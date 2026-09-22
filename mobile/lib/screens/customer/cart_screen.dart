import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:http/http.dart' as http;
import 'package:provider/provider.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../core/theme.dart';
import '../../providers/cart_provider.dart';
import '../../services/api_service.dart';
import '../../services/supabase_service.dart';
import '../../widgets/item_customization_sheet.dart';

class CartScreen extends StatefulWidget {
  const CartScreen({super.key});

  @override
  State<CartScreen> createState() => _CartScreenState();
}

class _CartScreenState extends State<CartScreen> {
  String _orderStatus = 'none';
  StreamSubscription? _orderSub;
  final TextEditingController _specialNotesController = TextEditingController();
  final TextEditingController _couponController = TextEditingController();

  List<Map<String, dynamic>> _tables = [];
  int? _selectedTableId;
  int _userLoyaltyPoints = 0;
  bool _useLoyaltyPoints = false;
  bool _isValidatingCoupon = false;
  bool _isSubmitting = false;

  Future<void> _handleEditCartItem(CartItem item) async {
    try {
      final menuItems = await SupabaseService.getMenuItems();
      final menuItem = menuItems.firstWhere(
        (m) => m['id'].toString() == item.id,
        orElse: () => {
          'id': item.id,
          'name': item.name,
          'price': item.basePrice,
          'image_url': item.imageUrl,
          'customizations': null,
        },
      );
      if (mounted) {
        ItemCustomizationSheet.show(
          context,
          menuItem: menuItem,
          editingCartItem: item,
        );
      }
    } catch (e) {
      debugPrint('Error opening customization sheet for edit: $e');
    }
  }
  final String _paymentMethod = 'pay_at_counter';

  @override
  void initState() {
    super.initState();
    _checkActiveOrder();
    _fetchTables();
    _fetchLoyaltyPoints();
  }

  @override
  void dispose() {
    _orderSub?.cancel();
    _specialNotesController.dispose();
    _couponController.dispose();
    super.dispose();
  }

  Future<void> _fetchTables() async {
    try {
      final data = await Supabase.instance.client
          .from('restaurant_tables')
          .select('id, table_number')
          .order('table_number', ascending: true);
      if (mounted) {
        setState(() {
          _tables = List<Map<String, dynamic>>.from(data);
        });
      }
    } catch (e) {
      debugPrint('Error fetching tables: $e');
    }
  }

  Future<void> _fetchLoyaltyPoints() async {
    final user = Supabase.instance.client.auth.currentUser;
    if (user == null) return;
    try {
      final data = await Supabase.instance.client
          .from('users')
          .select('loyalty_points')
          .eq('id', user.id)
          .maybeSingle();
      if (data != null && mounted) {
        setState(() {
          _userLoyaltyPoints = data['loyalty_points'] ?? 0;
        });
      }
    } catch (e) {
      debugPrint('Error fetching loyalty points: $e');
    }
  }

  Future<void> _checkActiveOrder() async {
    final user = Supabase.instance.client.auth.currentUser;
    if (user == null) return;
    try {
      final data = await Supabase.instance.client
          .from('orders')
          .select('id, status')
          .eq('user_id', user.id)
          .inFilter('status', ['pending', 'preparing', 'ready'])
          .order('created_at', ascending: false)
          .limit(1)
          .maybeSingle();

      if (data != null && mounted) {
        setState(() {
          _orderStatus = data['status'];
        });
        _listenToOrder(data['id']);
      }
    } catch (e) {
      debugPrint('Error checking active order: $e');
    }
  }

  void _listenToOrder(String orderId) {
    _orderSub?.cancel();
    _orderSub = Supabase.instance.client
        .from('orders')
        .stream(primaryKey: ['id'])
        .eq('id', orderId)
        .listen(
          (data) {
            if (data.isNotEmpty && mounted) {
              setState(() {
                _orderStatus = data.first['status'];
              });
            }
          },
          onError: (error) {
            debugPrint('CartScreen order stream error: $error');
          },
        );
  }

  Future<void> _applyCoupon() async {
    final code = _couponController.text.trim();
    if (code.isEmpty) return;

    final cart = context.read<CartProvider>();
    setState(() => _isValidatingCoupon = true);

    try {
      final res = await ApiService.validateCoupon(code, cart.totalAmount);
      final couponData = res['coupon'];
      final discount = (couponData['discount_amount'] as num).toDouble();

      cart.applyCoupon(couponData['code'], discount);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Promo "${couponData['code']}" applied! Saved LKR ${discount.toStringAsFixed(2)}'),
            backgroundColor: Colors.green,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e.toString().replaceAll('Exception: ', '')),
            backgroundColor: Colors.redAccent,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isValidatingCoupon = false);
    }
  }

  void _toggleLoyaltyPoints(bool? value) {
    final cart = context.read<CartProvider>();
    final checked = value ?? false;
    setState(() => _useLoyaltyPoints = checked);

    if (checked && _userLoyaltyPoints > 0) {
      // 1 point = 1 LKR, capped at cart total after coupon
      final maxApplicable = cart.totalAmount - cart.couponDiscount;
      final pointsToUse = _userLoyaltyPoints.clamp(0, maxApplicable.toInt());
      cart.setRedeemedPoints(pointsToUse, pointsToUse.toDouble());
    } else {
      cart.clearRedeemedPoints();
    }
  }

  Future<void> _submitOrder() async {
    final cart = context.read<CartProvider>();
    final user = Supabase.instance.client.auth.currentUser;

    if (user == null) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Please log in first')));
      return;
    }

    final effectiveTableId = cart.selectedTableId ?? _selectedTableId;

    // Check reservation if no table is selected
    String? reservationId;
    if (effectiveTableId == null) {
      final resData = await Supabase.instance.client
          .from('reservations')
          .select('id')
          .eq('user_id', user.id)
          .inFilter('status', ['pending', 'confirmed'])
          .order('created_at', ascending: false)
          .limit(1);

      reservationId = resData.isNotEmpty ? resData.first['id'] : null;

      if (reservationId == null) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Please scan a Table QR or select a table from the list.'),
              behavior: SnackBarBehavior.floating,
            ),
          );
        }
        return;
      }
    }

    setState(() => _isSubmitting = true);

    try {
      final idempotencyKey = '${user.id}_${DateTime.now().millisecondsSinceEpoch}';
      final token = Supabase.instance.client.auth.currentSession?.accessToken;

      final orderItems = cart.itemsList.map((item) => {
        'menu_item_id': int.tryParse(item.id) ?? item.id,
        'quantity': item.quantity,
        'unit_price': item.price,
        'item_notes': item.itemNotes,
        'selected_customizations': item.toSelectedCustomizationsJson(),
      }).toList();

      final response = await http.post(
        Uri.parse('${ApiService.baseUrl}/orders'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
          'Idempotency-Key': idempotencyKey,
        },
        body: jsonEncode({
          'reservation_id': reservationId,
          'table_id': effectiveTableId,
          'total_amount': cart.grandTotal,
          'payment_method': _paymentMethod,
          'coupon_code': cart.couponCode,
          'redeem_points': cart.redeemedPoints,
          'special_notes': _specialNotesController.text,
          'items': orderItems,
        }),
      );

      final respData = jsonDecode(response.body);

      if (response.statusCode == 201 || response.statusCode == 200) {
        final orderId = respData['order']['id'];

        if (mounted) {
          cart.clear();
          context.push('/order-tracker', extra: {'orderId': orderId.toString()});
        }
      } else {
        throw Exception(respData['error'] ?? 'Server error placing order');
      }
    } catch (e) {
      debugPrint('Error submitting order: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed: ${e.toString().replaceAll('Exception: ', '')}'),
            backgroundColor: Colors.redAccent,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final cart = context.watch<CartProvider>();
    final cartItems = cart.itemsList;

    return Scaffold(
      backgroundColor: AppTheme.background,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: AppTheme.white,
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(color: AppTheme.secondary.withValues(alpha: 0.1), blurRadius: 10),
              ],
            ),
            child: const Icon(Icons.arrow_back_ios_new, size: 18, color: AppTheme.secondary),
          ),
          onPressed: () {
            if (context.canPop()) {
              context.pop();
            } else {
              context.go('/menu');
            }
          },
        ),
        title: Text(
          'Your Order',
          style: Theme.of(context).textTheme.titleLarge?.copyWith(
            fontFamily: 'Playfair Display',
            fontWeight: FontWeight.bold,
          ),
        ),
        centerTitle: true,
      ),
      body: Stack(
        children: [
          Column(
            children: [
              if (_orderStatus != 'none') _buildStatusBanner(),
              Expanded(
                child: cartItems.isEmpty
                    ? _buildEmptyState()
                    : ListView(
                        padding: const EdgeInsets.fromLTRB(24, 16, 24, 280),
                        children: [
                          ...cartItems.map((item) => Padding(
                            padding: const EdgeInsets.only(bottom: 16.0),
                            child: _buildCartItem(
                              cart: cart,
                              item: item,
                            ),
                          )),
                          const SizedBox(height: 12),
                          _buildDiscountAndLoyaltySection(cart),
                        ],
                      ),
              ),
            ],
          ),
          if (cartItems.isNotEmpty)
            Positioned(
              left: 0,
              right: 0,
              bottom: 0,
              child: _buildCheckoutPanel(cart),
            ),
        ],
      ),
    );
  }

  Widget _buildDiscountAndLoyaltySection(CartProvider cart) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppTheme.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.black.withValues(alpha: 0.05)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Promo & Loyalty Rewards', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
          const SizedBox(height: 12),

          // Coupon Code Row
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _couponController,
                  textCapitalization: TextCapitalization.characters,
                  decoration: InputDecoration(
                    hintText: 'Enter Promo Code (e.g. WELCOME10)',
                    hintStyle: TextStyle(color: Colors.black.withValues(alpha: 0.35), fontSize: 13),
                    isDense: true,
                    filled: true,
                    fillColor: AppTheme.background,
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              if (cart.couponCode != null)
                IconButton(
                  tooltip: 'Remove coupon',
                  icon: const Icon(Icons.close, color: Colors.redAccent),
                  onPressed: () {
                    cart.removeCoupon();
                    _couponController.clear();
                  },
                )
              else
                ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.secondary,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  ),
                  onPressed: _isValidatingCoupon ? null : _applyCoupon,
                  child: _isValidatingCoupon
                      ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : const Text('Apply'),
                ),
            ],
          ),

          if (cart.couponCode != null) ...[
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: Colors.green.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Row(
                children: [
                  const Icon(Icons.local_offer, size: 16, color: Colors.green),
                  const SizedBox(width: 8),
                  Text(
                    'Code "${cart.couponCode}" applied: -LKR ${cart.couponDiscount.toStringAsFixed(2)}',
                    style: const TextStyle(color: Colors.green, fontWeight: FontWeight.bold, fontSize: 12),
                  ),
                ],
              ),
            ),
          ],

          const Padding(
            padding: EdgeInsets.symmetric(vertical: 12.0),
            child: Divider(height: 1),
          ),

          // Loyalty Points Checkbox
          Material(
            type: MaterialType.transparency,
            child: CheckboxListTile(
              contentPadding: EdgeInsets.zero,
              dense: true,
              activeColor: AppTheme.primary,
              value: _useLoyaltyPoints,
              onChanged: _userLoyaltyPoints > 0 ? _toggleLoyaltyPoints : null,
              title: Row(
                children: [
                  const Icon(Icons.stars, color: AppTheme.primary, size: 20),
                  const SizedBox(width: 8),
                  Text(
                    'Redeem Loyalty Points ($_userLoyaltyPoints pts)',
                    style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                  ),
                ],
              ),
              subtitle: _userLoyaltyPoints > 0
                  ? Text('Save up to LKR $_userLoyaltyPoints on this bill', style: const TextStyle(fontSize: 11))
                  : const Text('No points available to redeem', style: TextStyle(fontSize: 11, color: Colors.grey)),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCheckoutPanel(CartProvider cart) {
    final hasTable = cart.hasTableSelected;

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppTheme.white,
        borderRadius: const BorderRadius.only(topLeft: Radius.circular(28), topRight: Radius.circular(28)),
        boxShadow: [
          BoxShadow(
            color: AppTheme.secondary.withValues(alpha: 0.12),
            blurRadius: 30,
            offset: const Offset(0, -10),
          ),
        ],
      ),
      child: SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Table selection badge or dropdown
            if (hasTable)
              Container(
                margin: const EdgeInsets.only(bottom: 12),
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                decoration: BoxDecoration(
                  color: AppTheme.primary.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppTheme.primary.withValues(alpha: 0.3)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.table_restaurant, color: AppTheme.primary, size: 20),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        'Dine-in at Table #${cart.selectedTableNumber} (QR Linked)',
                        style: const TextStyle(color: AppTheme.primary, fontWeight: FontWeight.bold, fontSize: 14),
                      ),
                    ),
                    InkWell(
                      onTap: () => cart.clearTable(),
                      child: const Icon(Icons.close, size: 18, color: AppTheme.primary),
                    ),
                  ],
                ),
              )
            else if (_tables.isNotEmpty)
              Container(
                margin: const EdgeInsets.only(bottom: 12),
                padding: const EdgeInsets.symmetric(horizontal: 14),
                decoration: BoxDecoration(
                  color: AppTheme.background,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: DropdownButtonHideUnderline(
                  child: DropdownButton<int>(
                    isExpanded: true,
                    value: _selectedTableId,
                    hint: Text('Select Table (Or Scan QR)', style: TextStyle(color: AppTheme.secondary.withValues(alpha: 0.6))),
                    items: _tables.map((t) => DropdownMenuItem<int>(
                      value: t['id'],
                      child: Text('Table ${t['table_number']}'),
                    )).toList(),
                    onChanged: (val) {
                      setState(() => _selectedTableId = val);
                    },
                  ),
                ),
              ),

            // Payment Method (Fixed to Pay at Counter per master plan)
            Container(
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: AppTheme.background,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.black.withValues(alpha: 0.06)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.point_of_sale_rounded, color: AppTheme.secondary, size: 20),
                  const SizedBox(width: 10),
                  const Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Payment Method', style: TextStyle(fontSize: 11, color: Colors.grey, fontWeight: FontWeight.w600)),
                        Text('Pay at Counter (Cash / Card with Waiter)', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppTheme.secondary)),
                      ],
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: Colors.green.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: const Text('Dine-In', style: TextStyle(fontSize: 10, color: Colors.green, fontWeight: FontWeight.bold)),
                  ),
                ],
              ),
            ),

            // Financial Summary Breakdown
            _buildSummaryRow('Subtotal', 'LKR ${cart.totalAmount.toStringAsFixed(2)}'),
            if (cart.couponDiscount > 0)
              _buildSummaryRow('Promo Discount', '-LKR ${cart.couponDiscount.toStringAsFixed(2)}', isDiscount: true),
            if (cart.pointsDiscount > 0)
              _buildSummaryRow('Loyalty Points', '-LKR ${cart.pointsDiscount.toStringAsFixed(2)}', isDiscount: true),
            _buildSummaryRow('Service Charge (10%)', 'LKR ${cart.serviceCharge.toStringAsFixed(2)}'),
            _buildSummaryRow('VAT / Tax (8%)', 'LKR ${cart.taxAmount.toStringAsFixed(2)}'),

            const Padding(
              padding: EdgeInsets.symmetric(vertical: 8.0),
              child: Divider(),
            ),

            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Total Payable',
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                ),
                Text(
                  'LKR ${cart.grandTotal.toStringAsFixed(2)}',
                  style: const TextStyle(color: AppTheme.primary, fontSize: 22, fontWeight: FontWeight.bold),
                ),
              ],
            ),
            const SizedBox(height: 14),

            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _isSubmitting ? null : _submitOrder,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.primary,
                  foregroundColor: AppTheme.white,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  elevation: 6,
                ),
                child: _isSubmitting
                    ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5))
                    : const Text('Confirm & Place Order', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSummaryRow(String label, String value, {bool isDiscount = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3.0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: TextStyle(color: isDiscount ? Colors.green : Colors.black87, fontSize: 13),
          ),
          Text(
            value,
            style: TextStyle(
              color: isDiscount ? Colors.green : Colors.black87,
              fontWeight: isDiscount ? FontWeight.bold : FontWeight.w600,
              fontSize: 13,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCartItem({
    required CartProvider cart,
    required CartItem item,
  }) {
    final hasCustomizations = item.selectedSize != null ||
        item.selectedAddons.isNotEmpty ||
        (item.cookingPreference != null && item.cookingPreference!.isNotEmpty);

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppTheme.white,
        borderRadius: BorderRadius.circular(18),
        boxShadow: [
          BoxShadow(
            color: AppTheme.secondary.withValues(alpha: 0.04),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: Image.network(
                  item.imageUrl ?? 'https://via.placeholder.com/500',
                  width: 68,
                  height: 68,
                  fit: BoxFit.cover,
                  errorBuilder: (context, error, stackTrace) => Container(
                    width: 68,
                    height: 68,
                    color: Colors.grey.shade200,
                    child: const Icon(Icons.fastfood, color: Colors.grey),
                  ),
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Expanded(
                          child: Text(
                            item.name,
                            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                          ),
                        ),
                        Text(
                          'LKR ${(item.price * item.quantity).toStringAsFixed(0)}',
                          style: const TextStyle(color: AppTheme.primary, fontWeight: FontWeight.bold, fontSize: 15),
                        ),
                      ],
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'LKR ${item.price.toStringAsFixed(0)} each',
                      style: TextStyle(color: Colors.grey.shade600, fontSize: 12),
                    ),
                  ],
                ),
              ),
            ],
          ),

          // Customization Badges / Chips
          if (hasCustomizations || (item.itemNotes != null && item.itemNotes!.isNotEmpty)) ...[
            const SizedBox(height: 10),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppTheme.background.withValues(alpha: 0.6),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Wrap(
                    spacing: 6,
                    runSpacing: 6,
                    children: [
                      if (item.selectedSize != null)
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                          decoration: BoxDecoration(
                            color: AppTheme.primary.withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            item.selectedSize!['name'] ?? '',
                            style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppTheme.primary),
                          ),
                        ),
                      ...item.selectedAddons.map((addon) {
                        final name = addon['name'] ?? '';
                        final qty = (addon['qty'] as num?)?.toInt() ?? 1;
                        return Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                          decoration: BoxDecoration(
                            color: Colors.grey.shade200,
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            '+ $name${qty > 1 ? ' (x$qty)' : ''}',
                            style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Colors.grey.shade800),
                          ),
                        );
                      }),
                      if (item.cookingPreference != null && item.cookingPreference!.isNotEmpty)
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                          decoration: BoxDecoration(
                            color: Colors.amber.shade100,
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            '• ${item.cookingPreference!}',
                            style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.amber.shade900),
                          ),
                        ),
                    ],
                  ),
                  if (item.itemNotes != null && item.itemNotes!.isNotEmpty) ...[
                    const SizedBox(height: 6),
                    Text(
                      'Note: ${item.itemNotes}',
                      style: TextStyle(fontSize: 11, fontStyle: FontStyle.italic, color: Colors.grey.shade700),
                    ),
                  ],
                ],
              ),
            ),
          ],

          const SizedBox(height: 10),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              // Edit In-Place Action Button
              InkWell(
                onTap: () => _handleEditCartItem(item),
                borderRadius: BorderRadius.circular(8),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    border: Border.all(color: AppTheme.primary.withValues(alpha: 0.4)),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: const [
                      Icon(Icons.edit_outlined, size: 13, color: AppTheme.primary),
                      SizedBox(width: 4),
                      Text(
                        'Edit',
                        style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.primary),
                      ),
                    ],
                  ),
                ),
              ),

              // Stepper Quantity Controls
              Row(
                children: [
                  IconButton(
                    icon: const Icon(Icons.remove_circle_outline, size: 22),
                    onPressed: () => cart.updateQuantity(item.cartLineId, item.quantity - 1),
                  ),
                  Text('${item.quantity}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                  IconButton(
                    icon: const Icon(Icons.add_circle_outline, size: 22, color: AppTheme.primary),
                    onPressed: () => cart.updateQuantity(item.cartLineId, item.quantity + 1),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildStatusBanner() {
    Color statusColor;
    String statusText;
    IconData statusIcon;

    switch (_orderStatus) {
      case 'pending':
        statusColor = Colors.orange;
        statusText = 'Order Sent to Kitchen';
        statusIcon = Icons.schedule;
        break;
      case 'preparing':
        statusColor = Colors.blue;
        statusText = 'Chefs are Preparing';
        statusIcon = Icons.soup_kitchen;
        break;
      case 'ready':
        statusColor = Colors.green;
        statusText = 'Ready to Serve';
        statusIcon = Icons.check_circle;
        break;
      case 'served':
      default:
        statusColor = AppTheme.secondary;
        statusText = 'Served';
        statusIcon = Icons.done_all;
        break;
    }

    return Container(
      margin: const EdgeInsets.fromLTRB(24, 8, 24, 16),
      decoration: BoxDecoration(
        color: statusColor.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: statusColor.withValues(alpha: 0.3)),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: () => context.push('/order-tracker'),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
            child: Row(
              children: [
                Icon(statusIcon, color: statusColor, size: 20),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    statusText,
                    style: TextStyle(color: statusColor, fontWeight: FontWeight.bold, fontSize: 13.5),
                  ),
                ),
                Text(
                  'Live Tracker →',
                  style: TextStyle(color: statusColor, fontWeight: FontWeight.bold, fontSize: 12),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            padding: const EdgeInsets.all(28),
            decoration: BoxDecoration(
              color: AppTheme.white,
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(color: AppTheme.secondary.withValues(alpha: 0.05), blurRadius: 25),
              ],
            ),
            child: Icon(Icons.shopping_bag_outlined, size: 64, color: AppTheme.primary.withValues(alpha: 0.5)),
          ),
          const SizedBox(height: 20),
          const Text(
            'Your cart is empty',
            style: TextStyle(fontFamily: 'Playfair Display', fontWeight: FontWeight.bold, fontSize: 20),
          ),
          const SizedBox(height: 8),
          Text(
            'Select delicious dishes from the menu to get started.',
            style: TextStyle(color: Colors.black.withValues(alpha: 0.5), fontSize: 13),
          ),
          const SizedBox(height: 24),
          ElevatedButton(
            onPressed: () {
              if (context.canPop()) {
                context.pop();
              } else {
                context.go('/menu');
              }
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.primary,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 14),
            ),
            child: const Text('Browse Menu', style: TextStyle(fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }
}

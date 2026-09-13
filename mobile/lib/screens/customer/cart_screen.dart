import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme.dart';
import 'package:provider/provider.dart';
import '../../providers/cart_provider.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class CartScreen extends StatefulWidget {
  const CartScreen({super.key});

  @override
  State<CartScreen> createState() => _CartScreenState();
}

class _CartScreenState extends State<CartScreen> {
  String _orderStatus = 'none';

  void _submitOrder() async {
    setState(() {
      _orderStatus = 'pending';
    });

    final cart = context.read<CartProvider>();
    final user = Supabase.instance.client.auth.currentUser;
    
    if (user == null) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Please log in first')));
      setState(() => _orderStatus = 'none');
      return;
    }

    try {
      final resData = await Supabase.instance.client
          .from('reservations')
          .select('id')
          .eq('user_id', user.id)
          .inFilter('status', ['pending', 'confirmed'])
          .order('created_at', ascending: false)
          .limit(1);
          
      final queueData = await Supabase.instance.client
          .from('queue_entries')
          .select('id')
          .eq('user_id', user.id)
          .eq('status', 'waiting')
          .order('created_at', ascending: false)
          .limit(1);

      if (resData.isEmpty && queueData.isEmpty) {
        if (mounted) {
          setState(() => _orderStatus = 'none');
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('You must book a table or join the queue before ordering!')),
          );
        }
        return;
      }

      final reservationId = resData.isNotEmpty ? resData.first['id'] : null;
      final queueEntryId = queueData.isNotEmpty ? queueData.first['id'] : null;

      final orderResponse = await Supabase.instance.client.from('orders').insert({
        'user_id': user.id,
        if (reservationId != null) 'reservation_id': reservationId,
        if (reservationId == null && queueEntryId != null) 'queue_entry_id': queueEntryId,
        'total_amount': cart.totalAmount * 1.08,
        'status': 'pending',
      }).select().single();

      final orderId = orderResponse['id'];

      final orderItems = cart.itemsList.map((item) => {
        'order_id': orderId,
        'menu_item_id': item.id,
        'quantity': item.quantity,
        'unit_price': item.price,
      }).toList();

      await Supabase.instance.client.from('order_items').insert(orderItems);

      if (mounted) {
        cart.clear();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Text('Order sent to kitchen!'),
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          ),
        );
      }
    } catch (e) {
      debugPrint('Error submitting order: $e');
      if (mounted) {
        setState(() => _orderStatus = 'none');
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Failed to submit order.')));
      }
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
              ]
            ),
            child: const Icon(Icons.arrow_back_ios_new, size: 18, color: AppTheme.secondary),
          ),
          onPressed: () => context.pop(),
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
                        padding: const EdgeInsets.fromLTRB(24, 16, 24, 120),
                        children: [
                          ...cartItems.map((item) => Padding(
                            padding: const EdgeInsets.only(bottom: 16.0),
                            child: _buildCartItem(
                              cart: cart,
                              id: item.id,
                              title: item.name,
                              price: 'LKR ${item.price.toStringAsFixed(2)}',
                              quantity: item.quantity,
                              imageUrl: item.imageUrl ?? 'https://via.placeholder.com/500',
                            ),
                          )),
                          const SizedBox(height: 16),
                        ],
                      ),
              ),
            ],
          ),
          
          if (cartItems.isNotEmpty && _orderStatus == 'none')
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

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            padding: const EdgeInsets.all(32),
            decoration: BoxDecoration(
              color: AppTheme.white,
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(color: AppTheme.secondary.withValues(alpha: 0.05), blurRadius: 30)
              ]
            ),
            child: Icon(Icons.shopping_bag_outlined, size: 64, color: AppTheme.primary.withValues(alpha: 0.5)),
          ),
          const SizedBox(height: 24),
          Text(
            'Your cart is empty',
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
              fontFamily: 'Playfair Display',
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 12),
          Text(
            'Looks like you haven\'t added\nany dishes yet.',
            textAlign: TextAlign.center,
            style: TextStyle(color: AppTheme.secondary.withValues(alpha: 0.6), height: 1.5),
          ),
          const SizedBox(height: 32),
          ElevatedButton(
            onPressed: () => context.pop(),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.primary,
              foregroundColor: AppTheme.white,
              padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 16),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
            ),
            child: const Text('Browse Menu', style: TextStyle(fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  Widget _buildCheckoutPanel(CartProvider cart) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: AppTheme.white,
        borderRadius: const BorderRadius.only(topLeft: Radius.circular(32), topRight: Radius.circular(32)),
        boxShadow: [
          BoxShadow(
            color: AppTheme.secondary.withValues(alpha: 0.1),
            blurRadius: 30,
            offset: const Offset(0, -10),
          )
        ],
      ),
      child: SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            _buildSummaryRow('Subtotal', 'LKR ${cart.totalAmount.toStringAsFixed(2)}'),
            const SizedBox(height: 12),
            _buildSummaryRow('Taxes & Fees (8%)', 'LKR ${(cart.totalAmount * 0.08).toStringAsFixed(2)}'),
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 16.0),
              child: Divider(),
            ),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Total',
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold),
                ),
                Text(
                  'LKR ${(cart.totalAmount * 1.08).toStringAsFixed(2)}',
                  style: const TextStyle(color: AppTheme.primary, fontSize: 24, fontWeight: FontWeight.bold),
                ),
              ],
            ),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _submitOrder,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.primary,
                  foregroundColor: AppTheme.white,
                  padding: const EdgeInsets.symmetric(vertical: 18),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                  elevation: 10,
                  shadowColor: AppTheme.primary.withValues(alpha: 0.5),
                ),
                child: const Text('Confirm Order', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
              ),
            ),
          ],
        ),
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
      margin: const EdgeInsets.fromLTRB(24, 8, 24, 24),
      padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 20),
      decoration: BoxDecoration(
        color: statusColor.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: statusColor.withValues(alpha: 0.3)),
      ),
      child: Row(
        children: [
          Icon(statusIcon, color: statusColor),
          const SizedBox(width: 16),
          Text(
            statusText,
            style: TextStyle(
              color: statusColor,
              fontWeight: FontWeight.bold,
              fontSize: 16,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCartItem({
    required CartProvider cart,
    required String id,
    required String title,
    required String price,
    required int quantity,
    required String imageUrl,
  }) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppTheme.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: AppTheme.secondary.withValues(alpha: 0.04),
            blurRadius: 15,
            offset: const Offset(0, 5),
          )
        ],
      ),
      child: Row(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(16),
            child: Image.network(
              imageUrl,
              width: 90,
              height: 90,
              fit: BoxFit.cover,
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontFamily: 'Playfair Display',
                    fontWeight: FontWeight.bold,
                    fontSize: 18,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  price,
                  style: const TextStyle(color: AppTheme.primary, fontWeight: FontWeight.bold, fontSize: 15),
                ),
                const SizedBox(height: 12),
                if (_orderStatus == 'none')
                  Row(
                    children: [
                      MouseRegion(
                        cursor: SystemMouseCursors.click,
                        child: GestureDetector(
                          onTap: () => cart.updateQuantity(id, quantity - 1),
                          child: _buildQtyBtn(Icons.remove),
                        ),
                      ),
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        child: Text(quantity.toString(), style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                      ),
                      MouseRegion(
                        cursor: SystemMouseCursors.click,
                        child: GestureDetector(
                          onTap: () => cart.updateQuantity(id, quantity + 1),
                          child: _buildQtyBtn(Icons.add),
                        ),
                      ),
                    ],
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildQtyBtn(IconData icon) {
    return Container(
      padding: const EdgeInsets.all(6),
      decoration: BoxDecoration(
        color: AppTheme.background,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Icon(icon, size: 16, color: AppTheme.secondary),
    );
  }

  Widget _buildSummaryRow(String label, String value) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: TextStyle(color: AppTheme.secondary.withValues(alpha: 0.6), fontSize: 15)),
        Text(value, style: const TextStyle(color: AppTheme.secondary, fontWeight: FontWeight.w600, fontSize: 15)),
      ],
    );
  }
}

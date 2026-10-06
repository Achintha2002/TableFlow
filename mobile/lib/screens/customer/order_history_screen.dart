import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../services/api_service.dart';
import '../../widgets/guest_placeholder.dart';
import 'package:intl/intl.dart';

class OrderHistoryScreen extends StatefulWidget {
  const OrderHistoryScreen({super.key});

  @override
  State<OrderHistoryScreen> createState() => _OrderHistoryScreenState();
}

class _OrderHistoryScreenState extends State<OrderHistoryScreen> {
  bool _isLoading = true;
  List<Map<String, dynamic>> _orders = [];

  @override
  void initState() {
    super.initState();
    _fetchOrders();
  }

  Future<void> _fetchOrders() async {
    try {
      final userId = Supabase.instance.client.auth.currentUser?.id;
      if (userId == null) {
        if (mounted) setState(() => _isLoading = false);
        return;
      }

      final data = await Supabase.instance.client
          .from('orders')
          .select('*, order_items(*, menu_items(name)), reviews(rating, comment)')
          .eq('user_id', userId)
          .order('created_at', ascending: false);

      if (mounted) {
        setState(() {
          _orders = List<Map<String, dynamic>>.from(data);
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  Future<void> _submitReview(String orderId, int rating, String comment) async {
    final userId = Supabase.instance.client.auth.currentUser?.id;
    if (userId == null) return;

    bool success = false;
    String? lastError;
    final trimmedComment = comment.trim();

    // 1. Direct Supabase: check if review already exists for this order
    try {
      final existingReviews = await Supabase.instance.client
          .from('reviews')
          .select('id')
          .eq('order_id', orderId);

      if (existingReviews.isNotEmpty) {
        await Supabase.instance.client
            .from('reviews')
            .update({
              'rating': rating,
              'comment': trimmedComment,
              'user_id': userId,
            })
            .eq('order_id', orderId);
        success = true;
      } else {
        await Supabase.instance.client
            .from('reviews')
            .insert({
              'order_id': orderId,
              'user_id': userId,
              'rating': rating,
              'comment': trimmedComment,
            });
        success = true;
      }
    } catch (e) {
      lastError = e.toString();
      // Also try direct update if insert threw duplicate constraint
      try {
        await Supabase.instance.client
            .from('reviews')
            .update({
              'rating': rating,
              'comment': trimmedComment,
              'user_id': userId,
            })
            .eq('order_id', orderId);
        success = true;
      } catch (_) {}
    }

    // 2. Fallback to backend API (uses service role to bypass any RLS issue)
    if (!success) {
      try {
        final uri = Uri.parse('${ApiService.baseUrl}/reviews');
        final response = await http.post(
          uri,
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode({
            'order_id': orderId,
            'user_id': userId,
            'rating': rating,
            'comment': trimmedComment,
          }),
        );

        if (response.statusCode >= 200 && response.statusCode < 300) {
          success = true;
          lastError = null;
        } else {
          lastError ??= 'API response: ${response.statusCode}';
        }
      } catch (httpErr) {
        lastError ??= httpErr.toString();
      }
    }

    if (!mounted) return;

    if (success) {
      // Optimistically update local state so card displays stars immediately
      setState(() {
        final idx = _orders.indexWhere((o) => o['id'].toString() == orderId);
        if (idx != -1) {
          _orders[idx]['reviews'] = [
            {'rating': rating, 'comment': comment.trim()}
          ];
        }
      });

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Row(
            children: [
              Icon(Icons.check_circle_rounded, color: Colors.white, size: 20),
              SizedBox(width: 10),
              Text('Thank you! Review submitted successfully.'),
            ],
          ),
          backgroundColor: const Color(0xFF065F46),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
      );

      _fetchOrders();
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Could not submit review: ${lastError ?? "Please try again."}'),
          backgroundColor: Colors.red.shade700,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
      );
    }
  }

  void _showReviewDialog(String orderId, List<dynamic> items) {
    int selectedRating = 5;
    String comment = '';
    int? selectedItemId = items.isNotEmpty ? items.first['menu_item_id'] : null;

    showDialog(
      context: context,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return Dialog(
              backgroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
              insetPadding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
              child: Padding(
                padding: const EdgeInsets.all(24.0),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // Top glowing star icon
                    Container(
                      width: 58,
                      height: 58,
                      decoration: BoxDecoration(
                        color: const Color(0xFFFEF3C7),
                        shape: BoxShape.circle,
                        boxShadow: [
                          BoxShadow(
                            color: const Color(0xFFF59E0B).withValues(alpha: 0.25),
                            blurRadius: 16,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      child: const Icon(
                        Icons.star_rounded,
                        color: Color(0xFFD97706),
                        size: 32,
                      ),
                    ),
                    const SizedBox(height: 16),
                    const Text(
                      'Rate Your Dining',
                      style: TextStyle(
                        fontFamily: 'Playfair Display',
                        fontSize: 22,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF2C2420),
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'How was your culinary experience with us?',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 13,
                        color: Colors.grey.shade600,
                      ),
                    ),
                    const SizedBox(height: 20),

                    // Menu Item Selector (Optional, if items exist)
                    if (items.isNotEmpty) ...[
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFBF8F5),
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: const Color(0xFFEDE4DC)),
                        ),
                        child: DropdownButtonHideUnderline(
                          child: DropdownButton<int?>(
                            isExpanded: true,
                            value: selectedItemId,
                            icon: const Icon(Icons.keyboard_arrow_down, color: Color(0xFFC48858)),
                            items: [
                              ...items.map((item) {
                                return DropdownMenuItem<int?>(
                                  value: item['menu_item_id'],
                                  child: Text(
                                    item['menu_items']?['name'] ?? 'Dish Item',
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w600,
                                      fontSize: 14,
                                      color: Color(0xFF2C2420),
                                    ),
                                  ),
                                );
                              }),
                            ],
                            onChanged: (val) => setDialogState(() => selectedItemId = val),
                          ),
                        ),
                      ),
                      const SizedBox(height: 18),
                    ],

                    // Star Rating Bar
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: List.generate(5, (index) {
                        final isFilled = index < selectedRating;
                        return IconButton(
                          padding: const EdgeInsets.symmetric(horizontal: 4),
                          constraints: const BoxConstraints(),
                          icon: Icon(
                            isFilled ? Icons.star_rounded : Icons.star_outline_rounded,
                            color: isFilled ? const Color(0xFFF59E0B) : const Color(0xFFD1D5DB),
                            size: 38,
                          ),
                          onPressed: () => setDialogState(() => selectedRating = index + 1),
                        );
                      }),
                    ),
                    const SizedBox(height: 16),

                    // Comments Box
                    TextField(
                      decoration: InputDecoration(
                        hintText: 'Share your feedback or favorite flavors (optional)...',
                        hintStyle: TextStyle(color: Colors.grey.shade400, fontSize: 13),
                        filled: true,
                        fillColor: const Color(0xFFFBF8F5),
                        contentPadding: const EdgeInsets.all(14),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(14),
                          borderSide: const BorderSide(color: Color(0xFFEDE4DC)),
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(14),
                          borderSide: const BorderSide(color: Color(0xFFEDE4DC)),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(14),
                          borderSide: const BorderSide(color: Color(0xFFC48858), width: 1.5),
                        ),
                      ),
                      maxLines: 3,
                      onChanged: (val) => comment = val,
                    ),
                    const SizedBox(height: 24),

                    // Action Buttons
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton(
                            style: OutlinedButton.styleFrom(
                              foregroundColor: const Color(0xFF6B7280),
                              side: const BorderSide(color: Color(0xFFE5E7EB)),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                              padding: const EdgeInsets.symmetric(vertical: 14),
                            ),
                            onPressed: () => Navigator.pop(context),
                            child: const Text('Cancel', style: TextStyle(fontWeight: FontWeight.w600)),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Container(
                            decoration: BoxDecoration(
                              gradient: const LinearGradient(
                                colors: [Color(0xFFC48858), Color(0xFFA66C3E)],
                                begin: Alignment.topLeft,
                                end: Alignment.bottomRight,
                              ),
                              borderRadius: BorderRadius.circular(14),
                              boxShadow: [
                                BoxShadow(
                                  color: const Color(0xFFC48858).withValues(alpha: 0.35),
                                  blurRadius: 10,
                                  offset: const Offset(0, 4),
                                ),
                              ],
                            ),
                            child: ElevatedButton(
                              style: ElevatedButton.styleFrom(
                                backgroundColor: Colors.transparent,
                                shadowColor: Colors.transparent,
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                                padding: const EdgeInsets.symmetric(vertical: 14),
                              ),
                              onPressed: () {
                                Navigator.pop(context);
                                _submitReview(orderId, selectedRating, comment);
                              },
                              child: const Text(
                                'Submit',
                                style: TextStyle(
                                  fontWeight: FontWeight.bold,
                                  color: Colors.white,
                                  fontSize: 15,
                                ),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  Widget _buildStatusBadge(String status) {
    Color bg;
    Color fg;
    Color border;
    IconData icon;

    switch (status.toLowerCase()) {
      case 'served':
      case 'completed':
        bg = const Color(0xFFECFDF5);
        fg = const Color(0xFF047857);
        border = const Color(0xFFA7F3D0);
        icon = Icons.check_circle_rounded;
        break;
      case 'preparing':
      case 'confirmed':
        bg = const Color(0xFFFFFBEB);
        fg = const Color(0xFFB45309);
        border = const Color(0xFFFDE68A);
        icon = Icons.hourglass_top_rounded;
        break;
      case 'cancelled':
        bg = const Color(0xFFFEF2F2);
        fg = const Color(0xFFDC2626);
        border = const Color(0xFFFECACA);
        icon = Icons.cancel_rounded;
        break;
      default:
        bg = const Color(0xFFF3F4F6);
        fg = const Color(0xFF4B5563);
        border = const Color(0xFFE5E7EB);
        icon = Icons.info_outline_rounded;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: border, width: 1),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 13, color: fg),
          const SizedBox(width: 5),
          Text(
            status.toUpperCase(),
            style: TextStyle(
              color: fg,
              fontWeight: FontWeight.w700,
              fontSize: 11,
              letterSpacing: 0.5,
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFFDFBF7),
      appBar: AppBar(
        leading: Container(
          margin: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: Colors.white,
            shape: BoxShape.circle,
            border: Border.all(color: const Color(0xFFEDE4DC)),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.04),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: IconButton(
            icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Color(0xFF2C2420), size: 16),
            onPressed: () {
              if (context.canPop()) {
                context.pop();
              } else {
                context.go('/home');
              }
            },
          ),
        ),
        title: const Text(
          'Order History',
          style: TextStyle(
            fontFamily: 'Playfair Display',
            fontWeight: FontWeight.bold,
            color: Color(0xFF2C2420),
            fontSize: 22,
          ),
        ),
        centerTitle: true,
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      body: Supabase.instance.client.auth.currentUser == null
          ? GuestPlaceholder(
              title: 'Order History',
              description: 'Sign in to TableFlow to view your past dining receipts, track status, and submit meal reviews.',
              icon: Icons.receipt_long,
              onSignedIn: _fetchOrders,
            )
          : _isLoading
              ? const Center(
                  child: CircularProgressIndicator(
                    color: Color(0xFFC48858),
                  ),
                )
              : _orders.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Container(
                            padding: const EdgeInsets.all(24),
                            decoration: BoxDecoration(
                              color: const Color(0xFFFAF3EC),
                              shape: BoxShape.circle,
                              border: Border.all(color: const Color(0xFFEDE4DC)),
                            ),
                            child: const Icon(
                              Icons.receipt_long_rounded,
                              size: 48,
                              color: Color(0xFFC48858),
                            ),
                          ),
                          const SizedBox(height: 16),
                          const Text(
                            'No Past Orders Yet',
                            style: TextStyle(
                              fontFamily: 'Playfair Display',
                              fontSize: 20,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFF2C2420),
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'Your delicious dining moments and receipts\nwill appear right here.',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              fontSize: 14,
                              color: Colors.grey.shade600,
                              height: 1.4,
                            ),
                          ),
                        ],
                      ),
                    )
                  : ListView.builder(
                      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                      itemCount: _orders.length,
                      itemBuilder: (context, index) {
                        final order = _orders[index];
                        final date = DateTime.tryParse(order['created_at']) ?? DateTime.now();
                        final items = order['order_items'] as List<dynamic>? ?? [];
                        final reviews = order['reviews'] as List<dynamic>? ?? [];
                        final hasReviewed = reviews.isNotEmpty;
                        final orderIdStr = order['id'].toString();
                        final shortId = orderIdStr.length >= 6 ? orderIdStr.substring(0, 6) : orderIdStr;

                        return Container(
                          margin: const EdgeInsets.only(bottom: 18),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(color: const Color(0xFFEDE4DC), width: 1.2),
                            boxShadow: [
                              BoxShadow(
                                color: const Color(0xFF382314).withValues(alpha: 0.05),
                                blurRadius: 16,
                                offset: const Offset(0, 4),
                              ),
                            ],
                          ),
                          child: Padding(
                            padding: const EdgeInsets.all(18.0),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                // Top Row: Order ID & Status
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    Row(
                                      children: [
                                        Container(
                                          padding: const EdgeInsets.all(8),
                                          decoration: BoxDecoration(
                                            color: const Color(0xFFFAF3EC),
                                            borderRadius: BorderRadius.circular(10),
                                          ),
                                          child: const Icon(
                                            Icons.receipt_outlined,
                                            size: 18,
                                            color: Color(0xFFC48858),
                                          ),
                                        ),
                                        const SizedBox(width: 10),
                                        Text(
                                          'Order #$shortId',
                                          style: const TextStyle(
                                            fontWeight: FontWeight.bold,
                                            fontSize: 16,
                                            color: Color(0xFF2C2420),
                                            letterSpacing: 0.2,
                                          ),
                                        ),
                                      ],
                                    ),
                                    _buildStatusBadge(order['status'] ?? 'pending'),
                                  ],
                                ),
                                const SizedBox(height: 12),

                                // Date & Time
                                Row(
                                  children: [
                                    Icon(Icons.schedule_rounded, size: 14, color: Colors.grey.shade500),
                                    const SizedBox(width: 6),
                                    Text(
                                      DateFormat('MMM dd, yyyy • hh:mm a').format(date),
                                      style: TextStyle(
                                        color: Colors.grey.shade600,
                                        fontSize: 13,
                                        fontWeight: FontWeight.w500,
                                      ),
                                    ),
                                  ],
                                ),

                                const SizedBox(height: 14),

                                // Order items list container
                                if (items.isNotEmpty)
                                  Container(
                                    padding: const EdgeInsets.all(14),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFFFAF7F2),
                                      borderRadius: BorderRadius.circular(14),
                                      border: Border.all(color: const Color(0xFFF3ECE4)),
                                    ),
                                    child: Column(
                                      children: items.map((item) {
                                        return Padding(
                                          padding: const EdgeInsets.symmetric(vertical: 4.0),
                                          child: Row(
                                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                            children: [
                                              Expanded(
                                                child: Row(
                                                  children: [
                                                    Container(
                                                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                                      decoration: BoxDecoration(
                                                        color: const Color(0xFFEDE4DC),
                                                        borderRadius: BorderRadius.circular(6),
                                                      ),
                                                      child: Text(
                                                        '${item['quantity']}x',
                                                        style: const TextStyle(
                                                          fontSize: 11,
                                                          fontWeight: FontWeight.bold,
                                                          color: Color(0xFF8C5835),
                                                        ),
                                                      ),
                                                    ),
                                                    const SizedBox(width: 8),
                                                    Expanded(
                                                      child: Text(
                                                        item['menu_items']?['name'] ?? 'Menu Item',
                                                        style: const TextStyle(
                                                          fontSize: 13,
                                                          fontWeight: FontWeight.w600,
                                                          color: Color(0xFF374151),
                                                        ),
                                                        overflow: TextOverflow.ellipsis,
                                                      ),
                                                    ),
                                                  ],
                                                ),
                                              ),
                                              const SizedBox(width: 8),
                                              Text(
                                                'LKR ${item['unit_price']}',
                                                style: const TextStyle(
                                                  fontSize: 13,
                                                  fontWeight: FontWeight.w600,
                                                  color: Color(0xFF4B5563),
                                                ),
                                              ),
                                            ],
                                          ),
                                        );
                                      }).toList(),
                                    ),
                                  ),

                                const SizedBox(height: 14),

                                // Total Row
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
                                  child: Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      const Text(
                                        'Total Paid',
                                        style: TextStyle(
                                          fontSize: 14,
                                          fontWeight: FontWeight.w600,
                                          color: Color(0xFF6B7280),
                                        ),
                                      ),
                                      Text(
                                        'LKR ${order['total_amount']}',
                                        style: const TextStyle(
                                          fontWeight: FontWeight.bold,
                                          fontSize: 17,
                                          color: Color(0xFFC48858),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),

                                // Live tracking if not served or cancelled
                                if (order['status'] != 'served' && order['status'] != 'cancelled') ...[
                                  const SizedBox(height: 14),
                                  Container(
                                    width: double.infinity,
                                    decoration: BoxDecoration(
                                      gradient: const LinearGradient(
                                        colors: [Color(0xFFC48858), Color(0xFFA66C3E)],
                                        begin: Alignment.topLeft,
                                        end: Alignment.bottomRight,
                                      ),
                                      borderRadius: BorderRadius.circular(14),
                                      boxShadow: [
                                        BoxShadow(
                                          color: const Color(0xFFC48858).withValues(alpha: 0.3),
                                          blurRadius: 10,
                                          offset: const Offset(0, 4),
                                        ),
                                      ],
                                    ),
                                    child: Material(
                                      color: Colors.transparent,
                                      child: InkWell(
                                        borderRadius: BorderRadius.circular(14),
                                        onTap: () {
                                          context.push('/order-tracker', extra: {'orderId': orderIdStr});
                                        },
                                        child: const Padding(
                                          padding: EdgeInsets.symmetric(vertical: 13),
                                          child: Row(
                                            mainAxisAlignment: MainAxisAlignment.center,
                                            children: [
                                              Icon(Icons.room_service_outlined, size: 18, color: Colors.white),
                                              SizedBox(width: 8),
                                              Text(
                                                'Track Live Preparation',
                                                style: TextStyle(
                                                  fontWeight: FontWeight.bold,
                                                  color: Colors.white,
                                                  fontSize: 14,
                                                ),
                                              ),
                                            ],
                                          ),
                                        ),
                                      ),
                                    ),
                                  ),
                                ],

                                // Rate order button or reviewed banner
                                if (order['status'] == 'served' && !hasReviewed) ...[
                                  const SizedBox(height: 14),
                                  Container(
                                    width: double.infinity,
                                    decoration: BoxDecoration(
                                      gradient: const LinearGradient(
                                        colors: [Color(0xFFD49A6A), Color(0xFFB87848)],
                                        begin: Alignment.topLeft,
                                        end: Alignment.bottomRight,
                                      ),
                                      borderRadius: BorderRadius.circular(14),
                                      boxShadow: [
                                        BoxShadow(
                                          color: const Color(0xFFB87848).withValues(alpha: 0.28),
                                          blurRadius: 10,
                                          offset: const Offset(0, 4),
                                        ),
                                      ],
                                    ),
                                    child: Material(
                                      color: Colors.transparent,
                                      child: InkWell(
                                        borderRadius: BorderRadius.circular(14),
                                        onTap: () => _showReviewDialog(orderIdStr, items),
                                        child: const Padding(
                                          padding: EdgeInsets.symmetric(vertical: 13),
                                          child: Row(
                                            mainAxisAlignment: MainAxisAlignment.center,
                                            children: [
                                              Icon(Icons.star_rounded, color: Colors.white, size: 20),
                                              SizedBox(width: 8),
                                              Text(
                                                'Rate Order',
                                                style: TextStyle(
                                                  color: Colors.white,
                                                  fontWeight: FontWeight.bold,
                                                  fontSize: 14,
                                                  letterSpacing: 0.3,
                                                ),
                                              ),
                                            ],
                                          ),
                                        ),
                                      ),
                                    ),
                                  ),
                                ] else if (hasReviewed) ...[
                                  const SizedBox(height: 14),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFFF0FDF4),
                                      borderRadius: BorderRadius.circular(12),
                                      border: Border.all(color: const Color(0xFFBBF7D0)),
                                    ),
                                    child: Row(
                                      children: [
                                        const Icon(Icons.check_circle_rounded, color: Color(0xFF16A34A), size: 18),
                                        const SizedBox(width: 8),
                                        Text(
                                          'You rated this meal',
                                          style: TextStyle(
                                            color: Colors.grey.shade800,
                                            fontSize: 13,
                                            fontWeight: FontWeight.w600,
                                          ),
                                        ),
                                        const Spacer(),
                                        Row(
                                          children: List.generate(
                                            (reviews[0]['rating'] as num?)?.toInt() ?? 5,
                                            (i) => const Icon(Icons.star_rounded, size: 16, color: Color(0xFFF59E0B)),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                              ],
                            ),
                          ),
                        );
                      },
                    ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../core/theme.dart';
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
      if (userId == null) return;

      final data = await Supabase.instance.client
          .from('orders')
          .select('*, order_items(*, menu_items(name)), reviews(rating)')
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

  Future<void> _submitReview(String orderId, int itemId, int rating, String comment) async {
    final userId = Supabase.instance.client.auth.currentUser?.id;
    if (userId == null) return;
    try {
      await Supabase.instance.client.from('reviews').insert({
        'order_id': orderId,
        'user_id': userId,
        'menu_item_id': itemId,
        'rating': rating,
        'comment': comment,
      });
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Review submitted!')));
      _fetchOrders();
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
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
            return AlertDialog(
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
              title: const Text('Rate your meal'),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  DropdownButtonFormField<int>(
                    value: selectedItemId,
                    decoration: const InputDecoration(labelText: 'Item to rate'),
                    items: items.map((item) {
                      return DropdownMenuItem<int>(
                        value: item['menu_item_id'],
                        child: Text(item['menu_items']['name'] ?? 'Unknown Item'),
                      );
                    }).toList(),
                    onChanged: (val) => setDialogState(() => selectedItemId = val),
                  ),
                  const SizedBox(height: 16),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: List.generate(5, (index) {
                      return IconButton(
                        icon: Icon(
                          index < selectedRating ? Icons.star : Icons.star_border,
                          color: AppTheme.tertiary,
                          size: 32,
                        ),
                        onPressed: () => setDialogState(() => selectedRating = index + 1),
                      );
                    }),
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    decoration: const InputDecoration(
                      hintText: 'Any comments? (Optional)',
                      border: OutlineInputBorder(),
                    ),
                    maxLines: 3,
                    onChanged: (val) => comment = val,
                  )
                ],
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(context),
                  child: const Text('Cancel'),
                ),
                ElevatedButton(
                  onPressed: () {
                    if (selectedItemId != null) {
                      Navigator.pop(context);
                      _submitReview(orderId, selectedItemId!, selectedRating, comment);
                    }
                  },
                  child: const Text('Submit'),
                ),
              ],
            );
          },
        );
      }
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios, color: AppTheme.secondary),
          onPressed: () => context.pop(),
        ),
        title: Text(
          'Order History',
          style: Theme.of(context).textTheme.titleLarge?.copyWith(
            fontFamily: 'Playfair Display',
            fontWeight: FontWeight.bold,
          ),
        ),
        centerTitle: true,
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _orders.isEmpty
              ? const Center(child: Text('No past orders found.'))
              : ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: _orders.length,
                  itemBuilder: (context, index) {
                    final order = _orders[index];
                    final date = DateTime.tryParse(order['created_at']) ?? DateTime.now();
                    final items = order['order_items'] as List<dynamic>? ?? [];
                    final reviews = order['reviews'] as List<dynamic>? ?? [];
                    final hasReviewed = reviews.isNotEmpty;
                    
                    return Card(
                      margin: const EdgeInsets.only(bottom: 16),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                      child: Padding(
                        padding: const EdgeInsets.all(16.0),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(
                                  'Order #${order['id'].toString().substring(0, 6)}',
                                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                                ),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                                  decoration: BoxDecoration(
                                    color: order['status'] == 'served' ? Colors.green.withOpacity(0.1) : Colors.orange.withOpacity(0.1),
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                  child: Text(
                                    (order['status'] as String).toUpperCase(),
                                    style: TextStyle(
                                      color: order['status'] == 'served' ? Colors.green : Colors.orange,
                                      fontWeight: FontWeight.bold,
                                      fontSize: 12,
                                    ),
                                  ),
                                )
                              ],
                            ),
                            const SizedBox(height: 8),
                            Text(
                              DateFormat('MMM dd, yyyy - hh:mm a').format(date),
                              style: TextStyle(color: Colors.grey.shade600, fontSize: 13),
                            ),
                            const Divider(height: 24),
                            ...items.map((item) => Padding(
                              padding: const EdgeInsets.only(bottom: 8.0),
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Text('${item['quantity']}x ${item['menu_items']?['name'] ?? 'Item'}'),
                                  Text('LKR ${item['unit_price']}'),
                                ],
                              ),
                            )),
                            const SizedBox(height: 8),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                const Text('Total', style: TextStyle(fontWeight: FontWeight.bold)),
                                Text('LKR ${order['total_amount']}', style: const TextStyle(fontWeight: FontWeight.bold, color: AppTheme.primary)),
                              ],
                            ),
                            if (order['status'] == 'served' && !hasReviewed) ...[
                              const SizedBox(height: 16),
                              SizedBox(
                                width: double.infinity,
                                child: OutlinedButton(
                                  onPressed: () => _showReviewDialog(order['id'], items),
                                  child: const Text('Rate Order'),
                                ),
                              )
                            ] else if (hasReviewed) ...[
                              const SizedBox(height: 16),
                              Row(
                                children: [
                                  const Icon(Icons.check_circle, color: Colors.green, size: 16),
                                  const SizedBox(width: 8),
                                  Text('You rated this order ${reviews[0]['rating']} stars', style: TextStyle(color: Colors.grey.shade700, fontSize: 13)),
                                ],
                              )
                            ]
                          ],
                        ),
                      ),
                    );
                  },
                ),
    );
  }
}

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
  // Mock State: 'none', 'pending', 'preparing', 'ready', 'served'
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
      final orderResponse = await Supabase.instance.client.from('orders').insert({
        'user_id': user.id,
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
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Order sent to kitchen!')));
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
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, size: 20),
          onPressed: () => context.pop(),
        ),
        title: const Text('Your Pre-order'),
      ),
      body: Column(
        children: [
          if (_orderStatus != 'none') _buildStatusBanner(),
          
          Expanded(
            child: ListView(
              padding: const EdgeInsets.all(24.0),
              children: [
                if (cartItems.isEmpty)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 40),
                    child: Center(child: Text('Your cart is empty')),
                  ),
                ...cartItems.map((item) => Padding(
                  padding: const EdgeInsets.only(bottom: 20.0),
                  child: _buildCartItem(
                    cart: cart,
                    id: item.id,
                    title: item.name,
                    description: '',
                    price: '\$${item.price.toStringAsFixed(2)}',
                    quantity: item.quantity,
                    imageUrl: item.imageUrl ?? 'https://via.placeholder.com/500',
                  ),
                )),
                if (cartItems.isNotEmpty) ...[
                  const Divider(),
                  const SizedBox(height: 16),
                  
                  _buildSummaryRow('Subtotal', '\$${cart.totalAmount.toStringAsFixed(2)}'),
                  const SizedBox(height: 8),
                  _buildSummaryRow('Taxes & Fees', '\$${(cart.totalAmount * 0.08).toStringAsFixed(2)}'),
                  const SizedBox(height: 16),
                  const Divider(),
                  const SizedBox(height: 16),
                  
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'Total',
                        style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      Text(
                        '\$${(cart.totalAmount * 1.08).toStringAsFixed(2)}',
                        style: const TextStyle(
                          color: AppTheme.primary,
                          fontSize: 24,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 40),
                ],
              ],
            ),
          ),
          
          // Bottom Action
          if (_orderStatus == 'none')
            Container(
              padding: const EdgeInsets.all(24.0),
              decoration: BoxDecoration(
                color: AppTheme.white,
                boxShadow: [
                  BoxShadow(
                    color: AppTheme.secondary.withValues(alpha: 0.05),
                    offset: const Offset(0, -4),
                    blurRadius: 16,
                  ),
                ],
              ),
              child: ElevatedButton(
                onPressed: cart.items.isEmpty ? null : _submitOrder,
                child: const Text('Send Order to Kitchen'),
              ),
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
        statusText = 'Order Pending';
        statusIcon = Icons.schedule;
        break;
      case 'preparing':
        statusColor = Colors.blue;
        statusText = 'Kitchen is Preparing';
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
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 24),
      color: statusColor.withValues(alpha: 0.1),
      child: Row(
        children: [
          Icon(statusIcon, color: statusColor),
          const SizedBox(width: 12),
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
    required String description,
    required String price,
    required int quantity,
    required String imageUrl,
  }) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(8),
          child: Image.network(
            imageUrl,
            width: 80,
            height: 80,
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
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  fontFamily: 'Playfair Display',
                  fontSize: 18,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                description,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: AppTheme.secondary.withValues(alpha: 0.6),
                ),
              ),
              const SizedBox(height: 8),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    price,
                    style: const TextStyle(
                      color: AppTheme.primary,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                    if (_orderStatus == 'none')
                      Row(
                        children: [
                          GestureDetector(
                            onTap: () => cart.updateQuantity(id, quantity - 1),
                            child: _buildQtyBtn(Icons.remove),
                          ),
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 12),
                            child: Text(quantity.toString()),
                          ),
                          GestureDetector(
                            onTap: () => cart.updateQuantity(id, quantity + 1),
                            child: _buildQtyBtn(Icons.add),
                          ),
                        ],
                      ),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildQtyBtn(IconData icon) {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        border: Border.all(color: AppTheme.secondary.withValues(alpha: 0.2)),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Icon(icon, size: 16, color: AppTheme.secondary),
    );
  }

  Widget _buildSummaryRow(String label, String value) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: Theme.of(context).textTheme.bodyMedium,
        ),
        Text(
          value,
          style: const TextStyle(
            color: AppTheme.secondary,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    );
  }
}

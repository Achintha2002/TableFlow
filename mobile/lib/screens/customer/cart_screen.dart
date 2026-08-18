import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme.dart';

class CartScreen extends StatefulWidget {
  const CartScreen({super.key});

  @override
  State<CartScreen> createState() => _CartScreenState();
}

class _CartScreenState extends State<CartScreen> {
  // Mock State: 'none', 'pending', 'preparing', 'ready', 'served'
  String _orderStatus = 'none';

  void _submitOrder() {
    setState(() {
      _orderStatus = 'pending';
    });
    
    // Simulate real-time status updates for preview
    Future.delayed(const Duration(seconds: 3), () {
      if (mounted) setState(() => _orderStatus = 'preparing');
    });
  }

  @override
  Widget build(BuildContext context) {
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
                _buildCartItem(
                  title: 'Seared Hokkaido Scallops',
                  description: 'No pancetta dust.',
                  price: '\$28.00',
                  quantity: 1,
                  imageUrl: 'https://images.unsplash.com/photo-1599084993091-1cb5c0721cc6?q=80&w=200&auto=format&fit=crop',
                ),
                const SizedBox(height: 20),
                _buildCartItem(
                  title: 'Braised Short Rib',
                  description: 'Extra gravy.',
                  price: '\$42.00',
                  quantity: 1,
                  imageUrl: 'https://images.unsplash.com/photo-1544025162-d76694265947?q=80&w=200&auto=format&fit=crop',
                ),
                const SizedBox(height: 40),
                
                const Divider(),
                const SizedBox(height: 16),
                
                _buildSummaryRow('Subtotal', '\$70.00'),
                const SizedBox(height: 8),
                _buildSummaryRow('Taxes & Fees', '\$5.50'),
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
                    const Text(
                      '\$75.50',
                      style: TextStyle(
                        color: AppTheme.primary,
                        fontSize: 24,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 40),
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
                    color: AppTheme.secondary.withOpacity(0.05),
                    offset: const Offset(0, -4),
                    blurRadius: 16,
                  ),
                ],
              ),
              child: ElevatedButton(
                onPressed: _submitOrder,
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
      color: statusColor.withOpacity(0.1),
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
                  color: AppTheme.secondary.withOpacity(0.6),
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
                        _buildQtyBtn(Icons.remove),
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 12),
                          child: Text(quantity.toString()),
                        ),
                        _buildQtyBtn(Icons.add),
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
        border: Border.all(color: AppTheme.secondary.withOpacity(0.2)),
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

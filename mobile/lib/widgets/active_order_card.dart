import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../core/theme.dart';

class ActiveOrderCard extends StatefulWidget {
  const ActiveOrderCard({super.key});

  @override
  State<ActiveOrderCard> createState() => _ActiveOrderCardState();
}

class _ActiveOrderCardState extends State<ActiveOrderCard>
    with SingleTickerProviderStateMixin {
  late AnimationController _pulseController;
  late Animation<double> _pulseAnimation;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    )..repeat(reverse: true);

    _pulseAnimation = Tween<double>(begin: 0.85, end: 1.15).animate(
      CurvedAnimation(parent: _pulseController, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _pulseController.dispose();
    super.dispose();
  }

  bool _isAwaitingPaymentAudit(Map<String, dynamic> order) {
    final method = order['payment_method']?.toString();
    final paymentStatus = order['payment_status']?.toString();
    final notes = order['special_notes']?.toString().toLowerCase() ?? '';
    final isBank = method == 'bank_transfer' || notes.contains('bank transfer');
    return isBank && paymentStatus != 'paid';
  }

  String _getStatusTitle(String status, [Map<String, dynamic>? order]) {
    if (order != null && _isAwaitingPaymentAudit(order)) {
      return 'Payment Verification in Progress';
    }
    switch (status) {
      case 'pending':
        return 'Order Received by Kitchen';
      case 'preparing':
        return 'Chefs are Cooking Your Order';
      case 'ready':
        return 'Plated & Ready to Serve!';
      default:
        return 'Active Order';
    }
  }

  Color _getStatusColor(String status, [Map<String, dynamic>? order]) {
    if (order != null && _isAwaitingPaymentAudit(order)) {
      return const Color(0xFFD97706);
    }
    switch (status) {
      case 'pending':
        return Colors.orange;
      case 'preparing':
        return AppTheme.primary;
      case 'ready':
        return Colors.green;
      default:
        return AppTheme.primary;
    }
  }

  IconData _getStatusIcon(String status, [Map<String, dynamic>? order]) {
    if (order != null && _isAwaitingPaymentAudit(order)) {
      return Icons.hourglass_top_rounded;
    }
    switch (status) {
      case 'pending':
        return Icons.receipt_long_rounded;
      case 'preparing':
        return Icons.soup_kitchen_rounded;
      case 'ready':
        return Icons.dinner_dining_rounded;
      default:
        return Icons.restaurant;
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = Supabase.instance.client.auth.currentUser;
    if (user == null) return const SizedBox.shrink();

    return StreamBuilder<List<Map<String, dynamic>>>(
      stream: Supabase.instance.client
          .from('orders')
          .stream(primaryKey: ['id'])
          .eq('user_id', user.id)
          .order('created_at', ascending: false),
      builder: (context, snapshot) {
        if (!snapshot.hasData || snapshot.data == null) {
          return const SizedBox.shrink();
        }

        // Filter active orders
        final activeOrders = snapshot.data!.where((o) {
          final status = o['status']?.toString();
          return status == 'pending' || status == 'preparing' || status == 'ready';
        }).toList();

        if (activeOrders.isEmpty) {
          return const SizedBox.shrink();
        }

        return Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  ScaleTransition(
                    scale: _pulseAnimation,
                    child: Container(
                      width: 8,
                      height: 8,
                      decoration: const BoxDecoration(
                        shape: BoxShape.circle,
                        color: Colors.green,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    activeOrders.length == 1
                        ? 'Live Kitchen Tracker'
                        : 'Active Orders (${activeOrders.length})',
                    style: GoogleFonts.inter(
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 0.5,
                      color: AppTheme.secondary,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              ...activeOrders.map((order) {
                final orderId = order['id']?.toString() ?? '';
                final status = order['status']?.toString() ?? 'pending';
                final statusColor = _getStatusColor(status, order);
                final statusTitle = _getStatusTitle(status, order);
                final statusIcon = _getStatusIcon(status, order);
                final tableId = order['table_id'];

                return Container(
                  margin: const EdgeInsets.only(bottom: 8),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(18),
                    border: Border.all(
                      color: statusColor.withValues(alpha: 0.3),
                      width: 1.2,
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: statusColor.withValues(alpha: 0.10),
                        blurRadius: 14,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: Material(
                    color: Colors.transparent,
                    child: InkWell(
                      borderRadius: BorderRadius.circular(18),
                      onTap: () {
                        context.push('/order-tracker', extra: {'orderId': orderId});
                      },
                      child: Padding(
                        padding: const EdgeInsets.all(14),
                        child: Row(
                          children: [
                            Container(
                              width: 44,
                              height: 44,
                              decoration: BoxDecoration(
                                color: statusColor.withValues(alpha: 0.14),
                                shape: BoxShape.circle,
                              ),
                              child: Icon(statusIcon, color: statusColor, size: 22),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    statusTitle,
                                    style: const TextStyle(
                                      fontWeight: FontWeight.bold,
                                      fontSize: 13.5,
                                      color: AppTheme.secondary,
                                    ),
                                  ),
                                  const SizedBox(height: 3),
                                  Text(
                                    tableId != null
                                        ? 'Table #$tableId • #${orderId.substring(0, orderId.length > 8 ? 8 : orderId.length)}'
                                        : 'Dine-In • #${orderId.substring(0, orderId.length > 8 ? 8 : orderId.length)}',
                                    style: TextStyle(
                                      fontSize: 11,
                                      color: Colors.black.withValues(alpha: 0.55),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                              decoration: BoxDecoration(
                                color: statusColor,
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: const Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Text(
                                    'Track',
                                    style: TextStyle(
                                      fontSize: 11,
                                      fontWeight: FontWeight.bold,
                                      color: Colors.white,
                                    ),
                                  ),
                                  SizedBox(width: 4),
                                  Icon(Icons.arrow_forward_ios_rounded, size: 10, color: Colors.white),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                );
              }),
            ],
          ),
        );
      },
    );
  }
}

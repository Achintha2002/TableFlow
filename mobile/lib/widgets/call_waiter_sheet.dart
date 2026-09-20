import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../core/theme.dart';
import '../providers/cart_provider.dart';
import '../services/api_service.dart';

class CallWaiterSheet extends StatefulWidget {
  const CallWaiterSheet({super.key});

  static Future<void> show(BuildContext context) {
    return showModalBottomSheet(
      context: context,
      useRootNavigator: true,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (_) => const CallWaiterSheet(),
    );
  }

  @override
  State<CallWaiterSheet> createState() => _CallWaiterSheetState();
}

class _CallWaiterSheetState extends State<CallWaiterSheet> {
  bool _isLoading = false;

  Future<void> _sendRequest(String requestType, String label) async {
    final cart = context.read<CartProvider>();
    final tableId = cart.selectedTableId;
    final tableNum = cart.selectedTableNumber;

    if (tableId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please scan a Table QR code first before calling a waiter.'),
          behavior: SnackBarBehavior.floating,
        ),
      );
      Navigator.pop(context);
      return;
    }

    setState(() => _isLoading = true);

    try {
      await ApiService.submitServiceRequest(
        tableId: tableId,
        requestType: requestType,
      );

      if (!mounted) return;
      Navigator.pop(context);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Staff notified for Table #$tableNum: "$label". Someone will attend to you shortly!'),
          backgroundColor: Colors.green,
          behavior: SnackBarBehavior.floating,
        ),
      );
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e.toString().replaceAll('Exception: ', '')),
            backgroundColor: Colors.redAccent,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }

  Widget _buildRequestTile({
    required IconData icon,
    required String title,
    required String subtitle,
    required String type,
    required Color iconColor,
  }) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: AppTheme.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.black.withValues(alpha: 0.06)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: ListTile(
        leading: Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: iconColor.withValues(alpha: 0.12),
            shape: BoxShape.circle,
          ),
          child: Icon(icon, color: iconColor, size: 22),
        ),
        title: Text(
          title,
          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
        ),
        subtitle: Text(
          subtitle,
          style: TextStyle(color: Colors.black.withValues(alpha: 0.5), fontSize: 12),
        ),
        trailing: const Icon(Icons.arrow_forward_ios, size: 14, color: Colors.black38),
        onTap: _isLoading ? null : () => _sendRequest(type, title),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final cart = context.watch<CartProvider>();
    final tableNum = cart.selectedTableNumber ?? '—';

    return Container(
      padding: const EdgeInsets.fromLTRB(24, 16, 24, 36),
      decoration: const BoxDecoration(
        color: AppTheme.background,
        borderRadius: BorderRadius.only(
          topLeft: Radius.circular(28),
          topRight: Radius.circular(28),
        ),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Drag handle
          Center(
            child: Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.black26,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 20),

          // Header
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Table Assistance',
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      fontFamily: 'Playfair Display',
                      fontWeight: FontWeight.bold,
                      fontSize: 22,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Table #$tableNum • Press an option to notify staff',
                    style: TextStyle(color: Colors.black.withValues(alpha: 0.6), fontSize: 13),
                  ),
                ],
              ),
              if (_isLoading)
                const SizedBox(
                  width: 24,
                  height: 24,
                  child: CircularProgressIndicator(strokeWidth: 2.5, color: AppTheme.primary),
                ),
            ],
          ),
          const SizedBox(height: 24),

          _buildRequestTile(
            icon: Icons.person_pin,
            title: 'Call Waiter',
            subtitle: 'Request a server to visit your table',
            type: 'call_waiter',
            iconColor: AppTheme.primary,
          ),
          _buildRequestTile(
            icon: Icons.water_drop_outlined,
            title: 'Request Water',
            subtitle: 'Ask for water refill or fresh glasses',
            type: 'water',
            iconColor: Colors.blueAccent,
          ),
          _buildRequestTile(
            icon: Icons.cleaning_services_outlined,
            title: 'Clean Table',
            subtitle: 'Clear plates or clean up accidental spills',
            type: 'clean_table',
            iconColor: Colors.orangeAccent,
          ),
          _buildRequestTile(
            icon: Icons.receipt_long,
            title: 'Request Bill',
            subtitle: 'Ask cashier or waiter to bring the check',
            type: 'bill',
            iconColor: Colors.green,
          ),

          const SizedBox(height: 8),
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel', style: TextStyle(color: Colors.black54)),
          ),
        ],
      ),
    );
  }
}

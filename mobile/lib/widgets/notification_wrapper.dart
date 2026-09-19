import 'dart:async';
import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../core/theme.dart';
import '../core/routes.dart';
import '../services/fcm_service.dart';

class NotificationWrapper extends StatefulWidget {
  final Widget child;

  const NotificationWrapper({super.key, required this.child});

  @override
  State<NotificationWrapper> createState() => _NotificationWrapperState();
}

class _NotificationWrapperState extends State<NotificationWrapper> {
  StreamSubscription? _queueSub;
  StreamSubscription? _orderSub;
  StreamSubscription? _authSub;
  StreamSubscription? _fcmSub;
  String? _lastNotifiedQueueId;
  String? _lastNotifiedOrderId;

  @override
  void initState() {
    super.initState();
    _listenToRealtimeEvents();

    // Listen to foreground FCM messages
    _fcmSub = FCMService.onNotificationReceived.listen((payload) {
      if (!mounted) return;
      final type = payload['type'] as String? ?? 'general';
      final title = payload['title'] as String? ?? 'TableFlow';
      final body = payload['body'] as String? ?? '';
      _showInAppBanner(title, body, payload['data'] ?? {}, type);
    });

    // Re-bind subscriptions on auth changes
    _authSub = Supabase.instance.client.auth.onAuthStateChange.listen((data) {
      if (data.event == AuthChangeEvent.signedIn || data.event == AuthChangeEvent.tokenRefreshed) {
        _listenToRealtimeEvents();
      } else if (data.event == AuthChangeEvent.signedOut) {
        _cancelSubscriptions();
        FCMService.deregisterToken();
      }
    });
  }

  void _listenToRealtimeEvents() {
    final user = Supabase.instance.client.auth.currentUser;
    if (user == null) {
      _cancelSubscriptions();
      return;
    }

    // 1. Queue Notifications
    _queueSub?.cancel();
    _queueSub = Supabase.instance.client
        .from('queue_entries')
        .stream(primaryKey: ['id'])
        .eq('user_id', user.id)
        .listen(
          (data) {
            if (data.isEmpty) return;
            for (var entry in data) {
              if (entry['status'] == 'notified' && entry['id'] != _lastNotifiedQueueId) {
                _lastNotifiedQueueId = entry['id'] as String?;
                _showTurnAlert(entry);
              }
            }
          },
          onError: (error) {
            debugPrint('NotificationWrapper queue stream error: $error');
          },
        );

    // 2. Kitchen Order Ready Notifications
    _orderSub?.cancel();
    _orderSub = Supabase.instance.client
        .from('orders')
        .stream(primaryKey: ['id'])
        .eq('user_id', user.id)
        .listen(
          (data) {
            if (data.isEmpty) return;
            for (var order in data) {
              final status = order['status'] as String?;
              final orderId = order['id'] as String?;
              if (status == 'ready' && orderId != null && orderId != _lastNotifiedOrderId) {
                _lastNotifiedOrderId = orderId;
                _showOrderReadyAlert(order);
              }
            }
          },
          onError: (error) {
            debugPrint('NotificationWrapper orders stream error: $error');
          },
        );
  }

  void _cancelSubscriptions() {
    _queueSub?.cancel();
    _queueSub = null;
    _orderSub?.cancel();
    _orderSub = null;
  }

  void _showTurnAlert(Map<String, dynamic> entry) {
    if (!mounted) return;
    final pax = entry['pax'] ?? entry['party_size'] ?? 2;

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) {
        return AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          title: const Row(
            children: [
              Icon(Icons.notifications_active, color: AppTheme.primary, size: 28),
              SizedBox(width: 10),
              Text('Your Table is Ready!'),
            ],
          ),
          content: Text(
            'We have prepared a table for $pax guests! Please proceed to the reception desk.',
            style: const TextStyle(fontSize: 15, height: 1.4),
          ),
          actions: [
            ElevatedButton(
              onPressed: () {
                Navigator.of(ctx).pop();
                AppRoutes.router.go('/queue');
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.primary,
                foregroundColor: AppTheme.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
              child: const Text('View Waitlist Status'),
            ),
          ],
        );
      },
    );
  }

  void _showOrderReadyAlert(Map<String, dynamic> order) {
    if (!mounted) return;

    showDialog(
      context: context,
      builder: (ctx) {
        return AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          title: const Row(
            children: [
              Icon(Icons.restaurant, color: Color(0xFFD4AF37), size: 28),
              SizedBox(width: 10),
              Text('Order is Ready!'),
            ],
          ),
          content: const Text(
            'Your dishes are hot and ready to serve! Our team is bringing them to your table.',
            style: TextStyle(fontSize: 15, height: 1.4),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(),
              child: const Text('Dismiss', style: TextStyle(color: Colors.grey)),
            ),
            ElevatedButton(
              onPressed: () {
                Navigator.of(ctx).pop();
                AppRoutes.router.go('/order-status');
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.primary,
                foregroundColor: AppTheme.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
              child: const Text('View Order'),
            ),
          ],
        );
      },
    );
  }

  void _showInAppBanner(String title, String body, Map<String, dynamic> data, String type) {
    if (!mounted) return;

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        behavior: SnackBarBehavior.floating,
        margin: const EdgeInsets.all(16),
        backgroundColor: const Color(0xFF1E1E1E),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        content: Row(
          children: [
            Icon(
              type == 'order_ready'
                  ? Icons.restaurant
                  : (type == 'queue_ready' ? Icons.notifications_active : Icons.info_outline),
              color: AppTheme.secondary,
              size: 24,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.white)),
                  if (body.isNotEmpty)
                    Text(body, style: const TextStyle(fontSize: 13, color: Colors.white70), maxLines: 2),
                ],
              ),
            ),
          ],
        ),
        action: SnackBarAction(
          label: 'View',
          textColor: AppTheme.secondary,
          onPressed: () => FCMService.handleNotificationTap(data),
        ),
        duration: const Duration(seconds: 4),
      ),
    );
  }

  @override
  void dispose() {
    _authSub?.cancel();
    _fcmSub?.cancel();
    _cancelSubscriptions();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return widget.child;
  }
}

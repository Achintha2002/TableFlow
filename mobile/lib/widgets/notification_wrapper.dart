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
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
          contentPadding: EdgeInsets.zero,
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // ── Bright Illuminated Header ──
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 20),
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    colors: [Color(0xFF10B981), Color(0xFF047857)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
                ),
                child: Column(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.25),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.notifications_active_rounded, color: Colors.white, size: 36),
                    ),
                    const SizedBox(height: 12),
                    const Text(
                      'Your Table is Ready!',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                        fontSize: 22,
                      ),
                    ),
                  ],
                ),
              ),

              // ── Content & Step-by-Step Guidance ──
              Padding(
                padding: const EdgeInsets.all(20.0),
                child: Column(
                  children: [
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: const Color(0xFFECFDF5),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: const Color(0xFFA7F3D0)),
                      ),
                      child: Text(
                        'A dedicated table for $pax guests has been prepared and sanitized for your party!',
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          color: Color(0xFF065F46),
                          fontWeight: FontWeight.w600,
                          fontSize: 13,
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    const Align(
                      alignment: Alignment.centerLeft,
                      child: Text(
                        'Please follow these steps:',
                        style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF1F2937)),
                      ),
                    ),
                    const SizedBox(height: 8),
                    _buildAlertStep('1', 'Walk directly to the reception / front host stand.'),
                    const SizedBox(height: 6),
                    _buildAlertStep('2', 'Show your waitlist ticket to the host to be seated.'),
                    const SizedBox(height: 6),
                    _buildAlertStep('3', 'Your table is reserved for the next 10 minutes.'),
                    const SizedBox(height: 20),

                    // Big full-width button
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton.icon(
                        onPressed: () {
                          Navigator.of(ctx).pop();
                          AppRoutes.router.go('/queue');
                        },
                        icon: const Icon(Icons.check_circle_outline_rounded, size: 22),
                        label: const Text(
                          'Proceed to Host Stand',
                          style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                        ),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF10B981),
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 16),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                          elevation: 4,
                          shadowColor: const Color(0xFF10B981).withValues(alpha: 0.4),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  static Widget _buildAlertStep(String num, String text) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 20,
          height: 20,
          alignment: Alignment.center,
          decoration: const BoxDecoration(
            color: Color(0xFFE5E7EB),
            shape: BoxShape.circle,
          ),
          child: Text(num, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF374151))),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: Text(text, style: const TextStyle(fontSize: 13, color: Color(0xFF4B5563), height: 1.3)),
        ),
      ],
    );
  }

  void _showOrderReadyAlert(Map<String, dynamic> order) {
    if (!mounted) return;

    showDialog(
      context: context,
      builder: (ctx) {
        return AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
          contentPadding: EdgeInsets.zero,
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // ── Bright Amber Header ──
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 20),
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    colors: [Color(0xFFF59E0B), Color(0xFFD97706)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
                ),
                child: Column(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.25),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.restaurant_rounded, color: Colors.white, size: 36),
                    ),
                    const SizedBox(height: 12),
                    const Text(
                      'Your Food is Ready!',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                        fontSize: 22,
                      ),
                    ),
                  ],
                ),
              ),

              Padding(
                padding: const EdgeInsets.all(20.0),
                child: Column(
                  children: [
                    const Text(
                      'Fresh & hot dishes have been prepared by our kitchen team and are now on their way to your table!',
                      textAlign: TextAlign.center,
                      style: TextStyle(fontSize: 14, color: Color(0xFF4B5563), height: 1.4),
                    ),
                    const SizedBox(height: 20),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton.icon(
                        onPressed: () {
                          Navigator.of(ctx).pop();
                          AppRoutes.router.go('/order-status');
                        },
                        icon: const Icon(Icons.receipt_long_rounded, size: 20),
                        label: const Text('View Order Status', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFFF59E0B),
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 16),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                          elevation: 4,
                          shadowColor: const Color(0xFFF59E0B).withValues(alpha: 0.4),
                        ),
                      ),
                    ),
                    const SizedBox(height: 8),
                    TextButton(
                      onPressed: () => Navigator.of(ctx).pop(),
                      child: const Text('Dismiss', style: TextStyle(color: Colors.grey)),
                    ),
                  ],
                ),
              ),
            ],
          ),
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

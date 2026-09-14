import 'dart:async';
import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../core/theme.dart';
import '../core/routes.dart';

class NotificationWrapper extends StatefulWidget {
  final Widget child;
  
  const NotificationWrapper({super.key, required this.child});

  @override
  State<NotificationWrapper> createState() => _NotificationWrapperState();
}

class _NotificationWrapperState extends State<NotificationWrapper> {
  StreamSubscription? _queueSub;
  String? _lastNotifiedQueueId;
  
  StreamSubscription? _resSub;
  Map<String, String> _notifiedReplies = {};

  @override
  void initState() {
    super.initState();
    _listenToQueue();
    _listenToReservations();
  }

  void _listenToQueue() {
    final user = Supabase.instance.client.auth.currentUser;
    if (user == null) return;

    _queueSub = Supabase.instance.client
        .from('queue_entries')
        .stream(primaryKey: ['id'])
        .eq('user_id', user.id)
        .listen((data) {
      if (data.isEmpty) return;
      
      // Look for the active one
      for (var entry in data) {
        if (entry['status'] == 'notified' && entry['id'] != _lastNotifiedQueueId) {
          _lastNotifiedQueueId = entry['id'];
          _showTurnAlert(entry);
        }
      }
    });
  }

  void _listenToReservations() {
    final user = Supabase.instance.client.auth.currentUser;
    if (user == null) return;

    _resSub = Supabase.instance.client
        .from('reservations')
        .stream(primaryKey: ['id'])
        .eq('user_id', user.id)
        .listen((data) {
      if (data.isEmpty) return;
      
      for (var entry in data) {
        final reply = entry['admin_reply'] as String?;
        if (reply != null && reply.isNotEmpty) {
          if (_notifiedReplies[entry['id']] != reply) {
            _notifiedReplies[entry['id']] = reply;
            _showReplyAlert(reply);
          }
        }
      }
    });
  }

  void _showReplyAlert(String reply) {
    if (!mounted) return;
    
    final ctx = AppRoutes.rootNavigatorKey.currentContext;
    if (ctx == null) return;

    showDialog(
      context: ctx,
      builder: (dialogCtx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Row(
          children: [
            Icon(Icons.message, color: AppTheme.primary, size: 30),
            SizedBox(width: 10),
            Text('Message from Admin'),
          ],
        ),
        content: Text(reply, style: const TextStyle(fontSize: 16)),
        actions: [
          ElevatedButton(
            onPressed: () => Navigator.of(dialogCtx).pop(),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.primary,
              foregroundColor: AppTheme.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            child: const Text('OK'),
          )
        ],
      ),
    );
  }

  void _showTurnAlert(Map<String, dynamic> entry) {
    if (!mounted) return;
    
    final ctx = AppRoutes.rootNavigatorKey.currentContext;
    if (ctx == null) return;

    final partySize = entry['party_size'];
    
    showDialog(
      context: ctx,
      barrierDismissible: false,
      builder: (dialogCtx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Row(
          children: [
            Icon(Icons.notifications_active, color: AppTheme.primary, size: 30),
            SizedBox(width: 10),
            Text('It\'s Your Turn!'),
          ],
        ),
        content: Text(
          'Your table for $partySize is ready.\nPlease head to the host stand.',
          style: const TextStyle(fontSize: 16),
        ),
        actions: [
          ElevatedButton(
            onPressed: () => Navigator.of(dialogCtx).pop(),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.primary,
              foregroundColor: AppTheme.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            child: const Text('OK'),
          )
        ],
      ),
    );
  }

  @override
  void dispose() {
    _queueSub?.cancel();
    _resSub?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return widget.child;
  }
}

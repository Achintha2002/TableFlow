import 'dart:async';
import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../core/theme.dart';

class NotificationWrapper extends StatefulWidget {
  final Widget child;
  
  const NotificationWrapper({super.key, required this.child});

  @override
  State<NotificationWrapper> createState() => _NotificationWrapperState();
}

class _NotificationWrapperState extends State<NotificationWrapper> {
  StreamSubscription? _queueSub;
  String? _lastNotifiedQueueId;

  @override
  void initState() {
    super.initState();
    _listenToQueue();
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

  void _showTurnAlert(Map<String, dynamic> entry) {
    if (!mounted) return;
    
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) {
        return AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          title: const Row(
            children: [
              Icon(Icons.notifications_active, color: AppTheme.primary, size: 30),
              SizedBox(width: 10),
              Text('Your Table is Ready!'),
            ],
          ),
          content: Text(
            'Please head to the reception. We have prepared a table for ${entry['party_size']} people!',
            style: const TextStyle(fontSize: 16),
          ),
          actions: [
            ElevatedButton(
              onPressed: () {
                Navigator.of(ctx).pop();
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.primary,
                foregroundColor: AppTheme.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
              child: const Text('I am on my way'),
            )
          ],
        );
      },
    );
  }

  @override
  void dispose() {
    _queueSub?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return widget.child;
  }
}

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'dart:async';
import '../../core/theme.dart';

class QueueScreen extends StatefulWidget {
  const QueueScreen({super.key});

  @override
  State<QueueScreen> createState() => _QueueScreenState();
}

class _QueueScreenState extends State<QueueScreen> {
  bool _inQueue = false;
  int _position = 0;
  int _estimatedWaitTime = 0;
  int _totalWaiting = 0;
  bool _isLoading = true;
  String? _queueId;
  StreamSubscription? _queueSubscription;

  @override
  void initState() {
    super.initState();
    _checkQueueStatus();
  }

  @override
  void dispose() {
    _queueSubscription?.cancel();
    super.dispose();
  }

  Future<void> _checkQueueStatus() async {
    setState(() => _isLoading = true);
    final user = Supabase.instance.client.auth.currentUser;
    if (user == null) {
      if(mounted) setState(() => _isLoading = false);
      return;
    }

    try {
      // Check if user has an active queue entry
      final activeEntry = await Supabase.instance.client
          .from('queue_entries')
          .select()
          .eq('user_id', user.id)
          .inFilter('status', ['waiting', 'seated'])
          .order('created_at', ascending: false)
          .limit(1)
          .maybeSingle();

      if (activeEntry != null && activeEntry['status'] == 'waiting') {
        _inQueue = true;
        _queueId = activeEntry['id'];
        await _calculatePosition(activeEntry['created_at']);
        _setupSubscription();
      } else {
        _inQueue = false;
        await _calculateTotalWaiting();
        _setupSubscription();
      }
    } catch (e) {
      debugPrint('Error checking queue: $e');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _calculateTotalWaiting() async {
    try {
      final res = await Supabase.instance.client
          .from('queue_entries')
          .select('id')
          .eq('status', 'waiting');
      if (mounted) {
        setState(() {
          _totalWaiting = res.length;
        });
      }
    } catch(e) {
      debugPrint('Total waiting error: $e');
    }
  }

  Future<void> _calculatePosition(String joinedAt) async {
    try {
      final res = await Supabase.instance.client
          .from('queue_entries')
          .select('id')
          .eq('status', 'waiting')
          .lt('created_at', joinedAt);
      if (mounted) {
        setState(() {
          _position = res.length + 1;
          _estimatedWaitTime = _position * 5;
        });
      }
    } catch(e) {
      debugPrint('Position error: $e');
    }
  }

  void _setupSubscription() {
    _queueSubscription?.cancel();
    _queueSubscription = Supabase.instance.client
        .from('queue_entries')
        .stream(primaryKey: ['id'])
        .eq('status', 'waiting')
        .listen((data) {
          if (!mounted) return;
          if (_inQueue && _queueId != null) {
             try {
               final myEntry = data.firstWhere((e) => e['id'] == _queueId);
               _calculatePosition(myEntry['created_at']);
             } catch(e) {
               // We were seated, cancelled, or left (status no longer waiting)
               _checkQueueStatus();
             }
          } else {
             _calculateTotalWaiting();
          }
        });
  }

  Future<void> _joinQueue() async {
    final user = Supabase.instance.client.auth.currentUser;
    if (user == null) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Please log in')));
      return;
    }
    
    setState(() => _isLoading = true);
    try {
      final res = await Supabase.instance.client.from('queue_entries').insert({
        'user_id': user.id,
        'party_size': 2, // Hardcoded for simplicity
        'status': 'waiting'
      }).select().single();
      
      _inQueue = true;
      _queueId = res['id'];
      await _calculatePosition(res['created_at']);
      _setupSubscription();
    } catch (e) {
       debugPrint('Failed to join queue: $e');
       if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed: $e')));
    } finally {
       if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _leaveQueue() async {
    if (_queueId == null) return;
    setState(() => _isLoading = true);
    try {
      await Supabase.instance.client.from('queue_entries').update({'status': 'left'}).eq('id', _queueId!);
      _inQueue = false;
      _queueId = null;
      await _calculateTotalWaiting();
    } catch (e) {
      debugPrint('Error leaving queue: $e');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(32.0),
          child: _isLoading 
            ? const CircularProgressIndicator()
            : _inQueue ? _buildInQueueView() : _buildJoinQueueView(),
        ),
      ),
    );
  }

  Widget _buildJoinQueueView() {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Icon(Icons.people_outline, size: 80, color: AppTheme.primary.withValues(alpha: 0.5)),
        const SizedBox(height: 24),
        Text(
          'Join the Waitlist',
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.displayMedium?.copyWith(
            color: AppTheme.primary,
          ),
        ),
        const SizedBox(height: 16),
        Text(
          'Currently there are $_totalWaiting parties waiting. Estimated wait time is ${_totalWaiting * 5} minutes.',
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(height: 1.5),
        ),
        const SizedBox(height: 48),
        ElevatedButton(
          onPressed: _joinQueue,
          child: const Text('Join Waitlist Now'),
        ),
      ],
    );
  }

  Widget _buildInQueueView() {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Container(
          width: 150,
          height: 150,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: Border.all(color: AppTheme.primary, width: 4),
            color: AppTheme.primary.withValues(alpha: 0.05),
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                '$_position',
                style: const TextStyle(
                  fontSize: 48,
                  fontWeight: FontWeight.bold,
                  color: AppTheme.primary,
                ),
              ),
              const Text(
                'in line',
                style: TextStyle(
                  color: AppTheme.secondary,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 32),
        Text(
          'You are in the queue!',
          style: Theme.of(context).textTheme.titleLarge?.copyWith(
            fontFamily: 'Playfair Display',
          ),
        ),
        const SizedBox(height: 8),
        Text(
          'Estimated wait time: ~$_estimatedWaitTime mins',
          style: Theme.of(context).textTheme.bodyMedium,
        ),
        const SizedBox(height: 16),
        const Text(
          'We will notify you when your table is almost ready. You can browse the menu and pre-order while you wait.',
          textAlign: TextAlign.center,
          style: TextStyle(height: 1.5, color: Colors.grey),
        ),
        const SizedBox(height: 48),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            OutlinedButton(
              onPressed: () => context.go('/menu'),
              child: const Text('Browse Menu'),
            ),
            const SizedBox(width: 16),
            TextButton(
              onPressed: _leaveQueue,
              child: const Text('Leave Queue', style: TextStyle(color: Colors.red)),
            ),
          ],
        ),
      ],
    );
  }
}

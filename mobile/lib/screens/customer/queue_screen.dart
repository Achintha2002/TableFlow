
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

class _QueueScreenState extends State<QueueScreen> with SingleTickerProviderStateMixin {
  bool _inQueue = false;
  int _position = 0;
  int _estimatedWaitTime = 0;
  int _totalWaiting = 0;
  bool _isLoading = true;
  String? _queueId;
  StreamSubscription? _queueSubscription;

  late AnimationController _pulseController;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat(reverse: true);
    
    _checkQueueStatus();
  }

  @override
  void dispose() {
    _queueSubscription?.cancel();
    _pulseController.dispose();
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
        'party_size': 2,
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
      backgroundColor: AppTheme.background,
      body: Stack(
        children: [
          // Elegant subtle background shape
          Positioned(
            top: -100,
            right: -100,
            child: Container(
              width: 300,
              height: 300,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: AppTheme.primary.withValues(alpha: 0.1),
              ),
            ),
          ),
          
          SafeArea(
            child: Center(
              child: Padding(
                padding: const EdgeInsets.all(32.0),
                child: _isLoading 
                  ? const CircularProgressIndicator(color: AppTheme.primary)
                  : _inQueue ? _buildInQueueView() : _buildJoinQueueView(),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildJoinQueueView() {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          padding: const EdgeInsets.all(40),
          decoration: BoxDecoration(
            color: AppTheme.white.withValues(alpha: 0.6),
            shape: BoxShape.circle,
            border: Border.all(color: AppTheme.white, width: 2),
            boxShadow: [
              BoxShadow(
                color: AppTheme.secondary.withValues(alpha: 0.05),
                blurRadius: 40,
                offset: const Offset(0, 10),
              )
            ],
          ),
          child: Icon(Icons.people_alt, size: 80, color: AppTheme.primary),
        ),
        const SizedBox(height: 48),
        Text(
          'Join the Waitlist',
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.displayMedium?.copyWith(
            color: AppTheme.secondary,
            fontFamily: 'Playfair Display',
            fontWeight: FontWeight.bold,
          ),
        ),
        const SizedBox(height: 24),
        Container(
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            color: AppTheme.white,
            borderRadius: BorderRadius.circular(24),
            boxShadow: [
              BoxShadow(
                color: AppTheme.secondary.withValues(alpha: 0.05),
                blurRadius: 20,
                offset: const Offset(0, 5),
              )
            ]
          ),
          child: Column(
            children: [
              Text(
                '$_totalWaiting parties waiting',
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Estimated wait time is ~${_totalWaiting * 5} minutes.',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: AppTheme.secondary.withValues(alpha: 0.6),
                  height: 1.5,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 48),
        ElevatedButton(
          onPressed: _joinQueue,
          style: ElevatedButton.styleFrom(
            padding: const EdgeInsets.symmetric(vertical: 20),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
            elevation: 10,
            shadowColor: AppTheme.primary.withValues(alpha: 0.5),
          ),
          child: const Text('Join Waitlist Now', style: TextStyle(fontSize: 18)),
        ),
      ],
    );
  }

  Widget _buildInQueueView() {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        AnimatedBuilder(
          animation: _pulseController,
          builder: (context, child) {
            return Container(
              width: 220,
              height: 220,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: AppTheme.white,
                boxShadow: [
                  BoxShadow(
                    color: AppTheme.primary.withValues(alpha: 0.2 + (_pulseController.value * 0.3)),
                    blurRadius: 40 + (_pulseController.value * 20),
                    spreadRadius: _pulseController.value * 10,
                  ),
                  const BoxShadow(
                    color: Colors.white,
                    blurRadius: 10,
                    spreadRadius: 5,
                  ),
                ],
                border: Border.all(
                  color: AppTheme.primary.withValues(alpha: 0.3),
                  width: 2,
                ),
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    '$_position',
                    style: const TextStyle(
                      fontSize: 72,
                      fontWeight: FontWeight.bold,
                      color: AppTheme.primary,
                      height: 1.0,
                    ),
                  ),
                  Text(
                    'IN LINE',
                    style: TextStyle(
                      color: AppTheme.secondary.withValues(alpha: 0.6),
                      fontWeight: FontWeight.w800,
                      letterSpacing: 2,
                    ),
                  ),
                ],
              ),
            );
          },
        ),
        const SizedBox(height: 48),
        Text(
          'You\'re on the list!',
          style: Theme.of(context).textTheme.titleLarge?.copyWith(
            fontFamily: 'Playfair Display',
            fontSize: 28,
            fontWeight: FontWeight.bold,
          ),
        ),
        const SizedBox(height: 12),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
          decoration: BoxDecoration(
            color: AppTheme.primary.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(20),
          ),
          child: Text(
            'Estimated wait time: ~$_estimatedWaitTime mins',
            style: const TextStyle(
              color: AppTheme.primary,
              fontWeight: FontWeight.bold,
              fontSize: 16,
            ),
          ),
        ),
        const SizedBox(height: 32),
        Text(
          'We will notify you when your table is almost ready.\nPre-order your favorites while you wait.',
          textAlign: TextAlign.center,
          style: TextStyle(
            height: 1.6, 
            color: AppTheme.secondary.withValues(alpha: 0.6),
            fontSize: 15,
          ),
        ),
        const SizedBox(height: 48),
        Row(
          children: [
            Expanded(
              child: OutlinedButton(
                onPressed: () => context.go('/menu'),
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 18),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  side: BorderSide(color: AppTheme.secondary.withValues(alpha: 0.2)),
                ),
                child: const Text('Browse Menu'),
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: TextButton(
                onPressed: _leaveQueue,
                style: TextButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 18),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  backgroundColor: Colors.red.withValues(alpha: 0.05),
                ),
                child: const Text('Leave Queue', style: TextStyle(color: Colors.red, fontWeight: FontWeight.bold)),
              ),
            ),
          ],
        ),
      ],
    );
  }
}

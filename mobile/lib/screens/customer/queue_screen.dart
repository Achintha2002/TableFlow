
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
  int? _queueNumber;
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
          .order('joined_at', ascending: false)
          .limit(1)
          .maybeSingle();

      if (activeEntry != null && activeEntry['status'] == 'waiting') {
        _inQueue = true;
        _queueId = activeEntry['id'];
        _queueNumber = activeEntry['queue_number'];
        await _calculatePosition(_queueNumber ?? 0);
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

  Future<void> _calculatePosition(int queueNumber) async {
    try {
      final res = await Supabase.instance.client
          .from('queue_entries')
          .select('id')
          .eq('status', 'waiting')
          .lt('queue_number', queueNumber);
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
        .listen(
          (data) {
            if (!mounted) return;
            if (_inQueue && _queueId != null) {
              try {
                final myEntry = data.firstWhere((e) => e['id'] == _queueId);
                _queueNumber = myEntry['queue_number'];
                _calculatePosition(_queueNumber ?? 0);
              } catch (e) {
                _checkQueueStatus();
              }
            } else {
              _calculateTotalWaiting();
            }
          },
          onError: (error) {
            debugPrint('QueueScreen stream error: $error');
          },
        );
  }

  Future<void> _joinQueue() async {
    final user = Supabase.instance.client.auth.currentUser;
    if (user == null) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Please log in')));
      return;
    }
    
    // Ask for pax
    int pax = 2; // Default
    final selectedPax = await showModalBottomSheet<int>(
      context: context,
      useRootNavigator: true,
      backgroundColor: Colors.transparent,
      builder: (context) {
        int tempPax = 2;
        return StatefulBuilder(
          builder: (context, setSheetState) {
            return Container(
              padding: const EdgeInsets.all(24),
              decoration: const BoxDecoration(
                color: AppTheme.white,
                borderRadius: BorderRadius.only(topLeft: Radius.circular(32), topRight: Radius.circular(32)),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text('Party Size', style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold, color: AppTheme.primary)),
                  const SizedBox(height: 24),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      IconButton(
                        onPressed: () => setSheetState(() => tempPax = tempPax > 1 ? tempPax - 1 : 1),
                        icon: const Icon(Icons.remove_circle_outline, size: 40, color: AppTheme.secondary),
                      ),
                      const SizedBox(width: 24),
                      Text('$tempPax', style: const TextStyle(fontSize: 40, fontWeight: FontWeight.bold)),
                      const SizedBox(width: 24),
                      IconButton(
                        onPressed: () => setSheetState(() => tempPax = tempPax < 20 ? tempPax + 1 : 20),
                        icon: const Icon(Icons.add_circle_outline, size: 40, color: AppTheme.primary),
                      ),
                    ],
                  ),
                  const SizedBox(height: 32),
                  ElevatedButton(
                    onPressed: () => Navigator.pop(context, tempPax),
                    style: ElevatedButton.styleFrom(
                      minimumSize: const Size(double.infinity, 56),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    ),
                    child: const Text('Confirm', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                  ),
                  SizedBox(height: MediaQuery.of(context).padding.bottom),
                ],
              ),
            );
          }
        );
      }
    );

    if (selectedPax == null) return;
    pax = selectedPax;

    setState(() => _isLoading = true);
    try {
      final res = await Supabase.instance.client.from('queue_entries').insert({
        'user_id': user.id,
        'pax': pax,
        'status': 'waiting'
      }).select().single();
      
      _inQueue = true;
      _queueId = res['id'];
      _queueNumber = res['queue_number'];
      await _calculatePosition(_queueNumber ?? 0);
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
      await Supabase.instance.client.from('queue_entries').update({'status': 'cancelled'}).eq('id', _queueId!);
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
    return SingleChildScrollView(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
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
      ),
    );
  }

  Widget _buildInQueueView() {
    const primaryColor = Color(0xFFB87F5C);
    final pos = _position > 0 ? _position : 1;
    final waitMins = _estimatedWaitTime > 0 ? _estimatedWaitTime : pos * 5;

    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          // Live status badge bar
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'CURRENT QUEUE STATUS',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1.2,
                  color: Color(0xFF8C827A),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: const Color(0xFF10B981).withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Row(
                  children: const [
                    Icon(Icons.circle, color: Color(0xFF10B981), size: 6),
                    SizedBox(width: 4),
                    Text(
                      'Live',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF10B981),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),

          // Central Ticket Card
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(vertical: 28, horizontal: 20),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(22),
              border: Border.all(color: const Color(0xFFEBE5DF)),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.03),
                  blurRadius: 14,
                  offset: const Offset(0, 6),
                ),
              ],
            ),
            child: Column(
              children: [
                Container(
                  width: 54,
                  height: 54,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: const Color(0xFFF7F3EE),
                  ),
                  child: const Icon(Icons.people_outline, color: primaryColor, size: 28),
                ),
                const SizedBox(height: 14),
                const Text(
                  "You're in the queue",
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF8C827A),
                  ),
                ),
                const SizedBox(height: 10),
                Text(
                  '#$pos',
                  style: const TextStyle(
                    fontFamily: 'Playfair Display',
                    fontSize: 52,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF1E1E1E),
                    height: 1.0,
                  ),
                ),
                const SizedBox(height: 4),
                const Text(
                  'YOUR POSITION',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 1.5,
                    color: Color(0xFF8C827A),
                  ),
                ),
                const SizedBox(height: 16),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF7F3EE),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: const Color(0xFFEBE5DF)),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.access_time, color: primaryColor, size: 14),
                      const SizedBox(width: 6),
                      Text(
                        'Estimated waiting time  ~ $waitMins minutes',
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF1E1E1E),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),

          // Queue Details Header
          const Align(
            alignment: Alignment.centerLeft,
            child: Text(
              'QUEUE DETAILS',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                letterSpacing: 1.2,
                color: Color(0xFF8C827A),
              ),
            ),
          ),
          const SizedBox(height: 12),

          // Queue Details Card
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFFEBE5DF)),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.02),
                  blurRadius: 8,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Column(
              children: [
                _buildQueueDetailRow(
                  icon: Icons.people_outline,
                  label: 'Party size',
                  value: '2 People',
                ),
                const Divider(height: 20, color: Color(0xFFF3ECE6)),
                _buildQueueDetailRow(
                  icon: Icons.calendar_today_outlined,
                  label: 'Date & time',
                  value: 'Today, ${TimeOfDay.now().format(context)}',
                ),
                const Divider(height: 20, color: Color(0xFFF3ECE6)),
                _buildQueueDetailRow(
                  icon: Icons.home_outlined,
                  label: 'Restaurant',
                  value: 'The Green Table',
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // View Restaurant Status Action Button
          SizedBox(
            width: double.infinity,
            height: 52,
            child: OutlinedButton(
              onPressed: () => context.push('/restaurant-status'),
              style: OutlinedButton.styleFrom(
                side: const BorderSide(color: Color(0xFFD4CDC5), width: 1.2),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: const [
                  Text(
                    'View Restaurant Status',
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF1E1E1E),
                    ),
                  ),
                  SizedBox(width: 6),
                  Icon(Icons.chevron_right, size: 18, color: Color(0xFF8C827A)),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),

          // Leave Queue Text Button
          TextButton(
            onPressed: _leaveQueue,
            child: const Text(
              'Leave Queue',
              style: TextStyle(
                color: Color(0xFFEF4444),
                fontWeight: FontWeight.w600,
                fontSize: 13,
              ),
            ),
          ),
          const SizedBox(height: 12),

          // Bottom description note
          const Text(
            'Real-time queue information area\nUpdates automatically when queue position changes',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 11,
              color: Color(0xFFA59D95),
              height: 1.4,
            ),
          ),
          const SizedBox(height: 20),
        ],
      ),
    );
  }

  Widget _buildQueueDetailRow({
    required IconData icon,
    required String label,
    required String value,
  }) {
    const primaryColor = Color(0xFFB87F5C);

    return Row(
      children: [
        Icon(icon, color: primaryColor, size: 18),
        const SizedBox(width: 12),
        Text(
          label,
          style: const TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w500,
            color: Color(0xFF8C827A),
          ),
        ),
        const Spacer(),
        Text(
          value,
          style: const TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w700,
            color: Color(0xFF1E1E1E),
          ),
        ),
      ],
    );
  }
}


import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:http/http.dart' as http;
import 'dart:async';
import 'dart:convert';
import '../../core/theme.dart';
import '../../core/constants.dart';
import '../../core/routes.dart';
import '../../services/api_service.dart';
import '../../services/operating_hours_service.dart';
import '../../utils/auth_guard.dart';

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

  // Availability gate state
  int _availableTablesForParty = -1;  // -1 = not yet checked
  bool _checkingAvailability = false;

  late AnimationController _pulseController;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat(reverse: true);
    
    OperatingHoursService().addListener(_onHoursUpdated);
    _checkQueueStatus();
  }

  void _onHoursUpdated() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    OperatingHoursService().removeListener(_onHoursUpdated);
    _queueSubscription?.cancel();
    _pulseController.dispose();
    super.dispose();
  }

  Future<void> _checkQueueStatus() async {
    setState(() => _isLoading = true);
    final user = Supabase.instance.client.auth.currentUser;
    if (user == null) {
      // Guest user - still calculate aggregate waiting count for privacy-safe live display
      await _calculateTotalWaiting();
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
    // 1. First attempt privacy-safe aggregate endpoint
    try {
      final res = await http.get(Uri.parse('${ApiService.baseUrl}/queue/public-status'));
      if (res.statusCode == 200) {
        final data = json.decode(res.body);
        if (mounted) {
          setState(() {
            _totalWaiting = data['peopleWaiting'] ?? 0;
          });
        }
        return;
      }
    } catch (e) {
      debugPrint('Public queue status fetch error: $e');
    }

    // 2. Direct fallback
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
      debugPrint('Total waiting fallback error: $e');
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

  // -------------------------------------------------------
  // Check availability for a given party size via backend
  // -------------------------------------------------------
  Future<int> _checkAvailabilityForPax(int pax) async {
    try {
      final uri = Uri.parse('${AppConstants.backendUrl}/api/tables/availability?pax=$pax');
      final response = await http.get(uri).timeout(const Duration(seconds: 6));
      if (response.statusCode == 200) {
        final body = jsonDecode(response.body);
        return (body['availableCount'] as int? ?? 0);
      }
    } catch (e) {
      debugPrint('Availability check error: $e');
    }
    // On network error, fail-open (allow joining)
    return 0;
  }

  // -------------------------------------------------------
  // Show "Tables are available" blocking dialog
  // -------------------------------------------------------
  void _showTablesAvailableDialog(int pax, int availableCount) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        contentPadding: EdgeInsets.zero,
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Bright illuminated header
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 20),
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  colors: [Color(0xFF10B981), Color(0xFF059669)],
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
                    child: const Icon(Icons.table_restaurant_rounded, color: Colors.white, size: 36),
                  ),
                  const SizedBox(height: 12),
                  const Text(
                    'Tables Available Right Now!',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                      fontSize: 20,
                    ),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(20.0),
              child: Column(
                children: [
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: const Color(0xFFECFDF5),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: const Color(0xFFA7F3D0)),
                    ),
                    child: Text(
                      'Great news! $availableCount ${availableCount == 1 ? 'table is' : 'tables are'} open for a party of $pax without waiting in line.',
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        color: Color(0xFF065F46),
                        fontWeight: FontWeight.w600,
                        fontSize: 14,
                        height: 1.4,
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  const Align(
                    alignment: Alignment.centerLeft,
                    child: Text(
                      'What to do next:',
                      style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF1F2937)),
                    ),
                  ),
                  const SizedBox(height: 8),
                  _buildStepRow('1', 'Walk directly inside to the host reception counter.'),
                  const SizedBox(height: 6),
                  _buildStepRow('2', 'Scan the QR code on any free table to order immediately.'),
                  const SizedBox(height: 20),

                  // Large prominent Action Button
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton.icon(
                      onPressed: () {
                        Navigator.pop(dialogContext);
                        context.go('/home');
                      },
                      icon: const Icon(Icons.restaurant_menu_rounded, size: 22),
                      label: const Text(
                        'Proceed to Dine In',
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
                  const SizedBox(height: 8),
                  TextButton(
                    onPressed: () => Navigator.pop(dialogContext),
                    child: const Text('View Waitlist Anyway', style: TextStyle(color: Colors.grey, fontSize: 13)),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  static Widget _buildStepRow(String num, String text) {
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

  bool get _isRestaurantOpen {
    return OperatingHoursService().isCurrentlyOpen();
  }

  void _showClosedDialog() {
    final svc = OperatingHoursService();
    final isClosedToday = !svc.isOpenToday;
    final title = isClosedToday ? 'Restaurant Closed Today' : 'Restaurant is Currently Closed';
    final message = isClosedToday
        ? 'TableFlow is closed for today (${svc.todayClosureReason ?? 'Special Occasion'}).\n\nOur doors will reopen tomorrow morning at ${svc.openTimeFormatted}.\nYou can book a table in advance for upcoming dates.'
        : 'Operating hours are daily from ${svc.operatingHoursString}.\nThe live waitlist queue is open only during working hours.\n\nYou can book a table in advance for upcoming hours.';

    showModalBottomSheet(
      context: context,
      useRootNavigator: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        padding: const EdgeInsets.fromLTRB(24, 16, 24, 28),
        decoration: const BoxDecoration(
          color: AppTheme.white,
          borderRadius: BorderRadius.only(
            topLeft: Radius.circular(28),
            topRight: Radius.circular(28),
          ),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 44,
              height: 5,
              decoration: BoxDecoration(
                color: Colors.grey.shade300,
                borderRadius: BorderRadius.circular(10),
              ),
            ),
            const SizedBox(height: 20),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: const Color(0xFFC48858).withValues(alpha: 0.15),
                shape: BoxShape.circle,
              ),
              child: Icon(
                isClosedToday ? Icons.store_mall_directory_rounded : Icons.access_time_filled_rounded,
                color: const Color(0xFFC48858),
                size: 36,
              ),
            ),
            const SizedBox(height: 16),
            Text(
              title,
              style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: AppTheme.primary),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 10),
            Text(
              message,
              style: TextStyle(fontSize: 14, color: Colors.grey.shade700, height: 1.4),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            ElevatedButton.icon(
              icon: const Icon(Icons.table_restaurant),
              label: const Text('Reserve a Table in Advance', style: TextStyle(fontWeight: FontWeight.bold)),
              style: ElevatedButton.styleFrom(
                minimumSize: const Size(double.infinity, 50),
                backgroundColor: const Color(0xFFC48858),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
              onPressed: () {
                Navigator.pop(ctx);
                context.push(AppRoutes.tableSelection);
              },
            ),
            const SizedBox(height: 8),
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Close', style: TextStyle(color: Colors.grey)),
            ),
            SizedBox(height: MediaQuery.of(ctx).padding.bottom),
          ],
        ),
      ),
    );
  }

  Future<void> _joinQueue() async {
    if (!_isRestaurantOpen) {
      _showClosedDialog();
      return;
    }

    var user = Supabase.instance.client.auth.currentUser;
    if (user == null) {
      final loggedIn = await AuthGuard.requireAuth(
        context,
        actionTitle: 'Join the Queue',
        actionSubtitle: 'Sign in to TableFlow to join the waitlist and receive real-time table alerts.',
      );
      if (!loggedIn || !mounted) return;
      user = Supabase.instance.client.auth.currentUser;
      if (user == null) return;
    }
    
    // ── Step 1: Pick party size ──────────────────────────
    int pax = 2;
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

    // ── Step 2: Availability check ───────────────────────
    setState(() { _checkingAvailability = true; });
    final availCount = await _checkAvailabilityForPax(pax);
    setState(() {
      _availableTablesForParty = availCount;
      _checkingAvailability = false;
    });

    if (!mounted) return;

    // Block if suitable tables are free
    if (availCount > 0) {
      _showTablesAvailableDialog(pax, availCount);
      return;
    }

    // ── Step 3: All tables full → join the queue ─────────
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
                child: (_isLoading || _checkingAvailability)
                  ? Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const CircularProgressIndicator(color: AppTheme.primary),
                        if (_checkingAvailability) ...
                          [const SizedBox(height: 16), const Text('Checking table availability…', style: TextStyle(color: AppTheme.secondary))],
                      ],
                    )
                  : _inQueue
                      ? _buildInQueueView()
                      : ListenableBuilder(
                          listenable: OperatingHoursService(),
                          builder: (context, _) => _buildJoinQueueView(),
                        ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildJoinQueueView() {
    final isOpen = _isRestaurantOpen;
    return SingleChildScrollView(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          // ── Operating Hours Status Indicator ──
          Container(
            margin: const EdgeInsets.only(bottom: 14),
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 11),
            decoration: BoxDecoration(
              color: isOpen ? const Color(0xFFECFDF5) : const Color(0xFFFFFBEB),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: isOpen ? const Color(0xFFA7F3D0) : const Color(0xFFFDE68A),
                width: 1.2,
              ),
            ),
            child: Row(
              children: [
                Icon(
                  isOpen ? Icons.check_circle_rounded : (OperatingHoursService().isOpenToday ? Icons.schedule_rounded : Icons.highlight_off_rounded),
                  size: 20,
                  color: isOpen ? const Color(0xFF059669) : (!OperatingHoursService().isOpenToday ? const Color(0xFFDC2626) : const Color(0xFFD97706)),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        !OperatingHoursService().isOpenToday
                            ? 'CLOSED TODAY • ${(OperatingHoursService().todayClosureReason ?? 'DOORS CLOSED').toUpperCase()}'
                            : (isOpen ? 'RESTAURANT IS OPEN' : 'RESTAURANT CURRENTLY CLOSED'),
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w800,
                          color: isOpen ? const Color(0xFF065F46) : (!OperatingHoursService().isOpenToday ? const Color(0xFF991B1B) : const Color(0xFF92400E)),
                          letterSpacing: 0.5,
                        ),
                      ),
                      const SizedBox(height: 1),
                      Text(
                        'Operating Hours: ${OperatingHoursService().operatingHoursString}',
                        style: TextStyle(
                          fontSize: 12,
                          color: isOpen ? const Color(0xFF047857) : (!OperatingHoursService().isOpenToday ? const Color(0xFFB91C1C) : const Color(0xFFB45309)),
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          // ── Prominent Top CTA ──
          Container(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(22),
              gradient: LinearGradient(
                colors: isOpen
                    ? [const Color(0xFFC48858), const Color(0xFF9E6538)]
                    : (!OperatingHoursService().isOpenToday
                        ? [const Color(0xFF991B1B), const Color(0xFF7F1D1D)]
                        : [const Color(0xFF6B7280), const Color(0xFF4B5563)]),
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              boxShadow: [
                BoxShadow(
                  color: (isOpen
                          ? const Color(0xFFC48858)
                          : (!OperatingHoursService().isOpenToday ? const Color(0xFF991B1B) : const Color(0xFF4B5563)))
                      .withValues(alpha: 0.4),
                  blurRadius: 18,
                  offset: const Offset(0, 8),
                ),
              ],
            ),
            child: Material(
              color: Colors.transparent,
              child: InkWell(
                onTap: _joinQueue,
                borderRadius: BorderRadius.circular(22),
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 20, horizontal: 20),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.22),
                          shape: BoxShape.circle,
                        ),
                        child: Icon(
                          isOpen ? Icons.people_alt_rounded : Icons.lock_clock_rounded,
                          size: 28,
                          color: Colors.white,
                        ),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              isOpen
                                  ? 'JOIN WAITLIST NOW'
                                  : (!OperatingHoursService().isOpenToday ? 'CLOSED FOR TODAY' : 'WAITLIST CLOSED'),
                              style: const TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.w900,
                                color: Colors.white,
                                letterSpacing: 0.8,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              isOpen
                                  ? '$_totalWaiting parties waiting • ~${_totalWaiting * 5} min turnaround'
                                  : (!OperatingHoursService().isOpenToday
                                      ? 'Reopens tomorrow at ${OperatingHoursService().openTimeFormatted} • Reserve in advance'
                                      : 'Opens daily at ${OperatingHoursService().openTimeFormatted} • Tap to book a table'),
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                color: Colors.white.withValues(alpha: 0.9),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const Icon(Icons.arrow_forward_ios_rounded, size: 18, color: Colors.white),
                    ],
                  ),
                ),
              ),
            ),
          ),

          const SizedBox(height: 32),

          // Illustration Graphic
          Center(
            child: Container(
              padding: const EdgeInsets.all(32),
              decoration: BoxDecoration(
                color: AppTheme.white.withValues(alpha: 0.8),
                shape: BoxShape.circle,
                border: Border.all(color: AppTheme.white, width: 2),
                boxShadow: [
                  BoxShadow(
                    color: AppTheme.secondary.withValues(alpha: 0.05),
                    blurRadius: 30,
                    offset: const Offset(0, 10),
                  ),
                ],
              ),
              child: const Icon(Icons.access_time_filled_rounded, size: 60, color: AppTheme.primary),
            ),
          ),
          const SizedBox(height: 24),
          Text(
            'Live Table Waitlist',
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.displayMedium?.copyWith(
              color: AppTheme.secondary,
              fontFamily: 'Playfair Display',
              fontWeight: FontWeight.bold,
              fontSize: 26,
            ),
          ),
          const SizedBox(height: 16),

          // Live Availability Status Card
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: AppTheme.white,
              borderRadius: BorderRadius.circular(20),
              boxShadow: [
                BoxShadow(
                  color: AppTheme.secondary.withValues(alpha: 0.05),
                  blurRadius: 16,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Column(
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Container(
                      width: 10,
                      height: 10,
                      decoration: const BoxDecoration(
                        color: Colors.green,
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      '$_totalWaiting parties currently waiting',
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Text(
                  'Average table turnaround time is ~${_totalWaiting * 5} minutes.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: AppTheme.secondary.withValues(alpha: 0.65),
                    fontSize: 13,
                    height: 1.4,
                  ),
                ),
                // Live availability status banner
                if (_availableTablesForParty >= 0) ...[
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                    decoration: BoxDecoration(
                      color: _availableTablesForParty > 0
                          ? Colors.green.shade50
                          : AppTheme.primary.withValues(alpha: 0.08),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: _availableTablesForParty > 0
                            ? Colors.green.shade300
                            : AppTheme.primary.withValues(alpha: 0.3),
                      ),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          _availableTablesForParty > 0 ? Icons.table_restaurant : Icons.event_busy,
                          size: 16,
                          color: _availableTablesForParty > 0 ? Colors.green.shade700 : AppTheme.primary,
                        ),
                        const SizedBox(width: 6),
                        Text(
                          _availableTablesForParty > 0
                              ? '$_availableTablesForParty table(s) currently open'
                              : 'Restaurant is fully occupied',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: _availableTablesForParty > 0 ? Colors.green.shade700 : AppTheme.primary,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildInQueueView() {
    return SingleChildScrollView(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.center,
        mainAxisSize: MainAxisSize.min,
        children: [
          // ── Queue Live Push Reminder: Alert when position is 1 or 2 ──
          if (_position <= 2 && _position > 0)
            Container(
              margin: const EdgeInsets.only(bottom: 24),
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFFFFFBEB), Color(0xFFFEF3C7)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: const Color(0xFFF59E0B), width: 1.8),
                boxShadow: [
                  BoxShadow(
                    color: Colors.amber.withValues(alpha: 0.35),
                    blurRadius: 14,
                    offset: const Offset(0, 5),
                  ),
                ],
              ),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: const BoxDecoration(
                      color: Color(0xFFD97706),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.notifications_active_rounded, color: Colors.white, size: 24),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          _position == 1 ? '🔥 You are Next in Line!' : '⚡ Get Ready! (Position #2)',
                          style: const TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 16,
                            color: Color(0xFF92400E),
                          ),
                        ),
                        const SizedBox(height: 3),
                        const Text(
                          'Please head towards the host / reception desk. Your table is being prepped and will be called shortly!',
                          style: TextStyle(
                            fontSize: 12,
                            color: Color(0xFF78350F),
                            height: 1.3,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
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
                    _queueNumber != null ? '#$_queueNumber' : '#?',
                    style: const TextStyle(
                      fontSize: 72,
                      fontWeight: FontWeight.bold,
                      color: AppTheme.primary,
                      height: 1.0,
                    ),
                  ),
                  Text(
                    'YOUR NUMBER',
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
        const SizedBox(height: 8),
        Text(
          _position == 1 
              ? 'You are next in line!' 
              : 'There are ${_position - 1} people ahead of you',
          style: const TextStyle(
            color: AppTheme.secondary,
            fontSize: 16,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 16),
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
      ),
    );
  }
}

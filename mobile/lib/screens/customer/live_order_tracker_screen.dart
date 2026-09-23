import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart' as http_parser;
import 'package:intl/intl.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../core/theme.dart';
import '../../services/api_service.dart';
import '../../utils/slip_picker.dart';
import '../../widgets/call_waiter_sheet.dart';
import '../../widgets/guest_placeholder.dart';

class LiveOrderTrackerScreen extends StatefulWidget {
  final String? orderId;

  const LiveOrderTrackerScreen({super.key, this.orderId});

  @override
  State<LiveOrderTrackerScreen> createState() => _LiveOrderTrackerScreenState();
}

class _LiveOrderTrackerScreenState extends State<LiveOrderTrackerScreen>
    with SingleTickerProviderStateMixin {
  String? _activeOrderId;
  Map<String, dynamic>? _orderData;
  List<Map<String, dynamic>> _orderItems = [];
  bool _isLoading = true;
  bool _isRealtimeConnected = true;
  String _previousStatus = 'none';
  bool _hasReviewed = false;
  Map<String, dynamic>? _paymentTxn;
  bool _isReuploading = false;

  StreamSubscription? _orderStreamSub;
  Timer? _fallbackPollTimer;
  late AnimationController _pulseController;
  late Animation<double> _pulseAnimation;

  @override
  void initState() {
    super.initState();
    _activeOrderId = widget.orderId;

    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1600),
    )..repeat(reverse: true);
    _pulseAnimation = Tween<double>(begin: 0.85, end: 1.15).animate(
      CurvedAnimation(parent: _pulseController, curve: Curves.easeInOut),
    );

    _initTracker();
  }

  @override
  void dispose() {
    _orderStreamSub?.cancel();
    _fallbackPollTimer?.cancel();
    _pulseController.dispose();
    super.dispose();
  }

  Future<void> _initTracker() async {
    final user = Supabase.instance.client.auth.currentUser;
    if (user == null) {
      if (mounted) setState(() => _isLoading = false);
      return;
    }

    try {
      // If no specific orderId passed, find the most recent active order
      if (_activeOrderId == null) {
        final activeOrder = await Supabase.instance.client
            .from('orders')
            .select('id')
            .eq('user_id', user.id)
            .inFilter('status', ['pending', 'preparing', 'ready', 'payment_pending', 'payment_rejected'])
            .order('created_at', ascending: false)
            .limit(1)
            .maybeSingle();

        if (activeOrder != null) {
          _activeOrderId = activeOrder['id'].toString();
        } else {
          // If no active order, fetch the most recent order of any status
          final latest = await Supabase.instance.client
              .from('orders')
              .select('id')
              .eq('user_id', user.id)
              .order('created_at', ascending: false)
              .limit(1)
              .maybeSingle();
          if (latest != null) {
            _activeOrderId = latest['id'].toString();
          }
        }
      }

      if (_activeOrderId != null) {
        await _fetchInitialOrderDetails(_activeOrderId!);
        _subscribeToRealtimeOrder(_activeOrderId!);
        _startFallbackPolling(_activeOrderId!);
      } else {
        if (mounted) setState(() => _isLoading = false);
      }
    } catch (e) {
      debugPrint('Error initializing order tracker: $e');
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _fetchInitialOrderDetails(String orderId) async {
    try {
      final orderRes = await Supabase.instance.client
          .from('orders')
          .select('*, restaurant_tables(table_number)')
          .eq('id', orderId)
          .maybeSingle();

      final itemsRes = await Supabase.instance.client
          .from('order_items')
          .select('*, menu_items(name, image_url)')
          .eq('order_id', orderId);

      bool hasReview = false;
      try {
        final rev = await Supabase.instance.client
            .from('reviews')
            .select('id')
            .eq('order_id', orderId)
            .maybeSingle();
        hasReview = rev != null;
      } catch (_) {}

      Map<String, dynamic>? pt;
      try {
        final ptRes = await Supabase.instance.client
            .from('payment_transactions')
            .select('*')
            .eq('order_id', orderId)
            .order('created_at', ascending: false)
            .limit(1)
            .maybeSingle();
        pt = ptRes;
      } catch (_) {}

      if (mounted) {
        setState(() {
          _orderData = orderRes;
          _orderItems = List<Map<String, dynamic>>.from(itemsRes);
          _previousStatus = orderRes?['status'] ?? 'pending';
          _hasReviewed = hasReview;
          _paymentTxn = pt;
          _isLoading = false;
        });
      }
    } catch (e) {
      debugPrint('Error fetching initial order data: $e');
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _startFallbackPolling(String orderId) {
    _fallbackPollTimer?.cancel();
    _fallbackPollTimer = Timer.periodic(const Duration(seconds: 4), (timer) async {
      if (!mounted) {
        timer.cancel();
        return;
      }
      final currentStatus = _orderData?['status']?.toString();
      if (currentStatus == 'served' || currentStatus == 'cancelled') {
        timer.cancel();
        return;
      }

      try {
        final orderRes = await Supabase.instance.client
            .from('orders')
            .select('*, restaurant_tables(table_number)')
            .eq('id', orderId)
            .maybeSingle();

        if (orderRes != null && mounted) {
          final newStatus = orderRes['status']?.toString() ?? 'pending';
          if (newStatus != _previousStatus) {
            _triggerFeedbackOnStatusChange(newStatus);
            setState(() {
              _orderData = {
                ...?_orderData,
                ...orderRes,
              };
              _previousStatus = newStatus;
            });
          }
        }
      } catch (e) {
        debugPrint('Fallback poller error: $e');
      }
    });
  }

  void _subscribeToRealtimeOrder(String orderId) {
    _orderStreamSub?.cancel();

    _orderStreamSub = Supabase.instance.client
        .from('orders')
        .stream(primaryKey: ['id'])
        .eq('id', orderId)
        .listen(
          (data) {
            if (data.isNotEmpty && mounted) {
              final newRecord = data.first;
              final newStatus = newRecord['status']?.toString() ?? 'pending';

              // Trigger Haptic & Audio cues on state transitions
              if (newStatus != _previousStatus) {
                _triggerFeedbackOnStatusChange(newStatus);
              }

              setState(() {
                _orderData = {
                  ...?_orderData,
                  ...newRecord,
                };
                _previousStatus = newStatus;
                _isRealtimeConnected = true;
              });
            }
          },
          onError: (error) {
            debugPrint('Realtime order stream error: $error');
            if (mounted) {
              setState(() => _isRealtimeConnected = false);
            }
          },
        );
  }

  void _triggerFeedbackOnStatusChange(String status) {
    if (status == 'preparing') {
      HapticFeedback.lightImpact();
    } else if (status == 'ready') {
      HapticFeedback.mediumImpact();
      SystemSound.play(SystemSoundType.click);
    } else if (status == 'served') {
      HapticFeedback.heavyImpact();
      SystemSound.play(SystemSoundType.click);
    }
  }

  int _getStatusStepIndex(String status) {
    switch (status) {
      case 'pending':
        return 0;
      case 'preparing':
        return 1;
      case 'ready':
        return 2;
      case 'served':
        return 3;
      default:
        return 0;
    }
  }

  String _formatCurrency(num amount) {
    return 'LKR ${amount.toStringAsFixed(0)}';
  }

  String _formatTime(String? timestamp) {
    if (timestamp == null) return '';
    try {
      final dt = DateTime.parse(timestamp).toLocal();
      return DateFormat('hh:mm a').format(dt);
    } catch (_) {
      return '';
    }
  }

  void _showRatingModal() {
    int rating = 5;
    final commentController = TextEditingController();
    final user = Supabase.instance.client.auth.currentUser;
    if (user == null || _activeOrderId == null) return;

    showModalBottomSheet(
      context: context,
      useRootNavigator: true,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setModalState) => Container(
          padding: EdgeInsets.fromLTRB(
            24,
            20,
            24,
            MediaQuery.of(context).viewInsets.bottom + 24,
          ),
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.grey.shade300,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(height: 18),
              Text(
                'Rate Your Dining Experience',
                style: GoogleFonts.playfairDisplay(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                  color: AppTheme.secondary,
                ),
              ),
              const SizedBox(height: 6),
              const Text(
                'How was the food and presentation?',
                style: TextStyle(fontSize: 13, color: Colors.grey),
              ),
              const SizedBox(height: 16),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: List.generate(5, (index) {
                  final starIndex = index + 1;
                  return IconButton(
                    iconSize: 36,
                    icon: Icon(
                      starIndex <= rating ? Icons.star_rounded : Icons.star_outline_rounded,
                      color: const Color(0xFFD4AF37),
                    ),
                    onPressed: () => setModalState(() => rating = starIndex),
                  );
                }),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: commentController,
                maxLines: 3,
                decoration: InputDecoration(
                  hintText: 'Add an optional compliment or note for the chef...',
                  filled: true,
                  fillColor: AppTheme.background,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(16),
                    borderSide: BorderSide.none,
                  ),
                ),
              ),
              const SizedBox(height: 18),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.primary,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                  onPressed: () async {
                    try {
                      await Supabase.instance.client.from('reviews').insert({
                        'order_id': _activeOrderId,
                        'user_id': user.id,
                        'rating': rating,
                        'comment': commentController.text.trim(),
                      });
                      if (context.mounted) {
                        Navigator.pop(ctx);
                        setState(() => _hasReviewed = true);
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                            content: Text('Thank you! Your feedback has been shared with the kitchen.'),
                            backgroundColor: Colors.green,
                          ),
                        );
                      }
                    } catch (e) {
                      if (context.mounted) {
                        Navigator.pop(ctx);
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(content: Text('Review note: $e')),
                        );
                      }
                    }
                  },
                  child: const Text('Submit Review', style: TextStyle(fontWeight: FontWeight.bold)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (Supabase.instance.client.auth.currentUser == null) {
      return Scaffold(
        backgroundColor: AppTheme.background,
        appBar: AppBar(
          title: const Text('Live Order Tracker'),
          backgroundColor: Colors.transparent,
          elevation: 0,
        ),
        body: GuestPlaceholder(
          title: 'Live Order Tracker',
          description: 'Sign in to TableFlow to track your kitchen order progress, status updates, and waiter calls in real time.',
          icon: Icons.room_service_outlined,
          onSignedIn: _initTracker,
        ),
      );
    }

    if (_isLoading) {
      return const Scaffold(
        backgroundColor: AppTheme.background,
        body: Center(
          child: CircularProgressIndicator(color: AppTheme.primary),
        ),
      );
    }

    if (_orderData == null) {
      return Scaffold(
        backgroundColor: AppTheme.background,
        appBar: AppBar(
          title: const Text('Live Order Tracker'),
          backgroundColor: Colors.transparent,
          elevation: 0,
        ),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(32.0),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.room_service_outlined, size: 64, color: AppTheme.primary.withValues(alpha: 0.5)),
                const SizedBox(height: 16),
                const Text(
                  'No Active Orders Found',
                  style: TextStyle(fontFamily: 'Playfair Display', fontSize: 20, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Place an order from the menu to track its preparation in real time.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Colors.grey, fontSize: 13),
                ),
                const SizedBox(height: 24),
                ElevatedButton(
                  onPressed: () => context.go('/menu'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.primary,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                  ),
                  child: const Text('Explore Menu', style: TextStyle(fontWeight: FontWeight.bold)),
                ),
              ],
            ),
          ),
        ),
      );
    }

    final currentStatus = _orderData?['status']?.toString() ?? 'pending';
    final currentStep = _getStatusStepIndex(currentStatus);
    final tableNumber = _orderData?['restaurant_tables']?['table_number'] ?? _orderData?['table_id'];
    final createdAt = _formatTime(_orderData?['created_at']);
    final totalAmount = (_orderData?['total_amount'] as num?) ?? 0;
    final isServed = currentStatus == 'served';
    final isPaymentPending = currentStatus == 'payment_pending';
    final isPaymentRejected = currentStatus == 'payment_rejected';

    return Scaffold(
      backgroundColor: AppTheme.background,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: Colors.white,
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(color: Colors.black.withValues(alpha: 0.08), blurRadius: 10),
              ],
            ),
            child: const Icon(Icons.arrow_back_ios_new, size: 16, color: AppTheme.secondary),
          ),
          onPressed: () {
            if (context.canPop()) {
              context.pop();
            } else {
              context.go('/home');
            }
          },
        ),
        title: Text(
          'Live Order Journey',
          style: GoogleFonts.playfairDisplay(
            fontSize: 20,
            fontWeight: FontWeight.bold,
            color: AppTheme.secondary,
          ),
        ),
        centerTitle: true,
        actions: [
          // Realtime Pulse Status Indicator
          Container(
            margin: const EdgeInsets.only(right: 16),
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: _isRealtimeConnected
                  ? Colors.green.withValues(alpha: 0.12)
                  : Colors.orange.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(
                color: _isRealtimeConnected ? Colors.green.shade300 : Colors.orange.shade300,
              ),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                ScaleTransition(
                  scale: _pulseAnimation,
                  child: Container(
                    width: 7,
                    height: 7,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: _isRealtimeConnected ? Colors.green : Colors.orange,
                    ),
                  ),
                ),
                const SizedBox(width: 6),
                Text(
                  _isRealtimeConnected ? 'LIVE' : 'SYNC',
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                    color: _isRealtimeConnected ? Colors.green.shade800 : Colors.orange.shade800,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
        physics: const BouncingScrollPhysics(),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // ── Top Summary Card ──────────────────────────────────────────
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(24),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.05),
                    blurRadius: 20,
                    offset: const Offset(0, 6),
                  ),
                ],
              ),
              child: Row(
                children: [
                  Container(
                    width: 52,
                    height: 52,
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [Color(0xFFD4AF37), Color(0xFFB87F5C)],
                      ),
                      borderRadius: BorderRadius.circular(16),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFFB87F5C).withValues(alpha: 0.35),
                          blurRadius: 10,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: const Icon(Icons.restaurant, color: Colors.white, size: 26),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                tableNumber != null ? 'Table #$tableNumber' : 'Dine-In Guest',
                                style: const TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.bold,
                                  color: AppTheme.secondary,
                                ),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            const SizedBox(width: 8),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                              decoration: BoxDecoration(
                                color: AppTheme.background,
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Text(
                                '#${_activeOrderId!.substring(0, 8)}',
                                style: const TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.grey,
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'Ordered at $createdAt • ${_orderItems.length} items',
                          style: TextStyle(
                            fontSize: 12,
                            color: Colors.black.withValues(alpha: 0.55),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 20),

            // ── Hero Preparation Stepper or Payment Verification Banner ──
            if (isPaymentPending)
              _buildPaymentPendingHero()
            else if (isPaymentRejected)
              _buildPaymentRejectedHero()
            else
              Container(
                padding: const EdgeInsets.all(22),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(26),
                  boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.05),
                    blurRadius: 20,
                    offset: const Offset(0, 6),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'Kitchen Progress',
                        style: GoogleFonts.playfairDisplay(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          color: AppTheme.secondary,
                        ),
                      ),
                      if (!isServed)
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: const Color(0xFFD4AF37).withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: const Row(
                            children: [
                              Icon(Icons.timer_outlined, size: 14, color: Color(0xFF9A7B1C)),
                              SizedBox(width: 4),
                              Text(
                                'Est. 12-18 min',
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.bold,
                                  color: Color(0xFF9A7B1C),
                                ),
                              ),
                            ],
                          ),
                        )
                      else
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: Colors.green.withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: const Row(
                            children: [
                              Icon(Icons.check_circle_rounded, size: 14, color: Colors.green),
                              SizedBox(width: 4),
                              Text(
                                'Served • Enjoy!',
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.green,
                                ),
                              ),
                            ],
                          ),
                        ),
                    ],
                  ),

                  const SizedBox(height: 24),

                  // 4 Progressive Steps
                  _buildProgressStep(
                    stepNumber: 0,
                    currentStep: currentStep,
                    icon: Icons.receipt_long_rounded,
                    title: 'Order Confirmed',
                    subtitle: 'Ticket received and queued for the kitchen station',
                    isFirst: true,
                  ),
                  _buildProgressStep(
                    stepNumber: 1,
                    currentStep: currentStep,
                    icon: Icons.soup_kitchen_rounded,
                    title: 'In the Kitchen',
                    subtitle: 'Chefs are firing up ingredients and cooking your order',
                  ),
                  _buildProgressStep(
                    stepNumber: 2,
                    currentStep: currentStep,
                    icon: Icons.dinner_dining_rounded,
                    title: 'Plated & Ready',
                    subtitle: 'Finished with artisanal garnishes, ready for server pickup',
                  ),
                  _buildProgressStep(
                    stepNumber: 3,
                    currentStep: currentStep,
                    icon: Icons.check_circle_rounded,
                    title: 'Served to Table',
                    subtitle: 'Delivered directly to your table. Bon Appétit!',
                    isLast: true,
                  ),
                ],
              ),
            ),

            const SizedBox(height: 20),

            // ── Order Items Breakdown Accordion ───────────────────────────
            // ── Order Items Breakdown Accordion ───────────────────────────
            Container(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(24),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.05),
                    blurRadius: 20,
                    offset: const Offset(0, 6),
                  ),
                ],
              ),
              child: Material(
                color: Colors.white,
                borderRadius: BorderRadius.circular(24),
                clipBehavior: Clip.antiAlias,
                child: Theme(
                  data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
                  child: ExpansionTile(
                    initiallyExpanded: true,
                    tilePadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 6),
                    title: Text(
                      'Ordered Items (${_orderItems.length})',
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.bold,
                        color: AppTheme.secondary,
                      ),
                    ),
                    trailing: Text(
                      _formatCurrency(totalAmount),
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.bold,
                        color: AppTheme.primary,
                      ),
                    ),
                    children: [
                      const Divider(height: 1),
                      Padding(
                        padding: const EdgeInsets.fromLTRB(20, 12, 20, 16),
                        child: Column(
                          children: [
                            ..._orderItems.map((item) {
                              final itemName = item['menu_items']?['name'] ?? 'Menu Item';
                              final qty = item['quantity'] ?? 1;
                              final price = (item['unit_price'] as num?) ?? 0;
                              final customizations = item['selected_customizations'];
                              final notes = item['special_instructions'] ?? item['item_notes'];

                              return Padding(
                                padding: const EdgeInsets.symmetric(vertical: 8.0),
                                child: Row(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                      decoration: BoxDecoration(
                                        color: AppTheme.background,
                                        borderRadius: BorderRadius.circular(6),
                                      ),
                                      child: Text(
                                        '${qty}x',
                                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
                                      ),
                                    ),
                                    const SizedBox(width: 12),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            itemName,
                                            style: const TextStyle(
                                              fontWeight: FontWeight.w600,
                                              fontSize: 14,
                                            ),
                                          ),
                                          if (customizations != null && customizations is Map) ...[
                                            const SizedBox(height: 2),
                                            Text(
                                              customizations.values.map((v) => v.toString()).join(' • '),
                                              style: TextStyle(
                                                fontSize: 11,
                                                color: Colors.black.withValues(alpha: 0.55),
                                              ),
                                            ),
                                          ],
                                          if (notes != null && notes.toString().isNotEmpty) ...[
                                            const SizedBox(height: 2),
                                            Text(
                                              'Note: $notes',
                                              style: const TextStyle(
                                                fontSize: 11,
                                                fontStyle: FontStyle.italic,
                                                color: Colors.grey,
                                              ),
                                            ),
                                          ],
                                        ],
                                      ),
                                    ),
                                    Text(
                                      _formatCurrency(price * qty),
                                      style: const TextStyle(
                                        fontWeight: FontWeight.w600,
                                        fontSize: 13,
                                      ),
                                    ),
                                  ],
                                ),
                              );
                            }),
                            const SizedBox(height: 12),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                              decoration: BoxDecoration(
                                color: AppTheme.background,
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: const Row(
                                children: [
                                  Icon(Icons.point_of_sale, size: 16, color: Colors.grey),
                                  SizedBox(width: 8),
                                  Expanded(
                                    child: Text(
                                      'Settlement: Pay at Counter (Cash or Card with Waiter)',
                                      style: TextStyle(fontSize: 11, color: Colors.grey, fontWeight: FontWeight.w600),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),

            const SizedBox(height: 24),

            // ── Dining Action Buttons ─────────────────────────────────────
            Row(
              children: [
                // Call Waiter Button
                Expanded(
                  child: OutlinedButton.icon(
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      side: const BorderSide(color: AppTheme.primary, width: 1.5),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                      foregroundColor: AppTheme.primary,
                    ),
                    icon: const Icon(Icons.notifications_active_outlined, size: 18),
                    label: const Text('Call Waiter', style: TextStyle(fontWeight: FontWeight.bold)),
                    onPressed: () {
                      final tableId = _orderData?['table_id'];
                      final tableNum = _orderData?['restaurant_tables']?['table_number']?.toString() ??
                          (tableId != null ? tableId.toString() : 'Dine-In');
                      CallWaiterSheet.show(
                        context,
                        tableId: tableId,
                        tableNumber: tableNum,
                      );
                    },
                  ),
                ),
                const SizedBox(width: 12),

                // Order Additional Items (Per decision: creates separate ticket)
                Expanded(
                  child: ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppTheme.primary,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      elevation: 4,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    ),
                    icon: const Icon(Icons.add_circle_outline, size: 18),
                    label: const Text('Add Dishes', style: TextStyle(fontWeight: FontWeight.bold)),
                    onPressed: () {
                      // Navigate to menu to order more items (creates a new order ticket)
                      context.go('/menu');
                    },
                  ),
                ),
              ],
            ),

            // Prompt to Review Meal if order is marked served
            if (isServed) ...[
              const SizedBox(height: 16),
              if (_hasReviewed)
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
                  decoration: BoxDecoration(
                    color: const Color(0xFFD4AF37).withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: const Color(0xFFD4AF37).withValues(alpha: 0.35)),
                  ),
                  child: const Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.stars_rounded, color: Color(0xFFD4AF37), size: 22),
                      SizedBox(width: 8),
                      Text(
                        'Review Submitted • Thank you!',
                        style: TextStyle(
                          color: Color(0xFF8B6508),
                          fontWeight: FontWeight.bold,
                          fontSize: 14,
                        ),
                      ),
                    ],
                  ),
                )
              else
                ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFD4AF37),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  ),
                  icon: const Icon(Icons.star_rate_rounded, size: 20),
                  label: const Text('Leave a Chef Review', style: TextStyle(fontWeight: FontWeight.bold)),
                  onPressed: _showRatingModal,
                ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildProgressStep({
    required int stepNumber,
    required int currentStep,
    required IconData icon,
    required String title,
    required String subtitle,
    bool isFirst = false,
    bool isLast = false,
  }) {
    final isPassed = currentStep > stepNumber || (currentStep == 3 && stepNumber == 3);
    final isCurrent = currentStep == stepNumber && currentStep != 3;
    final isPending = currentStep < stepNumber;

    Color stepColor;
    if (isPassed) {
      stepColor = Colors.green;
    } else if (isCurrent) {
      stepColor = AppTheme.primary;
    } else {
      stepColor = Colors.grey.shade300;
    }

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Stepper Icon + Vertical Connecting Line
        Column(
          children: [
            Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                color: isCurrent
                    ? AppTheme.primary.withValues(alpha: 0.15)
                    : isPassed
                        ? Colors.green.withValues(alpha: 0.15)
                        : Colors.grey.shade100,
                shape: BoxShape.circle,
                border: Border.all(
                  color: isCurrent
                      ? AppTheme.primary
                      : isPassed
                          ? Colors.green
                          : Colors.grey.shade300,
                  width: 2,
                ),
              ),
              child: Icon(
                isPassed ? Icons.check_circle_rounded : icon,
                color: stepColor,
                size: 18,
              ),
            ),
            if (!isLast)
              Container(
                width: 2,
                height: 42,
                color: isPassed ? Colors.green : Colors.grey.shade200,
              ),
          ],
        ),
        const SizedBox(width: 14),

        // Text Info
        Expanded(
          child: Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(
                      title,
                      style: TextStyle(
                        fontSize: 14.5,
                        fontWeight: isCurrent || isPassed ? FontWeight.bold : FontWeight.w500,
                        color: isPending ? Colors.grey.shade500 : AppTheme.secondary,
                      ),
                    ),
                    if (isCurrent) ...[
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                        decoration: BoxDecoration(
                          color: AppTheme.primary.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Text(
                          'ACTIVE',
                          style: TextStyle(
                            fontSize: 9,
                            fontWeight: FontWeight.bold,
                            color: AppTheme.primary,
                          ),
                        ),
                      ),
                    ] else if (currentStep == 3 && stepNumber == 3) ...[
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                        decoration: BoxDecoration(
                          color: Colors.green.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Text(
                          'DELIVERED',
                          style: TextStyle(
                            fontSize: 9,
                            fontWeight: FontWeight.bold,
                            color: Colors.green,
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: 3),
                Text(
                  subtitle,
                  style: TextStyle(
                    fontSize: 11.5,
                    color: Colors.black.withValues(alpha: isPending ? 0.4 : 0.6),
                    height: 1.3,
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildPaymentPendingHero() {
    final ref = _paymentTxn?['transaction_reference'] ?? 'Submitted';
    final bank = _paymentTxn?['bank_name'];

    return Container(
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(26),
        border: Border.all(color: const Color(0xFFF59E0B).withValues(alpha: 0.3), width: 1.5),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFFF59E0B).withValues(alpha: 0.08),
            blurRadius: 20,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Payment Verification',
                style: GoogleFonts.playfairDisplay(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: AppTheme.secondary,
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: const Color(0xFFF59E0B).withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Row(
                  children: [
                    Icon(Icons.hourglass_top_rounded, size: 14, color: Color(0xFFB45309)),
                    SizedBox(width: 4),
                    Text(
                      'Audit in Progress',
                      style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFFB45309)),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 18),

          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: const Color(0xFFF59E0B).withValues(alpha: 0.06),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Row(
                  children: [
                    Icon(Icons.verified_user_outlined, color: Color(0xFFD97706), size: 20),
                    SizedBox(width: 8),
                    Text(
                      'Slip Submitted for Review',
                      style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: Color(0xFF92400E)),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                const Text(
                  'Your bank transfer receipt is in the audit queue. Staff will verify the transfer reference with our bank account shortly.',
                  style: TextStyle(fontSize: 12, color: Colors.black87, height: 1.4),
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    const Text('Bank Reference: ', style: TextStyle(fontSize: 12, color: Colors.grey)),
                    Text(
                      ref,
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFFB45309), letterSpacing: 0.5),
                    ),
                  ],
                ),
                if (bank != null && bank.toString().isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      const Text('Bank: ', style: TextStyle(fontSize: 12, color: Colors.grey)),
                      Text(bank.toString(), style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                    ],
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              const Icon(Icons.lock_clock_rounded, size: 16, color: Colors.grey),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  'Your order items are temporarily reserved. As soon as payment is confirmed, cooking starts automatically!',
                  style: TextStyle(fontSize: 11, color: Colors.grey.shade600),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildPaymentRejectedHero() {
    final reason = _paymentTxn?['rejection_reason'] ?? 'The submitted bank slip details could not be verified.';

    return Container(
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(26),
        border: Border.all(color: Colors.red.withValues(alpha: 0.3), width: 1.5),
        boxShadow: [
          BoxShadow(
            color: Colors.red.withValues(alpha: 0.08),
            blurRadius: 20,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Verification Required',
                style: GoogleFonts.playfairDisplay(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: AppTheme.secondary,
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.red.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Row(
                  children: [
                    Icon(Icons.error_outline_rounded, size: 14, color: Colors.red),
                    SizedBox(width: 4),
                    Text(
                      'Payment Rejected',
                      style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.red),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),

          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.red.withValues(alpha: 0.05),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.red.withValues(alpha: 0.2)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Row(
                  children: [
                    Icon(Icons.info_outline, color: Colors.red, size: 18),
                    SizedBox(width: 8),
                    Text('Reason for Rejection:', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Colors.red)),
                  ],
                ),
                const SizedBox(height: 6),
                Text(
                  reason,
                  style: const TextStyle(fontSize: 12, color: Colors.black87, height: 1.35),
                ),
              ],
            ),
          ),

          const SizedBox(height: 18),

          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: _showReuploadSlipSheet,
              icon: const Icon(Icons.cloud_upload_rounded, size: 18),
              label: const Text('Re-upload Payment Slip', style: TextStyle(fontWeight: FontWeight.bold)),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFF59E0B),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                elevation: 4,
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _showReuploadSlipSheet() {
    PickedSlip? newSlip;
    final refController = TextEditingController(
      text: _paymentTxn?['transaction_reference'] ?? '',
    );
    final bankController = TextEditingController(
      text: _paymentTxn?['bank_name'] ?? '',
    );

    showModalBottomSheet(
      context: context,
      useRootNavigator: true,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setSheetState) => Container(
          padding: EdgeInsets.fromLTRB(
            24, 20, 24,
            MediaQuery.of(context).viewInsets.bottom + 24,
          ),
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Re-submit Payment Proof',
                    style: GoogleFonts.playfairDisplay(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: AppTheme.secondary,
                    ),
                  ),
                  IconButton(
                    onPressed: () => Navigator.pop(ctx),
                    icon: const Icon(Icons.close, size: 20),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              const Text(
                'Please upload a clear, valid bank transfer receipt and verify your transaction reference.',
                style: TextStyle(fontSize: 12, color: Colors.grey),
              ),
              const SizedBox(height: 16),

              // Upload box
              InkWell(
                onTap: () async {
                  final picked = await pickSlipFile();
                  if (picked != null) {
                    setSheetState(() => newSlip = picked);
                  }
                },
                borderRadius: BorderRadius.circular(14),
                child: Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: newSlip != null ? Colors.green.withValues(alpha: 0.08) : AppTheme.background,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(
                      color: newSlip != null ? Colors.green : AppTheme.primary.withValues(alpha: 0.3),
                      width: 1.5,
                    ),
                  ),
                  child: newSlip == null
                      ? const Column(
                          children: [
                            Icon(Icons.cloud_upload_outlined, size: 30, color: AppTheme.primary),
                            SizedBox(height: 6),
                            Text('Choose Payment Slip Image / PDF', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                            Text('Max 10MB', style: TextStyle(fontSize: 11, color: Colors.grey)),
                          ],
                        )
                      : Row(
                          children: [
                            const Icon(Icons.check_circle, color: Colors.green, size: 22),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                newSlip!.fileName,
                                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            const Text('Change', style: TextStyle(color: AppTheme.primary, fontWeight: FontWeight.bold, fontSize: 12)),
                          ],
                        ),
                ),
              ),
              const SizedBox(height: 12),

              // Reference Input
              TextField(
                controller: refController,
                textCapitalization: TextCapitalization.characters,
                decoration: InputDecoration(
                  labelText: 'Transaction Reference Number *',
                  labelStyle: const TextStyle(fontSize: 12),
                  hintText: 'e.g. TXN-83921049',
                  hintStyle: TextStyle(color: Colors.black.withValues(alpha: 0.3), fontSize: 12),
                  filled: true,
                  fillColor: AppTheme.background,
                  isDense: true,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                ),
              ),
              const SizedBox(height: 10),

              // Bank Name Input
              TextField(
                controller: bankController,
                decoration: InputDecoration(
                  labelText: 'Bank Name (Optional)',
                  labelStyle: const TextStyle(fontSize: 12),
                  hintText: 'e.g. Commercial Bank, BOC',
                  hintStyle: TextStyle(color: Colors.black.withValues(alpha: 0.3), fontSize: 12),
                  filled: true,
                  fillColor: AppTheme.background,
                  isDense: true,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                ),
              ),
              const SizedBox(height: 18),

              // Submit Re-upload Button
              ElevatedButton(
                onPressed: _isReuploading ? null : () async {
                  if (newSlip == null) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Please select a payment slip')),
                    );
                    return;
                  }
                  if (refController.text.trim().isEmpty) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Please enter transaction reference number')),
                    );
                    return;
                  }

                  final messenger = ScaffoldMessenger.of(context);
                  final navigator = Navigator.of(ctx);

                  setSheetState(() => _isReuploading = true);
                  try {
                    final token = Supabase.instance.client.auth.currentSession?.accessToken;
                    final uri = Uri.parse('${ApiService.baseUrl}/orders/$_activeOrderId/payment-proof');
                    final request = http.MultipartRequest('POST', uri);
                    if (token != null) {
                      request.headers['Authorization'] = 'Bearer $token';
                    }
                    request.fields['transaction_reference'] = refController.text.trim().toUpperCase();
                    if (bankController.text.trim().isNotEmpty) {
                      request.fields['bank_name'] = bankController.text.trim();
                    }
                    final fileName = newSlip!.fileName;
                    final ext = fileName.split('.').last.toLowerCase();
                    final mimeType = (ext == 'png')
                        ? 'image/png'
                        : (ext == 'webp')
                            ? 'image/webp'
                            : (ext == 'pdf')
                                ? 'application/pdf'
                                : 'image/jpeg';
                    final parts = mimeType.split('/');

                    request.files.add(
                      http.MultipartFile.fromBytes(
                        'slip',
                        newSlip!.bytes,
                        filename: fileName,
                        contentType: http_parser.MediaType(parts[0], parts[1]),
                      ),
                    );

                    final sResp = await request.send();
                    final resp = await http.Response.fromStream(sResp);
                    Map<String, dynamic> rData = {};
                    try {
                      if (resp.body.isNotEmpty) {
                        rData = jsonDecode(resp.body);
                      }
                    } catch (_) {}

                    if (resp.statusCode == 200) {
                      navigator.pop();
                      messenger.showSnackBar(
                        const SnackBar(
                          content: Text('Payment slip re-submitted! Staff will review shortly.'),
                          backgroundColor: Colors.green,
                        ),
                      );
                      if (mounted) {
                        _fetchInitialOrderDetails(_activeOrderId!);
                      }
                    } else {
                      final errMsg = rData['error'] ??
                          (resp.body.isNotEmpty ? resp.body : 'Failed to re-submit proof (${resp.statusCode})');
                      throw Exception(errMsg);
                    }
                  } catch (err) {
                    messenger.showSnackBar(
                      SnackBar(
                        content: Text('Error: ${err.toString().replaceAll('Exception: ', '')}'),
                        backgroundColor: Colors.redAccent,
                      ),
                    );
                  } finally {
                    setSheetState(() => _isReuploading = false);
                  }
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFF59E0B),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  elevation: 4,
                ),
                child: _isReuploading
                    ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                    : const Text('Re-submit for Verification', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../core/theme.dart';
import '../../providers/cart_provider.dart';
import '../../services/supabase_service.dart';
import '../../utils/auth_guard.dart';

class ReservationDetailsScreen extends StatefulWidget {
  final String tableId;
  final int dbId;
  final String date;
  final String time;
  final int seats;
  
  const ReservationDetailsScreen({
    super.key, 
    required this.tableId,
    required this.dbId,
    required this.date,
    required this.time,
    required this.seats,
  });

  @override
  State<ReservationDetailsScreen> createState() => _ReservationDetailsScreenState();
}

class _ReservationDetailsScreenState extends State<ReservationDetailsScreen> {
  final _specialRequestsController = TextEditingController();
  bool _isLoading = false;

  void _confirmReservation() async {
    var user = Supabase.instance.client.auth.currentUser;
    if (user == null) {
      final loggedIn = await AuthGuard.requireAuth(
        context,
        actionTitle: 'Confirm Reservation',
        actionSubtitle: 'Sign in to TableFlow to confirm your booking and receive immediate reservation notifications.',
      );
      if (!loggedIn || !mounted) return;
      user = Supabase.instance.client.auth.currentUser;
      if (user == null) return;
    }
    
    setState(() => _isLoading = true);
    
    try {
      final date = DateTime.parse(widget.date);
      final parts = widget.time.split(':');
      final reservationDateTime = DateTime(
        date.year,
        date.month,
        date.day,
        int.parse(parts[0]),
        int.parse(parts[1]),
      );

      if (reservationDateTime.isBefore(DateTime.now())) {
        setState(() => _isLoading = false);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: const Row(
                children: [
                  Icon(Icons.error_outline, color: Colors.white),
                  SizedBox(width: 8),
                  Expanded(child: Text('Cannot book for a past date or time. Please select an upcoming schedule.')),
                ],
              ),
              backgroundColor: Colors.red.shade700,
              behavior: SnackBarBehavior.floating,
            ),
          );
        }
        return;
      }
      
      final now = DateTime.now();
      final todayStr = '${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';

      // Enforce: Maximum 2 active/upcoming reservations per user account
      final existingRes = await Supabase.instance.client
          .from('reservations')
          .select('id')
          .eq('user_id', user.id)
          .gte('reservation_date', todayStr)
          .or('status.eq.confirmed,status.eq.pending')
          .timeout(const Duration(seconds: 4));

      if (existingRes.length >= 2) {
        setState(() => _isLoading = false);
        if (mounted) {
          _showBookingLimitReachedDialog(context, userEmail: user.email);
        }
        return;
      }
      
      await Supabase.instance.client.from('reservations').insert({
        'user_id': user.id,
        'table_id': widget.dbId,
        'reservation_date': '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}',
        'reservation_time': '${parts[0].padLeft(2, '0')}:${parts[1].padLeft(2, '0')}:00',
        'pax': widget.seats,
        'status': 'confirmed',
        'special_requests': _specialRequestsController.text.trim().isEmpty ? null : _specialRequestsController.text.trim(),
      });

      // If booking is for today, also mark table as reserved in restaurant_tables for immediate live sync
      final bookingDateStr = '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';
      if (bookingDateStr == todayStr) {
        try {
          await Supabase.instance.client
              .from('restaurant_tables')
              .update({'status': 'reserved'})
              .eq('id', widget.dbId);
        } catch (_) {}
      }

      // Automatically link booked table to CartProvider
      final tableNum = int.tryParse(widget.tableId.replaceAll(RegExp(r'[^0-9]'), '')) ?? widget.dbId;
      if (mounted) {
        context.read<CartProvider>().setTable(widget.dbId, tableNum, source: 'reservation');
      }

      
      if (mounted) {
        showDialog(
          context: context,
          barrierDismissible: false,
          builder: (context) => Dialog(
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28)),
            elevation: 16,
            backgroundColor: Colors.white,
            insetPadding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(22, 28, 22, 24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // ── 1. Elegant Glow Success Badge ──
                  Container(
                    width: 72,
                    height: 72,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: const Color(0xFF10B981).withValues(alpha: 0.12),
                    ),
                    child: Center(
                      child: Container(
                        width: 52,
                        height: 52,
                        decoration: const BoxDecoration(
                          shape: BoxShape.circle,
                          gradient: LinearGradient(
                            colors: [Color(0xFF34D399), Color(0xFF059669)],
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: Color(0x3310B981),
                              blurRadius: 14,
                              offset: Offset(0, 5),
                            ),
                          ],
                        ),
                        child: const Icon(Icons.check_rounded, color: Colors.white, size: 32),
                      ),
                    ),
                  ),
                  const SizedBox(height: 18),

                  // ── 2. Title & Description ──
                  Text(
                    'Reservation Confirmed',
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      fontFamily: 'Playfair Display',
                      fontSize: 22,
                      fontWeight: FontWeight.bold,
                      color: AppTheme.secondary,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Table ${widget.tableId} is confirmed for your dining experience. This table is also auto-selected in your cart.',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 13,
                      color: Colors.grey.shade600,
                      height: 1.45,
                    ),
                  ),
                  const SizedBox(height: 18),

                  // ── 3. Structured Booking Details Card ──
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFAF7F2),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: const Color(0xFFEADBCE), width: 1),
                    ),
                    child: Column(
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Row(
                              children: [
                                Icon(Icons.table_restaurant_rounded, size: 17, color: AppTheme.primary),
                                const SizedBox(width: 8),
                                Text('Reserved Table', style: TextStyle(fontSize: 13, color: Colors.grey.shade700)),
                              ],
                            ),
                            Text(
                              'Table ${widget.tableId}',
                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13.5, color: AppTheme.secondary),
                            ),
                          ],
                        ),
                        const Divider(height: 18, thickness: 0.8, color: Color(0xFFEADBCE)),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Row(
                              children: [
                                Icon(Icons.event_available_rounded, size: 17, color: AppTheme.primary),
                                const SizedBox(width: 8),
                                Text('Date & Time', style: TextStyle(fontSize: 13, color: Colors.grey.shade700)),
                              ],
                            ),
                            Text(
                              '${date.day}/${date.month}/${date.year} • ${widget.time}',
                              style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13, color: AppTheme.secondary),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),

                  // ── 4. Cart Link Pill Badge ──
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
                    decoration: BoxDecoration(
                      color: const Color(0xFFECFDF5),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFFA7F3D0)),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.shopping_bag_outlined, size: 16, color: Color(0xFF059669)),
                        const SizedBox(width: 8),
                        Flexible(
                          child: Text(
                            'Table #$tableNum auto-linked to Cart!',
                            style: const TextStyle(fontSize: 12.5, color: Color(0xFF065F46), fontWeight: FontWeight.w700),
                            textAlign: TextAlign.center,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 22),

                  // ── 5. Primary Action Button: Browse Menu (Rich Terracotta Gradient, Zero Dark Borders) ──
                  Container(
                    width: double.infinity,
                    height: 50,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(16),
                      gradient: const LinearGradient(
                        colors: [Color(0xFFC48858), Color(0xFF9E6538)],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFFC48858).withValues(alpha: 0.35),
                          blurRadius: 12,
                          offset: const Offset(0, 5),
                        ),
                      ],
                    ),
                    child: Material(
                      color: Colors.transparent,
                      child: InkWell(
                        onTap: () {
                          Navigator.of(context).pop();
                          context.go('/menu');
                        },
                        borderRadius: BorderRadius.circular(16),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Icon(Icons.restaurant_menu_rounded, size: 19, color: Colors.white),
                            const SizedBox(width: 9),
                            Text(
                              'Browse Menu (Table #$tableNum)',
                              style: const TextStyle(
                                fontSize: 14.5,
                                fontWeight: FontWeight.bold,
                                color: Colors.white,
                                letterSpacing: 0.3,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 10),

                  // ── 6. Secondary Action Button: Back to Home (Clean Modern Neutral, NO Black Border) ──
                  Container(
                    width: double.infinity,
                    height: 48,
                    decoration: BoxDecoration(
                      color: const Color(0xFFF9FAFB),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: const Color(0xFFE5E7EB), width: 1.2),
                    ),
                    child: Material(
                      color: Colors.transparent,
                      child: InkWell(
                        onTap: () {
                          Navigator.of(context).pop();
                          context.go('/home');
                        },
                        borderRadius: BorderRadius.circular(16),
                        child: const Center(
                          child: Text(
                            'Back to Home',
                            style: TextStyle(
                              fontSize: 14.5,
                              fontWeight: FontWeight.w600,
                              color: Color(0xFF4B5563),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      }
    } catch (e) {
      debugPrint('Reservation error: $e');
      if (mounted) {
        if (e.toString().contains('Maximum 2 active table reservations')) {
          _showBookingLimitReachedDialog(context, userEmail: user.email);
        } else {
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed: $e')));
        }
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _showBookingLimitReachedDialog(BuildContext context, {String? userEmail}) {
    final emailText = userEmail ?? Supabase.instance.client.auth.currentUser?.email ?? 'Your Account';
    showDialog(
      context: context,
      builder: (ctx) => Dialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28)),
        elevation: 16,
        backgroundColor: Colors.white,
        insetPadding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(22, 28, 22, 22),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // ── 1. Top Amber Badge ──
              Container(
                width: 72,
                height: 72,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: Colors.amber.shade50,
                ),
                child: Center(
                  child: Container(
                    width: 52,
                    height: 52,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: LinearGradient(
                        colors: [Colors.amber.shade400, Colors.orange.shade700],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.orange.shade300.withValues(alpha: 0.45),
                          blurRadius: 14,
                          offset: const Offset(0, 5),
                        ),
                      ],
                    ),
                    child: const Icon(Icons.table_restaurant_rounded, color: Colors.white, size: 28),
                  ),
                ),
              ),
              const SizedBox(height: 18),

              // ── 2. Title & Description ──
              Text(
                'Reservation Limit',
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  fontFamily: 'Playfair Display',
                  fontSize: 22,
                  fontWeight: FontWeight.bold,
                  color: AppTheme.secondary,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              Text(
                'Each customer account is limited to a maximum of 2 active table reservations to ensure fair availability.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 13,
                  color: Colors.grey.shade600,
                  height: 1.45,
                ),
              ),
              const SizedBox(height: 16),

              // ── 3. Account Banner ──
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                decoration: BoxDecoration(
                  color: const Color(0xFFFFFBEB),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0xFFFDE68A), width: 1.2),
                ),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(7),
                      decoration: BoxDecoration(
                        color: Colors.amber.shade100,
                        shape: BoxShape.circle,
                      ),
                      child: Icon(Icons.person_outline_rounded, color: Colors.amber.shade900, size: 18),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Account with 2 active tables:',
                            style: TextStyle(fontSize: 11.5, color: Colors.amber.shade900, fontWeight: FontWeight.w600),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            emailText,
                            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: AppTheme.secondary),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 22),

              // ── 4. Primary Button: My Bookings (Clay Gradient, Zero Black Borders) ──
              Container(
                width: double.infinity,
                height: 50,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(16),
                  gradient: const LinearGradient(
                    colors: [Color(0xFFC48858), Color(0xFF9E6538)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFFC48858).withValues(alpha: 0.35),
                      blurRadius: 12,
                      offset: const Offset(0, 5),
                    ),
                  ],
                ),
                child: Material(
                  color: Colors.transparent,
                  child: InkWell(
                    onTap: () {
                      Navigator.of(ctx).pop();
                      context.push('/reservations');
                    },
                    borderRadius: BorderRadius.circular(16),
                    child: const Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.calendar_month_rounded, size: 19, color: Colors.white),
                        SizedBox(width: 9),
                        Text(
                          'View My Bookings',
                          style: TextStyle(
                            fontSize: 14.5,
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                            letterSpacing: 0.3,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 10),

              // ── 5. Secondary Button: Switch Account (Clean Neutral, NO Black Border) ──
              Container(
                width: double.infinity,
                height: 48,
                decoration: BoxDecoration(
                  color: const Color(0xFFF9FAFB),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0xFFE5E7EB), width: 1.2),
                ),
                child: Material(
                  color: Colors.transparent,
                  child: InkWell(
                    onTap: () async {
                      Navigator.of(ctx).pop();
                      await SupabaseService.signOut();
                      if (context.mounted) {
                        context.go('/login');
                      }
                    },
                    borderRadius: BorderRadius.circular(16),
                    child: const Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.swap_horiz_rounded, size: 19, color: Color(0xFF4B5563)),
                        SizedBox(width: 8),
                        Text(
                          'Switch Account',
                          style: TextStyle(
                            fontSize: 14.5,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF4B5563),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 6),

              // ── 6. Close Action ──
              TextButton(
                onPressed: () => Navigator.of(ctx).pop(),
                child: Text(
                  'Dismiss',
                  style: TextStyle(color: Colors.grey.shade600, fontSize: 13.5, fontWeight: FontWeight.w500),
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
    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, size: 20),
          onPressed: () { if (context.canPop()) { context.pop(); } else { context.go('/home'); } },
        ),
        title: const Text('Reservation Details'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Summary Card
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: AppTheme.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppTheme.primary.withValues(alpha: 0.3)),
              ),
              child: Column(
                children: [
                  Text(
                    'Table ${widget.tableId}',
                    style: Theme.of(context).textTheme.displayMedium?.copyWith(
                      color: AppTheme.primary,
                      fontSize: 32,
                    ),
                  ),
                  const SizedBox(height: 16),
                  _buildSummaryRow(Icons.calendar_today, 'Date', '${DateTime.parse(widget.date).day}/${DateTime.parse(widget.date).month}/${DateTime.parse(widget.date).year}'),
                  const SizedBox(height: 12),
                  _buildSummaryRow(Icons.access_time, 'Time', widget.time),
                  const SizedBox(height: 12),
                  _buildSummaryRow(Icons.people, 'Guests', '${widget.seats} People'),
                ],
              ),
            ),
            
            const SizedBox(height: 32),
            
            Text(
              'Special Requests',
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                fontFamily: 'Playfair Display',
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _specialRequestsController,
              maxLines: 3,
              decoration: InputDecoration(
                hintText: 'e.g. Anniversary dinner, window seat preferred...',
                filled: true,
                fillColor: AppTheme.white,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: BorderSide(color: AppTheme.secondary.withValues(alpha: 0.1)),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: BorderSide(color: AppTheme.secondary.withValues(alpha: 0.1)),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: const BorderSide(color: AppTheme.primary, width: 2),
                ),
              ),
            ),
            
            const SizedBox(height: 32),
            
            Text(
              'Cancellation Policy',
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                fontFamily: 'Playfair Display',
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.orange.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.orange.withValues(alpha: 0.25)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.timer_outlined, color: Colors.green, size: 16),
                      const SizedBox(width: 6),
                      Text(
                        '10-Minute Grace Period:',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.bold,
                          color: Colors.green.shade800,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Instant free cancellation is available in the app within 10 minutes of booking. The reserved table will immediately be released.',
                    style: TextStyle(
                      fontSize: 12,
                      color: AppTheme.secondary.withValues(alpha: 0.8),
                      height: 1.4,
                    ),
                  ),
                  const Divider(height: 16),
                  Row(
                    children: [
                      Icon(Icons.phone_in_talk_rounded, color: Colors.orange.shade800, size: 16),
                      const SizedBox(width: 6),
                      Text(
                        'After 10 Minutes (Hotline Cancellation):',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.bold,
                          color: Colors.orange.shade900,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'To cancel or reschedule after 10 minutes, please contact our restaurant hotline at +94 11 234 5678.',
                    style: TextStyle(
                      fontSize: 12,
                      color: AppTheme.secondary.withValues(alpha: 0.8),
                      height: 1.4,
                    ),
                  ),
                ],
              ),
            ),
            
            const SizedBox(height: 40),
            
            ElevatedButton(
              onPressed: _isLoading ? null : _confirmReservation,
              child: _isLoading 
                  ? const SizedBox(
                      height: 20, 
                      width: 20, 
                      child: CircularProgressIndicator(color: AppTheme.white, strokeWidth: 2)
                    )
                  : const Text('Confirm Reservation'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSummaryRow(IconData icon, String label, String value) {
    return Row(
      children: [
        Icon(icon, size: 20, color: AppTheme.secondary.withValues(alpha: 0.6)),
        const SizedBox(width: 12),
        Text(
          label,
          style: TextStyle(
            color: AppTheme.secondary.withValues(alpha: 0.6),
          ),
        ),
        const Spacer(),
        Text(
          value,
          style: const TextStyle(
            fontWeight: FontWeight.bold,
          ),
        ),
      ],
    );
  }
}

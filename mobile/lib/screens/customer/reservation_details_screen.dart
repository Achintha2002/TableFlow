import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../core/theme.dart';
import '../../providers/cart_provider.dart';
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
          .or('status.eq.confirmed,status.eq.pending,status.eq.seated')
          .timeout(const Duration(seconds: 4));

      if (existingRes.length >= 2) {
        setState(() => _isLoading = false);
        if (mounted) {
          _showBookingLimitReachedDialog(context);
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

      // Automatically link booked table to CartProvider
      final tableNum = int.tryParse(widget.tableId.replaceAll(RegExp(r'[^0-9]'), '')) ?? widget.dbId;
      if (mounted) {
        context.read<CartProvider>().setTable(widget.dbId, tableNum, source: 'reservation');
      }
      
      if (mounted) {
        showDialog(
          context: context,
          barrierDismissible: false,
          builder: (context) => AlertDialog(
            title: const Icon(Icons.check_circle, color: Colors.green, size: 50),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  'Reservation Confirmed',
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    fontFamily: 'Playfair Display',
                  ),
                ),
                const SizedBox(height: 16),
                Text(
                  'Table ${widget.tableId} is booked for ${date.day}/${date.month}/${date.year} at ${widget.time}.\nThis table is now auto-selected in your Cart for ordering.',
                  textAlign: TextAlign.center,
                  style: const TextStyle(height: 1.5),
                ),
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: Colors.green.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: Colors.green.withValues(alpha: 0.3)),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.table_restaurant, size: 16, color: Colors.green),
                      const SizedBox(width: 8),
                      Flexible(
                        child: Text(
                          'Table #$tableNum auto-linked to Cart!',
                          style: const TextStyle(fontSize: 12, color: Colors.green, fontWeight: FontWeight.w600),
                          textAlign: TextAlign.center,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            actions: [
              ElevatedButton.icon(
                onPressed: () {
                  Navigator.of(context).pop();
                  context.go('/menu');
                },
                icon: const Icon(Icons.restaurant_menu, size: 18),
                label: Text('Browse Menu (Table #$tableNum)'),
                style: ElevatedButton.styleFrom(
                  minimumSize: const Size(double.infinity, 44),
                  backgroundColor: AppTheme.primary,
                  foregroundColor: Colors.white,
                ),
              ),
              const SizedBox(height: 8),
              OutlinedButton(
                onPressed: () {
                  Navigator.of(context).pop();
                  context.go('/home');
                },
                style: OutlinedButton.styleFrom(
                  minimumSize: const Size(double.infinity, 44),
                ),
                child: const Text('Back to Home'),
              ),
            ],
          ),
        );
      }
    } catch (e) {
      debugPrint('Reservation error: $e');
      if (mounted) {
        if (e.toString().contains('Maximum 2 active table reservations')) {
          _showBookingLimitReachedDialog(context);
        } else {
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed: $e')));
        }
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _showBookingLimitReachedDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: Colors.amber.shade100,
                shape: BoxShape.circle,
              ),
              child: Icon(Icons.table_restaurant_rounded, color: Colors.amber.shade900, size: 24),
            ),
            const SizedBox(width: 12),
            const Expanded(
              child: Text(
                'Reservation Limit',
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
              ),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.amber.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: Colors.amber.shade300),
              ),
              child: Row(
                children: [
                  Icon(Icons.info_outline, color: Colors.amber.shade900, size: 20),
                  const SizedBox(width: 10),
                  const Expanded(
                    child: Text(
                      'Max 2 Tables Allowed per Account',
                      style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),
            const Text(
              'Each guest account can only hold up to 2 active table reservations at a time to ensure fair seating for all restaurant guests.\n\nYou already have 2 active reservations. Please complete or cancel an existing reservation before booking another table.',
              style: TextStyle(fontSize: 13, height: 1.45, color: Colors.black87),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Close', style: TextStyle(color: Colors.grey)),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.of(ctx).pop();
              context.push('/reservations');
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.primary,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            child: const Text('My Reservations'),
          ),
        ],
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
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Cancellations made less than 24 hours before the reservation time may be subject to a LKR 6000 per person cancellation fee.',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: AppTheme.secondary.withValues(alpha: 0.7),
                height: 1.5,
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

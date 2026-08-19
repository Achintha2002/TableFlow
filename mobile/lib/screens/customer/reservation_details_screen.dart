import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme.dart';

class ReservationDetailsScreen extends StatefulWidget {
  final String tableId;
  const ReservationDetailsScreen({super.key, required this.tableId});

  @override
  State<ReservationDetailsScreen> createState() => _ReservationDetailsScreenState();
}

class _ReservationDetailsScreenState extends State<ReservationDetailsScreen> {
  final _specialRequestsController = TextEditingController();
  bool _isLoading = false;

  void _confirmReservation() async {
    setState(() => _isLoading = true);
    // Simulate API delay
    await Future.delayed(const Duration(seconds: 1));
    setState(() => _isLoading = false);
    
    // Show success dialog
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
                'Table ${widget.tableId} is booked for tonight at 7:00 PM.',
                textAlign: TextAlign.center,
              ),
            ],
          ),
          actions: [
            ElevatedButton(
              onPressed: () {
                Navigator.of(context).pop();
                context.go('/home');
              },
              style: ElevatedButton.styleFrom(
                minimumSize: const Size(double.infinity, 44),
              ),
              child: const Text('Back to Home'),
            ),
          ],
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, size: 20),
          onPressed: () => context.pop(),
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
                  _buildSummaryRow(Icons.calendar_today, 'Date', 'Today, 18 Aug'),
                  const SizedBox(height: 12),
                  _buildSummaryRow(Icons.access_time, 'Time', '7:00 PM'),
                  const SizedBox(height: 12),
                  _buildSummaryRow(Icons.people, 'Guests', '2 People'),
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
              'Cancellations made less than 24 hours before the reservation time may be subject to a \$20 per person cancellation fee.',
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

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import '../../services/api_service.dart';
import 'cancel_reservation_sheet.dart';

class ReservationDetailsSheet extends StatefulWidget {
  final Map<String, dynamic> reservation;
  final VoidCallback? onUpdated;

  const ReservationDetailsSheet({
    super.key,
    required this.reservation,
    this.onUpdated,
  });

  static Future<bool?> show(
    BuildContext context, {
    required Map<String, dynamic> reservation,
    VoidCallback? onUpdated,
  }) {
    return showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => ReservationDetailsSheet(
        reservation: reservation,
        onUpdated: onUpdated,
      ),
    );
  }

  @override
  State<ReservationDetailsSheet> createState() => _ReservationDetailsSheetState();
}

class _ReservationDetailsSheetState extends State<ReservationDetailsSheet> {
  bool _isSeating = false;

  Future<void> _seatGuests() async {
    setState(() => _isSeating = true);
    final id = widget.reservation['id'];
    final tableId = widget.reservation['table_id'] ?? '5';

    try {
      await http.patch(
        Uri.parse('${ApiService.baseUrl}/api/reservations/$id'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'status': 'seated'}),
      );
      // Also mark table occupied
      await http.patch(
        Uri.parse('${ApiService.baseUrl}/api/tables/$tableId'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'status': 'occupied'}),
      );
    } catch (_) {}

    if (mounted) {
      setState(() => _isSeating = false);
      widget.onUpdated?.call();
      Navigator.of(context).pop(true);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Guests seated! Table marked as occupied. 🎉'),
          backgroundColor: Color(0xFF2E7D32),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  void _openCancelSheet() {
    Navigator.of(context).pop();
    showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => CancelReservationSheet(reservation: widget.reservation),
    ).then((val) {
      if (val == true) widget.onUpdated?.call();
    });
  }


  @override
  Widget build(BuildContext context) {
    final res = widget.reservation;
    final guestName = res['customer_name'] ?? res['name'] ?? 'Guest Party';
    final phone = res['customer_phone'] ?? res['phone'] ?? '+1 (555) 019-2834';
    final email = res['customer_email'] ?? 'guest@tableflow.com';
    final pax = res['guest_count'] ?? res['pax'] ?? 2;
    final date = res['reservation_date'] ?? 'Today, Oct 14';
    final time = res['reservation_time'] ?? '7:30 PM';
    final table = res['table_number'] ?? 'Table ${res['table_id'] ?? 5}';
    final status = (res['status'] ?? 'confirmed').toString().toUpperCase();
    final requests = res['special_requests'] ?? 'Anniversary dinner. Window booth requested. 1 guest has shellfish allergy.';

    return Container(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom + 24,
        top: 12,
        left: 20,
        right: 20,
      ),
      decoration: const BoxDecoration(
        color: Color(0xFFFAF7F2),
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Drag handle
          Center(
            child: Container(
              width: 44,
              height: 5,
              decoration: BoxDecoration(
                color: const Color(0xFFE2DDD7),
                borderRadius: BorderRadius.circular(10),
              ),
            ),
          ),
          const SizedBox(height: 18),

          // Header
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: const Color(0xFFB87F5C).withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: const Icon(Icons.receipt_long_outlined, color: Color(0xFFB87F5C), size: 24),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Reservation Details',
                      style: TextStyle(
                        fontFamily: 'Playfair Display',
                        fontSize: 22,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF1E1E1E),
                      ),
                    ),
                    Text(
                      'Booking ref #${res['id'] ?? 'RES-482'}',
                      style: const TextStyle(fontSize: 12, color: Color(0xFF8C827A)),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: const Color(0xFFE8F5E9),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  status,
                  style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF2E7D32)),
                ),
              ),
            ],
          ),
          const SizedBox(height: 18),

          // Guest Card
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: const Color(0xFFEFEAE4)),
            ),
            child: Row(
              children: [
                CircleAvatar(
                  radius: 24,
                  backgroundColor: const Color(0xFFB87F5C).withValues(alpha: 0.15),
                  child: Text(
                    guestName.isNotEmpty ? guestName[0] : 'G',
                    style: const TextStyle(
                      fontFamily: 'Playfair Display',
                      fontWeight: FontWeight.bold,
                      fontSize: 18,
                      color: Color(0xFFB87F5C),
                    ),
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Flexible(
                            child: Text(
                              guestName,
                              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF1E1E1E)),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          const SizedBox(width: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: const Color(0xFFFFF3E0),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: const Text(
                              'VIP Guest',
                              style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFFB87F5C)),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 3),
                      Text(phone, style: const TextStyle(fontSize: 12, color: Color(0xFF8C827A))),
                      Text(email, style: const TextStyle(fontSize: 12, color: Color(0xFF8C827A))),
                    ],
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.phone_outlined, color: Color(0xFFB87F5C)),
                  onPressed: () {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text('Calling $guestName ($phone)')),
                    );
                  },
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),

          // Reservation Spec Grid
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: const Color(0xFFEFEAE4)),
            ),
            child: Column(
              children: [
                _buildInfoRow(Icons.calendar_today_outlined, 'Date & Time', '$date • $time'),
                const Divider(height: 20, color: Color(0xFFF0EBE6)),
                _buildInfoRow(Icons.people_outline, 'Party Size', '$pax Guests'),
                const Divider(height: 20, color: Color(0xFFF0EBE6)),
                _buildInfoRow(Icons.table_restaurant_outlined, 'Assigned Table', table),
              ],
            ),
          ),
          const SizedBox(height: 14),

          // Special Requests Banner
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: const Color(0xFFFFF8E1),
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: const Color(0xFFFFE082)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Row(
                  children: [
                    Icon(Icons.notes, size: 16, color: Color(0xFFF57F17)),
                    SizedBox(width: 6),
                    Text(
                      'SPECIAL REQUESTS & NOTES',
                      style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFFF57F17)),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Text(
                  requests,
                  style: const TextStyle(fontSize: 13, color: Color(0xFF424242)),
                ),
              ],
            ),
          ),
          const SizedBox(height: 22),

          // Action Buttons
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    side: const BorderSide(color: Colors.redAccent),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  ),
                  onPressed: _openCancelSheet,
                  icon: const Icon(Icons.cancel_outlined, color: Colors.redAccent, size: 18),
                  label: const Text('Cancel Booking', style: TextStyle(color: Colors.redAccent, fontWeight: FontWeight.bold)),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFB87F5C),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    elevation: 0,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  ),
                  onPressed: _isSeating ? null : _seatGuests,
                  icon: _isSeating
                      ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                      : const Icon(Icons.restaurant, size: 18),
                  label: Text(_isSeating ? 'Seating...' : 'Seat Guests Now', style: const TextStyle(fontWeight: FontWeight.bold)),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildInfoRow(IconData icon, String label, String value) {
    return Row(
      children: [
        Icon(icon, size: 18, color: const Color(0xFFB87F5C)),
        const SizedBox(width: 10),
        Text(label, style: const TextStyle(fontSize: 13, color: Color(0xFF8C827A))),
        const Spacer(),
        Text(value, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Color(0xFF1E1E1E))),
      ],
    );
  }
}

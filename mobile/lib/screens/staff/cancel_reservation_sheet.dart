import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';
import 'dart:convert';
import '../../services/api_service.dart';

class CancelReservationSheet extends StatefulWidget {
  final Map<String, dynamic> reservation;

  const CancelReservationSheet({super.key, required this.reservation});

  @override
  State<CancelReservationSheet> createState() => _CancelReservationSheetState();
}

class _CancelReservationSheetState extends State<CancelReservationSheet> {
  String _selectedReason = 'Customer called hotline (>10m policy)';
  final TextEditingController _notesController = TextEditingController();
  bool _isProcessing = false;

  final List<String> _reasons = [
    'Customer called hotline (>10m policy)',
    'Customer cancelled',
    'No show',
    'Duplicate booking',
    'Operational delay',
    'Other'
  ];

  @override
  void dispose() {
    _notesController.dispose();
    super.dispose();
  }

  Future<void> _handleCancel() async {
    setState(() => _isProcessing = true);
    final resId = widget.reservation['id'];
    try {
      final token = Supabase.instance.client.auth.currentSession?.accessToken;
      final url = Uri.parse('${ApiService.baseUrl}/api/reservations/$resId/cancel-with-reason');
      final res = await http.patch(
        url,
        headers: {
          'Content-Type': 'application/json',
          if (token != null) 'Authorization': 'Bearer $token',
        },
        body: jsonEncode({
          'reason': _selectedReason,
          'notes': _notesController.text.trim(),
        }),
      );

      if (!mounted) return;
      if (res.statusCode == 200) {
        Navigator.pop(context, true);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            backgroundColor: Color(0xFFEF4444),
            content: Text('Reservation cancelled successfully'),
          ),
        );
      } else {
        Navigator.pop(context, true);
      }
    } catch (e) {
      if (mounted) Navigator.pop(context, true);
    } finally {
      if (mounted) setState(() => _isProcessing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final r = widget.reservation;
    final customerName = r['customer_name'] ?? r['users']?['full_name'] ?? 'Guest';
    final phone = r['phone'] ?? '071 234 5678';
    final rawTime = r['reservation_time'] ?? '19:00';
    final partySize = r['party_size'] ?? 2;
    final tableNum = r['table_number'] ?? r['restaurant_tables']?['table_number'] ?? '3';

    return Container(
      decoration: const BoxDecoration(
        color: Color(0xFFFAF7F2),
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: EdgeInsets.fromLTRB(20, 16, 20, MediaQuery.of(context).viewInsets.bottom + 20),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Top Bar
            Row(
              children: [
                IconButton(
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(),
                  icon: const Icon(Icons.arrow_back_ios_new, size: 18, color: Color(0xFF1E1E1E)),
                  onPressed: () => Navigator.pop(context),
                ),
                const Expanded(
                  child: Text(
                    'Cancel Reservation',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontFamily: 'Playfair Display',
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF1E1E1E),
                    ),
                  ),
                ),
                const SizedBox(width: 18),
              ],
            ),
            const SizedBox(height: 20),

            // RESERVATION DETAILS Summary Box
            const Text(
              'RESERVATION DETAILS',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                letterSpacing: 1.2,
                color: Color(0xFF8C827A),
              ),
            ),
            const SizedBox(height: 10),

            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFEBE5DF)),
              ),
              child: Column(
                children: [
                  _buildDetailRow(Icons.person_outline, customerName, subtext: phone),
                  const Divider(height: 18, color: Color(0xFFF3ECE6)),
                  _buildDetailRow(Icons.calendar_today_outlined, 'Today, $rawTime'),
                  const Divider(height: 18, color: Color(0xFFF3ECE6)),
                  _buildDetailRow(Icons.people_outline, '$partySize People'),
                  const Divider(height: 18, color: Color(0xFFF3ECE6)),
                  _buildDetailRow(Icons.table_restaurant_outlined, 'Table $tableNum'),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // REASON FOR CANCELLATION Section
            const Text(
              'REASON FOR CANCELLATION',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                letterSpacing: 1.2,
                color: Color(0xFF8C827A),
              ),
            ),
            const SizedBox(height: 10),

            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: const Color(0xFFEBE5DF)),
              ),
              child: DropdownButtonHideUnderline(
                child: DropdownButton<String>(
                  value: _selectedReason,
                  isExpanded: true,
                  icon: const Icon(Icons.keyboard_arrow_down, color: Color(0xFF8C827A)),
                  items: _reasons.map((reason) {
                    return DropdownMenuItem(
                      value: reason,
                      child: Text(
                        reason,
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF1E1E1E),
                        ),
                      ),
                    );
                  }).toList(),
                  onChanged: (val) {
                    if (val != null) setState(() => _selectedReason = val);
                  },
                ),
              ),
            ),
            const SizedBox(height: 14),

            // Additional Notes Text Area
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: const Color(0xFFEBE5DF)),
              ),
              child: Column(
                children: [
                  TextField(
                    controller: _notesController,
                    maxLines: 3,
                    maxLength: 200,
                    decoration: const InputDecoration(
                      hintText: 'Add additional notes (optional)',
                      hintStyle: TextStyle(fontSize: 13, color: Color(0xFFA59D95)),
                      border: InputBorder.none,
                      counterText: '',
                    ),
                    style: const TextStyle(fontSize: 13, color: Color(0xFF1E1E1E)),
                    onChanged: (_) => setState(() {}),
                  ),
                  Align(
                    alignment: Alignment.bottomRight,
                    child: Text(
                      '${_notesController.text.length}/200',
                      style: const TextStyle(fontSize: 10, color: Color(0xFFA59D95)),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 28),

            // Actions: Back & Cancel Reservation
            Row(
              children: [
                Expanded(
                  child: SizedBox(
                    height: 50,
                    child: OutlinedButton(
                      onPressed: () => Navigator.pop(context),
                      style: OutlinedButton.styleFrom(
                        side: const BorderSide(color: Color(0xFFD4CDC5), width: 1.2),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      child: const Text(
                        'Back',
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF5A524C),
                        ),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: SizedBox(
                    height: 50,
                    child: ElevatedButton(
                      onPressed: _isProcessing ? null : _handleCancel,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF8B4513),
                        foregroundColor: Colors.white,
                        elevation: 0,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      child: _isProcessing
                          ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                          : const Text(
                              'Cancel Reservation',
                              style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700),
                            ),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDetailRow(IconData icon, String text, {String? subtext}) {
    const primaryColor = Color(0xFFB87F5C);

    return Row(
      children: [
        Icon(icon, color: primaryColor, size: 18),
        const SizedBox(width: 12),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              text,
              style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Color(0xFF1E1E1E)),
            ),
            if (subtext != null)
              Text(
                subtext,
                style: const TextStyle(fontSize: 12, color: Color(0xFF8C827A)),
              ),
          ],
        ),
      ],
    );
  }
}

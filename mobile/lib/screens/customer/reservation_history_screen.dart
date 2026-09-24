import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:http/http.dart' as http;
import '../../core/theme.dart';
import '../../services/api_service.dart';
import '../../widgets/guest_placeholder.dart';
import 'package:intl/intl.dart';

class ReservationHistoryScreen extends StatefulWidget {
  const ReservationHistoryScreen({super.key});

  @override
  State<ReservationHistoryScreen> createState() => _ReservationHistoryScreenState();
}

class _ReservationHistoryScreenState extends State<ReservationHistoryScreen> {
  bool _isLoading = true;
  List<Map<String, dynamic>> _reservations = [];
  RealtimeChannel? _channel;

  @override
  void initState() {
    super.initState();
    _fetchReservations();
    _setupRealtime();
  }

  void _setupRealtime() {
    final userId = Supabase.instance.client.auth.currentUser?.id;
    if (userId == null) return;

    _channel = Supabase.instance.client
        .channel('public:reservations_history')
        .onPostgresChanges(
            event: PostgresChangeEvent.all,
            schema: 'public',
            table: 'reservations',
            filter: PostgresChangeFilter(
              type: PostgresChangeFilterType.eq,
              column: 'user_id',
              value: userId,
            ),
            callback: (payload) {
              _fetchReservations();
            })
        .subscribe();
  }

  @override
  void dispose() {
    _channel?.unsubscribe();
    super.dispose();
  }

  void _confirmCancelReservation(Map<String, dynamic> res) {
    final tableNumber = res['restaurant_tables']?['table_number'] ?? 'N/A';
    final date = DateTime.tryParse(res['reservation_date'] ?? '') ?? DateTime.now();
    final time = res['reservation_time']?.toString().substring(0, 5) ?? '';

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Row(
          children: [
            Icon(Icons.cancel_outlined, color: Colors.redAccent, size: 26),
            SizedBox(width: 10),
            Text('Cancel Reservation?'),
          ],
        ),
        content: Text(
          'Are you sure you want to cancel your booking for Table $tableNumber on ${DateFormat('MMM dd, yyyy').format(date)} at $time?\n\nThis table will be released for other guests.',
          style: const TextStyle(fontSize: 14, height: 1.4),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Keep Booking', style: TextStyle(color: Colors.grey)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.redAccent,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            onPressed: () async {
              Navigator.of(ctx).pop();
              try {
                await Supabase.instance.client
                    .from('reservations')
                    .update({'status': 'cancelled'})
                    .eq('id', res['id']);

                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Reservation cancelled successfully.'),
                      backgroundColor: Colors.redAccent,
                      behavior: SnackBarBehavior.floating,
                    ),
                  );
                  _fetchReservations();
                }
              } catch (e) {
                try {
                  final token = Supabase.instance.client.auth.currentSession?.accessToken;
                  await http.post(
                    Uri.parse('${ApiService.baseUrl}/api/reservations/${res['id']}/cancel'),
                    headers: {
                      'Authorization': 'Bearer $token',
                      'Content-Type': 'application/json',
                    },
                  );
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text('Reservation cancelled successfully.'),
                        backgroundColor: Colors.redAccent,
                        behavior: SnackBarBehavior.floating,
                      ),
                    );
                    _fetchReservations();
                  }
                } catch (err) {
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text('Failed to cancel: $err')),
                    );
                  }
                }
              }
            },
            child: const Text('Yes, Cancel', style: TextStyle(fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  void _showModifyReservationSheet(Map<String, dynamic> res) {
    DateTime selectedDate = DateTime.tryParse(res['reservation_date'] ?? '') ?? DateTime.now();
    final timeStr = res['reservation_time']?.toString().substring(0, 5) ?? '19:00';
    final parts = timeStr.split(':');
    TimeOfDay selectedTime = TimeOfDay(
      hour: int.tryParse(parts[0]) ?? 19,
      minute: int.tryParse(parts.length > 1 ? parts[1] : '0') ?? 0,
    );
    int pax = (res['pax'] as num?)?.toInt() ?? 2;
    final requestsCtrl = TextEditingController(text: res['special_requests']?.toString() ?? '');
    bool isSaving = false;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) {
          return Container(
            padding: EdgeInsets.only(
              top: 20,
              left: 20,
              right: 20,
              bottom: MediaQuery.of(ctx).viewInsets.bottom + 24,
            ),
            decoration: const BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
            ),
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Center(
                    child: Container(
                      width: 40,
                      height: 4,
                      decoration: BoxDecoration(color: Colors.grey.shade300, borderRadius: BorderRadius.circular(4)),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'Modify Booking #${res['restaurant_tables']?['table_number'] != null ? 'Table ${res['restaurant_tables']['table_number']}' : ''}',
                        style: const TextStyle(fontFamily: 'Playfair Display', fontSize: 20, fontWeight: FontWeight.bold),
                      ),
                      IconButton(
                        icon: const Icon(Icons.close),
                        onPressed: () => Navigator.pop(ctx),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),

                  // Date selector
                  ListTile(
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: BorderSide(color: Colors.grey.shade300)),
                    leading: const Icon(Icons.calendar_today_rounded, color: AppTheme.primary),
                    title: const Text('Date', style: TextStyle(fontSize: 12, color: Colors.grey)),
                    subtitle: Text(DateFormat('EEEE, MMM dd, yyyy').format(selectedDate), style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                    trailing: const Icon(Icons.edit_outlined, size: 18),
                    onTap: () async {
                      final picked = await showDatePicker(
                        context: context,
                        initialDate: selectedDate.isBefore(DateTime.now()) ? DateTime.now() : selectedDate,
                        firstDate: DateTime.now(),
                        lastDate: DateTime.now().add(const Duration(days: 60)),
                      );
                      if (picked != null) {
                        setSheetState(() => selectedDate = picked);
                      }
                    },
                  ),
                  const SizedBox(height: 12),

                  // Time selector
                  ListTile(
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: BorderSide(color: Colors.grey.shade300)),
                    leading: const Icon(Icons.access_time_rounded, color: AppTheme.primary),
                    title: const Text('Time', style: TextStyle(fontSize: 12, color: Colors.grey)),
                    subtitle: Text(selectedTime.format(context), style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                    trailing: const Icon(Icons.edit_outlined, size: 18),
                    onTap: () async {
                      final picked = await showTimePicker(context: context, initialTime: selectedTime);
                      if (picked != null) {
                        setSheetState(() => selectedTime = picked);
                      }
                    },
                  ),
                  const SizedBox(height: 16),

                  // Pax Stepper
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Number of Guests:', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                      Row(
                        children: [
                          IconButton(
                            onPressed: pax > 1 ? () => setSheetState(() => pax--) : null,
                            icon: const Icon(Icons.remove_circle_outline),
                          ),
                          Text('$pax Guests', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                          IconButton(
                            onPressed: pax < 20 ? () => setSheetState(() => pax++) : null,
                            icon: const Icon(Icons.add_circle_outline, color: AppTheme.primary),
                          ),
                        ],
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),

                  // Special requests field
                  TextField(
                    controller: requestsCtrl,
                    maxLines: 2,
                    decoration: InputDecoration(
                      labelText: 'Special Requests / Dietary Notes',
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    ),
                  ),
                  const SizedBox(height: 20),

                  // Save button
                  ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppTheme.primary,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    ),
                    onPressed: isSaving ? null : () async {
                      setSheetState(() => isSaving = true);
                      final formattedDate = DateFormat('yyyy-MM-dd').format(selectedDate);
                      final formattedTime = '${selectedTime.hour.toString().padLeft(2, '0')}:${selectedTime.minute.toString().padLeft(2, '0')}:00';

                      try {
                        final token = Supabase.instance.client.auth.currentSession?.accessToken;
                        final response = await http.patch(
                          Uri.parse('${ApiService.baseUrl}/api/reservations/${res['id']}'),
                          headers: {
                            'Authorization': 'Bearer $token',
                            'Content-Type': 'application/json',
                          },
                          body: jsonEncode({
                            'reservation_date': formattedDate,
                            'reservation_time': formattedTime,
                            'pax': pax,
                            'special_requests': requestsCtrl.text.trim(),
                          }),
                        );

                        if (context.mounted) Navigator.pop(ctx);

                        if (response.statusCode == 200) {
                          if (mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                content: Text('Reservation updated successfully!'),
                                backgroundColor: Colors.green,
                                behavior: SnackBarBehavior.floating,
                              ),
                            );
                            _fetchReservations();
                          }
                        } else {
                          final data = jsonDecode(response.body);
                          throw Exception(data['error'] ?? 'Failed to update reservation');
                        }
                      } catch (e) {
                        setSheetState(() => isSaving = false);
                        if (mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              content: Text('Update failed: $e'),
                              backgroundColor: Colors.redAccent,
                              behavior: SnackBarBehavior.floating,
                            ),
                          );
                        }
                      }
                    },
                    child: isSaving
                        ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                        : const Text('Save Changes', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Future<void> _fetchReservations() async {
    try {
      final userId = Supabase.instance.client.auth.currentUser?.id;
      if (userId == null) {
        if (mounted) setState(() => _isLoading = false);
        return;
      }

      final data = await Supabase.instance.client
          .from('reservations')
          .select('*, restaurant_tables(table_number)')
          .eq('user_id', userId)
          .order('reservation_date', ascending: false)
          .order('reservation_time', ascending: false);

      if (mounted) {
        setState(() {
          _reservations = List<Map<String, dynamic>>.from(data);
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios, color: AppTheme.secondary),
          onPressed: () {
            if (context.canPop()) {
              context.pop();
            } else {
              context.go('/home');
            }
          },
        ),
        title: Text(
          'My Reservations',
          style: Theme.of(context).textTheme.titleLarge?.copyWith(
            fontFamily: 'Playfair Display',
            fontWeight: FontWeight.bold,
          ),
        ),
        centerTitle: true,
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      body: Supabase.instance.client.auth.currentUser == null
          ? GuestPlaceholder(
              title: 'My Reservations',
              description: 'Sign in to TableFlow to view your upcoming table reservations, manager replies, and booking details.',
              icon: Icons.event_seat,
              onSignedIn: _fetchReservations,
            )
          : _isLoading
              ? const Center(child: CircularProgressIndicator())
              : _reservations.isEmpty
                  ? const Center(child: Text('No reservations found.'))
                  : ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: _reservations.length,
                  itemBuilder: (context, index) {
                    final res = _reservations[index];
                    final date = DateTime.tryParse(res['reservation_date'] ?? '') ?? DateTime.now();
                    final time = res['reservation_time']?.toString().substring(0, 5) ?? '';
                    final tableNumber = res['restaurant_tables']?['table_number'] ?? 'N/A';
                    
                    return Card(
                      margin: const EdgeInsets.only(bottom: 16),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                      child: Padding(
                        padding: const EdgeInsets.all(16.0),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(
                                  'Table $tableNumber',
                                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
                                ),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                                  decoration: BoxDecoration(
                                    color: res['status'] == 'confirmed'
                                        ? Colors.green.withValues(alpha: 0.12)
                                        : res['status'] == 'cancelled'
                                            ? Colors.red.withValues(alpha: 0.12)
                                            : Colors.orange.withValues(alpha: 0.12),
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                  child: Text(
                                    (res['status'] as String? ?? 'PENDING').toUpperCase(),
                                    style: TextStyle(
                                      color: res['status'] == 'confirmed'
                                          ? Colors.green.shade700
                                          : res['status'] == 'cancelled'
                                              ? Colors.red.shade700
                                              : Colors.orange.shade800,
                                      fontWeight: FontWeight.bold,
                                      fontSize: 12,
                                    ),
                                  ),
                                )
                              ],
                            ),
                            const SizedBox(height: 8),
                            Text(
                              '${DateFormat('MMM dd, yyyy').format(date)} at $time',
                              style: TextStyle(color: Colors.grey.shade600, fontSize: 14),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              'Guests: ${res['pax']}',
                              style: TextStyle(color: Colors.grey.shade600, fontSize: 14),
                            ),
                            
                            if (res['special_requests'] != null && res['special_requests'].toString().isNotEmpty) ...[
                              const Divider(height: 24),
                              const Text('Special Requests:', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                              const SizedBox(height: 4),
                              Text(
                                '"${res['special_requests']}"',
                                style: const TextStyle(fontStyle: FontStyle.italic, fontSize: 14),
                              ),
                            ],

                            if (res['admin_reply'] != null && res['admin_reply'].toString().isNotEmpty) ...[
                              const SizedBox(height: 12),
                              Container(
                                width: double.infinity,
                                padding: const EdgeInsets.all(12),
                                decoration: BoxDecoration(
                                  color: AppTheme.primary.withValues(alpha: 0.1),
                                  borderRadius: BorderRadius.circular(8),
                                  border: Border.all(color: AppTheme.primary.withValues(alpha: 0.3)),
                                ),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    const Row(
                                      children: [
                                        Icon(Icons.message, size: 16, color: AppTheme.primary),
                                        SizedBox(width: 8),
                                        Text('Reply from Admin:', style: TextStyle(fontWeight: FontWeight.bold, color: AppTheme.primary, fontSize: 13)),
                                      ],
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      res['admin_reply'],
                                      style: const TextStyle(fontSize: 14),
                                    ),
                                  ],
                                ),
                              ),
                            ],

                            // ── Modify & Cancel Action Buttons right on the booking card ──
                            if (res['status'] != 'cancelled' && res['status'] != 'completed') ...[
                              const SizedBox(height: 16),
                              Row(
                                children: [
                                  Expanded(
                                    child: OutlinedButton.icon(
                                      onPressed: () => _showModifyReservationSheet(res),
                                      icon: const Icon(Icons.edit_calendar_rounded, size: 16, color: AppTheme.primary),
                                      label: const Text('Modify', style: TextStyle(color: AppTheme.primary, fontWeight: FontWeight.bold)),
                                      style: OutlinedButton.styleFrom(
                                        side: const BorderSide(color: AppTheme.primary, width: 1.5),
                                        padding: const EdgeInsets.symmetric(vertical: 11),
                                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: ElevatedButton.icon(
                                      onPressed: () => _confirmCancelReservation(res),
                                      icon: const Icon(Icons.cancel_outlined, size: 16, color: Colors.redAccent),
                                      label: const Text('Cancel', style: TextStyle(color: Colors.redAccent, fontWeight: FontWeight.bold)),
                                      style: ElevatedButton.styleFrom(
                                        backgroundColor: Colors.red.withValues(alpha: 0.08),
                                        foregroundColor: Colors.redAccent,
                                        elevation: 0,
                                        padding: const EdgeInsets.symmetric(vertical: 11),
                                        shape: RoundedRectangleBorder(
                                          borderRadius: BorderRadius.circular(10),
                                          side: BorderSide(color: Colors.red.withValues(alpha: 0.35)),
                                        ),
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ],
                        ),
                      ),
                    );
                  },
                ),
    );
  }
}

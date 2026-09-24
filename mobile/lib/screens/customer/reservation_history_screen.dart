import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:http/http.dart' as http;
import 'package:url_launcher/url_launcher.dart';
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

  static const String restaurantHotline = '+94 11 234 5678';

  int _getMinutesElapsed(Map<String, dynamic> res) {
    final createdAtStr = res['created_at'];
    if (createdAtStr == null) return 999;
    final createdAt = DateTime.tryParse(createdAtStr);
    if (createdAt == null) return 999;
    final diffSeconds = DateTime.now().toUtc().difference(createdAt.toUtc()).inSeconds;
    if (diffSeconds < 0) return 0;
    return diffSeconds ~/ 60;
  }

  bool _isWithin10Minutes(Map<String, dynamic> res) {
    return _getMinutesElapsed(res) < 10;
  }

  int _getMinutesRemaining(Map<String, dynamic> res) {
    final elapsed = _getMinutesElapsed(res);
    final remaining = 10 - elapsed;
    return remaining > 0 ? remaining : 0;
  }

  void _confirmCancelReservation(Map<String, dynamic> res, int remainingMins) {
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
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Are you sure you want to cancel your booking for Table $tableNumber on ${DateFormat('MMM dd, yyyy').format(date)} at $time?',
              style: const TextStyle(fontSize: 14, height: 1.4),
            ),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: Colors.green.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: Colors.green.withValues(alpha: 0.3)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.timer_outlined, color: Colors.green, size: 18),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'You are within the 10-minute cancellation window ($remainingMins min left). Instant cancellation will immediately release this table.',
                      style: TextStyle(fontSize: 12, color: Colors.green.shade800, fontWeight: FontWeight.w600),
                    ),
                  ),
                ],
              ),
            ),
          ],
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
              await _executeCancellation(res);
            },
            child: const Text('Yes, Cancel', style: TextStyle(fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  Future<void> _executeCancellation(Map<String, dynamic> res) async {
    try {
      final token = Supabase.instance.client.auth.currentSession?.accessToken;
      final response = await http.post(
        Uri.parse('${ApiService.baseUrl}/api/reservations/${res['id']}/cancel'),
        headers: {
          if (token != null) 'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
        },
      );

      if (!mounted) return;

      if (response.statusCode == 200) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Reservation cancelled successfully. Table has been released.'),
            backgroundColor: Colors.redAccent,
            behavior: SnackBarBehavior.floating,
          ),
        );
        _fetchReservations();
      } else {
        final body = jsonDecode(response.body);
        if (body['code'] == 'HOTLINE_REQUIRED') {
          _showHotlineCancellationDialog(res, body['minutesElapsed'] ?? 10);
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(body['error'] ?? 'Failed to cancel reservation'),
              backgroundColor: Colors.redAccent,
              behavior: SnackBarBehavior.floating,
            ),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to cancel: $e')),
        );
      }
    }
  }

  void _showHotlineCancellationDialog(Map<String, dynamic> res, int minutesElapsed) {
    const hotline = restaurantHotline;
    final tableNumber = res['restaurant_tables']?['table_number'] ?? 'N/A';
    final date = DateTime.tryParse(res['reservation_date'] ?? '') ?? DateTime.now();
    final time = res['reservation_time']?.toString().substring(0, 5) ?? '';

    String elapsedText;
    if (minutesElapsed >= 1440) {
      final days = minutesElapsed ~/ 1440;
      elapsedText = '$days day${days > 1 ? 's' : ''} ago';
    } else if (minutesElapsed >= 60) {
      final hours = minutesElapsed ~/ 60;
      final mins = minutesElapsed % 60;
      elapsedText = '$hours h $mins m ago';
    } else {
      elapsedText = '$minutesElapsed minutes ago';
    }

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Material(
        color: Colors.white,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
        clipBehavior: Clip.antiAlias,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 16, 24, 32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
              child: Container(
                width: 44,
                height: 5,
                decoration: BoxDecoration(
                  color: Colors.grey.shade300,
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
            ),
            const SizedBox(height: 20),

            // Header
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.orange.withValues(alpha: 0.12),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(Icons.support_agent_rounded, color: Colors.orange.shade800, size: 28),
                ),
                const SizedBox(width: 14),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Cancellation Policy',
                        style: TextStyle(
                          fontFamily: 'Playfair Display',
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      SizedBox(height: 2),
                      Text(
                        '10-Minute Policy Reached',
                        style: TextStyle(color: Colors.grey, fontSize: 13),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.close, color: Colors.grey),
                  onPressed: () => Navigator.pop(ctx),
                ),
              ],
            ),
            const SizedBox(height: 18),

            // Booking summary card
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: const Color(0xFFF9FAFB),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: Colors.grey.shade200),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'Table $tableNumber',
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: Colors.orange.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          'Booked $elapsedText',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                            color: Colors.orange.shade900,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    '${DateFormat('MMM dd, yyyy').format(date)} at $time • ${res['pax']} Guests',
                    style: TextStyle(fontSize: 13, color: Colors.grey.shade600),
                  ),
                  const Divider(height: 20),
                  Text(
                    'Direct in-app cancellations are only allowed within 10 minutes of booking to avoid conflicts with kitchen prep and floor seating.',
                    style: TextStyle(fontSize: 13, height: 1.45, color: Colors.grey.shade800),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'To cancel or reschedule your reservation now, please call our hotline. Our reservations desk will be pleased to assist you.',
                    style: TextStyle(fontSize: 13, height: 1.45, color: Colors.grey.shade800),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // Hotline Contact Box
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    AppTheme.primary.withValues(alpha: 0.08),
                    AppTheme.secondary.withValues(alpha: 0.04),
                  ],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppTheme.primary.withValues(alpha: 0.3)),
              ),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: AppTheme.primary,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(Icons.phone_in_talk_rounded, color: Colors.white, size: 22),
                  ),
                  const SizedBox(width: 14),
                  const Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Restaurant Reservations Hotline',
                          style: TextStyle(fontSize: 12, color: Colors.grey, fontWeight: FontWeight.w600),
                        ),
                        SizedBox(height: 3),
                        Text(
                          hotline,
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                            color: AppTheme.primary,
                            letterSpacing: 0.5,
                          ),
                        ),
                        SizedBox(height: 2),
                        Text(
                          'Available Daily: 8:00 AM - 11:00 PM',
                          style: TextStyle(fontSize: 11, color: Colors.grey),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            // Action Buttons
            Row(
              children: [
                Expanded(
                  flex: 3,
                  child: ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.green.shade600,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                      elevation: 0,
                    ),
                    onPressed: () async {
                      final uri = Uri.parse('tel:${hotline.replaceAll(' ', '')}');
                      try {
                        if (await canLaunchUrl(uri)) {
                          await launchUrl(uri);
                        } else {
                          await launchUrl(uri, mode: LaunchMode.externalApplication);
                        }
                      } catch (_) {
                        await Clipboard.setData(const ClipboardData(text: hotline));
                        if (mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text('Hotline number copied to clipboard: $hotline'),
                              backgroundColor: Colors.green,
                              behavior: SnackBarBehavior.floating,
                            ),
                          );
                        }
                      }
                    },
                    icon: const Icon(Icons.call, size: 18),
                    label: const Text('Call Hotline Now', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  flex: 2,
                  child: OutlinedButton.icon(
                    style: OutlinedButton.styleFrom(
                      foregroundColor: Colors.black87,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      side: BorderSide(color: Colors.grey.shade400),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    ),
                    onPressed: () async {
                      await Clipboard.setData(const ClipboardData(text: hotline));
                      if (mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                            content: Text('Hotline number copied: $hotline'),
                            backgroundColor: Colors.black87,
                            behavior: SnackBarBehavior.floating,
                          ),
                        );
                      }
                    },
                    icon: const Icon(Icons.copy_rounded, size: 16),
                    label: const Text('Copy', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
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
          return Material(
            color: Colors.white,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
            clipBehavior: Clip.antiAlias,
            child: Padding(
              padding: EdgeInsets.only(
                top: 20,
                left: 20,
                right: 20,
                bottom: MediaQuery.of(ctx).viewInsets.bottom + 24,
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
                    Material(
                      color: Colors.transparent,
                      child: ListTile(
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
                    ),
                    const SizedBox(height: 12),

                    // Time selector
                    Material(
                      color: Colors.transparent,
                      child: ListTile(
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
                    final isWithin10Min = _isWithin10Minutes(res);
                    final remainingMins = _getMinutesRemaining(res);
                    final minutesElapsed = _getMinutesElapsed(res);
                    
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

                            // ── Cancellation Policy Banner for Active Bookings ──
                            if (res['status'] != 'cancelled' && res['status'] != 'completed') ...[
                              const SizedBox(height: 12),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
                                decoration: BoxDecoration(
                                  color: isWithin10Min
                                      ? Colors.green.withValues(alpha: 0.08)
                                      : Colors.orange.withValues(alpha: 0.08),
                                  borderRadius: BorderRadius.circular(8),
                                  border: Border.all(
                                    color: isWithin10Min
                                        ? Colors.green.withValues(alpha: 0.25)
                                        : Colors.orange.withValues(alpha: 0.25),
                                  ),
                                ),
                                child: Row(
                                  children: [
                                    Icon(
                                      isWithin10Min ? Icons.timer_outlined : Icons.headset_mic_outlined,
                                      size: 15,
                                      color: isWithin10Min ? Colors.green.shade700 : Colors.orange.shade900,
                                    ),
                                    const SizedBox(width: 6),
                                    Expanded(
                                      child: Text(
                                        isWithin10Min
                                            ? 'Instant cancel available ($remainingMins min left)'
                                            : 'Grace period ended • Cancel via Hotline',
                                        style: TextStyle(
                                          fontSize: 12,
                                          fontWeight: FontWeight.w600,
                                          color: isWithin10Min ? Colors.green.shade800 : Colors.orange.shade900,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],

                            // ── Modify & Cancel Action Buttons right on the booking card ──
                            if (res['status'] != 'cancelled' && res['status'] != 'completed') ...[
                              const SizedBox(height: 14),
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
                                      onPressed: isWithin10Min
                                          ? () => _confirmCancelReservation(res, remainingMins)
                                          : () => _showHotlineCancellationDialog(res, minutesElapsed),
                                      icon: Icon(
                                        isWithin10Min ? Icons.cancel_outlined : Icons.phone_in_talk_rounded,
                                        size: 16,
                                        color: isWithin10Min ? Colors.redAccent : Colors.orange.shade900,
                                      ),
                                      label: Text(
                                        isWithin10Min ? 'Cancel (${remainingMins}m left)' : 'Cancel (Hotline)',
                                        style: TextStyle(
                                          color: isWithin10Min ? Colors.redAccent : Colors.orange.shade900,
                                          fontWeight: FontWeight.bold,
                                        ),
                                      ),
                                      style: ElevatedButton.styleFrom(
                                        backgroundColor: isWithin10Min
                                            ? Colors.red.withValues(alpha: 0.08)
                                            : Colors.orange.withValues(alpha: 0.1),
                                        foregroundColor: isWithin10Min ? Colors.redAccent : Colors.orange.shade900,
                                        elevation: 0,
                                        padding: const EdgeInsets.symmetric(vertical: 11),
                                        shape: RoundedRectangleBorder(
                                          borderRadius: BorderRadius.circular(10),
                                          side: BorderSide(
                                            color: isWithin10Min
                                                ? Colors.red.withValues(alpha: 0.35)
                                                : Colors.orange.withValues(alpha: 0.4),
                                          ),
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

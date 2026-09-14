import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../core/theme.dart';
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

  Future<void> _fetchReservations() async {
    try {
      final userId = Supabase.instance.client.auth.currentUser?.id;
      if (userId == null) return;

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
          onPressed: () => context.pop(),
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
      body: _isLoading
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
                                    color: res['status'] == 'confirmed' ? Colors.green.withValues(alpha: 0.1) : Colors.orange.withValues(alpha: 0.1),
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                  child: Text(
                                    (res['status'] as String).toUpperCase(),
                                    style: TextStyle(
                                      color: res['status'] == 'confirmed' ? Colors.green : Colors.orange,
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
                          ],
                        ),
                      ),
                    );
                  },
                ),
    );
  }
}

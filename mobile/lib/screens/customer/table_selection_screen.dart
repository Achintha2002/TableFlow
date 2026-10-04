
import 'package:flutter/material.dart';
import 'package:flutter/cupertino.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../core/theme.dart';
import '../../services/supabase_service.dart';
import '../../utils/auth_guard.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class TableSelectionScreen extends StatefulWidget {
  const TableSelectionScreen({super.key});

  @override
  State<TableSelectionScreen> createState() => _TableSelectionScreenState();
}

class _TableSelectionScreenState extends State<TableSelectionScreen> {
  String? _selectedTableId;
  DateTime _selectedDate = DateTime(
    DateTime.now().year,
    DateTime.now().month,
    DateTime.now().day,
  );
  TimeOfDay _selectedTime = const TimeOfDay(hour: 19, minute: 0);

  List<Map<String, dynamic>> _tables = [];
  bool _isLoading = true;

  RealtimeChannel? _tablesChannel;
  RealtimeChannel? _reservationsChannel;

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    if (_selectedDate.isBefore(today)) {
      _selectedDate = today;
    }
    if (_selectedDate.isAtSameMomentAs(today)) {
      final currentMinutes = now.hour * 60 + now.minute;
      final selectedMinutes = _selectedTime.hour * 60 + _selectedTime.minute;
      if (selectedMinutes <= currentMinutes) {
        final nextHour = (now.hour + 1).clamp(0, 23);
        _selectedTime = TimeOfDay(hour: nextHour, minute: 0);
      }
    }
    _fetchTables();
    _setupRealtime();
  }

  void _setupRealtime() {
    try {
      _tablesChannel = Supabase.instance.client.channel('public:restaurant_tables')
        .onPostgresChanges(
          event: PostgresChangeEvent.all, 
          schema: 'public', 
          table: 'restaurant_tables', 
          callback: (payload) => _fetchTables(silent: true),
        ).subscribe();

      _reservationsChannel = Supabase.instance.client.channel('public:reservations')
        .onPostgresChanges(
          event: PostgresChangeEvent.all, 
          schema: 'public', 
          table: 'reservations', 
          callback: (payload) => _fetchTables(silent: true),
        ).subscribe();
    } catch (e) {
      debugPrint('Realtime channel subscription error: $e');
    }
  }

  @override
  void dispose() {
    _tablesChannel?.unsubscribe();
    _reservationsChannel?.unsubscribe();
    super.dispose();
  }

  Future<void> _fetchTables({bool silent = false}) async {
    if (!silent) {
      setState(() => _isLoading = true);
    }
    try {
      // 1. Fetch tables with timeout & fallback support from SupabaseService
      final data = await SupabaseService.getTables();
      
      final dateStr = '${_selectedDate.year}-${_selectedDate.month.toString().padLeft(2, '0')}-${_selectedDate.day.toString().padLeft(2, '0')}';
      
      // 2. Fetch reservations safely: use .or() for enum types to avoid PostgREST 500 error
      List<dynamic> reservationsData = [];
      try {
        final res = await Supabase.instance.client
            .from('reservations')
            .select('table_id, reservation_time, status')
            .eq('reservation_date', dateStr)
            .or('status.eq.pending,status.eq.confirmed')
            .timeout(const Duration(seconds: 3));
        reservationsData = res;
      } catch (resErr) {
        debugPrint('Could not fetch reservations for $dateStr (RLS or Enum): $resErr');
        // Gracefully proceed with empty reservations list so tables still display!
      }

      if (mounted) {
        setState(() {
          _tables = data.map((t) {
            final tableId = t['id'];
            bool isAvailable = t['status'] == 'available';

            if (isAvailable && reservationsData.isNotEmpty) {
              final selectedMinutes = _selectedTime.hour * 60 + _selectedTime.minute;
              
              for (var res in reservationsData) {
                if (res['table_id'] == tableId) {
                  final resTimeStr = res['reservation_time']?.toString() ?? '';
                  final parts = resTimeStr.split(':');
                  if (parts.length >= 2) {
                    final resMinutes = (int.tryParse(parts[0]) ?? 0) * 60 + (int.tryParse(parts[1]) ?? 0);
                    if ((selectedMinutes - resMinutes).abs() < 60) {
                      isAvailable = false;
                      break;
                    }
                  }
                }
              }
            }

            final customName = (t['table_name'] ?? t['table_categories']?['name'] ?? '').toString();
            return {
              'id': 'T${t['table_number']}',
              'dbId': tableId,
              'isAvailable': isAvailable,
              'seats': t['capacity'],
              'isVIP': t['table_categories']?['name'] == 'VIP Lounge',
              'name': customName,
            };
          }).toList();
          
          _tables.sort((a, b) {
            int numA = int.tryParse((a['id'] as String).replaceAll(RegExp(r'[^0-9]'), '')) ?? 0;
            int numB = int.tryParse((b['id'] as String).replaceAll(RegExp(r'[^0-9]'), '')) ?? 0;
            return numA.compareTo(numB);
          });
          
          // Deselect if currently selected table became unavailable
          if (_selectedTableId != null) {
            final selected = _tables.firstWhere((t) => t['id'] == _selectedTableId, orElse: () => {});
            if (selected.isEmpty || !selected['isAvailable']) {
              _selectedTableId = null;
            }
          }
          
          _isLoading = false;
        });
      }
    } catch (e) {
      debugPrint('Error fetching tables: $e');
      if (mounted) {
        setState(() {
          if (_tables.isEmpty) {
            _tables = SupabaseService.fallbackTablesList.map((t) => {
              'id': 'T${t['table_number']}',
              'dbId': t['id'],
              'isAvailable': true,
              'seats': t['capacity'],
              'isVIP': t['table_categories']?['name'] == 'VIP Lounge',
            }).toList();
          }
          _isLoading = false;
        });
      }
    } finally {
      if (mounted && _isLoading) {
        setState(() => _isLoading = false);
      }
    }
  }

  Future<void> _proceedToReservation() async {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final bookingDate = DateTime(_selectedDate.year, _selectedDate.month, _selectedDate.day);

    if (bookingDate.isBefore(today)) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Row(
            children: [
              Icon(Icons.error_outline, color: Colors.white),
              SizedBox(width: 8),
              Expanded(child: Text('Cannot book for a past date. Please select today or a future date.')),
            ],
          ),
          backgroundColor: Colors.red.shade700,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        ),
      );
      return;
    }

    if (bookingDate.isAtSameMomentAs(today)) {
      final currentMinutes = now.hour * 60 + now.minute;
      final selectedMinutes = _selectedTime.hour * 60 + _selectedTime.minute;
      if (selectedMinutes <= currentMinutes) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Row(
              children: [
                Icon(Icons.error_outline, color: Colors.white),
                SizedBox(width: 8),
                Expanded(child: Text('Cannot book for a past time. Please select an upcoming reservation time.')),
              ],
            ),
            backgroundColor: Colors.red.shade700,
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          ),
        );
        return;
      }
    }

    if (Supabase.instance.client.auth.currentUser == null) {
      final loggedIn = await AuthGuard.requireAuth(
        context,
        actionTitle: 'Reserve Table',
        actionSubtitle: 'Sign in to TableFlow to confirm your booking and receive immediate reservation updates.',
      );
      if (!mounted) return;
      if (!loggedIn) return;
    }

    final currentUser = Supabase.instance.client.auth.currentUser;
    if (currentUser != null) {
      final now = DateTime.now();
      final todayStr = '${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
      try {
        final activeBookings = await Supabase.instance.client
            .from('reservations')
            .select('id, reservation_date, reservation_time, table_id')
            .eq('user_id', currentUser.id)
            .gte('reservation_date', todayStr)
            .or('status.eq.confirmed,status.eq.pending')
            .timeout(const Duration(seconds: 4));

        if (activeBookings.length >= 2) {
          if (!mounted) return;
          _showBookingLimitReachedDialog(context);
          return;
        }
      } catch (checkErr) {
        debugPrint('Active bookings check notice: $checkErr');
      }
    }

    if (!mounted) return;
    final table = _tables.firstWhere((t) => t['id'] == _selectedTableId);
    context.push('/reservation-details', extra: {
      'tableId': _selectedTableId,
      'dbId': table['dbId'],
      'date': _selectedDate.toIso8601String(),
      'time': '${_selectedTime.hour}:${_selectedTime.minute.toString().padLeft(2, '0')}',
      'seats': table['seats'],
    });
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
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final bookingDate = DateTime(_selectedDate.year, _selectedDate.month, _selectedDate.day);
    final isToday = bookingDate.isAtSameMomentAs(today);
    final isDatePast = bookingDate.isBefore(today);
    final isTimePast = isToday && (_selectedTime.hour * 60 + _selectedTime.minute <= now.hour * 60 + now.minute);
    final isScheduleInvalid = isDatePast || isTimePast;

    return Scaffold(
      backgroundColor: AppTheme.background,
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Header / Date Time Picker
          Container(
            padding: const EdgeInsets.fromLTRB(24, 24, 24, 32),
            decoration: BoxDecoration(
              color: AppTheme.white,
              borderRadius: const BorderRadius.only(
                bottomLeft: Radius.circular(32),
                bottomRight: Radius.circular(32),
              ),
              boxShadow: [
                BoxShadow(
                  color: AppTheme.secondary.withValues(alpha: 0.05),
                  blurRadius: 20,
                  offset: const Offset(0, 10),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'When will you be joining us?',
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    fontFamily: 'Playfair Display',
                    fontSize: 24,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  '* All reservations are limited to a 1-hour session.',
                  style: TextStyle(
                    color: AppTheme.primary,
                    fontSize: 14,
                    fontStyle: FontStyle.italic,
                  ),
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      child: _buildPickerButton(
                        icon: Icons.calendar_today,
                        label: DateFormat('MMM d, yyyy').format(_selectedDate),
                        isInvalid: isDatePast,
                        invalidText: 'Past date',
                        onTap: _showPremiumDatePicker,
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: _buildPickerButton(
                        icon: Icons.access_time,
                        label: _selectedTime.format(context),
                        isInvalid: isTimePast,
                        invalidText: 'Past time',
                        onTap: _showPremiumTimePicker,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          
          // Legend
          Padding(
            padding: const EdgeInsets.all(24.0),
            child: Wrap(
              alignment: WrapAlignment.center,
              spacing: 16,
              runSpacing: 12,
              children: [
                _buildLegendItem(AppTheme.white, 'Available'),
                _buildLegendItem(AppTheme.secondary.withValues(alpha: 0.1), 'Booked'),
                _buildLegendItem(AppTheme.primary, 'Selected'),
              ],
            ),
          ),

          // Floor Plan Interactive Area
          Expanded(
            child: _isLoading 
              ? const Center(child: CircularProgressIndicator(color: AppTheme.primary))
              : _tables.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.table_restaurant_outlined, size: 48, color: AppTheme.secondary.withValues(alpha: 0.3)),
                          const SizedBox(height: 12),
                          const Text(
                            'No tables available. Tap to reload.',
                            style: TextStyle(color: AppTheme.secondary, fontWeight: FontWeight.w600),
                          ),
                          const SizedBox(height: 12),
                          ElevatedButton.icon(
                            onPressed: () => _fetchTables(),
                            icon: const Icon(Icons.refresh),
                            label: const Text('Reload Tables'),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppTheme.primary,
                              foregroundColor: AppTheme.white,
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            ),
                          ),
                        ],
                      ),
                    )
                  : SingleChildScrollView(
                  padding: const EdgeInsets.symmetric(horizontal: 24),
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(vertical: 32, horizontal: 16),
                    decoration: BoxDecoration(
                      color: AppTheme.secondary.withValues(alpha: 0.02),
                      borderRadius: BorderRadius.circular(32),
                      border: Border.all(color: AppTheme.secondary.withValues(alpha: 0.05), width: 1),
                    ),
                    child: Wrap(
                      spacing: 20,
                      runSpacing: 20,
                      alignment: WrapAlignment.center,
                      children: _tables.map((table) => _buildTableWidget(table)).toList(),
                    ),
                  ),
                ),
          ),
          
          // Proceed Button Spacer for Bottom Nav
          const SizedBox(height: 120),
        ],
      ),
      floatingActionButtonLocation: FloatingActionButtonLocation.centerFloat,
      floatingActionButton: _selectedTableId == null ? null : Padding(
        padding: const EdgeInsets.only(bottom: 90.0, left: 24, right: 24),
        child: SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: isScheduleInvalid ? () {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Row(
                    children: [
                      const Icon(Icons.error_outline, color: Colors.white),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(isDatePast 
                            ? 'Cannot reserve for a past date. Please pick today or a future date.' 
                            : 'Cannot reserve for a past time. Please pick an upcoming time for today.'),
                      ),
                    ],
                  ),
                  backgroundColor: Colors.red.shade700,
                  behavior: SnackBarBehavior.floating,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
              );
            } : _proceedToReservation,
            style: ElevatedButton.styleFrom(
              backgroundColor: isScheduleInvalid ? Colors.grey.shade600 : AppTheme.primary,
              foregroundColor: AppTheme.white,
              padding: const EdgeInsets.symmetric(vertical: 18),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
              elevation: isScheduleInvalid ? 2 : 10,
              shadowColor: AppTheme.primary.withValues(alpha: 0.5),
            ),
            child: Text(
              isScheduleInvalid ? 'Select Valid Time to Reserve' : 'Reserve Table',
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildPickerButton({
    required IconData icon, 
    required String label, 
    required VoidCallback onTap,
    bool isInvalid = false,
    String? invalidText,
  }) {
    return MouseRegion(
      cursor: SystemMouseCursors.click,
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 14),
          decoration: BoxDecoration(
            color: isInvalid ? Colors.red.shade50 : AppTheme.background,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: isInvalid ? Colors.red.shade300 : AppTheme.secondary.withValues(alpha: 0.1),
              width: isInvalid ? 1.5 : 1.0,
            ),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                isInvalid ? Icons.warning_amber_rounded : icon, 
                size: 20, 
                color: isInvalid ? Colors.red.shade700 : AppTheme.primary,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      label,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: isInvalid ? Colors.red.shade900 : AppTheme.secondary,
                        fontWeight: FontWeight.w600,
                        fontSize: 14,
                      ),
                    ),
                    if (isInvalid && invalidText != null)
                      Text(
                        invalidText,
                        style: TextStyle(
                          color: Colors.red.shade700,
                          fontSize: 11,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildLegendItem(Color color, String label) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 12,
          height: 12,
          decoration: BoxDecoration(
            color: color,
            shape: BoxShape.circle,
            border: Border.all(color: AppTheme.secondary.withValues(alpha: 0.2)),
          ),
        ),
        const SizedBox(width: 8),
        Text(
          label,
          style: TextStyle(
            color: AppTheme.secondary.withValues(alpha: 0.8),
            fontWeight: FontWeight.w600,
            fontSize: 14,
          ),
        ),
      ],
    );
  }

  Widget _buildTableWidget(Map<String, dynamic> table) {
    final bool isSelected = _selectedTableId == table['id'];
    final bool isAvailable = table['isAvailable'];
    final bool isVIP = table['isVIP'] ?? false;

    Color textColor = isSelected ? AppTheme.white : AppTheme.secondary;
    if (!isAvailable) textColor = AppTheme.secondary.withValues(alpha: 0.3);

    return MouseRegion(
      cursor: isAvailable ? SystemMouseCursors.click : SystemMouseCursors.forbidden,
      child: GestureDetector(
        onTap: () {
          if (isAvailable) {
            setState(() {
              _selectedTableId = _selectedTableId == table['id'] ? null : table['id'];
            });
          } else {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('This table is already booked. Please choose an available one.'),
                backgroundColor: Colors.redAccent,
                duration: Duration(seconds: 2),
              ),
            );
          }
        },
        child: AnimatedScale(
          duration: const Duration(milliseconds: 400),
          curve: Curves.elasticOut,
          scale: isSelected ? 1.05 : 1.0,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 300),
            curve: Curves.easeOut,
            width: 100,
            height: 100,
            decoration: BoxDecoration(
              gradient: isSelected 
                  ? LinearGradient(
                      colors: [AppTheme.primary, AppTheme.primary.withValues(alpha: 0.8)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    )
                  : !isAvailable
                      ? LinearGradient(
                          colors: [Colors.grey.shade300, Colors.grey.shade400],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        )
                      : const LinearGradient(
                          colors: [Colors.white, Color(0xFFFAFAFA)],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
              borderRadius: BorderRadius.circular(isSelected ? 24 : 16),
              border: Border.all(
                color: isSelected 
                    ? Colors.transparent 
                    : (isAvailable ? AppTheme.primary.withValues(alpha: 0.3) : Colors.transparent),
                width: isSelected ? 0 : 1.5,
              ),
              boxShadow: isSelected 
                  ? [
                      BoxShadow(
                        color: AppTheme.primary.withValues(alpha: 0.4),
                        blurRadius: 20,
                        offset: const Offset(0, 10),
                        spreadRadius: 2,
                      )
                    ]
                  : !isAvailable 
                      ? [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.1),
                            blurRadius: 4,
                            offset: const Offset(0, 2),
                          )
                        ]
                      : [
                          BoxShadow(
                            color: AppTheme.secondary.withValues(alpha: 0.12),
                            blurRadius: 20,
                            offset: const Offset(0, 10),
                            spreadRadius: -2,
                          ),
                          BoxShadow(
                            color: Colors.white,
                            blurRadius: 10,
                            spreadRadius: 2,
                            offset: const Offset(-2, -2),
                          )
                        ],
            ),
            child: Stack(
              children: [
                Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        table['id'],
                        style: TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 22,
                          color: textColor,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: isSelected ? Colors.black.withValues(alpha: 0.1) : AppTheme.secondary.withValues(alpha: 0.05),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.person, size: 14, color: textColor.withValues(alpha: 0.8)),
                            const SizedBox(width: 4),
                            Text(
                              '${table['seats']}',
                              style: TextStyle(fontSize: 13, color: textColor.withValues(alpha: 0.9), fontWeight: FontWeight.bold),
                            ),
                          ],
                        ),
                      ),
                      if ((table['name'] ?? '').toString().isNotEmpty)
                        Padding(
                          padding: const EdgeInsets.only(top: 4),
                          child: Text(
                            table['name'],
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w600,
                              color: textColor.withValues(alpha: 0.75),
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                    ],
                  ),
                ),
                if (isVIP)
                  Positioned(
                    top: 8,
                    right: 8,
                    child: Icon(
                      Icons.star,
                      size: 16,
                      color: isSelected ? AppTheme.white : AppTheme.tertiary,
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _showPremiumDatePicker() async {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final minDate = today;
    final maxDate = today.add(const Duration(days: 30));

    DateTime initialDate = DateTime(_selectedDate.year, _selectedDate.month, _selectedDate.day);
    if (initialDate.isBefore(minDate)) {
      initialDate = minDate;
    } else if (initialDate.isAfter(maxDate)) {
      initialDate = maxDate;
    }

    DateTime tempDate = initialDate;
    await showModalBottomSheet(
      context: context,
      useRootNavigator: true,
      backgroundColor: Colors.transparent,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setSheetState) {
            final chosenDate = DateTime(tempDate.year, tempDate.month, tempDate.day);
            final isPastDate = chosenDate.isBefore(today);
            final formattedDate = DateFormat('EEE, MMM d, yyyy').format(tempDate);

            return Container(
              height: 380,
              decoration: BoxDecoration(
                color: AppTheme.white,
                borderRadius: const BorderRadius.only(topLeft: Radius.circular(32), topRight: Radius.circular(32)),
                boxShadow: [
                  BoxShadow(
                    color: AppTheme.secondary.withValues(alpha: 0.2),
                    blurRadius: 30,
                    offset: const Offset(0, -10),
                  )
                ],
              ),
              child: Column(
                children: [
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 12.0),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        TextButton(
                          onPressed: () => Navigator.pop(context), 
                          child: const Text('Cancel', style: TextStyle(color: AppTheme.secondary, fontSize: 16)),
                        ),
                        const Text('Select Date', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppTheme.primary)),
                        TextButton(
                          onPressed: isPastDate ? null : () {
                            setState(() {
                              _selectedDate = chosenDate;
                              // If user selected today, adjust time if it has already passed
                              if (chosenDate.isAtSameMomentAs(today)) {
                                final currentMinutes = now.hour * 60 + now.minute;
                                final selectedMinutes = _selectedTime.hour * 60 + _selectedTime.minute;
                                if (selectedMinutes <= currentMinutes) {
                                  final nextHour = (now.hour + 1).clamp(0, 23);
                                  _selectedTime = TimeOfDay(hour: nextHour, minute: 0);
                                }
                              }
                            });
                            _fetchTables();
                            Navigator.pop(context);
                          }, 
                          child: Text(
                            'Confirm', 
                            style: TextStyle(
                              fontWeight: FontWeight.bold, 
                              fontSize: 16,
                              color: isPastDate ? Colors.grey.shade400 : AppTheme.primary,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const Divider(height: 1),
                  // Real-time Past Date Warning Indicator
                  AnimatedContainer(
                    duration: const Duration(milliseconds: 200),
                    margin: const EdgeInsets.fromLTRB(16, 12, 16, 4),
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                    decoration: BoxDecoration(
                      color: isPastDate ? Colors.red.shade50 : Colors.green.shade50,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: isPastDate ? Colors.red.shade200 : Colors.green.shade200,
                      ),
                    ),
                    child: Row(
                      children: [
                        Icon(
                          isPastDate ? Icons.error_outline : Icons.check_circle_outline,
                          size: 18,
                          color: isPastDate ? Colors.red.shade700 : Colors.green.shade700,
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            isPastDate
                                ? '$formattedDate is in the past. Cannot book past date.'
                                : 'Selected Date: $formattedDate (Available)',
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: isPastDate ? Colors.red.shade800 : Colors.green.shade800,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  Expanded(
                    child: CupertinoDatePicker(
                      mode: CupertinoDatePickerMode.date,
                      initialDateTime: initialDate,
                      minimumDate: minDate,
                      maximumDate: maxDate,
                      minimumYear: today.year,
                      maximumYear: maxDate.year,
                      onDateTimeChanged: (DateTime newDate) {
                        setSheetState(() {
                          tempDate = newDate;
                        });
                      },
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  Future<void> _showPremiumTimePicker() async {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final isToday = DateTime(_selectedDate.year, _selectedDate.month, _selectedDate.day).isAtSameMomentAs(today);
    final currentMinutes = now.hour * 60 + now.minute;

    int initialHour = _selectedTime.hour;
    int initialMinute = (_selectedTime.minute ~/ 15) * 15;
    if (isToday) {
      if (initialHour * 60 + initialMinute <= currentMinutes) {
        initialHour = (now.hour + 1).clamp(0, 23);
        initialMinute = 0;
      }
    }

    DateTime tempTime = DateTime(2020, 1, 1, initialHour, initialMinute);
    await showModalBottomSheet(
      context: context,
      useRootNavigator: true,
      backgroundColor: Colors.transparent,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setSheetState) {
            final pickedMinutes = tempTime.hour * 60 + tempTime.minute;
            final isPastTime = isToday && (pickedMinutes <= currentMinutes);
            final timeFormat = DateFormat('h:mm a').format(tempTime);

            return Container(
              height: 380,
              decoration: BoxDecoration(
                color: AppTheme.white,
                borderRadius: const BorderRadius.only(topLeft: Radius.circular(32), topRight: Radius.circular(32)),
                boxShadow: [
                  BoxShadow(
                    color: AppTheme.secondary.withValues(alpha: 0.2),
                    blurRadius: 30,
                    offset: const Offset(0, -10),
                  )
                ],
              ),
              child: Column(
                children: [
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 12.0),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        TextButton(
                          onPressed: () => Navigator.pop(context), 
                          child: const Text('Cancel', style: TextStyle(color: AppTheme.secondary, fontSize: 16)),
                        ),
                        const Text('Select Time', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppTheme.primary)),
                        TextButton(
                          onPressed: isPastTime ? null : () {
                            setState(() => _selectedTime = TimeOfDay(hour: tempTime.hour, minute: tempTime.minute));
                            _fetchTables();
                            Navigator.pop(context);
                          }, 
                          child: Text(
                            'Confirm', 
                            style: TextStyle(
                              fontWeight: FontWeight.bold, 
                              fontSize: 16,
                              color: isPastTime ? Colors.grey.shade400 : AppTheme.primary,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const Divider(height: 1),
                  // Real-time Past Time Warning Indicator
                  AnimatedContainer(
                    duration: const Duration(milliseconds: 200),
                    margin: const EdgeInsets.fromLTRB(16, 12, 16, 4),
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                    decoration: BoxDecoration(
                      color: isPastTime ? Colors.red.shade50 : Colors.green.shade50,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: isPastTime ? Colors.red.shade200 : Colors.green.shade200,
                      ),
                    ),
                    child: Row(
                      children: [
                        Icon(
                          isPastTime ? Icons.error_outline : Icons.check_circle_outline,
                          size: 18,
                          color: isPastTime ? Colors.red.shade700 : Colors.green.shade700,
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            isPastTime
                                ? '$timeFormat has already passed today. Cannot book past time.'
                                : 'Selected Time: $timeFormat (Valid for booking)',
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: isPastTime ? Colors.red.shade800 : Colors.green.shade800,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  Expanded(
                    child: CupertinoDatePicker(
                      mode: CupertinoDatePickerMode.time,
                      initialDateTime: tempTime,
                      use24hFormat: false,
                      minuteInterval: 15,
                      onDateTimeChanged: (DateTime newTime) {
                        setSheetState(() {
                          tempTime = newTime;
                        });
                      },
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }
}

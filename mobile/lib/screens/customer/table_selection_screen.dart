
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
  DateTime _selectedDate = DateTime.now();
  TimeOfDay _selectedTime = const TimeOfDay(hour: 19, minute: 0);

  List<Map<String, dynamic>> _tables = [];
  bool _isLoading = true;

  RealtimeChannel? _tablesChannel;
  RealtimeChannel? _reservationsChannel;

  @override
  void initState() {
    super.initState();
    _fetchTables();
    _setupRealtime();
  }

  void _setupRealtime() {
    _tablesChannel = Supabase.instance.client.channel('public:restaurant_tables')
      .onPostgresChanges(
        event: PostgresChangeEvent.all, 
        schema: 'public', 
        table: 'restaurant_tables', 
        callback: (payload) => _fetchTables()
      ).subscribe();

    _reservationsChannel = Supabase.instance.client.channel('public:reservations')
      .onPostgresChanges(
        event: PostgresChangeEvent.all, 
        schema: 'public', 
        table: 'reservations', 
        callback: (payload) => _fetchTables()
      ).subscribe();
  }

  @override
  void dispose() {
    _tablesChannel?.unsubscribe();
    _reservationsChannel?.unsubscribe();
    super.dispose();
  }

  Future<void> _fetchTables() async {
    setState(() => _isLoading = true);
    try {
      final data = await SupabaseService.getTables();
      
      final dateStr = '${_selectedDate.year}-${_selectedDate.month.toString().padLeft(2, '0')}-${_selectedDate.day.toString().padLeft(2, '0')}';
      final reservationsData = await Supabase.instance.client
          .from('reservations')
          .select('table_id, reservation_time')
          .eq('reservation_date', dateStr)
          .inFilter('status', const ['pending', 'confirmed']);

      if (mounted) {
        setState(() {
          _tables = data.map((t) {
            final tableId = t['id'];
            bool isAvailable = t['status'] == 'available';

            if (isAvailable) {
              final selectedMinutes = _selectedTime.hour * 60 + _selectedTime.minute;
              
              for (var res in reservationsData) {
                if (res['table_id'] == tableId) {
                  final resTimeStr = res['reservation_time'] as String;
                  final parts = resTimeStr.split(':');
                  final resMinutes = int.parse(parts[0]) * 60 + int.parse(parts[1]);
                  
                  if ((selectedMinutes - resMinutes).abs() < 60) {
                    isAvailable = false;
                    break;
                  }
                }
              }
            }

            return {
              'id': 'T${t['table_number']}',
              'dbId': tableId,
              'isAvailable': isAvailable,
              'seats': t['capacity'],
              'isVIP': t['table_categories']?['name'] == 'VIP Lounge',
            };
          }).toList();
          
          _tables.sort((a, b) {
            int numA = int.parse((a['id'] as String).substring(1));
            int numB = int.parse((b['id'] as String).substring(1));
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
        setState(() => _isLoading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
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
                        onTap: _showPremiumDatePicker,
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: _buildPickerButton(
                        icon: Icons.access_time,
                        label: _selectedTime.format(context),
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
            onPressed: () async {
              if (Supabase.instance.client.auth.currentUser == null) {
                final loggedIn = await AuthGuard.requireAuth(
                  context,
                  actionTitle: 'Reserve Table',
                  actionSubtitle: 'Sign in to TableFlow to confirm your booking and receive immediate reservation updates.',
                );
                if (!loggedIn || !mounted) return;
              }

              final table = _tables.firstWhere((t) => t['id'] == _selectedTableId);
              if (!mounted) return;
              context.push('/reservation-details', extra: {
                'tableId': _selectedTableId,
                'dbId': table['dbId'],
                'date': _selectedDate.toIso8601String(),
                'time': '${_selectedTime.hour}:${_selectedTime.minute.toString().padLeft(2, '0')}',
                'seats': table['seats'],
              });
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.primary,
              foregroundColor: AppTheme.white,
              padding: const EdgeInsets.symmetric(vertical: 18),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
              elevation: 10,
              shadowColor: AppTheme.primary.withValues(alpha: 0.5),
            ),
            child: const Text(
              'Reserve Table',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildPickerButton({required IconData icon, required String label, required VoidCallback onTap}) {
    return MouseRegion(
      cursor: SystemMouseCursors.click,
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 16),
          decoration: BoxDecoration(
            color: AppTheme.background,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppTheme.secondary.withValues(alpha: 0.1)),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 20, color: AppTheme.primary),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  label,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: AppTheme.secondary,
                    fontWeight: FontWeight.w600,
                    fontSize: 15,
                  ),
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
    DateTime tempDate = _selectedDate;
    await showModalBottomSheet(
      context: context,
      useRootNavigator: true,
      backgroundColor: Colors.transparent,
      builder: (context) {
        return Container(
          height: 320,
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
                    TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel', style: TextStyle(color: AppTheme.secondary, fontSize: 16))),
                    const Text('Select Date', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppTheme.primary)),
                    TextButton(
                      onPressed: () {
                        setState(() => _selectedDate = tempDate);
                        _fetchTables();
                        Navigator.pop(context);
                      }, 
                      child: const Text('Confirm', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16))
                    ),
                  ],
                ),
              ),
              const Divider(height: 1),
              Expanded(
                child: CupertinoDatePicker(
                  mode: CupertinoDatePickerMode.date,
                  initialDateTime: _selectedDate,
                  minimumDate: DateTime.now().subtract(const Duration(days: 1)),
                  maximumDate: DateTime.now().add(const Duration(days: 30)),
                  onDateTimeChanged: (DateTime newDate) {
                    tempDate = newDate;
                  },
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Future<void> _showPremiumTimePicker() async {
    DateTime tempTime = DateTime(2020, 1, 1, _selectedTime.hour, _selectedTime.minute);
    await showModalBottomSheet(
      context: context,
      useRootNavigator: true,
      backgroundColor: Colors.transparent,
      builder: (context) {
        return Container(
          height: 320,
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
                    TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel', style: TextStyle(color: AppTheme.secondary, fontSize: 16))),
                    const Text('Select Time', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppTheme.primary)),
                    TextButton(
                      onPressed: () {
                        setState(() => _selectedTime = TimeOfDay(hour: tempTime.hour, minute: tempTime.minute));
                        _fetchTables();
                        Navigator.pop(context);
                      }, 
                      child: const Text('Confirm', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16))
                    ),
                  ],
                ),
              ),
              const Divider(height: 1),
              Expanded(
                child: CupertinoDatePicker(
                  mode: CupertinoDatePickerMode.time,
                  initialDateTime: tempTime,
                  use24hFormat: false,
                  minuteInterval: 15,
                  onDateTimeChanged: (DateTime newTime) {
                    tempTime = newTime;
                  },
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

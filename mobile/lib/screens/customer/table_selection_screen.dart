
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../core/theme.dart';
import '../../services/supabase_service.dart';
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

  @override
  void initState() {
    super.initState();
    _fetchTables();
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
          
          _tables.sort((a, b) => a['id'].compareTo(b['id']));
          
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
                const SizedBox(height: 20),
                Row(
                  children: [
                    Expanded(
                      child: _buildPickerButton(
                        icon: Icons.calendar_today,
                        label: DateFormat('MMM d, yyyy').format(_selectedDate),
                        onTap: () async {
                          final date = await showDatePicker(
                            context: context,
                            initialDate: _selectedDate,
                            firstDate: DateTime.now(),
                            lastDate: DateTime.now().add(const Duration(days: 30)),
                            builder: (context, child) {
                              return Theme(
                                data: Theme.of(context).copyWith(
                                  colorScheme: const ColorScheme.light(
                                    primary: AppTheme.primary,
                                  ),
                                ),
                                child: child!,
                              );
                            },
                          );
                          if (date != null) {
                            setState(() => _selectedDate = date);
                            _fetchTables();
                          }
                        },
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: _buildPickerButton(
                        icon: Icons.access_time,
                        label: _selectedTime.format(context),
                        onTap: () async {
                          final time = await showTimePicker(
                            context: context,
                            initialTime: _selectedTime,
                            builder: (context, child) {
                              return Theme(
                                data: Theme.of(context).copyWith(
                                  colorScheme: const ColorScheme.light(
                                    primary: AppTheme.primary,
                                  ),
                                ),
                                child: child!,
                              );
                            },
                          );
                          if (time != null) {
                            setState(() => _selectedTime = time);
                            _fetchTables();
                          }
                        },
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
              : Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 24),
                  child: FittedBox(
                    fit: BoxFit.contain,
                    child: Center(
                    child: Container(
                      width: 400,
                      height: 500,
                      decoration: BoxDecoration(
                        color: AppTheme.secondary.withValues(alpha: 0.02), // Very subtle background
                        borderRadius: BorderRadius.circular(32),
                        border: Border.all(color: AppTheme.secondary.withValues(alpha: 0.05), width: 1),
                      ),
                      child: Center(
                        child: Wrap(
                          spacing: 40,
                          runSpacing: 40,
                          alignment: WrapAlignment.center,
                          children: _tables.map((table) => _buildTableWidget(table)).toList(),
                        ),
                      ),
                    ),
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
            onPressed: () {
              final table = _tables.firstWhere((t) => t['id'] == _selectedTableId);
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
      children: [
        Container(
          width: 12,
          height: 12,
          decoration: BoxDecoration(
            color: color,
            shape: BoxShape.circle,
            border: Border.all(color: AppTheme.secondary.withValues(alpha: 0.2)),
            boxShadow: [
              if (color == AppTheme.primary)
                BoxShadow(
                  color: AppTheme.primary.withValues(alpha: 0.4),
                  blurRadius: 4,
                  offset: const Offset(0, 2),
                )
            ],
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
                        color: AppTheme.primary.withValues(alpha: 0.6),
                        blurRadius: 25,
                        offset: const Offset(0, 12),
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
}

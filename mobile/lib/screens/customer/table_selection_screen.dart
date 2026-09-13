
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../core/theme.dart';
import '../../services/supabase_service.dart';

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
    try {
      final data = await SupabaseService.getTables();
      if (mounted) {
        setState(() {
          _tables = data.map((t) => {
            'id': 'T${t['table_number']}',
            'dbId': t['id'],
            'x': (t['x_coordinate'] ?? 0.0) as double,
            'y': (t['y_coordinate'] ?? 0.0) as double,
            'w': 80.0,
            'h': 80.0,
            'isAvailable': t['status'] == 'available',
            'seats': t['capacity'],
            'isVIP': t['table_categories']?['name'] == 'VIP Lounge',
          }).toList();
          
          for (var table in _tables) {
            if (table['seats'] >= 6) table['w'] = 120.0;
            if (table['seats'] >= 8) table['w'] = 180.0;
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
                          if (date != null) setState(() => _selectedDate = date);
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
                          if (time != null) setState(() => _selectedTime = time);
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
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                _buildLegendItem(AppTheme.white, 'Available'),
                const SizedBox(width: 24),
                _buildLegendItem(AppTheme.secondary.withValues(alpha: 0.1), 'Booked'),
                const SizedBox(width: 24),
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
                        color: AppTheme.white.withValues(alpha: 0.5),
                        borderRadius: BorderRadius.circular(32),
                        border: Border.all(color: AppTheme.white, width: 2),
                        boxShadow: [
                          BoxShadow(
                            color: AppTheme.secondary.withValues(alpha: 0.05),
                            blurRadius: 30,
                            offset: const Offset(0, 15),
                          ),
                        ],
                      ),
                      child: Stack(
                        clipBehavior: Clip.none,
                        children: _tables.map((table) => _buildTableWidget(table)).toList(),
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
              Text(
                label,
                style: const TextStyle(
                  color: AppTheme.secondary,
                  fontWeight: FontWeight.w600,
                  fontSize: 15,
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

    Color bgColor = AppTheme.white;
    if (!isAvailable) bgColor = AppTheme.secondary.withValues(alpha: 0.05);
    if (isSelected) bgColor = AppTheme.primary;

    Color textColor = isSelected ? AppTheme.white : AppTheme.secondary;
    if (!isAvailable) textColor = AppTheme.secondary.withValues(alpha: 0.3);

    return Positioned(
      left: table['x'],
      top: table['y'],
      width: table['w'],
      height: table['h'],
      child: MouseRegion(
        cursor: isAvailable ? SystemMouseCursors.click : SystemMouseCursors.forbidden,
        child: GestureDetector(
          onTap: () {
            if (isAvailable) {
              setState(() {
                _selectedTableId = _selectedTableId == table['id'] ? null : table['id'];
              });
            }
          },
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 300),
            curve: Curves.easeOutQuart,
            decoration: BoxDecoration(
              color: bgColor,
              borderRadius: BorderRadius.circular(isSelected ? 24 : 16),
              border: Border.all(
                color: isSelected ? AppTheme.primary : AppTheme.secondary.withValues(alpha: 0.1),
                width: isSelected ? 0 : 1,
              ),
              boxShadow: isSelected 
                  ? [
                      BoxShadow(
                        color: AppTheme.primary.withValues(alpha: 0.4),
                        blurRadius: 15,
                        offset: const Offset(0, 8),
                      )
                    ]
                  : !isAvailable 
                      ? []
                      : [
                          BoxShadow(
                            color: AppTheme.secondary.withValues(alpha: 0.05),
                            blurRadius: 10,
                            offset: const Offset(0, 4),
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
                          fontSize: 18,
                          color: textColor,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.people, size: 14, color: textColor.withValues(alpha: 0.7)),
                          const SizedBox(width: 4),
                          Text(
                            '${table['seats']}',
                            style: TextStyle(fontSize: 14, color: textColor.withValues(alpha: 0.8), fontWeight: FontWeight.w600),
                          ),
                        ],
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
                      size: 14,
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

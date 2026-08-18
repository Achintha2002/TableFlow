import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme.dart';

class TableSelectionScreen extends StatefulWidget {
  const TableSelectionScreen({super.key});

  @override
  State<TableSelectionScreen> createState() => _TableSelectionScreenState();
}

class _TableSelectionScreenState extends State<TableSelectionScreen> {
  String? _selectedTableId;
  DateTime _selectedDate = DateTime.now();
  TimeOfDay _selectedTime = const TimeOfDay(hour: 19, minute: 0);

  // Mock table data: id, x, y, width, height, isAvailable, seats
  final List<Map<String, dynamic>> _tables = [
    {'id': 'T1', 'x': 50.0, 'y': 50.0, 'w': 80.0, 'h': 80.0, 'isAvailable': true, 'seats': 2},
    {'id': 'T2', 'x': 180.0, 'y': 50.0, 'w': 120.0, 'h': 80.0, 'isAvailable': false, 'seats': 4},
    {'id': 'T3', 'x': 50.0, 'y': 180.0, 'w': 80.0, 'h': 80.0, 'isAvailable': true, 'seats': 2},
    {'id': 'T4', 'x': 180.0, 'y': 180.0, 'w': 120.0, 'h': 120.0, 'isAvailable': true, 'seats': 6, 'isVIP': true},
    {'id': 'T5', 'x': 50.0, 'y': 310.0, 'w': 250.0, 'h': 80.0, 'isAvailable': true, 'seats': 8},
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, size: 20),
          onPressed: () => context.pop(),
        ),
        title: const Text('Select a Table'),
      ),
      body: Column(
        children: [
          // Date & Time Picker Bar
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
            decoration: BoxDecoration(
              color: AppTheme.white,
              border: Border(bottom: BorderSide(color: AppTheme.secondary.withOpacity(0.1))),
            ),
            child: Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () async {
                      final date = await showDatePicker(
                        context: context,
                        initialDate: _selectedDate,
                        firstDate: DateTime.now(),
                        lastDate: DateTime.now().add(const Duration(days: 30)),
                      );
                      if (date != null) setState(() => _selectedDate = date);
                    },
                    icon: const Icon(Icons.calendar_today, size: 18),
                    label: Text('${_selectedDate.day}/${_selectedDate.month}/${_selectedDate.year}'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppTheme.secondary,
                      side: BorderSide(color: AppTheme.secondary.withOpacity(0.2)),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () async {
                      final time = await showTimePicker(
                        context: context,
                        initialTime: _selectedTime,
                      );
                      if (time != null) setState(() => _selectedTime = time);
                    },
                    icon: const Icon(Icons.access_time, size: 18),
                    label: Text(_selectedTime.format(context)),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppTheme.secondary,
                      side: BorderSide(color: AppTheme.secondary.withOpacity(0.2)),
                    ),
                  ),
                ),
              ],
            ),
          ),
          
          // Legend
          Padding(
            padding: const EdgeInsets.all(16.0),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                _buildLegendItem(AppTheme.white, 'Available'),
                const SizedBox(width: 16),
                _buildLegendItem(AppTheme.secondary.withOpacity(0.1), 'Booked'),
                const SizedBox(width: 16),
                _buildLegendItem(AppTheme.primary, 'Selected'),
              ],
            ),
          ),

          // Floor Plan Interactive Area
          Expanded(
            child: Center(
              child: Container(
                width: 350,
                height: 450,
                decoration: BoxDecoration(
                  color: AppTheme.white,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppTheme.secondary.withOpacity(0.1)),
                ),
                child: Stack(
                  children: _tables.map((table) => _buildTableWidget(table)).toList(),
                ),
              ),
            ),
          ),
          
          // Proceed Button
          Container(
            padding: const EdgeInsets.all(24.0),
            decoration: BoxDecoration(
              color: AppTheme.white,
              boxShadow: [
                BoxShadow(
                  color: AppTheme.secondary.withOpacity(0.05),
                  offset: const Offset(0, -4),
                  blurRadius: 16,
                ),
              ],
            ),
            child: ElevatedButton(
              onPressed: _selectedTableId == null ? null : () {
                context.push('/reservation-details', extra: _selectedTableId);
              },
              child: const Text('Proceed to Details'),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLegendItem(Color color, String label) {
    return Row(
      children: [
        Container(
          width: 16,
          height: 16,
          decoration: BoxDecoration(
            color: color,
            border: Border.all(color: AppTheme.secondary.withOpacity(0.2)),
            borderRadius: BorderRadius.circular(4),
          ),
        ),
        const SizedBox(width: 8),
        Text(label, style: Theme.of(context).textTheme.bodyMedium),
      ],
    );
  }

  Widget _buildTableWidget(Map<String, dynamic> table) {
    final bool isSelected = _selectedTableId == table['id'];
    final bool isAvailable = table['isAvailable'];
    final bool isVIP = table['isVIP'] ?? false;

    Color bgColor = AppTheme.white;
    if (!isAvailable) bgColor = AppTheme.secondary.withOpacity(0.1);
    if (isSelected) bgColor = AppTheme.primary;

    Color textColor = isSelected ? AppTheme.white : AppTheme.secondary;
    if (!isAvailable) textColor = AppTheme.secondary.withOpacity(0.4);

    return Positioned(
      left: table['x'],
      top: table['y'],
      width: table['w'],
      height: table['h'],
      child: GestureDetector(
        onTap: () {
          if (isAvailable) {
            setState(() {
              _selectedTableId = _selectedTableId == table['id'] ? null : table['id'];
            });
          }
        },
        child: Container(
          decoration: BoxDecoration(
            color: bgColor,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(
              color: isSelected ? AppTheme.primary : AppTheme.secondary.withOpacity(0.2),
              width: 2,
            ),
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                table['id'],
                style: TextStyle(
                  fontWeight: FontWeight.bold,
                  color: textColor,
                ),
              ),
              const SizedBox(height: 4),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.people, size: 12, color: textColor),
                  const SizedBox(width: 4),
                  Text(
                    '${table['seats']}',
                    style: TextStyle(fontSize: 12, color: textColor),
                  ),
                ],
              ),
              if (isVIP) ...[
                const SizedBox(height: 4),
                Icon(Icons.star, size: 12, color: isSelected ? AppTheme.white : AppTheme.tertiary),
              ]
            ],
          ),
        ),
      ),
    );
  }
}

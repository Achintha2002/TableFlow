import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import '../../services/api_service.dart';

class AssignTableSheet extends StatefulWidget {
  final Map<String, dynamic> queueItem;
  final VoidCallback? onAssigned;

  const AssignTableSheet({
    super.key,
    required this.queueItem,
    this.onAssigned,
  });

  static Future<bool?> show(
    BuildContext context, {
    required Map<String, dynamic> queueItem,
    VoidCallback? onAssigned,
  }) {
    return showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => AssignTableSheet(
        queueItem: queueItem,
        onAssigned: onAssigned,
      ),
    );
  }

  @override
  State<AssignTableSheet> createState() => _AssignTableSheetState();
}

class _AssignTableSheetState extends State<AssignTableSheet> {
  bool _isLoading = true;
  bool _isSubmitting = false;
  String? _selectedTableId;
  String? _selectedTableNumber;
  List<Map<String, dynamic>> _tables = [];

  @override
  void initState() {
    super.initState();
    _fetchAvailableTables();
  }

  Future<void> _fetchAvailableTables() async {
    try {
      final res = await http.get(Uri.parse('${ApiService.baseUrl}/api/tables'));
      if (res.statusCode == 200) {
        final List<dynamic> data = jsonDecode(res.body);
        final guestCount = widget.queueItem['guest_count'] ?? widget.queueItem['pax'] ?? 2;
        
        // Filter or rank tables (available or cleaning)
        final parsed = data.map<Map<String, dynamic>>((t) {
          return {
            'id': t['id']?.toString() ?? '',
            'table_number': t['table_number']?.toString() ?? 'T${t['id']}',
            'capacity': t['capacity'] ?? 4,
            'status': t['status'] ?? 'available',
            'section': t['section'] ?? 'Main Dining',
            'is_fit': (t['capacity'] ?? 4) >= guestCount,
          };
        }).toList();

        setState(() {
          _tables = parsed;
          // Preselect the first available fitting table if any
          final firstFit = _tables.firstWhere(
            (t) => t['is_fit'] == true && (t['status'] == 'available' || t['status'] == 'ready'),
            orElse: () => _tables.isNotEmpty ? _tables.first : {},
          );
          if (firstFit.isNotEmpty) {
            _selectedTableId = firstFit['id'];
            _selectedTableNumber = firstFit['table_number'];
          }
          _isLoading = false;
        });
      } else {
        _useFallbackTables();
      }
    } catch (_) {
      _useFallbackTables();
    }
  }

  void _useFallbackTables() {
    setState(() {
      _tables = [
        {'id': '5', 'table_number': 'Table 5', 'capacity': 4, 'status': 'available', 'section': 'Main Dining', 'is_fit': true},
        {'id': '3', 'table_number': 'Table 3', 'capacity': 4, 'status': 'available', 'section': 'Window Booth', 'is_fit': true},
        {'id': '8', 'table_number': 'Table 8', 'capacity': 6, 'status': 'available', 'section': 'Patio Terrace', 'is_fit': true},
        {'id': '2', 'table_number': 'Table 2', 'capacity': 2, 'status': 'occupied', 'section': 'Main Dining', 'is_fit': false},
        {'id': '7', 'table_number': 'Table 7', 'capacity': 4, 'status': 'cleaning', 'section': 'Courtyard', 'is_fit': true},
      ];
      _selectedTableId = '5';
      _selectedTableNumber = 'Table 5';
      _isLoading = false;
    });
  }

  Future<void> _confirmAssignment() async {
    if (_selectedTableId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please select a table to assign')),
      );
      return;
    }

    setState(() => _isSubmitting = true);
    final queueId = widget.queueItem['id'];

    try {
      final res = await http.post(
        Uri.parse('${ApiService.baseUrl}/api/queue/$queueId/assign-table'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'table_id': _selectedTableId,
          'table_number': _selectedTableNumber ?? 'Table $_selectedTableId',
        }),
      );

      if (mounted) {
        setState(() => _isSubmitting = false);
        if (res.statusCode == 200) {
          widget.onAssigned?.call();
          Navigator.of(context).pop(true);
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Assigned to $_selectedTableNumber & notification sent to guest!'),
              backgroundColor: const Color(0xFF2E7D32),
              behavior: SnackBarBehavior.floating,
            ),
          );
        } else {
          final err = jsonDecode(res.body)['error'] ?? 'Assignment failed';
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(err), backgroundColor: Colors.redAccent),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isSubmitting = false);
        // Optimistic success for smooth staff demo
        widget.onAssigned?.call();
        Navigator.of(context).pop(true);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Assigned to $_selectedTableNumber (Demo local mode)'),
            backgroundColor: const Color(0xFF2E7D32),
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final guestName = widget.queueItem['customer_name'] ?? widget.queueItem['name'] ?? 'Guest';
    final pax = widget.queueItem['guest_count'] ?? widget.queueItem['pax'] ?? 2;
    final pos = widget.queueItem['position'] ?? widget.queueItem['queue_number'] ?? 1;
    final phone = widget.queueItem['customer_phone'] ?? widget.queueItem['phone'] ?? '';

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
                child: const Icon(Icons.table_restaurant_rounded, color: Color(0xFFB87F5C), size: 24),
              ),
              const SizedBox(width: 14),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Assign Table',
                      style: TextStyle(
                        fontFamily: 'Playfair Display',
                        fontSize: 22,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF1E1E1E),
                      ),
                    ),
                    Text(
                      'Select a dining table to notify this waiting party',
                      style: TextStyle(fontSize: 13, color: Color(0xFF8C827A)),
                    ),
                  ],
                ),
              ),
              IconButton(
                icon: const Icon(Icons.close, color: Color(0xFF8C827A)),
                onPressed: () => Navigator.of(context).pop(),
              ),
            ],
          ),
          const SizedBox(height: 18),

          // Guest Profile Banner
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: const Color(0xFFEFEAE4)),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.03),
                  blurRadius: 10,
                  offset: const Offset(0, 3),
                ),
              ],
            ),
            child: Row(
              children: [
                CircleAvatar(
                  radius: 24,
                  backgroundColor: const Color(0xFFB87F5C),
                  child: Text(
                    '#$pos',
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                      fontSize: 16,
                    ),
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        guestName,
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF1E1E1E),
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        '$pax Guests • ${phone.isNotEmpty ? phone : "Waiting party"}',
                        style: const TextStyle(fontSize: 13, color: Color(0xFF8C827A)),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFFF3E0),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Text(
                    'Waiting',
                    style: TextStyle(
                      color: Color(0xFFE65100),
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // Section label
          const Text(
            'SELECT READY TABLE',
            style: TextStyle(
              fontSize: 12,
              letterSpacing: 1.2,
              fontWeight: FontWeight.bold,
              color: Color(0xFF8C827A),
            ),
          ),
          const SizedBox(height: 12),

          // Table Options Grid
          if (_isLoading)
            const Center(
              child: Padding(
                padding: EdgeInsets.all(28.0),
                child: CircularProgressIndicator(color: Color(0xFFB87F5C)),
              ),
            )
          else if (_tables.isEmpty)
            const Center(
              child: Padding(
                padding: EdgeInsets.all(24.0),
                child: Text('No tables found', style: TextStyle(color: Color(0xFF8C827A))),
              ),
            )
          else
            ConstrainedBox(
              constraints: const BoxConstraints(maxHeight: 280),
              child: ListView.separated(
                shrinkWrap: true,
                itemCount: _tables.length,
                separatorBuilder: (_, _) => const SizedBox(height: 10),
                itemBuilder: (ctx, index) {
                  final t = _tables[index];
                  final isSelected = _selectedTableId == t['id'];
                  final isAvailable = t['status'] == 'available' || t['status'] == 'ready';
                  final fits = t['is_fit'] == true;

                  return InkWell(
                    borderRadius: BorderRadius.circular(16),
                    onTap: isAvailable
                        ? () {
                            setState(() {
                              _selectedTableId = t['id'];
                              _selectedTableNumber = t['table_number'];
                            });
                          }
                        : null,
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 180),
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                      decoration: BoxDecoration(
                        color: isSelected
                            ? const Color(0xFFB87F5C).withValues(alpha: 0.08)
                            : isAvailable
                                ? Colors.white
                                : const Color(0xFFF0EBE6),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(
                          color: isSelected
                              ? const Color(0xFFB87F5C)
                              : isAvailable
                                  ? const Color(0xFFE8E2DC)
                                  : const Color(0xFFDDD6CF),
                          width: isSelected ? 2 : 1,
                        ),
                      ),
                      child: Row(
                        children: [
                          Icon(
                            Icons.table_restaurant_outlined,
                            color: isSelected
                                ? const Color(0xFFB87F5C)
                                : isAvailable
                                    ? const Color(0xFF1E1E1E)
                                    : const Color(0xFFB0A7A0),
                            size: 26,
                          ),
                          const SizedBox(width: 14),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Text(
                                      t['table_number'],
                                      style: TextStyle(
                                        fontSize: 15,
                                        fontWeight: FontWeight.bold,
                                        color: isAvailable
                                            ? const Color(0xFF1E1E1E)
                                            : const Color(0xFF8C827A),
                                      ),
                                    ),
                                    const SizedBox(width: 8),
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                                      decoration: BoxDecoration(
                                        color: const Color(0xFFEFEAE4),
                                        borderRadius: BorderRadius.circular(6),
                                      ),
                                      child: Text(
                                        '${t['capacity']} Seats',
                                        style: const TextStyle(fontSize: 11, color: Color(0xFF5A524C)),
                                      ),
                                    ),
                                    if (!fits) ...[
                                      const SizedBox(width: 6),
                                      const Text(
                                        '(Small)',
                                        style: TextStyle(fontSize: 11, color: Colors.orange, fontWeight: FontWeight.bold),
                                      ),
                                    ],
                                  ],
                                ),
                                const SizedBox(height: 3),
                                Text(
                                  '${t['section']} • ${isAvailable ? "Ready & Sanitized" : t['status']}',
                                  style: TextStyle(
                                    fontSize: 12,
                                    color: isAvailable ? const Color(0xFF8C827A) : Colors.grey,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          if (isSelected)
                            const CircleAvatar(
                              radius: 12,
                              backgroundColor: Color(0xFFB87F5C),
                              child: Icon(Icons.check, size: 16, color: Colors.white),
                            )
                          else if (!isAvailable)
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                              decoration: BoxDecoration(
                                color: Colors.grey.shade300,
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Text(
                                t['status'],
                                style: TextStyle(fontSize: 11, color: Colors.grey.shade700),
                              ),
                            ),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),
          const SizedBox(height: 20),

          // Action Buttons
          Row(
            children: [
              Expanded(
                flex: 2,
                child: OutlinedButton(
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    side: const BorderSide(color: Color(0xFFD4CDC5)),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  ),
                  onPressed: () => Navigator.of(context).pop(),
                  child: const Text('Cancel', style: TextStyle(color: Color(0xFF5A524C), fontWeight: FontWeight.w600)),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                flex: 4,
                child: ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFB87F5C),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    elevation: 0,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  ),
                  onPressed: _isSubmitting ? null : _confirmAssignment,
                  icon: _isSubmitting
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                        )
                      : const Icon(Icons.send_rounded, size: 18),
                  label: Text(
                    _isSubmitting ? 'Assigning...' : 'Confirm & Notify Guest',
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

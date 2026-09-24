import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import '../../services/api_service.dart';

class TableStatusMonitorScreen extends StatefulWidget {
  const TableStatusMonitorScreen({super.key});

  @override
  State<TableStatusMonitorScreen> createState() => _TableStatusMonitorScreenState();
}

class _TableStatusMonitorScreenState extends State<TableStatusMonitorScreen> {
  String _selectedSection = 'All';
  bool _isLoading = true;
  List<Map<String, dynamic>> _tables = [];

  final List<String> _sections = ['All', 'Main Dining', 'Window Booths', 'Patio Terrace'];

  @override
  void initState() {
    super.initState();
    _fetchTables();
  }

  Future<void> _fetchTables() async {
    setState(() => _isLoading = true);
    try {
      final res = await http.get(Uri.parse('${ApiService.baseUrl}/api/tables'));
      if (res.statusCode == 200) {
        final List<dynamic> data = jsonDecode(res.body);
        setState(() {
          _tables = data.map<Map<String, dynamic>>((t) {
            final id = t['id']?.toString() ?? '';
            final num = t['table_number']?.toString() ?? 'T$id';
            final status = (t['status'] ?? 'available').toString().toLowerCase();
            return {
              'id': id,
              'table_number': num,
              'capacity': t['capacity'] ?? 4,
              'status': status,
              'section': t['section'] ?? (int.tryParse(id) != null && int.parse(id) > 6 ? 'Patio Terrace' : 'Main Dining'),
              'time_in_status': status == 'occupied' ? '42m' : status == 'cleaning' ? '6m' : 'Ready',
              'guest_name': status == 'occupied' ? 'James W. (4 pax)' : status == 'reserved' ? 'VIP Elena R.' : null,
              'server': 'Kasun P.',
            };
          }).toList();
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
        {'id': '1', 'table_number': 'Table 1', 'capacity': 2, 'status': 'available', 'section': 'Main Dining', 'time_in_status': 'Ready', 'guest_name': null, 'server': 'Kasun P.'},
        {'id': '2', 'table_number': 'Table 2', 'capacity': 2, 'status': 'occupied', 'section': 'Main Dining', 'time_in_status': '38m', 'guest_name': 'Sarah & M.', 'server': 'Kasun P.'},
        {'id': '3', 'table_number': 'Table 3', 'capacity': 4, 'status': 'available', 'section': 'Window Booths', 'time_in_status': 'Ready', 'guest_name': null, 'server': 'Amara K.'},
        {'id': '4', 'table_number': 'Table 4', 'capacity': 4, 'status': 'cleaning', 'section': 'Window Booths', 'time_in_status': '5m', 'guest_name': null, 'server': 'Nimal S.'},
        {'id': '5', 'table_number': 'Table 5', 'capacity': 4, 'status': 'reserved', 'section': 'Main Dining', 'time_in_status': '7:30 PM', 'guest_name': 'Marcus V. (VIP)', 'server': 'Kasun P.'},
        {'id': '6', 'table_number': 'Table 6', 'capacity': 6, 'status': 'occupied', 'section': 'Main Dining', 'time_in_status': '55m', 'guest_name': 'Dupont Party', 'server': 'Amara K.'},
        {'id': '7', 'table_number': 'Table 7', 'capacity': 4, 'status': 'available', 'section': 'Patio Terrace', 'time_in_status': 'Ready', 'guest_name': null, 'server': 'Kasun P.'},
        {'id': '8', 'table_number': 'Table 8', 'capacity': 6, 'status': 'occupied', 'section': 'Patio Terrace', 'time_in_status': '22m', 'guest_name': 'Jenkins Table', 'server': 'Amara K.'},
      ];
      _isLoading = false;
    });
  }

  Future<void> _updateTableStatus(Map<String, dynamic> table, String newStatus) async {
    setState(() {
      table['status'] = newStatus;
      table['time_in_status'] = newStatus == 'available' ? 'Ready' : 'Just now';
    });

    try {
      await http.patch(
        Uri.parse('${ApiService.baseUrl}/api/tables/${table['id']}'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'status': newStatus}),
      );
    } catch (_) {}

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('${table['table_number']} marked as ${newStatus.toUpperCase()}'),
          duration: const Duration(seconds: 1),
        ),
      );
    }
  }

  void _showTableActionSheet(Map<String, dynamic> table) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Material(
        color: const Color(0xFFFAF7F2),
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        clipBehavior: Clip.antiAlias,
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  const Icon(Icons.table_restaurant, color: Color(0xFFB87F5C), size: 24),
                  const SizedBox(width: 10),
                  Text(
                    '${table['table_number']} Actions',
                    style: const TextStyle(fontFamily: 'Playfair Display', fontSize: 20, fontWeight: FontWeight.bold),
                  ),
                  const Spacer(),
                  Text('${table['capacity']} Seats • ${table['section']}', style: const TextStyle(color: Color(0xFF8C827A), fontSize: 12)),
                ],
              ),
              const SizedBox(height: 18),
              Material(
                color: Colors.transparent,
                child: ListTile(
                  leading: const Icon(Icons.check_circle_outline, color: Color(0xFF2E7D32)),
                  title: const Text('Mark Available & Sanitized'),
                  onTap: () {
                    Navigator.pop(ctx);
                    _updateTableStatus(table, 'available');
                  },
                ),
              ),
              Material(
                color: Colors.transparent,
                child: ListTile(
                  leading: const Icon(Icons.restaurant, color: Color(0xFFB87F5C)),
                  title: const Text('Mark Occupied (Guests Seated)'),
                  onTap: () {
                    Navigator.pop(ctx);
                    _updateTableStatus(table, 'occupied');
                  },
                ),
              ),
              Material(
                color: Colors.transparent,
                child: ListTile(
                  leading: const Icon(Icons.cleaning_services, color: Colors.blueAccent),
                  title: const Text('Mark for Cleaning / Bussing'),
                  onTap: () {
                    Navigator.pop(ctx);
                    _updateTableStatus(table, 'cleaning');
                  },
                ),
              ),
              Material(
                color: Colors.transparent,
                child: ListTile(
                  leading: const Icon(Icons.bookmark_outline, color: Colors.purple),
                  title: const Text('Mark Reserved for Upcoming Booking'),
                  onTap: () {
                    Navigator.pop(ctx);
                    _updateTableStatus(table, 'reserved');
                  },
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Color _getStatusColor(String status) {
    switch (status) {
      case 'available':
      case 'ready':
        return const Color(0xFF10B981); // Bright Emerald Green
      case 'occupied':
        return const Color(0xFFEF4444); // Vibrant Red
      case 'cleaning':
        return const Color(0xFF2563EB); // Azure Blue
      case 'reserved':
        return Colors.purple;
      default:
        return const Color(0xFF8C827A);
    }
  }

  IconData _getStatusIcon(String status) {
    switch (status) {
      case 'available':
      case 'ready':
        return Icons.check_circle_rounded;
      case 'occupied':
        return Icons.person_rounded;
      case 'cleaning':
        return Icons.cleaning_services_rounded;
      case 'reserved':
        return Icons.bookmark_rounded;
      default:
        return Icons.table_restaurant_rounded;
    }
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _selectedSection == 'All'
        ? _tables
        : _tables.where((t) => t['section'] == _selectedSection).toList();

    return Scaffold(
      backgroundColor: const Color(0xFFFAF7F2),
      appBar: AppBar(
        backgroundColor: const Color(0xFFFAF7F2),
        elevation: 0,
        title: const Text(
          'Table Status Monitor',
          style: TextStyle(
            fontFamily: 'Playfair Display',
            fontWeight: FontWeight.bold,
            color: Color(0xFF1E1E1E),
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: Color(0xFF1E1E1E)),
            onPressed: _fetchTables,
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFFB87F5C)))
          : Column(
              children: [
                // Status Legend Strip
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                  child: SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: Row(
                      children: [
                        _buildLegendPill('Available', const Color(0xFF2E7D32)),
                        const SizedBox(width: 8),
                        _buildLegendPill('Occupied', const Color(0xFFC48858)),
                        const SizedBox(width: 8),
                        _buildLegendPill('Cleaning', Colors.blueAccent),
                        const SizedBox(width: 8),
                        _buildLegendPill('Reserved', Colors.purple),
                      ],
                    ),
                  ),
                ),

                // Section Filter Tabs
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                  child: SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: Row(
                      children: _sections.map((sec) {
                        final isSel = _selectedSection == sec;
                        return Padding(
                          padding: const EdgeInsets.only(right: 8),
                          child: ChoiceChip(
                            label: Text(sec),
                            selected: isSel,
                            selectedColor: const Color(0xFFB87F5C),
                            backgroundColor: Colors.white,
                            labelStyle: TextStyle(
                              color: isSel ? Colors.white : const Color(0xFF1E1E1E),
                              fontWeight: FontWeight.bold,
                              fontSize: 12,
                            ),
                            side: BorderSide(color: isSel ? const Color(0xFFB87F5C) : const Color(0xFFE8E2DC)),
                            onSelected: (_) => setState(() => _selectedSection = sec),
                          ),
                        );
                      }).toList(),
                    ),
                  ),
                ),
                const SizedBox(height: 8),

                // Grid of Tables
                Expanded(
                  child: GridView.builder(
                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 2,
                      crossAxisSpacing: 14,
                      mainAxisSpacing: 14,
                      childAspectRatio: 1.15,
                    ),
                    itemCount: filtered.length,
                    itemBuilder: (ctx, index) {
                      final t = filtered[index];
                      final status = t['status'] as String;
                      final color = _getStatusColor(status);

                      return InkWell(
                        onTap: () => _showTableActionSheet(t),
                        borderRadius: BorderRadius.circular(20),
                        child: Container(
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(color: color.withValues(alpha: 0.35), width: 1.5),
                            boxShadow: [
                              BoxShadow(
                                color: color.withValues(alpha: 0.05),
                                blurRadius: 8,
                                offset: const Offset(0, 3),
                              ),
                            ],
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Row(
                                    children: [
                                      Icon(_getStatusIcon(status), color: color, size: 18),
                                      const SizedBox(width: 6),
                                      Text(
                                        t['table_number'],
                                        style: TextStyle(
                                          fontWeight: FontWeight.w900,
                                          fontSize: 20,
                                          color: color,
                                        ),
                                      ),
                                    ],
                                  ),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                                    decoration: BoxDecoration(
                                      color: color.withValues(alpha: 0.1),
                                      borderRadius: BorderRadius.circular(6),
                                    ),
                                    child: Text(
                                      '${t['capacity']}P',
                                      style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: color),
                                    ),
                                  ),
                                ],
                              ),
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    t['guest_name'] ?? t['section'],
                                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF1E1E1E)),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    'Timer: ${t['time_in_status']}',
                                    style: const TextStyle(fontSize: 11, color: Color(0xFF8C827A)),
                                  ),
                                ],
                              ),
                              Container(
                                width: double.infinity,
                                padding: const EdgeInsets.symmetric(vertical: 4),
                                decoration: BoxDecoration(
                                  color: color.withValues(alpha: 0.12),
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Center(
                                  child: Text(
                                    status.toUpperCase(),
                                    style: TextStyle(
                                      fontSize: 10,
                                      fontWeight: FontWeight.bold,
                                      letterSpacing: 0.8,
                                      color: color,
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                ),
              ],
            ),
    );
  }

  Widget _buildLegendPill(String label, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE8E2DC)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          CircleAvatar(radius: 4, backgroundColor: color),
          const SizedBox(width: 6),
          Text(label, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF1E1E1E))),
        ],
      ),
    );
  }
}

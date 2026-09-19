import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import '../../services/api_service.dart';

class TableCleaningTasksScreen extends StatefulWidget {
  const TableCleaningTasksScreen({super.key});

  @override
  State<TableCleaningTasksScreen> createState() => _TableCleaningTasksScreenState();
}

class _TableCleaningTasksScreenState extends State<TableCleaningTasksScreen> {
  int _selectedTabIndex = 0; // 0: Pending, 1: In Progress, 2: Done
  bool _isLoading = true;
  List<Map<String, dynamic>> _tasks = [];

  @override
  void initState() {
    super.initState();
    _fetchTasks();
  }

  Future<void> _fetchTasks() async {
    setState(() => _isLoading = true);
    try {
      final res = await http.get(Uri.parse('${ApiService.baseUrl}/api/tables/cleaning-tasks'));
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        final list = List<dynamic>.from(data['tasks'] ?? []);
        setState(() {
          _tasks = list.map<Map<String, dynamic>>((e) => Map<String, dynamic>.from(e)).toList();
          _isLoading = false;
        });
      } else {
        _useFallbackTasks();
      }
    } catch (_) {
      _useFallbackTasks();
    }
  }

  void _useFallbackTasks() {
    setState(() {
      _tasks = [
        {
          'id': 'clean_4',
          'table_id': '4',
          'table_number': 'Table 4',
          'capacity': 4,
          'section': 'Window Booths',
          'status': 'pending',
          'cleared_at': '5m ago',
          'assigned_to': 'Nimal S.',
          'is_high_priority': true,
          'reason': 'Next queue party waiting',
        },
        {
          'id': 'clean_7',
          'table_id': '7',
          'table_number': 'Table 7',
          'capacity': 4,
          'section': 'Patio Terrace',
          'status': 'pending',
          'cleared_at': '8m ago',
          'assigned_to': null,
          'is_high_priority': false,
          'reason': 'Turnover after dinner',
        },
        {
          'id': 'clean_2',
          'table_id': '2',
          'table_number': 'Table 2',
          'capacity': 2,
          'section': 'Main Dining',
          'status': 'in_progress',
          'cleared_at': '12m ago',
          'assigned_to': 'Amara K.',
          'is_high_priority': false,
          'reason': 'Sanitizing in progress',
        },
        {
          'id': 'clean_1',
          'table_id': '1',
          'table_number': 'Table 1',
          'capacity': 2,
          'section': 'Main Dining',
          'status': 'done',
          'cleared_at': '25m ago',
          'assigned_to': 'Kasun P.',
          'is_high_priority': false,
          'reason': 'Sanitized & reset',
        },
      ];
      _isLoading = false;
    });
  }

  Future<void> _updateTaskStatus(Map<String, dynamic> task, String newStatus) async {
    final taskId = task['id'];
    setState(() {
      task['status'] = newStatus;
    });

    try {
      await http.patch(
        Uri.parse('${ApiService.baseUrl}/api/tables/cleaning-tasks/$taskId'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'status': newStatus}),
      );
    } catch (_) {}

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            newStatus == 'done'
                ? '${task['table_number']} sanitized and marked READY for guests! ✨'
                : '${task['table_number']} bussing in progress',
          ),
          backgroundColor: newStatus == 'done' ? const Color(0xFF2E7D32) : const Color(0xFFB87F5C),
          duration: const Duration(seconds: 2),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final pending = _tasks.where((t) => t['status'] == 'pending').toList();
    final inProgress = _tasks.where((t) => t['status'] == 'in_progress').toList();
    final done = _tasks.where((t) => t['status'] == 'done').toList();

    final currentList = _selectedTabIndex == 0
        ? pending
        : _selectedTabIndex == 1
            ? inProgress
            : done;

    return Scaffold(
      backgroundColor: const Color(0xFFFAF7F2),
      appBar: AppBar(
        backgroundColor: const Color(0xFFFAF7F2),
        elevation: 0,
        title: const Text(
          'Bussing & Cleaning',
          style: TextStyle(
            fontFamily: 'Playfair Display',
            fontWeight: FontWeight.bold,
            color: Color(0xFF1E1E1E),
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: Color(0xFF1E1E1E)),
            onPressed: _fetchTasks,
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFFB87F5C)))
          : Column(
              children: [
                // Tab switcher
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                  child: Container(
                    padding: const EdgeInsets.all(4),
                    decoration: BoxDecoration(
                      color: const Color(0xFFEFEAE4),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Row(
                      children: [
                        _buildTab('Pending (${pending.length})', 0),
                        _buildTab('In Progress (${inProgress.length})', 1),
                        _buildTab('Ready (${done.length})', 2),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 8),

                // Task List
                Expanded(
                  child: currentList.isEmpty
                      ? Center(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(
                                Icons.cleaning_services_outlined,
                                size: 48,
                                color: Colors.grey.shade400,
                              ),
                              const SizedBox(height: 12),
                              Text(
                                _selectedTabIndex == 0
                                    ? 'No pending tables to buss'
                                    : _selectedTabIndex == 1
                                        ? 'No tables currently being sanitized'
                                        : 'No completed tasks yet',
                                style: const TextStyle(color: Color(0xFF8C827A)),
                              ),
                            ],
                          ),
                        )
                      : ListView.separated(
                          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                          itemCount: currentList.length,
                          separatorBuilder: (_, _) => const SizedBox(height: 12),
                          itemBuilder: (ctx, idx) {
                            final task = currentList[idx];
                            final isHigh = task['is_high_priority'] == true;

                            return Container(
                              padding: const EdgeInsets.all(16),
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(20),
                                border: Border.all(
                                  color: isHigh ? Colors.redAccent.withValues(alpha: 0.5) : const Color(0xFFEFEAE4),
                                  width: isHigh ? 1.5 : 1,
                                ),
                                boxShadow: [
                                  BoxShadow(
                                    color: Colors.black.withValues(alpha: 0.03),
                                    blurRadius: 10,
                                    offset: const Offset(0, 3),
                                  ),
                                ],
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      Container(
                                        padding: const EdgeInsets.all(10),
                                        decoration: BoxDecoration(
                                          color: isHigh
                                              ? Colors.redAccent.withValues(alpha: 0.1)
                                              : const Color(0xFFB87F5C).withValues(alpha: 0.1),
                                          borderRadius: BorderRadius.circular(12),
                                        ),
                                        child: Icon(
                                          Icons.table_restaurant,
                                          color: isHigh ? Colors.redAccent : const Color(0xFFB87F5C),
                                          size: 22,
                                        ),
                                      ),
                                      const SizedBox(width: 12),
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            Row(
                                              children: [
                                                Text(
                                                  task['table_number'] ?? 'Table',
                                                  style: const TextStyle(
                                                    fontSize: 17,
                                                    fontWeight: FontWeight.bold,
                                                    color: Color(0xFF1E1E1E),
                                                  ),
                                                ),
                                                const SizedBox(width: 8),
                                                Container(
                                                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                                  decoration: BoxDecoration(
                                                    color: const Color(0xFFFAF7F2),
                                                    borderRadius: BorderRadius.circular(6),
                                                    border: Border.all(color: const Color(0xFFE8E2DC)),
                                                  ),
                                                  child: Text(
                                                    '${task['capacity']} Seats',
                                                    style: const TextStyle(fontSize: 11, color: Color(0xFF5A524C)),
                                                  ),
                                                ),
                                              ],
                                            ),
                                            const SizedBox(height: 2),
                                            Text(
                                              '${task['section']} • Cleared ${task['cleared_at']}',
                                              style: const TextStyle(fontSize: 12, color: Color(0xFF8C827A)),
                                            ),
                                          ],
                                        ),
                                      ),
                                    ],
                                  ),
                                  if (isHigh) ...[
                                    const SizedBox(height: 10),
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                      decoration: BoxDecoration(
                                        color: const Color(0xFFFFEBEE),
                                        borderRadius: BorderRadius.circular(8),
                                      ),
                                      child: Row(
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          const Icon(Icons.priority_high, size: 14, color: Colors.redAccent),
                                          const SizedBox(width: 4),
                                          Text(
                                            task['reason'] ?? 'High Priority - Queue Waiting',
                                            style: const TextStyle(fontSize: 11, color: Colors.redAccent, fontWeight: FontWeight.bold),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ],
                                  const SizedBox(height: 14),
                                  const Divider(height: 1, color: Color(0xFFF0EBE6)),
                                  const SizedBox(height: 12),
                                  Row(
                                    children: [
                                      Text(
                                        task['assigned_to'] != null ? 'Assigned: ${task['assigned_to']}' : 'Unassigned',
                                        style: const TextStyle(fontSize: 12, color: Color(0xFF8C827A)),
                                      ),
                                      const Spacer(),
                                      if (_selectedTabIndex == 0)
                                        ElevatedButton.icon(
                                          style: ElevatedButton.styleFrom(
                                            backgroundColor: const Color(0xFFB87F5C),
                                            foregroundColor: Colors.white,
                                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                                            elevation: 0,
                                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                          ),
                                          onPressed: () => _updateTaskStatus(task, 'in_progress'),
                                          icon: const Icon(Icons.play_arrow, size: 16),
                                          label: const Text('Start Cleaning', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                                        )
                                      else if (_selectedTabIndex == 1)
                                        ElevatedButton.icon(
                                          style: ElevatedButton.styleFrom(
                                            backgroundColor: const Color(0xFF2E7D32),
                                            foregroundColor: Colors.white,
                                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                                            elevation: 0,
                                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                          ),
                                          onPressed: () => _updateTaskStatus(task, 'done'),
                                          icon: const Icon(Icons.check, size: 16),
                                          label: const Text('Mark Ready & Sanitized', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                                        )
                                      else
                                        const Row(
                                          children: [
                                            Icon(Icons.check_circle, color: Color(0xFF2E7D32), size: 18),
                                            SizedBox(width: 4),
                                            Text('Sanitized & Active', style: TextStyle(fontSize: 12, color: Color(0xFF2E7D32), fontWeight: FontWeight.bold)),
                                          ],
                                        ),
                                    ],
                                  ),
                                ],
                              ),
                            );
                          },
                        ),
                ),
              ],
            ),
    );
  }

  Widget _buildTab(String label, int index) {
    final isSelected = _selectedTabIndex == index;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _selectedTabIndex = index),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            color: isSelected ? Colors.white : Colors.transparent,
            borderRadius: BorderRadius.circular(12),
            boxShadow: isSelected
                ? [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.04),
                      blurRadius: 4,
                      offset: const Offset(0, 2),
                    ),
                  ]
                : null,
          ),
          child: Center(
            child: Text(
              label,
              style: TextStyle(
                fontSize: 12,
                fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                color: isSelected ? const Color(0xFF1E1E1E) : const Color(0xFF8C827A),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

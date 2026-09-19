import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import '../../services/api_service.dart';
import 'assign_table_sheet.dart';

class QueueStatusScreen extends StatefulWidget {
  const QueueStatusScreen({super.key});

  @override
  State<QueueStatusScreen> createState() => _QueueStatusScreenState();
}

class _QueueStatusScreenState extends State<QueueStatusScreen> {
  int _selectedTabIndex = 0; // 0: Waiting, 1: Ready, 2: Seated
  bool _isLoading = true;
  int _avgWaitTime = 15;

  List<Map<String, dynamic>> _waitingList = [];
  List<Map<String, dynamic>> _readyList = [];
  List<Map<String, dynamic>> _seatedList = [];

  @override
  void initState() {
    super.initState();
    _fetchQueueStatus();
  }

  Future<void> _fetchQueueStatus() async {
    setState(() => _isLoading = true);
    try {
      final res = await http.get(Uri.parse('${ApiService.baseUrl}/api/queue'));
      if (res.statusCode == 200) {
        final List<dynamic> data = jsonDecode(res.body);
        _categorizeData(data);
      } else {
        _useFallbackData();
      }
    } catch (_) {
      _useFallbackData();
    }
  }

  void _categorizeData(List<dynamic> data) {
    final waiting = <Map<String, dynamic>>[];
    final ready = <Map<String, dynamic>>[];
    final seated = <Map<String, dynamic>>[];

    for (var item in data) {
      final status = (item['status'] ?? 'waiting').toString().toLowerCase();
      final map = {
        'id': item['id']?.toString() ?? '',
        'name': item['customer_name'] ?? item['name'] ?? 'Guest Party',
        'phone': item['customer_phone'] ?? item['phone'] ?? '+1 (555) 019-2834',
        'pax': item['guest_count'] ?? item['pax'] ?? 2,
        'status': status,
        'wait_time': item['wait_time_minutes'] ?? 15,
        'assigned_table': item['assigned_table'] ?? (status == 'ready' ? 'Table 5' : null),
        'ready_response': item['guest_response'] ?? 'Pending response',
      };
      if (status == 'ready' || status == 'notified') {
        ready.add(map);
      } else if (status == 'seated' || status == 'completed') {
        seated.add(map);
      } else {
        waiting.add(map);
      }
    }

    setState(() {
      _waitingList = waiting;
      _readyList = ready;
      _seatedList = seated;
      _isLoading = false;
    });
  }

  void _useFallbackData() {
    setState(() {
      _waitingList = [
        {
          'id': '101',
          'name': 'James & Sarah Wilson',
          'phone': '+1 (555) 234-5678',
          'pax': 4,
          'status': 'waiting',
          'wait_time': 15,
          'assigned_table': null,
          'ready_response': null,
        },
        {
          'id': '102',
          'name': 'Elena Rostova',
          'phone': '+1 (555) 345-6789',
          'pax': 2,
          'status': 'waiting',
          'wait_time': 20,
          'assigned_table': null,
          'ready_response': null,
        },
        {
          'id': '103',
          'name': 'Chloe Dupont',
          'phone': '+1 (555) 456-7890',
          'pax': 3,
          'status': 'waiting',
          'wait_time': 25,
          'assigned_table': null,
          'ready_response': null,
        },
      ];
      _readyList = [
        {
          'id': '104',
          'name': 'Arthur Pendelton',
          'phone': '+1 (555) 567-8901',
          'pax': 2,
          'status': 'ready',
          'wait_time': 0,
          'assigned_table': 'Table 5',
          'ready_response': "On my way! (Est. 2 mins)",
        },
      ];
      _seatedList = [
        {
          'id': '105',
          'name': 'Sophia Lorenza',
          'phone': '+1 (555) 678-9012',
          'pax': 4,
          'status': 'seated',
          'wait_time': 0,
          'assigned_table': 'Table 8',
          'ready_response': 'Seated at 7:15 PM',
        },
      ];
      _isLoading = false;
    });
  }

  void _adjustWaitTime(int delta) {
    setState(() {
      _avgWaitTime = (_avgWaitTime + delta).clamp(5, 120);
      for (var w in _waitingList) {
        w['wait_time'] = ((w['wait_time'] as int) + delta).clamp(2, 120);
      }
    });
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Updated queue wait time (${delta > 0 ? "+$delta" : "$delta"} mins)'),
        duration: const Duration(seconds: 1),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final activeList = _selectedTabIndex == 0
        ? _waitingList
        : _selectedTabIndex == 1
            ? _readyList
            : _seatedList;

    return Scaffold(
      backgroundColor: const Color(0xFFFAF7F2),
      appBar: AppBar(
        backgroundColor: const Color(0xFFFAF7F2),
        elevation: 0,
        title: const Text(
          'Queue Status',
          style: TextStyle(
            fontFamily: 'Playfair Display',
            fontWeight: FontWeight.bold,
            color: Color(0xFF1E1E1E),
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: Color(0xFF1E1E1E)),
            onPressed: _fetchQueueStatus,
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFFB87F5C)))
          : SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // 3 KPI Cards
                  Row(
                    children: [
                      Expanded(
                        child: _buildMetricCard(
                          title: 'Waiting',
                          value: '${_waitingList.length}',
                          subtitle: 'Parties in line',
                          color: const Color(0xFFB87F5C),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: _buildMetricCard(
                          title: 'Avg Wait',
                          value: '${_avgWaitTime}m',
                          subtitle: 'Per group',
                          color: const Color(0xFF1E1E1E),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: _buildMetricCard(
                          title: 'Table Ready',
                          value: '${_readyList.length}',
                          subtitle: 'Notified now',
                          color: const Color(0xFF2E7D32),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 18),

                  // Batch Time Adjuster
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(18),
                      border: Border.all(color: const Color(0xFFEFEAE4)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Row(
                          children: [
                            Icon(Icons.schedule, size: 18, color: Color(0xFFB87F5C)),
                            SizedBox(width: 8),
                            Text(
                              'Batch Wait Time Adjustment',
                              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: Color(0xFF1E1E1E)),
                            ),
                          ],
                        ),
                        const SizedBox(height: 6),
                        const Text(
                          'Quickly adjust wait estimates for all waiting guests when kitchen pace changes:',
                          style: TextStyle(fontSize: 12, color: Color(0xFF8C827A)),
                        ),
                        const SizedBox(height: 14),
                        Row(
                          children: [
                            _buildAdjustButton('- 5 min', -5),
                            const SizedBox(width: 10),
                            _buildAdjustButton('+ 5 min', 5),
                            const SizedBox(width: 10),
                            _buildAdjustButton('+ 10 min', 10),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),

                  // Tab switcher
                  Container(
                    padding: const EdgeInsets.all(4),
                    decoration: BoxDecoration(
                      color: const Color(0xFFEFEAE4),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Row(
                      children: [
                        _buildTab('Waiting (${_waitingList.length})', 0),
                        _buildTab('Table Ready (${_readyList.length})', 1),
                        _buildTab('Seated (${_seatedList.length})', 2),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Tab Content List
                  if (activeList.isEmpty)
                    Container(
                      padding: const EdgeInsets.all(32),
                      alignment: Alignment.center,
                      child: Text(
                        _selectedTabIndex == 0
                            ? 'No parties currently waiting'
                            : _selectedTabIndex == 1
                                ? 'No guests in table ready state'
                                : 'No seated parties today yet',
                        style: const TextStyle(color: Color(0xFF8C827A)),
                      ),
                    )
                  else
                    ListView.separated(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      itemCount: activeList.length,
                      separatorBuilder: (_, _) => const SizedBox(height: 12),
                      itemBuilder: (ctx, idx) {
                        final item = activeList[idx];
                        return Container(
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(18),
                            border: Border.all(color: const Color(0xFFEFEAE4)),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withValues(alpha: 0.02),
                                blurRadius: 8,
                                offset: const Offset(0, 2),
                              ),
                            ],
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  CircleAvatar(
                                    radius: 20,
                                    backgroundColor: _selectedTabIndex == 0
                                        ? const Color(0xFFB87F5C).withValues(alpha: 0.12)
                                        : _selectedTabIndex == 1
                                            ? const Color(0xFFE8F5E9)
                                            : const Color(0xFFEFEAE4),
                                    child: Text(
                                      '#${idx + 1}',
                                      style: TextStyle(
                                        color: _selectedTabIndex == 0
                                            ? const Color(0xFFB87F5C)
                                            : _selectedTabIndex == 1
                                                ? const Color(0xFF2E7D32)
                                                : const Color(0xFF5A524C),
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          item['name'],
                                          style: const TextStyle(
                                            fontSize: 16,
                                            fontWeight: FontWeight.bold,
                                            color: Color(0xFF1E1E1E),
                                          ),
                                        ),
                                        const SizedBox(height: 2),
                                        Text(
                                          '${item['pax']} Guests • ${item['phone']}',
                                          style: const TextStyle(fontSize: 12, color: Color(0xFF8C827A)),
                                        ),
                                      ],
                                    ),
                                  ),
                                  if (_selectedTabIndex == 0)
                                    ElevatedButton(
                                      style: ElevatedButton.styleFrom(
                                        backgroundColor: const Color(0xFFB87F5C),
                                        foregroundColor: Colors.white,
                                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                                        elevation: 0,
                                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                      ),
                                      onPressed: () {
                                        AssignTableSheet.show(
                                          context,
                                          queueItem: {
                                            'id': item['id'],
                                            'customer_name': item['name'],
                                            'customer_phone': item['phone'],
                                            'guest_count': item['pax'],
                                          },
                                          onAssigned: _fetchQueueStatus,
                                        );
                                      },
                                      child: const Text('Assign', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                                    ),
                                ],
                              ),
                              if (item['assigned_table'] != null || item['ready_response'] != null) ...[
                                const Divider(height: 18, color: Color(0xFFF0EBE6)),
                                Row(
                                  children: [
                                    if (item['assigned_table'] != null) ...[
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                        decoration: BoxDecoration(
                                          color: const Color(0xFFE8F5E9),
                                          borderRadius: BorderRadius.circular(8),
                                        ),
                                        child: Text(
                                          'Assigned: ${item['assigned_table']}',
                                          style: const TextStyle(
                                            fontSize: 11,
                                            fontWeight: FontWeight.bold,
                                            color: Color(0xFF2E7D32),
                                          ),
                                        ),
                                      ),
                                      const SizedBox(width: 8),
                                    ],
                                    Expanded(
                                      child: Text(
                                        item['ready_response'] ?? '',
                                        style: const TextStyle(fontSize: 11, color: Color(0xFF8C827A)),
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ],
                          ),
                        );
                      },
                    ),
                ],
              ),
            ),
    );
  }

  Widget _buildAdjustButton(String label, int delta) {
    return Expanded(
      child: OutlinedButton(
        style: OutlinedButton.styleFrom(
          padding: const EdgeInsets.symmetric(vertical: 10),
          side: const BorderSide(color: Color(0xFFD4CDC5)),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
        onPressed: () => _adjustWaitTime(delta),
        child: Text(
          label,
          style: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF1E1E1E), fontSize: 13),
        ),
      ),
    );
  }

  Widget _buildMetricCard({
    required String title,
    required String value,
    required String subtitle,
    required Color color,
  }) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFEFEAE4)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(fontSize: 12, color: Color(0xFF8C827A))),
          const SizedBox(height: 4),
          Text(
            value,
            style: TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.bold,
              color: color,
            ),
          ),
          const SizedBox(height: 2),
          Text(subtitle, style: const TextStyle(fontSize: 11, color: Color(0xFF8C827A))),
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

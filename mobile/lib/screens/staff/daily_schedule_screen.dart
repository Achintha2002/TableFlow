import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import '../../services/api_service.dart';

class DailyScheduleScreen extends StatefulWidget {
  const DailyScheduleScreen({super.key});

  @override
  State<DailyScheduleScreen> createState() => _DailyScheduleScreenState();
}

class _DailyScheduleScreenState extends State<DailyScheduleScreen> {
  final String _selectedDate = 'Today, Oct 14';
  String _activeShiftTab = 'afternoon'; // 'morning', 'afternoon', 'evening'
  bool _isLoading = true;

  Map<String, List<Map<String, dynamic>>> _shifts = {
    'morning': [],
    'afternoon': [],
    'evening': [],
  };

  @override
  void initState() {
    super.initState();
    _fetchSchedule();
  }

  Future<void> _fetchSchedule() async {
    setState(() => _isLoading = true);
    try {
      final res = await http.get(Uri.parse('${ApiService.baseUrl}/api/staff/schedule'));
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        final rawShifts = data['shifts'] as Map<String, dynamic>?;
        if (rawShifts != null) {
          setState(() {
            _shifts = {
              'morning': List<Map<String, dynamic>>.from(rawShifts['morning'] ?? []),
              'afternoon': List<Map<String, dynamic>>.from(rawShifts['afternoon'] ?? []),
              'evening': List<Map<String, dynamic>>.from(rawShifts['evening'] ?? []),
            };
            _isLoading = false;
          });
          return;
        }
      }
      _useFallbackSchedule();
    } catch (_) {
      _useFallbackSchedule();
    }
  }

  void _useFallbackSchedule() {
    setState(() {
      _shifts = {
        'morning': [
          {'name': 'Dilshan Silva', 'role': 'Host & Reception', 'section': 'Front Entrance Desk', 'phone': '+1 (555) 123-4567', 'on_duty': false},
          {'name': 'Amara K.', 'role': 'Lead Server', 'section': 'Main Dining (T1 - T6)', 'phone': '+1 (555) 234-5678', 'on_duty': false},
          {'name': 'Nimal S.', 'role': 'Bussing & Floor', 'section': 'All Dining Floors', 'phone': '+1 (555) 345-6789', 'on_duty': false},
        ],
        'afternoon': [
          {'name': 'Kasun Perera', 'role': 'Floor Captain', 'section': 'Main Dining & Patio', 'phone': '+1 (555) 456-7890', 'on_duty': true},
          {'name': 'Sarah Alwis', 'role': 'Host & Waitlist', 'section': 'Host Stand', 'phone': '+1 (555) 567-8901', 'on_duty': true},
          {'name': 'Praveen Jay', 'role': 'Server', 'section': 'Window Booths (T3 - T5)', 'phone': '+1 (555) 678-9012', 'on_duty': true},
          {'name': 'Elena R.', 'role': 'Server', 'section': 'Patio Terrace (T7 - T10)', 'phone': '+1 (555) 789-0123', 'on_duty': true},
          {'name': 'Sahan M.', 'role': 'Busser / Cleaner', 'section': 'All Sections Turnover', 'phone': '+1 (555) 890-1234', 'on_duty': true},
        ],
        'evening': [
          {'name': 'Kasun Perera', 'role': 'Night Supervisor', 'section': 'Closing & Reconciliation', 'phone': '+1 (555) 456-7890', 'on_duty': false},
          {'name': 'Nimal S.', 'role': 'Closing Busser', 'section': 'Deep Cleaning & Sanitization', 'phone': '+1 (555) 345-6789', 'on_duty': false},
        ],
      };
      _isLoading = false;
    });
  }

  void _showAddStaffDialog() {
    final nameCtrl = TextEditingController();
    final roleCtrl = TextEditingController(text: 'Floor Server');
    final sectionCtrl = TextEditingController(text: 'Main Dining');

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFFFAF7F2),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text('Add Staff to Shift', style: TextStyle(fontFamily: 'Playfair Display', fontWeight: FontWeight.bold)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: nameCtrl,
              decoration: InputDecoration(
                labelText: 'Staff Member Name',
                filled: true,
                fillColor: Colors.white,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: roleCtrl,
              decoration: InputDecoration(
                labelText: 'Role (e.g. Server, Host, Busser)',
                filled: true,
                fillColor: Colors.white,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: sectionCtrl,
              decoration: InputDecoration(
                labelText: 'Section Assigned',
                filled: true,
                fillColor: Colors.white,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel', style: TextStyle(color: Color(0xFF8C827A)))),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFB87F5C), foregroundColor: Colors.white),
            onPressed: () {
              if (nameCtrl.text.trim().isEmpty) return;
              setState(() {
                _shifts[_activeShiftTab]?.add({
                  'name': nameCtrl.text.trim(),
                  'role': roleCtrl.text.trim(),
                  'section': sectionCtrl.text.trim(),
                  'phone': '+1 (555) 000-0000',
                  'on_duty': true,
                });
              });
              Navigator.pop(ctx);
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(content: Text('Added ${nameCtrl.text.trim()} to shift')),
              );
            },
            child: const Text('Assign Staff'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final currentList = _shifts[_activeShiftTab] ?? [];

    return Scaffold(
      backgroundColor: const Color(0xFFFAF7F2),
      appBar: AppBar(
        backgroundColor: const Color(0xFFFAF7F2),
        elevation: 0,
        title: const Text(
          'Daily Staff Schedule',
          style: TextStyle(
            fontFamily: 'Playfair Display',
            fontWeight: FontWeight.bold,
            color: Color(0xFF1E1E1E),
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: Color(0xFF1E1E1E)),
            onPressed: _fetchSchedule,
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFFB87F5C)))
          : Column(
              children: [
                // Date picker ribbon
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: const Color(0xFFEFEAE4)),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Row(
                          children: [
                            const Icon(Icons.calendar_month, color: Color(0xFFB87F5C), size: 20),
                            const SizedBox(width: 10),
                            Text(
                              _selectedDate,
                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: Color(0xFF1E1E1E)),
                            ),
                          ],
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color: const Color(0xFFE8F5E9),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: const Text(
                            'Fully Staffed',
                            style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF2E7D32)),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),

                // 3 Shift Pills
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                  child: Row(
                    children: [
                      _buildShiftPill('Morning', '7 AM - 3 PM', 'morning'),
                      const SizedBox(width: 8),
                      _buildShiftPill('Afternoon', '2:30 PM - 10:30 PM', 'afternoon'),
                      const SizedBox(width: 8),
                      _buildShiftPill('Night Close', '9 PM - 1 AM', 'evening'),
                    ],
                  ),
                ),
                const SizedBox(height: 8),

                // Staff list header
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 6),
                  child: Row(
                    children: [
                      Text(
                        'ALLOCATED STAFF (${currentList.length})',
                        style: const TextStyle(
                          fontSize: 11,
                          letterSpacing: 1.2,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF8C827A),
                        ),
                      ),
                      const Spacer(),
                      InkWell(
                        onTap: _showAddStaffDialog,
                        child: const Row(
                          children: [
                            Icon(Icons.add_circle_outline, size: 16, color: Color(0xFFB87F5C)),
                            SizedBox(width: 4),
                            Text(
                              'Add Staff',
                              style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFFB87F5C)),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),

                // List of staff
                Expanded(
                  child: currentList.isEmpty
                      ? const Center(
                          child: Text('No staff assigned to this shift yet', style: TextStyle(color: Color(0xFF8C827A))),
                        )
                      : ListView.separated(
                          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                          itemCount: currentList.length,
                          separatorBuilder: (_, _) => const SizedBox(height: 12),
                          itemBuilder: (ctx, idx) {
                            final s = currentList[idx];
                            final onDuty = s['on_duty'] == true;

                            return Container(
                              padding: const EdgeInsets.all(16),
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(20),
                                border: Border.all(color: const Color(0xFFEFEAE4)),
                                boxShadow: [
                                  BoxShadow(
                                    color: Colors.black.withValues(alpha: 0.02),
                                    blurRadius: 8,
                                    offset: const Offset(0, 2),
                                  ),
                                ],
                              ),
                              child: Row(
                                children: [
                                  CircleAvatar(
                                    radius: 22,
                                    backgroundColor: const Color(0xFFB87F5C).withValues(alpha: 0.12),
                                    child: Text(
                                      s['name'] != null && s['name'].toString().isNotEmpty ? s['name'][0] : 'S',
                                      style: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFFB87F5C)),
                                    ),
                                  ),
                                  const SizedBox(width: 14),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Row(
                                          children: [
                                            Text(
                                              s['name'] ?? '',
                                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: Color(0xFF1E1E1E)),
                                            ),
                                            const SizedBox(width: 8),
                                            if (onDuty)
                                              Container(
                                                width: 8,
                                                height: 8,
                                                decoration: const BoxDecoration(
                                                  color: Color(0xFF2E7D32),
                                                  shape: BoxShape.circle,
                                                ),
                                              ),
                                          ],
                                        ),
                                        const SizedBox(height: 2),
                                        Text(
                                          '${s['role']} • ${s['section']}',
                                          style: const TextStyle(fontSize: 12, color: Color(0xFF8C827A)),
                                        ),
                                      ],
                                    ),
                                  ),
                                  IconButton(
                                    icon: const Icon(Icons.phone_outlined, color: Color(0xFF5A524C), size: 20),
                                    onPressed: () {
                                      ScaffoldMessenger.of(context).showSnackBar(
                                        SnackBar(content: Text('Calling ${s['name']} (${s['phone']})')),
                                      );
                                    },
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

  Widget _buildShiftPill(String title, String hours, String tabKey) {
    final isSel = _activeShiftTab == tabKey;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _activeShiftTab = tabKey),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
          decoration: BoxDecoration(
            color: isSel ? const Color(0xFFB87F5C) : Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: isSel ? const Color(0xFFB87F5C) : const Color(0xFFE8E2DC)),
          ),
          child: Column(
            children: [
              Text(
                title,
                style: TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 13,
                  color: isSel ? Colors.white : const Color(0xFF1E1E1E),
                ),
              ),
              const SizedBox(height: 2),
              Text(
                hours,
                style: TextStyle(
                  fontSize: 10,
                  color: isSel ? Colors.white.withValues(alpha: 0.8) : const Color(0xFF8C827A),
                ),
                textAlign: TextAlign.center,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

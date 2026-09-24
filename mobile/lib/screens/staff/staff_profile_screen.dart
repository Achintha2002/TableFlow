import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../services/supabase_service.dart';

class StaffProfileScreen extends StatefulWidget {
  const StaffProfileScreen({super.key});

  @override
  State<StaffProfileScreen> createState() => _StaffProfileScreenState();
}

class _StaffProfileScreenState extends State<StaffProfileScreen> {
  bool _isOnDuty = true;
  String _staffName = 'Kasun Perera';
  final String _employeeId = 'EMP-104';
  String _role = 'Senior Floor Captain';
  final String _shift = 'Afternoon Shift: 2:00 PM - 10:30 PM';
  final String _section = 'Main Dining Room & Patio';

  @override
  void initState() {
    super.initState();
    _loadProfile();
  }

  Future<void> _loadProfile() async {
    try {
      final profile = await SupabaseService.getUserProfile();
      if (profile != null && mounted) {
        setState(() {
          if (profile['full_name'] != null && profile['full_name'].toString().isNotEmpty) {
            _staffName = profile['full_name'];
          }
          if (profile['role'] != null) {
            _role = profile['role'].toString().toUpperCase();
          }
        });
      }
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFFAF7F2),
      appBar: AppBar(
        backgroundColor: const Color(0xFFFAF7F2),
        elevation: 0,
        title: const Text(
          'Staff Profile',
          style: TextStyle(
            fontFamily: 'Playfair Display',
            fontWeight: FontWeight.bold,
            color: Color(0xFF1E1E1E),
          ),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
        child: Column(
          children: [
            // Avatar & Name Card
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(24),
                border: Border.all(color: const Color(0xFFEFEAE4)),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.03),
                    blurRadius: 10,
                    offset: const Offset(0, 3),
                  ),
                ],
              ),
              child: Column(
                children: [
                  Stack(
                    children: [
                      CircleAvatar(
                        radius: 44,
                        backgroundColor: const Color(0xFFB87F5C).withValues(alpha: 0.15),
                        child: Text(
                          _staffName.isNotEmpty ? _staffName[0] : 'S',
                          style: const TextStyle(
                            fontSize: 36,
                            fontWeight: FontWeight.bold,
                            color: Color(0xFFB87F5C),
                            fontFamily: 'Playfair Display',
                          ),
                        ),
                      ),
                      Positioned(
                        bottom: 0,
                        right: 0,
                        child: Container(
                          width: 22,
                          height: 22,
                          decoration: BoxDecoration(
                            color: _isOnDuty ? const Color(0xFF2E7D32) : Colors.orange,
                            shape: BoxShape.circle,
                            border: Border.all(color: Colors.white, width: 3),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  Text(
                    _staffName,
                    style: const TextStyle(
                      fontFamily: 'Playfair Display',
                      fontSize: 22,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF1E1E1E),
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '$_role • $_employeeId',
                    style: const TextStyle(fontSize: 13, color: Color(0xFF8C827A)),
                  ),
                  const SizedBox(height: 16),
                  // Duty toggle pill
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFAF7F2),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: const Color(0xFFE8E2DC)),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          _isOnDuty ? 'Active On Duty' : 'On Break / Inactive',
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.bold,
                            color: _isOnDuty ? const Color(0xFF2E7D32) : Colors.orange,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Switch(
                          value: _isOnDuty,
                          activeThumbColor: const Color(0xFF2E7D32),
                          onChanged: (v) => setState(() => _isOnDuty = v),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            // Today's Shift Card
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: const Color(0xFFEFEAE4)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Row(
                    children: [
                      Icon(Icons.badge_outlined, color: Color(0xFFB87F5C), size: 20),
                      SizedBox(width: 8),
                      Text(
                        "Today's Shift Assignment",
                        style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: Color(0xFF1E1E1E)),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  _buildShiftDetail(Icons.schedule, 'Shift Time', _shift),
                  const SizedBox(height: 8),
                  _buildShiftDetail(Icons.table_bar, 'Assigned Floor', _section),
                  const SizedBox(height: 8),
                  _buildShiftDetail(Icons.coffee_outlined, 'Break Time', '6:30 PM - 7:00 PM (30m)'),
                ],
              ),
            ),
            const SizedBox(height: 20),

            // KPI Performance Row
            Row(
              children: [
                Expanded(
                  child: _buildMetricTile('Tables Served', '18', Icons.room_service_outlined),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _buildMetricTile('Avg Turn Time', '42m', Icons.timer_outlined),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _buildMetricTile('Service Rating', '4.9 ★', Icons.star_border),
                ),
              ],
            ),
            const SizedBox(height: 24),

            // Floor shortcuts
            Container(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: const Color(0xFFEFEAE4)),
              ),
              child: Material(
                color: Colors.transparent,
                borderRadius: BorderRadius.circular(20),
                clipBehavior: Clip.antiAlias,
                child: Column(
                  children: [
                    ListTile(
                      leading: const Icon(Icons.table_restaurant, color: Color(0xFFB87F5C)),
                      title: const Text('Waiter Floor Mode', style: TextStyle(fontWeight: FontWeight.w600)),
                      subtitle: const Text('Open POS floor layout & table punch-in', style: TextStyle(fontSize: 12)),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () => context.push('/waiter-floor'),
                    ),
                    const Divider(height: 1, color: Color(0xFFF0EBE6)),
                    ListTile(
                      leading: const Icon(Icons.cleaning_services, color: Colors.blueAccent),
                      title: const Text('Table Cleaning Tracker', style: TextStyle(fontWeight: FontWeight.w600)),
                      subtitle: const Text('Manage bussing & turnover tasks', style: TextStyle(fontSize: 12)),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () => context.push('/table-cleaning-tasks'),
                    ),
                    const Divider(height: 1, color: Color(0xFFF0EBE6)),
                    ListTile(
                      leading: const Icon(Icons.calendar_month, color: Color(0xFF5A524C)),
                      title: const Text('Daily Shift Schedule', style: TextStyle(fontWeight: FontWeight.w600)),
                      subtitle: const Text('View roster & staff allocations', style: TextStyle(fontSize: 12)),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () => context.push('/daily-schedule'),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 24),

            // Clock out button
            OutlinedButton.icon(
              style: OutlinedButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 24),
                side: const BorderSide(color: Colors.redAccent),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
              onPressed: () {
                showDialog(
                  context: context,
                  builder: (ctx) => AlertDialog(
                    backgroundColor: const Color(0xFFFAF7F2),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                    title: const Text('Clock Out for the Day?'),
                    content: const Text('Your shift hours and tables served will be finalized and sent to payroll.'),
                    actions: [
                      TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
                      ElevatedButton(
                        style: ElevatedButton.styleFrom(backgroundColor: Colors.redAccent, foregroundColor: Colors.white),
                        onPressed: () {
                          Navigator.pop(ctx);
                          setState(() => _isOnDuty = false);
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('Clocked out successfully. Good job today!')),
                          );
                        },
                        child: const Text('Clock Out'),
                      ),
                    ],
                  ),
                );
              },
              icon: const Icon(Icons.logout, color: Colors.redAccent, size: 18),
              label: const Text('Clock Out of Shift', style: TextStyle(color: Colors.redAccent, fontWeight: FontWeight.bold)),
            ),
            const SizedBox(height: 30),
          ],
        ),
      ),
    );
  }

  Widget _buildShiftDetail(IconData icon, String label, String value) {
    return Row(
      children: [
        Icon(icon, size: 16, color: const Color(0xFF8C827A)),
        const SizedBox(width: 8),
        Text('$label: ', style: const TextStyle(fontSize: 13, color: Color(0xFF8C827A))),
        Expanded(
          child: Text(
            value,
            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF1E1E1E)),
          ),
        ),
      ],
    );
  }

  Widget _buildMetricTile(String title, String value, IconData icon) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFEFEAE4)),
      ),
      child: Column(
        children: [
          Icon(icon, size: 20, color: const Color(0xFFB87F5C)),
          const SizedBox(height: 6),
          Text(value, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF1E1E1E))),
          const SizedBox(height: 2),
          Text(title, style: const TextStyle(fontSize: 10, color: Color(0xFF8C827A)), textAlign: TextAlign.center),
        ],
      ),
    );
  }
}

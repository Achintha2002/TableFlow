import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

class StaffHubScreen extends StatelessWidget {
  const StaffHubScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFFAF7F2),
      appBar: AppBar(
        backgroundColor: const Color(0xFFFAF7F2),
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, color: Color(0xFF1E1E1E), size: 18),
          onPressed: () { if (context.canPop()) { context.pop(); } else { context.go('/home'); } },
        ),
        title: const Text(
          'Staff Operations Hub',
          style: TextStyle(
            fontFamily: 'Playfair Display',
            fontWeight: FontWeight.bold,
            color: Color(0xFF1E1E1E),
          ),
        ),
        actions: [
          Container(
            margin: const EdgeInsets.only(right: 16),
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: const Color(0xFF2E7D32).withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                CircleAvatar(radius: 4, backgroundColor: Color(0xFF2E7D32)),
                SizedBox(width: 6),
                Text(
                  'ON DUTY',
                  style: TextStyle(
                    color: Color(0xFF2E7D32),
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Hero Welcome Banner
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF2C2523), Color(0xFF1A1615)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(24),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.1),
                    blurRadius: 16,
                    offset: const Offset(0, 6),
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
                          color: const Color(0xFFB87F5C).withValues(alpha: 0.25),
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: const Icon(Icons.admin_panel_settings_rounded, color: Color(0xFFE2DDD7), size: 24),
                      ),
                      const SizedBox(width: 14),
                      const Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'TableFlow Floor Portal',
                            style: TextStyle(
                              color: Colors.white,
                              fontFamily: 'Playfair Display',
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          Text(
                            'Main Dining, Patio & Host Desk',
                            style: TextStyle(color: Color(0xFFA59D95), fontSize: 12),
                          ),
                        ],
                      ),
                    ],
                  ),
                  const SizedBox(height: 18),
                  const Divider(height: 1, color: Color(0xFF3E3634)),
                  const SizedBox(height: 14),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceAround,
                    children: [
                      _buildHeaderStat('12', 'Tables Floor'),
                      Container(width: 1, height: 26, color: const Color(0xFF3E3634)),
                      _buildHeaderStat('4', 'Waiting Queue'),
                      Container(width: 1, height: 26, color: const Color(0xFF3E3634)),
                      _buildHeaderStat('6', 'Bookings Today'),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 26),

            // Section 1: Floor & Dining
            _buildSectionHeader('DINING FLOOR & SERVICE', Icons.table_restaurant_outlined),
            const SizedBox(height: 12),
            _buildOperationsGrid([
              _OperationItem(
                title: 'Waiter Floor Mode',
                subtitle: 'Punch in orders & table bills',
                icon: Icons.table_restaurant,
                badge: 'POS',
                badgeColor: const Color(0xFFB87F5C),
                route: '/waiter-floor',
              ),
              _OperationItem(
                title: 'Table Status Monitor',
                subtitle: 'Real-time table occupancy grid',
                icon: Icons.dashboard_customize_outlined,
                badge: 'Live',
                badgeColor: const Color(0xFF2E7D32),
                route: '/table-status-monitor',
              ),
              _OperationItem(
                title: 'Bussing & Cleaning',
                subtitle: 'Table turnover & sanitation',
                icon: Icons.cleaning_services_outlined,
                badge: 'Tasks',
                badgeColor: Colors.blueAccent,
                route: '/table-cleaning-tasks',
              ),
            ]),
            const SizedBox(height: 26),

            // Section 2: Reservations & CRM
            _buildSectionHeader('RESERVATIONS & GUESTS', Icons.event_seat_outlined),
            const SizedBox(height: 12),
            _buildOperationsGrid([
              _OperationItem(
                title: 'Reservations Hub',
                subtitle: 'Confirm, view & cancel bookings',
                icon: Icons.calendar_month_outlined,
                badge: 'Manage',
                badgeColor: const Color(0xFFB87F5C),
                route: '/reservations-management',
              ),
              _OperationItem(
                title: 'Manual Reservation',
                subtitle: 'Punch in walk-in & phone calls',
                icon: Icons.add_circle_outline,
                badge: 'New',
                badgeColor: const Color(0xFF1E1E1E),
                route: '/new-reservation',
              ),
              _OperationItem(
                title: 'Guest CRM Directory',
                subtitle: 'Customer profiles & VIP loyalty',
                icon: Icons.contacts_outlined,
                badge: 'CRM',
                badgeColor: Colors.purple,
                route: '/customer-directory',
              ),
            ]),
            const SizedBox(height: 26),

            // Section 3: Queue & Analytics
            _buildSectionHeader('WAITLIST & ANALYTICS', Icons.hourglass_top_outlined),
            const SizedBox(height: 12),
            _buildOperationsGrid([
              _OperationItem(
                title: 'Queue Priority Manager',
                subtitle: 'Reorder waitlist & assign tables',
                icon: Icons.format_list_numbered,
                badge: 'Priority',
                badgeColor: const Color(0xFFB87F5C),
                route: '/manage-queue',
              ),
              _OperationItem(
                title: 'Queue Status & Adjust',
                subtitle: 'Batch +/- wait times & stages',
                icon: Icons.access_time_filled_outlined,
                badge: 'Times',
                badgeColor: Colors.amber.shade800,
                route: '/queue-status',
              ),
              _OperationItem(
                title: 'Queue & Flow Report',
                subtitle: 'Hourly guest volume & turnover',
                icon: Icons.bar_chart_rounded,
                badge: 'Report',
                badgeColor: const Color(0xFF2E7D32),
                route: '/queue-report',
              ),
            ]),
            const SizedBox(height: 26),

            // Section 4: Staff Team & Sync
            _buildSectionHeader('TEAM & PLATFORMS', Icons.badge_outlined),
            const SizedBox(height: 12),
            _buildOperationsGrid([
              _OperationItem(
                title: 'Daily Shift Schedule',
                subtitle: 'Morning, afternoon & night roster',
                icon: Icons.schedule_send_outlined,
                badge: 'Roster',
                badgeColor: const Color(0xFF5A524C),
                route: '/daily-schedule',
              ),
              _OperationItem(
                title: 'Broadcast Notification',
                subtitle: 'Send alerts to guests & staff',
                icon: Icons.campaign_outlined,
                badge: 'FCM Push',
                badgeColor: Colors.deepOrange,
                route: '/compose-notification',
              ),
              _OperationItem(
                title: 'Partner Sync',
                subtitle: 'BookMe, Reserve.lk & DineHub',
                icon: Icons.sync_outlined,
                badge: 'Online',
                badgeColor: const Color(0xFFB87F5C),
                route: '/partner-sync',
              ),
              _OperationItem(
                title: 'Staff Profile & KPIs',
                subtitle: 'Personal shift clock-out & stats',
                icon: Icons.person_outline,
                badge: 'Duty',
                badgeColor: const Color(0xFF2E7D32),
                route: '/staff-profile',
              ),
            ]),
            const SizedBox(height: 40),
          ],
        ),
      ),
    );
  }

  Widget _buildHeaderStat(String value, String label) {
    return Column(
      children: [
        Text(
          value,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 20,
            fontWeight: FontWeight.bold,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          label,
          style: const TextStyle(color: Color(0xFFA59D95), fontSize: 11),
        ),
      ],
    );
  }

  Widget _buildSectionHeader(String title, IconData icon) {
    return Row(
      children: [
        Icon(icon, size: 16, color: const Color(0xFFB87F5C)),
        const SizedBox(width: 8),
        Text(
          title,
          style: const TextStyle(
            fontSize: 11,
            letterSpacing: 1.2,
            fontWeight: FontWeight.bold,
            color: Color(0xFF8C827A),
          ),
        ),
      ],
    );
  }

  Widget _buildOperationsGrid(List<_OperationItem> items) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFEFEAE4)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: ListView.separated(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        itemCount: items.length,
        separatorBuilder: (_, _) => const Divider(height: 1, color: Color(0xFFF0EBE6)),
        itemBuilder: (context, index) {
          final item = items[index];
          return ListTile(
            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
            leading: Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: const Color(0xFFFAF7F2),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFE8E2DC)),
              ),
              child: Icon(item.icon, color: const Color(0xFFB87F5C), size: 22),
            ),
            title: Row(
              children: [
                Text(
                  item.title,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF1E1E1E),
                  ),
                ),
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: item.badgeColor.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    item.badge,
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                      color: item.badgeColor,
                    ),
                  ),
                ),
              ],
            ),
            subtitle: Text(
              item.subtitle,
              style: const TextStyle(fontSize: 12, color: Color(0xFF8C827A)),
            ),
            trailing: const Icon(Icons.arrow_forward_ios, size: 14, color: Color(0xFFB0A7A0)),
            onTap: () => context.push(item.route),
          );
        },
      ),
    );
  }
}

class _OperationItem {
  final String title;
  final String subtitle;
  final IconData icon;
  final String badge;
  final Color badgeColor;
  final String route;

  const _OperationItem({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.badge,
    required this.badgeColor,
    required this.route,
  });
}

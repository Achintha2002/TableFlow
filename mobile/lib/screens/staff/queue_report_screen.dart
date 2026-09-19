import 'package:flutter/material.dart';

class QueueReportScreen extends StatefulWidget {
  const QueueReportScreen({super.key});

  @override
  State<QueueReportScreen> createState() => _QueueReportScreenState();
}

class _QueueReportScreenState extends State<QueueReportScreen> {
  String _selectedRange = 'Today';

  final List<Map<String, dynamic>> _hourlyFlow = [
    {'hour': '12 PM', 'count': 14, 'is_peak': false},
    {'hour': '1 PM', 'count': 26, 'is_peak': false},
    {'hour': '2 PM', 'count': 18, 'is_peak': false},
    {'hour': '3 PM', 'count': 8, 'is_peak': false},
    {'hour': '4 PM', 'count': 10, 'is_peak': false},
    {'hour': '5 PM', 'count': 22, 'is_peak': false},
    {'hour': '6 PM', 'count': 38, 'is_peak': true},
    {'hour': '7 PM', 'count': 52, 'is_peak': true},
    {'hour': '8 PM', 'count': 46, 'is_peak': true},
    {'hour': '9 PM', 'count': 24, 'is_peak': false},
    {'hour': '10 PM', 'count': 12, 'is_peak': false},
  ];

  @override
  Widget build(BuildContext context) {
    const maxCount = 52.0;

    return Scaffold(
      backgroundColor: const Color(0xFFFAF7F2),
      appBar: AppBar(
        backgroundColor: const Color(0xFFFAF7F2),
        elevation: 0,
        title: const Text(
          'Queue & Flow Report',
          style: TextStyle(
            fontFamily: 'Playfair Display',
            fontWeight: FontWeight.bold,
            color: Color(0xFF1E1E1E),
          ),
        ),
        actions: [
          PopupMenuButton<String>(
            icon: const Icon(Icons.calendar_today, color: Color(0xFF1E1E1E), size: 20),
            onSelected: (val) => setState(() => _selectedRange = val),
            itemBuilder: (ctx) => [
              const PopupMenuItem(value: 'Today', child: Text('Today')),
              const PopupMenuItem(value: 'Yesterday', child: Text('Yesterday')),
              const PopupMenuItem(value: 'Last 7 Days', child: Text('Last 7 Days')),
              const PopupMenuItem(value: 'This Month', child: Text('This Month')),
            ],
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Selected range indicator
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: const Color(0xFFB87F5C).withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Text(
                    'Viewing: $_selectedRange',
                    style: const TextStyle(
                      color: Color(0xFFB87F5C),
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
                const Spacer(),
                const Text('Updated 2 mins ago', style: TextStyle(fontSize: 11, color: Color(0xFF8C827A))),
              ],
            ),
            const SizedBox(height: 16),

            // Top KPI grid
            Row(
              children: [
                Expanded(
                  child: _buildKpiCard('Total Served', '48', 'Parties seated', const Color(0xFFB87F5C)),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _buildKpiCard('Avg Wait Time', '14m', '-3m vs yesterday', const Color(0xFF2E7D32)),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: _buildKpiCard('Peak Rush', '7 - 8:30 PM', '52 guests / hr', const Color(0xFF1E1E1E)),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _buildKpiCard('No-Show Rate', '2.1%', '98% seated success', const Color(0xFF5A524C)),
                ),
              ],
            ),
            const SizedBox(height: 24),

            // Customer Flow Chart Card
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(20),
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
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Customer Flow by Hour',
                            style: TextStyle(
                              fontFamily: 'Playfair Display',
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFF1E1E1E),
                            ),
                          ),
                          SizedBox(height: 2),
                          Text(
                            'Hourly volume of dining guest parties',
                            style: TextStyle(fontSize: 12, color: Color(0xFF8C827A)),
                          ),
                        ],
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFFF3E0),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Row(
                          children: [
                            CircleAvatar(radius: 4, backgroundColor: Color(0xFFB87F5C)),
                            SizedBox(width: 4),
                            Text('Peak Zone', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFFB87F5C))),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 24),

                  // Visual Bar Chart
                  SizedBox(
                    height: 160,
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: _hourlyFlow.map((item) {
                        final count = item['count'] as int;
                        final isPeak = item['is_peak'] as bool;
                        final ratio = count / maxCount;

                        return Expanded(
                          child: Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 2),
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.end,
                              children: [
                                Text(
                                  '$count',
                                  style: TextStyle(
                                    fontSize: 10,
                                    fontWeight: isPeak ? FontWeight.bold : FontWeight.normal,
                                    color: isPeak ? const Color(0xFFB87F5C) : const Color(0xFF8C827A),
                                  ),
                                ),
                                const SizedBox(height: 4),
                                AnimatedContainer(
                                  duration: const Duration(milliseconds: 300),
                                  height: (120 * ratio).clamp(8.0, 120.0),
                                  decoration: BoxDecoration(
                                    color: isPeak ? const Color(0xFFB87F5C) : const Color(0xFFE2DDD7),
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                ),
                                const SizedBox(height: 6),
                                Text(
                                  item['hour']!.replaceAll(' ', ''),
                                  style: const TextStyle(fontSize: 9, color: Color(0xFF8C827A)),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ],
                            ),
                          ),
                        );
                      }).toList(),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // Wait Time Distribution Breakdown
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: const Color(0xFFEFEAE4)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Wait Time Distribution',
                    style: TextStyle(
                      fontFamily: 'Playfair Display',
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF1E1E1E),
                    ),
                  ),
                  const SizedBox(height: 4),
                  const Text(
                    'Percentage of parties seated within wait thresholds',
                    style: TextStyle(fontSize: 12, color: Color(0xFF8C827A)),
                  ),
                  const SizedBox(height: 18),
                  _buildDistributionRow('< 15 minutes', 0.62, '62% of guests', const Color(0xFF2E7D32)),
                  const SizedBox(height: 12),
                  _buildDistributionRow('15 - 30 minutes', 0.26, '26% of guests', const Color(0xFFB87F5C)),
                  const SizedBox(height: 12),
                  _buildDistributionRow('30 - 45 minutes', 0.09, '9% of guests', const Color(0xFFFFA000)),
                  const SizedBox(height: 12),
                  _buildDistributionRow('45+ minutes', 0.03, '3% of guests', Colors.redAccent),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // Table Turnover Benchmarks
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: const Color(0xFFEFEAE4)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Average Table Turnaround',
                    style: TextStyle(
                      fontFamily: 'Playfair Display',
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF1E1E1E),
                    ),
                  ),
                  const SizedBox(height: 14),
                  _buildTurnaroundItem('2-Guest Tables', '38 mins avg', 'Ideal benchmark ~40m'),
                  const Divider(height: 18, color: Color(0xFFF0EBE6)),
                  _buildTurnaroundItem('4-Guest Family Tables', '52 mins avg', 'Ideal benchmark ~55m'),
                  const Divider(height: 18, color: Color(0xFFF0EBE6)),
                  _buildTurnaroundItem('6+ Banquet / Booths', '68 mins avg', 'Ideal benchmark ~70m'),
                ],
              ),
            ),
            const SizedBox(height: 30),
          ],
        ),
      ),
    );
  }

  Widget _buildKpiCard(String title, String value, String subtitle, Color color) {
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
          Text(title, style: const TextStyle(fontSize: 12, color: Color(0xFF8C827A))),
          const SizedBox(height: 6),
          Text(
            value,
            style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: color),
          ),
          const SizedBox(height: 2),
          Text(subtitle, style: const TextStyle(fontSize: 11, color: Color(0xFF8C827A))),
        ],
      ),
    );
  }

  Widget _buildDistributionRow(String label, double ratio, String percentLabel, Color color) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(label, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
            Text(percentLabel, style: TextStyle(fontSize: 12, color: color, fontWeight: FontWeight.bold)),
          ],
        ),
        const SizedBox(height: 6),
        ClipRRect(
          borderRadius: BorderRadius.circular(8),
          child: LinearProgressIndicator(
            value: ratio,
            minHeight: 8,
            backgroundColor: const Color(0xFFEFEAE4),
            color: color,
          ),
        ),
      ],
    );
  }

  Widget _buildTurnaroundItem(String tableType, String time, String note) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(tableType, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
            Text(note, style: const TextStyle(fontSize: 11, color: Color(0xFF8C827A))),
          ],
        ),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
          decoration: BoxDecoration(
            color: const Color(0xFFFAF7F2),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: const Color(0xFFE8E2DC)),
          ),
          child: Text(
            time,
            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: Color(0xFF1E1E1E)),
          ),
        ),
      ],
    );
  }
}

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../core/routes.dart';

class RestaurantStatusScreen extends StatefulWidget {
  const RestaurantStatusScreen({super.key});

  @override
  State<RestaurantStatusScreen> createState() => _RestaurantStatusScreenState();
}

class _RestaurantStatusScreenState extends State<RestaurantStatusScreen> {
  bool _isLoading = true;
  int _availableCount = 4;
  int _occupiedCount = 8;
  int _cleaningCount = 2;
  int _outOfServiceCount = 1;

  final List<Map<String, dynamic>> _queueEntries = [
    {'position': 1, 'party_size': 2, 'wait_mins': 5},
    {'position': 2, 'party_size': 4, 'wait_mins': 15},
    {'position': 3, 'party_size': 3, 'wait_mins': 25},
    {'position': 4, 'party_size': 2, 'wait_mins': 40},
  ];

  @override
  void initState() {
    super.initState();
    _loadStatusData();
  }

  Future<void> _loadStatusData() async {
    try {
      final sb = Supabase.instance.client;
      final tables = await sb.from('restaurant_tables').select('status');
      if (tables.isNotEmpty) {
        int avail = 0;
        int occ = 0;
        int clean = 0;
        int oos = 0;
        for (var t in tables) {
          final s = (t['status'] ?? '').toString().toLowerCase();
          if (s == 'available') {
            avail++;
          } else if (s == 'occupied' || s == 'reserved') {
            occ++;
          } else if (s == 'cleaning') {
            clean++;
          } else {
            oos++;
          }
        }
        setState(() {
          _availableCount = avail;
          _occupiedCount = occ;
          _cleaningCount = clean;
          _outOfServiceCount = oos;
          _isLoading = false;
        });
      } else {
        setState(() => _isLoading = false);
      }
    } catch (e) {
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    const primaryColor = Color(0xFFB87F5C);

    return Scaffold(
      backgroundColor: const Color(0xFFFAF7F2),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, color: Color(0xFF1E1E1E), size: 18),
          onPressed: () { if (context.canPop()) { context.pop(); } else { context.go('/home'); } },
        ),
        centerTitle: true,
        title: const Text(
          'Restaurant Status',
          style: TextStyle(
            fontFamily: 'Playfair Display',
            fontSize: 20,
            fontWeight: FontWeight.w700,
            color: Color(0xFF1E1E1E),
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: Color(0xFF1E1E1E)),
            onPressed: () {
              setState(() => _isLoading = true);
              _loadStatusData();
            },
          )
        ],
      ),
      body: SafeArea(
        child: _isLoading
            ? const Center(child: CircularProgressIndicator(color: primaryColor))
            : SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
              // TABLE STATUS SUMMARY Header
              const Text(
                'TABLE STATUS SUMMARY',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1.2,
                  color: Color(0xFF8C827A),
                ),
              ),
              const SizedBox(height: 14),

              // 4 Stat Cards in a row
              Container(
                padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 12),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0xFFEBE5DF)),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.02),
                      blurRadius: 8,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                  children: [
                    _buildStatCol('$_availableCount', 'Available', const Color(0xFF10B981)),
                    _buildDivider(),
                    _buildStatCol('$_occupiedCount', 'Occupied', const Color(0xFFEF4444)),
                    _buildDivider(),
                    _buildStatCol('$_cleaningCount', 'Cleaning', const Color(0xFFF59E0B)),
                    _buildDivider(),
                    _buildStatCol('$_outOfServiceCount', 'Out of\nService', const Color(0xFF94A3B8)),
                  ],
                ),
              ),
              const SizedBox(height: 28),

              // LIVE QUEUE Header & List
              const Text(
                'LIVE QUEUE',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1.2,
                  color: Color(0xFF8C827A),
                ),
              ),
              const SizedBox(height: 14),

              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0xFFEBE5DF)),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.02),
                      blurRadius: 8,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: Column(
                  children: [
                    // Inner Header
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.all(6),
                              decoration: BoxDecoration(
                                color: const Color(0xFFF7F3EE),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: const Icon(Icons.people_alt_outlined, color: primaryColor, size: 18),
                            ),
                            const SizedBox(width: 10),
                            const Text(
                              'Current Queue',
                              style: TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.w700,
                                color: Color(0xFF1E1E1E),
                              ),
                            ),
                          ],
                        ),
                        TextButton(
                          onPressed: () => context.push(AppRoutes.queue),
                          child: const Text(
                            'See All',
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: primaryColor,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const Divider(color: Color(0xFFF3ECE6), height: 16),

                    // Queue Items
                    ..._queueEntries.map((e) {
                      return Padding(
                        padding: const EdgeInsets.symmetric(vertical: 8),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Row(
                              children: [
                                Text(
                                  '#${e['position']}',
                                  style: const TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w700,
                                    color: primaryColor,
                                  ),
                                ),
                                const SizedBox(width: 14),
                                Text(
                                  '${e['party_size']} People',
                                  style: const TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w500,
                                    color: Color(0xFF1E1E1E),
                                  ),
                                ),
                              ],
                            ),
                            Text(
                              '~ ${e['wait_mins']} mins',
                              style: const TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                                color: Color(0xFF8C827A),
                              ),
                            ),
                          ],
                        ),
                      );
                    }),
                  ],
                ),
              ),
              const SizedBox(height: 28),

              // NEXT AVAILABLE TABLE Header
              const Text(
                'NEXT AVAILABLE TABLE',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1.2,
                  color: Color(0xFF8C827A),
                ),
              ),
              const SizedBox(height: 14),

              Container(
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0xFFEBE5DF)),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.02),
                      blurRadius: 8,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: const [
                        Icon(Icons.access_time, size: 14, color: primaryColor),
                        SizedBox(width: 6),
                        Text(
                          'Estimated availability',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                            color: Color(0xFF8C827A),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.all(10),
                              decoration: BoxDecoration(
                                color: const Color(0xFFF7F3EE),
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: const Icon(Icons.table_restaurant_outlined, color: primaryColor, size: 24),
                            ),
                            const SizedBox(width: 14),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: const [
                                Text(
                                  'Table 2',
                                  style: TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.w700,
                                    color: Color(0xFF1E1E1E),
                                  ),
                                ),
                                SizedBox(height: 2),
                                Text(
                                  '4 Seats',
                                  style: TextStyle(
                                    fontSize: 12,
                                    color: Color(0xFF8C827A),
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF7F3EE),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: const Text(
                            '~ 5 mins',
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                              color: primaryColor,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),

              // Footer explanation
              const Center(
                child: Text(
                  'Live table status + current queue information.\nStatus values update when tables or queue change.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 11,
                    color: Color(0xFFA59D95),
                    height: 1.4,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildStatCol(String count, String label, Color color) {
    return Column(
      children: [
        Text(
          count,
          style: TextStyle(
            fontSize: 22,
            fontWeight: FontWeight.w800,
            color: color,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          label,
          textAlign: TextAlign.center,
          style: const TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w500,
            color: Color(0xFF8C827A),
            height: 1.2,
          ),
        ),
      ],
    );
  }

  Widget _buildDivider() {
    return Container(
      width: 1,
      height: 32,
      color: const Color(0xFFEBE5DF),
    );
  }
}

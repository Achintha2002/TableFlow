import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../core/theme.dart';
import '../../services/supabase_service.dart';
import 'quick_order_sheet.dart';

class WaiterFloorScreen extends StatefulWidget {
  const WaiterFloorScreen({super.key});

  @override
  State<WaiterFloorScreen> createState() => _WaiterFloorScreenState();
}

class _WaiterFloorScreenState extends State<WaiterFloorScreen> {
  bool _isLoading = true;
  bool _isStaff = false;
  String _staffName = 'Staff';
  String _staffRole = 'waiter';

  List<Map<String, dynamic>> _tables = [];
  List<Map<String, dynamic>> _serviceRequests = [];
  String _selectedFilter = 'All';

  Timer? _refreshTimer;

  @override
  void initState() {
    super.initState();
    _checkRoleAndLoad();
    // Periodic refresh for floor sync
    _refreshTimer = Timer.periodic(const Duration(seconds: 8), (_) {
      if (_isStaff && mounted) {
        _loadFloorData(silent: true);
      }
    });
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    super.dispose();
  }

  Future<void> _checkRoleAndLoad() async {
    try {
      final profile = await SupabaseService.getUserProfile();
      final role = profile?['role'] as String? ?? 'customer';
      final allowedRoles = ['waiter', 'staff', 'manager', 'admin'];

      if (!allowedRoles.contains(role)) {
        if (mounted) {
          setState(() {
            _isStaff = false;
            _isLoading = false;
          });
        }
        return;
      }

      if (mounted) {
        setState(() {
          _isStaff = true;
          _staffName = profile?['full_name'] ?? 'Staff Member';
          _staffRole = role;
        });
        await _loadFloorData();
      }
    } catch (e) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _loadFloorData({bool silent = false}) async {
    if (!silent) setState(() => _isLoading = true);

    try {
      // 1. Fetch tables
      final tables = await SupabaseService.getTables();

      // 2. Fetch active service requests from staff API
      final session = Supabase.instance.client.auth.currentSession;
      final token = session?.accessToken;

      List<Map<String, dynamic>> requests = [];
      try {
        final res = await http.get(
          Uri.parse('http://localhost:3000/api/service-requests'),
          headers: {
            if (token != null) 'Authorization': 'Bearer $token',
          },
        );
        if (res.statusCode == 200) {
          final decoded = jsonDecode(res.body);
          if (decoded is List) {
            requests = List<Map<String, dynamic>>.from(decoded);
          }
        }
      } catch (_) {}

      if (mounted) {
        setState(() {
          _tables = tables;
          _serviceRequests = requests;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted && !silent) setState(() => _isLoading = false);
    }
  }

  List<Map<String, dynamic>> get _filteredTables {
    if (_selectedFilter == 'All') return _tables;
    if (_selectedFilter == 'Available') return _tables.where((t) => t['status'] == 'available').toList();
    if (_selectedFilter == 'Occupied') return _tables.where((t) => t['status'] == 'occupied').toList();
    if (_selectedFilter == 'Cleaning') return _tables.where((t) => t['status'] == 'needs_cleaning').toList();
    return _tables;
  }

  int get _availableCount => _tables.where((t) => t['status'] == 'available').length;
  int get _occupiedCount => _tables.where((t) => t['status'] == 'occupied').length;
  int get _cleaningCount => _tables.where((t) => t['status'] == 'needs_cleaning').length;

  Color _getStatusColor(String status) {
    switch (status) {
      case 'available':
        return const Color(0xFF10B981); // Bright Emerald Green
      case 'occupied':
        return const Color(0xFFEF4444); // Vibrant Red
      case 'needs_cleaning':
      case 'cleaning':
        return const Color(0xFF2563EB); // Azure Blue
      default:
        return Colors.grey;
    }
  }

  IconData _getStatusIcon(String status) {
    switch (status) {
      case 'available':
        return Icons.check_circle_rounded;
      case 'occupied':
        return Icons.person_rounded;
      case 'needs_cleaning':
      case 'cleaning':
        return Icons.cleaning_services_rounded;
      default:
        return Icons.table_restaurant_rounded;
    }
  }

  String _formatStatus(String status) {
    switch (status) {
      case 'available':
        return 'Available';
      case 'occupied':
        return 'Occupied';
      case 'needs_cleaning':
        return 'Needs Cleaning';
      default:
        return status.toUpperCase();
    }
  }

  Future<void> _attendRequest(String requestId) async {
    try {
      final session = Supabase.instance.client.auth.currentSession;
      final token = session?.accessToken;

      final res = await http.patch(
        Uri.parse('http://localhost:3000/api/service-requests/$requestId/attend'),
        headers: {
          'Content-Type': 'application/json',
          if (token != null) 'Authorization': 'Bearer $token',
        },
      );

      final data = jsonDecode(res.body);

      if (res.statusCode == 200) {
        setState(() {
          _serviceRequests.removeWhere((r) => r['id'] == requestId);
        });
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              backgroundColor: Color(0xFF2E7D32),
              content: Text('Request marked as attended!'),
            ),
          );
        }
      } else if (res.statusCode == 409) {
        setState(() {
          _serviceRequests.removeWhere((r) => r['id'] == requestId);
        });
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              backgroundColor: Colors.orange.shade800,
              content: Text(data['error'] ?? 'Already attended by another staff member'),
            ),
          );
        }
      }
    } catch (e) {
      debugPrint('Error attending request: $e');
    }
  }

  Future<void> _updateTableStatus(dynamic tableId, String newStatus, {bool force = false}) async {
    try {
      final session = Supabase.instance.client.auth.currentSession;
      final token = session?.accessToken;

      final res = await http.patch(
        Uri.parse('http://localhost:3000/api/tables/$tableId/status'),
        headers: {
          'Content-Type': 'application/json',
          if (token != null) 'Authorization': 'Bearer $token',
        },
        body: jsonEncode({
          'status': newStatus,
          'force': force,
        }),
      );

      final data = jsonDecode(res.body);

      if (res.statusCode == 200) {
        if (mounted) {
          Navigator.of(context).pop();
          _loadFloorData();
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              backgroundColor: const Color(0xFF2E7D32),
              content: Text('Table status updated to ${_formatStatus(newStatus)}'),
            ),
          );
        }
      } else if (res.statusCode == 409) {
        // Unpaid order guard!
        if (mounted) {
          _showUnpaidOrderWarning(tableId, data['error'] ?? 'Table has an active unsettled order.');
        }
      } else {
        throw Exception(data['error'] ?? 'Failed to update table');
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: Colors.redAccent,
            content: Text(e.toString().replaceAll('Exception: ', '')),
          ),
        );
      }
    }
  }

  void _showUnpaidOrderWarning(dynamic tableId, String errorMsg) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Row(
          children: [
            Icon(Icons.warning_amber_rounded, color: Colors.orange, size: 28),
            SizedBox(width: 8),
            Text('Active Bill Pending'),
          ],
        ),
        content: Text(
          '$errorMsg\n\nAre you sure you want to force table availability?',
          style: const TextStyle(fontSize: 14),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.of(ctx).pop();
              _updateTableStatus(tableId, 'available', force: true);
            },
            style: ElevatedButton.styleFrom(backgroundColor: Colors.redAccent),
            child: const Text('Force Clear Table'),
          ),
        ],
      ),
    );
  }

  void _openTableActionSheet(Map<String, dynamic> table) {
    final tableNum = table['table_number'] ?? table['id'];
    final currentStatus = table['status'] ?? 'available';

    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Table #$tableNum Controls',
                    style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: _getStatusColor(currentStatus).withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      _formatStatus(currentStatus),
                      style: TextStyle(
                        color: _getStatusColor(currentStatus),
                        fontWeight: FontWeight.bold,
                        fontSize: 12,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              const Text('Change Table Status:', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => _updateTableStatus(table['id'], 'available'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: const Color(0xFF2E7D32),
                        side: const BorderSide(color: Color(0xFF2E7D32)),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                      child: const Text('Available'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => _updateTableStatus(table['id'], 'occupied'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: AppTheme.primary,
                        side: const BorderSide(color: AppTheme.primary),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                      child: const Text('Occupied'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => _updateTableStatus(table['id'], 'needs_cleaning'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: const Color(0xFFE65100),
                        side: const BorderSide(color: Color(0xFFE65100)),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                      child: const Text('Clean'),
                    ),
                  ),
                ],
              ),
              const Divider(height: 32),
              SizedBox(
                width: double.infinity,
                height: 48,
                child: ElevatedButton.icon(
                  icon: const Icon(Icons.add_shopping_cart),
                  label: const Text('Punch In Order at Table', style: TextStyle(fontWeight: FontWeight.bold)),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.secondary,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  ),
                  onPressed: () {
                    Navigator.of(ctx).pop();
                    QuickOrderSheet.show(
                      context,
                      table: table,
                      onOrderSubmitted: _loadFloorData,
                    );
                  },
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    if (!_isStaff) {
      return Scaffold(
        appBar: AppBar(title: const Text('Staff Area')),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.lock_outline, size: 64, color: AppTheme.primary),
                const SizedBox(height: 16),
                const Text(
                  'Staff Authorization Required',
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 8),
                const Text(
                  'This device is signed in as a Guest. Please sign in with a waiter, staff, or manager account to access Floor Mode.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Colors.grey),
                ),
                const SizedBox(height: 24),
                ElevatedButton(
                  onPressed: () => context.go('/home'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.primary,
                    foregroundColor: Colors.white,
                  ),
                  child: const Text('Return to Guest Home'),
                ),
                const SizedBox(height: 12),
                OutlinedButton.icon(
                  icon: const Icon(Icons.visibility_rounded, color: AppTheme.primary),
                  label: const Text('Preview Floor Mode (Staff Demo)', style: TextStyle(color: AppTheme.primary, fontWeight: FontWeight.bold)),
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: AppTheme.primary, width: 1.5),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                  ),
                  onPressed: () {
                    setState(() {
                      _isStaff = true;
                      _staffName = 'Staff Demo';
                      _staffRole = 'waiter';
                    });
                    _loadFloorData();
                  },
                ),
              ],
            ),
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: const Color(0xFFF9F7F2),
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Floor Mode', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
            Text(
              '$_staffName (${_staffRole.toUpperCase()})',
              style: const TextStyle(fontSize: 12, color: Colors.grey),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => _loadFloorData(),
          ),
          Padding(
            padding: const EdgeInsets.only(right: 8.0),
            child: TextButton.icon(
              icon: const Icon(Icons.person, size: 18),
              label: const Text('Guest View'),
              onPressed: () => context.go('/home'),
            ),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _loadFloorData,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // Metrics Summary
            Row(
              children: [
                _buildMetricCard('Available', '$_availableCount', const Color(0xFF2E7D32)),
                const SizedBox(width: 8),
                _buildMetricCard('Occupied', '$_occupiedCount', AppTheme.primary),
                const SizedBox(width: 8),
                _buildMetricCard('Cleaning', '$_cleaningCount', const Color(0xFFE65100)),
                const SizedBox(width: 8),
                _buildMetricCard('Calls', '${_serviceRequests.length}', Colors.red.shade700, isAlert: _serviceRequests.isNotEmpty),
              ],
            ),

            const SizedBox(height: 20),

            // Service Requests Banner / Hub
            if (_serviceRequests.isNotEmpty) ...[
              Row(
                children: [
                  const Icon(Icons.notifications_active, color: Colors.red, size: 20),
                  const SizedBox(width: 8),
                  Text(
                    'Active Service Calls (${_serviceRequests.length})',
                    style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              ListView.separated(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: _serviceRequests.length,
                separatorBuilder: (_, _) => const SizedBox(height: 8),
                itemBuilder: (context, idx) {
                  final req = _serviceRequests[idx];
                  final tNum = req['restaurant_tables']?['table_number'] ?? req['table_id'];
                  final reqType = (req['request_type'] as String? ?? 'general').toUpperCase();

                  return Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    decoration: BoxDecoration(
                      color: Colors.red.shade50,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: Colors.red.shade200),
                    ),
                    child: Row(
                      children: [
                        CircleAvatar(
                          backgroundColor: Colors.red.shade100,
                          child: const Icon(Icons.room_service, color: Colors.red, size: 20),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Table #$tNum requested $reqType',
                                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                              ),
                              const Text('Awaiting staff assistance', style: TextStyle(fontSize: 12, color: Colors.grey)),
                            ],
                          ),
                        ),
                        ElevatedButton(
                          onPressed: () => _attendRequest(req['id']),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.red.shade700,
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                          ),
                          child: const Text('Attend'),
                        ),
                      ],
                    ),
                  );
                },
              ),
              const SizedBox(height: 24),
            ],

            // Filter Tabs
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Dining Floor Tables', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                Text('${_filteredTables.length} tables', style: const TextStyle(color: Colors.grey, fontSize: 13)),
              ],
            ),
            const SizedBox(height: 10),
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: ['All', 'Available', 'Occupied', 'Cleaning'].map((f) {
                  final isSelected = f == _selectedFilter;
                  return Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: ChoiceChip(
                      label: Text(f),
                      selected: isSelected,
                      selectedColor: AppTheme.secondary,
                      labelStyle: TextStyle(
                        color: isSelected ? Colors.white : Colors.black87,
                        fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                      ),
                      onSelected: (_) => setState(() => _selectedFilter = f),
                    ),
                  );
                }).toList(),
              ),
            ),

            const SizedBox(height: 16),

            // Floor Tables Grid
            GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                childAspectRatio: 1.25,
                crossAxisSpacing: 12,
                mainAxisSpacing: 12,
              ),
              itemCount: _filteredTables.length,
              itemBuilder: (context, idx) {
                final t = _filteredTables[idx];
                final status = t['status'] ?? 'available';
                final color = _getStatusColor(status);

                return InkWell(
                  onTap: () => _openTableActionSheet(t),
                  borderRadius: BorderRadius.circular(18),
                  child: Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(18),
                      border: Border.all(color: color.withValues(alpha: 0.45), width: 2),
                      boxShadow: [
                        BoxShadow(
                          color: color.withValues(alpha: 0.08),
                          blurRadius: 10,
                          offset: const Offset(0, 4),
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
                            // Big table number display
                            Text(
                              '#${t['table_number']}',
                              style: TextStyle(
                                fontWeight: FontWeight.w900,
                                fontSize: 26,
                                color: color,
                                letterSpacing: -0.5,
                              ),
                            ),
                            // Simple clear icon
                            Container(
                              padding: const EdgeInsets.all(6),
                              decoration: BoxDecoration(
                                color: color.withValues(alpha: 0.12),
                                shape: BoxShape.circle,
                              ),
                              child: Icon(
                                _getStatusIcon(status),
                                color: color,
                                size: 18,
                              ),
                            ),
                          ],
                        ),
                        Text(
                          '${t['capacity'] ?? 2} Seats • ${t['table_categories']?['name'] ?? 'Main Dining'}',
                          style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: Color(0xFF6B7280)),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: color.withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(
                            _formatStatus(status),
                            style: TextStyle(
                              color: color,
                              fontWeight: FontWeight.w800,
                              fontSize: 11,
                              letterSpacing: 0.4,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),

            const SizedBox(height: 40),
          ],
        ),
      ),
    );
  }

  Widget _buildMetricCard(String title, String count, Color color, {bool isAlert = false}) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
        decoration: BoxDecoration(
          color: isAlert ? Colors.red.shade50 : Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isAlert ? Colors.red : color.withValues(alpha: 0.2),
            width: isAlert ? 1.5 : 1,
          ),
        ),
        child: Column(
          children: [
            Text(
              count,
              style: TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.bold,
                color: color,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              title,
              style: TextStyle(
                fontSize: 11,
                color: isAlert ? Colors.red.shade800 : Colors.grey.shade700,
                fontWeight: isAlert ? FontWeight.bold : FontWeight.normal,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

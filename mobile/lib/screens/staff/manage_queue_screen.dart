import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import '../../services/api_service.dart';
import 'assign_table_sheet.dart';

class ManageQueueScreen extends StatefulWidget {
  const ManageQueueScreen({super.key});

  @override
  State<ManageQueueScreen> createState() => _ManageQueueScreenState();
}

class _ManageQueueScreenState extends State<ManageQueueScreen> {
  bool _isLoading = true;
  List<Map<String, dynamic>> _queue = [];

  @override
  void initState() {
    super.initState();
    _fetchQueue();
  }

  Future<void> _fetchQueue() async {
    setState(() => _isLoading = true);
    try {
      final res = await http.get(Uri.parse('${ApiService.baseUrl}/api/queue'));
      if (res.statusCode == 200) {
        final List<dynamic> data = jsonDecode(res.body);
        setState(() {
          _queue = data.map<Map<String, dynamic>>((e) {
            return {
              'id': e['id']?.toString() ?? '',
              'customer_name': e['customer_name'] ?? e['name'] ?? 'Guest Party',
              'customer_phone': e['customer_phone'] ?? e['phone'] ?? '+1 (555) 019-2834',
              'guest_count': e['guest_count'] ?? e['pax'] ?? 2,
              'status': e['status'] ?? 'waiting',
              'wait_time_minutes': e['wait_time_minutes'] ?? 15,
              'created_at': e['created_at'] ?? '12m ago',
              'queue_number': e['queue_number'] ?? 1,
            };
          }).toList();
          _isLoading = false;
        });
      } else {
        _useFallbackQueue();
      }
    } catch (_) {
      _useFallbackQueue();
    }
  }

  void _useFallbackQueue() {
    setState(() {
      _queue = [
        {
          'id': '101',
          'customer_name': 'James & Sarah Wilson',
          'customer_phone': '+1 (555) 234-5678',
          'guest_count': 4,
          'status': 'waiting',
          'wait_time_minutes': 12,
          'created_at': '12m ago',
          'queue_number': 1,
        },
        {
          'id': '102',
          'customer_name': 'Elena Rostova',
          'customer_phone': '+1 (555) 345-6789',
          'guest_count': 2,
          'status': 'waiting',
          'wait_time_minutes': 18,
          'created_at': '18m ago',
          'queue_number': 2,
        },
        {
          'id': '103',
          'customer_name': 'Marcus Vance (VIP)',
          'customer_phone': '+1 (555) 987-6543',
          'guest_count': 6,
          'status': 'waiting',
          'wait_time_minutes': 25,
          'created_at': '25m ago',
          'queue_number': 3,
        },
        {
          'id': '104',
          'customer_name': 'Chloe Dupont',
          'customer_phone': '+1 (555) 456-7890',
          'guest_count': 3,
          'status': 'waiting',
          'wait_time_minutes': 30,
          'created_at': '30m ago',
          'queue_number': 4,
        },
      ];
      _isLoading = false;
    });
  }

  void _moveUp(int index) {
    if (index <= 0) return;
    final item = _queue[index];
    setState(() {
      _queue.removeAt(index);
      _queue.insert(index - 1, item);
      for (int i = 0; i < _queue.length; i++) {
        _queue[i]['queue_number'] = i + 1;
      }
    });
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Moved ${item['customer_name']} to #$index'),
        duration: const Duration(seconds: 1),
      ),
    );
  }

  void _moveDown(int index) {
    if (index >= _queue.length - 1) return;
    final item = _queue[index];
    setState(() {
      _queue.removeAt(index);
      _queue.insert(index + 1, item);
      for (int i = 0; i < _queue.length; i++) {
        _queue[i]['queue_number'] = i + 1;
      }
    });
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Moved ${item['customer_name']} to #${index + 2}'),
        duration: const Duration(seconds: 1),
      ),
    );
  }

  Future<void> _deleteQueueItem(int index) async {
    final item = _queue[index];
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFFFAF7F2),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text('Remove from Queue?', style: TextStyle(fontFamily: 'Playfair Display', fontWeight: FontWeight.bold)),
        content: Text('Are you sure you want to cancel waitlist ticket for ${item['customer_name']}?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Keep', style: TextStyle(color: Color(0xFF8C827A))),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.redAccent,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Remove'),
          ),
        ],
      ),
    );

    if (confirm == true) {
      setState(() {
        _queue.removeAt(index);
        for (int i = 0; i < _queue.length; i++) {
          _queue[i]['queue_number'] = i + 1;
        }
      });
      try {
        await http.delete(Uri.parse('${ApiService.baseUrl}/api/queue/${item['id']}'));
      } catch (_) {}
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Removed party from waitlist')),
        );
      }
    }
  }

  void _showAddWalkInDialog() {
    final nameCtrl = TextEditingController();
    final phoneCtrl = TextEditingController();
    int pax = 2;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => Container(
          padding: EdgeInsets.only(
            top: 16,
            left: 20,
            right: 20,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + 24,
          ),
          decoration: const BoxDecoration(
            color: Color(0xFFFAF7F2),
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(color: const Color(0xFFD4CDC5), borderRadius: BorderRadius.circular(4)),
                ),
              ),
              const SizedBox(height: 16),
              const Text(
                'Add Walk-In to Queue',
                style: TextStyle(fontFamily: 'Playfair Display', fontSize: 20, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 14),
              TextField(
                controller: nameCtrl,
                decoration: InputDecoration(
                  labelText: 'Guest / Party Name',
                  filled: true,
                  fillColor: Colors.white,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: phoneCtrl,
                keyboardType: TextInputType.phone,
                decoration: InputDecoration(
                  labelText: 'Mobile Phone (for SMS / FCM)',
                  filled: true,
                  fillColor: Colors.white,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                ),
              ),
              const SizedBox(height: 16),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Party Size', style: TextStyle(fontWeight: FontWeight.bold)),
                  Row(
                    children: [
                      IconButton(
                        onPressed: pax > 1 ? () => setDialogState(() => pax--) : null,
                        icon: const Icon(Icons.remove_circle_outline),
                      ),
                      Text('$pax Guests', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                      IconButton(
                        onPressed: () => setDialogState(() => pax++),
                        icon: const Icon(Icons.add_circle_outline, color: Color(0xFFB87F5C)),
                      ),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: 20),
              ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFB87F5C),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                ),
                onPressed: () async {
                  if (nameCtrl.text.trim().isEmpty) return;
                  final newEntry = {
                    'id': DateTime.now().millisecondsSinceEpoch.toString(),
                    'customer_name': nameCtrl.text.trim(),
                    'customer_phone': phoneCtrl.text.trim().isEmpty ? '+1 (555) 000-0000' : phoneCtrl.text.trim(),
                    'guest_count': pax,
                    'status': 'waiting',
                    'wait_time_minutes': 15,
                    'created_at': 'Just now',
                    'queue_number': _queue.length + 1,
                  };
                  setState(() => _queue.add(newEntry));
                  Navigator.pop(ctx);
                  try {
                    await http.post(
                      Uri.parse('${ApiService.baseUrl}/api/queue'),
                      headers: {'Content-Type': 'application/json'},
                      body: jsonEncode({
                        'customer_name': nameCtrl.text.trim(),
                        'customer_phone': phoneCtrl.text.trim(),
                        'guest_count': pax,
                      }),
                    );
                  } catch (_) {}
                },
                child: const Text('Add to Queue Ticket', style: TextStyle(fontWeight: FontWeight.bold)),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFFAF7F2),
      appBar: AppBar(
        backgroundColor: const Color(0xFFFAF7F2),
        elevation: 0,
        title: const Text(
          'Queue Manager',
          style: TextStyle(
            fontFamily: 'Playfair Display',
            fontWeight: FontWeight.bold,
            color: Color(0xFF1E1E1E),
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: Color(0xFF1E1E1E)),
            onPressed: _fetchQueue,
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFFB87F5C)))
          : Column(
              children: [
                // Top summary bar
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(18),
                      border: Border.all(color: const Color(0xFFEFEAE4)),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceAround,
                      children: [
                        Column(
                          children: [
                            Text(
                              '${_queue.length}',
                              style: const TextStyle(
                                fontSize: 22,
                                fontWeight: FontWeight.bold,
                                color: Color(0xFFB87F5C),
                              ),
                            ),
                            const Text('Parties Waiting', style: TextStyle(fontSize: 12, color: Color(0xFF8C827A))),
                          ],
                        ),
                        Container(width: 1, height: 32, color: const Color(0xFFEFEAE4)),
                        Column(
                          children: [
                            Text(
                              '~${_queue.length * 5}m',
                              style: const TextStyle(
                                fontSize: 22,
                                fontWeight: FontWeight.bold,
                                color: Color(0xFF1E1E1E),
                              ),
                            ),
                            const Text('Est. Turnaround', style: TextStyle(fontSize: 12, color: Color(0xFF8C827A))),
                          ],
                        ),
                        Container(width: 1, height: 32, color: const Color(0xFFEFEAE4)),
                        ElevatedButton.icon(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFFB87F5C),
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                            elevation: 0,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          ),
                          onPressed: _showAddWalkInDialog,
                          icon: const Icon(Icons.add, size: 18),
                          label: const Text('Walk-in', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 8),

                // Reorderable helper text
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 4),
                  child: Row(
                    children: [
                      const Text(
                        'PRIORITY QUEUE LIST',
                        style: TextStyle(
                          fontSize: 11,
                          letterSpacing: 1.2,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF8C827A),
                        ),
                      ),
                      const Spacer(),
                      Text(
                        'Use arrows to reorder priority',
                        style: TextStyle(fontSize: 11, color: Colors.grey.shade600),
                      ),
                    ],
                  ),
                ),

                // List of parties
                Expanded(
                  child: _queue.isEmpty
                      ? const Center(
                          child: Text('Waitlist is currently clear!', style: TextStyle(color: Color(0xFF8C827A))),
                        )
                      : ListView.separated(
                          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                          itemCount: _queue.length,
                          separatorBuilder: (_, _) => const SizedBox(height: 12),
                          itemBuilder: (ctx, index) {
                            final item = _queue[index];
                            final pos = index + 1;
                            final isFirst = index == 0;
                            final isLast = index == _queue.length - 1;

                            return Container(
                              padding: const EdgeInsets.all(14),
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(18),
                                border: Border.all(
                                  color: pos == 1 ? const Color(0xFFB87F5C) : const Color(0xFFEFEAE4),
                                  width: pos == 1 ? 1.5 : 1,
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
                                children: [
                                  Row(
                                    children: [
                                      // Position circle
                                      Container(
                                        width: 38,
                                        height: 38,
                                        decoration: BoxDecoration(
                                          color: pos == 1
                                              ? const Color(0xFFB87F5C)
                                              : const Color(0xFFFAF7F2),
                                          borderRadius: BorderRadius.circular(12),
                                          border: Border.all(
                                            color: pos == 1 ? Colors.transparent : const Color(0xFFD4CDC5),
                                          ),
                                        ),
                                        child: Center(
                                          child: Text(
                                            '#$pos',
                                            style: TextStyle(
                                              fontSize: 15,
                                              fontWeight: FontWeight.bold,
                                              color: pos == 1 ? Colors.white : const Color(0xFF1E1E1E),
                                            ),
                                          ),
                                        ),
                                      ),
                                      const SizedBox(width: 14),

                                      // Party details
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            Row(
                                              children: [
                                                Flexible(
                                                  child: Text(
                                                    item['customer_name'],
                                                    style: const TextStyle(
                                                      fontSize: 16,
                                                      fontWeight: FontWeight.bold,
                                                      color: Color(0xFF1E1E1E),
                                                    ),
                                                    overflow: TextOverflow.ellipsis,
                                                  ),
                                                ),
                                                if (pos == 1) ...[
                                                  const SizedBox(width: 6),
                                                  Container(
                                                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                                    decoration: BoxDecoration(
                                                      color: const Color(0xFFE8F5E9),
                                                      borderRadius: BorderRadius.circular(6),
                                                    ),
                                                    child: const Text(
                                                      'NEXT',
                                                      style: TextStyle(
                                                        fontSize: 10,
                                                        color: Color(0xFF2E7D32),
                                                        fontWeight: FontWeight.bold,
                                                      ),
                                                    ),
                                                  ),
                                                ],
                                              ],
                                            ),
                                            const SizedBox(height: 3),
                                            Text(
                                              '${item['guest_count']} Guests • ${item['customer_phone']}',
                                              style: const TextStyle(fontSize: 12, color: Color(0xFF8C827A)),
                                            ),
                                          ],
                                        ),
                                      ),

                                      // Reorder & Action buttons
                                      Row(
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          IconButton(
                                            visualDensity: VisualDensity.compact,
                                            icon: Icon(
                                              Icons.arrow_upward,
                                              size: 18,
                                              color: isFirst ? Colors.grey.shade300 : const Color(0xFF5A524C),
                                            ),
                                            onPressed: isFirst ? null : () => _moveUp(index),
                                          ),
                                          IconButton(
                                            visualDensity: VisualDensity.compact,
                                            icon: Icon(
                                              Icons.arrow_downward,
                                              size: 18,
                                              color: isLast ? Colors.grey.shade300 : const Color(0xFF5A524C),
                                            ),
                                            onPressed: isLast ? null : () => _moveDown(index),
                                          ),
                                          IconButton(
                                            visualDensity: VisualDensity.compact,
                                            icon: const Icon(Icons.delete_outline, size: 19, color: Colors.redAccent),
                                            onPressed: () => _deleteQueueItem(index),
                                          ),
                                        ],
                                      ),
                                    ],
                                  ),
                                  const Divider(height: 18, color: Color(0xFFF0EBE6)),
                                  Row(
                                    children: [
                                      Icon(Icons.timer_outlined, size: 15, color: Colors.grey.shade600),
                                      const SizedBox(width: 4),
                                      Text(
                                        'Waiting ~${item['wait_time_minutes']}m',
                                        style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                                      ),
                                      const Spacer(),
                                      OutlinedButton.icon(
                                        style: OutlinedButton.styleFrom(
                                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                                          side: const BorderSide(color: Color(0xFFB87F5C)),
                                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                        ),
                                        onPressed: () {
                                          AssignTableSheet.show(
                                            context,
                                            queueItem: item,
                                            onAssigned: _fetchQueue,
                                          );
                                        },
                                        icon: const Icon(Icons.table_restaurant, size: 15, color: Color(0xFFB87F5C)),
                                        label: const Text(
                                          'Assign Table',
                                          style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFFB87F5C)),
                                        ),
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
}

import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../core/theme.dart';
import '../../services/supabase_service.dart';

class QuickOrderSheet extends StatefulWidget {
  final Map<String, dynamic> table;
  final VoidCallback onOrderSubmitted;

  const QuickOrderSheet({
    super.key,
    required this.table,
    required this.onOrderSubmitted,
  });

  static Future<void> show(
    BuildContext context, {
    required Map<String, dynamic> table,
    required VoidCallback onOrderSubmitted,
  }) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => QuickOrderSheet(
        table: table,
        onOrderSubmitted: onOrderSubmitted,
      ),
    );
  }

  @override
  State<QuickOrderSheet> createState() => _QuickOrderSheetState();
}

class _QuickOrderSheetState extends State<QuickOrderSheet> {
  bool _isLoading = true;
  bool _isSubmitting = false;
  List<Map<String, dynamic>> _menuItems = [];
  String _selectedCategory = 'All';
  final Map<int, int> _itemQuantities = {};
  final TextEditingController _notesController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadMenu();
  }

  @override
  void dispose() {
    _notesController.dispose();
    super.dispose();
  }

  Future<void> _loadMenu() async {
    try {
      final items = await SupabaseService.getMenuItems();
      if (mounted) {
        setState(() {
          _menuItems = items;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  List<String> get _categories {
    final cats = {'All'};
    for (final item in _menuItems) {
      if (item['category'] != null) cats.add(item['category'] as String);
    }
    return cats.toList();
  }

  List<Map<String, dynamic>> get _filteredItems {
    if (_selectedCategory == 'All') return _menuItems;
    return _menuItems.where((i) => i['category'] == _selectedCategory).toList();
  }

  double get _totalPrice {
    double total = 0;
    _itemQuantities.forEach((id, qty) {
      final item = _menuItems.firstWhere((i) => i['id'] == id, orElse: () => {});
      if (item.isNotEmpty) {
        total += (_parsePrice(item['price'])) * qty;
      }
    });
    return total;
  }

  double _parsePrice(dynamic val) {
    if (val == null) return 0;
    if (val is num) return val.toDouble();
    return double.tryParse(val.toString()) ?? 0;
  }

  Future<void> _submitOrder() async {
    final selectedItems = <Map<String, dynamic>>[];
    _itemQuantities.forEach((id, qty) {
      if (qty > 0) {
        final item = _menuItems.firstWhere((i) => i['id'] == id);
        selectedItems.add({
          'id': id,
          'product_id': id,
          'quantity': qty,
          'price': item['price'],
        });
      }
    });

    if (selectedItems.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please select at least 1 item to punch in')),
      );
      return;
    }

    setState(() => _isSubmitting = true);

    try {
      final session = Supabase.instance.client.auth.currentSession;
      final token = session?.accessToken;
      final tableId = widget.table['id'];

      final response = await http.post(
        Uri.parse('http://localhost:3000/api/staff/orders'),
        headers: {
          'Content-Type': 'application/json',
          if (token != null) 'Authorization': 'Bearer $token',
        },
        body: jsonEncode({
          'table_id': tableId,
          'items': selectedItems,
          'special_instructions': _notesController.text.trim(),
        }),
      );

      final data = jsonDecode(response.body);

      if (response.statusCode == 200 || response.statusCode == 201) {
        if (mounted) {
          Navigator.of(context).pop();
          widget.onOrderSubmitted();
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              backgroundColor: const Color(0xFF2E7D32),
              content: Text(
                data['mode'] == 'merged'
                    ? 'Items appended to Table #${widget.table['table_number']} existing bill!'
                    : 'Order sent to Kitchen for Table #${widget.table['table_number']}!',
              ),
            ),
          );
        }
      } else {
        throw Exception(data['error'] ?? 'Failed to punch in order');
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
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final tableNum = widget.table['table_number'] ?? widget.table['id'];

    return Container(
      height: MediaQuery.of(context).size.height * 0.88,
      decoration: const BoxDecoration(
        color: AppTheme.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      child: Column(
        children: [
          // Drag Handle
          Center(
            child: Container(
              margin: const EdgeInsets.only(top: 12, bottom: 8),
              width: 44,
              height: 5,
              decoration: BoxDecoration(
                color: Colors.grey.shade300,
                borderRadius: BorderRadius.circular(10),
              ),
            ),
          ),

          // Header
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Punch In Order • Table #$tableNum',
                      style: const TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                        color: AppTheme.secondary,
                      ),
                    ),
                    const Text(
                      'Items send directly to KDS kitchen display',
                      style: TextStyle(fontSize: 13, color: Colors.grey),
                    ),
                  ],
                ),
                IconButton(
                  icon: const Icon(Icons.close),
                  onPressed: () => Navigator.of(context).pop(),
                ),
              ],
            ),
          ),

          const Divider(height: 1),

          // Category Pills
          SizedBox(
            height: 48,
            child: ListView.separated(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              scrollDirection: Axis.horizontal,
              itemCount: _categories.length,
              separatorBuilder: (_, _) => const SizedBox(width: 8),
              itemBuilder: (context, idx) {
                final cat = _categories[idx];
                final isSelected = cat == _selectedCategory;
                return ChoiceChip(
                  label: Text(cat),
                  selected: isSelected,
                  selectedColor: AppTheme.primary,
                  backgroundColor: Colors.grey.shade100,
                  labelStyle: TextStyle(
                    color: isSelected ? Colors.white : Colors.black87,
                    fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                    fontSize: 13,
                  ),
                  onSelected: (_) => setState(() => _selectedCategory = cat),
                );
              },
            ),
          ),

          // Menu Items List
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator())
                : ListView.separated(
                    padding: const EdgeInsets.all(16),
                    itemCount: _filteredItems.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 10),
                    itemBuilder: (context, idx) {
                      final item = _filteredItems[idx];
                      final id = item['id'] as int;
                      final qty = _itemQuantities[id] ?? 0;
                      final price = _parsePrice(item['price']);

                      return Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: qty > 0 ? AppTheme.primary.withValues(alpha: 0.05) : Colors.white,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(
                            color: qty > 0 ? AppTheme.primary : Colors.grey.shade200,
                            width: qty > 0 ? 1.5 : 1,
                          ),
                        ),
                        child: Row(
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    item['name'] ?? '',
                                    style: const TextStyle(
                                      fontWeight: FontWeight.bold,
                                      fontSize: 15,
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    'LKR ${price.toStringAsFixed(0)}',
                                    style: TextStyle(
                                      color: AppTheme.primary,
                                      fontWeight: FontWeight.w600,
                                      fontSize: 14,
                                    ),
                                  ),
                                ],
                              ),
                            ),

                            // Stepper
                            Row(
                              children: [
                                if (qty > 0) ...[
                                  IconButton(
                                    icon: const Icon(Icons.remove_circle_outline, size: 22),
                                    color: Colors.grey.shade700,
                                    onPressed: () {
                                      setState(() {
                                        if (qty > 1) {
                                          _itemQuantities[id] = qty - 1;
                                        } else {
                                          _itemQuantities.remove(id);
                                        }
                                      });
                                    },
                                  ),
                                  Text(
                                    '$qty',
                                    style: const TextStyle(
                                      fontWeight: FontWeight.bold,
                                      fontSize: 16,
                                    ),
                                  ),
                                ],
                                IconButton(
                                  icon: Icon(
                                    qty > 0 ? Icons.add_circle : Icons.add_circle_outline,
                                    color: AppTheme.primary,
                                    size: 26,
                                  ),
                                  onPressed: () {
                                    setState(() {
                                      _itemQuantities[id] = qty + 1;
                                    });
                                  },
                                ),
                              ],
                            ),
                          ],
                        ),
                      );
                    },
                  ),
          ),

          // Table Instructions & Submit Bar
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.06),
                  blurRadius: 10,
                  offset: const Offset(0, -4),
                ),
              ],
            ),
            child: SafeArea(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextField(
                    controller: _notesController,
                    decoration: InputDecoration(
                      hintText: 'Order notes (e.g. rush order, extra napkins)...',
                      hintStyle: const TextStyle(fontSize: 13),
                      isDense: true,
                      filled: true,
                      fillColor: Colors.grey.shade100,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: BorderSide.none,
                      ),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                    ),
                  ),
                  const SizedBox(height: 12),
                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: ElevatedButton(
                      onPressed: _isSubmitting || _totalPrice == 0 ? null : _submitOrder,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppTheme.primary,
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                        elevation: 0,
                      ),
                      child: _isSubmitting
                          ? const SizedBox(
                              height: 20,
                              width: 20,
                              child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                            )
                          : Text(
                              _totalPrice > 0
                                  ? 'Send to Kitchen • LKR ${_totalPrice.toStringAsFixed(0)}'
                                  : 'Select Items to Order',
                              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                            ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import '../../services/api_service.dart';

class CustomerDirectoryScreen extends StatefulWidget {
  const CustomerDirectoryScreen({super.key});

  @override
  State<CustomerDirectoryScreen> createState() => _CustomerDirectoryScreenState();
}

class _CustomerDirectoryScreenState extends State<CustomerDirectoryScreen> {
  final TextEditingController _searchController = TextEditingController();
  String _selectedFrequency = 'All Customers';
  final List<String> _frequencies = ['All Customers', 'VIP', 'Regular', 'New', 'Occasional'];
  bool _isLoading = true;

  List<Map<String, dynamic>> _customers = [];

  @override
  void initState() {
    super.initState();
    _fetchCustomers();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _fetchCustomers({String? search, String? frequency}) async {
    setState(() => _isLoading = true);
    try {
      var url = '${ApiService.baseUrl}/api/customers/directory';
      final params = <String>[];
      if (search != null && search.isNotEmpty) params.add('search=${Uri.encodeComponent(search)}');
      if (frequency != null && frequency != 'All Customers') params.add('frequency=${Uri.encodeComponent(frequency)}');
      if (params.isNotEmpty) url += '?${params.join('&')}';

      final res = await http.get(Uri.parse(url));
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        setState(() {
          _customers = List<Map<String, dynamic>>.from(data);
          _isLoading = false;
        });
      } else {
        _useFallbackCustomers();
      }
    } catch (e) {
      _useFallbackCustomers();
    }
  }

  void _useFallbackCustomers() {
    setState(() {
      _customers = [
        {
          'id': '1',
          'name': 'Nimesh Perera',
          'phone': '071 234 5678',
          'email': 'nimesh@gmail.com',
          'frequency': 'Regular',
          'total_visits': 8,
        },
        {
          'id': '2',
          'name': 'Sanjana Silva',
          'phone': '077 345 6789',
          'email': 'sanjana@gmail.com',
          'frequency': 'New',
          'total_visits': 1,
        },
        {
          'id': '3',
          'name': 'Kasun Fernando',
          'phone': '076 458 7890',
          'email': 'kasun@gmail.com',
          'frequency': 'VIP',
          'total_visits': 22,
        },
        {
          'id': '4',
          'name': 'Tharushi Jayasinghe',
          'phone': '071 987 8901',
          'email': 'tharushi@gmail.com',
          'frequency': 'Regular',
          'total_visits': 6,
        },
        {
          'id': '5',
          'name': 'Dilshan Amarasekara',
          'phone': '075 678 9012',
          'email': 'dilshan@gmail.com',
          'frequency': 'Occasional',
          'total_visits': 3,
        },
      ];
      _isLoading = false;
    });
  }

  Color _getFrequencyBadgeColor(String freq) {
    switch (freq.toLowerCase()) {
      case 'vip':
        return const Color(0xFFD4AF37); // Gold
      case 'regular':
        return const Color(0xFF10B981); // Emerald Green
      case 'new':
        return const Color(0xFF3B82F6); // Blue
      case 'occasional':
      default:
        return const Color(0xFFF59E0B); // Amber
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
          onPressed: () {
            if (context.canPop()) {
              context.pop();
            } else {
              context.go('/staff');
            }
          },
        ),
        centerTitle: true,
        title: const Text(
          'Customers',
          style: TextStyle(
            fontFamily: 'Playfair Display',
            fontSize: 22,
            fontWeight: FontWeight.w700,
            color: Color(0xFF1E1E1E),
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.add_circle_outline, color: primaryColor, size: 24),
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Add customer guest profile')),
              );
            },
          ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            // Search Input Field
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
              child: Container(
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: const Color(0xFFEBE5DF)),
                  boxShadow: [
                    BoxShadow(color: Colors.black.withValues(alpha: 0.02), blurRadius: 8, offset: const Offset(0, 3)),
                  ],
                ),
                child: TextField(
                  controller: _searchController,
                  onChanged: (val) => _fetchCustomers(search: val, frequency: _selectedFrequency),
                  decoration: const InputDecoration(
                    hintText: 'Search customer name or phone...',
                    hintStyle: TextStyle(fontSize: 13, color: Color(0xFF8C827A)),
                    prefixIcon: Icon(Icons.search, color: Color(0xFF8C827A), size: 20),
                    border: InputBorder.none,
                    contentPadding: EdgeInsets.symmetric(vertical: 14),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 14),

            // Frequency Filter Pills
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Row(
                children: _frequencies.map((f) {
                  final isSelected = _selectedFrequency == f;
                  return Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: InkWell(
                      onTap: () {
                        setState(() => _selectedFrequency = f);
                        _fetchCustomers(search: _searchController.text, frequency: f);
                      },
                      borderRadius: BorderRadius.circular(10),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                        decoration: BoxDecoration(
                          color: isSelected ? Colors.black : Colors.white,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(
                            color: isSelected ? Colors.black : const Color(0xFFEBE5DF),
                          ),
                        ),
                        child: Text(
                          f,
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                            color: isSelected ? Colors.white : const Color(0xFF8C827A),
                          ),
                        ),
                      ),
                    ),
                  );
                }).toList(),
              ),
            ),
            const SizedBox(height: 14),

            // Customer List
            Expanded(
              child: _isLoading
                  ? const Center(child: CircularProgressIndicator(color: primaryColor))
                  : _customers.isEmpty
                      ? const Center(
                          child: Text('No customers found', style: TextStyle(color: Color(0xFF8C827A))),
                        )
                      : ListView.separated(
                          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                          itemCount: _customers.length,
                          separatorBuilder: (_, _) => const SizedBox(height: 10),
                          itemBuilder: (context, index) {
                            final c = _customers[index];
                            final name = c['name'] ?? 'Guest';
                            final phone = c['phone'] ?? '';
                            final freq = (c['frequency'] ?? 'Regular').toString();
                            final badgeColor = _getFrequencyBadgeColor(freq);

                            return Container(
                              padding: const EdgeInsets.all(14),
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(16),
                                border: Border.all(color: const Color(0xFFEBE5DF)),
                                boxShadow: [
                                  BoxShadow(
                                    color: Colors.black.withValues(alpha: 0.02),
                                    blurRadius: 6,
                                    offset: const Offset(0, 2),
                                  ),
                                ],
                              ),
                              child: Row(
                                children: [
                                  // Avatar
                                  Container(
                                    width: 44,
                                    height: 44,
                                    decoration: BoxDecoration(
                                      shape: BoxShape.circle,
                                      color: const Color(0xFFF7F3EE),
                                      border: Border.all(color: const Color(0xFFEBE5DF)),
                                    ),
                                    child: const Icon(Icons.person_outline, color: primaryColor, size: 24),
                                  ),
                                  const SizedBox(width: 14),

                                  // Name & Details
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          name,
                                          style: const TextStyle(
                                            fontSize: 15,
                                            fontWeight: FontWeight.w700,
                                            color: Color(0xFF1E1E1E),
                                          ),
                                        ),
                                        const SizedBox(height: 2),
                                        Text(
                                          phone,
                                          style: const TextStyle(
                                            fontSize: 13,
                                            color: Color(0xFF8C827A),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),

                                  // Frequency Badge
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                    decoration: BoxDecoration(
                                      color: badgeColor.withValues(alpha: 0.12),
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    child: Text(
                                      freq,
                                      style: TextStyle(
                                        fontSize: 11,
                                        fontWeight: FontWeight.w700,
                                        color: badgeColor,
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  const Icon(Icons.chevron_right, color: Color(0xFFA59D95), size: 18),
                                ],
                              ),
                            );
                          },
                        ),
            ),
          ],
        ),
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import '../../services/api_service.dart';

class PartnerSyncScreen extends StatefulWidget {
  const PartnerSyncScreen({super.key});

  @override
  State<PartnerSyncScreen> createState() => _PartnerSyncScreenState();
}

class _PartnerSyncScreenState extends State<PartnerSyncScreen> {
  bool _liveSyncMaster = true;
  bool _isLoading = true;

  List<Map<String, dynamic>> _platforms = [
    {
      'id': 'bookme',
      'name': 'BookMe',
      'letter': 'B',
      'color': const Color(0xFFC48858),
      'enabled': true,
      'status': 'Live sync enabled',
    },
    {
      'id': 'reservelk',
      'name': 'Reserve.lk',
      'letter': 'R',
      'color': const Color(0xFFC48858),
      'enabled': true,
      'status': 'Live sync enabled',
    },
    {
      'id': 'dinehub',
      'name': 'DineHub',
      'letter': 'D',
      'color': const Color(0xFF8C827A),
      'enabled': false,
      'status': 'Not connected',
    },
  ];

  @override
  void initState() {
    super.initState();
    _fetchSyncStatus();
  }

  Future<void> _fetchSyncStatus() async {
    try {
      final res = await http.get(Uri.parse('${ApiService.baseUrl}/api/partners/sync'));
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        setState(() {
          _liveSyncMaster = data['live_sync_enabled'] ?? true;
          if (data['platforms'] != null) {
            final list = List<Map<String, dynamic>>.from(data['platforms']);
            _platforms = list.map((p) {
              return {
                'id': p['id'],
                'name': p['name'],
                'letter': (p['name'] as String).substring(0, 1),
                'color': (p['enabled'] == true) ? const Color(0xFFC48858) : const Color(0xFF8C827A),
                'enabled': p['enabled'] ?? false,
                'status': p['status'] ?? (p['enabled'] == true ? 'Live sync enabled' : 'Not connected'),
              };
            }).toList();
          }
          _isLoading = false;
        });
      } else {
        setState(() => _isLoading = false);
      }
    } catch (e) {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _toggleMaster(bool value) async {
    setState(() => _liveSyncMaster = value);
    try {
      await http.patch(
        Uri.parse('${ApiService.baseUrl}/api/partners/sync'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'live_sync_enabled': value}),
      );
    } catch (_) {}
  }

  Future<void> _togglePlatform(int index, bool value) async {
    setState(() {
      _platforms[index]['enabled'] = value;
      _platforms[index]['status'] = value ? 'Live sync enabled' : 'Not connected';
      _platforms[index]['color'] = value ? const Color(0xFFC48858) : const Color(0xFF8C827A);
    });

    try {
      await http.patch(
        Uri.parse('${ApiService.baseUrl}/api/partners/sync'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'platform_id': _platforms[index]['id'],
          'enabled': value,
        }),
      );
    } catch (_) {}
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
          'Share with Partners',
          style: TextStyle(
            fontFamily: 'Playfair Display',
            fontSize: 20,
            fontWeight: FontWeight.w700,
            color: Color(0xFF1E1E1E),
          ),
        ),
      ),
      body: SafeArea(
        child: _isLoading
            ? const Center(child: CircularProgressIndicator(color: primaryColor))
            : SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
              // LIVE AVAILABILITY SHARING Header
              const Text(
                'LIVE AVAILABILITY SHARING',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1.2,
                  color: Color(0xFF8C827A),
                ),
              ),
              const SizedBox(height: 12),

              // Master toggle card
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
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: const [
                          Text(
                            'Share Live Availability',
                            style: TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF1E1E1E),
                            ),
                          ),
                          SizedBox(height: 4),
                          Text(
                            'Sync availability with booking partners',
                            style: TextStyle(
                              fontSize: 12,
                              color: Color(0xFF8C827A),
                            ),
                          ),
                        ],
                      ),
                    ),
                    Switch(
                      value: _liveSyncMaster,
                      activeThumbColor: primaryColor,
                      onChanged: _toggleMaster,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 28),

              // CONNECTED PLATFORMS Header
              const Text(
                'CONNECTED PLATFORMS',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1.2,
                  color: Color(0xFF8C827A),
                ),
              ),
              const SizedBox(height: 12),

              // List of Connected Platforms
              Container(
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
                  children: _platforms.asMap().entries.map((entry) {
                    final idx = entry.key;
                    final item = entry.value;
                    final isLast = idx == _platforms.length - 1;

                    return Column(
                      children: [
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                          child: Row(
                            children: [
                              Container(
                                width: 36,
                                height: 36,
                                decoration: BoxDecoration(
                                  color: const Color(0xFFF7F3EE),
                                  borderRadius: BorderRadius.circular(10),
                                ),
                                alignment: Alignment.center,
                                child: Text(
                                  item['letter'],
                                  style: TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.w800,
                                    color: item['color'],
                                  ),
                                ),
                              ),
                              const SizedBox(width: 14),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      item['name'],
                                      style: const TextStyle(
                                        fontSize: 15,
                                        fontWeight: FontWeight.w700,
                                        color: Color(0xFF1E1E1E),
                                      ),
                                    ),
                                    const SizedBox(height: 2),
                                    Row(
                                      children: [
                                        Container(
                                          width: 6,
                                          height: 6,
                                          decoration: BoxDecoration(
                                            shape: BoxShape.circle,
                                            color: item['enabled']
                                                ? const Color(0xFF10B981)
                                                : const Color(0xFF94A3B8),
                                          ),
                                        ),
                                        const SizedBox(width: 6),
                                        Text(
                                          item['status'],
                                          style: TextStyle(
                                            fontSize: 12,
                                            fontWeight: FontWeight.w500,
                                            color: item['enabled']
                                                ? const Color(0xFF10B981)
                                                : const Color(0xFF8C827A),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ],
                                ),
                              ),
                              Switch(
                                value: _liveSyncMaster && item['enabled'],
                                activeThumbColor: primaryColor,
                                onChanged: _liveSyncMaster
                                    ? (val) => _togglePlatform(idx, val)
                                    : null,
                              ),
                            ],
                          ),
                        ),
                        if (!isLast) const Divider(height: 1, color: Color(0xFFF3ECE6)),
                      ],
                    );
                  }).toList(),
                ),
              ),
              const SizedBox(height: 28),

              // Manage Integrations Button
              SizedBox(
                width: double.infinity,
                height: 52,
                child: OutlinedButton(
                  onPressed: () {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        backgroundColor: primaryColor,
                        content: Text('Integration settings saved for BookMe, Reserve.lk & DineHub'),
                      ),
                    );
                  },
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: Color(0xFFD4CDC5), width: 1.2),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: const [
                      Icon(Icons.tune, color: Color(0xFF5A524C), size: 18),
                      SizedBox(width: 8),
                      Text(
                        'Manage Integrations',
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF5A524C),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 20),

              // Footer explanation
              const Center(
                child: Text(
                  'Partner sharing controls for live table availability.\nConnection and sync states update per platform.',
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
}

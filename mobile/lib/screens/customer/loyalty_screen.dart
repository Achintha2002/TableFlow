import 'dart:async';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../core/theme.dart';

class LoyaltyScreen extends StatefulWidget {
  const LoyaltyScreen({super.key});

  @override
  State<LoyaltyScreen> createState() => _LoyaltyScreenState();
}

class _LoyaltyScreenState extends State<LoyaltyScreen> {
  bool _isLoading = true;
  int _points = 0;
  String _tier = 'Bronze';
  StreamSubscription? _userSub;

  @override
  void initState() {
    super.initState();
    _fetchLoyaltyData();
    _listenToRealtime();
  }

  void _listenToRealtime() {
    final userId = Supabase.instance.client.auth.currentUser?.id;
    if (userId == null) return;
    
    // Listen to real-time updates (if enabled in DB)
    _userSub = Supabase.instance.client
        .from('users')
        .stream(primaryKey: ['id'])
        .eq('id', userId)
        .listen(
          (data) {
            if (data.isNotEmpty && mounted) {
              setState(() {
                _points = data.first['loyalty_points'] ?? 0;
                _tier = data.first['loyalty_tier'] ?? 'Bronze';
                _isLoading = false;
              });
            }
          },
          onError: (error) {
            debugPrint('LoyaltyScreen stream error: $error');
          },
        );
  }

  @override
  void dispose() {
    _userSub?.cancel();
    super.dispose();
  }

  Future<void> _fetchLoyaltyData() async {
    try {
      final userId = Supabase.instance.client.auth.currentUser?.id;
      if (userId == null) return;

      final data = await Supabase.instance.client
          .from('users')
          .select('loyalty_points, loyalty_tier')
          .eq('id', userId)
          .single();

      if (mounted) {
        setState(() {
          _points = data['loyalty_points'] ?? 0;
          _tier = data['loyalty_tier'] ?? 'Bronze';
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  double _calculateProgress() {
    if (_tier == 'Bronze') return _points / 500;
    if (_tier == 'Silver') return (_points - 500) / 1500;
    if (_tier == 'Gold') return (_points - 2000) / 3000;
    return 1.0; // Platinum
  }

  String _nextTierName() {
    if (_tier == 'Bronze') return 'Silver';
    if (_tier == 'Silver') return 'Gold';
    if (_tier == 'Gold') return 'Platinum';
    return 'Max Tier';
  }

  int _pointsToNextTier() {
    if (_tier == 'Bronze') return 500 - _points;
    if (_tier == 'Silver') return 2000 - _points;
    if (_tier == 'Gold') return 5000 - _points;
    return 0;
  }

  Color _getTierColor() {
    if (_tier == 'Bronze') return const Color(0xFFCD7F32);
    if (_tier == 'Silver') return const Color(0xFFC0C0C0);
    if (_tier == 'Gold') return const Color(0xFFFFD700);
    return const Color(0xFFE5E4E2); // Platinum
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios, color: AppTheme.secondary),
          onPressed: () => context.pop(),
        ),
        title: Text(
          'TableFlow Rewards',
          style: Theme.of(context).textTheme.titleLarge?.copyWith(
            fontFamily: 'Playfair Display',
            fontWeight: FontWeight.bold,
          ),
        ),
        centerTitle: true,
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _fetchLoyaltyData,
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(24),
                child: Column(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  const SizedBox(height: 20),
                  Container(
                    width: 140,
                    height: 140,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: _getTierColor().withValues(alpha: 0.1),
                      border: Border.all(color: _getTierColor(), width: 4),
                      boxShadow: [
                        BoxShadow(
                          color: _getTierColor().withValues(alpha: 0.3),
                          blurRadius: 30,
                          spreadRadius: 5,
                        ),
                      ],
                    ),
                    child: Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.star, color: _getTierColor(), size: 40),
                          const SizedBox(height: 4),
                          Text(
                            _tier,
                            style: TextStyle(
                              color: _getTierColor(),
                              fontWeight: FontWeight.bold,
                              fontSize: 18,
                            ),
                          )
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 40),
                  Text(
                    '$_points',
                    style: const TextStyle(
                      fontSize: 48,
                      fontWeight: FontWeight.bold,
                      fontFamily: 'Playfair Display',
                    ),
                  ),
                  const Text(
                    'Total Points',
                    style: TextStyle(
                      color: Colors.grey,
                      fontSize: 16,
                      letterSpacing: 1.2,
                    ),
                  ),
                  const SizedBox(height: 40),
                  if (_tier != 'Platinum') ...[
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(_tier, style: const TextStyle(fontWeight: FontWeight.bold)),
                        Text(_nextTierName(), style: const TextStyle(fontWeight: FontWeight.bold)),
                      ],
                    ),
                    const SizedBox(height: 12),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(10),
                      child: LinearProgressIndicator(
                        value: _calculateProgress().clamp(0.0, 1.0),
                        minHeight: 12,
                        backgroundColor: Colors.grey.shade200,
                        valueColor: AlwaysStoppedAnimation<Color>(_getTierColor()),
                      ),
                    ),
                    const SizedBox(height: 16),
                    Text(
                      '${_pointsToNextTier()} points away from ${_nextTierName()}',
                      style: TextStyle(color: Colors.grey.shade600),
                    ),
                  ] else ...[
                    const Text(
                      'You have reached the highest tier!',
                      style: TextStyle(fontWeight: FontWeight.bold, color: Colors.green),
                    ),
                  ],
                  const SizedBox(height: 40),
                  const Divider(),
                  const SizedBox(height: 20),
                  const Align(
                    alignment: Alignment.centerLeft,
                    child: Text(
                      'How it works',
                      style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                    ),
                  ),
                  const SizedBox(height: 16),
                  _buildRuleRow('Earn 1 point for every 100 LKR spent.'),
                  _buildRuleRow('Silver (500 pts) - Free drink every month.'),
                  _buildRuleRow('Gold (2000 pts) - 10% off on all orders.'),
                  _buildRuleRow('Platinum (5000 pts) - Priority booking & 20% off.'),
                ],
              ),
            ),
          ),
    );
  }

  Widget _buildRuleRow(String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12.0),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.check_circle_outline, color: AppTheme.primary, size: 20),
          const SizedBox(width: 12),
          Expanded(child: Text(text, style: const TextStyle(fontSize: 15, height: 1.4))),
        ],
      ),
    );
  }
}

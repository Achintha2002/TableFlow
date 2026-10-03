import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/theme.dart';
import '../../services/api_service.dart';
import '../../services/supabase_service.dart';
import '../../widgets/guest_placeholder.dart';

class MyVouchersScreen extends StatefulWidget {
  const MyVouchersScreen({super.key});

  @override
  State<MyVouchersScreen> createState() => _MyVouchersScreenState();
}

class _MyVouchersScreenState extends State<MyVouchersScreen> {
  int _selectedTabIndex = 1; // 0: My Wallet, 1: Earn 10% Tasks
  bool _isLoading = true;
  String _loyaltyTier = 'Silver';
  List<Map<String, dynamic>> _vouchers = [];
  List<Map<String, dynamic>> _tasks = [];
  String? _claimingTaskKey;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    final user = SupabaseService.client.auth.currentUser;
    if (user == null) {
      if (mounted) setState(() => _isLoading = false);
      return;
    }

    try {
      final profile = await SupabaseService.getUserProfile();
      final tier = profile?['loyalty_tier'] ?? 'Silver';

      final vouchers = await ApiService.fetchMyVouchers();
      final tasks = await ApiService.fetchMyTasks();

      if (mounted) {
        setState(() {
          _loyaltyTier = tier;
          _vouchers = vouchers;
          _tasks = tasks.isNotEmpty ? tasks : _getDefaultTasks();
          _isLoading = false;
        });
      }
    } catch (e) {
      debugPrint('Error loading vouchers & tasks: $e');
      if (mounted) {
        setState(() {
          _tasks = _getDefaultTasks();
          _isLoading = false;
        });
      }
    }
  }

  List<Map<String, dynamic>> _getDefaultTasks() {
    return [
      {
        'task_key': 'dine_3_orders',
        'title': 'Dine-In Explorer',
        'description': 'Enjoy 3 served dine-in meals at TableFlow to unlock your reward.',
        'target_progress': 3,
        'current_progress': 0,
        'reward_discount_percent': 10,
        'is_completed': false,
        'is_claimed': false,
      },
      {
        'task_key': 'weekday_booking',
        'title': 'Weekday Gourmet',
        'description': 'Book and complete a dining reservation between Monday and Thursday.',
        'target_progress': 1,
        'current_progress': 0,
        'reward_discount_percent': 10,
        'is_completed': false,
        'is_claimed': false,
      },
      {
        'task_key': 'chef_special',
        'title': "Chef's Signature Fan",
        'description': "Experience any handcrafted signature creation from our Chef's Special menu.",
        'target_progress': 1,
        'current_progress': 0,
        'reward_discount_percent': 10,
        'is_completed': false,
        'is_claimed': false,
      },
    ];
  }

  Future<void> _claimReward(String taskKey, String title) async {
    setState(() => _claimingTaskKey = taskKey);
    try {
      HapticFeedback.heavyImpact();
      final result = await ApiService.claimTaskReward(taskKey);
      final voucherCode = result['voucher_code'] ?? 'TASK10-CLAIMED';

      if (mounted) {
        _showSuccessCelebrationDialog(voucherCode, title);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to claim: ${e.toString().replaceAll("Exception: ", "")}'),
            backgroundColor: const Color(0xFFDC2626),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _claimingTaskKey = null);
    }
  }

  void _showSuccessCelebrationDialog(String voucherCode, String title) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF1E1B18),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(24),
          side: const BorderSide(color: Color(0xFFD4AF37), width: 1.5),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 70,
              height: 70,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: const RadialGradient(
                  colors: [Color(0xFFFDE68A), Color(0xFFD97706)],
                ),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFFD4AF37).withValues(alpha: 0.4),
                    blurRadius: 20,
                    spreadRadius: 2,
                  ),
                ],
              ),
              child: const Icon(Icons.celebration, color: Colors.black87, size: 36),
            ),
            const SizedBox(height: 18),
            Text(
              '10% Voucher Unlocked!',
              style: GoogleFonts.playfairDisplay(
                fontSize: 22,
                fontWeight: FontWeight.bold,
                color: const Color(0xFFFDFBF7),
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Bravo! You conquered the "$title" challenge.',
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 13, color: Colors.white70),
            ),
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
              decoration: BoxDecoration(
                color: const Color(0xFF2A241F),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: const Color(0xFFD4AF37).withValues(alpha: 0.6)),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    voucherCode,
                    style: const TextStyle(
                      fontFamily: 'monospace',
                      fontSize: 18,
                      fontWeight: FontWeight.w900,
                      letterSpacing: 2,
                      color: Color(0xFFF59E0B),
                    ),
                  ),
                  const SizedBox(width: 10),
                  InkWell(
                    onTap: () => _copyVoucherCode(voucherCode),
                    child: const Icon(Icons.copy, color: Color(0xFFF59E0B), size: 18),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 22),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFD4AF37),
                  foregroundColor: const Color(0xFF1E1B18),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  elevation: 0,
                ),
                onPressed: () {
                  Navigator.pop(ctx);
                  _loadData();
                  setState(() => _selectedTabIndex = 0);
                },
                child: const Text('View in My Wallet', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _copyVoucherCode(String code) {
    Clipboard.setData(ClipboardData(text: code));
    HapticFeedback.lightImpact();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Row(
          children: [
            const Icon(Icons.check_circle, color: Color(0xFF10B981), size: 18),
            const SizedBox(width: 8),
            Text('Voucher "$code" copied to clipboard!'),
          ],
        ),
        backgroundColor: const Color(0xFF1E293B),
        behavior: SnackBarBehavior.floating,
        duration: const Duration(seconds: 2),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final user = SupabaseService.client.auth.currentUser;

    return Scaffold(
      backgroundColor: const Color(0xFFF8F6F2),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0,
        leading: Padding(
          padding: const EdgeInsets.only(left: 12.0),
          child: Center(
            child: InkWell(
              borderRadius: BorderRadius.circular(12),
              onTap: () => context.pop(),
              child: Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.05),
                      blurRadius: 8,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
                child: const Icon(Icons.arrow_back_ios_new, color: AppTheme.secondary, size: 16),
              ),
            ),
          ),
        ),
        title: Column(
          children: [
            Text(
              'My Vouchers & Rewards',
              style: GoogleFonts.playfairDisplay(
                color: AppTheme.secondary,
                fontWeight: FontWeight.bold,
                fontSize: 18,
              ),
            ),
            const SizedBox(height: 2),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(
                color: const Color(0xFFD4AF37).withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Text(
                '★ VIP PRIVILEGE HUB',
                style: TextStyle(
                  color: Color(0xFFB45309),
                  fontSize: 9,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 1,
                ),
              ),
            ),
          ],
        ),
        centerTitle: true,
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 12.0),
            child: InkWell(
              borderRadius: BorderRadius.circular(12),
              onTap: () {
                setState(() => _isLoading = true);
                _loadData();
              },
              child: Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.05),
                      blurRadius: 8,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
                child: const Icon(Icons.refresh, color: AppTheme.secondary, size: 18),
              ),
            ),
          ),
        ],
      ),
      body: user == null
          ? GuestPlaceholder(
              title: 'Exclusive Dining Vouchers',
              description: 'Sign in to access your Silver member vouchers and earn 10% discount rewards.',
              icon: Icons.confirmation_number_outlined,
              onSignedIn: _loadData,
            )
          : _isLoading
              ? const Center(child: CircularProgressIndicator(color: AppTheme.primary))
              // SINGLE SMOOTH VERTICAL SCROLL: 100% FIXED HORIZONTALLY, ZERO SWAYING!
              : SingleChildScrollView(
                  physics: const BouncingScrollPhysics(parent: AlwaysScrollableScrollPhysics()),
                  child: Column(
                    children: [
                      // Ultra-Luxury VIP Hero Card
                      _buildHeroPrivilegeCard(),

                      // Luxury Segmented Tab Bar (Rock-solid tap toggle)
                      _buildSegmentedTabBar(),

                      // Selected Tab Content (Unified vertical layout)
                      AnimatedSwitcher(
                        duration: const Duration(milliseconds: 200),
                        child: _selectedTabIndex == 0
                            ? KeyedSubtree(
                                key: const ValueKey('tab_vouchers'),
                                child: _buildVouchersTab(),
                              )
                            : KeyedSubtree(
                                key: const ValueKey('tab_tasks'),
                                child: _buildTasksTab(),
                              ),
                      ),
                      const SizedBox(height: 36),
                    ],
                  ),
                ),
    );
  }

  // ─────────────────────────────────────────────────────────────
  // 1. ULTRA-LUXURY VIP PRIVILEGE HERO CARD
  // ─────────────────────────────────────────────────────────────
  Widget _buildHeroPrivilegeCard() {
    final isSilver = ['Silver', 'Gold', 'Platinum'].contains(_loyaltyTier);

    return Padding(
      padding: const EdgeInsets.fromLTRB(18, 8, 18, 6),
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(22),
          gradient: const LinearGradient(
            colors: [
              Color(0xFF1C1917), // Deep Obsidian
              Color(0xFF2C241F), // Rich Espresso Bronze
              Color(0xFF1E1A17), // Deep Dark Wood
            ],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          border: Border.all(
            color: const Color(0xFFD4AF37).withValues(alpha: 0.6),
            width: 1.2,
          ),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFF000000).withValues(alpha: 0.18),
              blurRadius: 18,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        child: Stack(
          children: [
            // Background luxury watermark ring
            Positioned(
              right: -25,
              top: -25,
              child: Container(
                width: 140,
                height: 140,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: const Color(0xFFD4AF37).withValues(alpha: 0.08),
                    width: 20,
                  ),
                ),
              ),
            ),

            Padding(
              padding: const EdgeInsets.all(18.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      // Golden Crown/Star Emblem
                      Container(
                        width: 44,
                        height: 44,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          gradient: const LinearGradient(
                            colors: [Color(0xFFFDE68A), Color(0xFFD4AF37)],
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: const Color(0xFFD4AF37).withValues(alpha: 0.35),
                              blurRadius: 10,
                              offset: const Offset(0, 3),
                            ),
                          ],
                        ),
                        child: const Icon(
                          Icons.workspace_premium_rounded,
                          color: Color(0xFF3A2E28),
                          size: 26,
                        ),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Text(
                                  '$_loyaltyTier Elite Diner',
                                  style: GoogleFonts.playfairDisplay(
                                    color: const Color(0xFFFDFBF7),
                                    fontWeight: FontWeight.bold,
                                    fontSize: 16,
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                                  decoration: BoxDecoration(
                                    gradient: const LinearGradient(
                                      colors: [Color(0xFFF59E0B), Color(0xFFD97706)],
                                    ),
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: const Text(
                                    '10% PERK',
                                    style: TextStyle(
                                      color: Colors.white,
                                      fontSize: 9,
                                      fontWeight: FontWeight.w900,
                                      letterSpacing: 0.5,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 2),
                            Text(
                              isSilver
                                  ? 'Active Member Benefits & Guaranteed 10% Savings'
                                  : 'Earn loyalty points to unlock 10% member discounts',
                              style: TextStyle(
                                color: Colors.white.withValues(alpha: 0.7),
                                fontSize: 11,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),

                  const SizedBox(height: 14),

                  // Interactive Quick-Voucher Coupon Ribbon
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.06),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: const Color(0xFFD4AF37).withValues(alpha: 0.3),
                      ),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.local_activity_outlined, color: Color(0xFFF59E0B), size: 18),
                        const SizedBox(width: 10),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'SILVER WELCOME CODE',
                              style: TextStyle(
                                color: Colors.white54,
                                fontSize: 9,
                                fontWeight: FontWeight.bold,
                                letterSpacing: 0.8,
                              ),
                            ),
                            Row(
                              children: [
                                const Text(
                                  'WELCOME10',
                                  style: TextStyle(
                                    fontFamily: 'monospace',
                                    color: Color(0xFFFDE68A),
                                    fontWeight: FontWeight.w900,
                                    fontSize: 14,
                                    letterSpacing: 1.5,
                                  ),
                                ),
                                const SizedBox(width: 6),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFF10B981).withValues(alpha: 0.2),
                                    borderRadius: BorderRadius.circular(4),
                                  ),
                                  child: const Text(
                                    '10% OFF',
                                    style: TextStyle(color: Color(0xFF10B981), fontSize: 9, fontWeight: FontWeight.bold),
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                        const Spacer(),
                        InkWell(
                          onTap: () => _copyVoucherCode('WELCOME10'),
                          borderRadius: BorderRadius.circular(8),
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                            decoration: BoxDecoration(
                              color: const Color(0xFFD4AF37).withValues(alpha: 0.2),
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(color: const Color(0xFFD4AF37).withValues(alpha: 0.5)),
                            ),
                            child: const Row(
                              children: [
                                Icon(Icons.copy, color: Color(0xFFFDE68A), size: 12),
                                SizedBox(width: 4),
                                Text(
                                  'Copy',
                                  style: TextStyle(
                                    color: Color(0xFFFDE68A),
                                    fontWeight: FontWeight.bold,
                                    fontSize: 11,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ─────────────────────────────────────────────────────────────
  // 2. LUXURY SEGMENTED TAB BAR (100% FIXED & STABLE)
  // ─────────────────────────────────────────────────────────────
  Widget _buildSegmentedTabBar() {
    return Container(
      margin: const EdgeInsets.fromLTRB(18, 10, 18, 10),
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE5E7EB)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Row(
        children: [
          // Tab 0: My Wallet
          Expanded(
            child: InkWell(
              borderRadius: BorderRadius.circular(12),
              onTap: () {
                HapticFeedback.selectionClick();
                setState(() => _selectedTabIndex = 0);
              },
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                height: 42,
                decoration: BoxDecoration(
                  color: _selectedTabIndex == 0 ? const Color(0xFF3A2E28) : Colors.transparent,
                  borderRadius: BorderRadius.circular(12),
                  boxShadow: _selectedTabIndex == 0
                      ? [
                          BoxShadow(
                            color: const Color(0xFF3A2E28).withValues(alpha: 0.25),
                            blurRadius: 8,
                            offset: const Offset(0, 3),
                          ),
                        ]
                      : null,
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      Icons.confirmation_number_outlined,
                      size: 16,
                      color: _selectedTabIndex == 0 ? const Color(0xFFFDE68A) : const Color(0xFF64748B),
                    ),
                    const SizedBox(width: 6),
                    Text(
                      'My Wallet (${_vouchers.length})',
                      style: TextStyle(
                        fontWeight: _selectedTabIndex == 0 ? FontWeight.w800 : FontWeight.w600,
                        fontSize: 13,
                        color: _selectedTabIndex == 0 ? const Color(0xFFFDE68A) : const Color(0xFF64748B),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),

          // Tab 1: Earn 10% Tasks
          Expanded(
            child: InkWell(
              borderRadius: BorderRadius.circular(12),
              onTap: () {
                HapticFeedback.selectionClick();
                setState(() => _selectedTabIndex = 1);
              },
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                height: 42,
                decoration: BoxDecoration(
                  color: _selectedTabIndex == 1 ? const Color(0xFF3A2E28) : Colors.transparent,
                  borderRadius: BorderRadius.circular(12),
                  boxShadow: _selectedTabIndex == 1
                      ? [
                          BoxShadow(
                            color: const Color(0xFF3A2E28).withValues(alpha: 0.25),
                            blurRadius: 8,
                            offset: const Offset(0, 3),
                          ),
                        ]
                      : null,
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      Icons.auto_awesome,
                      size: 15,
                      color: _selectedTabIndex == 1 ? const Color(0xFFFDE68A) : const Color(0xFFD4AF37),
                    ),
                    const SizedBox(width: 6),
                    Text(
                      'Earn 10% Tasks',
                      style: TextStyle(
                        fontWeight: _selectedTabIndex == 1 ? FontWeight.w800 : FontWeight.w600,
                        fontSize: 13,
                        color: _selectedTabIndex == 1 ? const Color(0xFFFDE68A) : const Color(0xFF64748B),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ─────────────────────────────────────────────────────────────
  // 3. TAB 1: LUXURY PERFORATED TICKET WALLET
  // ─────────────────────────────────────────────────────────────
  Widget _buildVouchersTab() {
    if (_vouchers.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 80,
                height: 80,
                decoration: BoxDecoration(
                  color: Colors.white,
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.05),
                      blurRadius: 16,
                      offset: const Offset(0, 6),
                    ),
                  ],
                ),
                child: const Icon(Icons.discount_outlined, size: 38, color: Color(0xFFB87F5C)),
              ),
              const SizedBox(height: 20),
              Text(
                'No Vouchers in Wallet',
                style: GoogleFonts.playfairDisplay(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                  color: AppTheme.secondary,
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'Complete dining challenges in the "Earn 10% Tasks" tab to unlock exclusive dining vouchers!',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 13, color: Color(0xFF64748B), height: 1.4),
              ),
              const SizedBox(height: 22),
              ElevatedButton.icon(
                onPressed: () => setState(() => _selectedTabIndex = 1),
                icon: const Icon(Icons.flash_on_rounded, size: 16),
                label: const Text('Explore Challenges (Earn 10%)', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.primary,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 12),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  elevation: 2,
                ),
              ),
            ],
          ),
        ),
      );
    }

    return ListView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 6),
      itemCount: _vouchers.length,
      itemBuilder: (context, index) {
        final voucher = _vouchers[index];
        final code = voucher['code'] ?? '';
        final disc = voucher['discount_percent'] ?? 10;
        final desc = voucher['description'] ?? 'Exclusive TableFlow Member Voucher';
        final isSilver = voucher['source'] == 'silver_tier_welcome' || code == 'WELCOME10';

        return Container(
          margin: const EdgeInsets.only(bottom: 16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(
              color: isSilver ? const Color(0xFFD4AF37).withValues(alpha: 0.6) : const Color(0xFFE2E8F0),
              width: 1.2,
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.04),
                blurRadius: 12,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Column(
            children: [
              // Ticket Header & Body
              Padding(
                padding: const EdgeInsets.all(16.0),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    // Coupon Discount Stamped Seal
                    Container(
                      width: 72,
                      height: 72,
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: isSilver
                              ? [const Color(0xFFFEF3C7), const Color(0xFFFDE68A)]
                              : [const Color(0xFFE0E7FF), const Color(0xFFC7D2FE)],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(
                          color: isSilver ? const Color(0xFFF59E0B) : const Color(0xFF818CF8),
                          width: 1,
                        ),
                      ),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(
                            '$disc%',
                            style: TextStyle(
                              fontSize: 22,
                              fontWeight: FontWeight.w900,
                              color: isSilver ? const Color(0xFF92400E) : const Color(0xFF3730A3),
                              height: 1,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            'OFF',
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w900,
                              letterSpacing: 1,
                              color: isSilver ? const Color(0xFFB45309) : const Color(0xFF4338CA),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 14),

                    // Details & Code
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Text(
                                code,
                                style: const TextStyle(
                                  fontFamily: 'monospace',
                                  fontSize: 16,
                                  fontWeight: FontWeight.w900,
                                  letterSpacing: 1.2,
                                  color: AppTheme.secondary,
                                ),
                              ),
                              const Spacer(),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                                decoration: BoxDecoration(
                                  color: isSilver
                                      ? const Color(0xFFFEF3C7)
                                      : const Color(0xFFD1FAE5),
                                  borderRadius: BorderRadius.circular(6),
                                ),
                                child: Text(
                                  isSilver ? '★ Silver Gift' : '⚡ Task Reward',
                                  style: TextStyle(
                                    color: isSilver ? const Color(0xFFB45309) : const Color(0xFF065F46),
                                    fontSize: 10,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 4),
                          Text(
                            desc,
                            style: const TextStyle(fontSize: 12, color: Color(0xFF64748B), height: 1.3),
                          ),
                          const SizedBox(height: 6),
                          const Row(
                            children: [
                              Icon(Icons.verified_outlined, size: 13, color: Color(0xFF10B981)),
                              SizedBox(width: 4),
                              Text(
                                'Dine-In & Takeaway Valid',
                                style: TextStyle(fontSize: 11, color: Color(0xFF10B981), fontWeight: FontWeight.w600),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),

              // Realistic Perforated Ticket Divider
              Row(
                children: [
                  Container(
                    width: 12,
                    height: 24,
                    decoration: const BoxDecoration(
                      color: Color(0xFFF8F6F2),
                      borderRadius: BorderRadius.only(
                        topRight: Radius.circular(12),
                        bottomRight: Radius.circular(12),
                      ),
                    ),
                  ),
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 6),
                      child: LayoutBuilder(
                        builder: (context, constraints) {
                          const dashWidth = 5.0;
                          const dashSpace = 4.0;
                          final count = (constraints.maxWidth / (dashWidth + dashSpace)).floor();
                          return Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: List.generate(count, (_) {
                              return const SizedBox(
                                width: dashWidth,
                                height: 1,
                                child: DecoratedBox(
                                  decoration: BoxDecoration(color: Color(0xFFCBD5E1)),
                                ),
                              );
                            }),
                          );
                        },
                      ),
                    ),
                  ),
                  Container(
                    width: 12,
                    height: 24,
                    decoration: const BoxDecoration(
                      color: Color(0xFFF8F6F2),
                      borderRadius: BorderRadius.only(
                        topLeft: Radius.circular(12),
                        bottomLeft: Radius.circular(12),
                      ),
                    ),
                  ),
                ],
              ),

              // Bottom Actions Bar
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 6, 16, 12),
                child: Row(
                  children: [
                    InkWell(
                      onTap: () => _copyVoucherCode(code),
                      borderRadius: BorderRadius.circular(8),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF1F5F9),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Row(
                          children: [
                            Icon(Icons.copy, size: 14, color: Color(0xFF475569)),
                            SizedBox(width: 4),
                            Text(
                              'Copy Code',
                              style: TextStyle(
                                color: Color(0xFF475569),
                                fontSize: 12,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const Spacer(),
                    ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF3A2E28),
                        foregroundColor: const Color(0xFFFDE68A),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 8),
                        elevation: 0,
                      ),
                      onPressed: () {
                        context.push('/cart', extra: {'applied_coupon': code});
                      },
                      child: const Row(
                        children: [
                          Text('Use in Cart', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                          SizedBox(width: 4),
                          Icon(Icons.arrow_forward_rounded, size: 14),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  // ─────────────────────────────────────────────────────────────
  // 4. TAB 2: GAMIFIED VIP QUEST HUB ("EARN 10% TASKS")
  // ─────────────────────────────────────────────────────────────
  Widget _buildTasksTab() {
    return ListView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 6),
      itemCount: _tasks.length,
      itemBuilder: (context, index) {
        final task = _tasks[index];
        final taskKey = task['task_key'] ?? '';
        final title = task['title'] ?? 'Dining Quest';
        final desc = task['description'] ?? '';
        final current = task['current_progress'] ?? 0;
        final target = task['target_progress'] ?? 1;
        final isCompleted = task['is_completed'] ?? false;
        final isClaimed = task['is_claimed'] ?? false;
        final isClaiming = _claimingTaskKey == taskKey;

        final double progressRatio = target > 0 ? (current / target).clamp(0.0, 1.0) : 0.0;

        // Custom task iconography
        IconData taskIcon = Icons.restaurant_menu;
        Color accentColor = const Color(0xFFD4AF37);
        if (taskKey == 'weekday_booking') {
          taskIcon = Icons.calendar_month_rounded;
          accentColor = const Color(0xFF3B82F6);
        } else if (taskKey == 'chef_special') {
          taskIcon = Icons.local_fire_department_rounded;
          accentColor = const Color(0xFFF59E0B);
        } else {
          taskIcon = Icons.dining_rounded;
          accentColor = const Color(0xFF10B981);
        }

        return Container(
          margin: const EdgeInsets.only(bottom: 16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: isCompleted && !isClaimed
                  ? const Color(0xFF10B981)
                  : const Color(0xFFE2E8F0),
              width: isCompleted && !isClaimed ? 1.8 : 1.0,
            ),
            boxShadow: [
              BoxShadow(
                color: isCompleted && !isClaimed
                    ? const Color(0xFF10B981).withValues(alpha: 0.12)
                    : Colors.black.withValues(alpha: 0.03),
                blurRadius: 14,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Padding(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Header with Themed Icon & 10% OFF Badge
                Row(
                  children: [
                    Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        color: accentColor.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: Icon(taskIcon, color: accentColor, size: 24),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Text(
                                title,
                                style: GoogleFonts.playfairDisplay(
                                  fontSize: 16,
                                  fontWeight: FontWeight.bold,
                                  color: AppTheme.secondary,
                                ),
                              ),
                              if (isCompleted && !isClaimed) ...[
                                const SizedBox(width: 6),
                                const Icon(Icons.check_circle, color: Color(0xFF10B981), size: 16),
                              ],
                            ],
                          ),
                          const SizedBox(height: 2),
                          Text(
                            desc,
                            style: const TextStyle(fontSize: 12, color: Color(0xFF64748B), height: 1.3),
                          ),
                        ],
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [Color(0xFFFEF3C7), Color(0xFFFDE68A)],
                        ),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: const Color(0xFFF59E0B).withValues(alpha: 0.4)),
                      ),
                      child: const Text(
                        '🎟️ 10% OFF',
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w900,
                          color: Color(0xFF92400E),
                        ),
                      ),
                    ),
                  ],
                ),

                const SizedBox(height: 16),

                // Gamified Multi-Step Milestones
                if (target > 1) ...[
                  Row(
                    children: List.generate(target, (i) {
                      final stepNum = i + 1;
                      final isStepDone = current >= stepNum;
                      return Expanded(
                        child: Row(
                          children: [
                            Container(
                              width: 26,
                              height: 26,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: isStepDone
                                    ? const Color(0xFF10B981)
                                    : const Color(0xFFF1F5F9),
                                border: Border.all(
                                  color: isStepDone
                                      ? const Color(0xFF10B981)
                                      : const Color(0xFFCBD5E1),
                                ),
                              ),
                              child: Center(
                                child: isStepDone
                                    ? const Icon(Icons.check, size: 15, color: Colors.white)
                                    : Text(
                                        '$stepNum',
                                        style: const TextStyle(
                                          fontSize: 11,
                                          fontWeight: FontWeight.bold,
                                          color: Color(0xFF64748B),
                                        ),
                                      ),
                              ),
                            ),
                            if (i < target - 1)
                              Expanded(
                                child: Container(
                                  height: 3,
                                  color: isStepDone
                                      ? const Color(0xFF10B981)
                                      : const Color(0xFFE2E8F0),
                                ),
                              ),
                          ],
                        ),
                      );
                    }),
                  ),
                  const SizedBox(height: 12),
                ] else ...[
                  // Single milestone progress bar
                  ClipRRect(
                    borderRadius: BorderRadius.circular(8),
                    child: LinearProgressIndicator(
                      value: progressRatio,
                      backgroundColor: const Color(0xFFF1F5F9),
                      valueColor: AlwaysStoppedAnimation<Color>(
                        isCompleted ? const Color(0xFF10B981) : AppTheme.primary,
                      ),
                      minHeight: 8,
                    ),
                  ),
                  const SizedBox(height: 10),
                ],

                // Footer Status & Interactive Action Button
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        Icon(
                          isCompleted ? Icons.celebration : Icons.timelapse_rounded,
                          size: 14,
                          color: isCompleted ? const Color(0xFF10B981) : const Color(0xFF94A3B8),
                        ),
                        const SizedBox(width: 4),
                        Text(
                          isCompleted
                              ? 'Goal Achieved ($current/$target)'
                              : 'Progress: $current / $target completed',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                            color: isCompleted ? const Color(0xFF059669) : const Color(0xFF64748B),
                          ),
                        ),
                      ],
                    ),
                    if (isClaimed)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF1F5F9),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: const Color(0xFFCBD5E1)),
                        ),
                        child: const Row(
                          children: [
                            Icon(Icons.check, size: 12, color: Color(0xFF64748B)),
                            SizedBox(width: 4),
                            Text(
                              'Claimed to Wallet',
                              style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF64748B)),
                            ),
                          ],
                        ),
                      )
                    else if (isCompleted)
                      ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF10B981),
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                          elevation: 3,
                          shadowColor: const Color(0xFF10B981).withValues(alpha: 0.5),
                        ),
                        onPressed: isClaiming ? null : () => _claimReward(taskKey, title),
                        child: isClaiming
                            ? const SizedBox(
                                width: 14,
                                height: 14,
                                child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                              )
                            : const Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(Icons.card_giftcard, size: 14),
                                  SizedBox(width: 5),
                                  Text('Claim 10% Reward', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                                ],
                              ),
                      )
                    else
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF1F5F9),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: const Text(
                          'In Progress',
                          style: TextStyle(fontSize: 11, color: Color(0xFF94A3B8), fontWeight: FontWeight.w600),
                        ),
                      ),
                  ],
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../core/theme.dart';
import '../../services/supabase_service.dart';
import '../../utils/auth_guard.dart';
import 'package:provider/provider.dart';
import '../../providers/cart_provider.dart';
import '../../widgets/call_waiter_sheet.dart';
import '../../widgets/active_order_card.dart';
import '../../widgets/safe_backdrop_filter.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  String _firstName = '';
  bool _isFirstVisit = false;

  @override
  void initState() {
    super.initState();
    _fetchUserData();
  }

  Future<void> _fetchUserData() async {
    try {
      final profile = await SupabaseService.getUserProfile();
      if (mounted) {
        final fullName = profile?['full_name'] as String? ?? '';

        // Per-user first-visit check using their Supabase user ID
        final userId = Supabase.instance.client.auth.currentUser?.id ?? 'guest';
        final prefKey = 'home_visited_$userId';
        final prefs = await SharedPreferences.getInstance();
        final hasVisited = prefs.getBool(prefKey) ?? false;

        if (!hasVisited) {
          await prefs.setBool(prefKey, true);
        }

        if (mounted) {
          setState(() {
            _firstName = fullName.split(' ').first;
            _isFirstVisit = !hasVisited;
          });
        }
      }
    } catch (e) {
      // ignore
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _buildHeroSection(),
            const ActiveOrderCard(),
            const SizedBox(height: 16),
            _buildQuickActions(),
            const SizedBox(height: 32),
            _buildFeaturedSection(),
            const SizedBox(height: 120), // Increased to prevent overlap with the floating bottom navigation bar
          ],
        ),
      ),
    );
  }

  Widget _buildHeroSection() {
    final greeting = _firstName.isNotEmpty
        ? (_isFirstVisit ? 'Welcome, $_firstName' : 'Welcome back, $_firstName')
        : 'Welcome to TableFlow';

    return Container(
      constraints: const BoxConstraints(minHeight: 340),
      decoration: const BoxDecoration(
        color: AppTheme.secondary,
        borderRadius: BorderRadius.only(
          bottomLeft: Radius.circular(40),
          bottomRight: Radius.circular(40),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black26,
            blurRadius: 20,
            offset: Offset(0, 10),
          ),
        ],
        image: DecorationImage(
          image: NetworkImage(
            'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?q=80&w=1000&auto=format&fit=crop',
          ), // Elegant restaurant interior
          fit: BoxFit.cover,
        ),
      ),
      child: ClipRRect(
        borderRadius: const BorderRadius.only(
          bottomLeft: Radius.circular(40),
          bottomRight: Radius.circular(40),
        ),
        child: Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [
                Colors.transparent,
                AppTheme.secondary.withValues(alpha: 0.7),
              ],
            ),
          ),
          padding: const EdgeInsets.all(24.0),
          alignment: Alignment.bottomLeft,
          child: SizedBox(
            width: double.infinity,
            child: ClipRRect(
              borderRadius: BorderRadius.circular(20),
              child: SafeBackdropFilter(
                sigmaX: 12,
                sigmaY: 12,
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 24,
                    vertical: 20,
                  ),
                  decoration: BoxDecoration(
                    color: AppTheme.secondary.withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                      color: AppTheme.white.withValues(alpha: 0.15),
                      width: 1.5,
                    ),
                  ),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        greeting,
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: AppTheme.white.withValues(alpha: 0.9),
                          letterSpacing: 1.5,
                          fontWeight: FontWeight.w600,
                          fontSize: 14,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Experience fine dining\nat your fingertips.',
                        style: Theme.of(context).textTheme.displayMedium
                            ?.copyWith(
                              color: AppTheme.white,
                              fontSize: 28,
                              height: 1.3,
                            ),
                      ),
                      if (Supabase.instance.client.auth.currentUser == null) ...[
                        const SizedBox(height: 14),
                        GestureDetector(
                          onTap: () => AuthGuard.requireAuth(
                            context,
                            actionTitle: 'Unlock Member Perks',
                            actionSubtitle: 'Sign in to TableFlow to save favorites, track orders in real time, and earn dining rewards.',
                            onAuthenticated: () {
                              _fetchUserData();
                            },
                          ),
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                            decoration: BoxDecoration(
                              color: AppTheme.white.withValues(alpha: 0.18),
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(
                                color: AppTheme.white.withValues(alpha: 0.35),
                                width: 1,
                              ),
                            ),
                            child: const Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(Icons.star, color: AppTheme.tertiary, size: 16),
                                SizedBox(width: 8),
                                Text(
                                  'Sign in for Member Perks',
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w600,
                                    color: Colors.white,
                                    letterSpacing: 0.5,
                                  ),
                                ),
                                SizedBox(width: 4),
                                Icon(Icons.chevron_right, color: Colors.white70, size: 16),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildQuickActions() {
    final cart = context.watch<CartProvider>();

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Active Dine-in Table Banner
          if (cart.hasTableSelected) ...[
            Container(
              margin: const EdgeInsets.only(bottom: 20),
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [AppTheme.primary, AppTheme.primary.withValues(alpha: 0.85)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(20),
                boxShadow: [
                  BoxShadow(
                    color: AppTheme.primary.withValues(alpha: 0.35),
                    blurRadius: 15,
                    offset: const Offset(0, 6),
                  ),
                ],
              ),
              child: Column(
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.2),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(Icons.table_restaurant, color: Colors.white, size: 24),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'ACTIVE TABLE SESSION',
                              style: TextStyle(
                                color: Colors.white70,
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                                letterSpacing: 1.2,
                              ),
                            ),
                            Text(
                              'Table #${cart.selectedTableNumber}',
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 20,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ],
                        ),
                      ),
                      IconButton(
                        tooltip: 'Leave Table',
                        icon: const Icon(Icons.close, color: Colors.white70, size: 20),
                        onPressed: () => cart.clearTable(),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  Row(
                    children: [
                      Expanded(
                        child: ElevatedButton.icon(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.white,
                            foregroundColor: AppTheme.primary,
                            elevation: 0,
                            padding: const EdgeInsets.symmetric(vertical: 10),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          ),
                          onPressed: () => CallWaiterSheet.show(context),
                          icon: const Icon(Icons.support_agent, size: 18),
                          label: const Text('Call Waiter', style: TextStyle(fontWeight: FontWeight.bold)),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: OutlinedButton.icon(
                          style: OutlinedButton.styleFrom(
                            side: const BorderSide(color: Colors.white, width: 1.5),
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(vertical: 10),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          ),
                          onPressed: () => context.go('/menu'),
                          icon: const Icon(Icons.restaurant_menu, size: 18),
                          label: const Text('Order More', style: TextStyle(fontWeight: FontWeight.bold)),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],

          Text(
            'Quick Actions',
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
              fontFamily: 'Playfair Display',
              fontWeight: FontWeight.bold,
              fontSize: 24,
            ),
          ),
          const SizedBox(height: 20),

          // Primary Actions: Book Table & Scan QR
          Row(
            children: [
              Expanded(
                child: _buildActionCard(
                  title: 'Book a Table',
                  subtitle: 'Reserve spot',
                  icon: Icons.event_seat,
                  isPrimary: true,
                  onTap: () => context.go('/table-selection'),
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: _buildActionCard(
                  title: 'Scan Table QR',
                  subtitle: 'Dine-in order',
                  icon: Icons.qr_code_scanner,
                  isPrimary: false,
                  onTap: () => context.push('/qr-checkin'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),

          // Secondary Actions Row
          Row(
            children: [
              Expanded(
                child: _buildActionCard(
                  title: 'Join Queue',
                  subtitle: 'Waitlist online',
                  icon: Icons.people_outline,
                  onTap: () => context.go('/queue'),
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: _buildActionCard(
                  title: 'Menu',
                  subtitle: 'Pre-order dishes',
                  icon: Icons.restaurant_menu,
                  onTap: () => context.go('/menu'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: _buildActionCard(
                  title: 'My Reservations',
                  subtitle: 'View bookings & admin replies',
                  icon: Icons.history,
                  onTap: () async {
                    if (Supabase.instance.client.auth.currentUser == null) {
                      final loggedIn = await AuthGuard.requireAuth(
                        context,
                        actionTitle: 'View Reservations',
                        actionSubtitle: 'Sign in to TableFlow to check your upcoming table reservations and manager confirmations.',
                      );
                      if (!mounted) return;
                      if (loggedIn) {
                        context.go('/reservations');
                      }
                    } else {
                      context.go('/reservations');
                    }
                  },
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: _buildActionCard(
                  title: 'Order History',
                  subtitle: 'Past orders & reviews',
                  icon: Icons.receipt_long,
                  onTap: () async {
                    if (Supabase.instance.client.auth.currentUser == null) {
                      final loggedIn = await AuthGuard.requireAuth(
                        context,
                        actionTitle: 'View Order History',
                        actionSubtitle: 'Sign in to TableFlow to view your past dining receipts and review dishes.',
                      );
                      if (!mounted) return;
                      if (loggedIn) {
                        context.go('/order-history');
                      }
                    } else {
                      context.go('/order-history');
                    }
                  },
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildFeaturedSection() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  'Chef\'s Specialty',
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    fontFamily: 'Playfair Display',
                    fontWeight: FontWeight.bold,
                    fontSize: 24,
                  ),
                ),
              ),
              TextButton(
                onPressed: () => context.go('/menu'),
                child: const Text('View All'),
              ),
            ],
          ),
          const SizedBox(height: 16),
          MouseRegion(
            cursor: SystemMouseCursors.click,
            child: GestureDetector(
              onTap: () => context.go('/menu'),
              child: Container(
                constraints: const BoxConstraints(minHeight: 180),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(24),
                  image: const DecorationImage(
                    image: NetworkImage(
                      'https://images.unsplash.com/photo-1544025162-d76694265947?q=80&w=1000&auto=format&fit=crop',
                    ),
                    fit: BoxFit.cover,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: AppTheme.secondary.withValues(alpha: 0.2),
                      blurRadius: 15,
                      offset: const Offset(0, 8),
                    ),
                  ],
                ),
                child: Container(
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(24),
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [
                        Colors.transparent,
                        AppTheme.secondary.withValues(alpha: 0.95),
                      ],
                    ),
                  ),
                  padding: const EdgeInsets.all(24),
                  alignment: Alignment.bottomLeft,
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Expanded(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 12,
                                vertical: 6,
                              ),
                              decoration: BoxDecoration(
                                color: AppTheme.primary,
                                borderRadius: BorderRadius.circular(20),
                              ),
                              child: Text(
                                'FEATURED',
                                style: Theme.of(context).textTheme.labelSmall
                                    ?.copyWith(
                                      color: AppTheme.white,
                                      fontWeight: FontWeight.bold,
                                      letterSpacing: 1.5,
                                    ),
                              ),
                            ),
                            const SizedBox(height: 12),
                            Text(
                              'Wagyu Beef Steak',
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: Theme.of(context).textTheme.titleLarge
                                    ?.copyWith(
                                      color: AppTheme.white,
                                      fontFamily: 'Playfair Display',
                                      fontSize: 22,
                                    ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 12),
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: AppTheme.white.withValues(alpha: 0.15),
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: AppTheme.white.withValues(alpha: 0.3),
                          ),
                        ),
                        child: const Icon(
                          Icons.arrow_forward,
                          color: AppTheme.white,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildActionCard({
    required String title,
    required String subtitle,
    required IconData icon,
    required VoidCallback onTap,
    bool isPrimary = false,
  }) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final isNarrow = constraints.maxWidth < 240;
        final cardPadding = isNarrow ? 16.0 : (isPrimary ? 24.0 : 20.0);

        return MouseRegion(
          cursor: SystemMouseCursors.click,
          child: GestureDetector(
            onTap: onTap,
            child: Container(
              padding: EdgeInsets.all(cardPadding),
              decoration: BoxDecoration(
                color: AppTheme.white,
                borderRadius: BorderRadius.circular(24),
                border: Border.all(
                  color: AppTheme.secondary.withValues(alpha: 0.05),
                ),
                boxShadow: [
                  BoxShadow(
                    color: AppTheme.secondary.withValues(alpha: 0.06),
                    blurRadius: 24,
                    offset: const Offset(0, 8),
                  ),
                ],
              ),
              child: isPrimary
                  ? (isNarrow
                      ? Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: AppTheme.primary.withValues(alpha: 0.1),
                                borderRadius: BorderRadius.circular(14),
                              ),
                              child: Icon(icon, color: AppTheme.primary, size: 28),
                            ),
                            const SizedBox(height: 12),
                            Text(
                              title,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                                    fontSize: 18,
                                    fontWeight: FontWeight.bold,
                                  ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              subtitle,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                    color: AppTheme.secondary.withValues(
                                      alpha: 0.6,
                                    ),
                                    fontSize: 13,
                                  ),
                            ),
                          ],
                        )
                      : Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.all(16),
                              decoration: BoxDecoration(
                                color: AppTheme.primary.withValues(alpha: 0.1),
                                borderRadius: BorderRadius.circular(16),
                              ),
                              child: Icon(icon, color: AppTheme.primary, size: 32),
                            ),
                            const SizedBox(width: 16),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    title,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                                          fontSize: 20,
                                          fontWeight: FontWeight.bold,
                                        ),
                                  ),
                                  const SizedBox(height: 6),
                                  Text(
                                    subtitle,
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                          color: AppTheme.secondary.withValues(
                                            alpha: 0.6,
                                          ),
                                        ),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(width: 8),
                            const Icon(Icons.chevron_right, color: AppTheme.secondary),
                          ],
                        ))
                  : Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          padding: EdgeInsets.all(isNarrow ? 10 : 14),
                          decoration: BoxDecoration(
                            color: AppTheme.primary.withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(14),
                          ),
                          child: Icon(icon, color: AppTheme.primary, size: isNarrow ? 20 : 24),
                        ),
                        SizedBox(height: isNarrow ? 12 : 20),
                        Text(
                          title,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context).textTheme.titleLarge?.copyWith(
                                fontSize: isNarrow ? 14 : 16,
                                fontWeight: FontWeight.bold,
                              ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          subtitle,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                color: AppTheme.secondary.withValues(alpha: 0.6),
                                height: 1.4,
                                fontSize: isNarrow ? 11 : 12,
                              ),
                        ),
                      ],
                    ),
            ),
          ),
        );
      },
    );
  }
}

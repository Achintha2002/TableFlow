import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme.dart';

class LoyaltyScreen extends StatelessWidget {
  const LoyaltyScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, size: 20),
          onPressed: () => context.pop(),
        ),
        title: const Text('Loyalty & VIP'),
      ),
      body: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // VIP Card Hero
            Container(
              margin: const EdgeInsets.all(24),
              padding: const EdgeInsets.all(28),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF3A2E28), Color(0xFF5C4A3A)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(20),
                boxShadow: [
                  BoxShadow(
                    color: AppTheme.secondary.withOpacity(0.3),
                    blurRadius: 20,
                    offset: const Offset(0, 8),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'TABLEFLOW',
                        style: TextStyle(
                          color: AppTheme.tertiary,
                          letterSpacing: 3,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      Icon(Icons.star, color: AppTheme.tertiary),
                    ],
                  ),
                  const SizedBox(height: 24),
                  const Text(
                    'Eleanor Vance',
                    style: TextStyle(
                      color: AppTheme.white,
                      fontSize: 22,
                      fontWeight: FontWeight.w600,
                      fontFamily: 'Playfair Display',
                    ),
                  ),
                  const SizedBox(height: 4),
                  const Text(
                    'Platinum Member',
                    style: TextStyle(color: AppTheme.tertiary, fontSize: 12),
                  ),
                  const SizedBox(height: 24),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            '1,240',
                            style: TextStyle(
                              color: AppTheme.white,
                              fontSize: 28,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          Text(
                            'POINTS',
                            style: TextStyle(
                              color: AppTheme.white.withOpacity(0.5),
                              fontSize: 11,
                              letterSpacing: 2,
                            ),
                          ),
                        ],
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                        decoration: BoxDecoration(
                          color: AppTheme.tertiary,
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: const Text(
                          'Redeem',
                          style: TextStyle(
                            color: AppTheme.secondary,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),

            // Progress to next tier
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Progress to Diamond',
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      fontFamily: 'Playfair Display',
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    '760 more points needed',
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                  const SizedBox(height: 12),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(4),
                    child: LinearProgressIndicator(
                      value: 0.62,
                      minHeight: 8,
                      backgroundColor: AppTheme.secondary.withOpacity(0.1),
                      valueColor: const AlwaysStoppedAnimation<Color>(AppTheme.tertiary),
                    ),
                  ),
                  const SizedBox(height: 32),

                  Text(
                    'Your Rewards',
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      fontFamily: 'Playfair Display',
                    ),
                  ),
                  const SizedBox(height: 16),
                ],
              ),
            ),

            // Rewards List
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24.0),
              child: Column(
                children: [
                  _buildRewardTile(
                    context,
                    icon: Icons.local_drink,
                    title: 'Complimentary Appetizer',
                    points: '200 pts',
                    isUnlocked: true,
                  ),
                  const SizedBox(height: 12),
                  _buildRewardTile(
                    context,
                    icon: Icons.wine_bar,
                    title: 'Sommelier Wine Pairing',
                    points: '500 pts',
                    isUnlocked: true,
                  ),
                  const SizedBox(height: 12),
                  _buildRewardTile(
                    context,
                    icon: Icons.cake,
                    title: 'Dessert Tasting Platter',
                    points: '350 pts',
                    isUnlocked: false,
                  ),
                  const SizedBox(height: 12),
                  _buildRewardTile(
                    context,
                    icon: Icons.event_seat,
                    title: 'Priority Table Reservation',
                    points: '800 pts',
                    isUnlocked: false,
                  ),
                ],
              ),
            ),
            const SizedBox(height: 40),
          ],
        ),
      ),
    );
  }

  Widget _buildRewardTile(
    BuildContext context, {
    required IconData icon,
    required String title,
    required String points,
    required bool isUnlocked,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppTheme.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isUnlocked ? AppTheme.tertiary.withOpacity(0.3) : AppTheme.secondary.withOpacity(0.1),
        ),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: isUnlocked ? AppTheme.tertiary.withOpacity(0.15) : AppTheme.secondary.withOpacity(0.05),
              shape: BoxShape.circle,
            ),
            child: Icon(
              icon,
              color: isUnlocked ? AppTheme.tertiary : AppTheme.secondary.withOpacity(0.3),
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Text(
              title,
              style: TextStyle(
                fontWeight: FontWeight.w600,
                color: isUnlocked ? AppTheme.secondary : AppTheme.secondary.withOpacity(0.4),
              ),
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: isUnlocked ? AppTheme.tertiary : AppTheme.secondary.withOpacity(0.05),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Text(
              points,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.bold,
                color: isUnlocked ? AppTheme.secondary : AppTheme.secondary.withOpacity(0.3),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

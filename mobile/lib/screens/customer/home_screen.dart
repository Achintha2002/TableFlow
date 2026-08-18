import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(
          'TableFlow',
          style: Theme.of(context).textTheme.displayMedium?.copyWith(
            color: AppTheme.primary,
            fontSize: 24,
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.person_outline),
            onPressed: () => context.push('/profile'),
          ),
        ],
      ),
      body: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Hero Image Section
            Container(
              height: 250,
              decoration: const BoxDecoration(
                color: AppTheme.secondary,
                image: DecorationImage(
                  image: NetworkImage('https://images.unsplash.com/photo-1544025162-d76694265947?q=80&w=1000&auto=format&fit=crop'),
                  fit: BoxFit.cover,
                ),
              ),
              child: Container(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      Colors.transparent,
                      AppTheme.secondary.withOpacity(0.8),
                    ],
                  ),
                ),
                padding: const EdgeInsets.all(24.0),
                alignment: Alignment.bottomLeft,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Welcome back, Eleanor',
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: AppTheme.white,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Experience fine dining\nat your fingertips.',
                      style: Theme.of(context).textTheme.displayMedium?.copyWith(
                        color: AppTheme.white,
                        fontSize: 26,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            
            const SizedBox(height: 24),
            
            // Quick Actions
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Quick Actions',
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      fontFamily: 'Playfair Display',
                    ),
                  ),
                  const SizedBox(height: 16),
                  
                  // Book a Table Card
                  _buildActionCard(
                    context,
                    title: 'Book a Table',
                    subtitle: 'Reserve your spot for a perfect evening.',
                    icon: Icons.event_seat,
                    onTap: () {
                      context.push('/table-selection');
                    },
                  ),
                  const SizedBox(height: 16),
                  
                  // Join the Queue Card
                  _buildActionCard(
                    context,
                    title: 'Join the Queue',
                    subtitle: 'Waitlist from anywhere, arrive when ready.',
                    icon: Icons.people_outline,
                    onTap: () {
                      context.push('/queue');
                    },
                  ),
                  const SizedBox(height: 16),
                  
                  // Browse Menu Card
                  _buildActionCard(
                    context,
                    title: 'Browse Menu',
                    subtitle: 'Pre-order your favorites.',
                    icon: Icons.restaurant_menu,
                    onTap: () {
                      context.push('/menu');
                    },
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

  Widget _buildActionCard(BuildContext context, {
    required String title,
    required String subtitle,
    required IconData icon,
    required VoidCallback onTap,
  }) {
    return Material(
      color: AppTheme.white,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppTheme.secondary.withOpacity(0.1)),
            boxShadow: [
              BoxShadow(
                color: AppTheme.secondary.withOpacity(0.05),
                blurRadius: 10,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppTheme.primary.withOpacity(0.1),
                  shape: BoxShape.circle,
                ),
                child: Icon(icon, color: AppTheme.primary),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                        fontSize: 18,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      subtitle,
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right, color: AppTheme.secondary),
            ],
          ),
        ),
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  bool _highContrast = false;
  bool _largeFont = false;
  bool _promoEmails = true;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, size: 20),
          onPressed: () => context.pop(),
        ),
        title: const Text('Profile & Settings'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // User Avatar & Info
            Center(
              child: Column(
                children: [
                  CircleAvatar(
                    radius: 50,
                    backgroundColor: AppTheme.primary.withOpacity(0.1),
                    child: const Icon(Icons.person, size: 50, color: AppTheme.primary),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    'Eleanor Vance',
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      fontFamily: 'Playfair Display',
                      fontSize: 26,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'eleanor.vance@example.com',
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                  const SizedBox(height: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                    decoration: BoxDecoration(
                      color: AppTheme.tertiary.withOpacity(0.15),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Text(
                      'Platinum Member',
                      style: TextStyle(
                        color: AppTheme.tertiary,
                        fontWeight: FontWeight.bold,
                        fontSize: 12,
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),
                  OutlinedButton(
                    onPressed: () {},
                    style: OutlinedButton.styleFrom(
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(20),
                      ),
                      padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 12),
                    ),
                    child: const Text('Edit Profile'),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 40),

            // Accessibility Settings
            Text(
              'Accessibility',
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                fontFamily: 'Playfair Display',
                fontSize: 20,
              ),
            ),
            const SizedBox(height: 16),
            _buildSwitchTile(
              title: 'High Contrast Mode',
              subtitle: 'Enhances visibility across the app for easier reading.',
              value: _highContrast,
              onChanged: (val) => setState(() => _highContrast = val),
            ),
            _buildSwitchTile(
              title: 'Large Font',
              subtitle: 'Increases text size throughout the application.',
              value: _largeFont,
              onChanged: (val) => setState(() => _largeFont = val),
            ),
            const SizedBox(height: 32),

            // Notifications
            Text(
              'Notifications',
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                fontFamily: 'Playfair Display',
                fontSize: 20,
              ),
            ),
            const SizedBox(height: 16),
            _buildSwitchTile(
              title: 'Promotional Offers',
              subtitle: 'Receive updates about special menus and events.',
              value: _promoEmails,
              onChanged: (val) => setState(() => _promoEmails = val),
            ),
            const SizedBox(height: 40),

            // Logout
            TextButton(
              onPressed: () {
                // Logout logic
                context.go('/login');
              },
              child: const Text(
                'Log Out',
                style: TextStyle(color: Colors.red, fontSize: 16),
              ),
            ),
            const SizedBox(height: 40),
          ],
        ),
      ),
    );
  }

  Widget _buildSwitchTile({
    required String title,
    required String subtitle,
    required bool value,
    required ValueChanged<bool> onChanged,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12.0),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: Theme.of(context).textTheme.labelLarge?.copyWith(
                    color: AppTheme.secondary,
                    fontSize: 16,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  subtitle,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: AppTheme.secondary.withOpacity(0.6),
                  ),
                ),
              ],
            ),
          ),
          Switch(
            value: value,
            onChanged: onChanged,
            activeColor: AppTheme.primary,
          ),
        ],
      ),
    );
  }
}

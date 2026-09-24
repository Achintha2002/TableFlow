import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme.dart';
import '../../widgets/safe_backdrop_filter.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../services/supabase_service.dart';
import '../../utils/auth_guard.dart';

import 'package:provider/provider.dart';
import '../../providers/settings_provider.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  bool _isLoading = true;
  String _fullName = '';
  String _email = '';
  String _phone = '';
  String _loyaltyTier = 'Bronze';
  
  bool _promoEmails = true;

  @override
  void initState() {
    super.initState();
    _fetchProfileData();
  }

  Future<void> _fetchProfileData() async {
    final user = Supabase.instance.client.auth.currentUser;
    if (user == null) {
      if (mounted) {
        setState(() {
          _fullName = 'Guest Customer';
          _email = 'Browsing as Guest';
          _phone = '';
          _loyaltyTier = 'Guest';
          _isLoading = false;
        });
      }
      return;
    }

    try {
      final profile = await SupabaseService.getUserProfile();

      if (mounted) {
        setState(() {
          _fullName = profile?['full_name'] ?? 'Guest';
          _email = profile?['email'] ?? '';
          _phone = profile?['phone_number'] ?? '';
          _loyaltyTier = profile?['loyalty_tier'] ?? 'Bronze';
          
          _isLoading = false;
        });
      }
    } catch (e) {
      debugPrint('Error fetching profile: $e');
      if (mounted) setState(() => _isLoading = false);
    }
  }


  void _showEditProfileDialog() {
    final nameController = TextEditingController(text: _fullName);
    final phoneController = TextEditingController(text: _phone);
    
    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          backgroundColor: AppTheme.white,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
          title: const Text('Edit Profile', style: TextStyle(fontFamily: 'Playfair Display', fontWeight: FontWeight.bold)),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: nameController,
                decoration: InputDecoration(
                  labelText: 'Full Name',
                  filled: true,
                  fillColor: AppTheme.background,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                ),
                cursorColor: AppTheme.primary,
              ),
              const SizedBox(height: 16),
              TextField(
                controller: phoneController,
                decoration: InputDecoration(
                  labelText: 'Phone Number',
                  filled: true,
                  fillColor: AppTheme.background,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                ),
                keyboardType: TextInputType.phone,
                cursorColor: AppTheme.primary,
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancel', style: TextStyle(color: AppTheme.secondary)),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.primary,
                foregroundColor: AppTheme.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              onPressed: () async {
                try {
                  await SupabaseService.updateUserProfile(
                    fullName: nameController.text,
                    phone: phoneController.text,
                  );
                  if (context.mounted) {
                    if (mounted) {
                      setState(() {
                        _fullName = nameController.text;
                        _phone = phoneController.text;
                      });
                    }
                    Navigator.pop(context);
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Profile updated successfully'), behavior: SnackBarBehavior.floating),
                    );
                  }
                } catch (e) {
                  debugPrint('Error updating profile: $e');
                }
              },
              child: const Text('Save'),
            ),
          ],
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(backgroundColor: AppTheme.background, body: Center(child: CircularProgressIndicator(color: AppTheme.primary)));
    }
    
    final isGuest = Supabase.instance.client.auth.currentUser == null;

    return Scaffold(
      backgroundColor: AppTheme.background,
      body: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Premium Glassmorphism Header
            Container(
              constraints: const BoxConstraints(minHeight: 380),
              decoration: const BoxDecoration(
                image: DecorationImage(
                  image: NetworkImage('https://images.unsplash.com/photo-1544148103-0773bf10d330?q=80&w=1000&auto=format&fit=crop'), // Elegant restaurant/wine image
                  fit: BoxFit.cover,
                ),
                borderRadius: BorderRadius.only(
                  bottomLeft: Radius.circular(40),
                  bottomRight: Radius.circular(40),
                ),
              ),
              child: Container(
                decoration: BoxDecoration(
                  borderRadius: const BorderRadius.only(
                    bottomLeft: Radius.circular(40),
                    bottomRight: Radius.circular(40),
                  ),
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      Colors.transparent,
                      AppTheme.secondary.withValues(alpha: 0.8),
                    ],
                  ),
                ),
                child: SafeArea(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.end,
                    children: [
                      Stack(
                        alignment: Alignment.bottomRight,
                        children: [
                          Container(
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              border: Border.all(color: AppTheme.white.withValues(alpha: 0.5), width: 3),
                              boxShadow: [
                                BoxShadow(color: AppTheme.secondary.withValues(alpha: 0.3), blurRadius: 20)
                              ],
                            ),
                            child: CircleAvatar(
                              radius: 50,
                              backgroundColor: AppTheme.white.withValues(alpha: 0.9),
                              child: isGuest
                                  ? const Icon(Icons.person_outline_rounded, size: 48, color: AppTheme.primary)
                                  : Text(
                                      _fullName.isNotEmpty ? _fullName[0].toUpperCase() : 'U',
                                      style: const TextStyle(
                                        fontSize: 40,
                                        fontFamily: 'Playfair Display',
                                        color: AppTheme.primary,
                                      ),
                                    ),
                            ),
                          ),
                          Container(
                            decoration: BoxDecoration(
                              color: AppTheme.primary,
                              shape: BoxShape.circle,
                              border: Border.all(color: AppTheme.white, width: 2),
                            ),
                            child: IconButton(
                              icon: const Icon(Icons.edit, color: AppTheme.white, size: 18),
                              onPressed: () {
                                if (isGuest) {
                                  AuthGuard.requireAuth(
                                    context,
                                    actionTitle: 'Edit Profile',
                                    actionSubtitle: 'Sign in to customize your TableFlow member profile.',
                                    onAuthenticated: _fetchProfileData,
                                  );
                                } else {
                                  _showEditProfileDialog();
                                }
                              },
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      Text(
                        _fullName,
                        style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          fontFamily: 'Playfair Display',
                          fontSize: 28,
                          fontWeight: FontWeight.bold,
                          color: AppTheme.white,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        _email,
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: AppTheme.white.withValues(alpha: 0.8),
                        ),
                      ),
                      const SizedBox(height: 16),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(20),
                        child: SafeBackdropFilter(
                          sigmaX: 10,
                          sigmaY: 10,
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                            decoration: BoxDecoration(
                              color: AppTheme.white.withValues(alpha: 0.2),
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(color: AppTheme.white.withValues(alpha: 0.3)),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Icon(Icons.star, color: AppTheme.tertiary, size: 18),
                                const SizedBox(width: 8),
                                Text(
                                  isGuest ? 'Guest Explorer' : '$_loyaltyTier Member',
                                  style: const TextStyle(
                                    color: AppTheme.white,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                      if (isGuest) ...[
                        const SizedBox(height: 16),
                        ElevatedButton.icon(
                          onPressed: () async {
                            await context.push('/login');
                            if (mounted) _fetchProfileData();
                          },
                          icon: const Icon(Icons.login_rounded, size: 18),
                          label: const Text(
                            'Sign In or Create Account',
                            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                          ),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppTheme.primary,
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                            elevation: 6,
                          ),
                        ),
                      ],
                      const SizedBox(height: 24),
                    ],
                  ),
                ),
              ),
            ),
            

            // Account Activity Section
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Account Activity',
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      fontFamily: 'Playfair Display',
                      fontSize: 22,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 16),
                  _buildSettingsCard(
                    children: [
                      _buildActionTile(
                        icon: Icons.receipt_long,
                        title: 'Order History',
                        subtitle: 'View your past orders & write reviews.',
                        onTap: () async {
                          if (isGuest) {
                            final loggedIn = await AuthGuard.requireAuth(
                              context,
                              actionTitle: 'View Order History',
                              actionSubtitle: 'Sign in to TableFlow to view past orders, track live status, and review dishes.',
                            );
                            if (loggedIn && context.mounted) {
                              _fetchProfileData();
                              context.push('/order-history');
                            }
                          } else {
                            context.push('/order-history');
                          }
                        },
                      ),
                      const Divider(height: 1),
                      _buildActionTile(
                        icon: Icons.event_seat,
                        title: 'My Reservations',
                        subtitle: 'Manage your upcoming table bookings.',
                        onTap: () async {
                          if (isGuest) {
                            final loggedIn = await AuthGuard.requireAuth(
                              context,
                              actionTitle: 'View Reservations',
                              actionSubtitle: 'Sign in to TableFlow to check your upcoming table bookings and replies.',
                            );
                            if (loggedIn && context.mounted) {
                              _fetchProfileData();
                              context.push('/reservations');
                            }
                          } else {
                            context.push('/reservations');
                          }
                        },
                      ),
                      const Divider(height: 1),
                      _buildActionTile(
                        icon: Icons.star_border,
                        title: 'Loyalty Program',
                        subtitle: 'Check your points and tier status.',
                        onTap: () async {
                          if (isGuest) {
                            final loggedIn = await AuthGuard.requireAuth(
                              context,
                              actionTitle: 'Loyalty Rewards',
                              actionSubtitle: 'Sign in to earn and redeem boutique dining points.',
                            );
                            if (loggedIn && context.mounted) {
                              _fetchProfileData();
                              context.push('/loyalty');
                            }
                          } else {
                            context.push('/loyalty');
                          }
                        },
                      ),
                    ],
                  ),
                ],
              ),
            ),
            
            const SizedBox(height: 32),
            
            // Settings Section
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Preferences',
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      fontFamily: 'Playfair Display',
                      fontSize: 22,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 16),
                  _buildSettingsCard(
                    children: [
                      Consumer<SettingsProvider>(
                        builder: (context, settings, _) {
                          return _buildSwitchTile(
                            icon: Icons.contrast,
                            title: 'High Contrast Mode',
                            subtitle: 'Enhances visibility across the app.',
                            value: settings.isHighContrast,
                            onChanged: (val) {
                              settings.updateSettings(
                                highContrast: val,
                                largeFont: settings.isLargeFont,
                              );
                            },
                          );
                        }
                      ),

                    ],
                  ),
                  const SizedBox(height: 32),
                  Text(
                    'Notifications',
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      fontFamily: 'Playfair Display',
                      fontSize: 22,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 16),
                  _buildSettingsCard(
                    children: [
                      _buildSwitchTile(
                        icon: Icons.campaign_outlined,
                        title: 'Promotional Offers',
                        subtitle: 'Receive updates about special menus.',
                        value: _promoEmails,
                        onChanged: (val) => setState(() => _promoEmails = val),
                      ),
                    ],
                  ),
                  
                  const SizedBox(height: 48),
                  
                  // Auth Action Button
                  Center(
                    child: isGuest
                        ? ElevatedButton.icon(
                            onPressed: () async {
                              await context.push('/login');
                              if (mounted) _fetchProfileData();
                            },
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppTheme.primary,
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(horizontal: 36, vertical: 16),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                              elevation: 4,
                            ),
                            icon: const Icon(Icons.login_rounded),
                            label: const Text(
                              'Sign In / Register',
                              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                            ),
                          )
                        : OutlinedButton.icon(
                            onPressed: () async {
                              await SupabaseService.signOut();
                              if (context.mounted) {
                                setState(() {
                                  _fetchProfileData();
                                });
                              }
                            },
                            style: OutlinedButton.styleFrom(
                              padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 16),
                              side: const BorderSide(color: Colors.redAccent),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                            ),
                            icon: const Icon(Icons.logout, color: Colors.redAccent),
                            label: const Text(
                              'Sign Out',
                              style: TextStyle(color: Colors.redAccent, fontSize: 16, fontWeight: FontWeight.bold),
                            ),
                          ),
                  ),
                  const SizedBox(height: 100), // padding for bottom nav
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSettingsCard({required List<Widget> children}) {
    return Container(
      decoration: BoxDecoration(
        color: AppTheme.white,
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: AppTheme.secondary.withValues(alpha: 0.05),
            blurRadius: 20,
            offset: const Offset(0, 5),
          ),
        ],
      ),
      child: Column(children: children),
    );
  }

  Widget _buildSwitchTile({
    required IconData icon,
    required String title,
    required String subtitle,
    required bool value,
    required ValueChanged<bool> onChanged,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 16.0, horizontal: 20.0),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppTheme.primary.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(14),
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
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                ),
                const SizedBox(height: 4),
                Text(
                  subtitle,
                  style: TextStyle(
                    color: AppTheme.secondary.withValues(alpha: 0.6),
                    fontSize: 13,
                  ),
                ),
              ],
            ),
          ),
          Switch(
            value: value,
            onChanged: onChanged,
            activeThumbColor: AppTheme.white,
            activeTrackColor: AppTheme.primary,
          ),
        ],
      ),
    );
  }

  Widget _buildActionTile({
    required IconData icon,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 16.0, horizontal: 20.0),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppTheme.primary.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(14),
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
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    subtitle,
                    style: TextStyle(
                      color: AppTheme.secondary.withValues(alpha: 0.6),
                      fontSize: 13,
                    ),
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right, color: Colors.grey),
          ],
        ),
      ),
    );
  }
}

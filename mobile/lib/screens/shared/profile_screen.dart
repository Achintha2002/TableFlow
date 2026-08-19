import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme.dart';
import '../../services/supabase_service.dart';

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
  
  bool _highContrast = false;
  bool _largeFont = false;
  bool _promoEmails = true;

  @override
  void initState() {
    super.initState();
    _fetchProfileData();
  }

  Future<void> _fetchProfileData() async {
    try {
      final profile = await SupabaseService.getUserProfile();
      final settings = await SupabaseService.getAccessibilitySettings();
      
      if (mounted) {
        setState(() {
          _fullName = profile?['full_name'] ?? 'Guest';
          _email = profile?['email'] ?? '';
          _phone = profile?['phone_number'] ?? '';
          _loyaltyTier = profile?['loyalty_tier'] ?? 'Bronze';
          
          if (settings != null) {
            _highContrast = settings['high_contrast'] ?? false;
            _largeFont = settings['font_size'] == 'large';
          }
          
          _isLoading = false;
        });
      }
    } catch (e) {
      debugPrint('Error fetching profile: $e');
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _updateSettings() async {
    try {
      await SupabaseService.updateAccessibilitySettings(
        highContrast: _highContrast,
        fontSize: _largeFont ? 'large' : 'medium',
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Preferences saved successfully')),
        );
      }
    } catch (e) {
      debugPrint('Error updating settings: $e');
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
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          title: const Text('Edit Profile', style: TextStyle(fontFamily: 'Playfair Display')),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: nameController,
                decoration: const InputDecoration(
                  labelText: 'Full Name',
                  focusedBorder: UnderlineInputBorder(borderSide: BorderSide(color: AppTheme.primary)),
                ),
                cursorColor: AppTheme.primary,
              ),
              const SizedBox(height: 16),
              TextField(
                controller: phoneController,
                decoration: const InputDecoration(
                  labelText: 'Phone Number',
                  focusedBorder: UnderlineInputBorder(borderSide: BorderSide(color: AppTheme.primary)),
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
                  if (mounted) {
                    setState(() {
                      _fullName = nameController.text;
                      _phone = phoneController.text;
                    });
                    Navigator.pop(context);
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Profile updated successfully')),
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
      return const Center(child: CircularProgressIndicator(color: AppTheme.primary));
    }
    
    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Elegant Header Gradient
          Container(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  AppTheme.primary.withValues(alpha: 0.1),
                  AppTheme.tertiary.withValues(alpha: 0.2),
                ],
              ),
              borderRadius: const BorderRadius.only(
                bottomLeft: Radius.circular(40),
                bottomRight: Radius.circular(40),
              ),
            ),
            padding: const EdgeInsets.only(top: 40, bottom: 40, left: 24, right: 24),
            child: Column(
              children: [
                Stack(
                  alignment: Alignment.bottomRight,
                  children: [
                    CircleAvatar(
                      radius: 60,
                      backgroundColor: AppTheme.white,
                      child: Text(
                        _fullName.isNotEmpty ? _fullName[0].toUpperCase() : 'U',
                        style: const TextStyle(
                          fontSize: 48,
                          fontFamily: 'Playfair Display',
                          color: AppTheme.primary,
                        ),
                      ),
                    ),
                    Container(
                      decoration: const BoxDecoration(
                        color: AppTheme.primary,
                        shape: BoxShape.circle,
                      ),
                      child: IconButton(
                        icon: const Icon(Icons.edit, color: AppTheme.white, size: 20),
                        onPressed: _showEditProfileDialog,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 24),
                Text(
                  _fullName,
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    fontFamily: 'Playfair Display',
                    fontSize: 32,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  _email,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    fontSize: 16,
                  ),
                ),
                if (_phone.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(
                    _phone,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      fontSize: 14,
                      color: AppTheme.secondary.withValues(alpha: 0.7),
                    ),
                  ),
                ],
                const SizedBox(height: 16),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  decoration: BoxDecoration(
                    color: AppTheme.white,
                    borderRadius: BorderRadius.circular(20),
                    boxShadow: [
                      BoxShadow(
                        color: AppTheme.secondary.withValues(alpha: 0.1),
                        blurRadius: 10,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.star, color: AppTheme.tertiary, size: 18),
                      const SizedBox(width: 8),
                      Text(
                        '$_loyaltyTier Member',
                        style: const TextStyle(
                          color: AppTheme.tertiary,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
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
                  ),
                ),
                const SizedBox(height: 16),
                _buildSettingsCard(
                  children: [
                    _buildSwitchTile(
                      icon: Icons.contrast,
                      title: 'High Contrast Mode',
                      subtitle: 'Enhances visibility across the app.',
                      value: _highContrast,
                      onChanged: (val) {
                        setState(() => _highContrast = val);
                        _updateSettings();
                      },
                    ),
                    const Divider(height: 1),
                    _buildSwitchTile(
                      icon: Icons.format_size,
                      title: 'Large Font',
                      subtitle: 'Increases text size throughout.',
                      value: _largeFont,
                      onChanged: (val) {
                        setState(() => _largeFont = val);
                        _updateSettings();
                      },
                    ),
                  ],
                ),
                const SizedBox(height: 24),
                Text(
                  'Notifications',
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    fontFamily: 'Playfair Display',
                    fontSize: 22,
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
                
                // Logout Button
                Center(
                  child: TextButton.icon(
                    onPressed: () async {
                      await SupabaseService.signOut();
                      if (context.mounted) context.go('/login');
                    },
                    icon: const Icon(Icons.logout, color: Colors.red),
                    label: const Text(
                      'Log Out',
                      style: TextStyle(color: Colors.red, fontSize: 16, fontWeight: FontWeight.bold),
                    ),
                  ),
                ),
                const SizedBox(height: 40),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSettingsCard({required List<Widget> children}) {
    return Container(
      decoration: BoxDecoration(
        color: AppTheme.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppTheme.secondary.withValues(alpha: 0.1)),
        boxShadow: [
          BoxShadow(
            color: AppTheme.secondary.withValues(alpha: 0.05),
            blurRadius: 10,
            offset: const Offset(0, 4),
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
      padding: const EdgeInsets.symmetric(vertical: 12.0, horizontal: 16.0),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: AppTheme.secondary.withValues(alpha: 0.05),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, color: AppTheme.secondary),
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
            activeColor: AppTheme.primary,
          ),
        ],
      ),
    );
  }
}

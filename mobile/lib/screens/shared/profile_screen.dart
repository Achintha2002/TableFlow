import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme.dart';
import '../../widgets/safe_backdrop_filter.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../services/supabase_service.dart';
import '../../utils/auth_guard.dart';

import 'package:provider/provider.dart';
import '../../providers/settings_provider.dart';
import '../../services/avatar_service.dart';
import '../../widgets/app_avatar.dart';

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
  String? _avatarUrl;
  
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
          _avatarUrl = null;
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
          _avatarUrl = profile?['avatar_url'] as String?;
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
    PickedAvatar? newAvatar;
    bool removeAvatar = false;
    bool isSaving = false;
    String? nameError;
    String? phoneError;

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) {
        return StatefulBuilder(
          builder: (dialogCtx, setDialogState) {
            return AlertDialog(
              backgroundColor: AppTheme.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
              title: const Text(
                'Edit Profile',
                style: TextStyle(fontFamily: 'Playfair Display', fontWeight: FontWeight.bold),
                textAlign: TextAlign.center,
              ),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // Profile Photo Avatar with Edit Badge
                    GestureDetector(
                      onTap: isSaving
                          ? null
                          : () async {
                              final picked = await AvatarService.showPhotoSourcePicker(
                                dialogCtx,
                                hasExistingPhoto: (!removeAvatar && (_avatarUrl != null && _avatarUrl!.isNotEmpty)) ||
                                    (newAvatar != null && newAvatar!.bytes.isNotEmpty),
                              );
                              if (picked != null) {
                                if (picked.fileName == '__remove__') {
                                  setDialogState(() {
                                    newAvatar = null;
                                    removeAvatar = true;
                                  });
                                } else {
                                  setDialogState(() {
                                    newAvatar = picked;
                                    removeAvatar = false;
                                  });
                                }
                              }
                            },
                      child: Stack(
                        alignment: Alignment.bottomRight,
                        children: [
                          Container(
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              border: Border.all(color: AppTheme.primary.withValues(alpha: 0.2), width: 3),
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.black.withValues(alpha: 0.08),
                                  blurRadius: 12,
                                  offset: const Offset(0, 4),
                                ),
                              ],
                            ),
                            child: AppAvatar(
                              avatarUrl: removeAvatar ? null : _avatarUrl,
                              localBytes: newAvatar?.bytes,
                              name: nameController.text.trim(),
                              radius: 42,
                              backgroundColor: AppTheme.primary.withValues(alpha: 0.1),
                              textColor: AppTheme.primary,
                              fontSize: 32,
                            ),
                          ),
                          Container(
                            padding: const EdgeInsets.all(6),
                            decoration: BoxDecoration(
                              color: AppTheme.primary,
                              shape: BoxShape.circle,
                              border: Border.all(color: AppTheme.white, width: 2),
                            ),
                            child: const Icon(Icons.camera_alt_rounded, color: AppTheme.white, size: 14),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 6),
                    TextButton.icon(
                      onPressed: isSaving
                          ? null
                          : () async {
                              final picked = await AvatarService.showPhotoSourcePicker(
                                dialogCtx,
                                hasExistingPhoto: (!removeAvatar && (_avatarUrl != null && _avatarUrl!.isNotEmpty)) ||
                                    (newAvatar != null && newAvatar!.bytes.isNotEmpty),
                              );
                              if (picked != null) {
                                if (picked.fileName == '__remove__') {
                                  setDialogState(() {
                                    newAvatar = null;
                                    removeAvatar = true;
                                  });
                                } else {
                                  setDialogState(() {
                                    newAvatar = picked;
                                    removeAvatar = false;
                                  });
                                }
                              }
                            },
                      icon: const Icon(Icons.photo_camera, size: 15, color: AppTheme.primary),
                      label: Text(
                        (newAvatar != null || (_avatarUrl != null && _avatarUrl!.isNotEmpty && !removeAvatar))
                            ? 'Change Photo'
                            : 'Upload Photo',
                        style: const TextStyle(
                          color: AppTheme.primary,
                          fontWeight: FontWeight.w600,
                          fontSize: 13,
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    TextField(
                      controller: nameController,
                      decoration: InputDecoration(
                        labelText: 'Full Name',
                        hintText: 'e.g. John Doe',
                        hintStyle: TextStyle(
                          color: Colors.grey.shade400,
                          fontSize: 14,
                          fontWeight: FontWeight.w400,
                        ),
                        errorText: nameError,
                        filled: true,
                        fillColor: AppTheme.background,
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                        errorBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Colors.red)),
                      ),
                      cursorColor: AppTheme.primary,
                      enabled: !isSaving,
                      onChanged: (_) {
                        if (nameError != null) setDialogState(() => nameError = null);
                      },
                    ),
                    const SizedBox(height: 16),
                    TextField(
                      controller: phoneController,
                      decoration: InputDecoration(
                        labelText: 'Phone Number',
                        hintText: 'e.g. 0712345678',
                        hintStyle: TextStyle(
                          color: Colors.grey.shade400,
                          fontSize: 14,
                          fontWeight: FontWeight.w400,
                        ),
                        counterText: '${phoneController.text.replaceAll(RegExp(r'\D'), '').length}/10',
                        counterStyle: TextStyle(
                          fontSize: 11,
                          color: phoneController.text.replaceAll(RegExp(r'\D'), '').length == 10
                              ? Colors.green.shade700
                              : Colors.grey.shade600,
                          fontWeight: phoneController.text.replaceAll(RegExp(r'\D'), '').length == 10
                              ? FontWeight.bold
                              : FontWeight.normal,
                        ),
                        errorText: phoneError,
                        filled: true,
                        fillColor: AppTheme.background,
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                        errorBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Colors.red)),
                      ),
                      keyboardType: TextInputType.phone,
                      inputFormatters: [
                        FilteringTextInputFormatter.digitsOnly,
                        LengthLimitingTextInputFormatter(10),
                      ],
                      cursorColor: AppTheme.primary,
                      enabled: !isSaving,
                      onChanged: (_) {
                        setDialogState(() {
                          if (phoneError != null) phoneError = null;
                        });
                      },
                    ),
                    if (isSaving) ...[
                      const SizedBox(height: 16),
                      const Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2, color: AppTheme.primary),
                          ),
                          SizedBox(width: 10),
                          Text('Saving profile...', style: TextStyle(fontSize: 13, color: Colors.grey)),
                        ],
                      ),
                    ],
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: isSaving ? null : () => Navigator.pop(context),
                  child: const Text('Cancel', style: TextStyle(color: AppTheme.secondary)),
                ),
                ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.primary,
                    foregroundColor: AppTheme.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  onPressed: isSaving
                      ? null
                      : () async {
                          final phoneDigits = phoneController.text.replaceAll(RegExp(r'\D'), '');
                          final nameVal = nameController.text.trim();

                          bool hasError = false;
                          String? newNameErr;
                          String? newPhoneErr;

                          if (nameVal.isEmpty) {
                            newNameErr = 'Full name is required';
                            hasError = true;
                          } else if (nameVal.length < 2) {
                            newNameErr = 'Name must be at least 2 characters';
                            hasError = true;
                          }

                          if (phoneDigits.isEmpty) {
                            newPhoneErr = 'Phone number is required';
                            hasError = true;
                          } else if (phoneDigits.length != 10) {
                            newPhoneErr = 'Phone number must be exactly 10 digits';
                            hasError = true;
                          }

                          if (hasError) {
                            setDialogState(() {
                              nameError = newNameErr;
                              phoneError = newPhoneErr;
                            });
                            return;
                          }

                          setDialogState(() => isSaving = true);
                          try {
                            String? uploadedUrl = _avatarUrl;
                            if (removeAvatar) {
                              uploadedUrl = '';
                            } else if (newAvatar != null && newAvatar!.bytes.isNotEmpty) {
                              uploadedUrl = await AvatarService.uploadAvatar(
                                bytes: newAvatar!.bytes,
                                fileName: newAvatar!.fileName,
                                userId: Supabase.instance.client.auth.currentUser?.id,
                              );
                            }

                            await SupabaseService.updateUserProfile(
                              fullName: nameController.text.trim(),
                              phone: phoneController.text.trim(),
                              avatarUrl: uploadedUrl,
                            );

                            if (context.mounted) {
                              if (mounted) {
                                setState(() {
                                  _fullName = nameController.text.trim();
                                  _phone = phoneController.text.trim();
                                  _avatarUrl = uploadedUrl;
                                });
                              }
                              Navigator.pop(context);
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                  content: Text('Profile updated successfully'),
                                  behavior: SnackBarBehavior.floating,
                                ),
                              );
                            }
                          } catch (e) {
                            debugPrint('Error updating profile: $e');
                            setDialogState(() => isSaving = false);
                            if (context.mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(content: Text('Failed to update: $e')),
                              );
                            }
                          }
                        },
                  child: const Text('Save'),
                ),
              ],
            );
          },
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
                          GestureDetector(
                            onTap: () {
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
                            child: Container(
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                border: Border.all(color: AppTheme.white.withValues(alpha: 0.5), width: 3),
                                boxShadow: [
                                  BoxShadow(color: AppTheme.secondary.withValues(alpha: 0.3), blurRadius: 20)
                                ],
                              ),
                              child: AppAvatar(
                                avatarUrl: _avatarUrl,
                                name: _fullName,
                                radius: 50,
                                isGuest: isGuest,
                                backgroundColor: AppTheme.white.withValues(alpha: 0.9),
                                textColor: AppTheme.primary,
                                fontSize: 40,
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
            
            const SizedBox(height: 28),

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

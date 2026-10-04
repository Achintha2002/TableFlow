import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../core/theme.dart';
import '../../widgets/safe_backdrop_filter.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../services/supabase_service.dart';
import '../../services/api_service.dart';
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
  String _userRole = 'customer';
  bool _isPendingDeletion = false;
  DateTime? _scheduledDeletionAt;
  
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
          _userRole = 'guest';
          _isPendingDeletion = false;
          _scheduledDeletionAt = null;
          _isLoading = false;
        });
      }
      return;
    }

    try {
      final profile = await SupabaseService.getUserProfile();

      if (mounted) {
        DateTime? scheduledDate;
        if (profile?['scheduled_deletion_at'] != null) {
          scheduledDate = DateTime.tryParse(profile!['scheduled_deletion_at'].toString());
        }

        setState(() {
          _fullName = profile?['full_name'] ?? 'Guest';
          _email = profile?['email'] ?? '';
          _phone = profile?['phone_number'] ?? '';
          _loyaltyTier = profile?['loyalty_tier'] ?? 'Bronze';
          _avatarUrl = profile?['avatar_url'] as String?;
          _userRole = profile?['role'] ?? 'customer';
          _isPendingDeletion = profile?['is_pending_deletion'] == true;
          _scheduledDeletionAt = scheduledDate;
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

  void _showDeleteAccountDialog() {
    if (_userRole != 'customer' && _userRole != 'guest') {
      showDialog(
        context: context,
        builder: (ctx) => AlertDialog(
          backgroundColor: AppTheme.white,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
          title: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(color: Colors.amber.shade50, shape: BoxShape.circle),
                child: Icon(Icons.shield_outlined, color: Colors.amber.shade800, size: 24),
              ),
              const SizedBox(width: 12),
              const Expanded(
                child: Text('Admin / Staff Account', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
              ),
            ],
          ),
          content: Text(
            'You are logged in as an authoritative $_userRole account. Staff and admin accounts cannot be deleted through the customer mobile app for security compliance.',
            style: const TextStyle(fontSize: 14, height: 1.4),
          ),
          actions: [
            ElevatedButton(
              onPressed: () => Navigator.of(ctx).pop(),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.primary,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: const Text('Understood'),
            ),
          ],
        ),
      );
      return;
    }

    bool isSubmitting = false;

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (dialogCtx) {
        return StatefulBuilder(
          builder: (ctx, setDialogState) {
            return AlertDialog(
              backgroundColor: AppTheme.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
              titlePadding: const EdgeInsets.fromLTRB(24, 24, 24, 12),
              contentPadding: const EdgeInsets.symmetric(horizontal: 24),
              actionsPadding: const EdgeInsets.fromLTRB(16, 12, 16, 20),
              title: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: Colors.red.shade50,
                      shape: BoxShape.circle,
                    ),
                    child: Icon(Icons.warning_amber_rounded, color: Colors.red.shade700, size: 26),
                  ),
                  const SizedBox(width: 14),
                  const Expanded(
                    child: Text(
                      'Delete Account?',
                      style: TextStyle(
                        fontFamily: 'Playfair Display',
                        fontWeight: FontWeight.bold,
                        fontSize: 20,
                        color: Colors.black87,
                      ),
                    ),
                  ),
                ],
              ),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Your account will be deactivated immediately and permanently deleted after a 30-day grace period.',
                    style: TextStyle(fontSize: 14, height: 1.4, color: Colors.black87),
                  ),
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.amber.shade50,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: Colors.amber.shade200),
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Icon(Icons.info_outline, size: 18, color: Colors.amber.shade900),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            'You can log back in anytime within 30 days to cancel this request and restore all your data.',
                            style: TextStyle(fontSize: 12, color: Colors.amber.shade900, height: 1.3),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    '⚠️ Active orders, reservations, or queue entries must be completed or cancelled before requesting deletion.',
                    style: TextStyle(fontSize: 12, color: Colors.grey.shade600, height: 1.3),
                  ),
                ],
              ),
              actions: [
                TextButton(
                  onPressed: isSubmitting ? null : () => Navigator.of(dialogCtx).pop(),
                  child: Text(
                    'Cancel',
                    style: TextStyle(
                      color: Colors.grey.shade700,
                      fontWeight: FontWeight.w600,
                      fontSize: 15,
                    ),
                  ),
                ),
                ElevatedButton(
                  onPressed: isSubmitting
                      ? null
                      : () async {
                          setDialogState(() => isSubmitting = true);
                          final result = await ApiService.requestAccountDeletion();
                          if (!mounted) return;

                          if (result['success'] == true) {
                            if (dialogCtx.mounted) {
                              Navigator.of(dialogCtx).pop();
                            }
                            await SupabaseService.signOut();
                            if (mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  backgroundColor: Colors.blueGrey.shade900,
                                  behavior: SnackBarBehavior.floating,
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                  content: Row(
                                    children: const [
                                      Icon(Icons.schedule, color: Colors.amberAccent),
                                      SizedBox(width: 12),
                                      Expanded(
                                        child: Text(
                                          'Account scheduled for deletion. Log in anytime within 30 days to cancel.',
                                          style: TextStyle(color: Colors.white, fontSize: 13),
                                        ),
                                      ),
                                    ],
                                  ),
                                  duration: const Duration(seconds: 6),
                                ),
                              );
                              context.go('/login');
                            }
                          } else {
                            if (dialogCtx.mounted) {
                              Navigator.of(dialogCtx).pop();
                            }
                            final blockType = result['blockType'] as String?;
                            final errorMsg = result['error'] as String? ?? 'Could not schedule account deletion';
                            if (mounted) {
                              _showBlockedDeletionDialog(blockType: blockType, message: errorMsg);
                            }
                          }
                        },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.red.shade700,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
                    elevation: 0,
                  ),
                  child: isSubmitting
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                        )
                      : const Text(
                          'Delete My Account',
                          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                        ),
                ),
              ],
            );
          },
        );
      },
    );
  }

  void _showBlockedDeletionDialog({String? blockType, required String message}) {
    String actionLabel = 'OK';
    VoidCallback? onAction;

    if (blockType == 'order') {
      actionLabel = 'View Orders';
      onAction = () {
        Navigator.of(context).pop();
        context.push('/order-history');
      };
    } else if (blockType == 'reservation') {
      actionLabel = 'View Reservations';
      onAction = () {
        Navigator.of(context).pop();
        context.push('/reservations');
      };
    } else if (blockType == 'queue') {
      actionLabel = 'View Queue';
      onAction = () {
        Navigator.of(context).pop();
        context.push('/queue');
      };
    }

    showDialog(
      context: context,
      builder: (ctx) {
        return AlertDialog(
          backgroundColor: AppTheme.white,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
          title: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: Colors.orange.shade50,
                  shape: BoxShape.circle,
                ),
                child: Icon(Icons.pan_tool_rounded, color: Colors.orange.shade800, size: 24),
              ),
              const SizedBox(width: 12),
              const Expanded(
                child: Text(
                  'Action Required',
                  style: TextStyle(fontFamily: 'Playfair Display', fontWeight: FontWeight.bold, fontSize: 19),
                ),
              ),
            ],
          ),
          content: Text(
            message,
            style: const TextStyle(fontSize: 14, height: 1.4, color: Colors.black87),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(),
              child: const Text('Dismiss', style: TextStyle(color: Colors.grey)),
            ),
            if (onAction != null)
              ElevatedButton(
                onPressed: onAction,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.primary,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                child: Text(actionLabel, style: const TextStyle(fontWeight: FontWeight.bold)),
              ),
          ],
        );
      },
    );
  }

  Future<void> _cancelDeletion() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppTheme.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        title: const Text(
          'Cancel Account Deletion?',
          style: TextStyle(fontFamily: 'Playfair Display', fontWeight: FontWeight.bold),
        ),
        content: const Text(
          'Restoring your account will keep all your loyalty points, vouchers, and order history safe.',
          style: TextStyle(fontSize: 14, height: 1.4),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Keep Scheduled', style: TextStyle(color: Colors.grey)),
          ),
          ElevatedButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.green.shade700,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            child: const Text('Restore Account', style: TextStyle(fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );

    if (confirmed == true && mounted) {
      setState(() => _isLoading = true);
      final result = await ApiService.cancelAccountDeletion();
      if (!mounted) return;

      if (result['success'] == true) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: Colors.green.shade800,
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            content: Row(
              children: const [
                Icon(Icons.check_circle, color: Colors.white),
                SizedBox(width: 12),
                Expanded(child: Text('Account restored! Deletion has been cancelled.')),
              ],
            ),
          ),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: Colors.red.shade800,
            content: Text(result['error'] ?? 'Failed to cancel deletion'),
          ),
        );
      }
      _fetchProfileData();
    }
  }

  Widget _buildPendingDeletionBanner() {
    final dateFormatted = _scheduledDeletionAt != null
        ? DateFormat('MMMM d, yyyy').format(_scheduledDeletionAt!)
        : 'in 30 days';

    return Container(
      margin: const EdgeInsets.fromLTRB(24, 20, 24, 0),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [Colors.amber.shade900.withValues(alpha: 0.12), Colors.orange.shade800.withValues(alpha: 0.08)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.amber.shade700.withValues(alpha: 0.4), width: 1.5),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: Colors.amber.shade100,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(Icons.hourglass_top_rounded, color: Colors.amber.shade900, size: 22),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Account Scheduled for Deletion',
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 16,
                        color: Colors.black87,
                      ),
                    ),
                    Text(
                      'Deletion Date: $dateFormatted',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: Colors.amber.shade900,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          const Text(
            'Your account is currently within the 30-day grace period. You can cancel this request at any time to preserve your profile, loyalty tier, and vouchers.',
            style: TextStyle(fontSize: 13, height: 1.4, color: Colors.black87),
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: _cancelDeletion,
              icon: const Icon(Icons.restart_alt_rounded, size: 18),
              label: const Text(
                'Cancel Deletion & Restore Account',
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.green.shade700,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 12),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                elevation: 2,
              ),
            ),
          ),
        ],
      ),
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
            
            if (_isPendingDeletion) _buildPendingDeletionBanner(),

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
                      const Divider(height: 1),
                      _buildActionTile(
                        icon: Icons.confirmation_number_outlined,
                        title: 'My Vouchers & Rewards',
                        subtitle: ['Silver', 'Gold', 'Platinum'].contains(_loyaltyTier)
                            ? 'Silver 10% voucher active & earn tasks.'
                            : 'View active vouchers & earn 10% discount.',
                        onTap: () async {
                          if (isGuest) {
                            final loggedIn = await AuthGuard.requireAuth(
                              context,
                              actionTitle: 'My Vouchers',
                              actionSubtitle: 'Sign in to access your dining vouchers and task rewards.',
                            );
                            if (loggedIn && context.mounted) {
                              _fetchProfileData();
                              context.push('/my-vouchers');
                            }
                          } else {
                            context.push('/my-vouchers');
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
                  
                  if (!isGuest && !_isPendingDeletion) ...[
                    const SizedBox(height: 32),
                    Text(
                      'Account Management',
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                        fontFamily: 'Playfair Display',
                        fontSize: 22,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 16),
                    _buildSettingsCard(
                      children: [
                        InkWell(
                          onTap: _showDeleteAccountDialog,
                          borderRadius: BorderRadius.circular(24),
                          child: Padding(
                            padding: const EdgeInsets.symmetric(vertical: 16.0, horizontal: 20.0),
                            child: Row(
                              children: [
                                Container(
                                  padding: const EdgeInsets.all(12),
                                  decoration: BoxDecoration(
                                    color: Colors.red.shade50,
                                    borderRadius: BorderRadius.circular(14),
                                  ),
                                  child: Icon(Icons.delete_forever_outlined, color: Colors.red.shade700),
                                ),
                                const SizedBox(width: 16),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        'Delete My Account',
                                        style: TextStyle(
                                          fontWeight: FontWeight.bold,
                                          fontSize: 16,
                                          color: Colors.red.shade700,
                                        ),
                                      ),
                                      const SizedBox(height: 4),
                                      Text(
                                        'Schedule account deletion with 30-day grace period',
                                        style: TextStyle(
                                          color: AppTheme.secondary.withValues(alpha: 0.6),
                                          fontSize: 13,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                Icon(Icons.chevron_right, color: Colors.grey.shade400),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],

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

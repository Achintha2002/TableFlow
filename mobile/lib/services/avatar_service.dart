import 'dart:convert';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../core/theme.dart';
import '../utils/platform_image_picker.dart';
import 'api_service.dart';

class PickedAvatar {
  final Uint8List bytes;
  final String fileName;
  final String mimeType;

  PickedAvatar({
    required this.bytes,
    required this.fileName,
    required this.mimeType,
  });
}

class AvatarService {
  /// Show bottom sheet to choose Camera or Gallery, or remove photo
  static Future<PickedAvatar?> showPhotoSourcePicker(
    BuildContext context, {
    bool hasExistingPhoto = false,
  }) async {
    bool isCamera = false;
    bool didSelect = false;
    bool shouldRemove = false;

    await showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return Material(
          color: Colors.white,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
          clipBehavior: Clip.antiAlias,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
            child: SafeArea(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Center(
                    child: Container(
                      width: 40,
                      height: 4,
                      decoration: BoxDecoration(
                        color: Colors.grey.shade300,
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                  ),
                  const SizedBox(height: 18),
                  const Text(
                    'Profile Photo',
                    style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.bold,
                      fontFamily: 'Playfair Display',
                      color: AppTheme.secondary,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Select a photo for your TableFlow account',
                    style: TextStyle(
                      fontSize: 13,
                      color: Colors.grey.shade600,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 20),
                  ListTile(
                    leading: Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: AppTheme.primary.withValues(alpha: 0.1),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.camera_alt_rounded, color: AppTheme.primary),
                    ),
                    title: const Text('Take Photo', style: TextStyle(fontWeight: FontWeight.w600)),
                    subtitle: const Text('Use camera to capture a new photo'),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    onTap: () {
                      isCamera = true;
                      didSelect = true;
                      Navigator.pop(ctx);
                    },
                  ),
                  const SizedBox(height: 8),
                  ListTile(
                    leading: Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: AppTheme.secondary.withValues(alpha: 0.1),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.photo_library_rounded, color: AppTheme.secondary),
                    ),
                    title: const Text('Choose from Gallery', style: TextStyle(fontWeight: FontWeight.w600)),
                    subtitle: const Text('Pick an image from your device photos'),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    onTap: () {
                      isCamera = false;
                      didSelect = true;
                      Navigator.pop(ctx);
                    },
                  ),
                  if (hasExistingPhoto) ...[
                    const SizedBox(height: 8),
                    ListTile(
                      leading: Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: Colors.red.withValues(alpha: 0.1),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(Icons.delete_outline_rounded, color: Colors.red),
                      ),
                      title: const Text('Remove Photo', style: TextStyle(fontWeight: FontWeight.w600, color: Colors.red)),
                      subtitle: const Text('Revert back to default avatar'),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                      onTap: () {
                        shouldRemove = true;
                        Navigator.pop(ctx);
                      },
                    ),
                  ],
                  const SizedBox(height: 8),
                ],
              ),
            ),
          ),
        );
      },
    );

    if (shouldRemove) {
      return PickedAvatar(bytes: Uint8List(0), fileName: '__remove__', mimeType: '');
    }

    if (!didSelect) return null;

    try {
      final picked = await pickPlatformAvatar(isCamera: isCamera);
      return picked;
    } catch (e) {
      debugPrint('AvatarService pick error: $e');
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Could not access image: $e')),
        );
      }
      return null;
    }
  }

  /// Upload the avatar bytes to Supabase Storage, backend fallback, or base64 fallback.
  static Future<String?> uploadAvatar({
    required Uint8List bytes,
    required String fileName,
    String? userId,
  }) async {
    if (bytes.isEmpty) return null;

    final ext = fileName.contains('.') ? fileName.split('.').last.toLowerCase() : 'jpg';
    final mimeType = ext == 'png' ? 'image/png' : 'image/jpeg';
    final uniqueName = 'avatar_${userId ?? 'user'}_${DateTime.now().millisecondsSinceEpoch}.$ext';

    // 1. Try Supabase Storage directly
    try {
      final client = Supabase.instance.client;
      await client.storage.from('avatars').uploadBinary(
        uniqueName,
        bytes,
        fileOptions: FileOptions(contentType: mimeType, upsert: true),
      );
      final publicUrl = client.storage.from('avatars').getPublicUrl(uniqueName);
      if (publicUrl.isNotEmpty) {
        debugPrint('Avatar uploaded to Supabase Storage: $publicUrl');
        return publicUrl;
      }
    } catch (supabaseError) {
      debugPrint('Supabase direct upload failed ($supabaseError). Trying backend...');
    }

    // 2. Try Backend API
    try {
      final uri = Uri.parse('${ApiService.baseUrl}/upload-avatar');
      final request = http.MultipartRequest('POST', uri);
      request.files.add(
        http.MultipartFile.fromBytes(
          'avatar',
          bytes,
          filename: uniqueName,
          contentType: MediaType('image', ext == 'png' ? 'png' : 'jpeg'),
        ),
      );

      final streamedResponse = await request.send().timeout(const Duration(seconds: 8));
      final res = await http.Response.fromStream(streamedResponse);
      if (res.statusCode == 200) {
        final json = jsonDecode(res.body);
        if (json['url'] != null) {
          debugPrint('Avatar uploaded to backend: ${json['url']}');
          return json['url'] as String;
        }
      }
    } catch (backendError) {
      debugPrint('Backend avatar upload failed ($backendError). Falling back to Base64...');
    }

    // 3. Fallback: Base64 data URL (self-contained, works everywhere)
    final base64String = base64Encode(bytes);
    return 'data:$mimeType;base64,$base64String';
  }

  /// Helper to get an ImageProvider from URL, data URL, or bytes
  static ImageProvider? getImageProvider({
    String? avatarUrl,
    Uint8List? localBytes,
  }) {
    if (localBytes != null && localBytes.isNotEmpty) {
      return MemoryImage(localBytes);
    }
    if (avatarUrl == null || avatarUrl.isEmpty) {
      return null;
    }
    if (avatarUrl.startsWith('data:image')) {
      final commaIndex = avatarUrl.indexOf(',');
      if (commaIndex != -1) {
        final base64Data = avatarUrl.substring(commaIndex + 1);
        try {
          return MemoryImage(base64Decode(base64Data));
        } catch (_) {}
      }
    }
    if (avatarUrl.startsWith('http://') || avatarUrl.startsWith('https://')) {
      return NetworkImage(avatarUrl);
    }
    return null;
  }
}

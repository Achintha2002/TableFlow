import 'package:flutter/foundation.dart';
import 'package:image_picker/image_picker.dart';
import '../services/avatar_service.dart';

Future<PickedAvatar?> pickPlatformAvatar({bool isCamera = false}) async {
  try {
    final picker = ImagePicker();
    final xFile = await picker.pickImage(
      source: isCamera ? ImageSource.camera : ImageSource.gallery,
      maxWidth: 600,
      maxHeight: 600,
      imageQuality: 85,
    );
    if (xFile == null) return null;
    final bytes = await xFile.readAsBytes();
    final name = xFile.name.isNotEmpty ? xFile.name : 'avatar.jpg';
    final mime = xFile.mimeType ?? (name.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg');
    return PickedAvatar(bytes: bytes, fileName: name, mimeType: mime);
  } catch (e) {
    debugPrint('IO image picker error: $e');
    return null;
  }
}

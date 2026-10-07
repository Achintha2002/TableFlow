import 'dart:typed_data';
import 'package:flutter/foundation.dart';
import 'package:image_picker/image_picker.dart';

class PickedSlip {
  final String fileName;
  final Uint8List bytes;
  final String mimeType;

  PickedSlip({
    required this.fileName,
    required this.bytes,
    required this.mimeType,
  });
}

Future<PickedSlip?> pickSlipFile() async {
  try {
    final picker = ImagePicker();
    final xFile = await picker.pickImage(
      source: ImageSource.gallery,
      imageQuality: 90,
    );
    if (xFile == null) return null;
    final bytes = await xFile.readAsBytes();
    final name = xFile.name.isNotEmpty
        ? xFile.name
        : 'slip_${DateTime.now().millisecondsSinceEpoch}.jpg';
    final ext = name.split('.').last.toLowerCase();
    final mime = (ext == 'png')
        ? 'image/png'
        : (ext == 'webp')
            ? 'image/webp'
            : (ext == 'pdf')
                ? 'application/pdf'
                : 'image/jpeg';
    return PickedSlip(
      fileName: name,
      bytes: bytes,
      mimeType: mime,
    );
  } catch (e) {
    debugPrint('Slip picker error: $e');
    return null;
  }
}

import 'dart:typed_data';

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
  return null;
}

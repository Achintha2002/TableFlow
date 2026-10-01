// ignore_for_file: avoid_web_libraries_in_flutter, deprecated_member_use
import 'dart:async';
import 'dart:html' as html;
import 'dart:typed_data';
import '../services/avatar_service.dart';

Future<PickedAvatar?> pickPlatformAvatar({bool isCamera = false}) {
  final completer = Completer<PickedAvatar?>();
  final input = html.FileUploadInputElement()
    ..accept = 'image/png,image/jpeg,image/webp,image/jpg';

  if (isCamera) {
    input.setAttribute('capture', 'user');
  }

  input.click();

  input.onChange.listen((event) {
    final files = input.files;
    if (files != null && files.isNotEmpty) {
      final file = files.first;
      final reader = html.FileReader();
      reader.readAsArrayBuffer(file);
      reader.onLoadEnd.listen((e) {
        final result = reader.result;
        Uint8List? bytes;
        if (result is Uint8List) {
          bytes = result;
        } else if (result is List<int>) {
          bytes = Uint8List.fromList(result);
        }
        if (bytes != null && bytes.isNotEmpty) {
          completer.complete(PickedAvatar(
            fileName: file.name,
            bytes: bytes,
            mimeType: file.type.isNotEmpty ? file.type : 'image/jpeg',
          ));
        } else {
          completer.complete(null);
        }
      });
    } else {
      completer.complete(null);
    }
  });

  return completer.future;
}

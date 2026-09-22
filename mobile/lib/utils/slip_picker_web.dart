// ignore_for_file: avoid_web_libraries_in_flutter, deprecated_member_use
import 'dart:async';
import 'dart:html' as html;
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

Future<PickedSlip?> pickSlipFile() {
  final completer = Completer<PickedSlip?>();
  final input = html.FileUploadInputElement()
    ..accept = 'image/png,image/jpeg,image/webp,application/pdf';
  input.click();

  input.onChange.listen((event) {
    final files = input.files;
    if (files != null && files.isNotEmpty) {
      final file = files.first;
      final reader = html.FileReader();
      reader.readAsArrayBuffer(file);
      reader.onLoadEnd.listen((e) {
        final result = reader.result;
        if (result is Uint8List) {
          completer.complete(PickedSlip(
            fileName: file.name,
            bytes: result,
            mimeType: file.type.isNotEmpty ? file.type : 'image/jpeg',
          ));
        } else if (result is List<int>) {
          completer.complete(PickedSlip(
            fileName: file.name,
            bytes: Uint8List.fromList(result),
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

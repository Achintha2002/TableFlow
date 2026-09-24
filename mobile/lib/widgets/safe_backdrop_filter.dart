import 'dart:ui';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

/// A platform-safe replacement for [BackdropFilter].
///
/// On Web (CanvasKit/WebGL), complex Gaussian blur convolution shaders frequently
/// fail compilation on various GPUs/drivers, causing catastrophic WebGL context loss loops
/// (9000+ "Too many active WebGL contexts" warnings and constant screen re-rendering).
/// On Web, this safely bypasses the shader and renders the child directly.
/// On native platforms (iOS/Android/macOS), it preserves the full GPU-accelerated [BackdropFilter].
class SafeBackdropFilter extends StatelessWidget {
  final double sigmaX;
  final double sigmaY;
  final Widget child;

  const SafeBackdropFilter({
    super.key,
    this.sigmaX = 10,
    this.sigmaY = 10,
    required this.child,
  });

  @override
  Widget build(BuildContext context) {
    if (kIsWeb) {
      return child;
    }
    return BackdropFilter(
      filter: ImageFilter.blur(sigmaX: sigmaX, sigmaY: sigmaY),
      child: child,
    );
  }
}

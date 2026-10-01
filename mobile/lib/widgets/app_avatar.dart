import 'dart:convert';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import '../core/theme.dart';

class AppAvatar extends StatelessWidget {
  final String? avatarUrl;
  final Uint8List? localBytes;
  final String name;
  final double radius;
  final bool isGuest;
  final Color? backgroundColor;
  final Color? textColor;
  final double? fontSize;

  const AppAvatar({
    super.key,
    this.avatarUrl,
    this.localBytes,
    required this.name,
    this.radius = 50,
    this.isGuest = false,
    this.backgroundColor,
    this.textColor,
    this.fontSize,
  });

  @override
  Widget build(BuildContext context) {
    final size = radius * 2;
    final bgColor = backgroundColor ?? AppTheme.white.withValues(alpha: 0.9);
    final fgColor = textColor ?? AppTheme.primary;
    final fSize = fontSize ?? (radius * 0.75);

    Widget fallback() {
      if (isGuest) {
        return Icon(
          Icons.person_outline_rounded,
          size: radius * 0.95,
          color: fgColor,
        );
      }
      final initial = name.trim().isNotEmpty ? name.trim()[0].toUpperCase() : 'U';
      return Text(
        initial,
        style: TextStyle(
          fontSize: fSize,
          fontFamily: 'Playfair Display',
          fontWeight: FontWeight.bold,
          color: fgColor,
        ),
      );
    }

    Widget content;
    if (localBytes != null && localBytes!.isNotEmpty) {
      content = Image.memory(
        localBytes!,
        width: size,
        height: size,
        fit: BoxFit.cover,
        errorBuilder: (_, __, ___) => fallback(),
      );
    } else if (avatarUrl != null && avatarUrl!.isNotEmpty) {
      if (avatarUrl!.startsWith('data:image')) {
        final commaIdx = avatarUrl!.indexOf(',');
        if (commaIdx != -1) {
          try {
            final bytes = base64Decode(avatarUrl!.substring(commaIdx + 1));
            content = Image.memory(
              bytes,
              width: size,
              height: size,
              fit: BoxFit.cover,
              errorBuilder: (_, __, ___) => fallback(),
            );
          } catch (_) {
            content = fallback();
          }
        } else {
          content = fallback();
        }
      } else {
        content = Image.network(
          avatarUrl!,
          width: size,
          height: size,
          fit: BoxFit.cover,
          errorBuilder: (_, __, ___) => fallback(),
        );
      }
    } else {
      content = fallback();
    }

    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: bgColor,
        shape: BoxShape.circle,
      ),
      child: ClipOval(
        child: Center(child: content),
      ),
    );
  }
}

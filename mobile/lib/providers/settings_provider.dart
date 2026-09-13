import 'package:flutter/material.dart';
import '../services/supabase_service.dart';

class SettingsProvider extends ChangeNotifier {
  bool _isHighContrast = false;
  bool _isLargeFont = false;
  bool _isLoading = false;

  bool get isHighContrast => _isHighContrast;
  bool get isLargeFont => _isLargeFont;
  bool get isLoading => _isLoading;

  SettingsProvider() {
    loadSettings();
  }

  Future<void> loadSettings() async {
    // Only attempt to load if authenticated
    if (SupabaseService.client.auth.currentSession == null) return;
    
    _isLoading = true;
    notifyListeners();
    
    try {
      final settings = await SupabaseService.getAccessibilitySettings();
      if (settings != null) {
        _isHighContrast = settings['high_contrast'] ?? false;
        _isLargeFont = settings['font_size'] == 'large';
      }
    } catch (e) {
      debugPrint('Error loading settings: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> updateSettings({required bool highContrast, required bool largeFont}) async {
    _isHighContrast = highContrast;
    _isLargeFont = largeFont;
    notifyListeners();
    
    try {
      await SupabaseService.updateAccessibilitySettings(
        highContrast: highContrast,
        fontSize: largeFont ? 'large' : 'medium',
      );
    } catch (e) {
      debugPrint('Error saving settings: $e');
    }
  }
}

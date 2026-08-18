import 'package:flutter/foundation.dart';

class FCMService {
  /// Placeholder for FCM initialization.
  /// This will be implemented fully in Phase 5 to request permissions
  /// and register the device token with Supabase/Firebase.
  static Future<void> initialize() async {
    debugPrint("FCM Service: Initialized (Placeholder)");
  }

  /// Placeholder for handling incoming notifications
  static void onMessageReceived(dynamic message) {
    debugPrint("FCM Service: Message received: \$message");
  }
}

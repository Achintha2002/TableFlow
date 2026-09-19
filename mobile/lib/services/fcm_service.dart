import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:http/http.dart' as http;
import '../core/routes.dart';

/// Top-level background message handler for FCM (required by Flutter)
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  debugPrint("TableFlow FCM Background message: ${message.messageId} - ${message.notification?.title}");
}

class FCMService {
  static String? _currentToken;
  static bool _initialized = false;
  static final StreamController<Map<String, dynamic>> _notificationStreamController =
      StreamController<Map<String, dynamic>>.broadcast();

  static Stream<Map<String, dynamic>> get onNotificationReceived =>
      _notificationStreamController.stream;

  /// Multi-platform safe initialization (Web, Android, iOS)
  static Future<void> initialize() async {
    if (_initialized) return;

    try {
      // 1. Initialize Firebase Core safely
      try {
        if (Firebase.apps.isEmpty) {
          if (kIsWeb) {
            await Firebase.initializeApp(
              options: const FirebaseOptions(
                apiKey: "AIzaSyDummyKeyForTableFlowWebNotifications",
                authDomain: "tableflow.firebaseapp.com",
                projectId: "tableflow",
                storageBucket: "tableflow.appspot.com",
                messagingSenderId: "878569392531",
                appId: "1:878569392531:web:abcdef123456",
              ),
            );
          } else {
            await Firebase.initializeApp();
          }
        }
      } catch (coreErr) {
        debugPrint("FCMService: Firebase.initializeApp info: $coreErr");
      }

      if (Firebase.apps.isEmpty) {
        debugPrint("FCMService: Firebase apps empty, falling back to Supabase Realtime alerts.");
        _initialized = true;
        return;
      }

      final messaging = FirebaseMessaging.instance;

      // 2. Request Notification Permissions
      final settings = await messaging.requestPermission(
        alert: true,
        announcement: false,
        badge: true,
        carPlay: false,
        criticalAlert: false,
        provisional: false,
        sound: true,
      );
      debugPrint("FCMService: User notification permission: ${settings.authorizationStatus}");

      // 3. Register Top-Level Background Message Handler on Native Mobile
      if (!kIsWeb) {
        FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);
      }

      // 4. Retrieve and Register Device Token
      try {
        final token = await messaging.getToken();
        if (token != null) {
          _currentToken = token;
          debugPrint("FCMService: Device token registered: ${token.substring(0, token.length > 20 ? 20 : token.length)}...");
          await registerDeviceToken(token);
        }
      } catch (tokenErr) {
        debugPrint("FCMService: getToken notice (expected on unconfigured web): $tokenErr");
      }

      // 5. Listen to Token Refreshes
      messaging.onTokenRefresh.listen((newToken) {
        _currentToken = newToken;
        registerDeviceToken(newToken);
      });

      // 6. Foreground Messages Handler
      FirebaseMessaging.onMessage.listen((RemoteMessage message) {
        debugPrint("FCMService: Foreground message received: ${message.notification?.title}");
        final payload = {
          'title': message.notification?.title ?? 'TableFlow Alert',
          'body': message.notification?.body ?? '',
          'data': message.data,
          'type': message.data['type'] ?? 'general',
        };
        _notificationStreamController.add(payload);
      });

      // 7. Message Opened App (tap to open from notification tray)
      FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
        debugPrint("FCMService: Notification tapped: ${message.data}");
        handleNotificationTap(message.data);
      });

      _initialized = true;
    } catch (e) {
      debugPrint("FCMService: Initialization error (running in resilient fallback mode): $e");
    }
  }

  /// Syncs device token with TableFlow backend user_devices and Supabase
  static Future<void> registerDeviceToken(String token) async {
    final user = Supabase.instance.client.auth.currentUser;
    if (user == null) return;

    final platform = kIsWeb
        ? 'web'
        : (defaultTargetPlatform == TargetPlatform.iOS ? 'ios' : 'android');

    try {
      final backendUrl = Uri.parse('http://localhost:3000/api/notifications/fcm-token');
      final session = Supabase.instance.client.auth.currentSession;
      await http.post(
        backendUrl,
        headers: {
          'Content-Type': 'application/json',
          if (session?.accessToken != null) 'Authorization': 'Bearer ${session!.accessToken}',
        },
        body: jsonEncode({
          'user_id': user.id,
          'fcm_token': token,
          'platform': platform,
          'device_info': kIsWeb ? 'Web Browser' : defaultTargetPlatform.name,
        }),
      );
    } catch (e) {
      debugPrint("FCMService: Backend registerToken notice: $e");
    }

    try {
      await Supabase.instance.client
          .from('users')
          .update({'fcm_token': token})
          .eq('id', user.id);
    } catch (_) {}
  }

  /// Deregisters device token on logout so shared/reset devices don't receive pushes
  static Future<void> deregisterToken() async {
    if (_currentToken == null) return;
    try {
      final backendUrl = Uri.parse('http://localhost:3000/api/notifications/fcm-token');
      await http.delete(
        backendUrl,
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'fcm_token': _currentToken}),
      );
    } catch (_) {}
    _currentToken = null;
  }

  /// Subscribes staff devices to the staff-service-calls topic
  static Future<void> subscribeToStaffTopic() async {
    if (kIsWeb) return;
    try {
      await FirebaseMessaging.instance.subscribeToTopic('staff-service-calls');
      debugPrint("FCMService: Subscribed to staff-service-calls");
    } catch (e) {
      debugPrint("FCMService: Failed to subscribe to staff topic: $e");
    }
  }

  /// Unsubscribes staff devices from the staff-service-calls topic
  static Future<void> unsubscribeFromStaffTopic() async {
    if (kIsWeb) return;
    try {
      await FirebaseMessaging.instance.unsubscribeFromTopic('staff-service-calls');
      debugPrint("FCMService: Unsubscribed from staff-service-calls");
    } catch (e) {
      debugPrint("FCMService: Failed to unsubscribe from staff topic: $e");
    }
  }

  /// Deep link routing when customer taps a push notification
  static void handleNotificationTap(Map<String, dynamic> data) {
    final type = data['type'] as String?;
    switch (type) {
      case 'order_ready':
        AppRoutes.router.go('/order-status');
        break;
      case 'queue_ready':
        AppRoutes.router.go('/queue');
        break;
      case 'reservation_confirmed':
        AppRoutes.router.go('/reservations');
        break;
      default:
        break;
    }
  }
}

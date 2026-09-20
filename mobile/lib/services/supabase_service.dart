import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:flutter/foundation.dart';
import 'package:google_sign_in/google_sign_in.dart';

class SupabaseService {
  static final SupabaseClient _client = Supabase.instance.client;

  static SupabaseClient get client => _client;

  /// Initialize Supabase — called once in main()
  static Future<void> initialize() async {
    await Supabase.initialize(
      url: 'https://azjjndqecpemltvdbkvy.supabase.co',
      publishableKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF6ampuZHFlY3BlbWx0dmRia3Z5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3OTA3ODEsImV4cCI6MjEwMjM2Njc4MX0.grBF4XJu0696MnrvKC-ZccppLGxPEM9KIHED8viZELc',
    );
    debugPrint('SupabaseService: Initialized');
  }

  // ─────────────────────────────────────────
  // AUTH
  // ─────────────────────────────────────────

  /// Sign up with email and password
  static Future<AuthResponse> signUp({
    required String email,
    required String password,
    required String fullName,
    required String phone,
  }) async {
    final response = await _client.auth.signUp(
      email: email,
      password: password,
      data: {'full_name': fullName, 'phone': phone},
    );

    // The user record is automatically inserted into public.users via a Supabase trigger
    // on the auth.users table (handle_new_user).

    return response;
  }

  /// Sign in with email and password
  static Future<AuthResponse> signIn({
    required String email,
    required String password,
  }) async {
    return await _client.auth.signInWithPassword(
      email: email,
      password: password,
    );
  }

  /// Request password reset email
  static Future<void> resetPassword(String email) async {
    await _client.auth.resetPasswordForEmail(
      email,
      redirectTo: kIsWeb ? '${Uri.base.origin}/reset-password' : null,
    );
  }

  static bool _isGoogleSignInInitialized = false;

  static Future<AuthResponse?> signInWithGoogle() async {
    // On Web, the google_sign_in plugin's interactive authenticate() method is unsupported.
    // We use Supabase's built-in OAuth flow which redirects to Google securely.
    if (kIsWeb) {
      await _client.auth.signInWithOAuth(
        OAuthProvider.google,
        redirectTo: '${Uri.base.origin}/',
        queryParams: {'prompt': 'select_account'},
      );
      // The browser will redirect to Google and then back to the app, so we return null.
      return null;
    }

    // On Mobile (Android/iOS), use the native google_sign_in plugin

    const webClientId =
        '878569392531-9uv232dv0r3h7n4aflmt3joncj5f43hs.apps.googleusercontent.com';
    // TODO: Replace with your actual iOS Client ID from Google Cloud Console (if supporting iOS)
    const iosClientId = 'YOUR_IOS_CLIENT_ID.apps.googleusercontent.com';

    if (!_isGoogleSignInInitialized) {
      await GoogleSignIn.instance.initialize(
        clientId: iosClientId,
        serverClientId: webClientId,
      );
      _isGoogleSignInInitialized = true;
    }

    final googleUser = await GoogleSignIn.instance.authenticate();
    final googleAuth = googleUser.authentication;
    final idToken = googleAuth.idToken;

    if (idToken == null) {
      throw 'No ID Token found.';
    }

    return _client.auth.signInWithIdToken(
      provider: OAuthProvider.google,
      idToken: idToken,
    );
  }

  /// Sign out
  static Future<void> signOut() async {
    await _client.auth.signOut();
  }

  /// Get current user
  static User? get currentUser => _client.auth.currentUser;

  /// Check if a user has completed/seen onboarding.
  /// Checks both SharedPreferences (local cache) and Supabase user metadata.
  static Future<bool> hasUserSeenOnboarding([String? userId]) async {
    final uid = userId ?? currentUser?.id;
    if (uid == null) return false;

    // 1. Check local SharedPreferences for this specific user
    final prefs = await SharedPreferences.getInstance();
    final localSeen = prefs.getBool('onboarding_seen_$uid');
    if (localSeen != null) return localSeen;

    // 2. Check Supabase user metadata
    final metadata = currentUser?.userMetadata;
    if (metadata != null &&
        (metadata['has_seen_onboarding'] == true ||
            metadata['has_seen_onboarding'] == 'true')) {
      // Cache locally
      await prefs.setBool('onboarding_seen_$uid', true);
      return true;
    }

    return false;
  }

  /// Mark onboarding as completed for a user.
  /// Saves to local SharedPreferences and updates Supabase user metadata.
  static Future<void> markOnboardingSeen([String? userId]) async {
    final uid = userId ?? currentUser?.id;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('onboarding_seen', true);

    if (uid != null) {
      await prefs.setBool('onboarding_seen_$uid', true);
      try {
        await _client.auth.updateUser(
          UserAttributes(data: {'has_seen_onboarding': true}),
        );
      } catch (e) {
        debugPrint('SupabaseService: Note - could not update user metadata: $e');
      }
    }
  }

  // ─────────────────────────────────────────
  // PROFILE & SETTINGS
  // ─────────────────────────────────────────

  /// Get current user profile
  static Future<Map<String, dynamic>?> getUserProfile() async {
    final userId = currentUser?.id;
    if (userId == null) return null;

    final response = await _client
        .from('users')
        .select()
        .eq('id', userId)
        .maybeSingle();
    return response;
  }

  /// Get accessibility settings
  static Future<Map<String, dynamic>?> getAccessibilitySettings() async {
    final userId = currentUser?.id;
    if (userId == null) return null;

    final response = await _client
        .from('accessibility_settings')
        .select()
        .eq('user_id', userId)
        .maybeSingle();
    return response;
  }

  /// Update user profile
  static Future<void> updateUserProfile({
    required String fullName,
    required String phone,
  }) async {
    final userId = currentUser?.id;
    if (userId == null) return;

    await _client
        .from('users')
        .update({'full_name': fullName, 'phone_number': phone})
        .eq('id', userId);
  }

  /// Update accessibility settings
  static Future<void> updateAccessibilitySettings({
    required bool highContrast,
    required String fontSize,
  }) async {
    final userId = currentUser?.id;
    if (userId == null) return;

    await _client.from('accessibility_settings').upsert({
      'user_id': userId,
      'high_contrast': highContrast,
      'font_size': fontSize,
    });
  }

  // ─────────────────────────────────────────
  // QUEUE — Real-time
  // ─────────────────────────────────────────

  /// Join the waitlist queue
  static Future<Map<String, dynamic>?> joinQueue({
    required String restaurantId,
    required int partySize,
  }) async {
    final userId = currentUser?.id;
    if (userId == null) return null;

    final response = await _client
        .from('queue_entries')
        .insert({'user_id': userId, 'pax': partySize, 'status': 'waiting'})
        .select()
        .single();
    return response;
  }

  /// Leave the queue
  static Future<void> leaveQueue(String queueEntryId) async {
    await _client
        .from('queue_entries')
        .update({'status': 'cancelled'})
        .eq('id', queueEntryId);
  }

  /// Subscribe to live queue position updates for a user
  static RealtimeChannel subscribeToQueue({
    required String userId,
    required void Function(Map<String, dynamic> payload) onUpdate,
  }) {
    return _client
        .channel('queue_updates_$userId')
        .onPostgresChanges(
          event: PostgresChangeEvent.update,
          schema: 'public',
          table: 'queue_entries',
          filter: PostgresChangeFilter(
            type: PostgresChangeFilterType.eq,
            column: 'user_id',
            value: userId,
          ),
          callback: (payload) => onUpdate(payload.newRecord),
        )
        .subscribe();
  }

  // ─────────────────────────────────────────
  // ORDERS — Real-time
  // ─────────────────────────────────────────

  /// Place a pre-order
  static Future<Map<String, dynamic>?> placeOrder({
    required String tableId,
    required List<Map<String, dynamic>> items,
    required double totalAmount,
  }) async {
    final userId = currentUser?.id;
    if (userId == null) return null;

    final response = await _client
        .from('orders')
        .insert({
          'user_id': userId,
          'table_id': tableId,
          'items': items,
          'total_amount': totalAmount,
          'status': 'pending',
        })
        .select()
        .single();
    return response;
  }

  /// Subscribe to live order status updates
  static RealtimeChannel subscribeToOrder({
    required String orderId,
    required void Function(String status) onStatusChange,
  }) {
    return _client
        .channel('order_status_$orderId')
        .onPostgresChanges(
          event: PostgresChangeEvent.update,
          schema: 'public',
          table: 'orders',
          filter: PostgresChangeFilter(
            type: PostgresChangeFilterType.eq,
            column: 'id',
            value: orderId,
          ),
          callback: (payload) {
            final newStatus = payload.newRecord['status'] as String?;
            if (newStatus != null) onStatusChange(newStatus);
          },
        )
        .subscribe();
  }

  // ─────────────────────────────────────────
  // RESERVATIONS
  // ─────────────────────────────────────────

  /// Book a table reservation
  static Future<Map<String, dynamic>?> createReservation({
    required String tableId,
    required String restaurantId,
    required DateTime reservationTime,
    required int partySize,
    String? specialRequests,
  }) async {
    final userId = currentUser?.id;
    if (userId == null) return null;

    final response = await _client
        .from('reservations')
        .insert({
          'user_id': userId,
          'table_id': tableId,
          'reservation_date':
              '${reservationTime.year}-${reservationTime.month.toString().padLeft(2, '0')}-${reservationTime.day.toString().padLeft(2, '0')}',
          'reservation_time':
              '${reservationTime.hour.toString().padLeft(2, '0')}:${reservationTime.minute.toString().padLeft(2, '0')}:00',
          'pax': partySize,
          'status': 'confirmed',
        })
        .select()
        .single();
    return response;
  }

  /// Get user's reservations
  static Future<List<Map<String, dynamic>>> getUserReservations() async {
    final userId = currentUser?.id;
    if (userId == null) return [];

    final response = await _client
        .from('reservations')
        .select()
        .eq('user_id', userId)
        .order('reservation_time', ascending: false);

    return List<Map<String, dynamic>>.from(response);
  }

  // ─────────────────────────────────────────
  // MENU
  // ─────────────────────────────────────────

  static final Map<int, Map<String, dynamic>> fallbackCustomizations = {
    4: {
      'sizes': [
        {'id': 'reg', 'name': 'Regular Portion (250g)', 'price_delta': 0, 'is_available': true},
        {'id': 'large', 'name': 'King Cut (400g)', 'price_delta': 1200, 'is_available': true},
      ],
      'addon_groups': [
        {
          'id': 'sauce',
          'name': 'Signature Sauce',
          'min_select': 1,
          'max_select': 1,
          'options': [
            {'id': 'red_wine', 'name': 'Red Wine Glaze', 'price': 0, 'max_qty': 1, 'is_available': true},
            {'id': 'truffle_pepper', 'name': 'Truffle Peppercorn', 'price': 250, 'max_qty': 1, 'is_available': true},
            {'id': 'chimichurri', 'name': 'Herb Chimichurri', 'price': 0, 'max_qty': 1, 'is_available': true},
          ],
        },
        {
          'id': 'gourmet_extras',
          'name': 'Gourmet Add-ons',
          'min_select': 0,
          'max_select': 3,
          'options': [
            {'id': 'bone_marrow', 'name': 'Roasted Bone Marrow', 'price': 800, 'max_qty': 1, 'is_available': true},
            {'id': 'extra_mash', 'name': 'Extra Truffle Mash', 'price': 450, 'max_qty': 2, 'is_available': true},
            {'id': 'asparagus', 'name': 'Charred Asparagus', 'price': 350, 'max_qty': 1, 'is_available': true},
            {'id': 'foie_gras', 'name': 'Seared Foie Gras', 'price': 1200, 'max_qty': 1, 'is_available': false},
          ],
        },
      ],
      'preferences': ['Medium Rare', 'Medium', 'Medium Well', 'Well Done'],
    },
    5: {
      'sizes': [
        {'id': 'reg', 'name': 'Standard Bowl', 'price_delta': 0, 'is_available': true},
        {'id': 'sharing', 'name': 'Sharing Platter', 'price_delta': 900, 'is_available': true},
      ],
      'addon_groups': [
        {
          'id': 'cheese_extras',
          'name': 'Cheeses & Toppings',
          'min_select': 0,
          'max_select': 2,
          'options': [
            {'id': 'black_truffle', 'name': 'Shaved Fresh Truffle', 'price': 650, 'max_qty': 1, 'is_available': true},
            {'id': 'parmesan_crisp', 'name': 'Aged Parmesan Crisp', 'price': 200, 'max_qty': 2, 'is_available': true},
            {'id': 'wild_porcini', 'name': 'Wild Porcini Mushrooms', 'price': 400, 'max_qty': 1, 'is_available': true},
          ],
        },
      ],
      'preferences': ['Classic Al Dente', 'Extra Creamy', 'Less Cream'],
    },
    3: {
      'sizes': [
        {'id': 'reg', 'name': 'Single Starter', 'price_delta': 0, 'is_available': true},
        {'id': 'large', 'name': 'Double Portion', 'price_delta': 1500, 'is_available': true},
      ],
      'addon_groups': [
        {
          'id': 'dressing',
          'name': 'Artisanal Dressing',
          'min_select': 1,
          'max_select': 1,
          'options': [
            {'id': 'truffle_aioli', 'name': 'Truffle Aioli', 'price': 0, 'max_qty': 1, 'is_available': true},
            {'id': 'lemon_caper', 'name': 'Lemon Caper Vinaigrette', 'price': 0, 'max_qty': 1, 'is_available': true},
          ],
        },
        {
          'id': 'garnishes',
          'name': 'Premium Garnishes',
          'min_select': 0,
          'max_select': 2,
          'options': [
            {'id': 'capers', 'name': 'Fried Baby Capers', 'price': 150, 'max_qty': 1, 'is_available': true},
            {'id': 'microgreens', 'name': 'Organic Microgreens', 'price': 180, 'max_qty': 1, 'is_available': true},
          ],
        },
      ],
      'preferences': ['Light Dressing', 'Dressing on Side'],
    },
    8: {
      'sizes': [
        {'id': 'reg', 'name': 'Regular (350ml)', 'price_delta': 0, 'is_available': true},
        {'id': 'large', 'name': 'Pitcher (750ml)', 'price_delta': 450, 'is_available': true},
      ],
      'addon_groups': [
        {
          'id': 'sweetness',
          'name': 'Sweetness Level',
          'min_select': 1,
          'max_select': 1,
          'options': [
            {'id': 'no_sugar', 'name': 'No Added Sugar', 'price': 0, 'max_qty': 1, 'is_available': true},
            {'id': 'honey', 'name': 'Wild Honey', 'price': 60, 'max_qty': 1, 'is_available': true},
            {'id': 'classic', 'name': 'Classic Cane Sugar', 'price': 0, 'max_qty': 1, 'is_available': true},
          ],
        },
        {
          'id': 'refreshers',
          'name': 'Fresh Infusions',
          'min_select': 0,
          'max_select': 2,
          'options': [
            {'id': 'mint', 'name': 'Crushed Mint Leaves', 'price': 50, 'max_qty': 1, 'is_available': true},
            {'id': 'chia', 'name': 'Chia Seeds', 'price': 80, 'max_qty': 1, 'is_available': true},
            {'id': 'lime', 'name': 'Fresh Lime Squeeze', 'price': 50, 'max_qty': 1, 'is_available': true},
          ],
        },
      ],
      'preferences': ['Extra Ice', 'No Ice', 'Less Ice'],
    },
  };

  /// Get all available menu items
  static Future<List<Map<String, dynamic>>> getMenuItems() async {
    final response = await _client
        .from('menu_items')
        .select()
        .eq('is_available', true)
        .order('category');

    final items = List<Map<String, dynamic>>.from(response);
    for (final item in items) {
      final id = (item['id'] as num?)?.toInt();
      if (item['customizations'] == null && id != null && fallbackCustomizations.containsKey(id)) {
        item['customizations'] = fallbackCustomizations[id];
      }
    }
    return items;
  }

  // ─────────────────────────────────────────
  // TABLES
  // ─────────────────────────────────────────

  /// Get all restaurant tables
  static Future<List<Map<String, dynamic>>> getTables() async {
    final response = await _client
        .from('restaurant_tables')
        .select('*, table_categories(name)')
        .order('table_number');

    return List<Map<String, dynamic>>.from(response);
  }
}

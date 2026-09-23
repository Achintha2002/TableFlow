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

  static final List<Map<String, dynamic>> fallbackRichMenuItems = [
    // Starters
    {
      'name': 'Seared Hokkaido Scallops',
      'description': 'Pan-seared premium scallops, served atop a silky cauliflower purée with crispy pancetta dust.',
      'price': 28.00,
      'category': 'Starters',
      'image_url': 'https://images.unsplash.com/photo-1599084993091-1cb5c0721cc6?q=80&w=600&auto=format&fit=crop',
      'is_available': true,
    },
    {
      'name': 'Artisanal Burrata',
      'description': 'Fresh Italian burrata with virgin heirloom tomatoes, basil oil, and aged balsamic glaze.',
      'price': 22.00,
      'category': 'Starters',
      'image_url': 'https://images.unsplash.com/photo-1608897013039-887f21d8c804?q=80&w=600&auto=format&fit=crop',
      'is_available': true,
    },
    {
      'name': 'Wagyu Beef Carpaccio',
      'description': 'Thinly sliced grade A5 wagyu, truffle aioli, shaved parmesan, caper berries, and micro arugula.',
      'price': 34.00,
      'category': 'Starters',
      'image_url': 'https://images.unsplash.com/photo-1550547660-d9450f859349?q=80&w=600&auto=format&fit=crop',
      'is_available': true,
    },
    {
      'name': 'Lobster Bisque Velouté',
      'description': 'Velvety Maine lobster bisque infused with aged cognac and tarragon crème fraîche.',
      'price': 24.00,
      'category': 'Starters',
      'image_url': 'https://images.unsplash.com/photo-1547592166-23ac45744acd?q=80&w=600&auto=format&fit=crop',
      'is_available': true,
    },
    {
      'name': 'Truffle & Taleggio Arancini',
      'description': 'Crispy carnaroli saffron rice croquettes filled with melted taleggio cheese and roasted garlic aioli.',
      'price': 18.00,
      'category': 'Starters',
      'image_url': 'https://images.unsplash.com/photo-1541529086526-db283c563270?q=80&w=600&auto=format&fit=crop',
      'is_available': true,
    },

    // Mains
    {
      'name': 'Braised Short Rib',
      'description': 'Slow-cooked beef short rib with truffle mashed potatoes and rich Cabernet Sauvignon reduction.',
      'price': 42.00,
      'category': 'Mains',
      'image_url': 'https://images.unsplash.com/photo-1544025162-d76694265947?q=80&w=600&auto=format&fit=crop',
      'is_available': true,
    },
    {
      'name': 'Truffle Mushroom Risotto',
      'description': 'Creamy carnaroli rice with wild forest mushrooms, 24-month Parmigiano crisp, and white truffle essence.',
      'price': 26.00,
      'category': 'Mains',
      'image_url': 'https://images.unsplash.com/photo-1633337474564-1d94faee6266?q=80&w=600&auto=format&fit=crop',
      'is_available': true,
    },
    {
      'name': 'Chilean Sea Bass',
      'description': 'Pan-roasted Chilean sea bass with sweet miso glaze, tender baby bok choy, and lemongrass dashi.',
      'price': 48.00,
      'category': 'Mains',
      'image_url': 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?q=80&w=600&auto=format&fit=crop',
      'is_available': true,
    },
    {
      'name': 'Prime Dry-Aged Ribeye',
      'description': '28-day aged USDA Prime ribeye steak, roasted bone marrow, charred rosemary herb butter, and sea salt.',
      'price': 56.00,
      'category': 'Mains',
      'image_url': 'https://images.unsplash.com/photo-1558030006-450675393462?q=80&w=600&auto=format&fit=crop',
      'is_available': true,
    },
    {
      'name': 'Handmade Tagliolini al Tartufo',
      'description': 'Fresh artisanal egg pasta twirled in French cultured butter, Parmigiano Reggiano, and freshly shaved black truffle.',
      'price': 32.00,
      'category': 'Mains',
      'image_url': 'https://images.unsplash.com/photo-1621996346565-e3d5d62816f1?q=80&w=600&auto=format&fit=crop',
      'is_available': true,
    },
    {
      'name': 'Pan-Roasted Spiced Duck Breast',
      'description': 'Magret duck breast with blood orange Grand Marnier reduction, parsnip purée, and honey-glazed baby carrots.',
      'price': 38.00,
      'category': 'Mains',
      'image_url': 'https://images.unsplash.com/photo-1514944298352-7b0032c25345?q=80&w=600&auto=format&fit=crop',
      'is_available': true,
    },

    // Desserts
    {
      'name': 'Valrhona Grand Cru Soufflé',
      'description': 'Warm single-origin Valrhona dark chocolate soufflé accompanied by Tahitian vanilla bean gelato.',
      'price': 18.00,
      'category': 'Desserts',
      'image_url': 'https://images.unsplash.com/photo-1579954115545-a95591f28bfc?q=80&w=600&auto=format&fit=crop',
      'is_available': true,
    },
    {
      'name': 'Artisanal Pistachio Tiramisu',
      'description': 'Bronte pistachio mascarpone cream layered with espresso-soaked savoiardi and crushed roasted pistachios.',
      'price': 16.00,
      'category': 'Desserts',
      'image_url': 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?q=80&w=600&auto=format&fit=crop',
      'is_available': true,
    },
    {
      'name': 'Madagascar Vanilla Crème Brûlée',
      'description': 'Velvety custard base topped with a brittle caramelized turbinado shell and fresh wild raspberries.',
      'price': 15.00,
      'category': 'Desserts',
      'image_url': 'https://images.unsplash.com/photo-1470124182917-cc6e71b22ecc?q=80&w=600&auto=format&fit=crop',
      'is_available': true,
    },
    {
      'name': 'Mango & Passion Fruit Panna Cotta',
      'description': 'Silky coconut cream panna cotta with Alphonso mango coulis, passion fruit pulp, and candied mint.',
      'price': 14.00,
      'category': 'Desserts',
      'image_url': 'https://images.unsplash.com/photo-1488477181946-6428a0291777?q=80&w=600&auto=format&fit=crop',
      'is_available': true,
    },

    // Drinks
    {
      'name': 'Smoked Rosemary Old Fashioned',
      'description': 'Small-batch Kentucky bourbon, Angostura bitters, pure maple syrup, infused with torch-smoked organic rosemary.',
      'price': 20.00,
      'category': 'Drinks',
      'image_url': 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?q=80&w=600&auto=format&fit=crop',
      'is_available': true,
    },
    {
      'name': 'Botanical Hibiscus Spritz',
      'description': 'Artisanal London dry gin, wild hibiscus flower reduction, elderflower liqueur, topped with crisp chilled Prosecco.',
      'price': 16.00,
      'category': 'Drinks',
      'image_url': 'https://images.unsplash.com/photo-1556881286-fc6915169721?q=80&w=600&auto=format&fit=crop',
      'is_available': true,
    },
    {
      'name': 'Imperial Matcha Ceremony Latte',
      'description': 'First-harvest ceremonial grade Uji matcha whisked with silky steamed oat milk and raw wildflower honey.',
      'price': 12.00,
      'category': 'Drinks',
      'image_url': 'https://images.unsplash.com/photo-1536256263959-770b48d82b0a?q=80&w=600&auto=format&fit=crop',
      'is_available': true,
    },
    {
      'name': 'Yuzu Lychee Sparkler',
      'description': 'Refreshing non-alcoholic elixir of Japanese yuzu juice, white lychee nectar, fresh mint, and sparkling mineral water.',
      'price': 14.00,
      'category': 'Drinks',
      'image_url': 'https://images.unsplash.com/photo-1536935338788-846bb9981813?q=80&w=600&auto=format&fit=crop',
      'is_available': true,
    },
    {
      'name': 'Single-Origin Ethiopian Pour-Over',
      'description': 'Specialty washed Yirgacheffe coffee beans presenting floral jasmine and citrus notes, freshly brewed.',
      'price': 10.00,
      'category': 'Drinks',
      'image_url': 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?q=80&w=600&auto=format&fit=crop',
      'is_available': true,
    },
  ];

  /// Get all available menu items
  static Future<List<Map<String, dynamic>>> getMenuItems() async {
    try {
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

      // If DB has fewer than 15 items, supplement with rich luxury menu items
      if (items.length < 15) {
        final existingNames = items
            .map((i) => (i['name'] as String? ?? '').toLowerCase().trim())
            .toSet();
        int mockId = 100;
        for (final fallback in fallbackRichMenuItems) {
          final fallbackName = (fallback['name'] as String? ?? '').toLowerCase().trim();
          if (!existingNames.contains(fallbackName)) {
            final merged = Map<String, dynamic>.from(fallback);
            merged['id'] = mockId++;
            items.add(merged);
          }
        }
      }

      return items;
    } catch (e) {
      debugPrint('Error fetching menu items: $e');
      int mockId = 100;
      return fallbackRichMenuItems.map((i) {
        final m = Map<String, dynamic>.from(i);
        m['id'] = mockId++;
        return m;
      }).toList();
    }
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

import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:flutter/foundation.dart';

class SupabaseService {
  static final SupabaseClient _client = Supabase.instance.client;

  static SupabaseClient get client => _client;

  /// Initialize Supabase — called once in main()
  static Future<void> initialize() async {
    await Supabase.initialize(
      url: 'https://azjjndqecpemltvdbkvy.supabase.co',
      anonKey:
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF6ampuZHFlY3BlbWx0dmRia3Z5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3OTA3ODEsImV4cCI6MjEwMjM2Njc4MX0.grBF4XJu0696MnrvKC-ZccppLGxPEM9KIHED8viZELc',
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
    return await _client.auth.signUp(
      email: email,
      password: password,
      data: {'full_name': fullName, 'phone': phone},
    );
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

  /// Sign out
  static Future<void> signOut() async {
    await _client.auth.signOut();
  }

  /// Get current user
  static User? get currentUser => _client.auth.currentUser;

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
        .insert({
          'user_id': userId,
          'restaurant_id': restaurantId,
          'party_size': partySize,
          'status': 'waiting',
        })
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
          'restaurant_id': restaurantId,
          'reservation_time': reservationTime.toIso8601String(),
          'party_size': partySize,
          'status': 'confirmed',
          'special_requests': specialRequests,
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

  /// Get menu items for a restaurant
  static Future<List<Map<String, dynamic>>> getMenuItems(
      String restaurantId) async {
    final response = await _client
        .from('menu_items')
        .select()
        .eq('restaurant_id', restaurantId)
        .eq('is_available', true)
        .order('category');

    return List<Map<String, dynamic>>.from(response);
  }
}

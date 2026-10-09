import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:flutter/foundation.dart';
import '../core/constants.dart';
import 'supabase_service.dart';

class ApiService {
  static String get baseUrl => '${AppConstants.backendUrl}/api';

  /// Helper to get headers with the Supabase JWT token
  static Future<Map<String, String>> _getHeaders({String? idempotencyKey}) async {
    var session = SupabaseService.client.auth.currentSession;
    if (session == null || session.isExpired) {
      try {
        final res = await SupabaseService.client.auth.refreshSession();
        session = res.session;
      } catch (_) {}
    }
    final token = session?.accessToken;

    final headers = <String, String>{
      'Content-Type': 'application/json',
    };

    if (token != null) {
      headers['Authorization'] = 'Bearer $token';
    }
    if (idempotencyKey != null) {
      headers['Idempotency-Key'] = idempotencyKey;
    }

    return headers;
  }

  /// Verify scanned QR code, token, or table number
  static Future<Map<String, dynamic>> verifyTableQr({
    String? token,
    String? rawCode,
    int? tableNumber,
    int? tableId,
    String? userId,
  }) async {
    try {
      final headers = await _getHeaders();
      final body = <String, dynamic>{};
      if (token != null && token.isNotEmpty) body['token'] = token;
      if (rawCode != null && rawCode.isNotEmpty) body['rawCode'] = rawCode;
      if (tableNumber != null) body['tableNumber'] = tableNumber;
      if (tableId != null) body['tableId'] = tableId;
      if (userId != null && userId.isNotEmpty) body['user_id'] = userId;

      final response = await http.post(
        Uri.parse('$baseUrl/tables/verify-qr'),
        headers: headers,
        body: jsonEncode(body),
      );

      final data = jsonDecode(response.body);
      if (response.statusCode == 200) {
        return data;
      } else {
        throw Exception(data['error'] ?? 'Failed to verify table');
      }
    } catch (e) {
      debugPrint('Verify QR Error: $e');
      rethrow;
    }
  }

  /// Validate coupon code against server rules
  static Future<Map<String, dynamic>> validateCoupon(String code, double subtotal) async {
    try {
      final headers = await _getHeaders();
      final user = SupabaseService.client.auth.currentUser;
      final response = await http.post(
        Uri.parse('$baseUrl/coupons/validate'),
        headers: headers,
        body: jsonEncode({
          'code': code,
          'subtotal': subtotal,
          'user_id': user?.id,
        }),
      );

      final data = jsonDecode(response.body);
      if (response.statusCode == 200) {
        return data;
      } else {
        throw Exception(data['error'] ?? 'Invalid promo code');
      }
    } catch (e) {
      debugPrint('Validate Coupon Error: $e');
      rethrow;
    }
  }

  /// Submit customer service request (Call Waiter / Request Water / Request Bill)
  static Future<Map<String, dynamic>> submitServiceRequest({
    required int tableId,
    required String requestType,
  }) async {
    try {
      final headers = await _getHeaders();
      final user = SupabaseService.client.auth.currentUser;
      final response = await http.post(
        Uri.parse('$baseUrl/service-requests'),
        headers: headers,
        body: jsonEncode({
          'table_id': tableId,
          'request_type': requestType,
          'user_id': user?.id,
        }),
      );

      final data = jsonDecode(response.body);
      if (response.statusCode == 200 || response.statusCode == 201) {
        return data;
      } else {
        throw Exception(data['error'] ?? 'Failed to notify staff');
      }
    } catch (e) {
      debugPrint('Service Request Error: $e');
      rethrow;
    }
  }

  /// Fetch customer's active vouchers wallet
  static Future<List<Map<String, dynamic>>> fetchMyVouchers() async {
    try {
      final headers = await _getHeaders();
      final response = await http.get(
        Uri.parse('$baseUrl/vouchers/my-vouchers'),
        headers: headers,
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        return List<Map<String, dynamic>>.from(data['vouchers'] ?? []);
      }
      throw Exception('Failed to load vouchers');
    } catch (e) {
      debugPrint('Fetch My Vouchers HTTP Error: $e, falling back to Supabase');
      // Direct Supabase fallback
      final user = SupabaseService.client.auth.currentUser;
      if (user == null) return [];

      final data = await SupabaseService.client
          .from('user_vouchers')
          .select('*, coupons(*)')
          .eq('user_id', user.id)
          .filter('used_at', 'is', null)
          .order('claimed_at', ascending: false);

      return (data as List).map((v) {
        final c = v['coupons'] as Map<String, dynamic>?;
        return {
          'id': v['id'],
          'code': v['coupon_code'],
          'source': v['source'],
          'claimed_at': v['claimed_at'],
          'discount_percent': c?['discount_percent'] ?? 10,
          'discount_amount': c?['discount_amount'] ?? 0,
          'min_order_amount': c?['min_order_amount'] ?? 0,
          'description': c?['description'] ?? 'Exclusive discount voucher',
          'valid_until': c?['valid_until'],
        };
      }).toList();
    }
  }

  /// Fetch user's discount tasks & progress
  static Future<List<Map<String, dynamic>>> fetchMyTasks() async {
    try {
      final headers = await _getHeaders();
      final response = await http.get(
        Uri.parse('$baseUrl/vouchers/my-tasks'),
        headers: headers,
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        return List<Map<String, dynamic>>.from(data['tasks'] ?? []);
      }
      throw Exception('Failed to load tasks');
    } catch (e) {
      debugPrint('Fetch My Tasks HTTP Error: $e, falling back to Supabase');
      final user = SupabaseService.client.auth.currentUser;
      if (user == null) return [];

      final data = await SupabaseService.client
          .from('user_discount_tasks')
          .select('*')
          .eq('user_id', user.id);

      return List<Map<String, dynamic>>.from(data);
    }
  }

  /// Claim 10% voucher for a completed task
  static Future<Map<String, dynamic>> claimTaskReward(String taskKey) async {
    try {
      final headers = await _getHeaders();
      final response = await http.post(
        Uri.parse('$baseUrl/vouchers/claim-task'),
        headers: headers,
        body: jsonEncode({'task_key': taskKey}),
      );

      final data = jsonDecode(response.body);
      if (response.statusCode == 200) {
        return data;
      } else {
        throw Exception(data['error'] ?? 'Failed to claim reward');
      }
    } catch (e) {
      debugPrint('Claim Task Reward Error: $e');
      rethrow;
    }
  }

  /// Request customer account deletion (initiates 30-day grace period)
  static Future<Map<String, dynamic>> requestAccountDeletion() async {
    try {
      final headers = await _getHeaders();
      final response = await http.delete(
        Uri.parse('$baseUrl/users/me'),
        headers: headers,
      );

      final data = jsonDecode(response.body);
      if (response.statusCode == 200) {
        return {
          'success': true,
          'message': data['message'] ?? 'Account scheduled for deletion in 30 days',
          'scheduled_deletion_at': data['scheduled_deletion_at'],
        };
      } else {
        return {
          'success': false,
          'error': data['error'] ?? 'Failed to schedule account deletion',
          'blockType': data['blockType'],
        };
      }
    } catch (e) {
      debugPrint('Request Account Deletion Error: $e');
      return {
        'success': false,
        'error': 'Network connection error. Please try again.',
      };
    }
  }

  /// Cancel scheduled account deletion and restore normal account status
  static Future<Map<String, dynamic>> cancelAccountDeletion() async {
    try {
      final headers = await _getHeaders();
      final response = await http.post(
        Uri.parse('$baseUrl/users/me/cancel-deletion'),
        headers: headers,
      );

      final data = jsonDecode(response.body);
      if (response.statusCode == 200) {
        return {
          'success': true,
          'message': data['message'] ?? 'Account deletion cancelled successfully',
        };
      } else {
        return {
          'success': false,
          'error': data['error'] ?? 'Failed to cancel account deletion',
        };
      }
    } catch (e) {
      debugPrint('Cancel Account Deletion Error: $e');
      return {
        'success': false,
        'error': 'Network connection error. Please try again.',
      };
    }
  }
}


import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:flutter/foundation.dart';
import 'supabase_service.dart';

class ApiService {
  static String get baseUrl {
    if (kIsWeb) return 'http://localhost:3000/api';
    if (defaultTargetPlatform == TargetPlatform.android) {
      return 'http://10.0.2.2:3000/api';
    }
    return 'http://localhost:3000/api';
  }

  /// Helper to get headers with the Supabase JWT token
  static Future<Map<String, String>> _getHeaders({String? idempotencyKey}) async {
    final session = SupabaseService.client.auth.currentSession;
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
  }) async {
    try {
      final headers = await _getHeaders();
      final body = <String, dynamic>{};
      if (token != null && token.isNotEmpty) body['token'] = token;
      if (rawCode != null && rawCode.isNotEmpty) body['rawCode'] = rawCode;
      if (tableNumber != null) body['tableNumber'] = tableNumber;
      if (tableId != null) body['tableId'] = tableId;

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
}

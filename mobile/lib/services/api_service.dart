import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:flutter/foundation.dart';
import 'supabase_service.dart';

class ApiService {
  // Using localhost for iOS emulator, 10.0.2.2 for Android emulator
  // For Web, localhost is usually fine.
  static const String _baseUrl = 'http://localhost:3000/api';

  /// Helper to get headers with the Supabase JWT token
  static Future<Map<String, String>> _getHeaders() async {
    final session = SupabaseService.client.auth.currentSession;
    final token = session?.accessToken;

    if (token == null) {
      throw Exception('User is not authenticated. No token found.');
    }

    return {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer $token',
    };
  }

  /// Test the backend connection
  static Future<Map<String, dynamic>> testConnection() async {
    try {
      final headers = await _getHeaders();
      
      final response = await http.get(
        Uri.parse('$_baseUrl/me'),
        headers: headers,
      );

      if (response.statusCode == 200) {
        return json.decode(response.body);
      } else {
        throw Exception('Failed to connect: ${response.statusCode} - ${response.body}');
      }
    } catch (e) {
      debugPrint('API Error: $e');
      rethrow;
    }
  }
}

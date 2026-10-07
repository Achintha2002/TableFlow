import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:intl/intl.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'api_service.dart';

class OperatingHoursService extends ChangeNotifier {
  static final OperatingHoursService _instance = OperatingHoursService._internal();
  factory OperatingHoursService() => _instance;
  OperatingHoursService._internal();

  TimeOfDay _openTime = const TimeOfDay(hour: 8, minute: 0);
  TimeOfDay _closeTime = const TimeOfDay(hour: 23, minute: 0);
  int _cutoffMinutes = 60;
  bool _isOpenToday = true;
  String? _todayClosureReason;
  final Map<String, Map<String, dynamic>> _closuresByDate = {};
  bool _isLoaded = false;
  RealtimeChannel? _realtimeChannel;

  TimeOfDay get openTime => _openTime;
  TimeOfDay get closeTime => _closeTime;
  int get cutoffMinutes => _cutoffMinutes;
  bool get isOpenToday => _isOpenToday;
  String? get todayClosureReason => _todayClosureReason;
  Map<String, Map<String, dynamic>> get closuresByDate => _closuresByDate;
  bool get isLoaded => _isLoaded;

  List<Map<String, dynamic>> get upcomingClosures {
    final now = DateTime.now();
    final todayKey = formatDateKey(now);
    final list = _closuresByDate.values
        .where((c) => (c['close_date']?.toString() ?? '').compareTo(todayKey) >= 0)
        .toList();
    list.sort((a, b) => (a['close_date'] ?? '').compareTo(b['close_date'] ?? ''));
    return list;
  }

  int get openMinutes => _openTime.hour * 60 + _openTime.minute;
  int get closeMinutes => _closeTime.hour * 60 + _closeTime.minute;
  int get lastBookingMinutes => (_closeTime.hour * 60 + _closeTime.minute) - _cutoffMinutes;

  String formatTime(TimeOfDay time) {
    final now = DateTime.now();
    final dt = DateTime(now.year, now.month, now.day, time.hour, time.minute);
    return DateFormat('h:mm a').format(dt);
  }

  String get openTimeFormatted => formatTime(_openTime);
  String get closeTimeFormatted => formatTime(_closeTime);

  String get lastBookingTimeFormatted {
    final totalMins = lastBookingMinutes;
    if (totalMins < 0) return '--:--';
    final h = totalMins ~/ 60;
    final m = totalMins % 60;
    final now = DateTime.now();
    final dt = DateTime(now.year, now.month, now.day, h, m);
    return DateFormat('h:mm a').format(dt);
  }

  String get operatingHoursString => '$openTimeFormatted – $closeTimeFormatted';

  /// Check whether the restaurant is currently open right this minute
  bool isCurrentlyOpen() {
    if (!_isOpenToday) return false;
    final now = DateTime.now();
    final currentMinutes = now.hour * 60 + now.minute;
    return currentMinutes >= openMinutes && currentMinutes < closeMinutes;
  }

  /// Check if a given reservation time is within the allowed booking window
  bool isTimeWithinOperatingHours(TimeOfDay time) {
    final minutes = time.hour * 60 + time.minute;
    return minutes >= openMinutes && minutes <= lastBookingMinutes;
  }

  /// Format a DateTime as YYYY-MM-DD
  String formatDateKey(DateTime date) {
    return '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';
  }

  /// Check if a specific date has a scheduled closure
  Map<String, dynamic>? getClosureForDate(DateTime date) {
    final key = formatDateKey(date);
    return _closuresByDate[key];
  }

  bool isDateClosed(DateTime date) {
    final closure = getClosureForDate(date);
    if (closure == null) return false;
    return closure['is_full_day'] == true;
  }

  /// Initialize service and real-time subscription
  Future<void> initialize() async {
    await fetchOperatingHours();
    _setupRealtime();
  }

  /// Fetch operating hours and closures
  Future<void> fetchOperatingHours() async {
    try {
      // 1. Try fetching from public backend endpoint first
      final uri = Uri.parse('${ApiService.baseUrl}/operating-hours');
      final res = await http.get(uri).timeout(const Duration(seconds: 12));

      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        _applyBackendData(data);
        _isLoaded = true;
        notifyListeners();
        return;
      }
    } catch (e) {
      debugPrint('OperatingHoursService: Backend fetch failed, falling back to Supabase: $e');
    }

    // 2. Fallback to querying Supabase directly
    try {
      final client = Supabase.instance.client;

      // Fetch config
      final hoursRow = await client
          .from('restaurant_operating_hours')
          .select('*')
          .eq('id', 1)
          .maybeSingle();

      if (hoursRow != null) {
        _parseHoursConfig(hoursRow);
      }

      // Fetch upcoming closures
      final now = DateTime.now();
      final todayKey = formatDateKey(now);
      final closuresRows = await client
          .from('restaurant_special_closures')
          .select('*')
          .gte('close_date', todayKey)
          .order('close_date', ascending: true);

      _closuresByDate.clear();
      _isOpenToday = true;
      _todayClosureReason = null;

      for (final row in closuresRows) {
        final dateKey = row['close_date']?.toString() ?? '';
        if (dateKey.isNotEmpty) {
          _closuresByDate[dateKey] = Map<String, dynamic>.from(row);
        }
      }
      if (_closuresByDate.containsKey(todayKey)) {
        final todayEntry = _closuresByDate[todayKey]!;
        if (todayEntry['is_full_day'] == true) {
          _isOpenToday = false;
          _todayClosureReason = todayEntry['reason']?.toString() ?? 'Closed Today';
        }
      }

      _isLoaded = true;
      notifyListeners();
    } catch (e) {
      debugPrint('OperatingHoursService: Supabase direct fetch error: $e');
    }
  }

  void _applyBackendData(Map<String, dynamic> data) {
    if (data['default_open_time'] != null) {
      _openTime = _parseTimeString(data['default_open_time'].toString());
    }
    if (data['default_close_time'] != null) {
      _closeTime = _parseTimeString(data['default_close_time'].toString());
    }
    if (data['last_booking_minutes_before_close'] != null) {
      _cutoffMinutes = int.tryParse(data['last_booking_minutes_before_close'].toString()) ?? 60;
    }

    _isOpenToday = data['is_open_today'] == true;
    if (data['closure_today'] != null) {
      _todayClosureReason = data['closure_today']['reason']?.toString();
    } else {
      _todayClosureReason = null;
    }

    _closuresByDate.clear();
    final upcoming = data['upcoming_closures'];
    if (upcoming is List) {
      for (final item in upcoming) {
        final dateKey = item['close_date']?.toString() ?? '';
        if (dateKey.isNotEmpty) {
          _closuresByDate[dateKey] = Map<String, dynamic>.from(item);
        }
      }
    }
  }

  void _parseHoursConfig(Map<String, dynamic> row) {
    if (row['default_open_time'] != null) {
      _openTime = _parseTimeString(row['default_open_time'].toString());
    }
    if (row['default_close_time'] != null) {
      _closeTime = _parseTimeString(row['default_close_time'].toString());
    }
    if (row['last_booking_minutes_before_close'] != null) {
      _cutoffMinutes = int.tryParse(row['last_booking_minutes_before_close'].toString()) ?? 60;
    }
  }

  TimeOfDay _parseTimeString(String timeStr) {
    try {
      final parts = timeStr.split(':');
      final hour = int.parse(parts[0]);
      final minute = int.parse(parts[1]);
      return TimeOfDay(hour: hour, minute: minute);
    } catch (_) {
      return const TimeOfDay(hour: 8, minute: 0);
    }
  }

  Timer? _autoSyncTimer;

  void _setupRealtime() {
    try {
      _realtimeChannel = Supabase.instance.client
          .channel('restaurant_operating_hours_sync')
          .onBroadcast(
            event: 'hours_updated',
            callback: (payload) {
              debugPrint('⚡⚡ [Realtime] Operating hours broadcast received: $payload');
              fetchOperatingHours();
            },
          )
          .onBroadcast(
            event: 'closure_updated',
            callback: (payload) {
              debugPrint('⚡⚡ [Realtime] Closure broadcast received: $payload');
              fetchOperatingHours();
            },
          )
          .onPostgresChanges(
            event: PostgresChangeEvent.all,
            schema: 'public',
            table: 'restaurant_operating_hours',
            callback: (payload) {
              debugPrint('⚡⚡ [Realtime] restaurant_operating_hours changed');
              fetchOperatingHours();
            },
          )
          .onPostgresChanges(
            event: PostgresChangeEvent.all,
            schema: 'public',
            table: 'restaurant_special_closures',
            callback: (payload) {
              debugPrint('⚡⚡ [Realtime] restaurant_special_closures changed');
              fetchOperatingHours();
            },
          )
          .subscribe((status, [error]) {
            debugPrint('⚡ [Realtime] OperatingHours channel status: $status');
          });

      // 3-second rapid background heartbeat backup
      _autoSyncTimer?.cancel();
      _autoSyncTimer = Timer.periodic(const Duration(seconds: 3), (_) {
        fetchOperatingHours();
      });
    } catch (e) {
      debugPrint('OperatingHoursService: Realtime setup warning: $e');
    }
  }

  @override
  void dispose() {
    _autoSyncTimer?.cancel();
    if (_realtimeChannel != null) {
      Supabase.instance.client.removeChannel(_realtimeChannel!);
    }
    super.dispose();
  }
}

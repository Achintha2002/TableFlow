import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../services/supabase_service.dart';
import '../screens/customer/splash_screen.dart';
import '../screens/auth/login_screen.dart';
import '../screens/auth/onboarding_screen.dart';
import '../screens/auth/register_screen.dart';
import '../screens/customer/home_screen.dart';
import '../screens/customer/menu_screen.dart';
import '../screens/customer/cart_screen.dart';
import '../screens/customer/queue_screen.dart';
import '../screens/customer/table_selection_screen.dart';
import '../screens/customer/reservation_details_screen.dart';
import '../screens/shared/profile_screen.dart';
import '../screens/shared/main_shell.dart';
import '../screens/customer/order_history_screen.dart';
import '../screens/customer/reservation_history_screen.dart';
import '../screens/customer/loyalty_screen.dart';
import '../screens/customer/qr_checkin_screen.dart';
import '../screens/customer/live_order_tracker_screen.dart';
import '../screens/staff/waiter_floor_screen.dart';
import '../screens/staff/staff_hub_screen.dart';
import '../screens/staff/manage_queue_screen.dart';
import '../screens/staff/table_status_monitor_screen.dart';
import '../screens/staff/partner_sync_screen.dart';
import '../screens/customer/table_landing_screen.dart';

class GoRouterRefreshStream extends ChangeNotifier {
  GoRouterRefreshStream(Stream<dynamic> stream) {
    notifyListeners();
    _subscription = stream.asBroadcastStream().listen(
      (dynamic _) => notifyListeners(),
    );
  }

  late final StreamSubscription<dynamic> _subscription;

  @override
  void dispose() {
    _subscription.cancel();
    super.dispose();
  }
}

class AppRoutes {
  static const splash = '/';
  static const onboarding = '/onboarding';
  static const login = '/login';
  static const register = '/register';
  static const home = '/home';
  static const menu = '/menu';
  static const cart = '/cart';
  static const queue = '/queue';
  static const tableSelection = '/table-selection';
  static const reservationDetails = '/reservation-details';
  static const profile = '/profile';
  static const orderHistory = '/order-history';
  static const reservations = '/reservations';
  static const loyalty = '/loyalty';
  static const qrCheckin = '/qr-checkin';
  static const orderTracker = '/order-tracker';
  static const waiterFloor = '/waiter-floor';
  static const staffHub = '/staff-hub';
  static const manageQueue = '/manage-queue';
  static const tableStatusMonitor = '/table-status-monitor';
  static const partnerSync = '/partner-sync';
  static const table = '/table';

  static final router = GoRouter(
    initialLocation: splash,
    refreshListenable: GoRouterRefreshStream(Supabase.instance.client.auth.onAuthStateChange),
    redirect: (context, state) async {
      final isAuth = Supabase.instance.client.auth.currentSession != null;
      final isOnboarding = state.matchedLocation == onboarding;
      final isLoginOrRegister = state.matchedLocation == login ||
          state.matchedLocation == register;

      // Whitelist of routes accessible without an active auth session (Guest Mode & Testing)
      final publicRoutes = [
        splash,
        onboarding,
        login,
        register,
        home,
        menu,
        cart,
        queue,
        tableSelection,
        profile,
        qrCheckin,
        orderHistory,
        reservations,
        loyalty,
        reservationDetails,
        orderTracker,
        waiterFloor,
        staffHub,
        manageQueue,
        tableStatusMonitor,
        partnerSync,
        table,
      ];

      // If route requires staff/strict auth and user is unauthenticated, redirect to login
      if (!isAuth && !publicRoutes.contains(state.matchedLocation)) {
        return login;
      }

      // If logged in and on login/register screens, route to redirect param or onboarding/home
      if (isAuth && isLoginOrRegister) {
        final redirectParam = state.uri.queryParameters['redirect'];
        if (redirectParam != null && redirectParam.isNotEmpty) {
          return redirectParam;
        }
        final hasSeen = await SupabaseService.hasUserSeenOnboarding();
        return hasSeen ? home : onboarding;
      }

      // If logged in and on onboarding screen, check if they already finished it
      if (isAuth && isOnboarding) {
        final hasSeen = await SupabaseService.hasUserSeenOnboarding();
        if (hasSeen) {
          return home;
        }
      }

      return null;
    },
    routes: [
      GoRoute(path: splash, builder: (context, state) => const SplashScreen()),
      GoRoute(path: onboarding, builder: (context, state) => const OnboardingScreen()),
      GoRoute(path: login, builder: (context, state) => const LoginScreen()),
      GoRoute(path: register, builder: (context, state) => const RegisterScreen()),
      
      // Screens that are NOT in the bottom navigation bar
      GoRoute(path: cart, builder: (context, state) => const CartScreen()),
      GoRoute(path: orderHistory, builder: (context, state) => const OrderHistoryScreen()),
      GoRoute(path: reservations, builder: (context, state) => const ReservationHistoryScreen()),
      GoRoute(path: loyalty, builder: (context, state) => const LoyaltyScreen()),
      GoRoute(path: qrCheckin, builder: (context, state) => const QrCheckinScreen()),
      GoRoute(
        path: table,
        builder: (context, state) {
          final token = state.uri.queryParameters['token'];
          final tNumStr = state.uri.queryParameters['tableNumber'] ?? state.uri.queryParameters['table'];
          final tIdStr = state.uri.queryParameters['tableId'];
          final extra = state.extra as Map<String, dynamic>?;

          return TableLandingScreen(
            token: token ?? extra?['token'] as String?,
            tableNumber: tNumStr != null ? int.tryParse(tNumStr) : extra?['tableNumber'] as int?,
            tableId: tIdStr != null ? int.tryParse(tIdStr) : extra?['tableId'] as int?,
          );
        },
      ),
      GoRoute(
        path: orderTracker,
        builder: (context, state) {
          final extra = state.extra as Map<String, dynamic>? ?? {};
          return LiveOrderTrackerScreen(orderId: extra['orderId']?.toString());
        },
      ),
      GoRoute(path: waiterFloor, builder: (context, state) => const WaiterFloorScreen()),
      GoRoute(path: staffHub, builder: (context, state) => const StaffHubScreen()),
      GoRoute(path: manageQueue, builder: (context, state) => const ManageQueueScreen()),
      GoRoute(path: tableStatusMonitor, builder: (context, state) => const TableStatusMonitorScreen()),
      GoRoute(path: partnerSync, builder: (context, state) => const PartnerSyncScreen()),
      GoRoute(
        path: reservationDetails,
        builder: (context, state) {
          final extra = state.extra as Map<String, dynamic>? ?? {};
          return ReservationDetailsScreen(
            tableId: extra['tableId'] ?? '',
            dbId: extra['dbId'] ?? 0,
            date: extra['date'] ?? DateTime.now().toIso8601String(),
            time: extra['time'] ?? '12:00',
            seats: extra['seats'] ?? 2,
          );
        },
      ),

      // The Shell Route that provides the Bottom Navigation Bar
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) {
          return MainShell(navigationShell: navigationShell);
        },
        branches: [
          StatefulShellBranch(routes: [GoRoute(path: home, builder: (context, state) => const HomeScreen())]),
          StatefulShellBranch(routes: [GoRoute(path: menu, builder: (context, state) => const MenuScreen())]),
          StatefulShellBranch(routes: [GoRoute(path: tableSelection, builder: (context, state) => const TableSelectionScreen())]),
          StatefulShellBranch(routes: [GoRoute(path: queue, builder: (context, state) => const QueueScreen())]),
          StatefulShellBranch(routes: [GoRoute(path: profile, builder: (context, state) => const ProfileScreen())]),
        ],
      ),
    ],
  );
}

import 'dart:async';
import 'package:flutter/material.dart';
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
import '../screens/customer/my_vouchers_screen.dart';
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
  static const myVouchers = '/my-vouchers';
  static const qrCheckin = '/qr-checkin';
  static const orderTracker = '/order-tracker';
  static const waiterFloor = '/waiter-floor';
  static const staffHub = '/staff-hub';
  static const manageQueue = '/manage-queue';
  static const tableStatusMonitor = '/table-status-monitor';
  static const partnerSync = '/partner-sync';
  static const table = '/table';

  static final GlobalKey<NavigatorState> rootNavigatorKey = GlobalKey<NavigatorState>(debugLabel: 'root');
  static final GlobalKey<NavigatorState> shellHomeKey = GlobalKey<NavigatorState>(debugLabel: 'home');
  static final GlobalKey<NavigatorState> shellMenuKey = GlobalKey<NavigatorState>(debugLabel: 'menu');
  static final GlobalKey<NavigatorState> shellTableKey = GlobalKey<NavigatorState>(debugLabel: 'table');
  static final GlobalKey<NavigatorState> shellQueueKey = GlobalKey<NavigatorState>(debugLabel: 'queue');
  static final GlobalKey<NavigatorState> shellProfileKey = GlobalKey<NavigatorState>(debugLabel: 'profile');

  static final router = GoRouter(
    navigatorKey: rootNavigatorKey,
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
      GoRoute(parentNavigatorKey: rootNavigatorKey, path: splash, builder: (context, state) => const SplashScreen()),
      GoRoute(parentNavigatorKey: rootNavigatorKey, path: onboarding, builder: (context, state) => const OnboardingScreen()),
      GoRoute(parentNavigatorKey: rootNavigatorKey, path: login, builder: (context, state) => const LoginScreen()),
      GoRoute(parentNavigatorKey: rootNavigatorKey, path: register, builder: (context, state) => const RegisterScreen()),
      
      // Screens that are NOT in the bottom navigation bar
      GoRoute(parentNavigatorKey: rootNavigatorKey, path: cart, builder: (context, state) => const CartScreen()),
      GoRoute(parentNavigatorKey: rootNavigatorKey, path: orderHistory, builder: (context, state) => const OrderHistoryScreen()),
      GoRoute(parentNavigatorKey: rootNavigatorKey, path: reservations, builder: (context, state) => const ReservationHistoryScreen()),
      GoRoute(parentNavigatorKey: rootNavigatorKey, path: loyalty, builder: (context, state) => const LoyaltyScreen()),
      GoRoute(parentNavigatorKey: rootNavigatorKey, path: myVouchers, builder: (context, state) => const MyVouchersScreen()),
      GoRoute(parentNavigatorKey: rootNavigatorKey, path: qrCheckin, builder: (context, state) => const QrCheckinScreen()),
      GoRoute(
        parentNavigatorKey: rootNavigatorKey,
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
        parentNavigatorKey: rootNavigatorKey,
        path: orderTracker,
        builder: (context, state) {
          final extra = state.extra as Map<String, dynamic>? ?? {};
          final queryOrderId = state.uri.queryParameters['orderId'];
          return LiveOrderTrackerScreen(orderId: queryOrderId ?? extra['orderId']?.toString());
        },
      ),
      GoRoute(parentNavigatorKey: rootNavigatorKey, path: waiterFloor, builder: (context, state) => const WaiterFloorScreen()),
      GoRoute(parentNavigatorKey: rootNavigatorKey, path: staffHub, builder: (context, state) => const StaffHubScreen()),
      GoRoute(parentNavigatorKey: rootNavigatorKey, path: manageQueue, builder: (context, state) => const ManageQueueScreen()),
      GoRoute(parentNavigatorKey: rootNavigatorKey, path: tableStatusMonitor, builder: (context, state) => const TableStatusMonitorScreen()),
      GoRoute(parentNavigatorKey: rootNavigatorKey, path: partnerSync, builder: (context, state) => const PartnerSyncScreen()),
      GoRoute(
        parentNavigatorKey: rootNavigatorKey,
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
          StatefulShellBranch(
            navigatorKey: shellHomeKey,
            routes: [GoRoute(path: home, builder: (context, state) => const HomeScreen())],
          ),
          StatefulShellBranch(
            navigatorKey: shellMenuKey,
            routes: [GoRoute(path: menu, builder: (context, state) => const MenuScreen())],
          ),
          StatefulShellBranch(
            navigatorKey: shellTableKey,
            routes: [GoRoute(path: tableSelection, builder: (context, state) => const TableSelectionScreen())],
          ),
          StatefulShellBranch(
            navigatorKey: shellQueueKey,
            routes: [GoRoute(path: queue, builder: (context, state) => const QueueScreen())],
          ),
          StatefulShellBranch(
            navigatorKey: shellProfileKey,
            routes: [GoRoute(path: profile, builder: (context, state) => const ProfileScreen())],
          ),
        ],
      ),
    ],
  );
}

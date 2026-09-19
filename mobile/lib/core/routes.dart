import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../screens/customer/splash_screen.dart';
import '../screens/auth/login_screen.dart';
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
import '../screens/customer/reservation_step1_screen.dart';
import '../screens/customer/restaurant_status_screen.dart';
import '../screens/staff/waiter_floor_screen.dart';
import '../screens/staff/partner_sync_screen.dart';
import '../screens/staff/reservations_management_screen.dart';
import '../screens/staff/new_reservation_screen.dart';
import '../screens/staff/customer_directory_screen.dart';
import '../screens/staff/manage_queue_screen.dart';
import '../screens/staff/queue_status_screen.dart';
import '../screens/staff/compose_notification_screen.dart';
import '../screens/staff/queue_report_screen.dart';
import '../screens/staff/table_status_monitor_screen.dart';
import '../screens/staff/staff_profile_screen.dart';
import '../screens/staff/table_cleaning_tasks_screen.dart';
import '../screens/staff/daily_schedule_screen.dart';
import '../screens/staff/staff_hub_screen.dart';

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
  static const waiterFloor = '/waiter-floor';
  static const reservationStep1 = '/reservation-step-1';
  static const restaurantStatus = '/restaurant-status';
  static const partnerSync = '/partner-sync';
  static const reservationsManagement = '/reservations-management';
  static const newReservation = '/new-reservation';
  static const customerDirectory = '/customer-directory';
  static const manageQueue = '/manage-queue';
  static const queueStatus = '/queue-status';
  static const composeNotification = '/compose-notification';
  static const queueReport = '/queue-report';
  static const tableStatusMonitor = '/table-status-monitor';
  static const staffProfile = '/staff-profile';
  static const tableCleaningTasks = '/table-cleaning-tasks';
  static const dailySchedule = '/daily-schedule';
  static const staffHub = '/staff-hub';

  static final router = GoRouter(
    initialLocation: splash,
    refreshListenable: GoRouterRefreshStream(Supabase.instance.client.auth.onAuthStateChange),
    redirect: (context, state) {
      final isAuth = Supabase.instance.client.auth.currentSession != null;
      final isSplash = state.matchedLocation == splash;
      final isAuthRoute = state.matchedLocation == login || state.matchedLocation == register;

      // If not logged in and trying to access a protected route, go to login
      if (!isAuth && !isSplash && !isAuthRoute) {
        return login;
      }
      
      // If logged in and trying to access auth screens or splash, go to home
      if (isAuth && (isAuthRoute || isSplash)) {
        return home;
      }
      
      return null;
    },
    routes: [
      GoRoute(path: splash, builder: (context, state) => const SplashScreen()),
      GoRoute(path: login, builder: (context, state) => const LoginScreen()),
      GoRoute(path: register, builder: (context, state) => const RegisterScreen()),
      
      // Screens that are NOT in the bottom navigation bar
      GoRoute(path: cart, builder: (context, state) => const CartScreen()),
      GoRoute(path: orderHistory, builder: (context, state) => const OrderHistoryScreen()),
      GoRoute(path: reservations, builder: (context, state) => const ReservationHistoryScreen()),
      GoRoute(path: loyalty, builder: (context, state) => const LoyaltyScreen()),
      GoRoute(path: qrCheckin, builder: (context, state) => const QrCheckinScreen()),
      GoRoute(path: waiterFloor, builder: (context, state) => const WaiterFloorScreen()),
      GoRoute(path: reservationStep1, builder: (context, state) => const ReservationStep1Screen()),
      GoRoute(path: restaurantStatus, builder: (context, state) => const RestaurantStatusScreen()),
      GoRoute(path: partnerSync, builder: (context, state) => const PartnerSyncScreen()),
      GoRoute(path: reservationsManagement, builder: (context, state) => const ReservationsManagementScreen()),
      GoRoute(path: newReservation, builder: (context, state) => const NewReservationScreen()),
      GoRoute(path: customerDirectory, builder: (context, state) => const CustomerDirectoryScreen()),
      GoRoute(path: manageQueue, builder: (context, state) => const ManageQueueScreen()),
      GoRoute(path: queueStatus, builder: (context, state) => const QueueStatusScreen()),
      GoRoute(path: composeNotification, builder: (context, state) => const ComposeNotificationScreen()),
      GoRoute(path: queueReport, builder: (context, state) => const QueueReportScreen()),
      GoRoute(path: tableStatusMonitor, builder: (context, state) => const TableStatusMonitorScreen()),
      GoRoute(path: staffProfile, builder: (context, state) => const StaffProfileScreen()),
      GoRoute(path: tableCleaningTasks, builder: (context, state) => const TableCleaningTasksScreen()),
      GoRoute(path: dailySchedule, builder: (context, state) => const DailyScheduleScreen()),
      GoRoute(path: staffHub, builder: (context, state) => const StaffHubScreen()),
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

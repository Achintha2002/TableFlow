import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../screens/auth/login_screen.dart';
import '../screens/auth/register_screen.dart';
import '../screens/customer/splash_screen.dart';
import '../screens/customer/cart_screen.dart';
import '../screens/customer/reservation_details_screen.dart';
import '../screens/customer/qr_checkin_screen.dart';
import '../screens/customer/loyalty_screen.dart';
import '../screens/shared/main_shell.dart';

class AppRoutes {
  static const String splash = '/';
  static const String home = '/home';
  static const String login = '/login';
  static const String register = '/register';
  static const String cart = '/cart';
  static const String reservationDetails = '/reservation-details';
  static const String qrCheckin = '/qr-checkin';
  static const String loyalty = '/loyalty';

  static final GoRouter router = GoRouter(
    initialLocation: splash,
    redirect: (context, state) {
      final isAuth = Supabase.instance.client.auth.currentSession != null;
      final isSplash = state.matchedLocation == splash;
      final isAuthRoute = state.matchedLocation == login || state.matchedLocation == register;

      if (!isAuth && !isSplash && !isAuthRoute) {
        return login;
      }
      return null;
    },
    routes: [
      // Unauthenticated routes
      GoRoute(
        path: splash,
        builder: (context, state) => const SplashScreen(),
      ),
      GoRoute(
        path: login,
        builder: (context, state) => const LoginScreen(),
      ),
      GoRoute(
        path: register,
        builder: (context, state) => const RegisterScreen(),
      ),

      // Main shell (with bottom nav) — all authenticated screens
      GoRoute(
        path: home,
        builder: (context, state) => const MainShell(),
      ),

      // Full-page screens pushed on top of shell
      GoRoute(
        path: cart,
        builder: (context, state) => const CartScreen(),
      ),
      GoRoute(
        path: reservationDetails,
        builder: (context, state) {
          final extra = state.extra as Map<String, dynamic>? ?? {};
          return ReservationDetailsScreen(
            tableId: extra['tableId'] ?? 'T1',
            dbId: extra['dbId'] ?? 0,
            date: extra['date'] ?? DateTime.now().toIso8601String(),
            time: extra['time'] ?? '19:00',
            seats: extra['seats'] ?? 2,
          );
        },
      ),
      GoRoute(
        path: qrCheckin,
        builder: (context, state) => const QrCheckinScreen(),
      ),
      GoRoute(
        path: loyalty,
        builder: (context, state) => const LoyaltyScreen(),
      ),
    ],
  );
}

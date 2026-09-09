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

  static final router = GoRouter(
    initialLocation: splash,
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
      GoRoute(path: home, builder: (context, state) => const HomeScreen()),
      GoRoute(path: menu, builder: (context, state) => const MenuScreen()),
      GoRoute(path: cart, builder: (context, state) => const CartScreen()),
      GoRoute(path: queue, builder: (context, state) => const QueueScreen()),
      GoRoute(path: tableSelection, builder: (context, state) => const TableSelectionScreen()),
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
      GoRoute(path: profile, builder: (context, state) => const ProfileScreen()),
    ],
  );
}

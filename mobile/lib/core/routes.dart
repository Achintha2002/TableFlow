import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../screens/auth/login_screen.dart';
import '../screens/auth/register_screen.dart';
import '../screens/shared/profile_screen.dart';
import '../screens/customer/splash_screen.dart';
import '../screens/customer/home_screen.dart';
import '../screens/customer/menu_screen.dart';
import '../screens/customer/cart_screen.dart';
import '../screens/customer/table_selection_screen.dart';
import '../screens/customer/reservation_details_screen.dart';
import '../screens/customer/queue_screen.dart';

class AppRoutes {
  static const String splash = '/';
  static const String home = '/home';
  static const String login = '/login';
  static const String register = '/register';
  static const String profile = '/profile';
  static const String menu = '/menu';
  static const String cart = '/cart';
  static const String tableSelection = '/table-selection';
  static const String reservationDetails = '/reservation-details';
  static const String queue = '/queue';
  
  static final GoRouter router = GoRouter(
    initialLocation: splash, // Reset initial location to splash
    routes: [
      GoRoute(
        path: splash,
        builder: (context, state) => const SplashScreen(),
      ),
      GoRoute(
        path: home,
        builder: (context, state) => const HomeScreen(),
      ),
      GoRoute(
        path: login,
        builder: (context, state) => const LoginScreen(),
      ),
      GoRoute(
        path: register,
        builder: (context, state) => const RegisterScreen(),
      ),
      GoRoute(
        path: profile,
        builder: (context, state) => const ProfileScreen(),
      ),
      GoRoute(
        path: menu,
        builder: (context, state) => const MenuScreen(),
      ),
      GoRoute(
        path: cart,
        builder: (context, state) => const CartScreen(),
      ),
      GoRoute(
        path: tableSelection,
        builder: (context, state) => const TableSelectionScreen(),
      ),
      GoRoute(
        path: reservationDetails,
        builder: (context, state) {
          final tableId = state.extra as String? ?? 'T1';
          return ReservationDetailsScreen(tableId: tableId);
        },
      ),
      GoRoute(
        path: queue,
        builder: (context, state) => const QueueScreen(),
      ),
    ],
  );
}

// Temporary Placeholder Screen
class PlaceholderScreen extends StatelessWidget {
  final String title;
  const PlaceholderScreen({super.key, required this.title});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: Center(
        child: Text(
          '$title (Under Construction)',
          style: Theme.of(context).textTheme.titleLarge,
        ),
      ),
    );
  }
}

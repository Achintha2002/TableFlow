import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../screens/auth/login_screen.dart';
import '../screens/auth/register_screen.dart';
import '../screens/shared/profile_screen.dart';

// Screens will be imported here later

class AppRoutes {
  static const String splash = '/';
  static const String home = '/home';
  static const String login = '/login';
  static const String register = '/register';
  static const String profile = '/profile';
  
  static final GoRouter router = GoRouter(
    initialLocation: login, // Changed initial to login for testing
    routes: [
      GoRoute(
        path: splash,
        builder: (context, state) => const PlaceholderScreen(title: 'Splash Screen'),
      ),
      GoRoute(
        path: home,
        builder: (context, state) => const PlaceholderScreen(title: 'Home Screen'),
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

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme.dart';
import '../../services/supabase_service.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  @override
  void initState() {
    super.initState();
    _checkAuthAndNavigate();
  }

  Future<void> _checkAuthAndNavigate() async {
    // Small delay to show the splash screen
    await Future.delayed(const Duration(seconds: 2));
    if (!mounted) return;

    // Check if user is already logged in via Supabase session
    final currentUser = SupabaseService.currentUser;
    if (currentUser != null) {
      // Already logged in → go to Home
      context.go('/home');
    } else {
      // Not logged in → go to Login
      context.go('/login');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.background,
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              'TableFlow',
              style: Theme.of(context).textTheme.displayLarge?.copyWith(
                color: AppTheme.primary,
                letterSpacing: 3.0,
                fontSize: 42,
              ),
            ),
            const SizedBox(height: 16),
            const Text(
              'Boutique Dining, Reimagined',
              style: TextStyle(
                color: AppTheme.secondary,
                letterSpacing: 1.5,
              ),
            ),
            const SizedBox(height: 40),
            const CircularProgressIndicator(
              color: AppTheme.primary,
            ),
          ],
        ),
      ),
    );
  }
}

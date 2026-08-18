import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  @override
  void initState() {
    super.initState();
    // Simulate initial loading (e.g., checking auth state)
    Future.delayed(const Duration(seconds: 2), () {
      if (mounted) {
        context.go('/home');
      }
    });
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

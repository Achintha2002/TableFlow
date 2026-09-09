import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme.dart';

class QrCheckinScreen extends StatefulWidget {
  const QrCheckinScreen({super.key});

  @override
  State<QrCheckinScreen> createState() => _QrCheckinScreenState();
}

class _QrCheckinScreenState extends State<QrCheckinScreen>
    with TickerProviderStateMixin {
  bool _checkedIn = false;
  late AnimationController _pulseController;
  late Animation<double> _pulseAnimation;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      duration: const Duration(seconds: 2),
      vsync: this,
    )..repeat(reverse: true);
    _pulseAnimation = Tween<double>(begin: 0.9, end: 1.05).animate(
      CurvedAnimation(parent: _pulseController, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _pulseController.dispose();
    super.dispose();
  }

  void _simulateScan() {
    setState(() => _checkedIn = true);
    _pulseController.stop();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, size: 20),
          onPressed: () => context.pop(),
        ),
        title: const Text('QR Check-In'),
      ),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(32.0),
          child: _checkedIn ? _buildCheckedInView() : _buildScanView(),
        ),
      ),
    );
  }

  Widget _buildScanView() {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Text(
          'Scan to Check In',
          style: Theme.of(context).textTheme.displayMedium?.copyWith(
            color: AppTheme.primary,
          ),
        ),
        const SizedBox(height: 12),
        Text(
          'Show this QR code or scan the restaurant\'s code at the host stand.',
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(height: 1.6),
        ),
        const SizedBox(height: 48),

        // Animated QR Placeholder
        ScaleTransition(
          scale: _pulseAnimation,
          child: Container(
            width: 220,
            height: 220,
            decoration: BoxDecoration(
              border: Border.all(color: AppTheme.primary, width: 3),
              borderRadius: BorderRadius.circular(16),
              color: AppTheme.white,
            ),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                // QR Code pattern simulation using icons/widgets
                const Icon(Icons.qr_code_2, size: 140, color: AppTheme.secondary),
                const SizedBox(height: 8),
                Text(
                  'TF-23081819-001',
                  style: TextStyle(
                    fontSize: 11,
                    color: AppTheme.secondary.withValues(alpha: 0.5),
                    fontFamily: 'monospace',
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 48),

        // Simulate button
        ElevatedButton.icon(
          onPressed: _simulateScan,
          icon: const Icon(Icons.check_circle_outline),
          label: const Text('Simulate Successful Scan'),
        ),
      ],
    );
  }

  Widget _buildCheckedInView() {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Container(
          width: 120,
          height: 120,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: Colors.green.withValues(alpha: 0.1),
          ),
          child: const Icon(Icons.check_circle, size: 80, color: Colors.green),
        ),
        const SizedBox(height: 32),
        Text(
          'Checked In!',
          style: Theme.of(context).textTheme.displayMedium?.copyWith(
            color: Colors.green,
          ),
        ),
        const SizedBox(height: 16),
        Text(
          'Welcome to the TableFlow dining experience. Your table will be ready shortly.',
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(height: 1.6),
        ),
        const SizedBox(height: 48),
        ElevatedButton(
          onPressed: () => context.go('/home'),
          child: const Text('Back to Home'),
        ),
        const SizedBox(height: 16),
        OutlinedButton(
          onPressed: () => context.push('/menu'),
          child: const Text('Browse Menu While You Wait'),
        ),
      ],
    );
  }
}

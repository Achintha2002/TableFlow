import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme.dart';

class QueueScreen extends StatefulWidget {
  const QueueScreen({super.key});

  @override
  State<QueueScreen> createState() => _QueueScreenState();
}

class _QueueScreenState extends State<QueueScreen> {
  // Mock Data
  bool _inQueue = false;
  int _position = 14;
  int _estimatedWaitTime = 45; // minutes

  void _joinQueue() {
    setState(() {
      _inQueue = true;
      _position = 15;
      _estimatedWaitTime = 50;
    });
    
    // Simulate position moving up after 3 seconds
    Future.delayed(const Duration(seconds: 3), () {
      if (mounted) {
        setState(() {
          _position = 14;
          _estimatedWaitTime = 45;
        });
      }
    });
  }

  void _leaveQueue() {
    setState(() {
      _inQueue = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, size: 20),
          onPressed: () => context.pop(),
        ),
        title: const Text('Live Waitlist'),
      ),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(32.0),
          child: _inQueue ? _buildInQueueView() : _buildJoinQueueView(),
        ),
      ),
    );
  }

  Widget _buildJoinQueueView() {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Icon(Icons.people_outline, size: 80, color: AppTheme.primary.withValues(alpha: 0.5)),
        const SizedBox(height: 24),
        Text(
          'Join the Waitlist',
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.displayMedium?.copyWith(
            color: AppTheme.primary,
          ),
        ),
        const SizedBox(height: 16),
        Text(
          'Currently there are 14 parties ahead of you. Estimated wait time is 45-50 minutes.',
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(height: 1.5),
        ),
        const SizedBox(height: 48),
        ElevatedButton(
          onPressed: _joinQueue,
          child: const Text('Join Waitlist Now'),
        ),
      ],
    );
  }

  Widget _buildInQueueView() {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Container(
          width: 150,
          height: 150,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: Border.all(color: AppTheme.primary, width: 4),
            color: AppTheme.primary.withValues(alpha: 0.05),
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                '$_position',
                style: const TextStyle(
                  fontSize: 48,
                  fontWeight: FontWeight.bold,
                  color: AppTheme.primary,
                ),
              ),
              const Text(
                'in line',
                style: TextStyle(
                  color: AppTheme.secondary,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 32),
        Text(
          'You are in the queue!',
          style: Theme.of(context).textTheme.titleLarge?.copyWith(
            fontFamily: 'Playfair Display',
          ),
        ),
        const SizedBox(height: 8),
        Text(
          'Estimated wait time: ~$_estimatedWaitTime mins',
          style: Theme.of(context).textTheme.bodyMedium,
        ),
        const SizedBox(height: 16),
        const Text(
          'We will notify you when your table is almost ready. You can browse the menu and pre-order while you wait.',
          textAlign: TextAlign.center,
          style: TextStyle(height: 1.5, color: Colors.grey),
        ),
        const SizedBox(height: 48),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            OutlinedButton(
              onPressed: () => context.push('/menu'),
              child: const Text('Browse Menu'),
            ),
            const SizedBox(width: 16),
            TextButton(
              onPressed: _leaveQueue,
              child: const Text('Leave Queue', style: TextStyle(color: Colors.red)),
            ),
          ],
        ),
      ],
    );
  }
}

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme.dart';
import '../customer/home_screen.dart';
import '../customer/menu_screen.dart';
import '../customer/queue_screen.dart';
import '../customer/table_selection_screen.dart';
import '../shared/profile_screen.dart';

class MainShell extends StatefulWidget {
  const MainShell({super.key});

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  int _currentIndex = 0;

  final List<Widget> _screens = [
    const HomeScreen(),
    const MenuScreen(),
    const TableSelectionScreen(),
    const QueueScreen(),
    const ProfileScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(
        index: _currentIndex,
        children: _screens,
      ),
      bottomNavigationBar: _buildBottomNav(),
    );
  }

  Widget _buildBottomNav() {
    return Container(
      decoration: BoxDecoration(
        color: AppTheme.white,
        border: Border(
          top: BorderSide(color: AppTheme.secondary.withValues(alpha: 0.1)),
        ),
        boxShadow: [
          BoxShadow(
            color: AppTheme.secondary.withValues(alpha: 0.06),
            blurRadius: 20,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      child: SafeArea(
        child: SizedBox(
          height: 64,
          child: Row(
            children: [
              _buildNavItem(0, Icons.home_outlined, Icons.home, 'Home'),
              _buildNavItem(1, Icons.restaurant_menu_outlined, Icons.restaurant_menu, 'Menu'),
              _buildNavItem(2, Icons.event_seat_outlined, Icons.event_seat, 'Book'),
              _buildNavItem(3, Icons.people_outline, Icons.people, 'Queue'),
              _buildNavItem(4, Icons.person_outline, Icons.person, 'Profile'),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildNavItem(int index, IconData icon, IconData activeIcon, String label) {
    final isActive = _currentIndex == index;
    return Expanded(
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () => setState(() => _currentIndex = index),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                decoration: BoxDecoration(
                  color: isActive ? AppTheme.primary.withValues(alpha: 0.1) : Colors.transparent,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Icon(
                  isActive ? activeIcon : icon,
                  color: isActive ? AppTheme.primary : AppTheme.secondary.withValues(alpha: 0.4),
                  size: 24,
                ),
              ),
              const SizedBox(height: 4),
              AnimatedDefaultTextStyle(
                duration: const Duration(milliseconds: 200),
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: isActive ? FontWeight.w600 : FontWeight.normal,
                  color: isActive ? AppTheme.primary : AppTheme.secondary.withValues(alpha: 0.4),
                ),
                child: Text(label),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

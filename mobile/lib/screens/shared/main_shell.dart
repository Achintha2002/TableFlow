import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme.dart';

class MainShell extends StatelessWidget {
  final StatefulNavigationShell navigationShell;

  const MainShell({super.key, required this.navigationShell});

  String _getTitle(int index) {
    switch (index) {
      case 0: return 'TableFlow';
      case 1: return 'Curated Selection';
      case 2: return 'Select a Table';
      case 3: return 'Live Waitlist';
      case 4: return 'Profile & Settings';
      default: return 'TableFlow';
    }
  }

  List<Widget>? _getActions(BuildContext context, int index) {
    if (index == 1) { // Menu Screen gets a Cart icon
      return [
        Padding(
          padding: const EdgeInsets.only(right: 8.0),
          child: IconButton(
            icon: const Icon(Icons.shopping_bag_outlined),
            onPressed: () => context.push('/cart'),
            style: IconButton.styleFrom(
              backgroundColor: AppTheme.primary.withValues(alpha: 0.1),
              foregroundColor: AppTheme.primary,
            ),
          ),
        ),
      ];
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final currentIndex = navigationShell.currentIndex;
    
    return Scaffold(
      extendBody: true, // Needed for floating transparent bottom nav
      appBar: AppBar(
        title: Text(
          _getTitle(currentIndex),
          style: currentIndex == 0 || currentIndex == 1
              ? Theme.of(context).textTheme.displayMedium?.copyWith(
                  color: currentIndex == 0 ? AppTheme.primary : AppTheme.secondary,
                  fontSize: 24,
                )
              : null,
        ),
        actions: _getActions(context, currentIndex),
        backgroundColor: AppTheme.background.withValues(alpha: 0.8),
        flexibleSpace: ClipRRect(
          child: BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
            child: Container(color: Colors.transparent),
          ),
        ),
      ),
      body: navigationShell,
      bottomNavigationBar: Container(
        margin: const EdgeInsets.all(24).copyWith(top: 0),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(32),
          boxShadow: [
            BoxShadow(
              color: AppTheme.secondary.withValues(alpha: 0.15),
              blurRadius: 20,
              offset: const Offset(0, 10),
            ),
          ],
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(32),
          child: BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 15, sigmaY: 15),
            child: Container(
              color: AppTheme.white.withValues(alpha: 0.85),
              child: NavigationBar(
                selectedIndex: currentIndex,
                onDestinationSelected: (index) {
                  navigationShell.goBranch(
                    index,
                    initialLocation: index == navigationShell.currentIndex,
                  );
                },
                backgroundColor: Colors.transparent,
                indicatorColor: AppTheme.primary.withValues(alpha: 0.2),
                elevation: 0,
                height: 70,
                destinations: const [
                  NavigationDestination(
                    icon: Icon(Icons.home_outlined),
                    selectedIcon: Icon(Icons.home),
                    label: 'Home',
                  ),
                  NavigationDestination(
                    icon: Icon(Icons.restaurant_menu_outlined),
                    selectedIcon: Icon(Icons.restaurant_menu),
                    label: 'Menu',
                  ),
                  NavigationDestination(
                    icon: Icon(Icons.event_seat_outlined),
                    selectedIcon: Icon(Icons.event_seat),
                    label: 'Book',
                  ),
                  NavigationDestination(
                    icon: Icon(Icons.people_outline),
                    selectedIcon: Icon(Icons.people),
                    label: 'Queue',
                  ),
                  NavigationDestination(
                    icon: Icon(Icons.person_outline),
                    selectedIcon: Icon(Icons.person),
                    label: 'Profile',
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

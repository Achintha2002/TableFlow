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
    switch (index) {
      case 0:
        return [
          IconButton(
            icon: const Icon(Icons.person_outline),
            onPressed: () => navigationShell.goBranch(4),
          ),
        ];
      case 1:
        return [
          IconButton(
            icon: const Icon(Icons.shopping_bag_outlined),
            onPressed: () => context.push('/cart'),
          ),
        ];
      default:
        return null;
    }
  }

  @override
  Widget build(BuildContext context) {
    final currentIndex = navigationShell.currentIndex;
    return Scaffold(
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
      ),
      drawer: _buildDrawer(context),
      body: navigationShell,
    );
  }

  Widget _buildDrawer(BuildContext context) {
    return Drawer(
      child: Column(
        children: [
          DrawerHeader(
            decoration: const BoxDecoration(color: AppTheme.secondary),
            child: Center(
              child: Text(
                'TableFlow',
                style: Theme.of(context).textTheme.displayMedium?.copyWith(
                  color: AppTheme.white,
                  fontSize: 32,
                ),
              ),
            ),
          ),
          _buildDrawerItem(context, 0, Icons.home_outlined, Icons.home, 'Home'),
          _buildDrawerItem(context, 1, Icons.restaurant_menu_outlined, Icons.restaurant_menu, 'Menu'),
          _buildDrawerItem(context, 2, Icons.event_seat_outlined, Icons.event_seat, 'Book a Table'),
          _buildDrawerItem(context, 3, Icons.people_outline, Icons.people, 'Live Queue'),
          _buildDrawerItem(context, 4, Icons.person_outline, Icons.person, 'Profile'),
        ],
      ),
    );
  }

  Widget _buildDrawerItem(BuildContext context, int index, IconData icon, IconData activeIcon, String label) {
    final isActive = navigationShell.currentIndex == index;
    return ListTile(
      leading: Icon(
        isActive ? activeIcon : icon,
        color: isActive ? AppTheme.primary : AppTheme.secondary.withValues(alpha: 0.6),
      ),
      title: Text(
        label,
        style: TextStyle(
          color: isActive ? AppTheme.primary : AppTheme.secondary,
          fontWeight: isActive ? FontWeight.bold : FontWeight.normal,
        ),
      ),
      selected: isActive,
      onTap: () {
        Navigator.pop(context); // Close the drawer
        navigationShell.goBranch(
          index,
          initialLocation: index == navigationShell.currentIndex,
        );
      },
    );
  }
}

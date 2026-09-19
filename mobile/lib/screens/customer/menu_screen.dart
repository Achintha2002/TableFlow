import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme.dart';
import '../../services/supabase_service.dart';
import 'package:provider/provider.dart';
import '../../providers/cart_provider.dart';
import '../../widgets/item_customization_sheet.dart';

class MenuScreen extends StatefulWidget {
  const MenuScreen({super.key});

  @override
  State<MenuScreen> createState() => _MenuScreenState();
}

class _MenuScreenState extends State<MenuScreen> {
  List<Map<String, dynamic>> _menuItems = [];
  bool _isLoading = true;
  String _selectedCategory = 'All';

  @override
  void initState() {
    super.initState();
    _fetchMenu();
  }

  Future<void> _fetchMenu() async {
    try {
      final items = await SupabaseService.getMenuItems();
      if (mounted) {
        setState(() {
          _menuItems = items;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  List<Map<String, dynamic>> get _filteredItems {
    if (_selectedCategory == 'All') return _menuItems;
    return _menuItems.where((item) => item['category'] == _selectedCategory).toList();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.background,
      body: CustomScrollView(
        slivers: [
          // App Bar with Hero title
          SliverAppBar(
            expandedHeight: 140.0,
            floating: false,
            pinned: true,
            elevation: 0,
            backgroundColor: AppTheme.background,
            flexibleSpace: FlexibleSpaceBar(
              titlePadding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 16.0),
              title: Text(
                'Menu',
                style: Theme.of(context).textTheme.displayLarge?.copyWith(
                  fontFamily: 'Playfair Display',
                  color: AppTheme.secondary,
                  fontSize: 28,
                  fontWeight: FontWeight.bold,
                ),
              ),
              centerTitle: false,
            ),
          ),
          
          // Subtitle
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 8.0),
              child: Text(
                'Explore our seasonal offerings, crafted with intention and presented with care.',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  fontSize: 16,
                  height: 1.5,
                  color: AppTheme.secondary.withValues(alpha: 0.7),
                ),
              ),
            ),
          ),
          
          // Sticky Categories Filter
          SliverPersistentHeader(
            pinned: true,
            delegate: _StickyCategoryDelegate(
              child: Container(
                color: AppTheme.background.withValues(alpha: 0.95),
                child: SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 16.0),
                  child: Row(
                    children: [
                      _buildCategoryChip('All'),
                      const SizedBox(width: 12),
                      _buildCategoryChip('Starters'),
                      const SizedBox(width: 12),
                      _buildCategoryChip('Mains'),
                      const SizedBox(width: 12),
                      _buildCategoryChip('Desserts'),
                      const SizedBox(width: 12),
                      _buildCategoryChip('Drinks'),
                    ],
                  ),
                ),
              ),
            ),
          ),
          
          // Menu Items List
          _isLoading 
              ? const SliverFillRemaining(
                  child: Center(child: CircularProgressIndicator(color: AppTheme.primary)),
                )
              : _filteredItems.isEmpty
                  ? const SliverFillRemaining(
                      child: Center(child: Text("No items available in this category.")),
                    )
                  : SliverPadding(
                      padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 16.0),
                      sliver: SliverList(
                        delegate: SliverChildBuilderDelegate(
                          (context, index) {
                            final item = _filteredItems[index];
                            return Padding(
                              padding: const EdgeInsets.only(bottom: 24.0),
                              child: _buildMenuItem(context, item),
                            );
                          },
                          childCount: _filteredItems.length,
                        ),
                      ),
                    ),
          // Padding for floating bottom nav
          const SliverToBoxAdapter(child: SizedBox(height: 100)),
        ],
      ),
    );
  }

  Widget _buildCategoryChip(String label) {
    final isSelected = _selectedCategory == label;
    return MouseRegion(
      cursor: SystemMouseCursors.click,
      child: GestureDetector(
        onTap: () {
          setState(() {
            _selectedCategory = label;
          });
        },
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 10),
          decoration: BoxDecoration(
            color: isSelected ? AppTheme.primary : AppTheme.white,
            borderRadius: BorderRadius.circular(30),
            boxShadow: isSelected 
                ? [
                    BoxShadow(
                      color: AppTheme.primary.withValues(alpha: 0.3),
                      blurRadius: 10,
                      offset: const Offset(0, 4),
                    )
                  ]
                : [
                    BoxShadow(
                      color: AppTheme.secondary.withValues(alpha: 0.05),
                      blurRadius: 10,
                      offset: const Offset(0, 2),
                    )
                  ],
            border: Border.all(
              color: isSelected ? Colors.transparent : AppTheme.secondary.withValues(alpha: 0.1),
            ),
          ),
          child: Text(
            label,
            style: TextStyle(
              color: isSelected ? AppTheme.white : AppTheme.secondary,
              fontWeight: FontWeight.bold,
              letterSpacing: 0.5,
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildMenuItem(BuildContext context, Map<String, dynamic> item) {
    final id = item['id'].toString();
    final title = item['name'] ?? '';
    final description = item['description'] ?? '';
    final price = (item['price'] as num?)?.toDouble() ?? 0.0;
    final imageUrl = item['image_url'] ?? 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=1000&auto=format&fit=crop';
    final hasCustomizations = item['customizations'] != null;

    return Container(
      height: 290,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: AppTheme.secondary.withValues(alpha: 0.15),
            blurRadius: 20,
            offset: const Offset(0, 10),
          ),
        ],
        image: DecorationImage(
          image: NetworkImage(imageUrl),
          fit: BoxFit.cover,
        ),
      ),
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(24),
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              Colors.transparent,
              AppTheme.secondary.withValues(alpha: 0.92),
            ],
            stops: const [0.35, 1.0],
          ),
        ),
        padding: const EdgeInsets.all(20),
        alignment: Alignment.bottomCenter,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (hasCustomizations) ...[
              Container(
                margin: const EdgeInsets.only(bottom: 8),
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: AppTheme.tertiary.withValues(alpha: 0.25),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: AppTheme.tertiary.withValues(alpha: 0.5)),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: const [
                    Icon(Icons.tune, size: 13, color: AppTheme.tertiary),
                    SizedBox(width: 5),
                    Text(
                      'Portions & Add-ons Available',
                      style: TextStyle(
                        color: AppTheme.white,
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 0.3,
                      ),
                    ),
                  ],
                ),
              ),
            ],
            Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          fontFamily: 'Playfair Display',
                          fontSize: 23,
                          fontWeight: FontWeight.bold,
                          color: AppTheme.white,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        description,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: AppTheme.white.withValues(alpha: 0.8),
                          height: 1.35,
                          fontSize: 13,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 14),
                ClipRRect(
                  borderRadius: BorderRadius.circular(16),
                  child: BackdropFilter(
                    filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                      decoration: BoxDecoration(
                        color: AppTheme.white.withValues(alpha: 0.2),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: AppTheme.white.withValues(alpha: 0.3)),
                      ),
                      child: Text(
                        hasCustomizations ? 'From LKR ${price.toStringAsFixed(0)}' : 'LKR ${price.toStringAsFixed(0)}',
                        style: const TextStyle(
                          color: AppTheme.white,
                          fontWeight: FontWeight.bold,
                          fontSize: 15,
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () {
                  if (hasCustomizations) {
                    ItemCustomizationSheet.show(context, menuItem: item);
                  } else {
                    context.read<CartProvider>().addItem(id, title, price, imageUrl);
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text('$title added to cart'),
                        behavior: SnackBarBehavior.floating,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        action: SnackBarAction(
                          label: 'View Cart',
                          textColor: AppTheme.tertiary,
                          onPressed: () => context.push('/cart'),
                        ),
                      ),
                    );
                  }
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.primary,
                  foregroundColor: AppTheme.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                  ),
                  elevation: 0,
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    if (hasCustomizations) ...[
                      const Icon(Icons.tune, size: 18),
                      const SizedBox(width: 8),
                      const Text('Customize & Order', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                    ] else ...[
                      const Icon(Icons.add_shopping_cart, size: 18),
                      const SizedBox(width: 8),
                      const Text('Add to Order', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                    ],
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _StickyCategoryDelegate extends SliverPersistentHeaderDelegate {
  final Widget child;

  _StickyCategoryDelegate({required this.child});

  @override
  double get minExtent => 70.0;
  
  @override
  double get maxExtent => 70.0;

  @override
  Widget build(BuildContext context, double shrinkOffset, bool overlapsContent) {
    return child;
  }

  @override
  bool shouldRebuild(_StickyCategoryDelegate oldDelegate) {
    return false;
  }
}

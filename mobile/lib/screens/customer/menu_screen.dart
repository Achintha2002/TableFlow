import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/theme.dart';
import '../../services/supabase_service.dart';
import 'package:provider/provider.dart';
import '../../providers/cart_provider.dart';
import '../../widgets/item_customization_sheet.dart';
import '../../widgets/safe_backdrop_filter.dart';

class MenuScreen extends StatefulWidget {
  const MenuScreen({super.key});

  @override
  State<MenuScreen> createState() => _MenuScreenState();
}

class _MenuScreenState extends State<MenuScreen> {
  List<Map<String, dynamic>> _menuItems = [];
  bool _isLoading = true;
  String _selectedCategory = 'All';
  String _searchQuery = '';
  final TextEditingController _searchController = TextEditingController();
  final ScrollController _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    _fetchMenu();
  }

  @override
  void dispose() {
    _searchController.dispose();
    _scrollController.dispose();
    super.dispose();
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
    final rawQuery = _searchQuery.trim().toLowerCase();

    // 1. Filter items: ONLY match the dish's main name
    final filtered = _menuItems.where((item) {
      // Category match
      if (_selectedCategory != 'All') {
        final cat = (item['category'] as String? ?? '').toLowerCase();
        if (cat != _selectedCategory.toLowerCase()) {
          return false;
        }
      }

      // Search query: strictly match only the dish's main name
      if (rawQuery.isEmpty) return true;
      final name = (item['name'] as String? ?? '').toLowerCase().trim();
      final queryWords = rawQuery.split(RegExp(r'\s+')).where((w) => w.isNotEmpty).toList();

      return name.contains(rawQuery) || (queryWords.isNotEmpty && queryWords.every((w) => name.contains(w)));
    }).toList();

    if (rawQuery.isEmpty) return filtered;

    // 2. Priority Ranking: Sort results by relevance to the dish's main name
    filtered.sort((a, b) {
      final nameA = (a['name'] as String? ?? '').toLowerCase().trim();
      final nameB = (b['name'] as String? ?? '').toLowerCase().trim();

      int score(String name) {
        if (name == rawQuery) return 0; // Exact match (top priority)
        if (name.startsWith(rawQuery)) return 1; // Starts with full query
        final words = name.split(RegExp(r'\s+'));
        if (words.any((w) => w.startsWith(rawQuery))) return 2; // Any word in dish name starts with query
        if (name.contains(rawQuery)) return 3; // Contains query substring in dish name
        final queryWords = rawQuery.split(RegExp(r'\s+')).where((w) => w.isNotEmpty).toList();
        if (queryWords.isNotEmpty && queryWords.every((w) => name.contains(w))) return 4; // Contains all query words
        return 5;
      }

      final scoreA = score(nameA);
      final scoreB = score(nameB);

      if (scoreA != scoreB) {
        return scoreA.compareTo(scoreB);
      }
      final lenComp = nameA.length.compareTo(nameB.length);
      if (lenComp != 0) return lenComp;
      return nameA.compareTo(nameB);
    });

    return filtered;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.background,
      body: CustomScrollView(
        controller: _scrollController,
        slivers: [
          // ── Compact Header & Luxury Search Bar ─────────────────
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20.0, 14.0, 20.0, 12.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Explore our seasonal offerings, crafted with intention and presented with care.',
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          fontSize: 14,
                          height: 1.45,
                          color: AppTheme.secondary.withValues(alpha: 0.65),
                        ),
                  ),
                  const SizedBox(height: 14),

                  // Luxury Search Bar
                  Container(
                    decoration: BoxDecoration(
                      color: AppTheme.white,
                      borderRadius: BorderRadius.circular(18),
                      border: Border.all(
                        color: _searchQuery.isNotEmpty
                            ? AppTheme.primary
                            : AppTheme.secondary.withValues(alpha: 0.12),
                        width: _searchQuery.isNotEmpty ? 1.5 : 1.0,
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: _searchQuery.isNotEmpty
                              ? AppTheme.primary.withValues(alpha: 0.1)
                              : AppTheme.secondary.withValues(alpha: 0.04),
                          blurRadius: 14,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: TextField(
                      controller: _searchController,
                      onChanged: (val) {
                        setState(() {
                          _searchQuery = val;
                        });
                      },
                      style: GoogleFonts.inter(
                        fontSize: 14,
                        color: AppTheme.secondary,
                        fontWeight: FontWeight.w500,
                      ),
                      cursorColor: AppTheme.primary,
                      decoration: InputDecoration(
                        hintText: 'Search by dish name (e.g. Biryani, Pasta)...',
                        hintStyle: GoogleFonts.inter(
                          fontSize: 14,
                          color: AppTheme.secondary.withValues(alpha: 0.45),
                        ),
                        prefixIcon: Icon(
                          Icons.search_rounded,
                          color: _searchQuery.isNotEmpty
                              ? AppTheme.primary
                              : AppTheme.secondary.withValues(alpha: 0.4),
                          size: 22,
                        ),
                        suffixIcon: _searchQuery.isNotEmpty
                            ? IconButton(
                                icon: const Icon(
                                  Icons.cancel_rounded,
                                  color: AppTheme.secondary,
                                  size: 20,
                                ),
                                onPressed: () {
                                  _searchController.clear();
                                  setState(() {
                                    _searchQuery = '';
                                  });
                                },
                              )
                            : null,
                        border: InputBorder.none,
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: 16,
                          vertical: 14,
                        ),
                      ),
                    ),
                  ),

                  // Search match summary if active
                  if (_searchQuery.trim().isNotEmpty && !_isLoading) ...[
                    const SizedBox(height: 10),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 4.0),
                      child: Row(
                        children: [
                          Icon(
                            Icons.filter_list_rounded,
                            size: 14,
                            color: AppTheme.primary,
                          ),
                          const SizedBox(width: 6),
                          Text(
                            'Found ${_filteredItems.length} ${_filteredItems.length == 1 ? "item" : "items"} for "$_searchQuery"',
                            style: GoogleFonts.inter(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: AppTheme.primary,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),

          // ── Sticky Category Chips ─────────────────────────────
          SliverPersistentHeader(
            pinned: true,
            delegate: _StickyCategoryDelegate(
              child: ClipRect(
                child: SafeBackdropFilter(
                  sigmaX: 16,
                  sigmaY: 16,
                  child: Container(
                    decoration: BoxDecoration(
                      color: AppTheme.background.withValues(alpha: 0.92),
                      border: Border(
                        bottom: BorderSide(
                          color: AppTheme.secondary.withValues(alpha: 0.08),
                        ),
                      ),
                    ),
                    child: SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      padding: const EdgeInsets.symmetric(
                          horizontal: 20.0, vertical: 12.0),
                      child: Row(
                        children: [
                          _buildCategoryChip('All'),
                          const SizedBox(width: 8),
                          _buildCategoryChip('Starters'),
                          const SizedBox(width: 8),
                          _buildCategoryChip('Mains'),
                          const SizedBox(width: 8),
                          _buildCategoryChip('Desserts'),
                          const SizedBox(width: 8),
                          _buildCategoryChip('Drinks'),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),

          // ── Menu Items ────────────────────────────────────────
          if (_isLoading)
            const SliverFillRemaining(
              hasScrollBody: false,
              child: Center(
                child: CircularProgressIndicator(color: AppTheme.primary),
              ),
            )
          else if (_filteredItems.isEmpty)
            SliverFillRemaining(
              hasScrollBody: false,
              child: Center(
                child: Padding(
                  padding: const EdgeInsets.all(32.0),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        padding: const EdgeInsets.all(20),
                        decoration: BoxDecoration(
                          color: AppTheme.primary.withValues(alpha: 0.1),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(
                          Icons.search_off_rounded,
                          size: 44,
                          color: AppTheme.primary,
                        ),
                      ),
                      const SizedBox(height: 18),
                      Text(
                        _searchQuery.isNotEmpty
                            ? 'No dishes matching "$_searchQuery"'
                            : 'No items in this category',
                        textAlign: TextAlign.center,
                        style: GoogleFonts.playfairDisplay(
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                          color: AppTheme.secondary,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        _searchQuery.isNotEmpty
                            ? 'Try searching with different keywords or ingredients.'
                            : 'Explore our other categories or check back soon.',
                        textAlign: TextAlign.center,
                        style: GoogleFonts.inter(
                          fontSize: 14,
                          color: AppTheme.secondary.withValues(alpha: 0.65),
                        ),
                      ),
                      if (_searchQuery.isNotEmpty || _selectedCategory != 'All') ...[
                        const SizedBox(height: 20),
                        OutlinedButton.icon(
                          onPressed: () {
                            _searchController.clear();
                            setState(() {
                              _searchQuery = '';
                              _selectedCategory = 'All';
                            });
                          },
                          icon: const Icon(Icons.refresh_rounded, size: 18),
                          label: const Text('Reset Filters'),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: AppTheme.primary,
                            side: const BorderSide(color: AppTheme.primary),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(20),
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            )
          else ...[
            SliverPadding(
              padding: const EdgeInsets.symmetric(
                  horizontal: 20.0, vertical: 16.0),
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
            const SliverToBoxAdapter(child: SizedBox(height: 120)),
          ],
        ],
      ),
    );
  }

  Widget _buildCategoryChip(String label) {
    final isSelected = _selectedCategory == label;
    final count = label == 'All'
        ? _menuItems.length
        : _menuItems
            .where((i) =>
                (i['category'] as String? ?? '').toLowerCase() ==
                label.toLowerCase())
            .length;
    final displayLabel = count > 0 ? '$label ($count)' : label;

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
          padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 9),
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
              color: isSelected
                  ? Colors.transparent
                  : AppTheme.secondary.withValues(alpha: 0.1),
            ),
          ),
          child: Text(
            displayLabel,
            style: GoogleFonts.inter(
              color: isSelected ? AppTheme.white : AppTheme.secondary,
              fontWeight: FontWeight.bold,
              letterSpacing: 0.3,
              fontSize: 13,
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
    final imageUrl = item['image_url'] ??
        'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=1000&auto=format&fit=crop';
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
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: AppTheme.tertiary.withValues(alpha: 0.25),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(
                      color: AppTheme.tertiary.withValues(alpha: 0.5)),
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
                        style: Theme.of(context)
                            .textTheme
                            .titleLarge
                            ?.copyWith(
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
                        style: Theme.of(context)
                            .textTheme
                            .bodyMedium
                            ?.copyWith(
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
                  child: SafeBackdropFilter(
                    sigmaX: 10,
                    sigmaY: 10,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 14, vertical: 8),
                      decoration: BoxDecoration(
                        color: AppTheme.white.withValues(alpha: 0.2),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(
                            color: AppTheme.white.withValues(alpha: 0.3)),
                      ),
                      child: Text(
                        hasCustomizations
                            ? 'From LKR ${price.toStringAsFixed(0)}'
                            : 'LKR ${price.toStringAsFixed(0)}',
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
                    context.read<CartProvider>().addItem(
                        id, title, price, imageUrl);
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text('$title added to cart'),
                        behavior: SnackBarBehavior.floating,
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10)),
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
                      const Text('Customize & Order',
                          style: TextStyle(
                              fontWeight: FontWeight.bold, fontSize: 15)),
                    ] else ...[
                      const Icon(Icons.add_shopping_cart, size: 18),
                      const SizedBox(width: 8),
                      const Text('Add to Order',
                          style: TextStyle(
                              fontWeight: FontWeight.bold, fontSize: 15)),
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
    return SizedBox.expand(child: child);
  }

  @override
  bool shouldRebuild(_StickyCategoryDelegate oldDelegate) {
    return true;
  }
}

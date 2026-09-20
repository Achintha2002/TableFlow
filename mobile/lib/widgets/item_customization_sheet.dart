import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../core/theme.dart';
import '../providers/cart_provider.dart';

class ItemCustomizationSheet extends StatefulWidget {
  final Map<String, dynamic> menuItem;
  final CartItem? editingCartItem;

  const ItemCustomizationSheet({
    super.key,
    required this.menuItem,
    this.editingCartItem,
  });

  static Future<void> show(
    BuildContext context, {
    required Map<String, dynamic> menuItem,
    CartItem? editingCartItem,
  }) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useRootNavigator: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => ItemCustomizationSheet(
        menuItem: menuItem,
        editingCartItem: editingCartItem,
      ),
    );
  }

  @override
  State<ItemCustomizationSheet> createState() => _ItemCustomizationSheetState();
}

class _ItemCustomizationSheetState extends State<ItemCustomizationSheet> {
  late double _basePrice;
  Map<String, dynamic>? _selectedSize;
  final Map<String, Map<String, dynamic>> _selectedAddons = {}; // key: option_id -> {group_id, id, name, price, qty}
  String? _selectedPreference;
  final TextEditingController _notesController = TextEditingController();
  int _quantity = 1;

  // Customization schema parsed from menuItem
  List<Map<String, dynamic>> _sizes = [];
  List<Map<String, dynamic>> _addonGroups = [];
  List<String> _preferences = [];

  @override
  void initState() {
    super.initState();
    _basePrice = (widget.menuItem['price'] as num?)?.toDouble() ?? 0.0;
    _parseCustomizations();
    _initSelections();
  }

  void _parseCustomizations() {
    final cust = widget.menuItem['customizations'];
    if (cust is Map<String, dynamic>) {
      if (cust['sizes'] is List) {
        _sizes = List<Map<String, dynamic>>.from(cust['sizes']);
      }
      if (cust['addon_groups'] is List) {
        _addonGroups = List<Map<String, dynamic>>.from(cust['addon_groups']);
      }
      if (cust['preferences'] is List) {
        _preferences = List<String>.from(cust['preferences']);
      }
    }
  }

  void _initSelections() {
    if (widget.editingCartItem != null) {
      final item = widget.editingCartItem!;
      _quantity = item.quantity;
      _selectedSize = item.selectedSize;
      _selectedPreference = item.cookingPreference;
      _notesController.text = item.itemNotes ?? '';

      for (final addon in item.selectedAddons) {
        final id = addon['id']?.toString() ?? '';
        if (id.isNotEmpty) {
          _selectedAddons[id] = Map<String, dynamic>.from(addon);
        }
      }
    } else {
      // Default: select first available size
      for (final size in _sizes) {
        if (size['is_available'] != false) {
          _selectedSize = size;
          break;
        }
      }

      // Pre-select first available option for required single-choice groups (min_select == 1 && max_select == 1)
      for (final group in _addonGroups) {
        final minSelect = (group['min_select'] as num?)?.toInt() ?? 0;
        final maxSelect = (group['max_select'] as num?)?.toInt() ?? 0;
        if (minSelect == 1 && maxSelect == 1) {
          final options = (group['options'] as List<dynamic>?) ?? [];
          for (final opt in options) {
            final optMap = opt as Map<String, dynamic>;
            if (optMap['is_available'] != false) {
              _selectedAddons[optMap['id']] = {
                'group_id': group['id'],
                'id': optMap['id'],
                'name': optMap['name'],
                'price': (optMap['price'] as num?)?.toDouble() ?? 0.0,
                'qty': 1,
              };
              break;
            }
          }
        }
      }
    }
  }

  @override
  void dispose() {
    _notesController.dispose();
    super.dispose();
  }

  double get _currentUnitPrice {
    double total = _basePrice;
    if (_selectedSize != null) {
      total += (_selectedSize!['price_delta'] as num?)?.toDouble() ?? 0.0;
    }
    for (final addon in _selectedAddons.values) {
      final price = (addon['price'] as num?)?.toDouble() ?? 0.0;
      final qty = (addon['qty'] as num?)?.toInt() ?? 1;
      total += price * qty;
    }
    return total;
  }

  double get _currentLineTotal => _currentUnitPrice * _quantity;

  /// Check validation errors across all groups
  String? get _validationError {
    // 1. Portion Size
    if (_sizes.isNotEmpty && _selectedSize == null) {
      return 'Please choose a portion size.';
    }

    // 2. Addon Groups
    for (final group in _addonGroups) {
      final groupId = group['id'];
      final groupName = group['name'] ?? 'Options';
      final minSelect = (group['min_select'] as num?)?.toInt() ?? 0;
      final maxSelect = (group['max_select'] as num?)?.toInt() ?? 999;

      int groupQty = 0;
      for (final addon in _selectedAddons.values) {
        if (addon['group_id'] == groupId) {
          groupQty += (addon['qty'] as num?)?.toInt() ?? 1;
        }
      }

      if (groupQty < minSelect) {
        return minSelect == 1
            ? 'Please choose an option for "$groupName".'
            : 'Please select at least $minSelect options for "$groupName".';
      }
      if (groupQty > maxSelect) {
        return 'You can select at most $maxSelect options for "$groupName".';
      }
    }

    return null;
  }

  bool get _isValid => _validationError == null;

  void _handleSubmit() {
    if (!_isValid) return;

    final cart = context.read<CartProvider>();
    final productId = widget.menuItem['id'].toString();
    final name = widget.menuItem['name']?.toString() ?? 'Item';
    final imageUrl = widget.menuItem['image_url']?.toString();
    final notes = _notesController.text.trim().isEmpty ? null : _notesController.text.trim();
    final addonsList = _selectedAddons.values.toList();

    if (widget.editingCartItem != null) {
      final updatedItem = CartItem(
        id: productId,
        name: name,
        basePrice: _basePrice,
        price: _currentUnitPrice,
        imageUrl: imageUrl,
        quantity: _quantity,
        cartLineId: CartItem.generateCartLineId(productId, _selectedSize, addonsList, _selectedPreference),
        selectedSize: _selectedSize,
        selectedAddons: addonsList,
        cookingPreference: _selectedPreference,
        itemNotes: notes,
      );
      cart.updateCartLine(widget.editingCartItem!.cartLineId, updatedItem);
      Navigator.pop(context);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('$name updated in order'),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        ),
      );
    } else {
      cart.addItem(
        productId,
        name,
        _currentUnitPrice,
        imageUrl,
        basePrice: _basePrice,
        selectedSize: _selectedSize,
        selectedAddons: addonsList,
        cookingPreference: _selectedPreference,
        itemNotes: notes,
        quantity: _quantity,
      );
      Navigator.pop(context);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('$name added to order'),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          action: SnackBarAction(
            label: 'View Cart',
            textColor: AppTheme.tertiary,
            onPressed: () {
              Navigator.of(context).pushNamed('/cart');
            },
          ),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final error = _validationError;

    return Container(
      decoration: const BoxDecoration(
        color: AppTheme.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      child: FractionallySizedBox(
        heightFactor: 0.88,
        child: Column(
          children: [
            // Handle Bar & Header
            _buildHeader(),

            // Scrollable Content
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(24, 0, 24, 24),
                children: [
                  // Item Details Header
                  _buildItemOverview(),
                  const SizedBox(height: 20),

                  // Portion Sizes
                  if (_sizes.isNotEmpty) ...[
                    _buildPortionSizes(),
                    const SizedBox(height: 24),
                  ],

                  // Addon Groups
                  for (final group in _addonGroups) ...[
                    _buildAddonGroup(group),
                    const SizedBox(height: 24),
                  ],

                  // Cooking Preferences
                  if (_preferences.isNotEmpty) ...[
                    _buildPreferences(),
                    const SizedBox(height: 24),
                  ],

                  // Special Instructions
                  _buildSpecialInstructions(),
                  const SizedBox(height: 24),

                  // Quantity Stepper
                  _buildQuantitySection(),
                  const SizedBox(height: 16),
                ],
              ),
            ),

            // Bottom Sticky Action Bar
            _buildBottomBar(error),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Container(
      padding: const EdgeInsets.fromLTRB(24, 14, 16, 10),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Container(
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: Colors.grey.shade300,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          IconButton(
            icon: const Icon(Icons.close, color: AppTheme.secondary),
            onPressed: () => Navigator.pop(context),
          ),
        ],
      ),
    );
  }

  Widget _buildItemOverview() {
    final title = widget.menuItem['name'] ?? 'Item';
    final desc = widget.menuItem['description'] ?? '';
    final imageUrl = widget.menuItem['image_url'] as String?;

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (imageUrl != null && imageUrl.isNotEmpty) ...[
          ClipRRect(
            borderRadius: BorderRadius.circular(16),
            child: Image.network(
              imageUrl,
              width: 84,
              height: 84,
              fit: BoxFit.cover,
              errorBuilder: (context, error, stackTrace) => Container(
                width: 84,
                height: 84,
                color: Colors.grey.shade100,
                child: const Icon(Icons.restaurant, color: Colors.grey),
              ),
            ),
          ),
          const SizedBox(width: 16),
        ],
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: const TextStyle(
                  fontFamily: 'Playfair Display',
                  fontSize: 22,
                  fontWeight: FontWeight.bold,
                  color: AppTheme.secondary,
                ),
              ),
              const SizedBox(height: 4),
              if (desc.isNotEmpty)
                Text(
                  desc,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 13,
                    color: Colors.black.withValues(alpha: 0.6),
                    height: 1.3,
                  ),
                ),
              const SizedBox(height: 6),
              Text(
                'Base Price: LKR ${_basePrice.toStringAsFixed(0)}',
                style: const TextStyle(
                  color: AppTheme.primary,
                  fontWeight: FontWeight.bold,
                  fontSize: 14,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildPortionSizes() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text(
              'Portion Size',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppTheme.secondary),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: AppTheme.primary.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Text(
                'REQUIRED (CHOOSE 1)',
                style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: AppTheme.primary),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Wrap(
          spacing: 10,
          runSpacing: 10,
          children: _sizes.map((size) {
            final isSelected = _selectedSize?['id'] == size['id'];
            final isAvailable = size['is_available'] != false;
            final delta = (size['price_delta'] as num?)?.toDouble() ?? 0.0;
            final deltaText = delta > 0 ? '+ LKR ${delta.toStringAsFixed(0)}' : 'Included';

            return InkWell(
              onTap: isAvailable
                  ? () {
                      setState(() {
                        _selectedSize = size;
                      });
                    }
                  : null,
              borderRadius: BorderRadius.circular(14),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 180),
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                decoration: BoxDecoration(
                  color: !isAvailable
                      ? Colors.grey.shade100
                      : isSelected
                          ? AppTheme.primary.withValues(alpha: 0.08)
                          : Colors.white,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(
                    color: !isAvailable
                        ? Colors.grey.shade300
                        : isSelected
                            ? AppTheme.primary
                            : Colors.grey.shade300,
                    width: isSelected ? 2 : 1,
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          size['name'] ?? '',
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: isSelected ? FontWeight.bold : FontWeight.w600,
                            color: !isAvailable ? Colors.grey : AppTheme.secondary,
                          ),
                        ),
                        if (!isAvailable) ...[
                          const SizedBox(width: 6),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: Colors.red.withValues(alpha: 0.12),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: const Text(
                              'Sold out',
                              style: TextStyle(fontSize: 10, color: Colors.red, fontWeight: FontWeight.bold),
                            ),
                          ),
                        ],
                      ],
                    ),
                    const SizedBox(height: 2),
                    Text(
                      deltaText,
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: isSelected ? AppTheme.primary : Colors.grey.shade600,
                      ),
                    ),
                  ],
                ),
              ),
            );
          }).toList(),
        ),
      ],
    );
  }

  Widget _buildAddonGroup(Map<String, dynamic> group) {
    final groupId = group['id'];
    final groupName = group['name'] ?? 'Add-ons';
    final minSelect = (group['min_select'] as num?)?.toInt() ?? 0;
    final maxSelect = (group['max_select'] as num?)?.toInt() ?? 999;
    final isSingleChoice = minSelect == 1 && maxSelect == 1;
    final options = (group['options'] as List<dynamic>?) ?? [];

    // Calculate current count in this group
    int currentCount = 0;
    for (final sel in _selectedAddons.values) {
      if (sel['group_id'] == groupId) {
        currentCount += (sel['qty'] as num?)?.toInt() ?? 1;
      }
    }

    String badgeLabel;
    if (isSingleChoice) {
      badgeLabel = 'REQUIRED (CHOOSE 1)';
    } else if (minSelect > 0) {
      badgeLabel = 'REQUIRED (CHOOSE $minSelect-$maxSelect)';
    } else {
      badgeLabel = maxSelect < 999 ? 'OPTIONAL (MAX $maxSelect)' : 'OPTIONAL';
    }

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppTheme.background.withValues(alpha: 0.5),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: Colors.black.withValues(alpha: 0.05)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                groupName,
                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppTheme.secondary),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: minSelect > 0 ? AppTheme.primary.withValues(alpha: 0.12) : Colors.grey.shade200,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  badgeLabel,
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                    color: minSelect > 0 ? AppTheme.primary : Colors.grey.shade700,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // Options List
          ...options.map((opt) {
            final optMap = opt as Map<String, dynamic>;
            final optId = optMap['id'].toString();
            final optName = optMap['name'] ?? '';
            final price = (optMap['price'] as num?)?.toDouble() ?? 0.0;
            final isAvailable = optMap['is_available'] != false;
            final maxQty = (optMap['max_qty'] as num?)?.toInt() ?? 1;

            final isSelected = _selectedAddons.containsKey(optId);
            final currentQty = isSelected ? (_selectedAddons[optId]!['qty'] as num?)?.toInt() ?? 1 : 0;
            final reachedGroupMax = !isSingleChoice && currentCount >= maxSelect && !isSelected;

            return Padding(
              padding: const EdgeInsets.only(bottom: 8.0),
              child: InkWell(
                onTap: (!isAvailable || reachedGroupMax)
                    ? null
                    : () {
                        setState(() {
                          if (isSingleChoice) {
                            // Remove previous selection from this group
                            _selectedAddons.removeWhere((k, v) => v['group_id'] == groupId);
                            _selectedAddons[optId] = {
                              'group_id': groupId,
                              'id': optId,
                              'name': optName,
                              'price': price,
                              'qty': 1,
                            };
                          } else {
                            if (isSelected) {
                              _selectedAddons.remove(optId);
                            } else {
                              if (currentCount < maxSelect) {
                                _selectedAddons[optId] = {
                                  'group_id': groupId,
                                  'id': optId,
                                  'name': optName,
                                  'price': price,
                                  'qty': 1,
                                };
                              }
                            }
                          }
                        });
                      },
                borderRadius: BorderRadius.circular(12),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: isSelected ? AppTheme.primary : Colors.grey.shade200,
                      width: isSelected ? 1.5 : 1,
                    ),
                  ),
                  child: Row(
                    children: [
                      // Selection Indicator
                      if (isSingleChoice)
                        Icon(
                          isSelected ? Icons.radio_button_checked : Icons.radio_button_off,
                          color: isSelected ? AppTheme.primary : Colors.grey.shade400,
                          size: 20,
                        )
                      else
                        Icon(
                          isSelected ? Icons.check_box : Icons.check_box_outline_blank,
                          color: isSelected ? AppTheme.primary : Colors.grey.shade400,
                          size: 20,
                        ),
                      const SizedBox(width: 10),

                      // Name
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              optName,
                              style: TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w600,
                                color: !isAvailable ? Colors.grey : AppTheme.secondary,
                              ),
                            ),
                            if (!isAvailable)
                              const Text(
                                'Currently sold out',
                                style: TextStyle(fontSize: 11, color: Colors.red, fontWeight: FontWeight.bold),
                              ),
                          ],
                        ),
                      ),

                      // Price
                      Text(
                        price > 0 ? '+ LKR ${price.toStringAsFixed(0)}' : 'Free',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.bold,
                          color: isSelected ? AppTheme.primary : Colors.grey.shade700,
                        ),
                      ),

                      // Quantity Stepper (if max_qty > 1 and selected)
                      if (!isSingleChoice && maxQty > 1 && isSelected) ...[
                        const SizedBox(width: 8),
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            InkWell(
                              onTap: () {
                                setState(() {
                                  if (currentQty > 1) {
                                    _selectedAddons[optId]!['qty'] = currentQty - 1;
                                  } else {
                                    _selectedAddons.remove(optId);
                                  }
                                });
                              },
                              child: Container(
                                padding: const EdgeInsets.all(4),
                                decoration: BoxDecoration(
                                  color: Colors.grey.shade100,
                                  shape: BoxShape.circle,
                                ),
                                child: const Icon(Icons.remove, size: 14),
                              ),
                            ),
                            Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 6),
                              child: Text(
                                '$currentQty',
                                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                              ),
                            ),
                            InkWell(
                              onTap: (currentQty < maxQty && currentCount < maxSelect)
                                  ? () {
                                      setState(() {
                                        _selectedAddons[optId]!['qty'] = currentQty + 1;
                                      });
                                    }
                                  : null,
                              child: Container(
                                padding: const EdgeInsets.all(4),
                                decoration: BoxDecoration(
                                  color: (currentQty < maxQty && currentCount < maxSelect)
                                      ? AppTheme.primary.withValues(alpha: 0.15)
                                      : Colors.grey.shade100,
                                  shape: BoxShape.circle,
                                ),
                                child: Icon(
                                  Icons.add,
                                  size: 14,
                                  color: (currentQty < maxQty && currentCount < maxSelect)
                                      ? AppTheme.primary
                                      : Colors.grey,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            );
          }),
        ],
      ),
    );
  }

  Widget _buildPreferences() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Preparation Preference',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppTheme.secondary),
        ),
        const SizedBox(height: 10),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: _preferences.map((pref) {
            final isSelected = _selectedPreference == pref;
            return ChoiceChip(
              label: Text(pref),
              selected: isSelected,
              selectedColor: AppTheme.primary,
              backgroundColor: Colors.white,
              labelStyle: TextStyle(
                color: isSelected ? Colors.white : AppTheme.secondary,
                fontWeight: FontWeight.bold,
                fontSize: 13,
              ),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
                side: BorderSide(color: isSelected ? AppTheme.primary : Colors.grey.shade300),
              ),
              onSelected: (val) {
                setState(() {
                  _selectedPreference = val ? pref : null;
                });
              },
            );
          }).toList(),
        ),
      ],
    );
  }

  Widget _buildSpecialInstructions() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Special Instructions for Kitchen',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppTheme.secondary),
        ),
        const SizedBox(height: 8),
        TextField(
          controller: _notesController,
          maxLines: 2,
          decoration: InputDecoration(
            hintText: 'e.g. Extra napkins, sauce on the side, no cutlery...',
            hintStyle: TextStyle(color: Colors.grey.shade400, fontSize: 13),
            filled: true,
            fillColor: AppTheme.background.withValues(alpha: 0.5),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: BorderSide(color: Colors.grey.shade300),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: BorderSide(color: Colors.grey.shade300),
            ),
            contentPadding: const EdgeInsets.all(12),
          ),
        ),
      ],
    );
  }

  Widget _buildQuantitySection() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: AppTheme.background.withValues(alpha: 0.5),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          const Text(
            'Quantity',
            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: AppTheme.secondary),
          ),
          Row(
            children: [
              IconButton(
                icon: const Icon(Icons.remove_circle_outline, size: 24),
                onPressed: _quantity > 1 ? () => setState(() => _quantity--) : null,
              ),
              Text(
                '$_quantity',
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
              ),
              IconButton(
                icon: const Icon(Icons.add_circle_outline, size: 24, color: AppTheme.primary),
                onPressed: () => setState(() => _quantity++),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildBottomBar(String? error) {
    final isEditing = widget.editingCartItem != null;
    final btnText = isEditing
        ? 'Update Order • LKR ${_currentLineTotal.toStringAsFixed(0)}'
        : 'Add to Order • LKR ${_currentLineTotal.toStringAsFixed(0)}';

    return SafeArea(
      top: false,
      child: Container(
        padding: const EdgeInsets.fromLTRB(24, 12, 24, 16),
        decoration: BoxDecoration(
          color: Colors.white,
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.08),
              blurRadius: 20,
              offset: const Offset(0, -6),
            ),
          ],
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (error != null) ...[
              Container(
                margin: const EdgeInsets.only(bottom: 10),
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: Colors.amber.shade50,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.amber.shade300),
                ),
                child: Row(
                  children: [
                    Icon(Icons.info_outline, size: 16, color: Colors.amber.shade800),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        error,
                        style: TextStyle(fontSize: 12, color: Colors.amber.shade900, fontWeight: FontWeight.w600),
                      ),
                    ),
                  ],
                ),
              ),
            ],
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _isValid ? _handleSubmit : null,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.primary,
                  foregroundColor: Colors.white,
                  disabledBackgroundColor: Colors.grey.shade300,
                  disabledForegroundColor: Colors.grey.shade600,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  elevation: _isValid ? 4 : 0,
                ),
                child: Text(
                  btnText,
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

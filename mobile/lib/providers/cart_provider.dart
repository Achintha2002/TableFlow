import 'dart:math';
import 'package:flutter/foundation.dart';

class CartItem {
  final String id; // Menu Item ID
  final String name;
  final double basePrice;
  final double price; // Verified unit price (base + sizeDelta + addonsTotal)
  final String? imageUrl;
  int quantity;
  final String cartLineId; // Unique deterministic sorted hash
  final Map<String, dynamic>? selectedSize; // e.g. {'id': 'large', 'name': 'King Cut (400g)', 'price_delta': 1200}
  final List<Map<String, dynamic>> selectedAddons; // e.g. [{'group_id': 'sauce', 'id': 'red_wine', 'name': 'Red Wine Glaze', 'price': 0, 'qty': 1}]
  final String? cookingPreference;
  String? itemNotes;

  CartItem({
    required this.id,
    required this.name,
    required this.basePrice,
    required this.price,
    this.imageUrl,
    this.quantity = 1,
    required this.cartLineId,
    this.selectedSize,
    this.selectedAddons = const [],
    this.cookingPreference,
    this.itemNotes,
  });

  /// Deterministic sorted hash so selection order (e.g. Cheese-then-Bacon vs Bacon-then-Cheese)
  /// always maps to the same cart line and correctly merges quantities.
  static String generateCartLineId(
    String productId,
    Map<String, dynamic>? size,
    List<Map<String, dynamic>> addons,
    String? preference,
  ) {
    final sizeKey = size != null ? '${size['id'] ?? size['name']}' : 'nosize';
    final sortedAddons = List<Map<String, dynamic>>.from(addons);
    sortedAddons.sort((a, b) =>
        (a['id'] ?? a['name'] ?? '').toString().compareTo((b['id'] ?? b['name'] ?? '').toString()));
    final addonsKey = sortedAddons.map((a) => '${a['id'] ?? a['name']}:${a['qty'] ?? 1}').join('|');
    final prefKey = preference != null && preference.isNotEmpty ? preference : 'nopref';
    return '${productId}_${sizeKey}_${addonsKey}_$prefKey';
  }

  /// Structured snapshot for order submission and receipt records
  Map<String, dynamic> toSelectedCustomizationsJson() {
    return {
      'size': selectedSize,
      'addons': selectedAddons,
      'preference': cookingPreference,
      'special_instructions': itemNotes,
    };
  }

  /// Human-readable summary for display under cart items
  String get customizationSummary {
    final parts = <String>[];
    if (selectedSize != null && selectedSize!['name'] != null) {
      parts.add(selectedSize!['name'].toString());
    }
    for (final addon in selectedAddons) {
      final name = addon['name']?.toString() ?? '';
      final qty = (addon['qty'] as num?)?.toInt() ?? 1;
      if (qty > 1) {
        parts.add('$name (x$qty)');
      } else {
        parts.add(name);
      }
    }
    if (cookingPreference != null && cookingPreference!.isNotEmpty) {
      parts.add(cookingPreference!);
    }
    return parts.join(' • ');
  }
}

class CartProvider extends ChangeNotifier {
  final Map<String, CartItem> _items = {};

  // Active Dining Table details
  int? _selectedTableId;
  int? _selectedTableNumber;

  // Coupon & Discount details
  String? _couponCode;
  double _couponDiscount = 0.0;

  // Loyalty Points details
  int _redeemedPoints = 0;
  double _pointsDiscount = 0.0;

  Map<String, CartItem> get items => {..._items};

  List<CartItem> get itemsList => _items.values.toList();

  int get itemCount {
    int count = 0;
    _items.forEach((key, cartItem) {
      count += cartItem.quantity;
    });
    return count;
  }

  // Base subtotal of items
  double get totalAmount {
    var total = 0.0;
    _items.forEach((key, cartItem) {
      total += cartItem.price * cartItem.quantity;
    });
    return total;
  }

  // Table Getters
  int? get selectedTableId => _selectedTableId;
  int? get selectedTableNumber => _selectedTableNumber;
  bool get hasTableSelected => _selectedTableId != null;

  void setTable(int id, int number) {
    _selectedTableId = id;
    _selectedTableNumber = number;
    notifyListeners();
  }

  void clearTable() {
    _selectedTableId = null;
    _selectedTableNumber = null;
    notifyListeners();
  }

  // Coupon Getters & Methods
  String? get couponCode => _couponCode;
  double get couponDiscount => _couponDiscount;

  void applyCoupon(String code, double discount) {
    _couponCode = code;
    _couponDiscount = discount;
    notifyListeners();
  }

  void removeCoupon() {
    _couponCode = null;
    _couponDiscount = 0.0;
    notifyListeners();
  }

  // Loyalty Getters & Methods
  int get redeemedPoints => _redeemedPoints;
  double get pointsDiscount => _pointsDiscount;

  void setRedeemedPoints(int points, double discount) {
    _redeemedPoints = points;
    _pointsDiscount = discount;
    notifyListeners();
  }

  void clearRedeemedPoints() {
    _redeemedPoints = 0;
    _pointsDiscount = 0.0;
    notifyListeners();
  }

  // Financial Breakdown Calculations
  double get totalDiscount => _couponDiscount + _pointsDiscount;

  double get discountedSubtotal => max(0.0, totalAmount - totalDiscount);

  double get serviceCharge => (discountedSubtotal * 0.10); // 10%

  double get taxAmount => (discountedSubtotal * 0.08); // 8% VAT

  double get grandTotal => (discountedSubtotal + serviceCharge + taxAmount);

  /// Add item to cart with support for structured customizations
  void addItem(
    String productId,
    String name,
    double price,
    String? imageUrl, {
    double? basePrice,
    Map<String, dynamic>? selectedSize,
    List<Map<String, dynamic>> selectedAddons = const [],
    String? cookingPreference,
    String? itemNotes,
    int quantity = 1,
  }) {
    final effectiveBase = basePrice ?? price;
    final lineId = CartItem.generateCartLineId(productId, selectedSize, selectedAddons, cookingPreference);

    if (_items.containsKey(lineId)) {
      _items.update(
        lineId,
        (existing) => CartItem(
          id: existing.id,
          name: existing.name,
          basePrice: existing.basePrice,
          price: existing.price,
          imageUrl: existing.imageUrl,
          quantity: existing.quantity + quantity,
          cartLineId: existing.cartLineId,
          selectedSize: existing.selectedSize,
          selectedAddons: existing.selectedAddons,
          cookingPreference: existing.cookingPreference,
          itemNotes: itemNotes ?? existing.itemNotes,
        ),
      );
    } else {
      _items.putIfAbsent(
        lineId,
        () => CartItem(
          id: productId,
          name: name,
          basePrice: effectiveBase,
          price: price,
          imageUrl: imageUrl,
          quantity: quantity,
          cartLineId: lineId,
          selectedSize: selectedSize,
          selectedAddons: selectedAddons,
          cookingPreference: cookingPreference,
          itemNotes: itemNotes,
        ),
      );
    }
    notifyListeners();
  }

  /// In-place cart line edit (replaces old cart line, merging if new selections match an existing line)
  void updateCartLine(String oldLineId, CartItem updatedItem) {
    if (oldLineId == updatedItem.cartLineId) {
      _items[oldLineId] = updatedItem;
    } else {
      _items.remove(oldLineId);
      if (_items.containsKey(updatedItem.cartLineId)) {
        _items[updatedItem.cartLineId]!.quantity += updatedItem.quantity;
      } else {
        _items[updatedItem.cartLineId] = updatedItem;
      }
    }
    notifyListeners();
  }

  void removeItem(String lineIdOrProductId) {
    if (_items.containsKey(lineIdOrProductId)) {
      _items.remove(lineIdOrProductId);
    } else {
      // Fallback: match by product id if old key was passed
      _items.removeWhere((k, v) => v.id == lineIdOrProductId || v.cartLineId == lineIdOrProductId);
    }
    notifyListeners();
  }

  void updateQuantity(String lineIdOrProductId, int quantity) {
    final targetKey = _items.containsKey(lineIdOrProductId)
        ? lineIdOrProductId
        : _items.keys.firstWhere(
            (k) => _items[k]!.id == lineIdOrProductId || _items[k]!.cartLineId == lineIdOrProductId,
            orElse: () => '',
          );

    if (targetKey.isNotEmpty && _items.containsKey(targetKey)) {
      if (quantity > 0) {
        _items.update(
          targetKey,
          (existing) => CartItem(
            id: existing.id,
            name: existing.name,
            basePrice: existing.basePrice,
            price: existing.price,
            imageUrl: existing.imageUrl,
            quantity: quantity,
            cartLineId: existing.cartLineId,
            selectedSize: existing.selectedSize,
            selectedAddons: existing.selectedAddons,
            cookingPreference: existing.cookingPreference,
            itemNotes: existing.itemNotes,
          ),
        );
      } else {
        _items.remove(targetKey);
      }
      notifyListeners();
    }
  }

  void updateItemNotes(String lineIdOrProductId, String notes) {
    final targetKey = _items.containsKey(lineIdOrProductId)
        ? lineIdOrProductId
        : _items.keys.firstWhere(
            (k) => _items[k]!.id == lineIdOrProductId || _items[k]!.cartLineId == lineIdOrProductId,
            orElse: () => '',
          );

    if (targetKey.isNotEmpty && _items.containsKey(targetKey)) {
      _items.update(
        targetKey,
        (existing) => CartItem(
          id: existing.id,
          name: existing.name,
          basePrice: existing.basePrice,
          price: existing.price,
          imageUrl: existing.imageUrl,
          quantity: existing.quantity,
          cartLineId: existing.cartLineId,
          selectedSize: existing.selectedSize,
          selectedAddons: existing.selectedAddons,
          cookingPreference: existing.cookingPreference,
          itemNotes: notes.isEmpty ? null : notes,
        ),
      );
      notifyListeners();
    }
  }

  void clear() {
    _items.clear();
    _couponCode = null;
    _couponDiscount = 0.0;
    _redeemedPoints = 0;
    _pointsDiscount = 0.0;
    notifyListeners();
  }
}

import 'dart:math';
import 'package:flutter/foundation.dart';

class CartItem {
  final String id;
  final String name;
  final double price;
  final String? imageUrl;
  int quantity;
  String? itemNotes;

  CartItem({
    required this.id,
    required this.name,
    required this.price,
    this.imageUrl,
    this.quantity = 1,
    this.itemNotes,
  });
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

  void addItem(String productId, String name, double price, String? imageUrl, {String? itemNotes}) {
    if (_items.containsKey(productId)) {
      _items.update(
        productId,
        (existingCartItem) => CartItem(
          id: existingCartItem.id,
          name: existingCartItem.name,
          price: existingCartItem.price,
          imageUrl: existingCartItem.imageUrl,
          quantity: existingCartItem.quantity + 1,
          itemNotes: itemNotes ?? existingCartItem.itemNotes,
        ),
      );
    } else {
      _items.putIfAbsent(
        productId,
        () => CartItem(
          id: productId,
          name: name,
          price: price,
          imageUrl: imageUrl,
          itemNotes: itemNotes,
        ),
      );
    }
    notifyListeners();
  }

  void removeItem(String productId) {
    _items.remove(productId);
    notifyListeners();
  }

  void updateQuantity(String productId, int quantity) {
    if (_items.containsKey(productId)) {
      if (quantity > 0) {
        _items.update(
          productId,
          (existingCartItem) => CartItem(
            id: existingCartItem.id,
            name: existingCartItem.name,
            price: existingCartItem.price,
            imageUrl: existingCartItem.imageUrl,
            quantity: quantity,
            itemNotes: existingCartItem.itemNotes,
          ),
        );
      } else {
        _items.remove(productId);
      }
      notifyListeners();
    }
  }

  void updateItemNotes(String productId, String notes) {
    if (_items.containsKey(productId)) {
      _items.update(
        productId,
        (existingCartItem) => CartItem(
          id: existingCartItem.id,
          name: existingCartItem.name,
          price: existingCartItem.price,
          imageUrl: existingCartItem.imageUrl,
          quantity: existingCartItem.quantity,
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

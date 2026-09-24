import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../../core/theme.dart';
import '../../providers/cart_provider.dart';
import '../../services/api_service.dart';

class TableLandingScreen extends StatefulWidget {
  final String? token;
  final int? tableNumber;
  final int? tableId;

  const TableLandingScreen({
    super.key,
    this.token,
    this.tableNumber,
    this.tableId,
  });

  @override
  State<TableLandingScreen> createState() => _TableLandingScreenState();
}

class _TableLandingScreenState extends State<TableLandingScreen> {
  bool _isLoading = true;
  String? _errorMessage;
  Map<String, dynamic>? _tableData;
  bool _isOccupied = false;
  bool _isCallingWaiter = false;

  @override
  void initState() {
    super.initState();
    _resolveAndVerifyTable();
  }

  void _resolveAndVerifyTable() {
    String? token = widget.token;
    int? tableNumber = widget.tableNumber;
    int? tableId = widget.tableId;

    // Fallback: If not passed in widget constructor, parse from Uri.base
    if (token == null && tableNumber == null && tableId == null) {
      final base = Uri.base;
      token = base.queryParameters['token'];
      final tNumStr = base.queryParameters['tableNumber'] ?? base.queryParameters['table'];
      if (tNumStr != null) tableNumber = int.tryParse(tNumStr);
      final tIdStr = base.queryParameters['tableId'];
      if (tIdStr != null) tableId = int.tryParse(tIdStr);

      // Check inside fragment if using hash router (e.g. #/table?token=...)
      if (base.fragment.contains('?')) {
        final fragQuery = base.fragment.split('?').last;
        final params = Uri.splitQueryString(fragQuery);
        token ??= params['token'];
        if (tableNumber == null && (params['tableNumber'] != null || params['table'] != null)) {
          tableNumber = int.tryParse(params['tableNumber'] ?? params['table']!);
        }
        if (tableId == null && params['tableId'] != null) {
          tableId = int.tryParse(params['tableId']!);
        }
      }
    }

    if (token == null && tableNumber == null && tableId == null) {
      final currentTable = context.read<CartProvider>().selectedTableNumber;
      final currentTableId = context.read<CartProvider>().selectedTableId;
      if (currentTable != null) {
        _loadTable(tableNumber: currentTable, tableId: currentTableId);
        return;
      }

      setState(() {
        _isLoading = false;
        _errorMessage = 'No table selected. Please scan the QR code placed on your table or enter the table number below.';
      });
      return;
    }

    _loadTable(token: token, tableNumber: tableNumber, tableId: tableId);
  }

  Future<void> _loadTable({String? token, int? tableNumber, int? tableId}) async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final result = await ApiService.verifyTableQr(
        token: token,
        tableNumber: tableNumber,
        tableId: tableId,
      );

      if (!mounted) return;

      final table = result['table'] as Map<String, dynamic>?;
      if (table == null) {
        throw Exception('Table information could not be retrieved.');
      }

      setState(() {
        _tableData = table;
        _isOccupied = result['isOccupied'] == true;
        _isLoading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _errorMessage = e.toString().replaceAll('Exception: ', '');
        _isLoading = false;
      });
    }
  }

  void _proceedToMenu() {
    if (_tableData == null) return;
    final tableId = (_tableData!['id'] as num).toInt();
    final tableNumber = (_tableData!['table_number'] as num).toInt();

    // Link table to CartProvider
    context.read<CartProvider>().setTable(tableId, tableNumber);

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Row(
          children: [
            const Icon(Icons.check_circle_rounded, color: Colors.white, size: 20),
            const SizedBox(width: 10),
            Text('Linked to Table #$tableNumber! Ready to order.'),
          ],
        ),
        backgroundColor: Colors.green.shade700,
        behavior: SnackBarBehavior.floating,
        duration: const Duration(seconds: 2),
      ),
    );

    context.go('/menu');
  }

  void _showServiceRequestSheet() {
    if (_tableData == null) return;
    final tableId = (_tableData!['id'] as num).toInt();
    final tableNumber = (_tableData!['table_number'] as num).toInt();

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (ctx) => Container(
        padding: const EdgeInsets.fromLTRB(24, 16, 24, 32),
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
          boxShadow: [
            BoxShadow(
              color: Colors.black26,
              blurRadius: 20,
              offset: Offset(0, -4),
            ),
          ],
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 44,
                height: 5,
                decoration: BoxDecoration(
                  color: Colors.grey.shade300,
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
            ),
            const SizedBox(height: 18),
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: AppTheme.primary.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(Icons.room_service_rounded, color: AppTheme.primary, size: 24),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Request Table Service',
                        style: GoogleFonts.outfit(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          color: AppTheme.secondary,
                        ),
                      ),
                      Text(
                        'Table #$tableNumber assistance',
                        style: GoogleFonts.inter(
                          fontSize: 13,
                          color: Colors.grey.shade600,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),
            _buildServiceOption(
              icon: Icons.person_pin_rounded,
              title: 'Call Waiter / Attendant',
              subtitle: 'A staff member will come to assist you',
              requestType: 'call_waiter',
              tableId: tableId,
              tableNumber: tableNumber,
              parentCtx: ctx,
            ),
            const SizedBox(height: 10),
            _buildServiceOption(
              icon: Icons.water_drop_rounded,
              title: 'Request Drinking Water',
              subtitle: 'Fresh iced or room temperature water',
              requestType: 'water',
              tableId: tableId,
              tableNumber: tableNumber,
              parentCtx: ctx,
            ),
            const SizedBox(height: 10),
            _buildServiceOption(
              icon: Icons.restaurant_rounded,
              title: 'Extra Cutlery / Napkins',
              subtitle: 'Plates, spoons, forks, or napkins',
              requestType: 'cutlery',
              tableId: tableId,
              tableNumber: tableNumber,
              parentCtx: ctx,
            ),
            const SizedBox(height: 10),
            _buildServiceOption(
              icon: Icons.receipt_long_rounded,
              title: 'Request Bill / Check',
              subtitle: 'Review your meal total and pay',
              requestType: 'bill',
              tableId: tableId,
              tableNumber: tableNumber,
              parentCtx: ctx,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildServiceOption({
    required IconData icon,
    required String title,
    required String subtitle,
    required String requestType,
    required int tableId,
    required int tableNumber,
    required BuildContext parentCtx,
  }) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () async {
          Navigator.of(parentCtx).pop();
          _dispatchServiceRequest(tableId, tableNumber, requestType, title);
        },
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          decoration: BoxDecoration(
            color: const Color(0xFFF8F9FA),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: Colors.grey.shade200),
          ),
          child: Row(
            children: [
              Icon(icon, color: AppTheme.primary, size: 22),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: GoogleFonts.inter(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: AppTheme.secondary,
                      ),
                    ),
                    Text(
                      subtitle,
                      style: GoogleFonts.inter(
                        fontSize: 12,
                        color: Colors.grey.shade600,
                      ),
                    ),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right_rounded, color: Colors.grey, size: 20),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _dispatchServiceRequest(int tableId, int tableNumber, String type, String label) async {
    setState(() => _isCallingWaiter = true);
    try {
      await ApiService.submitServiceRequest(
        tableId: tableId,
        requestType: type,
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Row(
            children: [
              const Icon(Icons.notifications_active_rounded, color: Colors.white, size: 20),
              const SizedBox(width: 10),
              Expanded(child: Text('Staff notified for Table #$tableNumber: $label!')),
            ],
          ),
          backgroundColor: AppTheme.primary,
          behavior: SnackBarBehavior.floating,
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.toString().replaceAll('Exception: ', '')),
          backgroundColor: Colors.redAccent,
          behavior: SnackBarBehavior.floating,
        ),
      );
    } finally {
      if (mounted) setState(() => _isCallingWaiter = false);
    }
  }

  void _showManualEntryDialog() {
    final textController = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(
          'Enter Table Number',
          style: GoogleFonts.outfit(fontWeight: FontWeight.bold),
        ),
        content: TextField(
          controller: textController,
          keyboardType: TextInputType.number,
          autofocus: true,
          decoration: const InputDecoration(
            hintText: 'e.g. 4',
            labelText: 'Table #',
            prefixIcon: Icon(Icons.table_restaurant_rounded),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () {
              final raw = textController.text.trim();
              Navigator.of(ctx).pop();
              final numParsed = int.tryParse(raw);
              if (numParsed != null) {
                _loadTable(tableNumber: numParsed);
              }
            },
            child: const Text('Find Table'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.background,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, color: AppTheme.secondary, size: 20),
          onPressed: () {
            if (context.canPop()) {
              context.pop();
            } else {
              context.go('/home');
            }
          },
        ),
        title: Text(
          'TableFlow Dine-In',
          style: GoogleFonts.outfit(
            fontWeight: FontWeight.bold,
            color: AppTheme.secondary,
            fontSize: 18,
          ),
        ),
        centerTitle: true,
        actions: [
          IconButton(
            icon: const Icon(Icons.qr_code_scanner_rounded, color: AppTheme.primary),
            tooltip: 'Scan Another QR',
            onPressed: () => context.push('/qr-checkin'),
          ),
        ],
      ),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_isLoading) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const CircularProgressIndicator(color: AppTheme.primary),
            const SizedBox(height: 18),
            Text(
              'Verifying Table Details...',
              style: GoogleFonts.inter(
                fontSize: 15,
                fontWeight: FontWeight.w600,
                color: AppTheme.secondary,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              'Connecting to TableFlow Live Service',
              style: GoogleFonts.inter(
                fontSize: 13,
                color: Colors.grey.shade600,
              ),
            ),
          ],
        ),
      );
    }

    if (_errorMessage != null || _tableData == null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: Colors.red.shade50,
                  shape: BoxShape.circle,
                ),
                child: Icon(Icons.error_outline_rounded, color: Colors.red.shade700, size: 48),
              ),
              const SizedBox(height: 20),
              Text(
                'Table Verification Failed',
                style: GoogleFonts.outfit(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                  color: AppTheme.secondary,
                ),
              ),
              const SizedBox(height: 10),
              Text(
                _errorMessage ?? 'We could not detect this table. Please check the QR code or enter your table number.',
                textAlign: TextAlign.center,
                style: GoogleFonts.inter(
                  fontSize: 14,
                  color: Colors.grey.shade600,
                  height: 1.4,
                ),
              ),
              const SizedBox(height: 28),
              ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.primary,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                ),
                onPressed: _showManualEntryDialog,
                icon: const Icon(Icons.table_restaurant_rounded, size: 20),
                label: const Text('Enter Table Number Manually'),
              ),
              const SizedBox(height: 12),
              OutlinedButton.icon(
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppTheme.secondary,
                  side: BorderSide(color: Colors.grey.shade300),
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                ),
                onPressed: () => context.push('/qr-checkin'),
                icon: const Icon(Icons.qr_code_scanner_rounded, size: 20),
                label: const Text('Scan Table QR Code Again'),
              ),
            ],
          ),
        ),
      );
    }

    final tableNumber = _tableData!['table_number'] ?? widget.tableNumber ?? 0;
    final capacity = _tableData!['capacity'] ?? 2;
    final category = _tableData!['table_categories'] as Map<String, dynamic>?;
    final categoryName = category?['name'] ?? 'Main Dining Area';
    final categoryDesc = category?['description'] ?? 'Comfortable dine-in table';

    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(20, 10, 20, 40),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // ── HERO TABLE CARD ────────────────────────────────────
          Container(
            padding: const EdgeInsets.all(26),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF2B2019), Color(0xFF1E1713)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(28),
              boxShadow: [
                BoxShadow(
                  color: AppTheme.primary.withValues(alpha: 0.25),
                  blurRadius: 24,
                  offset: const Offset(0, 10),
                ),
              ],
              border: Border.all(
                color: AppTheme.primary.withValues(alpha: 0.35),
                width: 1.5,
              ),
            ),
            child: Column(
              children: [
                // Top Tag
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                  decoration: BoxDecoration(
                    color: AppTheme.primary.withValues(alpha: 0.18),
                    borderRadius: BorderRadius.circular(30),
                    border: Border.all(color: AppTheme.primary.withValues(alpha: 0.4)),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.verified_rounded, color: AppTheme.primary, size: 14),
                      const SizedBox(width: 6),
                      Text(
                        'TABLEFLOW DINE-IN VERIFIED',
                        style: GoogleFonts.inter(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 1.2,
                          color: AppTheme.primary,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 20),

                // Table Icon Badge
                Container(
                  width: 80,
                  height: 80,
                  decoration: BoxDecoration(
                    color: AppTheme.primary.withValues(alpha: 0.15),
                    shape: BoxShape.circle,
                    border: Border.all(color: AppTheme.primary, width: 2),
                  ),
                  child: const Center(
                    child: Icon(Icons.table_restaurant_rounded, color: AppTheme.primary, size: 40),
                  ),
                ),
                const SizedBox(height: 16),

                // Table Title
                Text(
                  'TABLE $tableNumber',
                  style: GoogleFonts.outfit(
                    fontSize: 32,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 1.5,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(height: 6),

                Text(
                  categoryName,
                  style: GoogleFonts.inter(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                    color: Colors.white.withValues(alpha: 0.85),
                  ),
                ),
                const SizedBox(height: 4),

                Text(
                  categoryDesc,
                  textAlign: TextAlign.center,
                  style: GoogleFonts.inter(
                    fontSize: 12,
                    color: Colors.white.withValues(alpha: 0.6),
                  ),
                ),
                const SizedBox(height: 20),

                // Status Badge
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                  decoration: BoxDecoration(
                    color: _isOccupied
                        ? Colors.amber.shade900.withValues(alpha: 0.35)
                        : Colors.green.shade900.withValues(alpha: 0.35),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(
                      color: _isOccupied ? Colors.amber.shade400 : Colors.green.shade400,
                      width: 1,
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 8,
                        height: 8,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: _isOccupied ? Colors.amber.shade400 : Colors.green.shade400,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        _isOccupied ? 'Active Dine-In Session' : 'Ready for Dine-In & Ordering',
                        style: GoogleFonts.inter(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: _isOccupied ? Colors.amber.shade200 : Colors.green.shade200,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // ── TABLE SPECIFICATION CARDS ─────────────────────────
          Row(
            children: [
              Expanded(
                child: _buildDetailCard(
                  icon: Icons.people_alt_rounded,
                  title: 'Capacity',
                  value: '$capacity Guests',
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _buildDetailCard(
                  icon: Icons.location_on_rounded,
                  title: 'Zone / Area',
                  value: categoryName,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          _buildDetailCard(
            icon: Icons.electric_bolt_rounded,
            title: 'Direct Kitchen Routing',
            value: 'Orders are sent straight to the chef display system for Table #$tableNumber',
            isFullWidth: true,
          ),
          const SizedBox(height: 28),

          // ── PRIMARY ACTION: BROWSE MENU & ORDER ────────────────
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.primary,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 18),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
              elevation: 4,
              shadowColor: AppTheme.primary.withValues(alpha: 0.4),
            ),
            onPressed: _proceedToMenu,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.restaurant_menu_rounded, size: 22),
                const SizedBox(width: 10),
                Text(
                  'Browse Menu & Order Food',
                  style: GoogleFonts.outfit(
                    fontSize: 17,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(width: 8),
                const Icon(Icons.arrow_forward_rounded, size: 20),
              ],
            ),
          ),
          const SizedBox(height: 14),

          // ── SECONDARY ACTION: CALL WAITER ──────────────────────
          OutlinedButton.icon(
            style: OutlinedButton.styleFrom(
              foregroundColor: AppTheme.secondary,
              side: BorderSide(color: Colors.grey.shade300, width: 1.5),
              padding: const EdgeInsets.symmetric(vertical: 16),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
              backgroundColor: Colors.white,
            ),
            onPressed: _isCallingWaiter ? null : _showServiceRequestSheet,
            icon: _isCallingWaiter
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2, color: AppTheme.primary),
                  )
                : const Icon(Icons.room_service_rounded, color: AppTheme.primary, size: 20),
            label: Text(
              'Call Waiter / Service Assistance',
              style: GoogleFonts.inter(
                fontSize: 15,
                fontWeight: FontWeight.w600,
                color: AppTheme.secondary,
              ),
            ),
          ),

          // Optional: View Cart Shortcut if items in cart
          Consumer<CartProvider>(
            builder: (context, cart, _) {
              if (cart.itemCount == 0) return const SizedBox.shrink();
              return Padding(
                padding: const EdgeInsets.only(top: 14),
                child: TextButton.icon(
                  onPressed: () => context.push('/cart'),
                  icon: const Icon(Icons.shopping_bag_outlined, color: AppTheme.primary, size: 18),
                  label: Text(
                    'View My Cart (${cart.itemCount} items) • LKR ${cart.totalAmount.toStringAsFixed(0)}',
                    style: GoogleFonts.inter(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: AppTheme.primary,
                    ),
                  ),
                ),
              );
            },
          ),

          const SizedBox(height: 10),
          Center(
            child: TextButton(
              onPressed: _showManualEntryDialog,
              child: Text(
                'Wrong table? Enter different table number',
                style: GoogleFonts.inter(
                  fontSize: 13,
                  color: Colors.grey.shade600,
                  decoration: TextDecoration.underline,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDetailCard({
    required IconData icon,
    required String title,
    required String value,
    bool isFullWidth = false,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: Colors.grey.shade200),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: AppTheme.primary.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, color: AppTheme.primary, size: 18),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: GoogleFonts.inter(
                    fontSize: 11,
                    color: Colors.grey.shade500,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  value,
                  style: GoogleFonts.inter(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: AppTheme.secondary,
                    height: 1.3,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import '../../core/theme.dart';

class QrCheckinScreen extends StatefulWidget {
  const QrCheckinScreen({super.key});

  @override
  State<QrCheckinScreen> createState() => _QrCheckinScreenState();
}

class _QrCheckinScreenState extends State<QrCheckinScreen>
    with SingleTickerProviderStateMixin, WidgetsBindingObserver {
  final MobileScannerController _scannerController = MobileScannerController(
    detectionSpeed: DetectionSpeed.noDuplicates,
    returnImage: false,
    autoStart: false,   // ← do NOT start camera on construction
  );

  late AnimationController _animController;
  late Animation<double> _scanLineAnimation;

  bool _isProcessing = false;
  bool _torchEnabled = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);

    _animController = AnimationController(
      duration: const Duration(seconds: 2),
      vsync: this,
    )..repeat(reverse: true);

    _scanLineAnimation = Tween<double>(begin: 0.1, end: 0.9).animate(
      CurvedAnimation(parent: _animController, curve: Curves.easeInOut),
    );

    // Start camera only after the first frame — user is actually on this screen
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _scannerController.start();
    });
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // Pause camera when app goes to background; resume when foregrounded
    if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.inactive ||
        state == AppLifecycleState.hidden) {
      _scannerController.stop();
    } else if (state == AppLifecycleState.resumed) {
      if (mounted && !_isProcessing) _scannerController.start();
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _animController.dispose();
    _scannerController.dispose();
    super.dispose();
  }

  Future<void> _handleScannedCode(String rawCode) async {
    if (_isProcessing) return;
    setState(() => _isProcessing = true);

    try {
      String? token;
      int? parsedTableNum;
      int? parsedTableId;

      // Check if it's a TableFlow QR URI or web link
      if (rawCode.contains('token=')) {
        final tokenMatch = RegExp(r'[?&]token=([^&#]+)').firstMatch(rawCode);
        if (tokenMatch != null) {
          token = Uri.decodeComponent(tokenMatch.group(1)!);
        }
        final numMatch = RegExp(r'[?&]tableNumber=([^&#]+)').firstMatch(rawCode);
        if (numMatch != null) {
          parsedTableNum = int.tryParse(numMatch.group(1)!);
        }
        final idMatch = RegExp(r'[?&]tableId=([^&#]+)').firstMatch(rawCode);
        if (idMatch != null) {
          parsedTableId = int.tryParse(idMatch.group(1)!);
        }
      } else if (rawCode.contains(':') && rawCode.length > 20) {
        // Raw HMAC token
        token = rawCode;
      } else {
        // Direct manual numeric input
        final digits = rawCode.replaceAll(RegExp(r'[^0-9]'), '');
        if (digits.isNotEmpty) {
          parsedTableNum = int.tryParse(digits);
        }
      }

      _scannerController.stop();

      final queryParams = <String, String>{};
      if (token != null) queryParams['token'] = token;
      if (parsedTableNum != null) queryParams['tableNumber'] = parsedTableNum.toString();
      if (parsedTableId != null) queryParams['tableId'] = parsedTableId.toString();

      final uri = Uri(path: '/table', queryParameters: queryParams.isNotEmpty ? queryParams : null);

      if (!mounted) return;
      context.go(
        uri.toString(),
        extra: {
          'token': token,
          'tableNumber': parsedTableNum,
          'tableId': parsedTableId,
        },
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Could not parse table QR: ${e.toString().replaceAll('Exception: ', '')}'),
            backgroundColor: Colors.redAccent,
            behavior: SnackBarBehavior.floating,
          ),
        );
        setState(() => _isProcessing = false);
      }
    }
  }

  void _showManualEntryDialog() {
    final textController = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Enter Table Number'),
        content: TextField(
          controller: textController,
          keyboardType: TextInputType.number,
          autofocus: true,
          decoration: const InputDecoration(
            hintText: 'e.g. 4',
            labelText: 'Table #',
            prefixIcon: Icon(Icons.table_restaurant),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () {
              final code = textController.text.trim();
              Navigator.of(ctx).pop();
              if (code.isNotEmpty) {
                _handleScannedCode(code);
              }
            },
            child: const Text('Confirm Table'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, color: Colors.white, size: 20),
          onPressed: () {
            _scannerController.stop();
            if (context.canPop()) {
              context.pop();
            } else {
              context.go('/home');
            }
          },
        ),
        title: const Text(
          'Scan Table QR',
          style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
        ),
        actions: [
          IconButton(
            icon: Icon(
              _torchEnabled ? Icons.flash_on : Icons.flash_off,
              color: _torchEnabled ? AppTheme.primary : Colors.white70,
            ),
            onPressed: () {
              _scannerController.toggleTorch();
              setState(() => _torchEnabled = !_torchEnabled);
            },
          ),
          IconButton(
            icon: const Icon(Icons.flip_camera_ios, color: Colors.white70),
            onPressed: () => _scannerController.switchCamera(),
          ),
        ],
      ),
      body: Stack(
        children: [
          // Camera Viewfinder
          MobileScanner(
            controller: _scannerController,
            onDetect: (BarcodeCapture capture) {
              final barcodes = capture.barcodes;
              for (final barcode in barcodes) {
                final raw = barcode.rawValue;
                if (raw != null && raw.isNotEmpty) {
                  _handleScannedCode(raw);
                  break;
                }
              }
            },
          ),

          // Dark Overlay with Cutout
          LayoutBuilder(
            builder: (context, constraints) {
              final scanSize = constraints.maxWidth * 0.72;
              final left = (constraints.maxWidth - scanSize) / 2;
              final top = (constraints.maxHeight - scanSize) / 2.4;

              return Stack(
                children: [
                  ColorFiltered(
                    colorFilter: ColorFilter.mode(
                      Colors.black.withValues(alpha: 0.65),
                      BlendMode.srcOut,
                    ),
                    child: Stack(
                      children: [
                        Container(
                          decoration: const BoxDecoration(
                            color: Colors.black,
                            backgroundBlendMode: BlendMode.dstOut,
                          ),
                        ),
                        Positioned(
                          left: left,
                          top: top,
                          width: scanSize,
                          height: scanSize,
                          child: Container(
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(24),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),

                  // Scanning Border & Animated Laser Line
                  Positioned(
                    left: left,
                    top: top,
                    width: scanSize,
                    height: scanSize,
                    child: Container(
                      decoration: BoxDecoration(
                        border: Border.all(color: AppTheme.primary, width: 2.5),
                        borderRadius: BorderRadius.circular(24),
                      ),
                      child: AnimatedBuilder(
                        animation: _scanLineAnimation,
                        builder: (context, child) {
                          return Align(
                            alignment: Alignment(0, (_scanLineAnimation.value * 2) - 1),
                            child: Container(
                              height: 3,
                              margin: const EdgeInsets.symmetric(horizontal: 16),
                              decoration: BoxDecoration(
                                color: AppTheme.primary,
                                boxShadow: [
                                  BoxShadow(
                                    color: AppTheme.primary.withValues(alpha: 0.8),
                                    blurRadius: 10,
                                    spreadRadius: 2,
                                  ),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
                    ),
                  ),

                  // Guidance text
                  Positioned(
                    left: 24,
                    right: 24,
                    top: top + scanSize + 32,
                    child: Column(
                      children: [
                        const Text(
                          'Point your camera at the Table QR code',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 16,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'Your table number will be automatically linked for easy dine-in ordering.',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            color: Colors.white.withValues(alpha: 0.7),
                            fontSize: 13,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              );
            },
          ),

          // Loading indicator if verifying
          if (_isProcessing)
            Container(
              color: Colors.black54,
              child: const Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    CircularProgressIndicator(color: AppTheme.primary),
                    SizedBox(height: 16),
                    Text(
                      'Verifying Table...',
                      style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
              ),
            ),

          // Manual Table Entry Fallback Button
          Positioned(
            left: 32,
            right: 32,
            bottom: 40,
            child: OutlinedButton.icon(
              style: OutlinedButton.styleFrom(
                side: const BorderSide(color: Colors.white38),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
              onPressed: _showManualEntryDialog,
              icon: const Icon(Icons.edit_note, size: 20),
              label: const Text('Enter Table Number Manually'),
            ),
          ),
        ],
      ),
    );
  }
}

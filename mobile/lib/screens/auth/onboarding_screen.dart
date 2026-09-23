import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../services/supabase_service.dart';

// ─────────────────────────────────────────────────────────────────────────────
//  Data model for authentic onboarding slides
// ─────────────────────────────────────────────────────────────────────────────
class _OnboardingSlide {
  final String brandSubtitle;
  final String headline1;
  final String headline2;
  final String headline3;
  final String description;
  final String imagePath;
  final List<Color> bgGradient;
  final List<Color> waveGradient;
  final List<Color> backWaveGradient;
  final List<Color> buttonGradient;

  const _OnboardingSlide({
    required this.brandSubtitle,
    required this.headline1,
    required this.headline2,
    required this.headline3,
    required this.description,
    required this.imagePath,
    required this.bgGradient,
    required this.waveGradient,
    required this.backWaveGradient,
    required this.buttonGradient,
  });
}

const List<_OnboardingSlide> _slides = [
  _OnboardingSlide(
    brandSubtitle: 'Boutique Dining • Reimagined',
    headline1: 'Elegance.',
    headline2: 'Ambience.',
    headline3: 'Perfection.',
    description:
        'Experience restaurant dining at its finest — effortless, warm, and entirely at your fingertips.',
    imagePath: 'assets/images/onboarding_1.jpg',
    bgGradient: [Color(0xFFFCF6F0), Color(0xFFF7E2CF), Color(0xFFEAA26F)],
    waveGradient: [Color(0xFFC86731), Color(0xFFAD4E1D), Color(0xFF78310B)],
    backWaveGradient: [Color(0xFFE28543), Color(0xFFC15F24)],
    buttonGradient: [Color(0xFFD4AF37), Color(0xFFB87F5C)],
  ),
  _OnboardingSlide(
    brandSubtitle: 'From Kitchen to Table',
    headline1: 'Curated Menus.',
    headline2: 'Instant Orders.',
    headline3: 'Live Tracking.',
    description:
        'Explore chef-crafted specialties, customize your meal, and track every course in real time.',
    imagePath: 'assets/images/onboarding_2.jpg',
    bgGradient: [Color(0xFFFBF1E8), Color(0xFFF3D4BC), Color(0xFFDE9159)],
    waveGradient: [Color(0xFFB65620), Color(0xFF933C14), Color(0xFF642207)],
    backWaveGradient: [Color(0xFFD67436), Color(0xFFAF4F1A)],
    buttonGradient: [Color(0xFFE5A642), Color(0xFFB85A23)],
  ),
  _OnboardingSlide(
    brandSubtitle: 'Priority Table Access',
    headline1: 'VIP Seating.',
    headline2: 'Zero Queues.',
    headline3: 'Peace of Mind.',
    description:
        'Reserve your preferred table in seconds, join live queues seamlessly, or scan your table QR code.',
    imagePath: 'assets/images/onboarding_3.jpg',
    bgGradient: [Color(0xFFFAF3E8), Color(0xFFEED6B9), Color(0xFFE09F62)],
    waveGradient: [Color(0xFFA36029), Color(0xFF804015), Color(0xFF562808)],
    backWaveGradient: [Color(0xFFC5803E), Color(0xFF9B5822)],
    buttonGradient: [Color(0xFFD4AF37), Color(0xFF9E652E)],
  ),
];

// ─────────────────────────────────────────────────────────────────────────────
//  OnboardingScreen widget
// ─────────────────────────────────────────────────────────────────────────────
class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key});

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen>
    with SingleTickerProviderStateMixin {
  final PageController _pageController = PageController();
  int _currentPage = 0;

  late final AnimationController _entryController;
  late final Animation<double> _entryFade;
  late final Animation<Offset> _entrySlide;

  @override
  void initState() {
    super.initState();

    _entryController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 700),
    );
    _entryFade = CurvedAnimation(parent: _entryController, curve: Curves.easeOut);
    _entrySlide = Tween<Offset>(begin: const Offset(0, 0.04), end: Offset.zero)
        .animate(CurvedAnimation(parent: _entryController, curve: Curves.easeOutCubic));

    _entryController.forward();
  }

  @override
  void dispose() {
    _pageController.dispose();
    _entryController.dispose();
    super.dispose();
  }

  Future<void> _markSeenAndNavigate(BuildContext ctx, {String target = '/home'}) async {
    await SupabaseService.markOnboardingSeen();
    if (!ctx.mounted) return;
    ctx.go(target);
  }

  void _nextPage() {
    if (_currentPage < _slides.length - 1) {
      _pageController.nextPage(
        duration: const Duration(milliseconds: 500),
        curve: Curves.easeInOutCubic,
      );
    } else {
      _markSeenAndNavigate(context, target: '/home');
    }
  }

  void _onSignInTapped() {
    _markSeenAndNavigate(context, target: '/login');
  }

  @override
  Widget build(BuildContext context) {
    final currentSlide = _slides[_currentPage];

    return Scaffold(
      body: AnimatedContainer(
        duration: const Duration(milliseconds: 450),
        curve: Curves.easeInOut,
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: currentSlide.bgGradient,
          ),
        ),
        child: SafeArea(
          bottom: false,
          child: FadeTransition(
            opacity: _entryFade,
            child: SlideTransition(
              position: _entrySlide,
              child: Column(
                children: [
                  // ── Top Brand Header (Clean, balanced & centered) ─────────
                  Padding(
                    padding: const EdgeInsets.fromLTRB(20, 6, 20, 4),
                    child: Stack(
                      alignment: Alignment.center,
                      children: [
                        // Centered Logo & Title
                        Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Container(
                              width: 38,
                              height: 38,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                gradient: const LinearGradient(
                                  colors: [Color(0xFFD4AF37), Color(0xFFB87F5C)],
                                ),
                                boxShadow: [
                                  BoxShadow(
                                    color: const Color(0xFFD4AF37).withValues(alpha: 0.40),
                                    blurRadius: 10,
                                    offset: const Offset(0, 3),
                                  ),
                                ],
                              ),
                              child: const Center(
                                child: Icon(
                                  Icons.dinner_dining_rounded,
                                  color: Colors.white,
                                  size: 20,
                                ),
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              'TableFlow',
                              style: GoogleFonts.playfairDisplay(
                                fontSize: 21,
                                fontWeight: FontWeight.bold,
                                letterSpacing: 0.5,
                                color: const Color(0xFF2B1B12),
                              ),
                            ),
                            AnimatedSwitcher(
                              duration: const Duration(milliseconds: 250),
                              child: Text(
                                currentSlide.brandSubtitle,
                                key: ValueKey(currentSlide.brandSubtitle),
                                style: GoogleFonts.inter(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w600,
                                  letterSpacing: 0.8,
                                  color: const Color(0xFF7A4526),
                                ),
                              ),
                            ),
                          ],
                        ),

                        // Skip button in top right
                        Align(
                          alignment: Alignment.topRight,
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(18),
                            child: BackdropFilter(
                              filter: ImageFilter.blur(sigmaX: 8, sigmaY: 8),
                              child: Container(
                                decoration: BoxDecoration(
                                  color: Colors.white.withValues(alpha: 0.45),
                                  borderRadius: BorderRadius.circular(18),
                                  border: Border.all(
                                    color: Colors.white.withValues(alpha: 0.70),
                                    width: 1,
                                  ),
                                ),
                                child: Material(
                                  color: Colors.transparent,
                                  child: InkWell(
                                    borderRadius: BorderRadius.circular(18),
                                    onTap: () => _markSeenAndNavigate(context),
                                    child: Padding(
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 13,
                                        vertical: 5,
                                      ),
                                      child: Text(
                                        'Skip',
                                        style: GoogleFonts.inter(
                                          fontSize: 12,
                                          fontWeight: FontWeight.w700,
                                          color: const Color(0xFF2B1B12),
                                        ),
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),

                  // ── PageView with Authentic Photograph ────────────────────
                  Expanded(
                    child: PageView.builder(
                      controller: _pageController,
                      physics: const BouncingScrollPhysics(),
                      onPageChanged: (i) => setState(() => _currentPage = i),
                      itemCount: _slides.length,
                      itemBuilder: (context, index) {
                        final slide = _slides[index];
                        return Padding(
                          padding: const EdgeInsets.fromLTRB(20, 8, 20, 8),
                          child: Container(
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(28),
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.black.withValues(alpha: 0.18),
                                  blurRadius: 24,
                                  offset: const Offset(0, 10),
                                ),
                              ],
                            ),
                            child: ClipRRect(
                              borderRadius: BorderRadius.circular(28),
                              child: Image.asset(
                                slide.imagePath,
                                fit: BoxFit.cover,
                                width: double.infinity,
                              ),
                            ),
                          ),
                        );
                      },
                    ),
                  ),

                  // ── Bottom Wave Overlay with Typography & Navigation ──────
                  _BottomWaveCard(
                    slide: currentSlide,
                    currentPage: _currentPage,
                    pageCount: _slides.length,
                    onNext: _nextPage,
                    onSignIn: _onSignInTapped,
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

// ─────────────────────────────────────────────────────────────────────────────
//  Bottom Multi-Layer Organic Wave Card (Matches user reference design)
// ─────────────────────────────────────────────────────────────────────────────
class _BottomWaveCard extends StatelessWidget {
  final _OnboardingSlide slide;
  final int currentPage;
  final int pageCount;
  final VoidCallback onNext;
  final VoidCallback onSignIn;

  const _BottomWaveCard({
    required this.slide,
    required this.currentPage,
    required this.pageCount,
    required this.onNext,
    required this.onSignIn,
  });

  @override
  Widget build(BuildContext context) {
    final isLastPage = currentPage == pageCount - 1;

    return SizedBox(
      width: double.infinity,
      height: isLastPage ? 335 : 310,
      child: Stack(
        fit: StackFit.expand,
        children: [
          // ── Layer 1: 3D Layered Wave Painter with Ambient Elevation ──
          CustomPaint(
            painter: _LayeredWavePainter(
              frontColors: slide.waveGradient,
              backColors: slide.backWaveGradient,
            ),
          ),

          // ── Layer 2: Foreground Typography & Controls ──────────────
          Padding(
            padding: const EdgeInsets.fromLTRB(28, 40, 28, 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                // ── 3-Line Punchy Statement (Matches reference design) ──
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${slide.headline1}\n${slide.headline2}\n${slide.headline3}',
                      style: GoogleFonts.outfit(
                        fontSize: 27,
                        fontWeight: FontWeight.w800,
                        color: Colors.white,
                        height: 1.15,
                        letterSpacing: -0.3,
                        shadows: [
                          Shadow(
                            color: Colors.black.withValues(alpha: 0.30),
                            offset: const Offset(0, 2),
                            blurRadius: 5,
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      slide.description,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: GoogleFonts.inter(
                        fontSize: 13,
                        fontWeight: FontWeight.w400,
                        color: Colors.white.withValues(alpha: 0.90),
                        height: 1.45,
                      ),
                    ),
                  ],
                ),

                // ── Bottom Controls: Segmented Progress & CTA Button ────
                Column(
                  children: [
                    // Segmented Story/Bar Indicator (like reference design)
                    _SegmentedProgressBar(
                      count: pageCount,
                      current: currentPage,
                    ),

                    const SizedBox(height: 14),

                    // Primary Glow CTA Button
                    _GlowingCTAButton(
                      label: isLastPage ? 'Explore as Guest' : 'Continue',
                      gradient: slide.buttonGradient,
                      isLast: isLastPage,
                      onTap: onNext,
                    ),

                    // Sign In prompt on the last slide
                    if (isLastPage)
                      Padding(
                        padding: const EdgeInsets.only(top: 10),
                        child: GestureDetector(
                          onTap: onSignIn,
                          behavior: HitTestBehavior.opaque,
                          child: Text.rich(
                            TextSpan(
                              text: 'Already a member? ',
                              style: GoogleFonts.inter(
                                fontSize: 13,
                                color: Colors.white.withValues(alpha: 0.9),
                              ),
                              children: [
                                TextSpan(
                                  text: 'Sign In',
                                  style: GoogleFonts.inter(
                                    fontSize: 13,
                                    fontWeight: FontWeight.bold,
                                    color: Colors.white,
                                    decoration: TextDecoration.underline,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Custom Wave Painter with 3D Bezier Curves and Dynamic Shadows
// ─────────────────────────────────────────────────────────────────────────────
class _LayeredWavePainter extends CustomPainter {
  final List<Color> frontColors;
  final List<Color> backColors;

  _LayeredWavePainter({
    required this.frontColors,
    required this.backColors,
  });

  @override
  void paint(Canvas canvas, Size size) {
    // ── 1. Back Layer Wave (Secondary Crest) ─────────────────────
    final backPath = Path();
    backPath.moveTo(0, size.height * 0.12);
    backPath.cubicTo(
      size.width * 0.32, 0,
      size.width * 0.70, size.height * 0.22,
      size.width, size.height * 0.11,
    );
    backPath.lineTo(size.width, size.height);
    backPath.lineTo(0, size.height);
    backPath.close();

    // Elevation drop shadow for back wave
    canvas.drawShadow(
      backPath,
      Colors.black.withValues(alpha: 0.24),
      12.0,
      false,
    );

    final backPaint = Paint()
      ..shader = LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: backColors,
      ).createShader(Rect.fromLTWH(0, 0, size.width, size.height));
    canvas.drawPath(backPath, backPaint);

    // ── 2. Front Layer Wave (Primary Fluid Crest) ────────────────
    final frontPath = Path();
    frontPath.moveTo(0, size.height * 0.18);
    frontPath.cubicTo(
      size.width * 0.30, size.height * 0.27,
      size.width * 0.65, size.height * 0.02,
      size.width, size.height * 0.08,
    );
    frontPath.lineTo(size.width, size.height);
    frontPath.lineTo(0, size.height);
    frontPath.close();

    // Elevation drop shadow for front wave
    canvas.drawShadow(
      frontPath,
      Colors.black.withValues(alpha: 0.32),
      18.0,
      false,
    );

    final frontPaint = Paint()
      ..shader = LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: frontColors,
      ).createShader(Rect.fromLTWH(0, 0, size.width, size.height));
    canvas.drawPath(frontPath, frontPaint);
  }

  @override
  bool shouldRepaint(covariant _LayeredWavePainter oldDelegate) {
    return oldDelegate.frontColors != frontColors ||
        oldDelegate.backColors != backColors;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Modern Segmented Progress Bar (Directly from reference design)
// ─────────────────────────────────────────────────────────────────────────────
class _SegmentedProgressBar extends StatelessWidget {
  final int count;
  final int current;

  const _SegmentedProgressBar({
    required this.count,
    required this.current,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: List.generate(count, (index) {
        final isActive = index == current;
        return AnimatedContainer(
          duration: const Duration(milliseconds: 350),
          curve: Curves.easeInOutCubic,
          margin: const EdgeInsets.symmetric(horizontal: 4),
          height: 4.5,
          width: isActive ? 48 : 20,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(3),
            color: isActive
                ? Colors.white
                : Colors.white.withValues(alpha: 0.35),
            boxShadow: isActive
                ? [
                    BoxShadow(
                      color: Colors.white.withValues(alpha: 0.70),
                      blurRadius: 8,
                      offset: const Offset(0, 1),
                    ),
                  ]
                : null,
          ),
        );
      }),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Luminous CTA Button with Spring Tap Physics
// ─────────────────────────────────────────────────────────────────────────────
class _GlowingCTAButton extends StatefulWidget {
  final String label;
  final List<Color> gradient;
  final bool isLast;
  final VoidCallback onTap;

  const _GlowingCTAButton({
    required this.label,
    required this.gradient,
    required this.isLast,
    required this.onTap,
  });

  @override
  State<_GlowingCTAButton> createState() => _GlowingCTAButtonState();
}

class _GlowingCTAButtonState extends State<_GlowingCTAButton>
    with SingleTickerProviderStateMixin {
  late final AnimationController _tapController;
  late final Animation<double> _scaleAnimation;

  @override
  void initState() {
    super.initState();
    _tapController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 100),
      reverseDuration: const Duration(milliseconds: 180),
      lowerBound: 0.96,
      upperBound: 1.0,
      value: 1.0,
    );
    _scaleAnimation = _tapController;
  }

  @override
  void dispose() {
    _tapController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTapDown: (_) => _tapController.reverse(),
      onTapUp: (_) async {
        await _tapController.forward();
        widget.onTap();
      },
      onTapCancel: () => _tapController.forward(),
      child: ScaleTransition(
        scale: _scaleAnimation,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 350),
          width: double.infinity,
          height: 52,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            gradient: LinearGradient(
              colors: widget.gradient,
              begin: Alignment.centerLeft,
              end: Alignment.centerRight,
            ),
            boxShadow: [
              BoxShadow(
                color: widget.gradient.first.withValues(alpha: 0.50),
                blurRadius: 18,
                offset: const Offset(0, 8),
              ),
            ],
            border: Border.all(
              color: Colors.white.withValues(alpha: 0.35),
              width: 1,
            ),
          ),
          child: Center(
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  widget.label,
                  style: GoogleFonts.inter(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.6,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(width: 8),
                Icon(
                  widget.isLast
                      ? Icons.check_circle_outline_rounded
                      : Icons.arrow_forward_rounded,
                  color: Colors.white,
                  size: 19,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

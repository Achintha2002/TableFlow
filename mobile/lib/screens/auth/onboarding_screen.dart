import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../services/supabase_service.dart';

// ─────────────────────────────────────────────────────────────────────────────
//  Data model for each realistic onboarding slide
// ─────────────────────────────────────────────────────────────────────────────
class _OnboardingSlide {
  final String brandSubtitle;
  final String headline1;
  final String headline2;
  final String headline3;
  final String description;
  final String imagePath;
  final String floatingBadge;
  final IconData badgeIcon;
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
    required this.floatingBadge,
    required this.badgeIcon,
    required this.bgGradient,
    required this.waveGradient,
    required this.backWaveGradient,
    required this.buttonGradient,
  });
}

const List<_OnboardingSlide> _slides = [
  _OnboardingSlide(
    brandSubtitle: 'Boutique Dining, Reimagined',
    headline1: 'Elegance.',
    headline2: 'Ambience.',
    headline3: 'Perfection.',
    description:
        'Experience restaurant dining the way it was meant to be — effortless, sophisticated, and entirely at your fingertips.',
    imagePath: 'assets/images/onboarding_1.jpg',
    floatingBadge: 'Michelin Star Atmosphere',
    badgeIcon: Icons.auto_awesome,
    bgGradient: [Color(0xFFFCF5EE), Color(0xFFF6DEC9), Color(0xFFE89A65)],
    waveGradient: [Color(0xFFCA6B33), Color(0xFFB05322), Color(0xFF7E350E)],
    backWaveGradient: [Color(0xFFE38848), Color(0xFFC46429)],
    buttonGradient: [Color(0xFFD4AF37), Color(0xFFB87F5C)],
  ),
  _OnboardingSlide(
    brandSubtitle: 'From Kitchen to Table',
    headline1: 'Curated Menus.',
    headline2: 'Instant Orders.',
    headline3: 'Live Tracking.',
    description:
        'Explore chef-crafted dishes, customize every ingredient, and track your order preparation in real time.',
    imagePath: 'assets/images/onboarding_2.jpg',
    floatingBadge: "Artisanal Gourmet Flavors",
    badgeIcon: Icons.restaurant_menu_rounded,
    bgGradient: [Color(0xFFFAF0E6), Color(0xFFF2D1B8), Color(0xFFDC8B52)],
    waveGradient: [Color(0xFFB85A23), Color(0xFF964016), Color(0xFF67250A)],
    backWaveGradient: [Color(0xFFD8783A), Color(0xFFB2531E)],
    buttonGradient: [Color(0xFFE5A642), Color(0xFFB85A23)],
  ),
  _OnboardingSlide(
    brandSubtitle: 'Priority VIP Access',
    headline1: 'VIP Seating.',
    headline2: 'Zero Queues.',
    headline3: 'Peace of Mind.',
    description:
        'Reserve your preferred table in seconds, join live queues effortlessly, or scan your table QR code upon arrival.',
    imagePath: 'assets/images/onboarding_3.jpg',
    floatingBadge: 'Guaranteed Priority Reservation',
    badgeIcon: Icons.verified_rounded,
    bgGradient: [Color(0xFFF9F1E6), Color(0xFFEED4B6), Color(0xFFDF9B5D)],
    waveGradient: [Color(0xFFA6642C), Color(0xFF834418), Color(0xFF592B0A)],
    backWaveGradient: [Color(0xFFC78342), Color(0xFF9E5C25)],
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
    with TickerProviderStateMixin {
  final PageController _pageController = PageController();
  int _currentPage = 0;

  // Entry animation controller
  late final AnimationController _entryController;
  late final Animation<double> _entryFade;
  late final Animation<Offset> _entrySlide;

  // Badge subtle float
  late final AnimationController _badgeFloatController;
  late final Animation<double> _badgeFloat;

  @override
  void initState() {
    super.initState();

    _entryController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 750),
    );
    _entryFade = CurvedAnimation(parent: _entryController, curve: Curves.easeOut);
    _entrySlide = Tween<Offset>(begin: const Offset(0, 0.05), end: Offset.zero)
        .animate(CurvedAnimation(parent: _entryController, curve: Curves.easeOutCubic));

    _badgeFloatController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2400),
    )..repeat(reverse: true);
    _badgeFloat = Tween<double>(begin: -4.0, end: 4.0).animate(
      CurvedAnimation(parent: _badgeFloatController, curve: Curves.easeInOut),
    );

    _entryController.forward();
  }

  @override
  void dispose() {
    _pageController.dispose();
    _entryController.dispose();
    _badgeFloatController.dispose();
    super.dispose();
  }

  Future<void> _markSeenAndNavigate(BuildContext ctx) async {
    await SupabaseService.markOnboardingSeen();
    if (!ctx.mounted) return;

    final isAuth = Supabase.instance.client.auth.currentSession != null;
    ctx.go(isAuth ? '/home' : '/login');
  }

  void _nextPage() {
    if (_currentPage < _slides.length - 1) {
      _pageController.nextPage(
        duration: const Duration(milliseconds: 550),
        curve: Curves.easeInOutCubic,
      );
    } else {
      _markSeenAndNavigate(context);
    }
  }

  @override
  Widget build(BuildContext context) {
    final currentSlide = _slides[_currentPage];

    return Scaffold(
      body: AnimatedContainer(
        duration: const Duration(milliseconds: 500),
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
                  // ── Top Bar with Logo, Tagline & Skip ─────────────────────
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 8),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        // Glowing Brand Emblem
                        Container(
                          width: 40,
                          height: 40,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            gradient: const LinearGradient(
                              colors: [Color(0xFFD4AF37), Color(0xFFB87F5C)],
                            ),
                            boxShadow: [
                              BoxShadow(
                                color: const Color(0xFFD4AF37).withValues(alpha: 0.45),
                                blurRadius: 12,
                                offset: const Offset(0, 4),
                              ),
                            ],
                          ),
                          child: const Center(
                            child: Icon(
                              Icons.dinner_dining_rounded,
                              color: Colors.white,
                              size: 22,
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        // Brand Name & Dynamic Subtitle
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                'TableFlow',
                                style: GoogleFonts.playfairDisplay(
                                  fontSize: 22,
                                  fontWeight: FontWeight.bold,
                                  letterSpacing: 0.6,
                                  color: const Color(0xFF2E1C12),
                                ),
                              ),
                              AnimatedSwitcher(
                                duration: const Duration(milliseconds: 300),
                                child: Text(
                                  currentSlide.brandSubtitle,
                                  key: ValueKey(currentSlide.brandSubtitle),
                                  style: GoogleFonts.inter(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w600,
                                    letterSpacing: 1.0,
                                    color: const Color(0xFF7A4828),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        // Glassmorphic Skip Pill
                        ClipRRect(
                          borderRadius: BorderRadius.circular(20),
                          child: BackdropFilter(
                            filter: ImageFilter.blur(sigmaX: 8, sigmaY: 8),
                            child: Container(
                              decoration: BoxDecoration(
                                color: Colors.white.withValues(alpha: 0.35),
                                borderRadius: BorderRadius.circular(20),
                                border: Border.all(
                                  color: Colors.white.withValues(alpha: 0.60),
                                  width: 1,
                                ),
                              ),
                              child: Material(
                                color: Colors.transparent,
                                child: InkWell(
                                  borderRadius: BorderRadius.circular(20),
                                  onTap: () => _markSeenAndNavigate(context),
                                  child: Padding(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 14,
                                      vertical: 6,
                                    ),
                                    child: Text(
                                      'Skip',
                                      style: GoogleFonts.inter(
                                        fontSize: 12,
                                        fontWeight: FontWeight.w700,
                                        color: const Color(0xFF2E1C12),
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

                  // ── PageView for Realistic Photo & Content ────────────────
                  Expanded(
                    child: PageView.builder(
                      controller: _pageController,
                      physics: const BouncingScrollPhysics(),
                      onPageChanged: (i) => setState(() => _currentPage = i),
                      itemCount: _slides.length,
                      itemBuilder: (context, index) {
                        return _SlideBody(
                          slide: _slides[index],
                          badgeFloat: _badgeFloat,
                          isActive: index == _currentPage,
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
//  Upper Realistic Photo Section with Floating Glass Badge
// ─────────────────────────────────────────────────────────────────────────────
class _SlideBody extends StatelessWidget {
  final _OnboardingSlide slide;
  final Animation<double> badgeFloat;
  final bool isActive;

  const _SlideBody({
    required this.slide,
    required this.badgeFloat,
    required this.isActive,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
      child: Stack(
        children: [
          // ── Cinematic Realistic Photograph Card ────────────────────
          Positioned.fill(
            child: Container(
              margin: const EdgeInsets.only(bottom: 24),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(32),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.22),
                    blurRadius: 28,
                    offset: const Offset(0, 14),
                  ),
                  BoxShadow(
                    color: slide.waveGradient.first.withValues(alpha: 0.28),
                    blurRadius: 36,
                    offset: const Offset(0, 18),
                  ),
                ],
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(32),
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    Image.asset(
                      slide.imagePath,
                      fit: BoxFit.cover,
                    ),
                    // Ambient light gradient to soften top and bottom
                    Container(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: [
                            Colors.black.withValues(alpha: 0.15),
                            Colors.transparent,
                            Colors.black.withValues(alpha: 0.35),
                          ],
                          stops: const [0.0, 0.5, 1.0],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),

          // ── Floating Luxury Glass Badge ────────────────────────────
          Positioned(
            bottom: 38,
            left: 16,
            right: 16,
            child: AnimatedBuilder(
              animation: badgeFloat,
              builder: (context, child) {
                return Transform.translate(
                  offset: Offset(0, isActive ? badgeFloat.value : 0),
                  child: child,
                );
              },
              child: ClipRRect(
                borderRadius: BorderRadius.circular(24),
                child: BackdropFilter(
                  filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                    decoration: BoxDecoration(
                      color: Colors.black.withValues(alpha: 0.42),
                      borderRadius: BorderRadius.circular(24),
                      border: Border.all(
                        color: Colors.white.withValues(alpha: 0.25),
                        width: 1,
                      ),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          padding: const EdgeInsets.all(6),
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: const Color(0xFFD4AF37).withValues(alpha: 0.25),
                          ),
                          child: Icon(
                            slide.badgeIcon,
                            color: const Color(0xFFFFD54F),
                            size: 15,
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            slide.floatingBadge,
                            style: GoogleFonts.inter(
                              color: Colors.white,
                              fontSize: 12.5,
                              fontWeight: FontWeight.w600,
                              letterSpacing: 0.4,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Bottom Multi-Layer Organic Wave Card (Inspired by reference design)
// ─────────────────────────────────────────────────────────────────────────────
class _BottomWaveCard extends StatelessWidget {
  final _OnboardingSlide slide;
  final int currentPage;
  final int pageCount;
  final VoidCallback onNext;

  const _BottomWaveCard({
    required this.slide,
    required this.currentPage,
    required this.pageCount,
    required this.onNext,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      height: 330,
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
            padding: const EdgeInsets.fromLTRB(28, 48, 28, 24),
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
                            color: Colors.black.withValues(alpha: 0.35),
                            offset: const Offset(0, 2),
                            blurRadius: 6,
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

                    const SizedBox(height: 16),

                    // Primary Glow CTA Button
                    _GlowingCTAButton(
                      label: currentPage == pageCount - 1
                          ? 'Get Started'
                          : 'Continue',
                      gradient: slide.buttonGradient,
                      isLast: currentPage == pageCount - 1,
                      onTap: onNext,
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
      Colors.black.withValues(alpha: 0.28),
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
      Colors.black.withValues(alpha: 0.36),
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
          height: 54,
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

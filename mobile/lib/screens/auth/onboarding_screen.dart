import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../core/theme.dart';

// ─────────────────────────────────────────────
//  Data model for each onboarding slide
// ─────────────────────────────────────────────
class _OnboardingSlide {
  final String title;
  final String subtitle;
  final String description;
  final String imagePath;
  final Color accentColor;
  final List<Color> gradientColors;

  const _OnboardingSlide({
    required this.title,
    required this.subtitle,
    required this.description,
    required this.imagePath,
    required this.accentColor,
    required this.gradientColors,
  });
}

const List<_OnboardingSlide> _slides = [
  _OnboardingSlide(
    title: 'TableFlow',
    subtitle: 'Boutique Dining, Reimagined',
    description:
        'Experience restaurant dining the way it was meant to be — effortless, elegant, and entirely at your fingertips.',
    imagePath: 'assets/images/onboarding_1.jpg',
    accentColor: AppTheme.primary,
    gradientColors: [Color(0xFFB87F5C), Color(0xFFD4AF37)],
  ),
  _OnboardingSlide(
    title: 'Order & Pay',
    subtitle: 'From table to taste',
    description:
        'Browse our curated menu, add to your cart, and place orders in seconds. Track your order status in real time.',
    imagePath: 'assets/images/onboarding_2.jpg',
    accentColor: Color(0xFF3A2E28),
    gradientColors: [Color(0xFF3A2E28), Color(0xFF6B4F3A)],
  ),
  _OnboardingSlide(
    title: 'Reserve & Relax',
    subtitle: 'Your table awaits',
    description:
        'Book a table, join the live queue, or scan a QR code on arrival. Your premium dining experience starts before you walk in.',
    imagePath: 'assets/images/onboarding_3.jpg',
    accentColor: AppTheme.tertiary,
    gradientColors: [Color(0xFFD4AF37), Color(0xFFB87F5C)],
  ),
];

// ─────────────────────────────────────────────
//  OnboardingScreen widget
// ─────────────────────────────────────────────
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

  // Icon bounce animation
  late final AnimationController _iconController;
  late final Animation<double> _iconBounce;

  @override
  void initState() {
    super.initState();

    // Entry fade + slide
    _entryController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
    );
    _entryFade = CurvedAnimation(parent: _entryController, curve: Curves.easeOut);
    _entrySlide = Tween<Offset>(begin: const Offset(0, 0.08), end: Offset.zero)
        .animate(CurvedAnimation(parent: _entryController, curve: Curves.easeOutCubic));

    // Icon float animation
    _iconController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1800),
    )..repeat(reverse: true);
    _iconBounce = Tween<double>(begin: -8.0, end: 8.0).animate(
      CurvedAnimation(parent: _iconController, curve: Curves.easeInOut),
    );

    _entryController.forward();
  }

  @override
  void dispose() {
    _pageController.dispose();
    _entryController.dispose();
    _iconController.dispose();
    super.dispose();
  }

  Future<void> _markSeenAndNavigate(BuildContext ctx) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('onboarding_seen', true);
    if (!ctx.mounted) return;

    // If the user just registered they are already authenticated → go home
    // Otherwise (first launch, not logged in) → go to login
    final isAuth = Supabase.instance.client.auth.currentSession != null;
    ctx.go(isAuth ? '/home' : '/login');
  }

  void _nextPage() {
    if (_currentPage < _slides.length - 1) {
      _pageController.nextPage(
        duration: const Duration(milliseconds: 500),
        curve: Curves.easeInOutCubic,
      );
    } else {
      _markSeenAndNavigate(context);
    }
  }

  @override
  Widget build(BuildContext context) {
    final slide = _slides[_currentPage];

    return Scaffold(
      backgroundColor: AppTheme.background,
      body: SafeArea(
        child: FadeTransition(
          opacity: _entryFade,
          child: SlideTransition(
            position: _entrySlide,
            child: Column(
              children: [
                // ── Skip button ──────────────────────────────────────────
                Align(
                  alignment: Alignment.centerRight,
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(0, 16, 20, 0),
                    child: TextButton(
                      onPressed: () => _markSeenAndNavigate(context),
                      style: TextButton.styleFrom(
                        foregroundColor: AppTheme.secondary.withValues(alpha: 0.5),
                      ),
                      child: Text(
                        'Skip',
                        style: GoogleFonts.inter(
                          fontSize: 13,
                          fontWeight: FontWeight.w500,
                          letterSpacing: 0.5,
                        ),
                      ),
                    ),
                  ),
                ),

                // ── PageView ─────────────────────────────────────────────
                Expanded(
                  child: PageView.builder(
                    controller: _pageController,
                    physics: const BouncingScrollPhysics(),
                    onPageChanged: (i) => setState(() => _currentPage = i),
                    itemCount: _slides.length,
                    itemBuilder: (context, index) {
                      return _SlideContent(
                        slide: _slides[index],
                        iconBounce: _iconBounce,
                        isActive: index == _currentPage,
                      );
                    },
                  ),
                ),

                // ── Dots ─────────────────────────────────────────────────
                _DotIndicator(
                  count: _slides.length,
                  current: _currentPage,
                  activeColor: slide.accentColor,
                ),

                const SizedBox(height: 24),

                // ── CTA button ───────────────────────────────────────────
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 32),
                  child: _AnimatedCTAButton(
                    label: _currentPage == _slides.length - 1
                        ? 'Get Started'
                        : 'Continue',
                    gradient: slide.gradientColors,
                    onTap: _nextPage,
                  ),
                ),

                const SizedBox(height: 16),

                // ── Already have account ─────────────────────────────────
                if (_currentPage == _slides.length - 1)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          'Already have an account?',
                          style: GoogleFonts.inter(
                            fontSize: 13,
                            color: AppTheme.secondary.withValues(alpha: 0.6),
                          ),
                        ),
                        TextButton(
                          onPressed: () => _markSeenAndNavigate(context),
                          style: TextButton.styleFrom(
                            foregroundColor: AppTheme.primary,
                          ),
                          child: Text(
                            'Sign in',
                            style: GoogleFonts.inter(
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                      ],
                    ),
                  )
                else
                  const SizedBox(height: 24),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────
//  Individual slide content
// ─────────────────────────────────────────────
class _SlideContent extends StatelessWidget {
  final _OnboardingSlide slide;
  final Animation<double> iconBounce;
  final bool isActive;

  const _SlideContent({
    required this.slide,
    required this.iconBounce,
    required this.isActive,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 32),
      child: Column(
        children: [
          const SizedBox(height: 16),

          // ── Illustration card ──────────────────────────────────────
          Expanded(
            flex: 5,
            child: Center(
              child: AnimatedBuilder(
                animation: iconBounce,
                builder: (context, child) {
                  return Transform.translate(
                    offset: Offset(0, isActive ? iconBounce.value : 0),
                    child: child,
                  );
                },
                child: _IllustrationCard(slide: slide),
              ),
            ),
          ),

          const SizedBox(height: 36),

          // ── Text content ──────────────────────────────────────────
          Expanded(
            flex: 3,
            child: Column(
              children: [
                // Accent line
                Container(
                  width: 48,
                  height: 3,
                  decoration: BoxDecoration(
                    gradient: LinearGradient(colors: slide.gradientColors),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
                const SizedBox(height: 20),

                Text(
                  slide.title,
                  textAlign: TextAlign.center,
                  style: GoogleFonts.playfairDisplay(
                    fontSize: 30,
                    fontWeight: FontWeight.bold,
                    color: AppTheme.secondary,
                    letterSpacing: 0.5,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  slide.subtitle,
                  textAlign: TextAlign.center,
                  style: GoogleFonts.inter(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 1.5,
                    color: slide.accentColor,
                  ),
                ),
                const SizedBox(height: 16),
                Text(
                  slide.description,
                  textAlign: TextAlign.center,
                  style: GoogleFonts.inter(
                    fontSize: 14,
                    height: 1.65,
                    color: AppTheme.secondary.withValues(alpha: 0.65),
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

// ─────────────────────────────────────────────
//  Image-based illustration card
// ─────────────────────────────────────────────
class _IllustrationCard extends StatelessWidget {
  final _OnboardingSlide slide;

  const _IllustrationCard({required this.slide});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 300,
      height: 280,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(28),
        boxShadow: [
          BoxShadow(
            color: slide.gradientColors.first.withValues(alpha: 0.22),
            blurRadius: 32,
            offset: const Offset(0, 14),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(28),
        child: Image.asset(
          slide.imagePath,
          fit: BoxFit.cover,
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────
//  Animated dot indicator
// ─────────────────────────────────────────────
class _DotIndicator extends StatelessWidget {
  final int count;
  final int current;
  final Color activeColor;

  const _DotIndicator({
    required this.count,
    required this.current,
    required this.activeColor,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: List.generate(count, (i) {
        final isActive = i == current;
        return AnimatedContainer(
          duration: const Duration(milliseconds: 350),
          curve: Curves.easeInOutCubic,
          margin: const EdgeInsets.symmetric(horizontal: 4),
          width: isActive ? 28 : 8,
          height: 8,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(4),
            color: isActive
                ? activeColor
                : AppTheme.secondary.withValues(alpha: 0.18),
          ),
        );
      }),
    );
  }
}

// ─────────────────────────────────────────────
//  Gradient CTA button with tap animation
// ─────────────────────────────────────────────
class _AnimatedCTAButton extends StatefulWidget {
  final String label;
  final List<Color> gradient;
  final VoidCallback onTap;

  const _AnimatedCTAButton({
    required this.label,
    required this.gradient,
    required this.onTap,
  });

  @override
  State<_AnimatedCTAButton> createState() => _AnimatedCTAButtonState();
}

class _AnimatedCTAButtonState extends State<_AnimatedCTAButton>
    with SingleTickerProviderStateMixin {
  late final AnimationController _tapCtrl;
  late final Animation<double> _tapScale;

  @override
  void initState() {
    super.initState();
    _tapCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 100),
      reverseDuration: const Duration(milliseconds: 200),
      lowerBound: 0.95,
      upperBound: 1.0,
      value: 1.0,
    );
    _tapScale = _tapCtrl;
  }

  @override
  void dispose() {
    _tapCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTapDown: (_) => _tapCtrl.reverse(),
      onTapUp: (_) async {
        await _tapCtrl.forward();
        widget.onTap();
      },
      onTapCancel: () => _tapCtrl.forward(),
      child: ScaleTransition(
        scale: _tapScale,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 400),
          curve: Curves.easeInOutCubic,
          width: double.infinity,
          height: 56,
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.centerLeft,
              end: Alignment.centerRight,
              colors: widget.gradient,
            ),
            borderRadius: BorderRadius.circular(14),
            boxShadow: [
              BoxShadow(
                color: widget.gradient.first.withValues(alpha: 0.40),
                blurRadius: 18,
                offset: const Offset(0, 6),
              ),
            ],
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
                    letterSpacing: 0.8,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(width: 8),
                const Icon(
                  Icons.arrow_forward_rounded,
                  color: Colors.white,
                  size: 18,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

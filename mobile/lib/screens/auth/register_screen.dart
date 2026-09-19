import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../core/theme.dart';
import '../../services/supabase_service.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  final _phoneController = TextEditingController();
  final _passwordController = TextEditingController();

  bool _isLoading = false;
  bool _obscurePassword = true;

  // Password strength tracking
  int _passwordStrength = 0; // 0–4
  String _passwordStrengthLabel = '';

  @override
  void initState() {
    super.initState();
    _passwordController.addListener(_evaluatePasswordStrength);
  }

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _phoneController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  // ── Password strength evaluator ──────────────────────────────────────────
  void _evaluatePasswordStrength() {
    final p = _passwordController.text;
    int score = 0;
    if (p.length >= 6) score++;
    if (p.length >= 10) score++;
    if (RegExp(r'[A-Z]').hasMatch(p) && RegExp(r'[a-z]').hasMatch(p)) score++;
    if (RegExp(r'[0-9]').hasMatch(p)) score++;
    if (RegExp(r'[!@#\$%^&*(),.?":{}|<>]').hasMatch(p)) score++;

    // Cap at 4 for display
    final capped = score.clamp(0, 4);
    final labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
    setState(() {
      _passwordStrength = capped;
      _passwordStrengthLabel = p.isEmpty ? '' : labels[capped];
    });
  }

  Color get _strengthColor {
    switch (_passwordStrength) {
      case 1: return Colors.red;
      case 2: return Colors.orange;
      case 3: return Colors.amber.shade700;
      case 4: return Colors.green;
      default: return Colors.transparent;
    }
  }

  // ── Validators ────────────────────────────────────────────────────────────
  String? _validateName(String? v) {
    if (v == null || v.trim().isEmpty) return 'Full name is required';
    if (v.trim().length < 2) return 'Name must be at least 2 characters';
    return null;
  }

  String? _validateEmail(String? v) {
    if (v == null || v.trim().isEmpty) return 'Email address is required';
    final emailRegex = RegExp(r'^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$');
    if (!emailRegex.hasMatch(v.trim())) return 'Enter a valid email address';
    return null;
  }

  String? _validatePhone(String? v) {
    if (v == null || v.trim().isEmpty) return 'Phone number is required';
    final digits = v.replaceAll(RegExp(r'\D'), '');
    if (digits.length < 10) return 'Phone number must be exactly 10 digits';
    if (digits.length > 10) return 'Phone number must be exactly 10 digits';
    return null;
  }

  String? _validatePassword(String? v) {
    if (v == null || v.isEmpty) return 'Password is required';
    if (v.length < 6) return 'Password must be at least 6 characters';
    if (!RegExp(r'[A-Z]').hasMatch(v)) return 'Add at least one uppercase letter (A–Z)';
    if (!RegExp(r'[a-z]').hasMatch(v)) return 'Add at least one lowercase letter (a–z)';
    if (!RegExp(r'[0-9]').hasMatch(v)) return 'Add at least one number (0–9)';
    if (!RegExp(r'[!@#\$%^&*(),.?":{}|<>]').hasMatch(v)) {
      return 'Add at least one special character (!@#\$…)';
    }
    return null;
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  void _handleRegister() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isLoading = true);
    try {
      await SupabaseService.signUp(
        email: _emailController.text.trim(),
        password: _passwordController.text,
        fullName: _nameController.text.trim(),
        phone: _phoneController.text.trim(),
      );
      // Navigate to Onboarding for new users
      if (mounted) context.go('/onboarding');
    } on AuthException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.message), backgroundColor: Colors.red),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('An unexpected error occurred.'),
            backgroundColor: Colors.red,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _handleGoogleRegister() async {
    setState(() => _isLoading = true);
    try {
      final response = await SupabaseService.signInWithGoogle();
      if (response != null && mounted) {
        context.go('/onboarding');
      }
    } on AuthException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.message), backgroundColor: Colors.red),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Google Sign In failed or was canceled.')),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  // ── Build ─────────────────────────────────────────────────────────────────
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, size: 20),
          onPressed: () {
            if (context.canPop()) {
              context.pop();
            } else {
              context.go('/login');
            }
          },
        ),
      ),
      body: SafeArea(
        child: Form(
          key: _formKey,
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 32.0, vertical: 16.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  'Create Account',
                  style: Theme.of(context).textTheme.displayMedium?.copyWith(
                    color: AppTheme.primary,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Join us for exclusive priority seating and premium dining rewards.',
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
                const SizedBox(height: 40),

                // ── Full Name ──────────────────────────────────────────────
                _buildLabel('Full Name'),
                const SizedBox(height: 8),
                _buildFormField(
                  controller: _nameController,
                  hintText: 'John Doe',
                  icon: Icons.person_outline,
                  validator: _validateName,
                  textInputAction: TextInputAction.next,
                ),
                const SizedBox(height: 20),

                // ── Email ──────────────────────────────────────────────────
                _buildLabel('Email Address'),
                const SizedBox(height: 8),
                _buildFormField(
                  controller: _emailController,
                  hintText: 'john@example.com',
                  icon: Icons.email_outlined,
                  keyboardType: TextInputType.emailAddress,
                  validator: _validateEmail,
                  textInputAction: TextInputAction.next,
                ),
                const SizedBox(height: 20),

                // ── Phone ──────────────────────────────────────────────────
                _buildLabel('Phone Number'),
                const SizedBox(height: 8),
                _buildFormField(
                  controller: _phoneController,
                  hintText: '0712345678  (10 digits)',
                  icon: Icons.phone_outlined,
                  keyboardType: TextInputType.phone,
                  inputFormatters: [
                    FilteringTextInputFormatter.digitsOnly,
                    LengthLimitingTextInputFormatter(10),
                  ],
                  validator: _validatePhone,
                  textInputAction: TextInputAction.next,
                  suffixIcon: ValueListenableBuilder(
                    valueListenable: _phoneController,
                    builder: (_, val, child) {
                      final len = val.text.replaceAll(RegExp(r'\D'), '').length;
                      return Padding(
                        padding: const EdgeInsets.only(right: 14),
                        child: Text(
                          '$len/10',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: len == 10
                                ? Colors.green
                                : AppTheme.secondary.withValues(alpha: 0.4),
                          ),
                        ),
                      );
                    },
                  ),
                ),
                const SizedBox(height: 20),

                // ── Password ───────────────────────────────────────────────
                _buildLabel('Password'),
                const SizedBox(height: 8),
                _buildFormField(
                  controller: _passwordController,
                  hintText: 'Min 6 chars, uppercase, number & symbol',
                  icon: Icons.lock_outline,
                  obscureText: _obscurePassword,
                  validator: _validatePassword,
                  textInputAction: TextInputAction.done,
                  onFieldSubmitted: (_) => _handleRegister(),
                  suffixIcon: IconButton(
                    icon: Icon(
                      _obscurePassword
                          ? Icons.visibility_outlined
                          : Icons.visibility_off_outlined,
                      color: AppTheme.secondary.withValues(alpha: 0.5),
                      size: 20,
                    ),
                    onPressed: () =>
                        setState(() => _obscurePassword = !_obscurePassword),
                  ),
                ),

                // ── Password strength bar ──────────────────────────────────
                if (_passwordController.text.isNotEmpty) ...[
                  const SizedBox(height: 10),
                  _buildPasswordStrengthBar(),
                ],

                // ── Password rules hint ────────────────────────────────────
                const SizedBox(height: 10),
                _buildPasswordRules(),

                const SizedBox(height: 32),

                // ── Register button ────────────────────────────────────────
                ElevatedButton(
                  onPressed: _isLoading ? null : _handleRegister,
                  child: _isLoading
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(
                            color: AppTheme.white,
                            strokeWidth: 2,
                          ),
                        )
                      : const Text('Create Account'),
                ),

                const SizedBox(height: 24),

                Row(
                  children: [
                    Expanded(
                        child: Divider(
                            color: AppTheme.secondary.withValues(alpha: 0.2))),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      child: Text(
                        'OR',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: AppTheme.secondary.withValues(alpha: 0.5),
                              fontWeight: FontWeight.bold,
                            ),
                      ),
                    ),
                    Expanded(
                        child: Divider(
                            color: AppTheme.secondary.withValues(alpha: 0.2))),
                  ],
                ),

                const SizedBox(height: 24),

                // ── Google Sign-Up ─────────────────────────────────────────
                OutlinedButton.icon(
                  onPressed: _isLoading ? null : _handleGoogleRegister,
                  icon: Image.asset('assets/images/google_logo.png', height: 24),
                  label: const Text('Continue with Google'),
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    side: BorderSide(
                        color: AppTheme.secondary.withValues(alpha: 0.2)),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8)),
                    foregroundColor: AppTheme.secondary,
                  ),
                ),

                const SizedBox(height: 32),
              ],
            ),
          ),
        ),
      ),
    );
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  Widget _buildLabel(String text) =>
      Text(text, style: Theme.of(context).textTheme.labelLarge);

  Widget _buildFormField({
    required TextEditingController controller,
    required String hintText,
    required IconData icon,
    String? Function(String?)? validator,
    bool obscureText = false,
    TextInputType? keyboardType,
    TextInputAction? textInputAction,
    List<TextInputFormatter>? inputFormatters,
    Widget? suffixIcon,
    void Function(String)? onFieldSubmitted,
  }) {
    return TextFormField(
      controller: controller,
      obscureText: obscureText,
      keyboardType: keyboardType,
      textInputAction: textInputAction,
      inputFormatters: inputFormatters,
      validator: validator,
      autovalidateMode: AutovalidateMode.onUserInteraction,
      onFieldSubmitted: onFieldSubmitted,
      decoration: InputDecoration(
        hintText: hintText,
        hintStyle: TextStyle(
          color: AppTheme.secondary.withValues(alpha: 0.4),
          fontWeight: FontWeight.normal,
          fontSize: 14,
        ),
        prefixIcon:
            Icon(icon, color: AppTheme.secondary.withValues(alpha: 0.4)),
        suffixIcon: suffixIcon,
        filled: true,
        fillColor: AppTheme.white,
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        // Normal
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide:
              BorderSide(color: AppTheme.secondary.withValues(alpha: 0.1)),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide:
              BorderSide(color: AppTheme.secondary.withValues(alpha: 0.1)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: AppTheme.primary, width: 2),
        ),
        // Error styling
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: Colors.red, width: 1.5),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: Colors.red, width: 2),
        ),
        errorStyle: const TextStyle(
          fontSize: 12,
          color: Colors.red,
          fontWeight: FontWeight.w500,
        ),
      ),
    );
  }

  Widget _buildPasswordStrengthBar() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: List.generate(4, (i) {
            final filled = i < _passwordStrength;
            return Expanded(
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 300),
                margin: EdgeInsets.only(right: i < 3 ? 6 : 0),
                height: 5,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(4),
                  color: filled
                      ? _strengthColor
                      : AppTheme.secondary.withValues(alpha: 0.1),
                ),
              ),
            );
          }),
        ),
        const SizedBox(height: 6),
        AnimatedSwitcher(
          duration: const Duration(milliseconds: 200),
          child: Text(
            _passwordStrengthLabel,
            key: ValueKey(_passwordStrengthLabel),
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: _strengthColor,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildPasswordRules() {
    final p = _passwordController.text;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppTheme.secondary.withValues(alpha: 0.04),
        borderRadius: BorderRadius.circular(10),
        border:
            Border.all(color: AppTheme.secondary.withValues(alpha: 0.08)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Password must contain:',
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: AppTheme.secondary.withValues(alpha: 0.6),
              letterSpacing: 0.5,
            ),
          ),
          const SizedBox(height: 8),
          _buildRule('At least 6 characters', p.length >= 6),
          _buildRule('Uppercase letter (A–Z)', RegExp(r'[A-Z]').hasMatch(p)),
          _buildRule('Lowercase letter (a–z)', RegExp(r'[a-z]').hasMatch(p)),
          _buildRule('Number (0–9)', RegExp(r'[0-9]').hasMatch(p)),
          _buildRule(
            'Special character (!@#\$…)',
            RegExp(r'[!@#\$%^&*(),.?":{}|<>]').hasMatch(p),
          ),
        ],
      ),
    );
  }

  Widget _buildRule(String label, bool met) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Row(
        children: [
          AnimatedContainer(
            duration: const Duration(milliseconds: 300),
            width: 16,
            height: 16,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: met
                  ? Colors.green.withValues(alpha: 0.15)
                  : AppTheme.secondary.withValues(alpha: 0.06),
            ),
            child: Icon(
              met ? Icons.check : Icons.remove,
              size: 10,
              color: met
                  ? Colors.green
                  : AppTheme.secondary.withValues(alpha: 0.35),
            ),
          ),
          const SizedBox(width: 8),
          Text(
            label,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w500,
              color: met
                  ? Colors.green.shade700
                  : AppTheme.secondary.withValues(alpha: 0.55),
            ),
          ),
        ],
      ),
    );
  }
}

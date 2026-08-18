import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  final _phoneController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _isLoading = false;

  void _handleRegister() async {
    setState(() => _isLoading = true);
    // Simulate API delay
    await Future.delayed(const Duration(seconds: 1));
    setState(() => _isLoading = false);
    
    // Bypass auth for now and go to home
    if (mounted) context.go('/home');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, size: 20),
          onPressed: () => context.pop(),
        ),
      ),
      body: SafeArea(
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
              
              // Full Name Field
              Text('Full Name', style: Theme.of(context).textTheme.labelLarge),
              const SizedBox(height: 8),
              _buildTextField(
                controller: _nameController,
                hintText: 'John Doe',
                icon: Icons.person_outline,
              ),
              const SizedBox(height: 20),
              
              // Email Field
              Text('Email Address', style: Theme.of(context).textTheme.labelLarge),
              const SizedBox(height: 8),
              _buildTextField(
                controller: _emailController,
                hintText: 'john@example.com',
                icon: Icons.email_outlined,
                keyboardType: TextInputType.emailAddress,
              ),
              const SizedBox(height: 20),

              // Phone Field
              Text('Phone Number', style: Theme.of(context).textTheme.labelLarge),
              const SizedBox(height: 8),
              _buildTextField(
                controller: _phoneController,
                hintText: '+1 234 567 8900',
                icon: Icons.phone_outlined,
                keyboardType: TextInputType.phone,
              ),
              const SizedBox(height: 20),
              
              // Password Field
              Text('Password', style: Theme.of(context).textTheme.labelLarge),
              const SizedBox(height: 8),
              _buildTextField(
                controller: _passwordController,
                hintText: 'Create a strong password',
                icon: Icons.lock_outline,
                obscureText: true,
              ),
              const SizedBox(height: 40),
              
              // Register Button
              ElevatedButton(
                onPressed: _isLoading ? null : _handleRegister,
                child: _isLoading 
                    ? const SizedBox(
                        height: 20, 
                        width: 20, 
                        child: CircularProgressIndicator(color: AppTheme.white, strokeWidth: 2)
                      )
                    : const Text('Create Account'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildTextField({
    required TextEditingController controller,
    required String hintText,
    required IconData icon,
    bool obscureText = false,
    TextInputType? keyboardType,
  }) {
    return TextField(
      controller: controller,
      obscureText: obscureText,
      keyboardType: keyboardType,
      decoration: InputDecoration(
        hintText: hintText,
        prefixIcon: Icon(icon, color: AppTheme.secondary.withOpacity(0.5)),
        filled: true,
        fillColor: AppTheme.white,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: BorderSide(color: AppTheme.secondary.withOpacity(0.1)),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: BorderSide(color: AppTheme.secondary.withOpacity(0.1)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: AppTheme.primary, width: 2),
        ),
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme.dart';

class MenuScreen extends StatelessWidget {
  const MenuScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, size: 20),
          onPressed: () => context.pop(),
        ),
        title: Text(
          'Curated Selection',
          style: Theme.of(context).textTheme.displayMedium?.copyWith(
            fontSize: 22,
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.shopping_bag_outlined),
            onPressed: () => context.push('/cart'),
          ),
        ],
      ),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 8.0),
            child: Text(
              'Explore our seasonal offerings, crafted with intention and presented with care.',
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          ),
          
          // Categories Filter (Mock)
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 16.0),
            child: Row(
              children: [
                _buildCategoryChip('Starters', true),
                const SizedBox(width: 12),
                _buildCategoryChip('Mains', false),
                const SizedBox(width: 12),
                _buildCategoryChip('Desserts', false),
                const SizedBox(width: 12),
                _buildCategoryChip('Drinks', false),
              ],
            ),
          ),
          
          // Menu Items List
          Expanded(
            child: ListView(
              padding: const EdgeInsets.symmetric(horizontal: 24.0),
              children: [
                _buildMenuItem(
                  context,
                  title: 'Seared Hokkaido Scallops',
                  description: 'Pan-seared premium scallops, served atop a silky cauliflower purée with crispy pancetta dust.',
                  price: '\$28',
                  imageUrl: 'https://images.unsplash.com/photo-1599084993091-1cb5c0721cc6?q=80&w=500&auto=format&fit=crop',
                ),
                const SizedBox(height: 24),
                _buildMenuItem(
                  context,
                  title: 'Artisanal Burrata',
                  description: 'Fresh Italian burrata with virgin heirloom tomatoes, basil oil, and aged balsamic.',
                  price: '\$22',
                  imageUrl: 'https://images.unsplash.com/photo-1608897013039-887f21d8c804?q=80&w=500&auto=format&fit=crop',
                ),
                const SizedBox(height: 24),
                _buildMenuItem(
                  context,
                  title: 'Wagyu Beef Carpaccio',
                  description: 'Thinly sliced grade A5 wagyu, truffle aioli, shaved parmesan, and micro arugula.',
                  price: '\$34',
                  imageUrl: 'https://images.unsplash.com/photo-1550547660-d9450f859349?q=80&w=500&auto=format&fit=crop',
                ),
                const SizedBox(height: 40),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCategoryChip(String label, bool isSelected) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
      decoration: BoxDecoration(
        color: isSelected ? AppTheme.primary : AppTheme.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: isSelected ? AppTheme.primary : AppTheme.secondary.withOpacity(0.2),
        ),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: isSelected ? AppTheme.white : AppTheme.secondary,
          fontWeight: FontWeight.w600,
          fontSize: 14,
        ),
      ),
    );
  }

  Widget _buildMenuItem(BuildContext context, {
    required String title,
    required String description,
    required String price,
    required String imageUrl,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(12),
          child: Image.network(
            imageUrl,
            height: 200,
            width: double.infinity,
            fit: BoxFit.cover,
          ),
        ),
        const SizedBox(height: 16),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Text(
                title,
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  fontFamily: 'Playfair Display',
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
            Text(
              price,
              style: const TextStyle(
                color: AppTheme.primary,
                fontWeight: FontWeight.bold,
                fontSize: 18,
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        Text(
          description,
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
            height: 1.5,
          ),
        ),
        const SizedBox(height: 16),
        OutlinedButton(
          onPressed: () {},
          style: OutlinedButton.styleFrom(
            minimumSize: const Size(double.infinity, 44),
            side: BorderSide(color: AppTheme.secondary.withOpacity(0.2)),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          ),
          child: const Text('+ Add'),
        ),
      ],
    );
  }
}

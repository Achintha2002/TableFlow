import 'package:flutter/material.dart';

import 'core/theme.dart';
import 'core/routes.dart';
import 'services/supabase_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // Initialize Supabase real-time connection
  await SupabaseService.initialize();
  
  runApp(const TableFlowApp());
}

class TableFlowApp extends StatelessWidget {
  const TableFlowApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: 'TableFlow',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme,
      routerConfig: AppRoutes.router,
    );
  }
}

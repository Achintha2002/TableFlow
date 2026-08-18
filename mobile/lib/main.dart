import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'core/theme.dart';
import 'core/routes.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const TableFlowApp());
}

class TableFlowApp extends StatelessWidget {
  const TableFlowApp({super.key});

  @override
  Widget build(BuildContext context) {
    // We will wrap this with MultiProvider later when we add the state classes
    return MaterialApp.router(
      title: 'TableFlow',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme,
      routerConfig: AppRoutes.router,
    );
  }
}

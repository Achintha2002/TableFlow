import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'providers/cart_provider.dart';
import 'core/theme.dart';
import 'core/routes.dart';
import 'services/supabase_service.dart';
import 'services/fcm_service.dart';
import 'widgets/notification_wrapper.dart';

import 'providers/settings_provider.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // Initialize Supabase real-time connection
  await SupabaseService.initialize();
  
  // Initialize FCM service with platform guards
  await FCMService.initialize();
  
  runApp(const TableFlowApp());
}

class TableFlowApp extends StatelessWidget {
  const TableFlowApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => CartProvider()),
        ChangeNotifierProvider(create: (_) => SettingsProvider()),
      ],
      child: Consumer<SettingsProvider>(
        builder: (context, settings, _) {
          return MaterialApp.router(
            title: 'TableFlow',
            debugShowCheckedModeBanner: false,
            theme: settings.isHighContrast ? AppTheme.highContrastTheme : AppTheme.lightTheme,
            builder: (context, child) {
              final scale = settings.isLargeFont ? 1.3 : 1.0;
              return MediaQuery(
                data: MediaQuery.of(context).copyWith(
                  textScaler: TextScaler.linear(scale),
                ),
                child: ColoredBox(
                  color: AppTheme.secondary.withValues(alpha: 0.1),
                  child: Center(
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 500),
                      child: ClipRect(
                        child: NotificationWrapper(child: child!),
                      ),
                    ),
                  ),
                ),
              );
            },
            routerConfig: AppRoutes.router,
          );
        },
      ),
    );
  }
}

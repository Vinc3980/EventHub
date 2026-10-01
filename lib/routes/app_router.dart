import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../screens/admin/admin_dashboard.dart';
import '../screens/attendee/attendee_home.dart';
import '../screens/organizer/organizer_dashboard.dart';
import '../screens/shared/landing.dart';
import '../screens/shared/role_selection.dart';
import '../services/auth_service.dart';

/// Central navigation / routing decisions.
class AppRouter {
  AppRouter._();

  /// Root widget: watches the local auth session via the Provider instance.
  ///
  /// Not signed in -> [LandingScreen]. Signed in -> resolve the profile; if
  /// missing go to [RoleSelectionScreen], otherwise route by role priority
  /// (admin > organizer > attendee).
  static Widget authGate() {
    return const _AuthGate();
  }

  /// Picks the home screen by role priority: admin > organizer > attendee.
  static Widget dashboardForProfile(Map<String, dynamic> profile) {
    final roles = List<String>.from(profile['roles'] as List? ?? const []);
    if (roles.contains('admin')) return const AdminDashboardScreen();
    if (roles.contains('organizer')) return const OrganizerDashboardScreen();
    return const AttendeeHomeScreen();
  }

  /// Used after login / role selection: fetch the profile and navigate with
  /// [Navigator.pushAndRemoveUntil] so the back stack cannot return to auth.
  static Future<void> routeAfterAuth(BuildContext context, String uid) async {
    final navigator = Navigator.of(context);
    final authService = context.read<AuthService>();
    final profile = await authService.fetchUserProfile(uid);
    if (profile == null) {
      navigator.pushAndRemoveUntil(
        MaterialPageRoute(builder: (_) => RoleSelectionScreen(uid: uid)),
        (route) => false,
      );
      return;
    }
    navigator.pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => dashboardForProfile(profile)),
      (route) => false,
    );
  }

  /// Navigates back to the auth gate (used after sign out).
  static void signOutAndNavigate(BuildContext context) {
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const _AuthGate()),
      (route) => false,
    );
  }
}

class _AuthGate extends StatelessWidget {
  const _AuthGate();

  @override
  Widget build(BuildContext context) {
    final authService = context.read<AuthService>();
    return StreamBuilder<String?>(
      stream: authService.authStateChanges,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const _LoadingScreen();
        }
        final uid = snapshot.data;
        if (uid == null) {
          return const LandingScreen();
        }
        return FutureBuilder<Map<String, dynamic>?>(
          future: authService.fetchUserProfile(uid),
          builder: (context, profileSnapshot) {
            if (profileSnapshot.connectionState != ConnectionState.done) {
              return const _LoadingScreen();
            }
            final profile = profileSnapshot.data;
            if (profile == null) {
              return RoleSelectionScreen(uid: uid);
            }
            return AppRouter.dashboardForProfile(profile);
          },
        );
      },
    );
  }
}

class _LoadingScreen extends StatelessWidget {
  const _LoadingScreen();

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(child: CircularProgressIndicator()),
    );
  }
}

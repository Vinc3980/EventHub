import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'routes/app_router.dart';
import 'services/auth_service.dart';
import 'services/chat_service.dart';
import 'services/discount_service.dart';
import 'services/event_schedule_service.dart';
import 'services/event_service.dart';
import 'services/guest_list_service.dart';
import 'services/invitation_service.dart';
import 'services/notification_service.dart';
import 'services/post_service.dart';
import 'services/promotion_service.dart';
import 'services/follow_service.dart';
import 'services/refund_service.dart';
import 'services/registration_service.dart';
import 'services/reminder_service.dart';
import 'services/report_service.dart';
import 'services/review_service.dart';
import 'services/waitlist_service.dart';
import 'theme/app_theme.dart';
import 'widgets/connectivity_banner.dart';

/// Root widget. Services are provided above the MaterialApp so every route
/// can reach them via `context.read<...>()`.
///
/// Local-first mode: all services read/write Hive boxes (LocalStore). When
/// Firebase is introduced, only the service implementations change.
class EventHubApp extends StatelessWidget {
  const EventHubApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        Provider<AuthService>(create: (_) => AuthService()),
        Provider<EventService>(create: (_) => EventService()),
        Provider<GuestListService>(create: (_) => GuestListService()),
        Provider<RegistrationService>(create: (_) => RegistrationService()),
        Provider<ChatService>(create: (_) => ChatService()),
        Provider<InvitationService>(create: (_) => InvitationService()),
        Provider<PostService>(create: (_) => PostService()),
        Provider<ReviewService>(create: (_) => ReviewService()),
        Provider<ReportService>(create: (_) => ReportService()),
        Provider<NotificationService>(create: (_) => NotificationService()),
        Provider<PromotionService>(create: (_) => PromotionService()),
        Provider<DiscountService>(create: (_) => DiscountService()),
        Provider<WaitlistService>(create: (_) => WaitlistService()),
        Provider<RefundService>(create: (_) => RefundService()),
        Provider<ReminderService>(create: (_) => ReminderService()),
        Provider<FollowService>(create: (_) => FollowService()),
        Provider<EventScheduleService>(create: (_) => EventScheduleService()),
      ],
      child: MaterialApp(
        title: 'EventHub',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.light(),
        home: ConnectivityBanner(child: AppRouter.authGate()),
      ),
    );
  }
}

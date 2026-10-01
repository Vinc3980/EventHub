import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../models/booking_model.dart';
import '../../services/auth_service.dart';
import '../../services/event_service.dart';
import '../../services/refund_service.dart';
import '../../services/registration_service.dart';
import '../../services/review_service.dart';
import '../../theme/app_colors.dart';
import '../../widgets/status_tag.dart';
import 'booking_confirmation_screen.dart';
import 'rate_organizer_screen.dart';

class MyBookingsScreen extends StatelessWidget {
  const MyBookingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final uid = context.read<AuthService>().currentUid ?? '';

    return Scaffold(
      appBar: AppBar(title: const Text('My Bookings')),
      body: StreamBuilder<List<Booking>>(
        stream: context.read<RegistrationService>().bookingsForUser(uid),
        builder: (context, snapshot) {
          if (snapshot.hasError) {
            return const Center(child: Text('Could not load bookings.'));
          }
          if (!snapshot.hasData) {
            return const Center(
              child: SizedBox(
                width: 24,
                height: 24,
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
            );
          }
          final bookings = snapshot.data!;
          if (bookings.isEmpty) {
            return Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 72,
                    height: 72,
                    decoration: BoxDecoration(
                      color: AppColors.skeleton,
                      borderRadius: BorderRadius.circular(24),
                    ),
                    child: const Icon(Icons.confirmation_number_outlined,
                        size: 32, color: AppColors.textMuted),
                  ),
                  const SizedBox(height: 20),
                  const Text(
                    'No bookings yet',
                    style: TextStyle(
                      fontSize: 17,
                      fontWeight: FontWeight.w800,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Your bookings will appear here after\nyou register for an event.',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                        fontSize: 14, color: AppColors.textMuted, height: 1.4),
                  ),
                ],
              ),
            );
          }
          return ListView.separated(
            padding: const EdgeInsets.all(20),
            itemCount: bookings.length,
            separatorBuilder: (_, __) => const SizedBox(height: 10),
            itemBuilder: (context, index) =>
                _BookingRow(booking: bookings[index]),
          );
        },
      ),
    );
  }
}

class _BookingRow extends StatelessWidget {
  const _BookingRow({required this.booking});

  final Booking booking;

  @override
  Widget build(BuildContext context) {
    return FutureBuilder(
      future: context.read<EventService>().getEvent(booking.eventId),
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return Container(
            margin: const EdgeInsets.only(bottom: 10),
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.card,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppColors.border, width: 1),
            ),
            child: const Row(
              children: [
                SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
                SizedBox(width: 12),
                Text('Loading...',
                    style: TextStyle(color: AppColors.textMuted)),
              ],
            ),
          );
        }
        final event = snapshot.data;
        final title = event?.title ?? 'Event';
        final dateLabel = event != null
            ? DateFormat('EEE, d MMM yyyy').format(event.date)
            : '';
        final venue = event?.venue ?? '';
        final isCompleted = event?.status == 'completed';
        final uid = context.read<AuthService>().currentUid ?? '';
        final hasReviewed = context.read<ReviewService>().hasReviewed(
              eventId: booking.eventId,
              attendeeId: uid,
            );

        return Column(
          children: [
            GestureDetector(
              onTap: booking.status == 'confirmed'
                  ? () {
                      Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) => BookingConfirmationScreen(
                              bookingId: booking.id),
                        ),
                      );
                    }
                  : null,
              child: Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.card,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppColors.border, width: 1),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        color: AppColors.skeleton,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Icon(Icons.event_outlined,
                          color: AppColors.textMuted, size: 20),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            title,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontWeight: FontWeight.w700,
                              fontSize: 14,
                              color: AppColors.textPrimary,
                            ),
                          ),
                          const SizedBox(height: 3),
                          Text(
                            '$dateLabel · $venue',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontSize: 12,
                              color: AppColors.textMuted,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 10),
                    if (booking.status == 'confirmed' &&
                        booking.seatNumber.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(right: 8),
                        child: Text(
                          booking.seatNumber,
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: AppColors.accent,
                          ),
                        ),
                      ),
                    StatusTag(status: booking.status),
                  ],
                ),
              ),
            ),
            // Cancel / Request refund action for confirmed bookings
            if (booking.status == 'confirmed')
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: GestureDetector(
                  onTap: () => _showCancelDialog(context, event?.title ?? 'Event'),
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(
                        horizontal: 16, vertical: 10),
                    decoration: BoxDecoration(
                      color: AppColors.dangerBg,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                          color: AppColors.danger.withValues(alpha: 0.3)),
                    ),
                    child: const Row(
                      children: [
                        Icon(Icons.cancel_outlined,
                            size: 18, color: AppColors.danger),
                        SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            'Cancel / request refund',
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: AppColors.danger,
                            ),
                          ),
                        ),
                        Icon(Icons.chevron_right,
                            size: 18, color: AppColors.danger),
                      ],
                    ),
                  ),
                ),
              ),
            // Rating banner for completed events with checked-in booking
            if (isCompleted &&
                booking.checkedIn &&
                !hasReviewed &&
                event != null)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: GestureDetector(
                  onTap: () {
                    Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => RateOrganizerScreen(
                          eventId: booking.eventId,
                          organizerId: event.ownerId,
                          eventTitle: event.title,
                        ),
                      ),
                    );
                  },
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 16, vertical: 10),
                    decoration: BoxDecoration(
                      color: AppColors.warningBg,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                          color: AppColors.warning.withValues(alpha: 0.3)),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.star_outline,
                            size: 18, color: AppColors.warning),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            'How was $title? Rate the organizer',
                            style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: AppColors.warning,
                            ),
                          ),
                        ),
                        const Icon(Icons.chevron_right,
                            size: 18, color: AppColors.warning),
                      ],
                    ),
                  ),
                ),
              ),
          ],
        );
      },
    );
  }

  Future<void> _showCancelDialog(BuildContext context, String eventTitle) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Cancel booking?'),
        content: Text(
          'Are you sure you want to cancel your booking for $eventTitle? '
          'This cannot be undone.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Keep booking'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.danger),
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Cancel booking'),
          ),
        ],
      ),
    );

    if (confirmed != true || !context.mounted) return;

    final regService = context.read<RegistrationService>();
    final refundService = context.read<RefundService>();

    try {
      // Cancel the booking.
      await regService.cancelBooking(booking.id, byOrganizer: false);

      // For paid bookings, create a refund request.
      final payment = refundService.paymentForBooking(booking.id);
      if (payment != null && payment.amount > 0) {
        await refundService.requestRefund(booking, payment);
      }

      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            payment != null && payment.amount > 0
                ? 'Booking cancelled. Refund request submitted.'
                : 'Booking cancelled.',
          ),
        ),
      );
    } catch (error) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Could not cancel: $error')),
      );
    }
  }
}

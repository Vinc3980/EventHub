import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:iconsax_plus/iconsax_plus.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:share_plus/share_plus.dart';

import '../../models/booking_model.dart';
import '../../models/event_model.dart';
import '../../models/invited_guest_model.dart';
import '../../services/auth_service.dart';
import '../../services/event_service.dart';
import '../../services/local_db.dart';
import '../../services/registration_service.dart';
import '../../theme/app_colors.dart';
import '../../theme/app_spacing.dart';
import 'my_bookings_screen.dart';
import 'registration_form_screen.dart';

class BookingConfirmationScreen extends StatefulWidget {
  const BookingConfirmationScreen({super.key, required this.bookingId});

  final String bookingId;

  @override
  State<BookingConfirmationScreen> createState() =>
      _BookingConfirmationScreenState();
}

class _BookingConfirmationScreenState extends State<BookingConfirmationScreen> {
  Booking? _booking;
  Event? _event;
  bool _loading = true;
  bool _calendarLoading = false;
  final _guestNameController = TextEditingController();
  List<InvitedGuest> _guests = const [];
  int _maxGuests = 0;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _guestNameController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final regService = context.read<RegistrationService>();
    final uid = context.read<AuthService>().currentUid ?? '';

    final bookings = await regService
        .bookingsForUser(uid)
        .first;

    final booking = bookings.where((b) => b.id == widget.bookingId).firstOrNull;
    if (booking == null) {
      if (mounted) setState(() => _loading = false);
      return;
    }

    final event =
        await context.read<EventService>().getEvent(booking.eventId);

    // Get registration to find invitedGuestCount
    final regStream = LocalStore.watchBox(
      LocalStore.instance.registrations,
      where: (r) => r['eventId'] == booking.eventId && r['userId'] == uid,
    );
    final regs = await regStream.first;
    final regData = regs.isNotEmpty ? regs.first.$2 : null;
    final maxGuests = (regData?['invitedGuestCount'] as num?)?.toInt() ?? 0;

    if (!mounted) return;
    setState(() {
      _booking = booking;
      _event = event;
      _maxGuests = maxGuests;
      _loading = false;
    });

    regService.invitedGuestsForBooking(booking.id).listen((guests) {
      if (mounted) setState(() => _guests = guests);
    });
  }

  Future<void> _addGuest() async {
    final name = _guestNameController.text.trim();
    if (name.isEmpty) return;
    if (_guests.length >= _maxGuests) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Maximum $_maxGuests guests allowed.')),
      );
      return;
    }

    try {
      final regService = context.read<RegistrationService>();
      await regService.addInvitedGuest(
        InvitedGuest(
          id: '',
          bookingId: _booking!.id,
          name: name,
        ),
      );
      _guestNameController.clear();
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Could not add guest: $error')),
      );
    }
  }

  Future<void> _addToCalendar(Event event, String dateLabel) async {
    if (_calendarLoading) return;
    setState(() => _calendarLoading = true);
    try {
      // Generate .ics content
      final icsContent = _generateIcsContent(event, dateLabel);
      final filename = '${event.title.replaceAll(' ', '_')}.ics';

      // Write to temporary file and share
      final tempDir = await Directory.systemTemp.createTemp();
      final file = File('${tempDir.path}/$filename');
      await file.writeAsString(icsContent);

      await Share.shareXFiles([XFile(file.path)], text: 'Add to calendar');
    } finally {
      if (mounted) setState(() => _calendarLoading = false);
    }
  }

  String _generateIcsContent(Event event, String dateLabel) {
    final dateFormat = DateFormat('yyyyMMdd');
    final timeFormat = DateFormat('HHmmss');
    final now = DateTime.now();

    return '''BEGIN:VCALENDAR
 VERSION:2.0
 PRODID:-//EventHub//Event Calendar//EN
 BEGIN:VEVENT
 DTSTART:${dateFormat.format(event.date)}T${timeFormat.format(event.date)}
 SUMMARY:${event.title}
 DESCRIPTION:Join me at ${event.title} on EventHub!
 LOCATION:${event.venue}
 UID:${event.id}@eventhub
 DTSTAMP:${dateFormat.format(now)}T${timeFormat.format(now)}
 END:VEVENT
 END:VCALENDAR''';
  }

  Future<void> _shareBooking(Booking booking, Event event, String dateLabel) async {
    final shareText = '''I'm going to ${event.title}!

📅 $dateLabel
📍 ${event.venue}
🎫 Seat: ${booking.seatNumber}

Join me on EventHub!''';

    await Share.share(shareText);
  }

  /// Calm, one-shot entry motion: fade + 3% slideY, 60ms stagger, skipped
  /// entirely when the OS asks for reduced motion (same as the register
  /// screen).
  Widget _stagger(Widget child, int index) {
    if (!mounted) return child;
    if (MediaQuery.of(context).disableAnimations) return child;
    return child
        .animate(delay: Duration(milliseconds: 60 * index))
        .fadeIn(duration: 250.ms)
        .slideY(begin: 0.03, end: 0);
  }

  /// Solid cobalt app bar with white title — matches the register screen.
  /// No back arrow: this is a success screen the flow lands on via
  /// pushReplacement (register/payment), and forward navigation is offered
  /// through the "My Bookings" action.
  PreferredSizeWidget _styledAppBar(String title) {
    return AppBar(
      title: Text(
        title,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: const TextStyle(
            fontWeight: FontWeight.w700, color: Colors.white),
      ),
      backgroundColor: AppColors.primary,
      foregroundColor: Colors.white,
      elevation: 0,
      scrolledUnderElevation: 0,
      surfaceTintColor: Colors.transparent,
      centerTitle: false,
      systemOverlayStyle: SystemUiOverlayStyle.light,
      actions: [
        TextButton(
          onPressed: () {
            Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const MyBookingsScreen()),
            );
          },
          style: TextButton.styleFrom(foregroundColor: Colors.white),
          child: const Text(
            'My Bookings',
            style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600),
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return Scaffold(
        backgroundColor: AppColors.backgroundTinted,
        body: const Center(
          child: SizedBox(
            width: 24,
            height: 24,
            child: CircularProgressIndicator(strokeWidth: 2),
          ),
        ),
      );
    }

    final booking = _booking;
    final event = _event;
    if (booking == null || event == null) {
      return Scaffold(
        backgroundColor: AppColors.backgroundTinted,
        appBar: _styledAppBar('Booking'),
        body: const Center(
          child: Text(
            'Booking not found.',
            style: TextStyle(fontSize: 14, color: AppColors.textMuted),
          ),
        ),
      );
    }

    final dateLabel = DateFormat('EEE, d MMMM yyyy').format(event.date);

    return Scaffold(
      backgroundColor: AppColors.backgroundTinted,
      appBar: _styledAppBar('Booking confirmed'),
      body: Stack(
        children: [
          // Rich cobalt band with the blurred event cover — the card stack
          // below overlaps its lower edge (same as the register screen).
          Positioned(
            left: 0,
            right: 0,
            top: 0,
            height: EventHeaderBand.defaultHeight,
            child: EventHeaderBand(event: event),
          ),
          ListView(
            // Cards start ~76px down so the photo band shows clearly above
            // them while still overlapping the band's lower edge.
            padding: const EdgeInsets.fromLTRB(AppSpacing.xl, 76,
                AppSpacing.xl, AppSpacing.xl),
            children: [
              // ── QR card + seat pill ──
              _stagger(
                Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Center(
                      child: Container(
                        padding: const EdgeInsets.all(20),
                        decoration: BoxDecoration(
                          color: AppColors.surface,
                          borderRadius: BorderRadius.circular(20),
                          boxShadow: [
                            BoxShadow(
                              color: AppColors.primary
                                  .withValues(alpha: 0.07),
                              blurRadius: 16,
                              offset: const Offset(0, 4),
                            ),
                          ],
                        ),
                        child: QrImageView(
                          data: booking.qrCode,
                          version: QrVersions.auto,
                          size: 180,
                          backgroundColor: AppColors.surface,
                          eyeStyle: const QrEyeStyle(
                              eyeShape: QrEyeShape.square,
                              color: AppColors.textPrimary),
                          dataModuleStyle: const QrDataModuleStyle(
                              dataModuleShape: QrDataModuleShape.square,
                              color: AppColors.textPrimary),
                        ),
                      ),
                    ),
                    const SizedBox(height: 20),
                    Center(
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 20, vertical: 10),
                        decoration: BoxDecoration(
                          color: AppColors.successBg,
                          borderRadius: BorderRadius.circular(100),
                        ),
                        child: Text(
                          booking.seatNumber,
                          style: const TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w800,
                            color: AppColors.success,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
                0,
              ),
              const SizedBox(height: 20),

              // ── Summary / meta ──
              _stagger(
                Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      event.title,
                      textAlign: TextAlign.center,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w800,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(IconsaxPlusLinear.calendar,
                            size: 14, color: AppColors.textMuted),
                        const SizedBox(width: 6),
                        Flexible(
                          child: Text(dateLabel,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                  fontSize: 13,
                                  color: AppColors.textMuted)),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(IconsaxPlusLinear.location,
                            size: 14, color: AppColors.textMuted),
                        const SizedBox(width: 6),
                        Flexible(
                          child: Text(event.venue,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                  fontSize: 13,
                                  color: AppColors.textMuted)),
                        ),
                      ],
                    ),
                  ],
                ),
                1,
              ),
              const SizedBox(height: 24),

              // ── Action buttons ──
              _stagger(
                Row(
                  children: [
                    Expanded(
                      child: _ActionButton(
                        icon: IconsaxPlusLinear.calendar_add,
                        label: 'Add to Calendar',
                        loading: _calendarLoading,
                        onTap: () => _addToCalendar(event, dateLabel),
                      ),
                    ),
                    const SizedBox(width: AppSpacing.md),
                    Expanded(
                      child: _ActionButton(
                        icon: IconsaxPlusLinear.share,
                        label: 'Share',
                        enabled: !_calendarLoading,
                        onTap: () =>
                            _shareBooking(booking, event, dateLabel),
                      ),
                    ),
                  ],
                ),
                2,
              ),

              // ── Guests (only when the registration invited guests) ──
              if (_maxGuests > 0) ...[
                const SizedBox(height: AppSpacing.xxl),
                _stagger(_buildGuestCard(event, dateLabel), 3),
              ],
            ],
          ),
        ],
      ),
    );
  }

  /// Guest section as a grouped white card (register-screen language):
  /// header row, borderless add-field, hairline-separated guest rows.
  Widget _buildGuestCard(Event event, String dateLabel) {
    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: AppColors.primary.withValues(alpha: 0.07),
            blurRadius: 16,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(AppSpacing.lg, AppSpacing.lg,
                AppSpacing.lg, AppSpacing.md),
            child: Row(
              children: [
                Container(
                  width: 28,
                  height: 28,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: AppColors.primary.withValues(alpha: 0.11),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(IconsaxPlusLinear.profile_2user,
                      size: 16, color: AppColors.primary),
                ),
                const SizedBox(width: 10),
                const Expanded(
                  child: Text(
                    "Add guests you're bringing",
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textMuted,
                    ),
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                Text(
                  '${_guests.length}/$_maxGuests',
                  style: const TextStyle(
                      fontSize: 13, color: AppColors.textMuted),
                ),
              ],
            ),
          ),
          if (_guests.length < _maxGuests)
            Padding(
              padding: const EdgeInsets.fromLTRB(
                  AppSpacing.lg, 0, AppSpacing.lg, AppSpacing.md),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _guestNameController,
                      textCapitalization: TextCapitalization.words,
                      style: const TextStyle(
                          fontSize: 14, color: AppColors.textPrimary),
                      onSubmitted: (_) => _addGuest(),
                      decoration: InputDecoration(
                        hintText: 'Guest name',
                        isDense: true,
                        filled: false,
                        contentPadding: const EdgeInsets.symmetric(
                            horizontal: 4, vertical: 14),
                        border: InputBorder.none,
                        enabledBorder: InputBorder.none,
                        focusedBorder: InputBorder.none,
                        errorBorder: InputBorder.none,
                        focusedErrorBorder: InputBorder.none,
                        prefixIcon: const Icon(IconsaxPlusLinear.user,
                            size: 20, color: AppColors.textMuted),
                        prefixIconConstraints: const BoxConstraints(
                            minWidth: 36, minHeight: 20),
                      ),
                    ),
                  ),
                  const SizedBox(width: AppSpacing.md),
                  GestureDetector(
                    behavior: HitTestBehavior.opaque,
                    onTap: _addGuest,
                    child: Container(
                      width: 44,
                      height: 44,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: AppColors.primary,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Icon(IconsaxPlusLinear.add,
                          color: Colors.white, size: 20),
                    ),
                  ),
                ],
              ),
            ),
          for (final guest in _guests) ...[
            const Divider(indent: 52),
            Padding(
              padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.lg, vertical: AppSpacing.md),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    guest.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontWeight: FontWeight.w600,
                      fontSize: 14,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${event.title} · $dateLabel · ${event.venue}',
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
          ],
        ],
      ),
    );
  }
}

/// Chip-language action button: primary-8% fill, radius 14, no border,
/// primary icon + w600 label. Disabled while the calendar file is being
/// written/shared; the loading button swaps its icon for a spinner.
class _ActionButton extends StatelessWidget {
  const _ActionButton({
    required this.icon,
    required this.label,
    required this.onTap,
    this.loading = false,
    this.enabled = true,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool loading;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    return Opacity(
      opacity: enabled ? 1 : 0.55,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: (enabled && !loading)
            ? () {
                HapticFeedback.lightImpact();
                onTap();
              }
            : null,
        child: Container(
          padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.md, vertical: 12),
          decoration: BoxDecoration(
            color: AppColors.primary.withValues(alpha: 0.08),
            borderRadius: BorderRadius.circular(14),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (loading)
                const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(
                      strokeWidth: 2, color: AppColors.primary),
                )
              else
                Icon(icon, size: 18, color: AppColors.primary),
              const SizedBox(width: 8),
              Flexible(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: AppColors.primary,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

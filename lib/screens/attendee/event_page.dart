import 'dart:io';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:iconsax_plus/iconsax_plus.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../models/booking_model.dart';
import '../../models/event_model.dart';
import '../../models/event_schedule_model.dart';
import '../../models/guest_list_entry_model.dart';
import '../../models/post_model.dart';
import '../../models/review_model.dart';
import '../../models/waitlist_entry_model.dart';
import '../../services/auth_service.dart';
import '../../services/event_schedule_service.dart';
import '../../services/event_service.dart';
import '../../services/follow_service.dart';
import '../../services/guest_list_service.dart';
import '../../services/post_service.dart';
import '../../services/registration_service.dart';
import '../../services/review_service.dart';
import '../../services/waitlist_service.dart';
import '../../theme/app_colors.dart';
import '../../theme/app_spacing.dart';
import '../../widgets/report_dialog.dart';
import 'registration_form_screen.dart';
import 'event_photos_screen.dart';
import '../organizer/organizer_profile_screen.dart';

class EventPageScreen extends StatefulWidget {
  const EventPageScreen({super.key, required this.eventId});

  final String eventId;

  @override
  State<EventPageScreen> createState() => _EventPageScreenState();
}

class _EventPageScreenState extends State<EventPageScreen> {
  late final Future<Event?> _eventFuture;

  @override
  void initState() {
    super.initState();
    _eventFuture = context.read<EventService>().getEvent(widget.eventId);
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<Event?>(
      future: _eventFuture,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const Scaffold(
              body: Center(
            child: SizedBox(
                width: 24,
                height: 24,
                child: CircularProgressIndicator(strokeWidth: 2)),
          ));
        }
        if (snapshot.hasError) {
          return Scaffold(
            appBar: AppBar(),
            body: const Center(
              child: Padding(
                padding: EdgeInsets.all(32),
                child: Text(
                  'Could not load event.',
                  style: TextStyle(color: AppColors.textMuted),
                ),
              ),
            ),
          );
        }
        final event = snapshot.data;
        if (event == null) {
          return Scaffold(
            appBar: AppBar(),
            body: const Center(child: Text('Event not found.')),
          );
        }
        return _EventView(event: event);
      },
    );
  }
}

class _EventView extends StatefulWidget {
  const _EventView({required this.event});
  final Event event;

  @override
  State<_EventView> createState() => _EventViewState();
}

class _EventViewState extends State<_EventView> {
  int _selectedTierIndex = 0;
  bool _saved = false;

  Event get event => widget.event;

  @override
  void initState() {
    super.initState();
    _loadSaved();
    if (event.ticketTypes.isNotEmpty) {
      for (int i = 0; i < event.ticketTypes.length; i++) {
        final remaining = context.read<EventService>().remainingCapacity(
              event.id,
              event.ticketTypes[i].name,
            );
        if (remaining > 0) {
          _selectedTierIndex = i;
          break;
        }
      }
    }
  }

  Future<void> _loadSaved() async {
    final uid = context.read<AuthService>().currentUid;
    if (uid == null) return;
    final profile = await context.read<AuthService>().fetchUserProfile(uid);
    final saved =
        List<String>.from(profile?['savedEventIds'] as List? ?? const []);
    if (mounted) setState(() => _saved = saved.contains(event.id));
  }

  Future<void> _toggleSaved() async {
    final uid = context.read<AuthService>().currentUid;
    if (uid == null) return;
    final updated = await context
        .read<AuthService>()
        .toggleSaveEvent(uid, event.id);
    if (mounted) setState(() => _saved = updated.contains(event.id));
  }

  void _shareEvent(Event event) {
    final dateLabel = DateFormat('EEE, d MMMM yyyy').format(event.date);
    final shareText = '''Check out ${event.title} on EventHub!

$dateLabel
${event.venue}
${event.isFree ? 'Free entry' : 'From GHS ${event.cheapestPrice.toStringAsFixed(0)}'}

Join me on EventHub!''';

    Share.share(shareText);
  }

  /// Calm, one-shot entry motion (same pattern as the register and
  /// confirmation screens): fade + 3% slideY, 60ms stagger, skipped entirely
  /// when the OS asks for reduced motion.
  Widget _stagger(Widget child, int index) {
    if (!mounted) return child;
    if (MediaQuery.of(context).disableAnimations) return child;
    return child
        .animate(delay: Duration(milliseconds: 60 * index))
        .fadeIn(duration: 250.ms)
        .slideY(begin: 0.03, end: 0);
  }

  @override
  Widget build(BuildContext context) {
    final dateLabel = DateFormat('EEE, d MMMM yyyy').format(event.date);
    final bottomPad = MediaQuery.of(context).padding.bottom;
    // First-load entrance stagger: ticket rows first, then the section cards.
    final sectionBase = 1 + event.ticketTypes.length;

    return Scaffold(
      backgroundColor: AppColors.backgroundTinted,
      body: CustomScrollView(
        slivers: [
          // ── Cover image app bar ──
          SliverAppBar(
            expandedHeight: 260,
            pinned: true,
            // Cover-overlay actions use the same icon system as the
            // EventFeedCard right rail: 44px translucent circle, white/15
            // fill + white/40 hairline, 22px glyph, AppSpacing.lg gaps.
            actions: [
              _CoverActionButton(
                icon: IconsaxPlusLinear.share,
                onTap: () => _shareEvent(event),
              ),
              const SizedBox(width: AppSpacing.lg),
              _CoverActionButton(
                icon: _saved
                    ? IconsaxPlusBold.bookmark
                    : IconsaxPlusLinear.bookmark,
                color: _saved ? AppColors.accent : Colors.white,
                onTap: _toggleSaved,
              ),
              const SizedBox(width: AppSpacing.lg),
              PopupMenuButton<String>(
                onSelected: (value) {
                  if (value == 'report') {
                    showReportDialog(
                      context,
                      targetType: 'event',
                      targetId: event.id,
                    );
                  }
                },
                itemBuilder: (_) => const [
                  PopupMenuItem(
                    value: 'report',
                    child: Text('Report event'),
                  ),
                ],
                child: const _CoverActionButton(
                  icon: IconsaxPlusLinear.more,
                ),
              ),
            ],
            flexibleSpace: FlexibleSpaceBar(
              background: event.coverImageUrl.isNotEmpty
                  ? (event.coverImageUrl.startsWith('http')
                      ? CachedNetworkImage(
                          imageUrl: event.coverImageUrl,
                          fit: BoxFit.cover,
                          errorWidget: (_, __, ___) => const _CoverFallback(),
                        )
                      : Image.file(File(event.coverImageUrl),
                          fit: BoxFit.cover,
                          errorBuilder: (_, __, ___) =>
                              const _CoverFallback()))
                  : const _CoverFallback(),
            ),
          ),

          // ── Main content ──
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Title
                  Text(
                    event.title,
                    style: const TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.w800,
                      color: AppColors.textPrimary,
                      letterSpacing: -0.3,
                    ),
                  ),
                  const SizedBox(height: 12),

                  // Date
                  _MetaRow(
                    icon: IconsaxPlusLinear.calendar,
                    text: dateLabel,
                  ),
                  const SizedBox(height: 8),

                  // Venue
                  _MetaRow(icon: IconsaxPlusLinear.location, text: event.venue),
                  const SizedBox(height: 20),

                  // Organizer row + social proof
                  _OrganizerRow(event: event),
                  _SocialProofLine(eventId: event.id),
                  const SizedBox(height: 20),

                  // Ticket tier selection
                  if (event.ticketTypes.isNotEmpty) ...[
                    _stagger(
                      const Text(
                        'Select ticket',
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      0,
                    ),
                    const SizedBox(height: 10),
                    for (int i = 0; i < event.ticketTypes.length; i++)
                      _stagger(
                        _TicketTierRow(
                          tier: event.ticketTypes[i],
                          eventId: event.id,
                          selected: _selectedTierIndex == i,
                          onTap: () {
                            final remaining = context
                                .read<EventService>()
                                .remainingCapacity(
                                    event.id, event.ticketTypes[i].name);
                            if (remaining > 0) {
                              setState(() => _selectedTierIndex = i);
                            }
                          },
                        ),
                                                1 + i,
                      ),
                    const SizedBox(height: 24),
                  ],

                  // Section label — a muted pacing cue between the ticket
                  // task and the reference-info groups below it.
                  _stagger(
                    const Text(
                      'Details',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: AppColors.textMuted,
                      ),
                    ),
                    sectionBase,
                  ),
                  const SizedBox(height: 10),

                  // ── Grouped expansion sections — one white card with
                  // hairline dividers between rows (Settings-style grouping) ──
                  _stagger(
                    Container(
                      clipBehavior: Clip.antiAlias,
                      decoration: BoxDecoration(
                        color: AppColors.surface,
                        borderRadius: BorderRadius.circular(20),
                        boxShadow: [
                          BoxShadow(
                            color: AppColors.primary.withValues(alpha: 0.09),
                            blurRadius: 16,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          _SectionExpansion(
                            title: 'About this event',
                            icon: IconsaxPlusLinear.info_circle,
                            initiallyExpanded: false,
                            child: _AboutContent(event: event),
                          ),
                          const Divider(indent: 50),
                          _SectionExpansion(
                            title: 'Guest list',
                            icon: IconsaxPlusLinear.people,
                            countStream: context
                                .read<GuestListService>()
                                .guestListForEvent(event.id),
                            countLabel: (n) =>
                                n == 1 ? '(1 contact)' : '($n contacts)',
                            initiallyExpanded: false,
                            child: _GuestsContent(event: event),
                          ),
                          const Divider(indent: 50),
                          _SectionExpansion(
                            title: 'Schedule',
                            icon: IconsaxPlusLinear.calendar_1,
                            countStream: context
                                .read<EventScheduleService>()
                                .scheduleForEvent(event.id),
                            countLabel: (n) => '($n)',
                            initiallyExpanded: false,
                            child: _ScheduleContent(eventId: event.id),
                          ),
                          const Divider(indent: 50),
                          _SectionExpansion(
                            title: 'Updates',
                            icon: IconsaxPlusLinear.notification,
                            countStream: context
                                .read<PostService>()
                                .postsForEvent(event.id),
                            countLabel: (n) => '($n)',
                            initiallyExpanded: false,
                            child: _UpdatesContent(eventId: event.id),
                          ),
                          const Divider(indent: 50),
                          _SectionExpansion(
                            title: 'Reviews',
                            icon: IconsaxPlusLinear.star,
                            countStream: context
                                .read<ReviewService>()
                                .reviewsForEvent(event.id),
                            countLabel: (n) => '($n)',
                            initiallyExpanded: false,
                            child: _ReviewsContent(eventId: event.id),
                          ),
                          if (event.status == 'completed') ...[
                            const Divider(indent: 50),
                            _SectionExpansion(
                              title: 'Photos',
                              icon: IconsaxPlusLinear.gallery,
                              initiallyExpanded: false,
                              child: SizedBox(
                                height: 300,
                                child: EventPhotosScreen(eventId: event.id),
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                    sectionBase,
                  ),

                  // Venue — same group-pause gap as ticket → details
                  const SizedBox(height: 24),
                  _VenueMapSection(event: event),

                  // Horizontal photo strip (only when photos exist)
                  _PhotoStrip(eventId: event.id),

                  // Bottom padding for the fixed CTA
                  SizedBox(height: 100 + bottomPad),
                ],
              ),
            ),
          ),
        ],
      ),

      // ── Fixed bottom CTA ──
      bottomNavigationBar: event.status == 'completed'
          ? null
          : _FixedCta(
              event: event,
              selectedTierIndex: _selectedTierIndex,
            ),
    );
  }
}

// ─── Fixed bottom CTA button ──────────────────────────────────────────────

class _FixedCta extends StatelessWidget {
  const _FixedCta({
    required this.event,
    required this.selectedTierIndex,
  });

  final Event event;
  final int selectedTierIndex;

  @override
  Widget build(BuildContext context) {
    final bottomPad = MediaQuery.of(context).padding.bottom;
    final ticket =
        event.ticketTypes.isNotEmpty ? event.ticketTypes[selectedTierIndex] : null;
    final ticketType = ticket?.name ?? 'Free';
    final priceLabel = event.isFree
        ? 'RSVP Free'
        : 'Get Tickets — GHS ${ticket?.price.toStringAsFixed(0) ?? '0'}';

    return Container(
      padding: EdgeInsets.fromLTRB(20, 12, 20, 12 + bottomPad),
      decoration: const BoxDecoration(
        color: AppColors.surface,
        border: Border(
          top: BorderSide(color: AppColors.border, width: 1),
        ),
      ),
      child: SizedBox(
        width: double.infinity,
        height: 50,
        child: ElevatedButton(
          onPressed: () {
            final remaining = context
                .read<EventService>()
                .remainingCapacity(event.id, ticketType);
            if (remaining == 0) return;
            Navigator.of(context).push(
              MaterialPageRoute(
                builder: (_) => RegistrationFormScreen(
                  eventId: event.id,
                  ticketType: ticketType,
                ),
              ),
            );
          },
          child: Text(priceLabel),
        ),
      ),
    );
  }
}

// ─── Section expansion tile ───────────────────────────────────────────────

/// Expandable row for the grouped sections card — a bare ExpansionTile with
/// no card chrome of its own (the shared white container + hairline dividers
/// supply that). The header keeps the 24px primary-tint chip + bold title;
/// an iconsax chevron rotates open and closed with a short, calm turn.
class _SectionExpansion extends StatefulWidget {
  const _SectionExpansion({
    required this.title,
    required this.icon,
    required this.child,
    this.initiallyExpanded = false,
    this.countStream,
    this.countLabel,
  });

  final String title;
  final IconData icon;
  final Widget child;
  final bool initiallyExpanded;
  final Stream<List<dynamic>>? countStream;
  final String Function(int count)? countLabel;

  @override
  State<_SectionExpansion> createState() => _SectionExpansionState();
}

class _SectionExpansionState extends State<_SectionExpansion> {
  late bool _expanded = widget.initiallyExpanded;

  @override
  Widget build(BuildContext context) {
    return ExpansionTile(
        title: Row(
          children: [
            Container(
              width: 24,
              height: 24,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.11),
                shape: BoxShape.circle,
              ),
              child: Icon(widget.icon, size: 14, color: AppColors.primary),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                widget.title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textPrimary,
                ),
              ),
            ),
            if (widget.countStream != null)
              StreamBuilder<List<dynamic>>(
                stream: widget.countStream,
                builder: (context, snapshot) {
                  final count = snapshot.data?.length ?? 0;
                  if (count == 0) return const SizedBox.shrink();
                  return Flexible(
                    child: Text(
                      widget.countLabel!(count),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: AppColors.textMuted,
                      ),
                    ),
                  );
                },
              ),
          ],
        ),
        trailing: Padding(
          padding: const EdgeInsets.only(left: AppSpacing.sm),
          child: AnimatedRotation(
            turns: _expanded ? 0.5 : 0,
            duration: const Duration(milliseconds: 180),
            curve: Curves.easeInOut,
            child: const Icon(
              IconsaxPlusLinear.arrow_down,
              size: 18,
              color: AppColors.textMuted,
            ),
          ),
        ),
        onExpansionChanged: (open) => setState(() => _expanded = open),
        initiallyExpanded: widget.initiallyExpanded,
        // ListTile's default one-line floor (56) is taller than this header
        // needs — cap it so the five rows stay a compact group.
        minTileHeight: 48,
        tilePadding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.lg, vertical: 4),
        childrenPadding: const EdgeInsets.only(bottom: AppSpacing.md),
        expandedCrossAxisAlignment: CrossAxisAlignment.stretch,
        children: [widget.child],
    );
  }
}

// ─── About content ────────────────────────────────────────────────────────

/// Category + description only. Ticket tiers and prices live exclusively
/// under "Select ticket" — no duplication here.
class _AboutContent extends StatelessWidget {
  const _AboutContent({required this.event});
  final Event event;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(
          AppSpacing.lg, AppSpacing.xs, AppSpacing.lg, AppSpacing.xs),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (event.category.isNotEmpty)
            _InfoRow(
                icon: IconsaxPlusLinear.category,
                text: _capitalize(event.category)),
          if (event.description.isNotEmpty) ...[
            if (event.category.isNotEmpty) const SizedBox(height: 12),
            Text(
              event.description,
              style: const TextStyle(
                fontSize: 14,
                color: AppColors.textPrimary,
                height: 1.5,
              ),
            ),
          ],
        ],
      ),
    );
  }

  String _capitalize(String v) =>
      v.isEmpty ? v : v[0].toUpperCase() + v.substring(1);
}

// ─── Guests content ───────────────────────────────────────────────────────

class _GuestsContent extends StatelessWidget {
  const _GuestsContent({required this.event});
  final Event event;

  @override
  Widget build(BuildContext context) {
    final registrationService = context.read<RegistrationService>();
    final authService = context.read<AuthService>();
    return StreamBuilder<List<GuestListEntry>>(
      stream: context.read<GuestListService>().guestListForEvent(event.id),
      builder: (context, guestSnapshot) {
        final guestList = guestSnapshot.data ?? const [];
        return StreamBuilder<List<Booking>>(
          stream: registrationService.bookingsForEvent(event.id),
          builder: (context, bookingSnapshot) {
            final bookings = (bookingSnapshot.data ?? const [])
                .where((b) => b.status == 'confirmed' || b.checkedIn)
                .toList();

            if (guestList.isEmpty && bookings.isEmpty) {
              return Center(
                child: Column(mainAxisSize: MainAxisSize.min, children: [
                  Container(
                      width: 48,
                      height: 48,
                      decoration: BoxDecoration(
                          color: AppColors.primary.withValues(alpha: 0.10),
                          borderRadius: BorderRadius.circular(12)),
                      child: const Icon(IconsaxPlusLinear.people,
                          color: AppColors.primary)),
                  const SizedBox(height: 12),
                  const Text('No guests yet.',
                      style: TextStyle(color: AppColors.textMuted)),
                ]),
              );
            }

            // Hairline-separated rows on the white section card — no
            // individually boxed sub-cards (register/confirmation language).
            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (guestList.isNotEmpty) ...[
                  _groupLabel(IconsaxPlusLinear.star,
                      'Honored guests · ${guestList.length}'),
                  for (int i = 0; i < guestList.length; i++) ...[
                    if (i > 0) const Divider(),
                    Padding(
                      padding: const EdgeInsets.symmetric(
                          horizontal: AppSpacing.lg, vertical: AppSpacing.md),
                      child: _guestRow(guestList[i]),
                    ),
                  ],
                ],
                if (guestList.isNotEmpty && bookings.isNotEmpty)
                  const Divider(),
                if (bookings.isNotEmpty) ...[
                  _groupLabel(IconsaxPlusLinear.people,
                      'Attendees · ${bookings.length}'),
                  for (final booking in bookings)
                    Padding(
                      padding: const EdgeInsets.symmetric(
                          horizontal: AppSpacing.lg, vertical: AppSpacing.md),
                      child: _attendeeRow(booking, authService),
                    ),
                ],
              ],
            );
          },
        );
      },
    );
  }

  /// Group heading inside the card: 14px primary icon + bold primary label,
  /// one line with ellipsis.
  Widget _groupLabel(IconData icon, String label) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(
          AppSpacing.lg, AppSpacing.xs, AppSpacing.lg, AppSpacing.xs),
      child: Row(children: [
        Icon(icon, size: 14, color: AppColors.primary),
        const SizedBox(width: 6),
        Expanded(
          child: Text(label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: AppColors.primary)),
        ),
      ]),
    );
  }

  Widget _guestRow(GuestListEntry g) {
    return Row(children: [
      Container(
        width: 40,
        height: 40,
        decoration: BoxDecoration(
          color: AppColors.skeleton,
          shape: BoxShape.circle,
          image: g.avatarUrl.isNotEmpty
              ? DecorationImage(
                  image: g.avatarUrl.startsWith('http')
                      ? NetworkImage(g.avatarUrl) as ImageProvider
                      : FileImage(File(g.avatarUrl)),
                  fit: BoxFit.cover)
              : null,
        ),
        child: g.avatarUrl.isEmpty
            ? Center(
                child: Text(
                    g.name.isEmpty ? '?' : g.name[0].toUpperCase(),
                    style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: AppColors.textPrimary)))
            : null,
      ),
      const SizedBox(width: 12),
      Expanded(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(children: [
              Expanded(
                child: Text(g.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 13,
                        color: AppColors.textPrimary)),
              ),
              if (g.role.isNotEmpty) ...[
                const SizedBox(width: AppSpacing.sm),
                Container(
                  constraints: const BoxConstraints(maxWidth: 110),
                  padding:
                      const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                      color: AppColors.primary.withValues(alpha: 0.10),
                      borderRadius: BorderRadius.circular(6)),
                  child: Text(g.role,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          color: AppColors.primary)),
                ),
              ],
            ]),
            if (g.phone.isNotEmpty)
              Text(g.phone,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                      fontSize: 11, color: AppColors.textMuted)),
            if (g.notes.isNotEmpty)
              Text(g.notes,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                      fontSize: 11, color: AppColors.textMuted)),
          ],
        ),
      ),
    ]);
  }

  Widget _attendeeRow(Booking booking, AuthService authService) {
    return FutureBuilder<Map<String, dynamic>?>(
      future: authService.fetchUserProfile(booking.userId),
      builder: (context, profileSnapshot) {
        final profile = profileSnapshot.data;
        final name = profile?['name'] as String? ?? 'Guest';
        final initial = name.isEmpty ? '?' : name[0].toUpperCase();
        return Row(children: [
          CircleAvatar(
              radius: 18,
              backgroundColor: AppColors.skeleton,
              child: Text(initial,
                  style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textPrimary))),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        fontWeight: FontWeight.w600,
                        fontSize: 13,
                        color: AppColors.textPrimary)),
                Text(
                    booking.checkedIn
                        ? 'Checked in · ${booking.seatNumber}'
                        : booking.seatNumber,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                        fontSize: 11,
                        color: booking.checkedIn
                            ? AppColors.success
                            : AppColors.textMuted)),
              ],
            ),
          ),
          if (booking.checkedIn)
            const Icon(IconsaxPlusBold.tick_circle,
                color: AppColors.success, size: 18)
          else
            const Icon(IconsaxPlusLinear.user,
                color: AppColors.textMuted, size: 18),
        ]);
      },
    );
  }
}

// ─── Schedule content ─────────────────────────────────────────────────────

class _ScheduleContent extends StatelessWidget {
  const _ScheduleContent({required this.eventId});
  final String eventId;

  @override
  Widget build(BuildContext context) {
    final scheduleService = context.read<EventScheduleService>();

    return StreamBuilder<List<EventScheduleItem>>(
      stream: scheduleService.scheduleForEvent(eventId),
      builder: (context, snapshot) {
        if (snapshot.hasError) {
          return const Padding(
            padding: EdgeInsets.all(16),
            child: Text('Could not load schedule.',
                style: TextStyle(color: AppColors.textMuted)),
          );
        }
        if (!snapshot.hasData) {
          return const Center(
            child: SizedBox(
                width: 24,
                height: 24,
                child: CircularProgressIndicator(strokeWidth: 2)),
          );
        }

        final items = snapshot.data!;
        if (items.isEmpty) {
          return Center(
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                      color: AppColors.skeleton,
                      borderRadius: BorderRadius.circular(12)),
                  child: const Icon(IconsaxPlusLinear.clock,
                      color: AppColors.textMuted)),
              const SizedBox(height: 12),
              const Text('No schedule yet.',
                  style: TextStyle(color: AppColors.textMuted)),
            ]),
          );
        }

        return ListView.separated(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: items.length,
          separatorBuilder: (_, __) => const Divider(),
          itemBuilder: (context, index) {
            final item = items[index];
            final timeFormat = DateFormat('HH:mm');
            final startLabel = timeFormat.format(item.startTime);
            final endLabel = timeFormat.format(item.endTime);

            return Padding(
              padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.lg, vertical: AppSpacing.md),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 4,
                    height: 50,
                    decoration: BoxDecoration(
                      color: AppColors.primary,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(item.title,
                            style: const TextStyle(
                                fontWeight: FontWeight.w600,
                                fontSize: 14,
                                color: AppColors.textPrimary)),
                        const SizedBox(height: 4),
                        Text('$startLabel - $endLabel',
                            style: const TextStyle(
                                fontSize: 12, color: AppColors.textMuted)),
                        if (item.description.isNotEmpty) ...[
                          const SizedBox(height: 4),
                          Text(item.description,
                              style: const TextStyle(
                                  fontSize: 12, color: AppColors.textMuted)),
                        ],
                        if (item.location.isNotEmpty) ...[
                          const SizedBox(height: 4),
                          Row(children: [
                            const Icon(IconsaxPlusLinear.location,
                                size: 12, color: AppColors.textMuted),
                            const SizedBox(width: 4),
                            Flexible(
                              child: Text(item.location,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                      fontSize: 12,
                                      color: AppColors.textMuted)),
                            ),
                          ]),
                        ],
                      ],
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }
}

// ─── Updates content ──────────────────────────────────────────────────────

class _UpdatesContent extends StatelessWidget {
  const _UpdatesContent({required this.eventId});
  final String eventId;

  @override
  Widget build(BuildContext context) {
    final postService = context.read<PostService>();

    return StreamBuilder<List<Post>>(
      stream: postService.postsForEvent(eventId),
      builder: (context, snapshot) {
        if (snapshot.hasError) {
          return const Padding(
            padding: EdgeInsets.all(16),
            child: Text('Could not load updates.',
                style: TextStyle(color: AppColors.textMuted)),
          );
        }
        if (!snapshot.hasData) {
          return const Center(
            child: SizedBox(
                width: 24,
                height: 24,
                child: CircularProgressIndicator(strokeWidth: 2)),
          );
        }
        final posts = snapshot.data!;
        if (posts.isEmpty) {
          return Center(
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                      color: AppColors.skeleton,
                      borderRadius: BorderRadius.circular(12)),
                  child: const Icon(IconsaxPlusLinear.speaker,
                      color: AppColors.textMuted)),
              const SizedBox(height: 12),
              const Text('No updates yet.',
                  style: TextStyle(color: AppColors.textMuted)),
            ]),
          );
        }
        return ListView.separated(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: posts.length,
          separatorBuilder: (_, __) => const Divider(),
          itemBuilder: (context, index) {
            final post = posts[index];
            final timeLabel =
                DateFormat('d MMM, HH:mm').format(post.postedAt);
            return Padding(
              padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.lg, vertical: AppSpacing.md),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        width: 28,
                        height: 28,
                        decoration: const BoxDecoration(
                          color: AppColors.skeleton,
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(IconsaxPlusLinear.user,
                            size: 14, color: AppColors.textMuted),
                      ),
                      const SizedBox(width: 8),
                      const Expanded(
                        child: Text('Organizer',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                                color: AppColors.textPrimary)),
                      ),
                      Flexible(
                        child: Text(timeLabel,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                                fontSize: 11, color: AppColors.textMuted)),
                      ),
                      PopupMenuButton<String>(
                        padding: EdgeInsets.zero,
                        icon: const Icon(IconsaxPlusLinear.more,
                            size: 16, color: AppColors.textMuted),
                        onSelected: (value) {
                          if (value == 'report') {
                            showReportDialog(context,
                                targetType: 'post', targetId: post.id);
                          }
                        },
                        itemBuilder: (_) => const [
                          PopupMenuItem(
                              value: 'report',
                              child: Text('Report post',
                                  style: TextStyle(fontSize: 13))),
                        ],
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Text(post.text,
                      style: const TextStyle(
                          fontSize: 14, color: AppColors.textPrimary)),
                  if (post.commentCount > 0) ...[
                    const SizedBox(height: 8),
                    Text(
                        '${post.commentCount} comment${post.commentCount == 1 ? '' : 's'}',
                        style: const TextStyle(
                            fontSize: 12, color: AppColors.textMuted)),
                  ],
                ],
              ),
            );
          },
        );
      },
    );
  }
}

// ─── Reviews content ──────────────────────────────────────────────────────

class _ReviewsContent extends StatelessWidget {
  const _ReviewsContent({required this.eventId});
  final String eventId;

  @override
  Widget build(BuildContext context) {
    final reviewService = context.read<ReviewService>();

    return StreamBuilder<List<Review>>(
      stream: reviewService.reviewsForEvent(eventId),
      builder: (context, snapshot) {
        if (snapshot.hasError) {
          return const Padding(
            padding: EdgeInsets.all(16),
            child: Text('Could not load reviews.',
                style: TextStyle(color: AppColors.textMuted)),
          );
        }
        if (!snapshot.hasData) {
          return const Center(
            child: SizedBox(
                width: 24,
                height: 24,
                child: CircularProgressIndicator(strokeWidth: 2)),
          );
        }

        final reviews = snapshot.data!;
        if (reviews.isEmpty) {
          return Center(
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                      color: AppColors.skeleton,
                      borderRadius: BorderRadius.circular(12)),
                  child: const Icon(IconsaxPlusLinear.star,
                      color: AppColors.textMuted)),
              const SizedBox(height: 12),
              const Text('No reviews yet.',
                  style: TextStyle(color: AppColors.textMuted)),
            ]),
          );
        }

        return ListView.separated(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: reviews.length,
          separatorBuilder: (_, __) => const Divider(),
          itemBuilder: (context, index) {
            final review = reviews[index];
            return FutureBuilder<Map<String, dynamic>?>(
              future:
                  context.read<AuthService>().fetchUserProfile(review.attendeeId),
              builder: (context, profileSnapshot) {
                final profile = profileSnapshot.data;
                final name = profile?['name'] as String? ?? 'Attendee';
                final initial =
                    name.isEmpty ? '?' : name[0].toUpperCase();

                return Padding(
                  padding: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.lg, vertical: AppSpacing.md),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          CircleAvatar(
                            radius: 16,
                            backgroundColor: AppColors.skeleton,
                            child: Text(initial,
                                style: const TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w700,
                                    color: AppColors.textPrimary)),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(name,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                        fontWeight: FontWeight.w600,
                                        fontSize: 13,
                                        color: AppColors.textPrimary)),
                                Row(
                                  children: [
                                    ...List.generate(5, (i) {
                                      final star = i + 1;
                                      return Icon(
                                        star <= review.rating
                                            ? IconsaxPlusBold.star
                                            : IconsaxPlusLinear.star,
                                        size: 12,
                                        color: star <= review.rating
                                            ? AppColors.accent
                                            : AppColors.neutral,
                                      );
                                    }),
                                    const SizedBox(width: 6),
                                    Flexible(
                                      child: Text(
                                          DateFormat('d MMM, HH:mm')
                                              .format(review.createdAt),
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                          style: const TextStyle(
                                              fontSize: 11,
                                              color: AppColors.textMuted)),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      if (review.text.isNotEmpty) ...[
                        const SizedBox(height: 10),
                        Text(review.text,
                            style: const TextStyle(
                                fontSize: 13, color: AppColors.textPrimary)),
                      ],
                    ],
                  ),
                );
              },
            );
          },
        );
      },
    );
  }
}

// ─── Shared sub-widgets ───────────────────────────────────────────────────

/// Circular cover-overlay action matching the EventFeedCard right-rail
/// icon treatment: 44px circle, white/15 fill, white/40 hairline border,
/// 22px glyph.
class _CoverActionButton extends StatelessWidget {
  const _CoverActionButton({
    required this.icon,
    this.onTap,
    this.color = Colors.white,
  });

  final IconData icon;
  final VoidCallback? onTap;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Container(
        width: 44,
        height: 44,
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.15),
          shape: BoxShape.circle,
          border: Border.all(
              color: Colors.white.withValues(alpha: 0.4), width: 1),
        ),
        child: Icon(icon, size: 22, color: color),
      ),
    );
  }
}

/// Social-proof line beneath the organizer row — "X people are attending",
/// hidden when nobody has registered yet. Computed from
/// [EventService.confirmedAttendeeCount].
class _SocialProofLine extends StatelessWidget {
  const _SocialProofLine({required this.eventId});

  final String eventId;

  @override
  Widget build(BuildContext context) {
    final count =
        context.read<EventService>().confirmedAttendeeCount(eventId);
    if (count == 0) return const SizedBox.shrink();

    return Padding(
      padding: const EdgeInsets.only(top: 10),
      child: Row(
        children: [
          const Icon(IconsaxPlusLinear.people,
              size: 14, color: AppColors.primary),
          const SizedBox(width: 6),
          Flexible(
            child: Text(
              count == 1
                  ? '1 person is attending'
                  : '$count people are attending',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w500,
                color: AppColors.primary,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Horizontal-scroll strip of posted event photos near the bottom of the
/// page (above the fixed CTA). Reads the existing posts/gallery feature —
/// renders nothing when the event has no photos.
class _PhotoStrip extends StatelessWidget {
  const _PhotoStrip({required this.eventId});

  final String eventId;

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<List<Post>>(
      stream: context.read<PostService>().postsForEvent(eventId),
      builder: (context, snapshot) {
        final photoUrls = <String>[
          for (final post in snapshot.data ?? const <Post>[])
            ...post.mediaUrls.where((u) => u.isNotEmpty),
        ];
        if (photoUrls.isEmpty) return const SizedBox.shrink();

        return Padding(
          padding: const EdgeInsets.only(top: 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Photos',
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 10),
              SizedBox(
                height: 96,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: photoUrls.length,
                  separatorBuilder: (_, __) =>
                      const SizedBox(width: AppSpacing.md),
                  itemBuilder: (context, index) {
                    final url = photoUrls[index];
                    return GestureDetector(
                      onTap: () => Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) => EventPhotosScreen(eventId: eventId),
                        ),
                      ),
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(10),
                        child: SizedBox(
                          width: 128,
                          child: url.startsWith('http')
                              ? Image.network(
                                  url,
                                  fit: BoxFit.cover,
                                  errorBuilder: (_, __, ___) =>
                                      const _PhotoStripPlaceholder(),
                                )
                              : Image.file(
                                  File(url),
                                  fit: BoxFit.cover,
                                  errorBuilder: (_, __, ___) =>
                                      const _PhotoStripPlaceholder(),
                                ),
                        ),
                      ),
                    );
                  },
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _PhotoStripPlaceholder extends StatelessWidget {
  const _PhotoStripPlaceholder();

  @override
  Widget build(BuildContext context) {
    return Container(
      color: AppColors.skeleton,
      child: const Center(
        child: Icon(IconsaxPlusLinear.image,
            size: 24, color: AppColors.textMuted),
      ),
    );
  }
}

class _MetaRow extends StatelessWidget {
  const _MetaRow({required this.icon, required this.text});
  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 16, color: AppColors.textMuted),
        const SizedBox(width: 8),
        Expanded(
          child: Text(text,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style:
                  const TextStyle(fontSize: 14, color: AppColors.textMuted)),
        ),
      ],
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.icon, required this.text});
  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 18, color: AppColors.textMuted),
        const SizedBox(width: 10),
        Expanded(
          child: Text(text,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                  fontSize: 14, color: AppColors.textPrimary)),
        ),
      ],
    );
  }
}

class _CoverFallback extends StatelessWidget {
  const _CoverFallback();

  @override
  Widget build(BuildContext context) {
    return Container(
      color: AppColors.skeleton,
      child: const Center(
        child: Icon(IconsaxPlusLinear.calendar,
            color: AppColors.textMuted, size: 56),
      ),
    );
  }
}

// ─── Venue section ────────────────────────────────────────────────────────

/// Venue card in the same grouped-card language as the sections above:
/// white surface, radius 20, soft cobalt shadow, primary-tint pin chip and a
/// designed location block (pin + venue + "View on map") instead of a bare
/// map box. The action hands off to the external maps app.
class _VenueMapSection extends StatelessWidget {
  const _VenueMapSection({required this.event});
  final Event event;

  @override
  Widget build(BuildContext context) {
    final hasCoords = event.lat != 0 || event.lng != 0;

    return Container(
      clipBehavior: Clip.antiAlias,
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: AppColors.primary.withValues(alpha: 0.09),
            blurRadius: 16,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Venue',
              style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textPrimary)),
          const SizedBox(height: 12),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.lg, vertical: AppSpacing.xl),
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.06),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Column(
              children: [
                Container(
                  width: 48,
                  height: 48,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: AppColors.primary.withValues(alpha: 0.10),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(IconsaxPlusLinear.location,
                      size: 24, color: AppColors.primary),
                ),
                const SizedBox(height: AppSpacing.md),
                Text(
                  event.venue,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: AppColors.textPrimary),
                ),
                if (hasCoords) ...[
                  const SizedBox(height: AppSpacing.md),
                  GestureDetector(
                    behavior: HitTestBehavior.opaque,
                    onTap: () => _openExternalMaps(context),
                    child: Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(vertical: 11),
                      decoration: BoxDecoration(
                        color: AppColors.primary.withValues(alpha: 0.08),
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: const Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(IconsaxPlusLinear.map,
                              size: 16, color: AppColors.primary),
                          SizedBox(width: 6),
                          Flexible(
                            child: Text('View on map',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w600,
                                    color: AppColors.primary)),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  void _openExternalMaps(BuildContext context) async {
    final uri = Uri.parse(
      'https://www.google.com/maps/search/?api=1&query=${event.lat},${event.lng}',
    );
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }
}

// ─── Organizer row ────────────────────────────────────────────────────────

class _OrganizerRow extends StatelessWidget {
  const _OrganizerRow({required this.event});
  final Event event;

  @override
  Widget build(BuildContext context) {
    final authService = context.read<AuthService>();
    final currentUid = authService.currentUid ?? '';
    final isSelf = currentUid == event.ownerId;

    return FutureBuilder<Map<String, dynamic>?>(
      future: authService.fetchUserProfile(event.ownerId),
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const Padding(
            padding: EdgeInsets.symmetric(vertical: 8),
            child: Row(
              children: [
                CircleAvatar(
                    radius: 18, backgroundColor: AppColors.skeleton),
                SizedBox(width: 12),
                Flexible(
                  child: Text('Loading...',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(color: AppColors.textMuted)),
                ),
              ],
            ),
          );
        }
        final profile = snapshot.data;
        final name = profile?['name'] as String? ?? 'Organizer';
        final initial = name.isEmpty ? '?' : name[0].toUpperCase();

        return GestureDetector(
          onTap: () {
            Navigator.of(context).push(
              MaterialPageRoute(
                builder: (_) =>
                    OrganizerProfileScreen(organizerId: event.ownerId),
              ),
            );
          },
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Row(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: const BoxDecoration(
                    color: AppColors.skeleton,
                    shape: BoxShape.circle,
                  ),
                  child: Center(
                    child: Text(initial,
                        style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w700,
                            color: AppColors.textPrimary)),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Organized by',
                          style: TextStyle(
                              fontSize: 11, color: AppColors.textMuted)),
                      Text(name,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                              color: AppColors.textPrimary)),
                    ],
                  ),
                ),
                if (!isSelf && currentUid.isNotEmpty)
                  _EventPageFollowButton(targetUserId: event.ownerId),
                const SizedBox(width: 4),
                const Icon(IconsaxPlusLinear.arrow_right_2,
                    size: 20, color: AppColors.textMuted),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _EventPageFollowButton extends StatefulWidget {
  const _EventPageFollowButton({required this.targetUserId});
  final String targetUserId;

  @override
  State<_EventPageFollowButton> createState() =>
      _EventPageFollowButtonState();
}

class _EventPageFollowButtonState extends State<_EventPageFollowButton> {
  bool _loading = false;

  @override
  Widget build(BuildContext context) {
    final currentUid = context.read<AuthService>().currentUid ?? '';
    if (currentUid.isEmpty) return const SizedBox.shrink();

    return StreamBuilder<bool>(
      stream: context.read<FollowService>().isFollowingStream(
            currentUid,
            widget.targetUserId,
          ),
      builder: (context, snapshot) {
        final isFollowing = snapshot.data ?? false;
        return GestureDetector(
          onTap: _loading
              ? null
              : () async {
                  setState(() => _loading = true);
                  await context.read<FollowService>().toggleFollow(
                        currentUid,
                        widget.targetUserId,
                      );
                  if (mounted) setState(() => _loading = false);
                },
          child: Container(
            padding:
                const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: isFollowing ? AppColors.skeleton : Colors.transparent,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(
                color: isFollowing ? AppColors.border : AppColors.primary,
                width: 1,
              ),
            ),
            child: _loading
                ? const SizedBox(
                    width: 12,
                    height: 12,
                    child: CircularProgressIndicator(strokeWidth: 1.5),
                  )
                : Text(
                    isFollowing ? 'Following' : 'Follow',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: isFollowing
                            ? AppColors.textMuted
                            : AppColors.primary),
                  ),
          ),
        );
      },
    );
  }
}

// ─── Ticket tier row ──────────────────────────────────────────────────────

class _TicketTierRow extends StatelessWidget {
  const _TicketTierRow({
    required this.tier,
    required this.eventId,
    required this.selected,
    required this.onTap,
  });

  final EventTicket tier;
  final String eventId;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final eventService = context.read<EventService>();
    final remaining = eventService.remainingCapacity(eventId, tier.name);
    final soldOut = remaining == 0;
    // Soft urgency cue: danger red when under 20% of capacity remains.
    final lowStock = remaining >= 0 &&
        tier.capacity > 0 &&
        remaining < tier.capacity * 0.2;

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: GestureDetector(
        onTap: soldOut ? null : onTap,
        child: Container(
          padding:
              const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(
            color: selected
                ? AppColors.primary.withValues(alpha: 0.10)
                : AppColors.surface,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: selected ? AppColors.primary : AppColors.border,
              width: selected ? 1.5 : 1,
            ),
          ),
          child: Row(
            children: [
              Container(
                width: 20,
                height: 20,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: selected ? AppColors.primary : AppColors.border,
                    width: 2,
                  ),
                ),
                child: selected
                    ? const Center(
                        child: DecoratedBox(
                          decoration: BoxDecoration(
                              color: AppColors.primary,
                              shape: BoxShape.circle),
                          child: SizedBox(width: 10, height: 10),
                        ),
                      )
                    : null,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(tier.name,
                        style: TextStyle(
                            fontWeight: FontWeight.w600,
                            color: soldOut
                                ? AppColors.textMuted
                                : AppColors.textPrimary)),
                    const SizedBox(height: 2),
                    soldOut
                        ? Row(children: [
                            Flexible(
                              child: Text('Sold out',
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(
                                      fontSize: 12,
                                      color: AppColors.danger,
                                      fontWeight: FontWeight.w600)),
                            ),
                            const SizedBox(width: 8),
                            GestureDetector(
                              onTap: () => _joinWaitlist(context),
                              child: Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 8, vertical: 3),
                                decoration: BoxDecoration(
                                  color: AppColors.warningBg,
                                  borderRadius: BorderRadius.circular(6),
                                ),
                                child: const Text('Join waitlist',
                                    style: TextStyle(
                                        fontSize: 11,
                                        fontWeight: FontWeight.w600,
                                        color: AppColors.warning)),
                              ),
                            ),
                          ])
                        : Text(
                            '$remaining of ${tier.capacity} left',
                            style: TextStyle(
                                fontSize: 12,
                                color: lowStock
                                    ? AppColors.danger
                                    : AppColors.textMuted),
                          ),
                  ],
                ),
              ),
              Text(
                tier.price == 0
                    ? 'Free'
                    : 'GHS ${tier.price.toStringAsFixed(2)}',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                    color: soldOut ? AppColors.textMuted : AppColors.primary,
                    fontWeight: FontWeight.w700),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _joinWaitlist(BuildContext context) async {
    final uid = context.read<AuthService>().currentUid ?? '';
    if (uid.isEmpty) return;

    final waitlistService = context.read<WaitlistService>();
    final entry = WaitlistEntry(
      id: '',
      eventId: eventId,
      tierName: tier.name,
      userId: uid,
      joinedAt: DateTime.now().toUtc().toIso8601String(),
    );

    final position = await waitlistService.joinWaitlist(entry);
    if (!context.mounted) return;

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text("You're #$position on the waitlist for ${tier.name}."),
        action: SnackBarAction(label: 'OK', onPressed: () {}),
      ),
    );
  }
}

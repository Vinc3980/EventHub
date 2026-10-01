import 'dart:io';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../models/booking_model.dart';
import '../../models/event_model.dart';
import '../../models/guest_list_entry_model.dart';
import '../../models/post_model.dart';
import '../../services/auth_service.dart';
import '../../services/event_service.dart';
import '../../services/guest_list_service.dart';
import '../../services/notification_service.dart';
import '../../services/post_service.dart';
import '../../services/registration_service.dart';
import '../../theme/app_colors.dart';
import '../../widgets/primary_button.dart';
import '../../widgets/status_tag.dart';
import 'create_event.dart';
import 'event_analytics_screen.dart';
import 'boost_event_screen.dart';
import 'discount_codes_screen.dart';
import 'qr_scanner_screen.dart';
import 'refund_requests_screen.dart';

class EventDetailScreen extends StatefulWidget {
  const EventDetailScreen({super.key, required this.eventId});

  final String eventId;

  @override
  State<EventDetailScreen> createState() => _EventDetailScreenState();
}

class _EventDetailScreenState extends State<EventDetailScreen> {
  Event? _event;
  bool _loading = true;
  bool _cancelling = false;
  List<GuestListEntry> _guests = const [];
  List<Booking> _bookings = const [];
  final _postController = TextEditingController();
  final _attendeeSearchController = TextEditingController();
  String _attendeeFilter = 'all'; // 'all' | 'checked_in' | 'not_checked_in' | 'cancelled'
  String _attendeeSearchQuery = '';

  @override
  void initState() {
    super.initState();
    _load();
    context.read<GuestListService>().guestListForEvent(widget.eventId).listen(
      (entries) {
        if (mounted) setState(() => _guests = entries);
      },
    );
    context.read<RegistrationService>().bookingsForEvent(widget.eventId).listen(
      (bookings) {
        if (mounted) setState(() => _bookings = bookings);
      },
    );
  }

  @override
  void dispose() {
    _postController.dispose();
    _attendeeSearchController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final event = await context.read<EventService>().getEvent(widget.eventId);
    if (!mounted) return;
    setState(() {
      _event = event;
      _loading = false;
    });
  }

  Future<void> _openEdit() async {
    final event = _event;
    if (event == null) return;
    await Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => CreateEventScreen(initial: event)),
    );
    _load();
  }

  Future<void> _cancelEvent() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Cancel this event?'),
        content: const Text(
          'Guests will no longer be able to RSVP. This cannot be undone.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Keep event'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.danger),
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Cancel event'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    setState(() => _cancelling = true);
    try {
      await context.read<EventService>().cancelEvent(widget.eventId);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Event cancelled.')),
      );
      Navigator.of(context).pop();
    } catch (error) {
      if (!mounted) return;
      setState(() => _cancelling = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Could not cancel event: $error')),
      );
    }
  }

  Future<void> _postUpdate() async {
    final text = _postController.text.trim();
    if (text.isEmpty) return;

    final uid = context.read<AuthService>().currentUid ?? '';
    final postService = context.read<PostService>();
    final notificationService = context.read<NotificationService>();

    await postService.createPost(Post(
      id: '',
      authorId: uid,
      eventId: widget.eventId,
      text: text,
      postedAt: DateTime.now(),
    ));

    // Notify all attendees about the update
    final event = _event;
    final eventTitle = event?.title ?? 'Event';
    for (final booking in _bookings) {
      if (booking.status == 'confirmed' && booking.userId != uid) {
        await notificationService.saveLocal(
          uid: booking.userId,
          title: 'New update on $eventTitle',
          body: text.length > 100 ? '${text.substring(0, 100)}...' : text,
          type: 'event_update',
          targetId: widget.eventId,
        );
      }
    }

    _postController.clear();
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Update posted.')),
    );
  }

  Future<void> _messageAllAttendees() async {
    final messageController = TextEditingController();
    final event = _event;
    final eventTitle = event?.title ?? 'Event';

    final sent = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Message all attendees'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Send a message to ${_bookings.where((b) => b.status == 'confirmed').length} confirmed attendees.',
              style: const TextStyle(color: AppColors.textMuted),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: messageController,
              textCapitalization: TextCapitalization.sentences,
              maxLines: 3,
              decoration: InputDecoration(
                hintText: 'Enter your message...',
                hintStyle: const TextStyle(color: AppColors.textMuted),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: const BorderSide(color: AppColors.border),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: const BorderSide(color: AppColors.border),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: const BorderSide(color: AppColors.accent, width: 1.5),
                ),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Send'),
          ),
        ],
      ),
    );

    if (sent != true || !mounted) return;

    final message = messageController.text.trim();
    if (message.isEmpty) return;

    final notificationService = context.read<NotificationService>();
    int count = 0;

    for (final booking in _bookings) {
      if (booking.status == 'confirmed' && booking.userId != event?.ownerId) {
        await notificationService.saveLocal(
          uid: booking.userId,
          title: 'Message from $eventTitle',
          body: message,
          type: 'event_update',
          targetId: widget.eventId,
        );
        count++;
      }
    }

    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Message sent to $count attendees.')),
    );
  }

  void _openScanner() {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => QrScannerScreen(eventId: widget.eventId),
      ),
    );
  }

  Future<void> _endEvent() async {
    final thankYouController = TextEditingController(
      text: 'Thank you for celebrating with us.',
    );

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('End this event?'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'This will mark the event as completed, make the chat read-only, '
              'and send thank-you messages to checked-in attendees.',
            ),
            const SizedBox(height: 16),
            TextField(
              controller: thankYouController,
              textCapitalization: TextCapitalization.sentences,
              maxLines: 3,
              decoration: InputDecoration(
                labelText: 'Thank-you message',
                hintStyle: const TextStyle(color: AppColors.textMuted),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: const BorderSide(color: AppColors.border),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: const BorderSide(color: AppColors.border),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide:
                      const BorderSide(color: AppColors.accent, width: 1.5),
                ),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('End event'),
          ),
        ],
      ),
    );

    if (confirmed != true || !mounted) return;

    final thankYouMessage = thankYouController.text.trim();
    try {
      await context.read<EventService>().endEvent(
            widget.eventId,
            thankYouMessage.isEmpty
                ? 'Thank you for celebrating with us.'
                : thankYouMessage,
          );
      _load();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Event ended. Thank-you messages sent.')),
      );
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Could not end event: $error')),
      );
    }
  }

  void _openAnalytics() {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => EventAnalyticsScreen(eventId: widget.eventId),
      ),
    );
  }

  List<Booking> get _filteredBookings {
    var list = _bookings;

    // Status filter
    switch (_attendeeFilter) {
      case 'checked_in':
        list = list.where((b) => b.checkedIn).toList();
        break;
      case 'not_checked_in':
        list = list.where((b) => !b.checkedIn && b.status != 'cancelled').toList();
        break;
      case 'cancelled':
        list = list.where((b) => b.status == 'cancelled').toList();
        break;
    }

    // Name search
    if (_attendeeSearchQuery.isNotEmpty) {
      final q = _attendeeSearchQuery.toLowerCase();
      list = list.where((b) {
        // Match against seat number or status
        if (b.seatNumber.toLowerCase().contains(q)) return true;
        if (b.status.toLowerCase().contains(q)) return true;
        return false;
      }).toList();
    }

    return list;
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(
        body: Center(
          child: SizedBox(
            width: 24,
            height: 24,
            child: CircularProgressIndicator(strokeWidth: 2),
          ),
        ),
      );
    }
    final event = _event;
    if (event == null) {
      return Scaffold(
        appBar: AppBar(),
        body: const Center(child: Text('Event not found.')),
      );
    }

    final dateLabel = DateFormat('EEE, d MMMM yyyy').format(event.date);
    final priceLabel = event.isFree
        ? 'Free'
        : 'From GHS ${event.cheapestPrice.toStringAsFixed(0)}';
    final isTerminal =
        event.status == 'cancelled' || event.status == 'completed';
    final checkedInCount =
        _bookings.where((b) => b.checkedIn).length;
    final uid = context.read<AuthService>().currentUid ?? '';
    final isOwner = event.ownerId == uid;
    final isCollaborator =
        !isOwner && event.collaboratorIds.contains(uid);
    final canManage = isOwner || isCollaborator;

    return Scaffold(
      appBar: AppBar(title: const Text('Event details')),
      body: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(16),
            child: SizedBox(
              height: 180,
              width: double.infinity,
              child: event.coverImageUrl.isNotEmpty
                  ? (event.coverImageUrl.startsWith('http')
                      ? Image.network(
                          event.coverImageUrl,
                          fit: BoxFit.cover,
                          errorBuilder: (_, __, ___) => const _FallbackCover(),
                        )
                      : Image.file(
                          File(event.coverImageUrl),
                          fit: BoxFit.cover,
                          errorBuilder: (_, __, ___) => const _FallbackCover(),
                        ))
                  : const _FallbackCover(),
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: Text(
                  event.title,
                  style: const TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                    color: AppColors.textPrimary,
                    letterSpacing: -0.3,
                  ),
                ),
              ),
              const SizedBox(width: 10),
              StatusTag(status: event.status),
            ],
          ),
          const SizedBox(height: 14),
          _InfoRow(icon: Icons.category_outlined, text: _capitalize(event.category)),
          const SizedBox(height: 10),
          _InfoRow(icon: Icons.calendar_today_outlined, text: dateLabel),
          const SizedBox(height: 10),
          _InfoRow(icon: Icons.location_on_outlined, text: event.venue),
          const SizedBox(height: 10),
          _InfoRow(icon: Icons.confirmation_number_outlined, text: priceLabel),
          if (event.ticketTypes.isNotEmpty) ...[
            const SizedBox(height: 20),
            const Text(
              'Tickets',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w700,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 10),
            for (final ticket in event.ticketTypes)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  decoration: BoxDecoration(
                    color: AppColors.card,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppColors.border, width: 1),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(ticket.name,
                            style: const TextStyle(
                                fontWeight: FontWeight.w600,
                                color: AppColors.textPrimary)),
                      ),
                      Text(
                        ticket.price == 0
                            ? 'Free'
                            : 'GHS ${ticket.price.toStringAsFixed(2)}',
                        style: const TextStyle(
                            color: AppColors.accent,
                            fontWeight: FontWeight.w700),
                      ),
                    ],
                  ),
                ),
              ),
          ],
          const SizedBox(height: 24),
          // Action buttons
          if (canManage) ...[
            PrimaryButton(
              label: 'Edit event',
              icon: Icons.edit_outlined,
              onPressed: _openEdit,
            ),
            const SizedBox(height: 12),
            PrimaryButton(
              label: 'Duplicate event',
              icon: Icons.copy_outlined,
              onPressed: () {
                () async {
                  final uid = context.read<AuthService>().currentUid ?? '';
                  try {
                    final newId = await context.read<EventService>().duplicateEvent(widget.eventId, uid);
                    final dup = await context.read<EventService>().getEvent(newId);
                    if (!context.mounted) return;
                    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Event duplicated — pending review.')));
                    Navigator.of(context).push(MaterialPageRoute(builder: (_) => CreateEventScreen(initial: dup)));
                  } catch (e) {
                    if (!context.mounted) return;
                    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Could not duplicate: $e')));
                  }
                }();
              },
            ),
            const SizedBox(height: 12),
            PrimaryButton(
              label: 'Discount codes',
              icon: Icons.local_offer_outlined,
              onPressed: () {
                Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) =>
                        DiscountCodesScreen(eventId: widget.eventId),
                  ),
                );
              },
            ),
            const SizedBox(height: 12),
            PrimaryButton(
              label: 'Refund requests',
              icon: Icons.replay_outlined,
              onPressed: () {
                Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => const RefundRequestsScreen(),
                  ),
                );
              },
            ),
            const SizedBox(height: 12),
          ],
          if (canManage && event.status == 'published' && !event.isCurrentlyFeatured) ...[
            PrimaryButton(
              label: 'Boost this event',
              icon: Icons.rocket_launch_outlined,
              onPressed: () async {
                final boosted = await Navigator.of(context).push<bool>(
                  MaterialPageRoute(
                    builder: (_) => BoostEventScreen(event: event),
                  ),
                );
                if (boosted == true) _load();
              },
            ),
            const SizedBox(height: 12),
          ],
          if (event.isCurrentlyFeatured) ...[
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: BoxDecoration(
                color: AppColors.accent.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                    color: AppColors.accent.withValues(alpha: 0.3)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.star_outline,
                      size: 18, color: AppColors.accent),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'Featured until ${event.featuredUntil != null ? event.featuredUntil!.substring(0, 10) : '—'}',
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: AppColors.accent,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
          ],
          if (canManage && !isTerminal)
            PrimaryButton(
              label: 'Scan tickets',
              icon: Icons.qr_code_scanner,
              onPressed: _openScanner,
            ),
          const SizedBox(height: 12),
          if (canManage && !isTerminal)
            SizedBox(
              width: double.infinity,
              child: OutlinedButton(
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.danger,
                  side: const BorderSide(color: AppColors.danger),
                ),
                onPressed: _cancelling ? null : _cancelEvent,
                child: Text(_cancelling ? 'Cancelling…' : 'Cancel event'),
              ),
            ),
          if (canManage &&
              event.date.isBefore(DateTime.now()) &&
              event.status == 'published') ...[
            const SizedBox(height: 12),
            PrimaryButton(
              label: 'End event',
              icon: Icons.flag_outlined,
              onPressed: _endEvent,
            ),
          ],
          if (canManage && event.status == 'completed') ...[
            const SizedBox(height: 12),
            PrimaryButton(
              label: 'View analytics',
              icon: Icons.analytics_outlined,
              onPressed: _openAnalytics,
            ),
          ],
          const SizedBox(height: 28),
          // Live attendee list
          Row(
            children: [
              const Text(
                'Attendees',
                style: TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textPrimary,
                ),
              ),
              const Spacer(),
              if (_bookings.isNotEmpty)
                Text(
                  '$checkedInCount/${_bookings.length} checked in',
                  style: const TextStyle(
                      fontSize: 13, color: AppColors.textMuted),
                ),
            ],
          ),
          const SizedBox(height: 10),
          if (_bookings.isNotEmpty) ...[
            // Search field
            TextField(
              controller: _attendeeSearchController,
              textCapitalization: TextCapitalization.words,
              decoration: InputDecoration(
                hintText: 'Search attendees...',
                hintStyle: const TextStyle(color: AppColors.textMuted, fontSize: 14),
                prefixIcon: const Icon(Icons.search, size: 20),
                contentPadding: const EdgeInsets.symmetric(
                    horizontal: 16, vertical: 12),
                filled: true,
                fillColor: AppColors.card,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: const BorderSide(color: AppColors.border),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: const BorderSide(color: AppColors.border),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide:
                      const BorderSide(color: AppColors.accent, width: 1.5),
                ),
              ),
              onChanged: (v) => setState(() => _attendeeSearchQuery = v),
            ),
            const SizedBox(height: 10),
            // Status filter chips
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  _FilterChip(
                    label: 'All',
                    selected: _attendeeFilter == 'all',
                    onTap: () => setState(() => _attendeeFilter = 'all'),
                  ),
                  const SizedBox(width: 8),
                  _FilterChip(
                    label: 'Checked in',
                    selected: _attendeeFilter == 'checked_in',
                    onTap: () => setState(() => _attendeeFilter = 'checked_in'),
                  ),
                  const SizedBox(width: 8),
                  _FilterChip(
                    label: 'Not checked in',
                    selected: _attendeeFilter == 'not_checked_in',
                    onTap: () => setState(() => _attendeeFilter = 'not_checked_in'),
                  ),
                  const SizedBox(width: 8),
                  _FilterChip(
                    label: 'Cancelled',
                    selected: _attendeeFilter == 'cancelled',
                    onTap: () => setState(() => _attendeeFilter = 'cancelled'),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 10),
          ],
          if (_bookings.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 12),
              child: Text('No RSVPs yet.',
                  style: TextStyle(color: AppColors.textMuted)),
            )
          else if (_filteredBookings.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 12),
              child: Text('No attendees match your filter.',
                  style: TextStyle(color: AppColors.textMuted)),
            )
          else
            for (final booking in _filteredBookings)
              _AttendeeRow(booking: booking, eventId: widget.eventId),
          const SizedBox(height: 24),
          Row(
            children: [
              const Text('Guest list', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
              const Spacer(),
              Text('${_guests.length} contact${_guests.length == 1 ? '' : 's'}', style: const TextStyle(color: AppColors.textMuted)),
            ],
          ),
          const SizedBox(height: 10),
          if (_guests.isEmpty)
            const Padding(padding: EdgeInsets.symmetric(vertical: 12), child: Text('No guests added yet.', style: TextStyle(color: AppColors.textMuted)))
          else
            for (final entry in _guests)
              Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.border, width: 1)),
                  child: Row(
                    children: [
                      Container(
                        width: 40,
                        height: 40,
                        decoration: BoxDecoration(
                          color: AppColors.skeleton,
                          shape: BoxShape.circle,
                          image: entry.avatarUrl.isNotEmpty
                              ? DecorationImage(image: entry.avatarUrl.startsWith('http') ? NetworkImage(entry.avatarUrl) as ImageProvider : FileImage(File(entry.avatarUrl)), fit: BoxFit.cover)
                              : null,
                        ),
                        child: entry.avatarUrl.isEmpty
                            ? Center(child: Text(entry.name.isEmpty ? '?' : entry.name[0].toUpperCase(), style: const TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w700)))
                            : null,
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Row(
                            children: [
                              Expanded(child: Text(entry.name, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14))),
                              if (entry.role.isNotEmpty)
                                Container(padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2), decoration: BoxDecoration(color: AppColors.accent.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(6)), child: Text(entry.role, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.accent))),
                            ],
                          ),
                          if (entry.phone.isNotEmpty) Text(entry.phone, style: const TextStyle(fontSize: 12, color: AppColors.textMuted)),
                        ]),
                      ),
                    ],
                  ),
                ),
              ),
          const SizedBox(height: 24),
          // Post update
          if (isOwner) ...[
            const Text(
              'Post update',
              style: TextStyle(
                fontSize: 17,
                fontWeight: FontWeight.w700,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _postController,
                    textCapitalization: TextCapitalization.sentences,
                    decoration: InputDecoration(
                      hintText: 'Share an update with attendees...',
                      hintStyle: const TextStyle(
                          color: AppColors.textMuted, fontSize: 14),
                      contentPadding: const EdgeInsets.symmetric(
                          horizontal: 16, vertical: 12),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: const BorderSide(color: AppColors.border),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: const BorderSide(color: AppColors.border),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: const BorderSide(
                            color: AppColors.accent, width: 1.5),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                GestureDetector(
                  onTap: _postUpdate,
                  child: Container(
                    width: 44,
                    height: 44,
                    decoration: const BoxDecoration(
                      color: AppColors.primary,
                      borderRadius: BorderRadius.all(Radius.circular(12)),
                    ),
                    child: const Icon(Icons.send, color: Colors.white, size: 20),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            // Message all attendees button
            PrimaryButton(
              label: 'Message all attendees',
              icon: Icons.mail_outline,
              onPressed: _bookings.isNotEmpty ? _messageAllAttendees : null,
            ),
            const SizedBox(height: 24),
          ],
          // Team section
          if (isOwner) ...[
            _TeamSection(
              eventId: widget.eventId,
              event: event,
              onReload: _load,
            ),
            const SizedBox(height: 24),
          ],
        ],
      ),
    );
  }

  String _capitalize(String value) {
    if (value.isEmpty) return value;
    return value[0].toUpperCase() + value.substring(1);
  }
}

class _AttendeeRow extends StatelessWidget {
  const _AttendeeRow({required this.booking, required this.eventId});

  final Booking booking;
  final String eventId;

  @override
  Widget build(BuildContext context) {
    final seatLabel =
        booking.seatNumber.isEmpty ? 'RSVP' : booking.seatNumber;
    final isActive = booking.status == 'confirmed';

    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.border, width: 1),
        ),
        child: Row(
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: booking.checkedIn
                    ? AppColors.successBg
                    : booking.status == 'cancelled'
                        ? AppColors.dangerBg
                        : AppColors.skeleton,
                shape: BoxShape.circle,
              ),
              child: Icon(
                booking.checkedIn
                    ? Icons.check
                    : booking.status == 'cancelled'
                        ? Icons.close
                        : Icons.person_outline,
                size: 18,
                color: booking.checkedIn
                    ? AppColors.success
                    : booking.status == 'cancelled'
                        ? AppColors.danger
                        : AppColors.textMuted,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    seatLabel,
                    style: const TextStyle(
                        fontWeight: FontWeight.w600, fontSize: 14),
                  ),
                  Text(
                    booking.checkedIn
                        ? 'Checked in'
                        : booking.status == 'cancelled'
                            ? 'Cancelled'
                            : booking.status,
                    style: TextStyle(
                      fontSize: 12,
                      color: booking.checkedIn
                          ? AppColors.success
                          : booking.status == 'cancelled'
                              ? AppColors.danger
                              : AppColors.textMuted,
                    ),
                  ),
                ],
              ),
            ),
            if (isActive)
              GestureDetector(
                onTap: () => _cancelAttendee(context),
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppColors.dangerBg,
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: const Text(
                    'Remove',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: AppColors.danger,
                    ),
                  ),
                ),
              )
            else if (booking.checkedIn)
              const Icon(Icons.check_circle,
                  color: AppColors.success, size: 18)
            else if (booking.status == 'cancelled')
              const Icon(Icons.cancel_outlined,
                  color: AppColors.danger, size: 18)
            else
              const Icon(Icons.cancel_outlined,
                  color: AppColors.textMuted, size: 18),
          ],
        ),
      ),
    );
  }

  Future<void> _cancelAttendee(BuildContext context) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Remove attendee?'),
        content: const Text(
          'This will cancel their booking and free up their spot. '
          'The next person on the waitlist (if any) will be notified.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Keep'),
          ),
          ElevatedButton(
            style:
                ElevatedButton.styleFrom(backgroundColor: AppColors.danger),
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Remove'),
          ),
        ],
      ),
    );

    if (confirmed != true || !context.mounted) return;

    try {
      final regService = context.read<RegistrationService>();
      await regService.cancelBooking(booking.id, byOrganizer: true);
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Attendee removed.')),
      );
    } catch (error) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Could not remove: $error')),
      );
    }
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
          child: Text(
            text,
            style: const TextStyle(fontSize: 14, color: AppColors.textPrimary),
          ),
        ),
      ],
    );
  }
}

class _FallbackCover extends StatelessWidget {
  const _FallbackCover();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      color: AppColors.skeleton,
      child: const Center(
        child: Icon(Icons.event_outlined, color: AppColors.textMuted, size: 48),
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: selected ? AppColors.textPrimary : AppColors.card,
          borderRadius: BorderRadius.circular(100),
          border: Border.all(
            color: selected ? AppColors.textPrimary : AppColors.border,
            width: 1,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: selected ? Colors.white : AppColors.textPrimary,
            fontWeight: FontWeight.w600,
            fontSize: 13,
          ),
        ),
      ),
    );
  }
}

class _TeamSection extends StatelessWidget {
  const _TeamSection({
    required this.eventId,
    required this.event,
    required this.onReload,
  });

  final String eventId;
  final Event event;
  final VoidCallback onReload;

  @override
  Widget build(BuildContext context) {
    final collabIds = event.collaboratorIds;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const Text(
              'Team',
              style: TextStyle(
                fontSize: 17,
                fontWeight: FontWeight.w700,
                color: AppColors.textPrimary,
              ),
            ),
            const Spacer(),
            GestureDetector(
              onTap: () => _addCollaborator(context),
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: AppColors.accent.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.person_add_outlined,
                        size: 16, color: AppColors.accent),
                    SizedBox(width: 4),
                    Text(
                      'Add',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: AppColors.accent,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        if (collabIds.isEmpty)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 12),
            child: Text(
              'No collaborators added yet.',
              style: TextStyle(color: AppColors.textMuted),
            ),
          )
        else
          for (final collabId in collabIds)
            _CollaboratorRow(
              userId: collabId,
              eventId: eventId,
              onRemoved: onReload,
            ),
      ],
    );
  }

  Future<void> _addCollaborator(BuildContext context) async {
    final controller = TextEditingController();
    final added = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Add collaborator'),
        content: TextField(
          controller: controller,
          textCapitalization: TextCapitalization.words,
          decoration: InputDecoration(
            hintText: 'Enter user name or id',
            hintStyle: const TextStyle(color: AppColors.textMuted),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: AppColors.border),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: AppColors.border),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide:
                  const BorderSide(color: AppColors.accent, width: 1.5),
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Add'),
          ),
        ],
      ),
    );

    if (added != true || !context.mounted) return;

    final input = controller.text.trim();
    if (input.isEmpty) return;

    final eventService = context.read<EventService>();
    await eventService.addCollaborator(eventId, input);
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Collaborator added.')),
    );
    onReload();
  }
}

class _CollaboratorRow extends StatelessWidget {
  const _CollaboratorRow({
    required this.userId,
    required this.eventId,
    required this.onRemoved,
  });

  final String userId;
  final String eventId;
  final VoidCallback onRemoved;

  @override
  Widget build(BuildContext context) {
    final authService = context.read<AuthService>();

    return FutureBuilder<Map<String, dynamic>?>(
      future: authService.fetchUserProfile(userId),
      builder: (context, snapshot) {
        final profile = snapshot.data;
        final name = profile?['name'] as String? ?? userId;
        final initial = name.isEmpty ? '?' : name[0].toUpperCase();

        return Padding(
          padding: const EdgeInsets.only(bottom: 6),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: AppColors.card,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.border, width: 1),
            ),
            child: Row(
              children: [
                Container(
                  width: 36,
                  height: 36,
                  decoration: const BoxDecoration(
                    color: AppColors.skeleton,
                    shape: BoxShape.circle,
                  ),
                  child: Center(
                    child: Text(
                      initial,
                      style: const TextStyle(
                        color: AppColors.textPrimary,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(name,
                          style: const TextStyle(
                              fontWeight: FontWeight.w600, fontSize: 14)),
                      const Text('Collaborator',
                          style: TextStyle(
                              fontSize: 12, color: AppColors.textMuted)),
                    ],
                  ),
                ),
                GestureDetector(
                  onTap: () => _remove(context),
                  child: Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: AppColors.dangerBg,
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: const Text(
                      'Remove',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: AppColors.danger,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Future<void> _remove(BuildContext context) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Remove collaborator?'),
        content: const Text('They will lose access to manage this event.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Keep'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.danger),
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Remove'),
          ),
        ],
      ),
    );

    if (confirmed != true || !context.mounted) return;

    await context.read<EventService>().removeCollaborator(eventId, userId);
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Collaborator removed.')),
    );
    onRemoved();
  }
}

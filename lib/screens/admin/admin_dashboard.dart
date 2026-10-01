import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:intl/intl.dart';
import 'package:iconsax_plus/iconsax_plus.dart';
import 'package:provider/provider.dart';

import '../../models/event_model.dart';
import '../../models/report_model.dart';
import '../../routes/app_router.dart';
import '../../services/auth_service.dart';
import '../../services/event_service.dart';
import '../../services/local_db.dart';
import '../../services/report_service.dart';
import '../../theme/app_colors.dart';
import '../../widgets/shimmer_skeleton.dart';
import '../../widgets/status_tag.dart';
import 'event_review.dart';

class AdminDashboardScreen extends StatefulWidget {
  const AdminDashboardScreen({super.key});

  @override
  State<AdminDashboardScreen> createState() => _AdminDashboardScreenState();
}

class _AdminDashboardScreenState extends State<AdminDashboardScreen> {
  int _index = 0;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(
        index: _index,
        children: [
          const _DashboardView(),
          const _EventsView(),
          const _UsersView(),
          const _ReportsView(),
          _AdminSettingsView(),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (value) => setState(() => _index = value),
        destinations: const [
          NavigationDestination(
            icon: Icon(IconsaxPlusLinear.home_2),
            selectedIcon: Icon(IconsaxPlusBold.home_2),
            label: 'Home',
          ),
          NavigationDestination(
            icon: Icon(IconsaxPlusLinear.calendar_2),
            selectedIcon: Icon(IconsaxPlusBold.calendar_2),
            label: 'Events',
          ),
          NavigationDestination(
            icon: Icon(IconsaxPlusLinear.people),
            selectedIcon: Icon(IconsaxPlusBold.people),
            label: 'Users',
          ),
          NavigationDestination(
            icon: Icon(IconsaxPlusLinear.danger),
            selectedIcon: Icon(IconsaxPlusBold.danger),
            label: 'Reports',
          ),
          NavigationDestination(
            icon: Icon(IconsaxPlusLinear.setting_2),
            selectedIcon: Icon(IconsaxPlusBold.setting_2),
            label: 'Settings',
          ),
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD — Real platform stats
// ═══════════════════════════════════════════════════════════════════════════════

class _DashboardView extends StatelessWidget {
  const _DashboardView();

  @override
  Widget build(BuildContext context) {
    final db = LocalStore.instance;
    final eventService = context.read<EventService>();

    return Scaffold(
      appBar: AppBar(title: const Text('Admin Dashboard')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          // ─── Platform stats ────────────────────────────────────────
          StreamBuilder<List<Event>>(
            stream: eventService.publishedEventsFeed(),
            builder: (context, eventSnap) {
              final allEvents = eventSnap.data ?? [];
              final pending = allEvents.where((e) => e.status == 'pending_review').length;
              final published = allEvents.where((e) => e.status == 'published').length;

              return StreamBuilder<List<Map<String, dynamic>>>(
                stream: LocalStore.watchBox(db.users).map((items) =>
                    items.map((e) => e.$2).toList()),
                builder: (context, userSnap) {
                  final users = userSnap.data ?? [];
                  final organizers = users
                      .where((u) =>
                          (u['roles'] as List? ?? const []).contains('organizer'))
                      .length;
                  final attendees = users
                      .where((u) =>
                          (u['roles'] as List? ?? const []).contains('attendee'))
                      .length;

                  return StreamBuilder<List<Map<String, dynamic>>>(
                    stream: LocalStore.watchBox(db.bookings).map((items) =>
                        items.map((e) => e.$2).toList()),
                    builder: (context, bookingSnap) {
                      final bookings = bookingSnap.data ?? [];
                      final confirmed =
                          bookings.where((b) => b['status'] == 'confirmed').length;

                      // Estimate revenue from confirmed bookings
                      double revenue = 0;
                      for (final b in bookings) {
                        if (b['status'] != 'confirmed') continue;
                        final regId = b['regId'] as String?;
                        if (regId == null) continue;
                        final reg = LocalStore.readDoc(db.registrations, regId);
                        if (reg == null) continue;
                        final ticketType = reg['ticketType'] as String? ?? '';
                        final eventId = b['eventId'] as String?;
                        if (eventId == null) continue;
                        final event = LocalStore.readDoc(db.events, eventId);
                        if (event == null) continue;
                        final tickets = event['ticketTypes'] as List? ?? const [];
                        for (final t in tickets) {
                          final ticket = Map<String, dynamic>.from(t as Map);
                          if ((ticket['name'] as String?) == ticketType) {
                            revenue += (ticket['price'] as num?)?.toDouble() ?? 0;
                            break;
                          }
                        }
                      }

                      return Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Stats grid
                          Row(
                            children: [
                              _StatTile(
                                  label: 'Events',
                                  value: '${allEvents.length}',
                                  icon: Icons.event_outlined,
                                  color: AppColors.accent),
                              const SizedBox(width: 10),
                              _StatTile(
                                  label: 'Users',
                                  value: '${users.length}',
                                  icon: Icons.people_outline,
                                  color: AppColors.primary),
                            ],
                          ),
                          const SizedBox(height: 10),
                          Row(
                            children: [
                              _StatTile(
                                  label: 'Bookings',
                                  value: '$confirmed',
                                  icon: Icons.confirmation_number_outlined,
                                  color: AppColors.success),
                              const SizedBox(width: 10),
                              _StatTile(
                                  label: 'Revenue',
                                  value: 'GHS ${revenue.toStringAsFixed(0)}',
                                  icon: Icons.payments_outlined,
                                  color: AppColors.warning),
                            ],
                          ),
                          const SizedBox(height: 10),
                          Row(
                            children: [
                              _StatTile(
                                  label: 'Organizers',
                                  value: '$organizers',
                                  icon: Icons.campaign_outlined,
                                  color: AppColors.accent),
                              const SizedBox(width: 10),
                              _StatTile(
                                  label: 'Attendees',
                                  value: '$attendees',
                                  icon: Icons.person_outline,
                                  color: AppColors.textMuted),
                            ],
                          ),
                          const SizedBox(height: 28),

                          // ─── Event status breakdown ─────────────────
                          const Text(
                            'Event Status',
                            style: TextStyle(
                              fontSize: 17,
                              fontWeight: FontWeight.w800,
                              color: AppColors.textPrimary,
                            ),
                          ),
                          const SizedBox(height: 12),
                          _StatusBreakdown(
                            items: [
                              _StatusItem('Published', published, AppColors.success),
                              _StatusItem('Pending', pending, AppColors.warning),
                              _StatusItem(
                                  'Rejected',
                                  allEvents
                                      .where((e) => e.status == 'rejected')
                                      .length,
                                  AppColors.danger),
                              _StatusItem(
                                  'Completed',
                                  allEvents
                                      .where((e) => e.status == 'completed')
                                      .length,
                                  AppColors.textMuted),
                            ],
                          ),
                          const SizedBox(height: 28),

                          // ─── Recent bookings ───────────────────────
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              const Text(
                                'Recent bookings',
                                style: TextStyle(
                                  fontSize: 17,
                                  fontWeight: FontWeight.w800,
                                  color: AppColors.textPrimary,
                                ),
                              ),
                              Text(
                                '$confirmed total',
                                style: const TextStyle(
                                    fontSize: 13, color: AppColors.textMuted),
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),
                          if (bookings.isEmpty)
                            const Text(
                              'No bookings yet.',
                              style: TextStyle(color: AppColors.textMuted),
                            )
                          else
                            ...bookings.take(5).map((b) {
                              final userId = b['userId'] as String? ?? '';
                              final user =
                                  LocalStore.readDoc(db.users, userId);
                              final userName =
                                  user?['name'] as String? ?? 'Unknown';
                              final eventId = b['eventId'] as String? ?? '';
                              final event =
                                  LocalStore.readDoc(db.events, eventId);
                              final eventTitle =
                                  event?['title'] as String? ?? 'Event';
                              final status = b['status'] as String? ?? '';
                              final time = b['createdAt'] as String? ?? '';
                              final timeLabel = time.isNotEmpty
                                  ? DateFormat('d MMM, HH:mm').format(
                                      DateTime.tryParse(time) ??
                                          DateTime.now())
                                  : '';
                              return _ActivityRow(
                                icon: Icons.confirmation_number_outlined,
                                title: '$userName booked $eventTitle',
                                subtitle: timeLabel,
                                status: status,
                              );
                            }),
                        ],
                      );
                    },
                  );
                },
              );
            },
          ),
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// EVENTS — All events with status filter tabs
// ═══════════════════════════════════════════════════════════════════════════════

class _EventsView extends StatefulWidget {
  const _EventsView();

  @override
  State<_EventsView> createState() => _EventsViewState();
}

class _EventsViewState extends State<_EventsView>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  String _search = '';

  static const _statuses = ['All', 'Pending', 'Published', 'Rejected', 'Completed'];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: _statuses.length, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final db = LocalStore.instance;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Events'),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(96),
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                child: TextField(
                  onChanged: (v) => setState(() => _search = v.toLowerCase()),
                  decoration: InputDecoration(
                    hintText: 'Search events...',
                    prefixIcon: const Icon(Icons.search, size: 20),
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
                    contentPadding:
                        const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  ),
                ),
              ),
              TabBar(
                controller: _tabController,
                isScrollable: true,
                tabAlignment: TabAlignment.start,
                labelColor: AppColors.textPrimary,
                unselectedLabelColor: AppColors.textMuted,
                indicatorColor: AppColors.accent,
                indicatorWeight: 2,
                tabs: _statuses.map((s) => Tab(text: s)).toList(),
              ),
            ],
          ),
        ),
      ),
      body: StreamBuilder<List<Event>>(
        stream: LocalStore.watchBox(
          db.events,
          sort: (a, b) {
            final da = DateTime.tryParse(a['date'] as String? ?? '') ??
                DateTime.fromMillisecondsSinceEpoch(0);
            final db2 = DateTime.tryParse(b['date'] as String? ?? '') ??
                DateTime.fromMillisecondsSinceEpoch(0);
            return db2.compareTo(da);
          },
        ).map((items) =>
            items.map((e) => Event.fromMap(e.$1, e.$2)).toList()),
        builder: (context, snapshot) {
          if (!snapshot.hasData) {
            return Center(
              child: ShimmerSkeleton.box(width: 240, height: 240, radius: 14),
            );
          }
          var events = snapshot.data!;

          // Filter by tab
          final tabIndex = _tabController.index;
          if (tabIndex == 1) {
            events = events.where((e) => e.status == 'pending_review').toList();
          } else if (tabIndex == 2) {
            events = events.where((e) => e.status == 'published').toList();
          } else if (tabIndex == 3) {
            events = events.where((e) => e.status == 'rejected').toList();
          } else if (tabIndex == 4) {
            events = events.where((e) => e.status == 'completed').toList();
          }

          // Search filter
          if (_search.isNotEmpty) {
            events = events
                .where((e) =>
                    e.title.toLowerCase().contains(_search) ||
                    e.venue.toLowerCase().contains(_search) ||
                    e.category.toLowerCase().contains(_search))
                .toList();
          }

          if (events.isEmpty) {
            return const Center(
              child: Text('No events found.',
                  style: TextStyle(color: AppColors.textMuted)),
            );
          }

          return ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: events.length,
            separatorBuilder: (_, __) => const SizedBox(height: 8),
            itemBuilder: (context, index) =>
                _AdminEventRow(event: events[index])
                    .animate()
                    .fadeIn(
                      duration: 300.ms,
                      delay: Duration(milliseconds: 40 * index),
                    ),
          );
        },
      ),
    );
  }
}

class _AdminEventRow extends StatelessWidget {
  const _AdminEventRow({required this.event});
  final Event event;

  @override
  Widget build(BuildContext context) {
    final db = LocalStore.instance;
    final owner = LocalStore.readDoc(db.users, event.ownerId);
    final ownerName = owner?['name'] as String? ?? 'Unknown';

    final dateLabel = DateFormat('d MMM yyyy').format(event.date);

    return GestureDetector(
      onTap: () {
        Navigator.of(context).push(
          MaterialPageRoute(
            builder: (_) => EventReviewScreen(eventId: event.id),
          ),
        );
      },
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.border, width: 1),
        ),
        child: Row(
          children: [
            // Cover thumbnail
            Container(
              width: 52,
              height: 52,
              decoration: BoxDecoration(
                color: AppColors.skeleton,
                borderRadius: BorderRadius.circular(10),
              ),
              child: event.coverImageUrl.isNotEmpty
                  ? ClipRRect(
                      borderRadius: BorderRadius.circular(10),
                      child: event.coverImageUrl.startsWith('http')
                          ? Image.network(event.coverImageUrl,
                              fit: BoxFit.cover,
                              errorBuilder: (_, __, ___) =>
                                  const Icon(Icons.event_outlined,
                                      color: AppColors.textMuted))
                          : Image.file(File(event.coverImageUrl),
                              fit: BoxFit.cover,
                              errorBuilder: (_, __, ___) =>
                                  const Icon(Icons.event_outlined,
                                      color: AppColors.textMuted)),
                    )
                  : const Icon(Icons.event_outlined,
                      color: AppColors.textMuted, size: 24),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    event.title,
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
                    '$dateLabel · ${_capitalize(event.category)}',
                    style:
                        const TextStyle(fontSize: 12, color: AppColors.textMuted),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    'by $ownerName',
                    style:
                        const TextStyle(fontSize: 11, color: AppColors.textMuted),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            StatusTag(status: event.status, compact: true),
          ],
        ),
      ),
    );
  }

  String _capitalize(String v) =>
      v.isEmpty ? v : v[0].toUpperCase() + v.substring(1);
}

// ═══════════════════════════════════════════════════════════════════════════════
// USERS — Full management with role filter
// ═══════════════════════════════════════════════════════════════════════════════

class _UsersView extends StatefulWidget {
  const _UsersView();

  @override
  State<_UsersView> createState() => _UsersViewState();
}

class _UsersViewState extends State<_UsersView> {
  String _search = '';
  String _roleFilter = 'All';

  @override
  Widget build(BuildContext context) {
    final db = LocalStore.instance;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Users'),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(96),
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                child: TextField(
                  onChanged: (v) => setState(() => _search = v.toLowerCase()),
                  decoration: InputDecoration(
                    hintText: 'Search by name or email...',
                    prefixIcon: const Icon(Icons.search, size: 20),
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
                    contentPadding:
                        const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  ),
                ),
              ),
              SizedBox(
                height: 36,
                child: ListView(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  children: ['All', 'Admin', 'Organizer', 'Attendee']
                      .map((role) => Padding(
                            padding: const EdgeInsets.only(right: 8),
                            child: ChoiceChip(
                              label: Text(role),
                              selected: _roleFilter == role,
                              onSelected: (_) =>
                                  setState(() => _roleFilter = role),
                              selectedColor: AppColors.accent,
                              labelStyle: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                color: _roleFilter == role
                                    ? Colors.white
                                    : AppColors.textPrimary,
                              ),
                              side: BorderSide(
                                color: _roleFilter == role
                                    ? AppColors.accent
                                    : AppColors.border,
                              ),
                            ),
                          ))
                      .toList(),
                ),
              ),
            ],
          ),
        ),
      ),
      body: StreamBuilder<List<Map<String, dynamic>>>(
        stream: LocalStore.watchBox(db.users).map(
            (items) => items.map((e) => e.$2).toList()),
        builder: (context, snapshot) {
          if (!snapshot.hasData) {
            return Center(
              child: ShimmerSkeleton.box(width: 240, height: 300, radius: 14),
            );
          }
          var users = snapshot.data!;

          // Role filter
          if (_roleFilter != 'All') {
            final role = _roleFilter.toLowerCase();
            users = users
                .where((u) =>
                    (u['roles'] as List? ?? const []).contains(role))
                .toList();
          }

          // Search filter
          if (_search.isNotEmpty) {
            users = users
                .where((u) =>
                    (u['name'] as String? ?? '').toLowerCase().contains(_search) ||
                    (u['email'] as String? ?? '').toLowerCase().contains(_search))
                .toList();
          }

          if (users.isEmpty) {
            return const Center(
              child: Text('No users found.',
                  style: TextStyle(color: AppColors.textMuted)),
            );
          }

          return ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: users.length,
            separatorBuilder: (_, __) => const SizedBox(height: 8),
            itemBuilder: (context, index) =>
                _AdminUserRow(user: users[index])
                    .animate()
                    .fadeIn(
                      duration: 300.ms,
                      delay: Duration(milliseconds: 40 * index),
                    ),
          );
        },
      ),
    );
  }
}

class _AdminUserRow extends StatefulWidget {
  const _AdminUserRow({required this.user});
  final Map<String, dynamic> user;

  @override
  State<_AdminUserRow> createState() => _AdminUserRowState();
}

class _AdminUserRowState extends State<_AdminUserRow> {
  @override
  Widget build(BuildContext context) {
    final user = widget.user;
    final uid = user['uid'] as String? ?? '';
    final name = user['name'] as String? ?? 'Unknown';
    final email = user['email'] as String? ?? '';
    final roles = List<String>.from(user['roles'] as List? ?? const []);
    final suspended = user['suspended'] as bool? ?? false;
    final isOrganizer = roles.contains('organizer');
    final verified = user['verifiedOrganizer'] as bool? ?? false;
    final initial = name.isEmpty ? '?' : name[0].toUpperCase();

    // Count user's events or bookings
    final db = LocalStore.instance;
    int eventCount = 0;
    int bookingCount = 0;
    if (isOrganizer) {
      for (final e in db.events.toMap().entries) {
        final data = Map<String, dynamic>.from(e.value);
        if (data['ownerId'] == uid) eventCount++;
      }
    } else {
      for (final b in db.bookings.toMap().entries) {
        final data = Map<String, dynamic>.from(b.value);
        if (data['userId'] == uid) bookingCount++;
      }
    }

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: suspended ? AppColors.dangerBg : AppColors.card,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: suspended ? AppColors.danger.withValues(alpha: 0.3) : AppColors.border,
          width: 1,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              CircleAvatar(
                radius: 20,
                backgroundColor: AppColors.skeleton,
                backgroundImage: (user['avatarUrl'] as String?)?.isNotEmpty ==
                        true
                    ? FileImage(File(user['avatarUrl'] as String))
                    : null,
                child: (user['avatarUrl'] as String?)?.isNotEmpty != true
                    ? Text(
                        initial,
                        style: const TextStyle(
                          fontWeight: FontWeight.w700,
                          fontSize: 16,
                          color: AppColors.textPrimary,
                        ),
                      )
                    : null,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Flexible(
                          child: Text(
                            name,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontWeight: FontWeight.w700,
                              fontSize: 14,
                              color: AppColors.textPrimary,
                            ),
                          ),
                        ),
                        if (isOrganizer && verified) ...[
                          const SizedBox(width: 4),
                          const Icon(Icons.verified,
                              size: 14, color: AppColors.accent),
                        ],
                        if (suspended) ...[
                          const SizedBox(width: 4),
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 6, vertical: 1),
                            decoration: BoxDecoration(
                              color: AppColors.dangerBg,
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: const Text(
                              'Suspended',
                              style: TextStyle(
                                fontSize: 9,
                                fontWeight: FontWeight.w700,
                                color: AppColors.danger,
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                    const SizedBox(height: 2),
                    Text(email,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                            fontSize: 12, color: AppColors.textMuted)),
                    const SizedBox(height: 2),
                    Row(
                      children: [
                        // Role chips
                        for (final role in roles) ...[
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 6, vertical: 1),
                            decoration: BoxDecoration(
                              color: role == 'admin'
                                  ? AppColors.dangerBg
                                  : role == 'organizer'
                                      ? AppColors.accent.withValues(alpha: 0.1)
                                      : AppColors.neutralBg,
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: Text(
                              role,
                              style: TextStyle(
                                fontSize: 9,
                                fontWeight: FontWeight.w600,
                                color: role == 'admin'
                                    ? AppColors.danger
                                    : role == 'organizer'
                                        ? AppColors.accent
                                        : AppColors.textMuted,
                              ),
                            ),
                          ),
                          const SizedBox(width: 4),
                        ],
                        const Spacer(),
                        if (isOrganizer)
                          Text('$eventCount events',
                              style: const TextStyle(
                                  fontSize: 11, color: AppColors.textMuted))
                        else
                          Text('$bookingCount bookings',
                              style: const TextStyle(
                                  fontSize: 11, color: AppColors.textMuted)),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  style: OutlinedButton.styleFrom(
                    foregroundColor:
                        suspended ? AppColors.success : AppColors.danger,
                    side: BorderSide(
                        color: suspended ? AppColors.success : AppColors.danger),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(100)),
                    padding: const EdgeInsets.symmetric(vertical: 6),
                  ),
                  onPressed: () => _toggleSuspend(uid, !suspended),
                  child: Text(suspended ? 'Reinstate' : 'Suspend',
                      style: const TextStyle(
                          fontSize: 11, fontWeight: FontWeight.w700)),
                ),
              ),
              if (isOrganizer) ...[
                const SizedBox(width: 8),
                Expanded(
                  child: OutlinedButton(
                    style: OutlinedButton.styleFrom(
                      foregroundColor:
                          verified ? AppColors.accent : AppColors.textMuted,
                      side: BorderSide(
                          color: verified ? AppColors.accent : AppColors.border),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(100)),
                      padding: const EdgeInsets.symmetric(vertical: 6),
                    ),
                    onPressed: () => _toggleVerify(uid, !verified),
                    child: Text(verified ? 'Verified' : 'Verify',
                        style: const TextStyle(
                            fontSize: 11, fontWeight: FontWeight.w700)),
                  ),
                ),
              ],
              if (!isOrganizer) ...[
                const SizedBox(width: 8),
                Expanded(
                  child: OutlinedButton(
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.accent,
                      side: const BorderSide(color: AppColors.accent),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(100)),
                      padding: const EdgeInsets.symmetric(vertical: 6),
                    ),
                    onPressed: () => _addRole(uid, 'organizer'),
                    child: const Text('Make Organizer',
                        style: TextStyle(
                            fontSize: 11, fontWeight: FontWeight.w700)),
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }

  Future<void> _toggleSuspend(String uid, bool suspend) async {
    final db = LocalStore.instance;
    final profile = LocalStore.readDoc(db.users, uid);
    if (profile == null) return;
    await db.users.put(uid, {...profile, 'suspended': suspend});
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(suspend ? 'User suspended.' : 'User reinstated.')),
      );
    }
  }

  Future<void> _toggleVerify(String uid, bool verify) async {
    final db = LocalStore.instance;
    final profile = LocalStore.readDoc(db.users, uid);
    if (profile == null) return;
    await db.users.put(uid, {...profile, 'verifiedOrganizer': verify});
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
            content: Text(verify ? 'Organizer verified.' : 'Verification removed.')),
      );
    }
  }

  Future<void> _addRole(String uid, String role) async {
    final db = LocalStore.instance;
    final profile = LocalStore.readDoc(db.users, uid);
    if (profile == null) return;
    final roles = List<String>.from(profile['roles'] as List? ?? const []);
    if (!roles.contains(role)) roles.add(role);
    await db.users.put(uid, {...profile, 'roles': roles});
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Made $role.')),
      );
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// REPORTS — Moderation queue with filters
// ═══════════════════════════════════════════════════════════════════════════════

class _ReportsView extends StatefulWidget {
  const _ReportsView();

  @override
  State<_ReportsView> createState() => _ReportsViewState();
}

class _ReportsViewState extends State<_ReportsView> {
  String _statusFilter = 'Open';

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Reports'),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(48),
          child: Row(
            children: ['Open', 'Dismissed', 'Removed', 'All']
                .map((s) => Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 4),
                      child: ChoiceChip(
                        label: Text(s),
                        selected: _statusFilter == s,
                        onSelected: (_) => setState(() => _statusFilter = s),
                        selectedColor: AppColors.accent,
                        labelStyle: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: _statusFilter == s
                              ? Colors.white
                              : AppColors.textPrimary,
                        ),
                        side: BorderSide(
                          color: _statusFilter == s
                              ? AppColors.accent
                              : AppColors.border,
                        ),
                      ),
                    ))
                .toList(),
          ),
        ),
      ),
      body: StreamBuilder<List<Report>>(
        stream: context.read<ReportService>().openReports(),
        builder: (context, snapshot) {
          if (!snapshot.hasData) {
            return Center(
              child: ShimmerSkeleton.box(width: 240, height: 200, radius: 14),
            );
          }

          // Also get dismissed/removed reports
          final db = LocalStore.instance;
          final allReports = db.reports.toMap().entries.map((e) {
            return Report.fromMap(e.key, Map<String, dynamic>.from(e.value));
          }).toList();

          var reports = allReports;
          if (_statusFilter == 'Open') {
            reports = reports.where((r) => r.status == 'open').toList();
          } else if (_statusFilter == 'Dismissed') {
            reports = reports.where((r) => r.status == 'dismissed').toList();
          } else if (_statusFilter == 'Removed') {
            reports = reports.where((r) => r.status == 'removed').toList();
          }

          // Sort newest first
          reports.sort((a, b) => b.createdAt.compareTo(a.createdAt));

          if (reports.isEmpty) {
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
                    child: const Icon(Icons.flag_outlined,
                        size: 32, color: AppColors.textMuted),
                  ),
                  const SizedBox(height: 20),
                  Text(
                    'No $_statusFilter reports',
                    style: const TextStyle(
                      fontSize: 17,
                      fontWeight: FontWeight.w800,
                      color: AppColors.textPrimary,
                    ),
                  ),
                ],
              ),
            );
          }

          return ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: reports.length,
            separatorBuilder: (_, __) => const SizedBox(height: 8),
            itemBuilder: (context, index) =>
                _AdminReportRow(report: reports[index])
                    .animate()
                    .fadeIn(
                      duration: 300.ms,
                      delay: Duration(milliseconds: 40 * index),
                    ),
          );
        },
      ),
    );
  }
}

class _AdminReportRow extends StatefulWidget {
  const _AdminReportRow({required this.report});
  final Report report;

  @override
  State<_AdminReportRow> createState() => _AdminReportRowState();
}

class _AdminReportRowState extends State<_AdminReportRow> {
  String _targetLabel = '';
  String _reporterName = 'Unknown';

  @override
  void initState() {
    super.initState();
    _loadMetadata();
  }

  Future<void> _loadMetadata() async {
    final db = LocalStore.instance;
    final report = widget.report;
    if (report.targetType == 'post') {
      final post = LocalStore.readDoc(db.posts, report.targetId);
      _targetLabel = post?['text'] as String? ?? 'Deleted post';
    } else if (report.targetType == 'event') {
      final event = LocalStore.readDoc(db.events, report.targetId);
      _targetLabel = event?['title'] as String? ?? 'Deleted event';
    }
    final reporter = LocalStore.readDoc(db.users, report.reporterId);
    _reporterName = reporter?['name'] as String? ?? 'Unknown';
    if (mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final report = widget.report;
    final isOpen = report.status == 'open';

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border, width: 1),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: isOpen ? AppColors.warningBg : AppColors.neutralBg,
                  borderRadius: BorderRadius.circular(100),
                ),
                child: Text(
                  report.targetType.toUpperCase(),
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    color: isOpen ? AppColors.warning : AppColors.textMuted,
                  ),
                ),
              ),
              const SizedBox(width: 6),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: report.status == 'open'
                      ? AppColors.dangerBg
                      : report.status == 'removed'
                          ? AppColors.warningBg
                          : AppColors.neutralBg,
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  report.status.toUpperCase(),
                  style: TextStyle(
                    fontSize: 9,
                    fontWeight: FontWeight.w700,
                    color: report.status == 'open'
                        ? AppColors.danger
                        : report.status == 'removed'
                            ? AppColors.warning
                            : AppColors.textMuted,
                  ),
                ),
              ),
              const Spacer(),
              Text(
                'by $_reporterName',
                style:
                    const TextStyle(fontSize: 11, color: AppColors.textMuted),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            _targetLabel,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            '"${report.reason}"',
            style: const TextStyle(
              fontSize: 13,
              fontStyle: FontStyle.italic,
              color: AppColors.textMuted,
            ),
          ),
          if (isOpen) ...[
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.textMuted,
                      side: const BorderSide(color: AppColors.border),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(100)),
                      padding: const EdgeInsets.symmetric(vertical: 6),
                    ),
                    onPressed: () =>
                        context.read<ReportService>().dismissReport(report.id),
                    child: const Text('Dismiss',
                        style: TextStyle(
                            fontSize: 11, fontWeight: FontWeight.w700)),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: OutlinedButton(
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.danger,
                      side: const BorderSide(color: AppColors.danger),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(100)),
                      padding: const EdgeInsets.symmetric(vertical: 6),
                    ),
                    onPressed: () =>
                        context.read<ReportService>().removeContent(report.id),
                    child: const Text('Remove content',
                        style: TextStyle(
                            fontSize: 11, fontWeight: FontWeight.w700)),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SETTINGS — Admin profile + sign out
// ═══════════════════════════════════════════════════════════════════════════════

class _AdminSettingsView extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final authService = context.read<AuthService>();
    final uid = authService.currentUid ?? '';

    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: FutureBuilder<Map<String, dynamic>?>(
        future: authService.fetchUserProfile(uid),
        builder: (context, snapshot) {
          final profile = snapshot.data;
          final name = profile?['name'] as String? ?? 'Admin';
          final email = profile?['email'] as String? ?? '';
          final initial = name.isEmpty ? '?' : name[0].toUpperCase();

          return ListView(
            padding: const EdgeInsets.all(20),
            children: [
              // Admin profile
              Center(
                child: Column(
                  children: [
                    CircleAvatar(
                      radius: 36,
                      backgroundColor: AppColors.skeleton,
                      child: Text(
                        initial,
                        style: const TextStyle(
                          fontSize: 28,
                          fontWeight: FontWeight.w800,
                          color: AppColors.textPrimary,
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    Text(
                      name,
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      email,
                      style:
                          const TextStyle(fontSize: 13, color: AppColors.textMuted),
                    ),
                    const SizedBox(height: 4),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 10, vertical: 3),
                      decoration: BoxDecoration(
                        color: AppColors.dangerBg,
                        borderRadius: BorderRadius.circular(100),
                      ),
                      child: const Text(
                        'ADMIN',
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w800,
                          color: AppColors.danger,
                          letterSpacing: 0.5,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 32),

              // Platform info
              _SettingsSection(
                title: 'Platform',
                children: [
                  _SettingsRow(
                    icon: Icons.info_outline,
                    label: 'App version',
                    value: '1.0.0',
                  ),
                  _SettingsRow(
                    icon: Icons.storage_outlined,
                    label: 'Storage',
                    value: 'Local (Hive)',
                  ),
                ],
              ),
              const SizedBox(height: 24),

              // Sign out
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.danger,
                    side: const BorderSide(color: AppColors.danger),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                  ),
                  onPressed: () async {
                    await authService.signOut();
                    if (context.mounted) {
                      AppRouter.signOutAndNavigate(context);
                    }
                  },
                  icon: const Icon(Icons.logout, size: 18),
                  label: const Text('Sign out'),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Shared helper widgets
// ═══════════════════════════════════════════════════════════════════════════════

class _StatTile extends StatelessWidget {
  const _StatTile({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
  });

  final String label;
  final String value;
  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.border, width: 1),
        ),
        child: Row(
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, size: 18, color: color),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    value,
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  Text(
                    label,
                    style: const TextStyle(
                        fontSize: 11,
                        color: AppColors.textMuted,
                        fontWeight: FontWeight.w500),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _StatusBreakdown extends StatelessWidget {
  const _StatusBreakdown({required this.items});
  final List<_StatusItem> items;

  @override
  Widget build(BuildContext context) {
    final total = items.fold<int>(0, (sum, item) => sum + item.count);
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border, width: 1),
      ),
      child: Column(
        children: [
          // Bar
          if (total > 0)
            ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: SizedBox(
                height: 8,
                child: Row(
                  children: items
                      .where((i) => i.count > 0)
                      .map((i) => Expanded(
                            flex: i.count,
                            child: Container(color: i.color),
                          ))
                      .toList(),
                ),
              ),
            ),
          if (total > 0) const SizedBox(height: 12),
          // Legend
          Wrap(
            spacing: 16,
            runSpacing: 8,
            children: items
                .map((i) => Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          width: 10,
                          height: 10,
                          decoration: BoxDecoration(
                            color: i.color,
                            borderRadius: BorderRadius.circular(3),
                          ),
                        ),
                        const SizedBox(width: 6),
                        Text(
                          '${i.label} (${i.count})',
                          style: const TextStyle(
                              fontSize: 12, color: AppColors.textMuted),
                        ),
                      ],
                    ))
                .toList(),
          ),
        ],
      ),
    );
  }
}

class _StatusItem {
  final String label;
  final int count;
  final Color color;
  const _StatusItem(this.label, this.count, this.color);
}

class _ActivityRow extends StatelessWidget {
  const _ActivityRow({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.status,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final String status;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border, width: 1),
      ),
      child: Row(
        children: [
          Icon(icon, size: 18, color: AppColors.textMuted),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textPrimary,
                  ),
                ),
                if (subtitle.isNotEmpty)
                  Text(subtitle,
                      style: const TextStyle(
                          fontSize: 11, color: AppColors.textMuted)),
              ],
            ),
          ),
          StatusTag(status: status, compact: true),
        ],
      ),
    );
  }
}

class _SettingsSection extends StatelessWidget {
  const _SettingsSection({required this.title, required this.children});
  final String title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: const TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w700,
            color: AppColors.textMuted,
            letterSpacing: 0.3,
          ),
        ),
        const SizedBox(height: 10),
        Container(
          decoration: BoxDecoration(
            color: AppColors.card,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppColors.border, width: 1),
          ),
          child: Column(children: children),
        ),
      ],
    );
  }
}

class _SettingsRow extends StatelessWidget {
  const _SettingsRow({
    required this.icon,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      child: Row(
        children: [
          Icon(icon, size: 18, color: AppColors.textMuted),
          const SizedBox(width: 12),
          Expanded(
            child: Text(label,
                style:
                    const TextStyle(fontSize: 14, color: AppColors.textPrimary)),
          ),
          Text(value,
              style:
                  const TextStyle(fontSize: 13, color: AppColors.textMuted)),
        ],
      ),
    );
  }
}

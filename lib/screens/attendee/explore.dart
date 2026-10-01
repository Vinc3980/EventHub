import 'dart:io';
import 'dart:math' as math;
import 'dart:ui' show ImageFilter;

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:iconsax_plus/iconsax_plus.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../models/event_model.dart';
import '../../services/auth_service.dart';
import '../../services/event_service.dart';
import '../../theme/app_colors.dart';
import '../../theme/app_spacing.dart';
import '../../theme/app_theme.dart';
import '../../widgets/event_card.dart';
import '../../widgets/status_tag.dart';
import 'event_page.dart';

enum _SectionFocus { none, featured, weekend }

class ExploreScreen extends StatefulWidget {
  const ExploreScreen({super.key, this.initialCategory});

  final String? initialCategory;

  @override
  State<ExploreScreen> createState() => _ExploreScreenState();
}

class _ExploreScreenState extends State<ExploreScreen> {
  static const List<Map<String, String>> _categoryTabs = [
    {'value': 'wedding', 'label': 'Wedding'},
    {'value': 'funeral', 'label': 'Funeral'},
    {'value': 'corporate', 'label': 'Corporate'},
    {'value': 'social', 'label': 'Social'},
    {'value': 'All', 'label': 'All'},
  ];
  static const List<String> _regions = [
    'Greater Accra',
    'Ashanti',
    'Eastern',
    'Western',
    'Northern',
    'Volta',
    'Central',
  ];
  static const List<String> _sortOptions = [
    'Date (nearest)',
    'Date (furthest)',
    'Price (low)',
    'Price (high)',
    'A-Z',
  ];

  final _searchController = TextEditingController();
  String _category = 'All';
  String? _region;
  DateTime? _date;
  bool _freeOnly = false;
  String _sort = 'Date (nearest)';
  bool _nearbyOnly = false;
  double _nearbyRadiusKm = 25;
  static const double _userLat = 5.6037;
  static const double _userLng = -0.1870;
  List<String> _recentSearches = [];
  bool _showRecent = false;
  bool _isGridView = true;
  _SectionFocus _sectionFocus = _SectionFocus.none;

  @override
  void initState() {
    super.initState();
    if (widget.initialCategory != null) {
      _category = widget.initialCategory!;
    }
    _loadRecentSearches();
    _loadViewPreference();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadRecentSearches() async {
    final uid = context.read<AuthService>().currentUid ?? '';
    if (uid.isEmpty) return;
    final profile = await context.read<AuthService>().fetchUserProfile(uid);
    final searches = List<String>.from(
      profile?['recentSearches'] as List? ?? const [],
    );
    if (mounted) setState(() => _recentSearches = searches);
  }

  Future<void> _saveRecentSearch(String query) async {
    if (query.trim().isEmpty) return;
    final uid = context.read<AuthService>().currentUid ?? '';
    if (uid.isEmpty) return;
    final profile = await context.read<AuthService>().fetchUserProfile(uid);
    if (profile == null) return;
    final searches = List<String>.from(
      profile['recentSearches'] as List? ?? const [],
    );
    searches.remove(query);
    searches.insert(0, query);
    if (searches.length > 10) searches.removeRange(10, searches.length);
    final existing = await context.read<AuthService>().fetchUserProfile(uid);
    if (existing == null) return;
    await context.read<AuthService>().updateProfile(
          uid: uid,
          name: existing['name'] as String? ?? '',
        );
  }

  Future<void> _loadViewPreference() async {
    final uid = context.read<AuthService>().currentUid ?? '';
    if (uid.isEmpty) return;
    final profile = await context.read<AuthService>().fetchUserProfile(uid);
    final isGrid = profile?['exploreViewGrid'] as bool? ?? true;
    if (mounted) setState(() => _isGridView = isGrid);
  }

  Future<void> _toggleView() async {
    setState(() => _isGridView = !_isGridView);
    final uid = context.read<AuthService>().currentUid ?? '';
    if (uid.isEmpty) return;
    final existing = await context.read<AuthService>().fetchUserProfile(uid);
    if (existing == null) return;
    await context.read<AuthService>().updateProfile(
          uid: uid,
          name: existing['name'] as String? ?? '',
        );
  }

  double _distanceKm(double lat1, double lon1, double lat2, double lon2) {
    const r = 6371;
    final dLat = (lat2 - lat1) * math.pi / 180;
    final dLon = (lon2 - lon1) * math.pi / 180;
    final a = math.sin(dLat / 2) * math.sin(dLat / 2) +
        math.cos(lat1 * math.pi / 180) *
            math.cos(lat2 * math.pi / 180) *
            math.sin(dLon / 2) *
            math.sin(dLon / 2);
    return r * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a));
  }

  /// Whether [date] falls in this week's Friday–Sunday window.
  /// Before Friday: the coming Friday. On Fri–Sun: the current weekend.
  bool _isThisWeekend(DateTime date) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final friday = today.add(Duration(days: 5 - today.weekday));
    final monday = friday.add(const Duration(days: 3));
    return !date.isBefore(friday) && date.isBefore(monday);
  }

  List<Event> _filter(List<Event> events) {
    final query = _searchController.text.trim().toLowerCase();
    var result = events.where((event) {
      if (_category != 'All' && event.category != _category) return false;
      if (_freeOnly && !event.isFree) return false;
      if (_nearbyOnly && (event.lat == 0 && event.lng == 0)) return false;
      if (_nearbyOnly &&
          _distanceKm(_userLat, _userLng, event.lat, event.lng) >
              _nearbyRadiusKm) return false;
      if (_region != null &&
          !event.venue
              .toLowerCase()
              .contains(_region!.toLowerCase())) return false;
      if (_date != null) {
        final d = event.date;
        if (d.year != _date!.year ||
            d.month != _date!.month ||
            d.day != _date!.day) return false;
      }
      if (query.isNotEmpty &&
          !event.title.toLowerCase().contains(query) &&
          !event.venue.toLowerCase().contains(query) &&
          !event.category.toLowerCase().contains(query)) return false;
      return true;
    }).toList();

    switch (_sort) {
      case 'Date (nearest)':
        result.sort((a, b) => a.date.compareTo(b.date));
        break;
      case 'Date (furthest)':
        result.sort((a, b) => b.date.compareTo(a.date));
        break;
      case 'Price (low)':
        result.sort((a, b) => a.cheapestPrice.compareTo(b.cheapestPrice));
        break;
      case 'Price (high)':
        result.sort((a, b) => b.cheapestPrice.compareTo(a.cheapestPrice));
        break;
      case 'A-Z':
        result.sort((a, b) => a.title.compareTo(b.title));
        break;
    }

    return result;
  }

  Future<void> _pickDate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _date ?? now,
      firstDate: now.subtract(const Duration(days: 1)),
      lastDate: now.add(const Duration(days: 730)),
    );
    if (picked != null) setState(() => _date = picked);
  }

  IconData _categoryIcon(String value) {
    switch (value) {
      case 'wedding':
        return IconsaxPlusLinear.heart;
      case 'funeral':
        return IconsaxPlusLinear.candle;
      case 'corporate':
        return IconsaxPlusLinear.briefcase;
      case 'social':
        return IconsaxPlusLinear.people;
      default:
        return IconsaxPlusLinear.grid_1;
    }
  }

  String get _sectionTitle {
    switch (_sectionFocus) {
      case _SectionFocus.featured:
        return 'Featured';
      case _SectionFocus.weekend:
        return 'This weekend';
      case _SectionFocus.none:
        return 'All events';
    }
  }

  bool get _forceGrid =>
      _sectionFocus != _SectionFocus.none || _category != 'All';

  bool get _showGrid => _forceGrid || _isGridView;

  @override
  Widget build(BuildContext context) {
    // White status-bar content — the wallpaper below is dark/saturated for
    // the whole scroll depth, including behind the status bar.
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
      backgroundColor: Colors.transparent,
      body: Stack(
        children: [
          // Persistent full-screen wallpaper: primary → deepViolet diagonal,
          // fixed behind everything (never scrolls, never repeats per
          // section) and extending under the status bar.
          Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [AppColors.primary, AppColors.deepViolet],
                ),
              ),
            ),
          ),
          SafeArea(
            child: Column(
              children: [
                // ── Search bar (frosted glass over the wallpaper) ──
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(AppTheme.radius),
                  child: BackdropFilter(
                    filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
                    child: Container(
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.2),
                        borderRadius: BorderRadius.circular(AppTheme.radius),
                        border: Border.all(
                            color: Colors.white.withValues(alpha: 0.3),
                            width: 1),
                      ),
                      // TextField paints an opaque Material canvas by
                      // default — transparency lets the frosted fill and
                      // white hint/icon show through.
                      child: Material(
                        type: MaterialType.transparency,
                        child: TextField(
                          controller: _searchController,
                          style: const TextStyle(color: Colors.white),
                          onChanged: (_) => setState(() {}),
                          onTap: () => setState(() => _showRecent = true),
                          onSubmitted: (value) {
                            setState(() => _showRecent = false);
                            _saveRecentSearch(value);
                          },
                          decoration: InputDecoration(
                            hintText: 'Search events, venues, categories',
                            hintStyle: TextStyle(
                                color: Colors.white.withValues(alpha: 0.9)),
                            prefixIcon: const Icon(
                                IconsaxPlusLinear.search_normal,
                                size: 20,
                                color: Colors.white),
                            suffixIcon: _searchController.text.isNotEmpty
                                ? IconButton(
                                    icon: const Icon(
                                        IconsaxPlusLinear.close_circle,
                                        size: 18,
                                        color: Colors.white),
                                    onPressed: () {
                                      _searchController.clear();
                                      setState(() {});
                                    },
                                  )
                                : null,
                            border: InputBorder.none,
                            contentPadding: const EdgeInsets.symmetric(
                                horizontal: 16, vertical: 14),
                          ),
                        ),
                      ),
                    ),
                  ),
              ),
            ),

            // ── Recent searches ──
            if (_showRecent && _recentSearches.isNotEmpty)
              Container(
                margin: const EdgeInsets.fromLTRB(20, 8, 20, 0),
                padding: const EdgeInsets.all(AppSpacing.md),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                  border: Border.all(color: AppColors.border, width: 1),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Expanded(
                          child: Text(
                            'Recent searches',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: AppColors.textMuted,
                            ),
                          ),
                        ),
                        GestureDetector(
                          onTap: () {
                            setState(() => _recentSearches.clear());
                            setState(() => _showRecent = false);
                          },
                          child: const Text(
                            'Clear all',
                            style: TextStyle(
                              fontSize: 12,
                              color: AppColors.primary,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    Wrap(
                      spacing: AppSpacing.sm,
                      runSpacing: 6,
                      children: _recentSearches.take(8).map((s) {
                        return GestureDetector(
                          onTap: () {
                            _searchController.text = s;
                            setState(() => _showRecent = false);
                          },
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 10, vertical: 5),
                            decoration: BoxDecoration(
                              color: AppColors.neutralBg,
                              borderRadius:
                                  BorderRadius.circular(AppTheme.radiusSm),
                            ),
                            child: Text(
                              s,
                              style: const TextStyle(
                                fontSize: 12,
                                color: AppColors.textPrimary,
                              ),
                            ),
                          ),
                        );
                      }).toList(),
                    ),
                  ],
                ),
              ),

            // ── Category rail ──
            SizedBox(
              height: 100,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.fromLTRB(20, 12, 20, 4),
                itemCount: _categoryTabs.length,
                separatorBuilder: (_, __) => const SizedBox(width: 14),
                itemBuilder: (context, index) {
                  final tab = _categoryTabs[index];
                  final value = tab['value']!;
                  final label = tab['label']!;
                  final selected = _category == value;
                  return GestureDetector(
                    behavior: HitTestBehavior.opaque,
                    onTap: () => setState(() => _category = value),
                    child: SizedBox(
                      width: 68,
                      child: Column(
                        children: [
                          Container(
                            width: 56,
                            height: 56,
                            decoration: BoxDecoration(
                              color: selected
                                  ? AppColors.primary
                                  : Colors.white.withValues(alpha: 0.15),
                              shape: BoxShape.circle,
                            ),
                            child: Icon(
                              _categoryIcon(value),
                              size: 24,
                              color: Colors.white,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            label,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight:
                                  selected ? FontWeight.w700 : FontWeight.w500,
                              color: selected
                                  ? Colors.white
                                  : Colors.white.withValues(alpha: 0.85),
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),

            // ── Secondary filter chips ──
            SizedBox(
              height: 64,
              child: ListView(
                scrollDirection: Axis.horizontal,
                padding:
                    const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                children: [
                  _FilterPill(
                    label: 'Region',
                    active: _region != null,
                    onTap: () async {
                      final region = await _pickRegion(context);
                      if (region != null) setState(() => _region = region);
                    },
                  ),
                  _FilterPill(
                    label: 'Date',
                    active: _date != null,
                    onTap: () async {
                      if (_date != null) {
                        setState(() => _date = null);
                      } else {
                        await _pickDate();
                      }
                    },
                  ),
                  _FilterPill(
                    label: _nearbyOnly
                        ? 'Nearby ${_nearbyRadiusKm.toInt()}km'
                        : 'Nearby',
                    active: _nearbyOnly,
                    onTap: () {
                      showModalBottomSheet(
                        context: context,
                        builder: (ctx) => SafeArea(
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Padding(
                                  padding: EdgeInsets.all(16),
                                  child: Text('Nearby radius',
                                      style: TextStyle(
                                          fontSize: 17,
                                          fontWeight: FontWeight.w800))),
                              for (final d in [10.0, 25.0, 50.0, 100.0])
                                ListTile(
                                  title: Text('${d.toInt()} km'),
                                  trailing: _nearbyOnly && _nearbyRadiusKm == d
                                      ? const Icon(IconsaxPlusLinear.check,
                                          color: AppColors.primary)
                                      : null,
                                  selected:
                                      _nearbyOnly && _nearbyRadiusKm == d,
                                  onTap: () {
                                    setState(() {
                                      _nearbyOnly = true;
                                      _nearbyRadiusKm = d;
                                    });
                                    Navigator.pop(ctx);
                                  },
                                ),
                              ListTile(
                                  title: const Text('Show all (disable)'),
                                  onTap: () {
                                    setState(() => _nearbyOnly = false);
                                    Navigator.pop(ctx);
                                  }),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                  _FilterPill(
                    label: 'Free',
                    active: _freeOnly,
                    onTap: () => setState(() => _freeOnly = !_freeOnly),
                  ),
                  _FilterPill(
                    label: 'Sort',
                    active: _sort != 'Date (nearest)',
                    onTap: () {
                      showModalBottomSheet(
                        context: context,
                        builder: (ctx) => SafeArea(
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Padding(
                                padding: EdgeInsets.all(16),
                                child: Text('Sort by',
                                    style: TextStyle(
                                        fontSize: 17,
                                        fontWeight: FontWeight.w800)),
                              ),
                              for (final option in _sortOptions)
                                ListTile(
                                  title: Text(option),
                                  selected: _sort == option,
                                  trailing: _sort == option
                                      ? const Icon(IconsaxPlusLinear.check,
                                          color: AppColors.primary)
                                      : null,
                                  onTap: () {
                                    setState(() => _sort = option);
                                    Navigator.pop(ctx);
                                  },
                                ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                  const SizedBox(width: 8),
                ],
              ),
            ),

            // ── Active filter chips ──
            if (_hasActiveFilters)
              SizedBox(
                height: 36,
                child: ListView(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  children: [
                    if (_sectionFocus != _SectionFocus.none)
                      _ActiveFilterChip(
                        label: _sectionFocus == _SectionFocus.featured
                            ? 'Featured'
                            : 'This weekend',
                        onRemove: () =>
                            setState(() => _sectionFocus = _SectionFocus.none),
                      ),
                    if (_category != 'All')
                      _ActiveFilterChip(
                        label: _capitalize(_category),
                        onRemove: () => setState(() => _category = 'All'),
                      ),
                    if (_region != null)
                      _ActiveFilterChip(
                        label: _region!,
                        onRemove: () => setState(() => _region = null),
                      ),
                    if (_date != null)
                      _ActiveFilterChip(
                        label:
                            '${_date!.day}/${_date!.month}/${_date!.year}',
                        onRemove: () => setState(() => _date = null),
                      ),
                    if (_nearbyOnly)
                      _ActiveFilterChip(
                          label: 'Nearby ${_nearbyRadiusKm.toInt()}km',
                          onRemove: () =>
                              setState(() => _nearbyOnly = false)),
                    if (_freeOnly)
                      _ActiveFilterChip(
                        label: 'Free only',
                        onRemove: () => setState(() => _freeOnly = false),
                      ),
                    if (_sort != 'Date (nearest)')
                      _ActiveFilterChip(
                        label: _sort,
                        onRemove: () =>
                            setState(() => _sort = 'Date (nearest)'),
                      ),
                  ],
                ),
              ),

            // ── Curated rails + main grid/list ──
            Expanded(child: _buildEventsArea()),
              ],
            ),
          ),
        ],
      ),
      ),
    );
  }

  Widget _buildEventsArea() {
    return StreamBuilder(
      stream: context.read<EventService>().publishedEventsFeed(),
      builder: (context, snapshot) {
        if (snapshot.hasError) {
          return const Center(
              child: Text('Could not load events.',
                  style: TextStyle(color: Colors.white70)));
        }
        if (!snapshot.hasData) {
          return const Center(
            child: SizedBox(
              width: 24,
              height: 24,
              child: CircularProgressIndicator(
                  strokeWidth: 2, color: Colors.white),
            ),
          );
        }

        final filtered = _filter(snapshot.data!);
        final featured =
            filtered.where((e) => e.isCurrentlyFeatured).toList();
        final weekend =
            filtered.where((e) => _isThisWeekend(e.date)).toList();

        final List<Event> display;
        switch (_sectionFocus) {
          case _SectionFocus.featured:
            display = featured;
            break;
          case _SectionFocus.weekend:
            display = weekend;
            break;
          case _SectionFocus.none:
            display = filtered;
            break;
        }

        if (display.isEmpty) {
          return Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 72,
                  height: 72,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.15),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(IconsaxPlusLinear.search_normal,
                      size: 32, color: Colors.white),
                ),
                const SizedBox(height: 20),
                Text(
                  _sectionFocus == _SectionFocus.none
                      ? 'No events found'
                      : 'Nothing here yet',
                  style: const TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w800,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  _sectionFocus == _SectionFocus.none
                      ? 'Try adjusting your filters or search.'
                      : 'Check back soon for events in this section.',
                  style: TextStyle(
                      fontSize: 14,
                      color: Colors.white.withValues(alpha: 0.8)),
                ),
              ],
            ),
          );
        }

        final showRails = _sectionFocus == _SectionFocus.none;

        return ListView(
          padding: const EdgeInsets.only(top: AppSpacing.xs, bottom: 32),
          children: [
            if (showRails && featured.isNotEmpty)
              _EventRail(
                title: 'Featured',
                events: featured,
                onSeeAll: () =>
                    setState(() => _sectionFocus = _SectionFocus.featured),
              ),
            if (showRails && weekend.isNotEmpty)
              _EventRail(
                title: 'This weekend',
                events: weekend,
                onSeeAll: () =>
                    setState(() => _sectionFocus = _SectionFocus.weekend),
              ),

            // Section header + view toggle
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 12),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      _sectionTitle,
                      style:
                          AppTheme.headlineMedium.copyWith(color: Colors.white),
                    ),
                  ),
                  if (!_forceGrid)
                    GestureDetector(
                      onTap: _toggleView,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 8),
                        decoration: BoxDecoration(
                          color: AppColors.surface,
                          borderRadius:
                              BorderRadius.circular(AppTheme.radiusPill),
                          border:
                              Border.all(color: AppColors.border, width: 1),
                        ),
                        child: Icon(
                          _isGridView
                              ? IconsaxPlusLinear.menu
                              : IconsaxPlusLinear.grid_1,
                          size: 16,
                          color: AppColors.textMuted,
                        ),
                      ),
                    ),
                ],
              ),
            ),

            if (_showGrid)
              GridView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                padding: const EdgeInsets.symmetric(horizontal: 20),
                gridDelegate:
                    const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 2,
                  mainAxisSpacing: AppSpacing.md,
                  crossAxisSpacing: AppSpacing.md,
                  childAspectRatio: 0.70,
                ),
                itemCount: display.length,
                itemBuilder: (context, index) =>
                    EventCard(event: display[index])
                        .animate()
                        .fadeIn(
                          duration: 300.ms,
                          delay: Duration(milliseconds: 50 * index),
                        )
                        .slideY(begin: 0.05, end: 0),
              )
            else
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: Column(
                  children: [
                    for (var i = 0; i < display.length; i++)
                      Padding(
                        padding: EdgeInsets.only(
                          bottom:
                              i == display.length - 1 ? 0 : AppSpacing.sm,
                        ),
                        child: _ListRow(event: display[i]).animate().fadeIn(
                              duration: 300.ms,
                              delay: Duration(milliseconds: 40 * i),
                            ),
                      ),
                  ],
                ),
              ),
          ],
        );
      },
    );
  }

  bool get _hasActiveFilters {
    return _sectionFocus != _SectionFocus.none ||
        _category != 'All' ||
        _region != null ||
        _date != null ||
        _freeOnly ||
        _nearbyOnly ||
        _sort != 'Date (nearest)';
  }

  Future<String?> _pickRegion(BuildContext context) {
    return showModalBottomSheet<String>(
      context: context,
      builder: (context) {
        return SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Padding(
                padding: EdgeInsets.all(16),
                child: Text(
                  'Filter by region',
                  style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800),
                ),
              ),
              ListTile(
                title: const Text('All regions'),
                selected: _region == null,
                onTap: () => Navigator.of(context).pop(null),
              ),
              for (final region in _regions)
                ListTile(
                  title: Text(region),
                  selected: _region == region,
                  onTap: () => Navigator.of(context).pop(region),
                ),
            ],
          ),
        );
      },
    );
  }

  String _capitalize(String value) {
    if (value.isEmpty) return value;
    return value[0].toUpperCase() + value.substring(1);
  }
}

// ─── Curated horizontal rail ──────────────────────────────────────────────

class _EventRail extends StatelessWidget {
  const _EventRail({
    required this.title,
    required this.events,
    required this.onSeeAll,
  });

  final String title;
  final List<Event> events;
  final VoidCallback onSeeAll;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 4, 20, 0),
          child: Row(
            children: [
              Expanded(
                child: Text(title,
                    style:
                        AppTheme.headlineMedium.copyWith(color: Colors.white)),
              ),
              GestureDetector(
                onTap: onSeeAll,
                child: Text(
                  'See all',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: Colors.white.withValues(alpha: 0.9),
                    decoration: TextDecoration.underline,
                    decorationColor: Colors.white.withValues(alpha: 0.9),
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        SizedBox(
          height: 260,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 20),
            itemCount: events.length,
            separatorBuilder: (_, __) => const SizedBox(width: 12),
            itemBuilder: (context, index) => _RailCard(
              event: events[index],
            )
                .animate()
                .fadeIn(
                  duration: 300.ms,
                  delay: Duration(milliseconds: 40 * index),
                )
                .slideX(begin: 0.04, end: 0),
          ),
        ),
        const SizedBox(height: AppSpacing.xl),
      ],
    );
  }
}

class _RailCard extends StatelessWidget {
  const _RailCard({required this.event});

  final Event event;

  @override
  Widget build(BuildContext context) {
    final dateLabel = DateFormat('EEE, d MMM').format(event.date);
    final priceLabel = event.isFree
        ? 'Free'
        : 'GHS ${event.cheapestPrice.toStringAsFixed(0)}';

    return GestureDetector(
      onTap: () {
        Navigator.of(context).push(
          MaterialPageRoute(
            builder: (_) => EventPageScreen(eventId: event.id),
          ),
        );
      },
      child: Container(
        width: 220,
        height: 260,
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(AppTheme.radius),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.2),
              blurRadius: 20,
              offset: const Offset(0, 6),
            ),
          ],
        ),
        clipBehavior: Clip.antiAlias,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            AspectRatio(
              aspectRatio: 16 / 10,
              child: _RailCover(event: event),
            ),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.all(AppSpacing.md),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      event.title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppTheme.titleMedium,
                    ),
                    const SizedBox(height: 6),
                    Row(
                      children: [
                        const Icon(IconsaxPlusLinear.calendar,
                            size: 11, color: AppColors.textMuted),
                        const SizedBox(width: 4),
                        Expanded(
                          child: Text(
                            dateLabel,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontSize: 12,
                              color: AppColors.textMuted,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      priceLabel,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: AppColors.textPrimary,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _RailCover extends StatelessWidget {
  const _RailCover({required this.event});

  final Event event;

  @override
  Widget build(BuildContext context) {
    if (event.coverImageUrl.isNotEmpty) {
      if (event.coverImageUrl.startsWith('http')) {
        return CachedNetworkImage(
          imageUrl: event.coverImageUrl,
          fit: BoxFit.cover,
          width: double.infinity,
          placeholder: (_, __) => const _CoverFallback(),
          errorWidget: (_, __, ___) => const _CoverFallback(),
        );
      }
      return Image.file(
        File(event.coverImageUrl),
        fit: BoxFit.cover,
        width: double.infinity,
        errorBuilder: (_, __, ___) => const _CoverFallback(),
      );
    }
    return const _CoverFallback();
  }
}

class _CoverFallback extends StatelessWidget {
  const _CoverFallback();

  @override
  Widget build(BuildContext context) {
    return Container(
      color: AppColors.primary.withValues(alpha: 0.16),
      child: const Center(
        child: Icon(IconsaxPlusLinear.calendar,
            size: 24, color: AppColors.primary),
      ),
    );
  }
}

// ─── Compact list row (Facebook-density pattern) ──────────────────────────

class _ListRow extends StatelessWidget {
  const _ListRow({required this.event});
  final Event event;

  @override
  Widget build(BuildContext context) {
    final dateLabel = DateFormat('EEE, d MMM').format(event.date);
    final priceLabel =
        event.isFree ? 'Free' : 'GHS ${event.cheapestPrice.toStringAsFixed(0)}';

    return GestureDetector(
      onTap: () {
        Navigator.of(context).push(
          MaterialPageRoute(
            builder: (_) => EventPageScreen(eventId: event.id),
          ),
        );
      },
      child: Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(AppTheme.radius),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.2),
              blurRadius: 20,
              offset: const Offset(0, 6),
            ),
          ],
        ),
        child: Row(
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(AppTheme.radiusSm),
              child: SizedBox(
                width: 56,
                height: 56,
                child: _ListThumb(event: event),
              ),
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    event.title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Row(
                    children: [
                      const Icon(IconsaxPlusLinear.calendar,
                          size: 11, color: AppColors.textMuted),
                      const SizedBox(width: 4),
                      Flexible(
                        child: Text(
                          dateLabel,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 12,
                            color: AppColors.textMuted,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 2),
                  Text(
                    event.venue,
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
            const SizedBox(width: AppSpacing.sm),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  priceLabel,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 4),
                StatusTag(status: event.status, compact: true),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _ListThumb extends StatelessWidget {
  const _ListThumb({required this.event});
  final Event event;

  @override
  Widget build(BuildContext context) {
    if (event.coverImageUrl.isNotEmpty) {
      if (event.coverImageUrl.startsWith('http')) {
        return CachedNetworkImage(
          imageUrl: event.coverImageUrl,
          fit: BoxFit.cover,
          width: 56,
          height: 56,
          placeholder: (_, __) => const _ThumbFallback(),
          errorWidget: (_, __, ___) => const _ThumbFallback(),
        );
      } else {
        return Image.file(
          File(event.coverImageUrl),
          fit: BoxFit.cover,
          width: 56,
          height: 56,
          errorBuilder: (_, __, ___) => const _ThumbFallback(),
        );
      }
    }
    return const _ThumbFallback();
  }
}

/// Tinted placeholder inside an opaque white card — primary at an alpha
/// that reads as a deliberate placeholder tile against white.
class _ThumbFallback extends StatelessWidget {
  const _ThumbFallback();

  @override
  Widget build(BuildContext context) {
    return Container(
      color: AppColors.primary.withValues(alpha: 0.16),
      alignment: Alignment.center,
      child: const Icon(IconsaxPlusLinear.calendar,
          size: 20, color: AppColors.primary),
    );
  }
}

// ─── Filter pill ──────────────────────────────────────────────────────────

class _FilterPill extends StatelessWidget {
  const _FilterPill({
    required this.label,
    required this.active,
    required this.onTap,
  });

  final String label;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          decoration: BoxDecoration(
            color: active
                ? AppColors.primary
                : Colors.white.withValues(alpha: 0.15),
            borderRadius: BorderRadius.circular(AppTheme.radiusPill),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                label,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: active ? FontWeight.w700 : FontWeight.w500,
                  color: Colors.white,
                ),
              ),
              if (active) ...[
                const SizedBox(width: 4),
                const Icon(IconsaxPlusLinear.close_circle,
                    size: 14, color: Colors.white),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _ActiveFilterChip extends StatelessWidget {
  const _ActiveFilterChip({
    required this.label,
    required this.onRemove,
  });

  final String label;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 6),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.18),
          borderRadius: BorderRadius.circular(AppTheme.radiusSm),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              label,
              style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: Colors.white,
              ),
            ),
            const SizedBox(width: 4),
            GestureDetector(
              onTap: onRemove,
              child: const Icon(IconsaxPlusLinear.close_circle,
                  size: 12, color: Colors.white),
            ),
          ],
        ),
      ),
    );
  }
}

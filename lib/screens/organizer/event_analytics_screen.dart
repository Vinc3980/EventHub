import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:share_plus/share_plus.dart';

import '../../models/booking_model.dart';
import '../../models/event_model.dart';
import '../../services/event_service.dart';
import '../../services/local_db.dart';
import '../../services/registration_service.dart';
import '../../theme/app_colors.dart';

class EventAnalyticsScreen extends StatefulWidget {
  const EventAnalyticsScreen({super.key, required this.eventId});

  final String eventId;

  @override
  State<EventAnalyticsScreen> createState() => _EventAnalyticsScreenState();
}

class _EventAnalyticsScreenState extends State<EventAnalyticsScreen> {
  Event? _event;
  List<Booking> _bookings = const [];
  List<Map<String, dynamic>> _registrations = const [];
  double _totalRevenue = 0;
  double _platformFees = 0;
  bool _loading = true;
  bool _exporting = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final eventService = context.read<EventService>();
    final regService = context.read<RegistrationService>();
    final db = LocalStore.instance;

    final event = await eventService.getEvent(widget.eventId);
    final bookings =
        await regService.bookingsForEvent(widget.eventId).first;

    final regs = <Map<String, dynamic>>[];
    for (final b in bookings) {
      final reg = LocalStore.readDoc(db.registrations, b.regId);
      if (reg != null) regs.add(reg);
    }

    double totalRevenue = 0;
    double platformFees = 0;
    for (final entry in db.payments.toMap().entries) {
      final payment = Map<String, dynamic>.from(entry.value);
      final bookingId = payment['bookingId'] as String?;
      if (bookings.any((b) => b.id == bookingId)) {
        totalRevenue += (payment['amount'] as num?)?.toDouble() ?? 0;
        platformFees += (payment['platformFee'] as num?)?.toDouble() ?? 0;
      }
    }

    if (mounted) {
      setState(() {
        _event = event;
        _bookings = bookings;
        _registrations = regs;
        _totalRevenue = totalRevenue;
        _platformFees = platformFees;
        _loading = false;
      });
    }
  }

  Future<void> _exportCsv() async {
    setState(() => _exporting = true);
    try {
      final eventService = context.read<EventService>();
      final filePath = await eventService.exportAttendeeListCsv(widget.eventId);
      if (!mounted) return;
      await Share.shareXFiles([XFile(filePath)], text: 'Attendee list');
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Export failed: $error')),
      );
    } finally {
      if (mounted) setState(() => _exporting = false);
    }
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

    final totalBookings = _bookings.length;
    final checkedIn = _bookings.where((b) => b.checkedIn).length;
    final attendanceRate =
        totalBookings > 0 ? checkedIn / totalBookings : 0.0;

    final hometownCounts = <String, int>{};
    for (final reg in _registrations) {
      final h = reg['hometown'] as String? ?? '';
      if (h.isNotEmpty) hometownCounts[h] = (hometownCounts[h] ?? 0) + 1;
    }

    final denomCounts = <String, int>{};
    for (final reg in _registrations) {
      final d = reg['denomination'] as String? ?? '';
      if (d.isNotEmpty) denomCounts[d] = (denomCounts[d] ?? 0) + 1;
    }

    final genderCounts = <String, int>{};
    for (final reg in _registrations) {
      final g = reg['gender'] as String? ?? '';
      if (g.isNotEmpty) genderCounts[g] = (genderCounts[g] ?? 0) + 1;
    }

    final maxHometown =
        hometownCounts.values.fold<int>(0, (a, b) => a > b ? a : b);
    final maxDenom =
        denomCounts.values.fold<int>(0, (a, b) => a > b ? a : b);
    final maxGender =
        genderCounts.values.fold<int>(0, (a, b) => a > b ? a : b);

    // Sales by ticket type
    final eventService = context.read<EventService>();
    final tierSales = <_TierSale>[];
    if (_event != null) {
      for (final tier in _event!.ticketTypes) {
        final sold = eventService.soldCountForTier(widget.eventId, tier.name);
        final revenue = sold * tier.price;
        tierSales.add(_TierSale(
          name: tier.name,
          sold: sold,
          revenue: revenue,
          capacity: tier.capacity,
        ));
      }
    }
    final maxSold = tierSales.fold<int>(0, (a, t) => a > t.sold ? a : t.sold);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Event analytics'),
        actions: [
          TextButton.icon(
            onPressed: _exporting ? null : _exportCsv,
            icon: _exporting
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.download_outlined, size: 20),
            label: Text(_exporting ? 'Exporting…' : 'Export CSV'),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          Text(
            _event?.title ?? 'Event',
            style: const TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w800,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 24),
          // Attendance rate
          const Text(
            'Attendance rate',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 16),
          Center(
            child: SizedBox(
              width: 140,
              height: 140,
              child: Stack(
                alignment: Alignment.center,
                children: [
                  SizedBox(
                    width: 140,
                    height: 140,
                    child: CircularProgressIndicator(
                      value: attendanceRate,
                      strokeWidth: 14,
                      backgroundColor: AppColors.skeleton,
                      valueColor: const AlwaysStoppedAnimation<Color>(
                          AppColors.success),
                    ),
                  ),
                  Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        '${(attendanceRate * 100).toStringAsFixed(0)}%',
                        style: const TextStyle(
                          fontSize: 28,
                          fontWeight: FontWeight.w800,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      Text(
                        '$checkedIn / $totalBookings',
                        style: const TextStyle(
                            fontSize: 13, color: AppColors.textMuted),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 32),
          // Revenue
          if (_totalRevenue > 0) ...[
            const Text(
              'Revenue',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w700,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 12),
            _StatRow(
              label: 'Total collected',
              value: 'GHS ${_totalRevenue.toStringAsFixed(2)}',
            ),
            const SizedBox(height: 8),
            _StatRow(
              label: 'Platform fees',
              value: 'GHS ${_platformFees.toStringAsFixed(2)}',
              valueColor: AppColors.textMuted,
            ),
            const SizedBox(height: 8),
            _StatRow(
              label: 'Your payout',
              value:
                  'GHS ${(_totalRevenue - _platformFees).toStringAsFixed(2)}',
              isHighlight: true,
            ),
            const SizedBox(height: 24),
          ],
          // Sales by ticket type
          if (tierSales.isNotEmpty) ...[
            const Text(
              'Sales by ticket type',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w700,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 12),
            for (final tier in tierSales)
              _TierSaleRow(tier: tier, maxSold: maxSold),
            const SizedBox(height: 24),
          ],
          if (hometownCounts.isNotEmpty) ...[
            _SectionTitle(title: 'By hometown'),
            const SizedBox(height: 10),
            for (final entry in hometownCounts.entries)
              _BarRow(
                label: entry.key,
                count: entry.value,
                max: maxHometown,
              ),
            const SizedBox(height: 20),
          ],
          if (denomCounts.isNotEmpty) ...[
            _SectionTitle(title: 'By denomination'),
            const SizedBox(height: 10),
            for (final entry in denomCounts.entries)
              _BarRow(
                label: entry.key,
                count: entry.value,
                max: maxDenom,
              ),
            const SizedBox(height: 20),
          ],
          if (genderCounts.isNotEmpty) ...[
            _SectionTitle(title: 'By gender'),
            const SizedBox(height: 10),
            for (final entry in genderCounts.entries)
              _BarRow(
                label: entry.key,
                count: entry.value,
                max: maxGender,
              ),
          ],
          if (hometownCounts.isEmpty &&
              denomCounts.isEmpty &&
              genderCounts.isEmpty &&
              tierSales.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 20),
              child: Text(
                'No registration data available for breakdowns.',
                style: TextStyle(color: AppColors.textMuted),
              ),
            ),
          const SizedBox(height: 32),
        ],
      ),
    );
  }
}

class _TierSale {
  final String name;
  final int sold;
  final double revenue;
  final int capacity;

  const _TierSale({
    required this.name,
    required this.sold,
    required this.revenue,
    required this.capacity,
  });
}

class _TierSaleRow extends StatelessWidget {
  const _TierSaleRow({required this.tier, required this.maxSold});

  final _TierSale tier;
  final int maxSold;

  @override
  Widget build(BuildContext context) {
    final fraction = maxSold > 0 ? tier.sold / maxSold : 0.0;
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.border, width: 1),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    tier.name,
                    style: const TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 14,
                      color: AppColors.textPrimary,
                    ),
                  ),
                ),
                Text(
                  '${tier.sold} / ${tier.capacity} sold',
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppColors.textMuted,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Stack(
              children: [
                Container(
                  height: 8,
                  decoration: BoxDecoration(
                    color: AppColors.skeleton,
                    borderRadius: BorderRadius.circular(4),
                  ),
                ),
                FractionallySizedBox(
                  widthFactor: fraction,
                  child: Container(
                    height: 8,
                    decoration: BoxDecoration(
                      color: AppColors.accent,
                      borderRadius: BorderRadius.circular(4),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              tier.revenue > 0
                  ? 'GHS ${tier.revenue.toStringAsFixed(2)} revenue'
                  : 'Free',
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: AppColors.accent,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle({required this.title});
  final String title;

  @override
  Widget build(BuildContext context) {
    return Text(
      title,
      style: const TextStyle(
        fontSize: 16,
        fontWeight: FontWeight.w700,
        color: AppColors.textPrimary,
      ),
    );
  }
}

class _StatRow extends StatelessWidget {
  const _StatRow({
    required this.label,
    required this.value,
    this.valueColor,
    this.isHighlight = false,
  });

  final String label;
  final String value;
  final Color? valueColor;
  final bool isHighlight;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: isHighlight ? AppColors.successBg : AppColors.card,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isHighlight ? AppColors.success : AppColors.border,
          width: 1,
        ),
      ),
      child: Row(
        children: [
          Expanded(
            child: Text(
              label,
              style: TextStyle(
                fontSize: 14,
                fontWeight: isHighlight ? FontWeight.w700 : FontWeight.w500,
                color: AppColors.textPrimary,
              ),
            ),
          ),
          Text(
            value,
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w800,
              color: valueColor ??
                  (isHighlight ? AppColors.success : AppColors.textPrimary),
            ),
          ),
        ],
      ),
    );
  }
}

class _BarRow extends StatelessWidget {
  const _BarRow({
    required this.label,
    required this.count,
    required this.max,
  });

  final String label;
  final int count;
  final int max;

  @override
  Widget build(BuildContext context) {
    final fraction = max > 0 ? count / max : 0.0;
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          SizedBox(
            width: 100,
            child: Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                  fontSize: 13, color: AppColors.textPrimary),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Stack(
              children: [
                Container(
                  height: 20,
                  decoration: BoxDecoration(
                    color: AppColors.skeleton,
                    borderRadius: BorderRadius.circular(6),
                  ),
                ),
                FractionallySizedBox(
                  widthFactor: fraction,
                  child: Container(
                    height: 20,
                    decoration: BoxDecoration(
                      color: AppColors.accent,
                      borderRadius: BorderRadius.circular(6),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          SizedBox(
            width: 30,
            child: Text(
              '$count',
              textAlign: TextAlign.end,
              style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textPrimary),
            ),
          ),
        ],
      ),
    );
  }
}

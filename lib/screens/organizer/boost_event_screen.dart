import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../models/event_model.dart';
import '../../services/promotion_service.dart';
import '../../theme/app_colors.dart';
import '../../widgets/primary_button.dart';

/// Screen where an organizer can "boost" (feature) their event for a chosen
/// number of days.  The payment is simulated locally — see [PromotionService].
class BoostEventScreen extends StatefulWidget {
  const BoostEventScreen({super.key, required this.event});

  final Event event;

  @override
  State<BoostEventScreen> createState() => _BoostEventScreenState();
}

class _BoostEventScreenState extends State<BoostEventScreen> {
  int _selectedDays = 7;
  bool _loading = false;

  static const List<_Tier> _tiers = [
    _Tier(days: 3, label: '3 days', subtitle: 'Quick boost'),
    _Tier(days: 7, label: '7 days', subtitle: 'Most popular'),
    _Tier(days: 14, label: '14 days', subtitle: 'Maximum reach'),
  ];

  Future<void> _boost() async {
    setState(() => _loading = true);
    try {
      final promo = context.read<PromotionService>();
      await promo.boostEvent(widget.event.id, _selectedDays);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Event boosted for $_selectedDays days!',
          ),
        ),
      );
      Navigator.of(context).pop(true);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Boost failed: $e')),
      );
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final promo = context.read<PromotionService>();

    return Scaffold(
      appBar: AppBar(title: const Text('Boost event')),
      body: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: AppColors.card,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppColors.border, width: 1),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Feature your event',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Boosted events appear at the top of Explore and Home feeds, '
                  'marked with a Featured badge.',
                  style: TextStyle(fontSize: 14, color: AppColors.textMuted),
                ),
                const SizedBox(height: 6),
                Text(
                  widget.event.title,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          const Text(
            'Choose a boost duration',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 12),
          for (final tier in _tiers)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: GestureDetector(
                onTap: () => setState(() => _selectedDays = tier.days),
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
                  decoration: BoxDecoration(
                    color: _selectedDays == tier.days
                        ? AppColors.primary.withValues(alpha: 0.05)
                        : AppColors.card,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(
                      color: _selectedDays == tier.days
                          ? AppColors.primary
                          : AppColors.border,
                      width: _selectedDays == tier.days ? 1.5 : 1,
                    ),
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 22,
                        height: 22,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: _selectedDays == tier.days
                                ? AppColors.primary
                                : AppColors.textMuted,
                            width: 2,
                          ),
                        ),
                        child: _selectedDays == tier.days
                            ? const Center(
                                child: Icon(Icons.circle,
                                    size: 10, color: AppColors.primary),
                              )
                            : null,
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              tier.label,
                              style: const TextStyle(
                                fontWeight: FontWeight.w700,
                                fontSize: 15,
                                color: AppColors.textPrimary,
                              ),
                            ),
                            Text(
                              tier.subtitle,
                              style: const TextStyle(
                                fontSize: 12,
                                color: AppColors.textMuted,
                              ),
                            ),
                          ],
                        ),
                      ),
                      Text(
                        'GHS ${promo.priceForTier(tier.days).toStringAsFixed(2)}',
                        style: const TextStyle(
                          fontWeight: FontWeight.w800,
                          fontSize: 16,
                          color: AppColors.primary,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          const SizedBox(height: 12),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppColors.warningBg,
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Text(
              'This is a simulated charge for testing. No real payment '
              'is processed. Replace with Paystack / Flutterwave before launch.',
              style: TextStyle(fontSize: 12, color: AppColors.warning),
            ),
          ),
          const SizedBox(height: 24),
          PrimaryButton(
            label: _loading ? 'Processing…' : 'Boost now',
            icon: Icons.rocket_launch_outlined,
            onPressed: _loading ? null : _boost,
          ),
        ],
      ),
    );
  }
}

class _Tier {
  const _Tier({required this.days, required this.label, required this.subtitle});
  final int days;
  final String label;
  final String subtitle;
}

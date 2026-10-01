import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../services/auth_service.dart';
import '../../services/local_db.dart';
import '../../theme/app_colors.dart';

/// Screen where an organizer can save their preferred payout account and
/// view a history of payouts from successfully completed events.
///
/// NOTE: Actually moving money to this saved account is a future Cloud
/// Function + payment-gateway payout API integration.  This screen only
/// stores where the money *should* go.
class PayoutSettingsScreen extends StatefulWidget {
  const PayoutSettingsScreen({super.key});

  @override
  State<PayoutSettingsScreen> createState() => _PayoutSettingsScreenState();
}

class _PayoutSettingsScreenState extends State<PayoutSettingsScreen> {
  static const List<String> _providers = [
    'MTN MoMo',
    'Vodafone Cash',
    'AirtelTigo',
    'Bank',
  ];

  String _selectedProvider = 'MTN MoMo';
  final _accountNumberController = TextEditingController();
  final _accountNameController = TextEditingController();
  bool _saved = false;

  @override
  void initState() {
    super.initState();
    _loadSaved();
  }

  @override
  void dispose() {
    _accountNumberController.dispose();
    _accountNameController.dispose();
    super.dispose();
  }

  void _loadSaved() {
    final uid = context.read<AuthService>().currentUid ?? '';
    final db = LocalStore.instance;
    final existing = db.payoutAccounts.get(uid);
    if (existing != null) {
      final data = Map<String, dynamic>.from(existing);
      _selectedProvider = data['provider'] as String? ?? 'MTN MoMo';
      _accountNumberController.text = data['accountNumber'] as String? ?? '';
      _accountNameController.text = data['accountName'] as String? ?? '';
      _saved = true;
    }
  }

  Future<void> _save() async {
    final uid = context.read<AuthService>().currentUid ?? '';
    final db = LocalStore.instance;
    await db.payoutAccounts.put(uid, {
      'provider': _selectedProvider,
      'accountNumber': _accountNumberController.text.trim(),
      'accountName': _accountNameController.text.trim(),
      'updatedAt': DateTime.now().toUtc().toIso8601String(),
    });
    if (!mounted) return;
    setState(() => _saved = true);
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Payout account saved.')),
    );
  }

  @override
  Widget build(BuildContext context) {
    final uid = context.read<AuthService>().currentUid ?? '';

    return Scaffold(
      appBar: AppBar(title: const Text('Payout settings')),
      body: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          // --- Account form ---
          const Text(
            'Payout account',
            style: TextStyle(
              fontSize: 17,
              fontWeight: FontWeight.w700,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 6),
          const Text(
            'Where your event earnings will be sent.',
            style: TextStyle(fontSize: 13, color: AppColors.textMuted),
          ),
          const SizedBox(height: 16),
          DropdownButtonFormField<String>(
            value: _selectedProvider,
            decoration: const InputDecoration(labelText: 'Provider'),
            items: _providers
                .map((p) => DropdownMenuItem(value: p, child: Text(p)))
                .toList(),
            onChanged: (v) {
              if (v != null) setState(() => _selectedProvider = v);
            },
          ),
          const SizedBox(height: 14),
          TextField(
            controller: _accountNumberController,
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(
              labelText: 'Account / phone number',
            ),
          ),
          const SizedBox(height: 14),
          TextField(
            controller: _accountNameController,
            textCapitalization: TextCapitalization.words,
            decoration: const InputDecoration(labelText: 'Account name'),
          ),
          const SizedBox(height: 20),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _save,
              child: Text(_saved ? 'Update' : 'Save'),
            ),
          ),
          const SizedBox(height: 32),

          // --- Payout history ---
          const Text(
            'Payout history',
            style: TextStyle(
              fontSize: 17,
              fontWeight: FontWeight.w700,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 6),
          const Text(
            'Earnings from your completed events.',
            style: TextStyle(fontSize: 13, color: AppColors.textMuted),
          ),
          const SizedBox(height: 12),
          _PayoutHistory(uid: uid),
          const SizedBox(height: 32),

          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppColors.warningBg,
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Text(
              'Payout transfers are not processed locally. '
              'This information will be used by a future Cloud Function '
              'to send earnings to your account.',
              style: TextStyle(fontSize: 12, color: AppColors.warning),
            ),
          ),
        ],
      ),
    );
  }
}

/// Queries the bookings + events boxes to build a payout history grouped by
/// event, showing total organizer payout per event.
class _PayoutHistory extends StatelessWidget {
  const _PayoutHistory({required this.uid});

  final String uid;

  @override
  Widget build(BuildContext context) {
    final db = LocalStore.instance;

    // Build a map: eventId -> event title (for events owned by this user).
    final myEvents = <String, String>{};
    for (final entry in db.events.toMap().entries) {
      final data = Map<String, dynamic>.from(entry.value);
      if (data['ownerId'] == uid) {
        myEvents[entry.key] = data['title'] as String? ?? 'Untitled';
      }
    }

    // Find successful payments for bookings on my events.
    final payoutsByEvent = <String, double>{};
    for (final paymentEntry in db.payments.toMap().entries) {
      final payment = Map<String, dynamic>.from(paymentEntry.value);
      if (payment['status'] != 'success') continue;
      final bookingId = payment['bookingId'] as String? ?? '';
      if (bookingId.isEmpty) continue;
      final booking = LocalStore.readDoc(db.bookings, bookingId);
      if (booking == null) continue;
      final eventId = booking['eventId'] as String? ?? '';
      if (!myEvents.containsKey(eventId)) continue;
      final payout = (payment['organizerPayout'] as num?)?.toDouble() ?? 0;
      payoutsByEvent[eventId] = (payoutsByEvent[eventId] ?? 0) + payout;
    }

    if (payoutsByEvent.isEmpty) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.border, width: 1),
        ),
        child: const Text(
          'No payouts yet. They\'ll appear here once your events have '
          'confirmed bookings.',
          style: TextStyle(fontSize: 13, color: AppColors.textMuted),
          textAlign: TextAlign.center,
        ),
      );
    }

    final total = payoutsByEvent.values.fold<double>(0, (a, b) => a + b);

    return Column(
      children: [
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppColors.successBg,
            borderRadius: BorderRadius.circular(14),
          ),
          child: Text(
            'Total earned: GHS ${total.toStringAsFixed(2)}',
            style: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w800,
              color: AppColors.success,
            ),
            textAlign: TextAlign.center,
          ),
        ),
        const SizedBox(height: 12),
        for (final entry in payoutsByEvent.entries) ...[
          Container(
            width: double.infinity,
            padding:
                const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              color: AppColors.card,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.border, width: 1),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    myEvents[entry.key] ?? 'Event',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontWeight: FontWeight.w600,
                      fontSize: 14,
                      color: AppColors.textPrimary,
                    ),
                  ),
                ),
                Text(
                  'GHS ${entry.value.toStringAsFixed(2)}',
                  style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 14,
                    color: AppColors.success,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 8),
        ],
      ],
    );
  }
}

import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../services/discount_service.dart';
import '../../services/registration_service.dart';
import '../../theme/app_colors.dart';
import 'booking_confirmation_screen.dart';
import 'event_page.dart';

class PaymentScreen extends StatefulWidget {
  const PaymentScreen({
    super.key,
    required this.eventId,
    required this.regId,
    required this.userId,
    required this.amount,
    this.originalAmount,
    this.discountCodeId,
  });

  final String eventId;
  final String regId;
  final String userId;
  final double amount;
  final double? originalAmount;
  final String? discountCodeId;

  @override
  State<PaymentScreen> createState() => _PaymentScreenState();
}

class _PaymentScreenState extends State<PaymentScreen> {
  bool _pending = true;
  bool _failed = false;
  String? _errorMessage;
  Timer? _pollTimer;
  String _paymentId = '';
  String _bookingId = '';

  @override
  void initState() {
    super.initState();
    _initiatePayment();
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    super.dispose();
  }

  Future<void> _initiatePayment() async {
    setState(() {
      _pending = true;
      _failed = false;
      _errorMessage = null;
    });

    try {
      final regService = context.read<RegistrationService>();
      final result = await regService.requestMomoPayment(
        regId: widget.regId,
        eventId: widget.eventId,
        userId: widget.userId,
        amount: widget.amount,
      );
      _paymentId = result['paymentId'] as String;
      _bookingId = result['bookingId'] as String;
      _startPolling();
    } on MomoPaymentException catch (e) {
      if (!mounted) return;
      setState(() {
        _pending = false;
        _failed = true;
        _errorMessage = e.message;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _pending = false;
        _failed = true;
        _errorMessage = 'Payment request failed. Please try again.';
      });
    }
  }

  void _startPolling() {
    _pollTimer = Timer.periodic(const Duration(seconds: 3), (_) async {
      if (!mounted) return;
      try {
        final regService = context.read<RegistrationService>();
        final booking = await regService
            .bookingsForEvent(widget.eventId)
            .first
            .then((list) => list.where((b) => b.regId == widget.regId).firstOrNull);

        if (booking == null) return;

        if (booking.status == 'confirmed') {
          _pollTimer?.cancel();
          // Redeem the discount code now that booking is confirmed.
          if (widget.discountCodeId != null) {
            try {
              final discountService = context.read<DiscountService>();
              await discountService.redeemCode(widget.discountCodeId!);
            } catch (_) {
              // Best-effort: don't block navigation if redemption fails.
            }
          }
          if (!mounted) return;
          Navigator.of(context).pushReplacement(
            MaterialPageRoute(
              builder: (_) =>
                  BookingConfirmationScreen(bookingId: booking.id),
            ),
          );
        } else if (booking.status == 'payment_failed') {
          _pollTimer?.cancel();
          if (!mounted) return;
          setState(() {
            _pending = false;
            _failed = true;
            _errorMessage = 'Payment was declined. Please try again.';
          });
        }
      } catch (_) {
        // Keep polling
      }
    });
  }

  void _cancel() {
    _pollTimer?.cancel();
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(
        builder: (_) => EventPageScreen(eventId: widget.eventId),
      ),
      (route) => false,
    );
  }

  void _simulateApproval() {
    final regService = context.read<RegistrationService>();
    regService.forceResolveMomoPayment(_paymentId, _bookingId, success: true);
  }

  void _simulateFailure() {
    final regService = context.read<RegistrationService>();
    regService.forceResolveMomoPayment(_paymentId, _bookingId, success: false);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Payment'),
        automaticallyImplyLeading: !_pending,
      ),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: _pending
              ? _PendingView(
                  amount: widget.amount,
                  originalAmount: widget.originalAmount,
                  onCancel: _cancel,
                  onSimulateApproval: kDebugMode ? _simulateApproval : null,
                  onSimulateFailure: kDebugMode ? _simulateFailure : null,
                )
              : _failed
                  ? _FailedView(
                      message: _errorMessage,
                      onRetry: _initiatePayment,
                      onCancel: _cancel,
                    )
                  : const SizedBox(),
        ),
      ),
    );
  }
}

class _PendingView extends StatelessWidget {
  const _PendingView({
    required this.amount,
    required this.onCancel,
    this.originalAmount,
    this.onSimulateApproval,
    this.onSimulateFailure,
  });

  final double amount;
  final double? originalAmount;
  final VoidCallback onCancel;
  final VoidCallback? onSimulateApproval;
  final VoidCallback? onSimulateFailure;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 80,
          height: 80,
          decoration: BoxDecoration(
            color: AppColors.skeleton,
            borderRadius: BorderRadius.circular(24),
          ),
          child: const SizedBox(
            width: 40,
            height: 40,
            child: CircularProgressIndicator(strokeWidth: 3),
          ),
        ),
        const SizedBox(height: 24),
        const Text(
          'Waiting for MoMo approval',
          style: TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.w800,
            color: AppColors.textPrimary,
          ),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 10),
        if (originalAmount != null && originalAmount! > amount)
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                'GHS ${originalAmount!.toStringAsFixed(2)}',
                style: const TextStyle(
                  fontSize: 16,
                  color: AppColors.textMuted,
                  decoration: TextDecoration.lineThrough,
                ),
              ),
              const SizedBox(width: 10),
              Text(
                'GHS ${amount.toStringAsFixed(2)}',
                style: const TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w800,
                  color: AppColors.accent,
                ),
              ),
            ],
          )
        else
          Text(
            'Check your phone and approve the payment of GHS ${amount.toStringAsFixed(2)}.',
            style: const TextStyle(fontSize: 14, color: AppColors.textMuted),
            textAlign: TextAlign.center,
          ),
        const SizedBox(height: 32),

        // Dev-only quick-resolve buttons — never ships to production users.
        if (onSimulateApproval != null || onSimulateFailure != null) ...[
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (onSimulateApproval != null)
                TextButton(
                  onPressed: onSimulateApproval,
                  child: const Text(
                    'Simulate approval now',
                    style: TextStyle(fontSize: 12, color: AppColors.textMuted),
                  ),
                ),
              if (onSimulateFailure != null) ...[
                const SizedBox(width: 16),
                TextButton(
                  onPressed: onSimulateFailure,
                  child: const Text(
                    'Simulate failure now',
                    style: TextStyle(fontSize: 12, color: AppColors.danger),
                  ),
                ),
              ],
            ],
          ),
          const SizedBox(height: 16),
        ],

        SizedBox(
          width: double.infinity,
          child: OutlinedButton(
            style: OutlinedButton.styleFrom(
              foregroundColor: AppColors.danger,
              side: const BorderSide(color: AppColors.danger),
            ),
            onPressed: onCancel,
            child: const Text('Cancel'),
          ),
        ),
      ],
    );
  }
}

class _FailedView extends StatelessWidget {
  const _FailedView({
    required this.message,
    required this.onRetry,
    required this.onCancel,
  });

  final String? message;
  final VoidCallback onRetry;
  final VoidCallback onCancel;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 80,
          height: 80,
          decoration: BoxDecoration(
            color: AppColors.dangerBg,
            borderRadius: BorderRadius.circular(24),
          ),
          child: const Icon(Icons.error_outline,
              color: AppColors.danger, size: 40),
        ),
        const SizedBox(height: 24),
        const Text(
          'Payment failed',
          style: TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.w800,
            color: AppColors.textPrimary,
          ),
        ),
        const SizedBox(height: 10),
        Text(
          message ?? 'Something went wrong.',
          style: const TextStyle(fontSize: 14, color: AppColors.textMuted),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 32),
        SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: onRetry,
            child: const Text('Retry'),
          ),
        ),
        const SizedBox(height: 12),
        SizedBox(
          width: double.infinity,
          child: OutlinedButton(
            style: OutlinedButton.styleFrom(
              foregroundColor: AppColors.danger,
              side: const BorderSide(color: AppColors.danger),
            ),
            onPressed: onCancel,
            child: const Text('Cancel'),
          ),
        ),
      ],
    );
  }
}

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../models/review_model.dart';
import '../../services/auth_service.dart';
import '../../services/review_service.dart';
import '../../theme/app_colors.dart';

class RateOrganizerScreen extends StatefulWidget {
  const RateOrganizerScreen({
    super.key,
    required this.eventId,
    required this.organizerId,
    required this.eventTitle,
  });

  final String eventId;
  final String organizerId;
  final String eventTitle;

  @override
  State<RateOrganizerScreen> createState() => _RateOrganizerScreenState();
}

class _RateOrganizerScreenState extends State<RateOrganizerScreen> {
  int _rating = 0;
  final _reviewController = TextEditingController();
  bool _submitting = false;
  bool _submitted = false;

  @override
  void dispose() {
    _reviewController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_rating == 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please select a rating.')),
      );
      return;
    }

    setState(() => _submitting = true);

    final uid = context.read<AuthService>().currentUid ?? '';
    final reviewService = context.read<ReviewService>();

    await reviewService.addReview(Review(
      id: '',
      eventId: widget.eventId,
      organizerId: widget.organizerId,
      attendeeId: uid,
      rating: _rating,
      text: _reviewController.text.trim(),
      createdAt: DateTime.now(),
    ));

    if (mounted) {
      setState(() {
        _submitting = false;
        _submitted = true;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_submitted) {
      return Scaffold(
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(32),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 80,
                  height: 80,
                  decoration: const BoxDecoration(
                    color: AppColors.successBg,
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.check,
                      color: AppColors.success, size: 40),
                ),
                const SizedBox(height: 24),
                const Text(
                  'Thanks for your review!',
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w800,
                    color: AppColors.textPrimary,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 12),
                const Text(
                  'Your feedback helps organizers improve future events.',
                  style: TextStyle(fontSize: 14, color: AppColors.textMuted),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 32),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: () => Navigator.of(context).pop(),
                    child: const Text('Done'),
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Rate this event')),
      body: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          Text(
            'How was ${widget.eventTitle}?',
            style: const TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.w800,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'Your feedback helps organizers create better experiences.',
            style: TextStyle(fontSize: 14, color: AppColors.textMuted),
          ),
          const SizedBox(height: 32),
          // Star picker
          Center(
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: List.generate(5, (index) {
                final star = index + 1;
                return GestureDetector(
                  onTap: () => setState(() => _rating = star),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 6),
                    child: Icon(
                      star <= _rating ? Icons.star : Icons.star_border,
                      size: 44,
                      color:
                          star <= _rating ? AppColors.warning : AppColors.border,
                    ),
                  ),
                );
              }),
            ),
          ),
          const SizedBox(height: 8),
          Center(
            child: Text(
              _rating == 0
                  ? 'Tap a star to rate'
                  : ['Poor', 'Fair', 'Good', 'Very good', 'Excellent'][_rating - 1],
              style: TextStyle(
                fontSize: 14,
                color: _rating == 0 ? AppColors.textMuted : AppColors.textPrimary,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          const SizedBox(height: 32),
          TextField(
            controller: _reviewController,
            textCapitalization: TextCapitalization.sentences,
            maxLines: 4,
            decoration: InputDecoration(
              hintText: 'Write a review (optional)...',
              hintStyle: const TextStyle(color: AppColors.textMuted),
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
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
          const SizedBox(height: 32),
          SizedBox(
            height: 52,
            child: ElevatedButton(
              onPressed: _submitting ? null : _submit,
              child: _submitting
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: Colors.white),
                    )
                  : const Text('Submit review'),
            ),
          ),
        ],
      ),
    );
  }
}

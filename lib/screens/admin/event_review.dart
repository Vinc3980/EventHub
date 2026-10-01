import 'dart:io';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../models/event_model.dart';
import '../../services/auth_service.dart';
import '../../services/event_service.dart';
import '../../theme/app_colors.dart';
import '../../widgets/shimmer_skeleton.dart';

class EventReviewScreen extends StatefulWidget {
  const EventReviewScreen({super.key, required this.eventId});

  final String eventId;

  @override
  State<EventReviewScreen> createState() => _EventReviewScreenState();
}

class _EventReviewScreenState extends State<EventReviewScreen> {
  Event? _event;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final event = await context.read<EventService>().getEvent(widget.eventId);
    if (!mounted) return;
    setState(() {
      _event = event;
      _loading = false;
    });
  }

  Future<void> _approve() async {
    try {
      await context.read<EventService>().approveEvent(widget.eventId);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Event approved.')),
      );
      Navigator.of(context).pop();
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Could not approve: $error')),
      );
    }
  }

  Future<void> _reject() async {
    try {
      await context.read<EventService>().rejectEvent(widget.eventId);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Event rejected.')),
      );
      Navigator.of(context).pop();
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Could not reject: $error')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return Scaffold(
        body: Center(
          child: ShimmerSkeleton.box(width: 240, height: 300, radius: 16),
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

    return Scaffold(
      appBar: AppBar(title: const Text('Review event')),
      body: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(16),
            child: SizedBox(
              height: 200,
              width: double.infinity,
              child: event.coverImageUrl.isNotEmpty
                  ? _isLocalPath(event.coverImageUrl)
                      ? Image.file(
                          File(event.coverImageUrl),
                          fit: BoxFit.cover,
                          errorBuilder: (_, __, ___) => const _CoverFallback(),
                        )
                      : Image.network(
                          event.coverImageUrl,
                          fit: BoxFit.cover,
                          errorBuilder: (_, __, ___) => const _CoverFallback(),
                        )
                  : const _CoverFallback(),
            ),
          ),
          const SizedBox(height: 16),
          Text(
            event.title,
            style: const TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.w800,
              color: AppColors.textPrimary,
              letterSpacing: -0.3,
            ),
          ),
          const SizedBox(height: 12),
          _OrganizerChip(ownerId: event.ownerId),
          const SizedBox(height: 16),
          _InfoRow(icon: Icons.calendar_today_outlined, text: dateLabel),
          const SizedBox(height: 10),
          _InfoRow(icon: Icons.location_on_outlined, text: event.venue),
          const SizedBox(height: 10),
          _InfoRow(
              icon: Icons.category_outlined,
              text: event.category[0].toUpperCase() + event.category.substring(1)),
          if (event.ticketTypes.isNotEmpty) ...[
            const SizedBox(height: 20),
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
          const SizedBox(height: 28),
          Row(
            children: [
              Expanded(
                child: SizedBox(
                  height: 50,
                  child: ElevatedButton(
                    onPressed: _approve,
                    child: const Text('Approve'),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: SizedBox(
                  height: 50,
                  child: OutlinedButton(
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.danger,
                      side: const BorderSide(color: AppColors.danger),
                    ),
                    onPressed: _reject,
                    child: const Text('Reject'),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _OrganizerChip extends StatelessWidget {
  const _OrganizerChip({required this.ownerId});

  final String ownerId;

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<Map<String, dynamic>?>(
      future: context.read<AuthService>().fetchUserProfile(ownerId),
      builder: (context, snapshot) {
        final data = snapshot.data;
        final name = data?['name'] as String? ?? 'Organizer';
        final initial = name.isEmpty ? '?' : name[0].toUpperCase();
        return Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: BoxDecoration(
            color: AppColors.card,
            borderRadius: BorderRadius.circular(100),
            border: Border.all(color: AppColors.border, width: 1),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 28,
                height: 28,
                decoration: BoxDecoration(
                  color: AppColors.skeleton,
                  shape: BoxShape.circle,
                ),
                child: Center(
                  child: Text(
                    initial,
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textPrimary,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Flexible(
                child: Text(
                  name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textPrimary,
                  ),
                ),
              ),
            ],
          ),
        );
      },
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
          child: Text(
            text,
            style: const TextStyle(fontSize: 14, color: AppColors.textPrimary),
          ),
        ),
      ],
    );
  }
}

bool _isLocalPath(String path) => !path.startsWith('http://') && !path.startsWith('https://');

class _CoverFallback extends StatelessWidget {
  const _CoverFallback();

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

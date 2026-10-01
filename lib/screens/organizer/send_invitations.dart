import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../../services/invitation_service.dart';
import '../../theme/app_colors.dart';
import 'organizer_dashboard.dart';

class SendInvitationsScreen extends StatefulWidget {
  const SendInvitationsScreen({super.key, required this.eventId});

  final String eventId;

  @override
  State<SendInvitationsScreen> createState() => _SendInvitationsScreenState();
}

class _SendInvitationsScreenState extends State<SendInvitationsScreen> {
  bool _inApp = true;
  bool _sms = true;
  bool _link = false;
  bool _sending = false;

  String get _rsvpLink =>
      context.read<InvitationService>().generateRsvpLink(widget.eventId);

  Future<void> _send() async {
    if (!_inApp && !_sms && !_link) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Select at least one channel.')),
      );
      return;
    }

    final invitationService = context.read<InvitationService>();
    final messenger = ScaffoldMessenger.of(context);
    final navigator = Navigator.of(context);

    setState(() => _sending = true);
    try {
      if (_inApp) await invitationService.notifyFollowers(widget.eventId);
      if (_sms) {
        await invitationService.sendBulkSmsInvites(
          eventId: widget.eventId,
          phoneNumbers: const [],
        );
      }
      setState(() => _sending = false);
      messenger.showSnackBar(
        const SnackBar(content: Text('Invitations sent')),
      );
      navigator.pushAndRemoveUntil(
        MaterialPageRoute(builder: (_) => const OrganizerDashboardScreen()),
        (route) => false,
      );
    } catch (error) {
      setState(() => _sending = false);
      messenger.showSnackBar(
        SnackBar(content: Text('Invitation failed: $error')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Send invitations')),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text(
                'Send invitations',
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w800,
                  color: AppColors.textPrimary,
                  letterSpacing: -0.3,
                ),
              ),
              const SizedBox(height: 24),
              _ChannelOption(
                label: 'In-app feed & push',
                checked: _inApp,
                onChanged: (v) => setState(() => _inApp = v),
              ),
              const SizedBox(height: 10),
              _ChannelOption(
                label: 'Bulk SMS to guest list',
                checked: _sms,
                onChanged: (v) => setState(() => _sms = v),
              ),
              const SizedBox(height: 10),
              _ChannelOption(
                label: 'Shareable link / QR poster',
                checked: _link,
                onChanged: (v) => setState(() => _link = v),
              ),
              if (_link) ...[
                const SizedBox(height: 24),
                Center(
                  child: Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: AppColors.card,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: AppColors.border, width: 1),
                    ),
                    child: QrImageView(
                      data: _rsvpLink,
                      version: QrVersions.auto,
                      size: 140,
                      backgroundColor: AppColors.card,
                      eyeStyle: const QrEyeStyle(
                          eyeShape: QrEyeShape.square,
                          color: AppColors.textPrimary),
                      dataModuleStyle: const QrDataModuleStyle(
                          dataModuleShape: QrDataModuleShape.square,
                          color: AppColors.textPrimary),
                    ),
                  ),
                ),
                const SizedBox(height: 10),
                Center(
                  child: SelectableText(
                    _rsvpLink,
                    style: const TextStyle(
                        fontSize: 12, color: AppColors.textMuted),
                  ),
                ),
              ],
              const SizedBox(height: 16),
              Center(
                child: Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: AppColors.skeleton,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(Icons.ios_share_outlined,
                      color: AppColors.textMuted, size: 20),
                ),
              ),
              const SizedBox(height: 32),
              SizedBox(
                height: 50,
                child: ElevatedButton(
                  onPressed: _sending ? null : _send,
                  child: _sending
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: Colors.white),
                        )
                      : const Text('Send invitations'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ChannelOption extends StatelessWidget {
  const _ChannelOption({
    required this.label,
    required this.checked,
    required this.onChanged,
  });

  final String label;
  final bool checked;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => onChanged(!checked),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.border, width: 1),
        ),
        child: Row(
          children: [
            Container(
              width: 22,
              height: 22,
              decoration: BoxDecoration(
                color: checked ? AppColors.textPrimary : Colors.transparent,
                borderRadius: BorderRadius.circular(6),
                border: Border.all(
                  color: checked ? AppColors.textPrimary : AppColors.border,
                  width: 1.5,
                ),
              ),
              child: checked
                  ? const Icon(Icons.check, color: Colors.white, size: 14)
                  : null,
            ),
            const SizedBox(width: 14),
            Flexible(
              child: Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w500,
                  color: AppColors.textPrimary,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

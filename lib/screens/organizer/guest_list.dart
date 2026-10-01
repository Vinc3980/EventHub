import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';

import '../../models/guest_list_entry_model.dart';
import '../../services/guest_list_service.dart';
import '../../theme/app_colors.dart';
import 'send_invitations.dart';

class GuestListScreen extends StatefulWidget {
  const GuestListScreen({super.key, required this.eventId});
  final String eventId;
  @override
  State<GuestListScreen> createState() => _GuestListScreenState();
}

class _GuestListScreenState extends State<GuestListScreen> {
  final _nameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _roleController = TextEditingController();
  String? _pickedAvatarPath;
  List<GuestListEntry> _entries = const [];

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    _roleController.dispose();
    super.dispose();
  }

  bool get _hasUnsavedInput =>
      _nameController.text.trim().isNotEmpty ||
      _phoneController.text.trim().isNotEmpty ||
      _roleController.text.trim().isNotEmpty ||
      _pickedAvatarPath != null;

  Future<void> _pickAvatar() async {
    final picker = ImagePicker();
    final picked = await picker.pickImage(source: ImageSource.gallery, maxWidth: 400, maxHeight: 400, imageQuality: 80);
    if (picked != null) setState(() => _pickedAvatarPath = picked.path);
  }

  Future<void> _addContact() async {
    final name = _nameController.text.trim();
    final phone = _phoneController.text.trim();
    if (name.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Enter a name.')));
      return;
    }
    try {
      await context.read<GuestListService>().addContact(GuestListEntry(
            id: '',
            eventId: widget.eventId,
            name: name,
            phone: phone,
            role: _roleController.text.trim(),
            avatarUrl: _pickedAvatarPath ?? '',
            inviteChannel: 'link',
          ));
      if (!mounted) return;
      _nameController.clear();
      _phoneController.clear();
      _roleController.clear();
      setState(() => _pickedAvatarPath = null);
      FocusScope.of(context).unfocus();
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Could not add contact: $error')));
    }
  }

  Future<void> _removeContact(GuestListEntry entry) async {
    try {
      await context.read<GuestListService>().removeContact(entry.id);
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Could not remove contact: $error')));
    }
  }

  Future<void> _uploadCsv() async {
    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('CSV upload is coming soon.')));
  }

  Future<void> _continueToInvitations() async {
    if (_entries.isNotEmpty) { _goToInvitations(); return; }
    final proceed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Continue without adding guests?'),
        content: const Text('You have not added any guests yet. You can still send invitations with a shareable link.'),
        actions: [
          TextButton(onPressed: () => Navigator.of(context).pop(false), child: const Text('Add guests')),
          ElevatedButton(onPressed: () => Navigator.of(context).pop(true), child: const Text('Continue')),
        ],
      ),
    );
    if (proceed == true && mounted) _goToInvitations();
  }

  void _goToInvitations() {
    Navigator.of(context).push(MaterialPageRoute(builder: (_) => SendInvitationsScreen(eventId: widget.eventId)));
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: !_hasUnsavedInput,
      onPopInvokedWithResult: (didPop, _) async {
        if (didPop) return;
        final discard = await showDialog<bool>(
          context: context,
          builder: (context) => AlertDialog(
            title: const Text('Discard?'),
            content: const Text('Unsaved details will be lost.'),
            actions: [
              TextButton(onPressed: () => Navigator.of(context).pop(false), child: const Text('Keep editing')),
              ElevatedButton(onPressed: () => Navigator.of(context).pop(true), child: const Text('Discard')),
            ],
          ),
        );
        if (discard == true && context.mounted) Navigator.of(context).pop();
      },
      child: Scaffold(
        appBar: AppBar(title: const Text('Guest list')),
        body: Column(
          children: [
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
                children: [
                  const Text('Upload a CSV or add contacts one by one.', style: TextStyle(color: AppColors.textMuted, fontSize: 13)),
                  const SizedBox(height: 16),
                  SizedBox(width: double.infinity, child: OutlinedButton.icon(onPressed: _uploadCsv, icon: const Icon(Icons.upload_outlined, size: 18), label: const Text('Upload CSV'))),
                  const SizedBox(height: 20),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      GestureDetector(
                        onTap: _pickAvatar,
                        child: Container(
                          width: 56,
                          height: 56,
                          decoration: BoxDecoration(color: AppColors.skeleton, shape: BoxShape.circle, border: Border.all(color: AppColors.border), image: _pickedAvatarPath != null ? DecorationImage(image: FileImage(File(_pickedAvatarPath!)), fit: BoxFit.cover) : null),
                          child: _pickedAvatarPath == null ? const Icon(Icons.add_a_photo_outlined, size: 20, color: AppColors.textMuted) : null,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          children: [
                            Row(
                              children: [
                                Expanded(child: TextField(controller: _nameController, textCapitalization: TextCapitalization.words, textInputAction: TextInputAction.next, decoration: const InputDecoration(labelText: 'Name *'))),
                                const SizedBox(width: 10),
                                Expanded(child: TextField(controller: _phoneController, keyboardType: TextInputType.phone, decoration: const InputDecoration(labelText: 'Phone'))),
                              ],
                            ),
                            const SizedBox(height: 10),
                            Row(
                              children: [
                                Expanded(child: TextField(controller: _roleController, textCapitalization: TextCapitalization.words, decoration: const InputDecoration(labelText: 'Role / Title', hintText: 'Chairman, Speaker...'))),
                                const SizedBox(width: 10),
                                GestureDetector(
                                  onTap: _addContact,
                                  child: Container(width: 44, height: 44, decoration: BoxDecoration(color: AppColors.textPrimary, borderRadius: BorderRadius.circular(12)), child: const Icon(Icons.add, color: Colors.white, size: 20)),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  SizedBox(width: double.infinity, child: OutlinedButton.icon(onPressed: _addContact, icon: const Icon(Icons.add, size: 18), label: const Text('Add contact'))),
                  if (_pickedAvatarPath != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 8),
                      child: GestureDetector(onTap: () => setState(() => _pickedAvatarPath = null), child: const Text('Remove photo', style: TextStyle(fontSize: 12, color: AppColors.danger))),
                    ),
                  const SizedBox(height: 20),
                  StreamBuilder<List<GuestListEntry>>(
                    stream: context.read<GuestListService>().guestListForEvent(widget.eventId),
                    builder: (context, snapshot) {
                      final entries = snapshot.data ?? const [];
                      WidgetsBinding.instance.addPostFrameCallback((_) {
                        if (mounted && _entries.length != entries.length) setState(() => _entries = entries);
                      });
                      if (entries.isEmpty) {
                        return Column(children: [ _SkeletonContactRow(), const SizedBox(height: 8), _SkeletonContactRow()]);
                      }
                      return Column(
                        children: [
                          for (final entry in entries)
                            Padding(
                              padding: const EdgeInsets.only(bottom: 8),
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                                decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(16), border: Border.all(color: AppColors.border, width: 1)),
                                child: Row(
                                  children: [
                                    Container(
                                      width: 44,
                                      height: 44,
                                      decoration: BoxDecoration(
                                        color: AppColors.skeleton,
                                        shape: BoxShape.circle,
                                        image: entry.avatarUrl.isNotEmpty ? DecorationImage(image: entry.avatarUrl.startsWith('http') ? NetworkImage(entry.avatarUrl) as ImageProvider : FileImage(File(entry.avatarUrl)), fit: BoxFit.cover) : null,
                                      ),
                                      child: entry.avatarUrl.isEmpty
                                          ? Center(child: Text(entry.name.isEmpty ? '?' : entry.name[0].toUpperCase(), style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.textPrimary)))
                                          : null,
                                    ),
                                    const SizedBox(width: 12),
                                    Expanded(
                                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                        Row(
                                          children: [
                                            Expanded(child: Text(entry.name, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: AppColors.textPrimary))),
                                            if (entry.role.isNotEmpty)
                                              Container(
                                                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                                                decoration: BoxDecoration(color: AppColors.accent.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(6)),
                                                child: Text(entry.role, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.accent)),
                                              ),
                                          ],
                                        ),
                                        if (entry.phone.isNotEmpty) ...[
                                          const SizedBox(height: 2),
                                          Text(entry.phone, style: const TextStyle(fontSize: 12, color: AppColors.textMuted)),
                                        ],
                                      ]),
                                    ),
                                    GestureDetector(onTap: () => _removeContact(entry), child: const Icon(Icons.close, size: 18, color: AppColors.textMuted)),
                                  ],
                                ),
                              ),
                            ),
                        ],
                      );
                    },
                  ),
                ],
              ),
            ),
            SafeArea(child: Padding(padding: const EdgeInsets.all(20), child: SizedBox(height: 50, width: double.infinity, child: ElevatedButton(onPressed: _continueToInvitations, child: const Text('Next: send invites'))))),
          ],
        ),
      ),
    );
  }
}

class _SkeletonContactRow extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(16), border: Border.all(color: AppColors.border, width: 1)),
      child: Row(children: [
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Container(height: 12, width: 100, decoration: BoxDecoration(color: AppColors.skeleton, borderRadius: BorderRadius.circular(4))),
          const SizedBox(height: 6),
          Container(height: 10, width: 70, decoration: BoxDecoration(color: AppColors.skeleton, borderRadius: BorderRadius.circular(4))),
        ])),
        const SizedBox(width: 12),
        const Icon(Icons.close, size: 18, color: AppColors.textMuted),
      ]),
    );
  }
}

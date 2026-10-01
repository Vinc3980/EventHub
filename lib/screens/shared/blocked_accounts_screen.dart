import 'dart:io';

import 'package:flutter/material.dart';
import 'package:iconsax_plus/iconsax_plus.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../services/auth_service.dart';
import '../../theme/app_colors.dart';
import '../../theme/app_spacing.dart';

/// Accounts the signed-in user has blocked, with an Unblock action per row.
///
/// Blocking is stored on the profile (`blockedUids`) only at this stage —
/// feeds/chats are not yet filtered by it.
class BlockedAccountsScreen extends StatefulWidget {
  const BlockedAccountsScreen({super.key});

  @override
  State<BlockedAccountsScreen> createState() => _BlockedAccountsScreenState();
}

class _BlockedAccountsScreenState extends State<BlockedAccountsScreen> {
  final List<(String, Map<String, dynamic>)> _blocked = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final auth = context.read<AuthService>();
    final uid = auth.currentUid ?? '';
    final profile = await auth.fetchUserProfile(uid);
    final uids =
        List<String>.from(profile?['blockedUids'] as List? ?? const []);
    final profiles = await Future.wait(
      uids.map((id) => auth.fetchUserProfile(id)),
    );
    if (!mounted) return;
    setState(() {
      _blocked
        ..clear()
        ..addAll([
          for (var i = 0; i < uids.length; i++)
            (uids[i], profiles[i] ?? <String, dynamic>{}),
        ]);
      _loading = false;
    });
  }

  Future<void> _unblock(String targetUid) async {
    final auth = context.read<AuthService>();
    final uid = auth.currentUid ?? '';
    await auth.unblockUser(uid, targetUid);
    final name = _nameFor(targetUid);
    if (!mounted) return;
    setState(() => _blocked.removeWhere((entry) => entry.$1 == targetUid));
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Unblocked $name.')),
    );
  }

  String _nameFor(String uid) {
    for (final entry in _blocked) {
      if (entry.$1 == uid) return entry.$2['name'] as String? ?? 'user';
    }
    return 'user';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text(
          'Blocked accounts',
          style: TextStyle(fontWeight: FontWeight.w700, color: Colors.white),
        ),
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 0,
        surfaceTintColor: Colors.transparent,
        centerTitle: false,
        systemOverlayStyle: SystemUiOverlayStyle.light,
        leading: IconButton(
          icon: const Icon(IconsaxPlusLinear.arrow_left, color: Colors.white),
          onPressed: () => Navigator.of(context).maybePop(),
        ),
      ),
      body: _loading
          ? const Center(
              child: SizedBox(
                width: 24,
                height: 24,
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
            )
          : _blocked.isEmpty
              ? const Center(
                  child: Padding(
                    padding: EdgeInsets.symmetric(horizontal: 40),
                    child: Text(
                      'You haven\'t blocked anyone.',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 14,
                        height: 1.4,
                        color: AppColors.textMuted,
                      ),
                    ),
                  ),
                )
              : ListView(
                  padding: const EdgeInsets.all(AppSpacing.lg),
                  children: [
                    Container(
                      clipBehavior: Clip.antiAlias,
                      decoration: BoxDecoration(
                        color: AppColors.surface,
                        borderRadius: BorderRadius.circular(20),
                        boxShadow: [
                          BoxShadow(
                            color: AppColors.primary.withValues(alpha: 0.07),
                            blurRadius: 16,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          for (var i = 0; i < _blocked.length; i++) ...[
                            if (i > 0) const Divider(indent: 68),
                            _BlockedRow(
                              name: _blocked[i].$2['name'] as String? ??
                                  'Unknown',
                              avatarUrl:
                                  _blocked[i].$2['avatarUrl'] as String? ?? '',
                              onUnblock: () => _unblock(_blocked[i].$1),
                            ),
                          ],
                        ],
                      ),
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    const Padding(
                      padding: EdgeInsets.symmetric(horizontal: AppSpacing.xs),
                      child: Text(
                        'Blocked people can\'t interact with you until you '
                        'unblock them again.',
                        style: TextStyle(
                          fontSize: 12,
                          height: 1.4,
                          color: AppColors.textMuted,
                        ),
                      ),
                    ),
                  ],
                ),
    );
  }
}

class _BlockedRow extends StatelessWidget {
  const _BlockedRow({
    required this.name,
    required this.avatarUrl,
    required this.onUnblock,
  });

  final String name;
  final String avatarUrl;
  final VoidCallback onUnblock;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(
          AppSpacing.lg, AppSpacing.md, AppSpacing.sm, AppSpacing.md),
      child: Row(
        children: [
          _Avatar(name: name, avatarUrl: avatarUrl),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Text(
              name,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: AppColors.textPrimary,
              ),
            ),
          ),
          TextButton(
            onPressed: onUnblock,
            child: const Text(
              'Unblock',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: AppColors.primary,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// 40px circular avatar — local file path, http url, or initial fallback.
class _Avatar extends StatelessWidget {
  const _Avatar({required this.name, required this.avatarUrl});

  final String name;
  final String avatarUrl;

  @override
  Widget build(BuildContext context) {
    final initial = name.isEmpty ? '?' : name[0].toUpperCase();
    final fallback = Text(
      initial,
      style: const TextStyle(
        fontSize: 15,
        fontWeight: FontWeight.w800,
        color: AppColors.primary,
      ),
    );

    Widget? image;
    if (avatarUrl.isNotEmpty && avatarUrl.startsWith('http')) {
      image = Image.network(
        avatarUrl,
        fit: BoxFit.cover,
        width: 40,
        height: 40,
        errorBuilder: (_, __, ___) => fallback,
      );
    } else if (avatarUrl.isNotEmpty) {
      image = Image.file(
        File(avatarUrl),
        fit: BoxFit.cover,
        width: 40,
        height: 40,
        errorBuilder: (_, __, ___) => fallback,
      );
    }

    return ClipOval(
      child: Container(
        width: 40,
        height: 40,
        color: AppColors.primary.withValues(alpha: 0.08),
        alignment: Alignment.center,
        child: image ?? fallback,
      ),
    );
  }
}

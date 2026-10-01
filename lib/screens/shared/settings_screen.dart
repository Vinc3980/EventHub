import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:iconsax_plus/iconsax_plus.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';

import '../../routes/app_router.dart';
import '../../services/auth_service.dart';
import '../../theme/app_colors.dart';
import '../../theme/app_spacing.dart';
import '../../theme/app_theme.dart';
import '../../widgets/primary_button.dart';
import '../organizer/payout_settings_screen.dart';
import 'blocked_accounts_screen.dart';
import 'payment_methods_screen.dart';

/// Settings screen reachable from the profile tab via the gear icon.
///
/// Sections: account editing (name / phone / bio / photo), roles, notification
/// preferences, payments (organizer payouts + saved methods), security &
/// privacy, and the danger rows (sign out / delete account).
///
/// Rows that have no backing service method yet are rendered muted with a
/// "Soon" badge instead of pretending to work.
class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  Map<String, dynamic>? _profile;
  bool _loading = true;
  late TextEditingController _nameController;
  late TextEditingController _phoneController;
  late TextEditingController _bioController;
  final ImagePicker _picker = ImagePicker();

  @override
  void initState() {
    super.initState();
    _nameController = TextEditingController();
    _phoneController = TextEditingController();
    _bioController = TextEditingController();
    _loadProfile();
  }

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    _bioController.dispose();
    super.dispose();
  }

  Future<void> _loadProfile() async {
    final uid = context.read<AuthService>().currentUid ?? '';
    final profile = await context.read<AuthService>().fetchUserProfile(uid);
    if (!mounted) return;
    setState(() {
      _profile = profile;
      _nameController.text = profile?['name'] as String? ?? '';
      _phoneController.text = profile?['phone'] as String? ?? '';
      _bioController.text = profile?['bio'] as String? ?? '';
      _loading = false;
    });
  }

  Future<void> _saveProfile() async {
    final uid = context.read<AuthService>().currentUid ?? '';
    await context.read<AuthService>().updateProfile(
          uid: uid,
          name: _nameController.text.trim(),
          phone: _phoneController.text.trim(),
          bio: _bioController.text.trim(),
        );
    if (!mounted) return;
    await _loadProfile();
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Profile updated.')),
    );
  }

  Future<void> _pickAvatar() async {
    final picked = await _picker.pickImage(source: ImageSource.gallery);
    if (picked == null || !mounted) return;
    final uid = context.read<AuthService>().currentUid ?? '';
    // TODO: Upload to Firebase Storage in production. For now, store the
    // local file path in avatarUrl.
    await context.read<AuthService>().updateProfile(
          uid: uid,
          avatarUrl: picked.path,
        );
    if (!mounted) return;
    await _loadProfile();
  }

  Future<void> _toggleReminders(bool value) async {
    final uid = context.read<AuthService>().currentUid ?? '';
    await context.read<AuthService>().setRemindersEnabled(uid, value);
    if (!mounted) return;
    await _loadProfile();
  }

  Future<void> _setNotifPref(String key, bool value) async {
    final uid = context.read<AuthService>().currentUid ?? '';
    await context.read<AuthService>().setNotificationPref(uid, key, value);
    if (!mounted) return;
    await _loadProfile();
  }

  Future<void> _openChangePassword() async {
    final changed = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(
            top: Radius.circular(AppTheme.radiusLg)),
      ),
      builder: (ctx) => const _ChangePasswordSheet(),
    );
    if (changed == true && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Password updated.')),
      );
    }
  }

  Future<void> _addOrganizerRole() async {
    final uid = context.read<AuthService>().currentUid ?? '';
    await context.read<AuthService>().addRole(uid: uid, role: 'organizer');
    if (!mounted) return;
    await _loadProfile();
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('You can now create events.')),
    );
  }

  Future<void> _signOut() async {
    final auth = context.read<AuthService>();
    await auth.signOut();
    if (mounted) {
      AppRouter.signOutAndNavigate(context);
    }
  }

  void _confirmDeleteAccount() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete account'),
        content: const Text(
          'Account deletion is not yet implemented. '
          'This feature will be available in a future update.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('OK'),
          ),
        ],
      ),
    );
  }

  PreferredSizeWidget _appBar(String title) {
    return AppBar(
      title: Text(
        title,
        style: const TextStyle(fontWeight: FontWeight.w700, color: Colors.white),
      ),
      backgroundColor: AppColors.primary,
      foregroundColor: Colors.white,
      elevation: 0,
      scrolledUnderElevation: 0,
      surfaceTintColor: Colors.transparent,
      centerTitle: false,
      systemOverlayStyle: SystemUiOverlayStyle.light,
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return Scaffold(
        appBar: _appBar('Settings'),
        body: const Center(
          child: SizedBox(
            width: 24,
            height: 24,
            child: CircularProgressIndicator(strokeWidth: 2),
          ),
        ),
      );
    }

    final name = _profile?['name'] as String? ?? '';
    final avatarUrl = _profile?['avatarUrl'] as String? ?? '';
    final email = _profile?['email'] as String? ?? '';
    final initial = name.isEmpty ? '?' : name[0].toUpperCase();
    final roles = List<String>.from(_profile?['roles'] as List? ?? const []);
    final isOrganizer = roles.contains('organizer');
    final remindersEnabled = _profile?['remindersEnabled'] as bool? ?? true;
    final messageNotifs =
        _profile?['messageNotifsEnabled'] as bool? ?? true;
    final followerNotifs =
        _profile?['followerNotifsEnabled'] as bool? ?? true;
    final promoNotifs = _profile?['promoNotifsEnabled'] as bool? ?? false;
    final blockedCount =
        List<String>.from(_profile?['blockedUids'] as List? ?? const [])
            .length;
    final momoNumber = _profile?['savedMomoNumber'] as String? ?? '';
    final momoNetwork = _profile?['savedMomoNetwork'] as String? ?? '';

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: _appBar('Settings'),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(
            AppSpacing.lg, AppSpacing.lg, AppSpacing.lg, 32),
        children: [
          // --- Account -----------------------------------------------------
          const _SectionHeader(
            icon: IconsaxPlusLinear.user,
            title: 'Account',
          ),
          _SectionCard(
            children: [
              // Avatar with a thin primary ring.
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 20, 16, 0),
                child: Column(
                  children: [
                    GestureDetector(
                      onTap: _pickAvatar,
                      child: Container(
                        padding: const EdgeInsets.all(2.5),
                        decoration: BoxDecoration(
                          color: AppColors.surface,
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: AppColors.primary,
                            width: 1.5,
                          ),
                        ),
                        child: CircleAvatar(
                          radius: 34,
                          backgroundColor: AppColors.skeleton,
                          backgroundImage: avatarUrl.isNotEmpty &&
                                  !avatarUrl.startsWith('http')
                              ? FileImage(File(avatarUrl))
                              : null,
                          child: avatarUrl.isEmpty
                              ? Text(
                                  initial,
                                  style: const TextStyle(
                                    fontSize: 26,
                                    fontWeight: FontWeight.w800,
                                    color: AppColors.textPrimary,
                                  ),
                                )
                              : null,
                        ),
                      ),
                    ),
                    TextButton.icon(
                      onPressed: _pickAvatar,
                      icon: const Icon(IconsaxPlusLinear.camera,
                          size: 16, color: AppColors.primary),
                      label: const Text(
                        'Change photo',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          color: AppColors.primary,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const Divider(indent: 52),
              _FieldRow(
                controller: _nameController,
                hint: 'Name',
                icon: IconsaxPlusLinear.user,
                textCapitalization: TextCapitalization.words,
              ),
              const Divider(indent: 52),
              _FieldRow(
                controller: _phoneController,
                hint: 'Phone number',
                icon: IconsaxPlusLinear.call,
                keyboardType: TextInputType.phone,
              ),
              const Divider(indent: 52),
              _FieldRow(
                controller: _bioController,
                hint: 'Bio',
                icon: IconsaxPlusLinear.note,
                textCapitalization: TextCapitalization.sentences,
                maxLines: 3,
              ),
              const Divider(indent: 52),
              // Email is read-only: AuthService has no email-change method.
              Padding(
                padding:
                    const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: 4),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Padding(
                      padding: EdgeInsets.only(top: 2),
                      child: Icon(IconsaxPlusLinear.sms,
                          size: 20, color: AppColors.textMuted),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            email.isEmpty ? 'No email on file' : email,
                            style: const TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w500,
                              color: AppColors.textPrimary,
                            ),
                          ),
                          const SizedBox(height: 2),
                          const Text(
                            'Contact support to change your email.',
                            style: TextStyle(
                              fontSize: 11.5,
                              color: AppColors.textMuted,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 10),
            ],
          ),
          const SizedBox(height: 14),
          PrimaryButton(
            label: 'Save changes',
            icon: IconsaxPlusBold.tick_circle,
            onPressed: _saveProfile,
          ),

          const SizedBox(height: AppSpacing.xl),

          // --- Roles -------------------------------------------------------
          const _SectionHeader(
            icon: IconsaxPlusLinear.profile_2user,
            title: 'Roles',
          ),
          _SectionCard(
            children: [
              Padding(
                padding: const EdgeInsets.all(16),
                child: Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    for (final role in roles)
                      _RolePill(
                        label: role[0].toUpperCase() + role.substring(1),
                      ),
                  ],
                ),
              ),
              if (!isOrganizer) ...[
                const Divider(indent: 16),
                InkWell(
                  onTap: _addOrganizerRole,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 16, vertical: 15),
                    decoration: BoxDecoration(
                      color: AppColors.primary.withValues(alpha: 0.10),
                    ),
                    child: const Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(IconsaxPlusLinear.add_circle,
                            size: 18, color: AppColors.primary),
                        SizedBox(width: 8),
                        Text(
                          'Also become an organizer',
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                            color: AppColors.primary,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ],
          ),

          const SizedBox(height: AppSpacing.xl),

          // --- Notifications ----------------------------------------------
          const _SectionHeader(
            icon: IconsaxPlusLinear.notification,
            title: 'Notifications',
          ),
          _SectionCard(
            children: [
              _SwitchRow(
                title: 'Event reminders',
                subtitle:
                    'Get notified 24 hours before an event you\'re attending.',
                value: remindersEnabled,
                onChanged: _toggleReminders,
              ),
              const Divider(indent: 52),
              _SwitchRow(
                title: 'New messages',
                subtitle: 'When someone sends you a chat message.',
                value: messageNotifs,
                onChanged: (v) => _setNotifPref('messageNotifsEnabled', v),
              ),
              const Divider(indent: 52),
              _SwitchRow(
                title: 'New followers',
                subtitle: 'When someone follows your profile.',
                value: followerNotifs,
                onChanged: (v) => _setNotifPref('followerNotifsEnabled', v),
              ),
              const Divider(indent: 52),
              _SwitchRow(
                title: 'Promotions & offers',
                subtitle: 'Boosted events, discounts, and platform news.',
                value: promoNotifs,
                onChanged: (v) => _setNotifPref('promoNotifsEnabled', v),
              ),
            ],
          ),

          const SizedBox(height: AppSpacing.xl),

          // --- Payments ----------------------------------------------------
          const _SectionHeader(
            icon: IconsaxPlusLinear.card,
            title: 'Payments',
          ),
          _SectionCard(
            children: [
              if (isOrganizer) ...[
                _NavRow(
                  icon: IconsaxPlusLinear.wallet_2,
                  title: 'Payout settings',
                  subtitle: 'Bank and MoMo payout details',
                  onTap: () {
                    Navigator.of(context).push(
                      MaterialPageRoute(
                          builder: (_) => const PayoutSettingsScreen()),
                    );
                  },
                ),
                const Divider(indent: 52),
              ],
              _NavRow(
                icon: IconsaxPlusLinear.wallet,
                title: 'Payment methods',
                subtitle: momoNumber.isEmpty
                    ? 'Save your MoMo wallet'
                    : '$momoNumber · $momoNetwork',
                onTap: () async {
                  await Navigator.of(context).push(
                    MaterialPageRoute(
                        builder: (_) => const PaymentMethodsScreen()),
                  );
                  if (mounted) await _loadProfile();
                },
              ),
            ],
          ),

          const SizedBox(height: AppSpacing.xl),

          // --- Security & privacy -----------------------------------------
          const _SectionHeader(
            icon: IconsaxPlusLinear.shield,
            title: 'Security & privacy',
          ),
          _SectionCard(
            children: [
              _NavRow(
                icon: IconsaxPlusLinear.key,
                title: 'Change password',
                subtitle: 'Update your sign-in password',
                onTap: _openChangePassword,
              ),
              const Divider(indent: 52),
              _NavRow(
                icon: IconsaxPlusLinear.user_minus,
                title: 'Blocked accounts',
                subtitle: blockedCount == 0
                    ? 'None'
                    : '$blockedCount blocked',
                onTap: () async {
                  await Navigator.of(context).push(
                    MaterialPageRoute(
                        builder: (_) => const BlockedAccountsScreen()),
                  );
                  if (mounted) await _loadProfile();
                },
              ),
              const Divider(indent: 52),
              const _NavRow(
                icon: IconsaxPlusLinear.message,
                title: 'Who can message me',
                subtitle: 'Everyone',
                comingSoon: true,
              ),
            ],
          ),

          const SizedBox(height: AppSpacing.xl),

          // --- Danger rows (plain, last) ----------------------------------
          _DangerRow(
            icon: IconsaxPlusLinear.logout,
            label: 'Sign out',
            onTap: _signOut,
          ),
          _DangerRow(
            icon: IconsaxPlusLinear.trash,
            label: 'Delete account',
            onTap: _confirmDeleteAccount,
          ),
        ],
      ),
    );
  }
}

// =============================================================================
// Shared building blocks
// =============================================================================

/// 28px primary-tint circle chip + bold muted title (matches the registration
/// form section headers).
class _SectionHeader extends StatelessWidget {
  const _SectionHeader({required this.icon, required this.title});

  final IconData icon;
  final String title;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.md),
      child: Row(
        children: [
          Container(
            width: 28,
            height: 28,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.11),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, size: 16, color: AppColors.primary),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              title,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: AppColors.textMuted,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Surface card that groups rows — radius 20, no border, soft shadow.
class _SectionCard extends StatelessWidget {
  const _SectionCard({required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Container(
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
        children: children,
      ),
    );
  }
}

/// Borderless text row with a prefix icon and a focus underline that fades
/// in as primary blue (same treatment as the registration form fields).
class _FieldRow extends StatefulWidget {
  const _FieldRow({
    required this.controller,
    required this.hint,
    required this.icon,
    this.keyboardType,
    this.textCapitalization = TextCapitalization.none,
    this.maxLines = 1,
    this.obscure = false,
  });

  final TextEditingController controller;
  final String hint;
  final IconData icon;
  final TextInputType? keyboardType;
  final TextCapitalization textCapitalization;
  final int maxLines;
  final bool obscure;

  @override
  State<_FieldRow> createState() => _FieldRowState();
}

class _FieldRowState extends State<_FieldRow> {
  late final FocusNode _focus;
  bool _focused = false;
  bool _obscured = true;

  @override
  void initState() {
    super.initState();
    _focus = FocusNode();
    _focused = _focus.hasFocus;
    _focus.addListener(_onFocusChanged);
    _obscured = widget.obscure;
  }

  @override
  void dispose() {
    _focus.removeListener(_onFocusChanged);
    _focus.dispose();
    super.dispose();
  }

  void _onFocusChanged() {
    if (mounted && _focused != _focus.hasFocus) {
      setState(() => _focused = _focus.hasFocus);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          TextField(
            controller: widget.controller,
            focusNode: _focus,
            textCapitalization: widget.textCapitalization,
            keyboardType: widget.keyboardType,
            maxLines: widget.maxLines,
            obscureText: widget.obscure && _obscured,
            style: const TextStyle(fontSize: 14, color: AppColors.textPrimary),
            decoration: InputDecoration(
              hintText: widget.hint,
              isDense: true,
              filled: false,
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 4, vertical: 14),
              border: InputBorder.none,
              enabledBorder: InputBorder.none,
              focusedBorder: InputBorder.none,
              errorBorder: InputBorder.none,
              focusedErrorBorder: InputBorder.none,
              prefixIcon: Icon(
                widget.icon,
                size: 20,
                color: _focused ? AppColors.primary : AppColors.textMuted,
              ),
              prefixIconConstraints:
                  const BoxConstraints(minWidth: 36, minHeight: 20),
              suffixIcon: widget.obscure
                  ? IconButton(
                      iconSize: 18,
                      padding: EdgeInsets.zero,
                      constraints:
                          const BoxConstraints(minWidth: 36, minHeight: 36),
                      icon: Icon(
                        _obscured
                            ? IconsaxPlusLinear.eye_slash
                            : IconsaxPlusLinear.eye,
                        size: 18,
                        color: AppColors.textMuted,
                      ),
                      onPressed: () =>
                          setState(() => _obscured = !_obscured),
                    )
                  : null,
            ),
          ),
          AnimatedContainer(
            duration: const Duration(milliseconds: 150),
            curve: Curves.easeInOut,
            height: 1.5,
            margin: const EdgeInsets.only(right: 4),
            color: _focused ? AppColors.primary : Colors.transparent,
          ),
          const SizedBox(height: 6),
        ],
      ),
    );
  }
}

/// Neutral role chip (pill, no border).
class _RolePill extends StatelessWidget {
  const _RolePill({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
      decoration: BoxDecoration(
        color: AppColors.neutralBg,
        borderRadius: BorderRadius.circular(AppTheme.radiusPill),
      ),
      child: Text(
        label,
        style: const TextStyle(
          fontSize: 13,
          fontWeight: FontWeight.w600,
          color: AppColors.textPrimary,
        ),
      ),
    );
  }
}

/// Row with a leading icon chip, title / subtitle, and either a chevron,
/// a "Soon" badge, or [trailing]. Disabled rows are muted and inert.
class _NavRow extends StatelessWidget {
  const _NavRow({
    required this.icon,
    required this.title,
    this.subtitle,
    this.onTap,
    this.comingSoon = false,
  });

  final IconData icon;
  final String title;
  final String? subtitle;
  final VoidCallback? onTap;
  final bool comingSoon;

  @override
  Widget build(BuildContext context) {
    final enabled = !comingSoon && onTap != null;
    return InkWell(
      onTap: enabled ? onTap : null,
      child: Padding(
        padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.md, vertical: 12),
        child: Row(
          children: [
            Container(
              width: 32,
              height: 32,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: enabled
                    ? AppColors.primary.withValues(alpha: 0.10)
                    : AppColors.neutralBg,
                shape: BoxShape.circle,
              ),
              child: Icon(
                icon,
                size: 17,
                color: enabled ? AppColors.primary : AppColors.textMuted,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color:
                          enabled ? AppColors.textPrimary : AppColors.textMuted,
                    ),
                  ),
                  if (subtitle != null) ...[
                    const SizedBox(height: 2),
                    Text(
                      subtitle!,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 11.5,
                        color: AppColors.textMuted,
                      ),
                    ),
                  ],
                ],
              ),
            ),
            if (comingSoon)
              const _SoonBadge()
            else
              Icon(IconsaxPlusLinear.arrow_right_3,
                  size: 16, color: AppColors.textMuted),
          ],
        ),
      ),
    );
  }
}

/// Switch row — enabled only while an [onChanged] handler is provided.
class _SwitchRow extends StatelessWidget {
  const _SwitchRow({
    required this.title,
    required this.value,
    this.subtitle,
    this.onChanged,
  });

  final String title;
  final String? subtitle;
  final bool value;
  final ValueChanged<bool>? onChanged;

  @override
  Widget build(BuildContext context) {
    final enabled = onChanged != null;
    return Padding(
      padding: const EdgeInsets.fromLTRB(
          AppSpacing.md, 6, AppSpacing.md - 8, 6),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: enabled ? AppColors.textPrimary : AppColors.textMuted,
                  ),
                ),
                if (subtitle != null) ...[
                  const SizedBox(height: 2),
                  Text(
                    subtitle!,
                    style: const TextStyle(
                      fontSize: 11.5,
                      height: 1.35,
                      color: AppColors.textMuted,
                    ),
                  ),
                ],
              ],
            ),
          ),
          Switch(
            value: value,
            activeColor: AppColors.primary,
            onChanged: onChanged,
          ),
        ],
      ),
    );
  }
}

/// Small muted "Soon" pill for features without a backing service yet.
class _SoonBadge extends StatelessWidget {
  const _SoonBadge();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
      decoration: BoxDecoration(
        color: AppColors.neutralBg,
        borderRadius: BorderRadius.circular(AppTheme.radiusPill),
      ),
      child: const Text(
        'Soon',
        style: TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.3,
          color: AppColors.textMuted,
        ),
      ),
    );
  }
}

/// Plain danger row (no card) — sign out / delete account.
class _DangerRow extends StatelessWidget {
  const _DangerRow({required this.icon, required this.label, this.onTap});

  final IconData icon;
  final String label;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 14),
        child: Row(
          children: [
            Icon(icon, size: 20, color: AppColors.danger),
            const SizedBox(width: 12),
            Text(
              label,
              style: const TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w700,
                color: AppColors.danger,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Bottom sheet that verifies the current password, then swaps in a new one.
///
/// Closes with `true` after a successful update; per-field inline errors for
/// wrong current password, weak password, and mismatched confirmation.
class _ChangePasswordSheet extends StatefulWidget {
  const _ChangePasswordSheet();

  @override
  State<_ChangePasswordSheet> createState() => _ChangePasswordSheetState();
}

class _ChangePasswordSheetState extends State<_ChangePasswordSheet> {
  final _currentController = TextEditingController();
  final _newController = TextEditingController();
  final _confirmController = TextEditingController();
  bool _saving = false;
  String? _currentError;
  String? _newError;
  String? _confirmError;

  @override
  void dispose() {
    _currentController.dispose();
    _newController.dispose();
    _confirmController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final current = _currentController.text;
    final next = _newController.text;
    final confirm = _confirmController.text;

    final currentError = current.isEmpty ? 'Enter your current password.' : null;
    String? newError;
    if (next.isEmpty) {
      newError = 'Enter a new password.';
    } else if (next.length < 6) {
      newError = 'Use at least 6 characters.';
    }
    final confirmError =
        (confirm != next) ? 'Passwords don\'t match.' : null;

    if (currentError != null || newError != null || confirmError != null) {
      setState(() {
        _currentError = currentError;
        _newError = newError;
        _confirmError = confirmError;
      });
      return;
    }

    setState(() {
      _saving = true;
      _currentError = null;
      _newError = null;
      _confirmError = null;
    });

    final auth = context.read<AuthService>();
    final uid = auth.currentUid ?? '';
    try {
      await auth.changePassword(
        uid: uid,
        currentPassword: current,
        newPassword: next,
      );
    } on AuthException catch (e) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        switch (e.code) {
          case 'wrong-password':
            _currentError = e.message;
          case 'weak-password':
            _newError = e.message;
          default:
            _newError = e.message;
        }
      });
      return;
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _currentError = 'Something went wrong. Try again.';
      });
      return;
    }

    if (!mounted) return;
    HapticFeedback.selectionClick();
    Navigator.of(context).pop(true);
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding:
          EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(AppSpacing.lg, 0, AppSpacing.lg,
              AppSpacing.lg + 8),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  width: 36,
                  height: 4,
                  margin: const EdgeInsets.only(top: 10, bottom: 16),
                  decoration: BoxDecoration(
                    color: AppColors.border,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const Text(
                'Change password',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 2),
              const Text(
                'Confirm your current password, then choose a new one.',
                style: TextStyle(fontSize: 12.5, color: AppColors.textMuted),
              ),
              const SizedBox(height: AppSpacing.sm),
              Container(
                clipBehavior: Clip.antiAlias,
                decoration: BoxDecoration(
                  color: AppColors.background,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    _FieldRow(
                      controller: _currentController,
                      hint: 'Current password',
                      icon: IconsaxPlusLinear.key,
                      obscure: true,
                    ),
                    if (_currentError != null)
                      _InlineError(text: _currentError!),
                    const Divider(indent: 52),
                    _FieldRow(
                      controller: _newController,
                      hint: 'New password',
                      icon: IconsaxPlusLinear.lock_1,
                      obscure: true,
                    ),
                    if (_newError != null)
                      _InlineError(text: _newError!),
                    const Divider(indent: 52),
                    _FieldRow(
                      controller: _confirmController,
                      hint: 'Confirm new password',
                      icon: IconsaxPlusLinear.check,
                      obscure: true,
                    ),
                    if (_confirmError != null)
                      _InlineError(text: _confirmError!),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.md + 4),
              PrimaryButton(
                label: 'Update password',
                icon: IconsaxPlusBold.tick_circle,
                loading: _saving,
                onPressed: _submit,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Inline danger message under a field inside the change-password sheet.
class _InlineError extends StatelessWidget {
  const _InlineError({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(52, 0, AppSpacing.md, 8),
      child: Text(
        text,
        style: const TextStyle(
          fontSize: 12,
          height: 1.3,
          color: AppColors.danger,
        ),
      ),
    );
  }
}

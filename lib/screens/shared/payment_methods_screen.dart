import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:iconsax_plus/iconsax_plus.dart';
import 'package:provider/provider.dart';

import '../../services/auth_service.dart';
import '../../theme/app_colors.dart';
import '../../theme/app_spacing.dart';
import '../../theme/app_theme.dart';
import '../../widgets/primary_button.dart';

/// Add or edit the saved MoMo wallet number (network + number).
///
/// The number is stored on the profile only — checkout still simulates MoMo
/// payment without reading it (see `payment_screen.dart`).
class PaymentMethodsScreen extends StatefulWidget {
  const PaymentMethodsScreen({super.key});

  @override
  State<PaymentMethodsScreen> createState() => _PaymentMethodsScreenState();
}

class _PaymentMethodsScreenState extends State<PaymentMethodsScreen> {
  /// MoMo networks already modelled by the payout settings screen.
  static const List<String> _networks = [
    'MTN MoMo',
    'Vodafone Cash',
    'AirtelTigo',
  ];

  final _numberController = TextEditingController();
  String _network = _networks.first;
  bool _loading = true;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _numberController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final uid = context.read<AuthService>().currentUid ?? '';
    final profile = await context.read<AuthService>().fetchUserProfile(uid);
    if (!mounted) return;
    final number = profile?['savedMomoNumber'] as String? ?? '';
    final network = profile?['savedMomoNetwork'] as String? ?? '';
    setState(() {
      _numberController.text = number;
      if (_networks.contains(network)) _network = network;
      _loading = false;
    });
  }

  /// Digits only, max 10, grouped as `024 123 4567`.
  String _format(String input) {
    var digits = input.replaceAll(RegExp(r'\D'), '');
    if (digits.length > 10) digits = digits.substring(0, 10);
    if (digits.length <= 4) return digits;
    if (digits.length <= 7) {
      return '${digits.substring(0, 4)} ${digits.substring(4)}';
    }
    return '${digits.substring(0, 4)} '
        '${digits.substring(4, 7)} '
        '${digits.substring(7)}';
  }

  Future<void> _save() async {
    final digits = _numberController.text.replaceAll(RegExp(r'\D'), '');
    if (digits.length != 10 || !digits.startsWith('0')) {
      setState(() => _error =
          'Enter a valid 10-digit MoMo number, e.g. 024 123 4567.');
      return;
    }
    setState(() {
      _error = null;
      _saving = true;
    });
    final uid = context.read<AuthService>().currentUid ?? '';
    await context.read<AuthService>().setSavedMomo(
          uid,
          number: digits,
          network: _network,
        );
    if (!mounted) return;
    setState(() => _saving = false);
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Payment method saved.')),
    );
    Navigator.of(context).maybePop();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text(
          'Payment methods',
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
          : ListView(
              padding: const EdgeInsets.all(AppSpacing.lg),
              children: [
                Padding(
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
                        child: const Icon(IconsaxPlusLinear.wallet,
                            size: 16, color: AppColors.primary),
                      ),
                      const SizedBox(width: 10),
                      const Expanded(
                        child: Text(
                          'MoMo wallet',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                            color: AppColors.textMuted,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                Container(
                  clipBehavior: Clip.antiAlias,
                  padding: const EdgeInsets.fromLTRB(
                      AppSpacing.lg, AppSpacing.xs, AppSpacing.lg, AppSpacing.lg),
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
                      _NumberField(
                        controller: _numberController,
                        onFormat: (value) {
                          final formatted = _format(value);
                          _numberController.value = TextEditingValue(
                            text: formatted,
                            selection: TextSelection.collapsed(
                                offset: formatted.length),
                          );
                          if (_error != null) setState(() => _error = null);
                        },
                      ),
                      if (_error != null) ...[
                        const SizedBox(height: 6),
                        Text(
                          _error!,
                          style: const TextStyle(
                            fontSize: 12,
                            height: 1.3,
                            color: AppColors.danger,
                          ),
                        ),
                      ],
                      const Divider(indent: 52),
                      const Padding(
                        padding: EdgeInsets.only(top: AppSpacing.xs),
                        child: Text(
                          'Network',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: AppColors.textMuted,
                          ),
                        ),
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      Wrap(
                        spacing: AppSpacing.sm,
                        runSpacing: AppSpacing.sm,
                        children: [
                          for (final network in _networks)
                            _NetworkChip(
                              label: network,
                              selected: _network == network,
                              onTap: () =>
                                  setState(() => _network = network),
                            ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 14),
                PrimaryButton(
                  label: 'Save',
                  icon: IconsaxPlusBold.tick_circle,
                  loading: _saving,
                  onPressed: _save,
                ),
                const SizedBox(height: AppSpacing.md),
                const Text(
                  'Saved for checkout once MoMo payments go live. This stage '
                  'stores the number only — payment is still simulated '
                  'locally.',
                  style: TextStyle(
                    fontSize: 12,
                    height: 1.4,
                    color: AppColors.textMuted,
                  ),
                ),
              ],
            ),
    );
  }
}

/// Borderless phone field with a focus underline (settings field style).
class _NumberField extends StatefulWidget {
  const _NumberField({required this.controller, required this.onFormat});

  final TextEditingController controller;
  final ValueChanged<String> onFormat;

  @override
  State<_NumberField> createState() => _NumberFieldState();
}

class _NumberFieldState extends State<_NumberField> {
  late final FocusNode _focus;
  bool _focused = false;

  @override
  void initState() {
    super.initState();
    _focus = FocusNode();
    _focused = _focus.hasFocus;
    _focus.addListener(_onFocusChanged);
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
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        TextField(
          controller: widget.controller,
          focusNode: _focus,
          keyboardType: TextInputType.phone,
          inputFormatters: [
            FilteringTextInputFormatter.allow(RegExp(r'[\d ]')),
          ],
          onChanged: widget.onFormat,
          style: const TextStyle(fontSize: 14, color: AppColors.textPrimary),
          decoration: InputDecoration(
            hintText: '024 123 4567',
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
              IconsaxPlusLinear.call,
              size: 20,
              color: _focused ? AppColors.primary : AppColors.textMuted,
            ),
            prefixIconConstraints:
                const BoxConstraints(minWidth: 36, minHeight: 20),
          ),
        ),
        AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          curve: Curves.easeInOut,
          height: 1.5,
          margin: const EdgeInsets.only(right: 4),
          color: _focused ? AppColors.primary : Colors.transparent,
        ),
      ],
    );
  }
}

/// Register-style choice chip: neutralBg unselected, primary filled when
/// selected.
class _NetworkChip extends StatelessWidget {
  const _NetworkChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        decoration: BoxDecoration(
          color: selected ? AppColors.primary : AppColors.neutralBg,
          borderRadius: BorderRadius.circular(AppTheme.radiusPill),
        ),
        child: Text(
          label,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            fontSize: 13,
            fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
            color: selected ? Colors.white : AppColors.textPrimary,
          ),
        ),
      ),
    );
  }
}

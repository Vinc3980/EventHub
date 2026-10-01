import 'dart:io' show File;
import 'dart:ui' show ImageFilter;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:iconsax_plus/iconsax_plus.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../models/event_model.dart';
import '../../models/registration_model.dart';
import '../../services/auth_service.dart';
import '../../services/discount_service.dart';
import '../../services/event_service.dart';
import '../../services/registration_service.dart';
import '../../theme/app_colors.dart';
import '../../theme/app_spacing.dart';
import '../../theme/app_theme.dart';
import '../../widgets/primary_button.dart';
import '../../widgets/shimmer_skeleton.dart';
import 'booking_confirmation_screen.dart';
import 'payment_screen.dart';

class RegistrationFormScreen extends StatefulWidget {
  const RegistrationFormScreen({
    super.key,
    required this.eventId,
    required this.ticketType,
  });

  final String eventId;
  final String ticketType;

  @override
  State<RegistrationFormScreen> createState() => _RegistrationFormScreenState();
}

class _RegistrationFormScreenState extends State<RegistrationFormScreen> {
  final _formKey = GlobalKey<FormState>();
  final _fullNameController = TextEditingController();
  final _hometownController = TextEditingController();
  final _locationController = TextEditingController();
  final _addressController = TextEditingController();
  final _denominationController = TextEditingController();
  final _religionController = TextEditingController();
  final _discountController = TextEditingController();

  final _fullNameFocus = FocusNode();
  final _hometownFocus = FocusNode();
  final _locationFocus = FocusNode();
  final _addressFocus = FocusNode();
  final _denominationFocus = FocusNode();
  final _religionFocus = FocusNode();
  final _discountFocus = FocusNode();
  final _scrollController = ScrollController();

  int _guestCount = 0;
  String _gender = '';
  String _attendeeType = '';
  bool _loading = false;
  bool _footerShadow = false;

  // Event/ticket summary state
  Event? _event;
  EventTicket? _ticket;
  bool _eventLoading = true;

  // Discount state
  String? _appliedDiscountId;
  double? _appliedDiscountPercent;
  double? _appliedDiscountAmount;
  String? _discountError;
  bool _discountApplied = false;
  bool _discountLoading = false;
  bool _suppressDiscountReset = false;

  static const List<String> _genders = [
    'Male',
    'Female',
    'Non-binary',
    'Prefer not to say',
  ];
  static const List<String> _attendeeTypes = [
    'Family',
    'Friend',
    'Colleague',
    'VIP',
    'Vendor',
    'Other',
  ];

  static const _errorStyle = TextStyle(
    fontSize: 12,
    height: 1.3,
    color: AppColors.danger,
  );

  @override
  void initState() {
    super.initState();
    _discountFocus.addListener(_onDiscountFocusChanged);
    _discountController.addListener(_onDiscountTextChanged);
    _scrollController.addListener(_onScrollChanged);
    _loadEvent();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _onScrollChanged();
    });
  }

  @override
  void dispose() {
    _discountFocus.removeListener(_onDiscountFocusChanged);
    _discountFocus.dispose();
    _discountController.removeListener(_onDiscountTextChanged);
    _discountController.dispose();
    _scrollController.removeListener(_onScrollChanged);
    _scrollController.dispose();
    _fullNameController.dispose();
    _hometownController.dispose();
    _locationController.dispose();
    _addressController.dispose();
    _denominationController.dispose();
    _religionController.dispose();
    _fullNameFocus.dispose();
    _hometownFocus.dispose();
    _locationFocus.dispose();
    _addressFocus.dispose();
    _denominationFocus.dispose();
    _religionFocus.dispose();
    super.dispose();
  }

  /// Shared ticket lookup for the summary card, price summary, CTA label
  /// and [_submit] — one helper so they can never disagree.
  EventTicket? _findTicket(Event? event) {
    if (event == null) return null;
    for (final t in event.ticketTypes) {
      if (t.name == widget.ticketType) return t;
    }
    return null;
  }

  Future<void> _loadEvent() async {
    final eventService = context.read<EventService>();
    try {
      final event = await eventService.getEvent(widget.eventId);
      if (!mounted) return;
      setState(() {
        _event = event;
        _ticket = _findTicket(event);
        _eventLoading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _eventLoading = false);
    }
  }

  void _onDiscountFocusChanged() {
    if (mounted) setState(() {});
  }

  /// Editing the code after it was applied resets the applied state so the
  /// price can never stay discounted against a changed (unvalidated) code.
  void _onDiscountTextChanged() {
    if (_suppressDiscountReset) return;
    if (_discountApplied ||
        _appliedDiscountId != null ||
        _appliedDiscountAmount != null) {
      setState(_resetDiscountState);
    }
  }

  void _resetDiscountState() {
    _appliedDiscountId = null;
    _appliedDiscountPercent = null;
    _appliedDiscountAmount = null;
    _discountApplied = false;
  }

  void _removeDiscount() {
    setState(() {
      _suppressDiscountReset = true;
      _discountController.clear();
      _suppressDiscountReset = false;
      _discountError = null;
      _resetDiscountState();
    });
  }

  /// Shows the footer's scroll shadow/divider whenever there is form content
  /// still scrollable beneath the sticky submit bar.
  void _onScrollChanged() {
    if (!mounted || !_scrollController.hasClients) return;
    final show = _scrollController.position.extentAfter > 0;
    if (show != _footerShadow) setState(() => _footerShadow = show);
  }

  bool get _isValid =>
      _fullNameController.text.trim().isNotEmpty &&
      _hometownController.text.trim().isNotEmpty &&
      _locationController.text.trim().isNotEmpty &&
      _addressController.text.trim().isNotEmpty &&
      _gender.isNotEmpty &&
      _attendeeType.isNotEmpty;

  double _discountedPrice(double original) {
    if (_appliedDiscountPercent != null) {
      return (original * (1 - _appliedDiscountPercent! / 100)).floorToDouble();
    }
    if (_appliedDiscountAmount != null) {
      return (original - _appliedDiscountAmount!).clamp(0, original).toDouble();
    }
    return original;
  }

  /// Scrolls the first incomplete text field into view and focuses it.
  /// Returns true when a text field was focused.
  bool _focusFirstInvalidTextField() {
    final entries = <(FocusNode, TextEditingController)>[
      (_fullNameFocus, _fullNameController),
      (_hometownFocus, _hometownController),
      (_locationFocus, _locationController),
      (_addressFocus, _addressController),
    ];
    for (final (node, controller) in entries) {
      if (controller.text.trim().isEmpty) {
        node.requestFocus();
        return true;
      }
    }
    return false;
  }

  Future<void> _validateDiscount() async {
    final code = _discountController.text.trim();
    if (code.isEmpty) return;

    setState(() {
      _discountLoading = true;
      _discountError = null;
      _discountApplied = false;
      _appliedDiscountId = null;
      _appliedDiscountPercent = null;
      _appliedDiscountAmount = null;
    });

    try {
      final discountService = context.read<DiscountService>();
      final discount = await discountService.validateCode(widget.eventId, code);
      if (!mounted) return;
      setState(() {
        _appliedDiscountId = discount.id;
        _appliedDiscountPercent = discount.percentOff;
        _appliedDiscountAmount = discount.amountOff;
        _discountApplied = true;
        _discountError = null;
        _discountLoading = false;
      });
    } on InvalidCodeException catch (e) {
      if (!mounted) return;
      setState(() {
        _discountError = e.message;
        _discountApplied = false;
        _discountLoading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _discountError = 'Could not validate discount code.';
        _discountApplied = false;
        _discountLoading = false;
      });
    }
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate() || !_isValid) {
      if (!_focusFirstInvalidTextField()) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Please fill all required fields.')),
        );
      }
      return;
    }

    setState(() => _loading = true);
    try {
      final uid = context.read<AuthService>().currentUid ?? '';
      final registration = Registration(
        id: '',
        eventId: widget.eventId,
        userId: uid,
        fullName: _fullNameController.text.trim(),
        invitedGuestCount: _guestCount,
        hometown: _hometownController.text.trim(),
        currentLocation: _locationController.text.trim(),
        residentialAddress: _addressController.text.trim(),
        denomination: _denominationController.text.trim(),
        religion: _religionController.text.trim(),
        gender: _gender,
        attendeeType: _attendeeType,
        ticketType: widget.ticketType,
      );

      final regService = context.read<RegistrationService>();
      final regId = await regService.submitRegistration(registration);

      if (!mounted) return;

      final eventService = context.read<EventService>();
      final event = await eventService.getEvent(widget.eventId);
      final ticket = _findTicket(event);
      if (!mounted) return;

      // effectivePrice (not price) so early-bird pricing flows into the
      // payment amount and the originalAmount shown on PaymentScreen.
      if (ticket != null && ticket.effectivePrice > 0) {
        final finalAmount = _discountedPrice(ticket.effectivePrice);
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(
            builder: (_) => PaymentScreen(
              eventId: widget.eventId,
              regId: regId,
              userId: uid,
              amount: finalAmount,
              originalAmount: ticket.effectivePrice,
              discountCodeId: _appliedDiscountId,
            ),
          ),
        );
      } else {
        final booking = await regService.confirmFreeBooking(
          regId: regId,
          eventId: widget.eventId,
          userId: uid,
          discountCodeId: _appliedDiscountId,
        );
        if (!mounted) return;
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(
            builder: (_) => BookingConfirmationScreen(bookingId: booking.id),
          ),
        );
      }
    } on SoldOutException catch (error) {
      if (!mounted) return;
      setState(() => _loading = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(error.message),
          backgroundColor: AppColors.danger,
        ),
      );
    } catch (error) {
      if (!mounted) return;
      setState(() => _loading = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Registration failed: $error')),
      );
    }
  }

  String _money(double value) => 'GHS ${value.toStringAsFixed(2)}';

  /// Calm, one-shot entry motion: fade + 3% slideY, 60ms stagger, skipped
  /// entirely when the OS asks for reduced motion.
  Widget _stagger(Widget child, int index) {
    if (!mounted) return child;
    if (MediaQuery.of(context).disableAnimations) return child;
    return child
        .animate(delay: Duration(milliseconds: 60 * index))
        .fadeIn(duration: 250.ms)
        .slideY(begin: 0.03, end: 0);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.backgroundTinted,
      appBar: AppBar(
        title: const Text(
          'Register',
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
      body: Column(
        children: [
          Expanded(
            child: SingleChildScrollView(
              controller: _scrollController,
              keyboardDismissBehavior:
                  ScrollViewKeyboardDismissBehavior.onDrag,
              padding: EdgeInsets.fromLTRB(
                  AppSpacing.lg, 0, AppSpacing.lg, AppSpacing.xl),
              child: Form(
                key: _formKey,
                autovalidateMode: AutovalidateMode.onUserInteraction,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Cobalt header band: first child of the scroll view, so
                    // it scrolls away while the solid app bar stays put.
                    Stack(
                      clipBehavior: Clip.none,
                      children: [
                        // Full-bleed band: Positioned with negative insets
                        // paints past the scroll padding (Stack clip is off),
                        // so the cobalt band continues the app bar edge-to-edge.
                        // Do not use Align/OverflowBox here — they expand to
                        // fill the parent, which is unbounded inside a
                        // vertical scroll view, and blow up with an infinite
                        // size assertion during layout.
                        Positioned(
                          left: -AppSpacing.lg,
                          right: -AppSpacing.lg,
                          top: 0,
                          height: EventHeaderBand.defaultHeight,
                          child: EventHeaderBand(event: _event),
                        ),
                        // White summary card overlaps the band's lower edge,
                        // leaving ~76px of the photo band visible above it.
                        Padding(
                          padding: const EdgeInsets.only(top: 76),
                          child: SizedBox(
                            width: double.infinity,
                            child: _buildSummarySlot(),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.xl),

                    // ── Section: Your details ──
                    _stagger(
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          const _SectionHeader(
                            icon: IconsaxPlusLinear.user,
                            title: 'Your details',
                          ),
                          _SectionCard(
                            children: [
                              _FieldRow(
                                controller: _fullNameController,
                                focusNode: _fullNameFocus,
                                hint: 'Full name',
                                icon: IconsaxPlusLinear.user,
                                textCapitalization:
                                    TextCapitalization.words,
                                validator: (_) => _fullNameController
                                        .text
                                        .trim()
                                        .isEmpty
                                    ? 'Add your full name'
                                    : null,
                              ),
                              const Divider(indent: 52),
                              _FieldRow(
                                controller: _hometownController,
                                focusNode: _hometownFocus,
                                hint: 'Hometown',
                                icon: IconsaxPlusLinear.flag,
                                textCapitalization:
                                    TextCapitalization.words,
                                validator: (_) => _hometownController
                                        .text
                                        .trim()
                                        .isEmpty
                                    ? 'Add your hometown'
                                    : null,
                              ),
                              const Divider(indent: 52),
                              _FieldRow(
                                controller: _locationController,
                                focusNode: _locationFocus,
                                hint: 'Current location',
                                icon: IconsaxPlusLinear.location,
                                textCapitalization:
                                    TextCapitalization.words,
                                validator: (_) => _locationController
                                        .text
                                        .trim()
                                        .isEmpty
                                    ? 'Add your current location'
                                    : null,
                              ),
                              const Divider(indent: 52),
                              _FieldRow(
                                controller: _addressController,
                                focusNode: _addressFocus,
                                hint: 'Residential address',
                                icon: IconsaxPlusLinear.map,
                                textCapitalization:
                                    TextCapitalization.words,
                                validator: (_) => _addressController
                                        .text
                                        .trim()
                                        .isEmpty
                                    ? 'Add your address'
                                    : null,
                              ),
                            ],
                          ),
                        ],
                      ),
                      1,
                    ),
                    const SizedBox(height: AppSpacing.xl),

                    // ── Section: About you ──
                    _stagger(
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          const _SectionHeader(
                            icon: IconsaxPlusLinear.heart,
                            title: 'About you',
                          ),
                          _SectionCard(
                            children: [
                              _FieldRow(
                                controller: _denominationController,
                                focusNode: _denominationFocus,
                                hint: 'Denomination',
                                icon: IconsaxPlusLinear.building,
                                optional: true,
                                textCapitalization:
                                    TextCapitalization.words,
                                validator: (_) => null,
                              ),
                              const Divider(indent: 52),
                              _FieldRow(
                                controller: _religionController,
                                focusNode: _religionFocus,
                                hint: 'Religion',
                                icon: IconsaxPlusLinear.book,
                                optional: true,
                                textCapitalization:
                                    TextCapitalization.words,
                                validator: (_) => null,
                              ),
                              const Divider(indent: 52),
                              _ChoiceChips(
                                value: _gender,
                                label: 'Gender',
                                icon: IconsaxPlusLinear.personalcard,
                                options: _genders,
                                onSelected: (v) =>
                                    setState(() => _gender = v),
                                validator: (v) =>
                                    (v == null || v.isEmpty)
                                        ? 'Choose one.'
                                        : null,
                              ),
                            ],
                          ),
                          const Padding(
                            padding: EdgeInsets.only(top: AppSpacing.sm),
                            child: _PrivacyLine(),
                          ),
                        ],
                      ),
                      2,
                    ),
                    const SizedBox(height: AppSpacing.xl),

                    // ── Section: Your visit ──
                    _stagger(
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          const _SectionHeader(
                            icon: IconsaxPlusLinear.calendar,
                            title: 'Your visit',
                          ),
                          _SectionCard(
                            children: [
                              _buildGuestsRow(),
                              const Divider(indent: 52),
                              _ChoiceChips(
                                value: _attendeeType,
                                label: 'Attendee type',
                                icon: IconsaxPlusLinear.tag_user,
                                options: _attendeeTypes,
                                onSelected: (v) =>
                                    setState(() => _attendeeType = v),
                                validator: (v) =>
                                    (v == null || v.isEmpty)
                                        ? 'Choose one.'
                                        : null,
                              ),
                            ],
                          ),
                        ],
                      ),
                      3,
                    ),

                    // ── Section: Discount ──
                    if (!(_ticket != null &&
                        _ticket!.effectivePrice == 0)) ...[
                      const SizedBox(height: AppSpacing.xl),
                      _stagger(
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            const _SectionHeader(
                              icon: IconsaxPlusLinear.ticket_discount,
                              title: 'Have a discount code?',
                            ),
                            _SectionCard(
                              children: [_buildDiscountRow()],
                            ),
                          ],
                        ),
                        4,
                      ),
                    ],

                    // ── Order summary (paid tickets only) ──
                    if (_ticket != null && _ticket!.effectivePrice > 0) ...[
                      const SizedBox(height: AppSpacing.xl),
                      _stagger(
                        _buildPriceSummary(),
                        5,
                      ),
                    ],

                    const SizedBox(height: AppSpacing.xl),
                  ],
                ),
              ),
            ),
          ),

          // Sticky submit bar with scroll shadow/divider.
          _buildStickyFooter(),
        ],
      ),
    );
  }

  // ─── Event summary card ─────────────────────────────────────────────────

  Widget _buildSummarySlot() {
    if (_eventLoading) {
      return ShimmerSkeleton.box(height: 96, radius: 20);
    }
    final event = _event;
    if (event == null) return const SizedBox.shrink();
    return _stagger(_EventSummaryCard(event: event, ticket: _ticket), 0);
  }

  // ─── Guests stepper row ─────────────────────────────────────────────────

  Widget _buildGuestsRow() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(
          AppSpacing.lg, AppSpacing.md, AppSpacing.lg, AppSpacing.md),
      child: Row(
        children: [
          const Icon(IconsaxPlusLinear.people,
              size: 20, color: AppColors.textMuted),
          const SizedBox(width: 10),
          const Expanded(
            child: Text(
              "Guests you're bringing",
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(fontSize: 14, color: AppColors.textMuted),
            ),
          ),
          const SizedBox(width: 8),
          Container(
            padding: const EdgeInsets.all(4),
            decoration: const BoxDecoration(
              color: AppColors.neutralBg,
              borderRadius: BorderRadius.all(Radius.circular(100)),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                _StepButton(
                  icon: IconsaxPlusLinear.minus,
                  enabled: _guestCount > 0,
                  filled: false,
                  onTap: () {
                    HapticFeedback.selectionClick();
                    setState(() => _guestCount--);
                  },
                ),
                SizedBox(
                  width: 28,
                  child: AnimatedSwitcher(
                    duration: const Duration(milliseconds: 150),
                    switchInCurve: Curves.easeOut,
                    transitionBuilder: (child, animation) =>
                        FadeTransition(opacity: animation, child: child),
                    child: Text(
                      key: ValueKey(_guestCount),
                      '$_guestCount',
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: AppColors.textPrimary,
                      ),
                    ),
                  ),
                ),
                _StepButton(
                  icon: IconsaxPlusLinear.add,
                  enabled: true,
                  filled: true,
                  onTap: () {
                    HapticFeedback.selectionClick();
                    setState(() => _guestCount++);
                  },
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ─── Discount row ───────────────────────────────────────────────────────

  Widget _buildDiscountRow() {
    if (_discountApplied) {
      final original = _ticket?.effectivePrice;
      final saving = original == null
          ? null
          : original - _discountedPrice(original);
      return Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Container(
          padding:
              const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: 4),
          decoration: BoxDecoration(
            color: AppColors.success.withValues(alpha: 0.08),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Row(
            children: [
              const Icon(IconsaxPlusBold.tick_circle,
                  size: 20, color: AppColors.success),
              const SizedBox(width: 8),
              Expanded(
                child: Row(
                  children: [
                    Flexible(
                      child: Text(
                        _discountController.text.trim(),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: AppColors.textPrimary,
                        ),
                      ),
                    ),
                    if (saving != null && saving > 0) ...[
                      const SizedBox(width: 6),
                      Text(
                        '- ${_money(saving)}',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: AppColors.success,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              TextButton(
                onPressed: _removeDiscount,
                style: TextButton.styleFrom(
                  foregroundColor: AppColors.textMuted,
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  minimumSize: Size.zero,
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
                child: const Text('Remove',
                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
              ),
            ],
          ),
        ),
      );
    }

    return Padding(
      padding: const EdgeInsets.fromLTRB(
          AppSpacing.lg, AppSpacing.sm, AppSpacing.lg, AppSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              const Icon(IconsaxPlusLinear.ticket_discount,
                  size: 20, color: AppColors.textMuted),
              const SizedBox(width: 8),
              Expanded(
                child: TextField(
                  controller: _discountController,
                  focusNode: _discountFocus,
                  textCapitalization: TextCapitalization.characters,
                  style: const TextStyle(
                      fontSize: 14, color: AppColors.textPrimary),
                  decoration: const InputDecoration(
                    hintText: 'Discount code',
                    isDense: true,
                    border: InputBorder.none,
                    enabledBorder: InputBorder.none,
                    focusedBorder: InputBorder.none,
                    errorBorder: InputBorder.none,
                    focusedErrorBorder: InputBorder.none,
                    filled: false,
                    contentPadding:
                        EdgeInsets.symmetric(horizontal: 4, vertical: 12),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              TextButton(
                onPressed: _discountLoading ? null : _validateDiscount,
                style: TextButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.white,
                  disabledBackgroundColor: AppColors.border,
                  disabledForegroundColor: AppColors.surface,
                  padding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                  minimumSize: Size.zero,
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(AppTheme.radiusPill),
                  ),
                ),
                child: _discountLoading
                    ? const SizedBox(
                        width: 14,
                        height: 14,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white),
                      )
                    : const Text('Apply',
                        style: TextStyle(
                            fontSize: 13, fontWeight: FontWeight.w700)),
              ),
            ],
          ),
          if (_discountError != null) ...[
            const SizedBox(height: 6),
            Row(
              children: [
                const Icon(IconsaxPlusLinear.close_circle,
                    size: 14, color: AppColors.danger),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    _discountError!,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: _errorStyle,
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  // ─── Price summary card ─────────────────────────────────────────────────

  Widget _buildPriceSummary() {
    final ticket = _ticket!;
    final original = ticket.effectivePrice;
    final total = _discountedPrice(original);
    final showDiscount = _discountApplied && original - total > 0;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const _SectionHeader(
          icon: IconsaxPlusLinear.ticket,
          title: 'Summary',
        ),
        _SectionCard(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(
                  AppSpacing.lg, AppSpacing.md, AppSpacing.lg, AppSpacing.sm),
              child: _SummaryRow(label: ticket.name, value: _money(original)),
            ),
            if (showDiscount)
              Padding(
                padding: const EdgeInsets.fromLTRB(
                    AppSpacing.lg, 0, AppSpacing.lg, AppSpacing.sm),
                child: _SummaryRow(
                  label: 'Discount',
                  value: '- ${_money(original - total)}',
                  valueColor: AppColors.success,
                ),
              ),
            const Divider(indent: 52),
            Padding(
              padding: const EdgeInsets.fromLTRB(
                  AppSpacing.lg, AppSpacing.sm, AppSpacing.lg, AppSpacing.md),
              child: _SummaryRow(
                label: 'Total',
                value: _money(total),
                emphasized: true,
              ),
            ),
          ],
        ),
      ],
    );
  }

  // ─── Sticky footer ──────────────────────────────────────────────────────

  String get _ctaLabel {
    final ticket = _ticket;
    if (ticket == null) return 'Continue';
    if (ticket.effectivePrice <= 0) return 'Confirm registration';
    final total = _discountedPrice(ticket.effectivePrice);
    return 'Continue to payment · ${_money(total)}';
  }

  Widget _buildStickyFooter() {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        border: Border(
          top: BorderSide(
            color: _footerShadow ? AppColors.border : Colors.transparent,
            width: 1,
          ),
        ),
        boxShadow: _footerShadow
            ? [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.06),
                  offset: const Offset(0, -4),
                  blurRadius: 12,
                ),
              ]
            : const [],
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(
              AppSpacing.xl, AppSpacing.lg, AppSpacing.xl, AppSpacing.lg),
          child: PrimaryButton(
            label: _ctaLabel,
            loading: _loading,
            onPressed: _submit,
          ),
        ),
      ),
    );
  }
}

// =============================================================================
// Shared rich header band (also used by BookingConfirmationScreen)
// =============================================================================

/// Full-bleed cobalt band (132px, rounded bottom) with the event's cover
/// image painted across it, blurred into atmosphere and flat-tinted with
/// [AppColors.primary] on top, so the header stays on-brand while feeling
/// specific to the event.
///
/// Falls back to the flat cobalt band whenever there is no usable image:
/// event still loading, empty [Event.coverImageUrl], a video URL, a path
/// that no longer resolves, or a decode failure — never a broken-image
/// glyph or a grey box.
///
/// NOTE: this widget has a fixed [height] and must sit inside a `Positioned`
/// (or other bounded parent). Never wrap it in an `Align`/`OverflowBox` inside
/// a scroll view — see the register screen's header comment about infinite
/// size assertions.
class EventHeaderBand extends StatelessWidget {
  const EventHeaderBand(
      {super.key, required this.event, this.height = defaultHeight});

  /// Tall enough that ~76px of photo still shows above the overlapping white
  /// card on a typical phone width, so the cover is legible rather than a
  /// smear (the card covers the lower ~56px, including the rounded corners).
  static const double defaultHeight = 132;

  final Event? event;
  final double height;

  /// The image is overdrawn past the band edges before blurring, so the
  /// blur never bleeds transparent pixels in from outside the photo.
  /// Kept ≥ 3× [_sigma] so the visible area stays artifact-free.
  static const double _overdraw = 24;

  /// Near-photo blur — deliberately tiny so stage lighting, faces and
  /// hard edges still read as *this* photo (concert vs wedding vs
  /// conference), not a soft colour wash. Tune this before the tint: blur
  /// decides "can I tell what this is", tint decides "is it cobalt".
  static const double _sigma = 1.5;

  /// Flat cobalt tint (not a gradient): enough for an obvious brand cast,
  /// light enough that the photo's own colours stay dominant.
  static const double _tintAlpha = 0.28;

  @override
  Widget build(BuildContext context) {
    final event = this.event;
    final url = event?.coverImageUrl ?? '';
    final showImage = event != null && url.isNotEmpty && !event.isVideoUrl;

    // Decode at roughly the band's rendered pixel size instead of the
    // photo's full resolution.
    final dpr = MediaQuery.devicePixelRatioOf(context);
    final bandWidth = MediaQuery.sizeOf(context).width + _overdraw * 2;
    final bandHeight = height + _overdraw * 2;

    return SizedBox(
      height: height,
      child: ClipRRect(
        borderRadius:
            const BorderRadius.vertical(bottom: Radius.circular(28)),
        child: Stack(
          fit: StackFit.expand,
          children: [
            // Flat cobalt base — also what the image fallback reveals.
            const ColoredBox(color: AppColors.primary),
            if (showImage)
              Positioned(
                left: -_overdraw,
                right: -_overdraw,
                top: -_overdraw,
                bottom: -_overdraw,
                child: ImageFiltered(
                  imageFilter:
                      ImageFilter.blur(sigmaX: _sigma, sigmaY: _sigma),
                  child: _coverImage(
                    url,
                    cacheWidth: (bandWidth * dpr).round(),
                    cacheHeight: (bandHeight * dpr).round(),
                  ),
                ),
              ),
            ColoredBox(color: AppColors.primary.withValues(alpha: _tintAlpha)),
          ],
        ),
      ),
    );
  }

  Widget _coverImage(String url, {required int cacheWidth, required int cacheHeight}) {
    if (url.startsWith('http')) {
      return Image.network(
        url,
        fit: BoxFit.cover,
        cacheWidth: cacheWidth,
        cacheHeight: cacheHeight,
        errorBuilder: (_, __, ___) => const SizedBox.shrink(),
      );
    }
    // Local file covers (mirrors the event page's cover handling).
    return Image.file(
      File(url),
      fit: BoxFit.cover,
      cacheWidth: cacheWidth,
      cacheHeight: cacheHeight,
      errorBuilder: (_, __, ___) => const SizedBox.shrink(),
    );
  }
}

// =============================================================================
// Event summary card
// =============================================================================

/// Shows which event and tier the person is registering for. Silently hidden
/// when the event failed to load — the form still works without it.
class _EventSummaryCard extends StatelessWidget {
  const _EventSummaryCard({required this.event, this.ticket});

  final Event event;
  final EventTicket? ticket;

  @override
  Widget build(BuildContext context) {
    final dateLabel = DateFormat('EEE, d MMM yyyy').format(event.date);
    final effective = ticket?.effectivePrice;
    final priceLabel = effective == null
        ? (event.isFree ? 'Free' : null)
        : effective == 0
            ? 'Free'
            : 'GHS ${effective.toStringAsFixed(2)}';

    return Container(
      padding: const EdgeInsets.all(12),
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
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _thumbnail(),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  event.title,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 6),
                Row(
                  children: [
                    Flexible(
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(IconsaxPlusLinear.calendar,
                              size: 14, color: AppColors.textMuted),
                          const SizedBox(width: 4),
                          Flexible(
                            child: Text(
                              dateLabel,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                  fontSize: 12, color: AppColors.textMuted),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 12),
                    Flexible(
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(IconsaxPlusLinear.location,
                              size: 14, color: AppColors.textMuted),
                          const SizedBox(width: 4),
                          Flexible(
                            child: Text(
                              event.venue,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                  fontSize: 12, color: AppColors.textMuted),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: [
                    if (ticket != null)
                      _Pill(
                        label: ticket!.name,
                        background: AppColors.primary.withValues(alpha: 0.10),
                        foreground: AppColors.primary,
                      ),
                    if (priceLabel != null)
                      _Pill(
                        label: priceLabel,
                        background: AppColors.neutralBg,
                        foreground: AppColors.textPrimary,
                      ),
                    if (ticket?.hasEarlyBird == true)
                      const _Pill(
                        label: 'Early-bird',
                        background: AppColors.successBg,
                        foreground: AppColors.success,
                      ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _thumbnail() {
    const fallback = _CoverFallback();
    final url = event.coverImageUrl;
    if (url.isEmpty || event.isVideoUrl) return fallback;
    return ClipRRect(
      borderRadius: BorderRadius.circular(14),
      child: Image.network(
        url,
        width: 64,
        height: 64,
        fit: BoxFit.cover,
        errorBuilder: (_, __, ___) => fallback,
      ),
    );
  }
}

class _CoverFallback extends StatelessWidget {
  const _CoverFallback();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 64,
      height: 64,
      decoration: BoxDecoration(
        color: AppColors.primary.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(14),
      ),
      child: const Icon(IconsaxPlusLinear.calendar,
          size: 24, color: AppColors.primary),
    );
  }
}

class _Pill extends StatelessWidget {
  const _Pill({
    required this.label,
    required this.background,
    required this.foreground,
  });

  final String label;
  final Color background;
  final Color foreground;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(AppTheme.radiusPill),
      ),
      child: Text(
        label,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w700,
          color: foreground,
        ),
      ),
    );
  }
}

// =============================================================================
// Section header + grouped card
// =============================================================================

/// 28px primary-tint circle chip + bold muted title (matches the Stage Y
/// section-icon treatment on the event page).
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

/// Surface card that groups form rows — radius 20, no border, soft shadow.
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

// =============================================================================
// Borderless field row with focus/error underline
// =============================================================================

class _FieldRow extends FormField<String> {
  _FieldRow({
    required TextEditingController controller,
    required FocusNode focusNode,
    required String hint,
    required IconData icon,
    bool optional = false,
    TextCapitalization textCapitalization = TextCapitalization.none,
    super.validator,
  }) : super(
          builder: (state) => _FieldRowView(
            state: state,
            controller: controller,
            focusNode: focusNode,
            hint: hint,
            icon: icon,
            optional: optional,
            textCapitalization: textCapitalization,
          ),
        );
}

class _FieldRowView extends StatefulWidget {
  const _FieldRowView({
    required this.state,
    required this.controller,
    required this.focusNode,
    required this.hint,
    required this.icon,
    required this.optional,
    required this.textCapitalization,
  });

  final FormFieldState<String> state;
  final TextEditingController controller;
  final FocusNode focusNode;
  final String hint;
  final IconData icon;
  final bool optional;
  final TextCapitalization textCapitalization;

  @override
  State<_FieldRowView> createState() => _FieldRowViewState();
}

class _FieldRowViewState extends State<_FieldRowView> {
  bool _focused = false;

  @override
  void initState() {
    super.initState();
    widget.focusNode.addListener(_onFocusChanged);
    _focused = widget.focusNode.hasFocus;
  }

  @override
  void dispose() {
    widget.focusNode.removeListener(_onFocusChanged);
    super.dispose();
  }

  void _onFocusChanged() {
    if (mounted && _focused != widget.focusNode.hasFocus) {
      setState(() => _focused = widget.focusNode.hasFocus);
    }
  }

  @override
  Widget build(BuildContext context) {
    final hasError = widget.state.hasError;
    final iconColor = hasError
        ? AppColors.danger
        : _focused
            ? AppColors.primary
            : AppColors.textMuted;
    final underlineColor = hasError
        ? AppColors.danger
        : _focused
            ? AppColors.primary
            : Colors.transparent;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: widget.controller,
                  focusNode: widget.focusNode,
                  textCapitalization: widget.textCapitalization,
                  style: const TextStyle(
                      fontSize: 14, color: AppColors.textPrimary),
                  onChanged: widget.state.didChange,
                  decoration: InputDecoration(
                    hintText: widget.hint,
                    isDense: true,
                    filled: false,
                    contentPadding: const EdgeInsets.symmetric(
                        horizontal: 4, vertical: 14),
                    border: InputBorder.none,
                    enabledBorder: InputBorder.none,
                    focusedBorder: InputBorder.none,
                    errorBorder: InputBorder.none,
                    focusedErrorBorder: InputBorder.none,
                    prefixIcon: Icon(widget.icon, size: 20, color: iconColor),
                    prefixIconConstraints:
                        const BoxConstraints(minWidth: 36, minHeight: 20),
                  ),
                ),
              ),
              if (widget.optional)
                const Padding(
                  padding: EdgeInsets.only(left: 8, right: 4),
                  child: Text(
                    'Optional',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(fontSize: 12, color: AppColors.textMuted),
                  ),
                ),
            ],
          ),
          if (hasError)
            Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Text(
                widget.state.errorText!,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontSize: 12,
                  height: 1.3,
                  color: AppColors.danger,
                ),
              ),
            ),
          // Focus/error underline — colour-only 150ms transition.
          AnimatedContainer(
            duration: const Duration(milliseconds: 150),
            curve: Curves.easeInOut,
            height: 1.5,
            margin: const EdgeInsets.only(right: 4),
            color: underlineColor,
          ),
          const SizedBox(height: 6),
        ],
      ),
    );
  }
}

// =============================================================================
// Choice chips (gender / attendee type)
// =============================================================================

class _ChoiceChips extends FormField<String> {
  _ChoiceChips({
    required String? value,
    required String label,
    required IconData icon,
    required List<String> options,
    required ValueChanged<String> onSelected,
    super.validator,
  }) : super(
          initialValue: (value == null || value.isEmpty) ? null : value,
          builder: (state) {
            void select(String option) {
              HapticFeedback.selectionClick();
              state.didChange(option);
              onSelected(option);
            }

            return Padding(
              padding: const EdgeInsets.fromLTRB(AppSpacing.lg,
                  AppSpacing.xs + AppSpacing.md, AppSpacing.lg, AppSpacing.lg),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: [
                      Icon(icon, size: 16, color: AppColors.textMuted),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          label,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: AppColors.textMuted,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      for (final option in options)
                        _chip(state, option, select),
                    ],
                  ),
                  if (state.hasError) ...[
                    const SizedBox(height: 8),
                    Text(
                      state.errorText!,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 12,
                        height: 1.3,
                        color: AppColors.danger,
                      ),
                    ),
                  ],
                ],
              ),
            );
          },
        );

  static Widget _chip(
    FormFieldState<String> state,
    String option,
    ValueChanged<String> select,
  ) {
    final isSelected = state.value == option;
    return Semantics(
      button: true,
      selected: isSelected,
      label: option,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () => select(option),
        child: Container(
          height: 44,
          padding: const EdgeInsets.symmetric(horizontal: 16),
          decoration: BoxDecoration(
            color: isSelected ? AppColors.primary : AppColors.neutralBg,
            borderRadius: BorderRadius.circular(AppTheme.radiusPill),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (isSelected) ...[
                const Icon(IconsaxPlusBold.tick_circle,
                    size: 16, color: Colors.white),
                const SizedBox(width: 6),
              ],
              Text(
                option,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight:
                      isSelected ? FontWeight.w600 : FontWeight.w500,
                  color: isSelected ? Colors.white : AppColors.textPrimary,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// =============================================================================
// Stepper button, summary row, privacy line
// =============================================================================

/// 36px circular stepper button inside a 44px hit target.
class _StepButton extends StatelessWidget {
  const _StepButton({
    required this.icon,
    required this.enabled,
    required this.filled,
    required this.onTap,
  });

  final IconData icon;
  final bool enabled;
  final bool filled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final Color bg = filled
        ? AppColors.primary
        : enabled
            ? AppColors.surface
            : Colors.transparent;
    final Color fg = filled
        ? Colors.white
        : enabled
            ? AppColors.primary
            : AppColors.textMuted.withValues(alpha: 0.5);

    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: enabled ? onTap : null,
      child: Padding(
        padding: const EdgeInsets.all(4),
        child: Container(
          width: 36,
          height: 36,
          alignment: Alignment.center,
          decoration: BoxDecoration(color: bg, shape: BoxShape.circle),
          child: Icon(icon, size: 16, color: fg),
        ),
      ),
    );
  }
}

class _SummaryRow extends StatelessWidget {
  const _SummaryRow({
    required this.label,
    required this.value,
    this.valueColor,
    this.emphasized = false,
  });

  final String label;
  final String value;
  final Color? valueColor;
  final bool emphasized;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: emphasized ? 15 : 14,
              fontWeight: emphasized ? FontWeight.w800 : FontWeight.w500,
              color: emphasized
                  ? AppColors.textPrimary
                  : AppColors.textMuted,
            ),
          ),
        ),
        const SizedBox(width: 12),
        Text(
          value,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            fontSize: emphasized ? 15 : 14,
            fontWeight: emphasized ? FontWeight.w800 : FontWeight.w600,
            color: valueColor ??
                (emphasized ? AppColors.textPrimary : AppColors.textPrimary),
          ),
        ),
      ],
    );
  }
}

class _PrivacyLine extends StatelessWidget {
  const _PrivacyLine();

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        const Icon(IconsaxPlusLinear.shield_tick,
            size: 14, color: AppColors.textMuted),
        const SizedBox(width: 6),
        const Expanded(
          child: Text(
            'Optional — shared with the organizer.',
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(fontSize: 12, color: AppColors.textMuted),
          ),
        ),
      ],
    );
  }
}

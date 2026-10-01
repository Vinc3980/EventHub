import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../models/discount_code_model.dart';
import '../../services/discount_service.dart';
import '../../theme/app_colors.dart';

class DiscountCodesScreen extends StatefulWidget {
  const DiscountCodesScreen({super.key, required this.eventId});

  final String eventId;

  @override
  State<DiscountCodesScreen> createState() => _DiscountCodesScreenState();
}

class _DiscountCodesScreenState extends State<DiscountCodesScreen> {
  final _codeController = TextEditingController();
  final _maxUsesController = TextEditingController(text: '50');
  String? _percentOff;
  String? _amountOff;
  bool _isPercent = true;
  DateTime? _expiresAt;
  bool _creating = false;

  @override
  void dispose() {
    _codeController.dispose();
    _maxUsesController.dispose();
    super.dispose();
  }

  Future<void> _pickExpiry() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _expiresAt ?? now.add(const Duration(days: 30)),
      firstDate: now,
      lastDate: now.add(const Duration(days: 365)),
    );
    if (picked != null) setState(() => _expiresAt = picked);
  }

  Future<void> _createCode() async {
    final code = _codeController.text.trim();
    if (code.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Enter a code.')),
      );
      return;
    }

    final maxUses = int.tryParse(_maxUsesController.text.trim()) ?? 0;
    if (maxUses <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Max uses must be greater than 0.')),
      );
      return;
    }

    double? percentOff;
    double? amountOff;

    if (_isPercent) {
      percentOff = double.tryParse(_percentOff ?? '') ?? 0;
      if (percentOff <= 0 || percentOff > 100) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Enter a valid percentage (1-100).')),
        );
        return;
      }
    } else {
      amountOff = double.tryParse(_amountOff ?? '') ?? 0;
      if (amountOff <= 0) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Enter a valid amount.')),
        );
        return;
      }
    }

    setState(() => _creating = true);
    try {
      final discountService = context.read<DiscountService>();
      await discountService.createCode(DiscountCode(
        id: '',
        eventId: widget.eventId,
        code: code,
        percentOff: _isPercent ? percentOff : null,
        amountOff: _isPercent ? null : amountOff,
        maxUses: maxUses,
        expiresAt: _expiresAt?.toUtc().toIso8601String(),
      ));
      _codeController.clear();
      _maxUsesController.text = '50';
      setState(() {
        _percentOff = null;
        _amountOff = null;
        _isPercent = true;
        _expiresAt = null;
        _creating = false;
      });
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Discount code created.')),
      );
    } catch (error) {
      if (!mounted) return;
      setState(() => _creating = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Could not create code: $error')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final discountService = context.read<DiscountService>();

    return Scaffold(
      appBar: AppBar(title: const Text('Discount codes')),
      body: StreamBuilder<List<DiscountCode>>(
        stream: discountService.codesForEvent(widget.eventId),
        builder: (context, snapshot) {
          final codes = snapshot.data ?? const [];

          return ListView(
            padding: const EdgeInsets.all(24),
            children: [
              // Create form
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.card,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: AppColors.border, width: 1),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Create a discount code',
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _codeController,
                      textCapitalization: TextCapitalization.characters,
                      decoration: const InputDecoration(
                        labelText: 'Code',
                        hintText: 'e.g. SAVE20',
                      ),
                    ),
                    const SizedBox(height: 12),
                    // Discount type radio
                    Row(
                      children: [
                        Expanded(
                          child: RadioListTile<bool>(
                            contentPadding: EdgeInsets.zero,
                            title: const Text('Percent off', style: TextStyle(fontSize: 14)),
                            value: true,
                            groupValue: _isPercent,
                            onChanged: (v) => setState(() => _isPercent = v!),
                          ),
                        ),
                        Expanded(
                          child: RadioListTile<bool>(
                            contentPadding: EdgeInsets.zero,
                            title: const Text('Amount off', style: TextStyle(fontSize: 14)),
                            value: false,
                            groupValue: _isPercent,
                            onChanged: (v) => setState(() => _isPercent = v!),
                          ),
                        ),
                      ],
                    ),
                    if (_isPercent)
                      TextField(
                        keyboardType: const TextInputType.numberWithOptions(decimal: true),
                        decoration: const InputDecoration(
                          labelText: 'Percent off (%)',
                          prefixText: '% ',
                        ),
                        onChanged: (v) => _percentOff = v,
                      )
                    else
                      TextField(
                        keyboardType: const TextInputType.numberWithOptions(decimal: true),
                        decoration: const InputDecoration(
                          labelText: 'Amount off (GHS)',
                          prefixText: 'GHS ',
                        ),
                        onChanged: (v) => _amountOff = v,
                      ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _maxUsesController,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(
                        labelText: 'Max uses',
                      ),
                    ),
                    const SizedBox(height: 12),
                    GestureDetector(
                      onTap: _pickExpiry,
                      child: InputDecorator(
                        decoration: const InputDecoration(
                          labelText: 'Expiry date (optional)',
                          prefixIcon: Icon(Icons.calendar_today_outlined, size: 20),
                        ),
                        child: Text(
                          _expiresAt == null
                              ? 'No expiry'
                              : '${_expiresAt!.day}/${_expiresAt!.month}/${_expiresAt!.year}',
                          style: TextStyle(
                            color: _expiresAt == null
                                ? AppColors.textMuted
                                : AppColors.textPrimary,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: _creating ? null : _createCode,
                        child: _creating
                            ? const SizedBox(
                                height: 20,
                                width: 20,
                                child: CircularProgressIndicator(
                                    strokeWidth: 2, color: Colors.white),
                              )
                            : const Text('Create code'),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),
              // Existing codes list
              if (codes.isEmpty)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 20),
                  child: Text(
                    'No discount codes yet.',
                    style: TextStyle(color: AppColors.textMuted),
                    textAlign: TextAlign.center,
                  ),
                )
              else
                for (final code in codes)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 14, vertical: 12),
                      decoration: BoxDecoration(
                        color: AppColors.card,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: AppColors.border, width: 1),
                      ),
                      child: Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  code.code,
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w700,
                                    color: AppColors.textPrimary,
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  '${code.usedCount} / ${code.maxUses} used'
                                  '${code.percentOff != null ? '  ·  ${code.percentOff!.toStringAsFixed(0)}% off' : ''}'
                                  '${code.amountOff != null ? '  ·  GHS ${code.amountOff!.toStringAsFixed(2)} off' : ''}'
                                  '${code.expiresAt != null ? '  ·  expires ${code.expiresAt!.substring(0, 10)}' : ''}',
                                  style: const TextStyle(
                                    fontSize: 12,
                                    color: AppColors.textMuted,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          Icon(
                            code.active
                                ? Icons.check_circle_outline
                                : Icons.cancel_outlined,
                            size: 18,
                            color: code.active
                                ? AppColors.success
                                : AppColors.textMuted,
                          ),
                        ],
                      ),
                    ),
                  ),
            ],
          );
        },
      ),
    );
  }
}

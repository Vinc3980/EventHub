import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:provider/provider.dart';

import '../../services/local_db.dart';
import '../../services/registration_service.dart';
import '../../theme/app_colors.dart';

class QrScannerScreen extends StatefulWidget {
  const QrScannerScreen({super.key, required this.eventId});

  final String eventId;

  @override
  State<QrScannerScreen> createState() => _QrScannerScreenState();
}

class _QrScannerScreenState extends State<QrScannerScreen> {
  MobileScannerController? _cameraController;
  bool _scanning = true;
  int _mode = 0; // 0 = camera, 1 = manual code, 2 = name search
  final _manualController = TextEditingController();
  final _searchController = TextEditingController();
  List<_SearchResult> _searchResults = [];
  bool _searching = false;

  @override
  void initState() {
    super.initState();
    _cameraController = MobileScannerController(
      detectionSpeed: DetectionSpeed.normal,
      facing: CameraFacing.back,
    );
  }

  @override
  void dispose() {
    _cameraController?.dispose();
    _manualController.dispose();
    _searchController.dispose();
    super.dispose();
  }

  void _onDetect(BarcodeCapture capture) {
    if (!_scanning) return;
    final code = capture.barcodes.firstOrNull?.rawValue;
    if (code == null || code.isEmpty) return;
    _processCode(code);
  }

  Future<void> _processCode(String code) async {
    setState(() => _scanning = false);
    try {
      final regService = context.read<RegistrationService>();
      final result = await regService.checkIn(
        eventId: widget.eventId,
        scannedCode: code,
      );
      if (!mounted) return;
      await _showSuccess(result['fullName'] as String, result['seatNumber'] as String);
    } on CheckInException catch (e) {
      if (!mounted) return;
      await _showError(e.message);
    } catch (e) {
      if (!mounted) return;
      await _showError('Unexpected error: $e');
    }
    if (mounted) setState(() => _scanning = true);
  }

  Future<void> _manualSubmit() async {
    final code = _manualController.text.trim();
    if (code.isEmpty) return;
    _manualController.clear();
    await _processCode(code);
  }

  Future<void> _searchByName() async {
    final query = _searchController.text.trim().toLowerCase();
    if (query.isEmpty) return;

    setState(() => _searching = true);

    final db = LocalStore.instance;
    final results = <_SearchResult>[];

    // Search all bookings for this event, match against linked Registration's fullName.
    for (final entry in db.bookings.toMap().entries) {
      final booking = Map<String, dynamic>.from(entry.value);
      if (booking['eventId'] != widget.eventId) continue;

      final regId = booking['regId'] as String?;
      if (regId == null) continue;
      final reg = LocalStore.readDoc(db.registrations, regId);
      if (reg == null) continue;

      final fullName = (reg['fullName'] as String? ?? '').toLowerCase();
      if (fullName.contains(query)) {
        results.add(_SearchResult(
          bookingId: entry.key,
          fullName: reg['fullName'] as String? ?? '',
          seatNumber: booking['seatNumber'] as String? ?? '',
          status: booking['status'] as String? ?? '',
          checkedIn: (booking['checkedIn'] as bool?) == true,
          regId: regId,
        ));
      }
    }

    if (mounted) {
      setState(() {
        _searchResults = results;
        _searching = false;
      });
    }
  }

  Future<void> _checkInResult(_SearchResult result) async {
    if (result.checkedIn) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Already checked in.')),
      );
      return;
    }
    if (result.status == 'cancelled') {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('This booking has been cancelled.')),
      );
      return;
    }

    // Use the QR code (seat number) to check in.
    // If no seat number, use the booking's qrCode field.
    final db = LocalStore.instance;
    final bookingData = LocalStore.readDoc(db.bookings, result.bookingId);
    final qrCode = bookingData?['qrCode'] as String? ?? '';

    if (qrCode.isNotEmpty) {
      await _processCode(qrCode);
    } else {
      // Fallback: check in by seat number directly.
      if (!mounted) return;
      try {
        final regService = context.read<RegistrationService>();
        final checkResult = await regService.checkInBySeat(
          eventId: widget.eventId,
          seatNumber: result.seatNumber,
        );
        if (!mounted) return;
        await _showSuccess(
            checkResult['fullName'] as String, checkResult['seatNumber'] as String);
      } on CheckInException catch (e) {
        if (!mounted) return;
        await _showError(e.message);
      }
    }
  }

  Future<void> _showSuccess(String fullName, String seatNumber) async {
    await showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.successBg,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 80,
              height: 80,
              decoration: const BoxDecoration(
                color: AppColors.success,
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.check, color: Colors.white, size: 40),
            ),
            const SizedBox(height: 20),
            const Text(
              'Checked In!',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w800,
                color: AppColors.success,
              ),
            ),
            const SizedBox(height: 12),
            Text(
              fullName,
              style: const TextStyle(
                fontSize: 17,
                fontWeight: FontWeight.w700,
                color: AppColors.textPrimary,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 6),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(100),
              ),
              child: Text(
                seatNumber,
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w800,
                  color: AppColors.success,
                ),
              ),
            ),
          ],
        ),
      ),
    );
    if (mounted) Navigator.of(context).pop();
  }

  Future<void> _showError(String message) async {
    await showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.dangerBg,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 80,
              height: 80,
              decoration: const BoxDecoration(
                color: AppColors.danger,
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.close, color: Colors.white, size: 40),
            ),
            const SizedBox(height: 20),
            const Text(
              'Check-in Failed',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w800,
                color: AppColors.danger,
              ),
            ),
            const SizedBox(height: 12),
            Text(
              message,
              style: const TextStyle(
                fontSize: 14,
                color: AppColors.textPrimary,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _mode == 0 ? Colors.black : null,
      appBar: AppBar(
        backgroundColor: _mode == 0 ? Colors.black : null,
        foregroundColor: _mode == 0 ? Colors.white : null,
        title: Text(_mode == 2 ? 'Search attendee' : 'Scan ticket'),
        actions: [
          IconButton(
            tooltip: 'Scan QR',
            icon: Icon(
              Icons.qr_code_scanner,
              color: _mode == 0 ? Colors.white : null,
            ),
            onPressed: () => setState(() => _mode = 0),
          ),
          IconButton(
            tooltip: 'Manual code entry',
            icon: Icon(
              Icons.keyboard,
              color: _mode == 0 ? Colors.white : null,
            ),
            onPressed: () => setState(() => _mode = 1),
          ),
          IconButton(
            tooltip: 'Search by name',
            icon: Icon(
              Icons.person_search,
              color: _mode == 0 ? Colors.white : null,
            ),
            onPressed: () => setState(() => _mode = 2),
          ),
        ],
      ),
      body: _mode == 0
          ? _buildCameraView()
          : _mode == 1
              ? _buildManualEntry()
              : _buildNameSearch(),
    );
  }

  Widget _buildCameraView() {
    return Stack(
      children: [
        MobileScanner(
          controller: _cameraController,
          onDetect: _onDetect,
        ),
        Center(
          child: Container(
            width: 280,
            height: 280,
            decoration: BoxDecoration(
              border: Border.all(color: Colors.white.withValues(alpha: 0.5), width: 2),
              borderRadius: BorderRadius.circular(20),
            ),
          ),
        ),
        Positioned(
          bottom: 0,
          left: 0,
          right: 0,
          child: Container(
            padding: const EdgeInsets.all(24),
            color: Colors.black.withValues(alpha: 0.6),
            child: const SafeArea(
              top: false,
              child: Text(
                'Point the camera at the attendee\'s QR code',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.white, fontSize: 15),
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildManualEntry() {
    return Container(
      color: AppColors.bg,
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.qr_code_2, size: 64, color: AppColors.textMuted),
          const SizedBox(height: 24),
          const Text(
            'Enter code manually',
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w700,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'Type the QR code or seat number',
            style: TextStyle(color: AppColors.textMuted, fontSize: 14),
          ),
          const SizedBox(height: 24),
          TextField(
            controller: _manualController,
            style: const TextStyle(fontSize: 18),
            textAlign: TextAlign.center,
            textCapitalization: TextCapitalization.characters,
            decoration: InputDecoration(
              hintText: 'e.g. S-123 or code...',
              hintStyle: const TextStyle(color: AppColors.textMuted),
              filled: true,
              fillColor: AppColors.card,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(16),
                borderSide: const BorderSide(color: AppColors.border),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(16),
                borderSide:
                    const BorderSide(color: AppColors.accent, width: 2),
              ),
            ),
            onSubmitted: (_) => _manualSubmit(),
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            height: 52,
            child: ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.accent,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
              ),
              onPressed: _manualSubmit,
              child: const Text(
                'Check In',
                style: TextStyle(
                    fontSize: 16, fontWeight: FontWeight.w700),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildNameSearch() {
    return Container(
      color: AppColors.bg,
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              children: [
                const Icon(Icons.person_search, size: 48, color: AppColors.textMuted),
                const SizedBox(height: 16),
                const Text(
                  'Search by attendee name',
                  style: TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 6),
                const Text(
                  'Partial name search — type any part of the name',
                  style: TextStyle(fontSize: 13, color: AppColors.textMuted),
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: _searchController,
                  textCapitalization: TextCapitalization.words,
                  decoration: InputDecoration(
                    hintText: 'Search by name...',
                    prefixIcon: const Icon(Icons.search, size: 20),
                    filled: true,
                    fillColor: AppColors.card,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(14),
                      borderSide: const BorderSide(color: AppColors.border),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(14),
                      borderSide:
                          const BorderSide(color: AppColors.accent, width: 1.5),
                    ),
                  ),
                  onSubmitted: (_) => _searchByName(),
                ),
              ],
            ),
          ),
          if (_searching)
            const Padding(
              padding: EdgeInsets.all(24),
              child: SizedBox(
                width: 24,
                height: 24,
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
            )
          else if (_searchResults.isNotEmpty)
            Expanded(
              child: ListView.separated(
                padding: const EdgeInsets.symmetric(horizontal: 24),
                itemCount: _searchResults.length,
                separatorBuilder: (_, __) => const SizedBox(height: 8),
                itemBuilder: (context, index) {
                  final r = _searchResults[index];
                  return GestureDetector(
                    onTap: () => _checkInResult(r),
                    child: Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: AppColors.card,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: AppColors.border, width: 1),
                      ),
                      child: Row(
                        children: [
                          Container(
                            width: 40,
                            height: 40,
                            decoration: BoxDecoration(
                              color: r.checkedIn
                                  ? AppColors.successBg
                                  : r.status == 'cancelled'
                                      ? AppColors.dangerBg
                                      : AppColors.skeleton,
                              shape: BoxShape.circle,
                            ),
                            child: Icon(
                              r.checkedIn
                                  ? Icons.check
                                  : r.status == 'cancelled'
                                      ? Icons.close
                                      : Icons.person_outline,
                              size: 20,
                              color: r.checkedIn
                                  ? AppColors.success
                                  : r.status == 'cancelled'
                                      ? AppColors.danger
                                      : AppColors.textMuted,
                            ),
                          ),
                          const SizedBox(width: 14),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  r.fullName,
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w700,
                                    fontSize: 15,
                                    color: AppColors.textPrimary,
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  r.seatNumber.isNotEmpty
                                      ? r.seatNumber
                                      : 'No seat assigned',
                                  style: const TextStyle(
                                    fontSize: 12,
                                    color: AppColors.textMuted,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          if (r.checkedIn)
                            const Text(
                              'Checked in',
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                color: AppColors.success,
                              ),
                            )
                          else if (r.status == 'cancelled')
                            const Text(
                              'Cancelled',
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                color: AppColors.danger,
                              ),
                            )
                          else
                            const Icon(
                              Icons.chevron_right,
                              size: 20,
                              color: AppColors.accent,
                            ),
                        ],
                      ),
                    ),
                  );
                },
              ),
            )
          else if (_searchController.text.isNotEmpty && !_searching)
            const Padding(
              padding: EdgeInsets.all(24),
              child: Text(
                'No attendees found.',
                style: TextStyle(color: AppColors.textMuted),
              ),
            ),
        ],
      ),
    );
  }
}

class _SearchResult {
  final String bookingId;
  final String fullName;
  final String seatNumber;
  final String status;
  final bool checkedIn;
  final String regId;

  const _SearchResult({
    required this.bookingId,
    required this.fullName,
    required this.seatNumber,
    required this.status,
    required this.checkedIn,
    required this.regId,
  });
}

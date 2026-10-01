import 'dart:io';

import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';

import '../../models/event_model.dart';
import '../../models/event_schedule_model.dart';
import '../../services/auth_service.dart';
import '../../services/event_schedule_service.dart';
import '../../services/event_service.dart';
import '../../theme/app_colors.dart';
import 'guest_list.dart';

class _TierRow {
  final TextEditingController nameController;
  final TextEditingController priceController;
  final TextEditingController capacityController;
  final TextEditingController earlyBirdPriceController;
  DateTime? earlyBirdUntil;
  _TierRow({String name = '', String price = '', String capacity = '', String earlyBirdPrice = '', this.earlyBirdUntil})
      : nameController = TextEditingController(text: name),
        priceController = TextEditingController(text: price),
        capacityController = TextEditingController(text: capacity),
        earlyBirdPriceController = TextEditingController(text: earlyBirdPrice);
  void dispose() {
    nameController.dispose();
    priceController.dispose();
    capacityController.dispose();
    earlyBirdPriceController.dispose();
  }
  EventTicket toTicket() {
    final price = double.tryParse(priceController.text.trim()) ?? 0;
    final cap = int.tryParse(capacityController.text.trim()) ?? 0;
    final name = nameController.text.trim().isEmpty ? 'General' : nameController.text.trim();
    final eb = double.tryParse(earlyBirdPriceController.text.trim());
    return EventTicket(
      name: name,
      price: price,
      capacity: cap,
      earlyBirdPrice: eb != null && eb > 0 && eb < price ? eb : null,
      earlyBirdUntil: eb != null && earlyBirdUntil != null ? earlyBirdUntil!.toUtc().toIso8601String() : null,
    );
  }
}

class _AgendaRow {
  final TextEditingController titleController;
  final TextEditingController timeController;
  final TextEditingController locationController;
  DateTime? startTime;
  DateTime? endTime;
  _AgendaRow({String title = '', String location = '', this.startTime, this.endTime})
      : titleController = TextEditingController(text: title),
        timeController = TextEditingController(),
        locationController = TextEditingController(text: location);
  void dispose() {
    titleController.dispose();
    timeController.dispose();
    locationController.dispose();
  }
}

class CreateEventScreen extends StatefulWidget {
  const CreateEventScreen({super.key, this.initial});
  final Event? initial;
  @override
  State<CreateEventScreen> createState() => _CreateEventScreenState();
}

class _CreateEventScreenState extends State<CreateEventScreen> {
  static const _categories = ['wedding', 'funeral', 'corporate', 'social'];
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _titleController;
  late final TextEditingController _venueController;
  late final TextEditingController _descController;
  late String? _category;
  late DateTime? _date;
  String _coverImageUrl = '';
  List<String> _mediaUrls = [];
  double _lat = 0;
  double _lng = 0;
  bool _loading = false;
  bool _savingDraft = false;
  late List<_TierRow> _tierRows;
  List<_AgendaRow> _agendaRows = [];
  bool get _isEditing => widget.initial != null;

  @override
  void initState() {
    super.initState();
    final i = widget.initial;
    _titleController = TextEditingController(text: i?.title ?? '');
    _venueController = TextEditingController(text: i?.venue ?? '');
    _descController = TextEditingController(text: i?.description ?? '');
    _category = i?.category;
    _date = i?.date;
    _coverImageUrl = i?.coverImageUrl ?? '';
    _mediaUrls = List<String>.from(i?.mediaUrls ?? const []);
    _lat = i?.lat ?? 0;
    _lng = i?.lng ?? 0;
    if (i != null && i.ticketTypes.isNotEmpty) {
      _tierRows = i.ticketTypes
          .map((t) => _TierRow(
                name: t.name,
                price: t.price > 0 ? t.price.toStringAsFixed(2) : '',
                capacity: t.capacity > 0 ? t.capacity.toString() : '',
                earlyBirdPrice: t.earlyBirdPrice != null && t.earlyBirdPrice! > 0 ? t.earlyBirdPrice!.toStringAsFixed(2) : '',
                earlyBirdUntil: t.earlyBirdUntil != null ? DateTime.tryParse(t.earlyBirdUntil!) : null,
              ))
          .toList();
    } else {
      _tierRows = [_TierRow()];
    }
    if (i != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) async {
        final items = await context.read<EventScheduleService>().scheduleForEvent(i.id).first;
        if (!mounted || items.isEmpty) return;
        setState(() {
          _agendaRows = items
              .map((e) => _AgendaRow(title: e.title, location: e.location, startTime: e.startTime, endTime: e.endTime)
                ..timeController.text =
                    '${e.startTime.hour.toString().padLeft(2, '0')}:${e.startTime.minute.toString().padLeft(2, '0')} - ${e.endTime.hour.toString().padLeft(2, '0')}:${e.endTime.minute.toString().padLeft(2, '0')}')
              .toList();
        });
      });
    }
  }

  @override
  void dispose() {
    _titleController.dispose();
    _venueController.dispose();
    _descController.dispose();
    for (final r in _tierRows) r.dispose();
    for (final r in _agendaRows) r.dispose();
    super.dispose();
  }

  bool get _hasUnsavedInput => _isEditing ? true : _titleController.text.trim().isNotEmpty || _venueController.text.trim().isNotEmpty || _descController.text.trim().isNotEmpty || _category != null || _date != null;
  bool get _hasAtLeastOneTier => _tierRows.any((r) => r.nameController.text.trim().isNotEmpty || r.priceController.text.trim().isNotEmpty || r.capacityController.text.trim().isNotEmpty);

  Future<void> _pickDate() async {
    final now = DateTime.now();
    final p = await showDatePicker(context: context, initialDate: _date ?? now.add(const Duration(days: 7)), firstDate: now, lastDate: now.add(const Duration(days: 730)));
    if (p != null) setState(() => _date = p);
  }

  Future<void> _pickCoverImage() async {
    final s = await showModalBottomSheet<ImageSource>(
        context: context,
        builder: (ctx) => SafeArea(
                child: Column(mainAxisSize: MainAxisSize.min, children: [
              ListTile(leading: const Icon(Icons.photo_camera_outlined), title: const Text('Take a photo'), onTap: () => Navigator.of(ctx).pop(ImageSource.camera)),
              ListTile(leading: const Icon(Icons.photo_library_outlined), title: const Text('Choose from gallery'), onTap: () => Navigator.of(ctx).pop(ImageSource.gallery)),
            ])));
    if (s == null) return;
    final picker = ImagePicker();
    final picked = await picker.pickImage(source: s, maxWidth: 1200, maxHeight: 800, imageQuality: 85);
    if (picked != null) setState(() => _coverImageUrl = picked.path);
  }

  Future<void> _pickExtraMedia() async {
    final picker = ImagePicker();
    final picked = await picker.pickMultiImage(maxWidth: 1200, maxHeight: 800, imageQuality: 80);
    if (picked.isNotEmpty) setState(() => _mediaUrls = [..._mediaUrls, ...picked.map((e) => e.path)]);
  }

  Future<void> _pickLocation() async {
    LatLng start = _lat != 0 ? LatLng(_lat, _lng) : const LatLng(5.6037, -0.1870);
    LatLng picked = start;
    final res = await showModalBottomSheet<LatLng>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => DraggableScrollableSheet(
        initialChildSize: 0.85,
        expand: false,
        builder: (ctx, scrollCtrl) => Column(
          children: [
            Padding(padding: const EdgeInsets.all(16), child: Row(children: [const Expanded(child: Text('Pick venue location', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16))), TextButton(onPressed: () => Navigator.pop(ctx, picked), child: const Text('Done'))])),
            Expanded(child: StatefulBuilder(builder: (ctx, setM) => GoogleMap(initialCameraPosition: CameraPosition(target: start, zoom: 13), onTap: (p) => setM(() => picked = p), markers: {Marker(markerId: const MarkerId('pick'), position: picked)}))),
            Padding(padding: const EdgeInsets.all(12), child: Text('${picked.latitude.toStringAsFixed(4)}, ${picked.longitude.toStringAsFixed(4)}', style: const TextStyle(color: AppColors.textMuted, fontSize: 12))),
          ],
        ),
      ),
    );
    if (res != null) setState(() {_lat = res.latitude; _lng = res.longitude;});
  }

  Event _buildEvent({required String status, String? idOverride}) {
    final tickets = <EventTicket>[];
    for (final r in _tierRows) {
      final t = r.toTicket();
      if (t.name.isNotEmpty) tickets.add(t);
    }
    return Event(
      id: idOverride ?? (_isEditing ? widget.initial!.id : ''),
      ownerId: _isEditing ? widget.initial!.ownerId : (context.read<AuthService>().currentUid ?? ''),
      title: _titleController.text.trim(),
      category: _category ?? 'social',
      date: _date ?? DateTime.now().add(const Duration(days: 7)),
      venue: _venueController.text.trim(),
      lat: _lat,
      lng: _lng,
      description: _descController.text.trim(),
      ticketTypes: tickets,
      status: status,
      coverImageUrl: _coverImageUrl,
      mediaUrls: _mediaUrls.where((u) => u != _coverImageUrl).toList(),
      thankYouMessage: _isEditing ? widget.initial!.thankYouMessage : '',
    );
  }

  Future<void> _saveDraft() async {
    if (_titleController.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Enter a title to save draft.')));
      return;
    }
    setState(() => _savingDraft = true);
    try {
      final ev = _buildEvent(status: 'draft', idOverride: _isEditing ? widget.initial!.id : null);
      final svc = context.read<EventService>();
      final id = await svc.saveDraft(ev);
      if (_agendaRows.isNotEmpty) {
        final agSvc = context.read<EventScheduleService>();
        for (int i = 0; i < _agendaRows.length; i++) {
          final r = _agendaRows[i];
          if (r.titleController.text.trim().isEmpty) continue;
          await agSvc.addScheduleItem(EventScheduleItem(id: '', eventId: id, title: r.titleController.text.trim(), description: '', startTime: r.startTime ?? DateTime.now(), endTime: r.endTime ?? DateTime.now().add(const Duration(hours: 1)), location: r.locationController.text.trim(), order: i));
        }
      }
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Draft saved.')));
      Navigator.of(context).pop();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Could not save draft: $e')));
    } finally {
      if (mounted) setState(() => _savingDraft = false);
    }
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    if (_category == null || _date == null) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Choose a category and date.')));
      return;
    }
    if (!_hasAtLeastOneTier) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Add at least one ticket tier.')));
      return;
    }
    final ev = _buildEvent(status: _isEditing ? widget.initial!.status : '', idOverride: null);
    setState(() => _loading = true);
    try {
      final svc = context.read<EventService>();
      if (_isEditing && widget.initial!.status == 'draft') {
        await svc.updateEvent(ev.copyWith(status: 'pending_review'));
        await _saveAgenda(ev.id);
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Submitted for review.')));
        Navigator.of(context).pop();
        return;
      }
      if (_isEditing) {
        await svc.updateEvent(ev);
        await _saveAgenda(ev.id);
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Event updated.')));
        Navigator.of(context).pop();
      } else {
        final id = await svc.createEvent(ev);
        await _saveAgenda(id);
        if (!mounted) return;
        Navigator.of(context).pushReplacement(MaterialPageRoute(builder: (_) => GuestListScreen(eventId: id)));
      }
    } catch (e) {
      if (!mounted) return;
      setState(() => _loading = false);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Could not save: $e')));
    }
  }

  Future<void> _saveAgenda(String eventId) async {
    if (_agendaRows.isEmpty) return;
    final svc = context.read<EventScheduleService>();
    final existing = await svc.scheduleForEvent(eventId).first;
    for (final old in existing) await svc.deleteScheduleItem(old.id);
    for (int i = 0; i < _agendaRows.length; i++) {
      final r = _agendaRows[i];
      if (r.titleController.text.trim().isEmpty) continue;
      await svc.addScheduleItem(EventScheduleItem(id: '', eventId: eventId, title: r.titleController.text.trim(), description: '', startTime: r.startTime ?? DateTime.now(), endTime: r.endTime ?? DateTime.now().add(const Duration(hours: 1)), location: r.locationController.text.trim(), order: i));
    }
  }

  void _preview() {
    final ev = _buildEvent(status: 'draft');
    showDialog(
        context: context,
        builder: (ctx) => AlertDialog(
              title: const Text('Preview'),
              content: SingleChildScrollView(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                if (ev.coverImageUrl.isNotEmpty)
                  ClipRRect(
                      borderRadius: BorderRadius.circular(12),
                      child: ev.coverImageUrl.startsWith('http')
                          ? Image.network(ev.coverImageUrl, height: 140, width: double.infinity, fit: BoxFit.cover)
                          : Image.file(File(ev.coverImageUrl), height: 140, width: double.infinity, fit: BoxFit.cover)),
                const SizedBox(height: 12),
                Text(ev.title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18)),
                const SizedBox(height: 6),
                Text(ev.description.isEmpty ? '(No description)' : ev.description, style: const TextStyle(color: AppColors.textMuted)),
                const SizedBox(height: 8),
                Text('${ev.venue} • ${ev.date.day}/${ev.date.month}/${ev.date.year}'),
                const SizedBox(height: 8),
                if (ev.ticketTypes.isNotEmpty) ...[const Divider(), for (final t in ev.ticketTypes) Text('${t.name}: GHS ${t.effectivePrice.toStringAsFixed(2)}${t.hasEarlyBird ? ' (Early-bird)' : ''}')],
                if (_agendaRows.isNotEmpty) ...[const Divider(), const Text('Agenda', style: TextStyle(fontWeight: FontWeight.w700)), for (final a in _agendaRows) if (a.titleController.text.trim().isNotEmpty) Text('• ${a.titleController.text.trim()}')],
              ])),
              actions: [TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Close'))],
            ));
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: !_hasUnsavedInput,
      onPopInvokedWithResult: (didPop, _) async {
        if (didPop) return;
        final d = await _confirmDiscard();
        if (d == true && context.mounted) Navigator.of(context).pop();
      },
      child: Scaffold(
        appBar: AppBar(title: Text(_isEditing ? 'Edit event' : 'Create event'), actions: [TextButton(onPressed: _preview, child: const Text('Preview')), const SizedBox(width: 8)]),
        body: SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Form(
              key: _formKey,
              autovalidateMode: AutovalidateMode.onUserInteraction,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  GestureDetector(
                    onTap: _pickCoverImage,
                    child: Container(
                      height: 200,
                      decoration: BoxDecoration(color: AppColors.skeleton, borderRadius: BorderRadius.circular(16), border: Border.all(color: AppColors.border)),
                      clipBehavior: Clip.antiAlias,
                      child: _coverImageUrl.isNotEmpty
                          ? (_coverImageUrl.startsWith('/') || _coverImageUrl.startsWith('file')
                              ? Image.file(File(_coverImageUrl), fit: BoxFit.cover, width: double.infinity, errorBuilder: (_, __, ___) => const _CoverPlaceholder())
                              : Image.network(_coverImageUrl, fit: BoxFit.cover, width: double.infinity, errorBuilder: (_, __, ___) => const _CoverPlaceholder()))
                          : const _CoverPlaceholder(),
                    ),
                  ),
                  if (_mediaUrls.isNotEmpty || _coverImageUrl.isNotEmpty) ...[
                    const SizedBox(height: 10),
                    SizedBox(
                      height: 72,
                      child: ListView.separated(
                        scrollDirection: Axis.horizontal,
                        itemCount: _mediaUrls.length + 1,
                        separatorBuilder: (_, __) => const SizedBox(width: 8),
                        itemBuilder: (_, i) {
                          if (i == _mediaUrls.length) {
                            return GestureDetector(
                                onTap: _pickExtraMedia,
                                child: Container(width: 72, decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(10), border: Border.all(color: AppColors.border)), child: const Icon(Icons.add_photo_alternate_outlined, color: AppColors.textMuted)));
                          }
                          final url = _mediaUrls[i];
                          return Stack(children: [
                            ClipRRect(
                                borderRadius: BorderRadius.circular(10),
                                child: url.startsWith('http')
                                    ? Image.network(url, width: 72, height: 72, fit: BoxFit.cover, errorBuilder: (_, __, ___) => Container(width: 72, height: 72, color: AppColors.skeleton))
                                    : Image.file(File(url), width: 72, height: 72, fit: BoxFit.cover, errorBuilder: (_, __, ___) => Container(width: 72, height: 72, color: AppColors.skeleton))),
                            Positioned(
                                top: 2,
                                right: 2,
                                child: GestureDetector(
                                    onTap: () => setState(() => _mediaUrls.removeAt(i)),
                                    child: Container(decoration: const BoxDecoration(color: Colors.black54, shape: BoxShape.circle), padding: const EdgeInsets.all(3), child: const Icon(Icons.close, size: 12, color: Colors.white)))),
                          ]);
                        },
                      ),
                    ),
                  ],
                  if (_mediaUrls.isEmpty && _coverImageUrl.isNotEmpty) ...[const SizedBox(height: 8), OutlinedButton.icon(onPressed: _pickExtraMedia, icon: const Icon(Icons.add_photo_alternate_outlined, size: 18), label: const Text('Add more photos / video'))],
                  const SizedBox(height: 24),
                  TextFormField(controller: _titleController, textCapitalization: TextCapitalization.sentences, decoration: const InputDecoration(labelText: 'Event title'), validator: (v) => (v ?? '').trim().isEmpty ? 'Enter a title.' : null),
                  const SizedBox(height: 16),
                  TextFormField(controller: _descController, textCapitalization: TextCapitalization.sentences, maxLines: 4, decoration: const InputDecoration(labelText: 'Description', hintText: 'What is this event about?', alignLabelWithHint: true)),
                  const SizedBox(height: 16),
                  Row(children: [
                    Expanded(child: GestureDetector(onTap: _pickDate, child: InputDecorator(decoration: const InputDecoration(labelText: 'Date', prefixIcon: Icon(Icons.calendar_today_outlined, size: 20)), child: Text(_date == null ? 'Pick a date' : '${_date!.day}/${_date!.month}/${_date!.year}', style: TextStyle(color: _date == null ? AppColors.textMuted : AppColors.textPrimary))))),
                    const SizedBox(width: 12),
                    Expanded(
                        child: FormField<String>(
                            initialValue: _category,
                            validator: (v) => v == null ? 'Category.' : null,
                            builder: (state) => InputDecorator(
                                decoration: InputDecoration(labelText: 'Category', suffixIcon: const Icon(Icons.expand_more, size: 20), errorText: state.errorText),
                                child: DropdownButtonHideUnderline(
                                    child: DropdownButton<String>(
                                        value: state.value,
                                        isExpanded: true,
                                        items: [for (final c in _categories) DropdownMenuItem(value: c, child: Text(_capitalize(c)))],
                                        onChanged: (v) {
                                          state.didChange(v);
                                          setState(() => _category = v);
                                        }))))),
                  ]),
                  const SizedBox(height: 16),
                  TextFormField(controller: _venueController, textCapitalization: TextCapitalization.words, decoration: const InputDecoration(labelText: 'Venue & location', prefixIcon: Icon(Icons.location_on_outlined, size: 20)), validator: (v) => (v ?? '').trim().isEmpty ? 'Enter a venue.' : null),
                  const SizedBox(height: 10),
                  InkWell(
                    onTap: _pickLocation,
                    borderRadius: BorderRadius.circular(12),
                    child: Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.border)),
                      child: Row(children: [
                        const Icon(Icons.map_outlined, size: 18, color: AppColors.accent),
                        const SizedBox(width: 10),
                        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [const Text('Pin on map', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)), Text(_lat == 0 ? 'Tap to set location on map' : '${_lat.toStringAsFixed(4)}, ${_lng.toStringAsFixed(4)}', style: const TextStyle(fontSize: 12, color: AppColors.textMuted))])),
                        if (_lat != 0) GestureDetector(onTap: () => setState(() {_lat = 0; _lng = 0;}), child: const Icon(Icons.close, size: 16, color: AppColors.textMuted)),
                      ]),
                    ),
                  ),
                  if (_lat != 0) ...[
                    const SizedBox(height: 10),
                    ClipRRect(
                        borderRadius: BorderRadius.circular(12),
                        child: SizedBox(
                            height: 150,
                            child: GoogleMap(
                                initialCameraPosition: CameraPosition(target: LatLng(_lat, _lng), zoom: 14),
                                markers: {Marker(markerId: const MarkerId('pin'), position: LatLng(_lat, _lng))},
                                zoomControlsEnabled: false,
                                scrollGesturesEnabled: false,
                                tiltGesturesEnabled: false))),
                  ],
                  const SizedBox(height: 24),
                  Row(children: [const Expanded(child: Text('Ticket Tiers', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.textPrimary))), TextButton.icon(onPressed: () => setState(() => _tierRows.add(_TierRow())), icon: const Icon(Icons.add, size: 18), label: const Text('Add another tier'))]),
                  const SizedBox(height: 8),
                  for (int i = 0; i < _tierRows.length; i++)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(14), border: Border.all(color: AppColors.border)),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(children: [Text('Tier ${i + 1}', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textMuted)), const Spacer(), if (_tierRows.length > 1) GestureDetector(onTap: () {setState(() {_tierRows[i].dispose(); _tierRows.removeAt(i);});}, child: const Icon(Icons.close, size: 18, color: AppColors.textMuted))]),
                            const SizedBox(height: 10),
                            TextField(controller: _tierRows[i].nameController, textCapitalization: TextCapitalization.words, decoration: const InputDecoration(labelText: 'Ticket name', hintText: 'e.g. General, VIP')),
                            const SizedBox(height: 10),
                            Row(children: [
                              Expanded(child: TextField(controller: _tierRows[i].priceController, keyboardType: const TextInputType.numberWithOptions(decimal: true), decoration: const InputDecoration(labelText: 'Price (GHS)', prefixText: 'GHS '))),
                              const SizedBox(width: 10),
                              Expanded(child: TextField(controller: _tierRows[i].capacityController, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Capacity', hintText: 'Max')))
                            ]),
                            const SizedBox(height: 10),
                            Container(
                              padding: const EdgeInsets.all(10),
                              decoration: BoxDecoration(color: AppColors.warningBg, borderRadius: BorderRadius.circular(10), border: Border.all(color: AppColors.warning.withValues(alpha: 0.25))),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(children: [
                                    const Icon(Icons.bolt_outlined, size: 14, color: AppColors.warning),
                                    const SizedBox(width: 4),
                                    const Text('Early-bird price', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.warning)),
                                    const Spacer(),
                                    if (_tierRows[i].earlyBirdPriceController.text.isNotEmpty || _tierRows[i].earlyBirdUntil != null)
                                      GestureDetector(onTap: () => setState(() {_tierRows[i].earlyBirdPriceController.clear(); _tierRows[i].earlyBirdUntil = null;}), child: const Text('Clear', style: TextStyle(fontSize: 11, color: AppColors.warning, fontWeight: FontWeight.w600)))
                                  ]),
                                  const SizedBox(height: 8),
                                  Row(children: [
                                    Expanded(child: TextField(controller: _tierRows[i].earlyBirdPriceController, keyboardType: const TextInputType.numberWithOptions(decimal: true), decoration: const InputDecoration(labelText: 'Early price', prefixText: 'GHS ', isDense: true), onChanged: (_) => setState(() {}))),
                                    const SizedBox(width: 10),
                                    Expanded(
                                        child: GestureDetector(
                                            onTap: () async {
                                              final now = DateTime.now();
                                              final p = await showDatePicker(context: context, initialDate: _tierRows[i].earlyBirdUntil ?? now.add(const Duration(days: 7)), firstDate: now, lastDate: now.add(const Duration(days: 365)));
                                              if (p != null) setState(() => _tierRows[i].earlyBirdUntil = p);
                                            },
                                            child: InputDecorator(
                                                decoration: const InputDecoration(labelText: 'Until', isDense: true, suffixIcon: Icon(Icons.calendar_today_outlined, size: 16)),
                                                child: Text(_tierRows[i].earlyBirdUntil == null ? 'Pick date' : '${_tierRows[i].earlyBirdUntil!.day}/${_tierRows[i].earlyBirdUntil!.month}/${_tierRows[i].earlyBirdUntil!.year}', style: TextStyle(fontSize: 13, color: _tierRows[i].earlyBirdUntil == null ? AppColors.textMuted : AppColors.textPrimary)))))
                                  ]),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  const SizedBox(height: 16),
                  Row(children: [const Expanded(child: Text('Agenda / Schedule', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.textPrimary))), TextButton.icon(onPressed: () => setState(() => _agendaRows.add(_AgendaRow())), icon: const Icon(Icons.add, size: 18), label: const Text('Add item'))]),
                  if (_agendaRows.isEmpty)
                    const Padding(padding: EdgeInsets.symmetric(vertical: 8), child: Text('Add schedule items (e.g. 09:00 Opening Ceremony). Visible in attendee Schedule tab.', style: TextStyle(color: AppColors.textMuted, fontSize: 12)))
                  else
                    for (int i = 0; i < _agendaRows.length; i++)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.border)),
                          child: Column(children: [
                            Row(children: [Expanded(child: TextField(controller: _agendaRows[i].titleController, decoration: const InputDecoration(labelText: 'Title', hintText: 'Opening Ceremony', isDense: true))), const SizedBox(width: 8), GestureDetector(onTap: () => setState(() {_agendaRows[i].dispose(); _agendaRows.removeAt(i);}), child: const Icon(Icons.close, size: 18, color: AppColors.textMuted))]),
                            const SizedBox(height: 8),
                            Row(children: [
                              Expanded(
                                  child: GestureDetector(
                                      onTap: () async {
                                        final t = await showTimePicker(context: context, initialTime: TimeOfDay.now());
                                        if (t == null) return;
                                        final now = DateTime.now();
                                        final start = DateTime(now.year, now.month, now.day, t.hour, t.minute);
                                        final end = start.add(const Duration(hours: 1));
                                        setState(() {
                                          _agendaRows[i].startTime = start;
                                          _agendaRows[i].endTime = end;
                                          _agendaRows[i].timeController.text = '${t.format(context)} - ${TimeOfDay.fromDateTime(end).format(context)}';
                                        });
                                      },
                                      child: AbsorbPointer(child: TextField(controller: _agendaRows[i].timeController, decoration: const InputDecoration(labelText: 'Time', hintText: 'Pick start time', isDense: true, suffixIcon: Icon(Icons.schedule_outlined, size: 16)))))),
                              const SizedBox(width: 8),
                              Expanded(child: TextField(controller: _agendaRows[i].locationController, decoration: const InputDecoration(labelText: 'Location', hintText: 'Main hall', isDense: true))),
                            ]),
                          ]),
                        ),
                      ),
                  const SizedBox(height: 28),
                  SizedBox(height: 50, child: ElevatedButton(onPressed: _loading || _savingDraft ? null : _submit, child: _loading ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : Text(_isEditing ? (widget.initial!.status == 'draft' ? 'Submit for review' : 'Save changes') : 'Submit for review'))),
                  const SizedBox(height: 10),
                  if (!_isEditing || widget.initial!.status == 'draft')
                    SizedBox(height: 50, child: OutlinedButton(onPressed: _savingDraft ? null : _saveDraft, child: _savingDraft ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2)) : const Text('Save as draft'))),
                  const SizedBox(height: 8),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Future<bool?> _confirmDiscard() => showDialog<bool>(context: context, builder: (ctx) => AlertDialog(title: const Text('Discard?'), content: const Text('Unsaved details will be lost.'), actions: [TextButton(onPressed: () => Navigator.of(ctx).pop(false), child: const Text('Keep editing')), ElevatedButton(onPressed: () => Navigator.of(ctx).pop(true), child: const Text('Discard'))]));
  String _capitalize(String v) => v.isEmpty ? v : v[0].toUpperCase() + v.substring(1);
}

class _CoverPlaceholder extends StatelessWidget {
  const _CoverPlaceholder();
  @override
  Widget build(BuildContext context) => Container(color: AppColors.skeleton, width: double.infinity, child: const Column(mainAxisAlignment: MainAxisAlignment.center, children: [Icon(Icons.camera_alt_outlined, size: 32, color: AppColors.textMuted), SizedBox(height: 8), Text('Tap to add cover image', style: TextStyle(color: AppColors.textMuted, fontSize: 13))]));
}

extension _Copy on Event {
  Event copyWith({String? status}) => Event(id: id, ownerId: ownerId, title: title, category: category, date: date, venue: venue, lat: lat, lng: lng, description: description, ticketTypes: ticketTypes, status: status ?? this.status, coverImageUrl: coverImageUrl, mediaUrls: mediaUrls, thankYouMessage: thankYouMessage, featured: featured, featuredUntil: featuredUntil, collaboratorIds: collaboratorIds);
}

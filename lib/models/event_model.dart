/// A purchasable / RSVP-able ticket inside an [Event]'s `ticketTypes` array.
class EventTicket {
  final String name;
  final double price;
  final int capacity;
  final double? earlyBirdPrice;
  final String? earlyBirdUntil;

  const EventTicket({
    required this.name,
    required this.price,
    required this.capacity,
    this.earlyBirdPrice,
    this.earlyBirdUntil,
  });

  bool get hasEarlyBird {
    if (earlyBirdPrice == null || earlyBirdUntil == null) return false;
    if (earlyBirdPrice! <= 0 || earlyBirdPrice! >= price) return false;
    final until = DateTime.tryParse(earlyBirdUntil!);
    if (until == null) return false;
    return DateTime.now().isBefore(until);
  }

  double get effectivePrice => hasEarlyBird ? earlyBirdPrice! : price;

  factory EventTicket.fromMap(Map<String, dynamic> map) {
    return EventTicket(
      name: map['name'] as String? ?? '',
      price: (map['price'] as num?)?.toDouble() ?? 0,
      capacity: (map['capacity'] as num?)?.toInt() ?? 0,
      earlyBirdPrice: (map['earlyBirdPrice'] as num?)?.toDouble(),
      earlyBirdUntil: map['earlyBirdUntil'] as String?,
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'name': name,
      'price': price,
      'capacity': capacity,
      if (earlyBirdPrice != null) 'earlyBirdPrice': earlyBirdPrice,
      if (earlyBirdUntil != null) 'earlyBirdUntil': earlyBirdUntil,
    };
  }
}

/// Event stored in Firestore at `events/{eventId}`.
class Event {
  final String id;
  final String ownerId;
  final String title;
  final String category; // wedding | funeral | corporate | social
  final DateTime date;
  final String venue;
  final double lat;
  final double lng;
  final String description;
  final List<EventTicket> ticketTypes;
  final String status; // draft | pending_review | published | completed | rejected | cancelled
  final String coverImageUrl;
  final List<String> mediaUrls;
  final String thankYouMessage;
  final bool featured;
  final String? featuredUntil;
  final List<String> collaboratorIds;

  const Event({
    required this.id,
    required this.ownerId,
    required this.title,
    required this.category,
    required this.date,
    required this.venue,
    this.lat = 0,
    this.lng = 0,
    this.description = '',
    this.ticketTypes = const [],
    this.status = 'pending_review',
    this.coverImageUrl = '',
    this.mediaUrls = const [],
    this.thankYouMessage = '',
    this.featured = false,
    this.featuredUntil,
    this.collaboratorIds = const [],
  });

  List<String> get allMediaUrls {
    final urls = <String>[];
    if (coverImageUrl.isNotEmpty) urls.add(coverImageUrl);
    for (final u in mediaUrls) {
      if (u.isNotEmpty && !urls.contains(u)) urls.add(u);
    }
    return urls;
  }

  bool get isVideoUrl => coverImageUrl.toLowerCase().endsWith('.mp4') ||
      coverImageUrl.toLowerCase().endsWith('.mov') ||
      coverImageUrl.toLowerCase().endsWith('.webm');

  static bool isVideo(String url) {
    final l = url.toLowerCase();
    return l.endsWith('.mp4') || l.endsWith('.mov') || l.endsWith('.webm');
  }

  /// An event with no paid ticket types is free.
  bool get isFree => ticketTypes.every((t) => t.price == 0);

  /// Whether this event is currently featured (boosted) and its boost period
  /// has not yet expired.
  bool get isCurrentlyFeatured {
    if (!featured) return false;
    final until = featuredUntil;
    if (until == null) return false;
    return DateTime.tryParse(until)?.isAfter(DateTime.now()) ?? false;
  }

  double get cheapestPrice {
    if (ticketTypes.isEmpty) return 0;
    return ticketTypes.map((t) => t.effectivePrice).reduce((a, b) => a < b ? a : b);
  }

  double get cheapestOriginalPrice {
    if (ticketTypes.isEmpty) return 0;
    return ticketTypes.map((t) => t.price).reduce((a, b) => a < b ? a : b);
  }

  factory Event.fromMap(String id, Map<String, dynamic> map) {
    return Event(
      id: id,
      ownerId: map['ownerId'] as String? ?? '',
      title: map['title'] as String? ?? '',
      category: map['category'] as String? ?? 'social',
      date: _parseDate(map['date']),
      venue: map['venue'] as String? ?? '',
      lat: (map['lat'] as num?)?.toDouble() ?? 0,
      lng: (map['lng'] as num?)?.toDouble() ?? 0,
      description: map['description'] as String? ?? '',
      ticketTypes: (map['ticketTypes'] as List? ?? const [])
          .map((e) => EventTicket.fromMap(Map<String, dynamic>.from(e as Map)))
          .toList(),
      status: map['status'] as String? ?? 'pending_review',
      coverImageUrl: map['coverImageUrl'] as String? ?? '',
      mediaUrls: List<String>.from(map['mediaUrls'] as List? ?? const []),
      thankYouMessage: map['thankYouMessage'] as String? ?? '',
      featured: map['featured'] as bool? ?? false,
      featuredUntil: map['featuredUntil'] as String?,
      collaboratorIds: List<String>.from(map['collaboratorIds'] as List? ?? const []),
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'ownerId': ownerId,
      'title': title,
      'category': category,
      'date': date.toUtc().toIso8601String(),
      'venue': venue,
      'lat': lat,
      'lng': lng,
      'description': description,
      'ticketTypes': ticketTypes.map((t) => t.toMap()).toList(),
      'status': status,
      'coverImageUrl': coverImageUrl,
      'mediaUrls': mediaUrls,
      'thankYouMessage': thankYouMessage,
      'featured': featured,
      'featuredUntil': featuredUntil,
      'collaboratorIds': collaboratorIds,
    };
  }

  static DateTime _parseDate(dynamic value) {
    if (value is DateTime) return value;
    if (value is String) {
      return DateTime.tryParse(value) ?? DateTime.fromMillisecondsSinceEpoch(0);
    }
    return DateTime.fromMillisecondsSinceEpoch(0);
  }
}

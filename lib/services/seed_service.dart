import 'dart:math';

import '../models/event_model.dart';
import 'local_db.dart';

/// Seeds the local database with realistic demo data.
///
/// 10 organizers, 10 attendees, 100 events (10 per organizer),
/// sample bookings, chats, and notifications.
class SeedService {
  SeedService() : _db = LocalStore.instance;

  final LocalStore _db;

  static const int _seedVersion = 4;

  Future<void> seedIfEmpty() async {
    final version = _db.session.get('seedVersion') as int? ?? 0;
    if (version >= _seedVersion) return;

    // --- Wipe old data ---
    await _db.events.clear();
    await _db.bookings.clear();
    await _db.registrations.clear();
    await _db.chats.clear();
    await _db.messages.clear();
    await _db.posts.clear();
    await _db.notifications.clear();
    await _db.follows.clear();
    await _db.waitlist.clear();
    await _db.refunds.clear();
    await _db.reviews.clear();
    await _db.promotions.clear();
    await _db.discountCodes.clear();
    await _db.invitedGuests.clear();
    await _db.guestList.clear();
    await _db.eventSchedules.clear();

    final now = DateTime.now();
    final rand = Random(42);

    // ─── 10 ORGANIZERS ──────────────────────────────────────────────
    final organizers = [
      _U('org-1', 'Kwame Asante', 'Event planner & MC in Accra. 5+ years experience.', 'kwame@eventhub.app'),
      _U('org-2', 'Ama Mensah', 'Wedding & party decorator. Making your special day beautiful.', 'ama@eventhub.app'),
      _U('org-3', 'Kofi Adjei', 'Corporate event specialist. Conferences, galas & team building.', 'kofi@eventhub.app'),
      _U('org-4', 'Akua Boateng', 'Funeral & celebration of life coordinator.', 'akua@eventhub.app'),
      _U('org-5', 'Yaw Owusu', 'Social events & concert promoter. Accra nightlife.', 'yaw@eventhub.app'),
      _U('org-6', 'Efua Sutherland', 'Children\'s party specialist & face painter.', 'efua@eventhub.app'),
      _U('org-7', 'Nana Ofori', 'Sports event organizer. Marathons, tournaments, galas.', 'nana.o@eventhub.app'),
      _U('org-8', 'Abena Pokua', 'Food & drink festival curator. Taste of Ghana.', 'abena@eventhub.app'),
      _U('org-9', 'Kwesi Mensah', 'Music producer & live event sound engineer.', 'kwesi@eventhub.app'),
      _U('org-10', 'Adjoa Wiredu', 'Art & culture exhibition curator. Gallery events.', 'adjoa@eventhub.app'),
    ];
    for (final o in organizers) {
      _seedUser(o.uid, o.name, o.bio, o.email, ['organizer']);
    }

    // ─── 10 ATTENDEES ───────────────────────────────────────────────
    final attendees = [
      _U('att-1', 'Nana Agyeman', 'Love attending social events and live music.', 'nana@eventhub.app'),
      _U('att-2', 'Esi Mensah', 'Corporate professional. Conferences & networking.', 'esi@eventhub.app'),
      _U('att-3', 'Kojo Frimpong', 'Fun-loving. Comedy shows, concerts, weddings.', 'kojo@eventhub.app'),
      _U('att-4', 'Adwoa Nyarko', 'Always the first to RSVP!', 'adwoa@eventhub.app'),
      _U('att-5', 'Yaw Boateng', 'Social butterfly. Events in every region.', 'yaw.b@eventhub.app'),
      _U('att-6', 'Ama Darko', 'Foodie. Love food festivals and brunch events.', 'ama.d@eventhub.app'),
      _U('att-7', 'Kwabena Osei', 'Sports fanatic. Marathons and match days.', 'kwabena@eventhub.app'),
      _U('att-8', 'Efua Ansah', 'Art lover. Gallery openings and cultural nights.', 'efua.a@eventhub.app'),
      _U('att-9', 'Yaa Asantewaa', 'Teacher. School events and community gatherings.', 'yaa@eventhub.app'),
      _U('att-10', 'Osei Bonsu', 'Tech entrepreneur. Startup events and hackathons.', 'osei@eventhub.app'),
    ];
    for (final a in attendees) {
      _seedUser(a.uid, a.name, a.bio, a.email, ['attendee']);
    }

    // ─── 100 EVENTS (10 per organizer) ──────────────────────────────
    final eventIds = <String>[];
    int c = 1;

    // --- org-1 Kwame Asante: Social, weddings ---
    _evts('org-1', now, rand, eventIds, c, [
      _E('Accra Music Festival 2026', 'social', 14, 'Black Star Square, Greater Accra', [50, 150], [500, 100], true, 7),
      _E('Kwame & Abena Wedding', 'wedding', 21, 'La Palm Royal Beach Hotel, Greater Accra', [100], [200], false, 0),
      _E('Traditional Naming Ceremony', 'wedding', 3, 'East Legon, Greater Accra', [0, 20], [100, 60], false, 0),
      _E('Highlife Night Live', 'social', 12, 'National Theatre, Greater Accra', [80, 200], [600, 80], true, 10),
      _E('Community Fun Fair', 'social', 18, 'Tema Community 1, Greater Accra', [0, 15], [1000, 200], false, 0),
      _E('Kofi & Akosua Engagement', 'wedding', 25, 'Mövenpick Ambassador Hotel, Greater Accra', [150], [150], false, 0),
      _E('Independence Day Celebration', 'social', 200, 'Independence Square, Greater Accra', [30, 100], [800, 200], true, 14),
      _E('Jazz & Wine Evening', 'social', 9, 'One11 Hotel, Greater Accra', [120], [100], false, 0),
      _E('Traditional Outdooring', 'wedding', 15, 'Airport Residential, Greater Accra', [0], [80], false, 0),
      _E('New Year Beach Party', 'social', 120, 'Bojo Beach Resort, Greater Accra', [60, 150], [400, 60], true, 30),
    ]);
    c += 10;

    // --- org-2 Ama Mensah: Weddings, parties ---
    _evts('org-2', now, rand, eventIds, c, [
      _E('Wedding Decor Showcase 2026', 'wedding', 28, 'Kempinski Hotel, Greater Accra', [40], [100], false, 0),
      _E('Ama & Kweku White Wedding', 'wedding', 35, 'Tema Golf Club, Greater Accra', [200], [200], false, 0),
      _E('Kids Birthday Bash', 'social', 11, 'Happy Land Indoor Play, Greater Accra', [25, 50], [30, 100], false, 0),
      _E('Garden Party & Networking', 'social', 5, 'Labadi Beach Hotel, Greater Accra', [0], [150], false, 0),
      _E('Floral Arrangement Workshop', 'corporate', 10, 'British Council, Greater Accra', [80], [40], false, 0),
      _E('Naa & Tetteh Traditional Wedding', 'wedding', 40, 'Legon Botanical Gardens, Greater Accra', [50, 100], [200, 50], false, 0),
      _E('Bridal Shower Bonanza', 'social', 16, 'Villa Monticello Hotel, Greater Accra', [30], [60], false, 0),
      _E('Graduation Celebration', 'social', 32, 'Ghana Academy of Sciences, Greater Accra', [25], [120], false, 0),
      _E('Easter Brunch & Social', 'social', 195, 'Sands Beach Resort, Central', [80, 150], [100, 30], false, 0),
      _E('Ama & Kweku Trad. Wedding', 'wedding', 30, 'Osu Oxford Street, Greater Accra', [75], [300], true, 20),
    ]);
    c += 10;

    // --- org-3 Kofi Adjei: Corporate ---
    _evts('org-3', now, rand, eventIds, c, [
      _E('Ghana Tech Summit 2026', 'corporate', 30, 'Kempinski Hotel, Greater Accra', [200, 500, 50], [300, 50, 100], true, 14),
      _E('Corporate Leadership Retreat', 'corporate', 45, 'Mövenpick Hotel, Ashanti', [300, 1200], [80, 20], false, 0),
      _E('Digital Marketing Masterclass', 'corporate', 14, 'Impact Hub Accra, Greater Accra', [150], [60], false, 0),
      _E('Startup Pitch Night', 'corporate', 22, 'Ghana Tech Lab, Greater Accra', [0, 50], [200, 30], false, 0),
      _E('Annual Banking Conference', 'corporate', 50, 'Labadi Beach Hotel, Greater Accra', [350, 750], [150, 40], true, 21),
      _E('Healthcare Innovation Forum', 'corporate', 38, 'Korle Bu Conf. Hall, Greater Accra', [100], [80], false, 0),
      _E('HR & People Mgmt Workshop', 'corporate', 17, 'Golden Tulip Hotel, Greater Accra', [200], [50], false, 0),
      _E('Sustainability & ESG Summit', 'corporate', 60, 'Kempinski Hotel, Greater Accra', [250, 600], [100, 25], true, 30),
      _E('Business Networking Breakfast', 'corporate', 8, 'Marriott Hotel, Greater Accra', [80], [40], false, 0),
      _E('Fintech Ghana Conference', 'corporate', 42, 'Accra Intl. Conference Centre', [150, 400], [200, 50], false, 0),
    ]);
    c += 10;

    // --- org-4 Akua Boateng: Funerals, social ---
    _evts('org-4', now, rand, eventIds, c, [
      _E('Celebration of Life — Nana A.', 'funeral', 7, 'National Theatre, Greater Accra', [0], [400], false, 0),
      _E('Family Reunion & Graduation', 'social', 25, 'Kumasi Sports Hotel, Ashanti', [30, 10], [100, 50], false, 0),
      _E('Mama Afia Memorial Service', 'funeral', 14, 'Ohene Djan Stadium, Greater Accra', [0], [500], false, 0),
      _E('Bereavement Support Brunch', 'funeral', 35, 'Kempinski Hotel, Greater Accra', [50], [80], false, 0),
      _E('Family Thanksgiving Gathering', 'social', 42, 'Lashibi Community Hall, Greater Accra', [20], [150], false, 0),
      _E('Uncle Kwaku Final Rites', 'funeral', 10, 'Maamobi Sports Complex, Greater Accra', [0, 15], [300, 100], false, 0),
      _E('Heritage & Culture Celebration', 'social', 28, 'Centre for National Culture, Ashanti', [40], [200], false, 0),
      _E('Community Fundraiser Gala', 'social', 55, 'Labadi Beach Hotel, Greater Accra', [100, 250], [100, 30], true, 21),
      _E('50th Birthday Celebration', 'social', 20, 'Alisa Hotel North Ridge, Greater Accra', [60], [120], false, 0),
      _E('Auntie Grace Remembrance', 'funeral', 65, 'Holy Spirit Cathedral, Greater Accra', [0], [250], false, 0),
    ]);
    c += 10;

    // --- org-5 Yaw Owusu: Social, concerts ---
    _evts('org-5', now, rand, eventIds, c, [
      _E('Afrobeats Night with Sarkodie', 'social', 10, 'Grand Arena, Greater Accra', [80, 1000], [800, 20], true, 5),
      _E('Comedy Night — Laugh Out Accra', 'social', 18, 'Golden Tulip Hotel, Greater Accra', [60, 120], [250, 30], false, 0),
      _E('Reggae Roots Revival', 'social', 24, 'Bukom Boxing Arena, Greater Accra', [50], [500], false, 0),
      _E('Fashion Week Ghana', 'corporate', 50, 'Accra Intl. Conference Centre', [100, 300], [200, 50], true, 30),
      _E('Hiplife Block Party', 'social', 8, 'Osu Oxford Street, Greater Accra', [20], [1000], false, 0),
      _E('Acoustic Sunset Sessions', 'social', 13, 'Sky Bar, Greater Accra', [40], [80], false, 0),
      _E('Ghana Movie Premiere Night', 'social', 22, 'Silverbird Cinemas, Greater Accra', [60], [300], false, 0),
      _E('Salsa Night & Dance Social', 'social', 6, 'Mango House Restaurant, Greater Accra', [30], [60], false, 0),
      _E('Throwback Friday Party', 'social', 37, 'Plot 7, Greater Accra', [40, 100], [300, 50], false, 0),
      _E('New Year Countdown Concert', 'social', 127, 'Independence Square, Greater Accra', [100, 300, 500], [2000, 200, 50], true, 60),
    ]);
    c += 10;

    // --- org-6 Efua Sutherland: Children's parties ---
    _evts('org-6', now, rand, eventIds, c, [
      _E('Princess Birthday Extravaganza', 'social', 12, 'Happy Land Indoor Play, Greater Accra', [25], [40], false, 0),
      _E('Superhero Academy Party', 'social', 19, 'Bouncy Castle World, Greater Accra', [30], [50], false, 0),
      _E('Under-the-Sea Birthday Bash', 'social', 26, 'La Palm Royal Beach Hotel, Greater Accra', [40], [30], false, 0),
      _E('Dinosaur Adventure Party', 'social', 33, 'Accra Zoo, Greater Accra', [20, 35], [60, 20], false, 0),
      _E('Unicorn Magic Party', 'social', 40, 'Golden Tulip Hotel, Greater Accra', [35], [35], false, 0),
      _E('Pirate Treasure Hunt Party', 'social', 47, 'Labadi Beach Hotel, Greater Accra', [25], [40], false, 0),
      _E('Frozen Winter Wonderland', 'social', 54, 'Mövenpick Hotel, Greater Accra', [45], [30], false, 0),
      _E('Lego Building Birthday', 'social', 61, 'East Legon Community Centre', [20], [50], false, 0),
      _E('Carnival Costume Kids Party', 'social', 180, 'National Theatre, Greater Accra', [15, 30], [100, 30], false, 0),
      _E('End-of-Year Kids Disco', 'social', 270, 'Kempinski Hotel, Greater Accra', [25, 50], [80, 20], false, 0),
    ]);
    c += 10;

    // --- org-7 Nana Ofori: Sports events ---
    _evts('org-7', now, rand, eventIds, c, [
      _E('Accra Marathon 2026', 'social', 60, 'Independence Square, Greater Accra', [50, 100], [2000, 200], true, 30),
      _E('Charity Football Match', 'social', 14, 'Ohene Djan Sports Stadium, Greater Accra', [10, 30], [500, 100], false, 0),
      _E('Corporate Golf Tournament', 'corporate', 30, 'Tema Golf Club, Greater Accra', [200], [60], true, 14),
      _E('Basketball 3x3 Championship', 'social', 21, 'Bukom Arena, Greater Accra', [15], [200], false, 0),
      _E('Swimming Gala', 'social', 28, 'Poolside Resort, Greater Accra', [20], [100], false, 0),
      _E('Inter-Company Sports Day', 'corporate', 35, 'Legon Sports Stadium, Greater Accra', [30], [300], false, 0),
      _E('Cycling Tour of Greater Accra', 'social', 42, 'Osu to Tema Beach Road', [40], [150], false, 0),
      _E('Boxing Night: Ghana vs Nigeria', 'social', 49, 'Bukom Boxing Arena, Greater Accra', [100, 500], [300, 50], true, 21),
      _E('Kids Sports Camp', 'social', 90, 'Ashesi University Grounds, Greater Accra', [25], [80], false, 0),
      _E('New Year Fun Run 5K', 'social', 130, 'Labadi Beach to Osu, Greater Accra', [20, 40], [500, 100], false, 0),
    ]);
    c += 10;

    // --- org-8 Abena Pokua: Food & drink festivals ---
    _evts('org-8', now, rand, eventIds, c, [
      _E('Taste of Ghana Food Festival', 'social', 21, 'Labadi Beach Hotel, Greater Accra', [50, 100], [500, 100], true, 14),
      _E('Wine & Cheese Tasting Night', 'social', 14, 'One11 Hotel, Greater Accra', [120], [60], false, 0),
      _E('Street Food Saturday', 'social', 7, 'Osu Oxford Street, Greater Accra', [0, 15], [1000, 200], false, 0),
      _E('Jollof Rice War Competition', 'social', 28, 'National Theatre, Greater Accra', [30, 80], [400, 60], true, 7),
      _E('Brunch & Bubbles', 'social', 10, 'Mövenpick Hotel, Greater Accra', [150], [80], false, 0),
      _E('Chocolate & Dessert Festival', 'social', 35, 'Kempinski Hotel, Greater Accra', [60], [200], false, 0),
      _E('Cooking Masterclass with Chef', 'corporate', 18, 'Alisa Hotel North Ridge, Greater Accra', [200], [30], false, 0),
      _E('Beach BBQ & Seafood Fest', 'social', 25, 'Bojo Beach Resort, Greater Accra', [40, 80], [300, 50], false, 0),
      _E('Ghana Coffee Festival', 'social', 42, 'Impact Hub Accra, Greater Accra', [30], [120], false, 0),
      _E('New Year\'s Eve Gala Dinner', 'social', 128, 'Marriott Hotel, Greater Accra', [250, 500], [100, 20], true, 30),
    ]);
    c += 10;

    // --- org-9 Kwesi Mensah: Music events ---
    _evts('org-9', now, rand, eventIds, c, [
      _E('Gospel Night of Worship', 'social', 15, 'National Theatre, Greater Accra', [30, 80], [600, 100], false, 0),
      _E('Hiplife Old School Reunion', 'social', 22, 'Bukom Boxing Arena, Greater Accra', [50], [500], true, 7),
      _E('Acoustic Unplugged Session', 'social', 8, 'Sky Bar, Greater Accra', [40], [80], false, 0),
      _E('DJ Battle Night', 'social', 16, 'Plot 7, Greater Accra', [30, 80], [300, 40], false, 0),
      _E('Live Band Thursdays', 'social', 11, 'Mango House Restaurant, Greater Accra', [25], [100], false, 0),
      _E('Ghana Music Awards Pre-Party', 'social', 45, 'Kempinski Hotel, Greater Accra', [100, 300], [200, 50], true, 14),
      _E('Kidifest Family Concert', 'social', 60, 'Accra International Conference Centre', [20, 50], [800, 200], false, 0),
      _E('Poetry & Spoken Word Night', 'social', 30, 'Alliance Française, Greater Accra', [25], [100], false, 0),
      _E('International Jazz Day Concert', 'social', 210, 'National Theatre, Greater Accra', [80, 200], [400, 80], false, 0),
      _E('Christmas Carol Concert', 'social', 115, 'Holy Spirit Cathedral, Greater Accra', [0, 50], [500, 100], false, 0),
    ]);
    c += 10;

    // --- org-10 Adjoa Wiredu: Art & culture ---
    _evts('org-10', now, rand, eventIds, c, [
      _E('Contemporary Art Exhibition', 'social', 20, 'Gallery 1957, Greater Accra', [20], [80], false, 0),
      _E('Photography Workshop & Walk', 'corporate', 14, 'Osu Heritage Trail, Greater Accra', [40], [30], false, 0),
      _E('Kente Weaving Demo & Market', 'social', 28, 'Centre for National Culture, Ashanti', [10], [200], false, 0),
      _E('Film Screening: Ghanaian Cinema', 'social', 10, 'Silverbird Cinemas, Greater Accra', [25], [150], false, 0),
      _E('Art & Wine Night', 'social', 17, 'Alliance Française, Greater Accra', [60], [60], false, 0),
      _E('Sculpture in the Park', 'social', 35, 'Legon Botanical Gardens, Greater Accra', [15], [100], false, 0),
      _E('Cultural Dance Showcase', 'social', 42, 'National Theatre, Greater Accra', [20, 50], [300, 60], true, 14),
      _E('Creative Writing Workshop', 'corporate', 25, 'British Council, Greater Accra', [30], [40], false, 0),
      _E('Poetry Slam Championship', 'social', 49, 'Bukom Arena, Greater Accra', [25, 60], [200, 40], false, 0),
      _E('Year-End Art Gala', 'social', 120, 'Kempinski Hotel, Greater Accra', [80, 200], [100, 30], true, 30),
    ]);

    // ─── SAMPLE BOOKINGS (first 15 events, 2-4 attendees each) ──────
    final bookingEvents = eventIds.sublist(0, 15);
    int bkC = 1;
    for (final eventId in bookingEvents) {
      final eventMap = _db.events.get(eventId);
      if (eventMap == null) continue;
      final tickets = (eventMap['ticketTypes'] as List? ?? const []);
      if (tickets.isEmpty) continue;
      final firstTicket = tickets.first as Map;
      final ticketName = firstTicket['name'] as String? ?? 'General';

      final numBk = 2 + rand.nextInt(3);
      for (int i = 0; i < numBk && i < attendees.length; i++) {
        final regId = 'reg-$bkC';
        final bookingId = 'bk-$bkC';

        _db.registrations.put(regId, {
          'id': regId,
          'eventId': eventId,
          'userId': attendees[i].uid,
          'fullName': attendees[i].name,
          'ticketType': ticketName,
          'hometown': _town(rand),
          'denomination': _denom(rand),
          'religion': 'Christianity',
          'gender': i % 2 == 0 ? 'Male' : 'Female',
          'attendeeType': 'Guest',
          'createdAt': now.subtract(Duration(days: rand.nextInt(5))).toUtc().toIso8601String(),
        });

        _db.bookings.put(bookingId, {
          'id': bookingId,
          'eventId': eventId,
          'userId': attendees[i].uid,
          'regId': regId,
          'status': 'confirmed',
          'checkedIn': rand.nextDouble() < 0.3,
          'seatNumber': '',
          'qrCode': 'QR-$bookingId',
          'createdAt': now.subtract(Duration(days: rand.nextInt(5))).toUtc().toIso8601String(),
        });
        bkC++;
      }
    }

    // ─── SAMPLE CHATS ──────────────────────────────────────────────
    for (int i = 0; i < 10; i++) {
      final eventId = eventIds[i];
      final eventMap = _db.events.get(eventId);
      final ownerId = eventMap?['ownerId'] as String? ?? '';
      _db.chats.put('chat-${i + 1}', {
        'eventId': eventId,
        'memberIds': [ownerId, ...attendees.take(3).map((a) => a.uid)],
        'type': 'group',
        'createdBy': ownerId,
        'readOnly': false,
        'lastReadAt': <String, dynamic>{},
        'createdAt': now.toUtc().toIso8601String(),
      });
    }

    // ─── SAMPLE NOTIFICATIONS ──────────────────────────────────────
    final notifs = [
      ('Booking Confirmed', 'Your booking for "Accra Music Festival 2026" is confirmed.', 'booking_confirmed', eventIds[0]),
      ('New Follower', 'Esi Mensah started following you.', 'new_follower', 'att-2'),
      ('Event Update', 'Kwame Asante posted an update on "Highlife Night Live".', 'event_update', eventIds[3]),
      ('Event Reminder', '"Garden Party & Networking Mixer" is happening in 5 days!', 'event_reminder', eventIds[14]),
      ('Waitlist Spot Available', 'A spot opened up for "Afrobeats Night with Sarkodie"!', 'waitlist_spot', eventIds[39]),
    ];
    for (int i = 0; i < notifs.length; i++) {
      final n = notifs[i];
      _db.notifications.put('notif-${i + 1}', {
        'id': 'notif-${i + 1}',
        'uid': 'att-1',
        'title': n.$1,
        'body': n.$2,
        'type': n.$3,
        'targetId': n.$4,
        'read': i > 1,
        'createdAt': now.subtract(Duration(hours: i * 3)).toUtc().toIso8601String(),
      });
    }

    await _db.session.put('seedVersion', _seedVersion);
  }

  // ─── Helpers ───────────────────────────────────────────────────────

  void _seedUser(String uid, String name, String bio, String email, List<String> roles) {
    _db.users.put(uid, {
      'uid': uid, 'name': name, 'phone': '', 'email': email,
      'roles': roles, 'bio': bio, 'avatarUrl': '',
      'followers': 0, 'following': 0,
      'savedEventIds': <String>[], 'remindersEnabled': true,
      'messageNotifsEnabled': true, 'followerNotifsEnabled': true,
      'promoNotifsEnabled': false, 'blockedUids': <String>[],
      'savedMomoNumber': '', 'savedMomoNetwork': '',
      'createdAt': DateTime.now().toUtc().toIso8601String(),
    });
    _db.auth.put(uid, {'uid': uid, 'email': email, 'password': 'demo123'});
  }

  void _evts(
    String ownerId,
    DateTime now,
    Random rand,
    List<String> eventIds,
    int startCounter,
    List<_E> events,
  ) {
    int c = startCounter;
    for (final e in events) {
      final id = 'seed-$c';
      eventIds.add(id);
      _seedEvent(id: id, ownerId: ownerId, data: e, now: now, rand: rand);
      c++;
    }
  }

  void _seedEvent({
    required String id,
    required String ownerId,
    required _E data,
    required DateTime now,
    required Random rand,
  }) {
    final date = now.add(Duration(days: data.d + rand.nextInt(3)));
    final tickets = <EventTicket>[];
    for (int i = 0; i < data.p.length; i++) {
      tickets.add(EventTicket(
        name: _tierName(data.p.length, i),
        price: data.p[i].toDouble(),
        capacity: data.c[i],
      ));
    }
    final mediaPool = [
      'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=800',
      'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=800',
      'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800',
      'https://images.unsplash.com/photo-1469371670807-013ccf25f16a?w=800',
      'https://images.unsplash.com/photo-1516450360452-9312abbf6f7e?w=800',
    ];
    final mCount = 1 + rand.nextInt(3);
    final mediaUrls = List<String>.generate(mCount, (i) => mediaPool[(id.hashCode + i) % mediaPool.length]);
    if (rand.nextDouble() < 0.12) {
      mediaUrls[mediaUrls.length - 1] = 'https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_1mb.mp4';
    }
    final event = Event(
      id: id, ownerId: ownerId, title: data.t, category: data.cat,
      date: date, venue: data.v, ticketTypes: tickets, status: 'published',
      lat: _lat(data.v), lng: _lng(data.v),
      coverImageUrl: mediaUrls.first,
      mediaUrls: mediaUrls,
      featured: data.f,
      featuredUntil: data.fd > 0 ? now.add(Duration(days: data.fd)).toIso8601String() : null,
    );
    _db.events.put(id, event.toMap());
  }

  String _tierName(int count, int i) {
    if (count == 1) return 'General';
    const n = ['Regular', 'VIP', 'Premium', 'Student', 'Table'];
    return i < n.length ? n[i] : 'Tier ${i + 1}';
  }

  double _lat(String v) {
    if (v.contains('Kumasi') || v.contains('Ashanti')) return 6.6885;
    if (v.contains('Central')) return 5.1054;
    return 5.6037 + (v.hashCode % 100) / 1000.0;
  }

  double _lng(String v) {
    if (v.contains('Kumasi') || v.contains('Ashanti')) return -1.6244;
    if (v.contains('Central')) return -1.2466;
    return -0.1870 + (v.hashCode % 100) / 1000.0;
  }

  String _town(Random r) => ['Accra', 'Kumasi', 'Tamale', 'Takoradi', 'Cape Coast', 'Tema', 'Sunyani', 'Ho'][r.nextInt(8)];
  String _denom(Random r) => ['Presbyterian', 'Methodist', 'Catholic', 'Pentecost', 'Anglican', 'Baptist'][r.nextInt(6)];
}

class _U {
  final String uid, name, bio, email;
  const _U(this.uid, this.name, this.bio, this.email);
}

class _E {
  final String t, cat, v;
  final int d;
  final List<int> p, c;
  final bool f;
  final int fd;
  const _E(this.t, this.cat, this.d, this.v, this.p, this.c, this.f, this.fd);
}

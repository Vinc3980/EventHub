import { db, getSeedVersion, setSeedVersion } from '../db/db';
import { hashPassword } from '../lib/crypto';
import { withAssetBase } from '../lib/asset';
import { Event, EventTicket, Post, User } from '../models';
import type { EventCategory, Role } from '../models';
import { WALLPAPER_IMAGES, WALLPAPER_VIDEOS } from './seedMedia';

export const SEED_VERSION = 'v6';

const SEED_PASSWORD = 'demo123';
const DAY_MS = 86_400_000;
const RANDOM_SEED = 42;
const HOUR_MS = 3_600_000;

type Row = Record<string, unknown>;

interface Person {
  uid: string;
  name: string;
  bio: string;
  email: string;
}

interface AuthRow {
  uid: string;
  email: string;
  passwordHash: string;
}

interface SeedEvent {
  title: string;
  category: EventCategory;
  dayOffset: number;
  venue: string;
  prices: number[];
  capacities: number[];
  featured: boolean;
  featuredDays: number;
}

interface EventGroup {
  ownerId: string;
  events: SeedEvent[];
}

function person(uid: string, name: string, bio: string, email: string): Person {
  return { uid, name, bio, email };
}

function E(
  title: string,
  category: EventCategory,
  dayOffset: number,
  venue: string,
  prices: number[],
  capacities: number[],
  featured: boolean,
  featuredDays: number,
): SeedEvent {
  return { title, category, dayOffset, venue, prices, capacities, featured, featuredDays };
}

const ADMIN: Person = person(
  'admin-1',
  'EventHub Admin',
  'EventHub platform administrator.',
  'admin@eventhub.app',
);

/** Attendee and organizer are merged: everyone is a `user`, admins stay `admin`. */
const USER_ROLES: Role[] = ['user'];

const ADMIN_ROLES: Role[] = ['admin', 'user'];

const ORGANIZERS: Person[] = [
  person('org-1', 'Kwame Asante', 'Event planner & MC in Accra. 5+ years experience.', 'kwame@eventhub.app'),
  person('org-2', 'Ama Mensah', 'Wedding & party decorator. Making your special day beautiful.', 'ama@eventhub.app'),
  person('org-3', 'Kofi Adjei', 'Corporate event specialist. Conferences, galas & team building.', 'kofi@eventhub.app'),
  person('org-4', 'Akua Boateng', 'Funeral & celebration of life coordinator.', 'akua@eventhub.app'),
  person('org-5', 'Yaw Owusu', 'Social events & concert promoter. Accra nightlife.', 'yaw@eventhub.app'),
  person('org-6', 'Efua Sutherland', "Children's party specialist & face painter.", 'efua@eventhub.app'),
  person('org-7', 'Nana Ofori', 'Sports event organizer. Marathons, tournaments, galas.', 'nana.o@eventhub.app'),
  person('org-8', 'Abena Pokua', 'Food & drink festival curator. Taste of Ghana.', 'abena@eventhub.app'),
  person('org-9', 'Kwesi Mensah', 'Music producer & live event sound engineer.', 'kwesi@eventhub.app'),
  person('org-10', 'Adjoa Wiredu', 'Art & culture exhibition curator. Gallery events.', 'adjoa@eventhub.app'),
];

const ATTENDEES: Person[] = [
  person('att-1', 'Nana Agyeman', 'Love attending social events and live music.', 'nana@eventhub.app'),
  person('att-2', 'Esi Mensah', 'Corporate professional. Conferences & networking.', 'esi@eventhub.app'),
  person('att-3', 'Kojo Frimpong', 'Fun-loving. Comedy shows, concerts, weddings.', 'kojo@eventhub.app'),
  person('att-4', 'Adwoa Nyarko', 'Always the first to RSVP!', 'adwoa@eventhub.app'),
  person('att-5', 'Yaw Boateng', 'Social butterfly. Events in every region.', 'yaw.b@eventhub.app'),
  person('att-6', 'Ama Darko', 'Foodie. Love food festivals and brunch events.', 'ama.d@eventhub.app'),
  person('att-7', 'Kwabena Osei', 'Sports fanatic. Marathons and match days.', 'kwabena@eventhub.app'),
  person('att-8', 'Efua Ansah', 'Art lover. Gallery openings and cultural nights.', 'efua.a@eventhub.app'),
  person('att-9', 'Yaa Asantewaa', 'Teacher. School events and community gatherings.', 'yaa@eventhub.app'),
  person('att-10', 'Osei Bonsu', 'Tech entrepreneur. Startup events and hackathons.', 'osei@eventhub.app'),
];

/**
 * Extra profiles that exist purely to be followable — feed recommendations.
 * `kind` only describes how they appear in the follow graph (roles are the
 * same `user` role for everyone).
 */
const CREATORS: Array<{ person: Person; kind: 'organizer' | 'attendee' }> = [
  { person: person('org-11', 'Selorm Agbeko', 'Event photographer & content creator. Accra and beyond.', 'selorm@eventhub.app'), kind: 'organizer' },
  { person: person('org-12', 'Naa Dedei Tetteh', 'MC and host for corporate shows, weddings and launches.', 'naa.d@eventhub.app'), kind: 'organizer' },
  { person: person('att-11', 'Fiifi Quartey', 'Dancehall and afrobeats nights. Always on the guest list.', 'fiifi@eventhub.app'), kind: 'attendee' },
  { person: person('att-12', 'Nana Ama Serwaa', 'Fashion stylist. Weddings, launches and red carpets.', 'serwaa@eventhub.app'), kind: 'attendee' },
  { person: person('att-13', 'Emmanuel Tetteh', 'Videographer for events across Accra.', 'emma.t@eventhub.app'), kind: 'attendee' },
  { person: person('att-14', 'Sandra Otoo', 'Brunches, pop-ups and art fairs every weekend.', 'sandra@eventhub.app'), kind: 'attendee' },
];

interface FollowEdge {
  followerId: string;
  followingId: string;
}

/**
 * Deterministic follow graph: it gives the Home feed a populated "Following"
 * tab for every demo account except `att-14`, a brand-new profile that follows
 * nobody — so the "people to follow" recommendation state is reachable.
 */
function buildFollowEdges(): FollowEdge[] {
  const keys = new Set<string>();
  const edges: FollowEdge[] = [];
  const add = (followerId: string, followingId: string) => {
    if (followerId === followingId) return;
    const key = `${followerId}|${followingId}`;
    if (keys.has(key)) return;
    keys.add(key);
    edges.push({ followerId, followingId });
  };

  const orgIds = [
    ...ORGANIZERS.map((p) => p.uid),
    ...CREATORS.filter((c) => c.kind === 'organizer').map((c) => c.person.uid),
  ];
  const attIds = [
    ...ATTENDEES.map((p) => p.uid),
    ...CREATORS.filter((c) => c.kind === 'attendee').map((c) => c.person.uid),
  ];

  // Attendees follow three organizers plus a friend (att-14 follows nobody).
  attIds.forEach((uid, i) => {
    if (uid === 'att-14') return;
    add(uid, orgIds[(2 * i) % orgIds.length]);
    add(uid, orgIds[(2 * i + 5) % orgIds.length]);
    add(uid, orgIds[(2 * i + 9) % orgIds.length]);
    add(uid, attIds[(i + 1) % attIds.length]);
    if (i % 2 === 0) add(uid, attIds[(i + 4) % attIds.length]);
  });

  // Organizers follow peers and a few attendees back.
  orgIds.forEach((uid, i) => {
    add(uid, orgIds[(i + 1) % orgIds.length]);
    add(uid, orgIds[(i + 4) % orgIds.length]);
    if (i % 2 === 0) add(uid, attIds[(i * 3) % attIds.length]);
  });

  return edges;
}

/** Mirror the seeded follow graph onto the users' follower/following counters. */
function applyFollowCounts(userRows: Row[], edges: FollowEdge[]): void {
  const followers = new Map<string, number>();
  const following = new Map<string, number>();
  for (const edge of edges) {
    followers.set(edge.followingId, (followers.get(edge.followingId) ?? 0) + 1);
    following.set(edge.followerId, (following.get(edge.followerId) ?? 0) + 1);
  }
  for (const row of userRows) {
    const uid = String(row.uid ?? '');
    row.followers = followers.get(uid) ?? 0;
    row.following = following.get(uid) ?? 0;
  }
}

const EVENT_GROUPS: EventGroup[] = [
  {
    ownerId: 'org-1',
    events: [
      E('Accra Music Festival 2026', 'social', 14, 'Black Star Square, Greater Accra', [50, 150], [500, 100], true, 7),
      E('Kwame & Abena Wedding', 'wedding', 21, 'La Palm Royal Beach Hotel, Greater Accra', [100], [200], false, 0),
      E('Traditional Naming Ceremony', 'wedding', 3, 'East Legon, Greater Accra', [0, 20], [100, 60], false, 0),
      E('Highlife Night Live', 'social', 12, 'National Theatre, Greater Accra', [80, 200], [600, 80], true, 10),
      E('Community Fun Fair', 'social', 18, 'Tema Community 1, Greater Accra', [0, 15], [1000, 200], false, 0),
      E('Kofi & Akosua Engagement', 'wedding', 25, 'Mövenpick Ambassador Hotel, Greater Accra', [150], [150], false, 0),
      E('Independence Day Celebration', 'social', 200, 'Independence Square, Greater Accra', [30, 100], [800, 200], true, 14),
      E('Jazz & Wine Evening', 'social', 9, 'One11 Hotel, Greater Accra', [120], [100], false, 0),
      E('Traditional Outdooring', 'wedding', 15, 'Airport Residential, Greater Accra', [0], [80], false, 0),
      E('New Year Beach Party', 'social', 120, 'Bojo Beach Resort, Greater Accra', [60, 150], [400, 60], true, 30),
    ],
  },
  {
    ownerId: 'org-2',
    events: [
      E('Wedding Decor Showcase 2026', 'wedding', 28, 'Kempinski Hotel, Greater Accra', [40], [100], false, 0),
      E('Ama & Kweku White Wedding', 'wedding', 35, 'Tema Golf Club, Greater Accra', [200], [200], false, 0),
      E('Kids Birthday Bash', 'social', 11, 'Happy Land Indoor Play, Greater Accra', [25, 50], [30, 100], false, 0),
      E('Garden Party & Networking', 'social', 5, 'Labadi Beach Hotel, Greater Accra', [0], [150], false, 0),
      E('Floral Arrangement Workshop', 'corporate', 10, 'British Council, Greater Accra', [80], [40], false, 0),
      E('Naa & Tetteh Traditional Wedding', 'wedding', 40, 'Legon Botanical Gardens, Greater Accra', [50, 100], [200, 50], false, 0),
      E('Bridal Shower Bonanza', 'social', 16, 'Villa Monticello Hotel, Greater Accra', [30], [60], false, 0),
      E('Graduation Celebration', 'social', 32, 'Ghana Academy of Sciences, Greater Accra', [25], [120], false, 0),
      E('Easter Brunch & Social', 'social', 195, 'Sands Beach Resort, Central', [80, 150], [100, 30], false, 0),
      E('Ama & Kweku Trad. Wedding', 'wedding', 30, 'Osu Oxford Street, Greater Accra', [75], [300], true, 20),
    ],
  },
  {
    ownerId: 'org-3',
    events: [
      E('Ghana Tech Summit 2026', 'corporate', 30, 'Kempinski Hotel, Greater Accra', [200, 500, 50], [300, 50, 100], true, 14),
      E('Corporate Leadership Retreat', 'corporate', 45, 'Mövenpick Hotel, Ashanti', [300, 1200], [80, 20], false, 0),
      E('Digital Marketing Masterclass', 'corporate', 14, 'Impact Hub Accra, Greater Accra', [150], [60], false, 0),
      E('Startup Pitch Night', 'corporate', 22, 'Ghana Tech Lab, Greater Accra', [0, 50], [200, 30], false, 0),
      E('Annual Banking Conference', 'corporate', 50, 'Labadi Beach Hotel, Greater Accra', [350, 750], [150, 40], true, 21),
      E('Healthcare Innovation Forum', 'corporate', 38, 'Korle Bu Conf. Hall, Greater Accra', [100], [80], false, 0),
      E('HR & People Mgmt Workshop', 'corporate', 17, 'Golden Tulip Hotel, Greater Accra', [200], [50], false, 0),
      E('Sustainability & ESG Summit', 'corporate', 60, 'Kempinski Hotel, Greater Accra', [250, 600], [100, 25], true, 30),
      E('Business Networking Breakfast', 'corporate', 8, 'Marriott Hotel, Greater Accra', [80], [40], false, 0),
      E('Fintech Ghana Conference', 'corporate', 42, 'Accra Intl. Conference Centre', [150, 400], [200, 50], false, 0),
    ],
  },
  {
    ownerId: 'org-4',
    events: [
      E('Celebration of Life — Nana A.', 'funeral', 7, 'National Theatre, Greater Accra', [0], [400], false, 0),
      E('Family Reunion & Graduation', 'social', 25, 'Kumasi Sports Hotel, Ashanti', [30, 10], [100, 50], false, 0),
      E('Mama Afia Memorial Service', 'funeral', 14, 'Ohene Djan Stadium, Greater Accra', [0], [500], false, 0),
      E('Bereavement Support Brunch', 'funeral', 35, 'Kempinski Hotel, Greater Accra', [50], [80], false, 0),
      E('Family Thanksgiving Gathering', 'social', 42, 'Lashibi Community Hall, Greater Accra', [20], [150], false, 0),
      E('Uncle Kwaku Final Rites', 'funeral', 10, 'Maamobi Sports Complex, Greater Accra', [0, 15], [300, 100], false, 0),
      E('Heritage & Culture Celebration', 'social', 28, 'Centre for National Culture, Ashanti', [40], [200], false, 0),
      E('Community Fundraiser Gala', 'social', 55, 'Labadi Beach Hotel, Greater Accra', [100, 250], [100, 30], true, 21),
      E('50th Birthday Celebration', 'social', 20, 'Alisa Hotel North Ridge, Greater Accra', [60], [120], false, 0),
      E('Auntie Grace Remembrance', 'funeral', 65, 'Holy Spirit Cathedral, Greater Accra', [0], [250], false, 0),
    ],
  },
  {
    ownerId: 'org-5',
    events: [
      E('Afrobeats Night with Sarkodie', 'social', 10, 'Grand Arena, Greater Accra', [80, 1000], [800, 20], true, 5),
      E('Comedy Night — Laugh Out Accra', 'social', 18, 'Golden Tulip Hotel, Greater Accra', [60, 120], [250, 30], false, 0),
      E('Reggae Roots Revival', 'social', 24, 'Bukom Boxing Arena, Greater Accra', [50], [500], false, 0),
      E('Fashion Week Ghana', 'corporate', 50, 'Accra Intl. Conference Centre', [100, 300], [200, 50], true, 30),
      E('Hiplife Block Party', 'social', 8, 'Osu Oxford Street, Greater Accra', [20], [1000], false, 0),
      E('Acoustic Sunset Sessions', 'social', 13, 'Sky Bar, Greater Accra', [40], [80], false, 0),
      E('Ghana Movie Premiere Night', 'social', 22, 'Silverbird Cinemas, Greater Accra', [60], [300], false, 0),
      E('Salsa Night & Dance Social', 'social', 6, 'Mango House Restaurant, Greater Accra', [30], [60], false, 0),
      E('Throwback Friday Party', 'social', 37, 'Plot 7, Greater Accra', [40, 100], [300, 50], false, 0),
      E('New Year Countdown Concert', 'social', 127, 'Independence Square, Greater Accra', [100, 300, 500], [2000, 200, 50], true, 60),
    ],
  },
  {
    ownerId: 'org-6',
    events: [
      E('Princess Birthday Extravaganza', 'social', 12, 'Happy Land Indoor Play, Greater Accra', [25], [40], false, 0),
      E('Superhero Academy Party', 'social', 19, 'Bouncy Castle World, Greater Accra', [30], [50], false, 0),
      E('Under-the-Sea Birthday Bash', 'social', 26, 'La Palm Royal Beach Hotel, Greater Accra', [40], [30], false, 0),
      E('Dinosaur Adventure Party', 'social', 33, 'Accra Zoo, Greater Accra', [20, 35], [60, 20], false, 0),
      E('Unicorn Magic Party', 'social', 40, 'Golden Tulip Hotel, Greater Accra', [35], [35], false, 0),
      E('Pirate Treasure Hunt Party', 'social', 47, 'Labadi Beach Hotel, Greater Accra', [25], [40], false, 0),
      E('Frozen Winter Wonderland', 'social', 54, 'Mövenpick Hotel, Greater Accra', [45], [30], false, 0),
      E('Lego Building Birthday', 'social', 61, 'East Legon Community Centre', [20], [50], false, 0),
      E('Carnival Costume Kids Party', 'social', 180, 'National Theatre, Greater Accra', [15, 30], [100, 30], false, 0),
      E('End-of-Year Kids Disco', 'social', 270, 'Kempinski Hotel, Greater Accra', [25, 50], [80, 20], false, 0),
    ],
  },
  {
    ownerId: 'org-7',
    events: [
      E('Accra Marathon 2026', 'social', 60, 'Independence Square, Greater Accra', [50, 100], [2000, 200], true, 30),
      E('Charity Football Match', 'social', 14, 'Ohene Djan Sports Stadium, Greater Accra', [10, 30], [500, 100], false, 0),
      E('Corporate Golf Tournament', 'corporate', 30, 'Tema Golf Club, Greater Accra', [200], [60], true, 14),
      E('Basketball 3x3 Championship', 'social', 21, 'Bukom Arena, Greater Accra', [15], [200], false, 0),
      E('Swimming Gala', 'social', 28, 'Poolside Resort, Greater Accra', [20], [100], false, 0),
      E('Inter-Company Sports Day', 'corporate', 35, 'Legon Sports Stadium, Greater Accra', [30], [300], false, 0),
      E('Cycling Tour of Greater Accra', 'social', 42, 'Osu to Tema Beach Road', [40], [150], false, 0),
      E('Boxing Night: Ghana vs Nigeria', 'social', 49, 'Bukom Boxing Arena, Greater Accra', [100, 500], [300, 50], true, 21),
      E('Kids Sports Camp', 'social', 90, 'Ashesi University Grounds, Greater Accra', [25], [80], false, 0),
      E('New Year Fun Run 5K', 'social', 130, 'Labadi Beach to Osu, Greater Accra', [20, 40], [500, 100], false, 0),
    ],
  },
  {
    ownerId: 'org-8',
    events: [
      E('Taste of Ghana Food Festival', 'social', 21, 'Labadi Beach Hotel, Greater Accra', [50, 100], [500, 100], true, 14),
      E('Wine & Cheese Tasting Night', 'social', 14, 'One11 Hotel, Greater Accra', [120], [60], false, 0),
      E('Street Food Saturday', 'social', 7, 'Osu Oxford Street, Greater Accra', [0, 15], [1000, 200], false, 0),
      E('Jollof Rice War Competition', 'social', 28, 'National Theatre, Greater Accra', [30, 80], [400, 60], true, 7),
      E('Brunch & Bubbles', 'social', 10, 'Mövenpick Hotel, Greater Accra', [150], [80], false, 0),
      E('Chocolate & Dessert Festival', 'social', 35, 'Kempinski Hotel, Greater Accra', [60], [200], false, 0),
      E('Cooking Masterclass with Chef', 'corporate', 18, 'Alisa Hotel North Ridge, Greater Accra', [200], [30], false, 0),
      E('Beach BBQ & Seafood Fest', 'social', 25, 'Bojo Beach Resort, Greater Accra', [40, 80], [300, 50], false, 0),
      E('Ghana Coffee Festival', 'social', 42, 'Impact Hub Accra, Greater Accra', [30], [120], false, 0),
      E("New Year's Eve Gala Dinner", 'social', 128, 'Marriott Hotel, Greater Accra', [250, 500], [100, 20], true, 30),
    ],
  },
  {
    ownerId: 'org-9',
    events: [
      E('Gospel Night of Worship', 'social', 15, 'National Theatre, Greater Accra', [30, 80], [600, 100], false, 0),
      E('Hiplife Old School Reunion', 'social', 22, 'Bukom Boxing Arena, Greater Accra', [50], [500], true, 7),
      E('Acoustic Unplugged Session', 'social', 8, 'Sky Bar, Greater Accra', [40], [80], false, 0),
      E('DJ Battle Night', 'social', 16, 'Plot 7, Greater Accra', [30, 80], [300, 40], false, 0),
      E('Live Band Thursdays', 'social', 11, 'Mango House Restaurant, Greater Accra', [25], [100], false, 0),
      E('Ghana Music Awards Pre-Party', 'social', 45, 'Kempinski Hotel, Greater Accra', [100, 300], [200, 50], true, 14),
      E('Kidifest Family Concert', 'social', 60, 'Accra International Conference Centre', [20, 50], [800, 200], false, 0),
      E('Poetry & Spoken Word Night', 'social', 30, 'Alliance Française, Greater Accra', [25], [100], false, 0),
      E('International Jazz Day Concert', 'social', 210, 'National Theatre, Greater Accra', [80, 200], [400, 80], false, 0),
      E('Christmas Carol Concert', 'social', 115, 'Holy Spirit Cathedral, Greater Accra', [0, 50], [500, 100], false, 0),
    ],
  },
  {
    ownerId: 'org-10',
    events: [
      E('Contemporary Art Exhibition', 'social', 20, 'Gallery 1957, Greater Accra', [20], [80], false, 0),
      E('Photography Workshop & Walk', 'corporate', 14, 'Osu Heritage Trail, Greater Accra', [40], [30], false, 0),
      E('Kente Weaving Demo & Market', 'social', 28, 'Centre for National Culture, Ashanti', [10], [200], false, 0),
      E('Film Screening: Ghanaian Cinema', 'social', 10, 'Silverbird Cinemas, Greater Accra', [25], [150], false, 0),
      E('Art & Wine Night', 'social', 17, 'Alliance Française, Greater Accra', [60], [60], false, 0),
      E('Sculpture in the Park', 'social', 35, 'Legon Botanical Gardens, Greater Accra', [15], [100], false, 0),
      E('Cultural Dance Showcase', 'social', 42, 'National Theatre, Greater Accra', [20, 50], [300, 60], true, 14),
      E('Creative Writing Workshop', 'corporate', 25, 'British Council, Greater Accra', [30], [40], false, 0),
      E('Poetry Slam Championship', 'social', 49, 'Bukom Arena, Greater Accra', [25, 60], [200, 40], false, 0),
      E('Year-End Art Gala', 'social', 120, 'Kempinski Hotel, Greater Accra', [80, 200], [100, 30], true, 30),
    ],
  },
];

const TIER_NAMES = ['Regular', 'VIP', 'Premium', 'Student', 'Table'];
const PHONE_PREFIXES = ['024', '025', '026', '027', '050', '054', '055', '059'];
const COMPANY_NAMES = [
  'MTN Ghana',
  'Ecobank Ghana',
  'Vodafone Ghana',
  'Kasapreko Company',
  'AngloGold Ashanti',
  'Deloitte Ghana',
  'Google Ghana',
  'Tullow Ghana',
];
const FUNERAL_GROUPS = [
  'Abetifi Presbyterian Church',
  'Kwahu Family Union',
  'Ashanti Church Choir',
  'Ofori Atta Family',
  'Temma Community Group',
];
const SOCIAL_TABLES = [
  'Table 1',
  'Table 2',
  'Table 3',
  'Legon Friends',
  'Auntie Naa Table',
  'Class of 2015',
];
const JOB_TITLES = ['Manager', 'Analyst', 'Coordinator', 'Director', 'Engineer', 'Consultant'];
const ORGANIZATIONS: Record<EventCategory, string[]> = {
  wedding: [],
  funeral: FUNERAL_GROUPS,
  corporate: COMPANY_NAMES,
  social: SOCIAL_TABLES,
};
const MEDIA_POOL = [
  '/seed/wedding.svg',
  '/seed/funeral.svg',
  '/seed/corporate.svg',
  '/seed/social.svg',
  '/seed/fallback.svg',
];

/** Video posts rotate through the generated clips first, then the imported bundle. */
const POST_VIDEO_MEDIA = [
  '/seed/social-clip.mp4',
  '/seed/gala-clip.mp4',
  '/seed/wedding-clip.mp4',
  '/seed/tech-clip.mp4',
  ...WALLPAPER_VIDEOS,
];

function makeRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function nextInt(rand: () => number, count: number): number {
  return Math.floor(rand() * count);
}

function pick(values: string[], rand: () => number): string {
  return values[nextInt(rand, values.length)];
}

function hashText(value: string): number {
  let h = 5381;
  for (let i = 0; i < value.length; i++) {
    h = (Math.imul(h, 33) ^ value.charCodeAt(i)) >>> 0;
  }
  return h;
}

function tierName(count: number, index: number): string {
  if (count === 1) return 'General';
  return index < TIER_NAMES.length ? TIER_NAMES[index] : `Tier ${index + 1}`;
}

function latitudeFor(venue: string): number {
  if (venue.includes('Kumasi') || venue.includes('Ashanti')) return 6.6885;
  if (venue.includes('Central')) return 5.1054;
  return 5.6037 + (hashText(venue) % 100) / 1000;
}

function longitudeFor(venue: string): number {
  if (venue.includes('Kumasi') || venue.includes('Ashanti')) return -1.6244;
  if (venue.includes('Central')) return -1.2466;
  return -0.187 + (hashText(venue) % 100) / 1000;
}

function coverFor(category: EventCategory, index: number): string {
  if (WALLPAPER_IMAGES.length > 0) return WALLPAPER_IMAGES[index % WALLPAPER_IMAGES.length];
  return `/seed/${category}.svg`;
}

function seedUserRow(p: Person, roles: Role[], index: number, now: Date): Row {
  const avatarIndex = (index % 6) + 1;
  const user = new User({
    uid: p.uid,
    name: p.name,
    email: p.email,
    roles,
    bio: p.bio,
    avatarUrl: `/seed/avatar-${avatarIndex}.svg`,
    bannerUrl: '/seed/banner.svg',
    createdAt: now,
  });
  return user.toMap();
}

function seedEventRow(
  id: string,
  ownerId: string,
  spec: SeedEvent,
  now: Date,
  rand: () => number,
  index: number,
): Row {
  const date = new Date(now.getTime() + (spec.dayOffset + nextInt(rand, 3)) * DAY_MS);
  const ticketTypes = spec.prices.map(
    (price, index) =>
      new EventTicket({
        name: tierName(spec.prices.length, index),
        price,
        capacity: spec.capacities[index],
      }),
  );
  const cover = coverFor(spec.category, index);
  const mediaUrls = [cover];
  const extraPool = WALLPAPER_IMAGES.length > 0 ? WALLPAPER_IMAGES : MEDIA_POOL;
  const extraMedia = nextInt(rand, 3);
  for (let i = 1; i <= extraMedia; i++) {
    const candidate = extraPool[(hashText(id) + i) % extraPool.length];
    if (!mediaUrls.includes(candidate)) mediaUrls.push(candidate);
  }
  const featuredUntil =
    spec.featuredDays > 0
      ? new Date(now.getTime() + spec.featuredDays * DAY_MS).toISOString()
      : undefined;
  const model = new Event({
    id,
    ownerId,
    title: spec.title,
    category: spec.category,
    date,
    venue: spec.venue,
    lat: latitudeFor(spec.venue),
    lng: longitudeFor(spec.venue),
    ticketTypes,
    status: 'published',
    coverImageUrl: cover,
    mediaUrls,
    featured: spec.featured,
    featuredUntil,
  });
  return { ...model.toMap(), id };
}

interface EventMeta {
  id: string;
  ownerId: string;
  spec: SeedEvent;
}

function buildEventRows(now: Date, rand: () => number): { rows: Row[]; meta: EventMeta[] } {
  const rows: Row[] = [];
  const meta: EventMeta[] = [];
  let counter = 1;
  for (const group of EVENT_GROUPS) {
    for (const spec of group.events) {
      const id = `seed-${counter}`;
      const index = counter - 1;
      counter += 1;
      rows.push(seedEventRow(id, group.ownerId, spec, now, rand, index));
      meta.push({ id, ownerId: group.ownerId, spec });
    }
  }
  return { rows, meta };
}

function buildBookingRows(meta: EventMeta[], now: Date, rand: () => number): {
  registrations: Row[];
  bookings: Row[];
} {
  const registrations: Row[] = [];
  const bookings: Row[] = [];
  let counter = 1;
  const bookable = meta.slice(0, 15);
  for (const item of bookable) {
    const ticketName = tierName(item.spec.prices.length, 0);
    const attendeeCount = 2 + nextInt(rand, 3);
    for (let i = 0; i < attendeeCount && i < ATTENDEES.length; i++) {
      const attendee = ATTENDEES[i];
      const regId = `reg-${counter}`;
      const bookingId = `bk-${counter}`;
      const registeredAt = new Date(now.getTime() - nextInt(rand, 5) * DAY_MS).toISOString();
      const bookedAt = new Date(now.getTime() - nextInt(rand, 5) * DAY_MS).toISOString();
      const orgOptions = ORGANIZATIONS[item.spec.category];
      registrations.push({
        id: regId,
        eventId: item.id,
        userId: attendee.uid,
        fullName: attendee.name,
        ticketType: ticketName,
        phone: `${pick(PHONE_PREFIXES, rand)} ${nextInt(rand, 900) + 100} ${nextInt(rand, 9000) + 1000}`,
        organization: orgOptions.length > 0 ? pick(orgOptions, rand) : '',
        jobTitle: item.spec.category === 'corporate' ? pick(JOB_TITLES, rand) : '',
        gender: i % 2 === 0 ? 'Male' : 'Female',
        attendeeType: 'Guest',
        createdAt: registeredAt,
      });
      bookings.push({
        id: bookingId,
        eventId: item.id,
        userId: attendee.uid,
        regId,
        status: 'confirmed',
        checkedIn: rand() < 0.3,
        seatNumber: '',
        qrCode: `QR-${bookingId}`,
        createdAt: bookedAt,
      });
      counter += 1;
    }
  }
  return { registrations, bookings };
}

function buildChatRows(meta: EventMeta[], now: Date): Row[] {
  const rows: Row[] = [];
  const attendeeIds = ATTENDEES.slice(0, 3).map((a) => a.uid);
  const createdAt = now.toISOString();
  for (let i = 0; i < 10 && i < meta.length; i++) {
    const item = meta[i];
    rows.push({
      id: `chat-${i + 1}`,
      eventId: item.id,
      memberIds: [item.ownerId, ...attendeeIds],
      organizerId: item.ownerId,
      attendeeIds,
      type: 'group',
      createdBy: item.ownerId,
      readOnly: false,
      lastReadAt: {},
      mutedBy: [],
      lastMessage: '',
      lastMessageAt: createdAt,
      unreadCounts: {},
      isPinned: false,
      isMuted: false,
      isBroadcast: false,
      createdAt,
    });
  }
  return rows;
}

function buildNotificationRows(meta: EventMeta[], now: Date): Row[] {
  const targets = [
    {
      title: 'Booking Confirmed',
      body: `Your booking for "${meta[0].spec.title}" is confirmed.`,
      type: 'booking_confirmed',
      targetId: meta[0].id,
    },
    {
      title: 'New Follower',
      body: 'Esi Mensah started following you.',
      type: 'new_follower',
      targetId: 'att-2',
    },
    {
      title: 'Event Update',
      body: `Kwame Asante posted an update on "${meta[3].spec.title}".`,
      type: 'event_update',
      targetId: meta[3].id,
    },
    {
      title: 'Event Reminder',
      body: '"Garden Party & Networking Mixer" is happening in 5 days!',
      type: 'event_reminder',
      targetId: meta[14].id,
    },
    {
      title: 'Waitlist Spot Available',
      body: 'A spot opened up for "Afrobeats Night with Sarkodie"!',
      type: 'waitlist_spot',
      targetId: meta[39].id,
    },
  ];
  return targets.map((item, index) => ({
    id: `notif-${index + 1}`,
    uid: 'att-1',
    userId: 'att-1',
    title: item.title,
    body: item.body,
    type: item.type,
    targetId: item.targetId,
    referenceId: item.targetId,
    read: index > 1,
    createdAt: new Date(now.getTime() - index * HOUR_MS).toISOString(),
  }));
}

// ---------------------------------------------------------------------------
// Feed posts — organizer event updates + attendee chatter for the Home feed
// ---------------------------------------------------------------------------

interface SeedComment {
  authorId: string;
  text: string;
}

/** An embedded comment row exactly as `Post.toMap()` serialises it. */
interface SeededComment {
  id: string;
  authorId: string;
  text: string;
  createdAt: string;
}

interface SeedPost {
  authorId: string;
  /** Index into the seeded `meta` array — keeps post → event links honest. */
  eventIndex?: number;
  text: string;
  hoursAgo: number;
  mediaUrl?: string;
  isVideo?: boolean;
  likeIds?: string[];
  comments?: SeedComment[];
}

/** 35 posts: 16 organizer updates tied to seeded events, 19 attendee posts. */
const FEED_POSTS: SeedPost[] = [
  {
    authorId: 'org-1',
    eventIndex: 0,
    text: 'Stage build is 70 percent done at Black Star Square for Accra Music Festival 2026. Gates open 4pm sharp — see you there.',
    hoursAgo: 3,
    mediaUrl: '/seed/social-clip.mp4',
    isVideo: true,
    likeIds: ['att-1', 'att-2'],
    comments: [
      { authorId: 'att-1', text: 'Counting down the days. See you there!' },
      { authorId: 'att-3', text: 'Front row or nothing. Congratulations to the team.' },
    ],
  },
  {
    authorId: 'org-1',
    eventIndex: 3,
    text: 'Rehearsal with the band went well tonight. Highlife Night Live at the National Theatre this Saturday — tickets at the gate and on EventHub.',
    hoursAgo: 26,
    mediaUrl: '/seed/social.svg',
  },
  {
    authorId: 'org-1',
    eventIndex: 1,
    text: 'Final florals delivered for Kwame and Abena. What a beautiful setup at La Palm Royal. Wishing the couple a lifetime of happiness.',
    hoursAgo: 49,
    mediaUrl: '/seed/wedding.svg',
    likeIds: ['att-4', 'att-6', 'att-9'],
    comments: [
      { authorId: 'att-4', text: 'Congratulations to the couple!' },
      { authorId: 'att-9', text: 'This is gorgeous work. Well done.' },
      { authorId: 'att-2', text: 'See you at the wedding.' },
    ],
  },
  {
    authorId: 'org-2',
    eventIndex: 10,
    text: 'Decorator slots for 2026 are filling fast. Come see the Wedding Decor Showcase at Kempinski and let us plan your special day.',
    hoursAgo: 8,
    mediaUrl: '/seed/wedding.svg',
  },
  {
    authorId: 'org-2',
    eventIndex: 14,
    text: 'Menu tasting done for the Garden Party and Networking mixer at Labadi Beach Hotel. Five days to go and everything is set.',
    hoursAgo: 31,
    mediaUrl: '/seed/social.svg',
    likeIds: ['att-2'],
  },
  {
    authorId: 'org-3',
    eventIndex: 20,
    text: 'Speaker lineup confirmed for Ghana Tech Summit 2026. Early bird pricing closes on Friday — register before the tier moves.',
    hoursAgo: 6,
    mediaUrl: '/seed/corporate.svg',
    likeIds: ['att-10', 'att-2'],
    comments: [
      { authorId: 'att-10', text: 'This lineup is serious. See you there.' },
      { authorId: 'att-2', text: 'Registering today. Congratulations on the programme.' },
    ],
  },
  {
    authorId: 'org-3',
    eventIndex: 23,
    text: 'Eight startups shortlisted for Startup Pitch Night. Winners take a booth at the Tech Summit. Seats are free but limited.',
    hoursAgo: 55,
  },
  {
    authorId: 'org-5',
    eventIndex: 40,
    text: 'One week to Afrobeats Night with Sarkodie at the Grand Arena. The production test went perfectly — this one will shake.',
    hoursAgo: 12,
    mediaUrl: '/seed/gala-clip.mp4',
    isVideo: true,
    likeIds: ['att-1', 'att-3', 'att-5'],
    comments: [
      { authorId: 'att-3', text: 'Tickets secured. Who else is going?' },
      { authorId: 'att-5', text: 'Accra is not ready for this one.' },
      { authorId: 'att-1', text: 'Congratulations on putting this together.' },
    ],
  },
  {
    authorId: 'org-8',
    eventIndex: 70,
    text: 'Vendor map is out for Taste of Ghana Food Festival — 40 vendors from every region. Jollof, waakye, kelewele and more.',
    hoursAgo: 20,
    mediaUrl: '/seed/social.svg',
    likeIds: ['att-6'],
    comments: [
      { authorId: 'att-6', text: 'I am coming hungry. See you there!' },
      { authorId: 'att-3', text: 'The jollof war alone is worth the ticket.' },
    ],
  },
  {
    authorId: 'org-9',
    eventIndex: 80,
    text: 'Choir rehearsals start this weekend at the National Theatre ahead of Gospel Night of Worship. Come and be part of it.',
    hoursAgo: 72,
  },
  {
    authorId: 'org-10',
    eventIndex: 90,
    text: 'New pieces hung at Gallery 1957 this morning for the Contemporary Art Exhibition. Entry is free all week — walk in any time.',
    hoursAgo: 44,
    mediaUrl: '/seed/fallback.svg',
  },
  {
    authorId: 'att-1',
    text: 'Just booked two tickets for Afrobeats Night with Sarkodie. Who else is going?',
    hoursAgo: 5,
    likeIds: ['att-3'],
    comments: [
      { authorId: 'att-3', text: 'Me! See you there.' },
      { authorId: 'att-5', text: 'Save me a spot in the queue.' },
      { authorId: 'att-4', text: 'Congratulations on the quick booking.' },
    ],
  },
  {
    authorId: 'att-2',
    text: 'Accra Music Festival last year was unmatched. This year looks even better — the video from the site visit says it all.',
    hoursAgo: 15,
    mediaUrl: '/seed/social-clip.mp4',
    isVideo: true,
    likeIds: ['att-1', 'att-7'],
    comments: [
      { authorId: 'att-1', text: 'We should go as a group this time.' },
      { authorId: 'att-7', text: 'The stage looks massive.' },
    ],
  },
  {
    authorId: 'att-3',
    text: 'Congratulations to Kojo and Ama on their wedding yesterday. Beautiful ceremony, beautiful people.',
    hoursAgo: 38,
    mediaUrl: '/seed/wedding.svg',
    likeIds: ['att-1', 'att-2', 'att-4', 'att-9'],
    comments: [
      { authorId: 'att-4', text: 'Congratulations to them!' },
      { authorId: 'att-9', text: 'God bless their union.' },
      { authorId: 'att-6', text: 'The photos are stunning.' },
      { authorId: 'att-2', text: 'See you at the next one.' },
    ],
  },
  {
    authorId: 'att-4',
    text: 'Any recommendations for a good brunch spot in East Legon this weekend?',
    hoursAgo: 9,
    comments: [
      { authorId: 'att-6', text: 'Try the place near the arcade — the pancakes are worth it.' },
      { authorId: 'att-2', text: 'Mövenpick does a lovely Sunday brunch.' },
      { authorId: 'att-3', text: 'Following this thread.' },
    ],
  },
  {
    authorId: 'att-5',
    text: 'Trained at the park this morning for the Accra Marathon. Ten kilometres done before the heat came down.',
    hoursAgo: 22,
    comments: [
      { authorId: 'att-7', text: 'Strong pace. See you at the start line.' },
      { authorId: 'att-1', text: 'Congratulations on the discipline.' },
    ],
  },
  {
    authorId: 'att-6',
    text: 'Street Food Saturday was a dream. Kelewele and grilled tilapia — enough said.',
    hoursAgo: 29,
    mediaUrl: '/seed/social-clip.mp4',
    isVideo: true,
    likeIds: ['att-3', 'att-4'],
    comments: [
      { authorId: 'att-3', text: 'You always find the best spots.' },
      { authorId: 'att-4', text: 'Take me along next time.' },
      { authorId: 'att-9', text: 'Now I am hungry.' },
      { authorId: 'att-1', text: 'The tilapia looks fresh.' },
      { authorId: 'att-2', text: 'Adding this to my list.' },
    ],
  },
  {
    authorId: 'att-7',
    text: 'Charity football match on Saturday at Ohene Djan Stadium. Come support a good cause.',
    hoursAgo: 47,
  },
  {
    authorId: 'att-8',
    text: 'The photography workshop at Osu was worth every cedi. My gallery game is improving already.',
    hoursAgo: 61,
    mediaUrl: '/seed/corporate.svg',
    likeIds: ['att-9'],
  },
  {
    authorId: 'att-9',
    text: 'School transfer forms are in. Now to plan the community fun fair with the parents association.',
    hoursAgo: 84,
  },
  {
    authorId: 'att-10',
    text: 'Pitch night last week was inspiring. Ghana startup scene is growing fast and I am here for it.',
    hoursAgo: 100,
    likeIds: ['att-1', 'att-5', 'att-7'],
  },
  {
    authorId: 'att-1',
    text: 'See you all at Highlife Night Live. Front row tickets secured.',
    hoursAgo: 110,
    mediaUrl: '/seed/gala-clip.mp4',
    isVideo: true,
    likeIds: ['att-3'],
  },
  {
    authorId: 'att-2',
    text: 'Attended the Celebration of Life for Nana A. Somber but beautiful. Rest well, Nana.',
    hoursAgo: 126,
    mediaUrl: '/seed/funeral.svg',
    likeIds: ['att-4', 'att-9'],
    comments: [
      { authorId: 'att-4', text: 'May his soul rest in peace.' },
      { authorId: 'att-9', text: 'Sending love to the family.' },
      { authorId: 'att-3', text: 'A good send-off indeed.' },
    ],
  },
  {
    authorId: 'att-3',
    text: 'Who is heading to Taste of Ghana Food Festival? Table for four — join us.',
    hoursAgo: 140,
  },
  {
    authorId: 'att-6',
    text: 'Brunch at the hotel was pure bliss. Accra knows how to do weekends properly.',
    hoursAgo: 152,
    mediaUrl: '/seed/social.svg',
    likeIds: ['att-4'],
  },
  {
    authorId: 'att-4',
    text: 'Saved my spot for the Jollof Rice War Competition. May the best cook win.',
    hoursAgo: 168,
    likeIds: ['att-3', 'att-6'],
  },
  {
    authorId: 'org-2',
    eventIndex: 15,
    text: "Full decor walkthrough for Naa and Tetteh's traditional wedding is up — draping, florals and the head table. Book your 2026 date before the calendar fills.",
    hoursAgo: 7,
    mediaUrl: '/seed/wedding-clip.mp4',
    isVideo: true,
    likeIds: ['att-4', 'att-12'],
    comments: [
      { authorId: 'att-12', text: 'The draping is everything. Saving this for my own wedding.' },
      { authorId: 'att-4', text: 'Beautiful work as always.' },
    ],
  },
  {
    authorId: 'org-3',
    eventIndex: 21,
    text: 'Venue tour for Ghana Tech Summit 2026 — main hall, breakout rooms and the demo floor. Early bird closes Friday.',
    hoursAgo: 11,
    mediaUrl: '/seed/tech-clip.mp4',
    isVideo: true,
    likeIds: ['att-10', 'att-2', 'att-13'],
    comments: [
      { authorId: 'att-10', text: 'The demo floor looks massive this year.' },
      { authorId: 'att-13', text: 'Shoot me the press pass details please.' },
    ],
  },
  {
    authorId: 'org-6',
    eventIndex: 53,
    text: 'Bouncy castles delivered and tested for the Kids Birthday Bash. Face painters arrive at 9am sharp.',
    hoursAgo: 24,
    mediaUrl: '/seed/social.svg',
    likeIds: ['att-9'],
  },
  {
    authorId: 'org-7',
    eventIndex: 62,
    text: 'Route map for the Accra Marathon is out — 5km, 10km and 21km options. Water stations every 3km.',
    hoursAgo: 33,
    mediaUrl: '/seed/social.svg',
    likeIds: ['att-5', 'att-7'],
    comments: [
      { authorId: 'att-7', text: 'Registered for the 21km. Let us go!' },
      { authorId: 'att-5', text: 'See you at the start line.' },
    ],
  },
  {
    authorId: 'org-11',
    eventIndex: 93,
    text: 'Behind the lens at Gallery 1957 this morning — new exhibition frames are hanging all week.',
    hoursAgo: 16,
    mediaUrl: '/seed/fallback.svg',
    likeIds: ['att-8'],
  },
  {
    authorId: 'att-11',
    text: 'Afrobeats night at the Twist was different. Accra, we need to do that again this weekend.',
    hoursAgo: 4,
    mediaUrl: '/seed/social.svg',
    likeIds: ['att-1', 'att-3', 'att-5'],
    comments: [
      { authorId: 'att-3', text: 'That set was proper. Count me in for next week.' },
      { authorId: 'att-1', text: 'Wish I had seen this earlier.' },
    ],
  },
  {
    authorId: 'att-12',
    text: 'Styled two bridal looks for the weekend. Which one wins — the kente or the lace?',
    hoursAgo: 19,
    mediaUrl: '/seed/wedding.svg',
    likeIds: ['att-4', 'att-9', 'att-1'],
    comments: [
      { authorId: 'att-4', text: 'Kente, no question.' },
      { authorId: 'att-9', text: 'The lace is stunning though!' },
    ],
  },
  {
    authorId: 'att-13',
    text: 'Cutting the highlight reel from Afrobeats Night. Four cameras, one very loud crowd.',
    hoursAgo: 42,
    mediaUrl: '/seed/gala-clip.mp4',
    isVideo: true,
    likeIds: ['att-11', 'att-5'],
  },
  {
    authorId: 'att-14',
    text: 'New in Accra and looking for weekend plans — brunch, pop-ups, galleries. What is good?',
    hoursAgo: 6,
    comments: [
      { authorId: 'att-6', text: 'Welcome! Street Food Saturday is a must.' },
      { authorId: 'att-8', text: 'Gallery openings on Thursday nights are the best.' },
    ],
  },
];

/**
 * Image posts use the imported wallpaper bundle (category SVGs only as a
 * fallback); video posts rotate through the generated clips first, then the
 * imported bundle videos. Text-only posts stay text-only.
 */
function postMedia(spec: SeedPost, ordinals: { image: number; video: number }): string {
  if (spec.isVideo === true) {
    const pool = POST_VIDEO_MEDIA.length > 0 ? POST_VIDEO_MEDIA : [spec.mediaUrl ?? ''];
    const url = pool[ordinals.video % pool.length] ?? '';
    ordinals.video += 1;
    return url;
  }
  if (!spec.mediaUrl) return '';
  if (WALLPAPER_IMAGES.length > 0) {
    const url = WALLPAPER_IMAGES[ordinals.image % WALLPAPER_IMAGES.length];
    ordinals.image += 1;
    return url;
  }
  return spec.mediaUrl;
}

function buildPostRows(meta: EventMeta[], now: Date): Row[] {
  const ordinals = { image: 0, video: 0 };
  return FEED_POSTS.map((spec, index) => {
    const postTime = new Date(now.getTime() - spec.hoursAgo * HOUR_MS);
    const comments: SeededComment[] = [];
    (spec.comments ?? []).forEach((comment, position) => {
      comments.push({
        id: `cmt-${index + 1}-${position + 1}`,
        authorId: comment.authorId,
        text: comment.text,
        createdAt: new Date(postTime.getTime() + (position + 1) * 20 * 60_000).toISOString(),
      });
    });
    const eventId =
      spec.eventIndex === undefined ? undefined : meta[spec.eventIndex]?.id;
    const post = new Post({
      id: `post-${index + 1}`,
      authorId: spec.authorId,
      eventId,
      text: spec.text,
      mediaUrl: postMedia(spec, ordinals),
      isVideo: spec.isVideo ?? false,
      timestamp: postTime,
      likeIds: spec.likeIds ?? [],
      comments,
      commentCount: comments.length,
    });
    return { ...post.toMap(), id: `post-${index + 1}` };
  });
}


const WIPE_TABLES = [
  db.events,
  db.registrations,
  db.bookings,
  db.chats,
  db.messages,
  db.posts,
  db.notifications,
  db.follows,
  db.waitlist,
  db.refunds,
  db.reviews,
  db.promotions,
  db.discountCodes,
  db.invitedGuests,
  db.guestList,
  db.eventSchedules,
];

export async function seedIfEmpty(): Promise<void> {
  const version = await getSeedVersion();
  if (version === SEED_VERSION) return;

  const now = new Date();
  const rand = makeRandom(RANDOM_SEED);

  const userRows: Row[] = [];
  const authRows: AuthRow[] = [];
  const accounts: Array<{ person: Person; roles: Role[] }> = [
    ...ORGANIZERS.map((p) => ({ person: p, roles: USER_ROLES })),
    ...ATTENDEES.map((p) => ({ person: p, roles: USER_ROLES })),
    ...CREATORS.map((c) => ({ person: c.person, roles: USER_ROLES })),
    { person: ADMIN, roles: ADMIN_ROLES },
  ];
  for (let i = 0; i < accounts.length; i++) {
    const account = accounts[i];
    userRows.push(seedUserRow(account.person, account.roles, i, now));
    authRows.push({
      uid: account.person.uid,
      email: account.person.email,
      passwordHash: await hashPassword(SEED_PASSWORD),
    });
  }

  const { rows: eventRows, meta } = buildEventRows(now, rand);
  const { registrations, bookings } = buildBookingRows(meta, now, rand);
  const chatRows = buildChatRows(meta, now);
  const notificationRows = buildNotificationRows(meta, now);
  const postRows = buildPostRows(meta, now);
  const followEdges = buildFollowEdges();
  applyFollowCounts(userRows, followEdges);
  const followRows = followEdges.map((edge) => ({
    id: `${edge.followerId}_${edge.followingId}`,
    followerId: edge.followerId,
    followingId: edge.followingId,
    createdAt: now.toISOString(),
  }));

  const scope = [
    db.session,
    db.auth,
    db.users,
    ...WIPE_TABLES,
  ];

  await db.transaction('rw', scope, async () => {
    for (const table of WIPE_TABLES) {
      await table.clear();
    }
    await db.users.bulkPut(userRows.map(withAssetBase));
    await db.auth.bulkPut(authRows.map(withAssetBase));
    await db.events.bulkPut(eventRows.map(withAssetBase));
    await db.registrations.bulkPut(registrations.map(withAssetBase));
    await db.bookings.bulkPut(bookings.map(withAssetBase));
    await db.chats.bulkPut(chatRows.map(withAssetBase));
    await db.notifications.bulkPut(notificationRows.map(withAssetBase));
    await db.posts.bulkPut(postRows.map(withAssetBase));
    await db.follows.bulkPut(followRows.map(withAssetBase));
    await setSeedVersion(SEED_VERSION);
  });
}

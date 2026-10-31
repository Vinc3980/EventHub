/**
 * Help articles (section 3.6). Content lives here as data so the hub tile,
 * the footer link and the `/help/:slug` route all resolve from one source.
 *
 * `terms` and `privacy` are explicit placeholders awaiting client copy.
 */
import type { Icon } from 'iconsax-react';
import { Book1, Calendar1, Card, Lifebuoy, Location, Money, ShieldTick, Ticket, User } from 'iconsax-react';

export interface HelpArticle {
  slug: string;
  title: string;
  summary: string;
  icon: Icon;
  /** Section grouping on the Help hub. */
  group: 'getting-started' | 'tickets' | 'hosting' | 'safety' | 'legal';
  sections: { heading?: string; body: string; bullets?: string[] }[];
}

export const HELP_ARTICLES: HelpArticle[] = [
  {
    slug: 'getting-started',
    title: 'Getting started',
    summary: 'Create an account, find events and buy your first ticket.',
    icon: Book1,
    group: 'getting-started',
    sections: [
      {
        heading: 'Create an account',
        body: 'Every EventHub account can both attend and host — there is no separate organizer role to pick. Sign up with your email and a password, then complete your profile.',
      },
      {
        heading: 'Find something to go to',
        body: 'Explore lists everything near you. Use the category filters, the date filters, or search by name, venue or organizer.',
        bullets: [
          'Filter by category: weddings, funerals, corporate or social.',
          'Filter by date: this weekend, this month, or a specific day.',
          'Save an event with the bookmark icon to find it later.',
        ],
      },
    ],
  },
  {
    slug: 'tickets-payments',
    title: 'Tickets & payments',
    summary: 'How buying, MoMo payments and refunds work.',
    icon: Ticket,
    group: 'tickets',
    sections: [
      {
        heading: 'Paying for a ticket',
        body: 'Free tickets are confirmed instantly. Paid tickets can be settled with Mobile Money or a card. With MoMo you receive a prompt on your phone and have a short window to approve it.',
      },
      {
        heading: 'Pending payments',
        body: 'If a MoMo payment is not approved in time the booking is marked pending and then released. You can retry from My bookings while the tier still has capacity.',
      },
      {
        heading: 'Refunds',
        body: 'Refund requests go to the organizer, who approves or declines them. Approved refunds return to the original payment method. EventHub’s platform fee is not returned once an event has started.',
      },
    ],
  },
  {
    slug: 'platform-fees',
    title: 'Pricing & fees',
    summary: 'The 2% platform fee, explained.',
    icon: Money,
    group: 'hosting',
    sections: [
      {
        heading: 'What EventHub charges',
        body: 'EventHub charges a 2% platform fee on the value of each paid ticket sold. There is no charge for free events, and no monthly or setup cost.',
      },
      {
        heading: 'How it is applied',
        body: 'The fee is deducted from the payout, so the amount you receive is the ticket price minus 2%. Attendees see the ticket price you set — the fee is not added at checkout.',
        bullets: [
          'A GHS 100 ticket pays out GHS 98.',
          'A free event pays out nothing and costs nothing.',
          'The fee appears as a line on each payout statement.',
        ],
      },
      {
        heading: 'Payouts',
        body: 'Payouts are sent to your bank account or MoMo wallet once your payout settings are complete. You can track every payout from the Payouts screen.',
      },
    ],
  },
  {
    slug: 'contact-support',
    title: 'Contact support',
    summary: 'How to reach the EventHub team.',
    icon: Lifebuoy,
    group: 'getting-started',
    sections: [
      {
        heading: 'Talk to us',
        body: 'This build is a local-first demo: there is no live support backend wired up yet. In the shipped product this page carries the support phone line, email and in-app chat.',
        bullets: [
          'Support hours: Monday to Saturday, 8:00–20:00 GMT.',
          'Have your booking reference or event link ready.',
          'Safety issues should be raised with a report, not a support ticket.',
        ],
      },
    ],
  },
  {
    slug: 'safety-reporting',
    title: 'Safety & reporting',
    summary: 'Report events, profiles and messages.',
    icon: ShieldTick,
    group: 'safety',
    sections: [
      {
        heading: 'What you can report',
        body: 'Every event, profile and message has a report action. Reports go to the platform team with the context attached.',
        bullets: [
          'Events that misrepresent a venue, date or price.',
          'Profiles impersonating someone or spamming.',
          'Messages that harass or attempt to scam.',
        ],
      },
      {
        heading: 'What happens next',
        body: 'Open reports are reviewed by the platform team. Content that breaks the rules is removed and the account is warned or suspended.',
      },
    ],
  },
  {
    slug: 'hosting-basics',
    title: 'Hosting basics',
    summary: 'Create, promote and run your first event.',
    icon: Calendar1,
    group: 'hosting',
    sections: [
      {
        heading: 'Create the listing',
        body: 'Start from Create event. Add a title, category, date, venue and a cover image, then define one or more ticket tiers. Save a draft at any time.',
      },
      {
        heading: 'Promote it',
        body: 'Send bulk SMS invitations, share the link, add discount codes, or boost the event so it is featured across Explore and Home.',
      },
      {
        heading: 'Run the day',
        body: 'Use the guest list for contacts and plus-ones, the RSVP list for registrations and seats, and the scanner to check people in at the door.',
      },
    ],
  },
  {
    slug: 'payments-momo',
    title: 'Mobile Money payments',
    summary: 'How MoMo works for tickets and payouts.',
    icon: Card,
    group: 'tickets',
    sections: [
      {
        heading: 'Paying with MoMo',
        body: 'Choose MoMo at checkout, enter your wallet number and approve the prompt on your phone. The booking confirms as soon as the payment settles.',
      },
      {
        heading: 'Networks',
        body: 'MTN, Telecel and AirtelTigo wallets are supported. If a prompt times out you can request it again from My bookings.',
      },
    ],
  },
  {
    slug: 'venues',
    title: 'Venues & locations',
    summary: 'How venues are matched and distances calculated.',
    icon: Location,
    group: 'hosting',
    sections: [
      {
        heading: 'Setting a venue',
        body: 'Type the venue name and EventHub suggests known places. The region is derived from the address, and “Near me” sorts by the distance from your device.',
      },
    ],
  },
  {
    slug: 'account-security',
    title: 'Account & security',
    summary: 'Passwords, blocked accounts and privacy.',
    icon: User,
    group: 'safety',
    sections: [
      {
        heading: 'Keep your account safe',
        body: 'Use a password you do not reuse elsewhere. You can change it from Settings → Security, and block accounts from Settings → Blocked accounts.',
      },
      {
        heading: 'Who can see your profile',
        body: 'Your name, avatar and bio are public so organizers can identify you at the door. Your email and phone number are never shown publicly.',
      },
    ],
  },
  {
    slug: 'terms',
    title: 'Terms of service',
    summary: 'Placeholder — awaiting client text.',
    icon: Book1,
    group: 'legal',
    sections: [
      {
        body: 'Placeholder — the client’s Terms of service text has not been supplied yet. This article exists so the footer and navigation links resolve without a 404.',
      },
    ],
  },
  {
    slug: 'privacy',
    title: 'Privacy policy',
    summary: 'Placeholder — awaiting client text.',
    icon: ShieldTick,
    group: 'legal',
    sections: [
      {
        body: 'Placeholder — the client’s Privacy policy text has not been supplied yet. This article exists so the footer and navigation links resolve without a 404.',
      },
    ],
  },
];

export const HELP_GROUP_TITLES: Record<HelpArticle['group'], string> = {
  'getting-started': 'Getting started',
  tickets: 'Tickets & payments',
  hosting: 'Hosting',
  safety: 'Safety & account',
  legal: 'Legal',
};

export function helpArticleFor(slug: string): HelpArticle | undefined {
  return HELP_ARTICLES.find((article) => article.slug === slug);
}

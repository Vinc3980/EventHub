/**
 * Help hub (section 3.6) — the public help center. Articles are grouped and
 * each links to `/help/<slug>`; contact details are surfaced as a card.
 */
import { Link } from 'react-router-dom';
import { Call, Lifebuoy, MessageQuestion } from 'iconsax-react';
import { HubPage, type HubTileData } from '../../components/hub';
import { HELP_ARTICLES, HELP_GROUP_TITLES } from './helpArticles';

export default function HelpHub() {
  const groups = Object.keys(HELP_GROUP_TITLES) as (keyof typeof HELP_GROUP_TITLES)[];
  const contact = HELP_ARTICLES.find((article) => article.slug === 'contact-support');

  return (
    <>
      <div className="mb-6 rounded-[20px] border border-border bg-surface p-5 shadow-card">
        <div className="flex items-start gap-3">
          <span className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-xl text-white" style={{ backgroundImage: 'var(--eh-tile-gradient)' }}>
            <Lifebuoy size={24} />
          </span>
          <div className="min-w-0">
            <h2 className="min-w-0 truncate text-title text-textprimary">How can we help?</h2>
            <p className="mt-1 min-w-0 text-body text-textmuted">
              Guides for buying tickets, hosting events and staying safe.
            </p>
          </div>
        </div>
        {contact && (
          <Link
            to={`/help/${contact.slug}`}
            className="mt-4 flex items-center gap-3 rounded-base border border-border px-4 py-3 transition-colors duration-200 hover:border-primary hover:bg-primary-6"
          >
            <MessageQuestion size={20} className="shrink-0 text-primary" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-body font-bold text-textprimary">Contact support</span>
              <span className="block truncate text-caption text-textmuted">Hours, phone and what to have ready</span>
            </span>
            <Call size={18} className="shrink-0 text-textmuted" />
          </Link>
        )}
      </div>

      <HubPage
        sections={groups
          .filter((group) => HELP_ARTICLES.some((article) => article.group === group))
          .map((group) => ({
            id: group,
            title: HELP_GROUP_TITLES[group],
            tiles: HELP_ARTICLES.filter((article) => article.group === group).map<HubTileData>(
              (article) => ({
                id: article.slug,
                label: article.title,
                description: article.summary,
                icon: article.icon,
                to: `/help/${article.slug}`,
              }),
            ),
          }))}
      />
    </>
  );
}

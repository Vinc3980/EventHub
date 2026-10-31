/**
 * Single help article (`/help/:slug`) — renders the structured sections from
 * `helpArticles.ts`. Unknown slugs fall back to a not-found state rather than
 * a blank page.
 */
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft2, Book1, Information } from 'iconsax-react';
import { EmptyState } from '../../components/ui';
import { HELP_ARTICLES, helpArticleFor } from './helpArticles';

export default function HelpArticleScreen() {
  const { slug } = useParams<{ slug: string }>();
  const article = slug ? helpArticleFor(slug) : undefined;

  if (!article) {
    return (
      <EmptyState
        icon={<Information size={26} />}
        title="Article not found"
        body="That help article does not exist (yet)."
        action={
          <Link to="/help" className="rounded-base bg-primary px-4 py-2 text-button text-white hover:brightness-95">
            Back to Help
          </Link>
        }
      />
    );
  }

  const Icon = article.icon;
  const related = HELP_ARTICLES.filter(
    (other) => other.group === article.group && other.slug !== article.slug,
  ).slice(0, 4);

  return (
    <article className="mx-auto w-full max-w-[720px]">
      <Link
        to="/help"
        className="mb-4 inline-flex items-center gap-1.5 text-caption font-semibold text-textmuted transition-colors duration-200 hover:text-primary"
      >
        <ArrowLeft2 size={14} />
        All help articles
      </Link>

      <div className="flex items-start gap-3">
        <span className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-xl bg-primary-6 text-primary">
          <Icon size={24} />
        </span>
        <div className="min-w-0">
          <h1 className="min-w-0 text-display text-textprimary">{article.title}</h1>
          <p className="mt-1 min-w-0 text-body text-textmuted">{article.summary}</p>
        </div>
      </div>

      <div className="mt-6 space-y-6">
        {article.sections.map((section, index) => (
          <section key={index} className="rounded-[20px] border border-border bg-surface p-5 shadow-card">
            {section.heading && (
              <h2 className="mb-2 min-w-0 text-subtitle text-textprimary">{section.heading}</h2>
            )}
            <p className="min-w-0 text-body leading-relaxed text-textmuted">{section.body}</p>
            {section.bullets && (
              <ul className="mt-3 space-y-2">
                {section.bullets.map((bullet, bulletIndex) => (
                  <li key={bulletIndex} className="flex min-w-0 items-start gap-2 text-body text-textmuted">
                    <Book1 size={14} className="mt-1 shrink-0 text-primary" />
                    <span className="min-w-0">{bullet}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>

      {related.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-title text-textprimary">Related</h2>
          <div className="grid grid-cols-1 gap-3 tablet:grid-cols-2">
            {related.map((other) => {
              const RelatedIcon = other.icon;
              return (
                <Link
                  key={other.slug}
                  to={`/help/${other.slug}`}
                  className="flex min-w-0 items-center gap-3 rounded-[20px] border border-border bg-surface p-4 shadow-card transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-popover"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary-6 text-primary">
                    <RelatedIcon size={18} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-body font-bold text-textprimary">{other.title}</span>
                    <span className="block truncate text-caption text-textmuted">{other.summary}</span>
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </article>
  );
}

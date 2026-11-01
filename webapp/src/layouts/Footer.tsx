/**
 * Site footer (section 4.1). Columns come straight from `navConfig`, so a
 * link added to a menu is automatically in the footer.
 *
 * On phone widths each column collapses into an accordion; from tablet up
 * they are plain columns. The bottom bar carries the copyright, "Made for
 * Ghana" and the GHS · MoMo note.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight2 } from 'iconsax-react';
import { FOOTER_COLUMNS } from './nav/navConfig';
import { entryHref } from './nav/navConfig';

function BrandMark({ size = 30 }: { size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-md font-extrabold text-white"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.42,
        backgroundImage:
          'linear-gradient(135deg, var(--eh-primary) 0%, var(--eh-deep-violet) 100%)',
      }}
      aria-hidden="true"
    >
      EH
    </span>
  );
}

export function Footer({ uid }: { uid: string | null }) {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-12 bg-textprimary text-white">
      <div
        className="h-0.5 w-full"
        style={{
          backgroundImage:
            'linear-gradient(90deg, var(--eh-primary) 0%, var(--eh-deep-violet) 100%)',
        }}
        aria-hidden="true"
      />
      <div className="mx-auto w-full max-w-[1280px] px-4 py-10 tablet:px-6 wide:px-8">
        <div className="mb-8">
          <div className="flex items-center gap-2.5">
            <BrandMark />
            <span className="text-title font-extrabold tracking-tight">EventHub</span>
          </div>
          <p className="mt-2 max-w-sm text-caption text-white/70">
            The modern platform for discovering, organizing and celebrating community events across Ghana.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-2 tablet:grid-cols-2 tablet:gap-8 wide:grid-cols-4">
          {FOOTER_COLUMNS.map((column) => (
            <FooterColumn key={column.id} title={column.title} items={column.items} uid={uid} />
          ))}
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-white/10 pt-6 text-caption text-white/60 tablet:flex-row tablet:items-center tablet:justify-between">
          <p>© {year} EventHub · v{__APP_VERSION__} ({__COMMIT_HASH__}) · {__BUILD_DATE__}</p>
          <p>Made for Ghana · Prices in GHS · Pay with MoMo or card</p>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  items,
  uid,
}: {
  title: string;
  items: typeof FOOTER_COLUMNS[number]['items'];
  uid: string | null;
}) {
  const [open, setOpen] = useState(false);

  const links = (
    <ul className="space-y-2">
      {items.map((entry) => {
        const href = entryHref(entry, uid) ?? entry.to ?? '/help';
        return (
          <li key={entry.id}>
            <Link
              to={href}
              className="min-w-0 truncate text-body text-white/70 transition-colors duration-200 hover:text-primary"
            >
              {entry.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className="border-b border-white/10 tablet:border-b-0">
      {/* Phone: accordion. Tablet+: always-open column. */}
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 py-3 text-left text-subtitle font-bold tablet:cursor-default tablet:py-0 tablet:pb-4"
      >
        <span className="min-w-0 truncate">{title}</span>
        <ArrowRight2
          size={16}
          className={`shrink-0 text-white/50 transition-transform duration-200 tablet:hidden ${open ? 'rotate-90' : ''}`}
        />
      </button>
      <div className={`${open ? 'block' : 'hidden'} pb-4 tablet:block`}>{links}</div>
    </div>
  );
}

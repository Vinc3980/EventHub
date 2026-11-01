/**
 * Full-screen search overlay used across desktop (below wide breakpoint)
 * and mobile/compact chrome.
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, SearchNormal } from 'iconsax-react';

export function SearchOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const [term, setTerm] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    }
  }, [open]);

  if (!open) return null;

  const submit = () => {
    const query = term.trim();
    onClose();
    navigate(query.length > 0 ? `/explore?q=${encodeURIComponent(query)}` : '/explore');
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-surface"
      role="dialog"
      aria-modal="true"
      aria-label="Search"
    >
      <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
        <button
          type="button"
          aria-label="Close search"
          onClick={onClose}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-textprimary transition-colors duration-200 hover:bg-primary-6"
        >
          <ArrowLeft size={22} />
        </button>
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="relative flex min-w-0 flex-1 items-center"
        >
          <SearchNormal size={18} className="pointer-events-none absolute left-3.5 text-textmuted" />
          <input
            ref={inputRef}
            type="search"
            value={term}
            aria-label="Search events, venues, organizers"
            placeholder="Search events"
            onChange={(e) => setTerm(e.target.value)}
            className="h-11 w-full rounded-pill border border-border bg-background pl-11 pr-4 text-body text-textprimary placeholder:text-neutral focus:border-primary focus:outline-none"
          />
        </form>
        <button
          type="button"
          onClick={submit}
          className="shrink-0 rounded-base px-2 py-2 text-button text-primary transition-colors duration-200 hover:bg-primary-6"
        >
          Search
        </button>
      </div>
    </div>
  );
}

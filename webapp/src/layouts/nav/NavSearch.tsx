/**
 * Compact typeahead in the top nav (section 3.2). Enter (or the search icon)
 * runs the query on Explore via its `q` URL param; Escape clears the field.
 */
import { useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { SearchNormal } from 'iconsax-react';

export function NavSearch({ className = 'flex items-center' }: { className?: string }) {
  const navigate = useNavigate();
  const [term, setTerm] = useState('');
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const query = term.trim();
    navigate(query.length > 0 ? `/explore?q=${encodeURIComponent(query)}` : '/explore');
    inputRef.current?.blur();
  };

  return (
    <form
      role="search"
      onSubmit={submit}
      className={`relative ${className}`}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <SearchNormal size={18} className="pointer-events-none absolute left-3.5 text-textmuted" />
      <input
        ref={inputRef}
        type="search"
        value={term}
        aria-label="Search events, venues, organizers"
        placeholder="Search events"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) => setTerm(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setTerm('');
            inputRef.current?.blur();
          }
        }}
        className={`h-10 rounded-pill border border-border bg-background pl-11 pr-4 text-body text-textprimary placeholder:text-neutral focus:border-primary focus:outline-none ${
          focused ? 'w-[240px] ultrawide:w-[320px]' : 'w-[200px] ultrawide:w-[260px]'
        } transition-[width,border-color] duration-200`}
      />
    </form>
  );
}

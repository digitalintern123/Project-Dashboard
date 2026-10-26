import { useEffect, useRef, useState } from 'react';
import { cleanLocation } from '@/data/projects';

const OTHER = '__other__';

/**
 * Location picker: the known locations plus "Other location…", which opens a
 * text box for a new place. The value passed to `onChange` is tidied with
 * `cleanLocation`, and a name that matches a known location in any letter
 * case uses the known spelling.
 */
export function LocationField({
  value,
  onChange,
  options,
  className = '',
  required = false,
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  className?: string;
  required?: boolean;
}) {
  const known = (text: string) => options.find((o) => o.toLowerCase() === text.trim().toLowerCase());
  const [other, setOther] = useState(() => !known(value));
  const [draft, setDraft] = useState(() => (known(value) ? '' : value));
  const [justPicked, setJustPicked] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (justPicked) input.current?.focus();
  }, [justPicked]);

  const pick = (next: string) => {
    if (next === OTHER) {
      setOther(true);
      setJustPicked(true);
      onChange(draft.trim() ? (known(draft) ?? cleanLocation(draft)) : '');
      return;
    }
    setOther(false);
    onChange(next);
  };

  const type = (text: string) => {
    setDraft(text);
    onChange(text.trim() ? (known(text) ?? cleanLocation(text)) : '');
  };

  return (
    <>
      <select
        aria-label="Location"
        value={other ? OTHER : (known(value) ?? value)}
        onChange={(event) => pick(event.target.value)}
        className={className}
      >
        {options.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
        <option value={OTHER}>Other location…</option>
      </select>
      {other && (
        <input
          aria-label="Other location"
          value={draft}
          onChange={(event) => type(event.target.value)}
          placeholder="Type the location, e.g. Mumbai"
          maxLength={80}
          required={required}
          ref={input}
          className={`mt-2 ${className}`}
        />
      )}
    </>
  );
}

import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { User } from '@/data/users';
import { api } from '@/lib/api';
import { highlightMatch, rankMentionCandidates } from '@/lib/mention-match';

interface MentionTextareaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> {
  value: string;
  onChange: (value: string) => void;
  users: User[];
  onMentionSelect?: (user: User) => void;
  dropdownDirection?: 'auto' | 'top' | 'bottom';
}

export function MentionTextarea({
  value,
  onChange,
  users,
  onMentionSelect,
  dropdownDirection = 'auto',
  placeholder = 'Type comments or instructions (use @name to tag)...',
  className = '',
  rows = 3,
  ...rest
}: MentionTextareaProps) {
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState<number>(-1);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [showDropdown, setShowDropdown] = useState<boolean>(false);
  const [effectiveDirection, setEffectiveDirection] = useState<'top' | 'bottom'>('top');
  const [azureUsers, setAzureUsers] = useState<User[]>([]);
  const [searchingAzure, setSearchingAzure] = useState<boolean>(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Debounced search for Encalm corporate directory via /api/email/directory
  useEffect(() => {
    if (mentionQuery === null) {
      setAzureUsers([]);
      setSearchingAzure(false);
      return;
    }

    // The directory is searched by the first word; the list then filters on every word.
    const q = mentionQuery.trim().split(/\s+/)[0] || '';
    const timer = setTimeout(async () => {
      try {
        setSearchingAzure(true);
        const data = await api.email.searchDirectory(q);
        if (Array.isArray(data.users)) {
          setAzureUsers(data.users);
        }
      } catch (err) {
        console.warn('Failed to query Encalm directory:', err);
      } finally {
        setSearchingAzure(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [mentionQuery]);

  // Local and directory people (one entry per email address), best matches first.
  const filteredUsers = React.useMemo(() => {
    if (mentionQuery === null) return [];
    const combined: User[] = [...users];
    azureUsers.forEach((au) => {
      if (!combined.some((cu) => cu.email?.toLowerCase() === au.email?.toLowerCase())) combined.push(au);
    });
    return rankMentionCandidates(mentionQuery, combined, 15);
  }, [mentionQuery, users, azureUsers]);

  // Handle textarea change and detect @
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    onChange(newValue);

    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = newValue.slice(0, cursorPos);

    // "@" then up to three words separated by single spaces ("@akash k" narrows the list);
    // two spaces in a row end the mention.
    const lastAtMatch = /(?:^|\s)@((?:[\p{L}\p{N}._'-]+(?: [\p{L}\p{N}._'-]+){0,2} ?)?)$/u.exec(textBeforeCursor);

    if (lastAtMatch) {
      const query = lastAtMatch[1];
      const atSymbolIndex = cursorPos - query.length - 1;
      setMentionQuery(query);
      setMentionIndex(atSymbolIndex);
      setSelectedIndex(0);

      // Determine vertical direction (top vs bottom)
      if (dropdownDirection === 'top' || dropdownDirection === 'bottom') {
        setEffectiveDirection(dropdownDirection);
      } else if (textareaRef.current) {
        const rect = textareaRef.current.getBoundingClientRect();
        // If there isn't enough space above (less than 220px to top of viewport/container), open downward
        if (rect.top < 220) {
          setEffectiveDirection('bottom');
        } else {
          setEffectiveDirection('top');
        }
      }

      setShowDropdown(true);
    } else {
      setShowDropdown(false);
      setMentionQuery(null);
    }
  };

  const insertMention = useCallback(
    (user: User) => {
      if (!textareaRef.current || mentionIndex === -1) return;

      const before = value.slice(0, mentionIndex);
      const queryLength = mentionQuery ? mentionQuery.length : 0;
      const afterCursor = Math.max(mentionIndex + 1 + queryLength, textareaRef.current.selectionStart || 0);
      const after = value.slice(afterCursor);

      const mentionText = `@${user.name} `;
      const updatedValue = `${before}${mentionText}${after}`;

      onChange(updatedValue);
      setShowDropdown(false);
      setMentionQuery(null);

      if (onMentionSelect) {
        onMentionSelect(user);
      }

      // Restore focus and place cursor right after inserted mention so typing continues immediately
      const newCursorPos = before.length + mentionText.length;
      const placeFocus = () => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
        }
      };

      placeFocus();
      setTimeout(placeFocus, 10);
      setTimeout(placeFocus, 50);
    },
    [value, mentionIndex, mentionQuery, onChange, onMentionSelect],
  );

  // Keyboard navigation for dropdown
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showDropdown || filteredUsers.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % filteredUsers.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredUsers.length) % filteredUsers.length);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      if (filteredUsers[selectedIndex]) {
        e.preventDefault();
        insertMention(filteredUsers[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setShowDropdown(false);
    }
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        textareaRef.current &&
        !textareaRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [showDropdown]);

  return (
    <div className="relative w-full">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        rows={rows}
        placeholder={placeholder}
        className={className}
        {...rest}
      />

      {/* Floating Mention Suggestions Dropdown */}
      {showDropdown && filteredUsers.length > 0 && (
        <div
          ref={dropdownRef}
          className={`absolute left-0 z-70 w-80 max-h-56 overflow-y-auto rounded-xl border border-border bg-white p-1.5 shadow-2xl shadow-[#173e49]/20 animate-in fade-in ${
            effectiveDirection === 'bottom'
              ? 'top-full mt-1.5 slide-in-from-top-2'
              : 'bottom-full mb-1.5 slide-in-from-bottom-2'
          }`}
        >
          <div className="px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border/50 mb-1 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <span>Encalm Directory (@)</span>
              {searchingAzure && (
                <span className="inline-block size-2 animate-spin rounded-full border border-primary border-t-transparent" />
              )}
            </span>
            <span className="text-[8px] font-normal text-muted-foreground">↑↓ to navigate • ↵ to select</span>
          </div>

          <div className="space-y-0.5">
            {filteredUsers.map((user, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <button
                  key={user.id}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault(); // Prevents textarea blur before insertion
                    e.stopPropagation();
                    e.nativeEvent?.stopImmediatePropagation?.();
                    insertMention(user);
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-[11px] transition ${
                    isSelected ? 'bg-[#edf5f0] text-[#173e49] font-semibold' : 'text-foreground hover:bg-muted/70'
                  }`}
                >
                  <span
                    className={`grid size-6 shrink-0 place-items-center rounded-full text-[9px] font-bold ${
                      isSelected ? 'bg-[#2e7c67] text-white' : 'bg-[#e2ddd3] text-[#173e49]'
                    }`}
                  >
                    {user.initials}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate flex items-center gap-1.5">
                      <span className="font-bold">
                        <Highlighted text={user.name} query={mentionQuery ?? ''} />
                      </span>
                      <span className="text-[9px] text-muted-foreground font-normal">({user.title || user.role})</span>
                    </div>
                    <div className="truncate text-[9px] text-muted-foreground font-mono">
                      {user.email ? <Highlighted text={user.email} query={mentionQuery ?? ''} /> : 'No email'}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/** The text with the letters that matched the query in bold. */
function Highlighted({ text, query }: { text: string; query: string }) {
  return (
    <>
      {highlightMatch(text, query).map((part, i) =>
        part.match ? (
          <mark key={i} className="bg-transparent font-extrabold text-[#2e7c67] underline decoration-[#2e7c67]/40">
            {part.text}
          </mark>
        ) : (
          <React.Fragment key={i}>{part.text}</React.Fragment>
        ),
      )}
    </>
  );
}

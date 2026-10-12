import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { User } from '@/data/users';
import { api } from '@/lib/api';

interface MentionTextareaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> {
  value: string;
  onChange: (value: string) => void;
  users: User[];
  onMentionSelect?: (user: User) => void;
  dropdownDirection?: 'auto' | 'top' | 'bottom';
}

/**
 * Parses text for any @mentions matching available users by first name, last name, or full name.
 */
export function extractMentionedUserIds(text: string, users: User[]): string[] {
  if (!text || !users || !users.length) return [];
  const mentionedIds = new Set<string>();

  // Sort users by full name length descending so longer full names match first
  const sortedUsers = [...users].sort((a, b) => (b.name?.length || 0) - (a.name?.length || 0));

  // Count first name occurrences across all users to guard against ambiguous first names (e.g. 7 users named Akash)
  const firstNameCounts = new Map<string, number>();
  for (const u of users) {
    if (!u.name) continue;
    const fn = u.name.toLowerCase().trim().split(' ')[0];
    if (fn) {
      firstNameCounts.set(fn, (firstNameCounts.get(fn) || 0) + 1);
    }
  }

  const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let remainingText = text;

  // 1. Exact Full Name Matching (e.g. "@Akash Deep")
  for (const u of sortedUsers) {
    if (!u.name) continue;
    const fullName = u.name.trim();
    const fnRegex = new RegExp(`@${escapeRegex(fullName)}(?:\\b|\\s|[,:;!?]|$)`, 'i');
    if (fnRegex.test(remainingText)) {
      mentionedIds.add(u.id);
      // Mask out matched full name so sub-tokens are not falsely re-matched
      remainingText = remainingText.replace(new RegExp(`@${escapeRegex(fullName)}`, 'gi'), ' ');
    }
  }

  // 2. Exact Email or Email Prefix Matching (e.g. "@akash.deep@encalm.com" or "@akash.deep")
  for (const u of sortedUsers) {
    if (!u.email) continue;
    const email = u.email.trim();
    const emailPrefix = email.split('@')[0];

    const emailRegex = new RegExp(`@${escapeRegex(email)}(?:\\b|\\s|[,:;!?]|$)`, 'i');
    if (emailRegex.test(remainingText)) {
      mentionedIds.add(u.id);
      remainingText = remainingText.replace(new RegExp(`@${escapeRegex(email)}`, 'gi'), ' ');
      continue;
    }

    if (emailPrefix && emailPrefix.length >= 3) {
      const prefixRegex = new RegExp(`@${escapeRegex(emailPrefix)}(?:\\b|\\s|[,:;!?]|$)`, 'i');
      if (prefixRegex.test(remainingText)) {
        mentionedIds.add(u.id);
        remainingText = remainingText.replace(new RegExp(`@${escapeRegex(emailPrefix)}`, 'gi'), ' ');
      }
    }
  }

  // 3. User ID Slug Matching (e.g. "user-praveen-pal" -> "@praveen pal")
  for (const u of sortedUsers) {
    if (!u.id) continue;
    const idSlug = u.id.replace('user-', '').replace(/-/g, ' ').trim();
    if (idSlug.length >= 3) {
      const idSlugRegex = new RegExp(`@${escapeRegex(idSlug)}(?:\\b|\\s|[,:;!?]|$)`, 'i');
      if (idSlugRegex.test(remainingText)) {
        mentionedIds.add(u.id);
        remainingText = remainingText.replace(new RegExp(`@${escapeRegex(idSlug)}`, 'gi'), ' ');
      }
    }
  }

  // 4. First name matching ONLY IF that first name is completely unique across the organisation
  // If multiple users share the same first name (e.g. multiple "Akash" in Encalm), matching on first name alone is strictly disabled
  for (const u of sortedUsers) {
    if (!u.name) continue;
    const firstName = u.name.trim().split(' ')[0];
    const fnLower = firstName.toLowerCase();
    if (firstName.length >= 3 && firstNameCounts.get(fnLower) === 1) {
      const firstNameRegex = new RegExp(`@${escapeRegex(firstName)}(?:\\b|\\s|[,:;!?]|$)`, 'i');
      if (firstNameRegex.test(remainingText)) {
        mentionedIds.add(u.id);
        remainingText = remainingText.replace(new RegExp(`@${escapeRegex(firstName)}`, 'gi'), ' ');
      }
    }
  }

  return Array.from(mentionedIds);
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

    const q = mentionQuery.trim();
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

  // Merge local users and live Azure directory users
  const filteredUsers = React.useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase().trim();

    // Start with local users matching the query
    const matchedLocal = q
      ? users.filter((u) => {
          const name = u.name.toLowerCase();
          const email = (u.email || '').toLowerCase();
          const title = (u.title || '').toLowerCase();
          return name.includes(q) || email.includes(q) || title.includes(q);
        })
      : users;

    // Combine with Azure users avoiding duplicates by email
    const combined: User[] = [...matchedLocal];
    azureUsers.forEach((au) => {
      if (!combined.some((cu) => cu.email?.toLowerCase() === au.email?.toLowerCase())) {
        combined.push(au);
      }
    });

    return combined.slice(0, 15);
  }, [mentionQuery, users, azureUsers]);

  // Handle textarea change and detect @
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    onChange(newValue);

    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = newValue.slice(0, cursorPos);

    // Look for @ followed by word characters up to cursor
    const lastAtMatch = /(?:^|\s)@([a-zA-Z0-9._-]*)$/.exec(textBeforeCursor);

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
                      <span className="font-bold">{user.name}</span>
                      <span className="text-[9px] text-muted-foreground font-normal">({user.title || user.role})</span>
                    </div>
                    <div className="truncate text-[9px] text-muted-foreground font-mono">
                      {user.email || 'No email'}
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

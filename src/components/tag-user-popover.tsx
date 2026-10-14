import React, { useState, useRef, useEffect } from 'react';
import { Tag, X, Check, Users, Send, Mail, Loader2 } from 'lucide-react';
import { users as defaultUsers, getUserById, initialsOf, type User } from '@/data/users';
import { useAppState } from '@/state/app-state';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api';
import { MentionTextarea } from './mention-textarea';
import { resolveTypedMentions } from '@/lib/mention-match';
import { errorMessage } from '@/lib/utils';

interface TagUserPopoverProps {
  taggedUsers?: string[];
  onChange: (taggedUserIds: string[]) => void;
  canTag?: boolean;
  /** Whether the tag chips are saved on the item (needs edit rights). Emails go out either way. */
  saveTags?: boolean;
  compact?: boolean;
  label?: string;
  projectId?: string;
  entityType?: 'Task' | 'Stage' | 'Milestone' | 'Issue' | 'Update' | 'General';
  entityId?: string;
  entityTitle?: string;
  entityContext?: string;
}

export function TagUserPopover({
  taggedUsers = [],
  onChange,
  canTag = true,
  saveTags = true,
  label = 'Tag',
  projectId,
  entityType = 'Stage',
  entityId,
  entityTitle,
  entityContext,
}: TagUserPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);
  const [stagedUserIds, setStagedUserIds] = useState<string[]>(taggedUsers || []);
  const [externalMentionedUsers, setExternalMentionedUsers] = useState<User[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const { leads, users: contextUsers, resolveUser } = useAppState();
  const { toast } = useToast();

  // Reset staged selections whenever popover opens
  useEffect(() => {
    if (isOpen) {
      setStagedUserIds(taggedUsers || []);
    }
  }, [isOpen, taggedUsers]);

  // Merge default users, context directory users, leads, and dynamically fetched Azure users
  const baseUsers: User[] = React.useMemo(() => {
    const map = new Map<string, User>();
    defaultUsers.forEach((u) => map.set(u.id, u));
    if (Array.isArray(contextUsers)) {
      contextUsers.forEach((u) => map.set(u.id, { ...map.get(u.id), ...u }));
    }
    if (Array.isArray(leads)) {
      leads.forEach((l) => map.set(l.id, { ...map.get(l.id), ...l }));
    }
    externalMentionedUsers.forEach((eu) => map.set(eu.id, { ...map.get(eu.id), ...eu }));
    return Array.from(map.values());
  }, [leads, contextUsers, externalMentionedUsers]);

  // @names typed without picking from the list: only a full name that belongs to
  // exactly one person counts. A shared name is never guessed; the user picks.
  const typedMentions = React.useMemo(
    () => resolveTypedMentions(comment, baseUsers, stagedUserIds),
    [comment, baseUsers, stagedUserIds],
  );

  // Exactly the people who will be emailed: picked ones plus unambiguous typed names.
  const effectiveSelectedIds = React.useMemo(() => {
    return Array.from(new Set([...(stagedUserIds || []), ...typedMentions.ids]));
  }, [stagedUserIds, typedMentions.ids]);
  const recipients = effectiveSelectedIds
    .map((id) => baseUsers.find((u) => u.id === id))
    .filter((u): u is User => Boolean(u));
  const unresolved = typedMentions.ambiguous;

  // Sort available users: currently selected/tagged users always appear at the top
  const availableUsers: User[] = React.useMemo(() => {
    return [...baseUsers].sort((a, b) => {
      const aSelected = effectiveSelectedIds.includes(a.id) ? 1 : 0;
      const bSelected = effectiveSelectedIds.includes(b.id) ? 1 : 0;
      return bSelected - aSelected;
    });
  }, [baseUsers, effectiveSelectedIds]);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node | null;
      if (!target || !containerRef.current) return;

      // 1. If event path passed through the container, it's an inside click
      const path = event.composedPath ? event.composedPath() : [];
      if (path.length > 0 && path.includes(containerRef.current)) {
        return;
      }

      // 2. If the clicked target was unmounted/detached during event processing (e.g. mention dropdown item),
      // it was inside our container when clicked; do not close the popover.
      if (!document.contains(target)) {
        return;
      }

      // 3. Regular outside click check
      if (!containerRef.current.contains(target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Stage or un-stage member locally without sending emails or updating parent yet
  const toggleUser = (userId: string) => {
    if (!canTag) return;
    const isAlreadySelected = effectiveSelectedIds.includes(userId);
    if (isAlreadySelected) {
      setStagedUserIds((prev) => prev.filter((id) => id !== userId));

      // If user was also mentioned in comment, clear their @mention so it doesn't immediately re-check
      const targetUser = baseUsers.find((u) => u.id === userId);
      if (targetUser && comment) {
        const cleanedComment = comment
          .replace(new RegExp(`@${targetUser.name}\\s*`, 'gi'), '')
          .replace(new RegExp(`@${targetUser.email}\\s*`, 'gi'), '')
          .trim();
        setComment(cleanedComment);
      }
    } else {
      setStagedUserIds((prev) => Array.from(new Set([...prev, userId])));
    }
  };

  const removeTag = (e: React.MouseEvent, userId: string) => {
    e.stopPropagation();
    if (!canTag || !saveTags) return;
    onChange((taggedUsers || []).filter((id) => id !== userId));
  };

  // When a user is picked from @ autocomplete, stage them locally without triggering premature emails
  const handleMentionSelect = (user: User) => {
    setExternalMentionedUsers((prev) => {
      if (!prev.some((u) => u.id === user.id || u.email?.toLowerCase() === user.email?.toLowerCase())) {
        return [...prev, user];
      }
      return prev;
    });
    setStagedUserIds((prev) => Array.from(new Set([...prev, user.id])));
  };

  const handleSendMail = async (e: React.FormEvent) => {
    e.preventDefault();

    const allRecipientIds = effectiveSelectedIds;

    if (unresolved.length > 0) {
      toast({
        title: `Which ${unresolved[0].name}?`,
        description: 'Several people share that name. Pick the right one before sending.',
        variant: 'destructive',
      });
      return;
    }

    if (allRecipientIds.length === 0) {
      toast({
        title: 'Select a team member',
        description: 'Please select a team member or type @name in the comment.',
        variant: 'destructive',
      });
      return;
    }

    // Save the chips on the item when this user may edit it.
    if (saveTags) onChange(allRecipientIds);

    if (!projectId) {
      // If no projectId is passed, we simply close with local tagging updated
      toast({
        title: 'Members tagged',
        description: 'Tagged team members updated successfully.',
      });
      setIsOpen(false);
      setComment('');
      return;
    }

    setSending(true);
    try {
      const res = await api.email.tagAndComment({
        projectId,
        entityType,
        entityId,
        entityTitle: entityTitle || entityType,
        entityContext,
        taggedUserIds: allRecipientIds,
        comment: comment.trim() || undefined,
      });

      const recipientNames = res.recipients
        .filter((r) => r.status !== 'skipped')
        .map((r) => r.userName || r.email)
        .join(', ');

      const emailed = res.recipients.filter((r) => r.status !== 'skipped').length;

      toast({
        title: emailed > 0 ? '✓ Notification sent' : '✓ Notification saved',
        description:
          emailed === 0
            ? 'Tagged users were notified in the dashboard.'
            : res.delivery === 'outbox'
              ? `Emails to ${recipientNames} are waiting in the Outbox: no email service is connected yet.`
              : `Emails to ${recipientNames} are on their way, sent from your address.`,
      });

      setComment('');
      setIsOpen(false);
    } catch (err) {
      toast({
        title: 'Notification Error',
        description: errorMessage(err, 'Could not dispatch email notification.'),
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="relative inline-flex items-center gap-1.5" ref={containerRef}>
      {/* Existing Tag Chips */}
      {taggedUsers.map((userId) => {
        const u =
          (resolveUser ? resolveUser(userId) : undefined) ||
          availableUsers.find((user) => user.id === userId) ||
          getUserById(userId);
        const name = u?.name || userId;
        const initials = u?.initials || (u?.name ? initialsOf(u.name) : name.slice(0, 2).toUpperCase());

        return (
          <span
            key={userId}
            className="inline-flex items-center gap-1 rounded-full border border-[#eadcb1] bg-[#fdf8ec] px-2 py-0.5 text-[10px] font-semibold text-[#8c671b] shadow-xs transition hover:border-[#d19b35]"
            title={`Tagged: ${name} (${u?.title || u?.role || 'Member'}) - ${u?.email || 'No email'}`}
          >
            <span className="grid size-3.5 place-items-center rounded-full bg-[#d19b35] text-[8px] font-bold text-white">
              {initials}
            </span>
            <span className="max-w-[80px] truncate">{name.split(' ')[0]}</span>
            {canTag && saveTags && (
              <button
                type="button"
                onClick={(e) => removeTag(e, userId)}
                aria-label={`Remove tag ${name}`}
                className="ml-0.5 rounded-full p-0.5 text-[#8c671b] hover:bg-[#ebd59f] hover:text-[#5a3e0b]"
              >
                <X size={10} />
              </button>
            )}
          </span>
        );
      })}

      {/* Trigger Button */}
      {canTag && (
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className={`inline-flex items-center gap-1 rounded-md border transition ${
            taggedUsers.length > 0
              ? 'border-border/60 bg-white/70 px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground'
              : 'border-dashed border-border bg-[#faf8f3] px-2 py-1 text-[10px] font-semibold text-muted-foreground hover:border-[#2e7c67] hover:bg-[#edf5f0] hover:text-[#2e7c67]'
          }`}
          title="Tag individuals to assign ownership & send email comments"
        >
          {taggedUsers.length === 0 ? (
            <>
              <Tag size={11} className="text-[#3d9a7e]" />
              <span>{label}</span>
            </>
          ) : (
            <>
              <Tag size={10} />
              <span>+</span>
            </>
          )}
        </button>
      )}

      {/* Dropdown Popover */}
      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-1.5 w-80 rounded-xl border border-border bg-white p-3 shadow-xl shadow-[#173e49]/15 animate-in fade-in zoom-in-95">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/70 pb-2">
            <div className="flex items-center gap-1.5">
              <Users size={14} className="text-[#2e7c67]" />
              <span className="text-[12px] font-bold text-[#173e49]">Tag & Send Email</span>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-md p-1 text-muted-foreground hover:bg-muted"
            >
              <X size={13} />
            </button>
          </div>

          {/* User Selection List */}
          <div className="mt-2 flex items-center justify-between text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
            <span>Select Member(s):</span>
            {effectiveSelectedIds.length > 0 && (
              <span className="font-mono text-[#2e7c67] font-bold lowercase">
                {effectiveSelectedIds.length} selected
              </span>
            )}
          </div>
          <div className="mt-1 max-h-36 space-y-1 overflow-y-auto pr-1">
            {availableUsers.map((user) => {
              const isSelected = effectiveSelectedIds.includes(user.id);
              return (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => toggleUser(user.id)}
                  className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-[11px] transition ${
                    isSelected ? 'bg-[#edf5f0] text-[#2e7c67] font-semibold' : 'hover:bg-muted/70 text-foreground'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`grid size-6 shrink-0 place-items-center rounded-full text-[9px] font-bold ${
                        isSelected ? 'bg-[#2e7c67] text-white' : 'bg-[#e2ddd3] text-[#173e49]'
                      }`}
                    >
                      {user.initials}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{user.name}</div>
                      <div className="text-[9px] text-muted-foreground truncate font-mono">
                        {user.email || user.title}
                      </div>
                    </div>
                  </div>

                  <span
                    className={`grid size-4 shrink-0 place-items-center rounded-sm border ${
                      isSelected ? 'border-[#2e7c67] bg-[#2e7c67] text-white' : 'border-border bg-card'
                    }`}
                  >
                    {isSelected && <Check size={11} strokeWidth={3} />}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Comment & Mail Form */}
          <form onSubmit={handleSendMail} className="mt-3 border-t border-border/70 pt-2.5">
            <div className="flex items-center justify-between mb-1">
              <span className="block text-[10px] font-bold text-[#173e49]">Add Message / Comment:</span>
              <span className="text-[9px] text-[#2e7c67] font-semibold">Type @ to tag recipient</span>
            </div>
            <MentionTextarea
              value={comment}
              onChange={setComment}
              users={availableUsers}
              onMentionSelect={handleMentionSelect}
              placeholder="Type @person to tag, then write message..."
              rows={2}
              className="w-full rounded-lg border border-border bg-[#faf8f3] px-2.5 py-1.5 text-[11px] outline-none focus:border-[#2e7c67] focus:bg-white transition resize-none"
            />

            {unresolved.map((group) => (
              <div
                key={group.name}
                role="group"
                aria-label={`Which ${group.name}?`}
                className="mt-2 rounded-lg border border-[#eadcb1] bg-[#fdf8ec] p-2 text-[10px] text-[#7a5914]"
              >
                <div className="font-bold">Which {group.name}? Several people share this name.</div>
                <div className="mt-1 space-y-1">
                  {group.candidates.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setStagedUserIds((prev) => Array.from(new Set([...prev, c.id])))}
                      className="flex w-full items-center justify-between rounded-md bg-white px-2 py-1 text-left hover:bg-[#f3ead2]"
                    >
                      <span className="font-semibold">{c.name}</span>
                      <span className="font-mono text-[9px] text-muted-foreground">
                        {c.email || c.title || 'No email'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}

            {recipients.length > 0 && (
              <div className="mt-2 rounded-lg bg-[#f7f5ef] px-2 py-1.5 text-[10px]">
                <div className="font-bold text-[#173e49]">Will email:</div>
                <ul className="mt-0.5 space-y-0.5">
                  {recipients.map((r) => (
                    <li key={r.id} className="flex justify-between gap-2">
                      <span className="truncate">{r.name}</span>
                      <span className="truncate font-mono text-[9px] text-muted-foreground">
                        {r.email || 'no email: dashboard notice only'}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-2.5 flex items-center justify-between gap-2">
              <span className="text-[9px] text-muted-foreground flex items-center gap-1">
                <Mail size={11} className="text-[#3d9a7e]" />
                {projectId ? 'Sent from your email address' : 'Emailed when you post the update'}
              </span>

              <button
                type="submit"
                disabled={sending || effectiveSelectedIds.length === 0 || unresolved.length > 0}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#173e49] px-3 py-1.5 text-[10px] font-bold text-white shadow-xs transition hover:bg-[#205160] disabled:opacity-40"
              >
                {sending ? (
                  <>
                    <Loader2 size={12} className="animate-spin" />
                    <span>Sending...</span>
                  </>
                ) : (
                  <>
                    <Send size={11} />
                    <span>{projectId ? 'Tag & Send Mail' : 'Add to update'}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

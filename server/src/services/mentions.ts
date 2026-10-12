type MentionableUser = { id: string; name: string | null; email: string | null };

const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Finds the users @mentioned in a comment. Tries, in order: full name
 * ("@Akash Deep"), email or email prefix ("@akash.deep"), the id slug
 * ("@praveen pal" for user-praveen-pal), and finally a first name, but only
 * when no one else shares it. Each match is masked out so its parts are not
 * matched again.
 */
export function resolveMentions(comment: string, users: MentionableUser[]): string[] {
  const found = new Set<string>();
  // Longer names first, so "@Akash Deep" wins over "@Akash".
  const sorted = [...users].sort((a, b) => (b.name?.length || 0) - (a.name?.length || 0));
  let remaining = comment;

  const take = (userId: string, token: string): boolean => {
    if (!new RegExp(`@${escapeRegex(token)}(?:\\b|\\s|[,:;!?]|$)`, 'i').test(remaining)) return false;
    found.add(userId);
    remaining = remaining.replace(new RegExp(`@${escapeRegex(token)}`, 'gi'), ' ');
    return true;
  };

  for (const u of sorted) {
    if (u.name) take(u.id, u.name.trim());
  }

  for (const u of sorted) {
    if (!u.email) continue;
    const email = u.email.trim();
    if (take(u.id, email)) continue;
    const prefix = email.split('@')[0];
    if (prefix.length >= 3) take(u.id, prefix);
  }

  for (const u of sorted) {
    const slug = u.id.replace('user-', '').replace(/-/g, ' ').trim();
    if (slug.length >= 3) take(u.id, slug);
  }

  const firstNameCounts = new Map<string, number>();
  for (const u of users) {
    const first = u.name?.toLowerCase().trim().split(' ')[0];
    if (first) firstNameCounts.set(first, (firstNameCounts.get(first) || 0) + 1);
  }
  for (const u of sorted) {
    if (!u.name) continue;
    const first = u.name.trim().split(' ')[0];
    if (first.length >= 3 && firstNameCounts.get(first.toLowerCase()) === 1) take(u.id, first);
  }

  return [...found];
}

/**
 * Matching for the @mention suggestion list and for @names typed into a
 * comment. Suggestions are forgiving (prefixes, small typos, several words);
 * deciding who gets an email is strict: only a picked person, or a typed full
 * name that belongs to exactly one person.
 */

export type Mentionable = { id: string; name: string; email?: string; title?: string; role?: string };

const fold = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');

const words = (s: string) =>
  fold(s)
    .split(/[\s._-]+/)
    .filter(Boolean);

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Optimal-string-alignment distance (insert, delete, substitute, swap adjacent). */
export function editDistance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
}

const isSubsequence = (needle: string, hay: string) => {
  let i = 0;
  for (const ch of hay) if (ch === needle[i]) i++;
  return i === needle.length;
};

/** How well one typed word matches one candidate word (0 = not at all). */
function wordScore(q: string, w: string): number {
  if (w === q) return 100;
  if (w.startsWith(q)) return 80;
  if (q.length >= 2 && w.includes(q)) return 50;
  if (q.length >= 3 && q[0] === w[0] && isSubsequence(q, w)) return 30; // "aksh" -> "akash"
  if (q.length >= 4) {
    const near = Math.min(editDistance(q, w), editDistance(q, w.slice(0, q.length)));
    if (near <= 1) return 25; // "akaash" -> "akash", "akahs" -> "akash"
  }
  return 0;
}

/**
 * Scores a person against what was typed after "@". Every typed word must
 * match their name, email or job title. 0 means "do not suggest".
 */
export function scoreMatch(query: string, user: Mentionable): number {
  const typed = words(query);
  if (typed.length === 0) return 1;
  const nameWords = words(user.name || '');
  const emailWords = words((user.email || '').split('@')[0]);
  const titleWords = words(user.title || '');

  let total = 0;
  for (const q of typed) {
    const best = Math.max(
      ...nameWords.map((w) => wordScore(q, w)),
      ...emailWords.map((w) => wordScore(q, w) * 0.8),
      ...titleWords.map((w) => (w.startsWith(q) ? 20 : 0)),
      0,
    );
    if (best === 0) return 0;
    total += best;
  }
  if (fold(user.name || '').startsWith(typed.join(' '))) total += 50;
  return total;
}

/** People to suggest for a query, best first. */
export function rankMentionCandidates<T extends Mentionable>(query: string, users: T[], limit = 15): T[] {
  return users
    .map((user, index) => ({ user, index, score: scoreMatch(query, user) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map((r) => r.user);
}

export type HighlightPart = { text: string; match: boolean };

/**
 * Splits `text` into parts, marking the characters that the query matched:
 * substrings where they occur, otherwise the letters of a fuzzy match.
 */
export function highlightMatch(text: string, query: string): HighlightPart[] {
  const lower = fold(text);
  const marked = new Array<boolean>(text.length).fill(false);
  for (const q of words(query)) {
    const at = lower.indexOf(q);
    if (at >= 0) {
      for (let i = at; i < at + q.length; i++) marked[i] = true;
      continue;
    }
    // Fuzzy: mark the letters of the query in order, within one word.
    const start = lower.search(new RegExp(`(^|[\\s._-])${escapeRegex(q[0])}`));
    if (start < 0) continue;
    let qi = 0;
    for (let i = start; i < lower.length && qi < q.length; i++) {
      if (lower[i] === q[qi]) {
        marked[i] = true;
        qi++;
      }
    }
  }
  const parts: HighlightPart[] = [];
  for (let i = 0; i < text.length; i++) {
    const last = parts[parts.length - 1];
    if (last && last.match === marked[i]) last.text += text[i];
    else parts.push({ text: text[i], match: marked[i] });
  }
  return parts;
}

export type TypedMentions<T extends Mentionable> = {
  /** People named in full by a typed @name that only they have. */
  ids: string[];
  /** Typed @names shared by several people, none of whom was picked. */
  ambiguous: Array<{ name: string; candidates: T[] }>;
};

/**
 * Finds people named by "@Full Name" or "@email" typed into a comment without
 * being picked from the list. A name shared by several people is never
 * guessed: it is reported as ambiguous unless one of them was picked.
 */
export function resolveTypedMentions<T extends Mentionable>(
  text: string,
  users: T[],
  pickedIds: string[] = [],
): TypedMentions<T> {
  const picked = new Set(pickedIds);
  const groups = new Map<string, T[]>();
  const seenEmails = new Set<string>();
  for (const u of users) {
    const email = u.email?.trim().toLowerCase();
    if (email) {
      if (seenEmails.has(email)) continue; // same person listed twice
      seenEmails.add(email);
    }
    const key = (u.name || '').trim().toLowerCase();
    if (!key) continue;
    groups.set(key, [...(groups.get(key) ?? []), u]);
  }

  const ids = new Set<string>();
  const ambiguous: TypedMentions<T>['ambiguous'] = [];
  let remaining = text;
  const end = '(?=$|[\\s,.;:!?)])';

  // Longest names first, so "@Akash Kumar" is not also read as "@Akash".
  for (const [key, members] of [...groups].sort((a, b) => b[0].length - a[0].length)) {
    const pattern = `@${escapeRegex(key)}${end}`;
    if (!new RegExp(pattern, 'i').test(remaining)) continue;
    remaining = remaining.replace(new RegExp(pattern, 'gi'), ' ');
    if (members.some((m) => picked.has(m.id))) continue;
    if (members.length === 1) ids.add(members[0].id);
    else ambiguous.push({ name: members[0].name, candidates: members });
  }

  for (const u of users) {
    if (u.email && new RegExp(`@${escapeRegex(u.email.trim())}${end}`, 'i').test(remaining)) ids.add(u.id);
  }

  return { ids: [...ids].filter((id) => !picked.has(id)), ambiguous };
}

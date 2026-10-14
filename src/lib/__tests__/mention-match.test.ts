import { describe, expect, it } from 'vitest';
import {
  editDistance,
  highlightMatch,
  rankMentionCandidates,
  resolveTypedMentions,
  scoreMatch,
} from '../mention-match';

const people = [
  { id: 'a1', name: 'Akash Deep', email: 'akash.deep@encalm.com', title: 'Lead' },
  { id: 'a2', name: 'Akash Kumar', email: 'akash.kumar@encalm.com' },
  { id: 'a3', name: 'Akash Kumar', email: 'akash.k2@encalm.com' },
  { id: 'a4', name: 'Akash Kapoor', email: 'ak@encalm.com' },
  { id: 'p1', name: 'Praveen Pal', email: 'praveen.pal@encalm.com', title: 'Architect' },
];
const ids = (list: { id: string }[]) => list.map((p) => p.id);

describe('suggestions', () => {
  it('suggests near-miss spellings', () => {
    expect(ids(rankMentionCandidates('aksh', people))).toEqual(['a1', 'a2', 'a3', 'a4']);
    expect(ids(rankMentionCandidates('akaash', people))).toEqual(['a1', 'a2', 'a3', 'a4']);
    expect(ids(rankMentionCandidates('praven', people))).toEqual(['p1']);
    expect(rankMentionCandidates('zzz', people)).toEqual([]);
  });

  it('narrows with a second word after a space', () => {
    expect(ids(rankMentionCandidates('akash k', people))).toEqual(['a2', 'a3', 'a4']);
    expect(ids(rankMentionCandidates('akash kum', people))).toEqual(['a2', 'a3']);
    expect(ids(rankMentionCandidates('akash d', people))).toEqual(['a1']);
  });

  it('ranks exact and starts-with matches above fuzzy ones', () => {
    expect(scoreMatch('praveen', people[4])).toBeGreaterThan(scoreMatch('praven', people[4]));
    expect(ids(rankMentionCandidates('pal', people))[0]).toBe('p1');
  });

  it('lists everyone for an empty query, and matches email and title', () => {
    expect(rankMentionCandidates('', people)).toHaveLength(5);
    expect(ids(rankMentionCandidates('architect', people))).toEqual(['p1']);
    expect(ids(rankMentionCandidates('k2', people))).toEqual(['a3']);
  });

  it('measures edit distance with swapped letters as one edit', () => {
    expect(editDistance('akash', 'akahs')).toBe(1);
    expect(editDistance('akaash', 'akash')).toBe(1);
    expect(editDistance('', 'ab')).toBe(2);
  });
});

describe('highlightMatch', () => {
  const marked = (text: string, q: string) =>
    highlightMatch(text, q)
      .filter((p) => p.match)
      .map((p) => p.text);

  it('marks substrings for each typed word', () => {
    expect(marked('Akash Kumar', 'akash ku')).toEqual(['Akash', 'Ku']);
  });

  it('marks the letters of a fuzzy match', () => {
    expect(marked('Akash Deep', 'aksh').join('')).toBe('Aksh');
  });

  it('keeps the original text intact', () => {
    expect(
      highlightMatch('Akash Deep', 'deep')
        .map((p) => p.text)
        .join(''),
    ).toBe('Akash Deep');
  });
});

describe('resolveTypedMentions', () => {
  it('names a person only when their full name is unique', () => {
    expect(resolveTypedMentions('please check @Akash Deep, thanks', people)).toEqual({ ids: ['a1'], ambiguous: [] });
  });

  it('never guesses between people who share a name', () => {
    const r = resolveTypedMentions('@Akash Kumar please check', people);
    expect(r.ids).toEqual([]);
    expect(r.ambiguous).toEqual([{ name: 'Akash Kumar', candidates: [people[1], people[2]] }]);
  });

  it('accepts the shared name once one of those people was picked from the list', () => {
    expect(resolveTypedMentions('@Akash Kumar please check', people, ['a3'])).toEqual({ ids: [], ambiguous: [] });
  });

  it('does not read a first name or part of a name as a mention', () => {
    expect(resolveTypedMentions('@Akash please, and @Kumar', people)).toEqual({ ids: [], ambiguous: [] });
  });

  it('accepts a full email address', () => {
    expect(resolveTypedMentions('cc @akash.k2@encalm.com', people).ids).toEqual(['a3']);
  });

  it('treats the same email listed twice as one person', () => {
    const twice = [...people, { id: 'azure-x', name: 'Akash Deep', email: 'AKASH.DEEP@encalm.com' }];
    expect(resolveTypedMentions('@Akash Deep', twice)).toEqual({ ids: ['a1'], ambiguous: [] });
  });
});

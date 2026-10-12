import { describe, expect, it } from 'vitest';
import { resolveMentions } from '../src/services/mentions.js';

const users = [
  { id: 'user-akash-deep', name: 'Akash Deep', email: 'akash.deep@encalm.com' },
  { id: 'user-akash-rao', name: 'Akash Rao', email: 'akash.rao@encalm.com' },
  { id: 'user-praveen-pal', name: 'Praveen Pal', email: 'ppal@encalm.com' },
  { id: 'user-ruchika', name: 'Ruchika Chauhan', email: 'ruchika@encalm.com' },
];

describe('resolveMentions', () => {
  it('matches full names, longest first', () => {
    expect(resolveMentions('Please check @Akash Deep', users)).toEqual(['user-akash-deep']);
  });

  it('matches an email or its prefix', () => {
    expect(resolveMentions('cc @akash.rao@encalm.com', users)).toEqual(['user-akash-rao']);
    expect(resolveMentions('cc @akash.rao, thanks', users)).toEqual(['user-akash-rao']);
  });

  it('matches the id slug', () => {
    expect(resolveMentions('@praveen pal please review', users)).toEqual(['user-praveen-pal']);
  });

  it('matches a first name only when it is unique', () => {
    expect(resolveMentions('@Ruchika over to you', users)).toEqual(['user-ruchika']);
    expect(resolveMentions('@Akash over to you', users)).toEqual([]);
  });

  it('finds several people and ignores text without @', () => {
    expect(resolveMentions('Akash Deep and @Ruchika Chauhan with @ppal', users).sort()).toEqual([
      'user-praveen-pal',
      'user-ruchika',
    ]);
  });
});

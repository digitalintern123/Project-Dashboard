import { describe, expect, it } from 'vitest';
import { leadName, rememberUsers } from '@/data/users';

describe('leadName', () => {
  it('says Unassigned for an unknown or empty lead', () => {
    expect(leadName('u-nobody-yet')).toBe('Unassigned');
    expect(leadName('')).toBe('Unassigned');
  });

  it('names a Project Lead loaded from the server', () => {
    rememberUsers([{ id: 'u-karan', name: 'Karan Verma', role: 'lead', title: 'Project Lead', initials: 'KV' }]);
    expect(leadName('u-karan')).toBe('Karan Verma');
  });
});

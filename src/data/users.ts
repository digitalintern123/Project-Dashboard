/**
 * User identity and authentic default system accounts for Encalm Projects.
 */

export type UserRole = 'hod' | 'lead' | 'coordinator' | 'viewer';

export type User = {
  id: string;
  name: string;
  email?: string;
  role: UserRole;
  title: string;
  initials: string;
  /** Set by the server when the user must change their password before continuing. */
  mustChangePassword?: boolean;
};

export const DEFAULT_HOD_ID = 'user-ruchika-chauhan';
export const DEFAULT_COORDINATOR_ID = 'user-praveen-pal';

export const users: User[] = [
  {
    id: DEFAULT_HOD_ID,
    name: 'Ruchika Chauhan',
    email: 'hod@encalm.com',
    role: 'hod',
    title: 'Project HOD',
    initials: 'RC',
  },
  {
    id: DEFAULT_COORDINATOR_ID,
    name: 'Praveen Pal',
    email: 'digital.intern@encalm.com',
    role: 'coordinator',
    title: 'Project Coordinator',
    initials: 'PP',
  },
];

/** People loaded from the server (Project Leads and the user list), so their names resolve too. */
const loadedUsers = new Map<string, User>();

export function rememberUsers(list: User[]) {
  for (const user of list) if (user?.id) loadedUsers.set(user.id, user);
}

export function getUserById(id: string | undefined | null): User | undefined {
  if (!id) return undefined;
  return users.find((user) => user.id === id) ?? loadedUsers.get(id);
}

/** Display name for a `leadId`. Never blank — falls back to "Unassigned". */
export function leadName(leadId: string | undefined | null): string {
  return getUserById(leadId)?.name ?? 'Unassigned';
}

export function initialsOf(name: string): string {
  return (
    name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || '?'
  );
}

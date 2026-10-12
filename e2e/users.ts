export const E2E_USERS = {
  coordinator: {
    id: 'e2e-coord',
    name: 'Cora Coordinator',
    email: 'coord@e2e.test',
    password: 'Coord-e2e-pass-1',
    role: 'coordinator',
    title: 'Project Coordinator',
    initials: 'CC',
  },
  lead: {
    id: 'e2e-lead',
    name: 'Lee Lead',
    email: 'lead@e2e.test',
    password: 'Lead-e2e-pass-1',
    role: 'lead',
    title: 'Project Lead',
    initials: 'LL',
  },
  hod: {
    id: 'e2e-hod',
    name: 'Hana Hod',
    email: 'hod@e2e.test',
    password: 'Hod-e2e-pass-1',
    role: 'hod',
    title: 'Project HOD',
    initials: 'HH',
  },
} as const;

export type E2ERole = keyof typeof E2E_USERS;

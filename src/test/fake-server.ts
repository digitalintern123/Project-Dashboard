import { vi } from 'vitest';
import type { User } from '@/data/users';

export type FakeUser = User & { email: string; password: string };

export const users: Record<'coordinator' | 'lead' | 'hod', FakeUser> = {
  coordinator: { id: 'u-coord', name: 'Cora Ordinator', email: 'coord@test.local', role: 'coordinator', title: 'Project Coordinator', initials: 'CO', password: 'Coord-pass-123' },
  lead: { id: 'u-lead', name: 'Lee Lead', email: 'lead@test.local', role: 'lead', title: 'Project Lead', initials: 'LL', password: 'Lead-pass-1234' },
  hod: { id: 'u-hod', name: 'Hal Od', email: 'hod@test.local', role: 'hod', title: 'Project HOD', initials: 'HO', password: 'Hod-pass-12345' },
};

export const sampleProject = {
  id: 'delhi-lounge',
  name: 'Delhi Lounge',
  location: 'Delhi',
  category: 'Lounge',
  code: 'DEL-1',
  health: 'On track',
  status: 'In Design',
  progress: 40,
  targetDate: '2027-01-01',
  targetLabel: 'Jan 2027',
  aop: 1000,
  awarded: 500,
  spent: 100,
  projectedCost: 1000,
  nextMilestone: 'Design freeze',
  nextMilestoneDate: '2026-12-01',
  leadId: 'u-lead',
  startDate: '2026-01-01',
  lastUpdated: '01 Oct 2026',
  phases: [{ id: 'ph-1', name: 'Design development', status: 'active', progress: 40, owner: 'Design' }],
  milestones: [],
  issues: [],
  updates: [],
  photos: [],
};

type Options = {
  /** The signed-in user, or null for no session. */
  session?: FakeUser | null;
  mustChangePassword?: boolean;
};

/**
 * A minimal in-memory stand-in for the API, installed as global fetch. It models
 * the cookie session (via `state.session`) rather than real cookies.
 */
export function installFakeServer(options: Options = {}) {
  const state = {
    session: options.session ?? null,
    mustChangePassword: options.mustChangePassword ?? false,
    requests: [] as { method: string; path: string; body: any; headers: Record<string, string> }[],
  };

  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  const publicUser = (u: FakeUser) => {
    const { password: _pw, ...rest } = u;
    return { ...rest, mustChangePassword: state.mustChangePassword };
  };

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input), 'http://localhost');
    const method = (init.method || 'GET').toUpperCase();
    const body = typeof init.body === 'string' ? JSON.parse(init.body) : init.body;
    state.requests.push({ method, path: url.pathname, body, headers: (init.headers || {}) as Record<string, string> });
    const route = `${method} ${url.pathname}`;

    if (route === 'POST /api/auth/login') {
      const user = Object.values(users).find((u) => u.email === body?.email && u.password === body?.password);
      if (!user) return json(401, { error: 'Invalid email or password.' });
      state.session = user;
      return json(200, { user: publicUser(user) });
    }
    if (route === 'POST /api/auth/refresh') return json(401, { error: 'Session expired' });
    if (route === 'POST /api/auth/logout') {
      state.session = null;
      return json(200, { message: 'ok' });
    }
    if (!state.session) return json(401, { error: 'Unauthorized' });

    if (route === 'GET /api/auth/me') return json(200, { user: publicUser(state.session) });
    if (route === 'POST /api/auth/change-password') {
      if (body.currentPassword !== state.session.password) return json(400, { error: 'Current password is incorrect' });
      state.session.password = body.newPassword;
      state.mustChangePassword = false;
      return json(200, { user: publicUser(state.session) });
    }
    if (state.mustChangePassword) return json(403, { error: 'Password change required', code: 'PASSWORD_CHANGE_REQUIRED' });

    if (route === 'GET /api/projects') return json(200, { projects: [sampleProject] });
    if (route === 'GET /api/notifications') return json(200, { notifications: [], unreadCount: 0 });
    if (route === 'GET /api/auth/leads') return json(200, { leads: [users.lead] });
    if (route === 'GET /api/auth/users') return json(200, { users: Object.values(users).map(publicUser) });
    if (route === 'GET /api/updates') return json(200, { updates: [] });
    if (route === 'GET /api/photos') return json(200, { photos: [] });
    return json(200, {});
  });

  vi.stubGlobal('fetch', fetchMock);
  return state;
}

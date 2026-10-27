import fs from 'node:fs';
import { test, expect, type APIRequestContext } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { E2E_USERS } from './users.mjs';

const H = { 'X-Requested-With': 'XMLHttpRequest' };
const PHOTOS = path.join(path.dirname(fileURLToPath(import.meta.url)), 'photos');
const CR = 1e7;

async function signIn(request: APIRequestContext, who: keyof typeof E2E_USERS) {
  const u = E2E_USERS[who];
  const r = await request.post('/api/auth/login', { headers: H, data: { email: u.email, password: u.password } });
  expect(r.status()).toBe(200);
}
async function post(request: APIRequestContext, path: string, data: unknown) {
  const r = await request.post(path, { headers: H, data });
  if (r.status() >= 300) throw new Error(`${path} ${r.status()} ${await r.text()}`);
  return r.json();
}

type Stage = [
  name: string,
  status: string,
  progress: number,
  owner: string,
  start: string,
  finish: string,
  extra?: Record<string, unknown>,
];
const stages = (list: Stage[], weights?: number[]) =>
  list.map(([name, status, progress, owner, plannedStart, plannedFinish, extra], i) => ({
    name,
    status,
    progress,
    owner,
    plannedStart,
    plannedFinish,
    ...(weights ? { weight: weights[i] } : {}),
    ...(extra ?? {}),
  }));

const projects = [
  {
    id: 'del-t3-intl-lounge',
    name: 'Delhi T3 International Lounge',
    code: 'DEL-T3-LNG',
    location: 'Delhi',
    category: 'Lounge',
    status: 'Under Construction',
    health: 'At risk',
    leadId: 'u-rahul',
    startDate: '2026-03-01',
    targetDate: '2027-02-28',
    aop: 48 * CR,
    awarded: 36 * CR,
    spent: 21.4 * CR,
    projectedCost: 50.5 * CR,
    area: '2,450 SQ.M.',
    paxKeys: '420 Pax',
    nextMilestone: 'MEP tender award',
    nextMilestoneDate: '2026-11-15',
    phases: stages(
      [
        ['Brief & scope', 'complete', 100, 'PMO', '2026-03-01', '2026-04-15'],
        ['Design development', 'complete', 100, 'Design', '2026-04-16', '2026-07-31'],
        [
          'Procurement',
          'active',
          80,
          'Sourcing',
          '2026-07-01',
          '2026-11-30',
          {
            workCompleted: 'Furniture and lighting orders placed; stone samples approved.',
            nextAction: 'Award MEP package after commercial negotiation.',
            decisionRequired: 'Approve 4% premium for imported stone to hold the February opening.',
          },
        ],
        [
          'Execution',
          'active',
          45,
          'Projects',
          '2026-08-15',
          '2027-01-31',
          {
            workCompleted: 'False ceiling framing done in Zone A and B; MEP first fix 60%.',
            nextAction: 'Start flooring in the entry lobby next week.',
          },
        ],
        ['Handover', 'upcoming', 0, 'Operations', '2027-02-01', '2027-02-28'],
      ],
      [10, 25, 20, 35, 10],
    ),
  },
  {
    id: 'hyd-airport-hotel',
    name: 'Hyderabad Airport Hotel',
    code: 'HYD-HTL',
    location: 'Hyderabad',
    category: 'Hotel',
    status: 'In Design',
    health: 'On track',
    leadId: 'u-rahul',
    startDate: '2026-06-01',
    targetDate: '2028-03-31',
    aop: 220 * CR,
    awarded: 18 * CR,
    spent: 6.2 * CR,
    projectedCost: 220 * CR,
    area: '14,970 SQ.M.',
    paxKeys: '156 Keys',
    nextMilestone: 'Concept design sign-off',
    nextMilestoneDate: '2026-12-10',
    phases: stages([
      ['Brief & scope', 'complete', 100, 'PMO', '2026-06-01', '2026-07-15'],
      ['Design development', 'active', 40, 'Design', '2026-07-16', '2027-01-31'],
      ['Procurement', 'upcoming', 0, 'Sourcing', '2027-01-01', '2027-06-30'],
      ['Execution', 'upcoming', 0, 'Projects', '2027-05-01', '2028-02-15'],
      ['Handover', 'upcoming', 0, 'Operations', '2028-02-16', '2028-03-31'],
    ]),
  },
  {
    id: 'goa-central-kitchen',
    name: 'Goa Central Kitchen',
    code: 'GOA-CK',
    location: 'Goa',
    category: 'Kitchen',
    status: 'In Tendering',
    health: 'On track',
    leadId: 'u-vikram',
    startDate: '2026-05-01',
    targetDate: '2027-04-30',
    aop: 14 * CR,
    awarded: 3.5 * CR,
    spent: 1.1 * CR,
    projectedCost: 13.6 * CR,
    area: '1,100 SQ.M.',
    paxKeys: '6,000 meals/day',
    nextMilestone: 'Kitchen equipment tender',
    nextMilestoneDate: '2026-11-30',
    phases: stages([
      ['Brief & scope', 'complete', 100, 'PMO', '2026-05-01', '2026-05-31'],
      ['Design development', 'complete', 100, 'Design', '2026-06-01', '2026-08-31'],
      ['Procurement', 'active', 35, 'Sourcing', '2026-09-01', '2026-12-31'],
      ['Execution', 'upcoming', 0, 'Projects', '2027-01-01', '2027-03-31'],
      ['Handover', 'upcoming', 0, 'Operations', '2027-04-01', '2027-04-30'],
    ]),
  },
  {
    id: 'bgp-encalm-eats',
    name: 'Bhogapuram Encalm Eats',
    code: 'BGP-EATS',
    location: 'Bhogapuram',
    category: 'Encalm Eats',
    status: 'Yet to start',
    health: 'Not started',
    leadId: 'u-rahul',
    startDate: '2026-12-01',
    targetDate: '2027-09-30',
    aop: 6.5 * CR,
    awarded: 0,
    spent: 0,
    projectedCost: 6.5 * CR,
    area: '380 SQ.M.',
    paxKeys: '90 Pax',
    nextMilestone: 'Brief sign-off',
    nextMilestoneDate: '2026-12-20',
    phases: stages([
      ['Brief & scope', 'upcoming', 0, 'PMO', '2026-12-01', '2026-12-31'],
      ['Design development', 'upcoming', 0, 'Design', '2027-01-01', '2027-03-31'],
      ['Procurement', 'upcoming', 0, 'Sourcing', '2027-03-01', '2027-05-31'],
      ['Execution', 'upcoming', 0, 'Projects', '2027-06-01', '2027-08-31'],
      ['Handover', 'upcoming', 0, 'Operations', '2027-09-01', '2027-09-30'],
    ]),
  },
  {
    id: 'vizag-spa-lounge',
    name: 'Vizag Spa & Lounge',
    code: 'VTZ-SPA',
    location: 'Vizag',
    category: 'Lounge',
    status: 'Operational',
    health: 'On track',
    leadId: 'u-vikram',
    startDate: '2025-08-01',
    targetDate: '2026-08-31',
    aop: 9 * CR,
    awarded: 8.6 * CR,
    spent: 8.5 * CR,
    projectedCost: 8.8 * CR,
    area: '640 SQ.M.',
    paxKeys: '120 Pax',
    phases: stages([
      ['Brief & scope', 'complete', 100, 'PMO', '2025-08-01', '2025-08-31'],
      ['Design development', 'complete', 100, 'Design', '2025-09-01', '2025-11-30'],
      ['Procurement', 'complete', 100, 'Sourcing', '2025-11-01', '2026-02-28'],
      ['Execution', 'complete', 100, 'Projects', '2026-02-01', '2026-07-31'],
      ['Handover', 'complete', 100, 'Operations', '2026-08-01', '2026-08-31'],
    ]),
  },
  {
    id: 'del-t1-dom-lounge',
    name: 'Delhi T1 Domestic Lounge',
    code: 'DEL-T1-LNG',
    location: 'Delhi',
    category: 'Lounge',
    status: 'On Hold',
    health: 'Delayed',
    leadId: 'u-vikram',
    startDate: '2026-01-15',
    targetDate: '2026-12-31',
    aop: 22 * CR,
    awarded: 15 * CR,
    spent: 9.8 * CR,
    projectedCost: 24.5 * CR,
    area: '1,350 SQ.M.',
    paxKeys: '260 Pax',
    nextMilestone: 'Airport authority approval',
    nextMilestoneDate: '2026-10-10',
    phases: stages([
      ['Brief & scope', 'complete', 100, 'PMO', '2026-01-15', '2026-02-15'],
      ['Design development', 'complete', 100, 'Design', '2026-02-16', '2026-05-15'],
      ['Procurement', 'complete', 100, 'Sourcing', '2026-04-01', '2026-07-31'],
      [
        'Execution',
        'blocked',
        55,
        'Projects',
        '2026-07-01',
        '2026-11-30',
        { decisionRequired: 'Airport authority clearance for the revised airside entry.' },
      ],
      ['Handover', 'upcoming', 0, 'Operations', '2026-12-01', '2026-12-31'],
    ]),
  },
];

test('seed sample portfolio for the video', async ({ playwright }) => {
  test.setTimeout(120_000);
  const coord = await playwright.request.newContext({ baseURL: 'http://localhost:5073' });
  await signIn(coord, 'coordinator');
  for (const p of projects) {
    await post(coord, '/api/projects', { ...p, progress: 0, milestones: [], issues: [], updates: [], photos: [] });
  }
  const lead = await playwright.request.newContext({ baseURL: 'http://localhost:5073' });
  await signIn(lead, 'lead');
  const T3 = '/api/projects/del-t3-intl-lounge';

  // Milestones
  await post(lead, `${T3}/milestones`, {
    title: 'Design freeze',
    date: '2026-07-31',
    status: 'complete',
    stage: 'Design development',
    owner: 'Design',
    completedDate: '2026-07-30',
  });
  await post(lead, `${T3}/milestones`, {
    title: 'MEP tender award',
    date: '2026-11-15',
    status: 'upcoming',
    stage: 'Procurement',
    owner: 'Sourcing',
    approvalRequired: true,
    approvalStatus: 'Pending',
  });
  await post(lead, `${T3}/milestones`, {
    title: 'Soft opening',
    date: '2027-02-20',
    status: 'upcoming',
    stage: 'Handover',
    owner: 'Operations',
  });
  await post(lead, '/api/projects/hyd-airport-hotel/milestones', {
    title: 'Concept design sign-off',
    date: '2026-12-10',
    status: 'upcoming',
    stage: 'Design development',
    owner: 'Design',
    approvalRequired: true,
    approvalStatus: 'Pending',
  });

  // Issues
  await post(lead, `${T3}/issues`, {
    title: 'Chiller delivery delayed by 3 weeks',
    detail:
      'Vendor has pushed dispatch of the two 120 TR chillers; HVAC commissioning slips unless air freight is approved.',
    severity: 'High',
    status: 'Action in progress',
    category: 'Procurement',
    stage: 'Procurement',
    owner: 'Rahul Mehta',
    issueAriseDate: '2026-10-05',
    targetClosureDate: '2026-11-05',
    impactSchedule: '3 weeks on HVAC commissioning',
    impactCost: '₹18 L air freight',
    action: 'Negotiating split shipment; air freight quote requested.',
  });
  await post(lead, `${T3}/issues`, {
    title: 'Fire NOC inspection pending',
    detail: 'Fire department inspection slot not yet confirmed for the lounge mezzanine.',
    severity: 'Medium',
    status: 'Under review',
    category: 'Approval',
    stage: 'Execution',
    owner: 'Suresh Nair',
    issueAriseDate: '2026-10-12',
    targetClosureDate: '2026-11-20',
    action: 'Follow up with the airport fire officer.',
  });

  // Updates
  for (const [kind, stage, text] of [
    ['Progress', 'Execution', 'False ceiling framing complete in Zones A and B. MEP first fix at 60%.'],
    [
      'Decision',
      'Procurement',
      'Shortlisted two stone suppliers; recommendation shared with @Anita Desai for approval.',
    ],
    ['Risk', 'Procurement', 'Chiller dispatch slipping; exploring split shipment to protect the commissioning date.'],
  ] as const) {
    await post(lead, `${T3}/updates`, { kind, stage, text });
  }

  // Photos
  const files = ['ceiling', 'mep', 'flooring', 'facade'];
  const captions = [
    'False ceiling framing - Zone B',
    'MEP first fix - seating area',
    'Stone flooring - entry lobby',
    'Glazing - airside facade',
  ];
  for (let i = 0; i < files.length; i++) {
    const r = await lead.post(`${T3}/photos`, {
      headers: H,
      multipart: {
        photos: {
          name: `${files[i]}.jpg`,
          mimeType: 'image/jpeg',
          buffer: fs.readFileSync(`${PHOTOS}/${files[i]}.jpg`),
        },
        meta: JSON.stringify([
          { caption: captions[i], stage: 'Execution', category: 'Progress', takenDate: `2026-10-${10 + i * 3}` },
        ]),
      },
    });
    expect(r.status(), await r.text()).toBeLessThan(300);
  }
});

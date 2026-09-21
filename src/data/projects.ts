import { formatDayMonth } from '@/lib/date';

export type Location = 'Delhi' | 'Hyderabad' | 'Goa' | 'Bhogapuram';
export type Category = 'Hotel' | 'Lounge' | 'Kitchen' | 'Encalm Eats' | 'Other';
export type Health = 'On track' | 'At risk' | 'Delayed' | 'Not started';
export type StageStatus = 'complete' | 'active' | 'upcoming' | 'blocked';
export type IssueCategory = 'Design' | 'Approval' | 'Procurement' | 'Vendor' | 'Site' | 'Commercial' | 'Operations' | 'Safety' | 'Quality' | 'Other';
export type IssueStatus = 'Open' | 'Under review' | 'Action in progress' | 'Resolved' | 'Closed';
export type ProjectTemplateId = 'lounge' | 'hotel' | 'kitchen' | 'encalm-eats' | 'custom';

export type Phase = {
  id?: string;
  name: string;
  status: StageStatus;
  progress: number;
  owner: string;
  plannedStart?: string;
  plannedFinish?: string;
  actualFinish?: string;
  workCompleted?: string;
  nextAction?: string;
  decisionRequired?: string;
  updatedAt?: string;
};

export type Milestone = {
  title: string;
  date: string;
  status: 'complete' | 'upcoming' | 'late';
  stage?: string;
  owner?: string;
  approvalRequired?: boolean;
  approvalStatus?: 'Not required' | 'Pending' | 'Approved' | 'Rejected';
  completedDate?: string;
};

export type ProjectIssue = {
  id?: string;
  title: string;
  detail: string;
  severity: 'High' | 'Medium' | 'Low';
  owner: string;
  category?: IssueCategory;
  status?: IssueStatus;
  stage?: string;
  dateRaised?: string;
  dueDate?: string;
  impactCost?: string;
  impactSchedule?: string;
  impactScope?: string;
  action?: string;
  resolution?: string;
};

export type ProjectUpdate = {
  date: string;
  author: string;
  role: string;
  text: string;
  stage?: string;
  kind?: 'Progress' | 'Decision' | 'Risk' | 'General';
};

export type ProjectSpecification = {
  projectType: string;
  area: string;
  capacity: string;
  units: string;
  terminal: string;
  floor: string;
  scope: string;
  customFields?: { label: string; value: string }[];
};

export type Project = {
  id: string;
  name: string;
  location: Location;
  category: Category;
  code: string;
  health: Health;
  progress: number;
  targetDate: string;
  targetLabel: string;
  aop: number;
  awarded: number;
  spent: number;
  nextMilestone: string;
  nextMilestoneDate: string;
  lead: string;
  phases: Phase[];
  milestones: Milestone[];
  issues: ProjectIssue[];
  updates: ProjectUpdate[];
  startDate?: string;
  lastUpdated?: string;
  plannedProgress?: number;
  specification?: ProjectSpecification;
  templateId?: ProjectTemplateId;
};

export type ProjectTemplate = {
  id: ProjectTemplateId;
  label: string;
  description: string;
  fields: string[];
  stages: { name: string; owner: string }[];
};

export const projectTemplates: ProjectTemplate[] = [
  {
    id: 'lounge',
    label: 'Airport lounge',
    description: 'Airport coordination, guest journey, MEP, fit-out, and operational readiness.',
    fields: ['Terminal / airport', 'Seating capacity', 'Operating hours', 'Passenger flow', 'MEP / airport approvals'],
    stages: [
      { name: 'Brief & operational requirements', owner: 'PMO' },
      { name: 'Concept & guest journey', owner: 'Design' },
      { name: 'MEP & airport coordination', owner: 'Projects' },
      { name: 'Procurement & vendor award', owner: 'Sourcing' },
      { name: 'Build & installation', owner: 'Projects' },
      { name: 'Operational readiness', owner: 'Operations' },
      { name: 'Soft opening & handover', owner: 'Operations' },
    ],
  },
  {
    id: 'hotel',
    label: 'Hotel',
    description: 'Feasibility, approvals, room delivery, F&B, and opening readiness.',
    fields: ['Number of keys', 'Room types', 'F&B outlets', 'Operator requirements', 'Opening readiness requirements'],
    stages: [
      { name: 'Feasibility & brief', owner: 'PMO' },
      { name: 'Design development', owner: 'Design' },
      { name: 'Approvals & statutory clearances', owner: 'Projects' },
      { name: 'Procurement & contracts', owner: 'Sourcing' },
      { name: 'Civil & interior construction', owner: 'Projects' },
      { name: 'Rooms, F&B & back-of-house setup', owner: 'Operations' },
      { name: 'Opening & handover', owner: 'Operations' },
    ],
  },
  {
    id: 'kitchen',
    label: 'Kitchen',
    description: 'Capacity, equipment, utilities, installation, testing, and food-safety sign-off.',
    fields: ['Cuisine / service type', 'Daily meal capacity', 'Equipment package', 'Exhaust requirement', 'Utility load'],
    stages: [
      { name: 'Menu & capacity planning', owner: 'Operations' },
      { name: 'Kitchen design & equipment specification', owner: 'Design' },
      { name: 'Utility, exhaust & hygiene approvals', owner: 'Projects' },
      { name: 'Equipment procurement', owner: 'Sourcing' },
      { name: 'Installation & integration', owner: 'Projects' },
      { name: 'Testing & commissioning', owner: 'Projects' },
      { name: 'Food-safety sign-off & handover', owner: 'Operations' },
    ],
  },
  {
    id: 'encalm-eats',
    label: 'Encalm Eats',
    description: 'Food concept, menu, supply chain, service setup, and launch readiness.',
    fields: ['Concept / cuisine', 'Service model', 'Daily covers', 'Menu owner', 'Launch dependencies'],
    stages: [
      { name: 'Concept & commercial brief', owner: 'PMO' },
      { name: 'Menu & guest experience', owner: 'Operations' },
      { name: 'Kitchen and service design', owner: 'Design' },
      { name: 'Supplier & procurement setup', owner: 'Sourcing' },
      { name: 'Fit-out & equipment installation', owner: 'Projects' },
      { name: 'Trial service & team readiness', owner: 'Operations' },
      { name: 'Launch & handover', owner: 'Operations' },
    ],
  },
  {
    id: 'custom',
    label: 'Custom project',
    description: 'Start with a flexible control plan and tailor the stages to the project.',
    fields: ['Primary success measure', 'Key stakeholders', 'Special approvals', 'Critical dependencies'],
    stages: [
      { name: 'Brief & scope', owner: 'PMO' },
      { name: 'Design / planning', owner: 'Design' },
      { name: 'Procurement / setup', owner: 'Sourcing' },
      { name: 'Delivery / installation', owner: 'Projects' },
      { name: 'Readiness & handover', owner: 'Operations' },
    ],
  },
];

export function getProjectTemplate(id?: ProjectTemplateId | string, category?: Category) {
  if (id) {
    const byId = projectTemplates.find((template) => template.id === id);
    if (byId) return byId;
  }
  if (category === 'Lounge') return projectTemplates[0];
  if (category === 'Hotel') return projectTemplates[1];
  if (category === 'Kitchen') return projectTemplates[2];
  if (category === 'Encalm Eats') return projectTemplates[3];
  return projectTemplates[4];
}

const phases = (active: number, activeName: string, owner: string): Phase[] => [
  { name: 'Brief & scope', status: 'complete', progress: 100, owner: 'PMO' },
  { name: 'Design development', status: active === 2 ? 'active' : active > 2 ? 'complete' : 'upcoming', progress: active === 2 ? 68 : active > 2 ? 100 : 0, owner },
  { name: 'Procurement', status: active === 3 ? 'active' : active > 3 ? 'complete' : 'upcoming', progress: active === 3 ? 42 : active > 3 ? 100 : 0, owner: 'Sourcing' },
  { name: 'Build & install', status: active === 4 ? 'active' : active > 4 ? 'complete' : 'upcoming', progress: active === 4 ? 24 : active > 4 ? 100 : 0, owner: 'Projects' },
  { name: ['Brief & scope', 'Design development', 'Procurement', 'Build & install'].includes(activeName) ? 'Operational readiness' : activeName, status: active >= 5 ? 'active' : 'upcoming', progress: active >= 5 ? 12 : 0, owner: 'Operations' },
];

export const projects: Project[] = [
  {
    id: 'delhi-terminal-3',
    name: 'Encalm Lounge · T3',
    location: 'Delhi',
    category: 'Lounge',
    code: 'DEL-T3-24',
    health: 'At risk',
    progress: 72,
    targetDate: '2025-10-18',
    targetLabel: '18 Oct 2025',
    aop: 118000000,
    awarded: 85600000,
    spent: 49200000,
    nextMilestone: 'MEP coordination sign-off',
    nextMilestoneDate: '2025-08-29',
    lead: 'Anika Sethi',
    phases: phases(4, 'Operational readiness', 'Design'),
    milestones: [
      { title: 'Concept freeze', date: '2025-03-14', status: 'complete' },
      { title: 'MEP coordination sign-off', date: '2025-08-29', status: 'late' },
      { title: 'Soft opening', date: '2025-10-18', status: 'upcoming' },
    ],
    issues: [
      { title: 'Kitchen exhaust route unresolved', detail: 'Airport stakeholder review moved to 28 Aug; impacts ceiling close in zone B.', severity: 'High', owner: 'R. Mehta' },
      { title: 'Imported stone shipment', detail: 'One container is held at Nhava Sheva. Alternate batch being evaluated.', severity: 'Medium', owner: 'Sourcing' },
    ],
    updates: [
      { date: '21 Aug', author: 'Anika Sethi', role: 'Project Head', text: 'Design team has issued the revised guest journey and service spine for final airport review.' },
      { date: '18 Aug', author: 'R. Mehta', role: 'Site Lead', text: 'Ceiling framing is 80% complete across the lounge; back-of-house remains on hold.' },
      { date: '13 Aug', author: 'Nandita Rao', role: 'Commercial', text: 'Value engineering has protected the AOP by ₹3.1M without affecting guest-facing finishes.' },
    ],
  },
  {
    id: 'hyderabad-rajiv-gandhi',
    name: 'Encalm Lounge · RGIA',
    location: 'Hyderabad',
    category: 'Lounge',
    code: 'HYD-RGIA-25',
    health: 'On track',
    progress: 58,
    targetDate: '2025-12-06',
    targetLabel: '06 Dec 2025',
    aop: 94000000,
    awarded: 63800000,
    spent: 27100000,
    nextMilestone: 'Joinery package award',
    nextMilestoneDate: '2025-09-12',
    lead: 'Vikram Iyer',
    phases: phases(3, 'Build & install', 'Design'),
    milestones: [
      { title: 'Brief sign-off', date: '2025-05-06', status: 'complete' },
      { title: 'Joinery package award', date: '2025-09-12', status: 'upcoming' },
      { title: 'Guest readiness review', date: '2025-11-21', status: 'upcoming' },
    ],
    issues: [{ title: 'Late access window', detail: 'Night access is constrained for two weeks; sequencing has been rebalanced.', severity: 'Low', owner: 'Airport Ops' }],
    updates: [
      { date: '22 Aug', author: 'Vikram Iyer', role: 'Project Head', text: 'Tender clarifications are closed. Joinery bidders return final numbers next week.' },
      { date: '19 Aug', author: 'Latha Kumar', role: 'Design Lead', text: 'The Hyderabad craft palette is now locked: sand, oxidised brass and indigo accents.' },
    ],
  },
  {
    id: 'goa-dabolim-arrivals',
    name: 'Encalm Lounge · Dabolim',
    location: 'Goa',
    category: 'Lounge',
    code: 'GOI-ARR-25',
    health: 'On track',
    progress: 44,
    targetDate: '2026-02-14',
    targetLabel: '14 Feb 2026',
    aop: 72000000,
    awarded: 31000000,
    spent: 12400000,
    nextMilestone: 'Schematic design review',
    nextMilestoneDate: '2025-09-05',
    lead: 'Meera Nair',
    phases: phases(2, 'Design development', 'Studio North'),
    milestones: [
      { title: 'Brief sign-off', date: '2025-06-18', status: 'complete' },
      { title: 'Schematic design review', date: '2025-09-05', status: 'upcoming' },
      { title: 'Site handover', date: '2025-12-05', status: 'upcoming' },
    ],
    issues: [],
    updates: [{ date: '20 Aug', author: 'Meera Nair', role: 'Project Head', text: 'Two guest flow options are ready for the steering review; both preserve the coastal outlook.' }],
  },
  {
    id: 'bhogapuram-main-terminal',
    name: 'Encalm Terminal Club · Bhogapuram',
    location: 'Bhogapuram',
    category: 'Hotel',
    code: 'BHO-TC-26',
    health: 'On track',
    progress: 31,
    targetDate: '2026-08-22',
    targetLabel: '22 Aug 2026',
    aop: 185000000,
    awarded: 42000000,
    spent: 8600000,
    nextMilestone: 'Operator brief complete',
    nextMilestoneDate: '2025-09-18',
    lead: 'Arjun Menon',
    phases: phases(2, 'Design development', 'Studio East'),
    milestones: [
      { title: 'Land parcel confirmed', date: '2025-07-04', status: 'complete' },
      { title: 'Operator brief complete', date: '2025-09-18', status: 'upcoming' },
      { title: 'Design freeze', date: '2025-11-28', status: 'upcoming' },
    ],
    issues: [{ title: 'Utility survey pending', detail: 'Final electrical load confirmation awaited from airport development authority.', severity: 'Medium', owner: 'PMO' }],
    updates: [{ date: '16 Aug', author: 'Arjun Menon', role: 'Project Head', text: 'The terminal club is moving into design with a clear 24-hour operating model.' }],
  },
  {
    id: 'delhi-aero-city-kitchen',
    name: 'Production Kitchen · Aerocity',
    location: 'Delhi',
    category: 'Kitchen',
    code: 'DEL-AER-K-25',
    health: 'Delayed',
    progress: 83,
    targetDate: '2025-09-30',
    targetLabel: '30 Sep 2025',
    aop: 56000000,
    awarded: 52400000,
    spent: 46800000,
    nextMilestone: 'Food safety commissioning',
    nextMilestoneDate: '2025-09-03',
    lead: 'Kabir Bahl',
    phases: phases(4, 'Operational readiness', 'Projects'),
    milestones: [
      { title: 'Equipment award', date: '2025-04-22', status: 'complete' },
      { title: 'Food safety commissioning', date: '2025-09-03', status: 'upcoming' },
      { title: 'Handover', date: '2025-09-30', status: 'upcoming' },
    ],
    issues: [{ title: 'Blast chiller commissioning', detail: 'Vendor engineer is arriving 4 days later than the approved sequence.', severity: 'High', owner: 'Facilities' }],
    updates: [{ date: '22 Aug', author: 'Kabir Bahl', role: 'Project Head', text: 'A recovery sequence is agreed with the operator; first production trials remain protected.' }],
  },
  {
    id: 'hyderabad-cargo-lounge',
    name: 'Cargo Crew Lounge · HYD',
    location: 'Hyderabad',
    category: 'Other',
    code: 'HYD-CGO-25',
    health: 'On track',
    progress: 67,
    targetDate: '2025-11-08',
    targetLabel: '08 Nov 2025',
    aop: 38000000,
    awarded: 27700000,
    spent: 14400000,
    nextMilestone: 'Furniture mock-up',
    nextMilestoneDate: '2025-09-01',
    lead: 'Vikram Iyer',
    phases: phases(3, 'Build & install', 'Projects'),
    milestones: [
      { title: 'Scope freeze', date: '2025-05-19', status: 'complete' },
      { title: 'Furniture mock-up', date: '2025-09-01', status: 'upcoming' },
      { title: 'Handover', date: '2025-11-08', status: 'upcoming' },
    ],
    issues: [],
    updates: [{ date: '21 Aug', author: 'Vikram Iyer', role: 'Project Head', text: 'The first furniture sample reads well in the daylight study. Site works are steady.' }],
  },
  {
    id: 'goa-mopa-lounge',
    name: 'Encalm Lounge · Mopa',
    location: 'Goa',
    category: 'Lounge',
    code: 'GOI-MOP-25',
    health: 'At risk',
    progress: 49,
    targetDate: '2025-12-19',
    targetLabel: '19 Dec 2025',
    aop: 88000000,
    awarded: 55100000,
    spent: 20800000,
    nextMilestone: 'Stone sample approval',
    nextMilestoneDate: '2025-08-30',
    lead: 'Meera Nair',
    phases: phases(3, 'Build & install', 'Sourcing'),
    milestones: [
      { title: 'Design freeze', date: '2025-04-11', status: 'complete' },
      { title: 'Stone sample approval', date: '2025-08-30', status: 'late' },
      { title: 'Practical completion', date: '2025-12-19', status: 'upcoming' },
    ],
    issues: [{ title: 'Local stone variance', detail: 'Approved quarry cannot meet the full volume in the current batch.', severity: 'Medium', owner: 'Design' }],
    updates: [{ date: '20 Aug', author: 'Meera Nair', role: 'Project Head', text: 'A local alternative has cleared the visual review; commercial comparison is due tomorrow.' }],
  },
  {
    id: 'delhi-t3-retail',
    name: 'Encalm Eats · T3 Retail',
    location: 'Delhi',
    category: 'Encalm Eats',
    code: 'DEL-T3-E-25',
    health: 'On track',
    progress: 63,
    targetDate: '2025-10-04',
    targetLabel: '04 Oct 2025',
    aop: 47000000,
    awarded: 38800000,
    spent: 24900000,
    nextMilestone: 'Menu engineering sign-off',
    nextMilestoneDate: '2025-09-04',
    lead: 'Anika Sethi',
    phases: phases(4, 'Operational readiness', 'Culinary'),
    milestones: [
      { title: 'Brand direction', date: '2025-03-27', status: 'complete' },
      { title: 'Menu engineering sign-off', date: '2025-09-04', status: 'upcoming' },
      { title: 'Opening', date: '2025-10-04', status: 'upcoming' },
    ],
    issues: [],
    updates: [{ date: '19 Aug', author: 'Nandita Rao', role: 'Commercial', text: 'The operating model is within AOP and the first menu tasting has been booked.' }],
  },
  {
    id: 'bhogapuram-arrivals',
    name: 'Arrivals Lounge · Bhogapuram',
    location: 'Bhogapuram',
    category: 'Lounge',
    code: 'BHO-ARR-26',
    health: 'On track',
    progress: 18,
    targetDate: '2026-11-13',
    targetLabel: '13 Nov 2026',
    aop: 98000000,
    awarded: 14800000,
    spent: 3200000,
    nextMilestone: 'Concept presentation',
    nextMilestoneDate: '2025-09-26',
    lead: 'Arjun Menon',
    phases: phases(2, 'Design development', 'Studio East'),
    milestones: [
      { title: 'Kick-off', date: '2025-08-01', status: 'complete' },
      { title: 'Concept presentation', date: '2025-09-26', status: 'upcoming' },
      { title: 'Design freeze', date: '2026-01-16', status: 'upcoming' },
    ],
    issues: [],
    updates: [{ date: '18 Aug', author: 'Arjun Menon', role: 'Project Head', text: 'The arrival sequence is being designed as a calm threshold between runway and city.' }],
  },
  {
    id: 'hyderabad-t2-kitchen',
    name: 'Hot Kitchen Refresh · HYD T2',
    location: 'Hyderabad',
    category: 'Kitchen',
    code: 'HYD-T2-K-25',
    health: 'At risk',
    progress: 76,
    targetDate: '2025-10-25',
    targetLabel: '25 Oct 2025',
    aop: 61000000,
    awarded: 59300000,
    spent: 42100000,
    nextMilestone: 'Gas train inspection',
    nextMilestoneDate: '2025-08-27',
    lead: 'Latha Kumar',
    phases: phases(4, 'Operational readiness', 'Facilities'),
    milestones: [
      { title: 'Equipment survey', date: '2025-02-12', status: 'complete' },
      { title: 'Gas train inspection', date: '2025-08-27', status: 'upcoming' },
      { title: 'Trial production', date: '2025-10-10', status: 'upcoming' },
    ],
    issues: [{ title: 'Night shutdown approval', detail: 'Operations has shortened the agreed shutdown window by one shift.', severity: 'Medium', owner: 'Operations' }],
    updates: [{ date: '22 Aug', author: 'Latha Kumar', role: 'Project Head', text: 'The team has compressed the live-work sequence to keep the kitchen opening date intact.' }],
  },
  {
    id: 'goa-mopa-eats',
    name: 'Encalm Eats · Mopa',
    location: 'Goa',
    category: 'Encalm Eats',
    code: 'GOI-MOP-E-25',
    health: 'On track',
    progress: 37,
    targetDate: '2026-01-16',
    targetLabel: '16 Jan 2026',
    aop: 53000000,
    awarded: 19600000,
    spent: 6900000,
    nextMilestone: 'Kitchen planning freeze',
    nextMilestoneDate: '2025-09-19',
    lead: 'Meera Nair',
    phases: phases(2, 'Design development', 'Culinary'),
    milestones: [
      { title: 'Commercial brief', date: '2025-06-05', status: 'complete' },
      { title: 'Kitchen planning freeze', date: '2025-09-19', status: 'upcoming' },
      { title: 'Soft launch', date: '2026-01-16', status: 'upcoming' },
    ],
    issues: [],
    updates: [{ date: '17 Aug', author: 'Meera Nair', role: 'Project Head', text: 'The local produce story is shaping both the menu and the material direction.' }],
  },
  {
    id: 'delhi-t1-concourse',
    name: 'Concourse Club · T1',
    location: 'Delhi',
    category: 'Hotel',
    code: 'DEL-T1-C-25',
    health: 'On track',
    progress: 91,
    targetDate: '2025-09-12',
    targetLabel: '12 Sep 2025',
    aop: 76000000,
    awarded: 74200000,
    spent: 68100000,
    nextMilestone: 'Operations readiness walk',
    nextMilestoneDate: '2025-08-28',
    lead: 'Kabir Bahl',
    phases: phases(5, 'Operational readiness', 'Operations'),
    milestones: [
      { title: 'Practical completion', date: '2025-08-20', status: 'complete' },
      { title: 'Operations readiness walk', date: '2025-08-28', status: 'upcoming' },
      { title: 'Opening', date: '2025-09-12', status: 'upcoming' },
    ],
    issues: [],
    updates: [{ date: '22 Aug', author: 'Kabir Bahl', role: 'Project Head', text: 'Snagging is down to 11 items. The opening team is now rehearsing the full guest journey.' }],
  },
  {
    id: 'bhogapuram-staff-dining',
    name: 'Staff Dining & Welfare Block',
    location: 'Bhogapuram',
    category: 'Other',
    code: 'BHO-SD-26',
    health: 'On track',
    progress: 12,
    targetDate: '2026-06-18',
    targetLabel: '18 Jun 2026',
    aop: 29000000,
    awarded: 7800000,
    spent: 1100000,
    nextMilestone: 'Site logistics plan',
    nextMilestoneDate: '2025-10-02',
    lead: 'Arjun Menon',
    phases: phases(1, 'Design development', 'PMO'),
    milestones: [
      { title: 'Scope confirmed', date: '2025-08-08', status: 'complete' },
      { title: 'Site logistics plan', date: '2025-10-02', status: 'upcoming' },
      { title: 'Construction start', date: '2025-11-13', status: 'upcoming' },
    ],
    issues: [],
    updates: [{ date: '14 Aug', author: 'Arjun Menon', role: 'Project Head', text: 'The welfare block is being planned as a practical, dignified amenity for the airport workforce.' }],
  },
  {
    id: 'hyderabad-retail-hub',
    name: 'Retail Hub · RGIA',
    location: 'Hyderabad',
    category: 'Other',
    code: 'HYD-RH-25',
    health: 'On track',
    progress: 52,
    targetDate: '2025-12-12',
    targetLabel: '12 Dec 2025',
    aop: 46000000,
    awarded: 31000000,
    spent: 17600000,
    nextMilestone: 'Tenant coordination',
    nextMilestoneDate: '2025-09-08',
    lead: 'Vikram Iyer',
    phases: phases(3, 'Build & install', 'Projects'),
    milestones: [
      { title: 'Tenant mix confirmed', date: '2025-05-30', status: 'complete' },
      { title: 'Tenant coordination', date: '2025-09-08', status: 'upcoming' },
      { title: 'Handover', date: '2025-12-12', status: 'upcoming' },
    ],
    issues: [],
    updates: [{ date: '19 Aug', author: 'Vikram Iyer', role: 'Project Head', text: 'Retail fronts are coordinated with the airport wayfinding package.' }],
  },
  {
    id: 'goa-vip-arrivals',
    name: 'VIP Arrivals Suite · Goa',
    location: 'Goa',
    category: 'Hotel',
    code: 'GOI-VIP-25',
    health: 'Delayed',
    progress: 61,
    targetDate: '2025-11-01',
    targetLabel: '01 Nov 2025',
    aop: 67000000,
    awarded: 58900000,
    spent: 30100000,
    nextMilestone: 'Authority NOC',
    nextMilestoneDate: '2025-08-26',
    lead: 'Meera Nair',
    phases: phases(3, 'Build & install', 'PMO'),
    milestones: [
      { title: 'Design freeze', date: '2025-04-09', status: 'complete' },
      { title: 'Authority NOC', date: '2025-08-26', status: 'late' },
      { title: 'Opening', date: '2025-11-01', status: 'upcoming' },
    ],
    issues: [{ title: 'Fire NOC review', detail: 'Additional smoke extraction note requested by the authority.', severity: 'High', owner: 'Consultant' }],
    updates: [{ date: '21 Aug', author: 'Meera Nair', role: 'Project Head', text: 'The consultant has resubmitted the extraction note; approval is the only critical path item.' }],
  },
  {
    id: 'delhi-enclave',
    name: 'Encalm Members Enclave',
    location: 'Delhi',
    category: 'Other',
    code: 'DEL-EME-25',
    health: 'On track',
    progress: 26,
    targetDate: '2026-04-30',
    targetLabel: '30 Apr 2026',
    aop: 112000000,
    awarded: 20500000,
    spent: 5200000,
    nextMilestone: 'User group sign-off',
    nextMilestoneDate: '2025-09-25',
    lead: 'Anika Sethi',
    phases: phases(2, 'Design development', 'Design'),
    milestones: [
      { title: 'Business case', date: '2025-06-20', status: 'complete' },
      { title: 'User group sign-off', date: '2025-09-25', status: 'upcoming' },
      { title: 'Design freeze', date: '2025-12-11', status: 'upcoming' },
    ],
    issues: [],
    updates: [{ date: '15 Aug', author: 'Anika Sethi', role: 'Project Head', text: 'The enclave brief is now grounded in real member interviews from the summer peak.' }],
  },
  {
    id: 'bhogapuram-back-office',
    name: 'Back-of-house Campus',
    location: 'Bhogapuram',
    category: 'Kitchen',
    code: 'BHO-BOH-26',
    health: 'At risk',
    progress: 8,
    targetDate: '2026-10-28',
    targetLabel: '28 Oct 2026',
    aop: 74000000,
    awarded: 9800000,
    spent: 900000,
    nextMilestone: 'Capacity model approval',
    nextMilestoneDate: '2025-09-03',
    lead: 'Arjun Menon',
    phases: phases(1, 'Design development', 'Culinary'),
    milestones: [
      { title: 'Operational brief', date: '2025-07-11', status: 'complete' },
      { title: 'Capacity model approval', date: '2025-09-03', status: 'upcoming' },
      { title: 'Design freeze', date: '2025-12-04', status: 'upcoming' },
    ],
    issues: [{ title: 'Demand model needs refresh', detail: 'Passenger forecast has shifted; kitchen capacity is being revalidated.', severity: 'Medium', owner: 'Strategy' }],
    updates: [{ date: '12 Aug', author: 'Arjun Menon', role: 'Project Head', text: 'We are holding the design gate until the revised passenger model is signed.' }],
  },
  {
    id: 'goa-business-hotel',
    name: 'Goa Business Hotel',
    location: 'Goa',
    category: 'Hotel',
    code: 'GOI-BH-26',
    health: 'At risk',
    progress: 60,
    targetDate: '2026-10-31',
    targetLabel: '31 Oct 2026',
    aop: 195000000,
    awarded: 113560000,
    spent: 62000000,
    nextMilestone: 'Package award',
    nextMilestoneDate: '2026-09-24',
    lead: 'Arjun Mehta',
    startDate: '2026-01-01',
    lastUpdated: '18 Sep 2026',
    plannedProgress: 68,
    specification: { projectType: 'Business hotel', area: '247,224 sqft', capacity: '420 guests', units: '186 keys', terminal: 'Dabolim', floor: 'Ground + 4', scope: 'Guest rooms, lobby, all-day dining and back-of-house services.' },
    phases: phases(4, 'Fit-out', 'Projects'),
    milestones: [
      { title: 'Design approval', date: '2026-03-18', status: 'complete' },
      { title: 'Package award', date: '2026-09-24', status: 'upcoming' },
      { title: 'Handover', date: '2026-10-31', status: 'upcoming' },
    ],
    issues: [{ title: 'Package finalisation', detail: 'The MEP package is awaiting final commercial alignment before award.', severity: 'Medium', owner: 'Procurement' }],
    updates: [{ date: '18 Sep 2026', author: 'Arjun Mehta', role: 'Project Lead', text: 'Construction is progressing. Procurement packages remain the primary area requiring attention.' }],
  },
  {
    id: 'vizag-inflight-kitchen',
    name: 'In-flight Kitchen · Vizag',
    location: 'Bhogapuram',
    category: 'Kitchen',
    code: 'BHO-IFK-26',
    health: 'On track',
    progress: 96,
    targetDate: '2026-10-03',
    targetLabel: '03 Oct 2026',
    aop: 84000000,
    awarded: 72800000,
    spent: 65500000,
    nextMilestone: 'Handover',
    nextMilestoneDate: '2026-10-03',
    lead: 'Arjun Mehta',
    startDate: '2026-02-02',
    lastUpdated: '17 Sep 2026',
    plannedProgress: 94,
    specification: { projectType: 'In-flight production kitchen', area: '64,000 sqft', capacity: '18,000 meals/day', units: '4 production zones', terminal: 'Bhogapuram', floor: 'Level 1', scope: 'Production, blast chill, dispatch and airline loading operations.' },
    phases: phases(5, 'Handover', 'Operations'),
    milestones: [
      { title: 'Equipment commissioning', date: '2026-08-18', status: 'complete' },
      { title: 'Handover', date: '2026-10-03', status: 'upcoming' },
    ],
    issues: [],
    updates: [{ date: '17 Sep 2026', author: 'Arjun Mehta', role: 'Project Lead', text: 'Final commissioning checks are underway and the opening handover pack is being compiled.' }],
  },
  {
    id: 'delhi-inflight-kitchen',
    name: 'In-flight Kitchen · Delhi',
    location: 'Delhi',
    category: 'Kitchen',
    code: 'DEL-IFK-26',
    health: 'Delayed',
    progress: 20,
    targetDate: '2026-12-18',
    targetLabel: '18 Dec 2026',
    aop: 91000000,
    awarded: 18000000,
    spent: 8400000,
    nextMilestone: 'Procurement release',
    nextMilestoneDate: '2026-09-25',
    lead: 'Arjun Mehta',
    startDate: '2026-04-12',
    lastUpdated: '16 Sep 2026',
    plannedProgress: 32,
    specification: { projectType: 'In-flight production kitchen', area: '52,000 sqft', capacity: '12,000 meals/day', units: '3 production zones', terminal: 'Delhi T3', floor: 'Service level', scope: 'Cook-chill, assembly, dispatch and airline loading operations.' },
    phases: phases(3, 'Procurement', 'Sourcing'),
    milestones: [
      { title: 'Design freeze', date: '2026-06-21', status: 'complete' },
      { title: 'Procurement release', date: '2026-09-25', status: 'late' },
      { title: 'Handover', date: '2026-12-18', status: 'upcoming' },
    ],
    issues: [{ title: 'Procurement delay', detail: 'Long-lead cold-chain equipment is not yet released; construction start is at risk.', severity: 'High', owner: 'Arjun Mehta' }],
    updates: [{ date: '16 Sep 2026', author: 'Arjun Mehta', role: 'Project Lead', text: 'Vendor clarifications are closed. The procurement release needs an accelerated approval this week.' }],
  },
];

export const locations: Location[] = ['Delhi', 'Hyderabad', 'Goa', 'Bhogapuram'];
export const categories: Category[] = ['Hotel', 'Lounge', 'Kitchen', 'Encalm Eats', 'Other'];
export const healthOptions: Health[] = ['On track', 'At risk', 'Delayed', 'Not started'];

/** One crore = 10,000,000. Non-finite input renders as `—` rather than `₹NaN Cr`. */
export const CRORE = 10000000;

export const formatCrore = (value: number) =>
  Number.isFinite(value) ? `₹${(value / CRORE).toFixed(1)} Cr` : '₹—';

/** Safe re-export so call sites keep working; see `@/lib/date`. */
export const formatShortDate = formatDayMonth;
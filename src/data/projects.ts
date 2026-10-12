import { formatDayMonth } from '@/lib/date';

export type Location = 'Delhi' | 'Hyderabad' | 'Goa' | 'Bhogapuram' | 'Vizag';
export type Category = 'Hotel' | 'Lounge' | 'Kitchen' | 'Encalm Eats' | 'Other';
export type Health = 'On track' | 'At risk' | 'Delayed' | 'Not started';
export type ProjectStatus =
  'Yet to start' | 'In Design' | 'In Tendering' | 'Under Construction' | 'Operational' | 'On Hold';
export type StageStatus = 'complete' | 'active' | 'upcoming' | 'blocked';
export type IssueCategory = 'Design' | 'Procurement' | 'Billing' | 'Construction' | 'Approval' | 'Other';
export type IssueStatus = 'Open' | 'Under review' | 'Action in progress' | 'Resolved' | 'Closed';
export type ProjectTemplateId = 'lounge' | 'hotel' | 'kitchen' | 'encalm-eats' | 'custom';

export const projectStatuses: ProjectStatus[] = [
  'Yet to start',
  'In Design',
  'In Tendering',
  'Under Construction',
  'Operational',
  'On Hold',
];

export const issueCategories: IssueCategory[] = [
  'Design',
  'Procurement',
  'Billing',
  'Construction',
  'Approval',
  'Other',
];

export type Phase = {
  id?: string;
  name: string;
  status: StageStatus;
  progress: number;
  weight?: number;
  budget?: number;
  owner: string;
  plannedStart?: string;
  plannedFinish?: string;
  actualFinish?: string;
  workCompleted?: string;
  nextAction?: string;
  decisionRequired?: string;
  taggedUsers?: string[];
  updatedAt?: string;
};

export type Milestone = {
  id?: string;
  title: string;
  date: string;
  status: 'complete' | 'upcoming' | 'late';
  stage?: string;
  owner?: string;
  approvalRequired?: boolean;
  approvalStatus?: 'Not required' | 'Pending' | 'Approved' | 'Rejected';
  completedDate?: string;
  taggedUsers?: string[];
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
  issueAriseDate?: string;
  targetClosureDate?: string;
  impactCost?: string;
  impactSchedule?: string;
  impactScope?: string;
  action?: string;
  resolution?: string;
  taggedUsers?: string[];
};

export type ProjectUpdate = {
  date: string;
  author: string;
  role: string;
  text: string;
  stage?: string;
  kind?: 'Progress' | 'Decision' | 'Risk' | 'General';
};

export type FOHAreaItem = {
  sNo: number;
  floor: string;
  description: string;
  areaSqm: number;
  areaSqft: number;
  capacityPax?: number | string;
  remarks?: string;
};

export type FloorBuaItem = {
  sNo: number;
  floor: string;
  areaSqm: number;
  areaSqft: number;
  remarks?: string;
};

export type RoomConfigItem = {
  sNo: number;
  floor: string;
  keys: number;
  bays: number;
  remarks?: string;
};

export type ArchitecturalAreaProgram = {
  summary: {
    plotAreaSqm: number;
    plotAreaSqft: number;
    plotAreaAcres: number;
    builtUpAreaSqm: number;
    builtUpAreaSqft: number;
    numberOfFloorsDescription: string;
    totalRoomKeys: number;
    totalBays: number;
    standardRoomSizeSqm: number;
    numberOfElevators: number;
    elevatorRemarks: string;
    generalRemarks?: string;
  };
  fohAreas: {
    groundFloor: FOHAreaItem[];
    groundFloorSubtotal: { areaSqm: number; areaSqft: number };
    secondFloor: FOHAreaItem[];
    secondFloorSubtotal: { areaSqm: number; areaSqft: number };
    grandSubtotal: { areaSqm: number; areaSqft: number };
  };
  floorWiseBua: {
    items: FloorBuaItem[];
    subtotal: { areaSqm: number; areaSqft: number };
  };
  roomConfiguration: {
    items: RoomConfigItem[];
    totalKeys: number;
    totalBays: number;
  };
};

export type AreaSheetItem = {
  slNo: number;
  section: 'LOUNGES' | 'OFFICE, KITCHEN & MISC WORKS' | 'HOTELS';
  status: string;
  areaSqft?: number;
  areaSqm?: number;
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
  areaProgram?: ArchitecturalAreaProgram;
  areaSheet?: AreaSheetItem;
};

export type PhotoCategory = 'Progress' | 'Snag / Issue' | 'Milestone' | 'Before / After' | 'Inspection' | 'General';
export const photoCategories: PhotoCategory[] = [
  'Progress',
  'Snag / Issue',
  'Milestone',
  'Before / After',
  'Inspection',
  'General',
];

export type SitePhoto = {
  id: string;
  projectId: string;
  url: string;
  caption: string;
  stage?: string;
  category?: PhotoCategory;
  takenDate?: string;
  uploadedAt?: string;
  uploadedBy: string;
  role?: string;
  fileSize?: number;
  createdAt?: string;
};

export type Project = {
  id: string;
  name: string;
  location: Location;
  category: Category;
  code: string;
  health: Health;
  status?: ProjectStatus;
  progress: number;
  targetDate: string;
  targetLabel: string;
  aop: number;
  awarded: number;
  spent: number;
  projectedCost?: number;
  area?: string;
  paxKeys?: string;
  nextMilestone: string;
  nextMilestoneDate: string;
  leadId: string;
  phases: Phase[];
  milestones: Milestone[];
  issues: ProjectIssue[];
  updates: ProjectUpdate[];
  photos?: SitePhoto[];
  startDate?: string;
  lastUpdated?: string;
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
      { name: 'Execution', owner: 'Projects' },
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
    fields: [
      'Cuisine / service type',
      'Daily meal capacity',
      'Equipment package',
      'Exhaust requirement',
      'Utility load',
    ],
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

/** Default projects array starts empty so users enter data from scratch. */
export const defaultDemoProjects: Project[] = [];

export const projects: Project[] = [];
export const locations: Location[] = ['Delhi', 'Hyderabad', 'Goa', 'Bhogapuram', 'Vizag'];
export const categories: Category[] = ['Hotel', 'Lounge', 'Kitchen', 'Encalm Eats', 'Other'];
export const healthOptions: Health[] = ['On track', 'At risk', 'Delayed', 'Not started'];

/** One crore = 10,000,000. Non-finite input renders as `—` rather than `₹NaN Cr`. */
export const CRORE = 10000000;

export const formatCrore = (value: number) => (Number.isFinite(value) ? `₹${(value / CRORE).toFixed(1)} Cr` : '₹—');

/** Safe re-export so call sites keep working; see `@/lib/date`. */
export const formatShortDate = formatDayMonth;

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------

/** Record ids: slugs, uuids and generated ids (letters, digits, . _ - : @). */
export const id = z.string().regex(/^[A-Za-z0-9._@:-]{1,200}$/, 'Invalid id');

const text = (max: number) => z.string().trim().max(max);
const optText = (max: number) => text(max).nullish();
/** Free-form date text as the UI stores it (ISO dates or labels like "Dec 2026"). */
const dateText = optText(40);
const taggedUsers = z.array(id).max(100).optional();

/** Numbers that may arrive as numbers, numeric strings, or '' / null for "no value". */
const looseNumber = z.preprocess(
  (v) => (v === '' || v === null ? null : typeof v === 'string' ? Number(v) : v),
  z.number().finite().nullable(),
);
const money = looseNumber.refine((v) => v === null || (v >= 0 && v < 1e13), 'Out of range');
const percent = looseNumber.refine((v) => v === null || (v >= 0 && v <= 100), 'Must be between 0 and 100');

export const health = z.enum(['On track', 'At risk', 'Delayed', 'Not started']);
export const projectStatus = z.enum([
  'Yet to start',
  'In Design',
  'In Tendering',
  'Under Construction',
  'Operational',
  'On Hold',
]);
export const phaseStatus = z.enum(['upcoming', 'active', 'blocked', 'complete']);
export const milestoneStatus = z.enum(['upcoming', 'complete', 'late']);
export const approvalStatus = z.enum(['Not required', 'Pending', 'Approved', 'Rejected']);
export const severity = z.enum(['High', 'Medium', 'Low']);
export const updateKind = z.enum(['Progress', 'Decision', 'Risk', 'General']);

/** Arbitrary JSON object, capped by serialised size. */
const boundedObject = (maxBytes: number) =>
  z
    .record(z.string(), z.unknown())
    .refine((v) => JSON.stringify(v).length <= maxBytes, `Must be under ${maxBytes} bytes`);

// ---------------------------------------------------------------------------
// Params and query
// ---------------------------------------------------------------------------

export const projectParams = z.object({ id });
export const phaseParams = z.object({ id, phaseId: id });
export const milestoneParams = z.object({ id, milestoneId: id });
export const issueParams = z.object({ id, issueId: id });
export const photoParams = z.object({ id, photoId: id });
export const idParams = z.object({ id });

/** limit/offset paging for list endpoints. */
const pageFields = {
  limit: z
    .string()
    .regex(/^\d{1,3}$/)
    .optional(),
  offset: z
    .string()
    .regex(/^\d{1,7}$/)
    .optional(),
};
export const pageQuery = z.object(pageFields);
export const emailLogsQuery = z.object({ projectId: id.optional(), ...pageFields });
export const directoryQuery = z.object({ q: z.string().max(100).optional() });
export const auditQuery = z.object({
  ...pageFields,
  userId: id.optional(),
  entityType: z
    .string()
    .regex(/^[a-z_]{1,40}$/)
    .optional(),
  entityId: z.string().max(4000).optional(),
  action: z
    .string()
    .regex(/^[a-z_]{1,40}$/)
    .optional(),
});

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export const loginBody = z.object({
  email: text(254).min(1),
  password: z.string().min(1).max(200),
});

export const changePasswordBody = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(1).max(200),
});

export const createLeadBody = z.object({
  name: text(120).min(1),
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(200),
  title: optText(120),
});

// ---------------------------------------------------------------------------
// Stages, milestones, issues, updates
// ---------------------------------------------------------------------------

const phaseFields = {
  name: text(200).min(1),
  status: phaseStatus,
  progress: percent,
  weight: looseNumber.refine((v) => v === null || (v >= 0 && v <= 1000), 'Out of range'),
  budget: money,
  owner: text(120),
  plannedStart: dateText,
  plannedFinish: dateText,
  actualFinish: dateText,
  workCompleted: optText(5000),
  nextAction: optText(5000),
  decisionRequired: optText(5000),
  taggedUsers,
};

export const createPhaseBody = z
  .object({ id: id.optional(), ...phaseFields })
  .partial()
  .extend({
    name: text(200).min(1).optional(),
  });
export const updatePhaseBody = z.object(phaseFields).partial().extend({ notify: z.boolean().optional() });
export const movePhaseBody = z.object({
  phaseIndex: z.number().int().min(0).max(1000),
  direction: z.union([z.literal(-1), z.literal(1)]),
});

const milestoneFields = {
  title: text(300).min(1),
  date: text(40),
  status: milestoneStatus,
  stage: optText(200),
  owner: optText(120),
  approvalRequired: z.boolean(),
  approvalStatus: approvalStatus,
  completedDate: dateText,
  taggedUsers,
};

export const createMilestoneBody = z
  .object({ id: id.optional(), ...milestoneFields })
  .partial()
  .required({ title: true, date: true });
export const updateMilestoneBody = z.object(milestoneFields).partial().extend({ notify: z.boolean().optional() });

const issueFields = {
  title: text(300).min(1),
  detail: text(10000),
  severity,
  owner: optText(120),
  category: optText(60),
  status: optText(60),
  stage: optText(200),
  dateRaised: dateText,
  dueDate: dateText,
  issueAriseDate: dateText,
  targetClosureDate: dateText,
  impactCost: optText(2000),
  impactSchedule: optText(2000),
  impactScope: optText(2000),
  action: optText(5000),
  resolution: optText(5000),
  taggedUsers,
};

export const createIssueBody = z
  .object({ id: id.optional(), ...issueFields })
  .partial()
  .required({ title: true, detail: true });
export const updateIssueBody = z.object(issueFields).partial().extend({ notify: z.boolean().optional() });

export const createUpdateBody = z.object({
  text: text(10000).min(1),
  date: dateText,
  author: optText(120),
  role: optText(120),
  stage: optText(200),
  kind: updateKind.optional(),
});

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

const projectScalarFields = {
  name: text(200).min(1),
  code: text(60),
  location: text(80).min(1),
  category: text(80).min(1),
  health,
  status: projectStatus,
  progress: percent,
  startDate: dateText,
  targetDate: dateText,
  targetLabel: optText(60),
  aop: money,
  awarded: money,
  spent: money,
  projectedCost: money,
  projected_cost: money,
  area: optText(200),
  paxKeys: optText(200),
  pax_keys: optText(200),
  nextMilestone: optText(300),
  nextMilestoneDate: dateText,
  leadId: id.or(z.literal('')),
  specification: boundedObject(50_000),
};

export const createProjectBody = z
  .object({
    id: id.optional(),
    templateId: optText(60),
    ...projectScalarFields,
    phases: z
      .array(
        z
          .object({ id: id.optional(), ...phaseFields })
          .partial()
          .required({ name: true }),
      )
      .max(50)
      .optional(),
    milestones: z
      .array(
        z
          .object({ id: id.optional(), ...milestoneFields })
          .partial()
          .required({ title: true, date: true }),
      )
      .max(200)
      .optional(),
    issues: z
      .array(
        z
          .object({ id: id.optional(), ...issueFields })
          .partial()
          .required({ title: true, detail: true }),
      )
      .max(200)
      .optional(),
  })
  .partial()
  .required({ name: true, location: true, category: true });

export const updateProjectBody = z
  .object({
    ...projectScalarFields,
    phases: z
      .array(z.object({ id: id.optional(), budget: money.optional() }))
      .max(50)
      .optional(),
  })
  .partial();

export const allotProjectBody = z.object({ leadId: id });

/** Full-portfolio payloads (import / sync): checked for shape, contents handled by restore. */
const portfolioProject = z.looseObject({ id, name: text(200).min(1) });
export const syncProjectsBody = z.object({
  projects: z.array(portfolioProject).max(2000),
  explicit: z.boolean().optional(),
});
export const importBody = z.looseObject({
  projects: z.array(portfolioProject).max(2000),
  notifications: z.array(z.unknown()).max(10000).optional(),
});

// ---------------------------------------------------------------------------
// Email
// ---------------------------------------------------------------------------

// Only SMTP can be set from the app. Microsoft 365 (Azure) credentials live in
// the server's environment, and the sender is always the signed-in user, so
// none of those fields are accepted here. Unknown keys are rejected.
const smtpSettings = z
  .object({
    host: optText(253),
    port: z.coerce.number().int().min(1).max(65535).optional(),
    secure: z.boolean().optional(),
    user: optText(254),
    pass: z.string().max(500).optional(),
    fromName: optText(120),
  })
  .strict();

export const emailSettingsBody = z.object({ smtp: smtpSettings.optional() }).strict();

/** A test email always goes from and to the signed-in coordinator. */
export const emailTestBody = z.object({}).strict();

const recipient = z.union([
  z.string().trim().email().max(254),
  z.object({ email: z.string().trim().email().max(254), name: optText(120) }),
]);

export const sendProjectUpdateBody = z.object({
  projectId: id,
  recipients: z.array(recipient).min(1).max(50),
  customNote: optText(5000),
});

export const tagAndCommentBody = z.object({
  projectId: id,
  entityType: z.enum(['Task', 'Stage', 'Milestone', 'Issue', 'Update', 'General']).optional(),
  entityId: id.optional(),
  entityTitle: optText(300),
  entityContext: optText(2000),
  taggedUserIds: z.array(id).max(100).optional(),
  comment: optText(5000),
});

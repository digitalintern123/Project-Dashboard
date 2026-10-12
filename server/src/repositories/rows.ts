/** Row shapes as stored in SQLite (snake_case, JSON stored as text). */

export type ProjectRow = {
  id: string;
  name: string;
  location: string;
  category: string;
  code: string;
  health: string;
  status: string;
  progress: number;
  target_date: string;
  target_label: string;
  aop: number;
  awarded: number;
  spent: number;
  projected_cost: number;
  area: string | null;
  pax_keys: string | null;
  next_milestone: string;
  next_milestone_date: string;
  lead_id: string;
  start_date: string | null;
  last_updated: string | null;
  specification_json: string | null;
  template_id: string | null;
  created_at: string;
};

export type PhaseRow = {
  id: string;
  project_id: string;
  name: string;
  status: string;
  progress: number;
  owner: string;
  order_index: number;
  planned_start: string | null;
  planned_finish: string | null;
  actual_finish: string | null;
  work_completed: string | null;
  next_action: string | null;
  decision_required: string | null;
  budget: number | null;
  updated_at: string | null;
  weight: number | null;
  tagged_users: string | null;
};

export type MilestoneRow = {
  id: string;
  project_id: string;
  title: string;
  date: string;
  status: string;
  stage: string | null;
  owner: string | null;
  approval_required: number;
  approval_status: string | null;
  completed_date: string | null;
  order_index: number;
  tagged_users: string | null;
};

export type IssueRow = {
  id: string;
  project_id: string;
  title: string;
  detail: string;
  severity: string;
  owner: string;
  category: string | null;
  status: string;
  stage: string | null;
  date_raised: string | null;
  due_date: string | null;
  impact_cost: string | null;
  impact_schedule: string | null;
  impact_scope: string | null;
  action: string | null;
  resolution: string | null;
  order_index: number;
  tagged_users: string | null;
};

export type UpdateRow = {
  id: string;
  project_id: string;
  date: string;
  author: string;
  role: string;
  text: string;
  stage: string | null;
  kind: string;
  created_at: string;
};

export type PhotoRow = {
  id: string;
  project_id: string;
  url: string;
  thumbnail_url: string | null;
  caption: string;
  stage: string | null;
  category: string | null;
  taken_date: string | null;
  uploaded_by: string;
  role: string | null;
  file_size: number | null;
  created_at: string;
};

export type UserRow = {
  id: string;
  name: string;
  email: string | null;
  password_hash: string | null;
  role: 'hod' | 'lead' | 'coordinator' | 'stakeholder';
  title: string;
  initials: string;
  created_at: string;
  must_change_password: number;
  token_version: number;
  failed_attempts: number;
  locked_until: string | null;
};

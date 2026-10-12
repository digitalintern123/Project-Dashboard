import { CommercialView } from './commercial-view';
import { IssuesView } from './issues/issues-view';
import { MilestonesView } from './milestones-view';
import { NewProjectView } from './new-project/new-project-view';
import { ProjectsView } from './projects-view';
import { ReportsView } from './reports-view';
import { SitePhotographsView } from './site-photographs-view';
import { TeamView } from './team-view';
import { TimelineView } from './timeline-view';
import { UpdatesView } from './updates-view';

export type WorkspaceView =
  | 'projects'
  | 'my-projects'
  | 'timeline'
  | 'milestones'
  | 'issues'
  | 'commercial'
  | 'updates'
  | 'photos'
  | 'reports'
  | 'new-project'
  | 'team';

export default function Workspace({ view }: { view: WorkspaceView }) {
  return (
    <div className="mx-auto max-w-[1500px] px-5 pb-14 pt-8 md:px-10 md:pt-10">
      {view === 'projects' && <ProjectsView />}
      {view === 'my-projects' && <ProjectsView mine />}
      {view === 'timeline' && <TimelineView />}
      {view === 'milestones' && <MilestonesView />}
      {view === 'issues' && <IssuesView />}
      {view === 'commercial' && <CommercialView />}
      {view === 'updates' && <UpdatesView />}
      {view === 'photos' && <SitePhotographsView />}
      {view === 'reports' && <ReportsView />}
      {view === 'new-project' && <NewProjectView />}
      {view === 'team' && <TeamView />}
    </div>
  );
}

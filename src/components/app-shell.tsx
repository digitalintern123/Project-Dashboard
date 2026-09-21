import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import {
  AlertTriangle,
  Bell,
  CalendarRange,
  CalendarDays,
  ChevronRight,
  CircleDollarSign,
  FileBarChart,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  PanelLeft,
  Plus,
  RotateCcw,
  Settings,
  ShieldCheck,
  Target,
  X,
} from 'lucide-react';
import { useAppState } from '@/state/app-state';
import { readItem, writeItem } from '@/lib/storage';
import { useToast } from '@/hooks/use-toast';

type AppShellProps = { children: ReactNode };

const groups = [
  {
    label: 'Command center',
    items: [{ label: 'Portfolio overview', href: '/', icon: LayoutDashboard }],
  },
  {
    label: 'Projects',
    items: [
      { label: 'All projects', href: '/projects', icon: ListChecks },
      { label: 'New project', href: '/new-project', icon: Plus, leadOnly: true },
      { label: 'My projects', href: '/my-projects', icon: Target, leadOnly: true },
    ],
  },
  {
    label: 'Execution',
    items: [
      { label: 'Timeline', href: '/timeline', icon: CalendarRange },
      { label: 'Milestones', href: '/milestones', icon: CalendarDays },
      { label: 'Issues & risks', href: '/issues', icon: AlertTriangle },
    ],
  },
  {
    label: 'Commercial',
    items: [{ label: 'Budget & AOP', href: '/commercial', icon: CircleDollarSign }],
  },
  {
    label: 'Reports',
    items: [{ label: 'Project reports', href: '/reports', icon: FileBarChart }],
  },
];

export function AppShell({ children }: AppShellProps) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [reminders, setReminders] = useState(() => readItem('encalm-update-reminders') !== 'off');
  const [resetConfirm, setResetConfirm] = useState(false);
  const { role, user, logout, resetProjects } = useAppState();
  const { toast } = useToast();
  const settingsTriggerRef = useRef<HTMLButtonElement | null>(null);
  const settingsCloseRef = useRef<HTMLButtonElement | null>(null);
  const isDetail = location.startsWith('/project/');
  const isLead = role === 'lead';

  useEffect(() => {
    writeItem('encalm-compact-nav', collapsed ? 'on' : 'off');
  }, [collapsed]);

  useEffect(() => {
    writeItem('encalm-update-reminders', reminders ? 'on' : 'off');
  }, [reminders]);

  const closeSettings = useCallback(() => {
    setSettingsOpen(false);
    // Return focus to the control that opened the dialog.
    settingsTriggerRef.current?.focus();
  }, []);

  // Escape closes whichever overlay is open, and the body is locked from
  // scrolling behind them.
  useEffect(() => {
    if (!settingsOpen && !mobileOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (settingsOpen) closeSettings();
      else setMobileOpen(false);
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [settingsOpen, mobileOpen, closeSettings]);

  // Move focus into the dialog so keyboard and screen-reader users are not
  // left behind on the page underneath.
  useEffect(() => {
    if (settingsOpen) settingsCloseRef.current?.focus();
  }, [settingsOpen]);

  const resetDemoData = () => {
    resetProjects();
    setResetConfirm(false);
    closeSettings();
    toast({
      title: 'Demo data restored',
      description: 'Local edits were cleared and the seeded portfolio is back.',
    });
  };

  return (
    <div className="grain app-shell min-h-[100dvh] bg-background text-foreground">
      <aside className={`fixed inset-y-0 left-0 z-40 flex flex-col bg-sidebar px-4 py-6 text-sidebar-foreground shadow-2xl shadow-slate-950/10 transition-all duration-300 md:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} ${collapsed ? 'w-[88px]' : 'w-[256px]'}`}>
        <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-between'}`}>
          <Link href="/" data-testid="link-brand" className={`group flex items-center ${collapsed ? '' : 'gap-3'}`} onClick={() => setMobileOpen(false)}>
            <img src="https://encalm.com/assets/image/Encalm-Logo-White.png" alt="Encalm" onError={(event) => { event.currentTarget.style.display = 'none'; }} className={`h-8 w-auto object-contain object-left ${collapsed ? 'max-w-10' : 'max-w-[120px]'}`} />{!collapsed && <span className="sr-only">Encalm</span>}
            {!collapsed && <span className="border-l border-white/20 pl-3 font-mono text-[9px] uppercase tracking-[.18em] text-white/45">Projects</span>}
          </Link>
          <button type="button" aria-label="Close navigation" data-testid="button-close-navigation" onClick={() => setMobileOpen(false)} className="rounded-lg p-2 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground md:hidden"><X size={18} /></button>
        </div>

        <nav className="mt-9 flex-1 space-y-6 overflow-y-auto">
          {groups.map((group) => {
            const visible = group.items.filter((item) => !item.leadOnly || isLead);
            return <div key={group.label}><p className={`px-3 font-mono text-[9px] uppercase tracking-[.18em] text-sidebar-foreground/40 ${collapsed ? 'text-center px-0' : ''}`}>{collapsed ? group.label.slice(0, 2) : group.label}</p><div className="mt-2 space-y-1">{visible.map((item) => { const active = item.href === '/' ? location === '/' : location.startsWith(item.href); const Icon = item.icon; return <Link href={item.href} key={item.href} data-testid={`link-nav-${item.label.toLowerCase().replaceAll(' ', '-')}`} onClick={() => setMobileOpen(false)} title={collapsed ? item.label : undefined} className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[12px] font-semibold transition ${active ? 'bg-sidebar-accent text-sidebar-foreground' : 'text-sidebar-foreground/60 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground'} ${collapsed ? 'justify-center px-0' : ''}`}><Icon size={16} className={active ? 'text-sidebar-primary' : ''} />{!collapsed && <span>{item.label}</span>}{!collapsed && active && <ChevronRight size={13} className="ml-auto text-sidebar-foreground/40" />}</Link>; })}</div></div>;
          })}
        </nav>

        {!collapsed && <div className="mb-5 rounded-2xl border border-sidebar-border bg-sidebar-accent/50 p-4"><div className="flex items-center gap-2 text-sidebar-primary"><span className="size-1.5 rounded-full bg-sidebar-primary" /><span className="font-mono text-[9px] uppercase tracking-[.14em]">{isLead ? 'Lead workspace' : 'Live portfolio'}</span></div><p className="mt-3 text-[11px] leading-5 text-sidebar-foreground/60">{isLead ? 'Keep project information accurate and moving.' : 'A clear view of the decisions moving the network forward.'}</p></div>}
        <div className={`border-t border-sidebar-border pt-4 ${collapsed ? 'text-center' : ''}`}><div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : ''}`}><span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#d6a95d] text-[11px] font-bold text-[#173e49]">{user?.initials}</span>{!collapsed && <span className="min-w-0"><span className="block truncate text-[11px] font-bold">{user?.name}</span><span className="mt-1 block truncate font-mono text-[9px] uppercase tracking-[.08em] text-sidebar-foreground/50">{user?.title}</span></span>}{!collapsed && <button type="button" aria-label="Notifications" data-testid="button-notifications" className="ml-auto rounded-lg p-2 text-sidebar-foreground/55 hover:bg-sidebar-accent hover:text-sidebar-foreground"><Bell size={15} /></button>}</div>{!collapsed && <div className="mt-3 flex items-center gap-2 pl-1"><span className="size-1.5 rounded-full bg-[#66b89b]" /><span className="font-mono text-[9px] uppercase tracking-[.1em] text-sidebar-foreground/40">Online</span><button type="button" onClick={logout} className="ml-auto flex items-center gap-1 text-[10px] text-sidebar-foreground/40 hover:text-sidebar-foreground"><LogOut size={12} /> Logout</button></div>}</div>
      </aside>

      {mobileOpen && <button type="button" aria-label="Close menu overlay" data-testid="button-menu-overlay" className="fixed inset-0 z-30 bg-[#123b45]/35 md:hidden" onClick={() => setMobileOpen(false)} />}
      <main className={`min-h-[100dvh] transition-[padding] duration-300 ${collapsed ? 'md:pl-[88px]' : 'md:pl-[256px]'}`}>
        <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between border-b border-border/70 bg-background/85 px-5 backdrop-blur-xl md:px-10">
          <div className="flex items-center gap-3">
            <button type="button" aria-label="Open navigation" data-testid="button-open-navigation" onClick={() => setMobileOpen(true)} className="rounded-xl border border-border bg-card p-2.5 text-muted-foreground hover:bg-muted md:hidden"><Menu size={18} /></button>
            <button type="button" aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'} onClick={() => setCollapsed((value) => !value)} className="hidden rounded-xl border border-border bg-card p-2.5 text-muted-foreground hover:bg-muted md:block"><PanelLeft size={16} /></button>
            <div className="hidden items-center gap-2 text-[12px] text-muted-foreground sm:flex"><span>Encalm Hospitality</span><ChevronRight size={13} className="text-muted-foreground/50" /><span className="font-semibold text-foreground">{isDetail ? 'Project view' : location === '/' ? 'Portfolio overview' : currentSectionLabel(location) ?? 'Workspace'}</span></div>
            <span className="font-mono text-[10px] uppercase tracking-[.14em] text-muted-foreground sm:hidden">{isDetail ? 'Project view' : 'Projects'}</span>
          </div>
          <div className="flex items-center gap-3"><span className={`hidden rounded-full px-3 py-1.5 font-mono text-[9px] uppercase tracking-[.12em] sm:inline-flex ${isLead ? 'bg-[#e4f1ec] text-[#2e7c67]' : 'bg-[#f8edcf] text-[#9a711f]'}`}>{isLead ? 'Project lead' : 'Project HOD'}</span><span className="hidden items-center gap-2 text-[11px] font-semibold text-muted-foreground sm:flex"><span className="size-1.5 rounded-full bg-[#3d9a7e]" /> Saved locally</span><button type="button" aria-label="Open settings" data-testid="button-settings" ref={settingsTriggerRef} aria-haspopup="dialog" aria-expanded={settingsOpen} onClick={() => { setSettingsOpen(true); setResetConfirm(false); }} className={`rounded-lg p-2 text-muted-foreground hover:bg-muted ${settingsOpen ? 'bg-muted text-foreground' : ''}`}><Settings size={16} /></button></div>
        </header>
        {children}
      </main>
      {settingsOpen && <div role="presentation" className="fixed inset-0 z-50 flex items-start justify-end bg-[#123b45]/25 p-3 backdrop-blur-[2px] sm:p-5" onClick={closeSettings}>
        <section role="dialog" aria-modal="true" aria-labelledby="settings-title" className="fade-up max-h-[calc(100dvh-24px)] w-full max-w-[430px] overflow-y-auto rounded-2xl border border-border bg-[#f7f4ec] p-5 shadow-2xl shadow-[#173e49]/20 sm:max-h-[calc(100dvh-40px)] sm:p-6" onClick={(event) => event.stopPropagation()}>
          <div className="flex items-start justify-between gap-4"><div><p className="font-mono text-[9px] uppercase tracking-[.16em] text-[#9a711f]">Workspace settings</p><h2 id="settings-title" className="mt-2 font-serif text-[32px] leading-none tracking-[-.04em] text-[#173e49]">Settings</h2></div><button type="button" ref={settingsCloseRef} aria-label="Close settings" data-testid="button-close-settings" onClick={closeSettings} className="rounded-lg p-2 text-muted-foreground hover:bg-white"><X size={17} /></button></div>
          <div className="mt-6 flex items-center gap-3 rounded-xl border border-border bg-white/70 p-3.5"><span className="grid size-10 place-items-center rounded-full bg-[#d6a95d] text-[11px] font-bold text-[#173e49]">{user?.initials}</span><span className="min-w-0 flex-1"><strong className="block truncate text-[12px]">{user?.name}</strong><span className="mt-1 block truncate font-mono text-[9px] uppercase tracking-[.1em] text-muted-foreground">{user?.email}</span></span><span className={`rounded-full px-2 py-1 font-mono text-[8px] uppercase tracking-[.1em] ${isLead ? 'bg-[#e4f1ec] text-[#2e7c67]' : 'bg-[#f8edcf] text-[#9a711f]'}`}>{isLead ? 'Lead' : 'HOD'}</span></div>
          <div className="mt-6"><p className="font-mono text-[9px] uppercase tracking-[.14em] text-muted-foreground">Preferences</p><div className="mt-3 divide-y divide-border overflow-hidden rounded-xl border border-border bg-white/70"><button type="button" onClick={() => setCollapsed((value) => !value)} className="flex w-full items-center gap-3 p-3.5 text-left hover:bg-white"><span className="grid size-8 place-items-center rounded-lg bg-[#e4f1ec] text-[#2e7c67]"><Settings size={15} /></span><span className="min-w-0 flex-1"><strong className="block text-[11px]">Compact navigation</strong><span className="mt-1 block text-[10px] text-muted-foreground">Keep the sidebar collapsed on desktop.</span></span><span className={`relative h-5 w-9 rounded-full transition ${collapsed ? 'bg-[#3d9a7e]' : 'bg-[#c8cec9]'}`}><span className={`absolute top-0.5 size-4 rounded-full bg-white shadow-sm transition ${collapsed ? 'left-[18px]' : 'left-0.5'}`} /></span></button><button type="button" onClick={() => setReminders((value) => !value)} className="flex w-full items-center gap-3 p-3.5 text-left hover:bg-white"><span className="grid size-8 place-items-center rounded-lg bg-[#f8edcf] text-[#9a711f]"><Bell size={15} /></span><span className="min-w-0 flex-1"><strong className="block text-[11px]">Update reminders</strong><span className="mt-1 block text-[10px] text-muted-foreground">Keep project update reminders enabled.</span></span><span className={`relative h-5 w-9 rounded-full transition ${reminders ? 'bg-[#3d9a7e]' : 'bg-[#c8cec9]'}`}><span className={`absolute top-0.5 size-4 rounded-full bg-white shadow-sm transition ${reminders ? 'left-[18px]' : 'left-0.5'}`} /></span></button></div></div>
          <div className="mt-6"><p className="font-mono text-[9px] uppercase tracking-[.14em] text-muted-foreground">Access</p><div className="mt-3 flex items-start gap-3 rounded-xl border border-[#cbe4d9] bg-[#edf5f0] p-3.5"><ShieldCheck size={17} className="mt-0.5 shrink-0 text-[#2e7c67]" /><p className="text-[11px] leading-5 text-[#517167]">{isLead ? 'You can create projects and update delivery, commercial, milestone, issue, risk, and update records.' : 'You have read-only access to the portfolio. Project changes are restricted to Project Leads.'}</p></div></div>
          <div className="mt-6 border-t border-border pt-5"><p className="font-mono text-[9px] uppercase tracking-[.14em] text-muted-foreground">Prototype data</p>{resetConfirm ? <div className="mt-3 rounded-xl border border-[#f0c8c2] bg-[#fff5f2] p-3.5"><p className="text-[11px] font-bold text-[#b2473d]">Reset all local project changes?</p><p className="mt-1 text-[10px] leading-4 text-muted-foreground">This restores the original demo projects on this browser.</p><div className="mt-3 flex gap-2"><button type="button" onClick={resetDemoData} className="rounded-lg bg-[#b2473d] px-3 py-2 text-[10px] font-bold text-white">Reset data</button><button type="button" onClick={() => setResetConfirm(false)} className="rounded-lg border border-border bg-white px-3 py-2 text-[10px] font-bold">Cancel</button></div></div> : <button type="button" onClick={() => setResetConfirm(true)} className="mt-3 flex w-full items-center gap-3 rounded-xl border border-border bg-white/70 p-3.5 text-left hover:bg-white"><span className="grid size-8 place-items-center rounded-lg bg-[#fae5e1] text-[#b2473d]"><RotateCcw size={15} /></span><span><strong className="block text-[11px]">Reset demo data</strong><span className="mt-1 block text-[10px] text-muted-foreground">Remove local edits and restore the seeded portfolio.</span></span></button>}</div>
        </section>
      </div>}
    </div>
  );
}

/**
 * Longest-prefix match so the breadcrumb names the section actually open.
 * A plain `find(startsWith)` matched the `/` entry first and labelled every
 * route "Portfolio overview".
 */
function currentSectionLabel(location: string): string | null {
  const items = groups.flatMap((group) => group.items);
  let best: { label: string; length: number } | null = null;

  for (const item of items) {
    const matches = item.href === '/' ? location === '/' : location.startsWith(item.href);
    if (!matches) continue;
    if (!best || item.href.length > best.length) {
      best = { label: item.label, length: item.href.length };
    }
  }

  return best?.label ?? null;
}

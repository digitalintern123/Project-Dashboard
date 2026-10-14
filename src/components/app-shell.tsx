import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import {
  TriangleAlert as AlertTriangle,
  Bell,
  CalendarRange,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronRight,
  CircleDollarSign,
  ChartBar as FileBarChart,
  Download,
  Upload,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  MessageSquareText,
  PanelLeft,
  Plus,
  RotateCcw,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Target,
  X,
  Clock3,
  Activity,
  Server,
  Users,
  Camera,
  Mail,
  Tag,
  UserCheck,
  FileSpreadsheet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAppState, type AppRole } from '@/state/app-state';
import { BrandLogo } from './brand-logo';
import { readItem, writeItem } from '@/lib/storage';
import { useToast } from '@/hooks/use-toast';
import { EmailHubModal } from './email-hub-modal';
import { ServerBackupsCard } from './server-backups-card';
import { errorMessage } from '@/lib/utils';

type AppShellProps = { children: ReactNode };

type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  allowedRoles?: AppRole[];
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const groups: NavGroup[] = [
  {
    label: 'Command center',
    items: [{ label: 'Portfolio overview', href: '/', icon: LayoutDashboard }],
  },
  {
    label: 'Projects',
    items: [
      { label: 'All projects', href: '/projects', icon: ListChecks },
      { label: 'Project Area Sheet', href: '/area-sheet', icon: FileSpreadsheet },
      { label: 'New project', href: '/new-project', icon: Plus, allowedRoles: ['lead', 'coordinator'] },
      { label: 'My projects', href: '/my-projects', icon: Target, allowedRoles: ['lead'] },
      { label: 'Team & Allotment', href: '/team', icon: Users, allowedRoles: ['coordinator'] },
    ],
  },
  {
    label: 'Execution',
    items: [
      { label: 'Timeline', href: '/timeline', icon: CalendarRange },
      { label: 'Milestones', href: '/milestones', icon: CalendarDays },
      { label: 'Issues & risks', href: '/issues', icon: AlertTriangle },
      { label: 'Update feed', href: '/updates', icon: MessageSquareText },
      { label: 'Site photographs', href: '/photos', icon: Camera },
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
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [reminders, setReminders] = useState(() => readItem('encalm-update-reminders') !== 'off');
  const [resetConfirm, setResetConfirm] = useState(false);
  const [emailHubOpen, setEmailHubOpen] = useState(false);

  const {
    role,
    user,
    logout,
    resetProjects,
    exportBackup,
    importBackup,
    isConnected,
    notifications,
    unreadNotifCount,
    markNotificationRead,
    markAllNotificationsRead,
  } = useAppState();

  const { toast } = useToast();
  const settingsTriggerRef = useRef<HTMLButtonElement | null>(null);
  const settingsCloseRef = useRef<HTMLButtonElement | null>(null);
  const notifCloseRef = useRef<HTMLButtonElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isDetail = location.startsWith('/project/');
  const isLead = role === 'lead';

  const handleExportBackup = async () => {
    try {
      await exportBackup();
      toast({
        title: 'Database Backup Exported',
        description: 'Portfolio snapshot downloaded to your device as JSON.',
      });
    } catch {
      toast({
        title: 'Export Failed',
        description: 'Could not generate backup file.',
        variant: 'destructive',
      });
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const res = await importBackup(text);
      if (res.success) {
        toast({
          title: 'Database Restored',
          description: `Successfully restored ${res.count || 0} projects.`,
        });
      } else {
        toast({
          title: 'Restore Failed',
          description: res.error || 'Invalid backup structure.',
          variant: 'destructive',
        });
      }
    } catch (err) {
      toast({
        title: 'Import Error',
        description: errorMessage(err, 'Failed to read file.'),
        variant: 'destructive',
      });
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  useEffect(() => {
    writeItem('encalm-compact-nav', collapsed ? 'on' : 'off');
  }, [collapsed]);

  useEffect(() => {
    writeItem('encalm-update-reminders', reminders ? 'on' : 'off');
  }, [reminders]);

  const closeSettings = useCallback(() => {
    setSettingsOpen(false);
    settingsTriggerRef.current?.focus();
  }, []);

  const closeNotifications = useCallback(() => {
    setNotificationsOpen(false);
  }, []);

  // Escape closes whichever overlay is open
  useEffect(() => {
    if (!settingsOpen && !notificationsOpen && !mobileOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (settingsOpen) closeSettings();
      else if (notificationsOpen) closeNotifications();
      else setMobileOpen(false);
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [settingsOpen, notificationsOpen, mobileOpen, closeSettings, closeNotifications]);

  const handleClearAllData = async () => {
    await resetProjects();
    setResetConfirm(false);
    closeSettings();
    toast({
      title: 'Database wiped clean',
      description: 'All project data has been cleared. You now have a fresh canvas to create projects from scratch.',
    });
  };

  return (
    <div className="grain app-shell min-h-[100dvh] bg-background text-foreground">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex flex-col bg-sidebar px-4 py-6 text-sidebar-foreground shadow-2xl shadow-slate-950/10 transition-all duration-300 md:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        } ${collapsed ? 'w-[88px]' : 'w-[256px]'}`}
      >
        <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-between'}`}>
          <Link
            href="/"
            data-testid="link-brand"
            className="group flex items-center"
            onClick={() => setMobileOpen(false)}
          >
            <BrandLogo variant={collapsed ? 'mark' : 'full'} theme="dark" size="md" />
          </Link>
          <button
            type="button"
            aria-label="Close navigation"
            data-testid="button-close-navigation"
            onClick={() => setMobileOpen(false)}
            className="rounded-lg p-2 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground md:hidden"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="mt-9 flex-1 space-y-6 overflow-y-auto">
          {groups.map((group) => {
            const visible = group.items.filter((item) => {
              if (item.allowedRoles) {
                return role ? item.allowedRoles.includes(role) : false;
              }
              return true;
            });
            if (visible.length === 0) return null;
            return (
              <div key={group.label}>
                <p
                  className={`px-3 font-mono text-[9px] uppercase tracking-[.18em] text-sidebar-foreground/40 ${
                    collapsed ? 'text-center px-0' : ''
                  }`}
                >
                  {collapsed ? group.label.slice(0, 2) : group.label}
                </p>
                <div className="mt-2 space-y-1">
                  {visible.map((item) => {
                    const active = item.href === '/' ? location === '/' : location.startsWith(item.href);
                    const Icon = item.icon;
                    return (
                      <Link
                        href={item.href}
                        key={item.href}
                        data-testid={`link-nav-${item.label.toLowerCase().replaceAll(' ', '-')}`}
                        onClick={() => setMobileOpen(false)}
                        title={collapsed ? item.label : undefined}
                        className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[12px] font-semibold transition ${
                          active
                            ? 'bg-sidebar-accent text-sidebar-foreground'
                            : 'text-sidebar-foreground/60 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground'
                        } ${collapsed ? 'justify-center px-0' : ''}`}
                      >
                        <Icon size={16} className={active ? 'text-sidebar-primary' : ''} />
                        {!collapsed && <span>{item.label}</span>}
                        {!collapsed && active && (
                          <ChevronRight size={13} className="ml-auto text-sidebar-foreground/40" />
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {/* User Card & Sidebar Bell */}
        <div className={`border-t border-sidebar-border pt-4 ${collapsed ? 'text-center' : ''}`}>
          <div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : ''}`}>
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#d6a95d] text-[11px] font-bold text-[#173e49]">
              {user?.initials}
            </span>
            {!collapsed && (
              <span className="min-w-0">
                <span className="block truncate text-[11px] font-bold">{user?.name}</span>
                <span className="mt-1 block truncate font-mono text-[9px] uppercase tracking-[.08em] text-sidebar-foreground/50">
                  {user?.title}
                </span>
              </span>
            )}
            {!collapsed && (
              <button
                type="button"
                aria-label="Notifications"
                data-testid="button-notifications"
                onClick={() => setNotificationsOpen(true)}
                className="relative ml-auto rounded-lg p-2 text-sidebar-foreground/55 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              >
                <Bell size={15} />
                {unreadNotifCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-[#d66254] font-mono text-[9px] font-bold text-white">
                    {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
                  </span>
                )}
              </button>
            )}
          </div>
          {!collapsed && (
            <div className="mt-3 flex items-center gap-2 pl-1">
              <span className={`size-1.5 rounded-full ${isConnected ? 'bg-[#66b89b]' : 'bg-[#e5a044]'}`} />
              <span className="font-mono text-[9px] uppercase tracking-[.1em] text-sidebar-foreground/40">
                {isConnected ? 'Server Online' : 'Syncing'}
              </span>
              <button
                type="button"
                onClick={logout}
                className="ml-auto flex items-center gap-1 text-[10px] text-sidebar-foreground/40 hover:text-sidebar-foreground"
              >
                <LogOut size={12} /> Logout
              </button>
            </div>
          )}
        </div>
      </aside>

      {mobileOpen && (
        <button
          type="button"
          aria-label="Close menu overlay"
          data-testid="button-menu-overlay"
          className="fixed inset-0 z-30 bg-[#123b45]/35 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Main Content Area */}
      <main
        className={`min-h-[100dvh] transition-[padding] duration-300 ${collapsed ? 'md:pl-[88px]' : 'md:pl-[256px]'}`}
      >
        <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between border-b border-border/70 bg-background/85 px-5 backdrop-blur-xl md:px-10">
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Open navigation"
              data-testid="button-open-navigation"
              onClick={() => setMobileOpen(true)}
              className="rounded-xl border border-border bg-card p-2.5 text-muted-foreground hover:bg-muted md:hidden"
            >
              <Menu size={18} />
            </button>
            <button
              type="button"
              aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
              onClick={() => setCollapsed((value) => !value)}
              className="hidden rounded-xl border border-border bg-card p-2.5 text-muted-foreground hover:bg-muted md:block"
            >
              <PanelLeft size={16} />
            </button>
            <div className="hidden items-center gap-2 text-[12px] text-muted-foreground sm:flex">
              <span>Encalm Hospitality</span>
              <ChevronRight size={13} className="text-muted-foreground/50" />
              <span className="font-semibold text-foreground">
                {isDetail
                  ? 'Project view'
                  : location === '/'
                    ? 'Portfolio overview'
                    : (currentSectionLabel(location) ?? 'Workspace')}
              </span>
            </div>
            <span className="font-mono text-[10px] uppercase tracking-[.14em] text-muted-foreground sm:hidden">
              {isDetail ? 'Project view' : 'Projects'}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span
              className={`hidden rounded-full px-3 py-1.5 font-mono text-[9px] uppercase tracking-[.12em] sm:inline-flex ${
                role === 'coordinator'
                  ? 'bg-[#ebdcb9] text-[#664b14]'
                  : isLead
                    ? 'bg-[#e4f1ec] text-[#2e7c67]'
                    : 'bg-[#dbeef7] text-[#1a5068]'
              }`}
            >
              {role === 'coordinator'
                ? 'Project coordinator'
                : isLead
                  ? 'Project lead'
                  : role === 'viewer'
                    ? 'Viewer · Read-only'
                    : 'Project HOD · Read-only'}
            </span>

            {/* Live Server Sync Indicator */}
            <span
              className={`hidden items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-semibold sm:flex ${
                isConnected
                  ? 'border-[#cbe4d9] bg-[#edf5f0] text-[#2e7c67]'
                  : 'border-[#eadcb1] bg-[#fbf1d8] text-[#9a711f]'
              }`}
            >
              <span className={`size-2 rounded-full ${isConnected ? 'bg-[#3d9a7e] animate-pulse' : 'bg-[#d19b35]'}`} />
              {isConnected ? 'Backend Active' : 'Connecting'}
            </span>

            {/* Header Notifications Icon Button */}
            <button
              type="button"
              aria-label="Open notifications"
              onClick={() => setNotificationsOpen(true)}
              className="relative rounded-lg border border-border bg-card p-2 text-muted-foreground hover:bg-muted"
            >
              <Bell size={16} />
              {unreadNotifCount > 0 && (
                <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-[#d66254] font-mono text-[9px] font-bold text-white">
                  {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
                </span>
              )}
            </button>

            {/* Header Email Hub Button (coordinator only: outbox and settings are coordinator-restricted) */}
            {role === 'coordinator' && (
              <button
                type="button"
                aria-label="Open email outbox and settings"
                onClick={() => setEmailHubOpen(true)}
                className="rounded-lg border border-border bg-card p-2 text-muted-foreground hover:bg-muted"
                title="Email Outbox & Delivery Radar"
              >
                <Mail size={16} />
              </button>
            )}

            {/* Header Settings Button */}
            <button
              type="button"
              aria-label="Open settings"
              data-testid="button-settings"
              ref={settingsTriggerRef}
              aria-haspopup="dialog"
              aria-expanded={settingsOpen}
              onClick={() => {
                setSettingsOpen(true);
                setResetConfirm(false);
              }}
              className={`rounded-lg border border-border bg-card p-2 text-muted-foreground hover:bg-muted ${
                settingsOpen ? 'bg-muted text-foreground' : ''
              }`}
            >
              <Settings size={16} />
            </button>
          </div>
        </header>

        {children}
      </main>

      {/* Notifications Drawer / Slide-Over */}
      {notificationsOpen && (
        <div
          role="presentation"
          className="fixed inset-0 z-50 flex items-start justify-end bg-[#123b45]/30 p-3 backdrop-blur-[2px] sm:p-5"
          onClick={(event) => {
            if (event.target === event.currentTarget) closeNotifications();
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="notifications-title"
            className="fade-up flex max-h-[calc(100dvh-24px)] w-full max-w-[450px] flex-col overflow-hidden rounded-2xl border border-border bg-[#f7f4ec] shadow-2xl shadow-[#173e49]/20 sm:max-h-[calc(100dvh-40px)]"
          >
            <div className="flex items-center justify-between border-b border-border bg-white/70 p-5">
              <div>
                <div className="flex items-center gap-2">
                  <h2 id="notifications-title" className="font-serif text-[24px] font-bold text-[#173e49]">
                    Notifications
                  </h2>
                  {unreadNotifCount > 0 && (
                    <span className="rounded-full bg-[#fae5e1] px-2 py-0.5 font-mono text-[10px] font-bold text-[#b2473d]">
                      {unreadNotifCount} unread
                    </span>
                  )}
                </div>
                <p className="mt-1 font-mono text-[9px] uppercase tracking-[.14em] text-muted-foreground">
                  Portfolio alerts & control radar
                </p>
              </div>

              <div className="flex items-center gap-2">
                {unreadNotifCount > 0 && (
                  <button
                    type="button"
                    title="Mark all as read"
                    onClick={markAllNotificationsRead}
                    className="flex items-center gap-1 rounded-lg border border-border bg-white px-2.5 py-1.5 text-[10px] font-bold text-[#2e7c67] hover:bg-[#edf5f0]"
                  >
                    <CheckCheck size={13} /> Read all
                  </button>
                )}
                <button
                  type="button"
                  ref={notifCloseRef}
                  aria-label="Close notifications"
                  onClick={closeNotifications}
                  className="rounded-lg p-2 text-muted-foreground hover:bg-white"
                >
                  <X size={17} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {notifications.length === 0 ? (
                <div className="py-16 text-center">
                  <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#edf5f0] text-[#3d9a7e]">
                    <Check size={20} />
                  </span>
                  <p className="mt-4 text-[13px] font-bold text-[#173e49]">All clear</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    No active issues, late milestones, or pending approvals.
                  </p>
                </div>
              ) : (
                notifications.map((notif) => {
                  const isUnread = !notif.read;
                  return (
                    <div
                      key={notif.id}
                      className={`group relative rounded-xl border p-3.5 transition ${
                        isUnread ? 'border-[#eadcb1] bg-white shadow-sm' : 'border-border/70 bg-white/60 opacity-80'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg ${
                            notif.type === 'milestone_overdue'
                              ? 'bg-[#fae5e1] text-[#b2473d]'
                              : notif.type === 'approval_required'
                                ? 'bg-[#f8edcf] text-[#9a711f]'
                                : notif.type === 'high_issue'
                                  ? 'bg-[#fae5e1] text-[#b2473d]'
                                  : notif.type === 'tagged_issue'
                                    ? 'bg-[#edf5f0] text-[#2e7c67]'
                                    : notif.type === 'tagged_task'
                                      ? 'bg-[#f8edcf] text-[#9a711f]'
                                      : 'bg-[#edf5f0] text-[#2e7c67]'
                          }`}
                        >
                          {notif.type === 'milestone_overdue' && <AlertTriangle size={14} />}
                          {notif.type === 'approval_required' && <Clock3 size={14} />}
                          {notif.type === 'high_issue' && <ShieldAlert size={14} />}
                          {notif.type === 'tagged_issue' && <Tag size={14} />}
                          {notif.type === 'tagged_task' && <UserCheck size={14} />}
                          {notif.type === 'system' && <Activity size={14} />}
                        </span>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="text-[12px] font-bold text-foreground">{notif.title}</h3>
                            {isUnread && (
                              <button
                                type="button"
                                title="Mark read"
                                onClick={() => markNotificationRead(notif.id)}
                                className="shrink-0 text-[10px] font-bold text-muted-foreground hover:text-[#2e7c67]"
                              >
                                Mark read
                              </button>
                            )}
                          </div>
                          <p className="mt-1 text-[11px] leading-5 text-muted-foreground">{notif.message}</p>
                          {notif.link && (
                            <Link
                              href={notif.link}
                              onClick={() => {
                                markNotificationRead(notif.id);
                                closeNotifications();
                              }}
                              className="mt-2.5 inline-flex items-center gap-1 font-mono text-[10px] font-bold text-[#2e7c67] hover:underline"
                            >
                              Open project <ChevronRight size={11} />
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>
      )}

      {/* Settings Dialog */}
      {settingsOpen && (
        <div
          role="presentation"
          className="fixed inset-0 z-50 flex items-start justify-end bg-[#123b45]/25 p-3 backdrop-blur-[2px] sm:p-5"
          onClick={(event) => {
            if (event.target === event.currentTarget) closeSettings();
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-title"
            className="fade-up max-h-[calc(100dvh-24px)] w-full max-w-[430px] overflow-y-auto rounded-2xl border border-border bg-[#f7f4ec] p-5 shadow-2xl shadow-[#173e49]/20 sm:max-h-[calc(100dvh-40px)] sm:p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-[9px] uppercase tracking-[.16em] text-[#9a711f]">Workspace settings</p>
                <h2
                  id="settings-title"
                  className="mt-2 font-serif text-[32px] leading-none tracking-[-.04em] text-[#173e49]"
                >
                  Settings
                </h2>
              </div>
              <button
                type="button"
                ref={settingsCloseRef}
                aria-label="Close settings"
                data-testid="button-close-settings"
                onClick={closeSettings}
                className="rounded-lg p-2 text-muted-foreground hover:bg-white"
              >
                <X size={17} />
              </button>
            </div>

            <div className="mt-6 flex items-center gap-3 rounded-xl border border-border bg-white/70 p-3.5">
              <span className="grid size-10 place-items-center rounded-full bg-[#d6a95d] text-[11px] font-bold text-[#173e49]">
                {user?.initials}
              </span>
              <span className="min-w-0 flex-1">
                <strong className="block truncate text-[12px]">{user?.name}</strong>
                <span className="mt-1 block truncate font-mono text-[9px] uppercase tracking-[.1em] text-muted-foreground">
                  {user?.email}
                </span>
              </span>
              <span
                className={`rounded-full px-2 py-1 font-mono text-[8px] uppercase tracking-[.1em] ${
                  isLead ? 'bg-[#e4f1ec] text-[#2e7c67]' : 'bg-[#f8edcf] text-[#9a711f]'
                }`}
              >
                {role === 'coordinator' ? 'Coordinator' : isLead ? 'Lead' : role === 'viewer' ? 'Viewer' : 'HOD'}
              </span>
            </div>

            {/* System / Database Status */}
            <div className="mt-6">
              <p className="font-mono text-[9px] uppercase tracking-[.14em] text-muted-foreground">
                System architecture
              </p>
              <div className="mt-3 rounded-xl border border-border bg-white/70 p-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Server size={14} className="text-[#3d9a7e]" />
                    <span className="text-[11px] font-bold">Express API Backend</span>
                  </div>
                  <span className="rounded-full bg-[#e4f1ec] px-2 py-0.5 font-mono text-[8px] font-bold text-[#2e7c67]">
                    Port 5000
                  </span>
                </div>
                <div className="mt-2.5 flex items-center justify-between border-t border-border/60 pt-2.5 text-[10px] text-muted-foreground">
                  <span>Database Engine</span>
                  <span className="font-mono font-bold text-foreground">SQLite 3 (WAL mode)</span>
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>Authentication</span>
                  <span className="font-mono font-bold text-foreground">JWT Bearer + bcrypt</span>
                </div>
              </div>
            </div>

            <div className="mt-6">
              <p className="font-mono text-[9px] uppercase tracking-[.14em] text-muted-foreground">Preferences</p>
              <div className="mt-3 divide-y divide-border overflow-hidden rounded-xl border border-border bg-white/70">
                <button
                  type="button"
                  onClick={() => setCollapsed((value) => !value)}
                  className="flex w-full items-center gap-3 p-3.5 text-left hover:bg-white"
                >
                  <span className="grid size-8 place-items-center rounded-lg bg-[#e4f1ec] text-[#2e7c67]">
                    <Settings size={15} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <strong className="block text-[11px]">Compact navigation</strong>
                    <span className="mt-1 block text-[10px] text-muted-foreground">
                      Keep the sidebar collapsed on desktop.
                    </span>
                  </span>
                  <span
                    className={`relative h-5 w-9 rounded-full transition ${
                      collapsed ? 'bg-[#3d9a7e]' : 'bg-[#c8cec9]'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 size-4 rounded-full bg-white shadow-sm transition ${
                        collapsed ? 'left-[18px]' : 'left-0.5'
                      }`}
                    />
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setReminders((value) => !value)}
                  className="flex w-full items-center gap-3 p-3.5 text-left hover:bg-white"
                >
                  <span className="grid size-8 place-items-center rounded-lg bg-[#f8edcf] text-[#9a711f]">
                    <Bell size={15} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <strong className="block text-[11px]">Update reminders</strong>
                    <span className="mt-1 block text-[10px] text-muted-foreground">
                      Keep project update reminders enabled.
                    </span>
                  </span>
                  <span
                    className={`relative h-5 w-9 rounded-full transition ${
                      reminders ? 'bg-[#3d9a7e]' : 'bg-[#c8cec9]'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 size-4 rounded-full bg-white shadow-sm transition ${
                        reminders ? 'left-[18px]' : 'left-0.5'
                      }`}
                    />
                  </span>
                </button>
              </div>
            </div>

            <div className="mt-6">
              <p className="font-mono text-[9px] uppercase tracking-[.14em] text-muted-foreground">Access</p>
              <div className="mt-3 flex items-start gap-3 rounded-xl border border-[#cbe4d9] bg-[#edf5f0] p-3.5">
                <ShieldCheck size={17} className="mt-0.5 shrink-0 text-[#2e7c67]" />
                <p className="text-[11px] leading-5 text-[#517167]">
                  {isLead
                    ? 'You can create projects and update delivery, commercial, milestone, issue, risk, and update records.'
                    : role === 'viewer'
                      ? 'You have view-only access: you can see every project, but not change, tag or email anything.'
                      : 'You have read-only access to the portfolio. Project changes are restricted to Project Leads.'}
                </p>
              </div>
            </div>

            {role === 'coordinator' && (
              <div className="mt-6 border-t border-border pt-5">
                <p className="font-mono text-[9px] uppercase tracking-[.14em] text-muted-foreground">
                  Communications & Integration
                </p>
                <div className="mt-3 rounded-xl border border-border bg-white/70 p-3.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="grid size-7 place-items-center rounded-lg bg-[#edf5f0] text-[#2e7c67]">
                        <Mail size={14} />
                      </span>
                      <div>
                        <strong className="block text-[11px]">Email Radar & SMTP</strong>
                        <span className="block text-[9px] text-muted-foreground">Outbox history & server setup</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setEmailHubOpen(true);
                        closeSettings();
                      }}
                      className="rounded-lg border border-[#cbe4d9] bg-[#edf5f0] px-3 py-1.5 text-[10px] font-bold text-[#2e7c67] hover:bg-[#dfeee5]"
                    >
                      Manage
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-6 border-t border-border pt-5">
              <p className="font-mono text-[9px] uppercase tracking-[.14em] text-muted-foreground">
                Database management & Backup
              </p>

              {role === 'coordinator' && <ServerBackupsCard />}

              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImportFile}
                accept=".json,application/json"
                className="hidden"
              />

              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleExportBackup}
                  className="flex items-center gap-2 rounded-xl border border-border bg-white/70 p-3 text-left hover:bg-white hover:border-[#1e5141]"
                >
                  <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-[#edf5f0] text-[#1e5141]">
                    <Download size={14} />
                  </span>
                  <div className="min-w-0">
                    <strong className="block text-[11px] truncate">Export Backup</strong>
                    <span className="block text-[9px] text-muted-foreground truncate">Save JSON file</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 rounded-xl border border-border bg-white/70 p-3 text-left hover:bg-white hover:border-[#1e5141]"
                >
                  <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-[#edf5f0] text-[#1e5141]">
                    <Upload size={14} />
                  </span>
                  <div className="min-w-0">
                    <strong className="block text-[11px] truncate">Import Backup</strong>
                    <span className="block text-[9px] text-muted-foreground truncate">Restore JSON</span>
                  </div>
                </button>
              </div>

              {resetConfirm ? (
                <div className="mt-3 rounded-xl border border-[#f0c8c2] bg-[#fff5f2] p-3.5">
                  <p className="text-[11px] font-bold text-[#b2473d]">Clear all project data?</p>
                  <p className="mt-1 text-[10px] leading-4 text-muted-foreground">
                    This removes all projects, stages, milestones, issues, and updates so you can enter everything from
                    scratch.
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={handleClearAllData}
                      className="rounded-lg bg-[#b2473d] px-3 py-2 text-[10px] font-bold text-white hover:bg-[#9a3b32]"
                    >
                      Clear everything
                    </button>
                    <button
                      type="button"
                      onClick={() => setResetConfirm(false)}
                      className="rounded-lg border border-border bg-white px-3 py-2 text-[10px] font-bold"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setResetConfirm(true)}
                  className="mt-3 flex w-full items-center gap-3 rounded-xl border border-border bg-white/70 p-3.5 text-left hover:bg-white"
                >
                  <span className="grid size-8 place-items-center rounded-lg bg-[#fae5e1] text-[#b2473d]">
                    <RotateCcw size={15} />
                  </span>
                  <span>
                    <strong className="block text-[11px]">Clear all project data</strong>
                    <span className="mt-1 block text-[10px] text-muted-foreground">
                      Remove all data and start with an empty portfolio from scratch.
                    </span>
                  </span>
                </button>
              )}
            </div>
          </section>
        </div>
      )}

      {/* Global Email Outbox & Settings Hub Modal */}
      <EmailHubModal isOpen={emailHubOpen} onClose={() => setEmailHubOpen(false)} defaultTab="outbox" />
    </div>
  );
}

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

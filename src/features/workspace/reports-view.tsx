import { useMemo, useRef } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  CircleDollarSign,
  Download,
  FileBarChart,
  Plus,
  ShieldAlert,
  Target,
  TrendingUp,
} from 'lucide-react';
import { formatCrore } from '@/data/projects';
import { useAppState } from '@/state/app-state';
import { useToast } from '@/hooks/use-toast';
import { todayIso } from '@/lib/date';
import { errorMessage } from '@/lib/utils';
import { buildPortfolioCsv, downloadCsv } from './csv';
import { PageHeader } from './page-header';

export function ReportsView() {
  const { projects, addProject } = useAppState();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const summary = useMemo(() => {
    const total = projects.length;
    const delayed = projects.filter((project) => project.health === 'Delayed').length;
    const atRisk = projects.filter((project) => project.health === 'At risk').length;
    const averageProgress = total
      ? Math.round(projects.reduce((sum, project) => sum + project.progress, 0) / total)
      : 0;
    const openMilestones = projects.reduce(
      (sum, project) => sum + project.milestones.filter((milestone) => milestone.status !== 'complete').length,
      0,
    );
    const totalAop = projects.reduce((sum, project) => sum + project.aop, 0);
    return { total, delayed, atRisk, averageProgress, openMilestones, totalAop };
  }, [projects]);

  const exportCsv = () => {
    if (projects.length === 0) {
      toast({ title: 'Nothing to export', description: 'There are no projects in this view.' });
      return;
    }
    try {
      downloadCsv(buildPortfolioCsv(projects), `encalm-portfolio-${todayIso()}.csv`);
      toast({ title: 'Export ready', description: `${projects.length} projects written to CSV.` });
    } catch {
      toast({
        variant: 'destructive',
        title: 'Export failed',
        description: 'Your browser blocked the download. Check its download settings.',
      });
    }
  };

  const exportJsonBackup = () => {
    if (projects.length === 0) {
      toast({ title: 'Nothing to backup', description: 'There are no projects to backup.' });
      return;
    }
    const blob = new Blob([JSON.stringify(projects, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `encalm-projects-backup-${todayIso()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Backup downloaded', description: `Full portfolio backup saved as JSON.` });
  };

  const handleImportFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const imported = JSON.parse(text);
        if (!Array.isArray(imported)) throw new Error('Invalid backup file format');
        let count = 0;
        for (const p of imported) {
          if (p?.name && p?.location) {
            await addProject(p);
            count++;
          }
        }
        toast({ title: 'Backup restored', description: `Restored ${count} projects successfully.` });
      } catch (err) {
        toast({
          variant: 'destructive',
          title: 'Restore failed',
          description: errorMessage(err, 'Could not parse JSON file.'),
        });
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const cards: { label: string; value: string; icon: typeof TrendingUp }[] = [
    { label: 'Portfolio summary', value: `${summary.total} active projects`, icon: TrendingUp },
    { label: 'Project health', value: `${summary.atRisk} at risk · ${summary.delayed} delayed`, icon: ShieldAlert },
    { label: 'Project progress', value: `${summary.averageProgress}% average`, icon: Target },
    { label: 'Delayed projects', value: `${summary.delayed} need recovery plans`, icon: AlertTriangle },
    { label: 'Open milestones', value: `${summary.openMilestones} control points ahead`, icon: CalendarDays },
    { label: 'Commercial summary', value: `${formatCrore(summary.totalAop)} total AOP`, icon: CircleDollarSign },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Reports & Backup"
        title="Project reports & Data Persistence"
        description="Reporting views for portfolio reviews and full data backup & restore."
      />
      <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-start justify-between">
              <span className="font-mono text-[9px] uppercase tracking-[.14em] text-muted-foreground">{label}</span>
              <Icon size={17} className="text-muted-foreground/60" />
            </div>
            <p className="mt-5 text-[18px] font-extrabold">{value}</p>
            <button
              type="button"
              onClick={exportCsv}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-[#f7f4ec] px-3 py-2.5 text-[10px] font-bold hover:bg-[#fbf1d8]"
            >
              <FileBarChart size={14} /> Export as CSV
            </button>
          </div>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={exportCsv}
          className="inline-flex items-center gap-2 rounded-xl bg-[#173e49] px-4 py-3 text-[11px] font-extrabold text-white hover:bg-[#204f59]"
        >
          <Download size={15} /> Export full portfolio (CSV)
        </button>

        <button
          type="button"
          onClick={exportJsonBackup}
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-white px-4 py-3 text-[11px] font-extrabold text-[#173e49] hover:bg-[#fbf1d8]"
        >
          <Download size={15} /> Download Full Backup (JSON)
        </button>

        <input type="file" accept=".json" ref={fileInputRef} onChange={handleImportFile} className="hidden" />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center gap-2 rounded-xl border border-[#cbe4d9] bg-[#edf5f0] px-4 py-3 text-[11px] font-extrabold text-[#2e7c67] hover:bg-[#dff0e7]"
        >
          <Plus size={15} /> Restore from Backup (JSON)
        </button>
      </div>
    </>
  );
}

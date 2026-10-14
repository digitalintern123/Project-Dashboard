import { useCallback, useEffect, useState } from 'react';
import { DatabaseBackup, Loader2 } from 'lucide-react';
import { api, type BackupStatus } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { errorMessage } from '@/lib/utils';

const sizeLabel = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

const whenLabel = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** Coordinator view of the server's automatic database backups, with "Back up now". */
export function ServerBackupsCard() {
  const [status, setStatus] = useState<BackupStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  const load = useCallback(() => {
    api.system
      .backups()
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);
  useEffect(load, [load]);

  const backUpNow = async () => {
    setBusy(true);
    try {
      const res = await api.system.backupNow();
      setStatus(res);
      toast({
        title: 'Backup complete',
        description: res.result.ok ? `${res.result.projects} projects saved (${sizeLabel(res.result.size)}).` : '',
      });
    } catch (err) {
      toast({ title: 'Backup failed', description: errorMessage(err, 'Could not back up.'), variant: 'destructive' });
      load();
    } finally {
      setBusy(false);
    }
  };

  const failed = status?.lastRun && !status.lastRun.ok ? status.lastRun : null;

  return (
    <div className="mt-3 rounded-xl border border-border bg-white/70 p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-[#edf5f0] text-[#1e5141]">
            <DatabaseBackup size={14} />
          </span>
          <div className="min-w-0 text-[10px] leading-4 text-muted-foreground">
            <strong className="block text-[11px] text-foreground">Server backups</strong>
            {status?.newest ? (
              <span className="block">
                Last backup: {whenLabel(status.newest.createdAt)} · {sizeLabel(status.newest.size)} · {status.count}{' '}
                kept
              </span>
            ) : (
              <span className="block">{status ? 'No backup yet.' : 'Status unavailable.'}</span>
            )}
            {status && (
              <span className="block">
                {status.enabled
                  ? `Automatic daily at ${status.time} (server time), kept ${status.retentionDays} days.`
                  : 'Automatic backups are off on this server.'}
              </span>
            )}
            {failed && <span className="block text-[#b2473d]">Last attempt failed: {failed.error}</span>}
          </div>
        </div>
        <button
          type="button"
          onClick={backUpNow}
          disabled={busy}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-[#cbe4d9] bg-[#edf5f0] px-3 py-1.5 text-[10px] font-bold text-[#2e7c67] hover:bg-[#dfeee5] disabled:opacity-50"
        >
          {busy && <Loader2 size={11} className="animate-spin" />}
          {busy ? 'Backing up…' : 'Back up now'}
        </button>
      </div>
    </div>
  );
}

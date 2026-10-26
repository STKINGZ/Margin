import { Download } from 'lucide-react';
import { useBackupDownload } from '@/lib/backup';
import { Btn } from '@/components/ui-bits';

export function BackupButton({ compact = false }: { compact?: boolean }) {
  const b = useBackupDownload();
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Btn tone={compact ? 'plain' : 'soft'} disabled={b.pending} onClick={b.run} data-testid="button-download-backup" aria-busy={b.pending}>
        <Download className="size-4" aria-hidden /> {b.pending ? 'Preparing backup…' : 'Download backup'}
      </Btn>
      {b.error && <span role="alert" className="text-xs text-destructive" data-testid="text-backup-error">{b.error}</span>}
    </span>
  );
}

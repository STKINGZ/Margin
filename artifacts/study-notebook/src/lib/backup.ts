import { useState } from 'react';
import { downloadBackup } from '@workspace/api-client-react';
import { errorText } from './notebook';

export function useBackupDownload() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async () => {
    setPending(true); setError(null);
    try {
      const data = await downloadBackup();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
      a.href = url;
      a.download = `margin-notebook-backup-${stamp}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError(errorText(e, 'Backup download failed.'));
    } finally {
      setPending(false);
    }
  };
  return { run, pending, error };
}

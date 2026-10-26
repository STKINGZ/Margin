import { useQueryClient } from '@tanstack/react-query';
import {
  getGetNotebookQueryKey,
  getListItemsQueryKey,
  getListMessagesQueryKey,
} from '@workspace/api-client-react';

export function useInvalidateNotebook() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: getListMessagesQueryKey() });
    qc.invalidateQueries({ queryKey: getListItemsQueryKey({ status: 'pending' }) });
    qc.invalidateQueries({ queryKey: getListItemsQueryKey({ status: 'approved' }) });
    qc.invalidateQueries({ queryKey: getGetNotebookQueryKey() });
  };
}

export function errorText(e: unknown, fallback = 'Something went wrong. Please try again.') {
  if (e && typeof e === 'object') {
    const o = e as { data?: { error?: string; message?: string }; message?: string };
    return o.data?.error || o.data?.message || o.message || fallback;
  }
  return fallback;
}

export function fmtDate(s: string) {
  const d = new Date(s);
  return isNaN(d.getTime())
    ? ''
    : d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

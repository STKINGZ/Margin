import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { useIsMutating, useQueryClient } from '@tanstack/react-query';
import { activateCourse, deleteCourse, getGetNotebookQueryOptions } from '@workspace/api-client-react';
import { clearTutorSession } from './tutor-session';
import { errorText } from './notebook';

type Ctx = { switching: boolean; error: string | null; switchTo: (id: number) => Promise<boolean>; removeCourse: (id: number) => Promise<boolean>; clearError: () => void };
const CourseSwitchContext = createContext<Ctx | null>(null);

export function CourseSwitchProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const removeCourse = useCallback(async (id: number) => {
    setSwitching(true);
    setError(null);
    try {
      await deleteCourse(id);
      await qc.cancelQueries();
      qc.removeQueries();
      clearTutorSession();
      await qc.fetchQuery(getGetNotebookQueryOptions());
      return true;
    } catch (e) {
      setError(errorText(e, 'Could not delete the course.'));
      return false;
    } finally {
      setSwitching(false);
    }
  }, [qc]);
  const switchTo = useCallback(async (id: number) => {
    setSwitching(true);
    setError(null);
    try {
      await activateCourse(id);
      // Drop every course-scoped cache before the new course mounts. Auth lives in Clerk, not here.
      await qc.cancelQueries();
      qc.removeQueries();
      clearTutorSession();
      await qc.fetchQuery(getGetNotebookQueryOptions());
      return true;
    } catch (e) {
      setError(errorText(e, 'Could not switch course.'));
      return false;
    } finally {
      setSwitching(false);
    }
  }, [qc]);
  return (
    <CourseSwitchContext.Provider value={{ switching, error, switchTo, removeCourse, clearError: () => setError(null) }}>
      {children}
    </CourseSwitchContext.Provider>
  );
}

export function useCourseSwitch() {
  const ctx = useContext(CourseSwitchContext);
  if (!ctx) throw new Error('useCourseSwitch outside provider');
  return ctx;
}

/** True while any write is in flight; switching then could let an old result land in a new course. */
export function useWritesPending() {
  return useIsMutating() > 0;
}

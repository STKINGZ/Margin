export type TutorSession = { contextId: string; sourceId: number | null; courseId?: number | null };
const key = 'margin-tutor-session';

export function newTutorSession(sourceId: number | null, courseId: number | null = null): TutorSession {
  return { contextId: crypto.randomUUID(), sourceId, courseId };
}

/** Reads the saved tutor context, discarding it when it belongs to a different course. */
export function readTutorSession(courseId: number | null = null): TutorSession {
  try {
    const saved = JSON.parse(sessionStorage.getItem(key) ?? 'null');
    if (saved && typeof saved.contextId === 'string' && /^[a-zA-Z0-9-]{16,80}$/.test(saved.contextId)
      && (saved.sourceId === null || Number.isInteger(saved.sourceId))
      && (saved.courseId ?? null) === courseId) return saved;
  } catch { /* Storage can be disabled; in-memory isolation still works. */ }
  return newTutorSession(null, courseId);
}

export function saveTutorSession(session: TutorSession) {
  try { sessionStorage.setItem(key, JSON.stringify(session)); }
  catch { /* Keep an in-memory session if browser storage is unavailable. */ }
}

export function clearTutorSession() {
  try { sessionStorage.removeItem(key); } catch { /* ignore */ }
}

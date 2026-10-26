export type TutorSession = { contextId: string; sourceId: number | null };
const key = 'margin-tutor-session';

export function newTutorSession(sourceId: number | null): TutorSession {
  return { contextId: crypto.randomUUID(), sourceId };
}

export function readTutorSession(): TutorSession {
  try {
    const saved = JSON.parse(sessionStorage.getItem(key) ?? 'null');
    if (saved && typeof saved.contextId === 'string' && /^[a-zA-Z0-9-]{16,80}$/.test(saved.contextId)
      && (saved.sourceId === null || Number.isInteger(saved.sourceId))) return saved;
  } catch { /* Storage can be disabled; in-memory isolation still works. */ }
  return newTutorSession(null);
}

export function saveTutorSession(session: TutorSession) {
  try { sessionStorage.setItem(key, JSON.stringify(session)); }
  catch { /* Keep an in-memory session if browser storage is unavailable. */ }
}

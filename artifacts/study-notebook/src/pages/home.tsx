import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'wouter';
import { ArrowUp, FileUp, History, Inbox, Mic, Square, Sparkles } from 'lucide-react';
import { useDictation } from '@/hooks/use-dictation';
import { newTutorSession, readTutorSession, saveTutorSession } from '@/lib/tutor-session';
import {
  useGetNotebook,
  useListItems,
  useListMessages,
  useSendMessage,
  type Message,
} from '@workspace/api-client-react';
import { CitationChips } from '@/components/citations';
import { ItemCard } from '@/components/item-card';
import { Btn, Empty, ErrorNote, SkeletonLines, fieldCls } from '@/components/ui-bits';
import { errorText, fmtDate, useInvalidateNotebook } from '@/lib/notebook';

type Level = 'beginner' | 'intermediate' | 'advanced';
const suggestions = [
  'Walk me through the key ideas of this source.',
  'Quiz me on what I should know cold.',
  'Explain the hardest concept as simply as you can.',
  'What commonly confuses students here?',
];

function Bubble({ m }: { m: Message }) {
  const mine = m.role === 'user';
  return (
    <div className={`rise flex ${mine ? 'justify-end' : 'justify-start'}`} data-testid={`message-${m.id}`}>
      <div className={`max-w-[92%] sm:max-w-[85%] rounded-2xl px-4 py-3 ${mine ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-card border rounded-bl-sm shadow-sm'}`}>
        <p className={`whitespace-pre-wrap leading-relaxed ${mine ? 'text-[0.95rem]' : 'font-reading text-[1.08rem] leading-[1.7]'}`}>{m.content}</p>
        {!mine && <CitationChips citations={m.citations} />}
        <p className={`mt-1.5 text-[11px] ${mine ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>{fmtDate(m.createdAt)}</p>
      </div>
    </div>
  );
}

type Thread = { contextId: string; sourceId: number | null; first: string; last: string; count: number };

function useThreads(msgs: Message[] | undefined) {
  return useMemo(() => {
    const map = new Map<string, Thread>();
    const legacy: Message[] = [];
    for (const m of msgs ?? []) {
      if (!m.contextId) { legacy.push(m); continue; }
      const key = JSON.stringify([m.contextId, m.sourceId ?? null]);
      const t = map.get(key);
      if (t) { t.count++; if (m.createdAt > t.last) t.last = m.createdAt; }
      else map.set(key, { contextId: m.contextId, sourceId: m.sourceId ?? null, first: m.role === 'user' ? m.content : '', last: m.createdAt, count: 1 });
      const cur = map.get(key)!;
      if (!cur.first && m.role === 'user') cur.first = m.content;
    }
    return { threads: [...map.values()].sort((a, b) => b.last.localeCompare(a.last)), legacy };
  }, [msgs]);
}

function Tutor() {
  const nb = useGetNotebook();
  const courseId = nb.data?.activeCourseId ?? null;
  const msgs = useListMessages();
  const send = useSendMessage();
  const invalidate = useInvalidateNotebook();
  const [draft, setDraft] = useState('');
  const voice = useDictation(draft, setDraft);
  const [session, setSession] = useState(() => readTutorSession(courseId));
  const [legacyView, setLegacyView] = useState(false);
  const {sourceId, contextId} = session;
  const { threads, legacy } = useThreads(msgs.data);
  const sourceName = (id: number | null | undefined) => {
    if (id == null) return 'All sources';
    const s = nb.data?.sources.find(x => x.id === id);
    return s ? `${s.lecture}: ${s.title}` : `Source ${id}`;
  };
  const activeMessages = legacyView ? legacy : msgs.data?.filter(m => m.contextId === contextId && (m.sourceId ?? null) === sourceId);
  const resetComposer = () => { voice.cancel(); setDraft(''); setNote(null); send.reset(); };
  useEffect(() => { saveTutorSession(session); }, [session]);
  const [level, setLevel] = useState<Level>('intermediate');
  const [inflight, setInflight] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [activeMessages?.length, contextId, inflight]);

  const submit = (content: string, fromDraft: boolean) => {
    const text = content.trim();
    if (!text || send.isPending || legacyView) return;
    voice.cancel();
    setInflight(text);
    setNote(null);
    send.mutate(
      { data: { content: text, sourceId, contextId, level } },
      {
        onSuccess: (r) => {
          if (fromDraft) setDraft('');
          if (r.extractedCount > 0) setNote(`${r.extractedCount} new item${r.extractedCount === 1 ? '' : 's'} added to your review queue.`);
          invalidate();
        },
        onSettled: () => setInflight(null),
      },
    );
  };

  return (
    <section aria-label="Tutor conversation" className="flex flex-col rounded-2xl border bg-muted/40 min-h-[70dvh] lg:h-[calc(100dvh-10rem)]">
      <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-4" aria-live="polite">
        {msgs.isLoading && <SkeletonLines n={2} />}
        {msgs.isError && <ErrorNote message={errorText(msgs.error, 'Could not load the conversation.')} onRetry={() => msgs.refetch()} />}
        {nb.data && nb.data.sources.length === 0 && (
          <Empty title="This course has no material yet" icon={<FileUp className="size-5" />}>
            Upload a PDF or text file so the tutor has something to cite.
            <Link href="/courses" className="mt-3 block font-medium text-primary underline underline-offset-2" data-testid="link-upload-material">Go to Courses to upload</Link>
          </Empty>
        )}
        {legacyView && (
          <p role="status" className="rounded-lg bg-accent/60 px-3 py-2 text-xs text-accent-foreground" data-testid="text-legacy-history">
            Earlier notebook history, read-only. These messages predate saved conversations and are never sent to the tutor as context.
          </p>
        )}
        {activeMessages?.length === 0 && !!nb.data?.sources.length && (
          <Empty title="Start with a question" icon={<Sparkles className="size-5" />}>
            {sourceId ? `Fresh context for ${nb.data?.sources.find(x => x.id === sourceId)?.title ?? 'this source'}.` : `Pick a source below, or ask anything about ${nb.data?.course ?? 'this course'}.`}
            <span className="block mt-2 text-xs">Switching sources starts a fresh conversation. Earlier conversations stay under Conversations and can be resumed.</span>
          </Empty>
        )}
        {activeMessages?.map((m) => (
          <div key={m.id}>
            {legacyView && <p className="mb-1 text-[11px] text-muted-foreground">{sourceName(m.sourceId)}</p>}
            <Bubble m={m} />
          </div>
        ))}
        {inflight && (
          <>
            <div className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary/70 px-4 py-3 text-primary-foreground text-[0.95rem] whitespace-pre-wrap">{inflight}</div>
            </div>
            <div className="flex" role="status" aria-label="Tutor is thinking" data-testid="status-thinking">
              <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm border bg-card px-4 py-3 text-sm text-muted-foreground">
                <span className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="dot size-1.5 rounded-full bg-primary" style={{ animationDelay: `${i * 0.18}s` }} />
                  ))}
                </span>
                Reading the sources
              </div>
            </div>
          </>
        )}
        <div ref={endRef} />
      </div>

      <div className="border-t bg-card/90 p-3 sm:p-4 rounded-b-2xl space-y-2.5">
        {nb.data && !nb.data.aiReady && (
          <div role="status" className="rounded-lg border border-primary/20 bg-secondary px-3 py-2 text-xs leading-relaxed text-primary">
            <strong>Live tutor setup needed.</strong> Complete Replit’s phone verification to enable AI replies. The source reader, review queue, and Testing Hub still work.
          </div>
        )}
        {send.isError && <ErrorNote message={`${errorText(send.error, 'The tutor could not reply.')} Your message is still in the box.`} />}
        {note && (
          <p role="status" className="rise text-xs text-primary bg-secondary rounded-md px-3 py-1.5" data-testid="text-extracted">
            {note}
          </p>
        )}
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex-1 min-w-48 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1"><History className="size-3" aria-hidden /> Conversations</span>
            <select className={`${fieldCls} mt-0.5`} disabled={send.isPending}
              value={legacyView ? 'legacy' : JSON.stringify([contextId, sourceId])}
              onChange={(e) => {
                resetComposer();
                if (e.target.value === 'legacy') { setLegacyView(true); return; }
                if (e.target.value === 'new') { setLegacyView(false); setSession(newTutorSession(sourceId, courseId)); return; }
                const [cid, sid] = JSON.parse(e.target.value) as [string, number | null];
                setLegacyView(false);
                setSession({ contextId: cid, sourceId: sid, courseId });
              }} data-testid="select-conversation">
              {!legacyView && !threads.some(t => t.contextId === contextId && t.sourceId === sourceId) && (
                <option value={JSON.stringify([contextId, sourceId])}>Current: new conversation · {sourceName(sourceId)}</option>
              )}
              <option value="new">Start a new conversation</option>
              {threads.map(t => (
                <option key={`${t.contextId}-${t.sourceId}`} value={JSON.stringify([t.contextId, t.sourceId])}>
                  {fmtDate(t.last)} · {sourceName(t.sourceId)} · {(t.first || 'Conversation').slice(0, 48)} ({t.count})
                </option>
              ))}
              {legacy.length > 0 && <option value="legacy">Earlier notebook history (read-only, {legacy.length})</option>}
            </select>
          </label>
          {legacyView && <Btn tone="soft" onClick={() => { setLegacyView(false); setSession(newTutorSession(null, courseId)); }} data-testid="button-leave-legacy">Start a new conversation</Btn>}
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 -mx-1 px-1">
          {suggestions.map((s) => (
            <button key={s} disabled={send.isPending || legacyView} onClick={() => submit(s, false)} data-testid={`button-suggest-${suggestions.indexOf(s)}`} className="shrink-0 rounded-full border bg-background px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary disabled:opacity-50">
              {s}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(draft, true);
          }}
          className="space-y-2"
        >
          <div className="flex flex-wrap gap-2">
            <label className="flex-1 min-w-40 text-[11px] text-muted-foreground">
              Source
              <select className={`${fieldCls} mt-0.5`} disabled={send.isPending} value={sourceId ?? ''} onChange={(e) => {
                resetComposer();
                setLegacyView(false);
                setSession(newTutorSession(e.target.value ? Number(e.target.value) : null, courseId));
              }} data-testid="select-source">
                <option value="">All sources</option>
                {nb.data?.sources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.lecture}: {s.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="w-40 text-[11px] text-muted-foreground">
              Level
              <select className={`${fieldCls} mt-0.5`} value={level} onChange={(e) => setLevel(e.target.value as Level)} data-testid="select-level">
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </label>
          </div>
          <div className="flex items-end gap-2">
            <textarea
              value={draft}
              maxLength={6000}
              rows={2}
              aria-label="Message to tutor"
              placeholder={legacyView ? 'Read-only history. Start a new conversation to ask.' : 'Ask about a source, or explain something back'}
              readOnly={voice.listening || legacyView}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  submit(draft, true);
                }
              }}
              className={`${fieldCls} resize-none font-reading text-base`}
              data-testid="input-message"
            />
            <button type="button" onClick={voice.toggle} disabled={!voice.supported || send.isPending}
              aria-label={voice.listening ? 'Stop dictation' : 'Push to talk'}
              aria-pressed={voice.listening}
              title={!voice.supported ? 'Speech recognition is not supported by this browser' : voice.listening ? 'Stop dictation' : 'Push to talk'}
              className={`grid size-10 shrink-0 place-items-center rounded-full border disabled:opacity-40 ${voice.listening ? 'bg-destructive text-white animate-pulse' : 'bg-secondary text-primary'}`}
              data-testid="button-microphone">
              {voice.listening ? <Square className="size-4" /> : <Mic className="size-5" />}
            </button>
            <button type="submit" disabled={send.isPending || !draft.trim() || legacyView} aria-label="Send message" className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition-all hover:bg-primary/90 active:scale-90 disabled:opacity-40" data-testid="button-send">
              <ArrowUp className="size-5" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground" role="status">
            {voice.listening ? 'Listening… Click stop when finished, then review your transcript before sending.'
              : !voice.supported ? 'Voice input is unavailable in this browser. You can still type your message.'
              : 'Push to talk, then click again to stop. Your browser may process audio using its speech service.'}
          </p>
          {voice.error && <p role="alert" className="text-xs text-destructive">{voice.error}</p>}
        </form>
      </div>
    </section>
  );
}

function Queue() {
  const q = useListItems({ status: 'pending' });
  return (
    <aside aria-label="Review queue" className="lg:h-[calc(100dvh-10rem)] lg:overflow-y-auto lg:pr-1">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-reading text-2xl font-semibold">Review queue</h2>
        {q.data && <span className="text-sm text-muted-foreground" data-testid="text-pending-count">{q.data.length} pending</span>}
      </div>
      <p className="mb-4 text-sm text-muted-foreground">Nothing enters your library until you approve it.</p>
      {q.isLoading && <SkeletonLines n={3} />}
      {q.isError && <ErrorNote message={errorText(q.error, 'Could not load the review queue.')} onRetry={() => q.refetch()} />}
      {q.data?.length === 0 && (
        <Empty title="Queue is clear" icon={<Inbox className="size-5" />}>
          Items the tutor thinks are worth keeping will wait here for your decision.
        </Empty>
      )}
      <div className="space-y-3">
        {q.data?.map((it) => (
          <ItemCard key={it.id} item={it} mode="pending" mergeTargets={q.data.filter((o) => o.id !== it.id)} />
        ))}
      </div>
    </aside>
  );
}

export default function Home() {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
      <Tutor />
      <Queue />
    </div>
  );
}

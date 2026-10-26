import { useRef, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Check, FileUp, LibraryBig, Plus } from 'lucide-react';
import {
  getGetNotebookQueryKey,
  getListCoursesQueryKey,
  useCreateCourse,
  useGetNotebook,
  useListCourses,
  useUploadCourseFile,
  type Course,
  type Source,
} from '@workspace/api-client-react';
import { Btn, Empty, ErrorNote, SkeletonLines, fieldCls } from '@/components/ui-bits';
import { BackupButton } from '@/components/backup-button';
import { useCourseSwitch, useWritesPending } from '@/lib/course-switch';
import { errorText } from '@/lib/notebook';

const MAX = 15 * 1024 * 1024;
const OK = /\.(pdf|txt|md)$/i;

function Uploader({ course }: { course: Course }) {
  const qc = useQueryClient();
  const upload = useUploadCourseFile();
  const input = useRef<HTMLInputElement>(null);
  const [local, setLocal] = useState<string | null>(null);
  const [done, setDone] = useState<Source[]>([]);
  const pick = (f: File | undefined) => {
    setLocal(null); upload.reset();
    if (!f) return;
    if (!OK.test(f.name)) return setLocal('Use a .pdf, .txt, or .md file.');
    if (f.size > MAX) return setLocal(`That file is ${(f.size / 1048576).toFixed(1)} MB; the limit is 15 MB.`);
    upload.mutate({ id: course.id, data: { file: f } }, {
      onSuccess: (s) => {
        setDone((d) => [s, ...d]);
        qc.invalidateQueries({ queryKey: getListCoursesQueryKey() });
        if (course.active) qc.invalidateQueries({ queryKey: getGetNotebookQueryKey() });
      },
      onSettled: () => { if (input.current) input.current.value = ''; },
    });
  };
  return (
    <div className="mt-3 space-y-2">
      <label className={`flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-primary/30 bg-secondary/40 px-3 py-2.5 text-sm transition-colors hover:border-primary/60 ${upload.isPending ? 'pointer-events-none opacity-60' : ''}`}>
        <FileUp className="size-4 text-primary" aria-hidden />
        <span className="flex-1">{upload.isPending ? 'Uploading and extracting text…' : 'Add a PDF or text file'}</span>
        <input ref={input} type="file" accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown" className="sr-only" disabled={upload.isPending}
          onChange={(e) => pick(e.target.files?.[0])} data-testid={`input-upload-${course.id}`} />
      </label>
      {upload.isPending && <div className="h-1 overflow-hidden rounded bg-muted"><div className="h-full w-1/3 animate-pulse rounded bg-primary" /></div>}
      {local && <ErrorNote message={local} />}
      {upload.isError && <ErrorNote message={errorText(upload.error, 'Upload failed.')} />}
      {done.map((s) => (
        <p key={s.id} role="status" className="rise flex items-center gap-2 text-xs text-primary" data-testid={`text-uploaded-${s.id}`}>
          <Check className="size-3.5" aria-hidden /> Added {s.title} · {s.pageCount} page{s.pageCount === 1 ? '' : 's'}
        </p>
      ))}
    </div>
  );
}

function CreateCourse() {
  const qc = useQueryClient();
  const create = useCreateCourse();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    create.mutate({ data: { title: title.trim(), description: description.trim() || undefined } }, {
      onSuccess: () => { setTitle(''); setDescription(''); qc.invalidateQueries({ queryKey: getListCoursesQueryKey() }); },
    });
  };
  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl border bg-card p-5 shadow-sm" aria-label="New course">
      <h2 className="font-reading text-2xl font-semibold">New course</h2>
      <label className="block text-xs font-medium text-muted-foreground">Title
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required placeholder="e.g. HIST 214: The Atlantic World" className={`${fieldCls} mt-1`} data-testid="input-course-title" />
      </label>
      <label className="block text-xs font-medium text-muted-foreground">Description (optional)
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} rows={2} className={`${fieldCls} mt-1 resize-none`} data-testid="input-course-description" />
      </label>
      {create.isError && <ErrorNote message={errorText(create.error, 'Could not create the course.')} />}
      <Btn type="submit" tone="primary" disabled={create.isPending || !title.trim()} data-testid="button-create-course">
        <Plus className="size-4" aria-hidden /> {create.isPending ? 'Creating…' : 'Create course'}
      </Btn>
    </form>
  );
}

export default function Courses() {
  const courses = useListCourses();
  const nb = useGetNotebook();
  const { switchTo, switching, error } = useCourseSwitch();
  const pending = useWritesPending();
  return (
    <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <section aria-label="Courses" className="space-y-4">
        <div>
          <h1 className="font-reading text-3xl font-semibold">Courses</h1>
          <p className="mt-1 text-sm text-muted-foreground">Each course keeps its own sources, tutor chats, review queue, and exams. Switching reloads the notebook for that course.</p>
        </div>
        {error && <ErrorNote message={error} />}
        {courses.isLoading && <SkeletonLines n={2} />}
        {courses.isError && <ErrorNote message={errorText(courses.error, 'Could not load courses.')} onRetry={() => courses.refetch()} />}
        {courses.data?.length === 0 && <Empty title="No courses yet" icon={<LibraryBig className="size-5" />}>Create one to start uploading material.</Empty>}
        <ul className="space-y-3">
          {courses.data?.map((c) => {
            const active = c.id === nb.data?.activeCourseId || c.active;
            return (
              <li key={c.id} className={`rounded-2xl border p-5 ${active ? 'border-primary/40 bg-secondary/50' : 'bg-card'}`} data-testid={`card-course-${c.id}`}>
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <h2 className="font-reading text-xl font-semibold leading-snug">{c.title}</h2>
                    {c.description && <p className="mt-0.5 text-sm text-muted-foreground">{c.description}</p>}
                    <p className="mt-1 font-mono text-[11px] text-accent-foreground">{c.sourceCount} source{c.sourceCount === 1 ? '' : 's'}</p>
                  </div>
                  {active
                    ? <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-medium text-primary-foreground" data-testid={`status-active-${c.id}`}>Active</span>
                    : <Btn tone="soft" disabled={switching || pending} title={pending ? 'Wait for the current save to finish' : undefined} onClick={() => void switchTo(c.id)} data-testid={`button-activate-${c.id}`}>{switching ? 'Switching…' : 'Make active'}</Btn>}
                </div>
                {c.sourceCount === 0 && <p className="mt-2 text-xs text-muted-foreground">Empty. Upload material so the tutor and practice have something to work from.</p>}
                <Uploader course={c} />
              </li>
            );
          })}
        </ul>
      </section>
      <aside className="space-y-5">
        <CreateCourse />
        <div className="rounded-2xl border bg-muted/40 p-5 text-sm leading-relaxed">
          <h2 className="font-reading text-xl font-semibold">About uploads</h2>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-muted-foreground">
            <li>.pdf, .txt, or .md, up to 15 MB each.</li>
            <li>PDFs need selectable text. Scanned pages are not read; there is no OCR.</li>
            <li>PDFs can contain up to 80 pages. Split longer documents before uploading.</li>
            <li>The original file is stored, and its extracted text is saved to your notebook.</li>
          </ul>
        </div>
        <div className="rounded-2xl border bg-card p-5 text-sm">
          <h2 className="font-reading text-xl font-semibold">Backup</h2>
          <p className="mt-1 mb-3 text-muted-foreground">A JSON copy of every course, approved card, statistic, exam attempt, and chat.</p>
          <BackupButton />
        </div>
      </aside>
    </div>
  );
}

import { useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Check, Pencil, Pin, PinOff, Trash2, X } from 'lucide-react';
import { getGetNotebookQueryKey, getListCoursesQueryKey, useUpdateCourse, type Course } from '@workspace/api-client-react';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from '@/components/ui/alert-dialog';
import { Btn, ErrorNote, fieldCls } from '@/components/ui-bits';
import { useCourseSwitch, useWritesPending } from '@/lib/course-switch';
import { errorText } from '@/lib/notebook';

export function CourseEditing({ course }: { course: Course }) {
  const qc = useQueryClient();
  const update = useUpdateCourse();
  const { removeCourse, switching } = useCourseSwitch();
  const writesPending = useWritesPending();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(course.title);
  const [confirm, setConfirm] = useState(false);
  const disabled = switching || writesPending;
  const save = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || disabled) return;
    update.mutate({ id: course.id, data: { title: title.trim() } }, {
      onSuccess: () => { setEditing(false); refresh(); },
    });
  };
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: getListCoursesQueryKey() });
    void qc.invalidateQueries({ queryKey: getGetNotebookQueryKey() });
  };
  const cancelEdit = () => { setEditing(false); setTitle(course.title); update.reset(); };
  return (
    <div className="min-w-0 flex-1 space-y-2">
      {editing ? (
        <form onSubmit={save} className="flex flex-wrap items-center gap-1" aria-label={`Rename ${course.title}`}>
          <input autoFocus value={title} onChange={e => setTitle(e.target.value)} required maxLength={160}
            aria-label="Course title" className={`${fieldCls} min-w-0 flex-1`} disabled={update.isPending}
            onKeyDown={e => { if (e.key === 'Escape') cancelEdit(); }} data-testid={`input-rename-course-${course.id}`} />
          <Btn type="submit" disabled={disabled || !title.trim()} aria-label="Save course title" title="Save title"><Check className="size-4" /></Btn>
          <Btn onClick={cancelEdit} disabled={update.isPending} aria-label="Cancel rename" title="Cancel"><X className="size-4" /></Btn>
        </form>
      ) : (
        <div className="flex flex-col items-start gap-2 sm:flex-row sm:gap-1">
          <h2 className="min-w-0 flex-1 break-words font-reading text-xl font-semibold leading-snug">{course.title}</h2>
          <div className="flex shrink-0 items-center">
            <Btn className="px-2" disabled={disabled} aria-label={course.isPinned ? `Unpin ${course.title}` : `Pin ${course.title}`}
              aria-pressed={course.isPinned} title={course.isPinned ? 'Unpin course' : 'Pin course'}
              onClick={() => { update.reset(); update.mutate({ id: course.id, data: { isPinned: !course.isPinned } }, { onSuccess: refresh }); }}
              data-testid={`button-pin-course-${course.id}`}>
              {course.isPinned ? <PinOff className="size-4 text-primary" /> : <Pin className="size-4" />}
            </Btn>
            <Btn className="px-2" disabled={disabled} aria-label={`Rename ${course.title}`} title="Rename course"
              onClick={() => { setTitle(course.title); setEditing(true); update.reset(); }} data-testid={`button-rename-course-${course.id}`}><Pencil className="size-4" /></Btn>
            <Btn className="px-2" tone="danger" disabled={disabled} aria-label={`Delete ${course.title}`} title="Delete course"
              onClick={() => setConfirm(true)} data-testid={`button-delete-course-${course.id}`}><Trash2 className="size-4" /></Btn>
          </div>
        </div>
      )}
      {course.isPinned && <p className="flex items-center gap-1 text-xs font-medium text-primary"><Pin className="size-3" aria-hidden /> Pinned</p>}
      {update.isError && <ErrorNote message={errorText(update.error, 'Could not update the course.')} />}
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="break-words">Delete “{course.title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes this course and all its uploaded files, extracted sources, tutor chat history, review queue items, flashcards, and exam attempts and statistics. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <p className="text-sm text-muted-foreground">Your other courses are not affected. Download a backup first if you want to keep a copy of your study data. If this is your last course, your notebook will be empty.</p>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={disabled} data-testid="button-cancel-course-delete">Keep course</AlertDialogCancel>
            <Btn tone="danger" className="border border-destructive/40" disabled={disabled}
              onClick={() => void removeCourse(course.id)} data-testid="button-confirm-course-delete"><Trash2 className="size-4" aria-hidden /> Permanently delete</Btn>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

import { Link } from 'wouter';
import { useListCourses } from '@workspace/api-client-react';
import { useCourseSwitch, useWritesPending } from '@/lib/course-switch';

export function CourseSwitcher({ activeId, title }: { activeId?: number; title: string }) {
  const courses = useListCourses();
  const { switchTo, switching, error } = useCourseSwitch();
  const pending = useWritesPending();
  return (
    <div className="flex min-w-0 items-center gap-2">
      <label className="min-w-0">
        <span className="sr-only">Active course</span>
        <select
          value={activeId ?? ''}
          disabled={switching || pending || !courses.data}
          title={pending ? 'Finish the current save before switching course' : 'Switch course'}
          onChange={(e) => { const id = Number(e.target.value); if (id && id !== activeId) void switchTo(id); }}
          className="max-w-[14rem] truncate rounded-md border border-transparent bg-transparent py-1 pl-1 pr-6 text-xs text-muted-foreground hover:border-border focus:border-ring disabled:opacity-60"
          data-testid="select-course"
        >
          {(!courses.data || !activeId) && <option value={activeId ?? ''}>{title}</option>}
          {courses.data?.map((c) => <option key={c.id} value={c.id}>{c.isPinned ? 'Pinned · ' : ''}{c.title}</option>)}
        </select>
      </label>
      <Link href="/courses" className="shrink-0 text-xs text-primary underline-offset-2 hover:underline" data-testid="link-manage-courses">Manage courses</Link>
      {error && <span role="alert" className="text-xs text-destructive">{error}</span>}
    </div>
  );
}

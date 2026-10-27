import { and, desc, eq } from "drizzle-orm";
import { db, coursesTable, courseFilesTable, notebooksTable } from "@workspace/db";
import { objectStorageClient } from "./objectStorage";

export class CourseManagementError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export async function removePrivateCourseFile(path: string) {
  const match = /^\/([^/]+)\/(.+)$/.exec(path);
  if (!match) throw new Error("Invalid private file path.");
  await objectStorageClient.bucket(match[1]!).file(match[2]!).delete({ ignoreNotFound: true });
}

/** Storage must be gone before the database cascade commits. Failed deletions
 * retain their metadata so retry can finish; already-removed objects are safe to retry.
 * Course FK locks prevent uploads/tutor/exam writes from leaving orphaned rows. */
export async function permanentlyDeleteCourse(
  notebookId: string,
  courseId: number,
  removeFile: (path: string) => Promise<void> = removePrivateCourseFile,
) {
  await db.transaction(async tx => {
    const [notebook] = await tx.select().from(notebooksTable).where(eq(notebooksTable.id,notebookId)).for("update");
    const [course] = await tx.select().from(coursesTable)
      .where(and(eq(coursesTable.id,courseId),eq(coursesTable.notebookId,notebookId))).for("update");
    if (!notebook || !course) throw new CourseManagementError("Course not found.",404);
    const files = await tx.select().from(courseFilesTable).where(eq(courseFilesTable.courseId,courseId));
    try {
      for (const file of files) await removeFile(file.objectPath);
    } catch {
      throw new CourseManagementError(
        "File removal could not finish. The course records were retained; some originals may already have been removed. Retry Delete to finish removing this course.",503,
      );
    }
    // All course-owned files, messages, review items (including discarded/merged),
    // approved cards and exam attempts are removed by ON DELETE CASCADE.
    await tx.delete(coursesTable).where(eq(coursesTable.id,courseId));
    const [next] = await tx.select().from(coursesTable).where(eq(coursesTable.notebookId,notebookId))
      .orderBy(desc(coursesTable.isPinned),coursesTable.id).limit(1);
    await tx.update(notebooksTable).set({
      coursesInitialized:true,
      activeCourseId:notebook.activeCourseId === courseId ? next?.id ?? null : notebook.activeCourseId,
    }).where(eq(notebooksTable.id,notebookId));
  });
}

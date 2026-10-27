import { and, desc, eq, isNull } from "drizzle-orm";
import { db, coursesTable, courseFilesTable, notebooksTable, studyItemsTable, studyMessagesTable, examAttemptsTable } from "@workspace/db";
import { sources as legacySources } from "./course";

export type CourseSource = typeof legacySources[number];
export async function initializeCourses(notebookId: string) {
  return db.transaction(async tx => {
    const [notebook] = await tx.select().from(notebooksTable).where(eq(notebooksTable.id,notebookId)).for("update");
    if (!notebook) throw new Error("Notebook not found.");
    if (!notebook.coursesInitialized) {
      await tx.update(notebooksTable).set({coursesInitialized:true}).where(eq(notebooksTable.id,notebookId));
    }
    if(notebook?.activeCourseId) {
      const [current]=await tx.select().from(coursesTable).where(and(eq(coursesTable.id,notebook.activeCourseId),eq(coursesTable.notebookId,notebookId)));
      if(current) return current;
    }
    let [first] = await tx.select().from(coursesTable).where(eq(coursesTable.notebookId,notebookId)).orderBy(desc(coursesTable.isPinned),coursesTable.id).limit(1);
    // A deliberately emptied notebook must not recreate its original course or material.
    if (!first && notebook.coursesInitialized) {
      await tx.update(notebooksTable).set({activeCourseId:null}).where(eq(notebooksTable.id,notebookId));
      return null;
    }
    if (!first) [first] = await tx.insert(coursesTable).values({
      notebookId,title:"CS 202 · Digital Logic & Computer Systems",description:"Your original nine lectures and study notebook.",legacy:true,
    }).returning();
    for (const table of [studyItemsTable,studyMessagesTable,examAttemptsTable]) {
      await tx.update(table).set({courseId:first!.id}).where(and(eq(table.notebookId,notebookId),isNull(table.courseId)));
    }
    await tx.update(notebooksTable).set({activeCourseId:first!.id}).where(eq(notebooksTable.id,notebookId));
    return first!;
  });
}

export async function getCourseSources(courseId: number, notebookId: string): Promise<CourseSource[]> {
  const [course] = await db.select().from(coursesTable).where(and(eq(coursesTable.id,courseId),eq(coursesTable.notebookId,notebookId)));
  if (!course) return [];
  const files = await db.select().from(courseFilesTable).where(and(eq(courseFilesTable.courseId,courseId),eq(courseFilesTable.notebookId,notebookId))).orderBy(courseFilesTable.id);
  return [...(course.legacy ? legacySources : []), ...files.map(file => ({
    id:1000+file.id,title:file.title,lecture:"Uploaded source",description:file.filename,
    pageCount:file.pages.length,pages:file.pages,
  }))];
}

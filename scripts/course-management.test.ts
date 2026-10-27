import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db, pool, notebooksTable, coursesTable, courseFilesTable, studyItemsTable, studyMessagesTable, examAttemptsTable } from "@workspace/db";
import { permanentlyDeleteCourse, CourseManagementError, removePrivateCourseFile } from "../artifacts/api-server/src/lib/course-management";
import { initializeCourses } from "../artifacts/api-server/src/lib/course-store";
import { ObjectStorageService, objectStorageClient } from "../artifacts/api-server/src/lib/objectStorage";

// Isolated fixtures only. This does not weaken authentication or touch owner courses.
const notebookId = `course-management-fixture-${randomUUID()}`;
const foreignId = `course-management-fixture-${randomUUID()}`;
let objectPath: string | undefined;
try {
  await db.insert(notebooksTable).values([{ id:notebookId, coursesInitialized:true }, { id:foreignId, coursesInitialized:true }]);
  const [first, second, foreign] = await db.insert(coursesTable).values([
    { notebookId, title:"First course" }, { notebookId, title:"Second course", isPinned:true },
    { notebookId:foreignId, title:"Other notebook" },
  ]).returning();
  assert.ok(first && second && foreign);
  const sorted = await db.select().from(coursesTable).where(eq(coursesTable.notebookId,notebookId)).orderBy(desc(coursesTable.isPinned),coursesTable.id);
  assert.equal(sorted[0]!.id,second.id,"Pinned courses precede lower IDs");
  await db.update(coursesTable).set({ title:"Renamed course", isPinned:false }).where(eq(coursesTable.id,second.id));
  const [renamed] = await db.select().from(coursesTable).where(eq(coursesTable.id,second.id));
  assert.equal(renamed!.title,"Renamed course");
  assert.equal(renamed!.isPinned,false);
  await db.update(notebooksTable).set({activeCourseId:first.id}).where(eq(notebooksTable.id,notebookId));
  const dir = new ObjectStorageService().getPrivateObjectDir().replace(/^\/|\/$/g,"");
  const slash = dir.indexOf("/");
  const bucket = dir.slice(0,slash), key = `${dir.slice(slash+1)}/verification/${randomUUID()}`;
  objectPath = `/${bucket}/${key}`;
  const object = objectStorageClient.bucket(bucket).file(key);
  await object.save("Temporary course deletion verification",{resumable:false,metadata:{contentType:"text/plain"}});
  await db.insert(courseFilesTable).values({notebookId,courseId:first.id,title:"Fixture",filename:"fixture.txt",
    objectPath,contentType:"text/plain",pages:[{page:1,text:"Temporary course deletion verification"}]});
  for (const status of ["pending","approved","discarded","merged"]) {
    await db.insert(studyItemsTable).values({notebookId,courseId:first.id,kind:"flashcard",title:"Fixture",question:"Question?",answer:"Answer",status,citations:[]});
  }
  await db.insert(studyItemsTable).values({notebookId,courseId:second.id,kind:"flashcard",title:"Keep",question:"Keep?",answer:"Yes",status:"approved",citations:[]});
  await db.insert(studyMessagesTable).values({notebookId,courseId:first.id,role:"user",content:"Delete this conversation",citations:[]});
  await db.insert(examAttemptsTable).values({notebookId,courseId:first.id,sourceIds:[1],requestedCount:1,questions:[]});

  await assert.rejects(permanentlyDeleteCourse(foreignId,first.id),e => e instanceof CourseManagementError && e.status===404);
  await assert.rejects(permanentlyDeleteCourse(notebookId,first.id,async () => {throw new Error("Simulated storage failure");}),
    e => e instanceof CourseManagementError && e.status===503);
  assert.equal((await db.select().from(coursesTable).where(eq(coursesTable.id,first.id))).length,1,"Storage failure retains course metadata for retry");
  assert.equal((await db.select().from(studyItemsTable).where(eq(studyItemsTable.courseId,first.id))).length,4);
  assert.equal((await object.exists())[0],true,"Failed cleanup fixture did not delete the object");

  await permanentlyDeleteCourse(notebookId,first.id);
  assert.equal((await object.exists())[0],false,"Original file permanently removed from App Storage");
  objectPath=undefined;
  for (const table of [courseFilesTable,studyItemsTable,studyMessagesTable,examAttemptsTable]) {
    assert.equal((await db.select().from(table).where(eq(table.courseId,first.id))).length,0,"Course-owned rows cascade");
  }
  assert.equal((await db.select().from(studyItemsTable).where(eq(studyItemsTable.courseId,second.id))).length,1,"Other course cards preserved");
  assert.equal((await db.select().from(coursesTable).where(eq(coursesTable.id,foreign.id))).length,1,"Other notebook preserved");
  assert.equal((await db.select().from(notebooksTable).where(eq(notebooksTable.id,notebookId)))[0]!.activeCourseId,second.id);
  await assert.rejects(db.insert(studyMessagesTable).values({notebookId,courseId:first.id,role:"assistant",content:"Late AI result",citations:[]}),
    "Late writes cannot resurrect deleted-course history");
  await permanentlyDeleteCourse(notebookId,second.id);
  assert.equal(await initializeCourses(notebookId),null,"Deleting last course does not recreate original material");
  assert.equal((await db.select().from(notebooksTable).where(eq(notebooksTable.id,notebookId)))[0]!.activeCourseId,null);
  const [newCourse] = await db.insert(coursesTable).values({notebookId,title:"Fresh start"}).returning();
  assert.equal((await initializeCourses(notebookId))!.id,newCourse!.id,"Can start again after deleting every course");
  console.log("Pin/rename persistence, owner isolation, storage failure/retry, real private file deletion, database cascades, late-write protection and last-course empty state passed.");
} finally {
  if(objectPath) await removePrivateCourseFile(objectPath);
  await db.transaction(async tx => {
    const ids=[notebookId,foreignId];
    // Nullable legacy records are not necessarily attached to a course.
    for(const table of [studyItemsTable,studyMessagesTable,examAttemptsTable,courseFilesTable,coursesTable]) {
      await tx.delete(table).where(inArray(table.notebookId,ids));
    }
    await tx.delete(notebooksTable).where(inArray(notebooksTable.id,ids));
  });
  await pool.end();
}

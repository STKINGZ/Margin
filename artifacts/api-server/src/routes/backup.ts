import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { db, coursesTable, courseFilesTable, studyItemsTable, studyMessagesTable, examAttemptsTable } from "@workspace/db";
import { sources as legacySources } from "../lib/course";

const router: IRouter=Router();
router.get("/backup",async (_req,res):Promise<void>=>{
  const owner:string=res.locals.notebookId;
  // One repeatable-read snapshot, across all courses, not only the current course.
  const backup=await db.transaction(async tx=>{
    const courses=await tx.select().from(coursesTable).where(eq(coursesTable.notebookId,owner));
    const files=await tx.select({id:courseFilesTable.id,courseId:courseFilesTable.courseId,title:courseFilesTable.title,
      filename:courseFilesTable.filename,pages:courseFilesTable.pages}).from(courseFilesTable).where(eq(courseFilesTable.notebookId,owner));
    const cards=await tx.select().from(studyItemsTable).where(and(eq(studyItemsTable.notebookId,owner),eq(studyItemsTable.status,"approved")));
    const chats=await tx.select().from(studyMessagesTable).where(eq(studyMessagesTable.notebookId,owner));
    const exams=await tx.select().from(examAttemptsTable).where(eq(examAttemptsTable.notebookId,owner));
    const strip=<T extends {notebookId:string}>(row:T)=>{const {notebookId:_owner,...safe}=row;return safe;};
    const completed=exams.filter(e=>e.status==="completed");
    const correct=completed.reduce((n,e)=>n+(e.score?.correct??0),0);
    const total=completed.reduce((n,e)=>n+(e.score?.total??0),0);
    return {format:"margin-backup",version:1,exportedAt:new Date().toISOString(),
      courses:courses.map(strip),sources:[
        ...courses.filter(c=>c.legacy).flatMap(c=>legacySources.map(source=>({...source,courseId:c.id}))),
        ...files.map(file=>({...file,id:1000+file.id})),
      ],
      approvedCards:cards.map(strip),chatHistories:chats.map(strip),examAttempts:exams.map(strip),
      testingStatistics:{attempts:exams.length,completed:completed.length,inProgress:exams.filter(e=>e.status==="in_progress").length,
        totalQuestions:total,correctAnswers:correct,accuracyPercent:total?Math.round(correct/total*10000)/100:0},
      notes:"Original uploaded file bytes are not included. Extracted source text, approved cards, chats, and saved exam attempts are included.",
    };
  },{isolationLevel:"repeatable read",accessMode:"read only"});
  res.setHeader("Content-Disposition",`attachment; filename="margin-backup-${new Date().toISOString().slice(0,10)}.json"`);
  res.type("application/json").send(JSON.stringify(backup,null,2));
});
export default router;

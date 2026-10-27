import { createHash, randomBytes } from "node:crypto";
import type { RequestHandler } from "express";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db, notebooksTable, studyItemsTable, studyMessagesTable, coursesTable, courseFilesTable, examAttemptsTable } from "@workspace/db";
import { starterItems, welcomeMessage } from "../lib/course";
import { initializeCourses, getCourseSources } from "../lib/course-store";
import { randomUUID } from "node:crypto";

export const notebookMiddleware: RequestHandler = async (req, res, next) => {
  try {
    const existing = req.headers.cookie?.split(";").map(s=>s.trim()).find(s=>s.startsWith("margin_notebook="))?.slice("margin_notebook=".length);
    const token = existing && /^[a-f0-9]{64}$/.test(existing) ? existing : randomBytes(32).toString("hex");
    const legacyId = createHash("sha256").update(token).digest("hex");
    const accountId: string = res.locals.accountId;
    if (!accountId) { res.status(401).json({error:"Sign in required."}); return; }
    const id = await db.transaction(async tx => {
      // Serialize account linking without first-visitor ownership or public signup access.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${accountId}))`);
      const [linked] = await tx.select().from(notebooksTable).where(eq(notebooksTable.accountId,accountId));
      const [legacy] = await tx.select().from(notebooksTable).where(and(eq(notebooksTable.id,legacyId),isNull(notebooksTable.accountId))).for("update");
      if (linked) {
        // A later first sign-in from the original browser must still recover its data,
        // even if the owner first signed in on another device. Only the old unguessable
        // cookie plus verified owner authentication can authorize this import.
        if(legacy&&legacy.id!==linked.id) {
          const previousCourses=await tx.select().from(coursesTable).where(eq(coursesTable.notebookId,legacy.id));
          const [oldMessage]=await tx.select({id:studyMessagesTable.id}).from(studyMessagesTable).where(eq(studyMessagesTable.notebookId,legacy.id)).limit(1);
          if(previousCourses.length||oldMessage) {
            let defaultId=legacy.activeCourseId??previousCourses[0]?.id;
            if(!defaultId) {
              const [imported]=await tx.insert(coursesTable).values({notebookId:legacy.id,title:"CS 202 · Original notebook",description:"Preserved from your earlier browser notebook.",legacy:true}).returning();
              defaultId=imported!.id;
            }
            for(const table of [studyItemsTable,studyMessagesTable,examAttemptsTable]) {
              await tx.update(table).set({courseId:defaultId}).where(and(eq(table.notebookId,legacy.id),isNull(table.courseId)));
              await tx.update(table).set({notebookId:linked.id}).where(eq(table.notebookId,legacy.id));
            }
            await tx.update(courseFilesTable).set({notebookId:linked.id}).where(eq(courseFilesTable.notebookId,legacy.id));
            await tx.update(coursesTable).set({notebookId:linked.id}).where(eq(coursesTable.notebookId,legacy.id));
            await tx.update(notebooksTable).set({activeCourseId:defaultId}).where(eq(notebooksTable.id,linked.id));
          }
        }
        return linked.id;
      }
      if (legacy) {
        await tx.update(notebooksTable).set({accountId}).where(eq(notebooksTable.id,legacy.id));
        return legacy.id;
      }
      const freshId = randomUUID();
      await tx.insert(notebooksTable).values({id:freshId,accountId});
      await tx.insert(studyMessagesTable).values({...welcomeMessage,notebookId:freshId});
      await tx.insert(studyItemsTable).values(starterItems.map(item=>({...item,notebookId:freshId})));
      return freshId;
    });
    if (token !== existing) {
      // Partitioned supports the preview iframe without exposing this capability to JS.
      res.cookie("margin_notebook",token,{httpOnly:true,secure:true,sameSite:"none",partitioned:true,maxAge:365*24*60*60*1000,path:"/api"});
    }
    res.locals.notebookId=id;
    const course=await initializeCourses(id);
    res.locals.course=course;
    res.locals.courseId=course?.id ?? 0;
    res.locals.sources=course ? await getCourseSources(course.id,id) : [];
    res.setHeader("Cache-Control","private, no-store");
    res.setHeader("X-Robots-Tag","noindex, nofollow");
    next();
  } catch(err) { next(err); }
};

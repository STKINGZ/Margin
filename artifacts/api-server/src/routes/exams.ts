import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db, examAttemptsTable as exams, notebooksTable, studyItemsTable, type ExamAttemptRecord } from "@workspace/db";
import {
  CreateExamAttemptBody, CreateExamAttemptResponse, GetExamAttemptParams, GetExamAttemptResponse,
  ListExamsResponse, UpdateExamAttemptBody, UpdateExamAttemptParams, UpdateExamAttemptResponse,
  ListItemsResponse,
} from "@workspace/api-zod";
import { scoreExam } from "@workspace/exam-engine";
import type { CourseSource } from "../lib/course-store";
import { generateDynamicPractice } from "../lib/dynamic-practice";

// Mounted inside the study router, after notebookMiddleware.
const router: IRouter = Router();
const summary = (row: ExamAttemptRecord) => ({
  id: row.id, status: row.status, sourceIds: row.sourceIds, requestedCount: row.requestedCount,
  total: row.questions.length, answered: Object.keys(row.answers).length, currentIndex: row.currentIndex,
  version: row.version, score: row.score, createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(), completedAt: row.completedAt?.toISOString() ?? null,
});
const detail = (row: ExamAttemptRecord) => ({ ...summary(row), questions: row.questions, answers: row.answers });
const fail = (status: number, message: string): never => { throw Object.assign(new Error(message), { status }); };

router.get("/exams", async (_req, res): Promise<void> => {
  const rows = await db.select().from(exams).where(and(eq(exams.notebookId, res.locals.notebookId),eq(exams.courseId,res.locals.courseId))).orderBy(desc(exams.id));
  res.json(ListExamsResponse.parse(rows.map(summary)));
});

router.get("/exams/:id", async (req, res): Promise<void> => {
  const params = GetExamAttemptParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid exam." }); return; }
  const [row] = await db.select().from(exams).where(and(eq(exams.id, params.data.id),eq(exams.courseId,res.locals.courseId), eq(exams.notebookId, res.locals.notebookId)));
  if (!row) { res.status(404).json({ error: "Exam not found." }); return; }
  res.json(GetExamAttemptResponse.parse(detail(row)));
});

router.post("/exams", async (req, res): Promise<void> => {
  const body = CreateExamAttemptBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Select lectures and a valid question count." }); return; }
  const owner: string = res.locals.notebookId;
  const sources=res.locals.sources as CourseSource[];
  try {
    const data=body.data;
    if(data.sourceIds.some(id=>!sources.some(s=>s.id===id))) fail(400,"Choose sources from the active course.");
    const [inProgress]=await db.select({id:exams.id}).from(exams).where(and(eq(exams.notebookId,owner),eq(exams.courseId,res.locals.courseId),eq(exams.status,"in_progress")));
    if(inProgress) fail(409,"Resume or end your unfinished exam before starting another.");
    const generated=data.retryOf===undefined
      ? await generateDynamicPractice(sources.filter(s=>data.sourceIds.includes(s.id)),res.locals.course.title,data.requestedCount,true)
      : null;
    const row = await db.transaction(async tx => {
      // Serialize creation across tabs; the partial unique index is an additional safeguard.
      await tx.select().from(notebooksTable).where(eq(notebooksTable.id, owner)).for("update");
      const [active] = await tx.select({ id: exams.id }).from(exams).where(and(eq(exams.notebookId, owner),eq(exams.courseId,res.locals.courseId), eq(exams.status, "in_progress")));
      if (active) fail(409, "Resume or end your unfinished exam before starting another.");
      const data = body.data;
      let questions;
      let sourceIds = [...new Set(data.sourceIds)];
      let requestedCount: number = data.requestedCount;
      if (data.retryOf !== undefined) {
        const [original] = await tx.select().from(exams).where(and(eq(exams.id, data.retryOf),eq(exams.courseId,res.locals.courseId), eq(exams.notebookId, owner)));
        if (!original) fail(404, "Exam not found.");
        if (original.status !== "completed") fail(400, "Only a completed exam can be retried.");
        questions = original.questions;
        sourceIds = original.sourceIds;
        requestedCount = original.requestedCount;
      } else {
        if (sourceIds.some(id => !sources.some(s => s.id === id))) fail(400, "Unknown lecture.");
        questions = generated!;
      }
      if (!questions.length) fail(400, "These lectures have no questions to draw from.");
      const [saved] = await tx.insert(exams).values({ notebookId: owner,courseId:res.locals.courseId, sourceIds, requestedCount, questions }).returning();
      return saved!;
    });
    res.status(201).json(CreateExamAttemptResponse.parse(detail(row)));
  } catch (err) {
    const e = err as Error & { status?: number };
    if (e.status) { res.status(e.status).json({ error: e.message }); return; }
    throw err;
  }
});

router.patch("/exams/:id", async (req, res): Promise<void> => {
  const params = UpdateExamAttemptParams.safeParse(req.params);
  const body = UpdateExamAttemptBody.safeParse(req.body);
  if (!params.success || !body.success) { res.status(400).json({ error: "Invalid exam progress." }); return; }
  try {
    const row = await db.transaction(async tx => {
      const [current] = await tx.select().from(exams).where(and(eq(exams.id, params.data.id),eq(exams.courseId,res.locals.courseId), eq(exams.notebookId, res.locals.notebookId))).for("update");
      if (!current) fail(404, "Exam not found.");
      const data = body.data;
      if (current.status !== "in_progress" || current.version !== data.version) fail(409, "This exam changed in another tab. Reload the saved attempt before continuing.");
      if (data.currentIndex >= current.questions.length || Object.entries(data.answers).some(([id, choice]) => {
        const q = current.questions.find(q => q.id === id);
        return !q || choice >= q.choices.length;
      })) fail(400, "Invalid question or answer choice.");
      const finished = data.action !== "save";
      const [saved] = await tx.update(exams).set({
        answers: data.answers, currentIndex: data.currentIndex, version: current.version + 1,
        status: data.action === "submit" ? "completed" : data.action === "abandon" ? "abandoned" : "in_progress",
        score: data.action === "submit" ? scoreExam(current.questions, data.answers) : null,
        updatedAt: new Date(), completedAt: finished ? new Date() : null,
      }).where(eq(exams.id, current.id)).returning();
      return saved!;
    });
    res.json(UpdateExamAttemptResponse.parse(detail(row)));
  } catch (err) {
    const e = err as Error & { status?: number };
    if (e.status) { res.status(e.status).json({ error: e.message }); return; }
    throw err;
  }
});

export default router;

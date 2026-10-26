import { pgTable, serial, text, timestamp, jsonb, integer, index, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import type { z } from "zod/v4";
import { notebooksTable } from "./notebooks";
import type { SourceCitation } from "./study-items";

export type FrozenExamQuestion = {
  id: string;
  kind: "terminology" | "applied";
  category: string;
  sourceId: number;
  prompt: string;
  choices: string[];
  correctIndex: number;
  explanation: string;
  citations: SourceCitation[];
};
export type SavedExamScore = { correct: number; total: number; unanswered: number; percent: number };

export const examAttemptsTable = pgTable("study_exam_attempts", {
  id: serial("id").primaryKey(),
  notebookId: text("notebook_id").notNull().references(() => notebooksTable.id),
  status: text("status").$type<"in_progress" | "completed" | "abandoned">().notNull().default("in_progress"),
  sourceIds: jsonb("source_ids").$type<number[]>().notNull(),
  requestedCount: integer("requested_count").notNull(),
  questions: jsonb("questions").$type<FrozenExamQuestion[]>().notNull(),
  answers: jsonb("answers").$type<Record<string, number>>().notNull().default({}),
  currentIndex: integer("current_index").notNull().default(0),
  version: integer("version").notNull().default(0),
  score: jsonb("score").$type<SavedExamScore>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
}, table => [
  index("study_exams_notebook_created").on(table.notebookId, table.createdAt),
  uniqueIndex("study_exams_one_active").on(table.notebookId).where(sql`${table.status} = 'in_progress'`),
]);

export const insertExamAttemptSchema = createInsertSchema(examAttemptsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertExamAttempt = z.infer<typeof insertExamAttemptSchema>;
export type ExamAttemptRecord = typeof examAttemptsTable.$inferSelect;

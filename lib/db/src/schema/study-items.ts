import { pgTable, serial, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { notebooksTable } from "./notebooks";

export type SourceCitation = { sourceId: number; sourceTitle: string; page: number; excerpt: string };
export const studyItemsTable = pgTable("study_items", {
  id: serial("id").primaryKey(),
  notebookId: text("notebook_id").notNull().references(() => notebooksTable.id),
  kind: text("kind").notNull(),
  title: text("title").notNull(),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  status: text("status").notNull().default("pending"),
  citations: jsonb("citations").$type<SourceCitation[]>().notNull(),
  createdAt: timestamp("created_at", {withTimezone:true}).notNull().defaultNow(),
}, (table) => [index("study_items_notebook_status").on(table.notebookId, table.status)]);

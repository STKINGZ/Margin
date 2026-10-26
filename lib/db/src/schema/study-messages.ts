import { pgTable, serial, text, integer, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { notebooksTable } from "./notebooks";
import type { SourceCitation } from "./study-items";

export const studyMessagesTable = pgTable("study_messages", {
  id: serial("id").primaryKey(),
  notebookId: text("notebook_id").notNull().references(() => notebooksTable.id),
  courseId: integer("course_id"),
  contextId: text("context_id"),
  sourceId: integer("source_id"),
  role: text("role").notNull(),
  content: text("content").notNull(),
  citations: jsonb("citations").$type<SourceCitation[]>().notNull(),
  createdAt: timestamp("created_at", {withTimezone:true}).notNull().defaultNow(),
}, table => [index("study_messages_notebook").on(table.notebookId)]);

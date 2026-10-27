import { pgTable, text, timestamp, integer, boolean, uniqueIndex } from "drizzle-orm/pg-core";

export const notebooksTable = pgTable("study_notebooks", {
  id: text("id").primaryKey(),
  accountId: text("account_id"),
  activeCourseId: integer("active_course_id"),
  coursesInitialized: boolean("courses_initialized").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, table=>[uniqueIndex("study_notebooks_account_unique").on(table.accountId)]);

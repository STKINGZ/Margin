import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const notebooksTable = pgTable("study_notebooks", {
  id: text("id").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

import { pgTable, serial, text, integer, boolean, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { notebooksTable } from "./notebooks";

export const coursesTable = pgTable("study_courses", {
  id: serial("id").primaryKey(),
  notebookId: text("notebook_id").notNull().references(() => notebooksTable.id),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  legacy: boolean("legacy").notNull().default(false),
  createdAt: timestamp("created_at", {withTimezone:true}).notNull().defaultNow(),
}, table => [index("study_courses_owner").on(table.notebookId)]);

export const courseFilesTable = pgTable("study_course_files", {
  id: serial("id").primaryKey(),
  courseId: integer("course_id").notNull().references(() => coursesTable.id),
  notebookId: text("notebook_id").notNull().references(() => notebooksTable.id),
  title: text("title").notNull(),
  filename: text("filename").notNull(),
  objectPath: text("object_path").notNull(),
  contentType: text("content_type").notNull(),
  pages: jsonb("pages").$type<{page:number;text:string}[]>().notNull(),
  createdAt: timestamp("created_at", {withTimezone:true}).notNull().defaultNow(),
}, table => [index("study_files_course_owner").on(table.courseId,table.notebookId)]);

import { createHash, randomBytes } from "node:crypto";
import type { RequestHandler } from "express";
import { db, notebooksTable, studyItemsTable, studyMessagesTable } from "@workspace/db";
import { starterItems, welcomeMessage } from "../lib/course";

export const notebookMiddleware: RequestHandler = async (req, res, next) => {
  try {
    const existing = req.headers.cookie?.split(";").map(s=>s.trim()).find(s=>s.startsWith("margin_notebook="))?.slice("margin_notebook=".length);
    const token = existing && /^[a-f0-9]{64}$/.test(existing) ? existing : randomBytes(32).toString("hex");
    const id = createHash("sha256").update(token).digest("hex");
    await db.transaction(async tx => {
      const created = await tx.insert(notebooksTable).values({id}).onConflictDoNothing().returning();
      if (created.length) {
        await tx.insert(studyMessagesTable).values({...welcomeMessage,notebookId:id});
        await tx.insert(studyItemsTable).values(starterItems.map(item=>({...item, notebookId:id})));
      }
    });
    if (token !== existing) {
      // Partitioned supports the preview iframe without exposing this capability to JS.
      res.cookie("margin_notebook",token,{httpOnly:true,secure:true,sameSite:"none",partitioned:true,maxAge:365*24*60*60*1000,path:"/api"});
    }
    res.locals.notebookId=id;
    res.setHeader("Cache-Control","private, no-store");
    res.setHeader("X-Robots-Tag","noindex, nofollow");
    next();
  } catch(err) { next(err); }
};

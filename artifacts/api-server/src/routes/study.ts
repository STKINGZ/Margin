import { Router, type IRouter } from "express";
import { and, asc, desc, eq, isNull, inArray, sql } from "drizzle-orm";
import { db, studyItemsTable as items, studyMessagesTable as messages } from "@workspace/db";
import {
  GetNotebookResponse, GetSourceParams, GetSourceResponse, ListMessagesResponse,
  SendMessageBody, SendMessageResponse, ListItemsQueryParams, ListItemsResponse,
  UpdateItemParams, UpdateItemBody, UpdateItemResponse,
} from "@workspace/api-zod";
import { notebookMiddleware } from "../middlewares/notebook";
import type { CourseSource } from "../lib/course-store";
import { privateAuth } from "../middlewares/private-auth";
import { teach } from "../lib/tutor";
import examsRouter from "./exams";
import coursesRouter from "./courses";
import practiceRouter from "./practice";
import backupRouter from "./backup";

const router:IRouter=Router();
router.use(privateAuth,notebookMiddleware);
router.use(coursesRouter,practiceRouter,backupRouter);
router.use(examsRouter);
const busy=new Set<string>();
const cooldown=new Map<string,number>();

router.get("/notebook",async (_req,res):Promise<void>=>{
  const id:string=res.locals.notebookId;
  const counts=await db.select({status:items.status,count:sql<number>`count(*)::int`}).from(items).where(and(eq(items.notebookId,id),eq(items.courseId,res.locals.courseId))).groupBy(items.status);
  const [messageCount]=await db.select({count:sql<number>`count(*)::int`}).from(messages).where(and(eq(messages.notebookId,id),eq(messages.courseId,res.locals.courseId),eq(messages.role,"user")));
  res.json(GetNotebookResponse.parse({
    course:res.locals.course?.title ?? "No active course",activeCourseId:res.locals.courseId || undefined,
    sources:(res.locals.sources as CourseSource[]).map(({pages:_pages,...source})=>source),
    aiReady:!!(process.env.AI_INTEGRATIONS_OPENAI_BASE_URL && process.env.AI_INTEGRATIONS_OPENAI_API_KEY),
    pendingCount:counts.find(c=>c.status==="pending")?.count??0,
    approvedCount:counts.find(c=>c.status==="approved")?.count??0,messageCount:messageCount?.count??0,
    privacyNotice:"Your notebook is private to your verified account. Source excerpts are sent to the AI provider only when you request tutoring or practice. Uploaded originals are stored privately.",
  }));
});
router.get("/sources/:id",async(req,res):Promise<void>=>{
  const parsed=GetSourceParams.safeParse(req.params);
  if(!parsed.success){res.status(400).json({error:"Invalid source."});return;}
  const source=(res.locals.sources as CourseSource[]).find(s=>s.id===parsed.data.id);
  if(!source){res.status(404).json({error:"Source not found."});return;}
  res.json(GetSourceResponse.parse(source));
});
router.get("/messages",async(_req,res):Promise<void>=>{
  const rows=await db.select().from(messages).where(and(eq(messages.notebookId,res.locals.notebookId),eq(messages.courseId,res.locals.courseId))).orderBy(asc(messages.id));
  res.json(ListMessagesResponse.parse(rows.map(r=>({...r,createdAt:r.createdAt.toISOString()}))));
});
router.post("/messages",async(req,res):Promise<void>=>{
  const parsed=SendMessageBody.safeParse(req.body);
  const sources=res.locals.sources as CourseSource[];
  if(!parsed.success){res.status(400).json({error:"Enter a message and select a valid knowledge level."});return;}
  if(parsed.data.sourceId != null && !sources.some(s=>s.id===parsed.data.sourceId)){res.status(400).json({error:"Unknown lecture."});return;}
  if(!process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || !process.env.AI_INTEGRATIONS_OPENAI_API_KEY){
    res.status(503).json({error:"AI tutor setup is waiting for Replit phone verification. Complete the verification in Replit, then try again. Your sources and review queue are ready; no message was saved or charged."});return;
  }
  const id:string=res.locals.notebookId;
  if(busy.has(id)){res.status(409).json({error:"Please wait for your current tutor response."});return;}
  if((cooldown.get(id)??0)>Date.now()){res.status(429).json({error:"Please wait a moment before asking another question."});return;}
  busy.add(id);cooldown.set(id,Date.now()+3000);
  try {
    // Legacy/stateless requests get no history. Never reuse another lecture's context.
    const contextId=parsed.data.contextId ?? null;
    const sourceId=parsed.data.sourceId ?? null;
    const history=contextId ? (await db.select({role:messages.role,content:messages.content}).from(messages)
      .where(and(eq(messages.notebookId,id),eq(messages.courseId,res.locals.courseId),eq(messages.contextId,contextId),
        sourceId === null ? isNull(messages.sourceId) : eq(messages.sourceId,sourceId)))
      .orderBy(desc(messages.id)).limit(18)).reverse() : [];
    if (!sources.length) {res.status(400).json({error:"Upload course material before starting tutoring."});return;}
    const result=await teach(parsed.data,history,sources,res.locals.course.title);
    const saved=await db.transaction(async tx=>{
      await tx.insert(messages).values({notebookId:id,courseId:res.locals.courseId,contextId,sourceId,role:"user",content:parsed.data.content,citations:[]});
      const [assistant]=await tx.insert(messages).values({notebookId:id,courseId:res.locals.courseId,contextId,sourceId,role:"assistant",content:result.content,citations:result.citations}).returning();
      const existing=await tx.select({question:items.question}).from(items).where(and(eq(items.notebookId,id),eq(items.courseId,res.locals.courseId)));
      const known=new Set(existing.map(i=>i.question.toLowerCase().trim()));
      const fresh=result.items.filter(i=>{const q=i.question.toLowerCase().trim();if(known.has(q))return false;known.add(q);return true;});
      if(fresh.length)await tx.insert(items).values(fresh.map(i=>({...i,notebookId:id,courseId:res.locals.courseId})));
      return {assistant:assistant!,count:fresh.length};
    });
    res.json(SendMessageResponse.parse({message:{...saved.assistant,createdAt:saved.assistant.createdAt.toISOString()},extractedCount:saved.count}));
  } catch(err) {
    req.log.error({err},"Tutor generation failed");
    res.status(502).json({error:"The AI tutor could not produce a source-verified reply. Please try again. Your draft is preserved and no partial items were saved."});
  } finally {busy.delete(id);}
});
router.get("/items",async(req,res):Promise<void>=>{
  const parsed=ListItemsQueryParams.safeParse(req.query);
  if(!parsed.success){res.status(400).json({error:"Choose pending or approved items."});return;}
  const rows=await db.select().from(items).where(and(eq(items.notebookId,res.locals.notebookId),eq(items.courseId,res.locals.courseId),eq(items.status,parsed.data.status))).orderBy(desc(items.id));
  res.json(ListItemsResponse.parse(rows.map(r=>({...r,createdAt:r.createdAt.toISOString()}))));
});
router.patch("/items/:id",async(req,res):Promise<void>=>{
  const params=UpdateItemParams.safeParse(req.params), body=UpdateItemBody.safeParse(req.body);
  if(!params.success||!body.success){res.status(400).json({error:"Invalid item or empty fields. Please check your changes."});return;}
  const owner:string=res.locals.notebookId;
  const data=body.data;
  if(data.action==="edit" && data.title===undefined && data.question===undefined && data.answer===undefined && data.kind===undefined){
    res.status(400).json({error:"Provide at least one field to edit."});return;
  }
  try{
    const row=await db.transaction(async tx=>{
      const ids=[params.data.id,...(data.action==="merge"&&data.mergeTargetId?[data.mergeTargetId]:[])];
      const rows=await tx.select().from(items).where(and(eq(items.notebookId,owner),eq(items.courseId,res.locals.courseId),inArray(items.id,ids))).orderBy(asc(items.id)).for("update");
      const current=rows.find(r=>r.id===params.data.id);
      if(!current)throw Object.assign(new Error("Item not found."),{status:404});
      if(!["pending","approved"].includes(current.status))throw Object.assign(new Error("This item is no longer available. Refresh the queue."),{status:409});
      if(data.action==="merge"){
        const target=rows.find(r=>r.id===data.mergeTargetId);
        if(!target||target.id===current.id||target.status!=="pending"||current.status!=="pending")throw Object.assign(new Error("Choose a different pending item to merge into."),{status:400});
        const citations=[...target.citations,...current.citations].filter((c,i,all)=>all.findIndex(x=>x.sourceId===c.sourceId&&x.page===c.page&&x.excerpt===c.excerpt)===i);
        await tx.update(items).set({answer:`${target.answer}\n\n${current.title}: ${current.answer}`,question:`${target.question}\n${current.question}`,citations}).where(eq(items.id,target.id));
        const [merged]=await tx.update(items).set({status:"merged"}).where(eq(items.id,current.id)).returning();
        return merged!;
      }
      if(data.action==="approve"&&current.status!=="pending")throw Object.assign(new Error("Only pending items can be approved."),{status:409});
      const changes={...(data.title!==undefined?{title:data.title}:{}),...(data.question!==undefined?{question:data.question}:{}),...(data.answer!==undefined?{answer:data.answer}:{}),...(data.kind!==undefined?{kind:data.kind}:{}),
        ...(data.action==="approve"?{status:"approved"}:data.action==="discard"?{status:"discarded"}:{})};
      const [updated]=await tx.update(items).set(changes).where(eq(items.id,current.id)).returning();
      return updated!;
    });
    res.json(UpdateItemResponse.parse({...row,createdAt:row.createdAt.toISOString()}));
  }catch(err){
    const e=err as Error & {status?:number};
    if(e.status){res.status(e.status).json({error:e.message});return;}
    throw err;
  }
});
export default router;

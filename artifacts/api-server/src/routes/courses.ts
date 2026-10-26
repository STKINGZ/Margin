import { Router, type IRouter } from "express";
import multer from "multer";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db, coursesTable as courses, courseFilesTable as files, notebooksTable } from "@workspace/db";
import { CreateCourseBody, ActivateCourseParams, UploadCourseFileParams, GetSourceResponse } from "@workspace/api-zod";
import { objectStorageClient, ObjectStorageService } from "../lib/objectStorage";
import { getCourseSources } from "../lib/course-store";

const router: IRouter = Router();
const upload = multer({storage:multer.memoryStorage(),limits:{fileSize:15*1024*1024,files:1,fields:0}});
router.get("/courses",async (_req,res):Promise<void>=>{
  const rows=await db.select().from(courses).where(eq(courses.notebookId,res.locals.notebookId)).orderBy(courses.id);
  res.json(await Promise.all(rows.map(async row=>({
    id:row.id,title:row.title,description:row.description,active:row.id===res.locals.courseId,
    sourceCount:(await getCourseSources(row.id,res.locals.notebookId)).length,
  }))));
});
router.post("/courses",async (req,res):Promise<void>=>{
  const body=CreateCourseBody.safeParse(req.body);
  if(!body.success||!body.data.title.trim()){res.status(400).json({error:"Enter a course name."});return;}
  const [row]=await db.insert(courses).values({notebookId:res.locals.notebookId,title:body.data.title.trim(),description:body.data.description?.trim()??""}).returning();
  res.status(201).json({id:row!.id,title:row!.title,description:row!.description,active:false,sourceCount:0});
});
router.post("/courses/:id/activate",async (req,res):Promise<void>=>{
  const params=ActivateCourseParams.safeParse(req.params);
  if(!params.success){res.status(400).json({error:"Invalid course."});return;}
  const [row]=await db.select().from(courses).where(and(eq(courses.id,params.data.id),eq(courses.notebookId,res.locals.notebookId)));
  if(!row){res.status(404).json({error:"Course not found."});return;}
  await db.update(notebooksTable).set({activeCourseId:row.id}).where(eq(notebooksTable.id,res.locals.notebookId));
  res.json({id:row.id,title:row.title,description:row.description,active:true,sourceCount:(await getCourseSources(row.id,res.locals.notebookId)).length});
});
router.post("/courses/:id/uploads",upload.single("file"),async (req,res):Promise<void>=>{
  const params=UploadCourseFileParams.safeParse(req.params);
  const input=req.file;
  if(!params.success||!input){res.status(400).json({error:"Choose a PDF, text, or Markdown file."});return;}
  const [course]=await db.select().from(courses).where(and(eq(courses.id,params.data.id),eq(courses.notebookId,res.locals.notebookId)));
  if(!course){res.status(404).json({error:"Course not found."});return;}
  const filename=input.originalname.replace(/[/\\\x00-\x1f]/g,"_").slice(0,220);
  const pdf=/\.pdf$/i.test(filename);
  if(!pdf&&!/\.(txt|md)$/i.test(filename)){res.status(400).json({error:"Only PDF, .txt, and .md files are supported."});return;}
  let pages:{page:number;text:string}[];
  try {
    if(pdf) {
      if(!input.buffer.subarray(0,1024).includes(Buffer.from("%PDF-"))) throw new Error("The file is not a valid PDF.");
      const {PDFParse}=await import("pdf-parse");
      const parser=new PDFParse({data:new Uint8Array(input.buffer),isEvalSupported:false});
      try {
        const info=await parser.getInfo();
        if(info.total>80) throw new Error("Please split PDFs longer than 80 pages into smaller files.");
        const text=await parser.getText();
        pages=text.pages.map(p=>({page:p.num,text:p.text.trim()}));
      } finally {await parser.destroy();}
    } else {
      const text=new TextDecoder("utf-8",{fatal:true}).decode(input.buffer).replace(/^\uFEFF/,"");
      if(text.includes("\0")) throw new Error("The file must contain readable UTF-8 text.");
      // Preserve explicitly separated pages; long text documents receive stable text-page numbers.
      const chunks=text.includes("\f")?text.split("\f"):text.match(/[\s\S]{1,7000}/g)??[];
      pages=chunks.map((text,index)=>({page:index+1,text:text.trim()}));
    }
    if(!pages.some(p=>p.text.length>=20)) throw new Error("No readable text was found. Scanned PDFs need OCR before upload.");
    if(pages.reduce((n,p)=>n+p.text.length,0)>500_000) throw new Error("This document has too much text. Please split it into smaller files.");
  } catch(err) {
    res.status(400).json({error:err instanceof Error?err.message:"Could not extract text from this file."});return;
  }
  const dir=new ObjectStorageService().getPrivateObjectDir().replace(/^\/|\/$/g,"");
  const slash=dir.indexOf("/");
  const bucket=dir.slice(0,slash),key=`${dir.slice(slash+1)}/courses/${course.id}/${randomUUID()}`;
  const object=objectStorageClient.bucket(bucket).file(key);
  const contentType=pdf?"application/pdf":"text/plain; charset=utf-8";
  await object.save(input.buffer,{resumable:false,metadata:{contentType,cacheControl:"private, no-store"}});
  try {
    const [saved]=await db.insert(files).values({
      courseId:course.id,notebookId:res.locals.notebookId,filename,title:filename.replace(/\.(pdf|txt|md)$/i,""),
      objectPath:`/${bucket}/${key}`,contentType,pages,
    }).returning();
    res.status(201).json(GetSourceResponse.parse({
      id:1000+saved!.id,title:saved!.title,lecture:"Uploaded source",description:filename,pageCount:pages.length,pages,
    }));
  } catch(err) {
    await object.delete().catch(cleanup=>req.log.error({err:cleanup},"Failed to remove orphaned private upload"));
    throw err;
  }
});
export default router;

import { Router, type IRouter } from "express";
import { GeneratePracticeBody } from "@workspace/api-zod";
import type { CourseSource } from "../lib/course-store";
import { generateDynamicPractice } from "../lib/dynamic-practice";

const router: IRouter=Router();
const busy=new Set<string>();
router.post("/practice",async(req,res):Promise<void>=>{
  const body=GeneratePracticeBody.safeParse(req.body);
  if(!body.success){res.status(400).json({error:"Select source files and a valid question count."});return;}
  const sources=res.locals.sources as CourseSource[];
  if(body.data.sourceIds.some(id=>!sources.some(s=>s.id===id))){res.status(400).json({error:"Choose sources from the active course only."});return;}
  const owner:string=res.locals.notebookId;
  if(busy.has(owner)){res.status(409).json({error:"Please wait for your current practice set."});return;}
  busy.add(owner);
  try {
    res.json(await generateDynamicPractice(sources.filter(s=>body.data.sourceIds.includes(s.id)),res.locals.course.title,body.data.count));
  }catch(err){
    req.log.error({err},"Practice generation failed");
    const error=err as Error & {status?:number};
    res.status(error.status??502).json({error:error.status?error.message:"Could not generate verified practice questions. Try again; nothing was saved."});
  }finally{busy.delete(owner);}
});
export default router;

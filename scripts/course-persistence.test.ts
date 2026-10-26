import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { db, pool, notebooksTable, coursesTable, courseFilesTable, studyItemsTable, studyMessagesTable, examAttemptsTable } from "@workspace/db";
import { notebookMiddleware } from "../artifacts/api-server/src/middlewares/notebook";
import { starterItems } from "../artifacts/api-server/src/lib/course";

// Exercise the persistence middleware directly with isolated DB fixtures. This does
// not expose a test login, owner override, or bypass in the running application.
const account=`persistence-fixture-${randomUUID()}`;
const tokens=[randomBytes(32).toString("hex"),randomBytes(32).toString("hex")];
const notebookIds=tokens.map(token=>createHash("sha256").update(token).digest("hex"));
async function open(token?: string) {
  const req={headers:{cookie:token?`margin_notebook=${token}`:""}} as Parameters<typeof notebookMiddleware>[0];
  const locals:Record<string,any>={accountId:account};
  const res={locals,cookie(){return this;},setHeader(){return this;}} as unknown as Parameters<typeof notebookMiddleware>[1];
  await new Promise<void>((resolve,reject)=>{
    Promise.resolve(notebookMiddleware(req,res,error=>error?reject(error):resolve())).catch(reject);
  });
  return locals;
}
try {
  await db.insert(notebooksTable).values(notebookIds.map(id=>({id})));
  for(const [i,id] of notebookIds.entries()) {
    await db.insert(studyItemsTable).values({...starterItems[0]!,notebookId:id,status:"approved",title:`Persistence fixture ${i}`});
    await db.insert(studyMessagesTable).values({notebookId:id,role:"user",contextId:randomUUID(),sourceId:2,content:`Preserved conversation ${i}`,citations:[]});
    await db.insert(examAttemptsTable).values({notebookId:id,sourceIds:[2],requestedCount:1,questions:[{
      id:`fixture-${i}`,kind:"terminology",category:"fixture",sourceId:2,prompt:"Preserve this frozen question",
      choices:["A","B","C","D"],correctIndex:0,explanation:"Fixture only",citations:[],
    }]});
  }
  const first=await open(tokens[0]);
  assert.equal(first.notebookId,notebookIds[0],"First owner sign-in retains the legacy notebook ID");
  assert.equal(first.sources.length,9);
  const [card]=await db.select().from(studyItemsTable).where(eq(studyItemsTable.notebookId,notebookIds[0]!));
  assert.equal(card!.status,"approved");
  assert.equal(card!.courseId,first.courseId,"Existing approved cards are assigned to the legacy course");
  assert.equal((await open()).notebookId,first.notebookId,"A fresh browser recovers the same account notebook");

  const imported=await open(tokens[1]);
  assert.equal(imported.notebookId,first.notebookId,"A later login from another legacy browser imports into the established account");
  assert.notEqual(imported.courseId,first.courseId,"Imported courses do not overwrite the existing course");
  for(const table of [studyItemsTable,studyMessagesTable,examAttemptsTable]) {
    const rows=await db.select().from(table).where(eq(table.notebookId,first.notebookId));
    assert.equal(rows.length,2,"Both legacy notebooks retain their records");
    assert.ok(rows.every(row=>row.courseId!==null));
    assert.equal(new Set(rows.map(row=>row.courseId)).size,2,"Records remain in separate courses");
  }
  const before=await db.select().from(coursesTable).where(eq(coursesTable.notebookId,first.notebookId));
  await open(tokens[1]);
  const after=await db.select().from(coursesTable).where(eq(coursesTable.notebookId,first.notebookId));
  assert.equal(before.length,after.length,"Repeating the old browser login does not duplicate imported courses");
  assert.equal((await db.select().from(studyItemsTable).where(and(eq(studyItemsTable.notebookId,first.notebookId),eq(studyItemsTable.status,"approved")))).length,2);
  console.log("Legacy account linking, fresh-browser recovery, multi-browser import, course isolation, approved data and exam preservation passed.");
} finally {
  await db.transaction(async tx=>{
    for(const table of [studyItemsTable,studyMessagesTable,examAttemptsTable,courseFilesTable,coursesTable]) {
      await tx.delete(table).where(inArray(table.notebookId,notebookIds));
    }
    await tx.delete(notebooksTable).where(inArray(notebooksTable.id,notebookIds));
  });
  await pool.end();
}

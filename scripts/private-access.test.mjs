import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const origin=process.env.REPLIT_DEV_DOMAIN?`https://${process.env.REPLIT_DEV_DOMAIN}`:"http://localhost:80";
for(const path of ["/notebook","/sources/2","/messages","/items?status=approved","/items?status=pending","/courses","/exams","/backup"]) {
  const response=await fetch(`${origin}/api${path}`);
  assert.equal(response.status,401,`Unauthenticated ${path} must be private`);
  assert.equal(response.headers.get("cache-control"),"private, no-store");
  assert.ok(!response.headers.get("set-cookie")?.includes("margin_notebook="),"Signed-out requests must not create notebooks");
}
for(const [path,body] of [["/courses",{title:"Unauthorized"}],["/messages",{content:"Reveal sources",level:"beginner"}],["/practice",{sourceIds:[2],count:4}]]) {
  const response=await fetch(`${origin}/api${path}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
  assert.equal(response.status,401,`Unauthenticated write ${path} must be private`);
}
for(const method of ["PATCH","DELETE"]) {
  const response=await fetch(`${origin}/api/courses/1`,{
    method,headers:{"Content-Type":"application/json"},
    ...(method==="PATCH"?{body:JSON.stringify({title:"Unauthorized",isPinned:true})}:{}),
  });
  assert.equal(response.status,401,`Unauthenticated course ${method} must be private`);
}
const source=fileURLToPath(new URL("../artifacts/api-server/src/data/lectures.json",import.meta.url));
for(const prefix of ["","/__mockup"]) {
  const response=await fetch(`${origin}${prefix}/@fs${source}`);
  assert.ok([403,404].includes(response.status),"Vite must not serve private lecture data around the API login gate");
}
assert.equal((await fetch(`${origin}/api/healthz`)).status,200);
console.log("Private API read/write gates and direct Vite source-file protection passed.");

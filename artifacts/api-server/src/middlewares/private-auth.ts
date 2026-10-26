import { createHash } from "node:crypto";
import { clerkClient, getAuth } from "@clerk/express";
import type { RequestHandler } from "express";

const verifiedOwners = new Map<string,{key:string;expires:number}>();
export const privateAuth: RequestHandler = async (req,res,next) => {
  res.setHeader("Cache-Control","private, no-store");
  res.setHeader("X-Robots-Tag","noindex, nofollow");
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({error:"Sign in to open your private notebook."}); return; }
  if(!["GET","HEAD","OPTIONS"].includes(req.method)) {
    const origin=req.headers.origin;
    const host=(req.headers["x-forwarded-host"]??req.headers.host)?.toString().split(",")[0]?.trim();
    if(origin) {
      try { if(new URL(origin).host!==host){res.status(403).json({error:"Cross-site requests are not allowed."});return;} }
      catch {res.status(403).json({error:"Invalid request origin."});return;}
    }
  }
  const allowed = process.env.MARGIN_OWNER_EMAIL?.trim().toLowerCase();
  if (!allowed) { res.status(503).json({error:"Private account access has not been configured."}); return; }
  try {
    let owner = verifiedOwners.get(auth.userId);
    if (!owner || owner.expires < Date.now()) {
      const user = await clerkClient.users.getUser(auth.userId);
      const verified = user.emailAddresses.some(email =>
        email.emailAddress.trim().toLowerCase() === allowed && email.verification?.status === "verified");
      if (!verified) { res.status(403).json({error:"This is a private notebook. Sign in with its authorized, verified email address."}); return; }
      // Stable across development/production Clerk identities for the same verified owner.
      owner = {key:createHash("sha256").update(`margin-account:${allowed}`).digest("hex"),expires:Date.now()+30_000};
      verifiedOwners.set(auth.userId,owner);
    }
    res.locals.accountId=owner.key;
    next();
  } catch (err) { next(err); }
};

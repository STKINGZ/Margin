import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import { CLERK_PROXY_PATH, clerkProxyMiddleware, getClerkProxyHost } from "./middlewares/clerkProxyMiddleware";

const app: Express = express();
app.disable("x-powered-by");
app.use((_req,res,next)=>{
  res.setHeader("X-Content-Type-Options","nosniff");
  res.setHeader("Referrer-Policy","same-origin");
  next();
});

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
// Same-origin browser access only; notebook capability cookies are never exposed.
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());
app.use(cors({ origin: false }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  clerkMiddleware((req) => ({
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(req) ?? "",
      process.env.CLERK_PUBLISHABLE_KEY,
    ),
  })),
);

app.use("/api", router);
app.use(((err, req, res, _next) => {
  req.log.error({ err }, "Request failed");
  const tooLarge=err.code==="LIMIT_FILE_SIZE"||err.type==="entity.too.large";
  res.status(tooLarge?413:500).json({ error: tooLarge?"File too large. The upload limit is 15 MB.":"The notebook could not complete this request. Please try again." });
}) as express.ErrorRequestHandler);

export default app;

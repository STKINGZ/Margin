import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

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
app.use(cors({ origin: false }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);
app.use(((err, req, res, _next) => {
  req.log.error({ err }, "Request failed");
  res.status(500).json({ error: "The notebook could not complete this request. Please try again." });
}) as express.ErrorRequestHandler);

export default app;

// Copyright 2022 The Tari Project
// SPDX-License-Identifier: BSD-3-Clause

import express from "express";
import path from "path";
import pinoHttp from "pino-http";
import asciichart from "asciichart";
import cors from "cors";
import favicon from "serve-favicon";
import hbs from "hbs";

// Route imports
import indexRouter from "./routes/index.js";
import blockDataRouter from "./routes/block_data.js";
import blocksRouter from "./routes/blocks.js";
import mempoolRouter from "./routes/mempool.js";
import minersRouter from "./routes/miners.js";
import searchCommitmentsRouter from "./routes/search_commitments.js";
import searchKernelsRouter from "./routes/search_kernels.js";
import healthz from "./routes/healthz.js";
import statsRouter from "./routes/stats.js";
import assetsRouter from "./routes/assets.js";

import BackgrounUpdater from "./utils/updater.js";
import { hex, script } from "./script.js";

// Register HBS helpers
hbs.registerHelper("hex", hex);
hbs.registerHelper("script", script);

hbs.registerHelper("json", function (obj) {
  return Buffer.from(JSON.stringify(obj)).toString("base64");
});

hbs.registerHelper("timestamp", function (timestamp) {
  const dateObj = new Date(timestamp * 1000);
  const day = dateObj.getUTCDate();
  const month = dateObj.getUTCMonth() + 1;
  const year = dateObj.getUTCFullYear();
  const hours = dateObj.getUTCHours();
  const minutes = dateObj.getUTCMinutes();
  const seconds = dateObj.getSeconds();

  return (
    year.toString() +
    "-" +
    month.toString().padStart(2, "0") +
    "-" +
    day.toString().padStart(2, "0") +
    " " +
    hours.toString().padStart(2, "0") +
    ":" +
    minutes.toString().padStart(2, "0") +
    ":" +
    seconds.toString().padStart(2, "0")
  );
});

hbs.registerHelper("percentbar", function (a, b) {
  const percent = (a / (a + b)) * 100;
  const barWidth = percent / 10;
  const bar = "**********".slice(0, barWidth);
  const space = "...........".slice(0, 10 - barWidth);
  return bar + space + " " + parseInt(percent) + "% ";
});

hbs.registerHelper("chart", function (data, height) {
  if (data.length > 0) {
    return asciichart.plot(data, {
      height: height,
    });
  } else {
    return "**No data**";
  }
});

hbs.registerHelper("json", function (obj) {
  return JSON.stringify(obj);
});

hbs.registerHelper("add", function (a, b) {
  return a + b;
});

hbs.registerPartials(path.join(import.meta.dirname, "partials"));

const app = express();

const updater = new BackgrounUpdater();
updater.start();

// view engine setup
app.set("views", path.join(import.meta.dirname, "views"));
app.set("view engine", "hbs");

app.use(favicon(path.join(import.meta.dirname, "public", "favicon.ico")));
app.use(pinoHttp());
app.use(express.json());
app.use(
  express.urlencoded({
    extended: false,
  }),
);
app.use(express.static(path.join(import.meta.dirname, "public")));
app.use(cors());
app.use((req, res, next) => {
  res.locals.backgroundUpdater = updater;
  next();
});

app.use("/", indexRouter);
app.use("/blocks", blocksRouter);
app.use("/block_data", blockDataRouter);
app.use("/assets", assetsRouter);
app.use("/mempool", mempoolRouter);
app.use("/miners", minersRouter);
app.use("/search_commitments", searchCommitmentsRouter);
app.use("/search_kernels", searchKernelsRouter);
app.use("/healthz", healthz);
app.use("/stats", statsRouter);

// catch 404 and forward to error handler
app.use((req, res) => {
  res.status(404).send("Not found");
});

// error handler
app.use(function (err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};

  // render the error page
  res.err = err;
  res.status(err.status || 500).render("error");
});

export default app;

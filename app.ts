// Copyright 2022 The Tari Project
// SPDX-License-Identifier: BSD-3-Clause

import express from "express";
import path from "path";
import { pinoHttp } from "pino-http";
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
import searchKernelsRouter from "./routes/search_kernels.js";
import searchByHashOrHeightRouter from "./routes/search_by_hash_or_height.js";
import healthz from "./routes/healthz.js";

import BackgrounUpdater from "./utils/updater.js";
import { hex, script } from "./script.js";

import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Register HBS helpers
hbs.registerHelper("hex", hex);
hbs.registerHelper("script", script);

hbs.registerHelper("timestamp", function (timestamp: number) {
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

hbs.registerHelper(
  "percentbar",
  function (a: number, b: number, c: number, d: number) {
    const total = a + b + c + d;
    if (total === 0) return ".......... 0% ";
    const percent = (a / total) * 100;
    const barWidth = Math.round(percent / 10);
    const bar = "**********".slice(0, barWidth);
    const space = "..........".slice(0, 10 - barWidth);
    return bar + space + " " + parseInt(percent.toString()) + "% ";
  },
);

const getAutoUnit = (value: number) => {
  if (value >= 1e15) return "peta";
  if (value >= 1e12) return "tera";
  if (value >= 1e9) return "giga";
  if (value >= 1e6) return "mega";
  if (value >= 1e3) return "kilo";
  return "";
};

function autoUnitLabel(value: number, entity: string): string {
  if (value >= 1e15) return "P" + entity;
  if (value >= 1e12) return "T" + entity;
  if (value >= 1e9) return "G" + entity;
  if (value >= 1e6) return "M" + entity;
  if (value >= 1e3) return "k" + entity;
  return entity;
}

const transformNumberToFormat = (value: number, toFixedDecimal?: number) => {
  if (value == null) {
    return value;
  }
  const unit = getAutoUnit(value);

  let formatting = (val: number) => val.toLocaleString("en-US");

  if (toFixedDecimal && typeof toFixedDecimal === "number") {
    formatting = (val: number) =>
      val.toFixed(toFixedDecimal).toLocaleLowerCase("en-US");
  }

  return formatting(transformValueToUnit(value, unit, toFixedDecimal));
};

const transformValueToUnit = (
  value: number,
  unit: string,
  toFixedDecimal?: number,
) => {
  if (value === null || value === undefined) {
    return 0;
  }

  let transformLength = (val: number) => val;

  if (toFixedDecimal && !isNaN(toFixedDecimal)) {
    const toDecimalPoint = (val: number) => {
      const factor = Math.pow(10, toFixedDecimal);
      return Math.round(val * factor) / factor;
    };
    transformLength = toDecimalPoint;
  }

  switch (unit) {
    case "kilo":
      return transformLength(value / 1000);
    case "mega":
      return transformLength(value / 1000000);
    case "giga":
      return transformLength(value / 1000000000);
    case "tera":
      return transformLength(value / 1000000000000);
    case "peta":
      return transformLength(value / 1000000000000000);
    default:
      return transformLength(value);
  }
};

const getPrefixOfUnit = (unit: string) => {
  switch (unit) {
    case "kilo":
      return "K";
    case "mega":
      return "M";
    case "giga":
      return "G";
    case "tera":
      return "T";
    case "peta":
      return "P";
    default:
      return "";
  }
};

hbs.registerHelper(
  "chart",
  function (
    data: number[],
    height: number,
    formatRange: boolean,
    entity: string,
  ) {
    if (data.length > 0) {
      // Determine unit from max value
      const maxValue = Math.max(...data);
      const unitStr = getAutoUnit(maxValue);
      let dataTransformed = data;

      dataTransformed = data.map((v) => transformValueToUnit(v, unitStr, 4));

      const decimalPlaces = maxValue >= 1 ? 2 : 4;
      return asciichart.plot(dataTransformed, {
        height: height,
        format: formatRange
          ? (x: number) => {
              const valueStr =
                x.toFixed(decimalPlaces).toLocaleLowerCase("en-US") +
                ` ${getPrefixOfUnit(unitStr)}${entity}`;
              return valueStr.padStart(12, "  ");
            }
          : undefined,
      });
    } else {
      return "**No data**";
    }
  },
);

hbs.registerHelper("unitFormat", transformNumberToFormat);
hbs.registerHelper("autoUnitLabel", autoUnitLabel);

hbs.registerHelper("add", function (a: number, b: number) {
  return a + b;
});

hbs.registerHelper("format_thousands", function (value: number) {
  if (value == null) {
    return value;
  }
  return Math.floor(value).toLocaleString("en-US");
});
hbs.registerPartials(path.join(__dirname, "../partials"));

export const app = express();

const updater = new BackgrounUpdater();
updater.start();

// view engine setup
app.set("views", path.join(__dirname, "../views"));
app.set("view engine", "hbs");

app.use(favicon(path.join(__dirname, "../public", "favicon.ico")));
app.use(pinoHttp());
app.use(express.json());
app.use(
  express.urlencoded({
    extended: false,
  }),
);
app.use(express.static(path.join(__dirname, "../public")));
app.use(cors());
app.use((req, res, next) => {
  res.locals.backgroundUpdater = updater;
  next();
});

app.use("/", indexRouter);
app.use("/blocks", blocksRouter);
app.use("/block_data", blockDataRouter);
app.use("/mempool", mempoolRouter);
app.use("/miners", minersRouter);
app.use("/search_by_hash_or_height", searchByHashOrHeightRouter);
app.use("/search_kernels", searchKernelsRouter);
app.use("/healthz", healthz);

// catch 404 and forward to error handler
app.use((req, res) => {
  res.status(404).send("Not found");
});

// error handler
app.use(function (
  err: Record<string, unknown>,
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) {
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

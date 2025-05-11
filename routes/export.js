import { createClient } from "../baseNodeClient.js";
import express from "express";
import { format } from "@fast-csv/format";
const router = express.Router();

router.get("/", async function (req, res) {
  const client = createClient();
  const lastDifficulties = await client.getNetworkDifficulty({
    from_tip: 1000,
  });

  const csvStream = format({ headers: true });
  res.setHeader("Content-Disposition", 'attachment; filename="data.csv"');
  res.setHeader("Content-Type", "text/csv");

  csvStream.pipe(res);

  // Example data

  for (let i = 0; i < lastDifficulties.length; i++) {
    csvStream.write(lastDifficulties[i]);
  }

  csvStream.end();
});

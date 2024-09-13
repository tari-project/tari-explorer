var { createClient } = require("../baseNodeClient");

var express = require("express");
const { format } = require("@fast-csv/format");
var router = express.Router();

router.get("/", async function (req, res) {
  try {
    let client = createClient();
    let lastDifficulties = await client.getNetworkDifficulty({
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
  } catch (error) {
    res.status(500);
    if (req.query.json !== undefined) {
      res.json({ error: error });
    } else {
      res.render("error", { error: error });
    }
  }
});

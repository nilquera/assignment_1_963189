/** mysimbdp-ingestion
 *
 * This program is responsible of reading csv files and ingesting data into mysimbdp-coredms.
 * Make a copy of .env.template named .env and edit the fields before running "npm start".
 *
 * This program does the following:
 * 1) Watch for new CSV files.
 * 2) If a new CSV is detected, its rows are parsed and inserted into the coredms.metrics table
 * of the mysimbdp-coredms cluster.
 *
 */

const fs = require("fs").promises;
const parse = require("csv-parse/lib/sync");
const path = require("path");
const watch = require("watch");
require("dotenv").config();

const CSV_SEPARATOR = process.env.CSV_SEPARATOR;
const CSV_ROOTDIR = process.env.CSV_ROOTDIR;
const CSV_COLUMNS = process.env.CSV_COLUMNS;

watch.createMonitor(path.resolve(CSV_ROOTDIR), (monitor) => {
  monitor.on("created", async (f, stat) => {
    console.log(f);
    const content = await fs.readFile(f);
    const records = parse(content, {
      columns: CSV_COLUMNS ? true : false,
      delimiter: CSV_SEPARATOR,
    });

    records.map((record) => console.log(record));
  });
});

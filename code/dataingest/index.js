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
const cassandra = require("cassandra-driver");
const executeConcurrent = cassandra.concurrent.executeConcurrent;
require("dotenv").config();
const Lock = require("./lock");

const client = new cassandra.Client({
  contactPoints: [process.env.COREDMS_NODE1, process.env.COREDMS_NODE2],
  localDataCenter: process.env.COREDMS_LOCAL_DATACENTER,
  keyspace: "coredms",
});

const monitoredFiles = [];
const lock = new Lock();

watch.createMonitor(
  path.resolve(process.env.CSV_ROOTDIR),
  { interval: process.env.CSV_WATCH_INTERVAL },
  (monitor) => {
    monitor.on("created", async (f, stat) => {
      if (monitoredFiles.includes(f)) {
        return;
      } else {
        console.log("[INFO] New file detected: " + f);
        monitoredFiles.push(f);
      }

      await lock.acquire();
      console.log("[INFO] Processing file: " + f);

      const content = await fs.readFile(f);
      const records = parse(content, {
        columns: process.env.CSV_COLUMNS ? true : false,
        delimiter: process.env.CSV_SEPARATOR,
      });

      const concurrencyLevel =
        process.env.INGESTION_CONCURRENCY_LEVEL > 2048
          ? 2048
          : process.env.INGESTION_CONCURRENCY_LEVEL;

      const values = records.map((record) => {
        const date = new Date(Number(record.time));
        return [
          record["dev-id"],
          date.getMonth().toString(),
          Number(record.time),
          Number(record.acceleration),
          Number(record.acceleration_x),
          Number(record.acceleration_y),
          Number(record.acceleration_z),
          Number(record.battery),
          Number(record.humidity),
          Number(record.pressure),
          Number(record.temperature),
        ];
      });

      console.log("[INFO] Rows read from file: ", values.length);

      const query =
        "INSERT INTO metrics (dev_id, month, ts, acceleration, acceleration_x, acceleration_y, acceleration_z, battery, humidity, pressure, temperature) VALUES (?,?,?,?,?,?,?,?,?,?,?)";

      try {
        await executeConcurrent(client, query, values, {
          concurrencyLevel,
        });
      } catch (err) {
        console.log(err);
      }

      console.log("[INFO] Unlocking lock");
      lock.release();

      // records.forEach((record) => {
      //   //   console.log(record);
      //   const date = new Date(Number(record.time));
      //   const query =
      //     "INSERT INTO metrics (dev_id, month, ts, acceleration, acceleration_x, acceleration_y, acceleration_z, battery, humidity, pressure, temperature) VALUES (?,?,?,?,?,?,?,?,?,?,?)";
      //   const params = [
      //     record["dev-id"],
      //     date.getMonth().toString(),
      //     Number(record.time),
      //     Number(record.acceleration),
      //     Number(record.acceleration_x),
      //     Number(record.acceleration_y),
      //     Number(record.acceleration_z),
      //     Number(record.battery),
      //     Number(record.humidity),
      //     Number(record.pressure),
      //     Number(record.temperature),
      //   ];

      //   client.execute(query, params, { prepare: true }).then((result, err) => {
      //     console.log(record);
      //     if (err) console.log(err);
      //     else console.log(result);
      //   });
      // });
    });
  }
);

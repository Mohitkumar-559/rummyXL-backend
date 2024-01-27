const { MongoClient } = require("mongodb");
const logger = require("../utils/logger");

/*=========================================================
        Mongo Db connection start here.
===========================================================*/
// "mongodb": "^3.4.1",

// let db;

const dbInit = () => {
  return new Promise((resolve, reject) => {
    let databaseConnectionString =
      "mongodb://" +
      process.env.DB_USERNAME +
      ":" +
      process.env.DB_PASSWORD +
      "@" +
      process.env.DB_HOST +
      ":" +
      process.env.DB_PORT +
      "/" +
      process.env.DB_NAME;
    // let databaseConnectionString = process.env.DB_URL;
    if (process.env.environment == "production") {
      databaseConnectionString = process.env.DB_URL;
    }

    MongoClient.connect(databaseConnectionString, { useUnifiedTopology: true,poolSize:10 }, async function (err, dClient) {
      if (err) {
        logger.error("mongodb::::::::::::Error: ", err);
        reject(err);
      } else {
        db = await dClient.db(process.env.DB_NAME);
        logger.info(
          "Database connected  successfully------->>>>>:",
          "DB connected"
        );
        // db.setProfilingLevel({profile:1,slowms:200});
        // db.setProfilingLevel(1);

        db.collection("playing_table").createIndex({ "pi.location": "2dsphere" });

        gameConfig = await db.collection("config").findOne();



        resolve(db);
      }
    }
    );
  });
};

const GetConfig = () => gameConfig;

module.exports = { dbInit, GetConfig };
/*=========================================================
        Mongod Db connection Ends.
===========================================================*/

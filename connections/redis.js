/*=========================================================
        Redis server configuration start here..
===========================================================*/
const logger = require("../utils/logger");
const { createClient } = require("redis");
let rClient, pub, sub;


const redisInit = () => {
  return new Promise(async (resolve, reject) => {
    const { REDIS_DB } = process.env;

    const REDIS_CONFIG = {
      socket: {
        host: process.env.RDS_HOST,
        port: 6379,
      },
      password: process.env.RDS_AUTH,
    };

    rClient = createClient(REDIS_CONFIG);
    rClient.on("error", (err) => reject(err));



    // pub = createClient(REDIS_CONFIG);
    // sub = pub.duplicate();
    // await Promise.all([pub.connect(), sub.connect(),]);

    // pub.SELECT(REDIS_DB);
    // sub.SELECT(REDIS_DB);
    rClient.connect();
    rClient.SELECT(REDIS_DB);

    rClient.on('connect', () => logger.info('Redis Client', "Connected"));
    rClient.on('error', (err) => logger.error('Redis Client Connection Error', err));

    resolve(rClient);
  });
};

const getRedisInstances = () => rClient;
// const pubClient = () => pub;
// const subClient = () => sub;

module.exports = {
  redisInit, getRedisInstances,
  // pubClient, subClient
};

/*=========================================================
      Redis server configuration start here..
===========================================================*/

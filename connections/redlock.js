const { default: Redlock } = require("redlock");
const Redis = require("ioredis");

const REDIS_CONFIG = {
  port: 6379, // Redis port
  host: process.env.RDS_HOST, // Redis host
  password: process.env.RDS_AUTH,
  db: process.env.REDIS_DB,
};
const redis = new Redis(REDIS_CONFIG);

const redLock = new Redlock([redis], {
  driftFactor: 0.01,
  retryCount: -1,
  retryDelay: 25,
  retryJitter: 20,
});

redLock.on("error", (error) => console.error("REDIS_LOCK_ERROR" + error));

module.exports = redLock;

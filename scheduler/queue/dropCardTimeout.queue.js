const Bull = require("bull");
const logger = require("../../utils/logger");
const getInfo = require("../../common");
const { dropCardTimeoutProcess } = require("../process");

const { REDIS_DB, RDS_HOST, RDS_AUTH } = process.env;

const REDIS_CONFIG = { host: RDS_HOST, port: 6379, password: RDS_AUTH, db: REDIS_DB };

const dropCardTimeoutQueue = new Bull(`dropCardTimeout`, { redis: REDIS_CONFIG });

const dropCardTimeout = async (data) => {
  try {
    const options = {
      delay: data.timer,
      jobId: data.jobId,
      removeOnComplete: true
    };
    await dropCardTimeoutQueue.add(data, options);
    return dropCardTimeoutQueue;
  } catch (error) {
    logger.error("-----> error dropCardTimeoutQueue", error);
    getInfo.exceptionError(error);
  }
};

dropCardTimeoutQueue.process(dropCardTimeoutProcess);

module.exports = dropCardTimeout;

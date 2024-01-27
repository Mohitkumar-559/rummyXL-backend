const Bull = require("bull");
const logger = require("../../utils/logger");
const getInfo = require("../../common");
const { userRejoinTimerProcess } = require("../process");

const { REDIS_DB, RDS_HOST, RDS_AUTH } = process.env;

const REDIS_CONFIG = { host: RDS_HOST, port: 6379, password: RDS_AUTH, db: REDIS_DB };

const userRejoinTimerQueue = new Bull(`userRejoinTimer`, { redis: REDIS_CONFIG });

const userRejoinTimer = async (data) => {
  try {
    const options = {
      delay: data.timer,
      jobId: data.jobId,
      removeOnComplete: true
    };
    await userRejoinTimerQueue.add(data, options);
    return userRejoinTimerQueue;
  } catch (error) {
    logger.error("-----> error userRejoinTimerQueue", error);
    getInfo.exceptionError(error);
  }
};

userRejoinTimerQueue.process(userRejoinTimerProcess);

module.exports = userRejoinTimer;

const Bull = require("bull");
const logger = require("../../utils/logger");
const getInfo = require("../../common");
const { finishTimerProcess } = require("../process");

const { REDIS_DB, RDS_HOST, RDS_AUTH } = process.env;

const REDIS_CONFIG = { host: RDS_HOST, port: 6379, password: RDS_AUTH, db: REDIS_DB };

const finishTimerQueue = new Bull(`finishTimer`, { redis: REDIS_CONFIG });

const finishTimer = async (data) => {
  try {
    const options = {
      delay: data.timer,
      jobId: data.jobId,
      removeOnComplete: true
    };
    await finishTimerQueue.add(data, options);
    return finishTimerQueue;
  } catch (error) {
    logger.error("-----> error finishTimerQueue", error);
    getInfo.exceptionError(error);
  }
};

finishTimerQueue.process(finishTimerProcess);

module.exports = finishTimer;

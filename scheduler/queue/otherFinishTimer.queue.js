const Bull = require("bull");
const logger = require("../../utils/logger");
const getInfo = require("../../common");
const { otherFinishTimerProcess } = require("../process");

const { REDIS_DB, RDS_HOST, RDS_AUTH } = process.env;

const REDIS_CONFIG = { host: RDS_HOST, port: 6379, password: RDS_AUTH, db: REDIS_DB };

const otherFinishTimerQueue = new Bull(`otherFinishTimer`, { redis: REDIS_CONFIG });

const otherFinishTimer = async (data) => {
  try {
    const options = {
      delay: data.timer,
      jobId: data.jobId,
      removeOnComplete: true
    };
    await otherFinishTimerQueue.add(data, options);
    return otherFinishTimerQueue;
  } catch (error) {
    logger.error("-----> error otherFinishTimerQueue", error);
    getInfo.exceptionError(error);
  }
};

otherFinishTimerQueue.process(otherFinishTimerProcess);

module.exports = otherFinishTimer;

const Bull = require("bull");
const logger = require("../../utils/logger");
const roundTimerStartProcess = require("../process/roundTimerStart.process");
const getInfo = require("../../common");

const { REDIS_DB, RDS_HOST, RDS_AUTH } = process.env;

const REDIS_CONFIG = { host: RDS_HOST, port: 6379, password: RDS_AUTH, db: REDIS_DB };

const roundTimerQueue = new Bull(`roundTimerStart`, { redis: REDIS_CONFIG });

const roundTimerStart = async (data) => {
  try {
    const options = {
      delay: data.timer,
      jobId: data.jobId,
      removeOnComplete: true
    };
    await roundTimerQueue.add(data, options);
    return roundTimerQueue;
  } catch (error) {
    logger.error("-----> error roundTimerQueue", error);
    getInfo.exceptionError(error);
  }
};

roundTimerQueue.process(roundTimerStartProcess);

module.exports = roundTimerStart;

const Bull = require("bull");
const logger = require("../../utils/logger");
const getInfo = require("../../common");
const { dealRematchTimerProcess } = require("../process");

const { REDIS_DB, RDS_HOST, RDS_AUTH } = process.env;

const REDIS_CONFIG = { host: RDS_HOST, port: 6379, password: RDS_AUTH, db: REDIS_DB };

const dealRematchTimerQueue = new Bull(`dealRematchTimer`, { redis: REDIS_CONFIG });

const dealRematchTimer = async (data) => {
  try {
    const options = {
      delay: data.timer,
      jobId: data.jobId,
      removeOnComplete: true
    };
    await dealRematchTimerQueue.add(data, options);
    return dealRematchTimerQueue;
  } catch (error) {
    logger.error("-----> error dealRematchTimerQueue", error);
    getInfo.exceptionError(error);
  }
};

dealRematchTimerQueue.process(dealRematchTimerProcess);

module.exports = dealRematchTimer;

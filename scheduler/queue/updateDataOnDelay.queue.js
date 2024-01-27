const Bull = require("bull");
const logger = require("../../utils/logger");
// const userTurnStartProcess = require("../process/UserTurnStart.process");
const getInfo = require("../../common");
const { updateDataOnDelayProcess } = require("../process");

const { REDIS_DB, RDS_HOST, RDS_AUTH } = process.env;

const REDIS_CONFIG = { host: RDS_HOST, port: 6379, password: RDS_AUTH, db: REDIS_DB };

const updateDataOnDelayQueue = new Bull(`updateDataOnDelay`, { redis: REDIS_CONFIG });

const updateDataOnDelay = async (data) => {
  try {
    const options = {
      delay: data.timer,
      jobId: data.jobId,
      removeOnComplete: true
    };
    await updateDataOnDelayQueue.add(data, options);
    return updateDataOnDelayQueue;
  } catch (error) {
    logger.error("-----> error updateDataOnDelayQueue", error);
    getInfo.exceptionError(error);
  }
};

updateDataOnDelayQueue.process(updateDataOnDelayProcess);

module.exports = updateDataOnDelay;

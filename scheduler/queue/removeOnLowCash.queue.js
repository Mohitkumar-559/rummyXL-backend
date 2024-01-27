const Bull = require("bull");
const logger = require("../../utils/logger");
const getInfo = require("../../common");
const { removeOnLowCashProcess } = require("../process");

const { REDIS_DB, RDS_HOST, RDS_AUTH } = process.env;

const REDIS_CONFIG = { host: RDS_HOST, port: 6379, password: RDS_AUTH, db: REDIS_DB };

const removeOnLowCashQueue = new Bull(`removeOnLowCash`, { redis: REDIS_CONFIG });

const removeOnLowCash = async (data) => {
  try {
    const options = {
      delay: data.timer,
      jobId: data.jobId,
      removeOnComplete: true
    };
    await removeOnLowCashQueue.add(data, options);
    return removeOnLowCashQueue;
  } catch (error) {
    logger.error("-----> error removeOnLowCashQueue", error);
    getInfo.exceptionError(error);
  }
};

removeOnLowCashQueue.process(removeOnLowCashProcess);

module.exports = removeOnLowCash;

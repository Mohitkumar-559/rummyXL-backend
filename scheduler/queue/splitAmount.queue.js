const Bull = require("bull");
const logger = require("../../utils/logger");
const getInfo = require("../../common");
const { splitAmountProcess } = require("../process");

const { REDIS_DB, RDS_HOST, RDS_AUTH } = process.env;

const REDIS_CONFIG = { host: RDS_HOST, port: 6379, password: RDS_AUTH, db: REDIS_DB };

const splitAmountQueue = new Bull(`splitAmount`, { redis: REDIS_CONFIG });

const splitAmount = async (data) => {
  try {
    const options = {
      delay: data.timer,
      jobId: data.jobId,
      removeOnComplete: true
    };
    await splitAmountQueue.add(data, options);
    return splitAmountQueue;
  } catch (error) {
    logger.error("-----> error splitAmountQueue", error);
    getInfo.exceptionError(error);
  }
};

splitAmountQueue.process(splitAmountProcess);

module.exports = splitAmount;

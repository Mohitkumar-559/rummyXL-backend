const Bull = require("bull");
const logger = require("../../utils/logger");
const getInfo = require("../../common");
const { botSeatTimeoutProcess } = require("../process");

const { REDIS_DB, RDS_HOST, RDS_AUTH } = process.env;

const REDIS_CONFIG = { host: RDS_HOST, port: 6379, password: RDS_AUTH, db: REDIS_DB };

const botSeatTimeoutQueue = new Bull(`botSeatTimeout`, { redis: REDIS_CONFIG });

const botSeatTimeout = async (data) => {
  try {
    const options = {
      delay: data.timer,
      jobId: data.jobId,
      removeOnComplete: true
    };
    await botSeatTimeoutQueue.add(data, options);
    return botSeatTimeoutQueue;
  } catch (error) {
    logger.error("-----> error botSeatTimeoutQueue", error);
    getInfo.exceptionError(error);
  }
};

botSeatTimeoutQueue.process(botSeatTimeoutProcess);

module.exports = botSeatTimeout;

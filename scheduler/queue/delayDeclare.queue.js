const Bull = require("bull");
const logger = require("../../utils/logger");
const getInfo = require("../../common");
const { delayDeclareProcess } = require("../process");

const { REDIS_DB, RDS_HOST, RDS_AUTH } = process.env;

const REDIS_CONFIG = { host: RDS_HOST, port: 6379, password: RDS_AUTH, db: REDIS_DB };

const delayDeclareQueue = new Bull(`delayDeclare`, { redis: REDIS_CONFIG });

const delayDeclare = async (data) => {
  try {
    const options = {
      delay: data.timer,
      jobId: data.jobId,
      removeOnComplete: true
    };
    await delayDeclareQueue.add(data, options);
    return delayDeclareQueue;
  } catch (error) {
    logger.error("-----> error delayDeclareQueue", error);
    getInfo.exceptionError(error);
  }
};

delayDeclareQueue.process(delayDeclareProcess);

module.exports = delayDeclare;

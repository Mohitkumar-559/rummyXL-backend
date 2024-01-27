const Bull = require("bull");
const logger = require("../../utils/logger");
const getInfo = require("../../common");
const { robotTurnStartProcess } = require("../process");

const { REDIS_DB, RDS_HOST, RDS_AUTH } = process.env;

const REDIS_CONFIG = { host: RDS_HOST, port: 6379, password: RDS_AUTH, db: REDIS_DB };

const robotTurnStartQueue = new Bull(`robotTurnStart`, { redis: REDIS_CONFIG });

const robotTurnStart = async (data) => {
  try {
    const options = {
      delay: data.timer,
      jobId: data.jobId,
      removeOnComplete: true
    };
    await robotTurnStartQueue.add(data, options);
    return robotTurnStartQueue;
  } catch (error) {
    logger.error("-----> error robotTurnStartQueue", error);
    getInfo.exceptionError(error);
  }
};

robotTurnStartQueue.process(robotTurnStartProcess);

module.exports = robotTurnStart;

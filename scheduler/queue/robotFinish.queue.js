const Bull = require("bull");
const logger = require("../../utils/logger");
const getInfo = require("../../common");
const { robotFinishProcess } = require("../process");

const { REDIS_DB, RDS_HOST, RDS_AUTH } = process.env;

const REDIS_CONFIG = { host: RDS_HOST, port: 6379, password: RDS_AUTH, db: REDIS_DB };

const robotFinishQueue = new Bull(`robotFinish`, { redis: REDIS_CONFIG });

const robotFinish = async (data) => {
  try {
    const options = {
      delay: data.timer,
      jobId: data.jobId,
      removeOnComplete: true
    };
    await robotFinishQueue.add(data, options);
    return robotFinishQueue;
  } catch (error) {
    logger.error("-----> error robotFinishQueue", error);
    getInfo.exceptionError(error);
  }
};

robotFinishQueue.process(robotFinishProcess);

module.exports = robotFinish;

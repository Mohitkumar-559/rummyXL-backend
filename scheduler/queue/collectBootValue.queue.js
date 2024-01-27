const Bull = require("bull");
const logger = require("../../utils/logger");
const getInfo = require("../../common");
const { collectBootValueProcess } = require("../process");

const { REDIS_DB, RDS_HOST, RDS_AUTH } = process.env;

const REDIS_CONFIG = { host: RDS_HOST, port: 6379, password: RDS_AUTH, db: REDIS_DB };

const collectBootValueQueue = new Bull(`collectBootValue`, { redis: REDIS_CONFIG });

const collectBootValue = async (data) => {
  try {
    const options = {
      delay: data.timer,
      jobId: data.jobId,
      removeOnComplete: true
    };
    await collectBootValueQueue.add(data, options);
    return collectBootValueQueue;
  } catch (error) {
    logger.error("-----> error collectBootValueQueue", error);
    getInfo.exceptionError(error);
  }
};

collectBootValueQueue.process(collectBootValueProcess);

module.exports = collectBootValue;

const Bull = require("bull");
const logger = require("../../utils/logger");
const getInfo = require("../../common");
const { rejoinPoolTableProcess } = require("../process");

const { REDIS_DB, RDS_HOST, RDS_AUTH } = process.env;

const REDIS_CONFIG = { host: RDS_HOST, port: 6379, password: RDS_AUTH, db: REDIS_DB };

const rejoinPoolTableQueue = new Bull(`rejoinPoolTable`, { redis: REDIS_CONFIG });

const rejoinPoolTable = async (data) => {
  try {
    const options = {
      delay: data.timer,
      jobId: data.jobId,
      removeOnComplete: true
    };
    await rejoinPoolTableQueue.add(data, options);
    return rejoinPoolTableQueue;
  } catch (error) {
    logger.error("-----> error rejoinPoolTableQueue", error);
    getInfo.exceptionError(error);
  }
};

rejoinPoolTableQueue.process(rejoinPoolTableProcess);

module.exports = rejoinPoolTable;

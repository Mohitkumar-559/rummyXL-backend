const Bull = require("bull");
const logger = require("../../utils/logger");
const getInfo = require("../../common");
const { leaveTableTimeoutProcess } = require("../process");

const { REDIS_DB, RDS_HOST, RDS_AUTH } = process.env;

const REDIS_CONFIG = { host: RDS_HOST, port: 6379, password: RDS_AUTH, db: REDIS_DB };

const leaveTableTimeoutQueue = new Bull(`leaveTableTimeout`, { redis: REDIS_CONFIG });

const leaveTableTimeout = async (data) => {
  try {
    const options = {
      delay: data.timer,
      jobId: data.jobId,
      removeOnComplete: true
    };
    await leaveTableTimeoutQueue.add(data, options);
    return leaveTableTimeoutQueue;
  } catch (error) {
    logger.error("-----> error leaveTableTimeoutQueue", error);
    getInfo.exceptionError(error);
  }
};

leaveTableTimeoutQueue.process(leaveTableTimeoutProcess);

module.exports = leaveTableTimeout;

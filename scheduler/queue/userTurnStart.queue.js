const Bull = require("bull");
const logger = require("../../utils/logger");
// const userTurnStartProcess = require("../process/UserTurnStart.process");
const getInfo = require("../../common");
const { userTurnStartProcess } = require("../process");

const { REDIS_DB, RDS_HOST, RDS_AUTH } = process.env;

const REDIS_CONFIG = { host: RDS_HOST, port: 6379, password: RDS_AUTH, db: REDIS_DB };

const userTurnStartQueue = new Bull(`userTurnStart`, { redis: REDIS_CONFIG });

const userTurnStart = async (data) => {
  try {
    const options = {
      delay: data.timer,
      jobId: data.jobId,
      removeOnComplete: true
    };
    await userTurnStartQueue.add(data, options);
    return userTurnStartQueue;
  } catch (error) {
    logger.error("-----> error userTurnStartQueue", error);
    getInfo.exceptionError(error);
  }
};

userTurnStartQueue.process(userTurnStartProcess);

module.exports = userTurnStart;

const Bull = require("bull");
const logger = require("../../utils/logger");
const getInfo = require("../../common");
const { changeTableTurnProcess } = require("../process");

const { REDIS_DB, RDS_HOST, RDS_AUTH } = process.env;

const REDIS_CONFIG = { host: RDS_HOST, port: 6379, password: RDS_AUTH, db: REDIS_DB };

const changeTableTurnQueue = new Bull(`changeTableTurn`, { redis: REDIS_CONFIG });

const changeTableTurn = async (data) => {
  try {
    const options = {
      delay: data.timer,
      jobId: data.jobId,
      removeOnComplete: true
    };
    await changeTableTurnQueue.add(data, options);
    return changeTableTurnQueue;
  } catch (error) {
    logger.error("-----> error changeTableTurnQueue", error);
    getInfo.exceptionError(error);
  }
};

changeTableTurnQueue.process(changeTableTurnProcess);

module.exports = changeTableTurn;

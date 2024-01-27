const logger = require("../../utils/logger");
const commonEventEmitter = require("../../eventEmitter/index");
const { BOT_SEAT_TIMEOUT } = require("../../constants/eventName");
const getInfo = require("../../common");

const botSeatTimeoutProcess = async (job, done) => {
  try {
    commonEventEmitter.emit(BOT_SEAT_TIMEOUT, job.data.tableId, job.data.gameType);
    done();
    return job.data;
  } catch (e) {
    logger.error("-----> error botSeatTimeoutProcess", error);
    getInfo.exceptionError(error);
    return undefined;
  }
};

module.exports = botSeatTimeoutProcess;

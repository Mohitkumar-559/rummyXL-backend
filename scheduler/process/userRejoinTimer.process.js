const logger = require("../../utils/logger");
const commonEventEmitter = require("../../eventEmitter/index");
const { USER_REJOIN_TIMER } = require("../../constants/eventName");
const getInfo = require("../../common");

const userRejoinTimerProcess = async (job, done) => {
  try {
    commonEventEmitter.emit(USER_REJOIN_TIMER, job.data);
    done();
    return job.data;
  } catch (e) {
    logger.error("-----> error userRejoinTimerProcess", error);
    getInfo.exceptionError(error);
    return undefined;
  }
};

module.exports = userRejoinTimerProcess;

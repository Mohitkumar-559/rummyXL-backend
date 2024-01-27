const logger = require("../../utils/logger");
const commonEventEmitter = require("../../eventEmitter/index");
const { FINISH_TIMER } = require("../../constants/eventName");
const getInfo = require("../../common");

const finishTimerProcess = async (job, done) => {
  try {
    commonEventEmitter.emit(FINISH_TIMER, job.data.tableId);
    done();
    return job.data;
  } catch (e) {
    logger.error("-----> error finishTimerProcess", error);
    getInfo.exceptionError(error);
    return undefined;
  }
};

module.exports = finishTimerProcess;

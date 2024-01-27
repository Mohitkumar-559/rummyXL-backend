const logger = require("../../utils/logger");
const commonEventEmitter = require("../../eventEmitter/index");
const { DECLARE_TIMER } = require("../../constants/eventName");
const getInfo = require("../../common");

const otherFinishTimerProcess = async (job, done) => {
  try {
    commonEventEmitter.emit(DECLARE_TIMER, job.data.tableId);
    done();
    return job.data;
  } catch (e) {
    logger.error("-----> error otherFinishTimerProcess", error);
    getInfo.exceptionError(error);
    return undefined;
  }
};

module.exports = otherFinishTimerProcess;

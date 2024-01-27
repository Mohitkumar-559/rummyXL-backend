const logger = require("../../utils/logger");
const commonEventEmitter = require("../../eventEmitter/index");
const { ROUND_TIMER_START_TIMER } = require("../../constants/eventName");
const getInfo = require("../../common");
const roundTimerStartProcess = async (job, done) => {
  try {
    commonEventEmitter.emit(ROUND_TIMER_START_TIMER, job.data.tableId.toString());
    done();
    return job.data;
  } catch (e) {
    logger.error("-----> error roundTimerStartProcess", error);
    getInfo.exceptionError(error);
    return undefined;
  }
};

module.exports = roundTimerStartProcess;

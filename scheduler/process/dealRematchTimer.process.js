const logger = require("../../utils/logger");
const commonEventEmitter = require("../../eventEmitter/index");
const { DEAL_REMATCH_TIMER } = require("../../constants/eventName");
const getInfo = require("../../common");

const dealRematchTimerProcess = async (job, done) => {
  try {
    commonEventEmitter.emit(DEAL_REMATCH_TIMER, job.data);
    done();
    return job.data;
  } catch (e) {
    logger.error("-----> error dealRematchTimerProcess", error);
    getInfo.exceptionError(error);
    return undefined;
  }
};

module.exports = dealRematchTimerProcess;

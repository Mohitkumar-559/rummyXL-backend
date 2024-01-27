const logger = require("../../utils/logger");
const commonEventEmitter = require("../../eventEmitter/index");
const { USER_TURN_START_TIMER, ON_TURN_EXPIRE_TIMER } = require("../../constants/eventName");
const getInfo = require("../../common");

const userTurnStartProcess = async (job, done) => {
  try {
    if (job.data.onTurnExpire) {
      commonEventEmitter.emit(ON_TURN_EXPIRE_TIMER, job.data.table);
    } else {
      commonEventEmitter.emit(USER_TURN_START_TIMER, job.data);
    }
    done();
    return job.data;
  } catch (e) {
    logger.error("-----> error userTurnStartProcess", error);
    getInfo.exceptionError(error);
    return undefined;
  }
};

module.exports = userTurnStartProcess;

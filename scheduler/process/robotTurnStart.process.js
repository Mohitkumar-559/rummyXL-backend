const logger = require("../../utils/logger");
const commonEventEmitter = require("../../eventEmitter/index");
const { ROBOT_TURN_START_TIMER } = require("../../constants/eventName");
const getInfo = require("../../common");

const robotTurnStartProcess = async (job, done) => {
  try {
    commonEventEmitter.emit(ROBOT_TURN_START_TIMER, job.data.tableId.toString());
    done();
    return job.data;
  } catch (e) {
    logger.error("-----> error robotTurnStartProcess", error);
    getInfo.exceptionError(error);
    return undefined;
  }
};

module.exports = robotTurnStartProcess;

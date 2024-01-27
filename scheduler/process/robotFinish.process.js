const logger = require("../../utils/logger");
const commonEventEmitter = require("../../eventEmitter/index");
const { ROBOT_FINISH } = require("../../constants/eventName");
const getInfo = require("../../common");

const robotFinishProcess = async (job, done) => {
  try {
    if (job.data.robotFinish) {
      commonEventEmitter.emit(ROBOT_FINISH, job.data);
    }
    done();
    return job.data;
  } catch (e) {
    logger.error("-----> error robotFinishProcess", error);
    getInfo.exceptionError(error);
    return undefined;
  }
};

module.exports = robotFinishProcess;

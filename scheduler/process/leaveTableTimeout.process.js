const logger = require("../../utils/logger");
const commonEventEmitter = require("../../eventEmitter/index");
const { LEAVE_TABLE_TIMEOUT } = require("../../constants/eventName");
const getInfo = require("../../common");

const leaveTableTimeoutProcess = async (job, done) => {
  try {
    commonEventEmitter.emit(LEAVE_TABLE_TIMEOUT, job.data.firstParams, job.data.secondParams);
    done();
    return job.data;
  } catch (e) {
    logger.error("-----> error leaveTableTimeoutProcess", error);
    getInfo.exceptionError(error);
    return undefined;
  }
};

module.exports = leaveTableTimeoutProcess;

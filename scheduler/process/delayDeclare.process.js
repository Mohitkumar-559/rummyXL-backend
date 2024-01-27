const logger = require("../../utils/logger");
const commonEventEmitter = require("../../eventEmitter/index");
const { DELAY_DECLARE } = require("../../constants/eventName");
const getInfo = require("../../common");

const delayDeclareProcess = async (job, done) => {
  try {
    commonEventEmitter.emit(DELAY_DECLARE, job.data.firstParams, job.data.secondParams);
    done();
    return job.data;
  } catch (e) {
    logger.error("-----> error delayDeclareProcess", error);
    getInfo.exceptionError(error);
    return undefined;
  }
};

module.exports = delayDeclareProcess;

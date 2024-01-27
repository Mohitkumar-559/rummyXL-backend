const logger = require("../../utils/logger");
const commonEventEmitter = require("../../eventEmitter/index");
const { RESUME_AND_DROP } = require("../../constants/eventName");
const getInfo = require("../../common");

const resumeAndDropProcess = async (job, done) => {
  try {

    commonEventEmitter.emit(RESUME_AND_DROP, job.data.tableId);
    done();
    return job.data;
  } catch (e) {
    logger.error("-----> error resumeAndDropProcess", error);
    getInfo.exceptionError(error);
    return undefined;
  }
};

module.exports = resumeAndDropProcess;

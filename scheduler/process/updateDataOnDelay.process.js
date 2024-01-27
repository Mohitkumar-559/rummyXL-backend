const logger = require("../../utils/logger");
const commonEventEmitter = require("../../eventEmitter/index");
const { UPDATE_ON_DELAY } = require("../../constants/eventName");
const getInfo = require("../../common");

const updateDataOnDelayProcess = async (job, done) => {
  try {
    commonEventEmitter.emit(UPDATE_ON_DELAY, job.data.query, job.data.updateObject);
    done();
    return job.data;
  } catch (e) {
    logger.error("-----> error updateDataOnDelayProcess", error);
    getInfo.exceptionError(error);
    return undefined;
  }
};

module.exports = updateDataOnDelayProcess;

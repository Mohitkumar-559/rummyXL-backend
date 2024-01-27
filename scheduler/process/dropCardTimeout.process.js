const logger = require("../../utils/logger");
const commonEventEmitter = require("../../eventEmitter/index");
const { DROP_CARD_TIMEOUT } = require("../../constants/eventName");
const getInfo = require("../../common");

const dropCardTimeoutProcess = async (job, done) => {
  try {
    commonEventEmitter.emit(DROP_CARD_TIMEOUT, job.data.firstParams, job.data.secondParams, job.data.thirdParams, job.data.fourthParams);
    done();
    return job.data;
  } catch (e) {
    logger.error("-----> error dropCardTimeoutProcess", error);
    getInfo.exceptionError(error);
    return undefined;
  }
};

module.exports = dropCardTimeoutProcess;

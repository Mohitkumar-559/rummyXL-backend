const logger = require("../../utils/logger");
const commonEventEmitter = require("../../eventEmitter/index");
const { SELECT_DEALER } = require("../../constants/eventName");
const getInfo = require("../../common");

const selectDealerProcess = async (job, done) => {
  try {
    commonEventEmitter.emit(SELECT_DEALER, job.data);
    done();
    return job.data;
  } catch (e) {
    logger.error("-----> error selectDealerProcess", error);
    getInfo.exceptionError(error);
    return undefined;
  }
};

module.exports = selectDealerProcess;

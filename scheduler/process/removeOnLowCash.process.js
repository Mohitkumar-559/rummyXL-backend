const logger = require("../../utils/logger");
const commonEventEmitter = require("../../eventEmitter/index");
const { REMOVE_ON_LOW_CASH } = require("../../constants/eventName");
const getInfo = require("../../common");

const removeOnLowCashProcess = async (job, done) => {
  try {
    commonEventEmitter.emit(REMOVE_ON_LOW_CASH, job.data.tableId);
    done();
    return job.data;
  } catch (e) {
    logger.error("-----> error removeOnLowCashProcess", error);
    getInfo.exceptionError(error);
    return undefined;
  }
};

module.exports = removeOnLowCashProcess;

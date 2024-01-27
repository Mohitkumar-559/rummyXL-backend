const logger = require("../../utils/logger");
const commonEventEmitter = require("../../eventEmitter/index");
const { SPLIT_AMOUNT } = require("../../constants/eventName");
const getInfo = require("../../common");

const splitAmountProcess = async (job, done) => {
  try {
    commonEventEmitter.emit(SPLIT_AMOUNT, job.data.tableId, job.data?.splitAmountDirect);
    done();
    return job.data;
  } catch (e) {
    logger.error("-----> error splitAmountProcess", error);
    getInfo.exceptionError(error);
    return undefined;
  }
};

module.exports = splitAmountProcess;

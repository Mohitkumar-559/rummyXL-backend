const logger = require("../../utils/logger");
const commonEventEmitter = require("../../eventEmitter/index");
const { CARD_DEALT } = require("../../constants/eventName");
const getInfo = require("../../common");

const cardsDealtProcess = async (job, done) => {
  try {
    commonEventEmitter.emit(CARD_DEALT, job.data.tableId);
    done();
    return job.data;
  } catch (e) {
    logger.error("-----> error cardsDealtProcess", error);
    getInfo.exceptionError(error);
    return undefined;
  }
};

module.exports = cardsDealtProcess;

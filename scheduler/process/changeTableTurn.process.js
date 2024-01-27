const logger = require("../../utils/logger");
const commonEventEmitter = require("../../eventEmitter/index");
const { CHANGE_TABLE_TURN } = require("../../constants/eventName");
const getInfo = require("../../common");

const changeTableTurnProcess = async (job, done) => {
  try {
    commonEventEmitter.emit(CHANGE_TABLE_TURN, job.data.tableId, job.data.lastAction);
    done();
    return job.data;
  } catch (e) {
    logger.error("-----> error changeTableTurnProcess", error);
    getInfo.exceptionError(error);
    return;
  }
};

module.exports = changeTableTurnProcess;

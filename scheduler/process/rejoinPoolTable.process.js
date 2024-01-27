const logger = require("../../utils/logger");
const commonEventEmitter = require("../../eventEmitter/index");
const { REJOIN_POOL_TABLE } = require("../../constants/eventName");
const getInfo = require("../../common");

const rejoinPoolTableProcess = async (job, done) => {
  try {
    commonEventEmitter.emit(REJOIN_POOL_TABLE, job.data);
    done();
    return job.data;
  } catch (e) {
    logger.error("-----> error rejoinPoolTableProcess", error);
    getInfo.exceptionError(error);
    return undefined;
  }
};

module.exports = rejoinPoolTableProcess;

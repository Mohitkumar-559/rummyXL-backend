const logger = require("../../utils/logger");
const commonEventEmitter = require("../../eventEmitter/index");
const { COLLECT_BOOT_VALUE } = require("../../constants/eventName");
const getInfo = require("../../common");

const collectBootValueProcess = async (job, done) => {
  try {
    commonEventEmitter.emit(COLLECT_BOOT_VALUE, job.data.tableId, job.data.pv, job.data.pi);
    done();
    return job.data;
  } catch (e) {
    logger.error("-----> error collectBootValueProcess", error);
    getInfo.exceptionError(error);
    return undefined;
  }
};

module.exports = collectBootValueProcess;

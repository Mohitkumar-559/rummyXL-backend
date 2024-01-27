const Bull = require("bull");
const logger = require("../../utils/logger");
const getInfo = require("../../common");
const { selectDealerProcess } = require("../process");

const { REDIS_DB, RDS_HOST, RDS_AUTH } = process.env;

const REDIS_CONFIG = { host: RDS_HOST, port: 6379, password: RDS_AUTH, db: REDIS_DB };

const selectDealerQueue = new Bull(`selectDealer`, { redis: REDIS_CONFIG });

const selectDealer = async (data) => {
  try {
    const options = {
      delay: data.timer,
      jobId: data.jobId,
      removeOnComplete: true
    };
    await selectDealerQueue.add(data, options);
    return selectDealerQueue;
  } catch (error) {
    logger.error("-----> error selectDealerQueue", error);
    getInfo.exceptionError(error);
  }
};

selectDealerQueue.process(selectDealerProcess);

module.exports = selectDealer;

const Bull = require("bull");
const logger = require("../../utils/logger");
const getInfo = require("../../common");
const { resumeAndDropProcess } = require("../process");

const { REDIS_DB, RDS_HOST, RDS_AUTH } = process.env;

const REDIS_CONFIG = { host: RDS_HOST, port: 6379, password: RDS_AUTH, db: REDIS_DB };

const resumeAndDropQueue = new Bull(`resumeAndDrop`, { redis: REDIS_CONFIG });

const resumeAndDrop = async (data) => {
  try {
    const options = {
      delay: data.timer,
      jobId: data.jobId,
      removeOnComplete: true
    };
    await resumeAndDropQueue.add(data, options);
    return resumeAndDropQueue;
  } catch (error) {
    logger.error("-----> error resumeAndDropQueue", error);
    getInfo.exceptionError(error);
  }
};

resumeAndDropQueue.process(resumeAndDropProcess);

module.exports = resumeAndDrop;

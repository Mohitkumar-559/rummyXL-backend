const Bull = require("bull");
const logger = require("../../utils/logger");
const getInfo = require("../../common");

const { REDIS_DB, RDS_HOST, RDS_AUTH } = process.env;

const REDIS_CONFIG = { host: RDS_HOST, port: 6379, password: RDS_AUTH, db: REDIS_DB };

const cancelFinishTimerQueue = new Bull(`finishTimer`, { redis: REDIS_CONFIG });

const cancelFinishTimer = async (jobId) => {
    try {
        const job = await cancelFinishTimerQueue.getJob(jobId);

        if (job) {
            await job.remove();
        }
    } catch (error) {
        console.error("-----> error cancelFinishTimer", error);
        getInfo.exceptionError(error);
    }
};

module.exports = cancelFinishTimer;

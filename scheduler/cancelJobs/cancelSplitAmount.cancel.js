const Bull = require("bull");
const logger = require("../../utils/logger");
const getInfo = require("../../common");

const { REDIS_DB, RDS_HOST, RDS_AUTH } = process.env;

const REDIS_CONFIG = { host: RDS_HOST, port: 6379, password: RDS_AUTH, db: REDIS_DB };

const cancelSplitAmountQueue = new Bull(`splitAmount`, { redis: REDIS_CONFIG });

const cancelSplitAmount = async (jobId) => {
    try {
        const job = await cancelSplitAmountQueue.getJob(jobId);

        if (job) {
            await job.remove();
        }
    } catch (error) {
        console.error("-----> error cancelSplitAmount", error);
        getInfo.exceptionError(error);
    }
};

module.exports = cancelSplitAmount;

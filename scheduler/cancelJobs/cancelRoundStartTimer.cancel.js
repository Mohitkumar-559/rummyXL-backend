const Bull = require("bull");
const getInfo = require("../../common");

const { REDIS_DB, RDS_HOST, RDS_AUTH } = process.env;

const REDIS_CONFIG = { host: RDS_HOST, port: 6379, password: RDS_AUTH, db: REDIS_DB };

const cancelRoundTimerStartQueue = new Bull(`roundTimerStart`, { redis: REDIS_CONFIG });

const cancelRoundTimerStart = async (jobId) => {
    try {
        const job = await cancelRoundTimerStartQueue.getJob(jobId);
        console.log("cancelRoundTimerStartQueue");
        if (job) {
            console.log("if cancelRoundTimerStartQueue", job.id);
            await job.remove();
        }
    } catch (error) {
        console.error("-----> error cancelRoundTimerStart", error);
        getInfo.exceptionError(error);
    }
};

module.exports = cancelRoundTimerStart;

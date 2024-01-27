const Bull = require("bull");
const { REDIS_DB, RDS_HOST, RDS_AUTH } = process.env;
const REDIS_CONFIG = { host: RDS_HOST, port: 6379, password: RDS_AUTH, db: REDIS_DB };
const logger = require("../utils/logger");
const { bullProcess } = require("./bullProcess");

// Create a queue named 'RummyXLQueue' with Redis connection details
const RummyXLQueue = new Bull('RummyXLQueue', { redis: REDIS_CONFIG });

// Define a job processing function
RummyXLQueue.process(bullProcess);


const addQueue = (jobData, optionsData) => {
    const options = {
        delay: optionsData.delay,
        jobId: optionsData.jobId,
        removeOnComplete: true
    };

    RummyXLQueue.add(jobData, options)
        .then(async (job) => {
            logger.info("Job created with details", job.id);
        })
        .catch((error) => {
            logger.error('Failed to add job:', error);
        });
    return RummyXLQueue;
};
// Cancel the job
const cancelJob = async (jobId) => {
    const job = await RummyXLQueue.getJob(jobId);
    if (job === null) {
        logger.info(`Job not found.`, jobId);
    } else {
        job.remove().then(() => {
            logger.info(`Job cancelled.`, jobId);
        }).catch((error) => {
            logger.error(`Failed to cancel job ${jobId}:`, error);
        });
    }
};

// Start the queue and process jobs
RummyXLQueue.on('bull Queue completed', (job) => {
    logger.info(`Job ${job.id} completed`);
}).on('bull Queue failed', (job, error) => {
    logger.error(`Job ${job.id} failed: ${error}`);
});

module.exports = { addQueue, cancelJob };
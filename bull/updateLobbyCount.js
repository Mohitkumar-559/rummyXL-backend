const Queue = require('bull');
const logger = require('../utils/logger');
const getInfo = require("../common");
const { updateLobbyCount } = require('../common/newUpdateLobbyCount');

const REDIS_CONFIG = {
    host: process.env.RDS_HOST,
    port: 6379,
    password: process.env.RDS_AUTH,
    db: process.env.REDIS_DB,
};

const defaultJobOptions = { removeOnComplete: true, removeOnFail: true, lazyConnect: true, timeout: 5000 };
const settings = { maxStalledCount: 1 };

class UpdateLobbyCountQueue {
    constructor() {

        this.queueKYCAttemptRest = new Queue('Update-Lobby-Count-Queue', { redis: REDIS_CONFIG, defaultJobOptions, settings });

        this.queueKYCAttemptRest.on('completed', function (job, result) {
            logger.info("Completed: updateLobbyCount Job-", job.id);
        });
        this.queueKYCAttemptRest.on('failed', async function (job, error) {
            logger.error("Failed: updateLobbyCount Job-", job.id + error);
        });
        this.queueKYCAttemptRest.on('error', async function (error) {
            logger.error("error: updateLobbyCount Job-", error);
        });


        // consumer
        this.queueKYCAttemptRest.process(async (job, done) => {
            await this.updateLobbyCount();
            done();
        });


    }

    // producer
    async UpdateLobbyCountToQueue() {
        const resetOptions = { repeat: { cron: '*/5 * * * *' } };
        await this.queueKYCAttemptRest.add({}, resetOptions);
    }



    async updateLobbyCount() {
        try {
            logger.info("Update Lobby Count");
            updateLobbyCount();
        } catch (error) {
            logger.error("-----> error Update Lobby Count", error);
            getInfo.exceptionError(error);
        }
    }


}

module.exports = UpdateLobbyCountQueue;
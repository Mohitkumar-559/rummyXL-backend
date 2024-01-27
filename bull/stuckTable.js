const Queue = require('bull');
const logger = require('../utils/logger');
const getInfo = require("../common");
const { checkStuckTables } = require("../common/stucktables.class");
const { GetConfig } = require("../connections/mongodb");


const REDIS_CONFIG = {
    host: process.env.RDS_HOST,
    port: 6379,
    password: process.env.RDS_AUTH,
    db: process.env.REDIS_DB,
};

const defaultJobOptions = { removeOnComplete: true, removeOnFail: true, lazyConnect: true, timeout: 5000 };
const settings = { maxStalledCount: 1 };

class STUCKTableReset {
    constructor() {

        this.queueKYCAttemptRest = new Queue('table-release-stuck', { redis: REDIS_CONFIG, defaultJobOptions, settings });

        this.queueKYCAttemptRest.on('completed', function (job, result) {
            logger.info("Completed: STUCKtable Job-", job.id);
        });
        this.queueKYCAttemptRest.on('failed', async function (job, error) {
            logger.error("Failed: STUCKtable Job-", job.id + error);
        });
        this.queueKYCAttemptRest.on('error', async function (error) {
            logger.error("error: STUCKtable Job-", error);
        });


        // consumer
        this.queueKYCAttemptRest.process(async (job, done) => {
            await this.StuckTable();
            done();
        });


    }

    // producer
    async STUCKResetToQueue() {
       const { STUCK_TABLE_CRON_REPEAT_TIME } = GetConfig();
        const resetOptions = { repeat: { every: STUCK_TABLE_CRON_REPEAT_TIME*60*1000 } };
        await this.queueKYCAttemptRest.add({}, resetOptions);
    }



    async StuckTable() {
        try {
            logger.info("stuck table release queue");

            /* +---------------------------------------------------------------
               reset the kyc api PAN, Bank, UPi api
            --------------------------------------------------------------------*/

            await checkStuckTables()
            
        } catch (error) {
            logger.error("-----> error red flag function", error);
            getInfo.exceptionError(error);
        }
    }


}

module.exports = STUCKTableReset;
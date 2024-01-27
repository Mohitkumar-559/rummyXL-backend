const Queue = require('bull');
const logger = require('../utils/logger');
const getInfo = require("../common");
const REDIS_CONFIG = {
    host: process.env.RDS_HOST,
    port: 6379,
    password: process.env.RDS_AUTH,
    db: process.env.REDIS_DB,
};

const defaultJobOptions = { removeOnComplete: true, removeOnFail: true, lazyConnect: true, timeout: 5000 };
const settings = { maxStalledCount: 1 };

class KYCAttemptResetQueue {
    constructor() {

        this.queueKYCAttemptRest = new Queue('KYC-attempt-reset-Queue', { redis: REDIS_CONFIG, defaultJobOptions, settings });

        this.queueKYCAttemptRest.on('completed', function (job, result) {
            logger.info("Completed: KYCAttemptRest Job-", job.id);
        });
        this.queueKYCAttemptRest.on('failed', async function (job, error) {
            logger.error("Failed: KYCAttemptRest Job-", job.id + error);
        });
        this.queueKYCAttemptRest.on('error', async function (error) {
            logger.error("error: KYCAttemptRest Job-", error);
        });


        // consumer
        this.queueKYCAttemptRest.process(async (job, done) => {
            await this.KYCReset();
            done();
        });


    }

    // producer
    async KYCResetToQueue() {
        const resetOptions = { repeat: { cron: '0 0 * * *' } };
        await this.queueKYCAttemptRest.add({}, resetOptions);
    }



    async KYCReset() {
        try {
            logger.info("update user kyc count of all user");

            /* +---------------------------------------------------------------
               reset the kyc api PAN, Bank, UPi api
            --------------------------------------------------------------------*/
            await db.collection("game_users").updateMany({}, { $set: { bank_kyc_count: 0, upi_kyc_count: 0, pan_kyc_count: 0 } });
            /* ---------------------Code End----------------------------------- */

            /* +---------------------------------------------------------------
               reset the kyc api PAN, Bank, UPi api and remove the REJECT user details
            --------------------------------------------------------------------*/
            // const data = await db.collection("user_details").find({ status: "REJECTED" }).toArray()
            // await db.collection("user_details_back_up").insertMany(data);

            //await db.collection("user_details").deleteMany({ status: "REJECTED" });
            /* ---------------------Code End----------------------------------- */

            /* ---------------------Remove table and user percent start----------------------------------- */
            //removeFinishTablePercent();
            /* ---------------------Remove table and user percent end----------------------------------- */

        } catch (error) {
            logger.error("-----> error reset User attempt function", error);
            getInfo.exceptionError(error);
        }
    }


}

module.exports = KYCAttemptResetQueue;
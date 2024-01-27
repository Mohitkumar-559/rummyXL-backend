const Queue = require('bull');
const logger = require('../utils/logger');
const getInfo = require("../common");
const _ = require("underscore");
const moment = require("moment");

const REDIS_CONFIG = {
    host: process.env.RDS_HOST,
    port: 6379,
    password: process.env.RDS_AUTH,
    db: process.env.REDIS_DB,
};



const defaultJobOptions = { removeOnComplete: true, removeOnFail: true, lazyConnect: true, timeout: 5000 };
const settings = { maxStalledCount: 1 };

class RemoveDataTableHistoryQueue {
    constructor() {

        this.queueRemoveDataTableHistory = new Queue('Remove-Data-Table-History-Queue', { redis: REDIS_CONFIG, defaultJobOptions, settings });

        this.queueRemoveDataTableHistory.on('completed', function (job, result) {
            logger.info("Completed: RemoveDataTableHistory Job-", job.id);
        });
        this.queueRemoveDataTableHistory.on('failed', async function (job, error) {
            logger.error("Failed: RemoveDataTableHistory Job-", job.id + error);
        });
        this.queueRemoveDataTableHistory.on('error', async function (error) {
            logger.error("error: RemoveDataTableHistory Job-", error);
        });


        // consumer
        this.queueRemoveDataTableHistory.process(async (job, done) => {
            await this.RemoveTableHistory();
            done();
        });


    }

    // producer
    async RemoveTableHistoryQueue() {
        const resetOptions = { repeat: { cron: '0 9 * * MON' } };
        await this.queueRemoveDataTableHistory.add({}, resetOptions);
    }



    async RemoveTableHistory() {
        try {
            let date = moment().subtract(5, 'days');
            let playing_table = (await db.collection("playing_table").distinct("_id")).map((id) => id.toString());
            let tableHistory = (await db.collection("tableHistory").distinct("tableId", { createdAt: { $lt: new Date(date) } })).map((id) => id.toString());
            let filteredKeywords = tableHistory.filter((word) => !playing_table.includes(word));
            filteredKeywords = filteredKeywords.map((word) => getInfo.MongoID(word));
            if (filteredKeywords.length > 0) {
                await db.collection("tableHistory").deleteMany({ tableId: { $in: filteredKeywords } });
            }
        } catch (error) {
            logger.error("-----> error Remove-Data-Table-History function", error);
            getInfo.exceptionError(error);
        }
    }
}


module.exports = RemoveDataTableHistoryQueue;
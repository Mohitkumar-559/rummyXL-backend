const Queue = require('bull');
const logger = require('../utils/logger');
const { accessKeyId, secretAccessKey, region, bucket, folderName } = require("../utils/config");
const { ListObjectsCommand, DeleteObjectsCommand } = require('@aws-sdk/client-s3');
const { S3Client } = require("@aws-sdk/client-s3");
const credentials = { region, accessKeyId, secretAccessKey };
const client = new S3Client({ credentials, region: region });
const { GetConfig } = require("../connections/mongodb");

const REDIS_CONFIG = {
    host: process.env.RDS_HOST,
    port: 6379,
    password: process.env.RDS_AUTH,
    db: process.env.REDIS_DB,
};

const defaultJobOptions = { removeOnComplete: true, removeOnFail: true, lazyConnect: true, timeout: 5000 };
const settings = { maxStalledCount: 1 };

class RemoveInvoiceQueue {
    constructor() {

        this.queueRemoveInvoice = new Queue('Remove-Invoice-Queue', { redis: REDIS_CONFIG, defaultJobOptions, settings });

        this.queueRemoveInvoice.on('completed', function (job, result) {
            logger.info("Completed: Invoice Job-", job.id);
        });
        this.queueRemoveInvoice.on('failed', async function (job, error) {
            logger.error("Failed: Invoice Job-", job.id + error);
        });
        this.queueRemoveInvoice.on('error', async function (error) {
            logger.error("error: Invoice Job-", error);
        });


        // consumer
        this.queueRemoveInvoice.process({}, async (job, done) => {
            await this.removeInvoice();
            done();
        });


    }

    // producer
    async removeInvoiceToQueue() {
        const invoiceOptions = { repeat: { cron: '10 4 * * *' } };
        await this.queueRemoveInvoice.add({}, invoiceOptions);
    }



    async removeInvoice() {
        try {
            // this is for get folder only.

            // const input = {
            //     "Bucket": `${bucket}`,
            //     Delimiter: `/`,
            //     Prefix: 'dev/pdfFiles/'
            // };
            // const command = new ListObjectsCommand(input);
            // const response = await client.send(command);
            // let keys = [];

            // for (const iterator of response?.CommonPrefixes) {
            //     const { Prefix } = iterator;
            //     const date1 = new Date();
            //     const date2 = new Date(Prefix.split('/')[2].split('-').join('/'));
            //     const diffDate = parseInt((date2 - date1) / (1000 * 60 * 60 * 24), 10);
            //     if (diffDate <= BUCKET_REMOVE_DAYS) keys.push({ Key: Prefix });

            // }

            const { BUCKET_REMOVE_DAYS } = GetConfig();

            const input = {
                "Bucket": bucket,
                // Delimiter: `.pdf`,
                Prefix: 'dev/pdfFiles/'
            };
            const command = new ListObjectsCommand(input);
            const response = await client.send(command);
            let keys = [];
            if (response?.Contents) {
                for (const iterator of response?.Contents) {
                    const { Key } = iterator;
                    const date1 = new Date();
                    const date2 = new Date(Key.split('/')[2].split('-').join('/'));
                    const diffDate = parseInt((date1 - date2) / (1000 * 60 * 60 * 24), 10);
                    if (diffDate > BUCKET_REMOVE_DAYS ?? 7) keys.push({ Key });
                }

                if (keys.length > 0) {
                    let deleteCommand = new DeleteObjectsCommand({
                        Bucket: bucket,
                        Delete: { Objects: keys },
                    });
                    const { Deleted } = await client.send(deleteCommand);
                    logger.info(
                        `Successfully deleted ${Deleted.length} objects from S3 bucket. Deleted objects:`
                    );
                }
            }
        } catch (error) {
            logger.error("error------> removeInvoice", error);
        }
    }


}

module.exports = RemoveInvoiceQueue;
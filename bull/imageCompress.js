const Queue = require('bull');
const logger = require('../utils/logger');
const getInfo = require("../common");
const { checkStuckTables } = require("../common/stucktables.class");
const AWS = require('aws-sdk');
const sharp = require('sharp');


const REDIS_CONFIG = {
    host: process.env.RDS_HOST,
    port: 6379,
    password: process.env.RDS_AUTH,
    db: process.env.REDIS_DB,
};

const {
    bucket,
    s3_key_id,
    s3_bucket_secrete_key,
    s3_bucket_region,
    environment,
    folderName
} = require("../utils/config")
const s3 = new AWS.S3({
    accessKeyId: s3_key_id,
    secretAccessKey: s3_bucket_secrete_key,
    region: s3_bucket_region
});

const defaultJobOptions = { removeOnComplete: true, removeOnFail: true, lazyConnect: true, timeout: 5000 };
const settings = { maxStalledCount: 1 };

class ImageCompressationSet {
    constructor() {

        this.queueImageCompressSet = new Queue('image-compress-set', { redis: REDIS_CONFIG, defaultJobOptions, settings });

        this.queueImageCompressSet.on('completed', function (job, result) {
            logger.info("Completed: imageCompress Job-", job.id);
        });
        this.queueImageCompressSet.on('failed', async function (job, error) {
            logger.error("Failed: imageCompress Job-", job.id + error);
        });
        this.queueImageCompressSet.on('error', async function (error) {
            logger.error("error: imageCompress Job-", error);
        });


        // consumer
        this.queueImageCompressSet.process(async (job, done) => {
            await this.ImageCompress();
            done();
        });


    }

    // producer
    async ImageCompressSetToQueue() {
        const resetOptions = { repeat: { cron: '0 4 * * *' } };
        await this.queueImageCompressSet.add({}, resetOptions);
    }



    async ImageCompress() {
        try {
            logger.info("Image release queue");

            /* +---------------------------------------------------------------
               Image compressation
            --------------------------------------------------------------------*/
                const currentTime = new Date();
                const oneHourAgo = new Date(currentTime.getTime() - 60*60*1000);
                // change the bucket here
                const objects = await s3.listObjectsV2({ 
                    Bucket: bucket,
                    Delimiter: '/',
                    Prefix: folderName+'/images/' 
                }).promise();
                const objectsToProcess = objects.Contents.filter(
                (obj) => obj.LastModified > oneHourAgo
                );
                for (const obj of objectsToProcess) {
                const key = obj.Key;
                const image = await s3.getObject({ Bucket: bucket, Key: key }).promise();
                const compressedImage = await sharp(image.Body)
                    .resize(800) // Set desired dimensions or compression options
                    .toBuffer();
                await s3.putObject({
                    Bucket: bucket,
                    Key: key,
                    Body: compressedImage,
                    ContentType: image.ContentType // Preserve the original content type
                }).promise();
                }
                return {
                statusCode: 200,
                body: 'Image compression successful.'
                };
                        
        } catch (error) {
            logger.error("-----> error red flag function", error);
            getInfo.exceptionError(error);
        }
    }
     


}

module.exports = ImageCompressationSet;
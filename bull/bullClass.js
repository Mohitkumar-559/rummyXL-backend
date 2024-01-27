const Queue = require('bull');
const getInfo = require("../common");
const logger = require('../utils/logger');
const { GetConfig } = require('../connections/mongodb');
const { checkStuckTables } = require("../common/stucktables.class");
const AWS = require('aws-sdk');
const {imageCompress} = require("../utils")
const cronTime='0 0 * * *'

const { updateLobbyCount } = require('../common/newUpdateLobbyCount');

const _ = require("underscore");
const moment = require("moment");

const { accessKeyId, secretAccessKey, region, bucket, folderName } = require("../utils/config");
const { ListObjectsCommand, DeleteObjectsCommand } = require('@aws-sdk/client-s3');
const { S3Client } = require("@aws-sdk/client-s3");
const credentials = { region, accessKeyId, secretAccessKey };
const client = new S3Client({ credentials, region: region });




const REDIS_CONFIG = {
    host: process.env.RDS_HOST,
    port: 6379,
    password: process.env.RDS_AUTH,
    db: process.env.REDIS_DB
};

const {
    
    s3_key_id,
    s3_bucket_secrete_key,
    s3_bucket_region,
    environment
} = require("../utils/config")
const s3 = new AWS.S3({
    accessKeyId: s3_key_id,
    secretAccessKey: s3_bucket_secrete_key,
    region: s3_bucket_region
});


class BullClass {
    constructor() {
        
      // Create a queue named 'RummyXLQueue' with Redis connection details
        this.RummyXLCron = new Queue('Cron-Job', { redis: REDIS_CONFIG });

        this.RummyXLCron.on('completed', function (job, result) {
            logger.info("Completed: Cron-Job Job-", job.id);
        });
        this.RummyXLCron.on('failed', async function (job, error) {
            logger.error("Failed: Cron-Job Job-", job.id + error);
        });
        this.RummyXLCron.on('error', async function (error) {
            logger.error("error: Cron-Job Job-", error);
        });
        this.RummyXLCron.process(async (job, done) => {
          if(job.opts.repeat.jobId=="image-compress-set"){
            await this.ImageCompress();
            done();
          }
          if(job.opts.repeat.jobId=="Remove-Data-Table-History-Queue"){
            await this.RemoveTableHistory();
            done();
          }
          if(job.opts.repeat.jobId=="Remove-Invoice-Queue"){
            await this.removeInvoice();
            done();
          }
          if(job.opts.repeat.jobId=="state-update-set"){
            await this.statUpdateCompress();
            done();
          }
          if(job.opts.repeat.jobId=="KYC-attempt-reset-Queue"){
            await this.KYCReset();
            done();
          }
          if(job.opts.repeat.jobId=="STUCK-TABLE-reset-Queue"){
            await this.StuckTable();
            done()
          }
          if(job.opts.repeat.jobId=="Update-Lobby-Count-Queue"){
            await this.updateLobbyCount();
            done();
          }
            
        });
    }
    
    // producer FOR IMAGE COMPRESSION
    async ImageCompressSetToQueue() {
      const jobId = `image-compress-set`;
      const options = {
          repeat: { cron: cronTime },
          jobId: jobId,
          removeOnComplete: true
      };
      await this.RummyXLCron.add({}, options);
    }
    async ImageCompress() {
        try {
            logger.info("Image release queue");

            /* +---------------------------------------------------------------
               Image compressation
            --------------------------------------------------------------------*/
                const currentTime = new Date();
                const oneHourAgo = new Date(currentTime.getTime() - 24*60*60*1000);
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
            logger.error("-----> ImageCompress", error);
            getInfo.exceptionError(error);
        }
    }


    // producer FOR REMOVE table history
    async RemoveTableHistoryQueue() {
      const jobId = `Remove-Data-Table-History-Queue`;
      const options = {
          repeat: { cron: '0 9 * * MON' },
          jobId: jobId,
          removeOnComplete: true
      };
      await this.RummyXLCron.add({}, options);
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

    // producer remove invice
    async removeInvoiceToQueue() {
      const jobId = `Remove-Invoice-Queue`;
      const options = {
          repeat: { cron: '0 0 0 * * *' },
          jobId: jobId,
          removeOnComplete: true
      };
      await this.RummyXLCron.add({}, options);
    }



    async removeInvoice() {
        try {
            
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

    // producer state update
    async StateUpdateToQueue() {
      const jobId = `state-update-set`;
      const options = {
          repeat: { cron: cronTime },
          jobId: jobId,
          removeOnComplete: true
      };
      await this.RummyXLCron.add({}, options);
    }
    // producer
    async KYCResetToQueue() {
      const jobId = `KYC-attempt-reset-Queue`;
      const options = {
          repeat: { cron: cronTime },
          jobId: jobId,
          removeOnComplete: true
      };
      await this.RummyXLCron.add({}, options);
  }



    async statUpdateCompress() {
        try {
            logger.info("STATE UPDATE release queue");

            /* +---------------------------------------------------------------
               STATE UPDATE IN INVOICE IF MISSING
            --------------------------------------------------------------------*/
                const getAllUser = await db.collection("UserGameHistory").find({playersList:{$elemMatch:{state:""}}}).toArray();
                var userList=[]
                const collectionOfUser = getAllUser.map((players)=>{

                  var collectuser = players.playersList.map((player)=>{
                    if(player.state=="" || player.state==null)
                        return player
                    
                  }); 
                  
                  collectuser.mapId = players._id
                  return collectuser
                  
                })
                let userIdList=[];
                 collectionOfUser.forEach(async (users) => {
                  users.forEach(user => {
                    if(user && user.uid){
                      userList.push({uid:getInfo.MongoID(user.uid),mapId:users.mapId});  
                      userIdList.push(getInfo.MongoID(user.uid))
                    }
                  });
                 });
                   
                 
                //console.log(collectuser);
                //console.log(userList);
                //all user state with user list
                var userListWithState = []
                // for (let index = 0; index < userList.length; index++) {
                var getState = await db.collection("game_users").find({_id:{$in:userIdList}}).project({state:1}).toArray()
                for (let element of userList)  {
                  for(let state of getState){
                    if(state._id.toString() == element.uid.toString()){
                      userListWithState.push({uid:element.uid,state:getState[0].state,mapId:element.mapId})
                    }
                  }
                  
                }
                console.log(userListWithState)
                if(userListWithState.length>0){
                  //update all state
                  var bulk = await db.collection("UserGameHistory").initializeUnorderedBulkOp();
                  for (let user of userListWithState){
                    bulk.find({ _id: user.mapId,"playersList.uid": user.uid.toString()}).updateOne({$set:{ "playersList.$.state": user.state }});
                  }
                  //bulk.execute();
                  bulk.execute(function(err, result) {
                    if(err){
                      console.log(err)
                    }
                    console.log(result)
                  })
                }
                
                return {
                statusCode: 200,
                body: 'State Updated successful.'
                };
                        
        } catch (error) {
            logger.error("-----> error statUpdateCompress function", error);
            getInfo.exceptionError(error);
        }
    }


    // producer stuck update
    async STUCKResetToQueue() {
      const jobId = `STUCK-TABLE-reset-Queue`;
      const options = {
          repeat: { cron: '*/5 * * * *' },
          jobId: jobId,
          removeOnComplete: true
      };
      await this.RummyXLCron.add({}, options);
    }



    async StuckTable() {
        try {
            logger.info("stuck table release queue");

            /* +---------------------------------------------------------------
               reset the kyc api PAN, Bank, UPi api
            --------------------------------------------------------------------*/

            await checkStuckTables()
            
        } catch (error) {
            logger.error("-----> StuckTable", error);
            getInfo.exceptionError(error);
        }
    }

    // producer lobby count
    async UpdateLobbyCountToQueue() {
      const jobId = `Update-Lobby-Count-Queue`;
      const options = {
          repeat: { cron: '2 * * * * *' },
          jobId: jobId,
          removeOnComplete: true
      };
      await this.RummyXLCron.add({}, options);
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
          const data = await db.collection("user_details").find({status:"REJECTED"}).toArray()
          await db.collection("user_details_back_up").insertMany(data);

          await db.collection("user_details").deleteMany({status:"REJECTED"});
          /* ---------------------Code End----------------------------------- */
      } catch (error) {
          logger.error("-----> error KYCReset function", error);
          getInfo.exceptionError(error);
      }
  }
}

module.exports = BullClass;
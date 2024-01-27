const Queue = require('bull');
const logger = require('../utils/logger');
const getInfo = require("../common");
const {verifyUPI}= require("../common/upiVerification")
const REDIS_CONFIG = {
    host: process.env.RDS_HOST,
    port: 6379,
    password: process.env.RDS_AUTH,
    db: process.env.REDIS_DB,
};

const defaultJobOptions = { removeOnComplete: true, removeOnFail: true, lazyConnect: true, timeout: 5000 };
const settings = { maxStalledCount: 1 };

class UPIAttemptResetQueue {
    constructor() {

        this.queueUPIAttemptRest = new Queue('UPI-attempt-reset-Queue', { redis: REDIS_CONFIG, defaultJobOptions, settings });

        this.queueUPIAttemptRest.on('completed', function (job, result) {
            logger.info("Completed: UPIAttemptRest Job-", job.id);
        });
        this.queueUPIAttemptRest.on('failed', async function (job, error) {
            logger.error("Failed: UPIAttemptRest Job-", job.id + error);
        });
        this.queueUPIAttemptRest.on('error', async function (error) {
            logger.error("error: UPIAttemptRest Job-", error);
        });


        // consumer
        this.queueUPIAttemptRest.process(async (job, done) => {
            await this.UPIRest();
            done();
        });


    }

    // producer
    async UPIRestToQueue() {
        const resetOptions = { repeat: { cron: '*/7 * * * *' } };
        await this.queueUPIAttemptRest.add({}, resetOptions);
    }



    async UPIRest() {
        try {
            logger.info("update user UPI count of all user");

            /* +---------------------------------------------------------------
               reset the UPI API UPI
            --------------------------------------------------------------------*/
            const getupiPending  = await db.collection("user_details").find({docType:"UPI",status:{ $in:["PENDING"]}},{projection: {userId:1,docType:1,upiId:1,status:1,score:1}}).toArray()
            const userList = getupiPending.map((user)=>{if(!user.score){return user.userId}})
            const userListWithData = await db.collection("game_users").find({_id: { $in:userList}},{projection: {_id:1,unique_id:1}}).toArray()
            const userWithPanList = await db.collection("user_details").find({docType:"PAN", userId: { $in:userList}},{projection: {userId:1,registered_name:1}}).toArray()
            const PanWithUser = getupiPending.map((user)=>{
                for(let element of userWithPanList)
                {
                    if(user.userId.toString() == element.userId.toString())
                    {
                        user.registered_name = element.registered_name
                        return user
                    }
                }
            })
            const upiWithUser = PanWithUser.map((user)=>{
                for(let element of userListWithData)
                {
                    if(user.userId.toString() == element._id.toString())
                    {
                        user.user={_id:element._id,unique_id:element.unique_id}
                        return user;
                    }
                }
            })
            console.log(upiWithUser);
            /* ---------------------User data fetch End----------------------------------- */
            for(let req of upiWithUser){
                if(req){
                    const verifyUpi = await verifyUPI(req.upiId, req.registered_name, req.user);
                await db.collection("user_details").findOneAndUpdate(
                        { 
                            userId: req.user._id,
                            upiId: req.upiId,
                            docType: "UPI"
                        },
                        {
                            $set: {
                                status: "PENDING",
                                request_id: verifyUpi.request_id||"",
                                create_date: new Date(),
                            },
                        },
                        { new: true, upsert: true }
                    );    
                
                }
                
                
            }
             

            /* ---------------------Code End----------------------------------- */
        } catch (error) {
            logger.error("-----> error reset UPI attempt function", error);
            getInfo.exceptionError(error);
        }
    }


}

module.exports = UPIAttemptResetQueue;
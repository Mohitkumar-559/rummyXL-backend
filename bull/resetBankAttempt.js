const Queue = require('bull');
const logger = require('../utils/logger');
const getInfo = require("../common");
const {bankValidationRest} = require("../common/bankValidationRest")

const REDIS_CONFIG = {
    host: process.env.RDS_HOST,
    port: 6379,
    password: process.env.RDS_AUTH,
    db: process.env.REDIS_DB,
};
const {createContact,createFundAccount} = require("../common/razorPayAccount")

const defaultJobOptions = { removeOnComplete: true, removeOnFail: true, lazyConnect: true, timeout: 5000 };
const settings = { maxStalledCount: 1 };

class BANKAttemptResetQueue {
    constructor() {

        this.queueBANKAttemptRest = new Queue('BANK-attempt-reset-Queue', { redis: REDIS_CONFIG, defaultJobOptions, settings });

        this.queueBANKAttemptRest.on('completed', function (job, result) {
            logger.info("Completed: BANKAttemptRest Job-", job.id);
        });
        this.queueBANKAttemptRest.on('failed', async function (job, error) {
            logger.error("Failed: BANKAttemptRest Job-", job.id + error);
        });
        this.queueBANKAttemptRest.on('error', async function (error) {
            logger.error("error: BANKAttemptRest Job-", error);
        });


        // consumer
        this.queueBANKAttemptRest.process(async (job, done) => {
            await this.BANKReset();
            done();
        });


    }

    // producer
    async BANKResetToQueue() {
        const resetOptions = { repeat: { cron: '*/7 * * * *' } };
        await this.queueBANKAttemptRest.add({}, resetOptions);
    }



    async BANKReset() {
        try {
            logger.info("update user BANK count of all user");

            /* +---------------------------------------------------------------
               reset the BANK API BANK
            --------------------------------------------------------------------*/
            const getBankPending  = await db.collection("user_details").find({docType:"BANK",status:"PENDING"},{projection: {userId:1,docType:1,accountNumber:1,ifsc:1,status:1,score:1}}).toArray()
            const userList = getBankPending.map((user)=>{ if(!user.score){return user.userId}})
            const userListWithData = await db.collection("game_users").find({_id: { $in:userList}},{projection: {_id:1,unique_id:1,phn:1,ue:1,un:1}}).toArray()
            const userWithPanList = await db.collection("user_details").find({docType:"PAN", userId: { $in:userList}},{projection: {userId:1,registered_name:1}}).toArray()
            const PanWithUser = getBankPending.map((user)=>{
                for(let element of userWithPanList)
                {
                    if(user.userId.toString() == element.userId.toString())
                    {
                        user.registered_name = element.registered_name
                        return user
                    }
                }
            })
            const bankWithUser = PanWithUser.map((user)=>{
                for(let element of userListWithData)
                {
                    if(user.userId.toString() == element._id.toString())
                    {
                        user.user={_id:element._id,unique_id:element.unique_id}
                        return user;
                    }
                }
            })
            console.log(bankWithUser);
            /* ---------------------User data fetch End----------------------------------- */
            for(let req of 
                bankWithUser){
                if(req){
                    const APIresponse   = await bankValidationRest(req.user, req.accountNumber,req.ifsc,req.registered_name);
                if (APIresponse.data.success) {

                    await db.collection("user_details").findOneAndUpdate(
                        { 
                            userId: req.user._id,
                            accountNumber: req.accountNumber,
                            docType: "BANK"
                        },
                        {
                            $set: {
                                status: APIresponse.data.data.data.upistatus,
                                account_holder_name: APIresponse.data.data.name_at_bank,
                                score: APIresponse.data.data.data.match_score || 0,
                                create_date: new Date(),
                                penny_status: APIresponse.data.data.penny_status,
                            },
                        },
                        { new: true, upsert: true }
                    );
                   
                    if (APIresponse.data.data.data.upistatus == "SUCCESS") {
                    //create contact
                    const razorpayContact = await createContact({
                        ue: user.ue,
                        un: user.un,
                        phn: user.phn,
                        unique_id: user.unique_id,
                    });
                    const userAccountDetails = {
                        userId: user._id,
                        ifsc: ifsc,
                        accountNumber: accountNumber,
                        docType: "BANK",
                    };
                    //create fund account
                    await createFundAccount(
                        userAccountDetails,
                        razorpayContact
                    );
                    await db.collection("game_users").findOneAndUpdate(
                        {
                        _id: user._id,
                        },
                        {
                        $set: {
                            BankVerify: true,
                        },
                        });
            
                    } 
                } else {
                    if (!APIresponse.data.success && APIresponse.data.status_code != 500) {
                    //save the data when API crash and not able check bank details
                    //save for further check
                    let apistatus = "PENDING"
                    // if(APIresponse.data.error == "Invalid Account Number"){
                    //     apistatus="REJECTED"
                    // }
                    if(APIresponse.data.error == "IFSC Code is invalid." || APIresponse.data.error == "Invalid Account Number" ){
                        bankstatus="REJECTED"
                      }
                    await db.collection("user_details").findOneAndUpdate(
                        { 
                            userId: req.user._id,
                            accountNumber: req.accountNumber,
                            ifsc: req.ifsc,
                            docType: "BANK"
                        },
                        {
                            $set: {
                                status: apistatus,
                                error_remark: APIresponse.data.api || "unknow error occured in third party IDC API ",
                                error_message: APIresponse.data.error || "unknow error occured in third party IDC API or IDFY",
                                create_date: new Date(),
                            },
                        },
                        { new: true, upsert: true }
                    );
                    } 
                } 
                }
                
            }
             

            /* ---------------------Code End----------------------------------- */
        } catch (error) {
            logger.error("-----> error reset bank attempt function", error);
            getInfo.exceptionError(error);
        }
    }


}

module.exports = BANKAttemptResetQueue;
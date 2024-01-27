const Queue = require('bull');
const { imageCompress } = require('../utils');
const { fileUploadByUnique } = require('../utils/fileUpload');
const getInfo = require("../common");
const logger = require('../utils/logger');
const { GetConfig } = require('../connections/mongodb');
const  fuzzyNameMatching =require("../common/fuzzyNameMatching")
const axios = require("axios").default;
const _ = require("underscore");
const {
  idfy_BaseURL,
  idfyAccountId,
  idfyKey,
  razorpayKey,
  razorpaySecret,
} = require("../utils/config");


const REDIS_CONFIG = {
    host: process.env.RDS_HOST,
    port: 6379,
    password: process.env.RDS_AUTH,
    db: process.env.REDIS_DB
};

const defaultJobOptions = { removeOnComplete: true, removeOnFail: true, };
const settings = { maxStalledCount: 1 };

class ImageQueue {
    constructor() {
      
        this.queueImageQueue = new Queue('Image-Queue', { redis: REDIS_CONFIG, defaultJobOptions });

        this.queueImageQueue.on('completed', function (job, result) {
            logger.info("Completed: Image Job-", job.id);
        });

        this.queueImageQueue.on('failed', async function (job, error) {
            logger.error("Failed: Image Job-", job.id + error);
        });

        // consumer
        this.queueImageQueue.process("addressProofQueue", async (imageJob) => {
            await this.uploadingProof(imageJob);
            return Promise.resolve();
        });


        this.queueLoggerQueue = new Queue('logger-Queue', { redis: REDIS_CONFIG, defaultJobOptions });

        this.queueLoggerQueue.on('completed', function (job, result) {
            logger.info("Completed: Logger Job-", job.id);
        });

        this.queueLoggerQueue.on('failed', async function (job, error) {
            logger.error("Failed: Logger Job-", job.id + error);
        });

        // consumer
        this.queueLoggerQueue.process("logger-Queue", async (fileData) => {
            await this.loggerUpload(fileData);
            return Promise.resolve();
        });

        //updating the PAN status webhoook controller
        this.PANandUPIRest = new Queue('PAN-UPI-attempt-reset-Queue', { redis: REDIS_CONFIG, defaultJobOptions, settings });

        this.PANandUPIRest.on('completed', function (job, result) {
            logger.info("Completed: PANandUPIRest Job-", job.id);
        });
        this.PANandUPIRest.on('failed', async function (job, error) {
            logger.error("Failed: PANandUPIRest Job-", job.id + error);
        });
        this.PANandUPIRest.on('error', async function (error) {
            logger.error("error: PANandUPIRest Job-", error);
        });

        this.PANandUPIRest.process('request_id',async (job, done) => {
            await this.UpdateStatust(job.data);
            done();//9718358085@paytm
        });

    }

    // producer
    async addressProofToQueue(imageData) {
        await this.queueImageQueue.add("addressProofQueue", imageData);
    }

    async loggerUploadQueue(fileData) {
        await this.queueLoggerQueue.add("logger-Queue",fileData);
    }

    async UpdateUPIAndUPIToQueue({timer,request_id}) {
        const resetOptions = { delay:timer,removeOnComplete:true };
        await this.PANandUPIRest.add('request_id', {request_id},resetOptions);
    }

    async uploadingProof(imageJob) {
        try {
            const { userId, files } = imageJob.data;
            // const removeFilesBackside = files.backside[0].path;
            // const removeFilesFrontSide = files.frontside[0].path;
            const { BUCKET_URL } = GetConfig();

            const backSideCompress = imageCompress(Buffer.from(files.backside.data));
            const frontSideCompress = imageCompress(Buffer.from(files.frontside.data));

            const backSideImageUpload = fileUploadByUnique({
                // fileContent: await imageCompress(Buffer.from(files.backside[0].buffer)),
                fileContent: await backSideCompress,
                folderCategoryLocation: "document-proof",
                fileCategoryName: "DOCUMENT_PROOF_BACKSIDE",
                uniqueId: userId,
                folderType: "images",
                extension: files.backside.mimetype.split("/")[1]
            });


            const frontSideImageUpload = fileUploadByUnique({
                // fileContent: await imageCompress(Buffer.from(files.frontside[0].buffer)),
                fileContent: await frontSideCompress,
                folderCategoryLocation: "document-proof",
                fileCategoryName: "DOCUMENT_PROOF_FRONT_SIDE",
                uniqueId: userId,
                folderType: "images",
                extension: files.frontside.mimetype.split("/")[1]
            });


            files.backside = await backSideImageUpload;
            files.frontside = await frontSideImageUpload;

            await db.collection("UserAddressProof").findOneAndUpdate(
                { userId: getInfo.MongoID(userId) },
                {
                    $set: {
                        backside: process.env.environment == "staging" ? `${files.backside.Location}` : `${BUCKET_URL}${files.backside.Key}`,
                        frontside: process.env.environment == "staging" ? `${files.backside.Location}` : `${BUCKET_URL}${files.frontside.Key}`,
                    },
                },
                { new: true, upsert: true }
            );
            // if (fs.existsSync(removeFilesBackside)) {
            //     fs.unlinkSync(removeFilesBackside);
            // }
            // if (fs.existsSync(removeFilesFrontSide)) {
            //     fs.unlinkSync(removeFilesFrontSide);
            // }
        } catch (error) {
            logger.error("error------> uploadingProof", error);
        }
    }

    async loggerUpload(imageJob) {
        try {
            const { userId, file,ticket_id } = imageJob.data;
            // const removeFilesBackside = files.backside[0].path;
            // const removeFilesFrontSide = files.frontside[0].path;
            const { BUCKET_URL } = GetConfig();

           const errorFileUpload = await fileUploadByUnique({
                // fileContent: await imageCompress(Buffer.from(files.frontside[0].buffer)),
                fileContent: Buffer.from(file),
                folderCategoryLocation: "log_file_error",
                fileCategoryName: "FRONTLOG",
                uniqueId: userId,
                folderType: "file",
                extension: "txt"
            });

            const fileData = errorFileUpload;

            await db.collection("issue_raise").findOneAndUpdate(
                { 
                    ticket_id: getInfo.MongoID(ticket_id),
                    userId: getInfo.MongoID(userId) 
                },
                {
                    $set: {
                        errorLog: process.env.environment == "staging" ? `${fileData.Location}` : `${BUCKET_URL}${fileData.Key}`,
                    },
                },
                { new: true, upsert: true }
            );
            } catch (error) {
            logger.error("error------> uploadingProof", error);
        }
    }

    async UpdateStatust({request_id}) {
        try {
            logger.info("update user kyc count of all user");

            /* +---------------------------------------------------------------
               reset the kyc api PAN, Bank, UPi api
            --------------------------------------------------------------------*/
              await this.webHook_Handling(request_id)
            
            /* ---------------------Code End----------------------------------- */
        } catch (error) {
            logger.error("-----> error UpdateStatust function", error);
            getInfo.exceptionError(error);
        }
    }
    async createContact(userDetails) {
      try {
        logger.info("-------createContact---------->", userDetails);
        let name = userDetails.un;
        if (name.includes("*")) {
          name = userDetails.phn;
        }
        let createContactData = JSON.stringify({
          name: name,
          email: userDetails.ue,
          contact: userDetails.phn,
          type: "customer",
          reference_id: userDetails.unique_id,
        });
    
        // create contact details
        let createContactConfig = {
          method: "post",
          url: "https://api.razorpay.com/v1/contacts",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Basic ${Buffer.from(
              [razorpayKey] + ":" + razorpaySecret
            ).toString("base64")}`,
          },
          data: createContactData,
        };
    
        let razorpayContact = await axios(createContactConfig);
        razorpayContact = razorpayContact.data;
        return razorpayContact;
      } catch (error) {
        logger.info("error----createContact----->", error.response.data);
        return error;
      }
    }
    //create fundAccount for RazorpayX
async createFundAccount(userAccountDetails, razorpayContact) {
  try {
    logger.info(
      "userAccountDetails---------->",
      userAccountDetails,
      razorpayContact
    );
    let createFundAccountData;
    if (userAccountDetails.docType == "BANK") {
      createFundAccountData = JSON.stringify({
        contact_id: razorpayContact.id,
        account_type: "bank_account",
        bank_account: {
          name: razorpayContact.name,
          ifsc: userAccountDetails.ifsc,
          account_number: userAccountDetails.accountNumber,
        },
      });
    } else {
      createFundAccountData = JSON.stringify({
        contact_id: razorpayContact.id,
        account_type: "vpa",
        vpa: {
          address: userAccountDetails.upiId,
        },
      });
    }

    // create fund account details
    let createFundAccountConfig = {
      method: "post",
      url: "https://api.razorpay.com/v1/fund_accounts",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(
          [razorpayKey] + ":" + razorpaySecret
        ).toString("base64")}`,
      },
      data: createFundAccountData,
    };

    let razorpayFundAccount = await axios(createFundAccountConfig);
    razorpayFundAccount = razorpayFundAccount.data;
    logger.info("razorpayFundAccount----------->", razorpayFundAccount);

    await db.collection("user_fund_account").findOneAndUpdate(
      {
        contactId: razorpayFundAccount.contact_id,
        userId: getInfo.MongoID(userAccountDetails.userId),
        fundAccounts: razorpayFundAccount.id,
      },
      {
        $set: {
          contactId: razorpayFundAccount.contact_id,
          userId: getInfo.MongoID(userAccountDetails.userId),
          fundAccounts: razorpayFundAccount.id,
          accountType: razorpayFundAccount.account_type,
          active: razorpayFundAccount.active,
          bankAccount:
            userAccountDetails.docType == "BANK"
              ? razorpayFundAccount.bank_account
              : razorpayFundAccount.vpa,
          createAt: new Date(),
          docType:
            userAccountDetails.docType == "BANK" ? "bank_account" : "vpa",
        },
      },
      { new: true, upsert: true }
    );
    return razorpayFundAccount;
  } catch (error) {
    logger.info("error----create fund account----->", error);
    return error.response;
  }
}
    
    async webHook_Handling(request_id) {
        //verfiy the name pan card the name fuzzy api
        try {
          const headers = {
            "Content-Type": "application/json",
            "account-id": idfyAccountId,
            "api-key": idfyKey,
          };
      
          const baseurl_task = idfy_BaseURL + `tasks?request_id=${request_id}`;
          //if request coming from UPI then
          let request_options2 = {
            method: "get",
            url: baseurl_task,
            headers: headers
          };
          let TaskResponse = await axios(request_options2);
          if(TaskResponse.status == 200){
            await this.updatePANandUPI_status(TaskResponse.data[0])
          }
          
        } catch (error) {
          
        }
      }
    async updatePANandUPI_status(dataInsert){
        try {
      
          let req={
            body:dataInsert
          }
          if ("ind_vpa" == req.body.type) {
            const upiData = await db.collection("user_details").findOne({
              userId: getInfo.MongoID(req.body.task_id),
              request_id: req.body.request_id,
              //group_id: req.body.group_id,
              docType: "UPI",
            });
            logger.info("upiData------webhook--->", upiData);
      
            if (upiData) {
              let user = await db.collection("game_users").findOne({
                _id: getInfo.MongoID(req.body.task_id),
              });
              logger.info("user.ue----------->", user.ue);
              logger.info("user UPI status----------->", req.body);
              if (req.body && req.body.status == "completed") {
                if (req.body.result && req.body.result.status == "id_not_found") {
                  // delete user entry in db
                  // await db.collection("user_details").findOneAndDelete({
                  //   userId: getInfo.MongoID(upiData.userId),
                  //   docType: "UPI",
                  //   request_id: req.body.request_id,
                  // });
                  await db.collection("user_details").findOneAndUpdate(
                    {
                      userId: getInfo.MongoID(upiData.userId),
                      docType: "UPI",
                      //upiId: req.body.result.vpa,
                      //group_id: req.body.group_id,
                    },
                    {
                      $set: {
                        status: "REJECTED",
                        docType: "UPI",
                        upiId: req.body.result.upiId,
                        request_id: req.body.request_id,
                      },
                    }
                  );
                } else {
                  const panPayload = await db.collection("user_details").findOne({
                    userId: getInfo.MongoID(req.body.task_id),
                    docType: "PAN",
                  });
                  if (
                    req.body.result.account_exists &&
                    req.body.result.account_exists == "YES"
                  ) {
                    let responseFuzzy = await fuzzyNameMatching(
                      req.body,
                      panPayload.registered_name,
                      user
                    );
                    if (responseFuzzy.data.upistatus == "SUCCESS") {
                      let updateFlag = user.UpiVerify;
                      if (!user.UpiVerify) {
                        if (responseFuzzy.data.upistatus == "SUCCESS") {
                          updateFlag = true;
                        }
                      }
                      //update UpiVerify flag in game_users record
                      await db.collection("game_users").findOneAndUpdate(
                        {
                          _id: user._id,
                        },
                        {
                          $set: {
                            UpiVerify: updateFlag,
                          },
                        }
                      );
                      //create contact
                      const razorpayContact = await this.createContact({
                        ue: user.ue,
                        un: user.un,
                        phn: user.phn,
                        unique_id: user.unique_id,
                      });
                      //create fund account
                      const userAccountDetails = {
                        userId: user._id,
                        upiId: req.body.result.vpa,
                        docType: "UPI",
                      };
                      const createFundAccountData = await this.createFundAccount(
                        userAccountDetails,
                        razorpayContact
                      );
                      logger.info(
                        "createFundAccountData--------->",
                        createFundAccountData
                      );
      
                      await db.collection("user_details").findOneAndUpdate(
                        {
                          userId: getInfo.MongoID(upiData.userId),
                          docType: "UPI",
                          upiId: req.body.result.vpa,
                        },
                        {
                          $set: {
                            status: "SUCCESS",
                            docType: "UPI",
                            //upiId: req.body.result.upiId,
                            account_holder_name: req.body.result.name_at_bank,
                            score: responseFuzzy.data.match_score,
                          },
                        }
                      );
                    } else if (responseFuzzy.data.upistatus == "PENDING") {
                      await db.collection("user_details").findOneAndUpdate(
                        {
                          userId: getInfo.MongoID(upiData.userId),
                          docType: "UPI",
                          upiId: req.body.result.vpa,
                          //group_id: req.body.group_id,
                        },
                        {
                          $set: {
                            status: "PENDING",
                            docType: "UPI",
                            //upiId: req.body.result.upiId,
                            //request_id: req.body.request_id
                            account_holder_name: req.body.result.name_at_bank,
                            score: responseFuzzy.data.match_score,
                          },
                        }
                      );
                    } else {
                      await db.collection("user_details").findOneAndUpdate(
                        {
                          userId: upiData._id,
                          docType: "UPI",
                          upiId: req.body.result.vpa,
                          //group_id: req.body.group_id,
                        },
                        {
                          $set: {
                            status: "REJECTED",
                            docType: "UPI",
                            //upiId: req.body.result.upiId,
                            //request_id: req.body.request_id
                            account_holder_name: req.body.result.name_at_bank,
                            score: req.body.result.match_score,
                          },
                        }
                      );
                    }
                  } else {
                    // delete user entry in db
                    // await db.collection("user_details").findOneAndDelete({
                    //   userId: getInfo.MongoID(panData.userId),
                    //   docType: "UPI",
                    //   request_id: req.body.request_id,
                    // });
                    await db.collection("user_details").findOneAndUpdate(
                      {
                        userId: upiData._id,
                        docType: "UPI",
                        upiId: req.body.result.vpa,
                        group_id: req.body.group_id,
                      },
                      {
                        $set: {
                          status: "REJECTED",
                          docType: "UPI",
                          upiId: req.body.result.upiId,
                          request_id: req.body.request_id,
                        },
                      }
                    );
                  }
                }
              } else {
                // delete user entry in db
                await db.collection("user_details").findOneAndUpdate({
                  userId: getInfo.MongoID(upiData.userId),
                  docType: "UPI",
                  request_id: req.body.request_id,
                },
                {
                  $set: {
                    status: "PENDING",
                    docType: "UPI",
                    //upiId: req.body.result.upiId,
                    ERROR:"WEBhook not called",
                    score: responseFuzzy.data.match_score,
                  },
                });
              }
            }
          }
          if ("ind_pan" == req.body.type) {
            const panData = await db.collection("user_details").findOne({
              userId: getInfo.MongoID(req.body.task_id),
              group_id: req.body.group_id,
              docType: "PAN",
            });
            logger.info("panData------webhook--->", panData);
      
            if (panData) {
              let user = await db.collection("game_users").findOne(
                {
                  _id: getInfo.MongoID(req.body.task_id),
                },
                {
                  projection: {
                    ue: 1,
                  },
                }
              );
              logger.info("user.ue----------->", user.ue);
              if (req.body.status == "completed") {
                const redisInstances = getRedisInstances();
                const ivt = await redisInstances.DEL("OCR:USER:" + req.body.task_id);
                logger.info("ivt--------->", ivt);
                if (req.body.result.source_output.status == "id_not_found") {
                  //send success mail
                  if (user.ue != "") {
                    sendMail(user.ue, "Pan Verification", "../views/pan_failed.html");
                  }
                  // delete user entry in db
                  await db.collection("user_details").findOneAndDelete({
                    userId: getInfo.MongoID(panData.userId),
                    docType: "PAN",
                    // request_id: req.body.request_id,
                  });
                  // await db.collection("user_details").findOneAndUpdate(
                  //   {
                  //     userId: getInfo.MongoID(panData.userId),
                  //     docType: "PAN",
                  //     panNumber: req.body.result.source_output.id_number,
                  //   },
                  //   {
                  //     $set: {
                  //       status: "FAILED",
                  //       docType: "PAN",
                  //       panNumber: req.body.result.source_output.id_number,
                  //       registered_name: req.body.result.source_output.name_on_card,
                  //       group_id: req.body.group_id,
                  //     },
                  //   }
                  // );
                } else {
                  //send success mail
                  if (user.ue != "") {
                    sendMail(
                      user.ue,
                      "Pan Verification",
                      "../views/pan_success.html"
                    );
                  }
                  await db.collection("game_users").updateOne(
                    { _id: getInfo.MongoID(panData.userId) },
                    {
                      $set: {
                        PanVerify: true,
                      },
                    },
                    { upsert: true }
                  );
      
                  await db.collection("user_details").findOneAndUpdate(
                    {
                      userId: getInfo.MongoID(panData.userId),
                      docType: "PAN",
                      panNumber: req.body.result.source_output.id_number,
                      group_id: req.body.group_id,
                      // dob: req.body.result.source_output.date_of_birth,
                    },
                    {
                      $set: {
                        status: "SUCCESS",
                        docType: "PAN",
                        panNumber: req.body.result.source_output.id_number,
                        registered_name: req.body.result.source_output.name_on_card,
                        request_id: req.body.request_id,
                        // dob: req.body.result.source_output.date_of_birth,
                      },
                    }
                  );
                }
              }
            }
          }
        } catch (error) {
          logger.info("error------pan-webhook--post--body---------->", error);
          getInfo.exceptionError(error);
        } 
      
      }
}

module.exports = ImageQueue;
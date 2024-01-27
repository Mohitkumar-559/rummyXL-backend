const Queue = require('bull');
const logger = require('../utils/logger');
const getInfo = require("../common");
const fuzzyNameMatching = require("../common/fuzzyNameMatching")
const axios = require("axios").default;
const { createContact, createFundAccount } = require("../common/razorPayAccount")
const {
  idfy_BaseURL,
  idfyAccountId,
  idfyKey,
} = require("../utils/config");

const REDIS_CONFIG = {
  host: process.env.RDS_HOST,
  port: 6379,
  password: process.env.RDS_AUTH,
  db: process.env.REDIS_DB,
};
const { getRedisInstances } = require("../connections/redis");
const defaultJobOptions = { removeOnComplete: true, removeOnFail: true, lazyConnect: true, timeout: 5000 };
const settings = { maxStalledCount: 1 };

class PANandUPIQueue {
  constructor() {

    this.PANandUPIRest = new Queue('PAN-UPI-attempt-reset-Queue-1', { redis: REDIS_CONFIG, defaultJobOptions, settings });

    this.PANandUPIRest.on('completed', function (job, result) {
      logger.info("Completed: PANandUPIRest Job-", job.id);
    });
    this.PANandUPIRest.on('failed', async function (job, error) {
      logger.error("Failed: PANandUPIRest Job-", job.id + error);
    });
    this.PANandUPIRest.on('error', async function (error) {
      logger.error("error: PANandUPIRest Job-", error);
    });


    // consumer
    this.PANandUPIRest.process(async (job, done) => {
      await this.UpdateUPIandPAN();
      done();
    });


  }

  // producer
  async UpdateUPIAndUPIToQueue() {
    const resetOptions = { repeat: { cron: '*/5 * * * *' } };
    await this.PANandUPIRest.add({}, resetOptions);
  }



  async UpdateUPIandPAN() {
    try {
      /* +---------------------------------------------------------------
         get all pending request
      --------------------------------------------------------------------*/
      const pendingWebhook = await db.collection("user_details").find({ status: { $in: ["PENDING", "in_progress"] }, docType: { $in: ["PAN", "UPI"] } }, { projection: { request_id: 1, score: 1 } }).toArray()
      for (let user of pendingWebhook) {
        if (!user.score) {
          await this.webHook_Handling(user.request_id)
        }
      }

      /* ---------------------Code End----------------------------------- */
    } catch (error) {
      logger.error("-----> error webhook  function", error);
      getInfo.exceptionError(error);
    }
  }
  //everyOne Hours
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
      if (TaskResponse.data[0] && TaskResponse.status == 200 && TaskResponse.data[0].status != 'failed') {
        await this.updatePANandUPI_status(TaskResponse.data[0])
      }

    } catch (error) {

    }
  }
  async updatePANandUPI_status(dataInsert) {
    try {

      let req = {
        body: dataInsert
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
                  request_id: req.body.request_id
                  //upiId: req.body.result.upiId,
                  //group_id: req.body.group_id,
                },
                {
                  $set: {
                    status: "REJECTED",
                    docType: "UPI",
                    response: "Invalid UPI ID"
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
                  const razorpayContact = await createContact({
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
                  const createFundAccountData = await createFundAccount(
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
                      request_id: req.body.request_id
                    },
                    {
                      $set: {
                        status: "SUCCESS",
                        docType: "UPI",
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
                      request_id: req.body.request_id
                    },
                    {
                      $set: {
                        status: "PENDING",
                        docType: "UPI",
                        account_holder_name: req.body.result.name_at_bank,
                        score: responseFuzzy.data.match_score,
                      },
                    }
                  );
                } else {
                  await db.collection("user_details").findOneAndUpdate(
                    {
                      userId: getInfo.MongoID(upiData.userId),
                      docType: "UPI",
                      upiId: req.body.result.vpa,
                      request_id: req.body.request_id
                    },
                    {
                      $set: {
                        status: "REJECTED",
                        docType: "UPI",
                        //upiId: req.body.result.upiId,
                        account_holder_name: req.body.result.name_at_bank,
                        score: responseFuzzy.data.match_score,
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
                    userId: getInfo.MongoID(upiData.userId),
                    docType: "UPI",
                    upiId: req.body.result.vpa,
                    request_id: req.body.request_id
                  },
                  {
                    $set: {
                      status: "REJECTED",
                      docType: "UPI",
                    },
                  }
                );
              }
            }
          } else {
            // store the data of the user when webhook is having Insufficent fund
            await db.collection("user_details").findOneAndUpdate(
              {
                userId: getInfo.MongoID(upiData.userId),
                docType: "UPI",
                request_id: req.body.request_id
                //upiId: req.body.result.upiId,
                //group_id: req.body.group_id,
              },
              {
                $set: {
                  status: "PENDING",
                  docType: "UPI",
                },
              }
            );
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

module.exports = PANandUPIQueue;
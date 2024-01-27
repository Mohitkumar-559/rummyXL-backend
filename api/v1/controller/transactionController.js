const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const logger = require("../../../utils/logger");
const { GetConfig } = require("../../../connections/mongodb");
const {
  addCashAmountService,
  updateAirPayResponse
} = require("../service/tranasctionService")
const {
  airPayMerchantId,
  airPayAPIkey,
  airPayUrl
} = require("../../../utils/config")

const _ = require("underscore");
const moment = require("moment");
const getInfo = require("../../../common");
const converttoJson = require('xml-js');
async function authenticateJWT(req, res, next) {
    try {
      const authHeader = req.headers.authorization || req.query.authorization;
      if (authHeader) {
        const user = jwt.verify(authHeader, process.env.JwtSecretKey);
        req.user = user;
        next();
      } else {
        res.status(401).send({
          success: false,
          errorCode: "1068",
          Type: "Request",
          message: "Token Is Not Provided",
        });
      }
    } catch (error) {
      logger.info("error---->", error);
      //getInfo.exceptionError(error);
      return res.status(400).send({ success: false, error: error });
    }
}

router.get("/v1/addCashAmount", authenticateJWT, async function (req, res) {
    try {
      const { BLOCK_STATE } = GetConfig();
      let { amount, type, targetapp, targetappios } = req.headers;
      const { userId } = req.user;
  
      logger.info("userId------------>", userId);
      logger.info(" req.headers------------>", req.headers);
  
      const user = await db.collection("game_users").findOne({
        _id: getInfo.MongoID(userId),
      });
      if (!user) {
        return res.status(404).send({
          success: false,
          errorCode: "1069",
          Type: "Response",
          message: "User Not Found",
        });
      }
  
      let countryCheck = false;
  
      if (user.storeUser && user.country !== "India") {
        countryCheck = true;
      }
      // const countryCheck = user.storeUser && user.country == "India" ? false : true;
      const checkLocation = _.contains(BLOCK_STATE, user.state) || countryCheck;
      if (checkLocation) {
        return res.status(404).send({
          success: false,
          errorCode: "1009",
          Type: "Response",
          message:
            "As per regulations, cash games are restricted for your location. We recommend you play practice games and improve your skill in the meantime!",
          data: {
            isRestricted: true,
            payment_link: "",
            callback_url: "",
            linkid: "",
          },
        });
      }
  
      let continueFlag = true,
        flagMsg;
  
      // const testUsers = ["646b46bad78ea10014b7db10", "646b4c16d78ea10014b7db17"];
      // if (amount < 50 || !testUsers.includes(userId)) {
      //   return res.status(400).send({
      //     success: false,
      //     errorCode: "0000",
      //     Type: "Response",
      //     message: "Minimum add cash amount 50",
      //   });
      // }
      if (amount < 50 ) {
        return res.status(400).send({
          success: false,
          errorCode: "0000",
          Type: "Response",
          message: "Minimum add cash amount 50",
        });
      }
  
  
      //find play-responsibly
      const userResponsibly = await db.collection("user_responsibly").findOne({
        userId: getInfo.MongoID(userId),
      });
      if (userResponsibly && user.flags._notificationCashFlag) {
        if (userResponsibly.dailyLimit) {
          const result = await checkDailyLimit(userId, amount);
          if (!result) {
            await db.collection("user_responsibly").findOneAndUpdate(
              { userId: getInfo.MongoID(userId) },
              {
                $inc: {
                  "dailyLimit.dailyPayCount": 1,
                },
                $set: {
                  paymentDate: new Date(),
                },
              }
            );
            continueFlag = false;
            flagMsg =
              "You crossed your daily add cash limit you set. Do you really want to continue?";
          }
        }
        if (continueFlag && userResponsibly.monthlyLimit) {
          //checkmonthly limit if hoy
          const result = await checkMonthlyLimit(userId, amount);
          if (!result) {
            await db.collection("user_responsibly").findOneAndUpdate(
              { userId: getInfo.MongoID(userId) },
              {
                $inc: {
                  "monthlyLimit.monthlyPayCount": 1,
                },
                $set: {
                  paymentDate: new Date(),
                },
              }
            );
            continueFlag = false;
            flagMsg =
              "You crossed your monthly add cash limit you set. Do you really want to continue?";
          }
        }
      }
      const {UPI_SWITCH} = GetConfig();
      if(UPI_SWITCH == "AIRPAY"){
        type = "airpay"
      }
      if(UPI_SWITCH == "PHONEPE"){
        type = "UPI"
      }
      //calling the service file
      const responseAddCash = await addCashAmountService(amount, type, targetapp, targetappios,userId,user,continueFlag);
      return res.status(responseAddCash.status).send(responseAddCash.data)

    } catch (error) {
      logger.info("error---addCashAmount---->", error);
      getInfo.exceptionError(error);
      // return res.status(400).send(commonClass.encrypt({ success: false, error: error }));
      return res.status(400).send({ success: false, error: error });
    }
});
router.post("/successAirpayResponse", async (req, res) => {
  try {
    logger.info("successAirpayResponse query", req.query);
    logger.info("successAirpayResponse body", req.body);
  } catch (error) {
    logger.info("error----- successAirpayResponse", error);
    getInfo.exceptionError(error);
  }
  return res.status(200).send({ success: true });
});

router.post("/failureAirpayResponse", async (req, res) => {
  try {
    logger.info("failureAirpayResponse query", req.query);
    logger.info("failureAirpayResponse body", req.body);
  } catch (error) {
    logger.info("error----- failureAirpayResponse", error);
    getInfo.exceptionError(error);
  }
  return res.status(200).send({ success: true });
});
router.post("/success", async (req, res) => {
  try {
    logger.info("failureAirpayResponse  success query", req.query);
    logger.info("failureAirpayResponse body", req.body);
  } catch (error) {
    logger.info("error----- failureAirpayResponse", error);
    getInfo.exceptionError(error);
  }
  return res.status(200).send({ success: true });
});
router.post("/success/318851775834", async (req, res) => {
  try {
    logger.info("failureAirpayResponse 318851775834 query", req.query);
    logger.info("failureAirpayResponse body", req.body);
  } catch (error) {
    logger.info("error----- failureAirpayResponse", error);
    getInfo.exceptionError(error);
  }
  return res.status(200).send({ success: true });
});
router.post("/", async (req, res) => {
  try {
    logger.info("failureAirpayResponse 318851775834 query", req.query);
    logger.info("failureAirpayResponse body", req.body);
  } catch (error) {
    logger.info("error----- failureAirpayResponse", error);
    getInfo.exceptionError(error);
  }
  return res.status(200).send({ success: true });
});


router.post('/ipnAirPayResponse', async (req, res) => {
  try {
    logger.info("ipnAirPayResponse query", req);
    logger.info("ipnAirPayResponse data", req.data);
    const AirpayResponseCallback = JSON.parse(converttoJson.xml2json(res.data,{compact: true, spaces: 2}));
    const getTransaction = await db.collection("user_payment").findOne({orderId: AirpayResponseCallback.TRANSACTIONID._cdata });
    const responseUpdateAirpay = await updateAirPayResponse(getTransaction,orderId,getTransaction.userId);
    logger.info("ipnAirPayResponse data Updated", responseUpdateAirpay);
    return res.status(responseUpdateAirpay.status).send(responseUpdateAirpay.data)
    
  } catch (error) {
    logger.info("----error---------> addCashAirPayResponse post", error);
    getInfo.exceptionError(error);
  }
  res.status(200).send({ success: true });
});


router.get("/v1/airPayPaymentVerify", authenticateJWT, async (req, res) => {
  try {
    const orderId = req.headers.orderid;
    const { userId } = req.user;
    const user = await db
      .collection("game_users")
      .findOne({ _id: getInfo.MongoID(userId) });
    if (!user)
      return res.status(404).send({
        success: false,
        errorCode: "1069",
        Type: "Response",
        message: "User Not Found",
      });

    //find transactionId
    const getTransaction = await db
      .collection("user_payment")
      .findOne({ userId: getInfo.MongoID(userId), orderId: orderId });
    //calling the service file
    const responseUpdateAirpay = await updateAirPayResponse(getTransaction,orderId,userId);
    return res.status(responseUpdateAirpay.status).send(responseUpdateAirpay.data)
    

    
  } catch (error) {
    logger.info("error-------->", error);
    getInfo.exceptionError(error);
    return res.status(400).send({ success: false, error: error.message });
  }
});

module.exports = router;
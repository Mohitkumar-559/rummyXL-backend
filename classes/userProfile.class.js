const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const axios = require("axios").default;
const moment = require("moment");
const Razorpay = require("razorpay");
const { decrypt } = require("../utils/crypto");
const sendMail = require("../utils/sendMail");
const path = require("path");
const Joi = require("joi");
const converter = require("number-to-words");
const multer = require("multer");
const _ = require("underscore");
const commonClass = require("./common.class");
const { replaceKeyOldToNew } = require("./replaceKey.class");
const crypto = require("crypto"); //deprecated inbulid in node
const {ticketCreater,viewticket} = require("../utils/freshDeshConnect");
const { v4: uuidv4 } = require('uuid');
const {bankValidationRest} = require("../common/bankValidationRest")
const {verifyUPI}= require("../common/upiVerification")
const { baseResponse } = require("../constants/baseResponse");
const {
  url,
  razorpayKey,
  razorpaySecret,
  environment,
  phonePeMerchantId,
  phonePeMerchantSaltKey,
  phonePeMerchantSaltIndex,
  goKwikAppKey,
  goKwikAppSecretKey,
  goKwikRequestUrl,
  phonePeMerchantHostUrl,
  idfyAccountId,
  idfyKey,
} = require("../utils/config");
const logger = require("../utils/logger");
const getInfo = require("../common");
const {
  getRandomId,
  imageCompress,
  getRandomString,
} = require("../utils");
const { fileUploadByUnique, fileUpload } = require("../utils/fileUpload");
const ImageQueue = require("../bull/addressProof");
const {
  renderMessageFromTemplateAndVariables,
  calculateInvoiceData,
  inWords,
} = require("../common/templateBind");
const pdf = require("html-pdf");
const { GetConfig } = require("../connections/mongodb");
const addressProofQueueClass = new ImageQueue();
const { getRedisInstances } = require("../connections/redis");
const { getRedis } = require("../classes/redis.class");
const fuzzyNameMatching = require("../common/fuzzyNameMatching");
const fs = require("fs");
const dir = './upload';
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir);
  console.log("dir");
}

const storageFiles = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'upload/');
  },
  filename: function (req, file, cb) {
    // cb(null, file.originalname);
    cb(null, req.body.userId + '-' + Date.now() + path.extname(file.originalname));
  }
});

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
    getInfo.exceptionError(error);
    return res.status(400).send({ success: false, error: error });
  }
}

function covertStringToObject(obj) {
  try {
    return typeof obj === "object" ? obj : JSON.parse(obj);
  } catch (error) {
    return error;
  }
}

//personal Details
function capitalizeFirstLetter(string) {
  return string?.charAt(0).toUpperCase() + string.slice(1);
}

function removeFile(file) {
  if (fs.existsSync(file)) {
    fs.unlinkSync(file);
  }
}

router.get("/get-userProfile", authenticateJWT, async (req, res) => {
  try {
    const { userId } = req.user;

    const user = await db.collection("game_users").findOne(
      {
        _id: getInfo.MongoID(userId),
      },
      {
        projection: {
          _id: 1,
          phn: 1,
          un: 1,
          MobileVerify: 1,
          ue: 1,
          EmailVerify: 1,
          fullName: 1,
        },
      }
    );
    if (!user) {
      return res.status(404).send({
        success: false,
        errorCode: "1069",
        Type: "Response",
        message: "User Not Found",
      });
    }

    const userData = {
      _id: user._id,
      mobile: user.phn,
      mobileVerified: user.MobileVerify,
      email: user.ue,
      emailVerified: user.EmailVerify,
      displayName: user.un,
      fullName: user.fullName
        ? {
          firstName: user.fullName.firstName,
          lastName: user.fullName.lastName,
        }
        : {
          firstName: "",
          lastName: "",
        },
    };
    logger.info("userData-------.", userData);
    return res.status(200).send({
      success: true,
      errorCode: "0000",
      Type: "Response",
      message: "Data delivered successfully",
      data: userData,
    });
  } catch (error) {
    logger.info("error----->", error);
    getInfo.exceptionError(error);
    return res.status(400).send({ success: false, error: error.message });
  }
});

router.post("/update-userProfile", authenticateJWT, async (req, res) => {
  try {
    req.body = covertStringToObject(req.body.data);
    logger.info("------/update-userProfile------->", req.body);
    const { userName, fullName } = req.body;
    const { userId } = req.user;

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
    } else {
      let obj = {},
        message;

      if (userName) {
        obj.un = capitalizeFirstLetter(userName);
        message = "Successfully updated Display Name";

        const fundAccounts = await db.collection("user_fund_account").findOne({
          userId: getInfo.MongoID(userId),
        });
        if (fundAccounts) {
          // update fund account details
          let createContactData = JSON.stringify({
            name: obj.un,
          });
          let createContactConfig = {
            method: "patch",
            url: `https://api.razorpay.com/v1/contacts/${fundAccounts.contactId}`,
            headers: {
              "Content-Type": "application/json",
              Authorization: `Basic ${Buffer.from(
                [razorpayKey] + ":" + razorpaySecret
              ).toString("base64")}`,
            },
            data: createContactData,
          };
          await axios(createContactConfig);
        }
      }
      if (fullName) {
        fullName.firstName = capitalizeFirstLetter(fullName.firstName);
        fullName.lastName = capitalizeFirstLetter(fullName.lastName);
        obj.fullName = fullName;
        message = "Successfully updated Full Name";
      }

      const updateUser = await db
        .collection("game_users")
        .findOneAndUpdate(
          { _id: getInfo.MongoID(userId) },
          { $set: obj },
          { new: true, returnDocument: "after" }
        );

      return res.status(200).send({
        success: true,
        errorCode: "9004",
        Type: "Response",
        message: message,
        data: {
          mobile: updateUser.value.phn,
          email: updateUser.value.ue,
          displayName: updateUser.value.un,
          fullName: updateUser.value.fullName
            ? {
              firstName: updateUser.value.fullName.firstName,
              lastName: updateUser.value.fullName.lastName,
            }
            : {
              firstName: "",
              lastName: "",
            },
        },
      });
    }
  } catch (error) {
    logger.info("error----->", error);
    getInfo.exceptionError(error);
    return res.status(400).send({ success: false, error: error.message });
  }
});

async function validateEmail(data) {
  const schema = Joi.object().keys({
    email: Joi.string()
      .email({
        minDomainSegments: 2 /* tlds: { allow: ['com', 'net', 'in', 'org'] } */,
      })
      .required(),
  });
  return schema.validate(data);
}

router.post("/email-verify", authenticateJWT, async (req, res) => {
  try {
    const { userId } = req.user;
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
    const { email } = req.body;

    const { error } = await validateEmail(req.body);
    if (error) {
      return res.status(404).send({
        success: false,
        errorCode: "0000",
        Type: "Response",
        message: "Please add valid email address",
      });
    }

    await db.collection("game_users").findOneAndUpdate(
      { _id: getInfo.MongoID(userId) },
      {
        $set: {
          ue: email,
        },
      },
      { new: true }
    );

    await sendMail(email, "Verify Email", "../views/index.html");
    return res.status(200).send({
      success: true,
      errorCode: "0000",
      Type: "Response",
      message: "An Email sent to your account please verify",
      data: email,
    });
  } catch (error) {
    logger.info("/email-verify------------------->>>>> error", error);
    getInfo.exceptionError(error);
    return res.status(400).send({ success: false, error: error.message });
  }
});

router.get("/emailVerification/:encryptEmail", async (req, res) => {
  try {
    const { encryptEmail } = req.params;
    const email = decrypt(encryptEmail);
    logger.info("decrypt------->", email);

    const user = await db.collection("game_users").findOne({ ue: email });
    if (!user) {
      return res
        .status(404)
        .send({ success: false, message: "Your Email verification failed" });
      // res.sendFile(path.join(__dirname, '../views/rummy_verified.html'));
    } else {
      await db.collection("game_users").updateOne(
        { _id: user._id },
        {
          $set: {
            EmailVerify: true,
          },
        }
      );
      return res.status(200).send({
        success: true,
        message: "Your Email Verification Successfully",
      });
      // res.sendFile(path.join(__dirname, '../views/verify_email_rummy.html'));
    }
  } catch (error) {
    logger.info("/email-------------------->>>>> error", error);
    getInfo.exceptionError(error);
    return res.status(400).send({ success: false, error: error.message });
  }
});

//Balance

router.get("/get-amount", authenticateJWT, async (req, res) => {
  try {
    const { userId } = req.user;
    const user = await db
      .collection("game_users")
      .findOne({ _id: getInfo.MongoID(userId) });
    if (!user) {
      return res.status(404).send({
        success: false,
        errorCode: "1069",
        Type: "Response",
        message: "User Not Found",
      });
    }
    let Deposit = user.depositCash;
    let withdrawable = user.Winning;

    let totalBonus,
      SignUpBonus = 0,
      totalCashBonus = 0,
      totalReferralBonus = 0,
      cmsBonus = 0;

    if (user.SignUpBonusStatus == "Active") {
      SignUpBonus += user.SignUpBonus;
    }

    if (user.addCash_bonus) {
      for (const element of user.addCash_bonus) {
        if (element.status == "Active") {
          totalCashBonus += element.addCashBonus;
        }
      }
    }

    if (user.referral_bonus) {
      for (const element of user.referral_bonus) {
        if (element.status == "Active") {
          totalReferralBonus += element.referralBonus;
        }
      }
    }

    if (user.Bonus) {
      cmsBonus += user.Bonus;
    }

    totalBonus = totalCashBonus + SignUpBonus + totalReferralBonus + cmsBonus;
    if (totalBonus < 0) {
      totalBonus = 0;
    }

    const userData = {
      Deposit: Deposit,
      withdrawable: withdrawable,
      total: Deposit + withdrawable,
      bonus: totalBonus,
    };

    return res.status(200).send({
      success: true,
      errorCode: "0000",
      Type: "Response",
      message: "Data delivered successfully",
      data: userData,
    });
  } catch (error) {
    return res.status(400).send({ success: false, error: error.message });
  }
});

//Add Cash statement

router.get("/get-cash-transaction", authenticateJWT, async (req, res) => {
  try {
    const { userId } = req.user;
    const user = await db
      .collection("game_users")
      .findOne({ _id: getInfo.MongoID(userId) });
    if (!user) {
      return res.status(404).send({
        success: false,
        errorCode: "1069",
        Type: "Response",
        message: "User Not Found",
      });
    }
    let payload = [];
    const userPaymentData = await db
      .collection("user_payment")
      .find({
        userId: getInfo.MongoID(userId),
        mode: "ADD_CASH",
        paymentFlag: { $ne: "Forwarded Cash" },
        status: { $ne: "PENDING" },
      })
      .sort({ _id: -1 })
      .project({ paymentResponse: 0 })
      .toArray();
    logger.info("---userPaymentData--------->", userPaymentData.length);
    for (const element of userPaymentData) {
      element.complete_date = element.complete_date
        ? element.complete_date
        : element.create_date;
      element.complete_date = moment
        .utc(new Date(element.complete_date))
        .add({ hours: 5, minutes: 30 })
        .format("MMM D, h:mm A");
      const bonusData = await db.collection("bonus_tracking").findOne({
        userId: getInfo.MongoID(userId),
        orderId: element.orderId,
      });
      if (bonusData) {
        element.bonus = bonusData.getBonus;
      } else {
        element.bonus = 0;
      }
      // delete element.paymentResponse;
      payload.push(element);
    }

    if (payload.length == 0) {
      return res.status(200).send({
        success: true,
        errorCode: "0000",
        Type: "Response",
        message: "You have not made any transactions yet",
        data: { totalCash: user.depositCash + user.Winning, payload: [] },
      });
    }

    return res.status(200).send({
      success: true,
      errorCode: "0000",
      Type: "Response",
      message: "Data delivered successfully",
      data: { totalCash: user.depositCash + user.Winning, payload: payload },
    });
  } catch (error) {
    logger.info("error----->", error);
    return res.status(400).send({ success: false, error: error.message });
  }
});

//offers

router.get("/get-offer", authenticateJWT, async (req, res) => {
  try {
    // const { BLOCK_STATE } = GetConfig();
    const { userId } = req.user;
    const user = await db.collection("game_users").findOne({
      _id: getInfo.MongoID(userId),
    });
    if (!user) {
      return res.status(404).send({
        success: false,
        errorCode: "1069",
        Type: "Response",
        message: "User Not Found",
        data: {}
      });
    }

    // let countryCheck = false;

    // if (user.storeUser && user.country !== "India") countryCheck = true;
    // const checkLocation = _.contains(BLOCK_STATE, user.state) || countryCheck;
    // if (checkLocation)
    //   return res.status(200).send({
    //     success: false,
    //     errorCode: "1009",
    //     Type: "Response",
    //     message:
    //       "As per regulations, cash games are restricted for your location. We recommend you play practice games and improve your skill in the meantime!",
    //     data: { showPop: true, isRestricted: true },
    //   });

    // if (user.storeUser) {
    //   const userAddressProof = await db
    //     .collection("UserAddressProof")
    //     .find({ userId: user._id })
    //     .limit(1)
    //     .toArray();
    //   if (userAddressProof.length <= 0)
    //     return res.status(200).send({
    //       success: true,
    //       errorCode: "0000",
    //       Type: "Response",
    //       message: "Get address document proof data.",
    //       data: {
    //         showPop: userAddressProof?.length == 0,
    //         userAddressProof,
    //       },
    //     });
    // }

    if (!user.isFirstTimeUser) {
      return res.status(200).send({
        success: false,
        errorCode: "0000",
        Type: "Response",
        message: "Not First Time User",
        data: {},
      });
    }

    //offer details

    let offer = await db.collection("offers").findOne({});

    if (!offer) {
      return res.status(200).send({
        success: false,
        errorCode: "0000",
        Type: "Response",
        message: "No Offer Found",
        data: {},
      });
    }
    return res.status(200).send({
      success: true,
      errorCode: "0000",
      Type: "Response",
      message: "Data delivered successfully",
      data: {
        offer: offer,
      },
    });
  } catch (error) {
    return res.status(400).send({ success: false, error: error.message, data: {} });
  }
});

//Add Cash

router.get("/amountPackDetails", authenticateJWT, async (req, res) => {
  try {
    const { BLOCK_STATE, CONTACT_US_NO } = GetConfig();
    const { userId } = req.user;
    const user = await db
      .collection("game_users")
      .findOne({ _id: getInfo.MongoID(userId) });
    if (!user) {
      return res.status(404).send({
        success: false,
        errorCode: "1069",
        Type: "Response",
        message: "User Not Found",
      });
    }

    let countryCheck = false;

    if (user.storeUser && user.country !== "India") countryCheck = true;
    const checkLocation = _.contains(BLOCK_STATE, user.state) || countryCheck;
    if (checkLocation)
      return res.status(200).send({
        success: false,
        errorCode: "1009",
        Type: "Response",
        message:
          "As per regulations, cash games are restricted for your location. We recommend you play practice games and improve your skill in the meantime!",
        data: { showPop: true, isRestricted: true },
      });

    if (user.storeUser) {
      const userAddressProof = await db
        .collection("UserAddressProof")
        .find({ userId: user._id })
        .limit(1)
        .toArray();
      if (userAddressProof.length <= 0)
        return res.status(200).send({
          success: true,
          errorCode: "0000",
          Type: "Response",
          message: "Get address document proof data.",
          data: {
            showPop: userAddressProof?.length == 0,
            userAddressProof,
          },
        });
    }

    //pack details
    let bonus_perc_table = await db
      .collection("add_cash_bonus_percent")
      .findOne();
    const bonusPercentage = bonus_perc_table.bonus_amt;
    logger.info("----bonusPercentage----->", bonusPercentage);
    // const bonusPercentage = Number(bonus_perc_table.bonus_amt.replace("%", ""));
    const minAmount = 50;
    const maxAmount = 10000;
    const packArray = await db.collection("pack_details").find().toArray();
    let contactus = CONTACT_US_NO ?? "9311449099";
    let bonusFormula, depositFormula;

    if (user.isFirstTimeUser) {
      bonusFormula = ["*", (bonusPercentage * 0.01).toString()];
      depositFormula = ["*", "1", "+", "50"];
      packArray.forEach((pack) => {
        pack.bonus = pack.add * (bonusPercentage / 100);
        pack.deposit = pack.add + 50;
        pack.get = pack.deposit + pack.bonus;
      });
    } else {
      bonusFormula = ["*", (bonusPercentage * 0.01).toString()];
      depositFormula = ["*", "1"];
      packArray.forEach((pack) => {
        pack.bonus = pack.add * (bonusPercentage / 100);
        pack.deposit = pack.add;
        pack.get = pack.deposit + pack.bonus;
      });
    }

    return res.status(200).send({
      success: true,
      errorCode: "0000",
      Type: "Response",
      message: "Data delivered successfully",
      data: {
        contactus,
        bonusPercentage: bonusPercentage,
        minAmount: minAmount,
        maxAmount: maxAmount,
        packArray: packArray,
        bonusFormula,
        depositFormula,
      },
    });
  } catch (error) {
    return res.status(400).send({ success: false, error: error.message });
  }
});

//if limit then check limit amount
async function checkDailyLimit(userId, amount) {
  let today, todayEnd, startTime, endTime;
  today = new Date().setUTCHours(0, 0, 0, 0);
  todayEnd = new Date().setUTCHours(23, 59, 59, 999);
  startTime = new Date(today).toISOString();
  endTime = new Date(todayEnd).toISOString();

  const paymentData = await db
    .collection("user_payment")
    .find({
      userId: getInfo.MongoID(userId),
      status: "SUCCESS",
      create_date: { $gte: new Date(startTime), $lte: new Date(endTime) },
    })
    .toArray();

  //find play responsibly
  const responsiblyData = await db.collection("user_responsibly").findOne({
    userId: getInfo.MongoID(userId),
  });
  const { dailyLimit } = responsiblyData;

  if (
    dailyLimit.date >= new Date(startTime) &&
    dailyLimit.date <= new Date(endTime)
  ) {
    dailyLimit.dailyPayCount = dailyLimit.dailyPayCount;
  } else {
    dailyLimit.dailyPayCount = 0;
    await db.collection("user_responsibly").findOneAndUpdate(
      { userId: getInfo.MongoID(userId) },
      {
        $set: {
          "dailyLimit.dailyPayCount": 0,
        },
      }
    );
  }

  if (dailyLimit.dailyPayCount == 1) {
    //after set limit check user payment
    let afterLimitPayment = [];
    for (const element of paymentData) {
      if (element.create_date >= dailyLimit.date) {
        afterLimitPayment.push(element);
      }
    }
    let totalAmount = 0;
    if (afterLimitPayment != 0) {
      for (const element of afterLimitPayment) {
        totalAmount += element.amount;
      }
    }

    const remainingAmount = dailyLimit.amount - totalAmount;
    if (remainingAmount <= 0) {
      return false;
    } else {
      return true;
    }
  } else {
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
    return true;
  }
}

async function checkMonthlyLimit(userId, amount) {
  //find play-responsibly
  const responsiblyData = await db.collection("user_responsibly").findOne({
    userId: getInfo.MongoID(userId),
  });
  const { monthlyLimit } = responsiblyData;

  let startTime, endTime;
  startTime = new Date(monthlyLimit.date);
  const month = startTime.getUTCMonth() + 1;
  startTime = new Date(startTime).toISOString();
  endTime = new Date(startTime).setUTCMonth(month);
  endTime = new Date(endTime).toISOString();

  const paymentData = await db
    .collection("user_payment")
    .find({
      userId: getInfo.MongoID(userId),
      status: "SUCCESS",
      create_date: { $gte: new Date(startTime), $lte: new Date(endTime) },
    })
    .toArray();

  if (
    monthlyLimit.date >= new Date(startTime) &&
    monthlyLimit.date <= new Date(endTime)
  ) {
    monthlyLimit.monthlyPayCount = monthlyLimit.monthlyPayCount;
  } else {
    monthlyLimit.monthlyPayCount = 0;
    await db.collection("user_responsibly").findOneAndUpdate(
      { userId: getInfo.MongoID(userId) },
      {
        $set: {
          "monthlyLimit.dailyPayCount": 0,
        },
      }
    );
  }

  if (monthlyLimit.monthlyPayCount == 1) {
    //after set limit check user payment
    let afterLimitPayment = [];
    for (const element of paymentData) {
      if (element.create_date >= monthlyLimit.date) {
        afterLimitPayment.push(element);
      }
    }

    let totalAmount = 0;
    if (afterLimitPayment != 0) {
      for (const element of afterLimitPayment) {
        totalAmount += element.amount;
      }
    }

    const remainingAmount = monthlyLimit.amount - totalAmount;
    return !(remainingAmount <= 0);
  } else {
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
    return true;
  }
}

//CLIENT KEYS
let instance = new Razorpay({
  key_id: razorpayKey,
  key_secret: razorpaySecret,
});

router.get("/addCashAmountView", authenticateJWT, async function (req, res) {
  try {
    let { amount, order_id } = req.query;
    const { userId } = req.user;
    logger.info("userID---------->", userId);

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

    res.render("payment/index", {
      razorpayKey,
      url,
      amount: +amount,
      order_id: order_id,
      name: user.un,
      email: user.ue,
      phn: user.phn,
    });
  } catch (error) {
    getInfo.exceptionError(error);
    return res.status(400).send({ success: false, error: error.message });
  }
});

router.get("/addCashAmount", authenticateJWT, async function (req, res) {
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

    // const paymentType = await db.collection("payment_gateway").findOne();
    // logger.info('paymentGateway--------->', paymentType);

    let orderDetails,
      razorpayAmount,
      sampleBase64,
      sampleSHA256,
      xVerify,
      phonepayRequest,
      paymentFlag,
      paymentMethod = "",
      gokwikPayload;

    // if (paymentType.payment_gateway == "razorpay") {
    if (type == "Razorpay") {
      paymentFlag = "razorpay";
      razorpayAmount = amount * 100;
      orderDetails = await instance.orders.create({
        amount: razorpayAmount,
        currency: "INR",
        receipt: await getRandomString(10, "user_payment", "receipt"),
      });
      if (!orderDetails) {
        return res.status(400).send({
          success: false,
          message: "Order created failed",
        });
      }
    } else if (type == "UPI") {
      // UPI intent

      const targetAppCheck = targetapp || targetappios;

      if (!targetAppCheck) {
        return res.status(200).send({
          success: false,
          errorCode: "0000",
          Type: "Response",
          message: "Please Provide target app.",
        });
      }

      paymentMethod = "upi";
      paymentFlag = "phonepay";
      orderDetails = {
        id: await getRandomString(14, "user_payment", "orderId", "order"),
        receipt: await getRandomString(10, "user_payment", "receipt"),
      };

      //upi intent
      // callbackUrl: 'https://kube.artoon.in:32267/phonepay-add-cash-callback',
      logger.info("targetApp targetappios", targetapp, targetappios);

      let deviceContext = {
        deviceOS: user.det.toUpperCase()
      };
      if (targetappios) {
        deviceContext.merchantCallBackScheme = "iOSIntentIntegration";
      }

      let sampleData = {
        merchantId: phonePeMerchantId,
        merchantTransactionId: orderDetails.id,
        merchantUserId: userId.toString(),
        amount: amount * 100,
        callbackUrl: url + "/addCashPhonePayResponse",
        mobileNumber: user.phn,
        deviceContext,
        paymentInstrument: {
          "type": "UPI_INTENT",
          targetApp: targetapp ?? targetappios.toUpperCase(),
          // android
          // "targetApp": "com.google.android.apps.nbu.paisa.user"
          // "targetApp": "com.phonepe.app"
          // "targetApp": "com.phonepe.simulator"

          // IOS
          // "targetApp": "PHONEPE"
          // "targetApp": "GPAY"
          // "targetApp": "PAYTM"
        },
      };
      logger.info("-------sampleData------->", sampleData);
      // convert JSON into base64
      sampleBase64 = jsonToBase64(sampleData);
      logger.info("-------sampleBase64-------->", sampleBase64);

      //convert into SHA256
      sampleSHA256 = sha256(
        sampleBase64 + "/pg/v1/pay" + phonePeMerchantSaltKey
      );
      logger.info("----sampleSHA256------->", sampleSHA256);

      xVerify = sampleSHA256 + "###" + phonePeMerchantSaltIndex;
      logger.info("--------------------XVERIFY", xVerify, sampleBase64);

      phonepayRequest = await axios({
        method: "post",
        url: phonePeMerchantHostUrl + "pg/v1/pay",
        headers: {
          "Content-Type": "application/json",
          "X-VERIFY": xVerify,
        },
        data: {
          request: sampleBase64,
        },
      })
        .then(function (response) {
          logger.info('phonepayRequest response ', response.data);
          return response.data;
        })
        .catch(function (error) {
          logger.info('phonepayRequest error', error);
          return error.response.data;
        });

      phonepayRequest.data.instrumentResponse.targetApp = targetapp;
      phonepayRequest.data.instrumentResponse.targetAppiOS = targetappios;
      logger.info('-----phonepayRequest--------->', phonepayRequest);
      // 
    } else if (type == "UPI_Gokwik") {
      orderDetails = {
        id: await getRandomString(14, "user_payment", "orderId", "order"),
        receipt: await getRandomString(10, "user_payment", "receipt"),
      };

      const order = {
        id: orderDetails.id,
        total: amount,
        payment_details: {
          method_id: "upi",
        },
        billing_address: {
          first_name: user.un,
          email: user.ue,
          phone: user.phn,
        },
      };

      const gokwikRequest = await axios({
        method: "post",
        url: goKwikRequestUrl + "/v1/order/create",
        headers: {
          "Content-Type": "application/json",
          appid: goKwikAppKey,
          appsecret: goKwikAppSecretKey,
        },
        data: { order },
      });

      logger.info("gokwikRequest ------>", gokwikRequest.data);

      if (gokwikRequest.data.statusCode !== 200) {
        return res.status(400).send({
          success: false,
          message: gokwikRequest.data.statusMessage,
        });
      }
      paymentFlag = "gokwik";
      paymentMethod = gokwikRequest.data.data.order_type;
      gokwikPayload = gokwikRequest.data.data;
    }
    logger.info("orderDetails--------->", orderDetails);
    let isFirstTimeUser=false;
    if(user.isFirstTimeUser){
      isFirstTimeUser=true;
    }

    let addUserPayment = {
      userId: getInfo.MongoID(userId),
      isFirstTimeUser,
      transactionId: await getRandomString(10, "user_payment", "transactionId"),
      orderId: orderDetails.id,
      status: "PENDING",
      mode: "ADD_CASH",
      receipt: orderDetails.receipt,
      amount: +amount,
      paymentFlag,
      paymentMethod,
      create_date: new Date(),
    };
    if (paymentFlag == "gokwik") {
      addUserPayment = {
        ...addUserPayment,
        gokwik_oid: gokwikPayload.gokwik_oid,
        gokwik_request_id: gokwikPayload.request_id,
      };
    }

    await db.collection("user_payment").insertOne(addUserPayment);

    let paymentData = {
      success: continueFlag ? true : false,
      errorCode: "0000",
      Type: paymentFlag,
      message: continueFlag ? "Data delivered successfully" : flagMsg,
      data: {
        payment_link: razorpayAmount
          ? `${url}/addCashAmountView?amount=${razorpayAmount}&order_id=${orderDetails.id}&authorization=${req.headers.authorization}`
          : "",
        callback_url: razorpayAmount ? `${url}/add-cash-callback` : "",
        linkid: razorpayAmount ? orderDetails.id : "",
      },
      payload: {
        // name: user.un,
        name: razorpayAmount ? "RummyXL" : user.un,
        description: razorpayAmount ? "RummyXL" : "",
        currency: razorpayAmount ? "INR" : "",
        amount: amount,
        send_sms_hash: true,
        prefill: {
          email: razorpayAmount ? user.un : "",
          contact: user.phn,
        },
        api_key: {
          RAZORPAY_KEY_ID: razorpayAmount ? razorpayKey : "",
          RAZORPAY_SECRET_KEY: razorpayAmount ? razorpaySecret : "",
        },
      },
      phonepayPayload: JSON.stringify(phonepayRequest),
      gokwikPayload: JSON.stringify(gokwikPayload),
    };
    return res.status(continueFlag ? 200 : 400).send(paymentData);
  } catch (error) {
    logger.info("error---addCashAmount---->", error);
    getInfo.exceptionError(error);
    // return res.status(400).send(commonClass.encrypt({ success: false, error: error }));
    return res.status(400).send({ success: false, error: error });
  }
});

router.post("/addCashAmount", async function (req, res) {
  try {
    logger.info("addCashAmount--------api called--------->");

    let amount = 200;
    const userId = "646b44dbd78ea10014b7db0d";
    logger.info("userId------------>", userId);
    const user = await db.collection("game_users").findOne({ _id: getInfo.MongoID(userId), });
    if (!user) {
      return res.status(404).send({
        success: false,
        errorCode: "1069",
        Type: "Response",
        message: "User Not Found",
      });
    }
    //  const paymentType = await db.collection("payment_gateway").findOne();
    // logger.info('paymentGateway--------->', paymentType);

    let orderDetails,
      razorpayAmount,
      sampleBase64,
      sampleSHA256,
      xVerify,
      phonepayRequest,
      paymentFlag,
      paymentMethod = "",
      gokwikPayload;

    // UPI intent
    paymentMethod = "upi";
    paymentFlag = "airpay";
    orderDetails = {
      id: await getRandomString(14, "user_payment", "orderId", "order"),
      receipt: await getRandomString(10, "user_payment", "receipt"),
    };

    const orderId = orderDetails.id.split("_")[1];

    // staging
    // const merchantId = '21720';
    // const userName = '7595201';
    // const password = 'MgUFY5em';
    // const API_key = '6KeetYvu2TSdsegD';

    const merchantId = 277915;
    const userName = 6941707;
    const password = "5VFZSx4G";
    const API_key = "KxsJruM23uFsYBMk";

    const date = moment().format('YYYY-MM-DD');
    const userData = userName + ':|:' + password;
    const privatekey = sha256(API_key + '@' + userData);
    const email = user.ue || user.phn.toString() + "@gmail.com";
    const allData = email + user.phn + user.phn + "" + "" + "" + "" + amount + orderId + date;
    const keySha256 = sha256(userName + "~:~" + password);
    const checksum = sha256(keySha256 + '@' + allData);
    logger.info("checksum", checksum);
    const requestPayload = {
      "buyerEmail": email,
      "buyerPhone": user.phn,
      "buyerFirstName": user.phn,
      "buyerLastName": user.phn,
      "buyerAddress": "",
      "buyerCity": "",
      "buyerState": "",
      "buyerCountry": "",
      "buyerPinCode": "",
      "orderId": orderId,
      "amount": amount,
      // "UID": user._id,
      "privatekey": privatekey,
      "merchantId": merchantId,
      "chmod": "upi",
      // "kittype": "inline",
      "checksum": checksum,
      "currency": 356,
      "isoCurrency": "INR",
      "CUSTOMVAR": "",
      "TXNSUBTYPE": "",
      "WALLET": "0",
      "SUCCESS_URL": url + "/successAirpayResponse",
      "FAILURE_URL": url + "/failureAirpayResponse",
    };

    let paymentData = {
      success: true,
      errorCode: "0000",
      Type: paymentFlag,
      message: "Data delivered successfully",
      airPayPayload: requestPayload
    };
    return res.status(200).send(paymentData);
  } catch (error) {
    logger.info("error---addCashAmount---->", error);
    getInfo.exceptionError(error);
    // return res.status(400).send(commonClass.encrypt({ success: false, error: error }));
    return res.status(400).send({ success: false, error: error });
  }
});

router.post("/add-cash-callback-webhook", async function (req, res) {
  try {
    logger.info(
      "---/add-cash-callback-webhook-------post------>",
      req.body.payload
    );
    const { EXPIRE_CASH_BONUS } = GetConfig();

    //find transactionId
    let orderId = req.body.payload.payment.entity.order_id;
    const getTransaction = await db
      .collection("user_payment")
      .findOne({ orderId: orderId });
    logger.info("getTransaction---------->", getTransaction);
    const findPayment = req.body.payload.payment;
    const verifyPayment = findPayment.entity;
    const userDetails = await db
      .collection("user_payment")
      .findOne({ paymentId: verifyPayment.id, orderId: orderId });

    if (getTransaction && getTransaction.status == "PENDING" && !userDetails) {
      logger.info("userId------->", getTransaction.userId);
      const userId = getTransaction.userId;

      //find payment using orderId

      verifyPayment.amount = verifyPayment.amount / 100;
      verifyPayment.created_at = moment(
        verifyPayment.created_at * 1000
      ).format();

      if (verifyPayment.status == "captured") {
        verifyPayment.status = "SUCCESS";
      } else if (verifyPayment.status == "failed") {
        verifyPayment.status = "FAILED";
      }

      await db.collection("user_payment").findOneAndUpdate(
        {
          userId: getInfo.MongoID(userId),
          orderId: orderId,
        },
        {
          $set: {
            amount: verifyPayment.amount,
            paymentMethod: verifyPayment.method,
            status: verifyPayment.status,
            complete_date: new Date(verifyPayment.created_at),
            paymentId: verifyPayment.id,
            paymentResponse: verifyPayment,
          },
        },
        { new: true }
      );

      //find bonus percentage
      let bonus_perc_table = await db
        .collection("add_cash_bonus_percent")
        .findOne();
      // const bonus_perc = Number(bonus_perc_table.bonus_amt.replace("%", ""));
      const bonus_perc = bonus_perc_table.bonus_amt;
      const displayBonus = (verifyPayment.amount * bonus_perc) / 100;

      if (verifyPayment.status == "SUCCESS") {
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

        let current_date, expire_date, days;
        days = EXPIRE_CASH_BONUS;
        current_date = new Date();
        expire_date = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

        
        let insertData = {
          uid: getInfo.MongoID(userId),
          un: user.un,
          ue: user.ue,
          c: verifyPayment.amount,
          tp: "Cash Added",
          sts: "success",
          orderId: orderId,
          transactionId: getTransaction.transactionId,
          cd: new Date(verifyPayment.created_at),
          depositCash: user.depositCash + verifyPayment.amount,
          withdrawableCash: user.Winning,
        };

        // await db.collection("cash_track").insertOne(insertData);

        let trobj = {
          userId: getInfo.MongoID(userId),
          orderId: orderId,
          addCash: verifyPayment.amount,
          getBonus: displayBonus,
          transactionId: getTransaction.transactionId,
          cd: new Date(verifyPayment.created_at),
          type: "User add cash",
        };
        await db.collection("bonus_tracking").insertOne(trobj);

         //check user for first time offer

        //  if (user.isFirstTimeUser) {
        //   let insertOfferData =insertData;
        //   insertOfferData.depositCash=insertData.depositCash+50;
        //   insertOfferData.tp="FreeCash Added"          
        //   await db.collection("cash_track").insertOne(insertOfferData);
        //   let depositAmount = verifyPayment.amount + 50;
        //   verifyPayment.amount = depositAmount;
        //   verifyPayment.isOfferClaimed = true;

        // }
        if (user.isFirstTimeUser) {
          let insertOfferData ={...insertData};
          insertOfferData.depositCash=insertData.depositCash+50;
          insertOfferData.tp="FreeCash Added"  
          // insertOfferData._id=getInfo.MongoID()        
          await db.collection("cash_track").insertMany([insertData,insertOfferData]);
          let depositAmount = verifyPayment.amount + 50;
          verifyPayment.amount = depositAmount;
          verifyPayment.isOfferClaimed = true;

        }else{
          await db.collection("cash_track").insertOne(insertData);

        }
        await db.collection("game_users").findOneAndUpdate(
          { _id: getInfo.MongoID(userId) },
          {
            $inc: {
              depositCash: verifyPayment.amount,
              "counters.addcash": +1,
            },
            $set: {
              "flags._firstdeposit": true,
              isFirstTimeUser: false,
              firstTimeOfferUsed: true,
            },
            $push: {
              addCash_bonus: {
                addCashBonus: displayBonus,
                current_date: current_date,
                expire_date: expire_date,
                status: "Active",
                transactionId: getTransaction.transactionId,
                _id: getInfo.MongoID(),
              },
            },
          },
          { new: true }
        );
      }
    }
  } catch (error) {
    logger.info("error-----add-cash-callback-webhook", error);
    getInfo.exceptionError(error);
    // res.status(400).send({ success: false, error: error.message });
  } finally {
    res.status(200).send({ success: true });
  }
});

router.get("/add-cash-callback", async function (req, res) {
  try {
    logger.info("/add-cash-callback-get-body", req.body);
    return res.status(200).send(req.body);
  } catch (error) {
    return res.status(400).send({ success: false, error: error.message });
  }
});

router.post("/add-cash-callback", async function (req, res) {
  try {
    logger.info("/add-cash-callback-post-body", req.body);
    return res.status(200).send(req.body);
  } catch (error) {
    return res.status(400).send({ success: false, error: error.message });
  }
});

router.get("/razorPayPaymentVerify", authenticateJWT, async (req, res) => {
  try {
    const { EXPIRE_CASH_BONUS } = GetConfig();

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
    let verifyPayment, displayBonus;
    logger.info("getTransaction------->", getTransaction);
    if (getTransaction && getTransaction.status == "PENDING") {
      //find payment using orderId
      const findPayment = await instance.orders.fetchPayments(orderId);
      logger.info("findPayment------>", findPayment);
      verifyPayment = findPayment.items[0];

      if (findPayment.items.length != 0) {
        const userDetails = await db
          .collection("user_payment")
          .findOne({ paymentId: verifyPayment.id, orderId: orderId });
        if (!userDetails) {
          verifyPayment.amount = verifyPayment.amount / 100;
          verifyPayment.created_at = moment(
            verifyPayment.created_at * 1000
          ).format();

          if (verifyPayment.status == "captured") {
            verifyPayment.status = "SUCCESS";
          } else if (verifyPayment.status == "failed") {
            verifyPayment.status = "FAILED";
          }

          await db.collection("user_payment").findOneAndUpdate(
            {
              userId: getInfo.MongoID(userId),
              orderId: orderId,
            },
            {
              $set: {
                amount: verifyPayment.amount,
                paymentMethod: verifyPayment.method,
                status: verifyPayment.status,
                complete_date: new Date(verifyPayment.created_at),
                paymentId: verifyPayment.id,
                paymentResponse: verifyPayment,
              },
            },
            { new: true, upsert: true }
          );

          //find bonus percentage
          let bonus_perc_table = await db
            .collection("add_cash_bonus_percent")
            .findOne();
          // const bonus_perc = Number(bonus_perc_table.bonus_amt.replace("%", ""));
          const bonus_perc = bonus_perc_table.bonus_amt;
          displayBonus = (verifyPayment.amount * bonus_perc) / 100;

          if (verifyPayment.status == "SUCCESS") {
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

            let current_date, expire_date, days;
            days = EXPIRE_CASH_BONUS; //config.EXPIRECASHBONUS
            current_date = new Date();
            expire_date = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

            // //check user for first time offer

            // if (user.isFirstTimeUser) {
            //   // let offer = await db.collection("offers").findOne();
            //   let depositAmount = verifyPayment.amount + 50;
            //   verifyPayment.amount = depositAmount;
            //   verifyPayment.isOfferClaimed = true;
            // }

            // await db.collection("game_users").findOneAndUpdate(
            //   { _id: getInfo.MongoID(userId) },
            //   {
            //     $inc: {
            //       depositCash: verifyPayment.amount,
            //       "counters.addcash": +1,
            //     },
            //     $set: {
            //       "flags._firstdeposit": true,
            //       isFirstTimeUser: false,
            //       firstTimeOfferUsed: true,
            //     },
            //     $push: {
            //       addCash_bonus: {
            //         addCashBonus: displayBonus,
            //         current_date: current_date,
            //         expire_date: expire_date,
            //         status: "Active",
            //         transactionId: getTransaction.transactionId,
            //         _id: getInfo.MongoID(),
            //       },
            //     },
            //   },
            //   { new: true }
            // );

            let insertData = {
              uid: getInfo.MongoID(userId),
              un: user.un,
              ue: user.ue,
              c: verifyPayment.amount,
              tp: "Cash Added",
              sts: "success",
              orderId: orderId,
              transactionId: getTransaction.transactionId,
              cd: new Date(verifyPayment.created_at),
              depositCash: user.depositCash + verifyPayment.amount,
              withdrawableCash: user.Winning,
            };

            // await db.collection("cash_track").insertOne(insertData);

            let trobj = {
              userId: getInfo.MongoID(userId),
              orderId: orderId,
              addCash: verifyPayment.amount,
              getBonus: displayBonus,
              orderId: orderId,
              transactionId: getTransaction.transactionId,
              cd: new Date(verifyPayment.created_at),
              type: "User add cash",
            };
            await db.collection("bonus_tracking").insertOne(trobj);

            //check user for first time offer

            if (user.isFirstTimeUser) {
              let insertOfferData ={...insertData};
              insertOfferData.depositCash=insertData.depositCash+50;
              insertOfferData.tp="FreeCash Added"                      
              await db.collection("cash_track").insertMany([insertData,insertOfferData]);
              let depositAmount = verifyPayment.amount + 50;
              verifyPayment.amount = depositAmount;
              verifyPayment.isOfferClaimed = true;

            }else{
              await db.collection("cash_track").insertOne(insertData);

            }
            
            await db.collection("game_users").findOneAndUpdate(
              { _id: getInfo.MongoID(userId) },
              {
                $inc: {
                  depositCash: verifyPayment.amount,
                  "counters.addcash": +1,
                },
                $set: {
                  "flags._firstdeposit": true,
                  isFirstTimeUser: false,
                  firstTimeOfferUsed: true,
                },
                $push: {
                  addCash_bonus: {
                    addCashBonus: displayBonus,
                    current_date: current_date,
                    expire_date: expire_date,
                    status: "Active",
                    transactionId: getTransaction.transactionId,
                    _id: getInfo.MongoID(),
                  },
                },
              },
              { new: true }
            );
          }
        }
      } else {
        // getTransaction.amount = getTransaction.amount / 100;

        await db.collection("user_payment").findOneAndUpdate(
          {
            userId: getInfo.MongoID(userId),
            orderId: orderId,
          },
          {
            $set: {
              amount: +getTransaction.amount,
              paymentMethod: "netbanking",
              status: "FAILED",
              complete_date: new Date(),
              paymentId: "-",
            },
          },
          { new: true }
        );

        verifyPayment = {
          id: "-",
          entity: "payment",
          amount: getTransaction.amount,
          currency: "INR",
          status: "FAILED",
          order_id: getTransaction.orderId,
          invoice_id: null,
          international: false,
          method: null,
          amount_refunded: 0,
          refund_status: null,
          captured: true,
          description: "Test Transaction",
          card_id: null,
          bank: null,
          wallet: null,
          vpa: null,
          email: user.ue,
          contact: user.phn,
          notes: [],
          fee: 100,
          tax: 0,
          error_code: null,
          error_description: null,
          error_source: null,
          error_step: null,
          error_reason: null,
          acquirer_data: { auth_code: "669882" },
          created_at: new Date(),
        };

        //find bonus percentage
        let bonus_perc_table = await db
          .collection("add_cash_bonus_percent")
          .findOne();
        // const bonus_perc = Number(bonus_perc_table.bonus_amt.replace("%", ""));
        const bonus_perc = bonus_perc_table.bonus_amt;
        displayBonus = (getTransaction.amount * bonus_perc) / 100;
      }
    } else {
      //find bonus percentage
      let bonus_perc_table = await db
        .collection("add_cash_bonus_percent")
        .findOne();
      // const bonus_perc = Number(bonus_perc_table.bonus_amt.replace("%", ""));
      const bonus_perc = bonus_perc_table.bonus_amt;
      displayBonus = (getTransaction.amount * bonus_perc) / 100;

      verifyPayment = {
        amount: +getTransaction.amount,
        status: getTransaction.status,
        paymentId: getTransaction.paymentId,
        paymentMethod: getTransaction.paymentMethod,
      };
      if(getTransaction.isFirstTimeUser){
        verifyPayment.amount=  +getTransaction.amount+50;
        verifyPayment.isOfferClaimed = true;
      }
    }

    let lobbyDetails = [];
    const pointCategory = await db
      .collection("point_category")
      .find({ mode: "cash" })
      .sort({ cpp: 1 })
      .limit(1)
      .toArray();
    lobbyDetails.push({
      lobbypayload: {
        gameName: "points",
        value: pointCategory[0].cpp,
        player_count: pointCategory[0].pCount,
      },
    });

    const poolCategory = await db
      .collection("pool_category")
      .find({ mode: "cash" })
      .sort({ fee: 1 })
      .limit(1)
      .toArray();
    lobbyDetails.push({
      lobbypayload: {
        gameName: "pool",
        value: poolCategory[0].fee,
        player_count: poolCategory[0].pCount,
      },
    });

    const dealCategory = await db
      .collection("deal_category")
      .find({ mode: "cash" })
      .sort({ cpp: 1 })
      .limit(1)
      .toArray();
    lobbyDetails.push({
      lobbypayload: {
        gameName: "deals",
        value: dealCategory[0].fee,
        player_count: dealCategory[0].pCount ? dealCategory[0].pCount : 2,
      },
    });

    return res.status(200).send({
      success: true,
      errorCode: "0000",
      Type: "Response",
      message: "Data delivered successfully",
      data: {
        transactionId: getTransaction ? getTransaction.transactionId : "",
        bonus: displayBonus,
        paymentData: verifyPayment,
        lobbyData: lobbyDetails,
      },
    });
  } catch (error) {
    logger.info("error-------->", error);
    getInfo.exceptionError(error);
    return res.status(400).send({ success: false, error: error.message });
  }
});

router.get("/phonepayPaymentVerify", authenticateJWT, async (req, res) => {
  try {
    logger.info("----phonepayPaymentVerify api called--------", req.headers);
    const { EXPIRE_CASH_BONUS } = GetConfig();

    const orderId = req.headers.orderid;
    const { userId } = req.user;
    setTimeout(async () => {
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
      logger.info("--orderId--->", userId, orderId);
      // find transactionId
      const getTransaction = await db
        .collection("user_payment")
        .findOne({ userId: getInfo.MongoID(userId), orderId: orderId });
      let verifyPayment, displayBonus;

      logger.info("getTransaction------->", getTransaction);
      if (getTransaction && getTransaction.status == "PENDING") {
        //convert into SHA256
        let sampleSHA256 = sha256(
          `/pg/v1/status/${phonePeMerchantId}/${orderId}` +
          phonePeMerchantSaltKey
        );
        logger.info("----sampleSHA256------->", sampleSHA256);
        let xVerify = sampleSHA256 + "###" + phonePeMerchantSaltIndex;
        logger.info("--------------------XVERIFY", xVerify);
        const phonepayResponse = await checkStatusAPIPhonePe(
          phonePeMerchantId,
          orderId,
          xVerify
        );
        logger.info(
          "----phonepayPaymentVerify phonepayResponse--------",
          phonepayResponse
        );

        const userDetails = await db.collection("user_payment").findOne({
          paymentId: phonepayResponse.data.transactionId,
          orderId: orderId,
        });
        if (!userDetails) {
          if (phonepayResponse.code == "PAYMENT_SUCCESS") {
            verifyPayment = phonepayResponse.data;
            logger.info("--verifyPayment--------->", verifyPayment);
            verifyPayment.amount = verifyPayment.amount / 100;

            if (verifyPayment.state == "COMPLETED") {
              verifyPayment.status = "SUCCESS";
            } else if (verifyPayment.state == "failed") {
              verifyPayment.status = "FAILED";
            }

            await db.collection("user_payment").findOneAndUpdate(
              {
                userId: getInfo.MongoID(userId),
                orderId: orderId,
              },
              {
                $set: {
                  amount: verifyPayment.amount,
                  paymentMethod: "upi",
                  status: verifyPayment.status,
                  complete_date: new Date(),
                  paymentId: verifyPayment.transactionId,
                  paymentResponse: verifyPayment,
                  // transactionId: verifyPayment.transactionId,
                },
              },
              { new: true, upsert: true }
            );

            //find bonus percentage
            let bonus_perc_table = await db
              .collection("add_cash_bonus_percent")
              .findOne();
            // const bonus_perc = Number(bonus_perc_table.bonus_amt.replace("%", ""));
            const bonus_perc = bonus_perc_table.bonus_amt;
            displayBonus = (verifyPayment.amount * bonus_perc) / 100;

            if (verifyPayment.status == "SUCCESS") {
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

              let current_date, expire_date, days;
              days = EXPIRE_CASH_BONUS; //config.EXPIRECASHBONUS
              current_date = new Date();
              expire_date = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

              //check user for first time offer

              // if (user.isFirstTimeUser) {
              //   // let offer = await db.collection("offers").findOne();
              //   let depositAmount = verifyPayment.amount + 50;
              //   verifyPayment.amount = depositAmount;
              //   verifyPayment.isOfferClaimed = true;
              // }

              // await db.collection("game_users").findOneAndUpdate(
              //   { _id: getInfo.MongoID(userId) },
              //   {
              //     $inc: {
              //       depositCash: verifyPayment.amount,
              //       "counters.addcash": +1,
              //     },
              //     $set: {
              //       "flags._firstdeposit": true,
              //       isFirstTimeUser: false,
              //       firstTimeOfferUsed: true,
              //     },
              //     $push: {
              //       addCash_bonus: {
              //         addCashBonus: displayBonus,
              //         current_date: current_date,
              //         expire_date: expire_date,
              //         status: "Active",
              //         transactionId: getTransaction.transactionId,
              //         _id: getInfo.MongoID(),
              //       },
              //     },
              //   },
              //   { new: true }
              // );

              let insertData = {
                uid: getInfo.MongoID(userId),
                un: user.un,
                ue: user.ue,
                c: verifyPayment.amount,
                tp: "Cash Added",
                sts: "success",
                orderId: orderId,
                transactionId: getTransaction.transactionId,
                cd: new Date(),
                depositCash: user.depositCash + verifyPayment.amount,
                withdrawableCash: user.Winning,
              };

              // await db.collection("cash_track").insertOne(insertData);

              let trobj = {
                userId: getInfo.MongoID(userId),
                orderId: orderId,
                addCash: verifyPayment.amount,
                getBonus: displayBonus,
                orderId: orderId,
                transactionId: getTransaction.transactionId,
                cd: new Date(),
                type: "User add cash",
              };
              await db.collection("bonus_tracking").insertOne(trobj);

              // if (user.isFirstTimeUser) {
              //   let insertOfferData =insertData;
              //   insertOfferData.depositCash=insertData.depositCash+50;
              //   insertOfferData.tp="FreeCash Added"          
              //   await db.collection("cash_track").insertOne(insertOfferData);
              //   let depositAmount = verifyPayment.amount + 50;
              //   verifyPayment.amount = depositAmount;
              //   verifyPayment.isOfferClaimed = true;
              // }
              if (user.isFirstTimeUser) {
                let insertOfferData ={...insertData};
                insertOfferData.depositCash=insertData.depositCash+50;
                insertOfferData.tp="FreeCash Added"  
                // insertOfferData._id=getInfo.MongoID()        
                await db.collection("cash_track").insertMany([insertData,insertOfferData]);
                let depositAmount = verifyPayment.amount + 50;
                verifyPayment.amount = depositAmount;
                verifyPayment.isOfferClaimed = true;
  
              }else{
                await db.collection("cash_track").insertOne(insertData);
  
              }
              
              await db.collection("game_users").findOneAndUpdate(
                { _id: getInfo.MongoID(userId) },
                {
                  $inc: {
                    depositCash: verifyPayment.amount,
                    "counters.addcash": +1,
                  },
                  $set: {
                    "flags._firstdeposit": true,
                    isFirstTimeUser: false,
                    firstTimeOfferUsed: true,
                  },
                  $push: {
                    addCash_bonus: {
                      addCashBonus: displayBonus,
                      current_date: current_date,
                      expire_date: expire_date,
                      status: "Active",
                      transactionId: getTransaction.transactionId,
                      _id: getInfo.MongoID(),
                    },
                  },
                },
                { new: true }
              );
              
            }
          } else if (phonepayResponse.code == "PAYMENT_ERROR") {
            logger.info(
              "---phonepayResponse---> success false",
              phonepayResponse
            );
            await db.collection("user_payment").findOneAndUpdate(
              {
                userId: getInfo.MongoID(userId),
                orderId: orderId,
              },
              {
                $set: {
                  amount: getTransaction.amount,
                  paymentMethod: "upi",
                  status: "FAILED",
                  complete_date: new Date(),
                  paymentId: "-",
                },
              },
              { new: true }
            );

            verifyPayment = {
              amount: getTransaction.amount,
              status: "FAILED",
              paymentId: getTransaction.paymentId,
              paymentMethod: "upi",
            };
            //find bonus percentage
            let bonus_perc_table = await db
              .collection("add_cash_bonus_percent")
              .findOne();
            // const bonus_perc = Number(bonus_perc_table.bonus_amt.replace("%", ""));
            const bonus_perc = bonus_perc_table.bonus_amt;
            displayBonus = (getTransaction.amount * bonus_perc) / 100;
          } else {
            //find bonus percentage
            let bonus_perc_table = await db
              .collection("add_cash_bonus_percent")
              .findOne();
            // const bonus_perc = Number(bonus_perc_table.bonus_amt.replace("%", ""));
            const bonus_perc = bonus_perc_table.bonus_amt;
            displayBonus = (getTransaction.amount * bonus_perc) / 100;

            verifyPayment = {
              amount: getTransaction.amount,
              status: getTransaction.status,
              paymentId: getTransaction.paymentId,
              paymentMethod: "upi",
            };
          }
        } else {
          //find bonus percentage
          let bonus_perc_table = await db
            .collection("add_cash_bonus_percent")
            .findOne();
          // const bonus_perc = Number(bonus_perc_table.bonus_amt.replace("%", ""));
          const bonus_perc = bonus_perc_table.bonus_amt;
          displayBonus = (getTransaction.amount * bonus_perc) / 100;

          verifyPayment = {
            amount: getTransaction.amount,
            status: getTransaction.status,
            paymentId: getTransaction.paymentId,
            paymentMethod: "upi",
          };
        }
      } else {
        //find bonus percentage
        let bonus_perc_table = await db
          .collection("add_cash_bonus_percent")
          .findOne();
        // const bonus_perc = Number(bonus_perc_table.bonus_amt.replace("%", ""));
        const bonus_perc = bonus_perc_table.bonus_amt;
        displayBonus = (getTransaction.amount * bonus_perc) / 100;

        verifyPayment = {
          amount: getTransaction.amount,
          status: getTransaction.status,
          paymentId: getTransaction.paymentId,
          paymentMethod: "upi",
        };
        if(getTransaction.isFirstTimeUser){
          verifyPayment.amount=  +getTransaction.amount+50;
          verifyPayment.isOfferClaimed = true;
        }
      }

      let lobbyDetails = [];
      const pointCategory = await db
        .collection("point_category")
        .find({ mode: "cash" })
        .sort({ cpp: 1 })
        .limit(1)
        .toArray();
      lobbyDetails.push({
        lobbypayload: {
          gameName: "points",
          value: pointCategory[0].cpp,
          player_count: pointCategory[0].pCount,
        },
      });

      const poolCategory = await db
        .collection("pool_category")
        .find({ mode: "cash" })
        .sort({ fee: 1 })
        .limit(1)
        .toArray();
      lobbyDetails.push({
        lobbypayload: {
          gameName: "pool",
          value: poolCategory[0].fee,
          player_count: poolCategory[0].pCount,
        },
      });

      const dealCategory = await db
        .collection("deal_category")
        .find({ mode: "cash" })
        .sort({ cpp: 1 })
        .limit(1)
        .toArray();
      lobbyDetails.push({
        lobbypayload: {
          gameName: "deals",
          value: dealCategory[0].fee,
          player_count: dealCategory[0].pCount ? dealCategory[0].pCount : 2,
        },
      });

      return res.status(200).send({
        success: true,
        errorCode: "0000",
        Type: "Response",
        message: "Data delivered successfully",
        data: {
          transactionId: getTransaction ? getTransaction.transactionId : "",
          bonus: displayBonus,
          paymentData: verifyPayment,
          lobbyData: lobbyDetails,
        },
      });
    }, 2000);
  } catch (error) {
    logger.info("error----phonepayPaymentVerify---->", error);
    getInfo.exceptionError(error);
    return res.status(400).send({ success: false, error: error.message });
  }
});

const checkStatusAPIPhonePe = async (phonePeMerchantId, orderId, xVerify) => {
  let configAxios = {
    method: "get",
    url: `${phonePeMerchantHostUrl}pg/v1/status/${phonePeMerchantId}/${orderId}`,
    headers: {
      "X-MERCHANT-ID": phonePeMerchantId,
      "X-VERIFY": xVerify,
    },
  };

  const phonepayResponse = await axios(configAxios)
    .then(function (response) {
      logger.info("response----->checkStatusAPIPhonePe", response.data);
      return response.data;
    })
    .catch(function (error) {
      logger.info("error------->checkStatusAPIPhonePe", error);
      return error;
    });


  return phonepayResponse;
};

router.get("/gokwikPaymentVerify", authenticateJWT, async (req, res) => {
  try {
    logger.info("----gokwikPaymentVerify api called--------", req.headers);
    const orderId = req.headers.orderid;
    const { userId } = req.user;
    const { EXPIRE_CASH_BONUS } = GetConfig();
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
    logger.info("--orderId--->", userId, orderId);

    // find transactionId
    const getTransaction = await db.collection("user_payment").findOne({
      userId: getInfo.MongoID(userId),
      orderId: orderId,
    });
    let verifyPayment, displayBonus;

    logger.info("getTransaction------->", getTransaction);
    if (getTransaction && getTransaction.status == "PENDING") {
      const gokwikPaymentVerify = await axios({
        method: "post",
        url: goKwikRequestUrl + "/v1/payment/verify",
        headers: {
          "Content-Type": "application/json",
          appid: goKwikAppKey,
          appsecret: goKwikAppSecretKey,
        },
        data: {
          gokwik_oid: getTransaction.gokwik_oid,
          total: getTransaction.amount,
        },
      });

      logger.info("gokwikRequest ------>", gokwikPaymentVerify.data.statusCode);

      if (gokwikPaymentVerify.data.statusCode == 200) {
        verifyPayment = gokwikPaymentVerify.data.data;
        logger.info("--verifyPayment--------->", verifyPayment);
        verifyPayment.status = "SUCCESS";

        await db.collection("user_payment").findOneAndUpdate(
          {
            userId: getInfo.MongoID(userId),
            orderId: orderId,
          },
          {
            $set: {
              amount: verifyPayment.amount,
              paymentMethod: "upi",
              status: verifyPayment.status,
              complete_date: new Date(),
              paymentId: verifyPayment.transactionId,
              paymentResponse: verifyPayment,
              // transactionId: verifyPayment.transactionId,
            },
          },
          { new: true, upsert: true }
        );

        //find bonus percentage
        let bonus_perc_table = await db
          .collection("add_cash_bonus_percent")
          .findOne();
        // const bonus_perc = Number(bonus_perc_table.bonus_amt.replace("%", ""));
        const bonus_perc = bonus_perc_table.bonus_amt;
        displayBonus = (verifyPayment.amount * bonus_perc) / 100;

        if (verifyPayment.status == "SUCCESS") {
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

          let current_date, expire_date, days;
          days = EXPIRE_CASH_BONUS; //config.EXPIRECASHBONUS
          current_date = new Date();
          expire_date = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

          //check user for first time offer

          // if (user.isFirstTimeUser) {
          //   // let offer = await db.collection("offers").findOne();
          //   let depositAmount = verifyPayment.amount + 50;
          //   verifyPayment.amount = depositAmount;
          //   verifyPayment.isOfferClaimed = true;
          // }

          // await db.collection("game_users").findOneAndUpdate(
          //   { _id: getInfo.MongoID(userId) },
          //   {
          //     $inc: {
          //       depositCash: verifyPayment.amount,
          //       "counters.addcash": +1,
          //     },
          //     $set: {
          //       "flags._firstdeposit": true,
          //       isFirstTimeUser: false,
          //       firstTimeOfferUsed: true,
          //     },
          //     $push: {
          //       addCash_bonus: {
          //         addCashBonus: displayBonus,
          //         current_date: current_date,
          //         expire_date: expire_date,
          //         status: "Active",
          //         transactionId: getTransaction.transactionId,
          //         _id: getInfo.MongoID(),
          //       },
          //     },
          //   },
          //   { new: true }
          // );

          let insertData = {
            uid: getInfo.MongoID(userId),
            un: user.un,
            ue: user.ue,
            c: verifyPayment.amount,
            tp: "Cash Added",
            sts: "success",
            orderId: orderId,
            transactionId: getTransaction.transactionId,
            cd: new Date(),
            depositCash: user.depositCash + verifyPayment.amount,
            withdrawableCash: user.Winning,
          };

          // await db.collection("cash_track").insertOne(insertData);

          let trobj = {
            userId: getInfo.MongoID(userId),
            orderId: orderId,
            addCash: verifyPayment.amount,
            getBonus: displayBonus,
            orderId: orderId,
            transactionId: getTransaction.transactionId,
            cd: new Date(),
            type: "User add cash",
          };
          await db.collection("bonus_tracking").insertOne(trobj);

          // if (user.isFirstTimeUser) {
          //   let insertOfferData =insertData;
          //   insertOfferData.depositCash=insertData.depositCash+50;
          //   insertOfferData.tp="FreeCash Added"          
          //   await db.collection("cash_track").insertOne(insertOfferData);
          //   let depositAmount = verifyPayment.amount + 50;
          //   verifyPayment.amount = depositAmount;
          //   verifyPayment.isOfferClaimed = true;

          // }
          if (user.isFirstTimeUser) {
            let insertOfferData ={...insertData};
            insertOfferData.depositCash=insertData.depositCash+50;
            insertOfferData.tp="FreeCash Added"  
            // insertOfferData._id=getInfo.MongoID()        
            await db.collection("cash_track").insertMany([insertData,insertOfferData]);
            let depositAmount = verifyPayment.amount + 50;
            verifyPayment.amount = depositAmount;
            verifyPayment.isOfferClaimed = true;

          }else{
            await db.collection("cash_track").insertOne(insertData);
          }
          
          await db.collection("game_users").findOneAndUpdate(
            { _id: getInfo.MongoID(userId) },
            {
              $inc: {
                depositCash: verifyPayment.amount,
                "counters.addcash": +1,
              },
              $set: {
                "flags._firstdeposit": true,
                isFirstTimeUser: false,
                firstTimeOfferUsed: true,
              },
              $push: {
                addCash_bonus: {
                  addCashBonus: displayBonus,
                  current_date: current_date,
                  expire_date: expire_date,
                  status: "Active",
                  transactionId: getTransaction.transactionId,
                  _id: getInfo.MongoID(),
                },
              },
            },
            { new: true }
          );
        }
      } else if (gokwikPaymentVerify.data.statusCode != 200) {
        logger.info(
          "---gokwikResponse---> success false",
          gokwikPaymentVerify.data
        );
        await db.collection("user_payment").findOneAndUpdate(
          {
            userId: getInfo.MongoID(userId),
            orderId: orderId,
          },
          {
            $set: {
              amount: getTransaction.amount,
              paymentMethod: "upi",
              status: "FAILED",
              complete_date: new Date(),
              paymentId: "-",
            },
          },
          { new: true }
        );

        verifyPayment = {
          amount: gokwikPaymentVerify.data.data.amount,
          status: "FAILED",
          paymentId: getTransaction.paymentId,
          paymentMethod: "upi",
        };
        //find bonus percentage
        let bonus_perc_table = await db
          .collection("add_cash_bonus_percent")
          .findOne();
        // const bonus_perc = Number(bonus_perc_table.bonus_amt.replace("%", ""));
        const bonus_perc = bonus_perc_table.bonus_amt;
        displayBonus = (getTransaction.amount * bonus_perc) / 100;
      }
    } else {
      //find bonus percentage
      let bonus_perc_table = await db
        .collection("add_cash_bonus_percent")
        .findOne();

      const bonus_perc = bonus_perc_table.bonus_amt;
      displayBonus = (getTransaction.amount * bonus_perc) / 100;

      verifyPayment = {
        amount: getTransaction.amount,
        status: getTransaction.status,
        paymentId: getTransaction.paymentId,
        paymentMethod: "upi",
      };
      if(getTransaction.isFirstTimeUser){
        verifyPayment.amount=  +getTransaction.amount+50;
        verifyPayment.verifyPayment.isOfferClaimed = true;
      }
    }

    let lobbyDetails = [];
    const pointCategory = await db
      .collection("point_category")
      .find({ mode: "cash" })
      .sort({ cpp: 1 })
      .limit(1)
      .toArray();
    lobbyDetails.push({
      lobbypayload: {
        gameName: "points",
        value: pointCategory[0].cpp,
        player_count: pointCategory[0].pCount,
      },
    });

    const poolCategory = await db
      .collection("pool_category")
      .find({ mode: "cash" })
      .sort({ fee: 1 })
      .limit(1)
      .toArray();
    lobbyDetails.push({
      lobbypayload: {
        gameName: "pool",
        value: poolCategory[0].fee,
        player_count: poolCategory[0].pCount,
      },
    });

    const dealCategory = await db
      .collection("deal_category")
      .find({ mode: "cash" })
      .sort({ cpp: 1 })
      .limit(1)
      .toArray();
    lobbyDetails.push({
      lobbypayload: {
        gameName: "deals",
        value: dealCategory[0].fee,
        player_count: dealCategory[0].pCount ? dealCategory[0].pCount : 2,
      },
    });

    return res.status(200).send({
      success: true,
      errorCode: "0000",
      Type: "Response",
      message: "Data delivered successfully",
      data: {
        transactionId: getTransaction ? getTransaction.transactionId : "",
        bonus: displayBonus,
        paymentData: verifyPayment,
        lobbyData: lobbyDetails,
      },
    });
  } catch (error) {
    logger.info("error----gokwikPaymentVerify---->", error);
    getInfo.exceptionError(error);
    return res.status(400).send({ success: false, error: error.message });
  }
});
// gokwik callback url for payment response
router.get("/goKwikPaymentResponse", authenticateJWT, async (req, res) => {
  try {
    logger.info("----goKwikPaymentResponse callback response-------", req.body);
    logger.info(
      "----goKwikPaymentResponse callback response-------",
      req.query
    );
    logger.info(
      "----goKwikPaymentResponse callback response-------",
      req.params
    );
    return res.status(200).send({ success: true });
  } catch (error) {
    logger.info("error----goKwikPaymentResponse---->get", error);
    logger.info("-error----goKwikPaymentResponse---->get", error);
    return res.status(400).send({ success: false, error: error.message });
  }
});
router.post("/goKwikPaymentResponse", authenticateJWT, async (req, res) => {
  try {
    logger.info(
      "----goKwikPaymentResponse callback response-------post",
      req.body
    );
    logger.info(
      "----goKwikPaymentResponse callback response-------post",
      req.query
    );
    logger.info(
      "----goKwikPaymentResponse callback response-------post",
      req.params
    );
    return res.status(200).send({ success: true });
  } catch (error) {
    logger.info("error----goKwikPaymentResponse---->post", error);
    logger.info("-error----goKwikPaymentResponse---->post", error);
    return res.status(400).send({ success: false, error: error.message });
  }
});

//Withdrawal

router.get("/withdraw_status", authenticateJWT, async (req, res) => {
  try {
    const { userId } = req.user;
    const user = await db.collection("game_users").findOne(
      {
        _id: getInfo.MongoID(userId),
      },
      {
        projection: {
          MobileVerify: 1,
          PanVerify: 1,
          BankVerify: 1,
          Winning: 1,
          phn: 1,
          ue: 1,
          EmailVerify: 1,
          UpiVerify: 1,
        },
      }
    );
    if (!user)
      return res.status(404).send({
        success: false,
        errorCode: "1069",
        Type: "Response",
        message: "User Not Found",
      });

    let kycDone = false;
    if (
      user.MobileVerify == true &&
      user.PanVerify == true &&
      (user.BankVerify == true || user.UpiVerify == true)
    ) {
      kycDone = true;
    }
    logger.info("kycDone--------->", kycDone);
    const withdrawData = await db
      .collection("user_withdraw")
      .find({
        userId: getInfo.MongoID(userId),
      })
      .sort({ _id: -1 })
      .toArray();

    for (const [i, element] of withdrawData.entries()) {
      // const newDate = moment(element.date).format("lll");
      // const newDate = moment(new Date(element.date)).format("lll");
      const newDate = moment
        .utc(new Date(element.date))
        .add({ hours: 5, minutes: 30 })
        .format("lll");
      withdrawData[i].date = newDate;
    }

    const termscondition = [
      "All withdrawals are processed instantly if supported by your bank. These cannot be cancelled once successfully placed.",
      "One withdrawal is allowed per day(3pm to 3pm).",
      "In case of any errors in processing your withdrawal request, your money will be refunded to your RummyXL account within 3-4 working days.",
    ];
    // const termscondition = await db.collection('withdraw-term').find().toArray();

    const minimumAmount = 100;
    //get kyc-details
    const payload = await db
      .collection("user_details")
      .find({ userId: getInfo.MongoID(userId) })
      .toArray();

    let BankDetail = [],
      UpiDetail = [];
    if (payload) {
      for (const index of payload) {
        if (index.docType == "BANK" && index.status == "SUCCESS") {
          BankDetail.push(index);
        } else if (index.docType == "UPI" && index.status == "SUCCESS") {
          UpiDetail.push(index);
        }
      }
    } else {
      BankDetail = [];
      UpiDetail = [];
    }
    return res.status(200).send({
      success: true,
      errorCode: "0000",
      Type: "Response",
      message: "Data delivered successfully",
      data: {
        mobileNumber: user.phn,
        MobileVerify: user.MobileVerify,
        email: user.ue,
        EmailVerify: user.EmailVerify,
        kycDone: kycDone,
        WithdrawableBalance: user.Winning,
        minimumAmount: minimumAmount,
        withdrawalpayload: withdrawData,
        termscondition: termscondition,
        bankDetails: BankDetail,
        upiDetails: UpiDetail,
      },
    });
  } catch (error) {
    logger.info("error-------->", error);
    getInfo.exceptionError(error);
    return res.status(400).send({ success: false, error: error.message });
  }
});

// router.post("/withdraw", authenticateJWT, async (req, res) => {
//   try {
//     req.body = covertStringToObject(req.body.data);
//     const { amount } = req.body;
//     const { userId } = req.user;

//     const user = await db.collection("game_users").findOne({
//       _id: getInfo.MongoID(userId),
//     });
//     if (!user)
//       return res.status(404).send({
//         success: false,
//         errorCode: "1069",
//         Type: "Response",
//         message: "User Not Found",
//       });

//     if (user.storeUser) {
//       const userAddressProof = await db
//         .collection("UserAddressProof").find({ userId: user._id, status: { $in: ["SUCCESS", "PENDING"] } }).limit(1).toArray();

//       if (userAddressProof.length <= 0) {
//         return res.status(200).send({
//           success: true,
//           errorCode: "0000",
//           Type: "Response",
//           message: "Get address document proof data.",
//           data: {
//             showPop: userAddressProof?.length == 0,
//             userAddressProof,
//           },
//         });
//       }
//     }

//     if (amount < 100) {
//       return res.status(400).send({
//         success: false,
//         errorCode: "0000",
//         Type: "Response",
//         message: "Minimum withdraw amount 100",
//       });
//     }

//     //check 1st deposite
//     if (!user.flags._firstdeposit) {
//       return res.status(400).send({
//         success: false,
//         errorCode: "0000",
//         Type: "Response",
//         message:
//           "You need to add cash at least once before requesting withdrawals.",
//       });
//     }

//     //minimum winning amount 100
//     if (user.Winning < 100) {
//       logger.info("in Winning");
//       return res.status(400).send({
//         success: false,
//         errorCode: "0000",
//         Type: "Response",
//         message: "Minimum Winning amount ₹100",
//       });
//     }

//     if (user.Winning < amount) {
//       return res.status(400).send({
//         success: false,
//         errorCode: "0000",
//         Type: "Response",
//         message: "Amount should not be greater than actual amount",
//       });
//     }

//     /* check flag- Manual-true/Automatic-false  */
//     const typeOfWithdraw = await db.collection("payment_gateway").findOne();
//     logger.info("typeOfWithdraw---------------->", typeOfWithdraw);
//     const withdrawFlag = typeOfWithdraw.withdraw_flag;
//     logger.info("withdrawFlag--------->", withdrawFlag);

//     //find if user already request for withdraw
//     const findWithdrawData = await db.collection("user_withdraw").findOne({
//       userId: getInfo.MongoID(userId),
//       $or: [{ status: "PROCESSING" }, { status: "PENDING" }],
//     });
//     logger.info("findWithdrawData=============>", findWithdrawData);
//     if (findWithdrawData) {
//       return res.status(201).send({
//         success: false,
//         errorCode: "0000",
//         Type: "Response",
//         message:
//           "You cannot proceed without clear your last request. Please wait because we are reviewing your request.",
//       });
//     }

//     // const withdrawId = randomString.generate(10);
//     const withdrawId = await getRandomId(10, "user_withdraw", "withdrawId");
//     const withdrawDate = new Date();
//     if (withdrawFlag) {
//       if (req.body.flag == "UPI") {
//         if (!req.body.UPI.upi) {
//           return res.status(201).send({
//             success: false,
//             errorCode: "0000",
//             Type: "Response",
//             message:
//               "Please add UPI on KYC document before proceed to withdraw request.",
//           });
//         }

//         let findFundAccount = {
//           accountType: "vpa",
//           userId: getInfo.MongoID(userId),
//           "bankAccount.address": req.body.UPI.upi,
//         };
//         const userFundAccount = await db
//           .collection("user_fund_account")
//           .findOne(findFundAccount);

//         await db.collection("user_withdraw").insertOne({
//           userId: getInfo.MongoID(userId),
//           amount: amount,
//           withdrawId: withdrawId,
//           flag: req.body.flag,
//           upiId: req.body.UPI.upi,
//           status: "PENDING",
//           contactId: userFundAccount ? userFundAccount.contactId : "",
//           fundAccounts: userFundAccount ? userFundAccount.fundAccounts : "",
//           date: withdrawDate,
//           complete_date: "",
//         });
//       } else if (req.body.flag == "IMPS") {
//         const { account_holder_name, accountNumber, ifsc } = req.body.IMPS;

//         if (!account_holder_name || !accountNumber || !ifsc) {
//           return res.status(201).send({
//             success: false,
//             errorCode: "0000",
//             Type: "Response",
//             message:
//               "Please add Bank details on KYC document before proceed to withdraw request.",
//           });
//         }

//         let findFundAccount = {
//           accountType: "bank_account",
//           userId: getInfo.MongoID(userId),
//           "bankAccount.account_number": accountNumber,
//           "bankAccount.ifsc": ifsc,
//         };
//         const userFundAccount = await db
//           .collection("user_fund_account")
//           .findOne(findFundAccount);

//         await db.collection("user_withdraw").insertOne({
//           userId: getInfo.MongoID(userId),
//           amount: amount,
//           withdrawId: withdrawId,
//           flag: req.body.flag,
//           account_holder_name: account_holder_name,
//           ifsc: ifsc,
//           accountNumber: accountNumber,
//           status: "PENDING",
//           contactId: userFundAccount ? userFundAccount.contactId : "",
//           fundAccounts: userFundAccount ? userFundAccount.fundAccounts : "",
//           date: withdrawDate,
//           complete_date: "",
//         });
//       }

//       //update user Data
//       let winningAmount = user.Winning - amount;
//       await db.collection("game_users").findOneAndUpdate(
//         {
//           _id: getInfo.MongoID(userId),
//         },
//         {
//           $set: {
//             Winning: winningAmount,
//           },
//         }
//       );

//       //cash_track
//       let inserData = {
//         uid: getInfo.MongoID(userId),
//         withdrawId: withdrawId,
//         un: user.un,
//         ue: user.ue,
//         c: amount,
//         tp: "Withdraw request added",
//         sts: "success",
//         cd: withdrawDate,
//         depositCash: user.depositCash,
//         withdrawableCash: winningAmount,
//       };

//       await db.collection("cash_track").insertOne(inserData);

//       return res.status(200).send({
//         success: true,
//         errorCode: "0000",
//         Type: "Response",
//         message: "We are reviewing your withdraw request.",
//         data: amount,
//       });
//     }
//   } catch (error) {
//     logger.info("-------1---------->", error);
//     return res.status(400).send({ success: false, error: error.message });
//   }
// });

//account-statment

router.post("/withdraw", authenticateJWT, async (req, res) => {
  try {

    req.body = covertStringToObject(req.body.data);
    const { amount } = req.body;
    const { userId } = req.user;
    const { TAX } = GetConfig();

    const redisInstances = getRedisInstances();

    const lvt = await redisInstances.SET(
      `withdrawalApi:${userId}`,
      1,
      {
        EX: 10,
        NX: true,
      }
    );
    logger.info("lvt----------------->", lvt);
    if (!lvt) {
      logger.info("in if---", "withdrawal Api");
      return false
    }
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

    if (user.storeUser) {
      const userAddressProof = await db
        .collection("UserAddressProof")
        .find({ userId: user._id, status: { $in: ["SUCCESS"] } })
        .limit(1)
        .toArray();

      if (userAddressProof.length <= 0) {
        return res.status(200).send({
          success: true,
          errorCode: "0000",
          Type: "Response",
          message: "Get address document proof data.",
          data: {
            showPop: userAddressProof?.length == 0,
            userAddressProof,
          },
        });
      }
    }

    if (amount < 100) {
      return res.status(400).send({
        success: false,
        errorCode: "0000",
        Type: "Response",
        message: "Minimum withdraw amount 100",
      });
    }

    //check 1st deposite
    if (!user.flags._firstdeposit) {
      return res.status(400).send({
        success: false,
        errorCode: "0000",
        Type: "Response",
        message:
          "You need to add cash at least once before requesting withdrawals.",
      });
    }

    //minimum winning amount 100
    if (user.Winning < 100) {
      logger.info("in Winning");
      return res.status(400).send({
        success: false,
        errorCode: "0000",
        Type: "Response",
        message: "Minimum Winning amount ₹100",
      });
    }

    if (user.Winning < amount) {
      return res.status(400).send({
        success: false,
        errorCode: "0000",
        Type: "Response",
        message: "Amount should not be greater than actual amount",
      });
    }

    /* check flag- Manual-true/Automatic-false  */
    const typeOfWithdraw = await db.collection("payment_gateway").findOne();
    const withdrawFlag = typeOfWithdraw.withdraw_flag;
    logger.info("withdrawFlag--------->", withdrawFlag);

    //find if user already request for withdraw
    const findWithdrawData = await db.collection("user_withdraw").findOne({
      userId: getInfo.MongoID(userId),
      $or: [{ status: "PROCESSING" }, { status: "PENDING" }],
    });
    logger.info("findWithdrawData=============>", findWithdrawData);
    if (findWithdrawData) {
      return res.status(201).send({
        success: false,
        errorCode: "0000",
        Type: "Response",
        message:
          "You cannot proceed without clear your last request. Please wait because we are reviewing your request.",
      });
    }

    // const withdrawId = randomString.generate(10);
    logger.info("user.tdsDeposited", user.tdsDeposited);
    logger.info("user.withdrawnAmount", user.withdrawnAmount);
    const withdrawId = await getRandomId(10, "user_withdraw", "withdrawId");
    const withdrawDate = new Date();
    let amountToUser = amount;
    let tdsDeposited = user.tdsDeposited ? +user.tdsDeposited.toFixed(2) : 0;
    let withdrawnAmount = user.withdrawnAmount
      ? +user.withdrawnAmount.toFixed(2)
      : 0;
    let tdsrequired = 0;
    let tdsOnAmount = 0;
    let totalAddedCash = 0;

    if (withdrawFlag) {
      //now check user tds calculation
      //let depositCash=user.depositCash;
      //  let withdrawableAmount=user.Winning;
      // let startDate = moment("2023-04-01").format('LT');
      let date = new Date();
      let month = date.getMonth() + 1;
      let startYear = date.getFullYear();

      if (month < 4) {
        startYear = startYear - 1;
      }

      let startDate = moment.utc(`${startYear}-04-01T00:00:00+05:30`);
      logger.info("withdraw======startDate=======>", startDate);

      // let endDate = moment("2023-04-04").format('LT');
      let endDate = moment.utc(`${startYear + 1}-04-01T00:00:00+05:30`);
      logger.info("withdraw======endDate=======>", endDate);

      // create_date:{$and:[{ $gte: startDate},{ $lt:  endDate } ]}

      let response = await db
        .collection("user_payment")
        .find({
          userId: getInfo.MongoID(userId),
          status: "SUCCESS",
          mode: "ADD_CASH",
          create_date: { $gte: startDate._d, $lt: endDate._d },
        })
        .project({ amount: 1, create_date: 1 })
        .toArray();
      logger.info("withdraw========user_payment response=====>", response);

      response.forEach((element) => {
        totalAddedCash += element.amount;
      });
      logger.info("withdraw=======totalAddedCash======>", totalAddedCash);

      let netWin = withdrawnAmount + amount - totalAddedCash;
      logger.info("withdraw=======netWin======>", netWin);

      if (netWin > 0) {
        tdsrequired = +(netWin * TAX * 0.01).toFixed(2) - tdsDeposited;
        logger.info("withdraw=======tdsrequired======>", tdsrequired);
        if (tdsrequired > 0) {
          tdsOnAmount = +(amount * TAX * 0.01).toFixed(2);
          logger.info("withdraw=======tdsOnAmount======>", tdsOnAmount);

          if (tdsOnAmount > tdsrequired) {
            tdsOnAmount = tdsrequired;
          }
          amountToUser = +(amount - tdsOnAmount).toFixed(2);
          logger.info("withdraw=======amountToUser======>", amountToUser);
        }
      }
      let idempotencyId = uuidv4();
      if (req.body.flag == "UPI") {
        if (!req.body.UPI.upi) {
          return res.status(201).send({
            success: false,
            errorCode: "0000",
            Type: "Response",
            message:
              "Please add UPI on KYC document before proceed to withdraw request.",
          });
        }

        let findFundAccount = {
          accountType: "vpa",
          userId: getInfo.MongoID(userId),
          "bankAccount.address": req.body.UPI.upi,
        };
        const userFundAccount = await db
          .collection("user_fund_account")
          .findOne(findFundAccount);

        // await db.collection("user_withdraw").insertOne({
        //   userId: getInfo.MongoID(userId),
        //   reqAmount: amount,
        //   amount: amountToUser,
        //   tds: tdsOnAmount,
        //   tds_percentage: TAX,
        //   withdrawId: withdrawId,
        //   flag: req.body.flag,
        //   upiId: req.body.UPI.upi,
        //   status: "PENDING",
        //   contactId: userFundAccount ? userFundAccount.contactId : "",
        //   fundAccounts: userFundAccount ? userFundAccount.fundAccounts : "",
        //   date: withdrawDate,
        //   complete_date: "",
        // });

        await db.collection("user_withdraw").insertOne({
          userId: getInfo.MongoID(userId),
          depositCash: user.depositCash,
          previous_winning: user.Winning,
          pTds: tdsDeposited,
          reqAmount: amount,
          amount: amountToUser,
          tds: tdsOnAmount,
          tds_percentage: TAX,
          total_Tds_deposited: tdsDeposited + tdsOnAmount,
          current_winning: +(user.Winning - amount).toFixed(2),
          withdrawId: withdrawId,
          netWin: netWin > 0 ? +(netWin).toFixed(2) : 0,
          IdempotencyId: idempotencyId,
          flag: req.body.flag,
          upiId: req.body.UPI.upi,
          status: "PENDING",
          contactId: userFundAccount ? userFundAccount.contactId : "",
          fundAccounts: userFundAccount ? userFundAccount.fundAccounts : "",
          date: withdrawDate,
          complete_date: "",
        });
      } else if (req.body.flag == "IMPS") {
        const { account_holder_name, accountNumber, ifsc } = req.body.IMPS;

        if (!account_holder_name || !accountNumber || !ifsc) {
          return res.status(201).send({
            success: false,
            errorCode: "0000",
            Type: "Response",
            message:
              "Please add Bank details on KYC document before proceed to withdraw request.",
          });
        }

        let findFundAccount = {
          accountType: "bank_account",
          userId: getInfo.MongoID(userId),
          "bankAccount.account_number": accountNumber,
          "bankAccount.ifsc": ifsc,
        };
        const userFundAccount = await db
          .collection("user_fund_account")
          .findOne(findFundAccount);

        // await db.collection("user_withdraw").insertOne({
        //   userId: getInfo.MongoID(userId),
        //   reqAmount: amount,
        //   amount: amountToUser,
        //   tds: tdsOnAmount,
        //   tds_percentage: TAX,
        //   withdrawId: withdrawId,
        //   flag: req.body.flag,
        //   account_holder_name: account_holder_name,
        //   ifsc: ifsc,
        //   accountNumber: accountNumber,
        //   status: "PENDING",
        //   contactId: userFundAccount ? userFundAccount.contactId : "",
        //   fundAccounts: userFundAccount ? userFundAccount.fundAccounts : "",
        //   date: withdrawDate,
        //   complete_date: "",
        // });

        await db.collection("user_withdraw").insertOne({
          userId: getInfo.MongoID(userId),
          depositCash: user.depositCash,
          previous_winning: user.Winning,
          pTds: tdsDeposited,
          reqAmount: amount,
          amount: amountToUser,
          tds: tdsOnAmount,
          tds_percentage: TAX,
          total_Tds_deposited: tdsDeposited + tdsOnAmount,
          current_winning: +(user.Winning - amount).toFixed(2),
          withdrawId: withdrawId,
          IdempotencyId: idempotencyId,
          netWin: netWin > 0 ? +(netWin).toFixed(2) : 0,
          flag: req.body.flag,
          account_holder_name: account_holder_name,
          ifsc: ifsc,
          accountNumber: accountNumber,
          status: "PENDING",
          contactId: userFundAccount ? userFundAccount.contactId : "",
          fundAccounts: userFundAccount ? userFundAccount.fundAccounts : "",
          date: withdrawDate,
          complete_date: "",
        });
      }

      //update user Data
      let winningAmount = +(user.Winning - amount).toFixed(2);
      await db.collection("game_users").findOneAndUpdate(
        {
          _id: getInfo.MongoID(userId),
        },
        {
          $set: {
            Winning: winningAmount,
            tdsDeposited: tdsDeposited + tdsOnAmount,
            withdrawnAmount: withdrawnAmount + amount,
          },
        }
      );

      // let tdstrack = {
      //   userId: getInfo.MongoID(userId),
      //   depositCash: user.depositCash,
      //   previous_winning: user.Winning,
      //   pTds: tdsDeposited,
      //   tds_percentage: TAX,
      //   withdrawReqId: withdrawId,
      //   request_amount: amount,
      //   tdsOnAmount,
      //   netAmount: amountToUser,
      //   Tds: tdsDeposited + tdsOnAmount,
      //   current_winning: winningAmount,
      //   status: "PENDING",
      //   reason: ""
      // };
      // logger.info("withdraw=======tdstrack======>", tdstrack);

      // let taxdata = {
      //   uid: "admin",
      //   withdrawReqId: withdrawId,
      //   userId: getInfo.MongoID(userId),
      //   depositCash: user.depositCash,
      //   previous_winning: user.Winning,
      //   request_amount: amount,
      //   cash: tdsOnAmount,
      //   netAmount: amountToUser,
      //   current_winning: winningAmount,
      //   tds_percentage: TAX,
      //   t: "tds from winamount",
      //   status: "PENDING",
      //   reason: ""
      // };
      // trackClass.PlayTrackNew(taxdata, function (tdsdata) { });
      // trackClass.TdsTrackNew(tdstrack, function (tdstrc) { });

      //cash_track
      let inserData = {
        uid: getInfo.MongoID(userId),
        withdrawId: withdrawId,
        un: user.un,
        ue: user.ue,
        c: amount,
        tp: "Withdraw request added",
        sts: "success",
        cd: withdrawDate,
        depositCash: user.depositCash,
        withdrawableCash: winningAmount,
      };

      await db.collection("cash_track").insertOne(inserData);

      return res.status(200).send({
        success: true,
        errorCode: "0000",
        Type: "Response",
        message: "We are reviewing your withdraw request.",
        user_amount: amount,
        user_tdsAmount: tdsOnAmount,
        net_amount: amountToUser,
        // line: `You will recieve Rs ${amountToUser} after deducting TDS @30%.`
        line:
          tdsOnAmount != 0
            ? `You will recieve Rs ${amountToUser} after deducting TDS @${TAX}%.`
            : "",
      });
    }
  } catch (error) {
    logger.info("-------1---------->", error);
    getInfo.exceptionError(error);
    return res.status(400).send({ success: false, error: error.message });
  }
});

router.get("/account-statement", authenticateJWT, async (req, res) => {
  try {
    const { userId } = req.user;
    // const userId = '636cbe5e21bd800013825a1e';
    logger.info("userId--->", userId);
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
    //only cash mode
    let playerAccountData = [];
    const trackdata = await db
      .collection("cash_track")
      .find({ uid: getInfo.MongoID(userId) })
      .sort({ _id: 1 })
      .toArray();
    // for (const [index,element] of trackdata.entries()) {}
    // }
    for (let index = 0; index < trackdata.length; index++) {
      // const newDate = moment(new Date(trackdata[index].cd)).format("MMM D, h:mm A");
      const newDate = moment
        .utc(new Date(trackdata[index].cd))
        .add({ hours: 5, minutes: 30 })
        .format("MMM D, h:mm A");

      let obj, signBonus, wallet;

      if (trackdata[index].tp == "Collect Boot Value") {
        var convertAmount = String(trackdata[index].c).replace("-", "");
        signBonus = trackdata[index].signUpBonus;
        convertAmount = Number(convertAmount);
        convertAmount = commonClass.RoundInt(convertAmount, 2);
        wallet = convertAmount - trackdata[index].signUpBonus;
        wallet = commonClass.RoundInt(wallet, 2);
        trackdata[index].depositCash = commonClass.RoundInt(
          trackdata[index].depositCash,
          2
        );
        obj = {
          Date: newDate,
          Description: {
            type: `Amount Taken to ${trackdata[index].gameType} Table #${trackdata[index].tjid}`,
            value: `₹${convertAmount} Buy-in = ₹${wallet} Wallet + ₹${signBonus} Bonus`,
          },
          Amount: convertAmount,
          Balance: {
            type: `${trackdata[index].depositCash}(D)`,
            value: `${trackdata[index].withdrawableCash}(W)`,
          },
        };
        playerAccountData.push(obj);
      } else if (trackdata[index].tp == "Auto rebuy") {
        var convertAmount = String(trackdata[index].c).replace("-", "");
        signBonus = trackdata[index].signUpBonus;
        convertAmount = Number(convertAmount);
        convertAmount = commonClass.RoundInt(convertAmount, 2);
        wallet = convertAmount - trackdata[index].signUpBonus;
        wallet = commonClass.RoundInt(wallet, 2);
        trackdata[index].depositCash = commonClass.RoundInt(
          trackdata[index].depositCash,
          2
        );
        obj = {
          Date: newDate,
          Description: {
            type: `Auto Rebuy to ${trackdata[index].gameType} Table #${trackdata[index].tjid}`,
            value: `₹${convertAmount} Buy-in = ₹${wallet} Wallet + ₹${signBonus} Bonus`,
          },
          Amount: convertAmount,
          Balance: {
            type: `${trackdata[index].depositCash}(D)`,
            value: `${trackdata[index].withdrawableCash}(W)`,
          },
        };
        playerAccountData.push(obj);
      } else if (trackdata[index].tp == "release remaining amount") {
        signBonus = trackdata[index].signUpBonus;
        wallet = trackdata[index].c - trackdata[index].signUpBonus;
        wallet = commonClass.RoundInt(wallet, 2);
        trackdata[index].depositCash = commonClass.RoundInt(
          trackdata[index].depositCash,
          2
        );
        trackdata[index].c = commonClass.RoundInt(trackdata[index].c, 2);

        obj = {
          Date: newDate,
          Description: {
            type: `Leave ${trackdata[index].gameType} Table #${trackdata[index].tjid}`,
            value: `₹${trackdata[index].c} Refund = ₹${wallet} Wallet + ₹${signBonus} Bonus`,
          },
          Amount: trackdata[index].c,
          Balance: {
            type: `${trackdata[index].depositCash}(D)`,
            value: `${trackdata[index].withdrawableCash}(W)`,
          },
        };
        playerAccountData.push(obj);
      } else if (trackdata[index].tp == "Game Win") {
        if (trackdata[index].gameType == "Points") {
          const length = playerAccountData.length - 1;
          const lastItem = playerAccountData[length];
          // logger.info('--------1--------->', lastItem);
          // check type - amount taken or leave table
          let descriptionType = lastItem.Description.type
            .split("Table")
            .map((item) => item.trim());

          if (
            descriptionType[0] == "Amount Taken to Points" ||
            descriptionType[0] == "Auto Rebuy to Points"
          ) {
            let amount = commonClass.RoundInt(trackdata[index].c, 2);
            obj = {
              Date: newDate,
              Description: {
                type: `Leave ${trackdata[index].gameType} Table #${trackdata[index].tjid}`,
                value: `₹${amount} Refund = ₹${amount} Wallet + ₹${0} Bonus`,
                // value: "",
              },
              Amount: amount,
              Balance: {
                type: `${trackdata[index].depositCash}(D)`,
                value: `${trackdata[index].withdrawableCash}(W)`,
              },
            };
            playerAccountData.push(obj);
          } /*  else if (descriptionType[0] == "Auto Rebuy to Points") {
            let amount = commonClass.RoundInt(trackdata[index].c, 2);
            logger.info('---amount-----2------->', amount);
            obj = {
              Date: newDate,
              Description: {
                type: `Leave ${trackdata[index].gameType} Table #${trackdata[index].tjid}`,
                value: `₹${amount} Refund = ₹${amount} Wallet + ₹${0} Bonus`,
                // value: "",
              },
              Amount: amount,
              Balance: {
                type: `${trackdata[index].depositCash}(D)`,
                value: `${trackdata[index].withdrawableCash}(W)`,
              },
            };
            playerAccountData.push(obj);
          } */ else {
            let amount = lastItem.Amount + trackdata[index].c;
            amount = commonClass.RoundInt(amount, 2);
            // logger.info('---amount----2------>', amount);

            let findSignBonus = lastItem.Description.value
              .split("+")
              .map((item) => item.trim());
            findSignBonus = findSignBonus[1]
              .replace("₹", "")
              .replace("Bonus", "");
            wallet = amount - findSignBonus;
            wallet = commonClass.RoundInt(wallet, 2);
            trackdata[index].depositCash = commonClass.RoundInt(
              trackdata[index].depositCash,
              2
            );

            obj = {
              Date: newDate,
              Description: {
                type: lastItem.Description.type,
                value: `₹${amount} Refund = ₹${wallet} Wallet + ₹${findSignBonus} Bonus`,
              },
              Amount: amount,
              Balance: {
                type: `${trackdata[index].depositCash}(D)`,
                value: `${trackdata[index].withdrawableCash}(W)`,
              },
            };
            playerAccountData.splice(length, 1, obj);
          }
        } else {
          let amount = commonClass.RoundInt(trackdata[index].c, 2);
          obj = {
            Date: newDate,
            Description: {
              type: `Leave ${trackdata[index].gameType} Table #${trackdata[index].tjid}`,
              // value: `₹${amount} Refund = ₹${wallet} Wallet + ₹${findSignBonus} Bonus`,
              value: "",
            },
            Amount: amount,
            Balance: {
              type: `${trackdata[index].depositCash}(D)`,
              value: `${trackdata[index].withdrawableCash}(W)`,
            },
          };
          playerAccountData.push(obj);
        }
      } else if (trackdata[index].tp == "FreeCash Added") {
        trackdata[index].depositCash = commonClass.RoundInt(
          trackdata[index].depositCash,
          2
        );
        obj = {
          Date: newDate,
          Description: {
            type: "FreeCash Added",
            value: "",
          },
          Amount: trackdata[index].c,
          Balance: {
            type: `${trackdata[index].depositCash}(D)`,
            value: `${trackdata[index].withdrawableCash}(W)`,
          },
        };
        playerAccountData.push(obj);
      } else if (trackdata[index].tp == "Cash Added") {
        trackdata[index].depositCash = commonClass.RoundInt(
          trackdata[index].depositCash,
          2
        );
        obj = {
          Date: newDate,
          Description: {
            type: "Cash Added",
            value: "",
          },
          Amount: trackdata[index].c,
          Balance: {
            type: `${trackdata[index].depositCash}(D)`,
            value: `${trackdata[index].withdrawableCash}(W)`,
          },
        };
        playerAccountData.push(obj);
      } else if (trackdata[index].tp == "Withdraw request added") {
        trackdata[index].depositCash = commonClass.RoundInt(
          trackdata[index].depositCash,
          2
        );
        obj = {
          Date: newDate,
          Description: {
            type: `Withdraw request added`,
            value: "",
          },
          Amount: trackdata[index].c,
          Balance: {
            type: `${trackdata[index].depositCash}(D)`,
            value: `${trackdata[index].withdrawableCash}(W)`,
          },
        };
        playerAccountData.push(obj);
      } else if (trackdata[index].tp == "Admin Cash Added") {
        trackdata[index].depositCash = commonClass.RoundInt(
          trackdata[index].depositCash,
          2
        );
        obj = {
          Date: newDate,
          Description: {
            type: "Admin Cash Added",
            value: "",
          },
          Amount: trackdata[index].c,
          Balance: {
            type: `${trackdata[index].depositCash}(D)`,
            value: `${trackdata[index].withdrawableCash}(W)`,
          },
        };
        playerAccountData.push(obj);
      } else if (trackdata[index].tp == "Withdraw request rejected") {
        trackdata[index].depositCash = commonClass.RoundInt(
          trackdata[index].depositCash,
          2
        );
        obj = {
          Date: newDate,
          Description: {
            type: `Withdraw request rejected`,
            value: "",
          },
          Amount: trackdata[index].c,
          Balance: {
            type: `${trackdata[index].depositCash}(D)`,
            value: `${trackdata[index].withdrawableCash}(W)`,
          },
        };
        playerAccountData.push(obj);
      } else if (
        trackdata[index].tp == "Admin Cash Removed" ||
        trackdata[index].tp == "Admin Winning Removed"
      ) {
        trackdata[index].depositCash = commonClass.RoundInt(
          trackdata[index].depositCash,
          2
        );
        obj = {
          Date: newDate,
          Description: {
            type: `Admin cash removed`,
            value: "",
          },
          Amount: trackdata[index].c,
          Balance: {
            type: `${trackdata[index].depositCash}(D)`,
            value: `${trackdata[index].withdrawableCash}(W)`,
          },
        };
        playerAccountData.push(obj);
      }
    }
    playerAccountData.reverse();
    playerAccountData = playerAccountData.slice(0, 25);

    return res.status(200).send({
      success: true,
      errorCode: "0000",
      Type: "Response",
      message: "Account statment",
      data: playerAccountData,
    });
  } catch (error) {
    logger.info("error------->", error);
    getInfo.exceptionError(error);
    return res.status(400).send({ success: false, error: error.message });
  }
});

//KYC documents
//create contact for RazorpayX
async function createContact(userDetails) {
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
async function createFundAccount(userAccountDetails, razorpayContact) {
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
router.get("/get-kyc", authenticateJWT, async (req, res) => {
  try {
    const { userId } = req.user;
    const { BLOCK_STATE } = GetConfig();
    const user = await db
      .collection("game_users")
      .findOne({ _id: getInfo.MongoID(userId) });
    if (!user) {
      return res.status(404).send({
        success: false,
        errorCode: "1069",
        Type: "Response",
        message: "User Not Found",
      });
    }

    const payload = await db
      .collection("user_details")
      .find({ userId: getInfo.MongoID(userId) })
      .sort({ create_date: -1 })
      .toArray();
    const limit = 1;
    var count1 = 0;
    var count2 = 0;
    let BankDetail = [],
      UpiDetail = [],
      panDetails = [];
    if (payload) {
      for (const element of payload) {
        if (element.docType == "BANK") {
          if (limit > count1) {
            BankDetail.push(element);
            count1++;
          }
        } else if (element.docType == "UPI") {
          if (limit > count2) {
            UpiDetail.push(element);
            count2++;
          }
        } else if (element.docType == "PAN") {
          panDetails.push(element);
        }
      }
    } else {
      BankDetail = [];
      UpiDetail = [];
      panDetails = [];
    }
    const bannedState = `I hear by declare that my UPI account is not based out of ${BLOCK_STATE}.`;
    return res.status(200).send({
      success: true,
      errorCode: "0000",
      Type: "Response",
      message: "Data delivered successfully",
      data: {
        BankDetail: BankDetail,
        UpiDetail: UpiDetail,
        panDetails: panDetails,
        notFromBannedState: bannedState,
      },
    });
  } catch (error) {
    getInfo.exceptionError(error);
    return res.status(400).send({ success: false, error: error.message });
  }
});

const PanUpload = multer({ storage: storageFiles });
router.post(
  "/pan-image-verify",
  authenticateJWT,
  // PanUpload.single("file"),
  async (req, res) => {
    try {
      const { IMAGE_UPLOAD_LIMITS = 15, BUCKET_URL } = GetConfig();

      if (!req.files || Object.keys(req.files).length === 0) {
        return res.status(200).json({
          success: false,
          errorCode: "0000",
          Type: "Response",
          message: 'No files uploaded.'
        });
      }

      const { file } = req.files;

      // Check file size
      if (file.size > IMAGE_UPLOAD_LIMITS * 1024 * 1024) {
        return res.status(200).json({
          success: false,
          errorCode: "0000",
          Type: "Response",
          message: 'File size exceeds the limit.'
        });
      }

      const { userId } = req.user;
      const user = await db.collection("game_users").findOne({
        _id: getInfo.MongoID(userId),
      });

      if (!user) {
        // removeFile(req.file.path);
        return res.status(404).send({
          success: false,
          errorCode: "1069",
          Type: "Response",
          message: "User Not Found",
        });
      }

      //find-pan details
      const payload = await db
        .collection("user_details")
        .findOne({ userId: getInfo.MongoID(userId), docType: "PAN" });
      if (payload) {
        // removeFile(req.file.path);
        return res.status(200).send({
          success: false,
          errorCode: "0000",
          Type: "Response",
          message: "PAN details already added",
          payload: {
            data: payload,
          },
        });
      }
      // logger.info('--req.file---------->', req.file);
      const panImageCopress = imageCompress(file.data);
      const panImage = await fileUpload({
        // fileContent: await imageCompress(req.file.buffer),
        fileContent: await panImageCopress,
        folderCategoryLocation: "pan_images",
        fileCategoryName: "PAN",
        uniqueId: userId,
        folderType: "images",
        extension: "png",
        contentType: "image/png",
      });
      // const panImageLocation = panImage.Location;
      const panImageLocation =
        process.env.environment == "staging"
          ? `${panImage.Location}`
          : `${BUCKET_URL}${panImage.Key}`;
      const panImageLocation1 = panImage.Location;
      logger.info("panImageLocation--------->", panImageLocation);
      logger.info("panImageLocation1--------->", panImageLocation1);
      // removeFile(req.file.path);
      // const group_id = getInfo.MongoID();
      const group_id = user.unique_id;
      //removeFile(req.file.path);
      //1. image validation
      const imageResponse = await axios({
        method: "post",
        url: "https://eve.idfy.com/v3/tasks/sync/validate/document",
        headers: {
          "Content-Type": "application/json",
          "account-id": idfyAccountId,
          "api-key": idfyKey,
        },
        data: JSON.stringify({
          task_id: userId,
          group_id: group_id,
          data: {
            document1: panImageLocation,
            doc_type: "ind_pan",
          },
        }),
      })
        .then(function (response) {
          return response.data;
        })
        .catch(function (error) {
          return error.response.data;
        });
      logger.info("imageResponse------->", imageResponse);
      if (imageResponse.status == "failed") {
        return res.status(200).send({
          success: false,
          errorCode: "0000",
          Type: "Response",
          message:
            "Invalid document uploaded. Please re-upload Pan and try again.",
          payload: "",
        });
      }
      if (imageResponse.result.detected_doc_type != "ind_pan" && imageResponse.result.detected_doc_type != true) {
        return res.status(200).send({
          success: false,
          errorCode: "0000",
          Type: "Response",
          message:
            "Invalid document uploaded. Please re-upload Pan and try again.",
          payload: "",
        });
      }

      //2.ocr
      const ocrResponse = await axios({
        method: "post",
        url: "https://eve.idfy.com/v3/tasks/sync/extract/ind_pan",
        headers: {
          "Content-Type": "application/json",
          "account-id": idfyAccountId,
          "api-key": idfyKey,
        },
        data: JSON.stringify({
          task_id: userId,
          group_id: group_id,
          data: {
            document1: panImageLocation,
          },
        }),
      })
        .then(function (response) {
          return response.data;
        })
        .catch(function (error) {
          return error.response.data;
        });
      logger.info("ocrResponse------>", ocrResponse);
      if (ocrResponse.status == "failed") {
        return res.status(200).send({
          success: false,
          errorCode: "0000",
          Type: "Response",
          message: ocrResponse.message,
          payload: "",
        });
      }

      const { extraction_output } = ocrResponse.result;
      logger.info("group_id---1------>", group_id);
      if (!extraction_output.pan_type || extraction_output.id_number == "" || isNull(extraction_output.minor) || extraction_output.name_on_card == "") {
        return res.status(200).send({
          success: false,
          errorCode: "0000",
          Type: "Response",
          message:
            "Invalid document uploaded. Please re-upload Pan and try again.",
          payload: "",
        });
      }


      if (
        extraction_output.pan_type != "Individual" ||
        extraction_output.minor
      ) {
        return res.status(200).send({
          success: false,
          errorCode: "0000",
          Type: "Response",
          message: extraction_output.minor
            ? "Uploaded PAN belongs to a minor. Please re-upload PAN and try again."
            : "Uploaded PAN is not an Individual Pan Card. Please re-upload PAN and try again.",
          data: "",
        });
      }

      const panData = await db.collection("user_details").findOne({
        docType: "PAN",
        panNumber: extraction_output.id_number,
        status: "SUCCESS",
      });

      if (panData) {
        return res.status(200).send({
          success: false,
          errorCode: "0000",
          Type: "Response",
          message:
            "Uploaded PAN is already linked to another user. Please re-upload PAN and try again.",
          data: "",
        });
      }

      // await db.collection("user_details").insertOne({
      //   userId: getInfo.MongoID(userId),
      //   docType: "PAN",
      //   panNumber: extraction_output.id_number,
      //   registered_name: extraction_output.name_on_card,
      //   dob: extraction_output.date_of_birth,
      //   status: "PENDING",
      //   group_id: group_id,
      //   panImage: panImageLocation,
      //   pan_type: extraction_output.pan_type,
      //   // father_name: extraction_output.fathers_name,
      //   create_date: new Date(),
      // });
      // logger.info("extraction_output------------>", extraction_output);
      let ocrObj = {
        userId: getInfo.MongoID(userId),
        docType: "PAN",
        panNumber: extraction_output.id_number,
        registered_name: extraction_output.name_on_card,
        dob: extraction_output.date_of_birth,
        status: "PENDING",
        group_id: group_id,
        panImage: panImageLocation,
        pan_type: extraction_output.pan_type,
        // father_name: extraction_output.fathers_name,
        create_date: new Date(),
      };
      const redisInstances = getRedisInstances();
      const ivt = await redisInstances.SET(
        "OCR:USER:" + userId,
        JSON.stringify(ocrObj),
        { EX: 1440, NX: true }
      );
      logger.info("ibt-------->", ivt);
      return res.status(200).send({
        success: true,
        errorCode: "0000",
        Type: "Response",
        message: "Valid document",
        payload: {
          panImage: panImageLocation,
          panImageLocation1: panImageLocation1,
          data: extraction_output,
        },
      });
    } catch (error) {
      logger.info("error-----PAN-IMAGE-VERIFY--------->", error);
      getInfo.exceptionError(error);
      return res.status(400).send({ success: false, error: error });
    }
  }
);

router.post("/edit-pan", authenticateJWT, async (req, res) => {
  try {
    const { userId } = req.user;
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

    req.body = covertStringToObject(req.body);
    const { id_number } = req.body;
    logger.info("id_number---->", id_number, "----userId---->", userId);
    let panDetails = await getRedis("OCR:USER:" + userId);
    logger.info("panData-------->", JSON.parse(panDetails));
    let panData = JSON.parse(panDetails);
    // const panData = await db.collection("user_details").findOne({
    //   userId: getInfo.MongoID(userId),
    //   docType: "PAN",
    //   status: "PENDING",
    // });

    if (!panData) {
      return res.status(404).send({
        success: false,
        errorCode: "0000",
        Type: "Response",
        message: "Invalid PAN details",
      });
    }

    // const updatePanDetails = await db.collection("user_details").findOneAndUpdate({
    //   userId: getInfo.MongoID(userId),
    //   docType: "PAN",
    //   status: "PENDING",
    // }, {
    //   $set: {
    //     panNumber: id_number
    //   }
    // }, { returnDocument: "after" });
    // logger.info('updatePanDetails----------->', updatePanDetails.value);
    logger.info("panData-----01--->", panData.panNumber);

    panData.panNumber = id_number;
    logger.info("panData-----1--->", typeof panData);

    const redisInstances = getRedisInstances();
    const ivt = await redisInstances.SET(
      "OCR:USER:" + userId,
      JSON.stringify(panData)
    );

    logger.info("ivt------------>", ivt);
    return res.status(200).send({
      success: true,
      errorCode: "0000",
      Type: "Response",
      message: "Update Pan Details",
      payload: panData,
    });
  } catch (error) {
    logger.info("error-----/edit-pan--------->", error);
    getInfo.exceptionError(error);
    return res.status(400).send({ success: false, error: error.message });
  }
});

router.post("/pan-validation", authenticateJWT, async (req, res) => {
  try {
    const { userId } = req.user;
    const { KYC_ATTEMP } = GetConfig();
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

    req.body = covertStringToObject(req.body);
    // redis get- id_number
    const { id_number } = req.body;
    logger.info("----/pan-validation------id_number---->", id_number);

    let panData = await getRedis("OCR:USER:" + userId);
    logger.info("panData-------->", JSON.parse(panData));
    panData = JSON.parse(panData);

    // const panData = await db.collection("user_details").findOne({
    //   userId: getInfo.MongoID(userId),
    //   docType: "PAN",
    //   status: "PENDING",
    //   panNumber: id_number,
    // });

    if (!panData) {
      return res.status(404).send({
        success: false,
        errorCode: "0000",
        Type: "Response",
        message: "Invalid PAN details",
      });
    }

    //if anyother user have same pan
    let multiplePan = await db
      .collection("user_details")
      .find({
        docType: "PAN",
        panNumber: id_number,
      })
      .toArray();

    for (const iterator of multiplePan) {
      logger.info("user._id---->", user._id);
      if (String(user._id) != String(iterator.userId)) {
        await db.collection("user_details").deleteOne({
          _id: panData._id,
          userId: getInfo.MongoID(user._id),
        });

        return res.status(404).send({
          success: false,
          errorCode: "0000",
          Type: "Response",
          message:
            "Uploaded PAN is already linked to another user. Please re-upload PAN and try again.",
          data: "",
        });
      }
    }
    /**************MAX API COUNT IN PAN VALIDATION***** */
    if (user.pan_kyc_count >= 1) {
      const addAPICount = await db
        .collection("game_users")
        .updateOne(
          { unique_id: user.unique_id },
          { $inc: { pan_kyc_count: 1 } }
        );
    } else if (user.pan_kyc_count >= KYC_ATTEMP) {
      console.log(baseResponse.TO_MANY_ATTEMPTED);
      return res.status(200).send({
        success: false,
        errorCode: "0000",
        Type: "Response",
        message: baseResponse.TO_MANY_ATTEMPTED,
      });
    } else {
      const addAPICount = await db
        .collection("game_users")
        .updateOne(
          { unique_id: user.unique_id },
          { $set: { pan_kyc_count: 1 } }
        );
    }

    /*****************eND ******************************/

    /*****************eND ******************************/
    //3. pan validation
    const reqIDResponse = await axios({
      method: "post",
      url: "https://eve.idfy.com/v3/tasks/async/verify_with_source/ind_pan",
      headers: {
        "Content-Type": "application/json",
        "account-id": idfyAccountId,
        "api-key": idfyKey,
      },
      data: JSON.stringify({
        task_id: userId,
        group_id: panData.group_id,
        data: {
          id_number: id_number,
        },
      }),
    })
      .then(function (response) {
        return response.data;
      })
      .catch(function (error) {
        return error.response.data;
      });

    //4. Get Task
    logger.info("reqIDResponse----------->", reqIDResponse);
    const request_id = reqIDResponse.request_id;

    let configAxios = {
      method: "get",
      url: `https://eve.idfy.com/v3/tasks?request_id=${request_id}`,
      headers: {
        "api-key": idfyKey,
        "Content-Type": "application/json",
        "account-id": idfyAccountId,
      },
    };

    const { KYC_TIMER } = GetConfig();

    // await timeout(3000);
    const UpdateStatus = {
      timer: KYC_TIMER,
      request_id: request_id,
    };
    //await timeout(10000);
    //addressProofQueueClass.UpdateUPIAndUPIToQueue(UpdateStatus);

    const validationResponse = await axios(configAxios)
      .then(function (response) {
        return response.data;
      })
      .catch(function (error) {
        return error;
      });
    logger.info("validationResponse===------->", validationResponse);

    let updatedata = panData;
    updatedata.userId = getInfo.MongoID(updatedata.userId);
    updatedata.create_date = new Date(updatedata.create_date);
    updatedata.panNumber = id_number;
    logger.info("updatedata------------>", updatedata);
    if (validationResponse[0]?.status == "in_progress") {
      updatedata.status = validationResponse[0].status;
      updatedata.request_id = request_id;
    } else if (validationResponse[0]?.status == "completed") {
      if (validationResponse[0].result.source_output.status == "id_not_found") {
        // delete user entry in db
        /*  await db.collection("user_details").findOneAndDelete({
           userId: getInfo.MongoID(panData.userId),
           docType: "PAN",
           panNumber: id_number
         }); */
        const redisInstances = getRedisInstances();
        const ivt = await redisInstances.DEL("OCR:USER:" + userId);
        logger.info("ivt--------->", ivt);
      } else {
        await db.collection("game_users").updateOne(
          { _id: getInfo.MongoID(userId) },
          {
            $set: {
              PanVerify: true,
            },
          },
          { upsert: true }
        );
        updatedata.status = "SUCCESS";
        updatedata.docType = "PAN";
        updatedata.request_id = request_id;
        updatedata.panNumber =
          validationResponse[0].result.source_output.id_number;
        updatedata.registered_name =
          validationResponse[0].result.source_output.name_on_card;
        updatedata.group_id = getInfo.MongoID(validationResponse[0].group_id);
      }
    }
    logger.info("updatedata---1--------->", updatedata);

    await db.collection("user_details").findOneAndUpdate(
      {
        userId: getInfo.MongoID(userId),
        docType: "PAN",
        panNumber: id_number,
      },
      {
        $set: updatedata,
      },
      { new: true, upsert: true }
    );
    // await db.collection("user_details").insertOne(updatedata);

    return res.status(200).send({
      success: true,
      errorCode: "0000",
      Type: "Response",
      message: "Your PAN Verifiacation In Progress",
      data: validationResponse[0],
    });
  } catch (error) {
    logger.info("error-----PAN-VALIDATION--------->", error);
    getInfo.exceptionError(error);
    return res.status(400).send({ success: false, error: error.message });
  }
});

router.get("/pan-verification-webhook", async (req, res) => {
  try {
    logger.info("---pan-webhook--get--body--->", req.body);
    const panData = await db.collection("user_details").findOne({
      // panNumber: req.body.result.source_output.id_number,
      userId: getInfo.MongoID(req.body.task_id),
      // request_id: req.body.request_id,
      group_id: req.body.group_id,
      docType: "PAN",
    });
    logger.info("panData---webhook------>", panData);

    if (panData) {
      if (req.body.status == "completed") {
        const redisInstances = getRedisInstances();
        const ivt = await redisInstances.DEL("OCR:USER:" + req.body.task_id);
        logger.info("ivt--------->", ivt);
        if (req.body.result.source_output.status == "id_not_found") {
          // delete user entry in db
          await db.collection("user_details").findOneAndDelete({
            userId: getInfo.MongoID(panData.userId),
            docType: "PAN",
            request_id: req.body.request_id,
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
          logger.info(
            "req.body.result.source_output.status",
            req.body.result.source_output
          );
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
            },
            {
              $set: {
                status: "SUCCESS",
                docType: "PAN",
                panNumber: req.body.result.source_output.id_number,
                registered_name: req.body.result.source_output.name_on_card,
              },
            }
          );
        }
      }
    }
  } catch (error) {
    logger.info("error------pan-webhook--get--body---------->", error);
    getInfo.exceptionError(error);
  } finally {
    return res.status(200).send({ success: true });
  }
});

router.post("/pan-verification-webhook", async (req, res) => {
  logger.info("---pan-webhook--post--body--->", req.body);
  try {
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
  } finally {
    return res.status(200).send({ success: true });
  }
});

router.post("/pan-status", authenticateJWT, async (req, res) => {
  try {
    const { userId } = req.user;
    req.body = covertStringToObject(req.body);
    const { id_number } = req.body;

    logger.info("userId---------->", userId);
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

    const panData = await db.collection("user_details").findOne({
      userId: getInfo.MongoID(userId),
      docType: "PAN",
      panNumber: id_number,
    });
    logger.info("panData--------->", panData);

    if (panData.status == "FAILED") {
      await db.collection("user_details").deleteOne({
        _id: panData._id,
        userId: getInfo.MongoID(userId),
        docType: "PAN",
        panNumber: id_number,
      });

      return res.status(200).send({
        success: false,
        errorCode: "0000",
        Type: "Response",
        message: "Pan Verification failed",
        data: panData,
      });
    } else if (panData.status == "in_progress") {
      return res.status(200).send({
        success: false,
        errorCode: "0000",
        Type: "Response",
        message: "Your PAN Verifiacation In Progress",
        data: panData,
      });
    } else if (panData.status == "SUCCESS") {
      //send success mail
      logger.info("user.ue----------->", user.ue);
      if (user.ue != "") {
        sendMail(user.ue, "Pan Verification", "../views/pan_success.html");
      }

      return res.status(200).send({
        success: true,
        errorCode: "0000",
        Type: "Response",
        message: "Your PAN has been verified successfully",
        data: panData,
      });
    }
  } catch (error) {
    logger.info("error------------->", error);
    getInfo.exceptionError(error);
    return res.status(400).send({ success: false, error: error.message });
  }
});

//BANK VALIDATION API
router.post(
  "/bank-validation",
  authenticateJWT,
  // BankUpload.single("file"),
  async (req, res) => {
    try {
      const { userId } = req.user;
      const { KYC_ATTEMP } = GetConfig();
      const user = await db.collection("game_users").findOne({
        _id: getInfo.MongoID(userId),
      });

      if (!user) {
        ////removeFile(req.file.path);
        return res.status(404).send({
          success: false,
          errorCode: "1069",
          Type: "Response",
          message: baseResponse.USER_NOT_FOUND,
        });
      }
      //ADDED KYC API COUN IN THE USER PROFILE
      if (user.bank_kyc_count >= 1 && user.bank_kyc_count < KYC_ATTEMP) {
        const addAPICount = await db
          .collection("game_users")
          .updateOne(
            { unique_id: user.unique_id },
            { $inc: { bank_kyc_count: 1 } }
          );
      } else if (user.bank_kyc_count >= KYC_ATTEMP) {
        logger.info(baseResponse.TO_MANY_ATTEMPTED);
        ////removeFile(req.file.path);
        return res.status(200).send({
          success: false,
          errorCode: "0000",
          Type: "Response",
          message: baseResponse.TO_MANY_ATTEMPTED,
        });
      } else {
        const addAPICount = await db
          .collection("game_users")
          .updateOne(
            { unique_id: user.unique_id },
            { $set: { bank_kyc_count: 1 } }
          );
      }

      const { account_holder_name, accountNumber, ifsc } = covertStringToObject(
        req.body
      );

      // find user pan details
      const panPayload = await db
        .collection("user_details")
        .findOne({ userId: getInfo.MongoID(userId), docType: "PAN" });

      if (!panPayload || panPayload.status != "SUCCESS") {
        //removeFile(req.file.path);
        return res.status(200).send({
          success: false,
          errorCode: "0000",
          Type: "Response",
          message: baseResponse.PAN_SUMIT_INFO,
        });
      }
      const ApprovedBank = await db.collection("user_details").findOne({
        docType: "BANK",
        userId: getInfo.MongoID(userId),
        status: "SUCCESS",
      });
      if (ApprovedBank) {
        ////removeFile(req.file.path);
        return res.status(200).send({
          success: false,
          errorCode: "0000",
          Type: "Response",
          message: baseResponse.ACCOUNT_APPROVED,
        });
      }
      const pendingBank = await db.collection("user_details").findOne({
        docType: "BANK",
        userId: getInfo.MongoID(userId),
        status: "PENDING",
      });
      if (pendingBank) {
        // //removeFile(req.file.path);
        return res.status(200).send({
          success: false,
          errorCode: "0000",
          Type: "Response",
          message: baseResponse.ACCOUNT_AT_PENDING,
        });
      }

      //find-bank details
      const payload = await db
        .collection("user_details")
        .find({ docType: "BANK" })
        .toArray();

      for (const element of payload) {
        if (
          element.accountNumber == accountNumber &&
          element.ifsc == ifsc &&
          /* element.status == "SUCCESS" && */
          element.userId == userId
        ) {
          // if (element.status == "REJECTED")
          return res.status(200).send({
            success: false,
            errorCode: "0000",
            Type: "Response",
            message: baseResponse.BANK_DETAILS_ALREADY_EXIT,
            payload: {
              bankDetails: element,
            },
          });
          // }
          // if (element.status == "REJECTED")
          //   return res.status(200).send({
          //     success: false,
          //     errorCode: "0000",
          //     Type: "Response",
          //     message: baseResponse.BANK_DETAILS_ALREADY_EXIT,
          //     payload: {
          //       bankDetails: element,
          //     },
          //   });
        } else if (
          element.accountNumber == accountNumber &&
          element.ifsc == ifsc &&
          element.status == "SUCCESS"
        ) {
          return res.status(200).send({
            success: false,
            errorCode: "0000",
            Type: "Response",
            message: baseResponse.BANK_DETAILS_ALREADY_EXIT_2,
            payload: {
              bankDetails: "",
            },
          });
        }
      }
      let APIresponse = await bankValidationRest(user,accountNumber,ifsc,panPayload.registered_name)
      let APIresponseData = APIresponse.data.data;
      
      if(!APIresponse.data.data){
        APIresponseData = APIresponse.data
      }
      //CHECK the api response getting from the subex IDC
      if (APIresponseData.status == "success") {
        const details = await db.collection("user_details").insertOne({
          userId: getInfo.MongoID(userId),
          docType: "BANK",
          accountNumber: accountNumber,
          ifsc: ifsc,
          status: APIresponseData.data.upistatus,
          //bankImage: bankImageLocation.Location,
          account_holder_name: APIresponseData.name_at_bank,
          score: APIresponseData.data.match_score || 0,
          create_date: new Date(),
          penny_status: APIresponse.data.penny_status,
        });
        if (APIresponseData.data.upistatus == "REJECTED") {
          return res.status(200).send({
            success: false,
            errorCode: "0000",
            Type: "Response",
            message: baseResponse.ACCOUNT_NOT_MATCH,
            payload: {
              bankDetails: "",
            },
          });
        }
        if (APIresponseData.data.upistatus == "SUCCESS") {
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
          const createFundAccountData = await createFundAccount(
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

          return res.status(200).send({
            success: true,
            errorCode: "0000",
            Type: "Response",
            message: baseResponse.BANK_ADDED,
            payload: {
              bankDetails: details.ops[0],
            },
          });
        } else if (APIresponseData.data.upistatus == "PENDING") {
          return res.status(200).send({
            success: true,
            errorCode: "0000",
            Type: "Response",
            message: baseResponse.ACCOUNT_REVIEW,
            payload: {
              bankDetails: details.ops[0],
            },
          });
        } else {
          return res.status(200).send({
            success: false,
            errorCode: "0000",
            Type: "Response",
            message: baseResponse.ACCOUNT_NOT_MATCH,
            payload: {
              bankDetails: "",
            },
          });
        }
      } else {
        if (!APIresponseData.status && APIresponse.status_code != 500) {
          //save the data when API crash and not able check bank details
          //save for further check
          if(!APIresponseData.status){
            bankstatus="REJECTED"
            return res.status(200).send({
              success: false,
              errorCode: "0000",
              Type: "Response",
              message: APIresponseData.message,
              payload: {
                bankDetails: "",
              },
            });
          }
          const details = await db.collection("user_details").insertOne({
            userId: getInfo.MongoID(userId),
            docType: "BANK",
            accountNumber: accountNumber,
            ifsc: ifsc,
            status: bankstatus,
            //bankImage: bankImageLocation.Location,
            account_holder_name: ''||'',
            error_remark: APIresponse.api || "unknow error occured in third party IDC API ",
            error_error: APIresponseData.error || "unknow error occured in third party IDC API or IDFY",
            error_message: APIresponseData.message || "unknow error occured in third party IDC API or IDFY",
            create_date: new Date(),
          });
          return res.status(200).send({
            success: true,
            errorCode: "0000",
            Type: "Response",
            message: baseResponse.ACCOUNT_REVIEW,
            payload: {
              bankDetails: details.ops[0],
            },
          });
        } else {
          return res.status(200).send({
            success: false,
            errorCode: "0000",
            Type: "Response",
            message: APIresponse.message,
          });
        }
      }
    } catch (error) {
      logger.info("error-----bank-validation--------->", error);
      logger.info("error-----bank-validation--------->>", error);
      getInfo.exceptionError(error);
      return res.status(400).send({ success: false, error: error });
    }
  }
);



router.post("/upi-validation", authenticateJWT, async (req, res) => {
  try {
    const { KYC_ATTEMP } = GetConfig();
    const { userId } = req.user;
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
    // req.body = req.body.data;
    logger.info(
      "req.body---/upi-validation------>",
      req.body,
      "req.body---1------>",
      req.body.data
    );
    const { upiId } = covertStringToObject(req.body);
    logger.info("upiId================>", upiId);

    // find user pan details
    const panPayload = await db
      .collection("user_details")
      .findOne({ userId: getInfo.MongoID(userId), docType: "PAN" });

    if (!panPayload || panPayload.status != "SUCCESS") {
      return res.status(200).send({
        success: false,
        errorCode: "0000",
        Type: "Response",
        message: baseResponse.PAN_SUMIT_INFO,
      });
    }
    const ApprovedUPI = await db.collection("user_details").findOne({
      docType: "UPI",
      userId: getInfo.MongoID(userId),
      status: "SUCCESS",
    });
    if (ApprovedUPI) {
      return res.status(200).send({
        success: false,
        errorCode: "0000",
        Type: "Response",
        message: baseResponse.ACCOUNT_APPROVED,
      });
    }
    const pendingBank = await db.collection("user_details").findOne({
      docType: "UPI",
      userId: getInfo.MongoID(userId),
      status: "PENDING",
    });
    if (pendingBank) {
      return res.status(200).send({
        success: false,
        errorCode: "0000",
        Type: "Response",
        message: baseResponse.ACCOUNT_AT_PENDING,
      });
    }
    //ADDED KYC API COUN IN THE USER PROFILE
    if (user.upi_kyc_count >= 1) {
      const addAPICount = await db
        .collection("game_users")
        .updateOne(
          { unique_id: user.unique_id },
          { $inc: { upi_kyc_count: 1 } }
        );
    } else if (user.upi_kyc_count >= KYC_ATTEMP) {
      logger.info(baseResponse.TO_MANY_ATTEMPTED);
      return res.status(200).send({
        success: false,
        errorCode: "0000",
        Type: "Response",
        message: baseResponse.TO_MANY_ATTEMPTED,
      });
    } else {
      const addAPICount = await db
        .collection("game_users")
        .updateOne(
          { unique_id: user.unique_id },
          { $set: { upi_kyc_count: 1 } }
        );
    }
    //find-upi details
    const payload = await db
      .collection("user_details")
      .find({ userId: getInfo.MongoID(userId), docType: "UPI" })
      .toArray();

    for (const element of payload) {
      if (element.upiId == upiId && element.status == "SUCCESS") {
        logger.info("element----------->", element);
        return res.status(200).send({
          success: false,
          errorCode: "0000",
          Type: "Response",
          message: "Upi details already added",
          payload: {
            upiDetails: element,
          },
        });
      }
    }
    //validate the Upi Id fiest
    
    let verifyUpi = await verifyUPI(upiId, panPayload.registered_name, user);
    if (verifyUpi.status) {
      const details = await db.collection("user_details").insertOne({
        userId: getInfo.MongoID(userId),
        docType: "UPI",
        upiId: upiId,
        status: "PENDING",
        request_id: verifyUpi.request_id,
        create_date: new Date(),
      });
      return res.status(200).send({
        success: true,
        errorCode: "0000",
        Type: "Response",
        message: verifyUpi.message,
        payload: {
          upiDetails: details.ops[0],
        },
      });
      
    } else {
      const details = await db.collection("user_details").insertOne({
          userId: getInfo.MongoID(userId),
          docType: "UPI",
          upiId: upiId,
          status: "PENDING",
          request_id: verifyUpi.request_id||"",
          create_date: new Date(),
        });
        return res.status(400).send({
          success: false,
          errorCode: "0000",
          Type: "Response",
          message: verifyUpi.api,payload: {
            upiDetails: details.ops[0],
          }
        });
    }
  } catch (error) {
    logger.info("error---------UPI---------->", error);
    getInfo.exceptionError(error);
    return res.status(400).send({ success: false, error: error });
  }
});

router.post("/upi-verification-webhook", async (req, res) => {
  logger.info("---upi-webhook--post--body--->", req.body);
  try {
    const upiData = await db.collection("user_details").findOne({
      // panNumber: req.body.result.source_output.id_number,
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
            sendMail(user.ue, "Pan Verification", "../views/pan_success.html");
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
  } catch (error) {
    logger.info("error------pan-webhook--post--body---------->", error);
    getInfo.exceptionError(error);
  } finally {
    return res.status(200).send({ success: true });
  }
});

//TDS

// router.get("/tds", authenticateJWT, async (req, res) => {
//   try {
//     const { userId } = req.user;
//     const user = await db.collection("game_users").findOne({
//       _id: getInfo.MongoID(userId),
//     });
//     if (!user) {
//       return res.status(404).send({
//         success: false,
//         errorCode: "1069",
//         Type: "Response",
//         message: "User Not Found",
//       });
//     }
//     const Email = user.ue;
//     const EmailVerify = user.EmailVerify;

//     //only cash mode
//     const TdsCashData = await db
//       .collection("tds_track")
//       .find({ winid: getInfo.MongoID(userId) })
//       .sort({ _id: -1 })
//       .toArray();
//     let TdsData = [];

//     for (let index = 0; index < TdsCashData.length; index++) {
//       const newDate = moment
//         .utc(new Date(TdsCashData[index].cd).toString())
//         .add({ hours: 5, minutes: 30 })
//         .format("MMM D, h:mm a");

//       const obj = {
//         Description: {
//           type: `Amount Taken to ${TdsCashData[index].gt} Table #${TdsCashData[index].tjid}`,
//           value: "",
//         },
//         Date: newDate,
//         Status: "",
//         "TDS Amount": TdsCashData[index].tds,
//       };
//       TdsData.push(obj);
//     }
//     //tds date CMS
//     // const findDate = "15th of November 2022";
//     // const TextData = `TDS certificate will be generated on ${findDate}.`;
//     const TextData = "";

//     return res.status(200).send({
//       success: true,
//       errorCode: "0000",
//       Type: "Response",
//       message: "TDS details",
//       data: { Email, EmailVerify, TdsData, TextData },
//     });
//   } catch (error) {
//     logger.info("error------->", error);
//     return res.status(400).send({ success: false, error: error.message });
//   }
// });

router.get("/tds", authenticateJWT, async (req, res) => {
  try {
    const { userId } = req.user;
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
    const Email = user.ue;
    const EmailVerify = user.EmailVerify;

    //only cash mode
    const TdsCashData = await db
      .collection("New_tds_track")
      .find({ userId: getInfo.MongoID(userId), status: "SUCCESS" })
      .sort({ _id: -1 })
      .toArray();
    let TdsData = [];
    for (const element of TdsCashData) {
      const newDate = moment(new Date(element.cd))
        .add({ hours: 5, minutes: 30 })
        .format("MMM D, h:mm a");
      // const newDate = moment.utc(new Date(element.date)).format("MMM D, h:m a");
      const obj = {
        Description: {
          //type: `Amount Taken to ${element.gt} Table #${element.tjid}`,
          type: `withdraw request Amount ${element.request_amount} `,
          value: "",
        },
        Date: newDate,
        Status: "",
        "TDS Amount": element.tdsOnAmount,
      };
      TdsData.push(obj);
    }

    //tds date CMS
    // const findDate = "15th of November 2022";
    // const TextData = `TDS certificate will be generated on ${findDate}.`;
    const TextData = "";

    return res.status(200).send({
      success: true,
      errorCode: "0000",
      Type: "Response",
      message: "TDS details",
      data: { Email, EmailVerify, TdsData, TextData },
    });
  } catch (error) {
    logger.info("error------->", error);
    getInfo.exceptionError(error);
    return res.status(400).send({ success: false, error: error.message });
  }
});

//Games summary

router.get("/yourGamePerformance", authenticateJWT, async (req, res) => {
  try {
    const { LAST_GAME_HISTORY } = GetConfig();
    const { userId } = req.user;
    logger.info("userId---------->", userId);
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
    let gameData = [];
    let query = {
      userId: getInfo.MongoID(userId),
      mode: "cash",
    };
    const userGameHistory = await db
      .collection("UserGameHistory")
      .find(query)
      .sort({ _id: -1 })
      .limit(LAST_GAME_HISTORY)
      .toArray();
    // total game play history

    for (const iterator of userGameHistory) {
      const GameHistotyData = iterator;
      let playerArr = [],
        rank;
      if (iterator.gameType == "Points") {
        GameHistotyData.playersList.forEach((element) => {
          let obj = {
            uid: element.uid,
            dps: element.dps,
          };
          playerArr.push(obj);
        });
      } else if (iterator.gameType == "Pool" || iterator.gameType == "Deal") {
        let data = iterator.tableHistory[iterator.tableHistory.length - 1];
        logger.info("data------------->", data.round);
        data.playersList.forEach((element) => {
          let obj = {
            uid: element.uid,
            dps: element.dps,
          };
          playerArr.push(obj);
        });
      }
      logger.info("playerArr---->", playerArr);
      playerArr.sort(function (a, b) {
        return parseFloat(a.dps) - parseFloat(b.dps);
      });

      for (const [i, element] of playerArr.entries()) {
        if (element.uid == userId) {
          rank = converter.toOrdinal(i + 1);
        }
      }
      logger.info("rank---------->", rank);
      const createDate = new Date(iterator.createdAt).toLocaleString("en-GB", {
        month: "long",
        day: "numeric",
      });

      let obj = {
        gameType: iterator.gameType,
        bootValue: iterator.bootValue,
        rank: `${rank} Position`,
        transactionId: iterator.transactionId,
        // tableId: `ID #${iterator.tableId}`,
        tableId: `ID #${iterator.tableGenerationId}`,
        date: createDate,
      };
      gameData.push(obj);
    }

    return res.status(200).send({
      success: true,
      errorCode: "0000",
      Type: "Response",
      message: "GamePerformance Details",
      data: gameData,
    });
  } catch (error) {
    logger.info("error------->", error);
    getInfo.exceptionError(error);
    return res.status(400).send({ success: false, error: error.message });
  }
});

router.post("/gamePerformanceScoreboard", authenticateJWT, async (req, res) => {
  try {
    const { userId } = req.user;
    const { LAST_GAME_HISTORY } = GetConfig();

    const user = await db.collection("game_users").findOne({
      _id: getInfo.MongoID(userId),
    });
    if (!user)
      return res.status(404).send({
        success: false,
        errorCode: "1069",
        Type: "Response",
        message: "User Not Found",
      });
    const { tableId, gameType, transactionId } = covertStringToObject(req.body);
    logger.info("tableId---------->", tableId);

    // let query = {
    //   userId: { $in: [getInfo.MongoID(userId)] },
    //   tableGenerationId: tableId,
    //   transactionId: transactionId,
    // };

    let projectData, query;

    if (gameType == "Pool" || gameType == "Deal") {
      query = {
        userId: { $in: [getInfo.MongoID(userId)] },
        tableGenerationId: tableId,
        // transactionId: transactionId,
      };

      projectData = {
        _id: 1,
        userId: 1,
        tableId: 1,
        bootValue: 1,
        pointValue: 1,
        mode: 1,
        tableGenerationId: 1,
        minimumSeats: 1,
        createdAt: 1,
        gameType: 1,
        "tableHistory.transactionId": 1,
        "tableHistory.round": 1,
        "tableHistory.playersList.uid": 1,
        "tableHistory.playersList.rndCount": 1,
        "tableHistory.playersList.si": 1,
        "tableHistory.playersList.un": 1,
        "tableHistory.playersList.indecl": 1,
        "tableHistory.playersList.s": 1,
        "tableHistory.playersList.ps": 1,
        "tableHistory.playersList.dps": 1,
        "tableHistory.playersList.tdps": 1,
        "tableHistory.playersList.tScore": 1,
        "tableHistory.playersList.pts": 1,
        "tableHistory.playersList.cards": 1,
        "tableHistory.playersList.gCards": 1,
        "tableHistory.playersList.dCards": 1,
        "tableHistory.playersList.wc": 1,
        "tableHistory.tableStatus": 1,
        "tableHistory.wildCard": 1,
        "tableHistory.winner": 1,
      };
    } else if (gameType == "Points") {
      query = {
        userId: { $in: [getInfo.MongoID(userId)] },
        tableGenerationId: tableId,
        transactionId: transactionId,
      };

      projectData = {
        _id: 1,
        userId: 1,
        tableId: 1,
        bootValue: 1,
        pointValue: 1,
        mode: 1,
        tableGenerationId: 1,
        minimumSeats: 1,
        gameType: 1,
        createdAt: 1,
        transactionId: 1,
        round: 1,
        "playersList.uid": 1,
        "playersList.si": 1,
        "playersList.un": 1,
        "playersList.indecl": 1,
        "playersList.s": 1,
        "playersList.ps": 1,
        "playersList.dps": 1,
        "playersList.tdps": 1,
        "playersList.tScore": 1,
        "playersList.pts": 1,
        "playersList.cards": 1,
        "playersList.gCards": 1,
        "playersList.dCards": 1,
        "playersList.wc": 1,
        tableStatus: 1,
        wildCard: 1,
        winner: 1,
      };
    }
    let userGameHistory = await db
      .collection("UserGameHistory")
      .find(query)
      .project(projectData)
      .sort({ _id: -1 })
      .limit(LAST_GAME_HISTORY)
      .toArray();

    let sortedHistory = [];
    for (const iterator of userGameHistory) {
      if (iterator.gameType == "Pool") {
        for (const element of iterator.tableHistory) {
          logger.info("element---------->", element);
          element.playersList = element.playersList.filter((p) => {
            if (p.rndCount == element.round) {
              return p;
            }
          });

          element.playersList = _.sortBy(
            element.playersList,
            (o) => o.pointsOfCards
          );
        }
      } else if (iterator.gameType == "Point") {
        iterator.playersList = _.sortBy(
          iterator.playersList,
          (o) => o.pointsOfCards
        );
      }

      iterator.createdAt = new Date(iterator.createdAt).toLocaleString(
        "en-GB",
        { month: "short", day: "numeric", year: "numeric" }
      );
      sortedHistory.push(iterator);
    }
    sortedHistory = replaceKeyOldToNew(sortedHistory);

    return res.status(200).send({
      success: true,
      errorCode: "0000",
      Type: "Response",
      message: "GamePerformance ScoreBoard Details",
      data: sortedHistory,
    });
  } catch (error) {
    logger.info("error------->", error);
    getInfo.exceptionError(error);
    return res.status(400).send({ success: false, error: error.message });
  }
});

//Play responsibly

router.get("/get-limit", authenticateJWT, async (req, res) => {
  try {
    const { userId } = req.user;
    const user = await db.collection("game_users").findOne({
      _id: getInfo.MongoID(userId),
    });
    if (!user)
      return res.status(404).send({
        success: false,
        errorCode: "1069",
        Type: "Response",
        message: "User Not Found",
      });

    const userResponsibly = await db.collection("user_responsibly").findOne({
      userId: getInfo.MongoID(user._id),
    });

    const userLimit = {
      dailyLimit: userResponsibly ? userResponsibly.dailyLimit.amount : "",
      monthlyLimit: userResponsibly ? userResponsibly.monthlyLimit.amount : "",
      setDailyLimit: 0,
      setMonthlyLimit: 0,
      minDailyLimit: 100,
      minMonthlyLimit: 250,
      notificationCashFlag: user.flags._notificationCashFlag,
    };
    const responsibly1 = {
      header:
        "Be Smart and keep a check on emotions to enjoy your favorite rummy games.",
    };
    const responsibly2 = {
      header:
        "Rummy Game ensure responsible play by taking the following measures.",
      value: [
        "Only Players above age of 18 years are allowed to play on RummyXL",
        "You can set your AddCash Limits which can help keep a check on your monthly expenditure.",
        "You can call our customer care in-case you want to Self-Exclude yourself from online rummy.",
        'You can follow our "Guidelines for Responsibile Play" to learn more about Responsible Gaming',
      ],
    };

    const responsibly3 = {
      header: "Guidelines for responsible Play",
      value: [""],
    };

    return res.status(200).send({
      success: true,
      errorCode: "0000",
      Type: "Response",
      message: "Data delivered successfully",
      data: {
        payload: userLimit,
        responsibly1: responsibly1,
        responsibly2: responsibly2,
        responsibly3: responsibly3,
      },
    });
  } catch (error) {
    getInfo.exceptionError(error);
    return res.status(400).send({ success: false, error: error.message });
  }
});

router.post("/play-responsibly", authenticateJWT, async (req, res) => {
  try {
    const { userId } = req.user;
    const user = await db.collection("game_users").findOne({
      _id: getInfo.MongoID(userId),
    });
    if (!user)
      return res.status(404).send({
        success: false,
        errorCode: "1069",
        Type: "Response",
        message: "User Not Found",
      });
    req.body = covertStringToObject(req.body.data);
    const { dailyLimit, monthlyLimit, notificationcashflag } = req.body;

    /* if (dailyLimit < 100) {
      return res.status(400).send({
        success: false,
        errorCode: "1064",
        Type: "Response",
        message: "Daily Add Cash Limit needs to be more than ₹100.",
      });
    }
    if (monthlyLimit < 250) {
      return res.status(400).send({
        success: false,
        errorCode: "1063",
        Type: "Response",
        message: "Monthly Add Cash Limit needs to be more than ₹250.",
      });
    } */
    let obj;
    let date = new Date();
    if (dailyLimit != 0 && monthlyLimit != 0) {
      if (monthlyLimit && monthlyLimit < dailyLimit) {
        obj = {
          userId: user._id,
          dailyLimit: {
            amount: dailyLimit,
            date: date,
            dailyPayCount: 0,
          },
          monthlyLimit: {
            amount: dailyLimit,
            date: date,
            monthlyPayCount: 0,
          },
        };
      } else {
        obj = {
          userId: user._id,
          dailyLimit: {
            amount: dailyLimit,
            date: date,
            dailyPayCount: 0,
          },
          monthlyLimit: {
            amount: monthlyLimit,
            date: date,
            monthlyPayCount: 0,
          },
        };
      }
    } else if (dailyLimit != 0 && monthlyLimit == 0) {
      const userData = await db
        .collection("user_responsibly")
        .findOne({ _id: user._id });
      if (
        userData?.monthlyLimit &&
        userData?.monthlyLimit.amount < dailyLimit
      ) {
        obj = {
          userId: user._id,
          dailyLimit: {
            amount: dailyLimit,
            date: date,
            dailyPayCount: 0,
          },
          monthlyLimit: {
            amount: dailyLimit,
            date: date,
            monthlyPayCount: 0,
          },
        };
      } else {
        obj = {
          userId: user._id,
          dailyLimit: {
            amount: dailyLimit,
            date: date,
            dailyPayCount: 0,
          },
        };
      }
    } else if (dailyLimit == 0 && monthlyLimit != 0) {
      obj = {
        userId: user._id,
        monthlyLimit: {
          amount: monthlyLimit,
          date: date,
          monthlyPayCount: 0,
        },
      };
    }

    await db.collection("game_users").findOneAndUpdate(
      { _id: user._id },
      {
        $set: {
          "flags._notificationCashFlag": notificationcashflag,
        },
      },
      { new: true }
    );

    const updateObj = await db.collection("user_responsibly").findOneAndUpdate(
      { _id: user._id },
      {
        $set: obj,
      },
      { upsert: true, returnDocument: "after" }
    );
    logger.info("updateObj------------>", updateObj.value);
    obj.notificationcashflag = notificationcashflag;

    if (!updateObj.value.dailyLimit) {
      updateObj.value.dailyLimit = { amount: 0, date: date, dailyPayCount: 0 };
    }
    if (!updateObj.value.monthlyLimit) {
      updateObj.value.monthlyLimit = {
        amount: 0,
        date: date,
        monthlyPayCount: 0,
      };
    }

    return res.status(200).send({
      success: true,
      errorCode: "0000",
      Type: "Response",
      message: "Add Cash Limit Updated",
      data: updateObj.value,
    });
  } catch (error) {
    getInfo.exceptionError(error);
    return res.status(400).send({ success: false, error: error.message });
  }
});

//Rating & feedback

const FeedbackUpload = multer({ storage: storageFiles });
router.post(
  "/feedback-image",
  authenticateJWT,
  FeedbackUpload.single("file"),
  async (req, res) => {
    try {
      const { IMAGE_UPLOAD_LIMITS = 15 } = GetConfig();

      if (!req.files || Object.keys(req.files).length === 0) {
        return res.status(200).json({
          success: false,
          errorCode: "0000",
          Type: "Response",
          message: 'No files uploaded.'
        });
      }

      const { file } = req.files;

      // Check file size
      if (file.size > IMAGE_UPLOAD_LIMITS * 1024 * 1024) {
        return res.status(200).json({
          success: false,
          errorCode: "0000",
          Type: "Response",
          message: 'File size exceeds the limit.'
        });
      }
      const { userId } = req.user;
      const { rating, description } = covertStringToObject(req.body);
      // const feedbackImageLocation = req.file.location;

      const feedbackImageCopress = imageCompress(file.data);
      const feedbackImageLocation = fileUpload({
        // fileContent: await imageCompress(req.file.buffer),
        fileContent: await feedbackImageCopress,
        folderCategoryLocation: "feedback",
        fileCategoryName: "FEEDBACK",
        uniqueId: userId,
        folderType: "images",
        extension: "jpg",
      });
      // //removeFile(req.file.path);

      await db.collection("feedback").insertOne({
        userId: getInfo.MongoID(userId),
        rating: rating,
        description: description,
        image: await feedbackImageLocation.Location,
        cd: new Date(),
      });

      return res.status(200).send({
        success: true,
        errorCode: "0000",
        Type: "Response",
        message: "Feedback sent successfully",
      });
    } catch (error) {
      logger.info("error---------->", error);
      getInfo.exceptionError(error);
      return res.status(400).send({ success: false, error: error.message });
    }
  }
);

router.post("/feedback", authenticateJWT, async (req, res) => {
  try {
    const { userId } = req.user;
    const { rating, description } = covertStringToObject(req.body);

    await db.collection("feedback").insertOne({
      userId: getInfo.MongoID(userId),
      rating: rating,
      description: description,
      cd: new Date(),
    });

    return res.status(200).send({
      success: true,
      errorCode: "0000",
      Type: "Response",
      message: "Feedback sent successfully",
    });
  } catch (error) {
    logger.info("error---------->", error);
    getInfo.exceptionError(error);
    return res.status(400).send({ success: false, error: error.message });
  }
});

//Security

router.get("/get-device-details", authenticateJWT, async (req, res) => {
  try {
    const { userId } = req.user;
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

    const details = await db
      .collection("device_details")
      .find({ userId: getInfo.MongoID(userId), deviceID: { $ne: null } })
      .toArray();

    const security1 = {
      header:
        "To enjoy the game at RummyXL, we offer world-class security for its players!",
      value: [
        "All your payments are 100% secured and protected",
        "Intelligent and Strict Fair Play Policy",
        "Fast and Easy withdrawals!",
        "Best customer support with email and calling support!",
        "Play practice games to learn and improve your rummy skill to win more!",
      ],
    };

    return res.status(200).send({
      success: true,
      errorCode: "0000",
      Type: "Response",
      message: "Device Details",
      data: {
        payload: details,
        security1: security1,
      },
    });
  } catch (error) {
    logger.info("error------->", error);
    getInfo.exceptionError(error);
    return res.status(400).send({ success: false, error: error.message });
  }
});

//contactUs

router.get("/contactUs", authenticateJWT, async (req, res) => {
  try {
    const { userId } = req.user;
    const { CONTACT_US_NO, CONTACT_US_EMAIL } = GetConfig();
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
    return res.status(200).send({
      success: true,
      errorCode: "0000",
      Type: "Response",
      message: "Data delivered successfully",
      data: {
        contactUs: CONTACT_US_NO,
        supportEmail: CONTACT_US_EMAIL,
      },
    });
  } catch (error) {
    getInfo.exceptionError(error);
    return res.status(400).send({ success: false, error: error.message });
  }
});

//Refer & Earn

router.get("/getReferralCode", authenticateJWT, async (req, res) => {
  try {
    const { userId } = req.user;
    const { BONUS_REFERRAL } = GetConfig();
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

    //find total earning details
    let earning = 0,
      yourReferrals = 0,
      selfReferralCode = user.rfc;
    const earnData = user.referral_bonus;
    if (!earnData) {
      const payload = {
        header: "EARN ₹50 BONUS EVERYTIME YOU REFER SOMEONE!",
        value:
          "YOU & YOUR FRIEND WILL BOTH GET ₹50 BONUS. SO REFER NOW TO START EARNING!",
        yourReferrals: yourReferrals,
        totalEarnings: earning,
        referralMessage: "My Invite Code",
        selfReferralCode: selfReferralCode,
        notReferralYet: true,
        notReferralYetMessage:
          "Your Statistics and earnings will be listed here once you refer people",
        referralMessage: `Hey! Join me on the RummyXL App.Play RUMMY & WIN REAL CASH.GET Rs.50 by using my code.Hurry! Use my referral link: https://rummyxl.com/ to join. Use Code: `,
      };

      return res.status(200).send({
        success: true,
        errorCode: "0000",
        Type: "Response",
        message: "Referral & Earn details",
        data: payload,
      });
    }

    for (let index = 0; index < earnData.length; index++) {
      yourReferrals += 1;
      earning = yourReferrals * BONUS_REFERRAL;
    }
    logger.info("---earning---->", earning);
    const payload = {
      header: "Earn Up to Rs. 10,000 for each referral!",
      value:
        "Earn upto Rs. 10,000 & your friend can also earn upto Rs. 10,000. Refer now to start earning!",
      yourReferrals: yourReferrals,
      totalEarnings: earning,
      referralMessage: "My Invite Code",
      selfReferralCode: selfReferralCode,
      notReferralYet: false,
      notReferralYetMessage:
        "Your Statistics and earnings will be listed here once you refer people",
      referralMessage: `Hey! Join me on the RummyXL App.Play RUMMY & WIN REAL CASH.GET Rs.50 by using my code.Hurry! Use my referral link: https://rummyxl.com/ to join. Use Code: `,
    };

    return res.status(200).send({
      success: true,
      errorCode: "0000",
      Type: "Response",
      message: "Referral & Earn details",
      data: payload,
    });
  } catch (error) {
    logger.info("error------->", error);
    getInfo.exceptionError(error);
    return res.status(400).send({ success: false, error: error.message });
  }
});

//Bonus Expire

router.get("/bonus-expire", authenticateJWT, async (req, res) => {
  try {
    const { userId } = req.user;
    const { BONUS_SIGN_UP, BONUS_REFERRAL } = GetConfig();
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
    logger.info("userId---------->", userId);
    let mybonuscashArr = [],
      bonusStat = [];

    if (BONUS_SIGN_UP != 0) {
      mybonuscashArr.push({
        description: "Sign Up Bonus",
        amountUtilised: `₹ ${commonClass.RoundInt(
          BONUS_SIGN_UP - user.SignUpBonus,
          2
        )} of ${BONUS_SIGN_UP}`,
        // expiry: moment
        //   .utc(new Date(user.SignUpBonusExpire).toString())
        //   .add({ hours: 5, minutes: 30 })
        //   .format("MMM D, h:mm:ss A"),
        // expiry: moment(new Date(user.SignUpBonusExpire).toString()).format("MMM D, h:mm:ss A"),
        expiry: user.SignUpBonusExpire,
        // const newDate = moment(new Date(element.date)).format("lll");
        status: user.SignUpBonusStatus,
      });
    }

    if (user.addCash_bonus) {
      for (const [i, element] of user.addCash_bonus.entries()) {
        //bonus-track
        const findBonusAmount = await db.collection("bonus_tracking").findOne({
          userId: getInfo.MongoID(userId),
          transactionId: element.transactionId,
        });
        if (findBonusAmount) {
          mybonuscashArr.push({
            description: "Add Cash Bonus",
            amountUtilised: `₹ ${commonClass.RoundInt(
              findBonusAmount.getBonus - element.addCashBonus,
              2
            )} of ₹ ${findBonusAmount.getBonus}`,
            expiry: element.expire_date,
            status: element.status,
          });
        }
      }
    }

    if (user.referral_bonus) {
      for (const [i, element] of user.referral_bonus.entries()) {
        // logger.info('elem--referral---->', element);
        mybonuscashArr.push({
          description: "Referral Bonus",
          amountUtilised: `₹ ${commonClass.RoundInt(
            BONUS_REFERRAL - element.referralBonus,
            2
          )} of ₹ ${BONUS_REFERRAL}`,
          expiry: element.expire_date,
          status: element.status,
        });
      }
    }

    const findCashTrack = await db
      .collection("cash_track")
      .find({ uid: getInfo.MongoID(userId) })
      .sort({ _id: -1 })
      .toArray();
    let amount;
    for (const [i, element] of findCashTrack.entries()) {
      if (element.tp == "Admin Bonus Removed") {
        mybonuscashArr.push({
          description: "Admin bonus removed",
          amountUtilised: `₹ ${commonClass.RoundInt(element.c, 2)}`,
          expiry: element.cd,
          status: "Remove",
        });
      } else if (element.tp == "release remaining amount") {
        const found = findCashTrack.filter(
          (tableId) =>
            tableId.tjid == element.tjid &&
            tableId.tp != "release remaining amount"
        );
        let bonus = 0;
        for (const [i, elem] of found.entries()) {
          if (elem.signUpBonus) {
            bonus += elem.signUpBonus;
            element.bonusType = elem.bonusType;
          }
        }

        amount = bonus - element.signUpBonus;
        if (amount != 0) {
          element.bonusType = capitalizeFirstLetter(element.bonusType);
          bonusStat.push({
            description: element.bonusType,
            bonusCashID: element.tjid,
            expiry: moment
              .utc(new Date(element.cd).toString())
              .add({ hours: 5, minutes: 30 })
              .format("MMM D, h:mm A"),
            // expiry: moment(new Date(element.cd)).format("MMM D, h:mm A"),
            amount: commonClass.RoundInt(amount, 2),
          });
        }
      } else if (
        element.tp == "Collect Boot Value" &&
        element.gameType != "Points"
      ) {
        let amount = element.signUpBonus;
        if (amount && amount != 0) {
          element.bonusType = capitalizeFirstLetter(element.bonusType);
          bonusStat.push({
            description: element.bonusType,
            bonusCashID: element.tjid,
            expiry: moment
              .utc(new Date(element.cd).toString())
              .add({ hours: 5, minutes: 30 })
              .format("MMM D, h:mm A"),
            // expiry: moment(new Date(element.cd)).format("MMM D, h:mm A"),
            amount: commonClass.RoundInt(amount, 2),
          });
        }
      }
    }

    mybonuscashArr.sort(function (a, b) {
      return new Date(b.expiry) - new Date(a.expiry);
    });

    for (const element of mybonuscashArr) {
      // element.expiry = moment.utc(element.expiry).format("MMM D, h:mm A");
      // element.expiry = moment
      //   .utc(new Date(element.expiry).toString())
      //   .add({ hours: 5, minutes: 30 })
      //   .format("MMM D, h:mm A");
      element.expiry = moment(new Date(element.expiry)).format("MMM D, h:mm A");
    }

    return res.status(200).send({
      success: true,
      errorCode: "0000",
      Type: "Response",
      message: "Bonus-Expire details",
      payload: {
        mybonuscash: mybonuscashArr,
        bonuscashministatement: bonusStat,
      },
      // bonuscashministatement: bonusStat
    });
  } catch (error) {
    logger.info("error------->", error);
    getInfo.exceptionError(error);
    return res.status(400).send({ success: false, error: error.message });
  }
});

router.post("/crashReportOfSocket", async (req, res) => {
  try {
    getInfo.exceptionError(req.body);
    return res.status(200).send({
      success: true,
      errorCode: "0000",
      Type: "Response",
      message: "Exception Error details",
      payload: req.body,
    });
  } catch (error) {
    getInfo.exceptionError(error);
    return res.status(400).send({ success: false, error: error.message });
  }
});

// authenticateJWT
router.post("/getSelectAddressProof", authenticateJWT, async (req, res) => {
  try {
    logger.info("API", "getSelectAddressProof");
    const { BLOCK_STATE } = GetConfig();

    const user = await db.collection("game_users").findOne({
      _id: getInfo.MongoID(req.body.userId),
    });

    if (!user) {
      logger.info("user getSelectAddressProof", "User Not Found");

      return res.status(200).send({
        success: false,
        errorCode: "1069",
        Type: "Response",
        message: "User Not Found",
      });
    }
    let countryCheck = false;

    if (user.country && user.state && user.country != "" && user.state != "") {
      if (user.storeUser && user.country !== "India") countryCheck = true;
      const checkLocation = _.contains(BLOCK_STATE, user.state) || countryCheck;
      if (checkLocation) {
        return res.status(200).send({
          success: false,
          errorCode: "1009",
          Type: "Response",
          message:
            "As per regulations, cash games are restricted for your location. We recommend you play practice games and improve your skill in the meantime!",
          payload: { showPop: true, isRestricted: true, userAddressProof: [] },
        });
      }
    }
    const userAddressProof = await db
      .collection("UserAddressProof")
      .find({ userId: user._id, status: { $in: ["SUCCESS", "PENDING"] } })
      .limit(1)
      .toArray();
    logger.info(
      "API getSelectAddressProof",
      "Get address document proof data."
    );

    return res.status(200).send({
      success: true,
      errorCode: "0000",
      Type: "Response",
      message: "Get address document proof data.",
      payload: {
        showPop: userAddressProof?.length == 0,
        isRestricted: false,
        userAddressProof,
      },
    });
  } catch (error) {
    getInfo.exceptionError(error);
    logger.error("-----> error getSelectAddressProof", error);
    return res.status(400).send({ success: false, error: error.message });
  }
});

const NewSelectAddressProofUpload = multer({ storage: storageFiles });

router.post(
  "/uploadSelectAddressProof",
  // NewSelectAddressProofUpload.fields([
  //   { name: "frontside", maxCount: 1 },
  //   { name: "backside", maxCount: 1 },
  // ]),
  authenticateJWT,
  async (req, res) => {
    try {
      const { IMAGE_UPLOAD_LIMITS = 15 } = GetConfig();

      if (!req.files || Object.keys(req.files).length === 0) {
        return res.status(200).json({
          success: false,
          errorCode: "0000",
          Type: "Response",
          message: 'No files uploaded.'
        });
      }

      const { backside, frontside } = req.files;

      // Check file size
      if (backside.size > IMAGE_UPLOAD_LIMITS * 1024 * 1024 || frontside.size > IMAGE_UPLOAD_LIMITS * 1024 * 1024) {
        return res.status(200).json({
          success: false,
          errorCode: "0000",
          Type: "Response",
          message: 'File size exceeds the limit.'
        });
      }
      // if (!req.files) {
      //   //removeFile(req.files.backside[0].path);
      //   //removeFile(req.files.frontside[0].path);

      //   return res.status(200).send({
      //     success: false,
      //     errorCode: "0000",
      //     Type: "Response",
      //     message: 'No files uploaded.'
      //   });
      // }

      // if (req.files.backside[0].size > 1024 * 1024 * IMAGE_UPLOAD_LIMITS || req.files.frontside[0].size > 1024 * 1024 * IMAGE_UPLOAD_LIMITS) {
      //   //removeFile(req.files.backside[0].path);
      //   //removeFile(req.files.frontside[0].path);
      //   return res.status(200).send(
      //     {
      //       success: false,
      //       errorCode: "0000",
      //       Type: "Response",
      //       message: 'File size exceeds the limit.'
      //     });
      // }
      const { userId, birthDate, state, documentType } = req.body;
      logger.info("API", "uploadSelectAddressProof", userId, birthDate, state, documentType);
      if (
        (req.files.backside.length > 0 && req.files.frontside.length > 0) ||
        userId ||
        birthDate ||
        state ||
        documentType
      ) {
        let dateSplit = birthDate.split(" ")[0];
        dateSplit = moment(new Date(Date.parse(dateSplit))).format(
          "MM/DD/YYYY"
        );

        // logger.info("dateSplit", dateSplit);

        let year = dateSplit.split("/")[2];
        logger.info("year", year);

        let date = dateSplit.split("/")[1];
        logger.info("date", date);

        let month = dateSplit.split("/")[0];
        logger.info("month", month);

        logger.info("Date.parse", new Date(Date.parse(dateSplit)));

        let bithday = moment(new Date(year, month - 1, date)).format(
          "MM/DD/YYYY"
        );
        logger.info("years", bithday);

        // const bithday = moment(new Date(birthDate)).format("MM/DD/YYYY");
        // logger.info("bithdaybithday", bithday);

        const years = moment().diff(new Date(bithday), "years", false);
        logger.info("yearsyears", years);

        logger.info("years < 18", years < 18);

        if (years < 18) {
          // //removeFile(req.files.backside[0].path);
          // //removeFile(req.files.frontside[0].path);
          logger.info("years", "To play Cash Games you must be above 18 years of age.");
          return res.status(200).send({
            success: false,
            errorCode: "0000",
            Type: "Response",
            message: "To play Cash Games you must be above 18 years of age.",
          });
        }

        const user = await db
          .collection("game_users")
          .findOne({ _id: getInfo.MongoID(userId) });

        if (!user) {
          // //removeFile(req.files.backside[0].path);
          // //removeFile(req.files.frontside[0].path);
          logger.info("user", "User Not Found");
          return res.status(200).send({
            success: false,
            errorCode: "1069",
            Type: "Response",
            message: "User Not Found",
          });
        }

        logger.info(" req.files req.files req.files", req.files)

        const imageData = { userId, files: req.files };
        addressProofQueueClass.addressProofToQueue(imageData);
        await db.collection("UserAddressProof").findOneAndUpdate(
          { userId: getInfo.MongoID(userId) },
          {
            $set: {
              documentType,
              state,
              status: "PENDING",
              birthDate,
              create_date: new Date(),
            },
          },
          { new: true, upsert: true }
        );
        logger.info("API", "Document proof update successfully.");
        return res.status(200).send({
          success: true,
          errorCode: "0000",
          Type: "Response",
          message: "Document proof update successfully.",
        });
      } else {
        logger.info("API", "Some field are missing.");
        // if (fs.existsSync(req.files.backside[0].path)) {
        //   fs.unlinkSync(req.files.backside[0].path);
        // }
        // if (fs.existsSync(req.files.frontside[0].path)) {
        //   fs.unlinkSync(req.files.frontside[0].path);
        // }
        return res.status(200).send({
          success: false,
          errorCode: "0000",
          Type: "Response",
          message: "Some field are missing.",
        });
      }
    } catch (error) {
      getInfo.exceptionError(error);
      logger.error("-----> error uploadSelectAddressProof", error);
      return res.status(400).send({ success: false, error: error });
    }
  }
);

router.get("/stateList", authenticateJWT, async (req, res) => {
  try {
    const stateList = await db.collection("state_list").find().toArray();

    const banState = [],
      state = [];
    for (const iterator of stateList) {
      if (iterator.banned) {
        banState.push(iterator);
      } else {
        state.push(iterator);
      }
    }
    return res.status(200).send({
      success: true,
      errorCode: "0000",
      Type: "Response",
      message: "State list data.",
      payload: {
        state,
        banState,
      },
    });
  } catch (error) {
    getInfo.exceptionError(error);
    return res.status(400).send({ success: false, error: error.message });
  }
});

router.get("/doumentOptions", authenticateJWT, async (req, res) => {
  try {
    const UserAddressProofOptionList = await db
      .collection("UserAddressProofOption")
      .find()
      .toArray();

    return res.status(200).send({
      success: true,
      errorCode: "0000",
      Type: "Response",
      message: "User Address Proof Option list data.",
      payload: {
        UserAddressProofOptionList,
      },
    });
  } catch (error) {
    getInfo.exceptionError(error);
    return res.status(400).send({ success: false, error: error.message });
  }
});

router.post("/newRequest", authenticateJWT, async (req, res) => {
  try {
    const { BLOCK_STATE } = GetConfig();
    const { userId } = req.body;
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

    if (user.country && user.state && user.country != "" && user.state != "") {
      if (user.storeUser && user.country !== "India") countryCheck = true;
      const checkLocation = _.contains(BLOCK_STATE, user.state) || countryCheck;
      if (checkLocation)
        return res.status(200).send({
          success: false,
          errorCode: "1009",
          Type: "Response",
          message:
            "As per regulations, cash games are restricted for your location. We recommend you play practice games and improve your skill in the meantime!",
          data: {
            showPop: true,
            isRestricted: true,
            messageTitle: "Restricted Region",
          },
        });
    }



    if (user.storeUser) {
      const userAddressProof = await db
        .collection("UserAddressProof")
        .find({ userId: user._id })
        .limit(1)
        .toArray();
      logger.info("newRequest userAddressProof", userAddressProof);
      if (
        userAddressProof?.length == 0 ||
        userAddressProof?.[0]?.status == "PENDING" ||
        userAddressProof?.[0]?.status == "REJECTED"
      )
        return res.status(200).send({
          success: false,
          errorCode: "0000",
          Type: "Response",
          message:
            userAddressProof?.[0]?.status === "PENDING"
              ? "You can't make a withdrawal until your address proof is verified by us."
              : "Get address document proof data.",
          data: {
            showPop: userAddressProof?.length >= 0,
            isRestricted: false,
            isWithdraw: userAddressProof?.[0]?.status == "PENDING",
            messageTitle: "Withdraw",
            userAddressProof,
          },
        });
    }

    return res.status(200).send({
      success: true,
      errorCode: "0000",
      Type: "Response",
      message: "New request data",
      data: {
        showPop: false,
        isRestricted: false,
      },
    });
  } catch (error) {
    logger.error("newRequest", error);
    getInfo.exceptionError(error);
    return res.status(400).send({ success: false, error: error.message });
  }
});

function jsonToBase64(jsonObj) {
  const jsonString = JSON.stringify(jsonObj);
  return Buffer.from(jsonString).toString("base64");
}

function sha256(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function Base64ToObject(jsonObj) {
  const json = Buffer.from(jsonObj, "base64").toString();
  return JSON.parse(json);
}

//phone pay
// router.get('/addCashPhonePayStandard', authenticateJWT, async (req, res) => {
//   try {
//     let { amount } = req.headers;
//     const { userId } = req.user;
//     logger.info("userId------------>", userId);

//     const user = await db.collection("game_users").findOne({
//       _id: getInfo.MongoID(userId),
//     });
//     if (!user)
//       return res.status(404).send({
//         success: false,
//         errorCode: "1069",
//         Type: "Response",
//         message: "User Not Found",
//       });

//     let orderDetails = {
//       id: await alphaNumericString(14, "user_payment", "orderId", "order"),
//       receipt: randomString.generate(10)
//     }
//     logger.info('----orderDetails---------->', orderDetails);
//     //web view
//     let sampleData = {
//       merchantId: phonePeMerchantId,
//       merchantTransactionId: orderDetails.id,
//       merchantUserId: userId.toString(),
//       amount: amount * 100,
//       redirectUrl: 'https://kube.artoon.in:32267/phonepay-redirecturl',
//       redirectMode: 'POST',
//       callbackUrl: 'https://kube.artoon.in:32267/addCashPhonePayWebView',
//       mobileNumber: user.phn,
//       paymentInstrument: {
//         "type": "PAY_PAGE"
//       }
//     }
//     logger.info('-------sampleData------->', sampleData);
//     // convert JSON into base64
//     let sampleBase64 = jsonToBase64(sampleData);
//     logger.info('-------sampleBase64-------->', sampleBase64);

//     //convert into SHA256
//     let sampleSHA256 = sha256(sampleBase64 + "/pg/v1/pay" + phonePeMerchantSaltKey);
//     logger.info('----sampleSHA256------->', sampleSHA256);

//     let xVerify = sampleSHA256 + "###" + phonePeMerchantSaltIndex;
//     logger.info("--------------------XVERIFY", xVerify, sampleBase64);

//     const phonepayRequest = await axios({
//       method: "post",
//       url: "https://api-preprod.phonepe.com/apis/merchant-simulator/pg/v1/pay",
//       headers: {
//         "Content-Type": "application/json",
//         accept: 'application/json',
//         'X-VERIFY': `${sampleSHA256}###${phonePeMerchantSaltIndex}`
//       },
//       data: {
//         request: sampleBase64
//       },
//     })
//       .then(async function (response) {
//         logger.info('------response--------->', response.data);

//         await db.collection("user_payment").insertOne({
//           userId: getInfo.MongoID(userId),
//           transactionId: '',
//           orderId: orderDetails.id,
//           status: "PENDING",
//           mode: "ADD_CASH",
//           receipt: orderDetails.receipt,
//           amount: 10,
//           paymentFlag: 'phonepay',
//           create_date: new Date(),
//         });
//         return response.data;
//       })
//       .catch(function (error) {
//         logger.info('------error------------>', error);
//         return error.response.data;
//       });

//     logger.info('-----phonepayRequest--------->', phonepayRequest);

//     return res.status(200).send({ success: true, data: phonepayRequest });
//     // return res.status(200).send({
//     //   success: true, data: {
//     //     sampleBase64: sampleBase64,
//     //     sampleSHA256: sampleSHA256,
//     //     xVerify: xVerify
//     //   }
//     // });
//   } catch (error) {
//     logger.info('-------error-----addCashPhonePay---->', error);
//     return res.status(400).send({ success: false, error: error });
//   }
// });

router.post("/addCashPhonePayResponse", async (req, res) => {
  try {
    req.body = Base64ToObject(req.body.response);
    logger.info("/addCashPhonePayResponse-post-body", req.body);
    // find transactionId
    const getTransaction = await db
      .collection("user_payment")
      .findOne({ orderId: req.body.data.merchantTransactionId });
    logger.info("getTransaction------->", getTransaction);
    if (getTransaction && getTransaction.status == "PENDING") {
      //convert into SHA256
      let sampleSHA256 = sha256(
        `/pg/v1/status/${phonePeMerchantId}/${req.body.data.merchantTransactionId}` +
        phonePeMerchantSaltKey
      );
      let xVerify = sampleSHA256 + "###" + phonePeMerchantSaltIndex;
      const phonepayResponse = await checkStatusAPIPhonePe(
        phonePeMerchantId,
        req.body.data.merchantTransactionId,
        xVerify
      );
      logger.info(
        "/callback-phonepayResponse-post-body-init",
        phonepayResponse
      );

      const userDetails = await db.collection("user_payment").findOne({
        paymentId: phonepayResponse.data.transactionId,
        orderId: req.body.data.merchantTransactionId,
      });

      if (!userDetails) {
        if (phonepayResponse.code == "PAYMENT_PENDING") {
          let checkStatusApiLoop;
          let count = 0;
          let timer = 25000;
          checkStatusApiLoop = setInterval(async () => {
            async function doit() {
              count++;
              const phonepayResponse = await checkStatusAPIPhonePe(
                phonePeMerchantId,
                req.body.data.merchantTransactionId,
                xVerify
              );
              logger.info(
                "/callback-phonepayResponse-post-body",
                phonepayResponse
              );

              if (phonepayResponse.code != "PAYMENT_PENDING")
                clearInterval(checkStatusApiLoop);
              logger.info("phonepayResponse", phonepayResponse);

              updatePhonePayResponse(
                phonepayResponse,
                getTransaction,
                req.body.data.merchantTransactionId
              );
            }
            doit();
            timer = count <= 1 ? 30000 : 60000;
            checkStatusApiLoop._repeat = timer;
          }, timer);
        } else {
          updatePhonePayResponse(phonepayResponse, getTransaction, req.body.data.merchantTransactionId);
        }
      }

      // setTimeout(() => {
      //   clearInterval(checkStatusApiLoop);
      //   updatePhonePayResponse(phonepayResponse, getTransaction, req.body.data.merchantTransactionId);
      // }, 900 * 1000);
    }
    return res.status(200).send({ success: true });
  } catch (error) {
    logger.info("----error---------> addCashPhonePayResponse post", error);
    getInfo.exceptionError(error);
    return res.status(400).send({ success: false, error: error.message });
  }
});

const updatePhonePayResponse = async (
  phonepayResponse,
  getTransaction,
  orderId
) => {
  const { EXPIRE_CASH_BONUS } = GetConfig();
  if (phonepayResponse.code == "PAYMENT_SUCCESS") {
    const verifyPayment = phonepayResponse.data;
    logger.info("--verifyPayment--------->", verifyPayment);
    verifyPayment.amount = verifyPayment.amount / 100;

    if (verifyPayment.state == "COMPLETED") {
      verifyPayment.status = "SUCCESS";
    } else if (verifyPayment.state == "FAILED") {
      verifyPayment.status = "FAILED";
    }

    await db.collection("user_payment").findOneAndUpdate(
      {
        userId: getTransaction.userId,
        orderId: orderId,
      },
      {
        $set: {
          amount: verifyPayment.amount,
          paymentMethod: "upi",
          status: verifyPayment.status,
          complete_date: new Date(),
          paymentId: verifyPayment.transactionId,
          paymentResponse: verifyPayment,
        },
      },
      { new: true, upsert: true }
    );

    if (verifyPayment.status == "SUCCESS") {
      const user = await db
        .collection("game_users")
        .findOne({ _id: getTransaction.userId });
      if (!user)
        return res.status(404).send({
          success: false,
          errorCode: "1069",
          Type: "Response",
          message: "User Not Found",
        });

      let current_date, expire_date, days;
      days = EXPIRE_CASH_BONUS; //config.EXPIRECASHBONUS
      current_date = new Date();
      expire_date = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
      //find bonus percentage
      let bonus_perc_table = await db
        .collection("add_cash_bonus_percent")
        .findOne();
      const bonus_perc = bonus_perc_table.bonus_amt;
      const displayBonus = (verifyPayment.amount * bonus_perc) / 100;

      // if (user.isFirstTimeUser) {
      //   // let offer = await db.collection("offers").findOne();
      //   let depositAmount = verifyPayment.amount + 50;
      //   verifyPayment.amount = depositAmount;
      //   verifyPayment.isOfferClaimed = true;
      // }

      // await db.collection("game_users").findOneAndUpdate(
      //   { _id: getTransaction.userId },
      //   {
      //     $inc: {
      //       depositCash: verifyPayment.amount,
      //       "counters.addcash": +1,
      //     },
      //     $set: {
      //       "flags._firstdeposit": true,
      //       isFirstTimeUser: false,
      //       firstTimeOfferUsed: true,
      //     },
      //     $push: {
      //       addCash_bonus: {
      //         addCashBonus: displayBonus,
      //         current_date: current_date,
      //         expire_date: expire_date,
      //         status: "Active",
      //         transactionId: getTransaction.transactionId,
      //         _id: getInfo.MongoID(),
      //       },
      //     },
      //   },
      //   { new: true }
      // );

      let insertData = {
        uid: getTransaction.userId,
        un: user.un,
        ue: user.ue,
        c: verifyPayment.amount,
        tp: "Cash Added",
        sts: "success",
        orderId: orderId,
        transactionId: getTransaction.transactionId,
        cd: new Date(),
        depositCash: user.depositCash + verifyPayment.amount,
        withdrawableCash: user.Winning,
      };

      // await db.collection("cash_track").insertOne(insertData);

      let trobj = {
        userId: getTransaction.userId,
        orderId: orderId,
        addCash: verifyPayment.amount,
        getBonus: displayBonus,
        orderId: orderId,
        transactionId: getTransaction.transactionId,
        cd: new Date(),
        type: "User add cash",
      };
      await db.collection("bonus_tracking").insertOne(trobj);
      // if (user.isFirstTimeUser) {
      //   let insertOfferData =insertData;
      //   insertOfferData.depositCash=insertData.depositCash+50;
      //   insertOfferData.tp="FreeCash Added"          
      //   await db.collection("cash_track").insertOne(insertOfferData);
      //   let depositAmount = verifyPayment.amount + 50;
      //   verifyPayment.amount = depositAmount;
      //   verifyPayment.isOfferClaimed = true;

      // }
      if (user.isFirstTimeUser) {
        let insertOfferData ={...insertData};
        insertOfferData.depositCash=insertData.depositCash+50;
        insertOfferData.tp="FreeCash Added"  
        // insertOferData._id=getInfo.MongoID()        
        await db.collection("cash_track").insertMany([insertData,insertOfferData]);
        let depositAmount = verifyPayment.amount + 50;
        verifyPayment.amount = depositAmount;
        verifyPayment.isOfferClaimed = true;

      }else{
        await db.collection("cash_track").insertOne(insertData);

      }
      
      await db.collection("game_users").findOneAndUpdate(
        { _id: getTransaction.userId },
        {
          $inc: {
            depositCash: verifyPayment.amount,
            "counters.addcash": +1,
          },
          $set: {
            "flags._firstdeposit": true,
            isFirstTimeUser: false,
            firstTimeOfferUsed: true,
          },
          $push: {
            addCash_bonus: {
              addCashBonus: displayBonus,
              current_date: current_date,
              expire_date: expire_date,
              status: "Active",
              transactionId: getTransaction.transactionId,
              _id: getInfo.MongoID(),
            },
          },
        },
        { new: true }
      );
    }
  } else if (phonepayResponse.code == "PAYMENT_ERROR") {
    logger.info("---phonepayResponse---> success false", phonepayResponse);
    await db.collection("user_payment").findOneAndUpdate(
      {
        userId: getTransaction.userId,
        orderId: orderId,
      },
      {
        $set: {
          amount: getTransaction.amount,
          paymentMethod: "upi",
          status: "FAILED",
          complete_date: new Date(),
          paymentId: "-",
        },
      },
      { new: true }
    );
  }
};

router.get("/get-report", authenticateJWT, async (req, res) => {
  try {
    logger.info("/get-report------->", "get-report");
    const report = await db
      .collection("user_query")
      .find({ userId: getInfo.MongoID(req.user.userId) })
      .limit(25)
      .toArray();

    return res.status(200).send({
      success: true,
      errorCode: "0000",
      Type: "Response",
      message: "report data",
      data: report,
    });
  } catch (error) {
    logger.error("get-report", error);
    getInfo.exceptionError(error);
    return res.status(400).send({ success: false, error: error.message });
  }
});

router.post("/get-invoice-list", authenticateJWT, async (req, res) => {
  try {
    const { userId } = req.body;
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

    let getUserData = await db
      .collection("UserGameHistory")
      .aggregate([
        { $sort: { _id: -1 } },
        { $match: { mode: "cash", userId: user._id } },
        { $limit: 200 },
        {
          $unwind: { path: "$tableHistory", preserveNullAndEmptyArrays: true },
        },
        {
          $unwind: {
            path: "$tableHistory.playersList",
            preserveNullAndEmptyArrays: true,
          },
        },
        { $unwind: { path: "$playersList", preserveNullAndEmptyArrays: true } },
        {
          $addFields: {
            player: {
              $cond: [
                { $ifNull: ["$playersList", false] },
                "$playersList",
                "$tableHistory.playersList",
              ],
            },
          },
        },
        {
          $match: {
            "player.uid": userId,
            "player.invoiceId": { $exists: true },
          },
        },
        {
          $project: {
            mode: 1,
            gameType: 1,
            tableGenerationId: 1,
            invoiceId: "$player.invoiceId",
            inoviceDate: {
              $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
            },
          },
        },
      ])
      .toArray();

    return res.status(200).send({
      success: true,
      errorCode: "0000",
      Type: "Response",
      message: "New request data",
      data: getUserData,
    });
  } catch (error) {
    getInfo.exceptionError(error);
    return res.status(400).send({ success: false, error: error.message });
  }
});

router.post("/download-invoice", authenticateJWT, async (req, res) => {
  try {
    const { BUCKET_URL } = GetConfig();
    let getUserData = await db
      .collection("UserGameHistory")
      .findOne({ _id: getInfo.MongoID(req.body.id) });
    if (!getUserData)
      return res.send({ status: 404, success: false, message: "Not found" });

    let getUser = await db
      .collection("game_users")
      .findOne({ _id: getInfo.MongoID(req.body.userId) });
    if (!getUser)
      return res.send({
        status: 500,
        success: false,
        data: [],
        message: "Not found",
      });

    let invData,
      invoiceId,
      tranId = "";
    if (getUserData.gameType == "Points") {
      tranId = getUserData.transactionId;
      let getUser = getUserData.playersList.find(
        (e) => e.uid == req.body.userId
      );
      if (getUser) {
        invoiceId = getUser.invoiceId ? getUser.invoiceId : "";
        invData = calculateInvoiceData(
          Math.abs(getUser.wc),
          "",
          getUser.state,
          getUserData.commission,
          getUserData.bonusPercentage,
          getUser.totalBonus
        );
      }
    } else {
      tranId = getUserData.tableGenerationId;
      let getWinnerObj = getUserData.tableHistory[0];
      if (getWinnerObj) {
        let getUser = getWinnerObj.playersList.find(
          (el) => el.uid == req.body.userId
        );
        if (getUser) {
          invoiceId = getUser.invoiceId ? getUser.invoiceId : "";
          invData = calculateInvoiceData(
            "",
            getUser.userViewCashChips,
            getUser.state,
            getUserData.commission,
            getUserData.bonusPercentage,
            getUser.totalBonus
          );
        }
      }
    }
    if (invData) {
      let amountInWord = invData.totalAmount.toString();
      amountInWord = amountInWord.split(".");
      let amountWord = "";
      if (amountInWord[0] == "0") {
        amountWord = "Zero";
      }
      if (amountInWord[1]) {
        if (amountInWord[1].length <= 1) {
          amountInWord[1] = amountInWord[1] + "0";
        }
        amountWord += `${inWords(amountInWord[0])} And ${inWords(
          amountInWord[1]
        )}`;
      } else {
        amountWord += inWords(amountInWord[0]);
      }

      let emailTemplate = fs.readFileSync(
        path.join(__dirname, "../views/invoice.html"),
        "utf8"
      );

      let setTemplates = renderMessageFromTemplateAndVariables(emailTemplate, {
        userId: getUser.unique_id,
        userName: getUser.un,
        transactionId: "NA",
        name: getUser.userName ? getUser.userName : "NA",
        state: getUser.state,
        stateCode: getUser.stateCode ? getUser.stateCode : "",
        tel: getUser.phn ? getUser.phn : "",
        email: getUser.ue ? getUser.ue : "",
        invoiceNo: invoiceId,
        invoiceDate: new Date(getUserData.createdAt).toLocaleDateString(
          "en-in",
          { year: "numeric", month: "short", day: "numeric" }
        ),
        grossValue: invData.grossTaxableAmount,
        discount: invData.discount,
        taxableValue: invData.taxableAmount,
        cgst: invData.cgst ? invData.cgst : 0,
        sgst: invData.sgst ? invData.sgst : 0,
        igst: invData.igst ? invData.igst : 0,
        totalAmount: invData.totalAmount,
        subTotal: invData.totalAmount,
        roundOff: invData.roundOff,
        invoiceValue: invData.totalAmount,
        amountInWord: amountWord,
        tranId: tranId,
      });

      let options = { format: "A4" };

      let dir = "./upload/";
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      pdf.create(setTemplates, options).toBuffer(async function (err, pdfRes) {
        if (err) {
          console.error("err--------upload---------", err);
          return res.send({ success: false, message: err });
        }

        const invoiceData = await fileUploadByUnique({
          fileContent: pdfRes,
          folderCategoryLocation: moment().format("MM-DD-YYYY"),
          fileCategoryName: "INVOICE",
          uniqueId: `${tranId}_${getUser.unique_id}`,
          folderType: "pdfFiles",
          extension: "pdf",
        });

        return res.status(200).send({
          success: true,
          errorCode: "0000",
          Type: "Response",
          message: "New request data",
          data: {
            invoiceData:
              environment == "staging"
                ? `${invoiceData.Location}`
                : `${BUCKET_URL}${invoiceData.Key}`,
          },
        });
      });
    } else {
      res.send({ success: false, message: "Not found" });
    }
  } catch (error) {
    getInfo.exceptionError(error);
    return res.status(400).send({ success: false, error: error.message });
  }
});
router.post("/public-ip-save", authenticateJWT, async (req, res) => {
  try {
    if (!req.body.publicIp)
      return res.send({ success: false, message: "Data is missing" });

    let getUser = await db
      .collection("game_users")
      .findOne({ _id: getInfo.MongoID(req.user.userId) });
    if (!getUser)
      return res.send({
        status: 500,
        success: false,
        data: [],
        message: "Not found",
      });

    await db.collection("game_users").findOneAndUpdate(
      { _id: getUser._id },
      {
        $set: { publicIp: req.body.publicIp },
      },
      { new: true }
    );

    return res.status(200).send({
      success: true,
      errorCode: "0000",
      Type: "Response",
      message: "Data save successfully",
    });
  } catch (error) {
    return res.status(400).send({ success: false, error: error.message });
  }
});

// router.get('/fetch', async (req, res) => {
//   try {
//     //4. Get Task
//     // const request_id = reqIDResponse.request_id;
//     //3. pan validation
//     let id_number = 'AYQPP1387B';
//     const reqIDResponse = await axios({
//       method: "post",
//       url: "https://eve.idfy.com/v3/tasks/async/verify_with_source/ind_pan",
//       headers: {
//         "Content-Type": "application/json",
//         "account-id": idfyAccountId,
//         "api-key": idfyKey,
//       },
//       data: JSON.stringify({
//         task_id: '6442b5a12229270013eb9474',
//         group_id: '6442b6552229270013eb960c',
//         data: {
//           id_number: id_number,
//         },
//       }),
//     })
//       .then(function (response) {
//         return response.data;
//       })
//       .catch(function (error) {
//         return error.response.data;
//       });

//     //4. Get Task
//     logger.info("reqIDResponse----------->", reqIDResponse);
//     const request_id = reqIDResponse.request_id;

//     let configAxios = {
//       method: "get",
//       url: `https://eve.idfy.com/v3/tasks?request_id=${request_id}`,
//       headers: {
//         "api-key": idfyKey,
//         "Content-Type": "application/json",
//         "account-id": idfyAccountId,
//       },
//     };

//     await timeout(3000);

//     const validationResponse = await axios(configAxios)
//       .then(function (response) {
//         return response.data;
//       })
//       .catch(function (error) {
//         return error;
//       });
//     logger.info("validationResponse===------->", validationResponse);

//     await db.collection("user_details").findOneAndUpdate(
//       {
//         userId: getInfo.MongoID('6442b5a12229270013eb9474'),
//         docType: "PAN",
//         panNumber: id_number,
//       },
//       {
//         $set: {
//           status: validationResponse[0].status,
//           request_id: request_id,
//         }
//       },
//     );

//     await db.collection("game_users").updateOne(
//       { _id: getInfo.MongoID('6442b5a12229270013eb9474') },
//       {
//         $set: {
//           PanVerify: true,
//         },
//       },
//       { upsert: true }
//     );

//     res.send(validationResponse)
//   } catch (error) {
//     logger.info("error----------->", error);
//   }
// });
router.post(
  "/issue-track",
  authenticateJWT,
  //IssueTrack.single("file"),
  async (req, res) => {
    try {
      logger.info("-----issue-track-log--------->");

      const { userId } = req.user;
      const { LOGGER_ATTEMP } = GetConfig();
      const user = await db.collection("game_users").findOne({
        _id: getInfo.MongoID(userId),
      });

      if (!user) {
        return res.status(404).send({
          success: false,
          errorCode: "1069",
          Type: "Response",
          message: baseResponse.USER_NOT_FOUND,
        });
      }

      const getListLogger = await db.collection("issue_raise").find({ userId: getInfo.MongoID(userId), status: "PENDING" }).toArray();
      logger.info("-----issue-track-LOGGER_ATTEMP--------->", LOGGER_ATTEMP, getListLogger.length);

      if (getListLogger && getListLogger.length >= LOGGER_ATTEMP) {
        return res.status(404).send({
          success: false,
          errorCode: "1069",
          Type: "Response",
          message: baseResponse.MAX_ISSUE_RAISED,
        });
      }

      const { userQueryInput, issueType } = covertStringToObject(req.body);
      const ticket_id = getInfo.MongoID()
      addressProofQueueClass.loggerUploadQueue({ userId: user._id.toString(), file: req.files.file.data, ticket_id: ticket_id });

      // const errorLogLocation = await fileUpload({
      //   fileContent: req.files.file.data, //await imageCompress(req.file.buffer),
      //   folderCategoryLocation: "log_file_error",
      //   fileCategoryName: "FRONTLOG",
      //   uniqueId: user._id.toString(),
      //   folderType: "file",
      //   extension: "txt",
      // });
      const issueData = {
        ticket_id: ticket_id,
        userId: getInfo.MongoID(user._id),
        issueType: issueType,
        userQueryInput: userQueryInput,
        status: "PENDING",
        crm_comment: "",
        //errorLog: errorLogLocation.Location,
        wcreate_date: new Date(),
      };
      const returnData = await db
        .collection("issue_raise")
        .insertOne(issueData);
      //calling the fresh desk api
      // const dataInput = "<h4>Ticket Logged </h4> " + issueData.ticket_id.toString() + " <br> <h4>User Description:</h4>  " + issueData.userQueryInput  + "<br><h4> User Unique_Id:</h4> " + user.unique_id
      const dataInput =
        `<table>
        <tr>
          <td>Ticket Logged ID:</td>
          <td>`+ issueData.ticket_id.toString() + `</td>
        </tr>
        <tr>
          <td>User Description:</td>
          <td>`+ issueData.userQueryInput + `</td>
        </tr>
        <tr>
          <td>User Unique ID:</td>
          <td>`+ user.unique_id + `</td>
        </tr>
      </table>`
      const datatoput = {
        description: dataInput,
        subject: issueData.issueType,
        phone: user.phn,
        priority: 1,
        status: 3,
        name: user.unique_id,
        id: issueData.ticket_id
      }

      await ticketCreater(datatoput)
      return res
        .status(200)
        .send({ success: true, message: baseResponse.ISSUE_INFO });
    } catch (error) {
      logger.info("error-----error-log--------->", error);
      getInfo.exceptionError(error);
      return res
        .status(400)
        .send({ success: false, error: baseResponse.ISSUE_ERROR, message: baseResponse.ISSUE_ERROR });
    }
  }
);

router.get("/getissues", authenticateJWT, async (req, res) => {
  try {
    const { userId } = req.user;

    const user = await db.collection("game_users").findOne({
      _id: getInfo.MongoID(userId),
    });

    if (!user) {
      return res.status(404).send({
        success: false,
        errorCode: "1069",
        Type: "Response",
        message: baseResponse.USER_NOT_FOUND,
      });
    }
    const getlist = await db.collection("issue_raise").find({ userId: getInfo.MongoID(userId) }).project({ ticket_id: 1, status: 1, issueType: 1, crm_comment: 1, freshdesk_id: 1 }).sort({ wcreate_date: -1 }).limit(3).toArray();
    const newTicket = getInfo.MongoID();
    for (let ticket of getlist) {
      await viewticket(ticket.freshdesk_id)
    }
    const data = {
      getlist: getlist,
      newTicket: newTicket,
    };
    res.data = data;
    return res.status(200).send({ success: true, data: res.data });
  } catch (error) {
    logger.info("error-----error-log--------->", error);
    getInfo.exceptionError(error);
    return res.status(400).send({ success: false, error: error });
  }
});



router.get("/getpennydetails", authenticateJWT, async (req, res) => {
  try {
    const requestType = req.query.type;
    const details = await db
      .collection("user_details")
      .find({ docType: "BANK", penny_status: requestType })
      .toArray();

    res.status(200).send({ success: true, data: details });
  } catch (error) {
    logger.info("----error---------> addCashAirPayResponse post", error);
    getInfo.exceptionError(error);
  }
});
router.get("/get_firsttime_user", authenticateJWT, async (req, res) => {
  try {
    const details = await db
      .collection("game_users")
      .find({ firstTimeOfferUsed: true }).project(
        {
          _id: 1,
          phn: 1,
          state: 1
        })
      .toArray();

    res.status(200).send({ success: true, data: details });
  } catch (error) {
    logger.info("----error---------> addCashAirPayResponse post", error);
    getInfo.exceptionError(error);
  }
});

router.get("/get_firsttime_user_details", async (req, res) => {
  try {
    const details = await db
      .collection("game_users")
      .find({ isFirstTimeUser: true }).project(
        {
          _id: 1,
          phn: 1,
          state: 1
        })
      .toArray();

    res.status(200).send({ success: true, data: details });
  } catch (error) {
    logger.info("----error---------> addCashAirPayResponse post", error);
    getInfo.exceptionError(error);
  }
});

module.exports = router;

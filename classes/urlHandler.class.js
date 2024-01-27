const express = require("express");
const router = express.Router();
const axios = require("axios");
const {
  replaceKeyNewToOld,
  replaceKeyOldToNew,
} = require("./replaceKey.class");
const jwt = require("jsonwebtoken");
const checkApkVersion = require("../utils/checkVersion");
const { otpTemplate, otpKey, subexidc_key, subexidc_baseURL } = require("../utils/config");
const signupClass = require("./signup.class");
const logger = require("../utils/logger");
const getInfo = require("../common");
const { GetConfig } = require("../connections/mongodb");
const { globalConfigUpdate } = require("./commonData.class");
const { getRedisInstances } = require("../connections/redis");

const authenticateJWT = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader) {
      const user = await jwt.verify(authHeader, process.env.JwtSecretKey);
      req.user = user;
      next();
    } else {
      res
        .status(401)
        .send({ message: "Token is not provided", success: false });
    }
  } catch (error) {
    return res.status(400).send({ error, success: false });
  }
};

router.post("/AppConfig", async function (req, res) {
  try {
    /* check APK version */
    logger.info("updateApk---------------> req.body", req.body);
    const { ENC_DEC_FLAG } = GetConfig();
    const updateApk = await checkApkVersion(req.body.version, req.body.storeUser);

    logger.info("updateApk--------------->", updateApk);
    const skipFlag = updateApk.skip; // if true than skip kri sake, false hoy forcefully
    logger.info("skipFlag----------->", skipFlag);
    logger.info("deviceID----------->", req.body.deviceID);

    const showData = await db
      .collection("game_users")
      .find({
        dids: req.body.deviceID,
      })
      .toArray();

    let isShowPromeCode;
    if (showData.length == 0) {
      isShowPromeCode = true;
    } else {
      isShowPromeCode = false;
    }
    // isShowPromeCode - true then display , false not display
    logger.info("isEncryptionData: ENC_DEC_FLAG,", ENC_DEC_FLAG);
    //updateApk.flag = false
    if (updateApk.flag) {
      return res.status(404).send({
        message: "Update available",
        success: false,
        payload: {
          version: {
            flag: updateApk.flag,
            live_version: updateApk.live_version,
            current_version: updateApk.current_version,
            skipFlag: skipFlag,
            latestApkUrl: updateApk.latestApkUrl,
          },
          isEncryptionData: ENC_DEC_FLAG,
          isShowPromeCode: isShowPromeCode,
        },
      });
    } else {
      return res.status(200).send({
        message: "No Update available",
        success: true,
        payload: {
          version: {
            flag: updateApk.flag,
            live_version: updateApk.live_version,
            current_version: updateApk.current_version,
          },
          isEncryptionData: ENC_DEC_FLAG,
          isShowPromeCode: isShowPromeCode,
        },
      });
    }
  } catch (error) {
    logger.info("error----------->", error);
    return res.status(400).send({ success: false, error: error.message });
  }
});

router.post("/updateConfig", async function (req, res) {
  try {
    gameConfig = await db.collection("config").findOne();
    logger.info("error-------gameConfig---->", gameConfig);

    globalConfigUpdate();
    return res.status(200).send({ message: "config updated.", success: true, });
  } catch (error) {
    logger.info("error----------->", error);
    return res.status(400).send({ success: false, error: error.message });
  }
});
router.post("/ReferralCode", async function (req, res) {
  try {
    const { referralCode } = req.body;
    logger.info("referralCode-------------->", referralCode);
    const findUser = await db.collection("game_users").findOne({
      rfc: referralCode,
    });
    if (findUser) {
      return res.status(200).send({
        message: "Valid ReferralCode",
        success: true,
        payload: {
          validReferralCode: referralCode,
        },
      });
    } else {
      return res.status(404).send({
        message: "Invalid ReferralCode",
        success: false,
        payload: {},
      });
    }
  } catch (error) {
    return res.status(400).send({ success: false, error: error.message });
  }
});

async function sendOtpToUser(phone) {
  if (phone === "1111111111") {
    return "1234";
  } else if (

    // process.env.environment === "development" ||
    process.env.environment === "production"
  ) {
    const { TIMER_OTP, TIMER_OTP_T } = GetConfig();

    logger.info("sendOtpToUser------------->", phone);
    const timer = TIMER_OTP;
    const template = otpTemplate;
    const apiKey = otpKey;
    const sendOtpURL = `https://api.msg91.com/api/v5/otp?template_id=${template}&mobile=91${phone}&authkey=${apiKey}&otp_expiry=${timer}`;
    let request_options1 = {
      method: "get",
      url: sendOtpURL,
    };

    let otpResponse = await axios(request_options1);
    logger.info("otpResponse------------>", otpResponse.data);
    return otpResponse.data;
  }
  return "0000";
}

router.post("/login", async function (req, res) {
  logger.info("/login------------------->>>>>", req.body);

  try {
    const { TIMER_OTP_T, TIMER_OTP, USER_LIMIT_PER_DEVICE, MAX_MOBILE_REGISTER } = GetConfig();
    const redisInstances = getRedisInstances();
    const otp_attemp_SET = await redisInstances.SET(`otp-attemp:${req.body.MobileNumber}`, 0);
    const lvt = await redisInstances.SET(
      `loginApi:${req.body.MobileNumber}`,
      1,
      {
        EX: TIMER_OTP_T - 1,
        NX: true,
      }
    );
    logger.info("lvt----------------->", lvt);
    if (!lvt) {
      logger.info("in if---", "loginAPi");
      return false
    }
    //find mobile details
    let totalRegisterUser_mobile = await db
      .collection("device_details")
      .find({
        phn: req.body.MobileNumber,
        deviceID: req.body.deviceID,
        _isRegister: true,
      })
      .toArray();
    if (totalRegisterUser_mobile.length == 0) {
      let totalRegisterUser_mobile_1 = await db
        .collection("device_details")
        .find({
          phn: req.body.MobileNumber,
          _isRegister: true,
        })
        .toArray();
      //entry
      let updateDeviceDetails = {}
      updateDeviceDetails.deviceID = req.body.deviceID;
      updateDeviceDetails.deviceName = req.body.deviceName;
      updateDeviceDetails.phn = req.body.MobileNumber;
      updateDeviceDetails._isRegister = false;


      if (totalRegisterUser_mobile_1.length >= MAX_MOBILE_REGISTER) {

        return res.status(200).send({
          // message: "You cannot register more than 3 accounts with same Mobile number.",
          success: false,
          showPopup: {
            isVisible: true,
            popupMessage: "You cannot register more than 3 accounts with same Mobile number.",
            header: "Blocked User"
          },
        });
      }
      await db.collection("device_details").findOneAndUpdate(
        {
          deviceID: req.body.deviceID,
          phn: req.body.MobileNumber,
        },
        {
          $set: {
            //userId :req.user._id,
            deviceName: req.body.deviceName,
            _isRegister: false,
          },
        },
        { new: true, upsert: true }

      );
    }

    let freshUser = false;
    let user = await db
      .collection("game_users")
      .findOne({ phn: req.body.MobileNumber });

    if (!user) {
      freshUser = true;
      user = await db
        .collection("fresh_users")
        .findOne({ phn: req.body.MobileNumber });
    }

    const timer = TIMER_OTP_T;
    //if fresh true
    // if (freshUser) {


    //find device details
    let totalRegisterUser_device = await db
      .collection("device_details")
      .find({
        deviceID: req.body.deviceID,
        _isRegister: true,
      })
      .toArray();
    logger.info("---length--------->", totalRegisterUser_device.length);
    if (totalRegisterUser_device.length >= USER_LIMIT_PER_DEVICE) {
      let totalRegisterUser_mobile = await db
        .collection("device_details")
        .find({
          phn: req.body.MobileNumber,
          deviceID: req.body.deviceID,
          _isRegister: true,
        })
        .toArray();
      if (totalRegisterUser_mobile.length != 1) {
        return res.status(200).send({
          success: false,
          showPopup: {
            isVisible: true,
            popupMessage: "You cannot register more than 3 accounts with same Device.",
            header: "Blocked User"
          },
        });
      }

    }


    // }

    if (!user) {
      /* OTP Integration */
      const OTP = await sendOtpToUser(req.body.MobileNumber);
      logger.info("OTP------------->", OTP);
      req.body = replaceKeyNewToOld(req.body);
      user = await signupClass.getUserDefaultFieldsNew(req.body, "client");
      user.OTP = OTP;
      // for script only
      if (req.body.scriptUser) {
        user.scriptUser = true;
        user.depositCash = 100000;
      }




      const userData = await db.collection("fresh_users").insertOne(user);

      user._id = userData.insertedId;
      // const deviceDetails = await db.collection("device_details").insertOne({
      //   userId:user._id,
      //     deviceID: req.body.DeviceId,
      //     deviceName:req.body.deviceName,
      //     det:req.body.det,
      //     phn:req.body.MobileNumber,
      //     _isRegister: true,
      // })
    } else if (user.IsBlock) {
      const accessToken = jwt.sign(
        { userId: user._id },
        process.env.JwtSecretKey,
        {
          expiresIn: "15d",
        }
      );

      return res.status(200).send({
        message: "OTP sent to your number",
        success: true,
        payload: {
          userblocked: { message: "User is blocked", isBlocked: true },
          user: { id: user._id, accessToken: accessToken, otpTimer: timer },
        },
      });
    } else {
      /* OTP Integration */
      const OTP = await sendOtpToUser(req.body.MobileNumber);
      logger.info("OTP------------->", OTP);
      req.body = replaceKeyNewToOld(req.body);
      logger.info("req.body-----else-------->", req.body);
      user.dids.push(req.body.DeviceId);
      user.dids = user.dids.filter((v, i, a) => a.indexOf(v) === i);

      let collection = "game_users";
      if (freshUser) collection = "fresh_users";

      await db.collection(collection).updateOne(
        { _id: user._id },
        {
          $set: {
            phn: req.body.MobileNumber,
            det: req.body.det,
            OTP: OTP,
            version: req.body.version,
            dids: user.dids,
          },
        }
      );
    }

    const accessToken = jwt.sign(
      { userId: user._id },
      process.env.JwtSecretKey,
      {
        expiresIn: "15d",
      }
    );

    return res.status(200).send({
      message: "OTP sent to your number",
      success: true,
      payload: {
        userblocked: { message: "User is not blocked", isBlocked: false },
        user: { id: user._id, accessToken: accessToken, otpTimer: timer },
      },
    });
  } catch (error) {
    logger.info("/login------------------->>>>> error", error);
    logger.info("/login----------1--------->>>>> error", error.message);
    return res.status(400).send({ success: false, error: error.message });
  }
});

async function verifyOTP(otp, phone) {
  if (phone === "1111111111" && otp === "1234") {
    return { type: "success", message: "OTP verified success" };
  } else if (
    process.env.environment === "production"
    // process.env.environment === "staging" 
  ) {
    logger.info("verifyOTP------------->", otp, phone);
    const apiKey = otpKey;
    const verifyOtpURL = `https://api.msg91.com/api/v5/otp/verify?otp=${otp}&authkey=${apiKey}&mobile=91${phone}`;
    logger.info("verifyOtpURL--------->", verifyOtpURL);
    let request_options1 = {
      method: "get",
      url: verifyOtpURL,
    };

    let verifyOtpResponse = await axios(request_options1);
    logger.info("verifyOtpResponse------------>", verifyOtpResponse.data);
    return verifyOtpResponse.data;
  } else {
    if (phone !== "1111111111" && otp === "0000") {
      return { type: "success", message: "OTP verified success" };
    }
    return { type: "error", message: "OTP not match" };
  }
}

router.post("/verify-otp", authenticateJWT, async function (req, res) {
  logger.info("/verify-otp------------------->>>>>", req.body);
  // let UserIp = req._remoteAddress.split(":")
  if (!req.body.userId) {
    req.body.userId = req.user.userId;
  }
  try {
    const { EXPIRE_SIGN_UP_BONUS, EXPIRE_REFERRAL_BONUS, BONUS_REFERRAL } = GetConfig();
    let freshUser = false;
    // const redisInstances = getRedisInstances();
    // const lvt = await redisInstances.SET(
    //   `verifyAPi:${req.body.userId}`,
    //   1,
    //   {
    //     EX: 10,
    //     NX: true,
    //   }
    // );
    // logger.info("lvt----------------->", lvt);
    // if (!lvt) {
    //   logger.info("in if---", "verifyAPi");
    //   return res
    //     .status(404)
    //     .send({ message: "one proccess is running", success: false });
    // }
    let user = await db.collection("game_users").findOne({
      _id: getInfo.MongoID(req.body.userId),
    });

    if (!user) {
      freshUser = true;
      user = await db
        .collection("fresh_users")
        .findOne({ _id: getInfo.MongoID(req.body.userId) });
    }

    if (!user) {
      return res
        .status(404)
        .send({ message: "User not found", success: false });
    }

    //verify
    //let updateDeviceDetails = {};
    let isFirstTimeUser = false;
    let SPRes = {
      det: user.det,
      nwt: user.nwt,
      ult: user.ult,
      DeviceId: user.DeviceId,
      rfc: user.rfc,
      un: user.un,
      pp: user.pp,
      ID: user.tId,
      ue: user.ue,
      userId: user._id.toString(),
      mobileNumber: user.phn,
      isBlock: user.IsBlock,
      emailVerify: user.EmailVerify,
      mobileVerify: user.MobileVerify,
      state: user.state,
    };
    const { OTP_ATTEMP } = GetConfig()
    //get the stored value
    const redisInstances = getRedisInstances();
    const otp_attemp = await redisInstances.GET(`otp-attemp:${req.body.phn}`);
    if (otp_attemp && parseInt(otp_attemp) == OTP_ATTEMP) {
      //const otp_attemp_incr = await redisInstances.INCR(`otp-attemp:${req.body.phn}`);
      SPRes = replaceKeyOldToNew(SPRes);
      return res.status(404).send({
        message:
          "Please wait for Resend OTP Option",
        success: false,
        user: SPRes,
      });
    }
    const verify = await verifyOTP(req.body.OTP, user.phn);
    logger.info("verify---------->", verify);
    logger.info("freshUser------->", freshUser);

    if (verify.type == "success") {
      //check user login with any other number
      let updateDeviceDetails = {}
      updateDeviceDetails._isRegister = true;
      updateDeviceDetails.userId = user._id;
      await db.collection("device_details").findOneAndUpdate(
        {
          deviceID: req.body.deviceID,
          phn: req.body.phn
        },
        { $set: updateDeviceDetails }
      );
      if (!user.isFirstTimeUser) {
        isFirstTimeUser = false
      }
      else {
        isFirstTimeUser = true
        //   let unique_device = await db
        //   .collection("device_details")
        //   .find({
        //     //deviceID: req.body.deviceID,
        //     phn:req.body.phn,
        //     _isRegister: true,
        //   }).toArray()
        //   if(unique_device.length==1){

        //     isFirstTimeUser=true
        //   }
        //   else{
        //     isFirstTimeUser=false
        //   }

      }


      if (freshUser) {

        let unique_device = await db
          .collection("device_details")
          .find({
            deviceID: req.body.deviceID,
            _isRegister: true,
          }).toArray()
        let unique_mobile = await db
          .collection("device_details")
          .find({
            phn: req.body.phn,
            _isRegister: true,
          }).toArray()
        if (unique_device.length == 1 && unique_mobile.length == 1) {


          //check device or mobile is register true of not
          let unique_mobile_false = await db
            .collection("device_details")
            .find({
              phn: req.body.phn,
              _isRegister: false,
            }).toArray()
          if (unique_mobile_false.length > 0) {
            isFirstTimeUser = false;
          }
          else {
            isFirstTimeUser = true;
          }
          //check device or mobile is register true of not
          let unique_device_false = await db
            .collection("device_details")
            .find({
              deviceID: req.body.deviceID,
              _isRegister: false,
            }).toArray()
          if (unique_device_false.length > 0) {
            isFirstTimeUser = false;
          }

          //await db.collection("first_timer_user").insertOne(user)


        }
        user = await db.collection("game_users").insertOne(user);
        user = user.ops[0];

        let inserData = {
          uid: getInfo.MongoID(req.body.userId),
          un: user.un,
          ue: user.ue,
          c: user.depositCash,
          tp: "FreeCash Added",
          sts: "success",
          cd: new Date(),
          depositCash: user.depositCash,
          withdrawableCash: user.Winning,
        };

        await db.collection("cash_track").insertOne(inserData);
        await db.collection("fresh_users").deleteOne({ _id: user._id });

        //**************get Ip data of the users******************** */
        // const findIp = await db.collection("UsedIP").findOneAndUpdate({ ip: UserIp[3] }, { $push: { userId: user._id.toString() }, $inc: { count: 1 } })
        // if (!findIp.value) {
        //   let addIp = await db.collection("UsedIP").insertOne({ ip: UserIp[3], userId: [user._id].toString(), count: 1 });
        //   //console.log(addIp)
        // }
        // else{
        //   if(findIp.value.count>1){
        //     return res.status(400).send({ success: false, error: "you can't register with same ip" }); 
        //   }
        //}

      }
      // else{
      //   if(user.isFirstTimeUser){
      //     isFirstTimeUser =true
      //   }
      // }


      let user_referral_bonus = [],
        referUsedFlag = user.flags._usedRFCcode;

      const { userReferralCode } = req.body;
      if (user.flags._usedRFCcode == false) {
        if (userReferralCode) {
          let current_date, expire_date, days;
          days = EXPIRE_REFERRAL_BONUS;
          current_date = new Date();
          expire_date = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

          let findUser = await db.collection("game_users").findOne({
            rfc: userReferralCode,
          });
          if (findUser) {
            logger.info("findUser---------->", findUser._id);
            await db.collection("game_users").findOneAndUpdate(
              { _id: findUser._id },
              {
                $push: {
                  referral_bonus: {
                    referralBonus: BONUS_REFERRAL,
                    current_date: current_date,
                    expire_date: expire_date,
                    status: "Active",
                    _id: getInfo.MongoID(),
                  },
                },
              },
              { new: true }
            );

            referUsedFlag = true;
            user_referral_bonus = [
              {
                referUsedId: getInfo.MongoID(findUser._id),
                referralBonus: BONUS_REFERRAL,
                current_date: current_date,
                expire_date: expire_date,
                status: "Active",
                _id: getInfo.MongoID(),
              },
            ];
          } else {
            logger.info("in valid referral code");
          }
        }
        logger.info("user_referral_bonus------------>", user_referral_bonus);
      }

      const userData = {
        isLogin: true,
        isFirstTimeUser: isFirstTimeUser,
        OTP: req.body.OTP,
        MobileVerify: true,
        usedRFCcode: userReferralCode,
        "flags._usedRFCcode": referUsedFlag,
      };

      if (user_referral_bonus.length > 0) {
        userData.referral_bonus = user_referral_bonus;
      }

      await db.collection("game_users").updateOne(
        { _id: user._id },
        {
          $set: userData,
        }
      );



      SPRes = replaceKeyOldToNew(SPRes);
      return res.status(200).send({
        message: verify.message,
        success: true,
        user: SPRes,
      });
    } else {
      if (verify.message == "OTP not match") {
        if (otp_attemp && parseInt(otp_attemp) < OTP_ATTEMP) {
          const otp_attemp_incr = await redisInstances.INCR(`otp-attemp:${req.body.phn}`);
          SPRes = replaceKeyOldToNew(SPRes);
          return res.status(404).send({
            message:
              verify.message || "Mobile no. already verified",
            success: false,
            user: SPRes,
          });
        }
        else {
          SPRes = replaceKeyOldToNew(SPRes);
          return res.status(404).send({
            message:
              "Please wait for Resend OTP Option",
            success: false,
            user: SPRes,
          });
        }
        //store the count in redis
      }
      else {
        SPRes = replaceKeyOldToNew(SPRes);
        return res.status(404).send({
          message:
            verify.message || "Mobile no. already verified",
          success: false,
          user: SPRes,
        });
      }

    }
  } catch (error) {
    logger.info("/verify-otp------------------->>>>> error", error.message);
    return res.status(400).send({ error, success: false });
  }
});

async function resendOtpToUser(phone) {
  logger.info("resendOtpToUser------------->", phone);
  if (phone === "1111111111") {
    return "1234";
  } else if (

    // process.env.environment === "development" ||
    process.env.environment === "production"
  ) {
    const { TIMER_OTP, TIMER_OTP_T } = GetConfig();

    logger.info("sendOtpToUser------------->", phone);
    const timer = TIMER_OTP;
    const apiKey = otpKey;
    const resendOtpURL = `https://api.msg91.com/api/v5/otp/retry?authkey=${apiKey}&retrytype=text&mobile=91${phone}&otp_expiry=${timer}`;
    let request_options1 = {
      method: "get",
      url: resendOtpURL,
    };

    let otpResponse = await axios(request_options1);
    logger.info("otpResponse------------>", otpResponse.data);
    return otpResponse.data;
  }
  return "0000";
}

router.post("/resend-otp", authenticateJWT, async function (req, res) {
  try {
    const { TIMER_OTP_T, TIMER_OTP } = GetConfig();
    const { userId } = req.user;
    let user = await db.collection("game_users").findOne({
      _id: getInfo.MongoID(userId),
    });

    if (!user) {
      user = await db.collection("fresh_users").findOne({
        _id: getInfo.MongoID(userId),
      });
      // return res
      //   .status(404)
      //   .send({ message: "User not found", success: false });
    }

    if (!user) {
      user = await db.collection("fresh_users").findOne({
        _id: getInfo.MongoID(userId),
      });
      return res
        .status(404)
        .send({ message: "User not found", success: false });
    }
    // OTP Integration
    const redisInstances = getRedisInstances();
    const otp_attemp_SET = await redisInstances.SET(`otp-attemp:${user.phn}`, 0);

    const resendOTP = await resendOtpToUser(user.phn);
    logger.info("resendOTP------------->", resendOTP);
    if (resendOTP.type == "success") {
      const accessToken = jwt.sign(
        { userId: user._id },
        process.env.JwtSecretKey,
        {
          expiresIn: "15d",
        }
      );

      const timer = TIMER_OTP_T;
      res.status(200).send({
        message: "OTP sent to your number",
        success: true,
        user: { id: user._id, accessToken, otpTimer: timer },
      });
    } else {
      res.status(200).send({
        message: resendOTP.message,
        success: false,
        user: { id: user._id },
      });
    }
  } catch (error) {
    logger.info("/resend-otp------------------->>>>> error", error);
    return res.status(400).send({ success: false, error: error.message });
  }
});

router.post("/removeScriptUsers", async function (req, res) {
  try {
    let users = await db.collection("game_users").aggregate([{
      '$match': { 'scriptUser': true }
    }, { '$group': { '_id': '$_id' } }, { '$project': { 'stringId': { '$toString': '$_id' } } }
    ]).toArray();
    let ObjectId = [], StringId = [];
    for (const iterator of users) {
      ObjectId.push(iterator._id);
      StringId.push(iterator.stringId);
    }
    let cash_track = await db.collection("cash_track").distinct("_id", { uid: { $in: ObjectId } });
    let device_details = await db.collection("device_details").distinct("_id", { userId: { $in: ObjectId } });
    let play_track = await db.collection("play_track").distinct("_id", { "pi.uid": { $in: StringId } });
    let playing_track = await db.collection("playing_track").distinct("_id", { uid: { $in: ObjectId } });
    let tds_track = await db.collection("tds_track").distinct("_id", { winid: { $in: ObjectId } });
    let upc_tracking = await db.collection("upc_tracking").distinct("_id", { uid: { $in: StringId } });
    let user_cash_percent = await db.collection("user_cash_percent").distinct("_id", { userId: { $in: StringId } });
    let leave_tracking = await db.collection("leave_tracking").distinct("_id", { uid: { $in: StringId } });
    let playing_history = await db.collection("playing_history").distinct("_id", { "pi.uid": { $in: StringId } });
    let playing_table = await db.collection("playing_table").distinct("_id", { "pi.uid": { $in: StringId } });
    let tableHistory = await db.collection("tableHistory").distinct("_id", { "user.userId": { $in: StringId } });


    let users_delete = await db.collection("game_users").deleteMany({ _id: { $in: ObjectId } });
    let cash_track_delete = await db.collection("cash_track").deleteMany({ _id: { $in: cash_track } });
    let device_details_delete = await db.collection("device_details").deleteMany({ _id: { $in: device_details } });
    let play_track_delete = await db.collection("play_track").deleteMany({ _id: { $in: play_track } });
    let playing_track_delete = await db.collection("playing_track").deleteMany({ _id: { $in: playing_track } });
    let tds_track_delete = await db.collection("tds_track").deleteMany({ _id: { $in: tds_track } });
    let upc_tracking_delete = await db.collection("upc_tracking").deleteMany({ _id: { $in: upc_tracking } });
    let user_cash_percent_delete = await db.collection("user_cash_percent").deleteMany({ _id: { $in: user_cash_percent } });
    let leave_tracking_delete = await db.collection("leave_tracking").deleteMany({ _id: { $in: leave_tracking } });
    let playing_history_delete = await db.collection("playing_history").deleteMany({ _id: { $in: playing_history } });
    let playing_table_delete = await db.collection("playing_table").deleteMany({ _id: { $in: playing_table } });
    let tableHistory_delete = await db.collection("tableHistory").deleteMany({ _id: { $in: tableHistory } });


    if (!users) return res.status(404).send({ message: "User not found", success: false });
    res.status(200).json(users);
  } catch (error) {
    logger.info("/resend-otp------------------->>>>> error", error);
    return res.status(400).send({ success: false, error: error.message });
  }
});
module.exports = router;

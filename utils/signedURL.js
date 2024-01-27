const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const axios = require("axios").default;
const Joi = require("joi");
const AWS = require('aws-sdk');
const logger = require("../utils/logger");
const getInfo = require("../common");
const moment = require("moment");
const { getRedisInstances } = require("../connections/redis");
const {
    bucket,
    s3_key_id,
    s3_bucket_secrete_key,
    s3_bucket_region,
    environment,
    idfyAccountId,
    idfyKey
} = require("../utils/config");
const { GetConfig } = require("../connections/mongodb");

const { isNull } = require("underscore");
const s3 = new AWS.S3({
    accessKeyId: s3_key_id,
    secretAccessKey: s3_bucket_secrete_key,
    region: s3_bucket_region
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
      //getInfo.exceptionError(error);
      return res.status(400).send({ success: false, error: error });
    }
}
router.get("/getSignedUrl_adhaar", authenticateJWT, async (req, res) => {
    const { userId } = req.user;
    try {
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
      const response  = await getSignedUrl_base(userId)
      return res.send({
        status: 200,
        success: true,
        data: response,
        message: "URL Genrated",
      });
    } catch (error) {
      logger.info("error---->", error);
      //etInfo.exceptionError(error);
      return res.json({ success: false, error: error })
    }
    
    
});
router.get("/getSignedUrl_pan", authenticateJWT, async (req, res) => {
  const { userId } = req.user;
  try {
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
    const response  = await getSignedUrl_basePan(userId)
    return res.send({
      status: 200,
      success: true,
      data: response,
      message: "URL Genrated",
    });
  } catch (error) {
    logger.info("error---->", error);
    //etInfo.exceptionError(error);
    return res.json({ success: false, error: error })
  }
  
  
});
router.get("/getSignedUrl_feedBack", authenticateJWT, async (req, res) => {
  const { userId } = req.user;
  try {
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
    const response  = await getSignedUrl_feedback(userId)
    return res.send({
      status: 200,
      success: true,
      data: response,
      message: "URL Genrated",
    });
  } catch (error) {
    logger.info("error---->", error);
    //etInfo.exceptionError(error);
    return res.json({ success: false, error: error })
  }
  
  
});
router.get("/getSignedUrl_logger", authenticateJWT, async (req, res) => {
  const { userId } = req.user;
  try {
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
    const response  = await getSignedUrl_logger(userId)
    return res.send({
      status: 200,
      success: true,
      data: response,
      message: "URL Genrated",
    });
  } catch (error) {
    logger.info("error---->", error);
    //etInfo.exceptionError(error);
    return res.json({ success: false, error: error })
  }
  
  
});

async function getSignedUrl_feedback(userId) {
  try {
    const time = new Date().getMilliseconds()
    const feedbackImage = environment+"/images/feedback/FEEDBACK_"+userId+"-"+time+".jpg"
    const params_back = {
        Bucket: bucket,
        Key: feedbackImage,
        ContentType: 'application/octet-stream',
        Expires: 300 // URL expiration time in seconds
    };
    
  const url_feedback  =  await getSignedUrl(params_back);
  res = { url_feedback, time}
  return res
  } catch (error) {
    logger.info("error---->", error);
    getInfo.exceptionError(error);
    return { success: false, error: error }
  }
}
async function getSignedUrl_logger(userId) {
  try {
    
    const time = new Date().getMilliseconds()
    const panImageUpload = environment+"/file/log_file_error/FRONT_LOG_"+userId+"-"+time+".txt"
    const params = {
        Bucket: bucket,
        Key: panImageUpload,
        ContentType: 'application/octet-stream',
        Expires: 300 // URL expiration time in seconds
    };
    
  const url_logger  =  await getSignedUrl(params);
  res = { url_logger, time }
  return res
  } catch (error) {
    logger.info("error---->", error);
    getInfo.exceptionError(error);
    return { success: false, error: error }
  }
}

async function getSignedUrl_base(userId) {
  try {
    const time = new Date().getMilliseconds()
    const backSideImageUpload = environment+"/images/document-proof/DOCUMENT_PROOF_BACKSIDE_"+userId+"-"+time+".jpg"
    const params_back = {
        Bucket: bucket,
        Key: backSideImageUpload,
        ContentType: 'application/octet-stream',
        Expires: 300 // URL expiration time in seconds
    };
    const frontSideImageUpload = environment+"/images/document-proof/DOCUMENT_PROOF_FRONT_SIDE_"+userId+"-"+time+".jpg"
    const params_fornt = {
      Bucket: bucket,
      Key: frontSideImageUpload,
      ContentType: 'application/octet-stream',
      Expires: 300 // URL expiration time in seconds
  };
  const url_front  =  await getSignedUrl(params_fornt);
  const url_back  =  await getSignedUrl(params_back);
  res = { url_front, url_back, time}
  return res
  } catch (error) {
    logger.info("error---->", error);
    getInfo.exceptionError(error);
    return { success: false, error: error }
  }
}
async function getSignedUrl_basePan(userId) {
  try {
    
    const time = new Date().getMilliseconds()
    const panImageUpload = environment+"/images/pan_images/PAN_"+userId+"-"+time+".jpg"
    const params = {
        Bucket: bucket,
        Key: panImageUpload,
        ContentType: 'application/octet-stream',
        Expires: 300 // URL expiration time in seconds
    };
    
  const url_pan  =  await getSignedUrl(params);
  res = { url_pan, time }
  return res
  } catch (error) {
    logger.info("error---->", error);
    getInfo.exceptionError(error);
    return { success: false, error: error }
  }
}

async function getSignedUrl(params){
  return new Promise((resolve,reject) => {
    s3.getSignedUrl('putObject', params, (err, url) => {
      if (err) reject(err);
      resolve(url);
    });
});
}
router.post("/updateAdhaarStatus", authenticateJWT, async (req, res) => {
  const { BUCKET_URL } = GetConfig()
  const { userId } = req.user;
  const { birthDate, state, documentType,time } = req.body;
  try {

    if ( userId || birthDate || state || documentType ) {

      let dateSplit = birthDate.split(" ")[0];
      dateSplit = moment(new Date(Date.parse(dateSplit))).format(
        "MM/DD/YYYY"
      );

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

      const years = moment().diff(new Date(bithday), "years", false);
      logger.info("yearsyears", years);

      logger.info("years < 18", years < 18);

      if (years < 18) {
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
        logger.info("user", "User Not Found");
        return res.status(200).send({
          success: false,
          errorCode: "1069",
          Type: "Response",
          message: "User Not Found",
        });
      }

      await db.collection("UserAddressProof").findOneAndUpdate(
        { userId: getInfo.MongoID(userId) },
        {
          $set: {
            documentType,
            state,
            status: "PENDING",
            birthDate,
            backside:BUCKET_URL+""+environment+"/images/document-proof/DOCUMENT_PROOF_BACKSIDE_"+userId+"-"+time+".jpg",
            frontside:BUCKET_URL+""+environment+"/images/document-proof/DOCUMENT_PROOF_FRONT_SIDE_"+userId+"-"+time+".jpg",
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
      return res.status(200).send({
        success: false,
        errorCode: "0000",
        Type: "Response",
        message: "Some field are missing.",
      });
    }


    
  } catch (error) {
    logger.info("error---->", error);
    return res.json({ success: false, error: error })
  }
  
  
});

router.post(
  "/pan-image-verify-signed",
  authenticateJWT,
  // PanUpload.single("file"),
  async (req, res) => {
    try {
      const { BUCKET_URL } = GetConfig()
      const { userId } = req.user;
      const { time } = req.body;
      
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
      // const panImageLocation = panImage.Location;
      const panImageLocation = BUCKET_URL+""+environment+"/images/pan_images/PAN_"+userId+"-"+time+".jpg"
      // const panImageLocation = BUCKET_URL+""+environment+"/images/pan_images/PAN_647ef38a2364507ac40f99e6.jpg"
      logger.info("panImageLocation--------->", panImageLocation);


      const group_id = user.unique_id;

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
          errorCode: "0001",
          Type: "Response",
          message:
            "Invalid document uploaded. Please re-upload Pan and try again.",
          payload: "",
        });
      }
      if (imageResponse.result.detected_doc_type != "ind_pan" && imageResponse.result.detected_doc_type != true) {
        return res.status(200).send({
          success: false,
          errorCode: "0002",
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
          errorCode: "0003",
          Type: "Response",
          message: ocrResponse.message,
          payload: "",
        });
      }

      const { extraction_output } = ocrResponse.result;
      logger.info("group_id---1------>", group_id);
      if (isNull(extraction_output.pan_type) || extraction_output.id_number=="" || isNull(extraction_output.minor) || extraction_output.name_on_card=="" ) {

        return res.status(200).send({
          success: false,
          errorCode: "0004",
          Type: "Response",
          message:
            "Invalid document uploaded. Please re-upload Pan and try again.",
          data: "",
        });
      }

      
      if (
        extraction_output.pan_type != "Individual" ||
        extraction_output.minor
      ) {
        return res.status(200).send({
          success: false,
          errorCode: "0005",
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
          errorCode: "0006",
          Type: "Response",
          message:
            "Uploaded PAN is already linked to another user. Please re-upload PAN and try again.",
          data: "",
        });
      }
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
        errorCode: "0007",
        Type: "Response",
        message: "Valid document",
        payload: {
          panImage: panImageLocation,
          panImageLocation1: panImageLocation,
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
function covertStringToObject(obj) {
  try {
    return typeof obj === "object" ? obj : JSON.parse(obj);
  } catch (error) {
    return error;
  }
}
router.post(
  "/feedback-image-signed",
  authenticateJWT,
  // FeedbackUpload.single("file"),
  async (req, res) => {
    try {
      const { BUCKET_URL } = GetConfig()
      const { userId } = req.user;
      const { rating, description, time } = covertStringToObject(req.body);
      
      const feedbackImageLocation = BUCKET_URL+""+environment+"/images/feedback/FEEDBACK_"+userId+"-"+time+".jpg"
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

router.post(
  "/issue-track-signed",
  authenticateJWT,
  async (req, res) => {
    try {
      const { userId } = req.user;
      const { LOGGER_ATTEMP } = GetConfig();
      const { BUCKET_URL } = GetConfig()
      
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

      const getListLogger = await db
        .collection("issue_raise")
        .find({ userId: getInfo.MongoID(userId), status: "PENDING" })
        .toArray();
      if (getListLogger && getListLogger.length >= LOGGER_ATTEMP) {
        return res.status(404).send({
          success: false,
          errorCode: "1069",
          Type: "Response",
          message: baseResponse.MAX_ISSUE_RAISED,
        });
      }

      const { userQueryInput, issueType,time } = covertStringToObject(req.body);
      const errorLogLocation = BUCKET_URL+""+environment+"/images/feedback/FEEDBACK_"+userId+"-"+time+".jpg"
    
      const ticket_id = getInfo.MongoID()
      const issueData = {
        ticket_id: ticket_id,
        userId: getInfo.MongoID(user._id),
        issueType: issueType,
        userQueryInput: userQueryInput,
        status: "PENDING",
        crm_comment: "",
        errorLog: errorLogLocation,
        wcreate_date: new Date(),
      };
      const returnData = await db
        .collection("issue_raise")
        .insertOne(issueData);
      //calling the fresh desk api
      const dataInput = "Mohit kumar \n issueData.userQueryInput"
      const freshDeskData = {
        description: dataInput,
        subject: issueData.issueType,
        phone : user.phn,
        priority: 1,
        status: 2,
        title:issueData.ticket_id.toString(),
        name:user._id
      }
      await ticketCreater(freshDeskData)
      return res
        .status(200)
        .send({ success: true, message: baseResponse.ISSUE_INFO });
    } catch (error) {
      logger.info("error-----error-log--------->", error);
      getInfo.exceptionError(error);
      return res
        .status(400)
        .send({ success: false, error: baseResponse.ISSUE_ERROR,message: baseResponse.ISSUE_ERROR });
    }
  }
);



module.exports = router;

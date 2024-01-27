const Razorpay = require("razorpay");
const getInfo = require("../../../common");
const {
    razorpayKey,
    razorpaySecret,
    url,
    phonePeMerchantId,
    phonePeMerchantSaltKey,
    phonePeMerchantSaltIndex,
    goKwikAppKey,
    goKwikAppSecretKey,
    goKwikRequestUrl,
    phonePeMerchantHostUrl,
    airPayMerchantId,
    airPayUserName,
    airPayPassword,
    airPayAPIkey,
    airPayUrl
    
} = require("../../../utils/config");
const converttoJson = require('xml-js');
const axios = require("axios").default;
const logger = require("../../../utils/logger");
const { GetConfig } = require("../../../connections/mongodb");
const moment = require("moment");
const crypto = require("crypto");
const AirpayResponseStatus = require("../../../constants/airpayResponse")
const AirpayResponseType = require("../../../constants/airpayTransactionType")
//CLIENT KEYS
let instance = new Razorpay({
    key_id: razorpayKey,
    key_secret: razorpaySecret,
  });
const FormData = require('form-data');
const {getRandomString} = require("../../../utils")

const addCashAmountService = async (amount, type, targetapp, targetappios,userId,user,continueFlag)=>{
    try {
        let data;

        let orderDetails,
        razorpayAmount,
        sampleBase64,
        sampleSHA256,
        xVerify,
        phonepayRequest,
        airPayPayload,
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
          return {
            status: 400,
            data:{
                success: false,
                message: "Order created failed"
            }
            ,
          };
        }
      } else if (type == "UPI") {
        // UPI intent
  
        const targetAppCheck = targetapp || targetappios;
  
        if (!targetAppCheck) {
          return {
            status: 200,
            data:{
                success: false,
                errorCode: "0000",
                Type: "Response",
                message: "Please Provide target app."
            }
          };
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
            return {
                status:200,
                data:response.data
            };
          })
          .catch(function (error) {
            logger.info('phonepayRequest error', error);
            return {
                status:400,
                data:error.response.data
            };
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
          return {
            status:400,
            data:{
                success: false,
                message: gokwikRequest.data.statusMessage,
            }
          };
        }
        paymentFlag = "gokwik";
        paymentMethod = gokwikRequest.data.data.order_type;
        gokwikPayload = gokwikRequest.data.data;
      }
      // implementation of airpay
      else if(type == "airpay"){
        paymentFlag = "airpay"
        orderDetails = {
          id: await getRandomString(14, "user_payment", "orderId", "order"),
          receipt: await getRandomString(10, "user_payment", "receipt"),
        };
        const orderId = orderDetails.id.split("_")[1];
        const merchantId = airPayMerchantId;
        const userName = airPayUserName;
        const password = airPayPassword;
        const API_key = airPayAPIkey;
        const date = moment().format('YYYY-MM-DD');
        const userData = userName + ':|:' + password;
        const privatekey = sha256(API_key + '@' + userData);
        const email = "payments@jpfunware.com";
        const allData = email + user.phn + user.phn + "" + "" + "" + "" + amount + orderId + date;
        const keySha256 = sha256(userName + "~:~" + password);
        const checksum = sha256(keySha256 + '@' + allData);
        logger.info("checksum", checksum);
        airPayPayload = {
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
          "currency": "356",
          "isoCurrency": "INR",
          "customvar": amount,
          // "orderid": "",
          "WALLET": "0",
          "SUCCESS_URL": url + "/successAirpayResponse",
          "FAILURE_URL": url + "/failureAirpayResponse",
        };


        // let airpayPayment = {
        //   success: true,
        //   errorCode: "0000",
        //   Type: paymentFlag,
        //   message: "Data delivered successfully",
        //   airPayPayload: requestPayload
        // };
        

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
      if(paymentFlag =="airpay"){
        addUserPayment = {
          userId: getInfo.MongoID(userId),
          isFirstTimeUser,
          transactionId: await getRandomString(10, "user_payment", "transactionId"),
          orderId: orderDetails.id.split("_")[1],
          status: "PENDING",
          mode: "ADD_CASH",
          receipt: orderDetails.receipt,
          amount: +amount,
          paymentFlag,
          paymentMethod,
          create_date: new Date(),
        };
      }
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
        airPayPayload:JSON.stringify(airPayPayload)
      };
      return continueFlag ? {status:200, data:paymentData} : {status:400, data:paymentData};
      
      
  
  
    } catch (error) {
      logger.error("-----> error red flag function", error);
      getInfo.exceptionError(error);
    }
}


const checkStatusAPIAirPay = async (orderId) => {
  const merchantId = airPayMerchantId;
  const userName = airPayUserName;
  const password = airPayPassword;
  const API_key = airPayAPIkey;
  const date = moment().format('YYYY-MM-DD');
  const userData = userName + ':|:' + password;
  const privatekey = sha256(API_key + '@' + userData);
  const keySha256 = sha256(userName + "~:~" + password);
  const allData = merchantId + orderId + "" + "" + "" + date;
  const checksum = sha256(keySha256 + '@' + allData);
  var bodyFormData = new FormData();
  bodyFormData.append('merchant_id', parseInt(merchantId));
  bodyFormData.append('merchant_txn_id', orderId);
  bodyFormData.append('private_key', privatekey);
  bodyFormData.append('checksum', checksum);
  let configAxios = {
    method: "post",
    url: "https://kraken.airpay.co.in/airpay/order/verify.php",
    headers: { "Content-Type": "multipart/form-data" },
    data: {
      "merchant_id": parseInt(merchantId),
      "merchant_txn_id": orderId,
      "private_key":privatekey,
      "checksum":checksum
    },
  };

  const AirpayResponse = await axios(configAxios)
    .then(function (response) {
      logger.info("response----->checkStatusAPIAirpay", response.data);
      return response.data;
    })
    .catch(function (error) {
      logger.info("error------->checkStatusAPIAirpay", error);
      return error;
    });

  const data = JSON.parse(converttoJson.xml2json(AirpayResponse,{compact: true, spaces: 2}));
  return data;
};

function sha256(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
}
const updateAirPayResponse = async (getTransaction,orderId,userId)=>{
  const { EXPIRE_CASH_BONUS } = GetConfig();
  const listofFailed = [400,401,402,403,405];
    
  let verifyPayment, displayBonus;
    logger.info("getTransaction------->", getTransaction);
    // if (getTransaction && getTransaction.status == "PENDING") {
      //update the status of the airpay status 
      const airpayResponse = await checkStatusAPIAirPay(orderId)
      logger.info("AirPay verifyPayment------>",airpayResponse)
      // logger.info();
      if(airpayResponse){
        const userDetails = await db.collection("user_payment").findOne({
          paymentId: airpayResponse.RESPONSE.TRANSACTION.APTRANSACTIONID._cdata||"T",
          orderId: orderId,
        });
        if (!userDetails) {
          console.log(listofFailed.includes(parseInt(airpayResponse.RESPONSE.TRANSACTION.TRANSACTIONSTATUS._cdata)))
          verifyPayment = airpayResponse.RESPONSE.TRANSACTION;
          if (airpayResponse.RESPONSE.TRANSACTION.TRANSACTIONSTATUS._cdata == '200') {
            logger.info("--airpayResponse--------->", verifyPayment);
            verifyPayment.AMOUNT = parseFloat(verifyPayment.AMOUNT._cdata);

            verifyPayment.status = "SUCCESS";
            console.log({amount: verifyPayment.AMOUNT,
                  paymentMethod: "upi",
                  status: verifyPayment.status,
                  complete_date: new Date(),
                  paymentId: verifyPayment.TRANSACTIONID._cdata,
                  apiTranscationId: verifyPayment.APTRANSACTIONID._cdata,
                  airPayTransactionStatus: AirpayResponseStatus.AirpayResponseStatus[parseInt(verifyPayment.TRANSACTIONSTATUS._cdata)],
                  transactionType: AirpayResponseType.AirpayResponseType[parseInt(verifyPayment.TRANSACTIONTYPE._cdata)],
                  transactionTime: verifyPayment.TRANSACTIONTIME._cdata,
                  paymentResponse: verifyPayment})
            await db.collection("user_payment").findOneAndUpdate(
              {
                userId: getInfo.MongoID(userId),
                orderId: orderId,
              },
              {
                $set: {
                  amount: verifyPayment.AMOUNT,
                  paymentMethod: "upi",
                  status: verifyPayment.status,
                  complete_date: new Date(),
                  paymentId: verifyPayment.TRANSACTIONID._cdata,
                  apiTranscationId: verifyPayment.APTRANSACTIONID._cdata,
                  airPayTransactionStatus: AirpayResponseStatus.AirpayResponseStatus[parseInt(verifyPayment.TRANSACTIONSTATUS._cdata)],
                  transactionType: AirpayResponseType.AirpayResponseType[parseInt(verifyPayment.TRANSACTIONTYPE._cdata)],
                  transactionTime: verifyPayment.TRANSACTIONTIME._cdata,
                  paymentResponse: verifyPayment
                  
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
            displayBonus = (verifyPayment.AMOUNT * bonus_perc) / 100;

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
                c: verifyPayment.AMOUNT,
                tp: "Cash Added",
                sts: "success",
                orderId: orderId,
                transactionId: getTransaction.transactionId,
                cd: new Date(),
                depositCash: user.depositCash + verifyPayment.AMOUNT,
                withdrawableCash: user.Winning,
              };

              // await db.collection("cash_track").insertOne(insertData);

              let trobj = {
                userId: getInfo.MongoID(userId),
                orderId: orderId,
                addCash: verifyPayment.AMOUNT,
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
                let depositAmount = verifyPayment.AMOUNT + 50;
                verifyPayment.AMOUNT = depositAmount;
                verifyPayment.isOfferClaimed = true;
  
              }else{
                await db.collection("cash_track").insertOne(insertData);
  
              }
              
              await db.collection("game_users").findOneAndUpdate(
                { _id: getInfo.MongoID(userId) },
                {
                  $inc: {
                    depositCash: verifyPayment.AMOUNT,
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
          } else if (listofFailed.includes(parseInt(airpayResponse.RESPONSE.TRANSACTION.TRANSACTIONSTATUS._cdata))){
            logger.info(
              "---airpayResponse---> success false",
              airpayResponse
            );
            await db.collection("user_payment").findOneAndUpdate(
              {
                userId: getInfo.MongoID(userId),
                orderId: orderId,
              },
              {
                $set: {
                  amount: parseFloat(verifyPayment.AMOUNT._cdata),
                  paymentMethod: "upi",
                  status: "FAILED",
                  complete_date: new Date(),
                  paymentId: verifyPayment.TRANSACTIONID._cdata,
                  apiTranscationId: verifyPayment.APTRANSACTIONID._cdata,
                  airPayTransactionStatus: AirpayResponseStatus.AirpayResponseStatus[parseInt(verifyPayment.TRANSACTIONSTATUS._cdata)],
                  transactionType: AirpayResponseType.AirpayResponseType[parseInt(verifyPayment.TRANSACTIONTYPE._cdata)],
                  transactionTime: verifyPayment.TRANSACTIONTIME._cdata,
                  paymentResponse: verifyPayment
                },
              },
              { new: true }
            );

            verifyPayment = {
              amount: parseFloat(verifyPayment.AMOUNT._cdata),
              status: "FAILED",
              paymentId: verifyPayment.APTRANSACTIONID._cdata,
              paymentMethod: "upi",
            };
            //find bonus percentage
            let bonus_perc_table = await db
              .collection("add_cash_bonus_percent")
              .findOne();
            // const bonus_perc = Number(bonus_perc_table.bonus_amt.replace("%", ""));
            const bonus_perc = bonus_perc_table.bonus_amt;
            displayBonus = (verifyPayment.amount * bonus_perc) / 100;
          }
          else{
            //pending status
            logger.info(
              "---phonepayResponse---> success false",
              airpayResponse
            );
            await db.collection("user_payment").findOneAndUpdate(
              {
                userId: getInfo.MongoID(userId),
                orderId: orderId,
              },
              {
                $set: {
                  amount: parseFloat(getTransaction.amount),
                  paymentMethod: "upi",
                  status: "PENDING",
                  complete_date: new Date(),
                  paymentId: verifyPayment.TRANSACTIONID._cdata,
                  apiTranscationId: verifyPayment.APTRANSACTIONID._cdata,
                  airPayTransactionStatus: AirpayResponseStatus.AirpayResponseStatus[parseInt(verifyPayment.TRANSACTIONSTATUS._cdata)],
                  transactionType: AirpayResponseType.AirpayResponseType[parseInt(verifyPayment.TRANSACTIONTYPE._cdata)],
                  transactionTime: verifyPayment.TRANSACTIONTIME._cdata,
                  errorMessage: verifyPayment.MESSAGE._cdata,
                  paymentResponse: verifyPayment
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
      }
      

    // } else {
    //   //find bonus percentage
    //   let bonus_perc_table = await db
    //     .collection("add_cash_bonus_percent")
    //     .findOne();
    //   // const bonus_perc = Number(bonus_perc_table.bonus_amt.replace("%", ""));
    //   const bonus_perc = bonus_perc_table.bonus_amt;
    //   displayBonus = (getTransaction.amount * bonus_perc) / 100;

    //   verifyPayment = {
    //     amount: +getTransaction.amount,
    //     status: getTransaction.status,
    //     paymentId: getTransaction.paymentId,
    //     paymentMethod: getTransaction.paymentMethod,
    //   };
    //   if(getTransaction.isFirstTimeUser){
    //     verifyPayment.amount=  +getTransaction.amount+50;
    //     verifyPayment.verifyPayment.isOfferClaimed = true;
    //   }
    // }

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
    return {
      status:200,
      data:{
        success: true,
        errorCode: "0000",
        Type: "Response",
        message: "Data delivered successfully",
        data: {
          transactionId: getTransaction ? getTransaction.transactionId : "",
          bonus: displayBonus,
          paymentData: verifyPayment,
          lobbyData: lobbyDetails,
        }
      }
      
    };
}
  module.exports = {
    addCashAmountService,
    updateAirPayResponse,
    checkStatusAPIAirPay
  }
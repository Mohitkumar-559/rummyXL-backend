const rs = require("randomstring");
const encKey = process.env.ENCRYPT_DECRYPT_KEY;
const { replaceKeyOldToNew } = require("./replaceKey.class");
const crypto = require("crypto"); //deprecated inbulid in node
const config = require("../config.json");
const _ = require("underscore");
const { GetUserInfo } = require("../common");
const logger = require("../utils/logger");
const { GetConfig } = require("../connections/mongodb");
const moment = require("moment");

const getIpad = (client) => {
  /* +-------------------------------------------------------------------+
      desc:this function gives the ip address of the player from socket id.
      i/p:socket object
      o/p:client ip address
    +-------------------------------------------------------------------+ */

  let ipad =
    client.handshake && client.handshake.address
      ? client.handshake.address.split(":")[3]
      : "";
  return ipad;
};

const GetLanguageCode = (lc) => {
  /* +-------------------------------------------------------------------+
      desc:this function give the language code of player if outside of this then en default.
      i/p:user languagecode
      o/p:language code
    +-------------------------------------------------------------------+ */

  const langArr = ["en", "hi", "te"];
  const { DEFAULT_LANGUAGE } = GetConfig();
  //if undefined from device or flash
  if (!lc) {
    return DEFAULT_LANGUAGE && InArray(DEFAULT_LANGUAGE, langArr)
      ? DEFAULT_LANGUAGE
      : "en";
  } else if (!InArray(lc.toLowerCase(), langArr)) {
    // we have only 3 languages, if outside of this then default
    return "en";
  } else {
    return lc;
  }
};

const GetRandomInt = (min, max) => {
  /* +-------------------------------------------------------------------+
      desc:this function generates random integer between min and max.
      i/p:min->lower bound,max->upper bound
      o/p:random int 
    +-------------------------------------------------------------------+ */

  const rnd =
    Math.floor(Math.random() * (parseInt(max) - parseInt(min) + 1)) +
    parseInt(min);
  return Number(rnd);
};
const GetRandomString = (len) => {
  /* +-------------------------------------------------------------------+
  desc:this function genrate the random string of particular leangth given as input.
  i/p:leangth
  o/p:string
  +-------------------------------------------------------------------+ */

  if (len) {
    if (len == 10) {
      return SERVER_ID + "." + rs.generate(len);
    } else {
      return rs.generate(len);
    }
  } else {
    return rs.generate(32);
  }
};

const RoundInt = (n, d) => {
  /* +-------------------------------------------------------------------+
      desc: this function is used to round the decimal number 
      i/p: n = number ,d = digits required after decimal places
      o/p: formatted date
    +-------------------------------------------------------------------+ */
  n = Math.round(n * Math.pow(10, d));

  n = n / Math.pow(10, d);
  return n;
};
const SendData = (client, en, dt, msgDefinition, parseFlag) => {
  /* +-------------------------------------------------------------------+
      desc: this function send data to server by socket.
      i/p:
        client : Using this object instance we can emit the message & data
        en : Which event we have to update.
        dt : Object or array of data which we need to send.
        msgDefinition : Definition of message which type of message we have to emit. E.X : error:1001
        parseFlag : Any message need to parse with sent data or not. if true i will parse the message.
      o/p: send data
    +-------------------------------------------------------------------+ */

  logger.info(
    `[ SendData ]----------------------------((( ${en} ))))-------ooooooooooooooooooooooooooooo   Time: ${moment().format()}`
  );
  if (client && typeof client == "object") {
    let msgArr;
    // this is fixed for circular dependency problem.
    const commonData = require("./commonData.class");
    if (dt) {
      //we have split message type and message content from here.
      if (!msgDefinition) {
        let def = "success:0000";
        msgDefinition = client.lc ? client.lc + ":" + def : "en:" + def;
      } else {
        msgDefinition = client.lc
          ? client.lc + ":" + msgDefinition
          : "en:" + msgDefinition;
      }
      logger.info(
        "SendData--------1-------->>>>>msgDefination: ",
        msgDefinition,
        "lc: " +
        client.lc +
        " client.vc: " +
        client.vc +
        " client.isOppo: " +
        client.isOppo
      );

      if (
        client.det == "flash" ||
        client.det == "html" ||
        (client.det == "android" &&
          typeof client.vc != "undefined" &&
          ((typeof client.isOppo != "undefined" &&
            client.isOppo == 1 &&
            parseInt(client.vc) > 4) ||
            15 < parseInt(client.vc))) ||
        (client.det == "ios" &&
          typeof client.v != "undefined" &&
          checkVer("1.6", client.v.toString()))
      ) {
        let lc = msgDefinition.split(":")[0];
        let type = msgDefinition.split(":")[1];
        let code = msgDefinition.split(":")[2];

        if (code == "9006") {
          code = "9800";
        } else if (code == "1019") {
          code = "9801";
        } else if (code == "8002") {
          code = "9802";
        } else if (code == "7002") {
          code = "9803";
        } else if (code == "3003" && type == "coins") {
          code = "9804";
        } else if (code == "3009") {
          code = "9805";
        }

        msgDefinition = lc + ":" + type + ":" + code;
      }

      logger.info(
        "sendData--------1.5--------->>>>>msgDefination: " + msgDefinition
      );

      if (!commonData.dataCodesArray[msgDefinition]) {
        msgDefinition =
          "en:" +
          msgDefinition.split(":")[1] +
          ":" +
          msgDefinition.split(":")[2];
      }

      logger.info(
        "SendData--------2-------->>>>>msgDefination: ",
        msgDefinition,
        "lc: " + client.lc
      );
      msgArr = msgDefinition.split(":");
    } else {
      msgArr = ["en", "error", "1111"];
    }
    // logger.info('SendData: ',commonData.dataCodesArray[msgDefinition]);
    //we have to prepare message from defined message for success, notification and error
    dt = replaceKeyOldToNew(dt);

    let msg;
    if (dt.message) {
      msg = dt.message;
    } else if (commonData.dataCodesArray[msgDefinition]) {
      msg = commonData.dataCodesArray[msgDefinition].Message;
    } else {
      msg = "Unknown Error!!!";
    }

    let data = {
      success: msgArr[1] == "error" ? false : true,
      errorCode: msgArr[2],
      title: commonData.dataCodesArray[msgDefinition].Title,
      lc: commonData.dataCodesArray[msgDefinition].Lc,
      msg,
      en: en,
      data: dt,
    };

    //if any message need to parsing the data then we have parse it manually
    if (parseFlag && dt) {
      // logger.info("SendData = dt:", dt);
      data.msg = this.KeywordReplacer(dt, data.msg);
    }

    // var eData = encrypt (data);

    logger.info("sendData -- en ---->", en);
    const eventName = ["onlineUsers", "GetPointRummy"];
    if (!eventName.includes(en)) {
      logger.info("sendData -- dt ---->", dt);
    }

    playExchange.publish("single." + client.sck, data);
  } else {
    logger.info('SendDataMsg"socket not found"', en);
    logger.info('SendData---------->>>>>>Msg"socket not found"');
  }
};
const SendDirect = (qid, data, flag) => {
  // send data direct to player; flag = true for qid = uid OR false for qid = client.sck
  /* +-------------------------------------------------------------------+
      desc: this function send data direct to player from userid.
      i/p:
        qid = uid,
        data = data to send to user
        flag = true
      o/p: send data
    +-------------------------------------------------------------------+ */

  if (data.en != "Heartbeat") {
    logger.info(`[ SendDirect ]----------------------------(((${data.en})))-------ooooooooooooooooooooooooooooo`, `Time: ${moment().format()}`);
  }
  if (!qid || qid == "") {
    logger.info('SendDirect:::::::::::::Error:  "qid not found!!!"');
    return false;
  }

  if (flag) {
    GetUserInfo(
      qid,
      { sck: 1, "flags._io": 1, "flags._ir": 1 },
      function (rcu) {
        // logger.info('SendDirect--------->>>>>>rcu: ',rcu);
        if (
          rcu &&
          rcu.flags &&
          rcu.flags._io == 1 &&
          rcu.flags._ir == 0 &&
          rcu.sck != "" &&
          typeof playExchange != "undefined"
        ) {
          logger.info("SendDirect-----if---->>>>>>en: ", data.en);
          logger.info("SendDirect--------->>>>>>data: ", data);
          playExchange.publish("single." + rcu.sck, data);
        } else {
          logger.info(
            'SendDirect::::::::::::::::::::::::>>>>>>Error: "table not found"'
          );
        }
      }
    );
  } else {
    // logger.info('SendDirect--------->>>>>>qid: ',qid);
    playExchange.publish("single." + qid, data);
  }
};
const FireEventToTable = (tbId, dataToSend, msgNoti) => {
  //send data to the table
  /* +-------------------------------------------------------------------+
      desc: this function send data to table from table_id.
      i/p: tableid,data to send
      o/p: send data 
    +-------------------------------------------------------------------+ */

  logger.info(
    `[ FireEventToTable ]--------<<<tbId: ${tbId}>>>--------(((${dataToSend.en
    })))------ooooooooooooooooooooooooo   Time: ${moment().format()}`
  );
  // logger.info("data = ", dataToSend.data);

  if (!tbId) {
    logger.info('FireEventToTable::::::::::::>>>>>Error: "tbId not found!!!"');
    return false;
  }
  //include Stand for that if we have to include current socket id or not.

  if (typeof tbId == "string" && tbId.length > 23) {
    if (msgNoti) {
      dataToSend.data.msg = "";
      dataToSend.data.key = msgNoti;
    }

    logger.info("send -- en ---->" + dataToSend.en);
    logger.info("send -- data ---->", dataToSend.data);
    dataToSend.data = replaceKeyOldToNew(dataToSend.data);
    playExchange.publish("room." + tbId, dataToSend);
  }
};

const KeywordReplacer = (dt, str) => {
  /* +-------------------------------------------------------------------+
      desc: this function replace the keyword(string) in array. 
      i/p:
        dt : total subset of array keyword.
        str : in which string you want to replace keyword.
      o/p: updated string
    +-------------------------------------------------------------------+ */

  for (let y in dt) {
    eval("str = str.replace(/\\[\\[" + y + "]\\]/g, dt." + y + ");");
  }
  for (let z in config) {
    eval("str = str.replace(/\\[\\[" + z + "]\\]/g, config." + z + ");");
  }

  return str;
};
const checkVer = (oldVer, newVers) => {
  /* +-------------------------------------------------------------------+
      desc: this function is used to check whether the version of app is older or not 
      i/p:
        oldVer : older version of app
        str : newer version of app
      o/p: true/false
    +-------------------------------------------------------------------+ */
  if (typeof oldVer == "undefined" || oldVer == null) {
    oldVer = "0";
  }
  if (typeof newVers == "undefined" || newVers == null) {
    newVers = "0";
  }

  let version = oldVer.split(".");
  let newVersion = newVers.split(".");

  if (newVersion.length == 2) {
    newVersion.push(0);
  } else if (newVersion.length == 1) {
    newVersion.push(0);
    newVersion.push(0);
  }

  if (version.length == 2) {
    version.push(0);
  } else if (version.length == 1) {
    version.push(0);
    version.push(0);
  }

  if (version[0] < newVersion[0]) {
    return true;
  } else if (version[0] == newVersion[0]) {
    if (version[1] < newVersion[1]) {
      return true;
    } else if (version[1] == newVersion[1]) {
      return version[2] < newVersion[2];
    } else {
      return false;
    }
  } else {
    return false;
  }
};

const encrypt = (toCrypt) => {
  /* +-------------------------------------------------------------------+
      desc: this function encrypt the data.
      i/p: plain data
      o/p: encrypted data
    +-------------------------------------------------------------------+ */

  const keyBuf = Buffer.from(Array(32));

  keyBuf.write(encKey, "utf8");
  const ivBuf = Buffer.from(Array(16));

  let cipher = crypto.createCipheriv("aes256", keyBuf, ivBuf);

  return (
    cipher.update(JSON.stringify(toCrypt), "utf-8", "base64") +
    cipher.final("base64")
  );
};
const decrypt = (request, private) => {
  /* +-------------------------------------------------------------------+
      desc: this function decrypt the data.
      i/p: encrypted data
      o/p: decrypted data
    +-------------------------------------------------------------------+ */

  // keyBuf = new Buffer(Array(32));
  const keyBuf = Buffer.from(Array(32));
  // Copy the key into this buffer

  keyBuf.write(encKey, "utf8");

  // Create the 16-byte zero-filled IV buffer
  const ivBuf = Buffer.from(Array(16));
  let deCipher = crypto.createDecipheriv("aes256", keyBuf, ivBuf);

  try {
    const decrypted =
      deCipher.update(request, "base64", "utf8") + deCipher.final("utf8");
    return JSON.parse(decrypted);
  } catch (e) {
    logger.info(request);
    logger.info(e);
    return null;
  }
};
const GetTimeDifference = (startDate, endDate, type) => {
  /* +-------------------------------------------------------------------+
      desc: this function return time difference between two dates.
      i/p: start_date,end_date
      o/p: timedifference
    +-------------------------------------------------------------------+ */
  // logger.info("GetTimeDifference-----------date1",startDate,"--------date2",endDate);
  let date1 = new Date(startDate);
  let date2 = new Date(endDate);
  let diffMs = date2 - date1; // milliseconds between now & Christmas
  // logger.info("GetTimeDifference-----------date1",date1,"--------date2",date2);
  if (type == "day") {
    date1 = new Date(
      startDate.getFullYear(),
      startDate.getMonth(),
      startDate.getDate(),
      0,
      0,
      0
    );
    date2 = new Date(
      endDate.getFullYear(),
      endDate.getMonth(),
      endDate.getDate(),
      0,
      0,
      0
    );
    let timeDiff = Math.abs(date2.getTime() - date1.getTime());
    return Math.ceil(timeDiff / (1000 * 3600 * 24));
  } else if (type == "hour") {
    return Math.round((diffMs % 86400000) / 3600000);
  } else if (type == "minute") {
    return Math.round(((diffMs % 86400000) % 3600000) / 60000);
  } else {
    return Math.round(diffMs / 1000);
  }
};
const getDuration = (startDate, endDate, lc, admin) => {
  //give time duration with unit
  /* +-------------------------------------------------------------------+
      desc:this function returns time difference string
      i/p: startDate = start date
         endDate = end date
         lc = language code
         admin = true/false sts for admin
      o/p: msg = message
    +-------------------------------------------------------------------+ */
  let diff = endDate.getTime() - startDate.getTime();
  diff = Math.round(diff / 1000);

  let obj = {};
  let r;
  if ((r = Math.floor(diff / 31536000)) > 1) {
    //years ago

    obj = { msg: "9901", value: r };
  } else if ((r = Math.floor(diff / 31536000)) == 1) {
    //year ago

    obj = { msg: "9902", value: r };
  } else if ((r = Math.floor(diff / 2592000)) > 1) {
    //months ago

    obj = { msg: "9903", value: r };
  } else if ((r = Math.floor(diff / 2592000)) == 1) {
    //month ago

    obj = { msg: "9904", value: r };
  } else if ((r = Math.floor(diff / 86400)) > 1) {
    //days ago

    obj = { msg: "9905", value: r };
  } else if ((r = Math.floor(diff / 86400)) == 1) {
    //day ago

    obj = { msg: "9906", value: r };
  } else if ((r = Math.floor(diff / 3600)) > 1) {
    //hours ago

    obj = { msg: "9907", value: r };
  } else if ((r = Math.floor(diff / 3600)) == 1) {
    //hour ago

    obj = { msg: "9908", value: r };
  } else if ((r = Math.floor(diff / 60)) > 1) {
    //minutes

    obj = { msg: "9909", value: r };
  } else if ((r = Math.floor(diff / 60)) == 1) {
    obj = { msg: "9910", value: r };
  } else {
    if (admin) {
      obj = { msg: "9911", value: "" };
    } else {
      obj = { msg: "9912", value: "" };
    }
  }

  // this is fixed for circular dependency problem.
  const commonData = require("./commonData.class");
  let type = lc + ":time:" + obj.msg;
  if (!commonData.dataCodesArray[type]) {
    type = "en:time:" + obj.msg;
  }
  logger.info(
    "getDuration------------>>>>>>>type: " +
    type +
    " obj.value: " +
    obj.value +
    " commonData.dataCodesArray[type]: ",
    commonData.dataCodesArray[type]
  );
  return KeywordReplacer(
    { v: obj.value },
    commonData.dataCodesArray[type].Message
  );
};

const AddTime = (t) => {
  //t will be in second how many second you want to add in time.
  /* +-------------------------------------------------------------------+
      desc: this function add the time(seconds) in time.
      i/p: seconds
      o/p: addedseconds
    +-------------------------------------------------------------------+ */

  let ut = new Date();
  ut.setSeconds(ut.getSeconds() + Number(t));
  return ut;
};

const AddTimeD = (sdate, t) => {
  /* +-------------------------------------------------------------------+
      desc: this function add the time(seconds) by adding sDate in time.
      i/p: sDate = start date , t = seconds to add
      o/p: new time after adding date
    +-------------------------------------------------------------------+ */
  //logger.info("sdate",typeof sdate);
  //logger.info("new date",typeof new Date());
  let ut = new Date(sdate);
  ut.setSeconds(ut.getSeconds() + Number(t));
  return ut;
};

const subTime = (t) => {
  let ut = new Date();
  ut.setSeconds(ut.getSeconds() - Number(t));
  return ut;
};

const PrepareId = (sPrefix, id) => {
  /* +-------------------------------------------------------------------+
      desc: this function is used to create socket id
      i/p: sPrefix = server id, id = socket id
      o/p: formatted socket id
    +-------------------------------------------------------------------+ */
  return sPrefix + "." + id;
};

const GetGameConfig = () => {
  /* +-------------------------------------------------------------------+
      desc: this function is used to get game config
      o/p: config details
    +-------------------------------------------------------------------+ */
  let dt = {};
  let ro = ["GAME_NAME", "MAX_DEADWOOD_PTS", "MIN_SEAT_TO_FILL", "START_TURN_TIMER", "SECONDARY_TIMER", "TIMER_FINISH", "CONTACT_US_NO", "BLOCK_STATE", "CONTACT_US_EMAIL"];
  let configData = GetConfig();
  for (let k in configData) {
    if (ro.indexOf(k) != -1) {
      dt[k] = configData[k];
    }
  }

  return dt;
};

const InArray = (needle, haystack) => {
  /* +-------------------------------------------------------------------+
      desc: check if the element is in array
      i/p: needle = element to find, haystack = array
      o/p: true/false 
    +-------------------------------------------------------------------+ */
  if (!haystack || !needle) {
    return false;
  }

  let length = haystack.length;
  for (let i = 0; i < length; i++) {
    if (haystack[i] && haystack[i].toString() == needle.toString()) {
      return true;
    }
  }
  return false;
};

const getMedian = (score) => {
  //score = array of numbers
  /* +-------------------------------------------------------------------+
      desc: this function is used to get median
      i/p: score = array of integers
      o/p: return median
    +-------------------------------------------------------------------+ */
  if (score.length > 0) {
    score.sort();

    let half = Math.floor(score.length / 2);

    if (score.length % 2 == 1) {
      //odd no. of scores
      return score[half];
    } else {
      //even number of score
      return Math.round((score[half - 1] + score[half]) / 2);
    }
  } else {
    return 0;
  }
};

const getWebShortCurrency = (amount) => {
  /* +-------------------------------------------------------------------+
      desc: format the currency
      i/p: amount = amount
      o/p: returns formatted currency 
    +-------------------------------------------------------------------+ */
  return Number(amount) > 9999999
    ? Math.round(amount / 10000000) + "Cr"
    : Number(amount) > 99999
      ? Math.round(amount / 100000) + "L"
      : amount;
};

const fireEventToAll = (dataToSend) => {
  //send data to the table
  /* +-------------------------------------------------------------------+
      desc: this function send data to table from table_id.
      i/p: tableid,data to send
      o/p: send data 
    +-------------------------------------------------------------------+ */

  logger.info(
    "[ FireEventToAll ]--------" +
    ">>>--------((( " +
    dataToSend.en +
    " )))------ooooooooooooooooooooooooo   Time: " +
    new Date().getHours() +
    ":" +
    new Date().getMinutes() +
    ":" +
    new Date().getSeconds() +
    ":" +
    new Date().getMilliseconds()
  );
  // logger.info("data = ", dataToSend.data);

  //include Stand for that if we have to include current socket id or not.

  // if (typeof tbId == "string" && tbId.length > 23) {

  logger.info("send -- en ---->" + dataToSend.en);
  logger.info("send -- data ---->", dataToSend.data);
  // dataToSend.data = replaceKeyOldToNew(dataToSend.data);
  playExchange.publish("all.", dataToSend);
  // }
};

const sendDataExceptSender = (dataToSend) => {
  //send data to the table
  /* +-------------------------------------------------------------------+
      desc: this function send data to table from table_id.
      i/p: tableid,data to send
      o/p: send data 
    +-------------------------------------------------------------------+ */
  logger.info("send -- en ---->" + dataToSend.en);
  logger.info("send -- data ---->", dataToSend.data);
  playExchange.publish("exceptSender.", dataToSend);
};

const GetTimeDifferenceForRound = (startDate, endDate, type) => {
  /* +-------------------------------------------------------------------+
      desc: this function return time difference between two dates.
      i/p: start_date,end_date
      o/p: timedifference
    +-------------------------------------------------------------------+ */
  // logger.info("GetTimeDifference-----------date1",startDate,"--------date2",endDate);
  let date1 = new Date(startDate);
  let date2 = new Date(endDate);
  let diffMs = date2 - date1; // milliseconds between now & Christmas
  // logger.info("GetTimeDifference-----------date1",date1,"--------date2",date2);
  if (type == "day") {
    date1 = new Date(
      startDate.getFullYear(),
      startDate.getMonth(),
      startDate.getDate(),
      0,
      0,
      0
    );
    date2 = new Date(
      endDate.getFullYear(),
      endDate.getMonth(),
      endDate.getDate(),
      0,
      0,
      0
    );
    let timeDiff = Math.abs(date2.getTime() - date1.getTime());
    return (timeDiff / (1000 * 3600 * 24));
  } else if (type == "hour") {
    return ((diffMs % 86400000) / 3600000);
  } else if (type == "minute") {
    return (((diffMs % 86400000) % 3600000) / 60000);
  } else {
    return (diffMs / 1000);
  }
};


module.exports = {
  GetRandomString,
  PrepareId,
  encrypt,
  decrypt,
  getIpad,
  InArray,
  GetGameConfig,
  GetTimeDifference,
  RoundInt,
  SendData,
  SendDirect,
  FireEventToTable,
  GetRandomInt,
  AddTime,
  subTime,
  GetLanguageCode,
  getDuration,
  getWebShortCurrency,
  getMedian,
  AddTimeD,
  fireEventToAll,
  sendDataExceptSender,
  GetTimeDifferenceForRound
};

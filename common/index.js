const _ = require("underscore");
const logger = require("../utils/logger");
const mongod = require("mongodb");
const MongoID = mongod.ObjectID;

const GetUserInfo = (id, fields, callback) => {
  /* +-------------------------------------------------------------------+
          desc:this function use to get the user data.
          i/p:userid,fields
          o/p:userdata
      +-------------------------------------------------------------------+ */
  logger.info("GetUserInfo---------->>>id: ", id);
  if (typeof fields == "function") {
    callback = fields;
    fields = {};
  }
  if (!id) {
    return false;
  }
  id = id.toString();
  if (typeof id != "string" || id.length < 24) {
    return;
  }

  db.collection("game_users").findOne(
    { _id: MongoID(id) },
    { projection: fields },
    function (err, res) {
      // logger.info('GetUserInfo---------->>>>>>res: ',res);
      if (!err && res) {
        callback(res);
      } else {
        logger.error("GetUserInfo-------fields: ", id, fields);
        callback();
      }
    }
  );
};

const UpdateUserData = (uid, uData, callback) => {
  /* +-------------------------------------------------------------------+
          desc:this function use to update the user data.
          i/p:userid,fields to update
          o/p:updated value
      +-------------------------------------------------------------------+ */
  logger.info("UpdateUserData---------->>>>uid: " + uid + " uData: ", uData);
  if (!uid || uid == "") {
    logger.info(
      'UpdateUserData:::::::::::::>>>>>>Error: "user data not found"'
    );
    return false;
  }
  uid = uid.toString();

  if (uid.length < 24) {
    logger.info(
      'UpdateUserData:::::::::::::>>>>Error: "string length less than 24"'
    );
    return false;
  }
  //adding default time
  if (!uData) {
    logger.info("UpdateUserData:::::::::::::::>>>>upData data not found");
    return false;
  }

  db.collection("game_users").findOneAndUpdate(
    { _id: MongoID(uid) },
    uData,
    { new: true },
    function (err, resp) {
      if (err) {
        logger.info("UpdateUserData::::::::::>>>>err: ", err);
      }
      if (typeof callback == "function" && resp) {
        return callback(resp.value);
      }
    }
  );
};

const GetTbInfo = (id, fields, callback) => {
  /* +-------------------------------------------------------------------+
          desc:this function use to get table data.
          i/p:table id,fields 
          o/p:table data
      +-------------------------------------------------------------------+ */
  if (!id) {
    logger.info(
      "GetTbInfo::::::::",
      fields,
      '::::::::>>>>Error: "id not found!!!" ' + new Date()
    );
    logger.info("GetTbInfo1");
    callback(false);
    return false;
  }
  if (typeof fields == "function") {
    callback = fields;
    fields = {};
  }
  id = id.toString();
  if (typeof id != "string" || id.length < 24) {
    logger.info(
      "GetTbInfo::::" + id + ":::::fields: ",
      fields,
      '::::::::>>>>Error: "id not valid!!!" ' + new Date()
    );
    callback();
  }

  db.collection("playing_table").findOne(
    { _id: MongoID(id) },
    { projection: fields },
    function (err, res) {
      // db.collection('playing_table').findOne({_id: MongoID(id)},fields,function(err, res) {

      if (err) {
        logger.info(
          "GetTbInfo::::" + id + ":::::fields: ",
          fields,
          "::::::::>>>>Error: ",
          err,
          " " + new Date()
        );
        callback();
      } else if (res) {
        // logger.info("GetTbInfo::::", res);
        callback(res);
      } else {
        logger.info(
          "GetTbInfo::::" + id + ":::::fields: ",
          fields,
          '::::::::>>>>Error: "data not found!!!" ' + new Date()
        );
        callback();
      }
    }
  );
};

const UpdateTableData = (tbid, uData, callback) => {
  /* +-------------------------------------------------------------------+
          desc:this function use to update the table data.
          i/p:table id,fields to update
          o/p:updated data
      +-------------------------------------------------------------------+ */
  if (!tbid) {
    logger.info(
      "UpdateTableData-------uData: ",
      uData,
      '----->>>>>Error:"tbid not found" ' + new Date()
    );
    console.error("UpdateTableData");
    if (typeof callback == "function") {
      callback();
    }
    return false;
  }
  tbid = tbid.toString();

  //adding default time
  if (!uData.$set) {
    uData.$set = { /*la :  new Date(),*/ ctrlServer: SERVER_ID };
  } else {
    // uData.$set.la = new Date();
    uData.$set.ctrlServer = SERVER_ID;
  }
  let where = { _id: MongoID(tbid) };
  db.collection("playing_table").findAndModify(
    where,
    {},
    uData,
    { new: true },
    function (err, resp) {
      if (err) {
        logger.info(
          "UpdateTableData::::tbid: " + tbid + "::::::where: ",
          where,
          " ::::uData: ",
          uData,
          ":::::::>>>Error: ",
          err,
          " " + new Date()
        );
        return false;
      }
      // logger.info('resp-------->', resp);
      // logger.info('type----------->', typeof callback);
      if (typeof callback == "function") {
        if (resp && resp.value) {
          callback(resp.value);
        } else {
          callback();
        }
      }
    }
  );
};

const getPlayingUserInRound = (p, play) => {
  //gives the json of the each players on the table;  play = flag for getting actual playing user
  /* +-------------------------------------------------------------------+
      desc:return the details of player on table in current round if play = true then only returns currently playing players
      i/p: p = details of all players on table,play = true/false if true then only returns playing users
    +-------------------------------------------------------------------+ */
  let pl = [];
  if (!p) {
    return pl;
  }

  for (const element of p) {
    if (
      typeof element == "object" &&
      element &&
      typeof element.s != "undefined" &&
      element.s != null &&
      element.s != "left" &&
      (!play || element.s == "playing")
    ) {
      //special condition P'+T

      pl.push(element);
    }
  }
  return pl;
};

const getPlayingUserInGame = (p, play) => {
  //gives the json of the each players on the table;  play = flag for getting actual playing user
  /* +-------------------------------------------------------------------+
      desc:return the details of player on table if play = true then only returns currently playing players
      i/p: p = details of all players on table,play = true/false if true then only returns playing users
    +-------------------------------------------------------------------+ */

  let pl = [];
  if (!p) {
    return pl;
  }

  for (const element of p) {
    if (
      typeof element == "object" &&
      element &&
      typeof element.s != "undefined" &&
      element.s != null &&
      element.s != "left" &&
      (!play || element.play == 1)
    ) {
      //special condition P'+T

      pl.push(element);
    }
  }
  return pl;
};

const getNextPlayer = (table) => {
  //get the index of next player on table
  /* +-------------------------------------------------------------------+
      desc:return the seat index of next playing user on table
      i/p: table = table details
      o/p: seat index of player
    +-------------------------------------------------------------------+ */

  if (table.ap > 1) {
    let i = 0,
      k = table.turn,
      chRound = false,
      obj = {};
    while (i < table.ms) {
      k = (k + 1) % table.ms;

      if (k == table.dealer) {
        chRound = true;
      }
      if (!_.isEmpty(table.pi[k]) && table.pi[k].s == "playing") {
        obj = {
          nxt: k,
          chRound: chRound,
        };
        return obj;
      }
      i++;
    }
  }
};

const exceptionError = async (data, device = false) => {
  db.collection("exceptionError").insertOne({
    error: JSON.stringify(data.stack ?? data),
    device: device,
    date: new Date(),
  });
};

const getJoiningUsers = async (where, projection, sort) => {
  let result = await db.collection("playing_table").find(where, { projection }).sort(sort).limit(1).toArray();
  return result?.length > 0 ? result[0].ap : 0;
};

// setTimeout(() => {
//   updateBots();
// }, 3000);

// const updateData = async () => {
//   const users = await db.collection("game_users").distinct("_id", {
//     Chips: NaN,
//   });
//   if (users.length) {
//     await db.collection("game_users").deleteMany({ _id: { $in: users } });
//     logger.info(users);
//   }
// };

// const updateBots = async () => {
//   const users = await db
//     .collection("game_users")
//     .distinct("_id", { "flags._ir": 1 });

//   // if (users.length) {
//   //   await db.collection("game_users").deleteMany({ _id: { $in: users } });
//   //   logger.info(users);
//   // }

//   const botsName = await db.collection("bot_name").find().toArray();
//   // for (const iterator of botsName) {
//   //   await db
//   //     .collection("bot_name")
//   //     .updateMany({}, { $set: { isUsed: false } }, { new: true });
//   // }

//   for await (const iterator of botsName) {
//     let pp =
//      config.BUCKET_URL +  "prithvi_rummy/4.png";
//     const userAvatar = await db
//       .collection("user_avatar")
//       .aggregate([{ $match: { use: true } }, { $sample: { size: 1 } }])
//       .toArray();

//     if (userAvatar.length) {
//       pp = userAvatar[0].user_avatar;
//     }
//     logger.info("generateRobot---------------->>>>>pp: " + pp);
//     let botName = await db
//       .collection("bot_name")
//       .aggregate([
//         {
//           $match: {
//             isUsed: {
//               $ne: true,
//             },
//           },
//         },
//         {
//           $limit: 1,
//         },
//       ])
//       .toArray();
//     if (botName.length) {
//       botName = botName[0];
//       let t = {
//         un: botName.name, //username
//         unId: botName._id, //username id
//         unique_id: await getYearMonthRandomId(6, "game_users", "unique_id"), //user uniqueID
//         ue: "", //useremail
//         pp: pp, //profile picture
//         tId: "",
//         cd: new Date(), //create date
//         det: "", //device type
//         dids: [], //device ids
//         sn: [], //serial numbe(only for ios)
//         wc: 0, //chips for winner
//         Chips: config.INITIAL_CHIPS, //user chips
//         bonuscash: 10000,
//         wincash: 20000,
//         depositcash: 10000,
//         totalcash: 40000,
//         counters: {
//           hw: 0, //hands win
//           hwc: 0, //hands win cash mode
//           hl: 0, //hands lost
//           hlc: 0, // hands lost cash
//           hd: 0, //Hands dropped
//           hdc: 0, //Hands drop cash
//           cw: 0, //consecutive win
//           cl: 0, //consecutive lose
//           cdr: 0, //consecutive drop
//           thp: 0, //Total Hands played
//           hpc: 0, //Total hands play cash
//           hp: 0, //10 hands play for level tracking
//           thpcd: 0, //Total hands play counter in 1 day
//           pprc: 0, //play point rummy counter in 1 day
//           pplrc: 0, //play pool rummy counter in 1 day
//           pdrc: 0, //play deal rummy counter in 1 day
//           pbrc: 0, //play bet rummy counter in 1 day
//           ptc: 0, //play turnament counter in 1 day
//           hcl: config.INITIAL_CHIPS, //highest chip level
//           mcw: 0, //Most Chips Won
//           deal_c: 0, //deal mode help session counter
//           pool_c: 0, //pool mode help session counter
//           bet_c: 0, //bet mode help session counter
//           tssc: 0, //total sunny shot claimed counter
//           lvc: 0, // level completed counter
//           ppo: 0, // current level point
//           pper: 0, //current level completed percentage
//           opc: 0, // operation counter
//           playDays: 0, //consicutive play days
//         },
//         nwt: "", //network
//         lc: "en", //Language code
//         rfc: rs.generate(7), //referral code generated by system on signup
//         flags: {
//           _ir: 1, //is robot
//           _isup: 0, //is suspended
//           _isbkip: 0, // block by ip
//           _isbkdv: 0, // block by device
//           _isRated: 0, //is app rated
//           _io: 1, //is Online
//           _ftpo: 1, //first time offers
//           _mhp: 0, // most highest payment
//           _pyr: 0, //is payer : 0 / 1
//           _cdb: 0, //collect daily bonus
//           _noti: 0, //notification : 0 / 1
//           _snd: 0, // sounds : 0 / 1
//           _vib: 0, //vibration : 0 / 1
//           _challenge: 0, //challange : 0 / 1
//           _tutf: 1, //tutorial flag
//           _payer: 0, //is payer : 0 / 1
//         },
//         lasts: {
//           pl: new Date(), //previous login
//           ll: new Date(), //last login
//           lpt: new Date(),
//           ldt: "", //last device type
//           ldi: null, // last device id
//           lsn: null, // last serial number
//           lfp: "", //last facebook post
//           ldbt: new Date(), //last daily bonus time
//           lict: new Date(), //last image collect time
//           lsct: new Date(), //last lucky spin collect time
//           lort: "", //last offer reject time
//           lsi: 0, //last bonus index (user in magic box bonus)
//           lssct: new Date(),
//         },
//         s: "free",
//         club: "Bronze-I",
//         wintrigger: 0, // wintrigger
//         losscounter: 0, //loss counter
//         friends: [], //array of friends ids
//         blocks: [], //array of block user ids
//         frndId: "", //friends id
//         rand: Math.random(), //random numer for special purposes
//         tbid: "", //table id,
//         rejoinID: "", //rejoinId
//         rejoin: 0, //rejoin flag
//         cbtn: 1, //in game notification
//         dbf: false, //daily bonus display in user setting or not
//         ds: "", //download source
//         country: "India", //country of player (default India)
//         cc: "in", //country code
//         bv: 50, // boot value of table that last played by user
//         sck: "", //socket id of user
//         sessId: 0, //Session Id
//         osType: "", //os of device
//         osVer: "", //os version
//         devBrnd: "", //device brand
//         devMdl: "", //device model
//         artifact: {}, //collected artifact
//       };

//       logger.info("generateRobot---------------->>>>t: ", t);
//       await db.collection("game_users").insertOne(t);

//       await db
//         .collection("bot_name")
//         .findOneAndUpdate(
//           { _id: botName._id },
//           { $set: { isUsed: true } },
//           { new: true }
//         );
//     } else {
//       logger.info("All robot name is used 😂🤣😅 😂🤣😅 😂🤣😅");
//     }
//   }
// };


module.exports = {
  MongoID,
  GetUserInfo,
  UpdateUserData,
  GetTbInfo,
  UpdateTableData,
  getPlayingUserInRound,
  getPlayingUserInGame,
  getNextPlayer,
  exceptionError,
  getJoiningUsers
};

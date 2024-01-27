const commonClass = require("./common.class.js"); //common functions
const profileClass = require("./profile.class");
const getInfo = require("../common");
const logger = require("../utils/logger");
const { getRedisInstances } = require("../connections/redis");
const { GetConfig } = require("../connections/mongodb");
const Chips_Track = (userInfo, chips, desc) => {
  try {
    // function for chip history storing
    /* +-------------------------------------------------------------------+
            desc:function for tracking user chips
            i/p: userInfo = user details,chips = chips of user, desc = description
        +-------------------------------------------------------------------+ */
    logger.info("Chips_Track------->>>>chips: ", chips);
    if (!userInfo) {
      return false;
    }

    let fChips = chips + userInfo.Chips < 0 ? 0 : chips + userInfo.Chips;
    let inserData = {
      uid: getInfo.MongoID(userInfo._id),
      tId: userInfo.tId,
      pc: userInfo.Chips,
      chips: chips,
      balance: fChips,
      description: desc,
      cd: new Date(),
    };
    db.collection("chips_track").insertOne(inserData);
  } catch (error) {
    logger.error("-----> error Chips_Track", error);
    getInfo.exceptionError(error);
  }
};
const Cash_Track = (obj, callback) => {
  try {
    //const key = getCashTrackKey()
    const redisInstances = getRedisInstances();
    if (typeof obj.uid == "undefined") return false;

    obj.cd = new Date();
    obj.tc = obj.pc + obj.c;
    // if(obj.tp == "")
    
    db.collection("cash_track").insertOne(obj, async function (err, trackdata) {
      if (!err && typeof trackdata.ops[0] != "undefined") {
        if (typeof callback == "function") {
          //collect 
          if(trackdata.ops[0].tp == "release remaining amount"){
              //await Cash_Track_delete(trackdata.ops[0])
            
            }
          
          return callback(trackdata.ops[0]);
          
          
        }
      } else {
        logger.info("Cash_Track:----------------data not save succesfully");
        return false;
      }
    });
  } catch (error) {
    logger.error("-----> error Cash_Track", error);
    getInfo.exceptionError(error);
  }
};
const Cash_Track_delete = async (obj) => {
  try {
    const { 
      ROUND_START_TIMER, 
      ROUND_START_TIMER_DEAL_SIX, 
      ROUND_START_TIMER_POINT_SIX, 
      ROUND_START_TIMER_POINT_TWO, 
      ROUND_START_TIMER_PRACTICE,
      ROUND_START_TIMER_POOL_SIX, 
      ROUND_START_TIMER_POOL_TWO, 
      ROUND_START_TIMER_POOL,
      MIN_SEAT_TO_FILL_SIX_POOL} = GetConfig();
    // delete the tanscation 
    const collectBot  = await db.collection("cash_track").findOne({tp:"Collect Boot Value",tjid:obj.tjid});
    const GetTimeDifference = obj.cd - collectBot.cd
    let ROUND_TIMER=0;
    if(collectBot.gt == "Deal" && collectBot.round == 0){
      ROUND_TIMER = ROUND_START_TIMER
        if(collectBot.ms == 6) {
          ROUND_TIMER = ROUND_START_TIMER_DEAL_SIX
      }
      
    }
    if(collectBot.gt == "Points"){
      ROUND_TIMER = ROUND_START_TIMER
      if(collectBot.ms == 6) {
        ROUND_TIMER = ROUND_START_TIMER_POINT_SIX
      }
      if (collectBot.ms == 2) {
        ROUND_TIMER = ROUND_START_TIMER_POINT_TWO;
      }
      
    }
    if(collectBot.gt == "Pool"){
      ROUND_TIMER = ROUND_START_TIMER
      if(collectBot.ap == 1 && collectBot.tst == "" && collectBot.round == 0){
        if(collectBot.ms == 6) {
          ROUND_TIMER = ROUND_START_TIMER_POINT_SIX
        }
        if (collectBot.ms == 2) {
          ROUND_TIMER = ROUND_START_TIMER_POINT_TWO;
        }
      }
      else if(collectBot.round == 0 && collectBot.ap < MIN_SEAT_TO_FILL_SIX_POOL){
        ROUND_TIMER = ROUND_START_TIMER_POOL_TWO;
        if (collectBot.ms == 6) {
          ROUND_TIMER = ROUND_START_TIMER_POOL_SIX;
        }
      }
      // else if(collectBot.ap > 1 && collectBot.round >= 1){
      //   if (collectBot.round > 0) {
      //     ROUND_TIMER = ROUND_START_TIMER_POOL;
      //   }
      // }
      
    }
    //convert the millisecond to second and delete entry when there are less than 25 second
    if(ROUND_TIMER !=0 && ROUND_TIMER*1000-3000 > GetTimeDifference){
      //const deleteTranscation = await db.collection("cash_track").deleteMany({tjid:obj.tjid})
      console.log("========== Transactiion deleted =================")
      //console.log(deleteTranscation)
    }
    console.log(GetTimeDifference+"    check for the time difference")
  } catch (error) {
    logger.error("-----> error Cash_Track", error);
    getInfo.exceptionError(error);
  }
};
const PlayTrack = (obj, callback) => {
  try {
    if (typeof obj.uid == "undefined") return false;

    obj.cd = new Date();
    obj.checked = false;
    delete obj._id;
    db.collection("playing_track").insertOne(obj, function (err, trackdata) {
      if (!err && typeof trackdata.ops[0] != "undefined") {
        if (typeof callback == "function") {
          return callback(trackdata.ops[0]);
        }
      } else {
        logger.info("PlayTrack:----------------data not save succesfully");
        return false;
      }
    });
  } catch (error) {
    logger.error("-----> error PlayTrack", error);
    getInfo.exceptionError(error);
  }
};

const PlayTrackNew = (obj, callback) => {
  try {
    if (typeof obj.uid == "undefined") return false;

    obj.cd = new Date();
    obj.checked = false;
    delete obj._id;
    db.collection("new_playing_track").insertOne(obj, function (err, trackdata) {
      if (!err && typeof trackdata.ops[0] != "undefined") {
        if (typeof callback == "function") {
          return callback(trackdata.ops[0]);
        }
      } else {
        logger.info("PlayTrack:----------------data not save succesfully");
        return false;
      }
    });
  } catch (error) {
    logger.error("-----> error PlayTrack", error);
    getInfo.exceptionError(error);
  }
};
const TdsTrack = (obj, callback) => {
  try {
    logger.info("obj TdsTrack::::::::", obj);

    obj.cd = new Date();
    delete obj._id;
    db.collection("tds_track").insertOne(obj, function (err, trackdata) {
      if (!err && typeof trackdata.ops[0] != "undefined") {
        logger.info(
          "PlayTrack:----------------data save succesfully ",
          trackdata.ops[0]
        );

        if (typeof callback == "function") {
          return callback(trackdata.ops[0]);
        }
      } else {
        logger.info("PlayTrack:----------------data not save succesfully");
        return false;
      }
    });
  } catch (error) {
    logger.error("-----> error TdsTrack", error);
    getInfo.exceptionError(error);
  }
};

const TdsTrackNew = (obj, callback) => {
  try {
    logger.info("obj TdsTrack::::::::", obj);

    obj.cd = new Date();
    delete obj._id;
    db.collection("New_tds_track").insertOne(obj, function (err, trackdata) {
      if (!err && typeof trackdata.ops[0] != "undefined") {
        logger.info(
          "PlayTrack:----------------data save succesfully ",
          trackdata.ops[0]
        );

        if (typeof callback == "function") {
          return callback(trackdata.ops[0]);
        }
      } else {
        logger.info("PlayTrack:----------------data not save succesfully");
        return false;
      }
    });
  } catch (error) {
    logger.error("-----> error TdsTrack", error);
    getInfo.exceptionError(error);
  }
};

const Leave_Track = (obj, callback) => {
  try {
    logger.info("obj ::::::::", obj);
    if (typeof obj.uid == "undefined") return false;

    getInfo.GetUserInfo(
      obj.uid,
      { rlsAmount: 1, cAmount: 1 },
      function (userInfo) {
        if (userInfo) {
          obj.cd = new Date();
          obj.rlsAmount = userInfo.rlsAmount;
          obj.cAmount = userInfo.cAmount;
          db.collection("leave_tracking").insertOne(
            obj,
            function (err, trackdata) {
              if (!err && typeof trackdata.ops[0] != "undefined") {
                logger.info(
                  "Leave_Track:----------------data save succesfully ",
                  trackdata.ops[0]
                );

                if (typeof callback == "function") {
                  return callback(trackdata.ops[0]);
                }
              } else {
                logger.info(
                  "Leave_Track:----------------data not save succesfully"
                );
                return false;
              }
            }
          );
        }
      }
    );
  } catch (error) {
    logger.error("-----> error Leave_Track", error);
    getInfo.exceptionError(error);
  }
};
const upc_Track = (obj, callback) => {
  try {
    logger.info("obj ::::::::", obj);
    if (typeof obj.uid == "undefined") return false;

    obj.cd = new Date();
    db.collection("upc_tracking").insertOne(obj, function (err, trackdata) {
      if (!err && typeof trackdata.ops[0] != "undefined") {
        logger.info(
          "Cash_Track:----------------data save succesfully ",
          trackdata.ops[0]
        );

        if (typeof callback == "function") {
          return callback(trackdata.ops[0]);
        }
      } else {
        logger.info("Cash_Track:----------------data not save succesfully");
        return false;
      }
    });
  } catch (error) {
    logger.error("-----> error upc_Track", error);
    getInfo.exceptionError(error);
  }
};
const PlayingTrack = (tbid, status) => {
  try {
    getInfo.GetTbInfo(tbid, {}, function (table) {
      let data = {};
      data.status = status;
      data.cd = new Date(table.cd);
      data.la = new Date();
      data.tbid = tbid.toString();
      data.tjid = table.tjid;
      data._ip = table._ip;
      data.ms = table.ms;
      data.ap = table.ap;
      data.bv = table.bv;
      data.gt = table.gt;
      data.mode = table.mode;
      data.lvc = table.lvc;
      data.win = "";
      data.pi = [];
      data.game_id = table.game_id;
      data.sub_id = table.sub_id;
      data.uCount = table.uCount;
      data.initServer = table.initServer;
      data.ctrlServer = table.ctrlServer;
      data.wildCard = table.wildCard;

      for (let i = 0; i < table.ap; i++) {
        let insdata = {
          uid: table.pi[i].uid,
          un: table.pi[i].un,
          si: table.pi[i].si,
          cutchips: table.pi[i].upc,
          thp: table.pi[i].thp,
          leave: 0,
          _ir: table.pi[i]._ir,
        };

        data.pi.push(insdata);
      }

      logger.info("PlayTrack-------------->>>>>>>data to insert:", data);
      db.collection("play_track").insertOne(data, function (err, td) { });
    });
  } catch (error) {
    logger.error("-----> error PlayingTrack", error);
    getInfo.exceptionError(error);
  }
};
const userHandsPlay = async (userInfo, gt) => {
  try {
    let thp = userInfo.counters.thp;
    let hp = userInfo.counters.hp;
    if (thp == 1) {
      await profileClass.ManageUserLevel("First Game", userInfo._id.toString());
    } else if (thp == 1000) {
      await profileClass.ManageUserLevel(
        "play 1000 game",
        userInfo._id.toString()
      );
    } else if (thp == 5000) {
      await profileClass.ManageUserLevel(
        "play 5000 game",
        userInfo._id.toString()
      );
    } else if (thp == 10000) {
      await profileClass.ManageUserLevel(
        "play 10000 game",
        userInfo._id.toString()
      );
    } else if (thp == 25000) {
      await profileClass.ManageUserLevel(
        "play 25000 game",
        userInfo._id.toString()
      );
    } else if (thp == 50000) {
      await profileClass.ManageUserLevel(
        "play 50000 game",
        userInfo._id.toString()
      );
    } else if (thp == 100000) {
      await profileClass.ManageUserLevel(
        "play 100000 game",
        userInfo._id.toString()
      );
    }

    if (hp == 10) {
      await profileClass.ManageUserLevel(
        "Played every 10 game",
        userInfo._id.toString()
      );
      getInfo.UpdateUserData(
        userInfo._id.toString(),
        { $set: { "counters.hp": 0 } },
        function (uinfo) { }
      );
    }

    let lpt = userInfo.lasts.lpt;
    let playDays = userInfo.counters.playdays;
    let retTime = commonClass.GetTimeDifference(lpt, new Date(), "day");

    if (retTime > 1) {
      playDays = 0;
      lpt = new Date();
      getInfo.UpdateUserData(
        userInfo._id.toString(),
        {
          $set: {
            "counters.thpcd": 1,
            "lasts.lpt": lpt,
            "counters.playdays": playDays,
          },
        },
        function (uinf) { }
      );
    } else if (retTime == 1) {
      playDays = playDays + 1;
      lpt = new Date();

      if (playDays == 3) {
        await profileClass.ManageUserLevel(
          "Continuous Play for 3 days",
          userInfo._id.toString()
        );
      } else if (playDays == 5) {
        await profileClass.ManageUserLevel(
          "Continuous Play for 5 days",
          userInfo._id.toString()
        );
      } else if (playDays == 7) {
        await profileClass.ManageUserLevel(
          "Continuous Play for 7 days",
          userInfo._id.toString()
        );
      } else if (playDays == 10) {
        await profileClass.ManageUserLevel(
          "Continuous Play for 10 days",
          userInfo._id.toString()
        );
      } else if (playDays == 15) {
        await profileClass.ManageUserLevel(
          "Continuous Play for 15 days",
          userInfo._id.toString()
        );
      }

      getInfo.UpdateUserData(
        userInfo._id.toString(),
        {
          $set: {
            "counters.thpcd": 1,
            "counters.playdays": playDays,
            "lasts.lpt": lpt,
          },
        },
        function (uinf) { }
      );
    } else {
      //do nothing

      playDays = userInfo.counters.playDays;
      lpt = userInfo.lasts.lpt;
      let thpcd = userInfo.counters.thpcd + 1;
      let pprc = userInfo.counters.pprc;
      let pplrc = userInfo.counters.pplrc;
      let pdrc = userInfo.counters.pdrc;
      let pbrc = userInfo.counters.pbrc;
      let ptc = userInfo.counters.ptc;

      if (gt == "Points") {
        pprc = pprc + 1;
      } else if (gt == "Deal") {
        pdrc = pdrc + 1;
      } else if (gt == "Pool") {
        pplrc = pplrc + 1;
      }

      getInfo.UpdateUserData(
        userInfo._id.toString(),
        {
          $set: {
            "counters.pprc": pprc,
            "counters.pplrc": pplrc,
            "counters.pdrc": pdrc,
            "counters.pbrc": pbrc,
            "counters.playdays": playDays,
            "lasts.lpt": lpt,
          },
          $inc: { "counters.thpcd": 1 },
        },
        async function (uinf) {
          if (thpcd == 100) {
            await profileClass.ManageUserLevel(
              "Play 100 games in a day",
              userInfo._id.toString()
            );
          } else if (thpcd == 50) {
            await profileClass.ManageUserLevel(
              "Play 50 games in a day",
              userInfo._id.toString()
            );
          } else if (thpcd == 20) {
            await profileClass.ManageUserLevel(
              "Play 20 games in a day",
              userInfo._id.toString()
            );
          }

          if (
            pprc > 0 &&
            pdrc > 0 &&
            pplrc > 0 &&
            pbrc > 0 &&
            (userInfo.counters.pprc == 0 ||
              userInfo.counters.pplrc == 0 ||
              userInfo.counters.pdrc == 0 ||
              userInfo.counters.pbrc == 0)
          ) {
            await profileClass.ManageUserLevel(
              "Play all Games variations in a day",
              userInfo._id.toString()
            );
          }
        }
      );
    }
  } catch (error) {
    logger.error("-----> error userHandsPlay", error);
    getInfo.exceptionError(error);
  }
};

const userLastPlaying = async (wl, obj) => {
  try {
    let i = 0;
    savedata(i);
    function savedata(i) {
      if (i < wl.length) {
        obj.userid = wl[i].uid;
        obj.cd = new Date();
        delete obj._id;
        db.collection("playing_history").insertOne(obj, function (err, resp) {
          if (!err && resp.ops[0]) {
            db.collection("playing_history")
              .find({ userid: wl[i].uid })
              .sort({ cd: 1 })
              .toArray(function (err1, res) {
                if (res.length >= 10) {
                  db.collection("playing_history").deleteOne(
                    {
                      userid: wl[i].uid,
                      tbid: res[0].tbid,
                      round: res[0].round,
                    },
                    function () {
                      i = i + 1;
                      savedata(i);
                    }
                  );
                } else {
                  i = i + 1;
                  savedata(i);
                }
              });
          }
        });
      }
    }
  } catch (error) {
    logger.error("-----> error userLastPlaying", error);
    getInfo.exceptionError(error);
  }
};
const TrackReferrer = (data, userData, isWholeNew, callback) => {
  try {
    /* +-------------------------------------------------------------------+
            desc:function to handle user reference logic
            i/p: data = {
                        rfc = referral code 
                        request = request id       
                    }
                 userData = user details
                 callback = callback function
        +-------------------------------------------------------------------+ */
    let refCode = data.rfc;
    logger.info(
      "TrackReferrer-------------->>>refCode: " +
      refCode +
      " userData.flags._isRefered: " +
      userData.flags._isRefered
    );
    if (userData && userData.flags && userData.flags._isRefered != 1) {
      if (typeof refCode != "undefined" && refCode != null && refCode != "") {
        //first we need to check ip in request_track table

        db.collection("game_users").findOne(
          { rfc: refCode },
          function (err1, result) {
            if (result) {
              getInfo.UpdateUserData(result._id.toString(), {
                $inc: { "counters.invC": 1 },
              });
              getInfo.UpdateUserData(userData._id.toString(), {
                $set: { "flags._isRefered": 1 },
              });
              profileClass.ManageUserLevel(
                "Successful invite",
                result._id.toString()
              );
            } else {
              logger.info(
                'TrackReferrer------------>>>"referrer user not found"'
              );
            }
          }
        );
      } else {
        logger.info('TrackReferrer------------>>>"not referred user"');
      }
    }

    return callback(userData);
  } catch (error) {
    logger.error("-----> error TrackReferrer", error);
    getInfo.exceptionError(error);
  }
};
const dauMau = (uid, ldt) => {
  try {
    //daily/monthly active user trackin
    /* +-------------------------------------------------------------------+
            desc:function to track daily active user and monthly active user
            i/p: uid = user id,ldt = last device type
        +-------------------------------------------------------------------+ */
    let det = ldt.toLowerCase();
    if (commonClass.InArray(det, ["android", "ios", "html"])) {
      let mString =
        new Date().getFullYear() + "-" + (new Date().getMonth() + 1);
      let upData = { $addToSet: {}, $inc: {} };
      upData.$inc[det] = 1;
      upData.$addToSet["uid_" + det] = uid;
      let wh1 = { mString: mString, type: "month" };
      wh1["uid_" + det] = { $ne: uid };

      db.collection("track_au").updateOne(wh1, upData, function (err) { });

      let dString =
        new Date().getFullYear() +
        "-" +
        (new Date().getMonth() + 1) +
        "-" +
        new Date().getDate();
      let wh2 = { dString: dString, type: "day" };
      wh2["uid_" + det] = { $ne: uid };
      db.collection("track_au").updateOne(wh2, upData, function (err, upd) {
        if (upd) {
          getInfo.GetUserInfo(uid, { Chips: 1 }, async function (userInfo) {
            if (userInfo) {
              await db.collection("dailyUserChips").insertOne({
                uid: getInfo.MongoID(uid),
                Chips: userInfo.Chips,
                dString: dString,
                cd: new Date(),
              });
            } else {
              logger.info('dauMau-------------->>>>"user not found"');
            }
          });
        }
      });
    }
  } catch (error) {
    logger.error("-----> error dauMau", error);
    getInfo.exceptionError(error);
  }
};

module.exports = {
  Chips_Track,
  Cash_Track,
  PlayTrack,
  TdsTrack,
  Leave_Track,
  upc_Track,
  PlayingTrack,
  userHandsPlay,
  userLastPlaying,
  TrackReferrer,
  dauMau,
  TdsTrackNew,
  PlayTrackNew
};

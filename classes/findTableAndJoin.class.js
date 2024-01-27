const config = require("../config.json");
const { getRandomId } = require("../utils");
const commonClass = require("./common.class"); //common functions
const commonData = require("./commonData.class");
const schedule = require("node-schedule");
const getInfo = require("../common");
const trackClass = require("./track.class");
const collectBootValueClass = require("./collectBootValue.class");
const _ = require("underscore");
const roundClass = require("./round.class");
const logger = require("../utils/logger");
const socketClass = require("../utils/getSockets");
const socketData = new socketClass();
// const redlock = require("../connections/redLock");
const { increment } = require("./redis.class");
const { GetConfig } = require("../connections/mongodb");
const scheduler = require("../scheduler");
const { addQueue, cancelJob } = require("../scheduler/bullQueue");
const { ROUND_TIMER_START_TIMER } = require("../constants/eventName");
const moment = require("moment");

const isFirstTimeUser = (userInfo, ms, gt, callback) => {
  try {
    logger.info(
      "isFirstTimeUser---------if-------->>>>",
      config.HAPPY_FLOW,
      ms
    );

    logger.info("-------------->", config.HAPPY_FLOW);
    logger.info("-------------->");
    logger.info(
      "isFirstTimeUser---------if-------->>>>userInfo.counters.winTrigger",
      userInfo.counters.winTrigger
    );
    logger.info(
      "isFirstTimeUser---------if-------->>>>userInfo.counters.loseStreak",
      userInfo.counters.loseStreak
    );
    let hands = userInfo.counters.winTrigger + userInfo.counters.loseStreak;
    let pr = (userInfo.counters.winTrigger * 100) / hands;
    logger.info("isFirstTimeUser---------if-------->>>>pr", pr);
    logger.info(
      "isFirstTimeUser---------if-------->>>>userInfo.flags._ir",
      userInfo.flags._ir
    );
    logger.info("isFirstTimeUser---------if-------->>>>ms", ms);

    let usw;
    if (gt == "Pool") {
      usw = config.USERWIN_POOL;
    } else {
      usw = config.USERWIN;
      if (ms == 2) {
        usw = config.USERWIN_TWO;
      }
    }

    if (gt == "Pool" && ms == 2) {
      usw = config.USERWIN_POOL_TWO;
    }
    logger.info("usw===========>", usw);
    if (pr >= usw && config.HAPPY_FLOW && userInfo.flags._ir == 0) {
      logger.info("isFirstTimeUser---------if-------->>>>usw", usw);
      if (typeof callback == "function") {
        return callback(true);
      }
    } else {
      logger.info(
        'isFirstTimeUser---------if--else----->>>>>>>>"user data not found"'
      );
      if (typeof callback == "function") {
        return callback(false);
      }
    }
  } catch (error) {
    logger.error("-----> error isFirstTimeUser", error);
    getInfo.exceptionError(error);
  }
};
const findTableAndJoin = (data, client, fCount) => {
  // : data = {gt,pCount,reke,bv,chips} ; table finding function    //reke and pCount iff gt == Deal or Pool
  /* +-------------------------------------------------------------------+
    desc:generic function to find table for user 
    i/p: data = {gt = game type,pCount = max player count,reke = reke to cut if any,bv = boot value of table,chips = chips of user}
  +-------------------------------------------------------------------+ */
  logger.info("findTableAndJoin--------------->>>>>>data: ", data);
  const {
    MATCH_MAKING_IP,
    MATCH_MAKING_DEVICE_ID,
    MATCH_MAKING_LAT_LONG,
    MATCH_MAKING_LAT_LONG_METERS,
    ROUND_START_TIMER,
    ROUND_START_TIMER_DEAL_SIX,
    ROUND_START_TIMER_POOL_TWO,
    ROUND_START_TIMER_POOL_SIX,
    ROUND_START_TIMER_PRACTICE,
    ROUND_START_TIMER_POINT_SIX,
    ROUND_START_TIMER_POINT_TWO,
  } = GetConfig();
  findTableExistence(client, false, data.fromRematch, function (check) {
    try {
      logger.info("findTableAndJoin--------------->>>>>>check: " + check);
      data.mode = typeof data.mode != "undefined" ? data.mode : "practice";
      data.pCount = typeof data.pCount != "undefined" ? data.pCount : 2;
      data.pt = typeof data.pt != "undefined" ? data.pt : 101;
      if (check == 1) {
        let where;
        if (data.gt && data.gt == "Deal") {
          where = {
            $and: [
              {
                bv: data.bv,
                gt: "Deal",
                ap: { $lt: data.pCount },
                mode: data.mode,
                deals: data.deals,
                ms: data.pCount,
                "pi.uid": { $ne: client.uid },
                tst: {
                  $in: ["", "RoundTimerStarted"],
                },
                round: 0,
                fromRematch: false,
              },
            ],
          };

          if (MATCH_MAKING_IP && data?.publicIp)
            where.$and[0] = { ...where.$and[0], "pi.publicIp": { $ne: data.publicIp } };

          if (MATCH_MAKING_DEVICE_ID && client?.deviceId)
            where.$and[0] = { ...where.$and[0], "pi.userDeviceId": { $ne: client.deviceId }, };

          if (MATCH_MAKING_LAT_LONG && client?.longitude && client?.latitude)
            where.$and[0] = {
              ...where.$and[0], "pi.location": {
                $nearSphere: {
                  $geometry: { type: "Point", coordinates: [+client.longitude, +client.latitude], }, $minDistance: config.MATCH_MAKING_LAT_LONG_METERS,
                },
              },
            };

          if (data.fromRematch && data.oldTableId) {
            where = {
              $and: [
                {
                  bv: data.bv,
                  gt: "Deal",
                  ap: { $lt: data.pCount },
                  mode: data.mode,
                  deals: data.deals,
                  ms: data.pCount,
                  "pi.uid": { $ne: client.uid },
                  tst: {
                    $in: ["", "RoundTimerStarted"],
                  },
                  round: 0,
                  fromRematch: true,
                  oldTableId: data.oldTableId,
                },
              ],
            };
          }
          logger.info("findTableAndJoin--------------->>>>>>where: ", where);
          db.collection("playing_table")
            .find(where)
            .limit(10)
            .toArray(function (err, resp) {
              if (resp.length > 0) {
                //user found appropriate table
                //join table logic here
                if (resp[0].tst == "RoundTimerStarted") {
                  let st = new Date();
                  let rst = ROUND_START_TIMER;
                  if (data.pCount == 6) {
                    rst = ROUND_START_TIMER_DEAL_SIX;
                  }
                  let Timer = parseInt(rst) - commonClass.GetTimeDifference(resp[0].ctt, st, "second");
                  if (data.fromRematch) {
                    joinSeat(resp[0]._id.toString(), data.theme, client);
                  } else {
                    logger.error(
                      "Timer < 3Timer < 3Timer < 3Timer < 3Timer < 3Timer < 3Timer < 3",
                      Timer,
                      Timer < 3
                    );
                    if (Timer <= 2) {
                      let where = {
                        $and: [
                          {
                            bv: data.bv,
                            gt: "Deal",
                            ap: { $lt: data.pCount },
                            mode: data.mode,
                            deals: data.deals,
                            ms: data.pCount,
                            "pi.uid": { $ne: client.uid },
                            tst: {
                              $in: [""],
                            },
                            round: 0,
                          },
                        ],
                      };

                      if (MATCH_MAKING_IP && data?.publicIp)
                        where.$and[0] = { ...where.$and[0], "pi.publicIp": { $ne: data.publicIp }, };

                      if (MATCH_MAKING_DEVICE_ID && client?.deviceId)
                        where.$and[0] = { ...where.$and[0], "pi.userDeviceId": { $ne: client.deviceId }, };

                      if (MATCH_MAKING_LAT_LONG && client?.longitude && client?.latitude)
                        where.$and[0] = {
                          ...where.$and[0], "pi.location": {
                            $nearSphere: {
                              $geometry: {
                                type: "Point", coordinates: [+client.longitude, +client.latitude,
                                ],
                              },
                              $minDistance: MATCH_MAKING_LAT_LONG_METERS,
                            },
                          },
                        };

                      db.collection("playing_table")
                        .find(where)
                        .limit(10)
                        .toArray(function (err, rsp) {
                          if (rsp.length > 0) {
                            joinSeat(rsp[0]._id.toString(), data.theme, client);
                          } else {
                            generateTable(
                              {
                                use_bot: data.use_bot,
                                bv: data.bv,
                                pCount: data.pCount,
                                tci: client.uid,
                                lvc: data.lvc,
                                gt: "Deal",
                                deals: data.deals,
                                mode: data.mode,
                                catid: data.catid,
                              },
                              function (tbInfo1) {
                                ///join table logic here
                                joinSeat(
                                  tbInfo1._id.toString(),
                                  data.theme,
                                  client
                                );
                              }
                            );
                          }
                        });
                    } else {
                      joinSeat(resp[0]._id.toString(), data.theme, client);
                    }
                  }
                } else {
                  joinSeat(resp[0]._id.toString(), data.theme, client);
                }
              } else {
                //table generate logic here
                generateTable(
                  {
                    use_bot: data.use_bot,
                    bv: data.bv,
                    pCount: data.pCount,
                    tci: client.uid,
                    lvc: data.lvc,
                    gt: "Deal",
                    deals: data.deals,
                    mode: data.mode,
                    catid: data.catid,
                    fromRematch: data.fromRematch,
                    oldTableId: data.oldTableId,
                  },
                  function (tbInfo) {
                    //join table logic here
                    joinSeat(tbInfo._id.toString(), data.theme, client);
                  }
                );
              }
            });
          // }
        } else if (data.gt && data.gt == "Pool") {
          //if user wants to play pool rummy
          where = {
            $and: [
              {
                bv: data.bv,
                gt: "Pool",
                mode: data.mode,
                ap: { $lt: data.pCount },
                ms: data.pCount,
                pt: data.pt,
                "pi.uid": { $ne: client.uid },
                "stdP.uid": { $ne: client.uid },
                tst: {
                  $in: ["", "RoundTimerStarted"],
                },
                round: 0,
              },
            ],
          };

          if (MATCH_MAKING_IP && data?.publicIp)
            where.$and[0] = { ...where.$and[0], "pi.publicIp": { $ne: data.publicIp }, };

          if (MATCH_MAKING_DEVICE_ID && client?.deviceId)
            where.$and[0] = { ...where.$and[0], "pi.userDeviceId": { $ne: client.deviceId }, };

          if (MATCH_MAKING_LAT_LONG && client?.longitude && client?.latitude)
            where.$and[0] = {
              ...where.$and[0], "pi.location": {
                $nearSphere: {
                  $geometry: { type: "Point", coordinates: [+client.longitude, +client.latitude], }, $minDistance: config.MATCH_MAKING_LAT_LONG_METERS,
                },
              },
            };

          logger.info("where-------- MATCH_MAKING_IP", where);
          db.collection("playing_table")
            .find(where)
            // .limit(10)
            .toArray(function (err, resp) {
              // logger.info("resp------------------>", resp);
              if (resp && resp.length > 0) {
                //user found appropriate table
                //join table logic here

                if (resp[0].tst == "RoundTimerStarted") {
                  let st = new Date();
                  let rst = ROUND_START_TIMER;
                  if (data.pCount == 6) {
                    rst = ROUND_START_TIMER_POOL_SIX;
                  } else if (data.pCount == 2) {
                    rst = ROUND_START_TIMER_POOL_TWO;
                  }

                  logger.info("rst---->", rst);
                  let Timer = parseInt(rst) - commonClass.GetTimeDifference(resp[0].ctt, st);
                  logger.info("Timer--------->", Timer);
                  if (Timer <= 2) {
                    logger.info("--------In if-------------");
                    let where = {
                      $and: [
                        {
                          _ip: { $ne: 1 },
                          bv: data.bv,
                          gt: "Pool",
                          ap: { $lt: data.pCount },
                          mode: data.mode,
                          ms: data.pCount,
                          pt: data.pt,
                          "pi.uid": { $ne: client.uid },
                          "stdP.uid": { $ne: client.uid },
                          tst: {
                            $in: [""],
                          },
                          round: 0,
                        },
                      ],
                    };

                    if (MATCH_MAKING_IP && data?.publicIp)
                      where.$and[0] = { ...where.$and[0], "pi.publicIp": { $ne: data.publicIp }, };

                    if (MATCH_MAKING_DEVICE_ID && client?.deviceId)
                      where.$and[0] = { ...where.$and[0], "pi.userDeviceId": { $ne: client.deviceId }, };

                    if (MATCH_MAKING_LAT_LONG && client?.longitude && client?.latitude)
                      where.$and[0] = {
                        ...where.$and[0], "pi.location": {
                          $nearSphere: {
                            $geometry: {
                              type: "Point", coordinates: [+client.longitude, +client.latitude,],
                            },
                            $minDistance: MATCH_MAKING_LAT_LONG_METERS,
                          },
                        },
                      };

                    logger.info("where--------  timer", where);
                    db.collection("playing_table")
                      .find(where)
                      // .limit(10)
                      .toArray(function (err, rsp) {
                        logger.info("rsp------>", rsp);
                        if (rsp.length > 0) {
                          joinSeat(rsp[0]._id.toString(), data.theme, client);
                        } else {
                          generateTable(
                            {
                              bv: data.bv,
                              use_bot: data.use_bot,
                              pCount: data.pCount,
                              tci: client.uid,
                              lvc: data.lvc,
                              // reke: data.reke,
                              gt: "Pool",
                              pt: data.pt,
                              mode: data.mode,
                              catid: data.catid,
                            },
                            function (tbInfo1) {
                              logger.info(
                                "tbInfo1------------------>",
                                tbInfo1
                              );
                              ///join table logic here
                              joinSeat(
                                tbInfo1._id.toString(),
                                data.theme,
                                client
                              );
                            }
                          );
                        }
                      });
                  } else {
                    joinSeat(resp[0]._id.toString(), data.theme, client);
                  }
                } else {
                  joinSeat(resp[0]._id.toString(), data.theme, client);
                }
              } else {
                //table generate logic here

                generateTable(
                  {
                    bv: data.bv,
                    use_bot: data.use_bot,
                    pCount: data.pCount,
                    tci: client.uid,
                    lvc: data.lvc,
                    // reke: data.reke,
                    gt: "Pool",
                    pt: data.pt,
                    mode: data.mode,
                    catid: data.catid,
                  },
                  function (tbInfo) {
                    ///join table logic here
                    joinSeat(tbInfo._id.toString(), data.theme, client);
                  }
                );
              }
            });
          // }
        } else {
          where = {
            $and: [
              {
                bv: data.bv,
                mode: data.mode,
                gt: "Points",
                uCount: { $gt: 0 },
                ap: { $lt: data.pCount },
                ms: data.pCount,
                "pi.uid": { $ne: client.uid },
                "stdP.uid": { $ne: client.uid },
                tst: {
                  $in: ["", "RoundTimerStarted"],
                },
              },
            ],
          };

          if (data.tbid)
            where.$and.push({
              _id: { $ne: getInfo.MongoID(data.tbid) },
            });

          if (MATCH_MAKING_IP && data?.publicIp)
            where.$and[0] = { ...where.$and[0], "pi.publicIp": { $ne: data.publicIp }, };

          if (MATCH_MAKING_DEVICE_ID && client?.deviceId)
            where.$and[0] = { ...where.$and[0], "pi.userDeviceId": { $ne: client.deviceId }, };

          if (MATCH_MAKING_LAT_LONG && client?.longitude && client?.latitude)
            where.$and[0] = {
              ...where.$and[0], "pi.location": {
                $nearSphere: {
                  $geometry: { type: "Point", coordinates: [+client.longitude, +client.latitude], }, $minDistance: config.MATCH_MAKING_LAT_LONG_METERS,
                },
              },
            };

          logger.info("findTableAndJoin------------------>>>>>>where: ", where);
          db.collection("playing_table")
            .find(where)
            .toArray(function (err, resp) {
              if (resp && resp.length > 0) {
                //user found appropriate table to play
                logger.info("findTableAndJoin----if----->>>>>", resp[0]);

                if (resp[0].tst == "RoundTimerStarted") {
                  logger.info(
                    "findTableAndJoin----if----->>>>> resp[0].tst == RoundTimerStarted"
                  );
                  let rst = ROUND_START_TIMER;
                  if (data.pCount == 6) {
                    rst = ROUND_START_TIMER_POINT_SIX;
                  } else if (data.pCount == 2) {
                    rst = ROUND_START_TIMER_POINT_TWO;
                  }

                  let Timer = parseInt(rst) - commonClass.GetTimeDifference(resp[0].ctt, new Date(), "second");
                  logger.info("findTableAndJoin---- >>>>> Timer", Timer);
                  if (Timer <= 2) {
                    logger.info(
                      "findTableAndJoin----if----->>>>> Timer",
                      Timer
                    );
                    where.$and[0].tst = {
                      $in: [""],
                    };

                    logger.info(
                      "findTableAndJoin----else----->>>>> Timer where condi",
                      where
                    );
                    db.collection("playing_table")
                      .find(where)
                      .toArray(function (err1, rsp) {
                        logger.info(
                          "findTableAndJoin--------->>>>> playing_table data",
                          err1,
                          rsp
                        );
                        if (rsp && rsp.length > 0) {
                          logger.info(
                            "findTableAndJoin------ if --->>>>> rsp && rsp.length > 0",
                            err1,
                            rsp
                          );
                          joinSeat(rsp[0]._id.toString(), data.theme, client);
                        } else {
                          logger.info(
                            "findTableAndJoin------esle --->>>>> rsp",
                            err1,
                            rsp
                          );
                          generateTable(
                            {
                              use_bot: data.use_bot,
                              bv: data.bv,
                              mode: data.mode,
                              pCount: data.pCount,
                              tci: client.uid,
                              lvc: data.lvc,
                              catid: data.catid,
                            },
                            function (tbInfo1) {
                              logger.info(
                                "findTableAndJoin----else----------->>>>>>"
                              );
                              joinSeat(
                                tbInfo1._id.toString(),
                                data.theme,
                                client
                              );
                            }
                          );
                        }
                      });
                  } else {
                    logger.info(
                      "findTableAndJoin----else----->>>>> Timer",
                      Timer
                    );
                    joinSeat(resp[0]._id.toString(), data.theme, client);
                  }
                } else {
                  logger.info(
                    "findTableAndJoin----else----->>>>> resp[0].tst == RoundTimerStarted",
                    resp[0]._id.toString()
                  );
                  joinSeat(resp[0]._id.toString(), data.theme, client);
                }
              } else {
                //no table found
                logger.info(
                  'findTableAndJoin------------->>>>>>>>>"create a new table with the same specs"'
                );

                generateTable(
                  {
                    use_bot: data.use_bot,
                    bv: data.bv,
                    mode: data.mode,
                    pCount: data.pCount,
                    tci: client.uid,
                    lvc: data.lvc,
                    catid: data.catid,
                  },
                  function (tbInfo) {
                    logger.info("findTableAndJoin----else----------->>>>>>");
                    joinSeat(tbInfo._id.toString(), data.theme, client);
                  }
                );
              }
            });
          //}
        }
        //});
      } else {
        logger.info(
          "findTableAndJoin------------------>>>>>>table can't be join"
        );
      }
    } catch (error) {
      logger.error("-----> error findTableExistence", error);
      getInfo.exceptionError(error);
    }
  });
};

const joinSeat = async (tbId, theme, client) => {
  try {
    //data = table data
    /* +-------------------------------------------------------------------+
    desc:function to join seat for user
    i/p: tbId = _id of table,client = socket object
  +-------------------------------------------------------------------+ */

    // lock = await redlock.acquire(`locks:${tbId.toString()}`, 2000);
    const {
      MAX_DEADWOOD_PTS,
      SECONDARY_TIMER,
      ROUND_START_TIMER,
      ROUND_START_TIMER_POINT_TWO,
      ROUND_START_TIMER_POINT_SIX,
      ROUND_START_TIMER_POOL,
      ROUND_START_TIMER_POOL_SIX,
      ROUND_START_TIMER_POOL_TWO,
      ROUND_START_TIMER_DEAL_SIX,
      ROUND_START_TIMER_PRACTICE,
      REDUCETIMER_TWO_PLAYER,
      REDUCETIMER_FOUR_PLAYER,
      REDUCETIMER_FIVE_PLAYER,
      REDUCETIMER_SIX_PLAYER,
      MAX_TIMEOUT,
      JOIN_USER_REDUCTIVE_FLAG
    } = GetConfig();
    logger.info(
      "joinSeat-------------->>>>>client._ir:" +
      client._ir +
      " client.uid: " +
      client.uid +
      " tbId: " +
      tbId
    );
    if (theme == null || typeof theme == "undefined") {
      theme = "red";
    }
    db.collection("playing_table").findOne(
      { _id: getInfo.MongoID(tbId.toString()), ap: { $lt: 6 } },
      async function (err, tbData) {
        if (tbData) {
          getInfo.GetUserInfo(
            client.uid,
            {
              _id: 1,
              tId: 1,
              ue: 1,
              un: 1,
              pp: 1,
              ip: 1,
              publicIp: 1,
              unique_id: 1,
              phn: 1,
              flags: 1,
              Chips: 1,
              rlsAmount: 1,
              cAmount: 1,
              totalcash: 1,
              wc: 1,
              tbid: 1,
              counters: 1,
              state: 1,
            },
            function (userInfo) {
              if (userInfo) {
                userInfo.tId = userInfo.tId ?? "";
                isFirstTimeUser(
                  userInfo,
                  tbData.ms,
                  tbData.gt,
                  async function (isSpc) {
                    if (!tbData.isSpc) {
                      isSpc = false;
                    }

                    if (userInfo.flags._ir == 1) {
                      isSpc = tbData.isSpc;
                    }
                    let cutchip = tbData.bv;
                    if (tbData.gt == "Points") {
                      cutchip = tbData.bv * MAX_DEADWOOD_PTS;
                    } else if (tbData.gt == "Pool") {
                      cutchip = tbData.bv;
                    }
                    let trobj = {
                      tbid: tbId,
                      uid: client.uid,
                      rid: tbData.rid,
                      s: "joinSeat",
                    };
                    trackClass.Leave_Track(trobj);
                    logger.info(
                      "cutchip------------->",
                      cutchip,
                      userInfo.cAmount,
                      userInfo.flags._ir
                    );
                    // if (lock) await lock.unlock();
                    logger.info("userInfo.cAmount", userInfo.cAmount);
                    logger.info("tbData.mode == practice", tbData.mode);
                    logger.info("userInfo.flags._ir", userInfo.flags._ir);

                    if (
                      !userInfo.cAmount ||
                      tbData.mode == "practice" ||
                      userInfo.flags._ir == 1 ||
                      userInfo.flags._ir == 0 ||
                      tbData.gt === "Deal"
                    ) {
                      collectBootValueClass.collectBootValue(
                        tbData._id.toString(),
                        tbData.mode,
                        tbData.gt,
                        0,
                        userInfo._id.toString(),
                        cutchip,
                        async function (res) {
                          if (res) {
                            logger.info(
                              "joinSeat------collectBootValue--->>>",
                              res
                            );
                            if (client.isInvite) {
                              delete client.isInvite;
                            }
                            logger.info(
                              "joinSeat------collectBootValue--->>> tbData.gt",
                              tbData.gt
                            );
                            let nuser = false;
                            let tdps = 0;
                            if (tbData.gt == "Points") {
                              if (
                                userInfo.counters.hpc < config.NEWUSER &&
                                tbData.bv <= config.MAX_BV_NUSER_POINT &&
                                tbData.bv >= config.MIN_BV_NUSER_POINT
                              ) {
                                nuser = true;
                              }
                            } else if (tbData.gt == "Pool") {
                              if (
                                userInfo.counters.hpc < config.NEWUSER &&
                                tbData.bv <= config.MAX_BV_NUSER_POOL &&
                                tbData.bv >= config.MIN_BV_NUSER_POOL
                              ) {
                                nuser = true;
                              }
                            } else if (tbData.gt == "Deal") {
                              tdps = tbData.deals * MAX_DEADWOOD_PTS;
                              if (
                                userInfo.counters.hpc < config.NEWUSER &&
                                tbData.bv <= config.MAX_BV_NUSER_DEAL &&
                                tbData.bv >= config.MIN_BV_NUSER_DEAL
                              ) {
                                nuser = true;
                              }
                            } else if (
                              userInfo.counters.hpc < config.NEWUSER &&
                              tbData.bv <= config.MAX_BV_NUSER_POINT &&
                              tbData.bv >= config.MIN_BV_NUSER_POINT
                            ) {
                              nuser = true;
                            }

                            if (tbData.mode == "cash") {
                              userInfo.totalcash = userInfo.totalcash - res;
                            } else {
                              userInfo.Chips = userInfo.Chips - res;
                            }

                            let seat = commonData.findEmptySeat(tbData.pi);
                            logger.info(
                              "joinSeat------------>>>>>userInfo: seat",
                              seat
                            );
                            logger.info("seat---------------->", seat);
                            logger.info(
                              "------+++++++------->",
                              seat == -1 && userInfo.flags._ir == 0
                            );
                            if (seat == -1 && userInfo.flags._ir == 0) {
                              //seat not found
                              logger.info(
                                "joinSeat----------->>>>>>seat == -1"
                              );
                              findTableAndJoin(
                                {
                                  bv: tbData.bv,
                                  lvc: userInfo.counters.lvc,
                                  chips: userInfo.Chips,
                                  tbid: tbData._id.toString(),
                                  mode: tbData.mode,
                                  pCount: tbData.ms,
                                  deals: tbData.deals,
                                  pt: tbData.pt,
                                  theme: "Red",
                                  gt: tbData.gt,
                                  catid: tbData.categoryId,
                                  publicIp: userInfo.publicIp,
                                },
                                client,
                                0
                              );
                              // findTableAndJoin(
                              //   {
                              //     gt: tbData.gt,
                              //     pCount: tbData.ms,
                              //     bv: tbData.bv,
                              //     reke: tbData.reke,
                              //     mode: tbData.mode,
                              //     chips: userInfo.Chips,
                              //     tbid: tbData._id.toString(),
                              //     catid: tbData.categoryId,
                              //   },
                              //   client,
                              //   0
                              // );
                              return false; ///if game stucks look here
                            } else if (seat == -1 && client._ir == 1) {
                              logger.info(
                                'joinSeat--------------->>>>>Msg:"no seat for robot!!!"'
                              );
                              return false; ///if game stucks look here
                            }

                            let rType = "";
                            let uName = userInfo.un;
                            if (client._ir == 1) {
                              if (client.rType) {
                                rType = client.rType;
                              } else {
                                rType = "Newbie";
                              }
                            }

                            logger.info(
                              "joinSeat------------>>>>>userInfo: ",
                              userInfo
                            );
                            let sts = "";

                            // if (
                            //   (_.contains(["Points"], tbData.gt) &&
                            //     !_.contains(
                            //       ["", "RoundTimerStarted"],
                            //       tbData.tst
                            //     )) ||
                            //   (_.contains(["Deal", "Pool"], tbData.gt) &&
                            //     (!_.contains(
                            //       ["", "RoundTimerStarted"],
                            //       tbData.tst
                            //     ) ||
                            //       tbData.round > 0))
                            // ) {
                            //   sts = "watch";
                            // }

                            let updateInfo = {
                              uid: userInfo._id.toString(), //	user id
                              tid: userInfo.tId, //	prithvi uid
                              userIp: userInfo.ip,
                              userDeviceId: client.deviceId,
                              jiid: "",
                              jt: new Date(), //	join time
                              gst: new Date(), //  game start time
                              gedt: new Date(), //  game end time
                              rndCount: 0, //  round count
                              si: seat, //	seat index
                              ue: userInfo.ue, //	user email
                              mobile: userInfo.phn, //	user mobile
                              un: uName.substring(0, 10), //	user name
                              state: userInfo.state, //	user state
                              unique_id: userInfo.unique_id, // unique_id for user id
                              pp: userInfo.pp, //	profile picture
                              publicIp: userInfo.publicIp,
                              theme: theme, //  color theme of table
                              Chips: userInfo.Chips, // 	player chips
                              totalCash: userInfo.totalcash, //  user total cash
                              upc: res, //  user play cash
                              userViewCashChips: res,
                              topup: 0, // 	topup
                              winAmount: 0, //	win amount to add while leave tabel
                              _ir: userInfo.flags._ir, //	is robot or not
                              rType: rType, // 	robot type not applicable for user
                              s: sts, //	status
                              indecl: false, //	invalide declare status
                              play: 0, //  is playing in current deal
                              tCount: 0, //	timeout count
                              sort: true, //  show sort button
                              ps: 0, //	cards points (deadwood)
                              dps: 0, //  deal total points
                              tdps: tdps,
                              tScore: 0,
                              pts: 0, //  points to be multiplied with bv
                              secTime: SECONDARY_TIMER, // 	secondary remaining time
                              sct: false, //	secondary timer flag
                              tsd: new Date(), // 	timer start time
                              ted: new Date(), //	timer end time
                              bet: tbData.bv, //  bet set by players
                              cards: [], //	player cards
                              gCards: { pure: [], seq: [], set: [], dwd: [] }, //  group cards formatted array
                              userShowCard: {}, //  group cards formatted array for show on table screen
                              dCards: {}, //  declared cards
                              score: 0, //	user score
                              wc: 0, //  win chips
                              pickCount: 0, //  cards pick count
                              leave: 0,
                              _isleave: 0,
                              _rematch: 0,
                              //isSpc:isSpc,									//  is special user
                              nuser: nuser,
                              rw: 0,
                              rl: 0,
                              thp: userInfo.counters.thp, //  total game played by user
                              hpc: userInfo.counters.hpc,
                              lpc: "", //	last picked card
                              occ: 0,
                              _iw: 0, //  is winner or not
                              dealewinner: 0,
                              pco: false,
                              isCollect: 0, //	is boot value collected
                              maxUserTimeout: MAX_TIMEOUT,
                              turnCounter: 0,
                            };

                            if (client.longitude && client.latitude) {
                              updateInfo.location = {
                                type: "Point",
                                coordinates: [
                                  +client.longitude,
                                  +client.latitude,
                                ],
                              };
                            }

                            logger.info(
                              "joinSeat----------->>>>>tbData.jid: ",
                              tbData.jid
                            );

                            // jtClass.cancelJobOnServers(tbData._id.toString(),tbData.jid);

                            logger.info(
                              "joinSeat-----1111111---->>> name: " +
                              userInfo.un,
                              "seat: ",
                              seat,
                              " tableid: ",
                              tbData._id
                            );

                            let Chips = userInfo.Chips;
                            let cash = userInfo.totalcash;

                            let where = {
                              _id: getInfo.MongoID(tbData._id.toString()),
                            };
                            where["pi." + seat + ".si"] = { $exists: false };

                            let extraChips = 0;
                            let cond = false;
                            let cpp = 0;
                            if (MAX_DEADWOOD_PTS > 0) {
                              cpp =
                                tbData.gt == "Deal" || tbData.gt == "Pool"
                                  ? tbData.bv / MAX_DEADWOOD_PTS
                                  : tbData.bv;
                            }
                            logger.info(
                              "joinSeat------------------------>>>>>>cpp: " +
                              cpp
                            );
                            db.collection("robot_chips")
                              .find({
                                lowerCpp: { $lte: cpp },
                                mode: tbData.mode,
                              })
                              .sort({ lowerCpp: -1 })
                              .toArray(function (error, robotChips) {
                                logger.info(
                                  "joinSeat---------------------->>>>>>robotChips: " +
                                  robotChips
                                );
                                if (
                                  robotChips &&
                                  robotChips.length > 0 &&
                                  client._ir == 1
                                ) {
                                  let robotExtraChips = 0;
                                  robotExtraChips = commonClass.GetRandomInt(
                                    robotChips[0].lowerChips,
                                    robotChips[0].upperChips
                                  );
                                  logger.info(
                                    "joinSeat------------1---------->>>>>>>robotExtraChips: " +
                                    robotExtraChips
                                  );
                                  robotExtraChips =
                                    robotExtraChips - (robotExtraChips % 100); //rounding robot chips  to 100

                                  if (tbData.mode == "cash") {
                                    extraChips = robotExtraChips - cash;
                                  } else {
                                    extraChips = robotExtraChips - Chips;
                                  }
                                  Chips = robotExtraChips;
                                  cond = true;
                                  logger.info(
                                    "joinSeat----------2------------->>>>>>extraChips: " +
                                    extraChips +
                                    " Chips: " +
                                    Chips
                                  );
                                }

                                let extraMulti = 1;

                                if (rType == "Newbie") {
                                  extraMulti = 1.5;
                                } else if (rType == "Amateur") {
                                  extraMulti = 2;
                                } else if (rType == "Pro") {
                                  extraMulti = 2.5;
                                } else if (rType == "God") {
                                  extraMulti = 3;
                                }

                                let cond1 =
                                  tbData.gt == "Deal" || tbData.gt == "Pool"
                                    ? Chips < tbData.bv
                                    : Chips < tbData.bv * MAX_DEADWOOD_PTS;
                                if (client._ir == 1) {
                                  if (cond1) {
                                    if (
                                      tbData.gt == "Deal" ||
                                      tbData.gt == "Pool"
                                    ) {
                                      extraChips = tbData.bv * extraMulti;
                                    } else {
                                      extraChips =
                                        tbData.bv *
                                        MAX_DEADWOOD_PTS *
                                        extraMulti;
                                    }

                                    if (tbData.mode == "cash") {
                                      Chips = userInfo.totalcash + extraChips;
                                    } else {
                                      Chips = userInfo.Chips + extraChips;
                                    }
                                  }

                                  if (tbData.mode == "practice") {
                                    updateInfo.Chips = Chips;
                                  } else if (tbData.mode == "cash") {
                                    updateInfo.cash = Chips;
                                  }
                                }

                                commonData.getUserScore(
                                  updateInfo.uid,
                                  tbData.bv,
                                  tbData.gt,
                                  async function (score) {
                                    updateInfo.score = score;

                                    eval(
                                      'var upData = {$set : {la:new Date(),isSpc:isSpc,"pi.' +
                                      seat +
                                      '":updateInfo},$inc:{ap:1, fromRematchAP:1, start_totalap:1,total_player_join:1}}'
                                    );

                                    if (client._ir == 0) {
                                      upData.$inc.uCount = 1;
                                    }

                                    logger.info(
                                      "joinSeat------222222222--->>> name: db.collection playing_table",
                                      where
                                    );

                                    let seatAfter = commonData.findEmptySeat(
                                      tbData.pi
                                    );
                                    logger.info(
                                      "joinSeat------------>>>>>userInfo: seatAfter",
                                      seatAfter
                                    );

                                    db.collection(
                                      "playing_table"
                                    ).findAndModify(
                                      where,
                                      {},
                                      upData,
                                      { new: true },
                                      async function (err1, resp) {
                                        logger.info(
                                          "joinSeat------222222222--->>> name: playing_table",
                                          resp
                                        );
                                        resp = resp.value;
                                        // logger.info("resp--------->", resp);
                                        logger.info(
                                          "joinSeat------222222222--->>> name: " +
                                          userInfo.un +
                                          "seat: " +
                                          seat +
                                          " tableid: " +
                                          tbData._id,
                                          resp
                                        );

                                        if (!resp) {
                                          logger.info(
                                            "joinSeat------222222222--->>> name: playing_table if (!resp)",
                                            resp,
                                            !resp
                                          );
                                          logger.info(
                                            "joinSeat------222222222--->>> name: playing_table if (tbData.mode == cash)",
                                            tbData.mode,
                                            tbData.mode == "cash"
                                          );
                                          if (tbData.mode == "cash") {
                                            let trackObj = {
                                              tbid: tbData._id.toString(),
                                              uid: client.uid,
                                              rid: tbData.rid,
                                              s: "user added in table error",
                                            };
                                            trackClass.Leave_Track(trackObj);
                                            logger.info(
                                              "joinSeat------222222222--->>> name: playing_table trackObj",
                                              trackObj
                                            );
                                            await commonData.UpdateUserCash(
                                              client.uid,
                                              res,
                                              "release remaining amount",
                                              tbData._id.toString(),
                                              false,
                                              true,
                                              tbData
                                            );
                                            logger.info(
                                              "joinSeat------222222222--->>> name: commonData.UpdateUserCash",
                                              client.uid,
                                              res,
                                              tbData._id.toString()
                                            );
                                          }

                                          logger.info(
                                            "joinSeat------222222222--->>> name: playing_table  if (client._ir == 0)",
                                            client._ir,
                                            client._ir == 0
                                          );
                                          if (client._ir == 0) {
                                            //seat not found
                                            logger.info(
                                              'joinSeat----------->>>>>>MSG:"seat occupied"'
                                            );
                                            findTableAndJoin(
                                              {
                                                bv: tbData.bv,
                                                lvc: userInfo.counters.lvc,
                                                chips: userInfo.Chips,
                                                tbid: tbData._id.toString(),
                                                mode: tbData.mode,
                                                pCount: tbData.ms,
                                                pt: tbData.pt,
                                                deals: tbData.deals,
                                                theme: "Red",
                                                gt: tbData.gt,
                                                catid: tbData.categoryId,
                                                publicIp: userInfo.publicIp,
                                              },
                                              client,
                                              0
                                            );
                                            return false; ///if game stucks look here
                                          } else if (client._ir == 1) {
                                            logger.info(
                                              'joinSeat--------------->>>>>Msg:"no seat for robot!!!"'
                                            );
                                            return false; ///if game stucks look here
                                          } else {
                                            return false; ///if game stucks look here
                                          }
                                        }

                                        let trobject = {
                                          tbid: tbData._id.toString(),
                                          uid: client.uid,
                                          rid: tbData.rid,
                                          s: "user added in table",
                                        };
                                        trackClass.Leave_Track(trobject);
                                        let _isHelp = 0;
                                        let deal_c = userInfo.counters.deal_c;
                                        let pool_c = userInfo.counters.pool_c;
                                        let bet_c = userInfo.counters.bet_c;

                                        logger.info(
                                          "joinSeat------333333--->>> name: " +
                                          userInfo.un +
                                          "seat: " +
                                          seat +
                                          " tableid: " +
                                          tbData._id +
                                          " updateInfo: ",
                                          updateInfo,
                                          " _isHelp: " + _isHelp
                                        );

                                        commonData.GetTableInfo(
                                          {
                                            tbid: resp._id.toString(),
                                            _isHelp: _isHelp,
                                            rejoin: 0,
                                            jnbk: 0,
                                          },
                                          client,
                                          async function () {
                                            if (client._ir == 0) {
                                              let single = client.sck.replace(
                                                SERVER_ID + ".",
                                                ""
                                              );
                                              logger.info(
                                                "joinSeat-----before----->>>>connected sockets: ",
                                                io.sockets.adapter.rooms[resp._id.toString()]
                                              );
                                              logger.info("joinSeat--------->>>>>>single: ", single);
                                              if (
                                                socketData.getSocketObjects(
                                                  single
                                                )
                                              ) {
                                                socketData.getSocketObjects(single).join(resp._id.toString());
                                                client.tbid =
                                                  resp._id.toString(); //adding  tableid to client
                                                client.si = seat; //adding seat index to client
                                                client.gt = resp.gt;
                                              }
                                              logger.info(
                                                "joinSeat-----after----->>>>connected sockets: ",
                                                io.sockets.adapter.rooms[resp._id.toString()]
                                              );
                                              logger.info(
                                                "joinSeat---------->>>>>>>>client.tbid: " +
                                                client.tbid,
                                                " client.si: " + client.si
                                              );
                                              getInfo.UpdateUserData(
                                                userInfo._id,
                                                {
                                                  $set: {
                                                    tbid: resp._id.toString(),
                                                    bv: resp.bv,
                                                    sck: client.sck,
                                                    "counters.deal_c": deal_c,
                                                    "counters.pool_c": pool_c,
                                                    "counters.bet_c": bet_c,
                                                  },
                                                },
                                                function (userInfo1) { }
                                              );
                                            } else {
                                              let rSck =
                                                SERVER_ID +
                                                "." +
                                                commonClass.GetRandomString(20);
                                              let game_id = tbData.game_id;
                                              let sub_id = tbData.sub_id;

                                              if (
                                                _.contains(
                                                  [
                                                    "",
                                                    "RoundTimerStarted",
                                                    "CollectingBootValue",
                                                    "StartDealingCard",
                                                  ],
                                                  tbData.tst
                                                )
                                              ) {
                                                game_id = game_id + 1;
                                                sub_id = sub_id + 1;
                                              }

                                              if (
                                                tbData.gt == "Deal" ||
                                                tbData.gt == "Pool"
                                              ) {
                                                if (tbData.round == 0) {
                                                  game_id = game_id + ".1";
                                                } else {
                                                  game_id =
                                                    game_id + "." + sub_id;
                                                }
                                              }

                                              logger.info(
                                                "joinSeat-------------->>>>>>rSck: ",
                                                rSck
                                              );
                                              if (cond || cond1) {
                                                if (resp.mode == "practice") {
                                                  commonData.UpdateUserChips(
                                                    userInfo._id.toString(),
                                                    extraChips,
                                                    "Extra Chips"
                                                  );
                                                } else if (
                                                  resp.mode == "cash"
                                                ) {
                                                  commonData.UpdateUserCash(
                                                    userInfo._id.toString(),
                                                    extraChips,
                                                    "Extra Cash",
                                                    "",
                                                    false,
                                                    false
                                                  );
                                                }
                                                getInfo.UpdateUserData(
                                                  userInfo._id,
                                                  {
                                                    $set: {
                                                      tbid: resp._id.toString(),
                                                      sck: rSck,
                                                      "lasts.ll": new Date(),
                                                      s: "busy",
                                                      "counters.opc": 0,
                                                    },
                                                    $inc: { sessId: 1 },
                                                  },
                                                  function (rbInfo) { }
                                                );
                                              } else {
                                                getInfo.UpdateUserData(
                                                  userInfo._id,
                                                  {
                                                    $set: {
                                                      tbid: resp._id.toString(),
                                                      sck: rSck,
                                                      "lasts.ll": new Date(),
                                                      s: "busy",
                                                      "counters.opc": 0,
                                                    },
                                                    $inc: { sessId: 1 },
                                                  },
                                                  function (rbInfo) { }
                                                );
                                              }
                                            }

                                            getInfo.UpdateTableData(
                                              resp._id.toString(),
                                              { $set: { tci: "", dealer: -1 } },
                                              function (upData) { }
                                            );

                                            commonClass.FireEventToTable(
                                              resp._id.toString(),
                                              {
                                                en: "JoinTable",
                                                data: {
                                                  ap: resp.ap,
                                                  si: seat,
                                                  rpsts: resp.pi[seat].rpsts,
                                                  pts: resp.pi[seat].pts,
                                                  dps: resp.pi[seat].dps,
                                                  tdps: resp.pi[seat].tdps,
                                                  ps: resp.pi[seat].ps,
                                                  _rp: resp.pi[seat]._rp,
                                                  uid: userInfo._id.toString(),
                                                  un: uName,
                                                  pp: userInfo.pp,
                                                  _ir: userInfo.flags._ir,
                                                  secTime:
                                                    resp.pi[seat].secTime,
                                                  Chips: Chips,
                                                  totalCash:
                                                    resp.pi[seat].totalCash,
                                                  upc: resp.pi[seat].upc,
                                                  userViewCashChips:
                                                    resp.pi[seat].upc,
                                                  bet: resp.bv,
                                                  s: sts,
                                                },
                                                flag: true,
                                              },
                                              "JOIN_TABLE"
                                            );
                                            if (client._ir == 0) {
                                              let gameTypeRedis = resp.gt;
                                              if (gameTypeRedis == "Pool") {
                                                gameTypeRedis = `${gameTypeRedis}${resp.pt}`;
                                              }
                                              increment(
                                                `${resp.mode}:${gameTypeRedis}`
                                              );

                                              increment(
                                                `${resp.mode}:${gameTypeRedis}:${resp.categoryId}`
                                              );
                                            }

                                            let trcobj = {
                                              tbid: tbData._id.toString(),
                                              uid: client.uid,
                                              rid: tbData.rid,
                                              s: "send JT",
                                            };
                                            trackClass.Leave_Track(trcobj);

                                            if (!resp.fromRematch) {
                                              commonClass.fireEventToAll({
                                                en: "JoiningUsers",
                                                data: {
                                                  joinedPlayers: resp.ms == resp.ap ? "0" : resp.ap.toString(),
                                                  _id: resp.categoryId.toString(),
                                                  playerCount: resp.ms,
                                                },
                                                tableIds: await db.collection("playing_table").distinct("_id"),
                                              });
                                            }

                                            roundClass.initializeGame(
                                              resp._id.toString(),
                                              false,
                                              tbData.fromRematch,
                                              userInfo._id.toString()
                                            );

                                            logger.info("resp.tst", resp.tst, "client._ir", client._ir);

                                            if (resp.tst == "RoundTimerStarted" && client._ir == 0) {
                                              logger.info("resp.tst == RoundTimerStarted", resp.tst == "RoundTimerStarted");
                                              let startTime = new Date();

                                              let roundStartTimer = ROUND_START_TIMER;

                                              logger.info("resp.gt === Deal", resp.gt);
                                              logger.info("resp.ms", resp.ms, resp.round);
                                              logger.info("resp.updateRoundTimer------->", resp.updateRoundTimer);

                                              if (resp.gt === "Deal" /* && resp.round */) {
                                                if (resp.ms == 6 || resp.round > 0) {
                                                  roundStartTimer = ROUND_START_TIMER_DEAL_SIX;
                                                }
                                              } else if (resp.gt === "Pool") {
                                                if (resp.ms == 6) {
                                                  roundStartTimer = ROUND_START_TIMER_POOL_SIX;
                                                } else if (resp.ms == 2) {
                                                  roundStartTimer = ROUND_START_TIMER_POOL_TWO;
                                                }
                                                if (resp.round > 0) {
                                                  roundStartTimer = ROUND_START_TIMER_POOL;
                                                }


                                              } else {
                                                if (resp.ms == 6) {
                                                  roundStartTimer = ROUND_START_TIMER_POINT_SIX;
                                                } else if (resp.ms == 2) {
                                                  roundStartTimer = ROUND_START_TIMER_POINT_TWO;
                                                }
                                              }

                                              // if (resp.updateRoundTimer) {
                                              //   roundStartTimer = resp.updateRoundTimer;
                                              // }
                                              logger.info("roundStartTimer-------->", roundStartTimer);

                                              //find table
                                              let findTable = await db
                                                .collection("playing_table")
                                                .findOne(
                                                  {
                                                    _id: getInfo.MongoID(
                                                      resp._id.toString()
                                                    ),
                                                  },
                                                  {
                                                    projection: {
                                                      jid: 1,
                                                      pi: 1,
                                                      ctt: 1,
                                                    },
                                                  }
                                                );

                                              let remainTimer = +roundStartTimer - commonClass.GetTimeDifferenceForRound(findTable.ctt, startTime, "second");
                                              // let remainTimer = +roundStartTimer - commonClass.GetTimeDifference(findTable.ctt, startTime, "second");

                                              logger.info("remain----->", remainTimer, '---1--->', REDUCETIMER_TWO_PLAYER);
                                              let newRst;
                                              if (resp.ms == 2 && remainTimer > REDUCETIMER_TWO_PLAYER && JOIN_USER_REDUCTIVE_FLAG) {
                                                logger.info('-----in if----------->>>');
                                                newRst = REDUCETIMER_TWO_PLAYER;
                                              }
                                              /* else if (resp.ap == 4 &&
                                                remainTimer > REDUCETIMER_FOUR_PLAYER
                                              ) {
                                                newRst = REDUCETIMER_FOUR_PLAYER;
                                              } else if (resp.ap == 5 &&
                                                remainTimer > REDUCETIMER_FIVE_PLAYER
                                              ) {
                                                newRst = REDUCETIMER_FIVE_PLAYER;
                                              } */
                                              else if (resp.ap == 6 && remainTimer > REDUCETIMER_SIX_PLAYER && JOIN_USER_REDUCTIVE_FLAG) {
                                                logger.info('------in else if-------');
                                                newRst = REDUCETIMER_SIX_PLAYER;
                                              }

                                              let pi = [];
                                              for (let j of findTable.pi) {
                                                let dt = {
                                                  uid: j.uid,
                                                  si: j.si,
                                                  s: j.s,
                                                };
                                                pi.push(dt);
                                              }
                                              logger.info("newRst------>", newRst);

                                              if (!tbData?.fromRematch) {
                                                commonClass.FireEventToTable(
                                                  resp._id.toString(),
                                                  {
                                                    en: "RoundTimerStarted",
                                                    data: {
                                                      timer: JOIN_USER_REDUCTIVE_FLAG && newRst ? newRst : remainTimer,
                                                      // timer: remainTimer,
                                                      tie: resp.tie,
                                                      bv: resp.bv,
                                                      next: 0,
                                                      newgame: false,
                                                      pi: pi,
                                                      round: resp.round + 1,
                                                      // serverCurrentMillis: moment.utc().valueOf(),
                                                    },
                                                  }
                                                );
                                              }
                                              if (newRst && JOIN_USER_REDUCTIVE_FLAG && !tbData?.fromRematch) {
                                                getInfo.UpdateTableData(
                                                  resp._id.toString(),
                                                  {
                                                    $set: {
                                                      updateRoundTimer: newRst,
                                                      ctt: new Date(),
                                                    },
                                                  }
                                                );

                                                logger.info("reschedule job timer------->", new Date());
                                                // let stt = commonClass.AddTime(newRst);
                                                // schedule.rescheduleJob(
                                                //   findTable.jid,
                                                //   new Date(stt),
                                                //   function () {
                                                //     logger.info("roundTimer recursive rescheduleJob");
                                                //   });

                                                const jobId = `${resp.gt}:roundTimerStart:${resp._id.toString()}`;
                                                const jobNewId = `${resp.gt}:roundCutTimerStart:${resp._id.toString()}:`;
                                                logger.info("reschedule job timer-------> jobId", jobId, jobNewId);

                                                // await scheduler.cancelJob.cancelRoundTimerStart(jobId);
                                                // await scheduler.cancelJob.cancelRoundTimerStart(jobNewId);
                                                cancelJob(jobId);
                                                cancelJob(jobNewId);


                                                // await scheduler.queues.roundTimerStart({
                                                //   timer: newRst * 1000,
                                                //   jobId: jobNewId,
                                                //   tableId: resp._id.toString(),
                                                // });

                                                const jobData = {
                                                  tableId: resp._id.toString(),
                                                  calling: ROUND_TIMER_START_TIMER
                                                };
                                                const jobOption = { delay: newRst * 1000, jobId: jobNewId };
                                                addQueue(jobData, jobOption);
                                              }
                                            }
                                            // if (lock) {
                                            //   await lock.release();
                                            // }
                                            db.collection("play_track").findOne(
                                              { tbid: resp._id.toString() },
                                              function (err, tbData) {
                                                logger.info("--------------tbData: ", tbData);
                                                if (tbData) {
                                                  let upData = {
                                                    $set: { la: new Date() },
                                                  };
                                                  let insdata = {
                                                    uid: resp.pi[seat].uid,
                                                    un: resp.pi[seat].un,
                                                    si: resp.pi[seat].si,
                                                    cutchips: resp.pi[seat].upc,
                                                    thp: resp.pi[seat].thp,
                                                    leave: 0,
                                                    _ir: resp.pi[seat]._ir,
                                                  };
                                                  upData["$addToSet"] = {
                                                    pi: insdata,
                                                  };

                                                  db.collection(
                                                    "play_track"
                                                  ).updateOne(
                                                    {
                                                      tbid: resp._id.toString(),
                                                    },
                                                    upData,
                                                    function (err, ress) { }
                                                  );
                                                } else {
                                                  trackClass.PlayingTrack(
                                                    resp._id.toString(),
                                                    "start"
                                                  );
                                                }
                                              }
                                            );
                                          }
                                        );
                                      }
                                    );
                                  }
                                );
                              });
                          } else {
                            logger.info(
                              "problem in collectBootValue: point mode"
                            );
                          }
                        }
                      );
                    } else {
                      logger.info(
                        "joinSeat--------->>>>>:can't collect boot value user's in already collect boot value"
                      );
                    }
                  }
                );
              } else {
                logger.info('joinSeat-------------->>>>>"user data not found"');
              }
            }
          );
        } else {
          logger.info(
            'joinSeat::::::::::::::::::>>>>>>>Error: "tbData not found!!!"'
          );
          return false;
        }
      }
    );
  } catch (error) {
    logger.error("-----> error findTableExistence", error);
    getInfo.exceptionError(error);
  } finally {
    // if (lock) await lock.unlock();
  }
};

const findTableExistence = (client, onInvite, fromRematch, cb) => {
  try {
    /* +-------------------------------------------------------------------+
    desc:function to check whether the user is set on any table or not
    i/p: client = socket object,onInvite = true/false if called when user is invited by someone,cb = callback function
  +-------------------------------------------------------------------+ */
    db.collection("playing_table")
      .find({ $or: [{ "pi.uid": client.uid }, { "stdP.uid": client.uid }] })
      .project({ pi: 1 })
      .toArray(function (err, table) {
        logger.info("findTableExistence------------->>>>>>>table: ", table);

        if (table && table.length > 0) {
          for (var i in table[0].pi) {
            if (
              !_.isEmpty(table[0].pi[i]) &&
              table[0].pi[i].uid == client.uid
            ) {
              logger.info(
                "findTableExistence-------------->>>>>>player on playing table",
                cb
              );
              client.tbid = table[0]._id.toString();
              client.si = table[0].pi[i].si;
              client.gt = table[0].gt;
              leaveTableClass.LeaveTable(
                { flag: "remain", onInvite: onInvite, fromRematch, eliminated: true },
                client,
                function (check) {
                  logger.info(
                    "findTableExistence----check---->>>>>check :",
                    check,
                    cb
                  );
                  if (typeof cb == "function") {
                    logger.info(
                      "findTableExistence----1---->>>>>check :",
                      check
                    );
                    cb(check);
                  }
                }
              );
              return;
            }
          }
          //means player is in standup
          logger.info(
            "findTableExistence---------------->>>>>>player is standup"
          );
          client.tbid = table[0]._id.toString();
          logger.info(
            "findTableExistence-------------->>>>si: " +
            client.si +
            "  client.tbid: " +
            client.tbid
          );
          leaveTableClass.LeaveTable(
            { flag: "remain", onInvite: onInvite, eliminated: true },
            client,
            function (check) {
              if (typeof cb == "function") {
                logger.info("findTableExistence-----2---->>>>>check :", check);
                cb(check);
              }
            }
          );
        } else {
          cb(1);
        }
      });
  } catch (error) {
    logger.error("-----> error main findTableExistence", error);
    getInfo.exceptionError(error);
  }
};

const generateTable = async (data, callback) => {
  try {
    //data = {bv,pCount,reke,gt,_ip} ; pCount,reke and gt iff gt == Deal or Pool
    /* +-------------------------------------------------------------------+
      desc:function to generate table for playing
      i/p: data = {bv = boot value,pCount = max player,reke = reke to cut,gt = game type,_ip:true/false}, callback = callback function
    +-------------------------------------------------------------------+ */
    logger.info("generateTable------->>>>>data: ", data);
    let gt = "Points";
    let pi = [{}, {}, {}, {}, {}, {}];
    let ms = data.pCount;
    let prize = 0;
    let reke = 0;
    let minS = 1;
    let pt = 101;
    let deals = 2;
    data.mode = typeof data.mode != "undefined" ? data.mode : "practice";
    if (data.gt && data.gt == "Deal") {
      gt = "Deal";
      ms = data.pCount;
      deals = data.deals;
      // reke = data.reke;
      // prize = data.bv * data.pCount * ((100 - reke) * 0.01); //table prize
      minS = data.pCount;
      if (data.pCount == 2) {
        //no requirement for additional seats if there are only two players
        pi = [{}, {}];
      } else {
        pi = [{}, {}, {}, {}, {}, {}];
        if (data.mode == "practice") {
          minS = config.MIN_SEAT_TO_FILL_SIX_PR;
        } else {
          minS = config.MIN_SEAT_TO_FILL_SIX_DEAL;
        }
      }
    } else if (data.gt && data.gt == "Pool") {
      gt = "Pool";
      ms = data.pCount;
      // reke = data.reke;
      // prize = data.bv*data.pCount*((100-reke)*0.01);  //table prize reke = % deduct from prize money
      pt = typeof data.pt != "undefined" ? data.pt : 101;
      logger.info("pt------------->", pt);
      if (data.pCount == 2) {
        pi = [{}, {}]; //no requirement for additional seats if there are only three players
        minS = data.pCount;
      } else if (data.pCount == 6) {
        pi = [{}, {}, {}, {}, {}, {}];
        if (data.mode == "practice") {
          minS = config.MIN_SEAT_TO_FILL_SIX_PR_POOL;
        } else {
          minS = config.MIN_SEAT_TO_FILL_SIX_POOL;
        }
      }
      logger.info("minS--->", minS);
    } else {
      ms = data.pCount;
      if (data.pCount == 2) {
        pi = [{}, {}];
        minS = data.pCount;
      } else {
        pi = [{}, {}, {}, {}, {}, {}];
        if (data.mode == "practice") {
          minS = config.MIN_SEAT_TO_FILL_SIX_PR;
        } else {
          minS = config.MIN_SEAT_TO_FILL_SIX;
        }
      }
    }
    // var tjid = commonClass.GetRandomString(7);
    let tjid = await getRandomId(10, "playing_table", "tjid");
    let hint = data.mode == "cash" ? config.HINT_CASH : config.HINT_PRACTICE;
    let rid = gt == "Pool" || gt == "Deal" ? 1 : 0;
    const { START_TURN_TIMER, SECONDARY_TIMER, TIMER_FINISH } = GetConfig();
    let tbJson = {
      tjid: tjid.toString(),
      use_bot: data.use_bot,
      fromRematch: data.fromRematch ? true : false,
      fromRematchAP: 0,
      oldTableId: data.fromRematch && data.oldTableId ? data.oldTableId : "",
      deck: 2, //	no.of deck used
      cd: new Date(), //	creation date
      la: new Date(), //	last table active time
      _ip: data._ip ? 1 : 0, //  is private or not
      tci: data.tci, // 	table creator id
      ap: 0, //	active player
      mode: data.mode, // 	mode of table cash/chips
      minS: minS, //  minimum seats to fill
      start_totalap: 0, //  start with active players
      total_player_join: 0, //  total player join for rejoin case
      ms: ms, //	max seats on table
      bv: data.bv, //	bootvalue
      bbv: data.bv, //  bet boot value
      prize: prize, //  prize for deal and pool
      reke: reke, //  reke to be deducted from prize
      hint: hint, //	show vard hint to user
      lvc: data.lvc, //	users level counter for find filter
      deals: deals,
      tpr: 0,
      pt: pt, //	pool type 101/201
      gt: gt, //	game type
      tst: "", //	table status
      tie: false,
      rndsts: "newgame",
      pi: pi, //	player array
      hist: [], //  history of players per round to show players info at winner screen
      stdP: [], //  stand up players array (i.e not playing but still remains on table)
      wildCard: "", //	wildCard card
      cDeck: [], //	cards in cDeck
      oDeck: [], //	thrown Cards
      turn: -1, //	turn player index
      trCount: 0, //	trun counter
      tcnt: 0,
      dealer: -1, //	round dealer index
      declCount: 0, //  declaration count
      playCount: 0, //	playing player count
      fnsPlayer: -1, // 	seat index of first finished  player
      pv: 0, //  pot value
      maxBet: 0, //
      ctt: new Date(), //  counter time
      round: 0, //  round count
      rid: rid, //	round id
      game_id: 0, //	game_id of table
      sub_id: 0, //	sub game_id for deak and pool
      rSeq: 1, //  round sequence
      dealwin: [],
      //spcSi : -1,						//  seat index of special user
      isSpc: true, //	special conditio for robot win
      addtime: false,
      nrg: 0,
      uCount: 0, //  number of human players
      RobotCount: 0, //  number of robots player to sit on special table
      HumanCount: 0, //  number of human players to sit on special table
      _isLeave: 0, //  leave status, if 1 then someone left else left procedure completed(patiyu)
      _isWinner: 0, //  if 1 then  winner handling start else winner handling complete
      _artFlag: 0, //	if artifact sent or not
      _qstWin: 0, //  is anyone have win quest or not
      _stuck: 0, //	is stuck
      tdsid: "", //  tds tracking id
      dealrmch: 0,
      initServer: SERVER_ID, //  server id of initialization
      ctrlServer: SERVER_ID, //	control server id
      categoryId: data.catid,
      rejoinAcceptedUsers: [],
      backToTableUser: [],
      START_TURN_TIMER,
      SECONDARY_TIMER,
      TIMER_FINISH
    };

    // const resp = await db.collection("playing_table").insertOne(tbJson);
    // const tableData = await db
    //   .collection("playing_table")
    //   .findOne({ _id: resp.insertedId });

    // callback(tableData);

    db.collection("playing_table").insertOne(tbJson, function (err, resp) {
      callback(resp?.ops[0]);
    });
  } catch (error) {
    logger.error("-----> error main generateTable", error);
    getInfo.exceptionError(error);
  }
};

module.exports = { findTableAndJoin, joinSeat, isFirstTimeUser, findTableExistence };

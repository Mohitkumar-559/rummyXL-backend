const { cashCut, calculationOfPlayCash } = require("../common/cashCut");
const { getKeys, getRedis } = require("./redis.class");
const { saveGameHistory } = require("./gameHistory.class");
const checkPlayerAvailability = require("../common/checkPlayerAvailability");
const _ = require("underscore");
const commonData = require("./commonData.class");
const commonClass = require("./common.class");
const findTableAndJoinClass = require("./findTableAndJoin.class");
const getInfo = require("../common");
// const { storeTableHistoryForWinner } = require("../classes/gameHistory.class");
const logger = require("../utils/logger");
const { getRedisInstances } = require("../connections/redis");
const { GetConfig } = require("../connections/mongodb");
const scheduler = require("../scheduler");
const { ROUND_TIMER_START_TIMER } = require("../constants/eventName");
const { addQueue, cancelJob } = require("../scheduler/bullQueue");
const moment = require("moment");

const JoinTablePoint = async (data, client) => {
  try {
    //find table and join; data = {bv}
    /* +-------------------------------------------------------------------+
    desc:event to find classic table and join 
    i/p: data = {bv = bot value},client = socket object
  +-------------------------------------------------------------------+ */
    logger.info(
      "JoinTablePoint------>>>>client.uid: ",
      client.uid,
      " data: ",
      data
    );
    const { MAX_DEADWOOD_PTS } = GetConfig();

    const redisInstances = getRedisInstances();
    const lvt = await redisInstances.SET("JoinTablePoint:" + client.uid, 1, { EX: 5, NX: true, });
    if (!lvt) {
      return false;
    }

    getInfo.GetUserInfo(
      client.uid,
      { ip: 1, Chips: 1, counters: 1, publicIp: 1 },
      function (userInfo) {
        if (userInfo) {
          if (typeof data.catid != "undefined" && data.catid != null) {
            db.collection("point_category").findOne(
              { _id: getInfo.MongoID(data.catid), mode: "practice" },
              function (err, resp) {
                let cpp = resp.cpp * MAX_DEADWOOD_PTS;
                // if (userInfo.Chips >= cpp * 3) {
                if (userInfo.Chips >= cpp) {
                  data.chips = userInfo.Chips;
                  data.bv = resp.cpp;
                  data.lvc = userInfo.counters.lvc;
                  data.mode = "practice";
                  data.pCount = resp.pCount;
                  data.use_bot = resp.use_bot;
                  data.theme =
                    data.theme != null && typeof data.theme != "undefined"
                      ? data.theme
                      : "red";
                  data.publicIp = userInfo.publicIp;

                  findTableAndJoinClass.findTableAndJoin(data, client, 0);
                } else {
                  let reqChips = resp.cpp * MAX_DEADWOOD_PTS;
                  commonClass.SendData(
                    client,
                    "PopUp",
                    { chips: reqChips, flag: "noChips", reqChips: reqChips },
                    "error:2020"
                  ); //Don't have sufficient chips
                }
              }
            );
          }
        } else {
          logger.info(
            'JoinTablePoint:::::::::::::::::::::::>>>>>>Error: "user not found!!!"'
          );
        }
      }
    );
  } catch (error) {
    logger.error("-----> error JoinTablePoint", error);
    getInfo.exceptionError(error);
  }
};

const JoinTablePointCash = async (data, client) => {
  // console.time("latency timer JoinTablePointCash");

  try {
    //find table and join; data = {bv}
    /* +-------------------------------------------------------------------+
    desc:event to find classic table and join 
    i/p: data = {bv = bot value},client = socket object
  +-------------------------------------------------------------------+ */
    logger.info(
      "JoinTablePointCash------>>>>client.uid: ",
      client.uid,
      " data: ",
      data
    );
    const redisInstances = getRedisInstances();
    const lvt = await redisInstances.SET("JoinTablePointCash:" + client.uid, 1, { EX: 5, NX: true, });
    if (!lvt) {
      return false;
    }

    const { MAX_DEADWOOD_PTS } = GetConfig();
    getInfo.GetUserInfo(
      client.uid,
      {
        totalcash: 1,
        depositcash: 1,
        wincash: 1,
        bonuscash: 1,
        counters: 1,
        tId: 1,
        SignUpBonus: 1,
        Chips: 1,
        Winning: 1,
        Bonus: 1,
        referral_bonus: 1,
        addCash_bonus: 1,
        SignUpBonusExpire: 1,
        SignUpBonusStatus: 1,
        publicIp: 1,
        state: 1,
        country: 1
      },
      async function (userInfo) {
        if (userInfo) {
          data.tId = userInfo.tId;
          const checkPlay = await checkPlayableOrNot(client, userInfo);
          if (typeof data.catid != "undefined" && data.catid != null && checkPlay) {
            db.collection("point_category").findOne(
              { _id: getInfo.MongoID(data.catid), mode: "cash" },
              async function (err, resp) {
                if (resp) {
                  let requiredChip = resp.cpp * MAX_DEADWOOD_PTS;
                  logger.info(
                    "JoinTablePointCash-------------------------ef:",
                    requiredChip
                  );
                  resp.bonus = resp.bonus || 0;
                  let { playable } = await cashCut({
                    userInfo,
                    entryFee: requiredChip,
                    cutBonus: +resp.bonus,
                  });

                  if (!playable) {
                    return commonClass.SendData(
                      client,
                      "PopUp",
                      {
                        chips: resp.cpp * MAX_DEADWOOD_PTS,
                        flag: "noCash",
                        requiredChip,
                        message: commonData.dataCodesArray[
                          "en:error:1020"
                        ].Message.replace("5", resp.bonus || 10),
                      },
                      "error:1020"
                    );
                  }

                  data.lvc = userInfo.counters.lvc;
                  data.cash = userInfo.totalcash;
                  data.bv = resp.cpp;
                  data.mode = "cash";
                  data.pCount = resp.pCount;
                  data.use_bot = resp.use_bot;
                  data.theme =
                    typeof data.theme != "undefined" ? data.theme : "cyan";
                  data.publicIp = userInfo.publicIp;

                  findTableAndJoinClass.findTableAndJoin(data, client, 0);
                }
              }
            );
          }
        } else {
          logger.info(
            'JoinTablePoint:::::::::::::::::::::::>>>>>>Error: "user not found!!!"'
          );
        }
      }
    );
  } catch (error) {
    logger.error("-----> error JoinTablePointCash", error);
    getInfo.exceptionError(error);
  }
  // console.timeEnd("latency timer JoinTablePointCash");

};

const JoinTableDeal = async (data, client) => {
  try {
    //find table and join deal mode; data = {catid}
    /* +-------------------------------------------------------------------+
    desc:event to find deal table and join 
    i/p: data = {catid = category id of table},client = socket object
  +-------------------------------------------------------------------+ */
    logger.info(
      "JoinTableDeal---------->>>>>>client.uid: ",
      client.uid,
      " data: ",
      data
    );
    const redisInstances = getRedisInstances();
    const lvt = await redisInstances.SET("JoinTableDeal:" + client.uid, 1, { EX: 5, NX: true, });
    if (!lvt) {
      return false;
    }

    if (data && data.catid) {
      getInfo.GetUserInfo(
        client.uid,
        { ip: 1, Chips: 1, counters: 1, tbid: 1, publicIp: 1 },
        function (userInfo) {
          if (userInfo) {
            db.collection("deal_category").findOne(
              { _id: getInfo.MongoID(data.catid), mode: "practice" },
              function (err, resp) {
                if (resp.fee <= userInfo.Chips) {
                  //user has enough chips to play
                  data.oldTableId = userInfo.tbid;
                  data.gt = "Deal";
                  data.bv = resp.fee;
                  data.mode = "practice";
                  data.deals = resp.deals;
                  data.lvc = userInfo.counters.lvc;
                  data.use_bot = resp.use_bot;
                  data.theme =
                    typeof data.theme != "undefined" ? data.theme : "red";
                  data.publicIp = userInfo.publicIp;

                  if (resp.deals == 2 /*|| resp.deals == 3*/) {
                    data.pCount = 2;
                  } else {
                    data.pCount = 6;
                  }

                  if (resp && resp.reke) {
                    data.reke = resp.reke;
                    // data.prize = parseInt(resp.fee*resp.pCount*((100-resp.reke)*0.01));  //table prize
                  } else {
                    data.reke = 0;
                    // data.prize = resp.fee*resp.pCount;
                  }
                  logger.info(
                    "JoinTableDeal---------->>>>>>>data.reke: " + data.reke
                  );

                  findTableAndJoinClass.findTableAndJoin(data, client, 0);
                } else {
                  let reqChips = resp.fee;
                  commonClass.SendData(
                    client,
                    "PopUp",
                    { chips: resp.fee, flag: "noChips", reqChips: reqChips },
                    "error:1020"
                  );
                }
              }
            );
          }
        }
      );
    } else {
      logger.info(
        'JoinTableDeal:::::::::::::::::::::>>>>Error: "category not founds"'
      );
    }
  } catch (error) {
    logger.error("-----> error JoinTableDeal", error);
    getInfo.exceptionError(error);
  }
};

const JoinTableDealCash = async (data, client) => {
  // console.time("latency timer JoinTableDealCash");

  try {
    //find table and join deal mode; data = {catid}
    /* +-------------------------------------------------------------------+
    desc:event to find deal table and join 
    i/p: data = {catid = category id of table},client = socket object
  +-------------------------------------------------------------------+ */
    logger.info(
      "JoinTableDealCash---------->>>>>>client.uid: ",
      client.uid,
      " data: ",
      data
    );
    const redisInstances = getRedisInstances();
    const lvt = await redisInstances.SET("JoinTableDealCash:" + client.uid, 1, { EX: 5, NX: true, });
    if (!lvt) {
      return false;
    }

    getInfo.GetUserInfo(
      client.uid,
      {
        tId: 1,
        Chips: 1,
        totalcash: 1,
        depositcash: 1,
        wincash: 1,
        bonuscash: 1,
        counters: 1,
        tbid: 1,
        publicIp: 1,
        state: 1,
        country: 1
      },
      async function (userInfo) {
        if (userInfo) {
          data.tId = userInfo.tId;
          data.oldTableId = userInfo.tbid;
          const checkPlay = await checkPlayableOrNot(client, userInfo);
          if (data && data.catid && checkPlay) {
            db.collection("deal_category").findOne(
              { _id: getInfo.MongoID(data.catid), mode: "cash" },
              async function (err, resp) {
                // if(resp.fee <= userInfo.Chips){ //user has enough chips to play
                if (!resp) {
                  logger.info("deal category not found: ", data);
                  return false;
                }
                resp.bonus = resp.bonus || 0;

                let { playable } = await cashCut({
                  userInfo,
                  entryFee: resp.fee,
                  cutBonus: +resp.bonus,
                });
                if (!playable) {
                  return commonClass.SendData(
                    client,
                    "PopUp",
                    {
                      chips: resp.fee,
                      flag: "noChips",
                      reqChips: resp.fee,
                      message: commonData.dataCodesArray[
                        "en:error:1020"
                      ].Message.replace("5", resp.bonus || 10),
                    },
                    "error:1020"
                  );
                }
                data.gt = "Deal";
                data.bv = resp.fee;
                data.mode = "cash";
                data.deals = resp.deals;
                data.use_bot = resp.use_bot;
                data.lvc = userInfo.counters.lvc;
                data.theme =
                  typeof data.theme != "undefined" ? data.theme : "red";
                data.pCount = resp.deals == 2 /*|| resp.deals == 3*/ ? 2 : 6;
                data.reke = resp.reke ?? 0;
                data.publicIp = userInfo.publicIp;

                logger.info(
                  "JoinTableDealCash---------->>>>>>>data.reke: " + data.reke
                );

                findTableAndJoinClass.findTableAndJoin(data, client, 0);
              }
            );
          } else {
            logger.info(
              'JoinTableDealCash:::::::::::::::::::::>>>>Error: "category not founds"'
            );
          }
        }
      }
    );
  } catch (error) {
    logger.error("-----> error JoinTableDealCash", error);
    getInfo.exceptionError(error);
  }
  // console.timeEnd("latency timer JoinTableDealCash");

};

const JoinTablePool = async (data, client) => {
  try {
    //find table and join pool mode; data = {catid}
    /* +-------------------------------------------------------------------+
    desc:event to find pool table and join 
    i/p: data = {catid = category id of table},client = socket object
  +-------------------------------------------------------------------+ */
    logger.info(
      "JoinTablePool---------------->>>>>>client.uid: ",
      client.uid,
      " data:",
      data
    );
    logger.info(
      "JoinTablePool---------------->>>>>>client.uid: ",
      client._ir,
      " data:",
      data
    );

    const redisInstances = getRedisInstances();
    const lvt = await redisInstances.SET("JoinTablePool:" + client.uid, 1, { EX: 5, NX: true, });
    if (!lvt) {
      return false;
    }

    getInfo.GetUserInfo(
      client.uid,
      {
        tId: 1,
        Chips: 1,
        totalcash: 1,
        depositcash: 1,
        wincash: 1,
        bonuscash: 1,
        counters: 1,
        publicIp: 1,
      },
      function (userInfo) {
        if (userInfo) {
          data.tId = userInfo.tId;
          if (data && data.catid) {
            db.collection("pool_category").findOne(
              { _id: getInfo.MongoID(data.catid), mode: "practice" },
              function (err, resp) {
                let { fee } = resp;
                // if (fee * 3 <= userInfo.Chips) {
                if (fee <= userInfo.Chips) {
                  data.gt = "Pool";
                  data.pCount = resp.pCount; /*resp.pCount;*/
                  data.bv = resp.fee;
                  data.use_bot = resp.use_bot;
                  data.mode = "practice";
                  data.pt = resp.category;
                  data.lvc = userInfo.counters.lvc;
                  data.theme =
                    data.theme != null || typeof data.theme != "undefined"
                      ? data.theme
                      : "red";
                  // data.reke = resp.reke ?? 0;

                  // logger.info(
                  //   "JoinTablePool-------------->>>data.reke: " + data.reke
                  // );

                  data.publicIp = userInfo.publicIp;

                  findTableAndJoinClass.findTableAndJoin(data, client, 0);
                } else {
                  commonClass.SendData(
                    client,
                    "PopUp",
                    { chips: resp.fee, flag: "noChips", reqChips: resp.fee },
                    "error:2020"
                  ); //Don't have sufficient chips

                }
              }
            );
          }
        }
      }
    );
  } catch (error) {
    logger.error("-----> error JoinTablePool", error);
    getInfo.exceptionError(error);
  }
};

const JoinTablePoolCash = async (data, client) => {
  // console.time("latency timer JoinTablePoolCash");

  try {
    //find table and join pool mode; data = {catid}
    /* +-------------------------------------------------------------------+
    desc:event to find pool table and join 
    i/p: data = {catid = category id of table},client = socket object
  +-------------------------------------------------------------------+ */
    logger.info("JoinTablePoolCash", data);
    logger.info(
      "JoinTablePoolCash---------------->>>>>>client.uid: ",
      client.uid,
      " data:",
      data
    );

    const redisInstances = getRedisInstances();
    const lvt = await redisInstances.SET("JoinTablePoolCash:" + client.uid, 1, { EX: 5, NX: true, });
    if (!lvt) {
      return false;
    }

    // redisInstances.expire("ftajpmc:" + client.uid, 5);
    getInfo.GetUserInfo(
      client.uid,
      {
        tId: 1,
        Chips: 1,
        totalcash: 1,
        depositcash: 1,
        wincash: 1,
        bonuscash: 1,
        counters: 1,
        publicIp: 1,
        state: 1,
        country: 1
      },
      async function (userInfo) {
        if (userInfo) {
          data.tId = userInfo.tId;
          const checkPlay = await checkPlayableOrNot(client, userInfo);

          if (data && data.catid && checkPlay) {
            db.collection("pool_category").findOne(
              { _id: getInfo.MongoID(data.catid), mode: "cash" },
              async function (err, resp) {
                if (!resp) {
                  logger.info("pool category not found: " , data);
                  return false;
                }
                logger.info("RESP------------------>", resp);
                resp.bonus = resp.bonus || 0;
                let { playable } = await cashCut({
                  userInfo,
                  entryFee: resp.fee,
                  cutBonus: +resp.bonus,
                });
                if (!playable) {
                  return commonClass.SendData(
                    client,
                    "PopUp",
                    {
                      chips: resp.fee,
                      flag: "noChips",
                      reqChips: resp.fee,
                      message: commonData.dataCodesArray["en:error:1020"].Message.replace("5", resp.bonus || 10),
                    },
                    "error:1020"
                  );
                }
                data.gt = "Pool";
                data.pCount = resp.pCount; /*resp.pCount;*/
                data.bv = resp.fee;
                data.mode = "cash";
                data.use_bot = resp.use_bot;
                data.lvc = userInfo.counters.lvc;
                data.pt = resp.category;
                data.theme =
                  typeof data.theme != "undefined" ? data.theme : "cyan";
                // data.reke = resp.reke ?? 0;
                // logger.info(
                //   "JoinTablePoolCash-------------->>>data.reke: " + data.reke
                // );
                data.publicIp = userInfo.publicIp;

                findTableAndJoinClass.findTableAndJoin(data, client, 0);
              }
            );
          }
        }
      }
    );
  } catch (error) {
    logger.error("-----> error JoinTablePoolCash", error);
    getInfo.exceptionError(error);
  }
  // console.timeEnd("latency timer JoinTablePoolCash");

};

const GameInfo = (data, client) => {
  try {
    const {
      MAX_DEADWOOD_PTS,
      MAX_DEADWOOD_PTS_POOL_61,
      FIRST_DROP,
      FIRST_DROP_101,
      FIRST_DROP_201,
      FIRST_DROP_61,
      MIDDLE_DROP,
      MIDDLE_DROP_101,
      MIDDLE_DROP_201,
      MIDDLE_DROP_61,
      SECONDARY_TIMER,
      START_TURN_TIMER,
    } = GetConfig();
    db.collection("playing_table").findOne(
      { _id: getInfo.MongoID(data.tbId.toString()) },
      function (err, tbData) {
        if (tbData) {
          let tn;
          if (tbData.ms == 2) {
            tn = "TwoPlayer_" + tbData.tjid;
          } else if (tbData.ms == 4) {
            tn = "FourPlayer_" + tbData.tjid;
          } else if (tbData.ms == 6) {
            tn = "SixPlayer_" + tbData.tjid;
          }

          let first_drop = MAX_DEADWOOD_PTS * FIRST_DROP;
          let middle_drop = MAX_DEADWOOD_PTS * MIDDLE_DROP;
          let full_drop = MAX_DEADWOOD_PTS;
          if (tbData.gt == "Pool") {
            if (tbData.pt == 101) {
              first_drop = FIRST_DROP_101;
              middle_drop = MIDDLE_DROP_101;
            } else if (tbData.pt == 201) {
              first_drop = FIRST_DROP_201;
              middle_drop = MIDDLE_DROP_201;
            } else if (tbData.pt == 61) {
              first_drop = FIRST_DROP_61;
              middle_drop = MIDDLE_DROP_61;
              full_drop = MAX_DEADWOOD_PTS_POOL_61;
            }
          } else if (tbData.gt == "Points") {
            first_drop = MAX_DEADWOOD_PTS * FIRST_DROP;
            middle_drop = MAX_DEADWOOD_PTS * MIDDLE_DROP;
            tbData.gt = "Points";
          }
          // gid : tbData.round,
          let configData = {
            extra: SECONDARY_TIMER + " Sec",
            move: START_TURN_TIMER + " Sec",
            table_name: tn,
            generateId: tbData.tjid,
            mode: `${tbData.mode} Game`,
            gameType: tbData.gt,
            point_value: tbData.bbv,
            variant: 13 + " Cards " + tbData.gt,
            decks: tbData.gt == "Deal" && tbData.ms == 2 ? 1 : 2,
            first_drop: first_drop + " pts",
            middle_drop: middle_drop + " pts",
            totalPoints: MAX_DEADWOOD_PTS,
            printedJoker: `1 per deck`,
            joker: "Printed and wild card",
            drop: `First:${first_drop} Mid:${middle_drop} Full:${full_drop}`,
          };

          commonClass.SendData(client, "GameInfo", configData);
        } else {
          commonClass.SendData(client, "PopUp", {}, "error:1046");
        }
      }
    );
  } catch (error) {
    logger.error("-----> error GameInfo", error);
    getInfo.exceptionError(error);
  }
};

const GetPoolRummy = async (data, client) => {
  try {
    //Get Pool Table Category List; data = {pCount}
    /* +-------------------------------------------------------------------+
      desc:this event is used to get pool rummy category list
      i/p: data = {}, client = socket object
      o/p: GetPoolRummy event, data = pool category list
    +-------------------------------------------------------------------+ */
    if (!client.uid) {
      return commonClass.SendData(client, "PopUp", {}, "error:1004");
    }
    const { BLOCK_STATE, BAN_STATE_GAME_PLAY_COUNT, BAN_STATE_ADD_CASH, BAN_STATE_GAME_PLAY } = GetConfig();

    const userData = await db.collection("game_users").findOne(
      { _id: getInfo.MongoID(client.uid) },
      {
        projection: {
          state: 1,
          country: 1,
          SignUpBonus: 1,
          Winning: 1,
          Chips: 1,
          totalcash: 1,
          depositCash: 1,
          Unutilized: 1,
          Bonus: 1,
          referral_bonus: 1,
          addCash_bonus: 1,
          SignUpBonusExpire: 1,
          SignUpBonusStatus: 1,
        },
      }
    );
    if (data.mode == "cash") {
      let countryCheck = false;

      if (client.storeUser && userData.country !== "India") {
        countryCheck = true;
      }
      const checkLocation =
        _.contains(BLOCK_STATE, userData.state) || countryCheck;
      if (checkLocation) {
        let possibleGamePlay = false;
        if (_.contains(BLOCK_STATE, userData.state) && BAN_STATE_GAME_PLAY) {
          const totalGamePlay = await db
            .collection("UserGameHistory")
            .countDocuments({
              userId: getInfo.MongoID(client.uid),
            });

          const totalAddCash = await db
            .collection("user_payment")
            .aggregate([
              {
                $match: {
                  userId: getInfo.MongoID(client.uid),
                  status: "SUCCESS",
                  mode: "ADD_CASH",
                },
              },
              {
                $group: {
                  _id: "$userId",
                  amount: {
                    $sum: "$amount",
                  },
                },
              },
            ])
            .toArray();
          possibleGamePlay =
            totalGamePlay >= BAN_STATE_GAME_PLAY_COUNT &&
            totalAddCash[0]?.amount >= BAN_STATE_ADD_CASH;
        }

        if (!possibleGamePlay) {
          commonClass.SendData(
            client,
            "PopUp",
            { flag: "Join Error", popupName: "Location" },
            "error:1009"
          );
          return false;
        }
      }

      if (client.storeUser) {
        const userAddressProof = await db.collection("UserAddressProof").find({ userId: getInfo.MongoID(client.uid), }).limit(1).toArray();
        if (userAddressProof.length <= 0) {
          commonClass.SendData(client, "UserAddressProof", {
            showPop: userAddressProof?.length == 0,
            userAddressProof,
          });
          return false;
        }
      }
    }
    data.mode = typeof data.mode != "undefined" ? data.mode : "practice";
    data.pCount = typeof data.pCount != "undefined" ? data.pCount : 6;

    db.collection("pool_category")
      .find({
        mode: data.mode,
        pCount: {
          $in: [+data.pCount, data.pCount.toString()],
        },
        category: data.point,
      })
      .project({ fee: 1, pCount: 1, commission: 1, bonus: 1 })
      .sort({ fee: 1 })
      .toArray(async function (err, resp) {
        logger.info("resp-------------->", resp);
        logger.info("GetPoolRummy-------------->>>>>resp: ", resp);
        // const onlineUsers = {};
        // onlineUsers.totalOnlinePlayers =
        //   (await getRedis(`totalOnlinePlayers`)) ?? 0;
        // // onlineUsers.pool = (await getRedis(`${data.mode}:Pool`)) ?? 0;
        // // const poolGameCount = await getKeys(`${data.mode}:Pool:`);

        // onlineUsers.pool =
        //   (await getRedis(`${data.mode}:Pool${data.point}`)) ?? 0;
        // // const poolGameCount = await getKeys(`${data.mode}:Pool${data.point}:`);

        for (let [i, value] of resp.entries()) {
          resp[i].prize =
            data.mode == "cash"
              ? (value.fee * value.pCount * (100 - value.commission)) / 100
              : value.fee * value.pCount;
          let canPlay =
            data.mode == "cash"
              ? await calculationOfPlayCash({
                entryFee: value.fee,
                userData,
                cutBonus: value.bonus,
                getList: true,
              })
              : value.fee <= userData.Chips;
          resp[i].canPlay = canPlay.playable ?? canPlay;
          resp[i].commission = value.commission ? +value.commission : 0;

          let where = {
            categoryId: value._id.toString(),
            tst: { $in: ["", "RoundTimerStarted"] },
            round: 0,
            ap: { $lt: data.pCount },
          };
          let projection = { ap: 1 };
          let sort = { _id: 1 };

          let joinedUsers = await getInfo.getJoiningUsers(
            where,
            projection,
            sort
          );
          resp[i].joinedPlayers = joinedUsers ? +joinedUsers : 0;

          const result =
            +(await getRedis(
              `${data.mode}:Pool${data.point}:${resp[i]._id}`
            )) ?? 0;
          // const result = poolGameCount.find(
          //   (a1) => a1.jobId.split(":")[2] == resp[i]._id
          // );
          resp[i].totalUser = result;
          resp[i].cashPlayerPoints = resp[i].fee;
          // delete resp[i].commission;
          // // delete resp[i].pCount;
          // delete resp[i].bonus;
          // delete resp[i].use_bot;
          delete resp[i].fee;
          // delete resp[i].reke;
          // delete resp[i].cb;
          // delete resp[i].mode;
        }
        logger.info("GetPoolRummy------------>>>>resp: " + resp);

        if (resp && resp.length > 0) {
          commonClass.SendData(client, "GetPoolRummy", {
            response: resp,
            // onlineUsers,
          });
        } else {
          commonClass.SendData(
            client,
            "GetPoolRummy",
            {
              response: [],
              // onlineUsers,
            },
            "error:1072"
          ); //category list not found
        }
      });
  } catch (error) {
    logger.error("-----> error GetPoolRummy", error);
    getInfo.exceptionError(error);
  }
};

const GetPointRummy = async (data, client) => {
  //get point table category
  try {
    if (!client.uid) {
      return commonClass.SendData(client, "PopUp", {}, "error:1004");
    }
    const { BLOCK_STATE, BAN_STATE_GAME_PLAY_COUNT, BAN_STATE_ADD_CASH, MAX_DEADWOOD_PTS, BAN_STATE_GAME_PLAY } = GetConfig();

    const userData = await db.collection("game_users").findOne(
      { _id: getInfo.MongoID(client.uid) },
      {
        projection: {
          state: 1,
          country: 1,
          SignUpBonus: 1,
          Chips: 1,
          Winning: 1,
          totalcash: 1,
          depositCash: 1,
          Unutilized: 1,
          Bonus: 1,
          referral_bonus: 1,
          addCash_bonus: 1,
          SignUpBonusExpire: 1,
          SignUpBonusStatus: 1,
        },
      }
    );

    if (data.mode == "cash") {
      let countryCheck = false;

      if (client.storeUser && userData.country !== "India") {
        countryCheck = true;
      }

      const checkLocation = _.contains(BLOCK_STATE, userData.state) || countryCheck;

      if (checkLocation) {
        let possibleGamePlay = false;
        if (_.contains(BLOCK_STATE, userData.state) && BAN_STATE_GAME_PLAY) {
          const totalGamePlay = await db
            .collection("UserGameHistory")
            .countDocuments({
              userId: getInfo.MongoID(client.uid),
            });

          const totalAddCash = await db
            .collection("user_payment")
            .aggregate([
              {
                $match: {
                  userId: getInfo.MongoID(client.uid),
                  status: "SUCCESS",
                  mode: "ADD_CASH",
                },
              },
              {
                $group: {
                  _id: "$userId",
                  amount: {
                    $sum: "$amount",
                  },
                },
              },
            ])
            .toArray();
          possibleGamePlay =
            totalGamePlay >= BAN_STATE_GAME_PLAY_COUNT &&
            totalAddCash[0]?.amount >= BAN_STATE_ADD_CASH;
        }

        if (!possibleGamePlay) {
          commonClass.SendData(
            client,
            "PopUp",
            { flag: "Join Error", popupName: "Location" },
            "error:1009"
          );
          return false;
        }
      }

      if (client.storeUser) {
        const userAddressProof = await db.collection("UserAddressProof").find({ userId: getInfo.MongoID(client.uid) }).limit(1).toArray();

        if (userAddressProof.length <= 0) {
          commonClass.SendData(client, "UserAddressProof", {
            showPop: userAddressProof?.length == 0,
            userAddressProof,
          });
          return false;
        }
      }
    }
    data.mode = typeof data.mode != "undefined" ? data.mode : "practice";
    data.pCount = typeof data.pCount != "undefined" ? data.pCount : 2;

    let resp = await db
      .collection("point_category")
      .find({
        mode: data.mode,
        pCount: {
          $in: [+data.pCount, data.pCount.toString()],
        },
      })
      .project({ cpp: 1, pCount: 1, commission: 1, bonus: 1 })
      .sort({ cpp: 1 })
      .toArray();

    // const onlineUsers = {};
    // onlineUsers.totalOnlinePlayers =
    //   (await getRedis(`totalOnlinePlayers`)) ?? 0;

    // onlineUsers.points = (await getRedis(`${data.mode}:Points`)) ?? 0;

    // const pointsGameCount = await getKeys(`${data.mode}:Points:`);

    for await (const [i, value] of resp.entries()) {
      let canPlay =
        data.mode == "cash"
          ? await calculationOfPlayCash({
            entryFee: value.cpp * MAX_DEADWOOD_PTS,
            userData,
            cutBonus: value.bonus,
            getList: true,
          })
          : userData.Chips >= value.cpp * MAX_DEADWOOD_PTS;

      resp[i].canPlay = canPlay.playable ?? canPlay;

      resp[i].commission = value.commission ? +value.commission : 0;

      let where = {
        categoryId: value._id.toString(),
        tst: { $in: ["", "RoundTimerStarted"] },
        ap: { $lt: data.pCount },
      };
      let projection = { ap: 1 };
      let sort = { _id: 1 };

      let joinedUsers = await getInfo.getJoiningUsers(where, projection, sort);
      resp[i].joinedPlayers = joinedUsers ? +joinedUsers : 0;

      const result =
        +(await getRedis(`${data.mode}:Points:${resp[i]._id}`)) ?? 0;
      // const result = pointsGameCount.find(
      //   (a1) => a1.jobId.split(":")[2] == resp[i]._id
      // );
      resp[i].totalUser = result;
    }

    if (resp && resp.length > 0) {
      commonClass.SendData(client, "GetPointRummy", {
        response: resp,
        // onlineUsers,
      });
    } else {
      commonClass.SendData(
        client,
        "GetPointRummy",
        {
          response: [],
          // onlineUsers,
        },
        "error:1072"
      );
    }
  } catch (error) {
    logger.error("-----> error GetPointRummy", error);
    getInfo.exceptionError(error);
  }
};

const GetDealRummy = async (data, client) => {
  try {
    //get deal table category
    data.mode = typeof data.mode != "undefined" ? data.mode : "practice";
    data.deals = data.deals ?? 2;

    if (!client.uid) {
      return commonClass.SendData(client, "PopUp", {}, "error:1004");
    }
    const { BLOCK_STATE, BAN_STATE_GAME_PLAY_COUNT, BAN_STATE_ADD_CASH, BAN_STATE_GAME_PLAY } = GetConfig();

    const userData = await db.collection("game_users").findOne(
      { _id: getInfo.MongoID(client.uid) },
      {
        projection: {
          state: 1,
          country: 1,
          SignUpBonus: 1,
          Winning: 1,
          Chips: 1,
          totalcash: 1,
          depositCash: 1,
          Unutilized: 1,
          Bonus: 1,
          referral_bonus: 1,
          addCash_bonus: 1,
          SignUpBonusExpire: 1,
          SignUpBonusStatus: 1,
        },
      }
    );

    if (data.mode == "cash") {
      let countryCheck = false;

      if (client.storeUser && userData.country !== "India") {
        countryCheck = true;
      }
      // const countryCheck = client.storeUser && userData.country == "India" ? false : true;
      const checkLocation =
        _.contains(BLOCK_STATE, userData.state) || countryCheck;
      if (checkLocation) {
        let possibleGamePlay = false;
        if (_.contains(BLOCK_STATE, userData.state) && BAN_STATE_GAME_PLAY) {
          const totalGamePlay = await db
            .collection("UserGameHistory")
            .countDocuments({
              userId: getInfo.MongoID(client.uid),
            });

          const totalAddCash = await db
            .collection("user_payment")
            .aggregate([
              {
                $match: {
                  userId: getInfo.MongoID(client.uid),
                  status: "SUCCESS",
                  mode: "ADD_CASH",
                },
              },
              {
                $group: {
                  _id: "$userId",
                  amount: {
                    $sum: "$amount",
                  },
                },
              },
            ])
            .toArray();
          possibleGamePlay =
            totalGamePlay >= BAN_STATE_GAME_PLAY_COUNT &&
            totalAddCash[0]?.amount >= BAN_STATE_ADD_CASH;
        }

        if (!possibleGamePlay) {
          commonClass.SendData(
            client,
            "PopUp",
            { flag: "Join Error", popupName: "Location" },
            "error:1009"
          );
          return false;
        }
      }

      if (client.storeUser) {
        const userAddressProof = await db.collection("UserAddressProof").find({ userId: getInfo.MongoID(client.uid), }).limit(1).toArray();

        if (userAddressProof.length <= 0) {
          commonClass.SendData(client, "UserAddressProof", {
            showPop: userAddressProof?.length == 0,
            userAddressProof,
          });
          return false;
        }
      }
    }

    db.collection("deal_category")
      .find(
        { mode: data.mode, deals: data.deals },
        {
          projection: {
            fee: 1,
            pCount: 1,
            commission: 1,
            mode: 1,
            deals: 1,
            bonus: 1
          },
        }
      )
      .sort({ fee: 1 })
      .toArray(async function (err, resp) {
        // const onlineUsers = {};
        // onlineUsers.totalOnlinePlayers =
        //   (await getRedis(`totalOnlinePlayers`)) ?? 0;

        // onlineUsers.deal = (await getRedis(`${data.mode}:Deal`)) ?? 0;

        // const dealGameCount = await getKeys(`${data.mode}:Deal:`);

        for await (let [i, value] of resp.entries()) {
          let canPlay =
            data.mode == "cash"
              ? await calculationOfPlayCash({
                entryFee: value.fee,
                userData,
                cutBonus: value.bonus,
                getList: true,
              })
              : value.fee <= userData.Chips;
          resp[i].canPlay = canPlay.playable ?? canPlay;

          data.pCount = 2;
          if (data.deals == 3) {
            data.pCount = 6;
          }
          let where = {
            categoryId: value._id.toString(),
            tst: { $in: ["", "RoundTimerStarted"] },
            round: 0,
            ap: { $lt: data.pCount },
          };
          let projection = { ap: 1 };
          let sort = { _id: 1 };

          let joinedUsers = await getInfo.getJoiningUsers(
            where,
            projection,
            sort
          );
          resp[i].joinedPlayers = joinedUsers ? +joinedUsers : 0;

          const result =
            +(await getRedis(`${data.mode}:Deal:${resp[i]._id}`)) ?? 0;
          // const result = dealGameCount.find(
          //   (a1) => a1.jobId.split(":")[2] == resp[i]._id
          // );
          resp[i].pCount = data.pCount;
          resp[i].totalUser = result;
          resp[i].commission = value.commission ? +value.commission : 0;
          resp[i].cashPlayerPoints = resp[i].fee;

          // delete resp[i].fee;
          // delete resp[i].mode;
        }
        logger.info("GetDealRummy-------------->>>>>resp: ", resp);

        if (resp && resp.length > 0) {
          commonClass.SendData(client, "GetDealRummy", {
            response: resp,
            // onlineUsers,
          });
        } else {
          commonClass.SendData(
            client,
            "GetDealRummy",
            {
              response: [],
              // onlineUsers,
            },
            "error:1072"
          ); //category list not found
        }
      });
  } catch (error) {
    logger.error("-----> error GetDealRummy", error);
    getInfo.exceptionError(error);
  }
};

const giveWinChips = async (
  tbId,
  winners,
  winnersTwo,
  px,
  iter,
  prize,
  secondprize,
  msg,
  bv,
  deals,
  mode,
  round,
  _ip,
  gt,
  direct,
  indecl,
  maxDps
) => {
  try {
    //iter = iterator for recursion
    /* +-------------------------------------------------------------------+
      desc:function to handle classic/bet winner
      i/p: tbId = table id
         winners = array of winners seat indices
         px = player details
         iter = iterator for recursion
         prize = prize amount for winners
         msg = message for chips track
         bv = boot value
         gt = game type
         direct = true/false direct winner or not
    +-------------------------------------------------------------------+ */
    logger.info("giveWinChips------------>>>>>>>>prize: ", maxDps, prize);
    const { TIMER_NEXT_ROUND_DELAY } = GetConfig();
    if (iter < px.length) {
      if (_.contains(winners, px[iter].si)) {
        //means the winner
        const table = await db.collection("playing_table").findOne({
          _id: getInfo.MongoID(tbId),
        });
        commonData.UpdateCashForPlayInTable(
          tbId,
          px[iter].uid,
          prize,
          "Game Win",
          async function (uChips) {
            let tempPlayerData = px[iter];
            let ctth = "";
            if (direct) {
              if (px[iter].cards.length > 13) {
                ctth = px[iter].cards.pop();
                tempPlayerData.cards = px[iter].cards;
              }
              tempPlayerData.dCards = {
                pure: [],
                seq: [],
                set: [],
                dwd: px[iter].cards,
              };
            }
            tempPlayerData.wc = prize;
            tempPlayerData.Chips = uChips;
            tempPlayerData._iw = 1;

            tempPlayerData.tdps -= tempPlayerData.ps;
            tempPlayerData.gedt = new Date();
            logger.info(
              "giveWinChips----------->>>>>>>>ctth: " +
              ctth +
              " direct: " +
              direct
            );
            let upData = {
              $set: {
                la: new Date(),
                ctrlServer: SERVER_ID,
                "pi.$.wc": prize,
                "pi.$.Chips": uChips,
                "pi.$._iw": 1,
                tst: "winnerDeclared",
                ctt: new Date(),
                "pi.$.gedt": new Date(),
              },
              $inc: { winAmount: prize },
            };
            if (ctth != "") {
              // upData["$set"]["pi.$.cards"] = px[iter].cards;
              // upData["$set"]["pi.$.gCards"] = gCards;
              // upData["$push"] = { oDeck: ctth };

              let gCards;
              if (px[iter].gCards.length > 0) {
                gCards = px[iter];
                if (gCards.pure.length > 0) {
                  let pureCards = gCards.pure;
                  logger.info(
                    "handlePoolWinner---------->>>>>>gCards: ",
                    pureCards
                  );
                  for (let x in pureCards) {
                    if (_.contains(pureCards[x], ctth)) {
                      pureCards[x] = _.without(pureCards[x], ctth);
                      break;
                    }
                  }
                  logger.info(
                    "handlePoolWinner------------->>>>>gCards: ",
                    gCards
                  );
                  gCards.pure = pureCards;
                } else if (gCards.seq.length > 0) {
                  let seqCards = gCards.seq;
                  logger.info(
                    "handlePoolWinner---------->>>>>>gCards: ",
                    seqCards
                  );
                  for (let x in seqCards) {
                    if (_.contains(seqCards[x], ctth)) {
                      seqCards[x] = _.without(seqCards[x], ctth);
                      break;
                    }
                  }
                  logger.info(
                    "handlePoolWinner------------->>>>>gCards: ",
                    seqCards
                  );
                  gCards.seq = seqCards;
                } else if (gCards.set.length > 0) {
                  let setCards = gCards.set;
                  logger.info(
                    "handlePoolWinner---------->>>>>>gCards: ",
                    setCards
                  );
                  for (let x in setCards) {
                    if (_.contains(setCards[x], ctth)) {
                      setCards[x] = _.without(setCards[x], ctth);
                      break;
                    }
                  }
                  logger.info(
                    "handlePoolWinner------------->>>>>gCards: ",
                    setCards
                  );
                  gCards.seq = setCards;
                } else if (gCards.dwd.length > 0) {
                  let dwdCards = gCards.dwd;
                  logger.info(
                    "handlePoolWinner---------->>>>>>gCards: ",
                    dwdCards
                  );
                  for (let x in dwdCards) {
                    if (_.contains(dwdCards[x], ctth)) {
                      dwdCards[x] = _.without(dwdCards[x], ctth);
                      break;
                    }
                  }
                  logger.info(
                    "handlePoolWinner------------->>>>>gCards: ",
                    dwdCards
                  );
                  gCards.seq = dwdCards;
                }
              } else {
                gCards = px[iter];
                let dwdCards = px[iter].cards;
                gCards.dwd = dwdCards;
              }
              upData["$set"]["pi.$.cards"] = px[iter].cards;
              upData["$set"]["pi.$.gCards"] = gCards;
              upData["$push"] = { oDeck: ctth };
            }
            if (table.hist.length != 0) {
              for (const iterator of table.hist) {
                if (iterator.uid == px[iter].uid) {
                  await db.collection("playing_table").updateOne(
                    {
                      _id: getInfo.MongoID(table._id.toString()),
                      "hist.uid": px[iter].uid,
                    },
                    { $set: { "hist.$": tempPlayerData } },
                    { new: true }
                  );
                } else {
                  upData["$addToSet"] = { hist: tempPlayerData };
                }
              }
            } else {
              upData["$addToSet"] = { hist: tempPlayerData };
            }
            logger.info("giveWinChips----------->>>>>upData: ", upData);
            // commonData.CountHands(table.value.pi[px[iter].si].uid,true,function(){
            commonData.CountHands(
              px[iter].uid,
              "win",
              gt,
              bv,
              true,
              mode,
              _ip,
              round,
              function (thp, qstWin, hpc) {
                commonData.getUserScore(px[iter].uid, bv, gt, function (score) {
                  upData["$set"]["pi.$.score"] = score;
                  upData["$set"]["pi.$.thp"] = thp;
                  upData["$set"]["pi.$.hpc"] = hpc;
                  upData["$inc"]["pi.$.rw"] = 1;

                  db.collection("playing_table").findAndModify(
                    { _id: getInfo.MongoID(tbId), "pi.si": px[iter].si },
                    {},
                    upData,
                    { new: true },
                    function (err, table) {
                      if (table && table.value) {
                        logger.info(
                          "giveWinChips-----------------track deal winner"
                        );

                        giveWinChips(
                          table.value._id.toString(),
                          winners,
                          winnersTwo,
                          px,
                          iter + 1,
                          prize,
                          secondprize,
                          msg,
                          bv,
                          deals,
                          mode,
                          round,
                          _ip,
                          gt,
                          direct,
                          indecl,
                          maxDps
                        );
                      } else {
                        logger.info(
                          'giveWinChips-------------->>>>>>>>>Error:"table  not found"'
                        );
                      }
                    }
                  );
                });
              }
            );
          }
        );
      } else if (_.contains(winnersTwo, px[iter].si) && gt === "Deal" && px[iter].tdps !== maxDps) {
        const table = await db.collection("playing_table").findOne({
          _id: getInfo.MongoID(tbId),
        });
        // commonData.UpdateCashForPlayInTable(
        //   tbId,
        //   px[iter].uid,
        //   secondprize,
        //   "Game Win",
        //   async function (uChips) {
        let tempPlayerData = px[iter];
        let ctth = "";
        if (direct) {
          if (px[iter].cards.length > 13) {
            ctth = px[iter].cards.pop();
            tempPlayerData.cards = px[iter].cards;
          }
          tempPlayerData.dCards = {
            pure: [],
            seq: [],
            set: [],
            dwd: px[iter].cards,
          };
        }

        tempPlayerData.tdps -= tempPlayerData.ps;
        tempPlayerData.gedt = new Date();
        logger.info(
          "giveWinChips----------->>>>>>>>ctth: " + ctth + " direct: " + direct
        );
        let upData = {
          $set: {
            la: new Date(),
            ctrlServer: SERVER_ID,
            tst: "winnerDeclared",
            ctt: new Date(),
            "pi.$.gedt": new Date(),
          },
          $inc: { winAmount: secondprize },
        };
        if (ctth != "") {
          // upData["$set"]["pi.$.cards"] = px[iter].cards;
          // upData["$set"]["pi.$.gCards"] = gCards;
          // upData["$push"] = { oDeck: ctth };

          let gCards;
          if (px[iter].gCards.length > 0) {
            gCards = px[iter].gCards;
            if (gCards.pure.length > 0) {
              let pureCards = gCards.pure;
              logger.info(
                "handlePoolWinner---------->>>>>>gCards: ",
                pureCards
              );
              for (let x in pureCards) {
                if (_.contains(pureCards[x], ctth)) {
                  pureCards[x] = _.without(pureCards[x], ctth);
                  break;
                }
              }
              logger.info("handlePoolWinner------------->>>>>gCards: ", gCards);
              gCards.pure = pureCards;
            } else if (gCards.seq.length > 0) {
              let seqCards = gCards.seq;
              logger.info("handlePoolWinner---------->>>>>>gCards: ", seqCards);
              for (let x in seqCards) {
                if (_.contains(seqCards[x], ctth)) {
                  seqCards[x] = _.without(seqCards[x], ctth);
                  break;
                }
              }
              logger.info(
                "handlePoolWinner------------->>>>>gCards: ",
                seqCards
              );
              gCards.seq = seqCards;
            } else if (gCards.set.length > 0) {
              let setCards = gCards.set;
              logger.info("handlePoolWinner---------->>>>>>gCards: ", setCards);
              for (let x in setCards) {
                if (_.contains(setCards[x], ctth)) {
                  setCards[x] = _.without(setCards[x], ctth);
                  break;
                }
              }
              logger.info(
                "handlePoolWinner------------->>>>>gCards: ",
                setCards
              );
              gCards.seq = setCards;
            } else if (gCards.dwd.length > 0) {
              let dwdCards = gCards.dwd;
              logger.info("handlePoolWinner---------->>>>>>gCards: ", dwdCards);
              for (let x in dwdCards) {
                if (_.contains(dwdCards[x], ctth)) {
                  dwdCards[x] = _.without(dwdCards[x], ctth);
                  break;
                }
              }
              logger.info(
                "handlePoolWinner------------->>>>>gCards: ",
                dwdCards
              );
              gCards.seq = dwdCards;
            } else {
            }
          } else {
            gCards = px[iter].gCards;
            let dwdCards = px[iter].cards;
            gCards.dwd = dwdCards;
          }
          upData["$set"]["pi.$.cards"] = px[iter].cards;
          upData["$set"]["pi.$.gCards"] = gCards;
          upData["$push"] = { oDeck: ctth };
        }
        if (table.hist.length != 0) {
          for (const iterator of table.hist) {
            if (iterator.uid == px[iter].uid) {
              await db.collection("playing_table").updateOne(
                {
                  _id: getInfo.MongoID(table._id.toString()),
                  "hist.uid": px[iter].uid,
                },
                { $set: { "hist.$": tempPlayerData } },
                { new: true }
              );
            } else {
              upData["$addToSet"] = { hist: tempPlayerData };
            }
          }
        } else {
          upData["$addToSet"] = { hist: tempPlayerData };
        }
        logger.info("giveWinChips----------->>>>>upData: ", upData);
        // commonData.CountHands(table.value.pi[px[iter].si].uid,true,function(){
        commonData.CountHands(
          px[iter].uid,
          "win",
          gt,
          bv,
          true,
          mode,
          _ip,
          round,
          function (thp, qstWin, hpc) {
            commonData.getUserScore(px[iter].uid, bv, gt, function (score) {
              upData["$set"]["pi.$.score"] = score;
              upData["$set"]["pi.$.thp"] = thp;
              upData["$set"]["pi.$.hpc"] = hpc;
              upData["$inc"]["pi.$.rw"] = 1;

              db.collection("playing_table").findAndModify(
                { _id: getInfo.MongoID(tbId), "pi.si": px[iter].si },
                {},
                upData,
                { new: true },
                function (err, table) {
                  if (table && table.value) {
                    logger.info(
                      "giveWinChips-----------------track deal winner"
                    );

                    giveWinChips(
                      table.value._id.toString(),
                      winners,
                      winnersTwo,
                      px,
                      iter + 1,
                      prize,
                      secondprize,
                      msg,
                      bv,
                      deals,
                      mode,
                      round,
                      _ip,
                      gt,
                      direct,
                      indecl,
                      maxDps
                    );
                  } else {
                    logger.info(
                      'giveWinChips-------------->>>>>>>>>Error:"table  not found"'
                    );
                  }
                }
              );
            });
          }
        );
        //   }
        // );
      } else if (_.contains(winnersTwo, px[iter].si) && gt !== "Deal") {
        const table = await db.collection("playing_table").findOne({
          _id: getInfo.MongoID(tbId),
        });
        commonData.UpdateCashForPlayInTable(
          tbId,
          px[iter].uid,
          secondprize,
          "Game Win",
          async function (uChips) {
            let tempPlayerData = px[iter];
            let ctth = "";
            if (direct) {
              if (px[iter].cards.length > 13) {
                ctth = px[iter].cards.pop();
                tempPlayerData.cards = px[iter].cards;
              }
              tempPlayerData.dCards = {
                pure: [],
                seq: [],
                set: [],
                dwd: px[iter].cards,
              };
            }
            tempPlayerData.wc = secondprize;
            tempPlayerData.Chips = uChips;
            tempPlayerData._iw = 1;
            tempPlayerData.tdps -= tempPlayerData.ps;
            tempPlayerData.gedt = new Date();
            logger.info(
              "giveWinChips----------->>>>>>>>ctth: " +
              ctth +
              " direct: " +
              direct
            );
            let upData = {
              $set: {
                la: new Date(),
                ctrlServer: SERVER_ID,
                "pi.$.wc": secondprize,
                "pi.$.Chips": uChips,
                "pi.$._iw": 1,
                tst: "winnerDeclared",
                ctt: new Date(),
                "pi.$.gedt": new Date(),
              },
              $inc: { winAmount: secondprize },
            };
            if (ctth != "") {
              // upData["$set"]["pi.$.cards"] = px[iter].cards;
              // upData["$set"]["pi.$.gCards"] = gCards;
              // upData["$push"] = { oDeck: ctth };

              let gCards;
              if (px[iter].gCards.length > 0) {
                gCards = px[iter].gCards;
                if (gCards.pure.length > 0) {
                  let pureCards = gCards.pure;
                  logger.info(
                    "handlePoolWinner---------->>>>>>gCards: ",
                    pureCards
                  );
                  for (let x in pureCards) {
                    if (_.contains(pureCards[x], ctth)) {
                      pureCards[x] = _.without(pureCards[x], ctth);
                      break;
                    }
                  }
                  logger.info(
                    "handlePoolWinner------------->>>>>gCards: ",
                    gCards
                  );
                  gCards.pure = pureCards;
                } else if (gCards.seq.length > 0) {
                  let seqCards = gCards.seq;
                  logger.info(
                    "handlePoolWinner---------->>>>>>gCards: ",
                    seqCards
                  );
                  for (let x in seqCards) {
                    if (_.contains(seqCards[x], ctth)) {
                      seqCards[x] = _.without(seqCards[x], ctth);
                      break;
                    }
                  }
                  logger.info(
                    "handlePoolWinner------------->>>>>gCards: ",
                    seqCards
                  );
                  gCards.seq = seqCards;
                } else if (gCards.set.length > 0) {
                  let setCards = gCards.set;
                  logger.info(
                    "handlePoolWinner---------->>>>>>gCards: ",
                    setCards
                  );
                  for (let x in setCards) {
                    if (_.contains(setCards[x], ctth)) {
                      setCards[x] = _.without(setCards[x], ctth);
                      break;
                    }
                  }
                  logger.info(
                    "handlePoolWinner------------->>>>>gCards: ",
                    setCards
                  );
                  gCards.seq = setCards;
                } else if (gCards.dwd.length > 0) {
                  let dwdCards = gCards.dwd;
                  logger.info(
                    "handlePoolWinner---------->>>>>>gCards: ",
                    dwdCards
                  );
                  for (let x in dwdCards) {
                    if (_.contains(dwdCards[x], ctth)) {
                      dwdCards[x] = _.without(dwdCards[x], ctth);
                      break;
                    }
                  }
                  logger.info(
                    "handlePoolWinner------------->>>>>gCards: ",
                    dwdCards
                  );
                  gCards.seq = dwdCards;
                }
              } else {
                gCards = px[iter].gCards;
                let dwdCards = px[iter].cards;
                gCards.dwd = dwdCards;
              }
              upData["$set"]["pi.$.cards"] = px[iter].cards;
              upData["$set"]["pi.$.gCards"] = gCards;
              upData["$push"] = { oDeck: ctth };
            }
            if (table.hist.length != 0) {
              for (const iterator of table.hist) {
                if (iterator.uid == px[iter].uid) {
                  await db.collection("playing_table").updateOne(
                    {
                      _id: getInfo.MongoID(table._id.toString()),
                      "hist.uid": px[iter].uid,
                    },
                    { $set: { "hist.$": tempPlayerData } },
                    { new: true }
                  );
                } else {
                  upData["$addToSet"] = { hist: tempPlayerData };
                }
              }
            } else {
              upData["$addToSet"] = { hist: tempPlayerData };
            }
            logger.info("giveWinChips----------->>>>>upData: ", upData);
            // commonData.CountHands(table.value.pi[px[iter].si].uid,true,function(){
            commonData.CountHands(
              px[iter].uid,
              "win",
              gt,
              bv,
              true,
              mode,
              _ip,
              round,
              function (thp, qstWin, hpc) {
                commonData.getUserScore(px[iter].uid, bv, gt, function (score) {
                  upData["$set"]["pi.$.score"] = score;
                  upData["$set"]["pi.$.thp"] = thp;
                  upData["$set"]["pi.$.hpc"] = hpc;
                  upData["$inc"]["pi.$.rw"] = 1;

                  db.collection("playing_table").findAndModify(
                    { _id: getInfo.MongoID(tbId), "pi.si": px[iter].si },
                    {},
                    upData,
                    { new: true },
                    function (err, table) {
                      if (table && table.value) {
                        logger.info(
                          "giveWinChips-----------------track deal winner"
                        );

                        giveWinChips(
                          table.value._id.toString(),
                          winners,
                          winnersTwo,
                          px,
                          iter + 1,
                          prize,
                          secondprize,
                          msg,
                          bv,
                          deals,
                          mode,
                          round,
                          _ip,
                          gt,
                          direct,
                          indecl,
                          maxDps
                        );
                      } else {
                        logger.info(
                          'giveWinChips-------------->>>>>>>>>Error:"table  not found"'
                        );
                      }
                    }
                  );
                });
              }
            );
          }
        );
      } else {
        giveWinChips(
          tbId,
          winners,
          winnersTwo,
          px,
          iter + 1,
          prize,
          secondprize,
          msg,
          bv,
          deals,
          mode,
          round,
          _ip,
          gt,
          direct,
          indecl,
          maxDps
        );
      }
    } else {
      getInfo.GetTbInfo(tbId, {}, async function (table1) {
        if (table1) {
          let hist = _.clone(table1.hist);
          let tempHint = [];
          hist.forEach((userObj) => {
            if (userObj.uid) {
              let arrIndex = tempHint.findIndex(
                (userObj1) => userObj1.uid === userObj.uid
              );
              if (arrIndex === -1) {
                if (JSON.stringify(userObj.dCards) === "{}") {
                  userObj.dCards = userObj.gCards;
                } else if (
                  typeof userObj.gCards.dwd[0] === "string" &&
                  userObj.dCards &&
                  userObj.dCards.dwd &&
                  typeof userObj.dCards.dwd[0] === "string"
                ) {
                  userObj.gCards.dwd = [userObj.gCards.dwd];
                  userObj.dCards = userObj.gCards;
                } else if (
                  userObj.dCards &&
                  userObj.dCards.dwd &&
                  typeof userObj.dCards.dwd[0] === "string"
                ) {
                  userObj.dCards.dwd = [userObj.dCards.dwd];
                }
                tempHint.push(userObj);
              }
            }
          });
          hist = tempHint;
          logger.info("giveWinChips------1----->>>>>>hist: ", hist);

          // for (i = 0; i < hist.length; i++) {
          //   //sort(bubble sort) the player according to the dps
          //   for (j = 0; j < hist.length - i - 1; j++) {
          //     if (hist[j].si > hist[j + 1].si) {
          //       //if dps are equal then put loser after winner
          //       temp = _.clone(hist[j]);
          //       hist[j] = _.clone(hist[j + 1]);
          //       hist[j + 1] = _.clone(temp);
          //     }
          //   }
          // }

          hist = _.sortBy(hist, (histObj) => histObj.tdps);
          hist.reverse();
          for (const iterator of winners) {
            hist = _.sortBy(hist, ({ si }) => (si === iterator ? 0 : 1));
          }
          // let testWinArray = [];
          // let testLossArray = [];
          // hist.forEach((histObj) => {
          //   if (histObj._iw === 1) {
          //     testWinArray.push(histObj);
          //   } else {
          //     testLossArray.push(histObj);
          //   }
          // });
          // hist = testWinArray.concat(testLossArray);

          let { game_id } = table1;
          if (table1.gt == "Deal" || table1.gt == "Pool") {
            game_id = game_id + "." + table1.sub_id;
          }

          let dealScore = [];
          if (table1.ms == 2) {
            dealScore = [{}, {}];
          } else {
            dealScore = [{}, {}, {}, {}, {}, {}];
          }

          let rCount = 0;
          let uCount = 0;
          let rSts = "loss";
          let uSts = "loss";
          for (let k in hist) {
            // if(hist[k]._ir == 0){

            if (hist[k]._iw == 1) {
              if (hist[k]._ir == 1) {
                rSts = "win";
              } else {
                uSts = "win";
              }
            }

            if (hist[k]._ir == 1) {
              rCount++;
            } else {
              uCount++;
            }

            dealScore[hist[k].si] = {
              uid: hist[k].uid,
              un: hist[k].un,
              dps: hist[k].tScore,
              tdps: hist[k].tdps,
              si: hist[k].si,
              sts: "playing",
            };
            // }
          }
          if (rCount > 0 || uCount > 0) {
            db.collection("win_sts").insertOne({
              date: new Date(),
              table_id: table1._id.toString(),
              game_type: table1.gt,
              game_id: game_id,
              rCount: rCount,
              uCount: uCount,
              rSts: rSts,
              uSts: uSts,
            });
          }

          let ldData = {
            $set: {
              tbid: table1._id.toString(),
              round: table1.round,
              game_id: table1.game_id,
              sub_id: table1.sub_id,
              gt: table1.gt,
              tst: table1.tst,
              pi: hist,
              wildCard: table1.wildCard,
              win: [winners],
            },
          };

          db.collection("last_deal").findAndModify(
            { tbid: table1._id.toString() },
            {},
            ldData,
            { upsert: true, new: true },
            function (err, table1) { }
          );


          // if (table1.ms != 2 && table1.tie != true) {
          //   winners = winners.concat(winnersTwo);
          // } else {
          //   winnersTwo = -1;
          // }
          let isHalfDeclCounter = 0;
          table1.pi.forEach((uObj) => {
            if (uObj && uObj.turnCounter === 0 && uObj.s && uObj.s !== "drop" && (typeof direct === "undefined" || direct === false)) {
              isHalfDeclCounter++;
            }
          });
          commonClass.FireEventToTable(table1._id.toString(), {
            en: "WinnerDeclared",
            data: {
              tbid: table1._id.toString(),
              pv: prize,
              bv: bv,
              round: table1.round,
              game_id: table1.game_id,
              sub_id: table1.sub_id,
              gt: table1.gt,
              tst: table1.tst,
              pi: hist,
              win: winners,
              dealwin: winners,
              dealwintwo: winnersTwo,
              wildCard: table1.wildCard,
              categoryId: table1.categoryId,
              halfDeclMsg: isHalfDeclCounter >= 1 ? "Deal Show - Points of the players who did not get turn will be half" : "",
            },
          });
          hist.forEach((userObj2) => {
            if (userObj2._iw === 1) {
              userObj2.tScore = 0;
              userObj2.dps = 0;
            } else {
              userObj2.dps = userObj2.ps;
            }
          });
          let jobId = commonClass.GetRandomString(10);
          await saveGameHistory(table1, hist, [table1.fnsPlayer]);
          // storeTableHistoryForWinner({
          //   tableId: table1._id.toString(),
          //   eventName: "WinnerDeclared",
          //   tableData: table1,
          //   playerData: hist,
          //   winner: [table1.fnsPlayer],
          // });
          const { pi, ap } = await checkPlayerAvailability(table1);
          getInfo.UpdateTableData(
            table1._id.toString(),
            {
              $set: {
                jid: jobId,
                tpr: 0,
                dealwin: winners,
                pi: pi,
                ap: ap,
              },
            },
            function (table2) {
              if (table2) {
                // let nxt = commonClass.AddTime(TIMER_NEXT_ROUND_DELAY);
                // if (
                //   direct &&
                //   (typeof indecl === "undefined" || indecl === false)
                // ) {
                //   winnerClass.afterRoundFinish(table2._id.toString());
                // } else {
                //   schedule.scheduleJob(table2.jid, new Date(nxt), function () {
                //     schedule.cancelJob(table2.jid);
                winnerClass.afterRoundFinish(table2._id.toString());
                //   });
                // }
              } else {
                logger.info(
                  'giveWinChips::::::::1::::>>>>>Error: "table not found"'
                );
              }
            }
          );
        } else {
          logger.info(
            'giveWinChips::::::::::::::>>>>>Error: "table not found"'
          );
        }
      });
    }
  } catch (error) {
    logger.error("-----> error giveWinChips", error);
    getInfo.exceptionError(error);
  }
};

const declareWinnerTie = (
  tbId,
  winners,
  winnersTwo,
  px,
  iter,
  prize,
  secondprize,
  msg,
  bv,
  deals,
  mode,
  round,
  _ip,
  gt,
  direct
) => {
  try {
    //iter = iterator for recursion
    /* +-------------------------------------------------------------------+
      desc:function to handle classic/bet winner
      i/p: tbId = table id
         winners = array of winners seat indices
         px = player details
         iter = iterator for recursion
         prize = prize amount for winners
         msg = message for chips track
         bv = boot value
         gt = game type
         direct = true/false direct winner or not
    +-------------------------------------------------------------------+ */
    logger.info("declareWinnerTie------------>>>>>>>>prize: ", prize);
    logger.info("declareWinnerTie------------>>>>>>>>winners: ", winners);

    if (iter < px.length) {
      if (_.contains(winners, px[iter].si)) {
        //means the winner

        let tempPlayerData = px[iter];
        let ctth = "";
        if (direct) {
          if (px[iter].cards.length > 13) {
            ctth = px[iter].cards.pop();
            tempPlayerData.cards = px[iter].cards;
          }
          tempPlayerData.dCards = {
            pure: [],
            seq: [],
            set: [],
            dwd: px[iter].cards,
          };
        }
        tempPlayerData._iw = 1;
        tempPlayerData.tdps -= tempPlayerData.ps;
        tempPlayerData.gedt = new Date();
        logger.info(
          "declareWinnerTie----------->>>>>>>>ctth: " +
          ctth +
          " direct: " +
          direct
        );
        let upData = {
          $set: {
            la: new Date(),
            ctrlServer: SERVER_ID,
            "pi.$._iw": 1,
            tst: "winnerDeclaredTie",
            ctt: new Date(),
            "pi.$.dealewinner": 1,
            "pi.$.gedt": new Date(),
          },
          $inc: {},
        };
        if (ctth != "") {
          // upData["$set"]["pi.$.cards"] = px[iter].cards;
          // upData["$set"]["pi.$.gCards"] = gCards;
          // upData["$push"] = { oDeck: ctth };

          let gCards;
          if (px[iter].gCards.length > 0) {
            gCards = px[iter].gCards;
            if (gCards.pure.length > 0) {
              let pureCards = gCards.pure;
              logger.info(
                "declareWinnerTie---------->>>>>>gCards: ",
                pureCards
              );
              for (let x in pureCards) {
                if (_.contains(pureCards[x], ctth)) {
                  pureCards[x] = _.without(pureCards[x], ctth);
                  break;
                }
              }
              logger.info("declareWinnerTie------------->>>>>gCards: ", gCards);
              gCards.pure = pureCards;
            } else if (gCards.seq.length > 0) {
              let seqCards = gCards.seq;
              logger.info("declareWinnerTie---------->>>>>>gCards: ", seqCards);
              for (let x in seqCards) {
                if (_.contains(seqCards[x], ctth)) {
                  seqCards[x] = _.without(seqCards[x], ctth);
                  break;
                }
              }
              logger.info(
                "declareWinnerTie------------->>>>>gCards: ",
                seqCards
              );
              gCards.seq = seqCards;
            } else if (gCards.set.length > 0) {
              let setCards = gCards.set;
              logger.info("declareWinnerTie---------->>>>>>gCards: ", setCards);
              for (let x in setCards) {
                if (_.contains(setCards[x], ctth)) {
                  setCards[x] = _.without(setCards[x], ctth);
                  break;
                }
              }
              logger.info(
                "declareWinnerTie------------->>>>>gCards: ",
                setCards
              );
              gCards.seq = setCards;
            } else if (gCards.dwd.length > 0) {
              let dwdCards = gCards.dwd;
              logger.info("declareWinnerTie---------->>>>>>gCards: ", dwdCards);
              for (let x in dwdCards) {
                if (_.contains(dwdCards[x], ctth)) {
                  dwdCards[x] = _.without(dwdCards[x], ctth);
                  break;
                }
              }
              logger.info(
                "declareWinnerTie------------->>>>>gCards: ",
                dwdCards
              );
              gCards.seq = dwdCards;
            }
          } else {
            gCards = px[iter].gCards;
            let dwdCards = px[iter].cards;
            gCards.dwd = dwdCards;
          }
          upData["$set"]["pi.$.cards"] = px[iter].cards;
          upData["$set"]["pi.$.gCards"] = gCards;
          upData["$push"] = { oDeck: ctth };
        }
        upData["$addToSet"] = { hist: tempPlayerData };
        logger.info("declareWinnerTie----------->>>>>upData: ", upData);
        // commonData.CountHands(table.value.pi[px[iter].si].uid,true,function(){
        commonData.CountHands(
          px[iter].uid,
          "win",
          gt,
          bv,
          false,
          mode,
          _ip,
          round,
          function (thp, qstWin, hpc) {
            commonData.getUserScore(px[iter].uid, bv, gt, function (score) {
              upData["$set"]["pi.$.score"] = score;
              upData["$set"]["pi.$.thp"] = thp;
              upData["$set"]["pi.$.hpc"] = hpc;
              upData["$inc"]["pi.$.rw"] = 1;

              db.collection("playing_table").findAndModify(
                { _id: getInfo.MongoID(tbId), "pi.si": px[iter].si },
                {},
                upData,
                { new: true },
                function (err, table) {
                  if (table && table.value) {
                    logger.info(
                      "declareWinnerTie-----------------track deal winner"
                    );

                    declareWinnerTie(
                      table.value._id.toString(),
                      winners,
                      winnersTwo,
                      px,
                      iter + 1,
                      prize,
                      secondprize,
                      msg,
                      bv,
                      deals,
                      mode,
                      round,
                      _ip,
                      gt,
                      direct
                    );
                  } else {
                    logger.info(
                      'declareWinnerTie-------------->>>>>>>>>Error:"table  not found"'
                    );
                  }
                }
              );
            });
          }
        );
      } else {
        declareWinnerTie(
          tbId,
          winners,
          winnersTwo,
          px,
          iter + 1,
          prize,
          secondprize,
          msg,
          bv,
          deals,
          mode,
          round,
          _ip,
          gt,
          direct
        );
      }
    } else {
      getInfo.GetTbInfo(tbId, {}, async function (table1) {
        if (table1) {
          let hist = _.clone(table1.hist);

          let tempHint = [];
          hist.forEach((userObj) => {
            if (userObj.uid) {
              let arrIndex = tempHint.findIndex(
                (userObj1) => userObj1.uid === userObj.uid
              );
              if (arrIndex === -1) {
                if (typeof userObj.gCards.dwd[0] === "string") {
                  userObj.gCards.dwd = [userObj.gCards.dwd];
                  userObj.dCards = userObj.gCards;
                } else {
                  userObj.dCards = userObj.gCards;
                }
                tempHint.push(userObj);
              }
            }
          });
          hist = tempHint;

          logger.info(
            "declareWinnerTie------1----->>>>>>hist: ",
            tempHint,
            hist
          );
          // for (i = 0; i < hist.length; i++) {
          //   //sort(bubble sort) the player according to the dps
          //   for (j = 0; j < hist.length - i - 1; j++) {
          //     if (hist[j].si > hist[j + 1].si) {
          //       //if dps are equal then put loser after winner
          //       temp = _.clone(hist[j]);
          //       hist[j] = _.clone(hist[j + 1]);
          //       hist[j + 1] = _.clone(temp);
          //     }
          //   }
          // }
          hist = _.sortBy(hist, (histObj) => histObj.tdps);
          hist.reverse();
          for (const iterator of winners) {
            hist = _.sortBy(hist, ({ si }) => (si === iterator ? 0 : 1));
          }

          let { game_id } = table1;
          if (table1.gt == "Deal" || table1.gt == "Pool") {
            game_id = game_id + "." + table1.sub_id;
          }
          let dealScore = [];
          if (table1.ms == 2) {
            dealScore = [{}, {}];
          } else {
            dealScore = [{}, {}, {}, {}, {}, {}];
          }
          let rCount = 0;
          let uCount = 0;
          let rSts = "loss";
          let uSts = "loss";
          for (let k in hist) {
            // if(hist[k]._ir == 0){

            if (hist[k]._iw == 1) {
              if (hist[k]._ir == 1) {
                rSts = "win";
              } else {
                uSts = "win";
              }
            }

            if (hist[k]._ir == 1) {
              rCount++;
            } else {
              uCount++;
            }

            dealScore[hist[k].si] = {
              uid: hist[k].uid,
              un: hist[k].un,
              dps: hist[k].tScore,
              tdps: hist[k].tdps,
              si: hist[k].si,
              sts: "playing",
            };
            // }
          }
          if (rCount > 0 || uCount > 0) {
            db.collection("win_sts").insertOne({
              date: new Date(),
              table_id: table1._id.toString(),
              game_type: table1.gt,
              game_id: game_id,
              rCount: rCount,
              uCount: uCount,
              rSts: rSts,
              uSts: uSts,
            });
          }

          let ldData = {
            $set: {
              tbid: table1._id.toString(),
              round: table1.round,
              game_id: table1.game_id,
              sub_id: table1.sub_id,
              gt: table1.gt,
              tst: table1.tst,
              pi: hist,
              wildCard: table1.wildCard,
              win: [table1.fnsPlayer],
            },
          };

          db.collection("last_deal").findAndModify(
            { tbid: table1._id.toString() },
            {},
            ldData,
            { upsert: true, new: true },
            function (err, table1) { }
          );


          commonClass.FireEventToTable(table1._id.toString(), {
            en: "WinnerDeclared",
            data: {
              tbid: table1._id.toString(),
              pv: prize,
              bv: bv,
              round: table1.round,
              game_id: table1.game_id,
              sub_id: table1.sub_id,
              gt: table1.gt,
              tst: "roundWinnerDeclared",
              pi: hist,
              win: winners,
              dealwin: winners,
              dealwintwo: -1,
              wildCard: table1.wildCard,
              categoryId: table1.categoryId,
            },
          });
          hist.forEach((userObj2) => {
            if (userObj2._iw === 1) {
              userObj2.tScore = 0;
              userObj2.dps = 0;
            } else {
              userObj2.dps = userObj2.ps;
            }
          });
          let jobId = commonClass.GetRandomString(10);
          await saveGameHistory(table1, hist, winners);
          // storeTableHistoryForWinner({
          //   tableId: table1._id.toString(),
          //   eventName: "WinnerDeclared",
          //   tableData: table1,
          //   playerData: hist,
          //   winner: winners,
          // });
          const { pi, ap } = await checkPlayerAvailability(table1);
          getInfo.UpdateTableData(
            table1._id.toString(),
            {
              $set: {
                jid: jobId,
                tpr: 0,
                pi: pi,
                ap: ap,
              },
            },
            function (table2) {
              if (table2) {
                let i = 0;
                res(i);
                async function res(i) {
                  if (i < table2.pi.length) {
                    if (
                      !_.isEmpty(table2.pi[i]) &&
                      typeof table2.pi[i].si != "undefined" &&
                      !_.contains(winners, table2.pi[i].si)
                    ) {
                      await db
                        .collection("game_users")
                        .findOneAndUpdate(
                          { _id: getInfo.MongoID(table2.pi[i].uid) },
                          { $set: { tableRemove: true } }
                        );

                      getInfo.GetUserInfo(
                        table2.pi[i].uid,
                        { sck: 1 },
                        function (userInfo) {
                          if (userInfo) {
                            let flag = "dealoversixloss";

                            let single = userInfo.sck.replace(/s\d*_\d*./i, "");
                            leaveTableClass.LeaveTable(
                              { flag: flag, eliminated: true },
                              {
                                id: single,
                                uid: table2.pi[i].uid,
                                _ir: table2.pi[i]._ir,
                                si: table2.pi[i].si,
                                tbid: table2._id.toString(),
                              },
                              function (check) {
                                i += 1;
                                res(i);
                              }
                            );
                          } else {
                            i += 1;
                            res(i);
                          }
                        }
                      );
                    } else {
                      i += 1;
                      res(i);
                    }
                  } else {
                    // we need to start tie round there is no any delay for tie breaker.
                    winnerClass.afterRoundFinish(table2._id.toString());
                  }
                }
              } else {
                logger.info(
                  'declareWinnerTie::::::::1::::>>>>>Error: "table not found"'
                );
              }
            }
          );
        } else {
          logger.info(
            'declareWinnerTie::::::::::::::>>>>>Error: "table not found"'
          );
        }
      });
    }
  } catch (error) {
    logger.error("-----> error declareWinnerTie", error);
    getInfo.exceptionError(error);
  }
};

const BackToTable = async (data, client) => {
  try {
    logger.info("data------->", data.tbid, data);
    const redisInstances = getRedisInstances();
    const lvt = await redisInstances.SET(`backToTable:${data.tbid}:${data.uid}`, 1, { EX: 5, NX: true, });
    if (!lvt) {
      return false;
    }

    const { TIMER_BACK_TO_TABLE, ROUND_START_TIMER, ROUND_START_TIMER_POINT_SIX, ROUND_START_TIMER_POINT_TWO, BACK_TO_TABLE_FLAG } = GetConfig();
    getInfo.GetTbInfo(
      data.tbid,
      {
        gt: 1,
        ap: 1,
      },
      async function (table) {
        if (table && table.gt == "Points" && BACK_TO_TABLE_FLAG) {
          await db.collection("playing_table").findOneAndUpdate(
            {
              _id: getInfo.MongoID(data.tbid),
            },
            {
              $addToSet: {
                backToTableUser: data.uid,
              },
            }
            // { returnDocument: "after" }
          );

          let updatedTable = await db.collection("playing_table").findOne(
            {
              _id: getInfo.MongoID(data.tbid),
            },
            {
              projection: {
                ap: 1,
                jid: 1,
                ms: 1,
                tie: 1,
                bv: 1,
                pi: 1,
                round: 1,
                backToTableUser: 1,
                ctt: 1,
                gt: 1
              },
            }
          );

          // updatedTable.pi = updatedTable.pi.filter((x) => x._ir === 0);
          let realUser = updatedTable.pi.filter((x) => x._ir === 0);

          let startTimer = new Date();

          let rst = ROUND_START_TIMER;
          if (table.ms == 6) {
            rst = ROUND_START_TIMER_POINT_SIX;
          } else if (table.ms == 2) {
            rst = ROUND_START_TIMER_POINT_TWO;
          }
          let Timer = parseInt(rst) - commonClass.GetTimeDifference(updatedTable.ctt, startTimer, "second");

          if (realUser.length <= updatedTable.backToTableUser.length && updatedTable.ap >= updatedTable.ms && Timer > TIMER_BACK_TO_TABLE) {

            let newRst = TIMER_BACK_TO_TABLE ?? 5;

            let pi = [];
            for (let j in updatedTable.pi) {
              let dt = {
                uid: updatedTable.pi[j].uid,
                si: updatedTable.pi[j].si,
                s: updatedTable.pi[j].s,
              };
              pi.push(dt);
            }

            await db.collection("playing_table").findOneAndUpdate({ _id: updatedTable._id, }, { $set: { ctt: new Date() } });
            commonClass.FireEventToTable(updatedTable._id.toString(), {
              en: "RoundTimerStarted",
              data: {
                timer: newRst,
                tie: updatedTable.tie,
                bv: updatedTable.bv,
                next: 0,
                newgame: false,
                pi: pi,
                round: updatedTable.round + 1,
                // serverCurrentMillis: moment.utc().valueOf(),
              },
            });

            // let stt = commonClass.AddTime(newRst);
            // schedule.rescheduleJob(updatedTable.jid, new Date(stt), function (err, rescheduleJob) {
            //   logger.info("back to table roundTimer", data.tbid, err, rescheduleJob);
            // });

            // let stt = commonClass.AddTime(newRst);
            // schedule.cancelJob(updatedTable.jid);
            // schedule.scheduleJob(updatedTable.jid, new Date(stt), function () {
            //   schedule.cancelJob(updatedTable.jid);
            //   roundClass.startRound(updatedTable._id.toString());
            // });

            const jobId = `${updatedTable.gt}:roundTimerStart:${updatedTable._id.toString()}`;
            const jobNewId = `${updatedTable.gt}:roundCutTimerStart:${updatedTable._id.toString()}`;
            logger.info("back to table roundTimerStart", jobId);
            logger.info("back to table roundCutTimerStart", jobNewId);
            // await scheduler.cancelJob.cancelRoundTimerStart(jobId);
            // await scheduler.cancelJob.cancelRoundTimerStart(jobNewId);

            cancelJob(jobId);
            cancelJob(jobNewId);

            // await scheduler.queues.roundTimerStart({
            //   timer: newRst * 1000,
            //   jobId: jobNewId,
            //   tableId: updatedTable._id.toString(),
            // });

            const jobData = {
              tableId: updatedTable._id.toString(),
              calling: ROUND_TIMER_START_TIMER
            };
            const jobOption = { delay: newRst * 1000, jobId: jobNewId };
            addQueue(jobData, jobOption);

          }
        }
      }
    );
  } catch (error) {
    logger.error("-----> error BackToTable", error);
    getInfo.exceptionError(error);
  }
};


const checkPlayableOrNot = async (client, userData) => {
  try {
    let countryCheck = false;
    const { BLOCK_STATE, BAN_STATE_GAME_PLAY, BAN_STATE_GAME_PLAY_COUNT, BAN_STATE_ADD_CASH } = GetConfig();
    if (client.storeUser && userData.country !== "India") {
      countryCheck = true;
    }
    const checkLocation =
      _.contains(BLOCK_STATE, userData.state) || countryCheck;
    if (checkLocation) {
      let possibleGamePlay = false;
      if (_.contains(BLOCK_STATE, userData.state) && BAN_STATE_GAME_PLAY) {
        const totalGamePlay = await db
          .collection("UserGameHistory")
          .countDocuments({
            userId: getInfo.MongoID(client.uid),
          });

        const totalAddCash = await db
          .collection("user_payment")
          .aggregate([
            {
              $match: {
                userId: getInfo.MongoID(client.uid),
                status: "SUCCESS",
                mode: "ADD_CASH",
              },
            },
            {
              $group: {
                _id: "$userId",
                amount: {
                  $sum: "$amount",
                },
              },
            },
          ])
          .toArray();
        possibleGamePlay =
          totalGamePlay >= BAN_STATE_GAME_PLAY_COUNT &&
          totalAddCash[0]?.amount >= BAN_STATE_ADD_CASH;
      }

      if (!possibleGamePlay) {
        commonClass.SendData(
          client,
          "PopUp",
          { flag: "Join Error", popupName: "Location" },
          "error:1009"
        );
        return false;
      }
    }

    if (client.storeUser) {
      const userAddressProof = await db.collection("UserAddressProof").find({ userId: getInfo.MongoID(client.uid) }).limit(1).toArray();

      if (userAddressProof.length <= 0) {
        commonClass.SendData(client, "UserAddressProof", {
          showPop: userAddressProof?.length == 0,
          userAddressProof,
        });
        return false;
      }
    }

    return true;
  } catch (error) {
    logger.error("checkPlayableOrNot----->", error);
  }
};

module.exports = {
  GetPointRummy,
  JoinTablePoint,
  JoinTablePointCash,
  GameInfo,
  GetPoolRummy,
  JoinTablePool,
  JoinTablePoolCash,
  GetDealRummy,
  JoinTableDeal,
  JoinTableDealCash,
  giveWinChips,
  declareWinnerTie,
  BackToTable,
};

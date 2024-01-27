const { decrement, getKeys, getRedis } = require("./redis.class");
const moment = require("moment");
const _ = require("underscore");
const schedule = require("node-schedule");
const commonData = require("./commonData.class");
const commonClass = require("./common.class.js"); //common functions
const trackClass = require("./track.class");
const jobTimers = require("./jobTimers.class");
const getInfo = require("../common");
const logger = require("../utils/logger");
const socketClass = require("../utils/getSockets");
const socketData = new socketClass();
const { getRedisInstances } = require("../connections/redis");
const { GetConfig } = require("../connections/mongodb");
const scheduler = require("../scheduler");
const { USER_REJOIN_TIMER } = require("../constants/eventName");
const checkStuckTables = require("../common/stucktables.class");
const { addQueue, cancelJob } = require("../scheduler/bullQueue");

const AUCI = async (data, client) => {
  try {
    //Add User Connection Id
    /* +-------------------------------------------------------------------+
          desc:this function is used to assign user variable to socket object
          i/p: data = user details
      +-------------------------------------------------------------------+ */
    if (!data || !client.sck) {
      logger.info('AUCI:::::::::::>>>>Error: "data not found!!!"');
      return false;
    }
    const { BLOCK_STATE } = GetConfig();

    client.uid = data._id.toString();
    client.det = data.det;

    //update socket of the user

    let lc = data.lc;
    data.depositCash = data.depositCash ?? 0;
    data.totalcash = data.Winning + data.depositCash;

    let SignUpBonus = 0,
      totalCashBonus = 0,
      totalReferralBonus = 0,
      cmsBonus = 0;
    if (data.SignUpBonusStatus == "Active") {
      SignUpBonus += data.SignUpBonus;
    }

    if (data.addCash_bonus) {
      for (const element of data.addCash_bonus) {
        if (element.status == "Active") {
          totalCashBonus += element.addCashBonus;
        }
      }
    }

    if (data.referral_bonus) {
      for (const element of data.referral_bonus) {
        if (element.status == "Active") {
          totalReferralBonus += element.referralBonus;
        }
      }
    }

    if (data.Bonus) {
      cmsBonus += data.Bonus;
    }

    data.totalBonus =
      totalCashBonus + SignUpBonus + totalReferralBonus + cmsBonus;

    if (data.totalBonus < 0) {
      data.totalBonus = 0;
    }

    let updata = {
      lc: lc,
      sck: client.sck,
      ipad: client.ipad,
      totalcash: data.totalcash,
      totalBonus: data.totalBonus,
      "flags._io": 1,
      "flags._ftp": 0,
    };
    //if the user comes after one days then reset the counter
    const { value: res } = await db
      .collection("game_users")
      .findOneAndUpdate(
        { _id: data._id },
        { $set: updata },
        { returnDocument: "after" }
      );

    //logger.info(data.uid);
    logger.info(
      "AUCI---------->>>>>data.sck: ",
      data.sck,
      " client.sck: ",
      client.sck
    );
    if (data.sck && data.sck != "" && data.sck != client.sck) {
      logger.info("AUCI---------->>>>> multi login detected: ");
      commonClass.SendDirect(data.sck, {
        en: "NCC",
        data: {
          sck: data.sck,
          message: commonData.dataCodesArray["en:error:1073"].Message,
          popupName: "MultiLogin",
        },
      });
    }

    let pUser = {
      uid: client.uid,
      un: res.un,
      lc: res.lc,
      _isup: res.flags._isup,
      _ir: res.flags._ir,
      pp: res.pp,
      sck: client.sck,
    };

    client.un = res.un;
    client.lc = res.lc;
    client._isup = res.flags._isup;
    client._ir = res.flags._ir;
    client.pp = res.pp;
    client.ult = res.ult;
    client.deviceId = res.deviceId;

    if (res.prms) {
      client.pubact = commonClass.InArray("publish_actions", res.prms);
    } else {
      client.pubact = true;
    }

    if (res.det == "ios" && res.iv) {
      // client.v = parseFloat(res.iv);
      client.v = res.iv;
      client.vc = res.ivc;
    } else if (res.det == "android" && res.av) {
      // client.v = parseFloat(res.av);
      client.v = res.av;
      client.vc = res.avc;
    } else {
      client.v = 2;
    }

    res.flags._ftp = data.flags._ftp;

    res.CASH_MODE = true;

    if (
      res.state != null &&
      res.state != "" &&
      _.contains(BLOCK_STATE, data.state)
    ) {
      res.CASH_MODE = false;
      res.unlock.tournament = 0;
      res.unlock.playwithfriend = 0;
    }

    trackClass.dauMau(pUser.uid, res.det);
    let remtime = commonClass.GetTimeDifference(
      new Date(),
      new Date(res.lasts.ldbt)
    );
    res.freeBonus = true;
    // var dayDiff = commonClass.GetTimeDifference(new Date(res.lasts.ldbt),new Date(),'day');
    if (remtime <= 0) {
      res.freeBonus = true;
    }

    // already login device
    res.isAlreadyLogin = client.isAlreadyLogin;
    filterData(res, client);
  } catch (error) {
    logger.error("-----> error AUCI", error);
    getInfo.exceptionError(error);
  }
};

const Logout = async (data, client) => {
  try {
    /* +-------------------------------------------------------------------+
          desc:this function is used to handle user that has disconnect 
          i/p: data = {}
      +-------------------------------------------------------------------+ */
    if (!client.sck) {
      logger.info('Logout::::::::::::::>>>>>>>>Error: "socket not found!!!"');
      return false;
    }
    const { TIME_REJOIN_PLAY } = GetConfig();
    const redisInstances = getRedisInstances();
    logger.info("TIME_REJOIN_PLAY", TIME_REJOIN_PLAY);
    const lvt = await redisInstances.SET(`Logout:${client.uid}`, 1, {
      EX: 5,
      NX: true,
    });

    if (!lvt) {
      return false;
    }

    // redisInstances.ZINCRBY("servers", -1, SERVER_ID);

    if (client._ir == 0) {
      decrement(`totalOnlinePlayers`);

      getInfo.GetUserInfo(
        client.uid,
        { sck: 1, tbid: 1, rejoinID: 1, rejoin: 1, cbTbid: 1 },
        function (userData) {
          logger.info(
            "Logout----->>>>>userData: ",
            userData,
            " client.sck: ",
            client.sck
          );
          if (userData && userData.sck == client.sck) {
            getInfo.UpdateUserData(
              client.uid,
              {
                $set: {
                  "flags._io": 0,
                  cAmount: false,
                  sck: "",
                  "lasts.llgt": new Date(),
                  storeUser: false,
                },
              },
              function (userInfo) {
                logger.info(
                  "Logout--------------------->>>>>userInfo: ",
                  userInfo
                );
                if (userInfo.tbid && userInfo.tbid != "") {
                  let rejoinPID = "REJOINP" + commonClass.GetRandomInt(1, 99999);
                  let { si, id } = client;
                  if(userData.scriptUser){
                    userRejoinTimer({id, si,userId: userInfo._id.toString()})
                    return false;

                  }

                  if (userInfo.rejoin == 0) {
                    getInfo.UpdateUserData(
                      userInfo._id.toString(),
                      {
                        $set: {
                          rejoinID: rejoinPID,
                          rejoin: 1 /*,sck:'','flags._io':0*/,
                        },
                      },
                      function (upData) {
                        // let playRejoinTime = commonClass.AddTime(TIME_REJOIN_PLAY);
                        const userJobId = `userRejoinTimer:${rejoinPID}`;
                        // scheduler.queues.userRejoinTimer({
                        //   timer: TIME_REJOIN_PLAY * 1000,
                        //   jobId: userJobId,
                        //   id, si, userId: userInfo._id.toString()
                        // });
                        const jobData = {
                          id, si, userId: userInfo._id.toString(),
                          calling: USER_REJOIN_TIMER
                        };
                        const jobOption = { delay: TIME_REJOIN_PLAY * 1000, jobId: userJobId };
                        addQueue(jobData, jobOption);
                        // schedule.scheduleJob(
                        //   rejoinPID,
                        //   new Date(playRejoinTime),
                        //   function () {
                        //     schedule.cancelJob(rejoinPID);
                        //     //standup logic here
                        //   });
                      }
                    );
                  } else {
                    logger.info(
                      'Logout---------------------------->>>>>"post logout process cancelled"'
                    );
                  }
                }
              }
            );
          } else {
            logger.info(
              'Logout::::::::::::::::>>>>>Error:"user not found or already rejoin!!!"'
            );
          }
        }
      );
    }
  } catch (error) {
    logger.error("-----> error Logout", error);
    getInfo.exceptionError(error);
  }
};

const ReJoin = (data, client) => {
  try {
    //Rejoin table; data = {}
    /* +-------------------------------------------------------------------+
          desc:this event is used to handle rejoin state
          i/p: data = {}
      +-------------------------------------------------------------------+ */
    logger.info("ReJoin----------->>>>>>client.uid:  ", client.uid);
    const {STUCK_TABLE_CHECK_TIME_IN_MINUT,ENABLE_REMOVE_STUCK_TABLE_FUNCTION} = GetConfig();
    if (!client.uid || client.uid.length < 24) {
      return false;
    }
    getInfo.GetUserInfo(client.uid, {}, function (userInfo) {
      logger.info("ReJoin---------->>>>>userInfo: ", userInfo);
      if (!userInfo) {
        logger.info('ReJoin------------>>>>>"user not found"');
        return false;
      }
      if (userInfo.rejoinID && userInfo.rejoinID != "") {
        // jobTimers.cancelRejoinJobs(userInfo.rejoinID);
        const userJobId = `userRejoinTimer:${userInfo.rejoinID}`;
        cancelJob(userJobId);
        logger.info('ReJoin------------->>>>>Msg: "rejoin timer canceled"');
      }

      logger.info("ReJoin---------->>>>>tableRemove: ", userInfo);

      if (
        (userInfo.tbid && userInfo.tbid != "" && userInfo.tbid.length == 24) ||
        userInfo.tableRemove
      ) {
        getInfo.GetTbInfo(userInfo.tbid, {}, async function (table) {
          if (table) {
            // table found
            let timerCheck1 = commonClass.GetTimeDifference(
              table.ctt,
              new Date(),
              "second"
            );
            let timerCheck2 = commonClass.GetTimeDifference(
              table.la,
              new Date(),
              "second"
            );
            if ((timerCheck1 > (STUCK_TABLE_CHECK_TIME_IN_MINUT*60)&&timerCheck2>(STUCK_TABLE_CHECK_TIME_IN_MINUT*60)) && ENABLE_REMOVE_STUCK_TABLE_FUNCTION) {
              await db.collection("game_users").findOneAndUpdate({ _id: getInfo.MongoID(client.uid) }, { $set: { rejoin: 0, rejoinID: "", tbid: "", tbd: "" } });
              commonClass.SendData(client, "PopUp", {}, "error:1067");
              return checkStuckTables.removeStuckTable(table);
            }


            db.collection("playing_table").findOne(
              { _id: table._id, "pi.uid": client.uid },
              { projection: { "pi.$": 1 } },
              function (err, pTable) {
                // db.collection('playing_table').findOne({_id:table._id,'pi.uid':client.uid},{"pi.$":1},function(err,pTable){
                let tbId = table._id.toString();
                let uId = userInfo._id.toString();

                let rCount = 0;

                for (let k in table.pi) {
                  if (
                    !_.isEmpty(table.pi[k]) &&
                    typeof table.pi[k]._ir != "undefined" &&
                    table.pi[k]._ir == 1
                  ) {
                    rCount++;
                  }
                }

                let game_id = table.game_id;
                let sub_id = table.sub_id;

                if (
                  _.contains(
                    [
                      "",
                      "RoundTimerStarted",
                      "CollectingBootValue",
                      "StartDealingCard",
                    ],
                    table.tst
                  )
                ) {
                  game_id = game_id + 1;
                  sub_id = sub_id + 1;
                }

                if (table.gt == "Deal" || table.gt == "Pool") {
                  if (table.round == 0) {
                    game_id = game_id + ".1";
                  } else {
                    game_id = game_id + "." + sub_id;
                  }
                }

                if (pTable) {
                  //means the player is playing in table
                  logger.info(
                    'ReJoin----------if---------->>>>>Msg: "join to seat"'
                  );
                  let Seat = pTable.pi[0].si;
                  getInfo.UpdateUserData(
                    uId,
                    { $set: { rejoin: 0, rejoinID: "", tableRemove: false } },
                    function (upData) {
                      let single = upData.sck.replace(SERVER_ID + ".", "");
                      logger.info("ReJoin--------->>>>>>>single: ", single);
                      if (socketData.getSocketObjects(single)) {
                        logger.info("ReJoin--------->>>>>if io  tbId: ", tbId);
                        socketData.getSocketObjects(single).join(tbId);
                      }
                      client.tbid = tbId;
                      client.si = Seat;
                      client.gt = table.gt;
                      commonData.GetTableInfo(
                        { tbid: tbId, _isHelp: 0, rejoin: 1, jnbk: 0 },
                        client
                      );
                    }
                  );
                } else {
                  //player is standup
                  logger.info(
                    'ReJoin----else--->>>>Msg: "user is join in standup mode"'
                  );
                  getInfo.UpdateUserData(
                    uId,
                    { $set: { rejoin: 0, rejoinID: "", tableRemove: false } },
                    function (upData) {
                      if (table.tst == "winnerDeclared") {
                        commonClass.SendData(
                          client,
                          "PopUp",
                          { flag: "tnf", uid: client.uid },
                          "error:1067"
                        );
                        return false;
                      } else {
                        let single = upData.sck.replace(SERVER_ID + ".", "");
                        if (socketData.getSocketObjects(single)) {
                          logger.info(
                            "joinSeat-----before----->>>>connected sockets: ",
                            io.sockets.adapter.rooms[tbId]
                          );
                          logger.info(
                            "ReJoin-----------else------------>>>>tbId: ",
                            tbId
                          );
                          socketData.getSocketObjects(single).join(tbId);
                          logger.info(
                            "joinSeat-----before----->>>>connected sockets: ",
                            io.sockets.adapter.rooms[tbId]
                          );
                        }
                        client.tbid = tbId;
                        client.gt = table.gt;
                        commonData.GetTableInfo(
                          { tbid: tbId, _isHelp: 0, rejoin: 1, jnbk: 0 },
                          client
                        );
                      }
                    }
                  );
                }
              }
            );
          } else {
            // if table not found
            getInfo.UpdateUserData(
              client.uid,
              {
                $set: {
                  tbid: "",
                  rejoin: 0,
                  rejoinID: "",
                  cAmount: false,
                  tableRemove: false,
                },
              },
              function () {
                logger.info('ReJoin------------->>>>>>Msg:"table not found"');
                return commonClass.SendData(
                  client,
                  "PopUp",
                  { flag: "tnf", uid: client.uid },
                  "error:1067"
                ); //table not found
              }
            );
          }
        });
      } else {
        logger.error('ReJoin-------3333----->>>>"no table found"', userInfo);
        return commonClass.SendData(
          client,
          "PopUp",
          { flag: "tnf", uid: client.uid },
          "error:1067"
        );
      }
    });
  } catch (error) {
    logger.error("-----> error ReJoin", error);
    getInfo.exceptionError(error);
  }
};

const filterData = (userData, client) => {
  try {
    if (userData) {
      userData._id = userData._id.toString();
      delete userData.lasts;
      delete userData.osType;
      delete userData.osVer;
      delete userData.devBrnd;
      delete userData.devMdl;
      delete userData.sck;
      delete userData.rand;
      delete userData.ds;
      delete userData.counters.hw;
      delete userData.counters.hl;
      delete userData.counters.hd;
      delete userData.counters.cw;
      delete userData.counters.cl;
      delete userData.counters.cdr;
      delete userData.counters.hcl;
      delete userData.counters.tap;
      delete userData.counters.tpp;
      delete userData.counters.opc;
      delete userData.counters.addcash;
      delete userData.counters.bet_c;
      delete userData.counters.dbc;
      delete userData.counters.deal_c;
      delete userData.counters.fdbk;
      delete userData.counters.hdc;
      delete userData.counters.hlc;
      delete userData.counters.hwc;
      delete userData.counters.hp;
      delete userData.counters.hpc;
      delete userData.counters.invC;
      delete userData.counters.loseStreak;
      delete userData.counters.mcw;
      delete userData.counters.pbrc;
      delete userData.counters.pdrc;
      delete userData.counters.playDays;
      delete userData.counters.playdays;
      delete userData.counters.pool_c;
      delete userData.counters.pplrc;
      delete userData.counters.ptc;
      delete userData.counters.rpc;
      delete userData.counters.spinDays;
      delete userData.counters.tacd;
      delete userData.counters.thp;
      delete userData.counters.thpcd;
      delete userData.counters.winTrigger;
      delete userData.counters.wsp;
      delete userData.flags._challenge;
      delete userData.flags._fActions;
      delete userData.flags._fDiscard;
      delete userData.flags._fPick;
      delete userData.flags._fSort;
      delete userData.flags._ftp;
      delete userData.flags._io;
      delete userData.flags._ir;
      delete userData.flags._isRated;
      delete userData.flags._isRefered;
      delete userData.flags._isSpc;
      delete userData.flags._isbkdv;
      delete userData.flags._isbkip;
      delete userData.flags._isup;
      delete userData.flags._noti;
      delete userData.flags._payer;
      delete userData.flags._pyr;
      delete userData.flags._tutf;
      delete userData.flags._winshare;
      delete userData.sn;
      delete userData.Bonus;
      delete userData.Password;
      // delete userData.SignUpBonus;
      delete userData.StartAfter;
      delete userData.Unutilized;
      delete userData.Winning;
      delete userData.av;
      delete userData.avc;
      delete userData.bv;
      delete userData.cbtn;
      delete userData.cc;
      delete userData.cd;
      delete userData.city;
      delete userData.claimRewards;
      delete userData.country;
      delete userData.dids;
      delete userData.freeBonus;
      delete userData.ip;
      delete userData.ipad;
      delete userData.iv;
      delete userData.ivc;
      delete userData.la;
      delete userData.lc;
      delete userData.losscounter;
      delete userData.nwt;
      delete userData.offers;
      delete userData.pbrc;
      delete userData.pdrc;
      delete userData.pplrc;
      delete userData.pprc;
      delete userData.ptc;
      delete userData.rejoinID;
      delete userData.sessId;
      delete userData.state;
      delete userData.wc;
      delete userData.wintrigger;
      delete userData.OTP;
      logger.info("filterData----------------->>>>>: userData: ", userData);

      let totalBonus,
        SignUpBonus = 0,
        totalCashBonus = 0,
        totalReferralBonus = 0,
        cmsBonus = 0;

      if (userData.SignUpBonusStatus == "Active") {
        SignUpBonus += userData.SignUpBonus;
      }

      if (userData.addCash_bonus) {
        for (const element of userData.addCash_bonus) {
          if (element.status == "Active") {
            totalCashBonus += element.addCashBonus;
          }
        }
      }

      if (userData.referral_bonus) {
        for (const element of userData.referral_bonus) {
          if (element.status == "Active") {
            totalReferralBonus += element.referralBonus;
          }
        }
      }

      if (userData.Bonus) {
        cmsBonus += userData.Bonus;
      }

      userData.totalBonus =
        totalCashBonus + SignUpBonus + totalReferralBonus + cmsBonus;

      if (userData.totalBonus < 0) {
        userData.totalBonus = 0;
      }

      commonClass.SendData(client, "SignUp", userData);
    } else {
      logger.info('filterData----------------->>>>>>"data not found"');
    }
  } catch (error) {
    logger.error("-----> error filterData", error);
    getInfo.exceptionError(error);
  }
};


const onlineUsers = async (data, client, eventName) => {
  try {
    const onlineUsers = {};
    onlineUsers.totalOnlinePlayers =
      (await getRedis(`totalOnlinePlayers`)) ?? "0";
    onlineUsers.points = (await getRedis(`${data.mode}:Points`)) ?? "0";
    onlineUsers.pool = (await getRedis(`${data.mode}:Pool`)) ?? "0";
    onlineUsers.deal = (await getRedis(`${data.mode}:Deal`)) ?? "0";
    onlineUsers.pool61 = (await getRedis(`${data.mode}:Pool61`)) ?? "0";
    onlineUsers.pool101 = (await getRedis(`${data.mode}:Pool101`)) ?? "0";
    onlineUsers.pool201 = (await getRedis(`${data.mode}:Pool201`)) ?? "0";

    const pointsGameCount = await getKeys(`${data.mode}:Points:`);
    const poolGameCount = await getKeys(`${data.mode}:Pool:`);
    const dealGameCount = await getKeys(`${data.mode}:Deal:`);

    const pool61GameCount = await getKeys(`${data.mode}:Pool61:`);
    const pool101GameCount = await getKeys(`${data.mode}:Pool101:`);
    const pool201GameCount = await getKeys(`${data.mode}:Pool201:`);

    const poolLobby = await db
      .collection("pool_category")
      .find({ mode: data.mode, pCount: data.pCount ?? 2 })
      .project({ mode: 1, pCount: 1 })
      .sort({ fee: 1 })
      .toArray();
    const pool61Lobby = await db
      .collection("pool_category")
      .find({ category: 61, mode: data.mode, pCount: data.pCount ?? 2 })
      .project({ mode: 1, pCount: 1 })
      .sort({ fee: 1 })
      .toArray();
    const pool101Lobby = await db
      .collection("pool_category")
      .find({ category: 101, mode: data.mode, pCount: data.pCount ?? 2 })
      .project({ mode: 1, pCount: 1 })
      .sort({ fee: 1 })
      .toArray();
    const pool201Lobby = await db
      .collection("pool_category")
      .find({ category: 201, mode: data.mode, pCount: data.pCount ?? 2 })
      .project({ mode: 1, pCount: 1 })
      .sort({ fee: 1 })
      .toArray();

    const pointsLobby = await db
      .collection("point_category")
      .find({ mode: data.mode, pCount: data.pCount ?? 2 })
      .project({ mode: 1, pCount: 1 })
      .sort({ cpp: 1 })
      .toArray();

    const dealLobby = await db
      .collection("deal_category")
      .find({ mode: data.mode })
      .project({ mode: 1, deals: 1 })
      .sort({ fee: 1 })
      .toArray();

    pointsLobby.map(async (x) => {
      const result = pointsGameCount.find(
        (a1) => a1.jobId.split(":")[2] == x._id
      );
      x.totalUser = result ? result.count : "0";
      return x;
    });

    poolLobby.map(async (x) => {
      const result = poolGameCount.find(
        (a1) => a1.jobId.split(":")[2] == x._id
      );
      x.totalUser = result ? result.count : "0";
      return x;
    });

    pool61Lobby.map(async (x) => {
      const result = pool61GameCount.find(
        (a1) => a1.jobId.split(":")[2] == x._id
      );
      x.totalUser = result ? result.count : "0";
      return x;
    });
    pool101Lobby.map(async (x) => {
      const result = pool101GameCount.find(
        (a1) => a1.jobId.split(":")[2] == x._id
      );
      x.totalUser = result ? result.count : "0";
      return x;
    });
    pool201Lobby.map(async (x) => {
      const result = pool201GameCount.find(
        (a1) => a1.jobId.split(":")[2] == x._id
      );
      x.totalUser = result ? result.count : "0";
      return x;
    });

    dealLobby.map(async (x) => {
      const result = dealGameCount.find(
        (a1) => a1.jobId.split(":")[2] == x._id
      );
      x.totalUser = result ? result.count : "0";
      return x;
    });

    onlineUsers.pointsLobby = pointsLobby;
    onlineUsers.poolLobby = poolLobby;
    onlineUsers.pool61Lobby = pool61Lobby;
    onlineUsers.pool101Lobby = pool101Lobby;
    onlineUsers.pool201Lobby = pool201Lobby;
    onlineUsers.dealLobby = dealLobby;
    commonClass.SendData(client, eventName, onlineUsers);
  } catch (error) {
    logger.error("-----> error onlineUsers", error);
    getInfo.exceptionError(error);
  }
};

const DailyBanner = async (data, client, eventName) => {
  try {
    const {Banner_ViewCount } = GetConfig();
    const userDetails = await db
      .collection("game_users")
      .findOne(
        { _id: getInfo.MongoID(client.uid) },
        { projection: { "lasts.bannerViewDate": 1,counters:1 } }
      );
    const bannerDetail = await db
      .collection("banner")
      .find()
      .sort({ _id: -1 })
      .limit(1)
      .toArray();
    if (bannerDetail.length === 0) return false;
    const URL = bannerDetail[0].imageUrl;
    if (!userDetails.lasts.bannerViewDate) {
      await bannerDate(client.uid);
      commonClass.SendData(client, eventName, { URL });
    } else {
      const isCurrentDate = moment(userDetails.lasts.bannerViewDate).isSame(
        new Date(),
        "day"
      );
      if (!isCurrentDate) {
        await bannerDate(client.uid);
        commonClass.SendData(client, eventName, { URL });
        // await db.collection("game_users").findOneAndUpdate({ _id: getInfo.MongoID(client.uid)},{$set:{"counters.bannerViewCount":1}});
      }else{
        if(!userDetails.counters.bannerViewCount){
          commonClass.SendData(client, eventName, { URL });
          await db.collection("game_users").findOneAndUpdate({ _id: getInfo.MongoID(client.uid)},{$set:{"counters.bannerViewCount":1}});


        }else if(userDetails.counters.bannerViewCount&&userDetails.counters.bannerViewCount<Banner_ViewCount){
          // await bannerDate(client.uid);
          commonClass.SendData(client, eventName, { URL });
          await db.collection("game_users").findOneAndUpdate({ _id: getInfo.MongoID(client.uid)},{$inc:{"counters.bannerViewCount":1}});
        }
      }
    }
  } catch (error) {
    logger.error("-----> error DailyBanner", error);
    getInfo.exceptionError(error);
  }
};

const bannerDate = async (userId) => {
  try {
    await db.collection("game_users").updateOne(
      {
        _id: getInfo.MongoID(userId),
      },
      {
        $set: {
          "lasts.bannerViewDate": new Date(),
          "counters.bannerViewCount":1
        },
      }
    );
  } catch (error) {
    logger.error("-----> error bannerDate", error);
    getInfo.exceptionError(error);
  }
};

const userRejoinTimer = ({ userId, id, si }) => {
  getInfo.GetUserInfo(userId, {}, function (userInfo1) {
    logger.info("Logout------------->>>>>userInfo1: ", userInfo1);
    if (userInfo1 && userInfo1.rejoin != 0) {
      logger.info(
        "Logout------ " +
        userInfo1.un +
        ' ------->>>>>Msg: "user 1 min time out hence standup"'
      );

      getInfo.GetTbInfo(
        userInfo1.tbid,
        {
          gt: 1,
          _ip: 1,
          mode: 1,
          bv: 1,
          categoryId: 1,
        },
        function (table) {
          if (table) {
            if (table.gt == "Deal") {
              logger.info("Logout--------->>>>userInfo1.flags._ir: ", userInfo1.flags._ir, " si: ", si, " userInfo1.tbid: ", userInfo1.tbid);
              getInfo.UpdateUserData(
                userInfo1._id.toString(),
                {
                  $set: {
                    rejoinID: "",
                    rejoin: 0,
                    tableRemove: false,
                  },
                },
                function (upData2) {
                  leaveTableClass.LeaveTable(
                    {
                      flag: "disc",
                      eliminated: true,
                    },
                    {
                      id: id,
                      uid: userInfo1._id.toString(),
                      _ir: userInfo1.flags._ir,
                      si: si,
                      tbid: userInfo1.tbid,
                    }
                  );
                }
              );
            } else if (table.gt == "Pool") {
              logger.info("Logout--------------->>>>>userInfo1.flags._ir: " + userInfo1.flags._ir + " si: " + si + " userInfo1.tbid: " + userInfo1.tbid);
              // if(table._ip == 1){
              getInfo.UpdateUserData(
                userInfo1._id.toString(),
                {
                  $set: {
                    rejoinID: "",
                    rejoin: 0,
                    tableRemove: false,
                  },
                },
                function (upData2) {
                  leaveTableClass.LeaveTable(
                    {
                      flag: "disc",
                      eliminated: true,
                    },
                    {
                      id: id,
                      uid: userInfo1._id.toString(),
                      _ir: userInfo1.flags._ir,
                      si: si,
                      tbid: userInfo1.tbid,
                    }
                  );
                }
              );
            } else {
              getInfo.UpdateUserData(
                userInfo1._id.toString(),
                {
                  $set: {
                    rejoinID: "",
                    rejoin: 0,
                    tableRemove: false,
                  },
                },
                function (upData2) {
                  logger.info("Logout--------->>>>upData2.flags._ir: ", upData2.flags._ir, " si: ", si, " upData2: ", upData2.tbid);
                  leaveTableClass.LeaveTable(
                    {
                      flag: "disc",
                      eliminated: true,
                    },
                    {
                      id: id,
                      uid: upData2._id.toString(),
                      _ir: upData2.flags._ir,
                      si: si,
                      tbid: upData2.tbid,
                    }
                  );
                }
              );
            }
          } else {
            logger.info(
              'Logout---------->>>>msg:"table not found"'
            );
          }
        }
      );
    } else {
      logger.info("Logout----->>>standup fail");
    }
  });
};

module.exports = {
  AUCI,
  ReJoin,
  DailyBanner,
  onlineUsers,
  Logout,
  userRejoinTimer
};

const commonData = require("./commonData.class");
const commonClass = require("./common.class.js"); //common functions
const trackClass = require("./track.class");
const _ = require("underscore");
const getInfo = require("../common");
const robotsClass = require("./robots.class");
const roundClass = require("./round.class");
const jobTimerClass = require("./jobTimers.class");
const config = require("../config.json");
const turnClass = require("./turn.class");
const discardedCardsClass = require("./discardedCards.class");
const logger = require("../utils/logger");
const { getRedisInstances } = require("../connections/redis");
// const redlock = require("../connections/redLock");
const { decrement } = require("./redis.class");
// const { storeTableHistory } = require("../classes/gameHistory.class");
const { GetConfig } = require("../connections/mongodb");
const { removeStuckTable } = require("../common/stucktables.class");
const { cancelJob } = require("../scheduler/bullQueue");

// const winnerClass = require("./winner.class");
const LeaveTable = async (data, client, callback) => {
  // console.time("latency timer LeaveTable");

  try {
    //leave table
    /* +-------------------------------------------------------------------+
      desc:event to leave table
      i/p: data = {flag = flag for table,onInvite = true/false leave from table invite or not},client = socket object,callback = callback function
    +-------------------------------------------------------------------+ */
    logger.info(
      "leaveTable-------->>>>data: ",
      data,
      " client.tbid: " +
      client.tbid +
      " client.si: " +
      client.si +
      " client.id: " +
      client.id +
      " client._ir: " +
      client._ir
    );
    let scriptLeave=data?.scriptLeave?true:false;
    
    let freeSts = [
      "",
      "RoundTimerStarted",
      "winnerDeclared",
      "RematchTimerStarted" /*,"roundWinnerDeclared","dealWinnerDeclared"*/,
    ];

    let leaveReason = "back_to_lobby";
    let isStuck = false;
    const {
      ROUND_START_TIMER,
      ROUND_START_TIMER_POOL_SIX,
      ROUND_START_TIMER_POOL_TWO,
      ROUND_START_TIMER_POOL,
      ROUND_START_TIMER_DEAL_SIX,
      ROUND_START_TIMER_POINT_TWO,
      ROUND_START_TIMER_POINT_SIX,
      MAX_DEADWOOD_PTS,
      FIRST_DROP,
      MIDDLE_DROP,
      STUCK_TABLE_CHECK_TIME_IN_MINUT,
      ENABLE_REMOVE_STUCK_TABLE_FUNCTION
      
    } = GetConfig();
    const redisInstances = getRedisInstances();

    logger.info("------next-----.");
    if (data.flag) {
      switch (data.flag) {
        case "botc":
          leaveReason = "ftu_bot_change";
          break;
        case "lvlc":
          leaveReason = "user_score_change";
          break;
        case "noChips":
          leaveReason = "out_of_chips";
          break;
        case "auto":
          leaveReason = "booted_out";
          break;
        case "disc":
          leaveReason = "user_disconnected";
          break;
        case "lostPool":
          leaveReason = "pool_elimination";
          break;
        case "linkexp":
          leaveReason = "link expire";
          break;
        case "dealover":
          leaveReason = "deal_over";
          break;
        case "dealoversixloss":
          leaveReason = "deal_over";
          break;
        case "dealoversixwin":
          leaveReason = "deal_over";
          break;
        default:
          leaveReason = "exit";
      }
    }
    logger.info("flag------------>", data.flag);

    // client.tbid = client?.tbid ?? data?.tbid;
    // client.si = client?.si ?? data?.si;

    logger.info("leaveTable---1---redis issue: ", client.tbid);
    // lock = await redlock.acquire(`locks:${client.tbid.toString()}`, 5000);

    getInfo.UpdateTableData(
      client.tbid,
      { $set: { _isLeave: 1 } },
      async function (table) {
        if (table) {
          if (
            !data.eliminated &&
            (data.fromRematch === false ||
              typeof data.fromRematch == "undefined")
          ) {
            const lvt = await redisInstances.SET(
              `dropAndLeave:${client.tbid}`,
              1,
              {
                EX: 2,
                NX: true,
              }
            );
            logger.info("lvt----------------->", lvt);
            if (!lvt) {
              logger.info("in if---", "dropAndLeave");
              return false;
            }
          }
          //check whether user try to leave from stuck table or normal (if Timer1>100) then table is stuck
          let Timer1 = commonClass.GetTimeDifference(
            table.ctt,
            new Date(),
            "second"
          );
          let Timer2 = commonClass.GetTimeDifference(
            table.la,
            new Date(),
            "second"
          );
          if ((Timer1 > (STUCK_TABLE_CHECK_TIME_IN_MINUT*60)&&Timer2>(STUCK_TABLE_CHECK_TIME_IN_MINUT*60)) && ENABLE_REMOVE_STUCK_TABLE_FUNCTION) {
            isStuck = true;
            return removeStuckTable(table);
          }
          /* 
          const leaveTableFlag =
            table.gt == "Points"
              ? `leaveTable:${client.tbid}`
              : `leaveTable:${client.tbid}:${client.uid}`;
          const lvt = await redisInstances.SET(leaveTableFlag, 1, {
            EX: 5,
            NX: true,
          });
          logger.info("lvt----------------->", lvt);
          if (!lvt) {
            logger.info("in if---");
            return false;
          }
          */
          if (client._ir == 0) {
            let gameTypeRedis = table.gt;
            if (gameTypeRedis == "Pool") {
              gameTypeRedis = `${gameTypeRedis}${table.pt}`;
            }
            decrement(`${table.mode}:${gameTypeRedis}`);

            decrement(`${table.mode}:${gameTypeRedis}:${table.categoryId}`);
          }
          // decrement(`${table.mode}:${table.gt}`);
          // decrement(`${table.mode}:${table.gt}:${table.categoryId}`);
          let trobj = {
            tbid: client.tbid,
            uid: client.uid,
            rid: table.rid,
            tst: table.tst,
            s: "leave",
          };
          trackClass.Leave_Track(trobj);

          logger.info("leaveTable---3---redis issue: ", client.tbid);

          let { si } = client;
          let Timer = 10;
          logger.info("leaveTable----" + table._id + "---->>>>>si: ", si);
          logger.info("tst---------------->", table.tst);
          logger.info("Timer------------>", Timer);
          if (table.tst == "RoundTimerStarted") {
            let st = new Date();
            let rst;
            if (table.gt == "Pool") {
              rst = ROUND_START_TIMER;
              if (table.ms == 6) {
                rst = ROUND_START_TIMER_POOL_SIX;
              } else if (table.ms == 2) {
                rst = ROUND_START_TIMER_POOL_TWO;
              }

              if (table.round > 0) {
                rst = ROUND_START_TIMER_POOL;
              }
            } else if (table.gt == "Deal") {
              rst = ROUND_START_TIMER;
              if (table.ms == 6) {
                rst = ROUND_START_TIMER_DEAL_SIX;
              }
              if (table.round > 0) {
                rst = ROUND_START_TIMER_POOL;
              }
              logger.info("rst-----0------->", rst);
            } else {
              rst = ROUND_START_TIMER;
              if (table.ms == 6) {
                rst = ROUND_START_TIMER_POINT_SIX;
              } else if (table.ms == 2) {
                rst = ROUND_START_TIMER_POINT_TWO;
              }
            }

            if (table.addtime && table.ms == 2) {
              rst += config.CASHCUT_TIMER;
            }
            logger.info("rst------1------>", rst);
            logger.info("Timer-----1------->", Timer);
            Timer = parseInt(rst) - commonClass.GetTimeDifference(table.ctt, st, "second");
          }
          logger.info("Timer-----2------->", Timer);
          if (
            typeof si == "undefined" ||
            si == null ||
            _.isEmpty(table.pi[si]) ||
            table.pi[si].uid != client.uid
          ) {
            //means player is in standup mode
            logger.info("in if--------1----------------");
            logger.info(
              "leaveTable------if-" + table._id + "--->>>>table status: ",
              table.tst
            );

            getInfo.GetUserInfo(
              client.uid,
              { wc: 1, flags: 1, Chips: 1, lasts: 1, artifact: 1 },
              function (userInfo) {
                let winc =
                  typeof userInfo == "undefined" ||
                    userInfo == null ||
                    data.flag == "noChips"
                    ? 0
                    : userInfo.wc;
                let showRate =
                  userInfo.flags._isRated == 0 &&
                    typeof userInfo.lasts.lrpt != "undefined" &&
                    commonClass.GetTimeDifference(
                      userInfo.lasts.lrpt,
                      new Date(),
                      "day"
                    ) >= 1
                    ? true
                    : false;
                logger.info("winc------------?", winc);
                logger.info("leaveTable------------>>>>>>>>winc: " + winc);
                if (client._ir == 1) {
                  getInfo.UpdateUserData(client.uid, {
                    $set: {
                      tbid: "",
                      wc: 0,
                      s: "free",
                      "counters.opc": 0,
                      sck: "",
                    },
                  });
                } else {
                  if (
                    showRate ||
                    typeof userInfo.lasts.lrpt == "undefined" ||
                    userInfo.lasts.lrpt == null
                  ) {
                    userInfo.lasts.lrpt = new Date();
                  }
                  let upData = {
                    $set: {
                      tbid: "",
                      rejoinID: "",
                      rejoin: 0,
                      "lasts.lrpt": userInfo.lasts.lrpt,
                    },
                  };

                  if (data.flag != "switch") {
                    upData.$set.wc = 0;
                  }

                  getInfo.UpdateUserData(client.uid, upData);
                }
                let onInvite = data.onInvite ? data.onInvite : false;
                let dt = {
                  activePlayer: table.ap,
                  tableStats: table.tst,
                  mode: table.mode,
                  pointTable: table.pt,
                  leave: 1,
                  seatIndex: -1,
                  gameType: table.gt,
                  winc: winc,
                  showRate: showRate,
                  userId: client.uid,
                  id: client.id,
                  playTableId: table._id.toString(),
                  flag: data.flag ? data.flag : "",
                  onInvite: onInvite,
                };

                if (data.flag == "noChips") {
                  dt.reqChips =
                    table.gt == "Deal" || table.gt == "Pool"
                      ? table.bv
                      : table.bv * MAX_DEADWOOD_PTS;
                }

                let newStdP = table.stdP.filter(function (stData) {
                  if (stData.uid != client.uid) {
                    return stData;
                  }
                });
                logger.info(
                  "leaveTable-----" + table._id + "----->>>>>newStdP: ",
                  newStdP
                );
                logger.info("newStdP----------------->", newStdP);
                getInfo.UpdateTableData(
                  client.tbid,
                  { $set: { stdP: newStdP, _isLeave: 0 } },
                  async function () {
                    logger.info(
                      "leaveTable-----------" +
                      table._id +
                      "---------->>>>>>client._ir: ",
                      client._ir
                    );
                    // if (lock) await lock.unlock();
                    if (
                      client &&
                      typeof client._ir != "undefined" &&
                      client._ir != null &&
                      client._ir == 0
                    ) {
                      logger.info("leaveTable--------if------>>>>>>");
                      getInfo.UpdateUserData(client.uid, {
                        $set: { cAmount: false },
                      });
                      commonClass.SendDirect(
                        client.uid,
                        { en: "LeaveTable", data: dt },
                        true
                      ); //-1 to represent player as standup user

                      delete client.tbid;
                      delete client.si;
                      delete client.gt;
                    }

                    managePlayerOnLeave(
                      table._id.toString(),
                      -1,
                      true,
                      leaveReason,
                      client
                    );
                    if (typeof callback == "function") {
                      callback(1);
                    }
                  }
                );
              }
            );
          } else if (
            table.tst == "RoundTimerStarted" &&
            Timer <= 2 &&
            table.mode == "cash"
          ) {
            logger.info("in else if---------1---------------->");
            logger.info(
              "leaveTable----" +
              table._id +
              '------>>>>>>Msg: "player cannot leave table on round timer phase phase"'
            );
            getInfo.UpdateTableData(
              table._id.toString(),
              { $set: { _isLeave: 0 } },
              async function () {
                if (!isStuck) {
                  commonClass.SendData(client, "PopUp", {}, "error:1041");
                }
                // commonClass.SendData(client, "PopUp", {}, "error:1041"); //player can't leave table at cards dealing phase
                // if (lock) await lock.unlock();
                if (typeof callback == "function") {
                  // callback(0);
                  callback(isStuck ? 1 : 0);
                }
              }
            );
          } else if (table.tst == "CollectingBootValue") {
            logger.info("in else if---------2---------------->");
            logger.info(
              "leaveTable----" +
              table._id +
              '------>>>>>>Msg: "player cannot leave table on cards boot value collection phase"'
            );
            getInfo.UpdateTableData(
              table._id.toString(),
              { $set: { _isLeave: 0 } },
              async function () {
                if (!isStuck) {
                  commonClass.SendData(client, "PopUp", {}, "error:1041");
                }
                // commonClass.SendData(client, "PopUp", {}, "error:1041"); //player can't leave table at cards dealing phase
                // if (lock) await lock.unlock();
                if (typeof callback == "function") {
                  // callback(0);
                  callback(isStuck ? 1 : 0);
                }
              }
            );
          } else if (
            table.tst == "StartDealingCard" ||
            table.tst == "CardsDealt"
          ) {
            logger.info("in else if---------3--------------->");
            logger.info(
              "leaveTable----" +
              table._id +
              '------>>>>>>Msg: "player cannot leave table on cards dealing phase"'
            );
            getInfo.UpdateTableData(
              table._id.toString(),
              { $set: { _isLeave: 0 } },
              async function () {
                if (!isStuck) {
                  commonClass.SendData(client, "PopUp", {}, "error:1033");
                }
                // commonClass.SendData(client, "PopUp", {}, "error:1033"); //player can't leave table at cards dealing phase
                // if (lock) await lock.unlock();
                if (typeof callback == "function") {
                  // callback(0);
                  callback(isStuck ? 1 : 0);
                }
              }
            );
          } else if (
            (table.tst == "roundWinnerDeclared" && table.gt == "Deal") ||
            (table.tst == "roundWinnerDeclared" &&
              table.gt == "Pool" &&
              data.flag != "lostPool") ||
            ((table.tst == "" || table.tst == "RoundTimerStarted") &&
              table.gt == "Deal" &&
              table.round > 0) ||
            ((table.tst == "" || table.tst == "RoundTimerStarted") &&
              table.gt == "Pool" &&
              table.round > 0)
          ) {
            logger.info("in else if---------4--------------->");
            logger.info(
              "leaveTable-----" +
              table._id +
              '-------->>>>>>Msg: "player cannot leave table on roundWinnerDeclared"'
            );
            getInfo.UpdateTableData(
              table._id.toString(),
              { $set: { _isLeave: 0 } },
              async function () {
                // if (lock) await lock.unlock();

                // if (typeof data.stck == "undefined" || !data.stck) {
                //   commonClass.SendData(client, "LeaveTable", {
                //     ap: table.ap,
                //     mode: table.mode,
                //     pt: table.pt,
                //     si: si,
                //     leave: 0,
                //     gt: table.gt,
                //     uid: client.uid,
                //     id: client.id,
                //     tbid: table._id.toString(),
                //     flag: "",
                //   }); //player can't leave table at cards dealing phase
                // commonClass.SendData(client, "PopUp", {}, "error:1042");
                if (!isStuck) {
                  commonClass.SendData(client, "PopUp", {}, "error:1042");
                }
                // }
                if (typeof callback == "function") {
                  // callback(0);
                  callback(isStuck ? 1 : 0);
                }
              }
            );
          } else if (
            _.contains(freeSts, table.tst) ||
            table.pi[si].s == "" ||
            // table.pi[si].s == "watch" ||
            (table.pi[si].s == "drop" && table.gt == "Points")
          ) {
            logger.info("in else if---------5--------------->");

            //simply remove player if player leaves after drop cards as chips already cut during drop cards process
            logger.info(
              "leaveTable------" +
              table._id +
              "---->>>>table status: " +
              table.tst +
              " leaving user: " +
              table.pi[si].un
            );
            logger.info(
              "leaveTable-------" +
              table._id +
              "------->>>on Free status or not playing"
            );
            //simply remove player

            getInfo.GetUserInfo(
              table.pi[si].uid,
              {
                wc: 1,
                rlsAmount: 1,
                tbd: 1,
                flags: 1,
                Chips: 1,
                lasts: 1,
                artifact: 1,
              },
              async function (userInfo) {
                let winc =
                  typeof userInfo == "undefined" ||
                    userInfo == null ||
                    data.flag == "noChips"
                    ? 0
                    : userInfo.wc;
                let showRate =
                  userInfo.flags._isRated == 0 &&
                    typeof userInfo.lasts.lrpt != "undefined" &&
                    commonClass.GetTimeDifference(
                      userInfo.lasts.lrpt,
                      new Date(),
                      "day"
                    ) >= 1
                    ? true
                    : false;
                logger.info("leaveTable--------------->>>>>>>winc: " + winc);
                if (
                  (table.gt == "Pool" && !_.contains(freeSts, table.tst)) ||
                  table.pi[si].s == "drop"
                ) {
                  let wholewin = false;
                  if (table.gt == "Pool") {
                    wholewin = true;
                  }
                  logger.info("wholewin------------>", wholewin);
                  commonData.CountHands(
                    table.pi[si].uid,
                    "lost",
                    table.gt,
                    table.bv,
                    wholewin,
                    table.mode,
                    table._ip,
                    table.round,
                    function (thp, qstWin, hpc) { }
                  );
                }
                let upData = {
                  $set: { "pi.$": {}, _isLeave: 0 },
                  $inc: { ap: -1, start_totalap: -1, total_player_join: -1 },
                };
                let uChips = table.pi[si].upc;
                logger.info("uChips----------<>", uChips);
                let winchips = table.pi[si].winAmount;
                logger.info("winchips-----1-----<>", winchips);
                if (table.gt == "Pool") {
                  winchips = 0;
                }
                if (winchips > uChips) {
                  winchips = uChips;
                }
                logger.info("winchips----2------<>", winchips);

                if (table.mode == "cash") {
                  logger.info("table._id-------->", table._id, userInfo.tbd);
                  logger.info(
                    "v--------->",
                    table._id.toString() == userInfo.tbd
                  );
                  if (
                    uChips > 0 && 
                    ((userInfo.rlsAmount &&
                      table._id.toString() == userInfo.tbd) ||
                      userInfo.flags._ir == 1)
                  ) {
                    logger.info("-----------In if---------");
                    uChips = uChips - winchips;
                    logger.info("uChips-----2-----<>", uChips);
                    logger.info(
                      "table.pi[si].winAmount=====>",
                      table.pi[si].winAmount
                    );
                    if (uChips > 0) {
                      let tpp = "release remaining amount";
                      if (table.gt == "Pool" && table.pi[si].winAmount > 0) {
                        tpp = "Game Win";
                      }
                      logger.info("tpp--------------->", tpp);
                      let utc = await commonData.UpdateUserCash(
                        table.pi[si].uid,
                        uChips,
                        tpp,
                        table._id.toString(),
                        false,
                        false
                      );
                      logger.info("winchips------->", winchips);
                      if (typeof utc != "undefined") {
                        logger.info("---------%%%%%%%-------->");
                        if (winchips > 0) {
                          await commonData.UpdateUserCash(
                            table.pi[si].uid,
                            winchips,
                            "Game Win",
                            table._id.toString(),
                            false,
                            false
                          );
                        }
                      }
                    } else {
                      if (winchips > 0) {
                        await commonData.UpdateUserCash(
                          table.pi[si].uid,
                          winchips,
                          "Game Win",
                          table._id.toString(),
                          false,
                          false
                        );
                      }
                    }
                  }else if(uChips > 0 &&scriptLeave) {
                    logger.info("-----------In if---------");
                    uChips = uChips - winchips;
                    logger.info("uChips-----2-----<>", uChips);
                    logger.info(
                      "table.pi[si].winAmount=====>",
                      table.pi[si].winAmount
                    );
                    if (uChips > 0) {
                      let tpp = "release remaining amount";
                      if (table.gt == "Pool" && table.pi[si].winAmount > 0) {
                        tpp = "Game Win";
                      }
                      logger.info("tpp--------------->", tpp);
                      let utc = await commonData.UpdateUserCash(
                        table.pi[si].uid,
                        uChips,
                        tpp,
                        table._id.toString(),
                        false,
                        false
                      );
                      logger.info("winchips------->", winchips);
                      if (typeof utc != "undefined") {
                        logger.info("---------%%%%%%%-------->");
                        if (winchips > 0) {
                          await commonData.UpdateUserCash(
                            table.pi[si].uid,
                            winchips,
                            "Game Win",
                            table._id.toString(),
                            false,
                            false
                          );
                        }
                      }
                    } else {
                      if (winchips > 0) {
                        await commonData.UpdateUserCash(
                          table.pi[si].uid,
                          winchips,
                          "Game Win",
                          table._id.toString(),
                          false,
                          false
                        );
                      }
                    }
                  }
                   else {
                    logger.info("else----------->");

                    logger.info(
                      "leaveTable----------->>>>> no need to release amount as it is released already ou uChips is 0"
                    );

                    getInfo.UpdateUserData(client.uid, {
                      $set: { cAmount: false },
                    });

                    /*  commonData.UpdateUserCash(
                         table.pi[si].uid,
                         uChips,
                         "release remaining amount",
                         table._id.toString(),
                         false,
                         true
                       );
                       getInfo.UpdateUserData(client.uid, {
                         $set: { cAmount: false },
                       });
                       logger.info(
                         "leaveTable----------->>>>> no need to release amount as it is released already ou uChips is 0"
                       ); */
                  }
                } else {
                  if (uChips > 0) {
                    uChips = uChips - winchips;
                    if (uChips > 0) {
                      let tpp = "release remaining amount";
                      if (table.gt == "Pool") {
                        tpp = "Game Win";
                      }
                      commonData.UpdateUserChips(
                        table.pi[si].uid,
                        uChips,
                        tpp,
                        function (utc) {
                          if (typeof utc != "undefined") {
                            if (winchips > 0) {
                              commonData.UpdateUserChips(
                                table.pi[si].uid,
                                winchips,
                                "Game Win",
                                function (uChips) { }
                              );
                            }
                          }
                        }
                      );
                    } else {
                      if (winchips > 0) {
                        commonData.UpdateUserChips(
                          table.pi[si].uid,
                          winchips,
                          "Game Win",
                          function (uChips) { }
                        );
                      }
                    }
                  }
                }
                if (
                  table.gt === "Deal" &&
                  table.tst === "RematchTimerStarted"
                ) {
                  getInfo.UpdateUserData(client.uid, {
                    $set: { cAmount: false, rlsAmount: false },
                  });
                }
                if (table.pi[si]._ir == 1) {
                  logger.info("i-----if-------");
                  getInfo.UpdateUserData(table.pi[si].uid, {
                    $set: {
                      tbid: "",
                      wc: 0,
                      s: "free",
                      "counters.opc": 0,
                      sck: "",
                    },
                  });
                } else {
                  if (
                    showRate ||
                    typeof userInfo.lasts.lrpt == "undefined" ||
                    userInfo.lasts.lrpt == null
                  ) {
                    userInfo.lasts.lrpt = new Date();
                  }
                  let upData1 = {
                    $set: {
                      tbid: "",
                      wc: 0,
                      rejoinID: "",
                      rejoin: 0,
                      cAmount: false,
                      "lasts.lrpt": userInfo.lasts.lrpt,
                    },
                  };

                  getInfo.UpdateUserData(table.pi[si].uid, upData1);
                  upData.$inc.uCount = -1;
                }
                logger.info(
                  "leaveTable----->>>>table._id: ",
                  table._id,
                  " si: ",
                  si
                );
                let onInvite = data.onInvite ? data.onInvite : false;
                let dt;
                if (data.flag) {
                  dt = {
                    leave: 1,
                    si: si,
                    mode: table.mode,
                    tst: table.tst,
                    gt: table.gt,
                    pt: table.pt,
                    winc: winc,
                    showRate: showRate,
                    uid: table.pi[si].uid,
                    id: client.id,
                    tbid: table._id.toString(),
                    flag: data.flag,
                    onInvite: onInvite,
                  };
                  if (data.flag == "noChips") {
                    //send out of chips with required chips
                    dt.reqChips =
                      table.gt == "Deal" || table.gt == "Pool"
                        ? table.bv
                        : table.bv * MAX_DEADWOOD_PTS;
                  }
                } else {
                  dt = {
                    leave: 1,
                    si: si,
                    mode: table.mode,
                    tst: table.tst,
                    gt: table.gt,
                    pt: table.pt,
                    winc: winc,
                    showRate: showRate,
                    uid: table.pi[si].uid,
                    id: client.id,
                    tbid: table._id.toString(),
                    flag: "",
                    onInvite: onInvite,
                  };
                }

                if (dt.flag == "" && table.hist.length > 0 && client.uid) {
                  let tempPlayerData = table.pi[si];
                  tempPlayerData.s = "left";

                  for (const iterator of table.hist) {
                    if (iterator.uid == client.uid) {
                      await db.collection("playing_table").updateOne(
                        {
                          _id: getInfo.MongoID(table._id.toString()),
                          "hist.uid": client.uid,
                        },
                        { $set: { "hist.$": tempPlayerData } },
                        { new: true }
                      );
                    }
                  }
                }

                logger.info(
                  "leaveTable--------->>>>>upData: ",
                  upData,
                  " table._id: " +
                  table._id +
                  " type table._id: " +
                  typeof table._id +
                  " si: " +
                  si
                );
                if (table.fromRematch) {
                  upData.$set.fromRematch = false;
                  upData.$set.oldTableId = "";
                  upData.$set.fromRematchAP = 0;
                }
                db.collection("playing_table").findAndModify(
                  { _id: table._id, "pi.si": si },
                  {},
                  upData,
                  { new: true },
                  async function (err, table1) {
                    // if (lock) await lock.unlock();
                    if (table1 && table1.value) {
                      logger.info(
                        "leaveTable-------------->>>>>table1.value: ",
                        table1.value
                      );

                      dt.ap = table1.value.ap;
                      if (!data?.playAgainScreen)
                        if (typeof data.stck == "undefined" || !data.stck) {
                          commonClass.FireEventToTable(
                            table1.value._id.toString(),
                            { en: "LeaveTable", data: dt }
                          );
                          // storeTableHistory({
                          //   tableId: table1.value._id.toString(),
                          //   eventName: "LeaveTable",
                          //   tableData: table1.value,
                          //   userIndex: si
                          // });

                          if (
                            ((table.tst == "" ||
                              table.tst == "RoundTimerStarted") &&
                              table.round == 0) ||
                            ((table.tst == "" ||
                              table.tst == "RoundTimerStarted") &&
                              table.gt == "Points")
                          ) {
                            commonClass.fireEventToAll({
                              en: "JoiningUsers",
                              data: {
                                joinedPlayers: (table.ap - 1).toString(),
                                _id: table.categoryId.toString(),
                                playerCount: table.ms,
                              },
                            });
                          }
                        }

                      delete client.tbid;
                      delete client.si;
                      delete client.gt;
                      logger.info("leaveReason---------->", leaveReason);

                      managePlayerOnLeave(
                        table1.value._id.toString(),
                        si,
                        true,
                        leaveReason,
                        client
                      );
                      if (typeof callback == "function") {
                        callback(1);
                      }
                    } else {
                      logger.info(
                        "leaveTable:::free sts::::" +
                        table._id +
                        "::::si: " +
                        si +
                        "::::upData: ",
                        upData,
                        "::::err: ",
                        err,
                        '::::Error: "table not found" ' + new Date()
                      );
                    }
                  }
                );
              }
            );
          } else if (table.tst == "Finished") {
            logger.info("in else if---------6--------------->");

            getInfo.UpdateTableData(
              table._id.toString(),
              { $set: { _isLeave: 0 } },
              async function () {
                // if (lock) await lock.unlock();

                if (data.flag == "switch") {
                  data.flag = data.flag;
                } else {
                  data.flag = "fns";
                }
                if (typeof data.stck == "undefined" || !data.stck) {
                  commonClass.SendDirect(
                    client.uid,
                    {
                      en: "LeaveTable",
                      data: {
                        ap: table.ap,
                        mode: table.mode,
                        tst: table.tst,
                        pt: table.pt,
                        leave: 0,
                        si: -1,
                        gt: table.gt,
                        winc: 0,
                        uid: client.uid,
                        id: client.id,
                        tbid: client.tbid,
                        flag: data.flag,
                      },
                    },
                    true
                  );
                  if (!isStuck) {
                    commonClass.SendData(client, "PopUp", {}, "error:1037");
                  }
                  // commonClass.SendData(client, "PopUp", {}, "error:1037");
                }
                if (typeof callback == "function") {
                  // callback(0);
                  callback(isStuck ? 1 : 0);
                }
              }
            );
          } else if (table.gt == "Deal") {
            logger.info("in else if---------7--------------->");

            logger.info(
              "leaveTable-------" + table._id + "----Deal--->>>>table status: ",
              table.tst,
              " leaving user: ",
              table.pi[si].un
            );

            logger.info(
              "leaveTable----------" +
              table._id +
              "------Deal------>>>>on running game"
            );

            getInfo.GetUserInfo(
              table.pi[si].uid,
              {
                wc: 1,
                rlsAmount: 1,
                tbd: 1,
                flags: 1,
                Chips: 1,
                lasts: 1,
                artifact: 1,
              },
              function (userInfo) {
                var winc =
                  typeof userInfo == "undefined" ||
                    userInfo == null ||
                    data.flag == "noChips"
                    ? 0
                    : userInfo.wc;
                var showRate =
                  userInfo.flags._isRated == 0 &&
                    typeof userInfo.lasts.lrpt != "undefined" &&
                    commonClass.GetTimeDifference(
                      userInfo.lasts.lrpt,
                      new Date(),
                      "day"
                    ) >= 1
                    ? true
                    : false;
                logger.info("leaveTable----------->>>>winc: " + winc);

                commonData.CountHands(
                  table.pi[si].uid,
                  "lost",
                  table.gt,
                  table.bv,
                  true,
                  table.mode,
                  table._ip,
                  table.round,
                  async function (thp, qstWin, hpc) {
                    var uChips = table.pi[si].upc;
                    // var winchips = table.pi[si].winAmount;
                    var winchips = 0;

                    if (table.mode == "cash") {
                      if (
                        uChips > 0 &&
                        ((userInfo.rlsAmount &&
                          table._id.toString() == userInfo.tbd) ||
                          userInfo.flags._ir == 1)
                      ) {
                        uChips = uChips - winchips;
                        if (uChips > 0) {
                          var utc = await commonData.UpdateUserCash(
                            table.pi[si].uid,
                            uChips,
                            "Game Win",
                            table._id.toString(),
                            false,
                            false
                          );
                          if (typeof utc != "undefined") {
                            if (winchips > 0) {
                              await commonData.UpdateUserCash(
                                table.pi[si].uid,
                                winchips,
                                "Game Win",
                                table._id.toString(),
                                false,
                                false
                              );
                            }
                          }
                          // })
                        } else {
                          if (winchips > 0) {
                            await commonData.UpdateUserCash(
                              table.pi[si].uid,
                              winchips,
                              "Game Win",
                              table._id.toString(),
                              false,
                              false
                            );
                          }
                        }
                      } else {
                        logger.info(
                          "leaveTable----------->>>>> no need to release amount as it is released already ou uChips is 0"
                        );
                        getInfo.UpdateUserData(client.uid, {
                          $set: { cAmount: false },
                        });
                      }
                    } else {
                      if (uChips > 0) {
                        uChips = uChips - winchips;
                        if (uChips > 0) {
                          commonData.UpdateUserChips(
                            table.pi[si].uid,
                            uChips,
                            "Game Win",
                            function (uts) {
                              if (typeof uts != "undefined") {
                                if (winchips > 0) {
                                  commonData.UpdateUserChips(
                                    table.pi[si].uid,
                                    winchips,
                                    "Game Win",
                                    function (uChips) { }
                                  );
                                }
                              }
                            }
                          );
                        } else {
                          if (winchips > 0) {
                            commonData.UpdateUserChips(
                              table.pi[si].uid,
                              winchips,
                              "Game Win",
                              function (uChips) { }
                            );
                          }
                        }
                      }
                    }

                    var upData = {
                      $set: { "pi.$": {}, _isLeave: 0 },
                      $inc: { ap: -1 },
                    };
                    if (table.pi[si]._ir == 1) {
                      getInfo.UpdateUserData(table.pi[si].uid, {
                        $set: {
                          tbid: "",
                          wc: 0,
                          s: "free",
                          "counters.opc": 0,
                          sck: "",
                        },
                      });
                    } else {
                      if (
                        showRate ||
                        typeof userInfo.lasts.lrpt == "undefined" ||
                        userInfo.lasts.lrpt == null
                      ) {
                        userInfo.lasts.lrpt = new Date();
                      }

                      var upData1 = {
                        $set: {
                          tbid: "",
                          rejoinID: "",
                          rejoin: 0,
                          cAmount: false,
                          "lasts.lrpt": userInfo.lasts.lrpt,
                        },
                      };

                      if (data.flag != "switch") {
                        upData1.$set.wc = 0;
                      }

                      getInfo.UpdateUserData(table.pi[si].uid, upData1);

                      upData.$inc.uCount = -1;
                    }

                    var onInvite = data.onInvite ? data.onInvite : false;
                    if (data.flag) {
                      var dt = {
                        leave: 1,
                        si: si,
                        gt: table.gt,
                        mode: table.mode,
                        tst: table.tst,
                        pt: table.pt,
                        winc: winc,
                        showRate: showRate,
                        uid: table.pi[si].uid,
                        id: client.id,
                        tbid: table._id.toString(),
                        flag: data.flag,
                        onInvite: onInvite,
                      };

                      if (data.flag == "noChips") {
                        dt.reqChips = table.bv;
                      }
                    } else {
                      var dt = {
                        leave: 1,
                        si: si,
                        tst: table.tst,
                        mode: table.mode,
                        gt: table.gt,
                        pt: table.pt,
                        winc: winc,
                        showRate: showRate,
                        uid: table.pi[si].uid,
                        id: client.id,
                        tbid: table._id.toString(),
                        flag: "",
                        onInvite: onInvite,
                      };
                    }

                    if (table.pi[si].s == "playing") {
                      upData["$inc"].playCount = -1;
                    }

                    var tempPlayerData = table.pi[si];
                    tempPlayerData.s = "left";
                    var ctth = "";
                    if (table.pi[si].cards.length > 13) {
                      //user has more than 13 cards means he has picked a card
                      ctth = table.pi[si].cards.pop();
                      upData["$push"] = { oDeck: ctth };
                    }
                    tempPlayerData.cards = table.pi[si].cards;
                    // tempPlayerData.gCards = {
                    //   pure: [],
                    //   seq: [],
                    //   set: [],
                    //   dwd: table.pi[si].cards,
                    // };
                    tempPlayerData.dCards = table.pi[si].gCards;
                    // tempPlayerData.dCards = {
                    //   pure: [],
                    //   seq: [],
                    //   set: [],
                    //   dwd: table.pi[si].cards,
                    // };
                    tempPlayerData.tScore = -0;
                    tempPlayerData.ps = 0;
                    tempPlayerData.dps = 0;
                    tempPlayerData._iw = 0;
                    tempPlayerData.gedt = new Date();
                    tempPlayerData.tdps =
                      tempPlayerData.tdps - tempPlayerData.ps;
                    var players = getInfo.getPlayingUserInRound(table.pi, true);
                    logger.info(
                      "leaveTable---------------->>>>>>>>>>>>>>>players.length:",
                      players.length
                    );
                    if (table.hist.length != 0) {
                      for (const iterator of table.hist) {
                        if (iterator.uid == table.pi[si].uid) {
                          await db.collection("playing_table").updateOne(
                            {
                              _id: getInfo.MongoID(table._id.toString()),
                              "hist.uid": table.pi[si].uid,
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
                    upData["$inc"].tpr = tempPlayerData.ps;
                    if (client.uid == table.tci) {
                      var nextTurn = getNextPlayerPr(table);
                      logger.info(
                        "leaveTable---------------->>>>>>>>>>>>>>>nextTurn: ",
                        nextTurn
                      );
                      if (
                        typeof nextTurn != "undefined" ||
                        nextTurn != null ||
                        typeof nextTurn.nxt != "undefined"
                      ) {
                        upData["$set"].tci = table.pi[nextTurn.nxt].uid;
                      } else {
                        upData["$set"].tci = "";
                      }
                    }
                    db.collection("playing_table").findAndModify(
                      { _id: table._id, "pi.si": si },
                      {},
                      upData,
                      { new: true },
                      async function (err, table1) {
                        if (err) {
                          logger.info(
                            "leaveTable::::si: " + si + ":::::",
                            table._id,
                            ":::::::upData: ",
                            upData,
                            ":::err: ",
                            err,
                            ':::>>>>>Error: "user not found"' + new Date()
                          );
                        }

                        if (!table1 || !table1.value) {
                          logger.info(
                            "leaveTable----si: " + si + "-----",
                            table._id,
                            "-------upData: ",
                            upData,
                            '------>>>>>Error: "user not found"' + new Date()
                          );
                          return false;
                        }

                        if (ctth != "") {
                          commonClass.FireEventToTable(
                            table1.value._id.toString(),
                            {
                              en: "ThrowCard",
                              data: {
                                si: si,
                                uid: table.pi[si].uid,
                                time: table.pi[si].secTime,
                                card: ctth,
                                bbv: table1.value.bbv,
                                finish: false,
                                cdd: true,
                              },
                            }
                          );
                          discardedCardsClass.DiscardedCards(
                            {},
                            { tbid: table1.value._id.toString() }
                          );
                        }
                        dt.ap = table1.value.ap;
                        if (typeof data.stck == "undefined" || !data.stck) {
                          commonClass.FireEventToTable(
                            table1.value._id.toString(),
                            { en: "LeaveTable", data: dt }
                          );

                          // storeTableHistory({
                          //   tableId: table1.value._id.toString(),
                          //   eventName: "LeaveTable",
                          //   tableData: table1.value,
                          //   userIndex: si
                          // });
                        }

                        delete client.tbid;
                        delete client.si;
                        delete client.gt;
                        // if (lock) await lock.unlock();
                        if (data.flag != "noChips") {
                          managePlayerOnLeave(
                            table1.value._id.toString(),
                            si,
                            true,
                            leaveReason,
                            client
                          );
                        }
                        if (typeof callback == "function") {
                          callback(1);
                        }
                      }
                    );
                  }
                );
              }
            );
          } else if (table.gt == "Pool") {
            logger.info("in else if---------8--------------->");
            logger.info("hist------------->", table.hist);
            logger.info(
              "leaveTable-------" + table._id + "----Pool--->>>>table status: ",
              table.tst,
              " leaving user: ",
              table.pi[si].un
            );

            logger.info(
              "leaveTable----------" +
              table._id +
              "------Pool------>>>>on running game/end of game"
            );

            //find table

            getInfo.GetUserInfo(
              table.pi[si].uid,
              {
                wc: 1,
                rlsAmount: 1,
                tbd: 1,
                flags: 1,
                Chips: 1,
                lasts: 1,
                artifact: 1,
                sck: 1,
              },
              function (userInfo) {
                logger.info("userInfo----------->", userInfo);
                var winc =
                  typeof userInfo == "undefined" ||
                    userInfo == null ||
                    data.flag == "noChips"
                    ? 0
                    : userInfo.wc;
                var showRate =
                  userInfo.flags._isRated == 0 &&
                    typeof userInfo.lasts.lrpt != "undefined" &&
                    commonClass.GetTimeDifference(
                      userInfo.lasts.lrpt,
                      new Date(),
                      "day"
                    ) >= 1
                    ? true
                    : false;
                logger.info(
                  "leaveTable-----" + table._id + "------>>>>winc: " + winc
                );

                commonData.CountHands(
                  table.pi[si].uid,
                  "lost",
                  table.gt,
                  table.bv,
                  true,
                  table.mode,
                  table._ip,
                  table.round,
                  async function (thp, qstWin, hpc) {
                    let uChips = table.pi[si].upc;
                    // let winchips = table.pi[si].winAmount;
                    let winchips = 0;
                    logger.info(
                      "leaveTable-----" +
                      table._id +
                      "------>>>after count hands uChips : " +
                      uChips
                    );
                    if (table.mode == "cash") {
                      if (
                        uChips > 0 &&
                        ((userInfo.rlsAmount &&
                          table._id.toString() == userInfo.tbd) ||
                          userInfo.flags._ir == 1)
                      ) {
                        uChips = uChips - winchips;
                        logger.info("winchips----------->", winchips);
                        logger.info("uChips--------------->", uChips);
                        if (uChips > 0) {
                          var utc = await commonData.UpdateUserCash(
                            table.pi[si].uid,
                            uChips,
                            "Game Win",
                            table._id.toString(),
                            false,
                            false
                          );
                          if (typeof utc != "undefined") {
                            if (winchips > 0) {
                              await commonData.UpdateUserCash(
                                table.pi[si].uid,
                                winchips,
                                "Game Win",
                                table._id.toString(),
                                false,
                                false
                              );
                            }
                          }
                          // })
                        } else {
                          if (winchips > 0) {
                            await commonData.UpdateUserCash(
                              table.pi[si].uid,
                              winchips,
                              "Game Win",
                              table._id.toString(),
                              false,
                              false
                            );
                          }
                        }
                      } else {
                        logger.info(
                          "leaveTable----------->>>>> no need to release amount as it is released already ou uChips is 0"
                        );
                        getInfo.UpdateUserData(client.uid, {
                          $set: { cAmount: false },
                        });
                      }
                    } else {
                      if (uChips > 0) {
                        uChips = uChips - winchips;
                        if (uChips > 0) {
                          commonData.UpdateUserChips(
                            table.pi[si].uid,
                            uChips,
                            "Game Win",
                            function (uts) {
                              if (typeof uts != "undefined") {
                                if (winchips > 0) {
                                  commonData.UpdateUserChips(
                                    table.pi[si].uid,
                                    winchips,
                                    "Game Win",
                                    function (uChips) { }
                                  );
                                }
                              }
                            }
                          );
                        } else {
                          if (winchips > 0) {
                            commonData.UpdateUserChips(
                              table.pi[si].uid,
                              winchips,
                              "Game Win",
                              function (uChips) { }
                            );
                          }
                        }
                      }
                    }

                    let upData = {
                      $set: { "pi.$": {}, _isLeave: 0 },
                      $inc: { ap: -1 },
                    };
                    if (table.pi[si]._ir == 1) {
                      getInfo.UpdateUserData(table.pi[si].uid, {
                        $set: {
                          tbid: "",
                          wc: 0,
                          s: "free",
                          "counters.opc": 0,
                          sck: "",
                        },
                      });
                    } else {
                      if (
                        showRate ||
                        typeof userInfo.lasts.lrpt == "undefined" ||
                        userInfo.lasts.lrpt == null
                      ) {
                        userInfo.lasts.lrpt = new Date();
                      }

                      let upData1 = {
                        $set: {
                          tbid: "",
                          rejoinID: "",
                          rejoin: 0,
                          cAmount: false,
                          "lasts.lrpt": userInfo.lasts.lrpt,
                        },
                      };

                      if (data.flag != "switch") {
                        upData1.$set.wc = 0;
                      }

                      getInfo.UpdateUserData(table.pi[si].uid, upData1);
                      upData.$inc.uCount = -1;
                    }
                    let onInvite = data.onInvite ? data.onInvite : false;
                    let dt = {};
                    let single = "";
                    if (
                      userInfo &&
                      typeof userInfo.sck == "string" &&
                      userInfo.sck != ""
                    ) {
                      single = userInfo.sck.replace(/s\d*_\d*./i, "");
                    }
                    if (data.flag) {
                      // eval('var dt = {leave:1,si:si,winc:winc,uid:table.pi[si].uid,id:client.id,tbid:table._id.toString(),'+data.flag+':1}')
                      dt = {
                        leave: 1,
                        si: si,
                        tst: table.tst,
                        mode: table.mode,
                        gt: table.gt,
                        pt: table.pt,
                        winc: winc,
                        showRate: showRate,
                        uid: table.pi[si].uid,
                        id: single,
                        tbid: table._id.toString(),
                        flag: data.flag,
                        onInvite: onInvite,
                      };

                      if (data.flag == "noChips") {
                        dt.reqChips = table.bv;
                      }
                    } else {
                      dt = {
                        leave: 1,
                        si: si,
                        tst: table.tst,
                        mode: table.mode,
                        gt: table.gt,
                        pt: table.pt,
                        winc: winc,
                        showRate: showRate,
                        uid: table.pi[si].uid,
                        id: single,
                        tbid: table._id.toString(),
                        flag: "",
                        onInvite: onInvite,
                      };
                    }
                    if (table.pi[si].s == "playing") {
                      upData["$inc"].playCount = -1;
                    }

                    let tempPlayerData = table.pi[si];
                    tempPlayerData.s = "left";
                    let ctth = "";
                    if (table.pi[si].cards.length > 13) {
                      //user has more than 13 cards means he has picked a card
                      ctth = table.pi[si].cards.pop();
                      upData["$push"] = { oDeck: ctth };
                    }
                    tempPlayerData.cards = table.pi[si].cards;
                    // tempPlayerData.gCards = [table.pi[si].cards];
                    // tempPlayerData.gCards = {
                    //   pure: [],
                    //   seq: [],
                    //   set: [],
                    //   dwd: table.pi[si].cards,
                    // };
                    tempPlayerData.dCards = table.pi[si].gCards;
                    // tempPlayerData.dCards = {
                    //   pure: [],
                    //   seq: [],
                    //   set: [],
                    //   dwd: table.pi[si].cards,
                    // };
                    tempPlayerData.ps = table.pt;
                    if (data.flag != "lostPool") {
                      //if lostPool then no need direct show original dps
                      tempPlayerData.dps = table.pt;
                    }
                    tempPlayerData._iw = 0;
                    tempPlayerData.gedt = new Date();
                    tempPlayerData.wc = -table.bv;
                    // upData["$addToSet"] = { hist: tempPlayerData };
                    logger.info("table.pi[si].uid--------->", table.pi[si].uid);
                    logger.info(
                      "table.hist.length---------->",
                      table.hist.length
                    );
                    if (table.hist.length != 0) {
                      for (const iterator of table.hist) {
                        logger.info("iterator----->", iterator);
                        logger.info(
                          "iterator.uid == table.pi[si].uid------>",
                          iterator.uid == table.pi[si].uid
                        );
                        logger.info("type--", typeof iterator.uid);
                        logger.info("type-------->", typeof table.pi[si].uid);
                        if (iterator.uid == table.pi[si].uid) {
                          logger.info("in if----");
                          await db.collection("playing_table").updateOne(
                            {
                              _id: getInfo.MongoID(table._id.toString()),
                              "hist.uid": table.pi[si].uid,
                            },
                            { $set: { "hist.$": tempPlayerData } },
                            { new: true }
                          );
                        } else {
                          logger.info("in else");
                          upData["$addToSet"] = { hist: tempPlayerData };
                        }
                      }
                    } else {
                      upData["$addToSet"] = { hist: tempPlayerData };
                    }

                    if (client.uid.toString() == table.tci) {
                      let nextTurn = getNextPlayerPr(table);
                      logger.info(
                        "leaveTable---------------->>>>>>>>>>>>>>>nextTurn: ",
                        nextTurn
                      );
                      if (
                        typeof nextTurn != "undefined" ||
                        nextTurn != null ||
                        typeof nextTurn.nxt != "undefined"
                      ) {
                        upData["$set"].tci = table.pi[nextTurn.nxt].uid;
                      } else {
                        upData["$set"].tci = "";
                      }
                    }
                    logger.info("upData0----------->", upData);

                    db.collection("playing_table").findAndModify (
                      { _id: table._id, "pi.si": si },
                      {},
                      upData,
                      { new: true },
                      async function (err, table1) {
                        if (err) {
                          logger.info(
                            "leaveTable-------" +
                            table._id +
                            "---si: " +
                            si +
                            "----upData: ",
                            upData,
                            "------->>>>>Error: ",
                            err,
                            " " + new Date()
                          );
                        }
                        logger.info("table1--------------->", table1);
                        if (!table1 || !table1.value) {
                          logger.info(
                            "leaveTable-------" +
                            table._id +
                            "---si: " +
                            si +
                            "----upData: ",
                            upData,
                            '------->>>>>Error: "user not found"' + new Date()
                          );
                          return false;
                        }

                        if (ctth != "") {
                          commonClass.FireEventToTable(
                            table1.value._id.toString(),
                            {
                              en: "ThrowCard",
                              data: {
                                si: si,
                                uid: table.pi[si].uid,
                                time: table.pi[si].secTime,
                                card: ctth,
                                bbv: table1.value.bbv,
                                finish: false,
                                cdd: true,
                              },
                            }
                          );
                          discardedCardsClass.DiscardedCards(
                            {},
                            { tbid: table1.value._id.toString() }
                          );
                        }
                        dt.ap = table1.value.ap;
                        if (typeof data.stck == "undefined" || !data.stck) {
                          commonClass.FireEventToTable(
                            table1.value._id.toString(),
                            { en: "LeaveTable", data: dt }
                          );
                          // storeTableHistory({
                          //   tableId: table1.value._id.toString(),
                          //   eventName: "LeaveTable",
                          //   tableData: table1.value,
                          //   userIndex: si
                          // });
                        }

                        delete client.tbid;
                        delete client.si;
                        delete client.gt;
                        // if (lock) await lock.unlock();
                        if (data.flag != "lostPool" && data.flag != "noChips") {
                          managePlayerOnLeave(
                            table1.value._id.toString(),
                            si,
                            true,
                            leaveReason,
                            client
                          );
                        } else if (
                          data.flag == "lostPool" &&
                          table1.value.tst == "RoundStarted"
                        ) {
                          //incase player left due to lost pool
                          logger.info(
                            "leaveTable-----" +
                            table1.value._id.toString() +
                            "------>>>goining in manage player on leave : "
                          );

                          managePlayerOnLeave(
                            table1.value._id.toString(),
                            si,
                            true,
                            leaveReason,
                            client
                          );
                        } else {
                          logger.info(
                            'leaveTable::::::::::::::::"Anonymous case"'
                          );
                        }
                        if (typeof callback == "function") {
                          logger.info(
                            "leaveTable::::::::" +
                            table1.value._id.toString() +
                            '::::::::"callback"'
                          );
                          callback(1);
                        }
                      }
                    );
                  }
                );
              }
            );
          } else {
            logger.info("in else -------------------> Leave Table");
            logger.info("table---------------->", table.hist);
            //remove with full chips cut
            logger.info(
              "leaveTable-------" + table._id + "------->>>>table status: ",
              table.tst,
              " leaving user:  Leave Table",
              table.pi[si].un
            );

            logger.info(
              "leaveTable----------" +
              table._id +
              "------------>>>>on running game  Leave Table"
            );
            let pvv = table.bv * MAX_DEADWOOD_PTS;
            let cutChips = 0;
            let pts = 0;
            let chp = pvv - cutChips;
            logger.info("pvv------------>  Leave Table", pvv, chp);
            if (table.pi[si].pickCount == 0) {
              cutChips = MAX_DEADWOOD_PTS * table.bv * FIRST_DROP; //25% will be deducted if leave without picking any cards i.e First Leave
              chp = pvv - cutChips;
              pts = MAX_DEADWOOD_PTS * FIRST_DROP;
            } else {
              cutChips = MAX_DEADWOOD_PTS * table.bv * MIDDLE_DROP; //50% will be deducted if leave after picking any cards i.e Middle Leave
              chp = pvv - cutChips;
              pts = MAX_DEADWOOD_PTS * MIDDLE_DROP;
            }

            if (data.flag == "auto") {
              cutChips = MAX_DEADWOOD_PTS * table.bv * MIDDLE_DROP; //50% will be deducted if leave after picking any cards i.e Middle Leave
              chp = pvv - cutChips;
              pts = MAX_DEADWOOD_PTS * MIDDLE_DROP;
            }

            logger.info(
              "leaveTable--------" +
              table._id +
              "---------->>>cutChips:  Leave Table",
              cutChips
            );

            if (table.mode == "practice") {
              commonData.UpdateCashForPlayInTable(
                table._id,
                table.pi[si].uid,
                chp,
                "Table Leave Deduction",
                function (uChips) {
                  if (typeof uChips != "undefined") {
                    getInfo.GetUserInfo(
                      table.pi[si].uid,
                      { wc: 1, flags: 1, Chips: 1, lasts: 1, artifact: 1 },
                      function (userInfo) {
                        let winc =
                          typeof userInfo == "undefined" ||
                            userInfo == null ||
                            data.flag == "noChips"
                            ? 0
                            : userInfo.wc;
                        let showRate =
                          userInfo.flags._isRated == 0 &&
                            typeof userInfo.lasts.lrpt != "undefined" &&
                            commonClass.GetTimeDifference(
                              userInfo.lasts.lrpt,
                              new Date(),
                              "day"
                            ) >= 1
                            ? true
                            : false;
                        logger.info("leaveTable---------->>>>winc: " + winc);

                        commonData.CountHands(
                          table.pi[si].uid,
                          "lost",
                          table.gt,
                          table.bv,
                          false,
                          table.mode,
                          table._ip,
                          table.round,
                          function (thp, qstWin) {
                            let winchips = table.pi[si].winAmount;
                            if (winchips > uChips) {
                              winchips = uChips;
                            }
                            if (uChips > 0) {
                              uChips = uChips - winchips;
                              if (uChips > 0) {
                                commonData.UpdateUserChips(
                                  table.pi[si].uid,
                                  uChips,
                                  "release remaining amount",
                                  function (uts) {
                                    if (typeof uts != "undefined") {
                                      if (winchips > 0) {
                                        commonData.UpdateUserChips(
                                          table.pi[si].uid,
                                          uChips,
                                          "add win amount",
                                          function (uChips) { }
                                        );
                                      }
                                    }
                                  }
                                );
                              } else {
                                if (winchips > 0) {
                                  commonData.UpdateUserChips(
                                    table.pi[si].uid,
                                    uChips,
                                    "add win amount",
                                    function (uChips) { }
                                  );
                                }
                              }
                            }

                            let upData = {
                              $set: { "pi.$": {}, _isLeave: 0 },
                              $inc: { pv: cutChips, ap: -1 },
                            };
                            if (table.pi[si]._ir == 1) {
                              getInfo.UpdateUserData(table.pi[si].uid, {
                                $set: {
                                  tbid: "",
                                  wc: 0,
                                  s: "free",
                                  "counters.opc": 0,
                                  sck: "",
                                },
                              });
                            } else {
                              upData.$inc.uCount = -1;
                            }
                            let onInvite = data.onInvite
                              ? data.onInvite
                              : false;
                            let dt = {};
                            if (data.flag) {
                              dt = {
                                leave: 1,
                                si: si,
                                gt: table.gt,
                                mode: table.mode,
                                tst: table.tst,
                                pt: table.pt,
                                winc: winc,
                                showRate: showRate,
                                uid: table.pi[si].uid,
                                id: client.id,
                                tbid: table._id.toString(),
                                flag: data.flag,
                                onInvite: onInvite,
                              };
                              if (data.flag == "noChips") {
                                dt.reqChips = table.bv * MAX_DEADWOOD_PTS;
                              }
                            } else {
                              dt = {
                                leave: 1,
                                si: si,
                                gt: table.gt,
                                mode: table.mode,
                                tst: table.tst,
                                pt: table.pt,
                                winc: winc,
                                showRate: showRate,
                                uid: table.pi[si].uid,
                                id: client.id,
                                tbid: table._id.toString(),
                                flag: "",
                                onInvite: onInvite,
                              };
                            }

                            if (table.pi[si].s == "playing") {
                              upData["$inc"].playCount = -1;
                            }
                            let tempPlayerData = table.pi[si];
                            tempPlayerData.s = "left";
                            tempPlayerData.Chips = uChips;
                            tempPlayerData.wc = -cutChips;
                            tempPlayerData.pts = pts;
                            let ctth = "";
                            if (table.pi[si].cards.length > 13) {
                              //user has more than 13 cards means he has picked a card
                              ctth = table.pi[si].cards.pop();
                              upData["$push"] = { oDeck: ctth };
                            }

                            tempPlayerData.cards = table.pi[si].cards;
                            // tempPlayerData.gCards = table.pi[si].gCards;
                            tempPlayerData.dCards = table.pi[si].gCards;
                            // tempPlayerData.dCards = {
                            //   pure: [],
                            //   seq: [],
                            //   set: [],
                            //   dwd: table.pi[si].cards,
                            // };

                            tempPlayerData.ps = pts;
                            tempPlayerData.dps = pts;
                            tempPlayerData.gedt = new Date();

                            let players = getInfo.getPlayingUserInRound(
                              table.pi,
                              true
                            );
                            logger.info(
                              "leaveTable---------------->>>>>>>>>>>>>>>players.length:",
                              players.length
                            );
                            if (players.length > 0) {
                              upData["$addToSet"] = {
                                hist: tempPlayerData,
                              };
                            } else {
                              logger.info(
                                "leaveTable---------------->>>>>>>>>>>>>>>do nothing"
                              );
                            }
                            // upData['$addToSet'] = {hist:tempPlayerData};
                            if (client.uid == table.tci) {
                              let nextTurn = getNextPlayerPr(table);
                              logger.info(
                                "leaveTable---------------->>>>>>>>>>>>>>>nextTurn: ",
                                nextTurn
                              );
                              if (
                                typeof nextTurn != "undefined" ||
                                nextTurn != null ||
                                typeof nextTurn.nxt != "undefined"
                              ) {
                                upData["$set"].tci = table.pi[nextTurn.nxt].uid;
                              } else {
                                upData["$set"].tci = "";
                              }
                            }
                            logger.info(
                              "leaveTable---------------->>>>>table._id: " +
                              table._id +
                              " si: " +
                              si
                            );
                            db.collection("playing_table").findAndModify(
                              { _id: table._id, "pi.si": si },
                              {},
                              upData,
                              { new: true },
                              async function (err, table1) {
                                if (err) {
                                  logger.info(
                                    "leaveTable:::::::" +
                                    table._id +
                                    ":::::si: " +
                                    si +
                                    "::::::upData: ",
                                    upData,
                                    ":::::::>>>>>Error: ",
                                    err,
                                    " " + new Date()
                                  );
                                }

                                if (!table1 || !table1.value) {
                                  logger.info(
                                    "leaveTable------" +
                                    table._id +
                                    "---upData: ",
                                    upData,
                                    "---si: " +
                                    si +
                                    '--------->>>>"table not found"' +
                                    new Date()
                                  );
                                  db.collection("playing_table").updateOne(
                                    { _id: table._id },
                                    { $set: { _isLeave: 0 } }
                                  );
                                  return false;
                                }

                                if (
                                  showRate ||
                                  typeof userInfo.lasts.lrpt == "undefined" ||
                                  userInfo.lasts.lrpt == null
                                ) {
                                  userInfo.lasts.lrpt = new Date();
                                }

                                let upData1 = {
                                  $set: {
                                    tbid: "",
                                    rejoinID: "",
                                    rejoin: 0,
                                    "lasts.lrpt": userInfo.lasts.lrpt,
                                  },
                                };
                                if (data.flag != "switch") {
                                  upData1.$set.wc = 0;
                                }

                                getInfo.UpdateUserData(
                                  table.pi[si].uid,
                                  upData1
                                );

                                dt.wc = cutChips;
                                dt.pts = pts;
                                dt.ap = table1.value.ap;

                                if (
                                  typeof data.stck == "undefined" ||
                                  !data.stck
                                ) {
                                  if (ctth != "") {
                                    commonClass.FireEventToTable(
                                      table1.value._id.toString(),
                                      {
                                        en: "ThrowCard",
                                        data: {
                                          si: si,
                                          uid: table.pi[si].uid,
                                          time: table1.value.pi[si].secTime,
                                          card: ctth,
                                          bbv: table1.value.bbv,
                                          finish: false,
                                          cdd: true,
                                        },
                                      }
                                    );
                                    discardedCardsClass.DiscardedCards(
                                      {},
                                      { tbid: table1.value._id.toString() }
                                    );
                                  }

                                  commonClass.FireEventToTable(
                                    table1.value._id.toString(),
                                    { en: "LeaveTable", data: dt }
                                  );
                                  // storeTableHistory({
                                  //   tableId: table1.value._id.toString(),
                                  //   eventName: "LeaveTable",
                                  //   tableData: table1.value,
                                  //   userIndex: si
                                  // });
                                }

                                delete client.tbid;
                                delete client.si;
                                delete client.gt;

                                // if (lock) await lock.unlock();
                                managePlayerOnLeave(
                                  table1.value._id.toString(),
                                  si,
                                  true,
                                  leaveReason,
                                  client
                                );
                                if (typeof callback == "function") {
                                  callback(1);
                                }
                              }
                            );
                          }
                        );
                      }
                    );
                  }
                }
              );
            } else if (table.mode == "cash") {
              commonData.UpdateCashForPlayInTable(
                table._id,
                table.pi[si].uid,
                chp,
                "Table Leave Deduction",
                function (uChips) {
                  logger.info("-uChips--------->", uChips);
                  if (typeof uChips != "undefined") {
                    getInfo.GetUserInfo(
                      table.pi[si].uid,
                      {
                        wc: 1,
                        rlsAmount: 1,
                        tbd: 1,
                        flags: 1,
                        Chips: 1,
                        cash: 1,
                        lasts: 1,
                        artifact: 1,
                      },
                      async function (userInfo) {
                        let winc =
                          typeof userInfo == "undefined" ||
                            userInfo == null ||
                            data.flag == "noChips"
                            ? 0
                            : userInfo.wc;
                        let showRate =
                          userInfo.flags._isRated == 0 &&
                            typeof userInfo.lasts.lrpt != "undefined" &&
                            commonClass.GetTimeDifference(
                              userInfo.lasts.lrpt,
                              new Date(),
                              "day"
                            ) >= 1
                            ? true
                            : false;
                        logger.info(
                          "leaveTable---------->>>>winc: Leave Table" + winc
                        );
                        logger.info(
                          "leaveTable---------->>>>uChips: " + uChips
                        );
                        logger.info(
                          "leaveTable---------->>>>table.pi[si].winAmount: Leave Table" +
                          table.pi[si].winAmount
                        );

                        let winchips = table.pi[si].winAmount;
                        if (winchips > uChips) {
                          winchips = uChips;
                        }
                        logger.info(
                          "winchipssssssssss-------1-----:winchips Leave Table",
                          winchips
                        );
                        if (
                          uChips > 0 &&
                          ((userInfo.rlsAmount &&
                            table._id.toString() == userInfo.tbd) ||
                            userInfo.flags._ir == 1)
                        ) {
                          uChips = uChips - winchips;
                          if (uChips > 0) {
                            logger.info(
                              "winchipssssssssss-------2-----:uChips Leave Table",
                              uChips
                            );
                            let utc = await commonData.UpdateUserCash(
                              table.pi[si].uid,
                              uChips,
                              "release remaining amount",
                              table._id.toString(),
                              false,
                              false
                            );
                            if (typeof utc != "undefined") {
                              if (winchips > 0) {
                                logger.info(
                                  "winchipssssssssss-------3-----:winchips",
                                  winchips
                                );
                                await commonData.UpdateUserCash(
                                  table.pi[si].uid,
                                  winchips,
                                  "Game Win",
                                  table._id.toString(),
                                  false,
                                  false
                                );
                              }
                            }
                            // })
                          } else {
                            if (winchips > 0) {
                              logger.info(
                                "winchipssssssssss-------3-----:winchips",
                                winchips
                              );
                              await commonData.UpdateUserCash(
                                table.pi[si].uid,
                                winchips,
                                "Game Win",
                                table._id.toString(),
                                false,
                                false
                              );
                            }
                          }
                        } else {
                          logger.info(
                            "leaveTable----------->>>>> no need to release amount as it is released already ou uChips is 0 Leave Table"
                          );
                          getInfo.UpdateUserData(client.uid, {
                            $set: { cAmount: false },
                          });
                        }
                        logger.info("------------1---------->");
                        commonData.CountHands(
                          table.pi[si].uid,
                          "lost",
                          table.gt,
                          table.bv,
                          false,
                          table.mode,
                          table._ip,
                          table.round,
                          function (thp, qstWin) {
                            let upData = {
                              $set: {
                                "pi.$": {},
                                cAmount: false,
                                _isLeave: 0,
                              },
                              $inc: { pv: cutChips, ap: -1 },
                            };
                            logger.info("--up----if", table.pi[si]._ir);
                            if (table.pi[si]._ir == 1) {
                              getInfo.UpdateUserData(table.pi[si].uid, {
                                $set: {
                                  tbid: "",
                                  wc: 0,
                                  s: "free",
                                  "counters.opc": 0,
                                  sck: "",
                                },
                              });
                            } else {
                              upData.$inc.uCount = -1;
                            }
                            let onInvite = data.onInvite
                              ? data.onInvite
                              : false;

                            let dt;
                            if (data.flag) {
                              // eval('var dt = {leave:1,si:si,winc:winc,uid:table.pi[si].uid,id:client.id,tbid:table._id.toString(),'+data.flag+':1}')
                              dt = {
                                leave: 1,
                                si: si,
                                gt: table.gt,
                                mode: table.mode,
                                tst: table.tst,
                                pt: table.pt,
                                winc: winc,
                                showRate: showRate,
                                uid: table.pi[si].uid,
                                id: client.id,
                                tbid: table._id.toString(),
                                flag: data.flag,
                                onInvite: onInvite,
                              };
                              if (data.flag == "noChips") {
                                dt.reqChips = table.bv * MAX_DEADWOOD_PTS;
                              }
                            } else {
                              dt = {
                                leave: 1,
                                si: si,
                                gt: table.gt,
                                mode: table.mode,
                                tst: table.tst,
                                pt: table.pt,
                                winc: winc,
                                showRate: showRate,
                                uid: table.pi[si].uid,
                                id: client.id,
                                tbid: table._id.toString(),
                                flag: "",
                                onInvite: onInvite,
                              };
                            }

                            if (table.pi[si].s == "playing") {
                              upData["$inc"].playCount = -1;
                            }
                            let tempPlayerData = table.pi[si];
                            tempPlayerData.s = "left";
                            tempPlayerData.cash = uChips;
                            tempPlayerData.wc = -cutChips;
                            tempPlayerData.pts = pts;
                            let ctth = "";
                            if (table.pi[si].cards.length > 13) {
                              //user has more than 13 cards means he has picked a card
                              ctth = table.pi[si].cards.pop();
                              upData["$push"] = { oDeck: ctth };
                            }

                            tempPlayerData.cards = table.pi[si].cards;
                            // tempPlayerData.gCards = table.pi[si].gCards;
                            tempPlayerData.dCards = table.pi[si].gCards;
                            // tempPlayerData.dCards = {
                            //   pure: [],
                            //   seq: [],
                            //   set: [],
                            //   dwd: table.pi[si].cards,
                            // };
                            tempPlayerData.ps = pts;
                            tempPlayerData.dps = pts;
                            tempPlayerData.gedt = new Date();
                            let players = getInfo.getPlayingUserInRound(
                              table.pi,
                              true
                            );
                            logger.info(
                              "leaveTable---------------->>>>>>>>>>>>>>>players.length: Leave Table",
                              players.length
                            );
                            if (players.length > 0) {
                              upData["$addToSet"] = {
                                hist: tempPlayerData,
                              };
                            } else {
                              logger.info(
                                "leaveTable---------------->>>>>>>>>>>>>>>do nothing"
                              );
                            }
                            // upData['$addToSet'] = {hist:tempPlayerData};
                            if (client.uid == table.tci) {
                              let nextTurn = getNextPlayerPr(table);
                              logger.info(
                                "leaveTable---------------->>>>>>>>>>>>>>>nextTurn: Leave Table ",
                                nextTurn
                              );
                              if (
                                typeof nextTurn != "undefined" ||
                                nextTurn != null ||
                                typeof nextTurn.nxt != "undefined"
                              ) {
                                upData["$set"].tci = table.pi[nextTurn.nxt].uid;
                              } else {
                                upData["$set"].tci = "";
                              }
                            }
                            logger.info(
                              "leaveTable---------------->>>>>table._id: " +
                              table._id +
                              " si:  Leave Table" +
                              si
                            );
                            db.collection("playing_table").findAndModify(
                              { _id: table._id, "pi.si": si },
                              {},
                              upData,
                              { new: true },
                              async function (err, table1) {
                                if (err) {
                                  logger.info(
                                    "leaveTable:::::::" +
                                    table._id +
                                    ":::::si: " +
                                    si +
                                    "::::::upData: ",
                                    upData,
                                    ":::::::>>>>>Error:  Leave Table",
                                    err,
                                    " " + new Date()
                                  );
                                }

                                if (!table1 || !table1.value) {
                                  logger.info(
                                    "leaveTable------" +
                                    table._id +
                                    "---upData: ",
                                    upData,
                                    "---si: " +
                                    si +
                                    '--------->>>>"table not found" Leave Table' +
                                    new Date()
                                  );
                                  logger.info(
                                    "table1.valu-------------->",
                                    table1.value.hist
                                  );
                                  db.collection("playing_table").updateOne(
                                    { _id: table._id },
                                    { $set: { _isLeave: 0 } }
                                  );
                                  return false;
                                }

                                if (
                                  showRate ||
                                  typeof userInfo.lasts.lrpt == "undefined" ||
                                  userInfo.lasts.lrpt == null
                                ) {
                                  userInfo.lasts.lrpt = new Date();
                                }

                                let upData1 = {
                                  $set: {
                                    tbid: "",
                                    rejoinID: "",
                                    rejoin: 0,
                                    "lasts.lrpt": userInfo.lasts.lrpt,
                                  },
                                };
                                if (data.flag != "switch") {
                                  upData1.$set.wc = 0;
                                }

                                getInfo.UpdateUserData(
                                  table.pi[si].uid,
                                  upData1
                                );

                                dt.wc = cutChips;
                                dt.pts = pts;
                                dt.ap = table1.value.ap;

                                if (
                                  typeof data.stck == "undefined" ||
                                  !data.stck
                                ) {
                                  if (ctth != "") {
                                    commonClass.FireEventToTable(
                                      table1.value._id.toString(),
                                      {
                                        en: "ThrowCard",
                                        data: {
                                          si: si,
                                          uid: table.pi[si].uid,
                                          time: table1.value.pi[si].secTime,
                                          card: ctth,
                                          bbv: table1.value.bbv,
                                          finish: false,
                                          cdd: true,
                                        },
                                      }
                                    );
                                    discardedCardsClass.DiscardedCards(
                                      {},
                                      { tbid: table1.value._id.toString() }
                                    );
                                  }
                                  commonClass.FireEventToTable(
                                    table1.value._id.toString(),
                                    { en: "LeaveTable", data: dt }
                                  );
                                  // storeTableHistory({
                                  //   tableId: table1.value._id.toString(),
                                  //   eventName: "LeaveTable",
                                  //   tableData: table1.value,
                                  //   userIndex: si
                                  // });
                                }
                                logger.info(" Leave Table");
                                delete client.tbid;
                                delete client.si;
                                delete client.gt;

                                // if (lock) await lock.unlock();
                                managePlayerOnLeave(
                                  table1.value._id.toString(),
                                  si,
                                  true,
                                  leaveReason,
                                  client
                                );
                                if (typeof callback == "function") {
                                  callback(1);
                                }
                              }
                            );
                          }
                        );
                      }
                    );
                  }
                }
              );
            }
          }
        } else {
          logger.info(
            "leaveTable::::::::::" +
            client.tbid +
            ':::::::>>>>Error: "table not found!!!"'
          );
          // if (lock) await lock.unlock();
          commonClass.SendDirect(
            client.uid,
            {
              en: "LeaveTable",
              data: {
                mode: "",
                activePlayer: 0,
                tableStats: "",
                leave: 1,
                seatIndex: -1,
                gameType: client.gt,
                winc: 0,
                userId: client.uid,
                id: client.id,
                playTableId: client.tbid,
                flag: "tnf",
              },
            },
            true
          );

          if (typeof callback == "function") {
            callback(1);
          }
        }
      }
    );
  } catch (error) {
    logger.error("-----> error LeaveTable", error);
    // if (lock) await lock.unlock();
    getInfo.exceptionError(error);
  } finally {
    // if (lock) await lock.unlock();
  }
  // console.timeEnd("latency timer LeaveTable");
};

const managePlayerOnLeave = async (tbId, si, left, leaveReason, client) => {
  // console.time("latency timer managePlayerOnLeave");

  let lock;
  try {
    //left is true if user actually leave the table
    /* +-------------------------------------------------------------------+
      desc:function to handle table when player leave the playing table
      i/p: tbId = table id
         si = seat index of leaving user
         left = is user left table or not
         leaveReason = reason to leave

    +-------------------------------------------------------------------+ */

    logger.info("managePlayerOnLeave------>>> tbId: " + tbId + " si: " + si);
    const redisInstances = getRedisInstances();
    if (client._ir == 0) {
      await redisInstances.DEL(`userPlayingCards:${tbId.toString()}:${client.uid}`);
    }

    getInfo.GetTbInfo(tbId, {}, async function (table) {
      if (table) {
        // lock = await redlock.acquire(`locks:${table._id.toString()}`, 5000);
        logger.info(
          "managePlayerOnLeave--------------->>>>>table.tst: " +
          table.tst +
          " table.pi: " +
          table.pi +
          " table.round: " +
          table.round +
          " table.gt: " +
          table.gt
        );
        let players = getInfo.getPlayingUserInRound(table.pi, true);
        if (
          (table.gt == "Deal" || table.gt == "Pool") &&
          (table.tst == "RoundTimerStarted" ||
            table.tst == "roundWinnerDeclared")
        ) {
          players = getInfo.getPlayingUserInGame(table.pi, true);
        }

        logger.info(
          "managePlayerOnLeave------->>>>players: " +
          players +
          " table.tst: " +
          table.tst
        );
        if (
          players.length == 1 &&
          (table.tst == "StartDealingCard" ||
            table.tst == "CardsDealt" ||
            table.tst == "RoundStarted" ||
            (table.tst == "RoundTimerStarted" &&
              table.gt == "Deal" &&
              table.round < table.deals) ||
            (table.tst == "roundWinnerDeclared" && table.gt == "Deal") ||
            (table.tst == "RoundTimerStarted" &&
              table.gt == "Pool" &&
              table.round > 0))
        ) {
          logger.info("in -----if----managePlayerOnLeave-----");
          logger.info("managePlayerOnLeave-------->>>>>>>table: ", table);

          if (table.gt == "Deal") {
            //deal rummy leave logic here
            var players1 = getInfo.getPlayingUserInGame(table.pi, true);
            logger.info(
              "managePlayerOnLeave----deal----->>>>>>players: ",
              players
            );
            logger.info(
              "managePlayerOnLeave-----deal---->>>>>>players1: ",
              players1
            );
            // if (lock) await lock.unlock();
            if (players1.length == 1) {
              //means there is only one player left on table which was in deal so direct winner
              logger.info("managePlayerOnLeave---play 1------deal--->>>>>");

              var upData1 = {
                $set: {
                  la: new Date(),
                  "pi.$.tScore": table.tpr,
                  fnsPlayer: players1[0].si,
                  round: table.deals,
                },
              };
              db.collection("playing_table").findAndModify(
                {
                  _id: getInfo.MongoID(table._id.toString()),
                  "pi.si": players1[0].si,
                },
                {},
                upData1,
                { new: true },
                function (err, table2) {
                  if (!table2 || !table2.value) {
                    logger.info("DropCards::::::::::1:::::::::::Error: ", err);
                    return false;
                  }

                  winnerClass.handleDealWinner(
                    table._id.toString(),
                    [players[0].si],
                    [],
                    table.pv,
                    true
                  );
                }
              );
            } else {
              logger.info("managePlayerOnLeave------play > 1------->>>>");
              //if the deal players are more than 1 and then check if the round is 1 then declare round winner or else decalre final winner
              if (table.round < table.deals) {
                logger.info(
                  "managePlayerOnLeave-----------play > 1 ----round 1------>>>>>"
                );

                getInfo.UpdateTableData(
                  table._id.toString(),
                  { $set: { fnsPlayer: players[0].si } },
                  function (table1) {
                    winnerClass.declareRoundWinnerNew(
                      table._id.toString(),
                      players[0].si,
                      true,
                      true
                    );
                    // winnerClass.declareRoundWinner(table._id.toString(), true);
                  }
                );
              } else {
                logger.info(
                  "managePlayerOnLeave-----------play > 1 -----round 2----------->>>>>",
                  players[0].si
                );
                getInfo.UpdateTableData(
                  table._id.toString(),
                  { $set: { fnsPlayer: players[0].si, round: table.deals } },
                  function (table1) {
                    if (table1) {
                      // winnerClass.declareDealWinner(table._id.toString(), true);
                      winnerClass.declareRoundWinnerNew(
                        table._id.toString(),
                        players[0].si,
                        true,
                        true
                      );
                    }
                  }
                );
              }
            }
          } else if (table.gt == "Pool") {
            let players1 = getInfo.getPlayingUserInGame(table.pi, true);
            logger.info(
              "managePlayerOnLeave----pool----->>>>>>players: ",
              players
            );
            logger.info(
              "managePlayerOnLeave-----pool---->>>>>>players1: ",
              players1
            );
            logger.info("players--------------->", players1.length);
            // if (lock) await lock.unlock();
            if (players1.length == 1) {
              //means there is only one player left on which was in pool so direct winner
              logger.info(
                "managePlayerOnLeave--------play 1----pool------>>>>>"
              );
              //logic to handle direct pool winner
              // this is fixed for circular dependency problem.
              // const winnerClass = require("./winner.class");
              winnerClass.handlePoolWinner(
                table._id.toString(),
                players1[0].si,
                true
              );
            } else {
              logger.info("managePlayerOnLeave------play > 1------->>>>");

              //direct winner logic here
              getInfo.UpdateTableData(
                table._id.toString(),
                { $set: { fnsPlayer: players[0].si } },
                function (table1) {
                  winnerClass.declareRoundWinnerNew(
                    table._id.toString(),
                    players[0].si,
                    true,
                    true
                  );
                }
              );
            }
          } else {
            // const winnerClass = require("./winner.class");
            // if (lock) await lock.unlock();
            if (table.mode == "practice") {
              winnerClass.handleWinner(
                table._id.toString(),
                players[0].si /*,table.pv*/,
                true
              );
            } else {
              winnerClass.handleWinnerCash(
                table._id.toString(),
                players[0].si /*,table.pv*/,
                true
              );
            }
          }
        } else {
          logger.info("-managePlayerOnLeave------else-->>-----");
          players = getInfo.getPlayingUserInRound(table.pi);
          let rCount = 0;
          let uCount = 0;

          for (let x in players) {
            if (players[x]._ir == 0) {
              uCount++;
            } else {
              rCount++;
            }
          }
          logger.info(
            "managePlayerOnLeave------else-->>>uCount: ",
            uCount,
            " rCount: ",
            rCount,
            " turn: ",
            table.turn,
            " ap: ",
            table.ap
          );

          if (
            uCount == 0 &&
            rCount >= 0 /*&& left*/ &&
            table.stdP.length == 0
          ) {
            //if player leaves and only robot remains then delete the table
            logger.info(
              "managePlayerOnLeave-------if player leaves and only robot remains then delete the table"
            );
            logger.info("---table--pi=------------>", table.pi);
            if (table.tst === "RematchTimerStarted" && table.gt === "Deal") {
              logger.info("-in------if-----------if----1");
              // update bot win amount
              for (let x in players) {
                if (players[x]._ir == 1) {
                  let upData = {
                    $inc: {
                      totalcash: commonClass.RoundInt(players[x].winAmount, 2),
                    },
                  };
                  getInfo.UpdateUserData(
                    players[x].uid,
                    upData,
                    function () { }
                  );
                }
              }

              db.collection("play_track").updateOne(
                { tbid: table._id.toString() },
                { $set: { tet: new Date() } },
                function () { }
              );

              db.collection("last_deal").deleteOne(
                { tbid: table._id.toString() },
                function () { }
              );
              // if (table.ap === 0) {
              db.collection("playing_table").deleteOne(
                { _id: table._id },
                function () { }
              );
              // }
              db.collection("user_cash_percent").deleteOne(
                { tableId: table._id },
                function () { }
              );
              // setTimeout(() => {
              //   db.collection("tableHistory").deleteMany({ tableId: getInfo.MongoID(table._id) });
              // }, 3000);
            } else {
              robotsClass.removeRobots(table._id.toString());
            }
            // if (lock) await lock.unlock();
            commonClass.fireEventToAll({
              en: "JoiningUsers",
              data: {
                joinedPlayers: (table.ap - rCount).toString(),
                _id: table.categoryId.toString(),
                playerCount: table.ms,
              },
            });
          } else {
            logger.info("in-----if else---------->");
            let minS = table.minS ? table.minS : config.MIN_SEAT_TO_FILL;
            let MIN_SEAT_TO_FILL = /*(table._ip == 1)?2:*/ minS;
            let MIN_SEAT_TO_FILL_DEAL = minS;
            let MIN_SEAT_TO_FILL_POOL = minS;

            if (
              table.tst == "RoundTimerStarted" &&
              table.ap < table.ms &&
              table.ap < MIN_SEAT_TO_FILL &&
              table.gt == "Points"
            ) {
              //special condition if user standup or leave table after round timer started
              logger.info(
                "managePlayerOnLeave-------RoundTimerStarted------>>>>>>>insufficient players"
              );
              // if (table.ap == 1) {
              //   jobTimerClass.cancelJobOnServers(
              //     table._id.toString(),
              //     table.jid
              //   );
              // }
              if (table.tst !== "RoundTimerStarted") {
                jobTimerClass.cancelJobOnServers(
                  table._id.toString(),
                  table.jid
                );
              }
              // if (lock) await lock.unlock();
              getInfo.UpdateTableData(
                table._id.toString(),
                {
                  $set: {
                    rSeq: 1,
                    maxBet: 0,
                    bbv: table.bv,
                    _isLeave: 0,
                    trCount: 0,
                    tst: table.tst,
                    pv: 0,
                    wildCard: "",
                    oDeck: [],
                    declCount: 0,
                    playCount: 0,
                    cDeck: [],
                    turn: -1,
                    fnsPlayer: -1,
                    hist: [],
                    // ctt: new Date(),
                  },
                },
                function (table1) {
                  roundClass.initializeGame(table._id.toString());
                }
              );
            } else if (
              table.tst == "RoundTimerStarted" &&
              table.ap < table.ms &&
              table.ap < MIN_SEAT_TO_FILL_DEAL &&
              table.gt == "Deal"
            ) {
              //special condition if user standup or leave table after round timer started
              logger.info(
                "managePlayerOnLeave-------RoundTimerStarted------>>>>>>>insufficient players"
              );
              if (table.tst !== "RoundTimerStarted") {
                jobTimerClass.cancelJobOnServers(
                  table._id.toString(),
                  table.jid
                );
              }
              // if (lock) await lock.unlock();
              getInfo.UpdateTableData(
                table._id.toString(),
                {
                  $set: {
                    rSeq: 1,
                    _isLeave: 0,
                    tst: table.tst,
                    pv: 0,
                    trCount: 0,
                    wildCard: "",
                    oDeck: [],
                    declCount: 0,
                    playCount: 0,
                    cDeck: [],
                    turn: -1,
                    fnsPlayer: -1,
                    hist: [],
                    // ctt: new Date(),
                  },
                },
                function (table1) {
                  roundClass.initializeGame(table._id.toString());
                }
              );
            } else if (
              table.tst == "RoundTimerStarted" &&
              table.ap < table.ms &&
              table.ap < MIN_SEAT_TO_FILL_POOL &&
              table.gt == "Pool"
            ) {
              //special condition if user standup or leave table after round timer started
              logger.info(
                "managePlayerOnLeave-------RoundTimerStarted------>>>>>>>insufficient players"
              );
              if (table.tst !== "RoundTimerStarted") {
                jobTimerClass.cancelJobOnServers(
                  table._id.toString(),
                  table.jid
                );
              }
              // if (lock) await lock.unlock();
              getInfo.UpdateTableData(
                table._id.toString(),
                {
                  $set: {
                    rSeq: 1,
                    _isLeave: 0,
                    tst: table.tst,
                    pv: 0,
                    wildCard: "",
                    trCount: 0,
                    oDeck: [],
                    declCount: 0,
                    playCount: 0,
                    cDeck: [],
                    turn: -1,
                    fnsPlayer: -1,
                    hist: [],
                    // ctt: new Date(),
                  },
                },
                function (table1) {
                  roundClass.initializeGame(table._id.toString());
                }
              );
            } else if (
              table.tst == "winnerDeclared" &&
              table.ap == 0 &&
              table.stdP.length > 0
            ) {
              //special condition if  all user standup or leave table on winnerDeclared timer started
              logger.info(
                "managePlayerOnLeave-----winnerDeclared-------->>>>>>>insufficient players"
              );
              // if (lock) await lock.unlock();
            } else if (table.tst == "RoundStarted" && players.length == 0) {
              //special condition to handle all standup and rounstarted table status of table
              logger.info(
                "managePlayerOnLeave----->>>>RoundStarted--------->>>>>ap: " +
                table.ap
              );
              // if (lock) await lock.unlock();
            } else if (
              /*table.tst == "StartDealingCard" || */ table.tst ==
              "RoundStarted" &&
              table.turn == si
            ) {
              //means turn user leaves table
              logger.info(
                "managePlayerOnLeave---------------->>>>>>RoundStarted"
              );
              // if (lock) await lock.unlock();
              const userJobId = `${table.gt}:userTurnStart:${tbId.toString()}:${client.uid}`;
              cancelJob(userJobId);
              // jobTimerClass.cancelJobOnServers(table._id.toString(), table.jid);
              turnClass.changeTableTurn(table._id.toString(), leaveReason);
            } else if (
              /*table.tst == "StartDealingCard" || */ table.tst ==
              "RoundStarted" &&
              table.ap > 0 &&
              (typeof table.turn == "undefined" || table.turn == null)
            ) {
              //special condition to handle simultaneous leave,switch, standup
              logger.info(
                "managePlayerOnLeave------1------>>>>>>table.turn: ",
                table.turn
              );
              // if (lock) await lock.unlock();

              let pi = getInfo.getPlayingUserInRound(table.pi, true);

              let upData = {
                $set: {
                  rSeq: 1,
                  maxBet: 0,
                  bbv: table.bv,
                  _isLeave: 0,
                  declCount: 0,
                  playCount: 0,
                  trCount: 0,
                  tst: "",
                  pv: 0,
                  hist: [],
                  cDeck: [],
                  oDeck: [],
                  fnsPlayer: -1,
                  wildCard: "",
                  turn: -1,
                  dealer: -1,
                  ctt: new Date(),
                },
              };
              if (table.gt == "Deal" || table.gt == "Pool") {
                upData["$set"].round = 0;
              }

              if (pi.length == 0) {
                getInfo.UpdateTableData(
                  table._id.toString(),
                  upData,
                  function (table1) {
                    if (table1) {
                      roundClass.initializeGame(table1._id.toString());
                    } else {
                      logger.info(
                        'managePlayerOnLeave---------->>>>>>Error:"table not found"'
                      );
                    }
                  }
                );
              }
            }
          }
        }
      }
    });
  } catch (error) {
    logger.error("-----> error managePlayerOnLeave", error);
    getInfo.exceptionError(error);
  }
  // console.timeEnd("latency timer managePlayerOnLeave");

};

const getNextPlayerPr = (table) => {
  //get the index of next player on table
  /* +-------------------------------------------------------------------+
      desc:return the seat index of next playing user on table
      i/p: table = table details
      o/p: seat index of player
    +-------------------------------------------------------------------+ */
  logger.info(">>>>>table.turn: ", table.turn, " table.ap: ", table.ap);
  if (table.ap > 0) {
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

const REMATCH_NO = async (data, client) => {
  logger.info("REMATCH_NO data = :", data);
  const { TIMER_REMATCH } = GetConfig();
  getInfo.GetTbInfo(
    client.tbid,
    {
      pi: 1,
      bv: 1,
      categoryId: 1,
      prize: 1,
    },
    function (table) {
      if (!table) {
        return false;
      }

      table.pi.map(async (userObject) => {
        if (
          !_.isEmpty(userObject) &&
          userObject._ir == 0 &&
          userObject.uid === client.uid
        ) {
          const userInfo_1 = await db.collection("game_users").findOne(
            {
              _id: getInfo.MongoID(userObject.uid),
            },
            {
              projection: {
                SignUpBonusStatus: 1,
                totalcash: 1,
                SignUpBonus: 1,
                addCash_bonus: 1,
                referral_bonus: 1,
                Bonus: 1,
                tbid: 1,
                tbd: 1,
              },
            }
          );

          let totalBonus,
            SignUpBonus = 0,
            totalCashBonus = 0,
            totalReferralBonus = 0,
            cmsBonus = 0;

          if (userInfo_1.SignUpBonusStatus == "Active") {
            SignUpBonus += userInfo_1.SignUpBonus;
          }

          if (userInfo_1.addCash_bonus) {
            for (const element of userInfo_1.addCash_bonus) {
              if (element.status == "Active") {
                totalCashBonus += element.addCashBonus;
              }
            }
          }

          if (userInfo_1.referral_bonus) {
            for (const element of userInfo_1.referral_bonus) {
              if (element.status == "Active") {
                totalReferralBonus += element.referralBonus;
              }
            }
          }

          if (userInfo_1.Bonus) {
            cmsBonus += userInfo_1.Bonus;
          }

          totalBonus =
            totalCashBonus + SignUpBonus + totalReferralBonus + cmsBonus;

          let remainRematchTime =
            TIMER_REMATCH -
            commonClass.GetTimeDifference(table.ctt, new Date(), "second");

          // if (userInfo_1.tbid !== "") {
          commonClass.SendDirect(
            userObject.uid,
            {
              en: "PLAY_AGAIN",
              data: {
                timer: remainRematchTime > 0 ? remainRematchTime : 0,
                bv: table.bv,
                winPrize: userObject._iw === 1 ? table.prize : 0,
                rank: userObject._iw === 1 ? 1 : 2,
                prize: table.prize,
                totalCash:
                  userObject._iw === 1
                    ? userInfo_1.totalcash + table.prize
                    : userInfo_1.totalCash,
                bonusCash: totalBonus,
                message:
                  userObject._iw === 1
                    ? "Yeah! you won"
                    : "Well played. You finished 2nd.",
                notifyMessage: "Do you want to play again?",
                catid: table.categoryId,
                pt: 0,
              },
            },
            true
          );
          // (
          //   userObject.uid,
          //   {
          //     en: "Rematch",
          //     data: {
          //       timer: config.TIMER_REMATCH,
          //       lockInTime: 1,
          //       rank: userObject._iw === 1 ? 1 : 2,
          //       bv: table.bv,
          //       winPrize:
          //         userObject._iw === 1 ? table.prize : 0,
          //       prize: table.prize,
          //       totalCash:
          //         userObject._iw === 1
          //           ? userInfo_1.totalcash + table.prize
          //           : userInfo_1.totalcash,
          //       bonusCash: totalBonus,
          //       message:
          //         userObject._iw === 1
          //           ? "Yeah! you won"
          //           : "Well played. You finished 2nd.",
          //       notifyMessage:
          //         "Do you want to request a rematch?",
          //       catid: table.categoryId,
          //       pt: 0,
          //     },
          //   },
          //   true
          // );
          LeaveTable(
            { flag: "dealovertwo", status: "REMATCH_NO", eliminated: true },
            client,
            function (check) { }
          );
        }
      });
    }
  );
};
module.exports = {
  LeaveTable,
  managePlayerOnLeave,
  REMATCH_NO,
};

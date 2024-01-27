let isSpcc = true;
let isSpcCash = true;
const { cashCut } = require("../common/cashCut");
const config = require("../config.json");
const _ = require("underscore");
const schedule = require("node-schedule");
const commonClass = require("./common.class");
const getInfo = require("../common");
const trackClass = require("./track.class");
const roundClass = require("./round.class");
const findTableAndJoinClass = require("./findTableAndJoin.class");
const collectBootValueClass = require("./collectBootValue.class");
const jobTimerClass = require("./jobTimers.class");
const leaveTableClass = require("./leaveTable.class");
const logger = require("../utils/logger");
const { getRedisInstances } = require("../connections/redis");
const rejoinClass = require("./rejoinPool.class");
const splitPointClass = require("./splitPoint.class");
const { getTableName } = require("../utils");
const { GetConfig } = require("../connections/mongodb");
// const redlock = require("../connections/redLock");
const scheduler = require("../scheduler");
const { REMOVE_ON_LOW_CASH } = require("../constants/eventName");
const { addQueue, cancelJob } = require("../scheduler/bullQueue");

const SaveCards = async (data, client) => {
  try {
    //save cards; data = {gCards: [[],[],......]}
    /* +-------------------------------------------------------------------+
      desc:event to store grouped cards to server
      i/p: data = {gCards = 2D array of grouped cards},client = socket object
    +-------------------------------------------------------------------+ */
    logger.info("SaveCards---------->>>>>client.tbid: " + client.tbid + " client.si " + client.si + " client.uid: " + client.uid);
    const redisInstances = getRedisInstances();
    let flg = false;

    if (data.gCards) {
      data.gCards.pure = typeof data.gCards.pure === "string" ? JSON.parse(data.gCards.pure) : data.gCards.pure;
      data.gCards.seq = typeof data.gCards.seq === "string" ? JSON.parse(data.gCards.seq) : data.gCards.seq;
      data.gCards.set = typeof data.gCards.set === "string" ? JSON.parse(data.gCards.set) : data.gCards.set;
      data.gCards.dwd = typeof data.gCards.dwd === "string" ? JSON.parse(data.gCards.dwd) : data.gCards.dwd;



      let tempPure = _.flatten(data.gCards.pure);
      let tempSeq = _.flatten(data.gCards.seq);
      let tempSet = _.flatten(data.gCards.set);
      let tempDwd = _.flatten(data.gCards.dwd);
      let tempAll = tempPure.concat(tempSeq, tempSet, tempDwd);

      logger.info("tempAll", tempAll);


      let temp = tempPure.length + tempSeq.length + tempSet.length + tempDwd.length;
      logger.info("tempPure.length", tempPure.length);
      logger.info("tempSeq.length", tempSeq.length);
      logger.info("tempSet.length", tempSet.length);
      logger.info("tempDwd.length", tempDwd.length);

      logger.info("SaveCards temp", temp);

      if (data?.userShowCard?.allCards) {
        data.userShowCard.allCards = typeof data?.userShowCard?.allCards === "string" ? JSON.parse(data.userShowCard.allCards) : data.userShowCard.allCards;
        logger.info("data.userShowCard.allCards", data.userShowCard.allCards);
      } else if (!data?.userShowCard || !data?.userShowCard?.allCards) {
        data.userShowCard = { allCards: [data.gCards.pure, data.gCards.seq, data.gCards.set, data.gCards.dwd] };
        logger.info("data.userShowCard.allCards updated userShowCard", data.userShowCard.allCards);
      }

      // if (client._ir == 0) {
      if (client._ir == 0) {

        let allCardsCheck = _.flatten(data.userShowCard.allCards);
        if (tempAll.includes("") || allCardsCheck.includes("")) {
          logger.info("save card---*****blank card found*****-----");
          flg = true
        } else {
          let cardsData = await redisInstances.HGETALL(`userPlayingCards:${client.tbid.toString()}:${client.uid}`);
          logger.info("save card---card data------:", cardsData);
          let playerCards = cardsData?.cards ? JSON.parse(cardsData.cards) : [];
          logger.info("save card---playingCards data------:", playerCards);
          if (tempAll.length > 0 && playerCards.length > 0) {
            for (let i in tempAll) {
              if (!_.contains(playerCards, tempAll[i].toString())) {
                logger.info("save card---fraud check------:card:", tempAll[i]);
                flg = true;
                break;
              }
            }
          }
        }
        //   let cardsData = await redisInstances.HGETALL(`userPlayingCards:${client.tbid.toString()}:${client.uid}`);
        //   logger.info("save card---card data------:", cardsData);
        //   let playerCards = JSON.parse(cardsData.cards);
        //   logger.info("save card---playingCards data------:", playerCards);

        //   if (tempAll.length > 0) {
        //     for (let i in tempAll) {
        //       if (!_.contains(playerCards, tempAll[i].toString())) {
        //         logger.info("save card---fraud check------:card:", tempAll[i]);
        //         flg = true;
        //         break;
        //       }
        //     }
        //   }
        // }

        // if (tempAll.length > 0) {
        //   for (let i in tempAll) {
        //     if (!_.contains(playerCards, tempAll[i].toString())) {
        //       logger.info("save card---fraud check------:card:", tempAll[i]);
        //       flg = true;
        //       break;
        //     }
        //   }
        // }


        // if (tempPure.length > 0) {
        //   for (let i in tempPure) {
        //     if (!_.contains(playerCards, tempPure[i].toString())) {
        //       logger.info("save card------:temppure[i]:", tempPure[i]);
        //       flg = true;
        //       break;
        //     }
        //   }
        // }

        // if (tempSeq.length > 0) {
        //   for (let j in tempSeq) {
        //     if (!_.contains(playerCards, tempSeq[j].toString())) {
        //       logger.info("save card------:tempseq[j]:", tempSeq[j]);
        //       flg = true;
        //       break;
        //     }
        //   }
        // }

        // if (tempSet.length > 0) {
        //   for (let k in tempSet) {
        //     if (!_.contains(playerCards, tempSet[k].toString())) {
        //       logger.info("save card------:tempset[k]:", tempSet[k]);
        //       flg = true;
        //       break;
        //     }
        //   }
        // }

        // if (tempDwd.length > 0) {
        //   for (let l in tempDwd) {
        //     if (!_.contains(playerCards, tempDwd[l].toString())) {
        //       logger.info("save card------:tempdwd[l]:", tempDwd[l]);
        //       flg = true;
        //       break;
        //     }
        //   }
        // }
      }
      if (flg) {
        logger.info("save card----*****mismatch in cards*****");
        // client.disconnect();
        let tData = await db.collection("playing_table").findOne(
          { _id: getInfo.MongoID(client.tbid), "pi.uid": client.uid });

        data.gCards = {
          pure: [],
          seq: [],
          set: [],
          dwd: [tData.pi[client.si].cards],
        };
        let userShowCard1 = { allCards: [tData.pi[client.si].cards] };
        await db.collection("playing_table").findOneAndUpdate(
          { _id: getInfo.MongoID(client.tbid), "pi.uid": client.uid },
          { $set: { la: new Date(), "pi.$.gCards": data.gCards, "pi.$.userShowCard": userShowCard1 } },
        );
        commonClass.SendData(client, "CallStuckRejoin", {});
        return false;
      }
      else if (temp == 13 || temp == 14) {
        data.gCards = {
          pure: data.gCards.pure,
          seq: data.gCards.seq,
          set: data.gCards.set,
          dwd: data.gCards.dwd,
        };
        // if (!data?.userShowCard?.allCards) {
        //   data.userShowCard = { allCards: [tempPure, tempSeq, tempSet, tempDwd] };
        //   logger.info("data.userShowCard.allCards updated userShowCard", data.userShowCard.allCards);
        // }
        await db.collection("playing_table").findOneAndUpdate(
          { _id: getInfo.MongoID(client.tbid), "pi.si": client.si },
          { $set: { la: new Date(), "pi.$.gCards": data.gCards, "pi.$.userShowCard": data.userShowCard } },
          {}
        );
        commonClass.SendData(client, "SaveCards", { data: temp });
      }
      else {
        // client.disconnect();
        commonClass.SendData(client, "CallStuckRejoin", {});
      }
    }
  } catch (error) {
    logger.error("-----> error SaveCards", error);
    getInfo.exceptionError(error);
  }
};

const SwitchTable = async (data, client) => {
  // console.time("latency timer SwitchTable");

  try {
    // switch table; data = {}
    /* +-------------------------------------------------------------------+
      desc:event to switch table
      i/p: data = {},client = socket object
    +-------------------------------------------------------------------+ */
    const { MAX_DEADWOOD_PTS } = GetConfig();
    const redisInstances = getRedisInstances();
    logger.info(
      "SwitchTable----------->>>>>>client.uid: " +
      client.uid +
      " client.tbid: " +
      client.tbid +
      " client.si: " +
      client.si +
      " client.id: " +
      client.id +
      " client.gt: " +
      client.gt
    );
    let { si } = client;
    const lvt = await redisInstances.SET(`switch:${client.tbid}:${client.uid}`, 1, { EX: 5, NX: true, });
    logger.debug(`debug:switch:lvt`, lvt);
    if (!lvt) {
      return false;
    }
    logger.info(`info:switch:${client.uid}`, `switch:${client.uid}`);
    // lock = await redlock.acquire(`locks:${client.tbid.toString()}`, 5000);

    // redisInstances.expire("switch:" + client.uid, 2);
    let trobj = {
      tbid: client.tbid,
      uid: client.uid,
      rid: 0,
      s: "switch",
    };
    trackClass.Leave_Track(trobj);
    getInfo.GetUserInfo(client.uid, {}, function (userInfo) {
      if (!userInfo) {
        logger.info(
          'SwitchTable::::::::::::::>>>>>>Error: "user not found!!!"'
        );
        return false;
      }
      if (userInfo.rejoinID && userInfo.rejoinID != "") {
        // jobTimerClass.cancelRejoinJobs(userInfo.rejoinID);
        logger.info(
          'SwitchTable------------------>>>>>Msg: "4 min rejoin timer canceled"'
        );
        const userJobId = `userRejoinTimer:${userInfo.rejoinID}`;
        cancelJob(userJobId);
      }

      getInfo.UpdateUserData(
        userInfo._id.toString(),
        { $set: { rejoinID: "", rejoin: 0 } },
        function (upData) {
          let { tbid } = client;
          getInfo.GetTbInfo(tbid, {}, async function (tbInfo) {
            if (!tbInfo) {
              logger.info(
                'SwitchTable::::::::::::::Error: "table not found!!!"'
              );
              return false;
            }

            if (tbInfo.tst == "RoundStarted" && tbInfo.gt == "Points") {
              let { gt } = tbInfo;
              const userJobId = `${gt}:userTurnStart:${tbInfo._id.toString()}:${client.uid}`;
              cancelJob(userJobId);
              logger.info(
                "SwitchTable------------------->>>>>client.tbid: ",
                client.tbid
              );

              let theme = "";
              for (let i in tbInfo.stdP) {
                if (tbInfo.stdP[i].uid == client.uid) {
                  theme = tbInfo.stdP[i].theme;
                }
              }

              if (
                theme == "" &&
                si != null &&
                typeof si != "undefined" &&
                typeof tbInfo.pi[si].theme != "undefined"
              ) {
                theme = tbInfo.pi[si].theme;
              }
              // if (lock) await redlock.release(lock);
              // if (lock) await lock.unlock();
              leaveTableClass.LeaveTable({ flag: "switch", gt: gt }, client,
                async function (check) {
                  if (check == 1) {
                    // let leaveTablelock = await redlock.acquire(
                    //   `locks:${tbInfo._id.toString()}`,
                    //   5000
                    // );
                    logger.info(
                      "SwitchTable---------->>>>>client: " +
                      client.tbid +
                      " client.uid: " +
                      client.uid +
                      " client.un: " +
                      client.un +
                      " check: " +
                      check
                    );
                    getInfo.UpdateUserData(
                      upData._id.toString(),
                      { $set: { tbid: "" } },
                      async function (userInfo1) {
                        // getInfo.GetUserInfo(upData._id.toString(),{},function(userInfo1){

                        if (userInfo1) {
                          logger.info(
                            "SwitchTable---------->>>>>userInfo1.un: ",
                            userInfo1.un,
                            " userInfo1.tbid: ",
                            userInfo1.tbid
                          );

                          if (tbInfo.mode == "practice") {
                            let bbb = upData.bv * MAX_DEADWOOD_PTS;

                            if (bbb <= userInfo1.Chips) {
                              logger.info(
                                "SwitchTable------------->>>>>>findTableAndJoin started!!!",
                                tbInfo.pCount
                              );
                              let tData = {
                                bv: upData.bv,
                                lvc: userInfo1.counters.lvc,
                                chips: userInfo1.Chips,
                                tbid: tbid,
                                mode: tbInfo.mode,
                                pCount: tbInfo.ms,
                                pt: tbInfo.pt,
                                theme: theme,
                                gt: tbInfo.gt,
                                catid: tbInfo.categoryId,
                                use_bot: tbInfo.use_bot,
                              };
                              findTableAndJoinClass.findTableAndJoin(
                                tData,
                                client,
                                0
                              ); //player seats on higher boot value
                            } else {
                              logger.info("SWTL--if--else----------->>>>>");
                              let reqChips =
                                upData.bv * MAX_DEADWOOD_PTS;
                              commonClass.SendDirect(
                                client.uid,
                                {
                                  en: "LeaveTable",
                                  data: {
                                    miniGames: [],
                                    leave: 1,
                                    si: -1,
                                    winc: 0,
                                    tst: "",
                                    showRate: false,
                                    uid: client.uid,
                                    id: client.id,
                                    tbid: "",
                                    flag: "noChips",
                                    ap: 0,
                                    reqChips: reqChips,
                                  },
                                },
                                true
                              );
                              getInfo.UpdateUserData(
                                client.uid,
                                { $set: { wc: 0 } },
                                function () { }
                              );
                              commonClass.SendData(
                                client,
                                "PopUp",
                                { flag: "noChips" },
                                "error:2020"
                              ); //Don't have sufficient chips
                            }
                          } else {
                            let ef = upData.bv * MAX_DEADWOOD_PTS;
                            let cutBonus = 0;

                            const tableName = getTableName(tbInfo.gt);
                            const category = await db
                              .collection(tableName)
                              .findOne({
                                _id: getInfo.MongoID(tbInfo.categoryId),
                              });

                            // const category = await db
                            //   .collection("point_category")
                            //   .findOne(
                            //     {
                            //       _id: getInfo.MongoID(tbInfo.categoryId),
                            //     },
                            //     { projection: { bonus: 1 } }
                            //   );
                            cutBonus = category.bonus ? +category.bonus : 0;
                            let { playable } = await cashCut({
                              userInfo,
                              entryFee: ef,
                              tableId: tbInfo._id,
                              cutBonus,
                            });
                            // if (leaveTablelock) await leaveTablelock.unlock();

                            if (playable) {
                              logger.info(
                                "SwitchTable------------->>>>>>findTableAndJoin started!!!"
                              );
                              let tData = {
                                bv: upData.bv,
                                lvc: userInfo1.counters.lvc,
                                chips: userInfo1.Chips,
                                tbid: tbid,
                                mode: tbInfo.mode,
                                pCount: tbInfo.ms,
                                pt: tbInfo.pt,
                                theme: theme,
                                gt: tbInfo.gt,
                                catid: tbInfo.categoryId,
                                use_bot: tbInfo.use_bot,
                              };
                              findTableAndJoinClass.findTableAndJoin(
                                tData,
                                client,
                                0
                              ); //player seats on higher boot value
                            } else {
                              logger.info("SWTL--if--else----------->>>>>");
                              let reqChips = upData.bv * MAX_DEADWOOD_PTS;
                              commonClass.SendDirect(
                                client.uid,
                                {
                                  en: "LeaveTable",
                                  data: {
                                    leave: 1,
                                    si: -1,
                                    winc: 0,
                                    showRate: false,
                                    uid: client.uid,
                                    id: client.id,
                                    tst: "",
                                    tbid: "",
                                    flag: "noChips",
                                    ap: 0,
                                    reqChips: reqChips,
                                  },
                                },
                                true
                              );
                              getInfo.UpdateUserData(
                                client.uid,
                                { $set: { wc: 0 } },
                                function () { }
                              );
                              commonClass.SendData(
                                client,
                                "PopUp",
                                { flag: "noChips" },
                                "error:1020"
                              );
                            }
                          }
                        } else {
                          logger.info(
                            'SwitchTable:::::::::::::::::::::>>> Error : "user not found"'
                          );
                          return false;
                        }
                      }
                    );
                  }
                }
              );
            } else {
              logger.info(
                "SwitchTable::::::::::::::: tbInfo.tst",
                tbInfo.tst,
                "client.tbid",
                client.tbid,
                "client.uid",
                client.uid
              );
              return false;
            }
          });
        }
      );
    });
  } catch (error) {
    logger.error("-----> error SwitchTable", error);
    getInfo.exceptionError(error);
  }
  // console.timeEnd("latency timer SwitchTable");

};

const removeOnLowChips = (
  tbId,
  bv,
  bbv,

  gt,
  px,
  rType,
  tst,
  rSeq,
  game_id,
  rr,
  pt,
  ms,
  iter
) => {
  try {
    /* +-------------------------------------------------------------------+
      desc:this function removes the player who has not sufficient chips to play on table
      i/p: tbId = _id of table, bv = boot value of user,gt = game type of table,px = details of player,rType = robot type,tst = table status,iter = iterator 
    +-------------------------------------------------------------------+ */
    logger.info(
      "removeOnLowChips----------->>>>>>tbId",
      tbId,
      " px: ",
      px +
      " bv: " +
      bv +
      " bbv: " +
      bbv +
      " rType: " +
      rType +
      " pt: " +
      pt +
      " rr: " +
      rr +
      " gt: " +
      gt
    );
    const { MAX_DEADWOOD_PTS, SECONDARY_TIMER } = GetConfig();
    if (iter < px.length) {
      getInfo.GetUserInfo(
        px[iter].uid,
        { Chips: 1, sck: 1, counters: 1, flags: 1, rejoin: 1 },
        function (playerInfo) {
          if (playerInfo) {
            findTableAndJoinClass.isFirstTimeUser(
              playerInfo,
              ms,
              gt,
              function (isSpc) {
                logger.info("removeOnLowChips---if--->>>>");
                let cond = false;
                let msg = "noChips";

                if (px[iter]._ir == 1 && px[iter].rType != rType) {
                  if (rType == "noBot") {
                    msg = "botc";
                  } else {
                    msg = "lvlc";
                  }

                  cond = true;
                }

                let bvv = bv;
                let nbv = bv;
                if (gt == "Deal") {
                  if (tst == "RematchTimerStarted" && px[iter].upc < bv) {
                    cond = true;
                    msg = "noChips";
                  }
                } else if (gt == "Pool") {
                  //low chips condition here
                  // bvv = bv * 3;
                  bvv = bv;
                  nbv = bv;
                  if (tst == "winnerDeclared" && px[iter].upc < bv) {
                    cond = true;
                    msg = "noChips";
                  }

                  logger.info(
                    "removeOnLowChips-------->>>>>dps: " + px[iter].dps
                  );
                  if (px[iter].dps >= pt /*101*/) {
                    //check if the player has total points greater than 100 then remove that player
                    cond = true;
                    msg = "lostPool";
                    getInfo.UpdateUserData(px[iter].uid, {
                      $set: { cAmount: false },
                    });
                  }
                } else {
                  ef = bv * MAX_DEADWOOD_PTS;
                  nbv = bv * MAX_DEADWOOD_PTS;
                  // bvv = ef * 3;
                  bvv = ef;
                  logger.info(
                    "removeOnLowChips-------->>>>>dps: " + px[iter].upc
                  );
                  if (px[iter].upc < bv * MAX_DEADWOOD_PTS) {
                    cond = true;
                  }
                }
                if (cond) {
                  logger.info("removeOnLowChips-------->>>>>msg: " + msg);
                  if (msg == "noChips") {
                    if (playerInfo.Chips >= bvv && playerInfo.rejoin == 0) {
                      collectBootValueClass.collectBootValue(
                        tbId,
                        "practice",
                        gt,
                        0,
                        px[iter].uid,
                        nbv,
                        function (res) {
                          if (!isSpcc) {
                            isSpcc = false;
                          } else if (playerInfo.flags._ir == 0) {
                            isSpcc = isSpc;
                          } else {
                            isSpcc = isSpcc;
                          }
                          removeOnLowChips(
                            tbId,
                            bv,
                            bbv,

                            gt,
                            px,
                            rType,
                            tst,
                            rSeq,
                            game_id,
                            rr,
                            pt,
                            ms,
                            iter + 1
                          );
                        }
                      );
                    } else {
                      logger.info("removeOnLowChips---if---if------>>>>");
                      let single = "";
                      if (
                        typeof playerInfo.sck == "string" &&
                        playerInfo.sck != ""
                      ) {
                        single = playerInfo.sck.replace(/s\d*_\d*./i, "");
                      }

                      leaveTableClass.LeaveTable(
                        { flag: msg },
                        {
                          id: single,
                          uid: px[iter].uid,
                          _ir: px[iter]._ir,
                          si: px[iter].si,
                          tbid: tbId,
                        },
                        function (check) {
                          logger.info(
                            "removeOnLowChips----------->>>check: ",
                            check
                          );
                          removeOnLowChips(
                            tbId,
                            bv,
                            bbv,

                            gt,
                            px,
                            rType,
                            tst,
                            rSeq,
                            game_id,
                            rr,
                            pt,
                            ms,
                            iter + 1
                          );
                        }
                      );
                    }
                  } else {
                    logger.info("removeOnLowChips---if---if------>>>>");
                    let single = "";
                    if (
                      typeof playerInfo.sck == "string" &&
                      playerInfo.sck != ""
                    ) {
                      single = playerInfo.sck.replace(/s\d*_\d*./i, "");
                    }

                    leaveTableClass.LeaveTable(
                      { flag: msg, eliminated: true },
                      {
                        id: single,
                        uid: px[iter].uid,
                        _ir: px[iter]._ir,
                        si: px[iter].si,
                        tbid: tbId,
                      },
                      function (check) {
                        logger.info(
                          "removeOnLowChips----------->>>check: ",
                          check
                        );
                        removeOnLowChips(
                          tbId,
                          bv,
                          bbv,
                          gt,
                          px,
                          rType,
                          tst,
                          rSeq,
                          game_id,
                          rr,
                          pt,
                          ms,
                          iter + 1
                        );
                      }
                    );
                  }
                } else {
                  logger.info("removeOnLowChips---if--else------>>>>");
                  if (isSpcc == false) {
                    isSpcc = false;
                  } else if (playerInfo.flags._ir == 0) {
                    isSpcc = isSpc;
                  } else {
                    isSpcc = isSpcc;
                  }
                  removeOnLowChips(
                    tbId,
                    bv,
                    bbv,

                    gt,
                    px,
                    rType,
                    tst,
                    rSeq,
                    game_id,
                    rr,
                    pt,
                    ms,
                    iter + 1
                  );
                }
              }
            );
          } else {
            logger.info("removeOnLowChips---else1--->>>>");
            removeOnLowChips(
              tbId,
              bv,
              bbv,

              gt,
              px,
              rType,
              tst,
              rSeq,
              game_id,
              rr,
              pt,
              ms,
              iter + 1
            );
          }
        }
      );
    } else {
      getInfo.GetTbInfo(tbId, {}, async function (table1) {
        if (table1) {
          let players = getInfo.getPlayingUserInRound(table1.pi);
          logger.info("removeOnLowChips-- else-->>>>>>>players: ", players);

          if (
            (table1.gt == "Pool" &&
              table1.start_totalap > 3 &&
              table1.ap <= 3 &&
              table1.tst == "roundWinnerDeclared" &&
              table1.round > 1) ||
            (table1.gt == "Pool" &&
              table1.start_totalap == 3 &&
              table1.ap <= 2 &&
              table1.tst == "roundWinnerDeclared" &&
              table1.round > 1)
          ) {
            splitPointClass.SplitData(table1._id.toString());
          } else {


            if (players.length <= 0 && table1.stdP.length == 0) {
              logger.info(
                "removeOnLowChips-------" +
                table1._id +
                '------>>>>"table deleted"'
              );
              db.collection("play_track").updateOne(
                { tbid: table1._id.toString() },
                { $set: { tet: new Date() } },
                function () { }
              );
              db.collection("last_deal").deleteOne(
                { tbid: table1._id.toString() },
                function () { }
              );
              db.collection("playing_table").deleteOne(
                { _id: table1._id },
                function () { }
              );
              db.collection("user_cash_percent").deleteOne(
                { tableId: table1._id },
                function () { }
              );

              // setTimeout(() => {
              //   db.collection("tableHistory").deleteMany({ tableId: getInfo.MongoID(table1._id) });
              // }, 3000);
            } else if (
              table1.gt == "Pool" &&
              players.length == 1 &&
              table1.stdP.length == 0
            ) {
              logger.info(
                "removeOnLowCash-----else--if----" +
                table1._id +
                '------>>>>"table deleted"'
              );
              let player;
              for (let activePlayer of players) {
                if (
                  activePlayer &&
                  !_.isEmpty(activePlayer) &&
                  typeof activePlayer.si != "undefined"
                ) {
                  logger.info(
                    "player.uid----------->",
                    activePlayer.uid,
                    activePlayer.s
                  );
                  player = activePlayer;
                }
              }

              getInfo.GetUserInfo(
                player.uid,
                {
                  tId: 1,
                  flags: 1,
                  counters: 1,
                  Chips: 1,
                  totalcash: 1,
                  depositcash: 1,
                  wincash: 1,
                  bonuscash: 1,
                  cash: 1,
                  sck: 1,
                  rejoin: 1,
                },
                function (playerInfo) {
                  logger.info("playerInfo------------->", playerInfo);
                  let single = "";
                  if (
                    typeof playerInfo.sck == "string" &&
                    playerInfo.sck != ""
                  ) {
                    single = playerInfo.sck.replace(/s\d*_\d*./i, "");
                  }

                  leaveTableClass.LeaveTable(
                    {
                      eliminated: true,
                    },
                    {
                      id: single,
                      uid: player.uid,
                      _ir: player._ir,
                      si: player.si,
                      tbid: tbId,
                    },
                    function (check) {
                      logger.info(
                        "removeOnLowCash-----" + tbId + "------>>>check: ",
                        check
                      );
                    }
                  );
                }
              );
            } else {
              logger.info(
                "removeOnLowChips-----else13131313----->>>>players: ",
                players
              );
              let pi = table1.pi;
              let ap = table1.ap;
              for (let player of pi) {
                if (
                  player &&
                  !_.isEmpty(player) &&
                  typeof player.si != "undefined"
                ) {
                  if (player.s == "left") {
                    // if (player.s == "left" || playerData.rejoin == 1) {
                    //remove left out player data from table

                    pi[player.si] = {};
                    ap--;
                  } else {
                    player.s = "";
                    player.indecl = false;
                    player.tCount = 0;
                    player.cards = [];
                    // player.dn = 0;
                    player._iw = 0;
                    player.gCards = {};
                    player.userShowCard = {};
                    player.dCards = {};
                    player.wc = 0;
                    player.pickCount = 0;
                    player.pts = 0;
                    player.ps = 0;
                    player.tScore = 0;
                    player.play =
                      (table1.round < table1.deals && table1.gt == "Deal") ||
                        (table1.gt == "Pool" &&
                          table1.tst == "roundWinnerDeclared")
                        ? player.play
                        : 0;
                    player.dps =
                      (table1.round < table1.deals && table1.gt == "Deal") ||
                        (table1.gt == "Pool" &&
                          table1.tst == "roundWinnerDeclared")
                        ? player.dps
                        : 0; //only for deal and pool
                    player.tdps =
                      (table1.round < table1.deals && table1.gt == "Deal") ||
                        (table1.gt == "Pool" &&
                          table1.tst == "roundWinnerDeclared")
                        ? player.tdps
                        : table1.deals * MAX_DEADWOOD_PTS; //only for deal and pool
                    player.bet = table1.bv;
                    player.isCollect =
                      (table1.round < table1.deals && table1.gt == "Deal") ||
                        (table1.gt == "Pool" &&
                          table1.tst == "roundWinnerDeclared")
                        ? player.isCollect
                        : 0; //isboot value collected or not
                    player.secTime = SECONDARY_TIMER;
                    player.sct = false;
                    player.tsd = new Date();
                    player.ted = new Date();
                    player.sort = true;
                    player._rematch = 0;
                    player.turnCounter = 0;

                    if (table1.gt == "Deal" && table1.round < table1.deals) {
                      player.tdps = table1.deals * MAX_DEADWOOD_PTS;
                    }

                    pi[player.si] = player;
                  }
                }
              }

              let round =
                (table1.round >= table1.deals && table1.gt == "Deal") ||
                  (table1.gt == "Pool" && table1.tst == "winnerDeclared")
                  ? 0
                  : table1.round;
              let rid =
                (table1.round >= table1.deals && table1.gt == "Deal") ||
                  (table1.gt == "Pool" && table1.tst == "winnerDeclared")
                  ? table1.rid + 1
                  : table1.rid;

              let pv =
                (round > 0 && table1.gt == "Deal") ||
                  (table1.gt == "Pool" && round > 0)
                  ? table1.pv
                  : 0;

              let hist = [];
              if (table1.gt == "Pool" && round > 0) {
                hist = table1.hist.filter(function (htData) {
                  if (htData.s == "left") {
                    return htData;
                  }
                });
              }

              let RobotCount = table1.RobotCount;
              let HumanCount = table1.HumanCount;
              let minS = table1.minS;
              let bv = table1.bv;
              if (table1.gt == "Deal") {
                minS = 2;
              } else if (table1.gt == "Pool") {
                minS = 3;
              } else {
                minS = config.MIN_SEAT_TO_FILL;
              }

              let playersData = getInfo.getPlayingUserInRound(table1.pi);
              let rCount = 0;
              for (let x in playersData) {
                if (playersData[x]._ir == 1) {
                  rCount++;
                }
              }

              minS = rCount + 1;

              logger.info(
                "removeOnLowChips-------------------------------bv" + bv
              );

              getInfo.UpdateTableData(
                table1._id.toString(),
                {
                  $set: {
                    rSeq: 1,
                    tcnt: 0,
                    /*minS:minS,*/ maxBet: 0,
                    bv: bv,
                    _isWinner: 0,
                    dealrmch: 0,
                    _isLeave: 0,
                    tst: "",
                    tie: false,
                    isSpc: isSpcc,
                    rid: rid,
                    round: round /*,jid:jobId*/,
                    ap: ap,
                    pi: pi,
                    pv: pv,
                    trCount: 0,
                    wildCard: "",
                    oDeck: [],
                    declCount: 0,
                    playCount: 0 /*,dNum:0*/,
                    cDeck: [],
                    turn: -1,
                    fnsPlayer: -1,
                    ctt: new Date(),
                    hist: hist,
                    HumanCount: HumanCount,
                    RobotCount: RobotCount,
                    backToTableUser: []
                  },
                },
                function (table2) {
                  if (table2) {
                    logger.info(
                      'removeOnLowChips-------111---->>>>>>"table data reset"',
                      table2._id.toString()
                    );
                    isSpcc = true;
                    roundClass.initializeGame(table2._id.toString());
                  } else {
                    logger.info(
                      'removeOnLowChips-------1---->>>>>>Error:"table not found"'
                    );
                  }
                }
              );
            }
          }
        } else {
          logger.info(
            'removeOnLowChips---------2----------Error:"Table not found"'
          );
        }
      });
    }
  } catch (error) {
    logger.error("-----> error removeOnLowChips", error);
    getInfo.exceptionError(error);
  }
};

const removeOnLowCash = (
  tbId,
  bv,
  bbv,
  gt,
  px,
  rType,
  tst,
  rSeq,
  game_id,
  rr,
  pt,
  ms,
  iter,
  isAnyUserEliminated = []
) => {

  try {
    /* +-------------------------------------------------------------------+
      desc:this function removes the player who has not sufficient chips to play on table
      i/p: tbId = _id of table, bv = boot value of user,gt = game type of table,px = details of player,rType = robot type,tst = table status,iter = iterator 
    +-------------------------------------------------------------------+ */
    logger.info(
      "removeOnLowCash----------->>>>>>tbId" +
      tbId +
      " px: " +
      px +
      " bv: " +
      bv +
      " iter: " +
      iter +
      " rType: " +
      rType +
      " rr: " +
      rr
    );
    logger.info("iter--->", iter, "---px------>", px.length);
    const { POOL_REJOIN_61_POINT_RULE, POOL_REJOIN_101_POINT_RULE, POOL_REJOIN_201_POINT_RULE, MAX_DEADWOOD_PTS, TIME_REJOIN_POOL_TABLE, ROUND_START_TIMER_POOL,
      TIMER_SPLIT, SECONDARY_TIMER, ROUND_START_TIMER } = GetConfig();
    if (iter < px.length) {
      getInfo.GetUserInfo(
        px[iter].uid,
        {
          tId: 1,
          flags: 1,
          counters: 1,
          Chips: 1,
          totalcash: 1,
          depositcash: 1,
          wincash: 1,
          bonuscash: 1,
          cash: 1,
          sck: 1,
          rejoin: 1,
        },
        function (playerInfo) {
          if (playerInfo) {
            findTableAndJoinClass.isFirstTimeUser(
              playerInfo,
              ms,
              gt,
              async function (isSpc) {
                logger.info("isSpc------------->", isSpc);
                logger.info("removeOnLowCash---if--->>>>", isSpc);
                let cond = false;
                let msg = "noChips";

                if (px[iter]._ir == 1 && px[iter].rType != rType) {
                  if (rType == "noBot") {
                    msg = "botc";
                  } else {
                    msg = "lvlc";
                  }

                  cond = true;
                }

                if (gt == "Deal") {
                  if (px[iter]._ir != 1) {
                    let amount = px[iter].upc;
                    logger.info(
                      "removeOnLowCash---if--if------>>>>amount",
                      amount
                    );
                    logger.info("removeOnLowCash---if--if------>>>>bv", bv);
                    logger.info("removeOnLowCash---if--if------>>>>tst", tst);

                    if (
                      tst == "RematchTimerStarted" &&
                      typeof amount != "undefined" &&
                      amount >= bv
                    ) {
                      msg = "noChips";
                      cond = false;
                      logger.info(
                        "removeOnLowCash---if--if--if---->>>>cond",
                        cond
                      );
                    } else {
                      msg = "noChips";
                      cond = true;
                    }

                    if (tst == "roundWinnerDeclared") {
                      msg = "noChips";
                      cond = false;
                    }

                    logger.info("removeOnLowCash---if--if------>>>>cond", cond);

                    if (cond) {
                      logger.info("removeOnLowCash---if---if------>>>>", tbId);

                      if (msg == "noChips") {
                        logger.info(
                          "removeOnLowCash---if---if----nochips-->>>>",
                          tbId
                        );
                        if (typeof amt != "undefined" && amt >= bvv) {
                          collectBootValueClass.collectBootValue(
                            tbId,
                            "cash",
                            gt,
                            px[iter].topup + 1,
                            px[iter].uid,
                            bv,
                            function (res) {
                              removeOnLowCash(
                                tbId,
                                bv,
                                bbv,
                                gt,
                                px,
                                rType,
                                tst,
                                rSeq,
                                game_id,
                                rr,
                                pt,
                                ms,
                                iter + 1,
                                isAnyUserEliminated
                              );
                            }
                          );
                        } else {
                          let single = "";
                          if (
                            typeof playerInfo.sck == "string" &&
                            playerInfo.sck != ""
                          ) {
                            single = playerInfo.sck.replace(/s\d*_\d*./i, "");
                          }

                          leaveTableClass.LeaveTable(
                            { flag: msg },
                            {
                              id: single,
                              uid: px[iter].uid,
                              _ir: px[iter]._ir,
                              si: px[iter].si,
                              tbid: tbId,
                            },
                            function (check) {
                              logger.info(
                                "removeOnLowCash-----" +
                                tbId +
                                "------>>>check: ",
                                check
                              );
                              removeOnLowCash(
                                tbId,
                                bv,
                                bbv,
                                gt,
                                px,
                                rType,
                                tst,
                                rSeq,
                                game_id,
                                rr,
                                pt,
                                ms,
                                iter + 1,
                                isAnyUserEliminated
                              );
                            }
                          );
                        }
                      } else {
                        let single = "";
                        if (
                          typeof playerInfo.sck == "string" &&
                          playerInfo.sck != ""
                        ) {
                          single = playerInfo.sck.replace(/s\d*_\d*./i, "");
                        }

                        leaveTableClass.LeaveTable(
                          { flag: msg },
                          {
                            id: single,
                            uid: px[iter].uid,
                            _ir: px[iter]._ir,
                            si: px[iter].si,
                            tbid: tbId,
                          },
                          function (check) {
                            logger.info(
                              "removeOnLowCash-----" +
                              tbId +
                              "------>>>check: ",
                              check
                            );
                            removeOnLowCash(
                              tbId,
                              bv,
                              bbv,
                              gt,
                              px,
                              rType,
                              tst,
                              rSeq,
                              game_id,
                              rr,
                              pt,
                              ms,
                              iter + 1,
                              isAnyUserEliminated
                            );
                          }
                        );
                      }
                    } else {
                      logger.info("removeOnLowCash---if--else------>>>>", tbId);
                      if (isSpcCash == false) {
                        isSpcCash = false;
                      } else if (playerInfo.flags._ir == 0) {
                        isSpcCash = isSpc;
                      } else {
                        isSpcCash = isSpcCash;
                      }
                      removeOnLowCash(
                        tbId,
                        bv,
                        bbv,
                        gt,
                        px,
                        rType,
                        tst,
                        rSeq,
                        game_id,
                        rr,
                        pt,
                        ms,
                        iter + 1,
                        isAnyUserEliminated
                      );
                    }
                  } else {
                    let amount = px[iter].upc;
                    if (amount >= bv) {
                      msg = "noChips";
                      cond = false;
                    } else {
                      msg = "noChips";
                      cond = true;
                    }

                    if (tst == "roundWinnerDeclared") {
                      msg = "noChips";
                      cond = false;
                    }

                    if (cond) {
                      if (msg == "noChips") {
                        let bvv = bv;
                        if (playerInfo.totalcash >= bvv) {
                          collectBootValueClass.collectBootValue(
                            tbId,
                            "cash",
                            gt,
                            px[iter].topup + 1,
                            px[iter].uid,
                            bv,
                            function (res) {
                              removeOnLowCash(
                                tbId,
                                bv,
                                bbv,
                                gt,
                                px,
                                rType,
                                tst,
                                rSeq,
                                game_id,
                                rr,
                                pt,
                                ms,
                                iter + 1,
                                isAnyUserEliminated
                              );
                            }
                          );
                        } else {
                          logger.info(
                            "removeOnLowCash---if---if------>>>>",
                            tbId
                          );
                          let single = "";
                          if (
                            typeof playerInfo.sck == "string" &&
                            playerInfo.sck != ""
                          ) {
                            single = playerInfo.sck.replace(/s\d*_\d*./i, "");
                          }

                          leaveTableClass.LeaveTable(
                            { flag: msg },
                            {
                              id: single,
                              uid: px[iter].uid,
                              _ir: px[iter]._ir,
                              si: px[iter].si,
                              tbid: tbId,
                            },
                            function (check) {
                              logger.info(
                                "removeOnLowCash-----" +
                                tbId +
                                "------>>>check: ",
                                check
                              );
                              removeOnLowCash(
                                tbId,
                                bv,
                                bbv,
                                gt,
                                px,
                                rType,
                                tst,
                                rSeq,
                                game_id,
                                rr,
                                pt,
                                ms,
                                iter + 1,
                                isAnyUserEliminated
                              );
                            }
                          );
                        }
                      } else {
                        logger.info(
                          "removeOnLowCash---if---if------>>>>",
                          tbId
                        );
                        let single = "";
                        if (
                          typeof playerInfo.sck == "string" &&
                          playerInfo.sck != ""
                        ) {
                          single = playerInfo.sck.replace(/s\d*_\d*./i, "");
                        }

                        leaveTableClass.LeaveTable(
                          { flag: msg },
                          {
                            id: single,
                            uid: px[iter].uid,
                            _ir: px[iter]._ir,
                            si: px[iter].si,
                            tbid: tbId,
                          },
                          function (check) {
                            logger.info(
                              "removeOnLowCash----------->>>check: ",
                              check
                            );
                            removeOnLowCash(
                              tbId,
                              bv,
                              bbv,
                              gt,
                              px,
                              rType,
                              tst,
                              rSeq,
                              game_id,
                              rr,
                              pt,
                              ms,
                              iter + 1,
                              isAnyUserEliminated
                            );
                          }
                        );
                      }
                    } else {
                      logger.info("removeOnLowCash---if--else------>>>>", tbId);
                      removeOnLowCash(
                        tbId,
                        bv,
                        bbv,
                        gt,
                        px,
                        rType,
                        tst,
                        rSeq,
                        game_id,
                        rr,
                        pt,
                        ms,
                        iter + 1,
                        isAnyUserEliminated
                      );
                    }
                  }
                } else if (gt == "Pool") {
                  //low chips condition here
                  logger.info("bv------------->", bv);
                  let cb = bv / 100;
                  logger.info("cb----------->", cb, px[iter]._ir);
                  if (px[iter]._ir != 1) {
                    let amount = px[iter].upc;
                    // bv = bv*2;
                    logger.info("px[iter].upc----------->", amount, bv, tst);
                    logger.info("amount >= bv------->", amount >= bv);
                    if (
                      tst == "winnerDeclared" &&
                      typeof amount != "undefined" &&
                      amount >= bv
                    ) {
                      logger.info("in--ifiiii---------");
                      msg = "noChips";
                      cond = false;
                    } else {
                      logger.info("in else----------");
                      msg = "noChips";
                      cond = true;
                    }

                    if (tst == "roundWinnerDeclared") {
                      logger.info("in--ifiiii-----1----");
                      msg = "noChips";
                      cond = false;
                    }
                    logger.info(
                      "removeOnLowCash----" +
                      tbId +
                      "---->>>>>dps: " +
                      px[iter].dps
                    );
                    logger.info("px[iter].dps------------->", px[iter].dps);
                    logger.info(
                      "pt---------------->",
                      pt,
                      "px----------->",
                      px[iter].uid
                    );
                    if (px[iter].dps >= pt /*101*/) {
                      logger.info("in if------------->");
                      //check if the player has total points greater than 100 then remove that player
                      cond = true;
                      msg = "lostPool";
                      getInfo.UpdateUserData(px[iter].uid, {
                        $set: { cAmount: false },
                      });
                    }
                    logger.info("cond------------->", cond, msg);
                    if (cond) {
                      logger.info("removeOnLowCash---if---if------>>>>", tbId);

                      if (msg == "noChips") {
                        logger.info(
                          "removeOnLowCash---if---if----nochips-->>>>",
                          tbId
                        );
                        let bvv = bv;
                        logger.info("bvv------------>", bvv);
                        let amt = px[iter].totalCash;
                        if (typeof amt != "undefined" && amt >= bvv) {
                          logger.info("in--------------->");
                          let jiid = commonClass.GetRandomString(10);
                          db.collection("playing_table").updateOne(
                            {
                              _id: getInfo.MongoID(tbId),
                              "pi.uid": px[iter].uid,
                            },
                            {
                              $set: {
                                addtime: true,
                                "pi.$.jiid": jiid,
                                "pi.$.pco": true,
                              },
                            },
                            function () {
                              // let nxt = commonClass.AddTime(config.CASHCUT_TIMER);
                              // schedule.scheduleJob(
                              //   jiid,
                              //   new Date(nxt),
                              //   function () {
                              //     schedule.cancelJob(jiid);
                              logger.info(
                                "removeOnLowCash---if---if------>>>>"
                              );
                              let single = "";
                              if (typeof playerInfo.sck == "string" && playerInfo.sck != "") {
                                single = playerInfo.sck.replace(
                                  /s\d*_\d*./i,
                                  ""
                                );
                              }

                              leaveTableClass.LeaveTable(
                                { flag: msg, eliminated: true },
                                {
                                  id: single,
                                  uid: px[iter].uid,
                                  _ir: px[iter]._ir,
                                  si: px[iter].si,
                                  tbid: tbId,
                                },
                                function (check) {
                                  logger.info(
                                    "removeOnLowCash----------->>>check: ",
                                    check
                                  );
                                }
                              );
                              //   }
                              // );

                              removeOnLowCash(
                                tbId,
                                bv,
                                bbv,
                                gt,
                                px,
                                rType,
                                tst,
                                rSeq,
                                game_id,
                                rr,
                                pt,
                                ms,
                                iter + 1,
                                isAnyUserEliminated
                              );
                            }
                          );
                        } else {
                          let single = "";
                          if (
                            typeof playerInfo.sck == "string" &&
                            playerInfo.sck != ""
                          ) {
                            single = playerInfo.sck.replace(/s\d*_\d*./i, "");
                          }

                          leaveTableClass.LeaveTable(
                            { flag: msg },
                            {
                              id: single,
                              uid: px[iter].uid,
                              _ir: px[iter]._ir,
                              si: px[iter].si,
                              tbid: tbId,
                            },
                            function (check) {
                              logger.info(
                                "removeOnLowCash-----" +
                                tbId +
                                "------>>>check: ",
                                check
                              );
                              removeOnLowCash(
                                tbId,
                                bv,
                                bbv,
                                gt,
                                px,
                                rType,
                                tst,
                                rSeq,
                                game_id,
                                rr,
                                pt,
                                ms,
                                iter + 1,
                                isAnyUserEliminated
                              );
                            }
                          );
                        }
                      } else {
                        let table = await db
                          .collection("playing_table")
                          .findOne({ _id: getInfo.MongoID(tbId) });

                        let single = "";
                        if (
                          typeof playerInfo.sck == "string" &&
                          playerInfo.sck != ""
                        ) {
                          single = playerInfo.sck.replace(/s\d*_\d*./i, "");
                        }

                        let isActiveRejoinPopup = true;
                        let isEliminatedCount = 0;
                        for (const piElement of table.pi) {
                          if (table.pt === 61 && piElement.dps > POOL_REJOIN_61_POINT_RULE && px[iter].uid !== piElement.uid && piElement.dps < table.pt) {
                            isActiveRejoinPopup = false;
                          } else if (table.pt === 101 && piElement.dps > POOL_REJOIN_101_POINT_RULE && px[iter].uid !== piElement.uid && piElement.dps < table.pt) {
                            isActiveRejoinPopup = false;
                          } else if (table.pt === 201 && piElement.dps > POOL_REJOIN_201_POINT_RULE && px[iter].uid !== piElement.uid && piElement.dps < table.pt) {
                            isActiveRejoinPopup = false;
                          }

                          if (table.pt === 61 && piElement.dps <= POOL_REJOIN_61_POINT_RULE) {
                            isEliminatedCount += 1;
                          } else if (table.pt === 101 && piElement.dps <= POOL_REJOIN_101_POINT_RULE) {
                            isEliminatedCount += 1;
                          } else if (table.pt === 201 && piElement.dps <= POOL_REJOIN_201_POINT_RULE) {
                            isEliminatedCount += 1;
                          }
                        }

                        if (
                          tst == "roundWinnerDeclared" &&
                          isActiveRejoinPopup &&
                          table.start_totalap > 2 &&
                          table.ap > 2 &&
                          isEliminatedCount >= 2
                        ) {
                          isAnyUserEliminated.push(px[iter].uid);
                          const resp = await db
                            .collection("playing_table")
                            .findAndModify(
                              {
                                _id: getInfo.MongoID(tbId),
                                "pi.uid": px[iter].uid,
                              },
                              {},
                              {
                                $set: {
                                  "pi.$.isRejoinPopup": true,
                                  "pi.$.isRejoinPopupTime": new Date(),
                                },
                                $push: { rejoinUsers: px[iter].uid },
                              },
                              { new: true }
                            );
                          if (resp && resp?.value) {
                            rejoinClass.sendRejoinPopUp(
                              { flag: msg },
                              {
                                id: single,
                                uid: px[iter].uid,
                                _ir: px[iter]._ir,
                                si: px[iter].si,
                                tbid: tbId,
                              },
                              tst,
                              isActiveRejoinPopup
                            );
                            removeOnLowCash(
                              tbId,
                              bv,
                              bbv,
                              gt,
                              px,
                              rType,
                              tst,
                              rSeq,
                              game_id,
                              rr,
                              pt,
                              ms,
                              iter + 1,
                              isAnyUserEliminated
                            );
                          }
                        } else {
                          //fix "Last round has been finished....." popup
                          await db
                            .collection("game_users")
                            .findOneAndUpdate(
                              { _id: getInfo.MongoID(px[iter].uid) },
                              { $set: { tableRemove: true } }
                            );
                          leaveTableClass.LeaveTable(
                            { flag: msg, eliminated: true },
                            {
                              id: single,
                              uid: px[iter].uid,
                              _ir: px[iter]._ir,
                              si: px[iter].si,
                              tbid: tbId,
                            },
                            function (check) {
                              logger.info(
                                "removeOnLowCash-----" +
                                tbId +
                                "------>>>check: ",
                                check
                              );
                              removeOnLowCash(
                                tbId,
                                bv,
                                bbv,
                                gt,
                                px,
                                rType,
                                tst,
                                rSeq,
                                game_id,
                                rr,
                                pt,
                                ms,
                                iter + 1,
                                isAnyUserEliminated
                              );
                            }
                          );
                        }
                      }
                    } else {
                      logger.info("removeOnLowCash---if--else------>>>>", tbId);
                      if (!isSpcCash) {
                        isSpcCash = false;
                      } else if (playerInfo.flags._ir == 0) {
                        isSpcCash = isSpc;
                      } else {
                        isSpcCash = isSpcCash;
                      }
                      logger.info("isSpcCash----------->", isSpcCash);
                      removeOnLowCash(
                        tbId,
                        bv,
                        bbv,
                        gt,
                        px,
                        rType,
                        tst,
                        rSeq,
                        game_id,
                        rr,
                        pt,
                        ms,
                        iter + 1,
                        isAnyUserEliminated
                      );
                    }
                  } else {
                    logger.info("in------else-----------");
                    let amount = px[iter].upc;
                    logger.info("amount >= bv---->", amount >= bv);
                    if (amount >= bv) {
                      msg = "noChips";
                      cond = false;
                    } else {
                      msg = "noChips";
                      cond = true;
                    }
                    logger.info("msg--------->", msg, cond);
                    logger.info("tst----------------->", tst);
                    if (tst == "roundWinnerDeclared") {
                      msg = "noChips";
                      cond = false;
                    }
                    logger.info(
                      "removeOnLowCash-----" +
                      tbId +
                      "--->>>>>dps: " +
                      px[iter].dps
                    );
                    logger.info("pt------------>", pt);
                    logger.info(
                      "px[iter].dps >= pt---------->",
                      px[iter].dps >= pt
                    );
                    if (px[iter].dps >= pt /*101*/) {
                      //check if the player has total points greater than 100 then remove that player
                      cond = true;
                      msg = "lostPool";
                    }

                    if (cond) {
                      if (msg == "noChips") {
                        let bvv = bv;
                        logger.info("bvv----?", bv);
                        if (playerInfo.totalcash >= bvv) {
                          // leave table
                          collectBootValueClass.collectBootValue(
                            tbId,
                            "cash",
                            gt,
                            px[iter].topup + 1,
                            px[iter].uid,
                            bv,
                            function (res) {
                              removeOnLowCash(
                                tbId,
                                bv,
                                bbv,
                                gt,
                                px,
                                rType,
                                tst,
                                rSeq,
                                game_id,
                                rr,
                                pt,
                                ms,
                                iter + 1,
                                isAnyUserEliminated
                              );
                            }
                          );
                        } else {
                          logger.info(
                            "removeOnLowCash---if---if------>>>>",
                            tbId
                          );
                          let single = "";
                          if (
                            typeof playerInfo.sck == "string" &&
                            playerInfo.sck != ""
                          ) {
                            single = playerInfo.sck.replace(/s\d*_\d*./i, "");
                          }

                          leaveTableClass.LeaveTable(
                            { flag: msg },
                            {
                              id: single,
                              uid: px[iter].uid,
                              _ir: px[iter]._ir,
                              si: px[iter].si,
                              tbid: tbId,
                            },
                            function (check) {
                              logger.info(
                                "removeOnLowCash-----" +
                                tbId +
                                "------>>>check: ",
                                check
                              );
                              removeOnLowCash(
                                tbId,
                                bv,
                                bbv,
                                gt,
                                px,
                                rType,
                                tst,
                                rSeq,
                                game_id,
                                rr,
                                pt,
                                ms,
                                iter + 1,
                                isAnyUserEliminated
                              );
                            }
                          );
                        }
                      } else {
                        logger.info(
                          "removeOnLowCash---if---if------>>>>",
                          tbId
                        );
                        let single = "";
                        if (
                          typeof playerInfo.sck == "string" &&
                          playerInfo.sck != ""
                        ) {
                          single = playerInfo.sck.replace(/s\d*_\d*./i, "");
                        }

                        leaveTableClass.LeaveTable(
                          { flag: msg, eliminated: true },
                          {
                            id: single,
                            uid: px[iter].uid,
                            _ir: px[iter]._ir,
                            si: px[iter].si,
                            tbid: tbId,
                          },
                          function (check) {
                            logger.info(
                              "removeOnLowCash----------->>>check: ",
                              check
                            );
                            removeOnLowCash(
                              tbId,
                              bv,
                              bbv,
                              gt,
                              px,
                              rType,
                              tst,
                              rSeq,
                              game_id,
                              rr,
                              pt,
                              ms,
                              iter + 1,
                              isAnyUserEliminated
                            );
                          }
                        );
                      }
                    } else {
                      logger.info("removeOnLowCash---if--else------>>>>", tbId);
                      removeOnLowCash(
                        tbId,
                        bv,
                        bbv,
                        gt,
                        px,
                        rType,
                        tst,
                        rSeq,
                        game_id,
                        rr,
                        pt,
                        ms,
                        iter + 1,
                        isAnyUserEliminated
                      );
                    }
                  }
                } else {
                  let minbv = bv;

                  let ef = minbv * MAX_DEADWOOD_PTS;
                  if (px[iter]._ir != 1) {
                    let amount = px[iter].upc;
                    if (typeof amount != "undefined" && amount >= ef) {
                      cond = false;
                    } else {
                      cond = true;
                    }

                    if (cond) {
                      if (msg == "noChips") {
                        let neededAmount = ef - amount;

                        const tableDetails = await db
                          .collection("playing_table")
                          .findOne(
                            {
                              _id: getInfo.MongoID(tbId),
                            },
                            { projection: { categoryId: 1 } }
                          );

                        let cutBonus = 0;
                        const category = await db
                          .collection("point_category")
                          .findOne(
                            {
                              _id: getInfo.MongoID(tableDetails.categoryId),
                            },
                            { projection: { bonus: 1 } }
                          );
                        cutBonus = category.bonus ? +category.bonus : 0;

                        let { playable } = await cashCut({
                          userInfo: playerInfo,
                          entryFee: neededAmount,
                          tableId: tbId,
                          cutBonus,
                          getList: true,
                        });
                        ef1 = ef;
                        // playerInfo.Chips >= bvv
                        if (
                          playable &&
                          playerInfo.totalcash >= neededAmount &&
                          playerInfo.rejoin == 0
                        ) {
                          collectBootValueClass.collectBootValue(
                            tbId,
                            "cash",
                            gt,
                            px[iter].topup + 1,
                            px[iter].uid,
                            neededAmount,
                            function (res) {
                              // update change for cash cut
                              removeOnLowCash(
                                tbId,
                                bv,
                                bbv,
                                gt,
                                px,
                                rType,
                                tst,
                                rSeq,
                                game_id,
                                rr,
                                pt,
                                ms,
                                iter + 1,
                                isAnyUserEliminated
                              );
                            }
                          );
                        } else {
                          logger.info("removeOnLowCash---if---if------>>>>");
                          let single = "";
                          if (
                            typeof playerInfo.sck == "string" &&
                            playerInfo.sck != ""
                          ) {
                            single = playerInfo.sck.replace(/s\d*_\d*./i, "");
                          }

                          leaveTableClass.LeaveTable(
                            { flag: msg },
                            {
                              id: single,
                              uid: px[iter].uid,
                              _ir: px[iter]._ir,
                              si: px[iter].si,
                              tbid: tbId,
                            },
                            function (check) {
                              logger.info(
                                "removeOnLowCash----------->>>check: ",
                                check
                              );
                              removeOnLowCash(
                                tbId,
                                bv,
                                bbv,
                                gt,
                                px,
                                rType,
                                tst,
                                rSeq,
                                game_id,
                                rr,
                                pt,
                                ms,
                                iter + 1,
                                isAnyUserEliminated
                              );
                            }
                          );
                        }
                      } else {
                        logger.info("removeOnLowCash---if---if------>>>>");
                        let single = "";
                        if (
                          typeof playerInfo.sck == "string" &&
                          playerInfo.sck != ""
                        ) {
                          single = playerInfo.sck.replace(/s\d*_\d*./i, "");
                        }

                        leaveTableClass.LeaveTable(
                          { flag: msg },
                          {
                            id: single,
                            uid: px[iter].uid,
                            _ir: px[iter]._ir,
                            si: px[iter].si,
                            tbid: tbId,
                          },
                          function (check) {
                            logger.info(
                              "removeOnLowCash----------->>>check: ",
                              check
                            );
                            removeOnLowCash(
                              tbId,
                              bv,
                              bbv,
                              gt,
                              px,
                              rType,
                              tst,
                              rSeq,
                              game_id,
                              rr,
                              pt,
                              ms,
                              iter + 1,
                              isAnyUserEliminated
                            );
                          }
                        );
                      }
                    } else {
                      logger.info("removeOnLowCash---if--else------>>>>");
                      if (!isSpcCash) {
                        isSpcCash = false;
                      } else if (playerInfo.flags._ir == 0) {
                        isSpcCash = isSpc;
                      } else {
                        isSpcCash = isSpcCash;
                      }
                      removeOnLowCash(
                        tbId,
                        bv,
                        bbv,
                        gt,
                        px,
                        rType,
                        tst,
                        rSeq,
                        game_id,
                        rr,
                        pt,
                        ms,
                        iter + 1,
                        isAnyUserEliminated
                      );
                    }

                    // })
                  } else {
                    let amount = px[iter].upc;
                    // 03-05-2023 requirement as par client
                    // every time we remove bots
                    msg = "botc";
                    if (msg != "botc") {
                      if (amount >= ef) {
                        msg = "noChips";
                        cond = false;
                      } else {
                        msg = "noChips";
                        cond = true;
                      }
                    } else {
                      cond = true;
                    }

                    if (cond) {
                      if (msg == "noChips") {
                        let ef1 = ef;
                        if (playerInfo.totalcash >= ef1) {
                          collectBootValueClass.collectBootValue(
                            tbId,
                            "cash",
                            gt,
                            px[iter].topup + 1,
                            px[iter].uid,
                            ef,
                            function (res) {
                              removeOnLowCash(
                                tbId,
                                bv,
                                bbv,
                                gt,
                                px,
                                rType,
                                tst,
                                rSeq,
                                game_id,
                                rr,
                                pt,
                                ms,
                                iter + 1,
                                isAnyUserEliminated
                              );
                            }
                          );
                        } else {
                          logger.info("removeOnLowCash---if---if------>>>>");
                          let single = "";
                          if (
                            typeof playerInfo.sck == "string" &&
                            playerInfo.sck != ""
                          ) {
                            single = playerInfo.sck.replace(/s\d*_\d*./i, "");
                          }

                          leaveTableClass.LeaveTable(
                            { flag: msg },
                            {
                              id: single,
                              uid: px[iter].uid,
                              _ir: px[iter]._ir,
                              si: px[iter].si,
                              tbid: tbId,
                            },
                            function (check) {
                              logger.info(
                                "removeOnLowCash----------->>>check: ",
                                check
                              );
                              removeOnLowCash(
                                tbId,
                                bv,
                                bbv,
                                gt,
                                px,
                                rType,
                                tst,
                                rSeq,
                                game_id,
                                rr,
                                pt,
                                ms,
                                iter + 1,
                                isAnyUserEliminated
                              );
                            }
                          );
                        }
                      } else {
                        logger.info("removeOnLowCash---if---if------>>>>");
                        let single = "";
                        if (
                          typeof playerInfo.sck == "string" &&
                          playerInfo.sck != ""
                        ) {
                          single = playerInfo.sck.replace(/s\d*_\d*./i, "");
                        }

                        leaveTableClass.LeaveTable(
                          { flag: msg, eliminated: true },
                          {
                            id: single,
                            uid: px[iter].uid,
                            _ir: px[iter]._ir,
                            si: px[iter].si,
                            tbid: tbId,
                          },
                          function (check) {
                            logger.info(
                              "removeOnLowCash----------->>>check: ",
                              check
                            );
                            removeOnLowCash(
                              tbId,
                              bv,
                              bbv,
                              gt,
                              px,
                              rType,
                              tst,
                              rSeq,
                              game_id,
                              rr,
                              pt,
                              ms,
                              iter + 1,
                              isAnyUserEliminated
                            );
                          }
                        );
                      }
                    } else {
                      logger.info("removeOnLowCash---if--else------>>>>");
                      removeOnLowCash(
                        tbId,
                        bv,
                        bbv,

                        gt,
                        px,
                        rType,
                        tst,
                        rSeq,
                        game_id,
                        rr,
                        pt,
                        ms,
                        iter + 1,
                        isAnyUserEliminated
                      );
                    }
                  }
                }
              }
            );
          } else {
            logger.info("removeOnLowCash---else1--->>>>");
            removeOnLowCash(
              tbId,
              bv,
              bbv,
              gt,
              px,
              rType,
              tst,
              rSeq,
              game_id,
              rr,
              pt,
              ms,
              iter + 1,
              isAnyUserEliminated
            );
          }
        }
      );
    } else {
      getInfo.GetTbInfo(tbId, {}, async function (table1) {
        if (table1) {
          let players = getInfo.getPlayingUserInRound(table1.pi);
          logger.info(
            "removeOnLowCash--" + tbId + " else-->>>>>>>players: ",
            players
          );
          // logger.info("players-------->", players);
          logger.info(
            "length------->" +
            players.length +
            "------------>" +
            table1.stdP.length
          );
          logger.info("players.length <= 0----------->", players.length <= 0);
          logger.info(
            "isAnyUserEliminated.length--->",
            isAnyUserEliminated.length
          );
          if (gt === "Pool" && isAnyUserEliminated.length > 0) {
            let timerOfNewGame = TIME_REJOIN_POOL_TABLE ?? 20;
            timerOfNewGame += ROUND_START_TIMER_POOL;
            const checkSplit = await splitPointClass.isSplit(table1._id.toString(), isAnyUserEliminated);
            if (checkSplit) {
              timerOfNewGame += TIMER_SPLIT ?? 20;
              timerOfNewGame -= ROUND_START_TIMER_POOL;
            }

            commonClass.FireEventToTable(table1._id.toString(), {
              en: "REJOIN_WAIT_POPUP",
              data: {
                uid: isAnyUserEliminated,
                time: timerOfNewGame,
                msg: "Wait for other players",
              },
            });

            await db.collection("playing_table").findAndModify(
              { _id: getInfo.MongoID(tbId) },
              {},
              {
                $set: {
                  isRejoinAndSliptPopupTime: timerOfNewGame,
                  isRejoinPopupTime: new Date(),
                },
              },
              { new: true }
            );


          } else if (
            (table1.gt == "Pool" &&
              table1.start_totalap > 3 &&
              table1.ap <= 3 &&
              table1.tst == "roundWinnerDeclared" &&
              table1.round > 1) ||
            (table1.gt == "Pool" &&
              table1.start_totalap == 3 &&
              table1.ap <= 2 &&
              table1.tst == "roundWinnerDeclared" &&
              table1.round > 1)
          ) {
            splitPointClass.SplitData(table1._id.toString());
          } else {

            if (players.length <= 0 && table1.stdP.length == 0) {
              logger.info(
                "removeOnLowCash-------" +
                table1._id +
                '------>>>>"table deleted"'
              );
              db.collection("play_track").updateOne(
                { tbid: table1._id.toString() },
                { $set: { tet: new Date() } },
                function () { }
              );
              db.collection("playing_table").deleteOne(
                { _id: table1._id.toString() },
                function () { }
              );
              db.collection("user_cash_percent").deleteOne(
                { tableId: table1._id },
                function () { }
              );

              db.collection("last_deal").deleteOne(
                { tbid: table1._id },
                function () { }
              );

              // setTimeout(() => {
              //   db.collection("tableHistory").deleteMany({ tableId: getInfo.MongoID(table1._id) });
              // }, 3000);

            } else if (
              table1.gt == "Pool" &&
              players.length == 1 &&
              table1.tst == "winnerDeclared" &&
              table1.stdP.length == 0
            ) {
              logger.info(
                "removeOnLowCash-----else--if----" +
                table1._id +
                '------>>>>"table deleted"'
              );
              let player;
              for (let activePlayer of players) {
                if (
                  activePlayer &&
                  !_.isEmpty(activePlayer) &&
                  typeof activePlayer.si != "undefined"
                ) {
                  logger.info(
                    "player.uid----------->",
                    activePlayer.uid,
                    activePlayer.s
                  );
                  player = activePlayer;
                }
              }

              getInfo.GetUserInfo(
                player.uid,
                {
                  tId: 1,
                  Chips: 1,
                  totalcash: 1,
                  depositcash: 1,
                  wincash: 1,
                  bonuscash: 1,
                  cash: 1,
                  sck: 1,
                  rejoin: 1,
                },
                async function (playerInfo) {
                  logger.info("playerInfo------------->", playerInfo);
                  let single = "";
                  if (
                    typeof playerInfo.sck == "string" &&
                    playerInfo.sck != ""
                  ) {
                    single = playerInfo.sck.replace(/s\d*_\d*./i, "");
                  }

                  await db
                    .collection("game_users")
                    .findOneAndUpdate(
                      { _id: getInfo.MongoID(playerInfo._id) },
                      { $set: { tableRemove: true } }
                    );

                  leaveTableClass.LeaveTable(
                    {
                      eliminated: true,
                    },
                    {
                      id: single,
                      uid: player.uid,
                      _ir: player._ir,
                      si: player.si,
                      tbid: tbId,
                    },
                    function (check) {
                      logger.info(
                        "removeOnLowCash-----" + tbId + "------>>>check: ",
                        check
                      );
                    }
                  );
                }
              );
            } else {
              let { pi, ap } = table1;
              for (let player of pi) {
                if (
                  player &&
                  !_.isEmpty(player) &&
                  typeof player.si != "undefined"
                ) {
                  logger.info("player.uid----------->", player.uid, player.s);

                  if (player.s == "left") {
                    //remove left out player data from table
                    pi[player.si] = {};
                    ap--;
                  } else {
                    player.s = "";
                    player.indecl = false;
                    player.tCount = 0;
                    player.cards = [];
                    // player.dn = 0;
                    player._iw = 0;
                    player.gCards = {};
                    player.userShowCard = {};
                    player.dCards = {};
                    player.wc = 0;
                    player.pickCount = 0;
                    player.pts = 0;
                    player.ps = 0;
                    player.tScore = 0;
                    player.play =
                      (table1.round < table1.deals && table1.gt == "Deal") ||
                        (table1.gt == "Pool" &&
                          table1.tst == "roundWinnerDeclared")
                        ? player.play
                        : 0;
                    player.dps =
                      (table1.round < table1.deals && table1.gt == "Deal") ||
                        (table1.gt == "Pool" &&
                          table1.tst == "roundWinnerDeclared")
                        ? player.dps
                        : 0; //only for deal and pool
                    player.tdps =
                      (table1.round < table1.deals && table1.gt == "Deal") ||
                        (table1.gt == "Pool" &&
                          table1.tst == "roundWinnerDeclared")
                        ? player.tdps
                        : table1.deals * MAX_DEADWOOD_PTS; //only for deal and pool
                    player.bet = table1.bv;
                    player.isCollect =
                      (table1.round < table1.deals && table1.gt == "Deal") ||
                        (table1.gt == "Pool" &&
                          table1.tst == "roundWinnerDeclared")
                        ? player.isCollect
                        : 0; //isboot value collected or not
                    player.secTime = SECONDARY_TIMER;
                    player.sct = false;
                    player.tsd = new Date();
                    player.ted = new Date();
                    player.sort = true;
                    player._rematch = 0;
                    player.turnCounter = 0;

                    pi[player.si] = player;
                  }
                }
              }

              let round =
                (table1.round >= table1.deals && table1.gt == "Deal") ||
                  (table1.gt == "Pool" && table1.tst == "winnerDeclared")
                  ? 0
                  : table1.round;
              let rid =
                (table1.round >= table1.deals && table1.gt == "Deal") ||
                  (table1.gt == "Pool" && table1.tst == "winnerDeclared")
                  ? table1.rid + 1
                  : table1.rid;

              let pv =
                (round > 0 && table1.gt == "Deal") ||
                  (table1.gt == "Pool" && round > 0)
                  ? table1.pv
                  : 0;

              let hist = [];
              if (
                /*table1.gt == 'Deal' || */ table1.gt == "Pool" &&
                round > 0
              ) {
                hist = table1.hist.filter(function (htData) {
                  if (htData.s == "left") {
                    return htData;
                  }
                });
              }

              let { RobotCount, HumanCount, minS, bv } = table1;
              if (table1.gt == "Deal") {
                minS = 2;
              } else if (table1.gt == "Pool") {
                minS = 3;
              } else {
                minS = config.MIN_SEAT_TO_FILL;
              }


              logger.info("removeOnLowCash--------***-------" + tbId);

              let players = getInfo.getPlayingUserInRound(table1.pi);
              let rCount = 0;
              for (let x in players) {
                if (players[x]._ir == 1) {
                  rCount++;
                }
              }

              minS = rCount + 1;

              logger.info(
                "removeOnLowCash-------------" +
                tbId +
                "------------------minS" +
                minS
              );

              let jId = commonClass.GetRandomString(10);

              logger.info(
                "removeOnLowCash-------------" +
                tbId +
                "------isSpcCash------" +
                isSpcCash
              );

              getInfo.UpdateTableData(
                table1._id.toString(),
                {
                  $set: {
                    rSeq: 1,
                    njid: jId,
                    tcnt: 0,
                    /*minS:minS,*/ maxBet: 0,
                    dealrmch: 0,
                    isSpc: isSpcCash,
                    bv: bv,
                    _isWinner: 0,
                    _isLeave: 0,
                    tst: "",
                    tie: false,
                    rid: rid,
                    round: round /*,jid:jobId*/,
                    ap: ap,
                    pi: pi,
                    pv: pv,
                    wildCard: "",
                    oDeck: [],
                    declCount: 0,
                    playCount: 0 /*,dNum:0*/,
                    cDeck: [],
                    trCount: 0,
                    turn: -1,
                    fnsPlayer: -1,
                    ctt: new Date(),
                    hist: hist,
                    HumanCount: HumanCount,
                    RobotCount: RobotCount,
                    backToTableUser: []
                  },
                },
                function (table2) {
                  if (table2) {
                    logger.info(
                      "removeOnLowCash-------------:" +
                      tbId +
                      "---after update table data-----table2.tst:",
                      table2.tst
                    );
                    isSpcCash = true;
                    logger.info("table2-------->", table2);
                    roundClass.initializeGame(table2._id.toString());

                    // let stt = commonClass.AddTime(ROUND_START_TIMER - 1);
                    // schedule.scheduleJob(jId, new Date(stt), function () {
                    //   schedule.cancelJob(jId);
                    // });
                    const removeOnLowCashTime = ROUND_START_TIMER - 1;
                    const jobId = `${table2.gt}:removeOnLowCash:${table2._id.toString()}`;
                    // scheduler.queues.removeOnLowCash({
                    //   timer: removeOnLowCashTime * 1000,
                    //   jobId,
                    //   tableId: table2._id.toString(),
                    // });

                    const jobData = {
                      tableId: table2._id.toString(),
                      calling: REMOVE_ON_LOW_CASH
                    };
                    const jobOption = { delay: removeOnLowCashTime * 1000, jobId };
                    addQueue(jobData, jobOption);

                  } else {
                    logger.info(
                      'removeOnLowCash-------1---->>>>>>Error:"table not found"',
                      tbId
                    );
                  }
                }
              );
            }
          }
        } else {
          logger.info(
            'removeOnLowCash---------2----------Error:"Table not found"',
            tbId
          );
        }
      });
    }
  } catch (error) {
    logger.error("-----> error removeOnLowCash", error);
    getInfo.exceptionError(error);
  }
};

const removeOnLowCashTimer = (tableId) => {
  db.collection("playing_table").findOne(
    { _id: getInfo.MongoID(tableId) },
    function (err1, resp1) {
      if (resp1 && resp1.pi) {
        let k = 0;
        res(k);
        function res(k) {
          if (k < resp1.pi.length) {
            if (!_.isEmpty(resp1.pi[k]) && resp1.pi[k].pco) {
              getInfo.GetUserInfo(
                resp1.pi[k].uid,
                {
                  tId: 1,
                  sck: 1,
                },
                function (uinfo) {
                  let msg = "noChips";
                  let single = "";
                  if (typeof uinfo.sck == "string" && uinfo.sck != "") {
                    single = uinfo.sck.replace(
                      /s\d*_\d*./i,
                      ""
                    );
                  }

                  leaveTableClass.LeaveTable(
                    {},
                    {
                      id: single,
                      uid: resp1.pi[k].uid,
                      _ir: resp1.pi[k]._ir,
                      si: resp1.pi[k].si,
                      tbid: resp1._id.toString(),
                    },
                    function (check) {
                      logger.info(
                        "removeOnLowCash----------->>>check: ",
                        check
                      );
                      k += 1;
                      res(k);
                    }
                  );
                }
              );
            } else {
              k += 1;
              res(k++);
            }
          }
        }
      }
    }
  );
};

module.exports = {
  SaveCards,
  SwitchTable,
  removeOnLowCash,
  removeOnLowChips,
  removeOnLowCashTimer
};

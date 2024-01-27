let isSpcc = true;
let isSpcCash = true;
const _ = require("underscore");
const config = require("../config.json");
const commonClass = require("./common.class");
const commonData = require("./commonData.class");
const getInfo = require("../common");
const schedule = require("node-schedule");
const jobTimerClass = require("./jobTimers.class");
const trackClass = require("./track.class");
const logger = require("../utils/logger");
const { getTableName } = require("../utils");
const { cardChange } = require("../utils/winnerCardChanges");
// const { saveGameHistory, storeTableHistoryForWinner } = require("./gameHistory.class");
const { saveGameHistory } = require("./gameHistory.class");
const { GetConfig } = require("../connections/mongodb");
const scheduler = require("../scheduler");
const { SPLIT_AMOUNT, ROUND_TIMER_START_TIMER, REMOVE_ON_LOW_CASH } = require("../constants/eventName");
const { addQueue, cancelJob } = require("../scheduler/bullQueue");
const moment = require("moment");

async function isSplit(tableId, userArr) {
  try {
    return new Promise((resolve, reject) => {
      getInfo.GetTbInfo(tableId, {}, async function (table) {
        if (!table) {
          logger.info('split----------->>>>>>Error:"table not found"');
          return false;
        }
        let result = false;
        //find active player
        let players = getInfo.getPlayingUserInGame(table.pi, true);
        let newPlayers = [];

        newPlayers = players.filter((elem) => {
          return !userArr.some((ele) => {
            return ele === elem.uid;
          });
        });

        if (
          (table.gt == "Pool" &&
            table.start_totalap > 3 &&
            newPlayers.length <= 3 &&
            table.tst == "roundWinnerDeclared" &&
            table.round > 1) ||
          (table.gt == "Pool" &&
            table.start_totalap == 3 &&
            newPlayers.length <= 2 &&
            table.tst == "roundWinnerDeclared" &&
            table.round > 1)
        ) {
          const tableName = getTableName(table.gt);
          let lobby = await db.collection(tableName).findOne({
            _id: getInfo.MongoID(table.categoryId),
          });

          logger.info("lobby------>", lobby);

          let dropArr = [];
          let prizePool = table.prize;
          // let dropPrice = (prizePool / table.start_totalap).toFixed(2);
          let dropPrice =
            table.bv - ((table.bv * lobby.commission) / 100).toFixed(2);
          logger.info("oneDropPrice--------->", dropPrice);
          let dropCount = 0;
          let totalDropCount = 0;
          let totalDropPrice = 0;
          let amount = 0;

          for (const element of newPlayers) {
            if (table.pt === 61) {
              if (element.dps === 0) {
                dropCount = config.DROP_POINTS.POOL_61.GAME_SCORE_0;
              } else if (element.dps >= 2 && element.dps <= 15) {
                dropCount = config.DROP_POINTS.POOL_61.GAME_SCORE_2_15;
              } else if (element.dps >= 16 && element.dps <= 30) {
                dropCount = config.DROP_POINTS.POOL_61.GAME_SCORE_16_30;
              } else if (element.dps >= 31 && element.dps <= 45) {
                dropCount = config.DROP_POINTS.POOL_61.GAME_SCORE_31_45;
              } else if (element.dps >= 46 && element.dps <= 60) {
                dropCount = config.DROP_POINTS.POOL_61.GAME_SCORE_46_60;
              }
            } else if (table.pt === 101) {
              if (element.dps === 0) {
                dropCount = config.DROP_POINTS.POOL_101.GAME_SCORE_0;
              } else if (element.dps >= 2 && element.dps <= 20) {
                dropCount = config.DROP_POINTS.POOL_101.GAME_SCORE_2_20;
              } else if (element.dps >= 21 && element.dps <= 40) {
                dropCount = config.DROP_POINTS.POOL_101.GAME_SCORE_21_40;
              } else if (element.dps >= 41 && element.dps <= 60) {
                dropCount = config.DROP_POINTS.POOL_101.GAME_SCORE_41_60;
              } else if (element.dps >= 61 && element.dps <= 80) {
                dropCount = config.DROP_POINTS.POOL_101.GAME_SCORE_61_80;
              } else if (element.dps >= 81 && element.dps <= 100) {
                dropCount = config.DROP_POINTS.POOL_101.GAME_SCORE_81_100;
              }
            } else if (table.pt === 201) {
              if (element.dps === 0) {
                dropCount = config.DROP_POINTS.POOL_201.GAME_SCORE_0;
              } else if (element.dps >= 2 && element.dps <= 25) {
                dropCount = config.DROP_POINTS.POOL_201.GAME_SCORE_2_25;
              } else if (element.dps >= 26 && element.dps <= 50) {
                dropCount = config.DROP_POINTS.POOL_201.GAME_SCORE_26_50;
              } else if (element.dps >= 51 && element.dps <= 75) {
                dropCount = config.DROP_POINTS.POOL_201.GAME_SCORE_51_75;
              } else if (element.dps >= 76 && element.dps <= 100) {
                dropCount = config.DROP_POINTS.POOL_201.GAME_SCORE_76_100;
              } else if (element.dps >= 101 && element.dps <= 125) {
                dropCount = config.DROP_POINTS.POOL_201.GAME_SCORE_101_125;
              } else if (element.dps >= 126 && element.dps <= 150) {
                dropCount = config.DROP_POINTS.POOL_201.GAME_SCORE_126_150;
              } else if (element.dps >= 151 && element.dps <= 175) {
                dropCount = config.DROP_POINTS.POOL_201.GAME_SCORE_151_175;
              } else if (element.dps >= 176 && element.dps <= 200) {
                dropCount = config.DROP_POINTS.POOL_201.GAME_SCORE_176_200;
              }
            }

            totalDropCount += dropCount;
            //4. calculate total drop value & price
            amount = dropPrice * dropCount;
            totalDropPrice += amount;

            dropArr.push({
              uid: element.uid,
              un: element.un,
              dps: element.dps,
              dropCount: dropCount,
              amount: amount,
              si: element.si,
              // isAccepted: false,
              isBot: element._ir === 1 ? true : false,
              status: "waiting",
            });
          }
          logger.info(
            "totalDropCount----->",
            totalDropCount,
            "--totalDropPrice--->",
            totalDropPrice
          );

          //5. calculate remaining price
          const remainingPrice = (prizePool - totalDropPrice).toFixed(2);
          logger.info("remainingPrice------->", remainingPrice);
          //6. remaining price greater than dropPrice
          if (remainingPrice < dropPrice) {
            logger.info(
              "split--------->>>>>Drop value greater than table amout"
            );
            // return result;
            resolve(false);
          } else {
            // result = true;
            // return result;
            resolve(true);
          }
        }
        logger.info("result--------->", result);
        // return false;
        resolve(false);
      });
    });
  } catch (error) {
    logger.info("error--------->", error);
    // getInfo.exceptionError(error);
  }
}

async function splitAmount(tableId) {
  try {
    const { TAX_VALUE, TAX } = GetConfig();
    const table = await db.collection("playing_table").findOne(
      { _id: getInfo.MongoID(tableId) },
      {
        projection: {
          total_player_join: 1,
          jid: 1,
          tjid: 1,
          mode: 1,
          pt: 1,
          bv: 1,
          prize: 1,
          gt: 1,
          pi: 1,
          hist: 1,
          round: 1,
          categoryId: 1,
        },
      }
    );
    if (table) {
      logger.info("tableId------------->", tableId);
      await db.collection("split_data").findOneAndUpdate(
        {
          tableId: getInfo.MongoID(tableId),
          round: table.round,
        },
        {
          $set: {
            status: "split_accepted",
          },
        },
        { new: true }
      );

      //cancel job timer

      logger.info("table-------------->", table);
      const jobId = `${table.gt}:splitAmount:${table._id.toString()}`;
      // await scheduler.cancelJob.cancelSplitAmount(jobId);
      cancelJob(jobId);

      // jobTimerClass.cancelJobOnServers(tableId, table.jid);
      // schedule.cancelJob("split" + table.jid);
      getInfo.UpdateTableData(
        tableId.toString(),
        {
          $set: {
            SplitPopupFlag: false,
          },
        },
        function (upData) { }
      );

      const updateSplitRecord = await db
        .collection("split_data")
        .findOne({ tableId: getInfo.MongoID(tableId), round: table.round });
      logger.info("updateSplitRecord------>", updateSplitRecord);

      const tableName = getTableName(table.gt);
      const lobbyDetail = await db
        .collection(tableName)
        .findOne({ _id: getInfo.MongoID(table.categoryId) });
      let commission = lobbyDetail.commission ? lobbyDetail.commission : 0;
      let bonusPercentage = lobbyDetail.bonus ? lobbyDetail.bonus : 0;

      let tds = commission == 0 ? 0 : +((table.bv * table.total_player_join) / commission).toFixed(2);
      logger.info("tds------->", tds);

      if (table.mode == "cash") {
        let winner = [];
        let kCount = 0;
        res(kCount);
        async function res(kCount) {
          logger.info("kCount--------->", kCount);
          if (kCount < updateSplitRecord.split.length) {
            let iterator = updateSplitRecord.split[kCount];
            winner.push(iterator.si);
            logger.info("---------iterator----->", iterator);

            //tds
            let taxAmount = 0;
            let winAmount = iterator.amount - table.bv;
            // pv = pv - bv;
            logger.info("winAmount------->", winAmount);
            logger.info("TAX_VALUE----->", TAX_VALUE);
            logger.info("winAmount > TAX_VALUE------>", winAmount > TAX_VALUE);
            let tax;
            // if (winAmount > TAX_VALUE) {
            //   tax = +((winAmount * TAX) / 100).toFixed(2);
            //   taxAmount = tax;
            //   logger.info("taxAmount------>", taxAmount);
            //   iterator.amount = iterator.amount - tax;
            //   logger.info("iterator.amount----->", iterator.amount);
            //   let diff1 = commonClass.GetTimeDifference(table.la, new Date());
            //   let taxdata = {
            //     uid: "admin",
            //     tbid: tableId.toString(),
            //     _ir: 0,
            //     tid: "",
            //     cash: tax,
            //     rid: table.round,
            //     mode: table.mode,
            //     gt: table.gt,
            //     trkid: table.tjid,
            //     diff: diff1,
            //     commission,
            //     bonusPercentage,
            //     t: "tds from winamount",
            //   };
            //   trackClass.PlayTrack(taxdata, function (tdsdata) { });
            //   let tdstrack = {
            //     tbid: tableId.toString(),
            //     tjid: table.tjid,
            //     winamount: iterator.amount,
            //     cmsn: tds,
            //     tds: tax,
            //     transferd: iterator.amount,
            //     rid: table.round,
            //     mode: table.mode,
            //     gt: table.gt,
            //     un: table.pi[iterator.si].un,
            //     ue: table.pi[iterator.si].ue,
            //     winid: getInfo.MongoID(table.pi[iterator.si].uid),
            //   };
            //   trackClass.TdsTrack(tdstrack, function (tdstrc) { });
            // }
            // let apv = pv + table.bv * config.MAX_DEADWOOD_PTS;
            logger.info("taxAmount--1----->", taxAmount);

            commonData.UpdateCashForPlayInTable(
              tableId,
              iterator.uid,
              iterator.amount,
              "Game Win",
              async function (uChips) {
                logger.info("handleWinnerCash---------------------uChips:" + uChips);
                const tableName = getTableName(table.gt);
                const lobbyDetail = await db
                  .collection(tableName)
                  .findOne({ _id: getInfo.MongoID(table.categoryId) });
                logger.info("lobbyDetail-------->", lobbyDetail);
                let commission = lobbyDetail.commission ? lobbyDetail.commission : 0;
                let bonusPercentage = lobbyDetail.bonus ? lobbyDetail.bonus : 0;
                logger.info("commission---------->", commission);

                var tempPlayerData = table.pi[iterator.si];
                var ctth = "", direct = true;
                if (direct) {
                  if (table.pi[iterator.si].cards.length > 13) {
                    ctth = table.pi[iterator.si].cards.pop();
                    tempPlayerData.cards = table.pi[iterator.si].cards;
                  }
                  tempPlayerData.dCards = {
                    pure: [],
                    seq: [],
                    set: [],
                    dwd: table.pi[iterator.si].cards,
                  };
                }
                // tempPlayerData.wc = commonClass.RoundInt(iterator.amount, 2);
                tempPlayerData.Chips = uChips;
                tempPlayerData._iw = 1;
                tempPlayerData.gedt = new Date();
                tempPlayerData.tdps = tempPlayerData.tdps - tempPlayerData.ps;

                var upData = {
                  $set: {
                    ctrlServer: SERVER_ID,
                    "pi.$.wc": commonClass.RoundInt(iterator.amount, 2),
                    "pi.$.Chips": uChips,
                    "pi.$._iw": 1,
                    "pi.$.tdps": tempPlayerData.tdps,
                    tst: "winnerDeclared",
                    "pi.$.gedt": new Date(),
                    tds,
                    bonusPercentage,
                    commission,
                    taxPercent: TAX,
                    // tax: taxAmount,
                  },
                  $inc: {
                    // tds: tds,
                    tax: taxAmount,
                    "pi.$.winAmount": iterator.amount,
                  },
                };
                if (ctth != "") {
                  let gCards = table.pi[iterator.si].gCards;

                  if (gCards.pure.length > 0) {
                    let pureCards = gCards.pure;
                    logger.info("ThrowCard---------->>>>>>gCards: ", pureCards);
                    for (let x in pureCards) {
                      if (_.contains(pureCards[x], ctth)) {
                        pureCards[x] = _.without(pureCards[x], ctth);
                        break;
                      }
                    }
                    logger.info("ThrowCard------------->>>>>gCards: ", gCards);
                    gCards.pure = pureCards;
                  }
                  if (gCards.seq.length > 0) {
                    let seqCards = gCards.seq;
                    logger.info("ThrowCard---------->>>>>>gCards: ", seqCards);
                    for (let x in seqCards) {
                      if (_.contains(seqCards[x], ctth)) {
                        seqCards[x] = _.without(seqCards[x], ctth);
                        break;
                      }
                    }
                    logger.info(
                      "ThrowCard------------->>>>>gCards: ",
                      seqCards
                    );
                    gCards.seq = seqCards;
                  }
                  if (gCards.set.length > 0) {
                    let setCards = gCards.set;
                    logger.info("ThrowCard---------->>>>>>gCards: ", setCards);
                    for (let x in setCards) {
                      if (_.contains(setCards[x], ctth)) {
                        setCards[x] = _.without(setCards[x], ctth);
                        break;
                      }
                    }
                    logger.info(
                      "ThrowCard------------->>>>>gCards: ",
                      setCards
                    );
                    gCards.set = setCards;
                  }
                  if (gCards.dwd.length > 0) {
                    let dwdCards = gCards.dwd;
                    logger.info("ThrowCard---------->>>>>>gCards: ", dwdCards);
                    for (let x in dwdCards) {
                      if (_.contains(dwdCards[x], ctth)) {
                        dwdCards[x] = _.without(dwdCards[x], ctth);
                        break;
                      }
                    }
                    logger.info(
                      "ThrowCard------------->>>>>gCards: ",
                      dwdCards
                    );
                    gCards.dwd = dwdCards;
                  }

                  upData["$set"]["pi.$.cards"] = table.pi[iterator.si].cards;
                  upData["$set"]["pi.$.gCards"] = gCards;
                  upData["$push"] = { oDeck: ctth };
                }
                upData["$addToSet"] = { hist: tempPlayerData };
                commonData.CountHands(
                  iterator.uid,
                  "win",
                  table.gt,
                  table.bv,
                  true,
                  table.mode,
                  table._ip,
                  table.round,
                  function (thp, qstWin, hpc) {
                    commonData.getUserScore(
                      iterator.uid,
                      table.bv,
                      table.gt,
                      function (score) {
                        logger.info("score------------>", score);
                        upData["$set"]["pi.$.score"] = score;
                        upData["$set"]["pi.$.thp"] = thp;
                        upData["$set"]["pi.$.hpc"] = hpc;
                        upData["$inc"]["pi.$.rw"] = 1;

                        upData.$set._qstWin = qstWin;
                        db.collection("playing_table").findAndModify(
                          {
                            _id: getInfo.MongoID(tableId),
                            "pi.si": iterator.si,
                          },
                          {},
                          upData,
                          { new: true },
                          async function (err, resp) {
                            if (err) {
                              return false;
                            }
                            resp = resp.value;
                            logger.info("resp---------->", resp);
                            logger.info("k-----1---->", kCount);

                            const tableName = getTableName(table.gt);
                            const lobby = await db
                              .collection(tableName)
                              .findOne({
                                _id: getInfo.MongoID(table.categoryId),
                              });

                            logger.info("lobby------>", lobby);
                            let cutBonus,
                              otherLobby = [];
                            logger.info("iterator.uid------>", iterator.uid, resp.tjid);

                            const poolCategory = await db
                              .collection("pool_category")
                              .find({
                                mode: "cash",
                                pCount: lobby.pCount,
                                category: table.pt,
                              })
                              .sort({ fee: -1 })
                              .limit(1)
                              .toArray();
                            logger.info("poolCategory----------->", poolCategory);
                            if (poolCategory[0].fee == table.bv) {
                              otherLobby.push({
                                fee: poolCategory[0].fee,
                                categoryId: poolCategory[0]._id,
                              });
                            } else {
                              otherLobby.push({
                                fee: table.bv,
                                categoryId: table.categoryId,
                              }, {
                                fee: poolCategory[0].fee,
                                categoryId: poolCategory[0]._id,
                              });
                            }

                            //split_win
                            const userInfo = await db
                              .collection("game_users")
                              .findOne(
                                { _id: getInfo.MongoID(iterator.uid) },
                                {
                                  projection: {
                                    depositCash: 1,
                                    Winning: 1,
                                    "flags._ir": 1,
                                  },
                                }
                              );

                            if (userInfo.flags._ir == 0) {
                              let cashData = await db
                                .collection("cash_track")
                                .findOne({
                                  uid: getInfo.MongoID(iterator.uid),
                                  tjid: resp.tjid,
                                });
                              logger.info("cashData------->", cashData);
                              cutBonus = cashData.signUpBonus;
                              logger.info("otherLobby------>", otherLobby);
                              logger.info("cutBonus-------->", cutBonus);

                              commonClass.SendDirect(
                                iterator.uid,
                                {
                                  en: "SplitWin",
                                  data: {
                                    bootValue: table.bv,
                                    pointTable: table.pt,
                                    gameType: table.gt,
                                    prize: table.prize,
                                    winAmount: iterator.amount,
                                    cutBonus: cutBonus,
                                    balance:
                                      userInfo.depositCash +
                                      userInfo.Winning +
                                      iterator.amount,
                                    otherLobby: otherLobby,
                                  },
                                },
                                true
                              );
                            }

                            kCount = kCount + 1;
                            logger.info("k----2----->", kCount);
                            res(kCount);
                          }
                        );
                      }
                    );
                  }
                );
              }
            );
          } else {
            logger.info("split----Accepted");
            const table1 = await db
              .collection("playing_table")
              .findOne({ _id: getInfo.MongoID(tableId) });

            if (table1) {
              let hist = [];
              hist = table1.hist.filter(function (htData) {
                if (htData.s == "left") {
                  return htData;
                }
              });

              for (const element of hist) {
                if (element && element.s == "left") {
                  table1.pi[element.si] = element;
                }
              }
              let playerList = table1.pi.filter((item) => item.uid);
              playerList = cardChange(playerList);
              if (table1 != null) {
                // for (i = 0; i < hist.length; i++) {
                //   //sort(bubble sort) the player according to the dps
                //   for (j = 0; j < hist.length - i - 1; j++) {
                //     if (
                //       hist[j].dps > hist[j + 1].dps ||
                //       (hist[j].dps == hist[j + 1].dps &&
                //         hist[j]._iw < hist[j + 1]._iw)
                //     ) {
                //       temp = _.clone(hist[j]);
                //       hist[j] = _.clone(hist[j + 1]);
                //       hist[j + 1] = _.clone(temp);
                //     }
                //   }
                // }

                let winArray = [];
                let lossArray = [];
                hist.forEach((histObj) => {
                  if (histObj._iw === 1) {
                    winArray.push(histObj);
                  } else {
                    lossArray.push(histObj);
                  }
                });
                hist = winArray.concat(lossArray);

                var game_id = table1.game_id;
                if (table1.gt == "Deal" || table1.gt == "Pool") {
                  game_id = game_id + "." + table1.sub_id;
                }

                var rCount = 0;
                var uCount = 0;
                var rSts = "loss";
                var uSts = "loss";
                for (var k in hist) {
                  if (hist[k]._iw == 1) {
                    // sts = 'win';
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
                var ldData = {
                  $set: {
                    tbid: table1._id.toString(),
                    round: table1.round,
                    game_id: table1.game_id,
                    sub_id: table1.sub_id,
                    gt: table1.gt,
                    tst: table1.tst,
                    pi: playerList,
                    wildCard: table1.wildCard,
                    win: winner,
                  },
                };

                db.collection("last_deal").findAndModify(
                  { tbid: table1._id.toString() },
                  {},
                  ldData,
                  { upsert: true, new: true },
                  function (err, table1) { }
                );

                let playerData = [];
                for (const element of playerList) {
                  if (element && element.s != "left") {
                    playerData.push(element);
                  }
                }

                commonClass.FireEventToTable(table1._id.toString(), {
                  en: "WinnerDeclared",
                  data: {
                    tbid: table1._id.toString(),
                    pv: 0,
                    bv: table1.bv,
                    round: table1.round,
                    game_id: table1.game_id,
                    sub_id: table1.sub_id,
                    gt: table1.gt,
                    tst: table1.tst,
                    pi: playerData,
                    win: winner,
                    wildCard: table1.wildCard,
                    categoryId: table1.categoryId,
                  },
                });
                await saveGameHistory(table1, playerList, winner);
                // storeTableHistoryForWinner({
                //   tableId: table1._id.toString(),
                //   eventName: "WinnerDeclared",
                //   tableData: table1,
                //   playerData,
                //   winner
                // });
              } else {
                logger.info('stuck---------else------>>>>Error:"table not found"');
              }

              let players = getInfo.getPlayingUserInRound(table1.pi);
              let playerCount = 0;
              resUpdate(playerCount);
              function resUpdate(playerCount) {
                if (playerCount < players.length) {
                  logger.info("lenght---------->", players.length);
                  getInfo.GetUserInfo(
                    players[playerCount].uid,
                    {
                      tId: 1,
                      flags: 1,
                      si: 1,
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
                      let single = "";
                      if (
                        typeof playerInfo.sck == "string" &&
                        playerInfo.sck != ""
                      ) {
                        single = playerInfo.sck.replace(/s\d*_\d*./i, "");
                      }
                      setTimeout(() => {
                        leaveTableClass.LeaveTable(
                          { eliminated: true },
                          {
                            id: single,
                            uid: players[playerCount].uid,
                            _ir: playerInfo._ir,
                            si: players[playerCount].si,
                            tbid: tableId,
                          },
                          function (check) {
                            logger.info("SplitResult-----" + tableId + "------>>>check: ", check);
                            playerCount += 1;
                            resUpdate(playerCount);
                          }
                        );
                      }, 2000);
                    }
                  );
                }
              }
            } else {
              logger.info("table not found");
            }
          }
        }
      } else if (table.mode == "practice") {
        let winner = [];
        let kCount = 0;
        res(kCount);
        async function res(kCount) {
          if (kCount < updateSplitRecord.split.length) {
            let iterator = updateSplitRecord.split[kCount];
            winner.push(iterator.si);
            logger.info("---------iterator----->", iterator);
            commonData.UpdateCashForPlayInTable(
              tableId,
              iterator.uid,
              iterator.amount,
              "Game Win",
              async function (uChips) {
                const tableName = getTableName(table.gt);
                const lobbyDetail = await db
                  .collection(tableName)
                  .findOne({ _id: getInfo.MongoID(table.categoryId) });
                logger.info("lobbyDetail-------->", lobbyDetail);
                let commission = lobbyDetail.commission
                  ? lobbyDetail.commission
                  : 0;
                let bonusPercentage = lobbyDetail.bonus ? lobbyDetail.bonus : 0;
                logger.info("commission---------->", commission);

                var tempPlayerData = table.pi[iterator.si];
                var ctth = "",
                  direct = true;
                if (direct) {
                  if (table.pi[iterator.si].cards.length > 13) {
                    ctth = table.pi[iterator.si].cards.pop();
                    tempPlayerData.cards = table.pi[iterator.si].cards;
                  }
                  tempPlayerData.dCards = {
                    pure: [],
                    seq: [],
                    set: [],
                    dwd: table.pi[iterator.si].cards,
                  };
                }

                // tempPlayerData.wc = commonClass.RoundInt(iterator.amount, 2);
                tempPlayerData.Chips = uChips;
                tempPlayerData._iw = 1;
                tempPlayerData.gedt = new Date();
                tempPlayerData.tdps = tempPlayerData.tdps - tempPlayerData.ps;

                var upData = {
                  $set: {
                    ctrlServer: SERVER_ID,
                    rndsts: "winnerDeclared",
                    "pi.$.wc": commonClass.RoundInt(iterator.amount, 2),
                    "pi.$.Chips": uChips,
                    "pi.$._iw": 1,
                    "pi.$.tdps": tempPlayerData.tdps,
                    tst: "winnerDeclared",
                    "pi.$.gedt": new Date(),
                    bonusPercentage,
                    commission,
                    taxPercent: TAX,
                  },
                  $inc: { winAmount: iterator.amount },
                };
                if (ctth != "") {
                  if (table.pi[iterator.si].gCards.length > 0) {
                    var gCards = table.pi[iterator.si].gCards;
                    if (gCards.pure.length > 0) {
                      var pureCards = gCards.pure;
                      logger.info("handlePoolWinner---------->>>>>>gCards: ", pureCards);
                      for (var x in pureCards) {
                        if (_.contains(pureCards[x], ctth)) {
                          pureCards[x] = _.without(pureCards[x], ctth);
                          break;
                        }
                      }
                      logger.info("handlePoolWinner------------->>>>>gCards: ", gCards);
                      gCards.pure = pureCards;
                    } else if (gCards.seq.length > 0) {
                      var seqCards = gCards.seq;
                      logger.info("handlePoolWinner---------->>>>>>gCards: ", seqCards);
                      for (var x in seqCards) {
                        if (_.contains(seqCards[x], ctth)) {
                          seqCards[x] = _.without(seqCards[x], ctth);
                          break;
                        }
                      }
                      logger.info("handlePoolWinner------------->>>>>gCards: ", seqCards);
                      gCards.seq = seqCards;
                    } else if (gCards.set.length > 0) {
                      var setCards = gCards.set;
                      logger.info("handlePoolWinner---------->>>>>>gCards: ", setCards);
                      for (var x in setCards) {
                        if (_.contains(setCards[x], ctth)) {
                          setCards[x] = _.without(setCards[x], ctth);
                          break;
                        }
                      }
                      logger.info("handlePoolWinner------------->>>>>gCards: ", setCards);
                      gCards.set = setCards;
                    } else if (gCards.dwd.length > 0) {
                      var dwdCards = gCards.dwd;
                      logger.info("handlePoolWinner---------->>>>>>gCards: ", dwdCards);
                      for (var x in dwdCards) {
                        if (_.contains(dwdCards[x], ctth)) {
                          dwdCards[x] = _.without(dwdCards[x], ctth);
                          break;
                        }
                      }
                      logger.info("handlePoolWinner------------->>>>>gCards: ", dwdCards);
                      gCards.dwd = dwdCards;
                    }
                  } else {
                    var gCards = table.pi[iterator.si].gCards;
                    var dwdCards = table.pi[iterator.si].cards;
                    gCards.dwd = dwdCards;
                  }
                  upData["$set"]["pi.$.cards"] = table.pi[iterator.si].cards;
                  upData["$set"]["pi.$.gCards"] = gCards;
                  upData["$push"] = { oDeck: ctth };
                }
                upData["$addToSet"] = { hist: tempPlayerData };

                commonData.CountHands(
                  iterator.uid,
                  "win",
                  table.gt,
                  table.bv,
                  true,
                  table.mode,
                  table._ip,
                  table.round,
                  function (thp, qstWin, hpc) {
                    commonData.getUserScore(
                      iterator.uid,
                      table.bv,
                      table.gt,
                      function (score) {
                        upData["$set"]["pi.$.score"] = score;
                        upData["$set"]["pi.$.thp"] = thp;
                        upData["$set"]["pi.$.hpc"] = hpc;
                        upData["$inc"]["pi.$.rw"] = 1;

                        upData.$set._qstWin = qstWin;
                        db.collection("playing_table").findAndModify(
                          {
                            _id: getInfo.MongoID(tableId),
                            "pi.si": iterator.si,
                          },
                          {},
                          upData,
                          { new: true },
                          async function (err, resp) {
                            if (err) {
                              return false;
                            }
                            resp = resp.value;
                            logger.info("resp---------->", resp);
                            logger.info("k-----1---->", kCount);

                            const tableName = getTableName(table.gt);

                            const lobby = await db
                              .collection(tableName)
                              .findOne({
                                _id: getInfo.MongoID(table.categoryId),
                              });

                            logger.info("lobby------>", lobby);
                            let cutBonus, otherLobby = [];
                            logger.info("iterator.uid------>", iterator.uid, resp.tjid);

                            const poolCategory = await db
                              .collection("pool_category")
                              .find({
                                mode: "practice",
                                pCount: lobby.pCount,
                                category: table.pt,
                              })
                              .sort({ fee: -1 })
                              .limit(1)
                              .toArray();
                            logger.info("poolCategory----------->", poolCategory);
                            if (poolCategory[0].fee == table.bv) {
                              otherLobby.push({
                                fee: poolCategory[0].fee,
                                categoryId: poolCategory[0]._id,
                              });
                            } else {
                              otherLobby.push(
                                {
                                  fee: table.bv,
                                  categoryId: table.categoryId,
                                },
                                {
                                  fee: poolCategory[0].fee,
                                  categoryId: poolCategory[0]._id,
                                }
                              );
                            }

                            //split_win
                            const userInfo = await db
                              .collection("game_users")
                              .findOne(
                                { _id: getInfo.MongoID(iterator.uid) },
                                {
                                  projection: {
                                    Chips: 1,
                                    depositCash: 1,
                                    Winning: 1,
                                    "flags._ir": 1,
                                  },
                                }
                              );
                            if (userInfo.flags._ir == 0) {
                              logger.info("otherLobby------>", otherLobby);
                              logger.info("userInfo.Chips------>", userInfo.Chips);
                              logger.info("iterator.amount", iterator.amount);

                              logger.info("userInfo.Chips + iterator.amount-------->", userInfo.Chips + iterator.amount);
                              commonClass.SendDirect(
                                iterator.uid,
                                {
                                  en: "SplitWin",
                                  data: {
                                    bootValue: table.bv,
                                    pointTable: table.pt,
                                    gameType: table.gt,
                                    prize: table.prize,
                                    winAmount: iterator.amount,
                                    cutBonus: 0,
                                    balance: userInfo.Chips + iterator.amount,
                                    otherLobby: otherLobby,
                                  },
                                },
                                true
                              );
                            }

                            kCount = kCount + 1;
                            logger.info("k----2----->", kCount);
                            res(kCount);
                          }
                        );
                      }
                    );
                  }
                );
              }
            );
          } else {
            logger.info("split----Accepted");
            const table1 = await db
              .collection("playing_table")
              .findOne({ _id: getInfo.MongoID(tableId) });

            if (table1) {
              let hist = [];
              hist = table1.hist.filter(function (htData) {
                if (htData.s == "left") {
                  return htData;
                }
              });

              for (const element of hist) {
                if (element && element.s == "left") {
                  table1.pi[element.si] = element;
                }
              }
              let playerList = table1.pi.filter((item) => item.uid);
              playerList = cardChange(playerList);

              if (table1 != null) {
                // for (i = 0; i < hist.length; i++) {
                //   //sort(bubble sort) the player according to the dps
                //   for (j = 0; j < hist.length - i - 1; j++) {
                //     if (
                //       hist[j].dps > hist[j + 1].dps ||
                //       (hist[j].dps == hist[j + 1].dps &&
                //         hist[j]._iw < hist[j + 1]._iw)
                //     ) {
                //       temp = _.clone(hist[j]);
                //       hist[j] = _.clone(hist[j + 1]);
                //       hist[j + 1] = _.clone(temp);
                //     }
                //   }
                // }


                let winArray = [];
                let lossArray = [];
                hist.forEach((histObj) => {
                  if (histObj._iw === 1) {
                    winArray.push(histObj);
                  } else {
                    lossArray.push(histObj);
                  }
                });
                hist = winArray.concat(lossArray);

                var game_id = table1.game_id;
                // var deal_id = table1.value.game_id;
                if (table1.gt == "Deal" || table1.gt == "Pool") {
                  game_id = game_id + "." + table1.sub_id;
                }
                var rCount = 0;
                var uCount = 0;
                var rSts = "loss";
                var uSts = "loss";
                for (var k in hist) {
                  if (hist[k]._iw == 1) {
                    if (hist[k]._ir == 1) {
                      rSts = "win";
                    } else {
                      uSts = "win";
                    }
                  } else {
                    hist[k].wc = -commonClass.RoundInt(table1.bv, 2);
                  }
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

                var ldData = {
                  $set: {
                    tbid: table1._id.toString(),
                    round: table1.round,
                    game_id: table1.game_id,
                    sub_id: table1.sub_id,
                    gt: table1.gt,
                    tst: table1.tst,
                    pi: playerList,
                    wildCard: table1.wildCard,
                    win: winner,
                  },
                };

                db.collection("last_deal").findAndModify(
                  { tbid: table1._id.toString() },
                  {},
                  ldData,
                  { upsert: true, new: true },
                  function (err, table1) { }
                );

                let playerData = [];
                for (const element of playerList) {
                  if (element && element.s != "left") {
                    playerData.push(element);
                  }
                }
                commonClass.FireEventToTable(table1._id.toString(), {
                  en: "WinnerDeclared",
                  data: {
                    tbid: table1._id.toString(),
                    bv: table1.bv,
                    pv: commonClass.RoundInt(table1.pv, 2),
                    round: table1.round,
                    game_id: table1.game_id,
                    sub_id: table1.sub_id,
                    gt: table1.gt,
                    tst: table1.tst,
                    pi: playerData,
                    win: winner,
                    wildCard: table1.wildCard,
                    categoryId: table1.categoryId,
                  },
                });

                await saveGameHistory(table1, playerList, winner);
                // storeTableHistoryForWinner({
                //   tableId: table1._id.toString(),
                //   eventName: "WinnerDeclared",
                //   tableData: table1,
                //   playerData,
                //   winner
                // });
              } else {
                logger.info('split-------------->>>>Error:"table not found"');
              }

              let players = getInfo.getPlayingUserInRound(table1.pi);
              let playerCount = 0;
              resUpdate(playerCount);
              function resUpdate(playerCount) {
                if (playerCount < players.length) {
                  logger.info("lenght---------->", players.length);
                  getInfo.GetUserInfo(
                    players[playerCount].uid,
                    {
                      tId: 1,
                      flags: 1,
                      si: 1,
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

                      setTimeout(() => {
                        leaveTableClass.LeaveTable(
                          { eliminated: true },
                          {
                            id: single,
                            uid: players[playerCount].uid,
                            _ir: playerInfo._ir,
                            si: players[playerCount].si,
                            tbid: tableId,
                          },
                          function (check) {
                            logger.info("SplitResult-----" + tableId + "------>>>check: ", check);
                            playerCount += 1;
                            resUpdate(playerCount);
                          }
                        );
                      }, 2000);
                    }
                  );
                }
              }
            } else {
              logger.info("table not found");
            }
          }
        }
      }
    } else {
      logger.info("Table not found---------->>>");
    }
  } catch (error) {
    logger.error("---splitAmount--error------>", error);
    getInfo.exceptionError(error);
  }
}

const SplitData = (tableId) => {
  try {
    //1. total player count more than 3 && remainging player 2-3
    logger.info('split----------->>>>>>Error:"tableId"', tableId);
    const { TIMER_SPLIT } = GetConfig();
    getInfo.GetTbInfo(tableId, {}, async function (table) {
      if (!table) {
        logger.info('split----------->>>>>>Error:"table not found"');
        return false;
      }

      if (
        (table.gt == "Pool" &&
          table.start_totalap > 3 &&
          table.ap <= 3 &&
          table.tst == "roundWinnerDeclared" &&
          table.round > 1) ||
        (table.gt == "Pool" &&
          table.start_totalap == 3 &&
          table.ap <= 2 &&
          table.tst == "roundWinnerDeclared" &&
          table.round > 1)
      ) {
        const tableName = getTableName(table.gt);
        let lobby = await db.collection(tableName).findOne({
          _id: getInfo.MongoID(table.categoryId),
        });

        logger.info("lobby------>", lobby);

        let isManualSplit = false;
        let isAutoSplit = false;
        //find active player
        let players = getInfo.getPlayingUserInGame(table.pi, true);
        let dropArr = [];
        let prizePool = table.prize;
        // let dropPrice = (prizePool / table.start_totalap).toFixed(2);
        let dropPrice =
          table.bv - ((table.bv * lobby.commission) / 100).toFixed(2);
        logger.info("oneDropPrice--------->", dropPrice);
        let dropCount = 0;
        let totalDropCount = 0;
        let totalDropPrice = 0;
        let amount = 0;

        for (const element of players) {
          if (table.pt === 61) {
            if (element.dps === 0) {
              dropCount = config.DROP_POINTS.POOL_61.GAME_SCORE_0;
            } else if (element.dps >= 2 && element.dps <= 15) {
              dropCount = config.DROP_POINTS.POOL_61.GAME_SCORE_2_15;
            } else if (element.dps >= 16 && element.dps <= 30) {
              dropCount = config.DROP_POINTS.POOL_61.GAME_SCORE_16_30;
            } else if (element.dps >= 31 && element.dps <= 45) {
              dropCount = config.DROP_POINTS.POOL_61.GAME_SCORE_31_45;
            } else if (element.dps >= 46 && element.dps <= 60) {
              dropCount = config.DROP_POINTS.POOL_61.GAME_SCORE_46_60;
            }
          } else if (table.pt === 101) {
            if (element.dps === 0) {
              dropCount = config.DROP_POINTS.POOL_101.GAME_SCORE_0;
            } else if (element.dps >= 2 && element.dps <= 20) {
              dropCount = config.DROP_POINTS.POOL_101.GAME_SCORE_2_20;
            } else if (element.dps >= 21 && element.dps <= 40) {
              dropCount = config.DROP_POINTS.POOL_101.GAME_SCORE_21_40;
            } else if (element.dps >= 41 && element.dps <= 60) {
              dropCount = config.DROP_POINTS.POOL_101.GAME_SCORE_41_60;
            } else if (element.dps >= 61 && element.dps <= 80) {
              dropCount = config.DROP_POINTS.POOL_101.GAME_SCORE_61_80;
            } else if (element.dps >= 81 && element.dps <= 100) {
              dropCount = config.DROP_POINTS.POOL_101.GAME_SCORE_81_100;
            }
          } else if (table.pt === 201) {
            if (element.dps === 0) {
              dropCount = config.DROP_POINTS.POOL_201.GAME_SCORE_0;
            } else if (element.dps >= 2 && element.dps <= 25) {
              dropCount = config.DROP_POINTS.POOL_201.GAME_SCORE_2_25;
            } else if (element.dps >= 26 && element.dps <= 50) {
              dropCount = config.DROP_POINTS.POOL_201.GAME_SCORE_26_50;
            } else if (element.dps >= 51 && element.dps <= 75) {
              dropCount = config.DROP_POINTS.POOL_201.GAME_SCORE_51_75;
            } else if (element.dps >= 76 && element.dps <= 100) {
              dropCount = config.DROP_POINTS.POOL_201.GAME_SCORE_76_100;
            } else if (element.dps >= 101 && element.dps <= 125) {
              dropCount = config.DROP_POINTS.POOL_201.GAME_SCORE_101_125;
            } else if (element.dps >= 126 && element.dps <= 150) {
              dropCount = config.DROP_POINTS.POOL_201.GAME_SCORE_126_150;
            } else if (element.dps >= 151 && element.dps <= 175) {
              dropCount = config.DROP_POINTS.POOL_201.GAME_SCORE_151_175;
            } else if (element.dps >= 176 && element.dps <= 200) {
              dropCount = config.DROP_POINTS.POOL_201.GAME_SCORE_176_200;
            }
          }

          totalDropCount += dropCount;
          //4. calculate total drop value & price
          amount = dropPrice * dropCount;
          totalDropPrice += amount;

          dropArr.push({
            uid: element.uid,
            un: element.un,
            dps: element.dps,
            dropCount: dropCount,
            amount: amount,
            si: element.si,
            // isAccepted: false,
            isBot: element._ir === 1 ? true : false,
            status: "waiting",
          });
        }
        logger.info("totalDropCount----->", totalDropCount, "-----totalDropPrice--->", totalDropPrice);

        //5. calculate remaining price
        const remainingPrice = (prizePool - totalDropPrice).toFixed(2);
        logger.info("remainingPrice------->", remainingPrice);
        //6. remaining price greater than dropPrice
        if (remainingPrice < dropPrice) {
          logger.info("split--------->>>>>Drop value greater than table amout");
          // resume game
          if (table.mode == "cash") {
            removeOnLowCashAfterSplit(table._id);
          } else {
            removeOnLowChipsAfterSplit(table._id);
          }
        } else {
          //7. remaining price distribution
          const remainingPriceDistribute = remainingPrice / players.length;
          logger.info("remainingPriceDistribute------->", remainingPriceDistribute);

          //8. split amount
          let verifySplitAmount = 0;
          for (const iterator of dropArr) {
            iterator.amount = commonClass.RoundInt(iterator.amount + remainingPriceDistribute, 2);
            verifySplitAmount += iterator.amount;
          }
          logger.info('---verifySplitAmount-------->', verifySplitAmount);
          logger.info("drpoArr---2------>", dropArr);

          if (prizePool != verifySplitAmount) {
            let diff = commonClass.RoundInt(prizePool - verifySplitAmount, 2);
            logger.info("---in if", diff);
            dropArr = dropArr.sort((a, b) => { return a.dropCount - b.dropCount })
            dropArr[0].amount += diff;
          }
          logger.info("drpoArr---3------>", dropArr);

          const flag = await db.collection("admin_split").findOne();
          logger.info("flag-------->", flag.autoSplitFlag);
          if (flag.autoSplitFlag) {
            //check flag for auto split
            let autoSplitCount = 0;
            for (const iterator of dropArr) {
              if (iterator.dropCount == 0) {
                autoSplitCount++;
              }
            }
            logger.info("autoSplit-------->", autoSplitCount);
            if (autoSplitCount == dropArr.length) {
              isAutoSplit = true;
            } else {
              isManualSplit = true;
            }
          } else {
            isManualSplit = true;
          }
          logger.info("isAutoSplit--------->", isAutoSplit);
          logger.info("isManualSplit------->", isManualSplit);

          let insertData = {
            tableId: table._id,
            gt: table.gt,
            mode: table.mode,
            bv: table.bv,
            pt: table.pt,
            tjid: table.tjid,
            round: table.round,
            split: dropArr,
            splitType: "",
            status: "",
            categoryId: table.categoryId,
            cd: new Date(),
          };
          let splitTimer = TIMER_SPLIT ?? 20;
          logger.info("splitTimer----->", splitTimer);
          if (isManualSplit) {
            insertData.splitType = "manual";
            db.collection("split_data").insertOne(insertData);

            //start split timer
            let jobId = commonClass.GetRandomString(10);
            getInfo.UpdateTableData(
              table._id.toString(),
              {
                $set: {
                  jid: jobId,
                  ctt: new Date(),
                  SplitPopupTime: new Date(),
                  SplitPopupFlag: true,
                },
              },
              function (upData) {
                commonClass.FireEventToTable(table._id.toString(), {
                  en: "SplitData",
                  data: {
                    dropArr: dropArr,
                    time: splitTimer,
                    flag: true,
                    closeButtonFlag: false,
                  },
                });

                dropArr.forEach((user) => {
                  if (user.isBot) {
                    logger.info("user------------>", user);
                    setTimeout(function () {
                      SplitResult({
                        tId: table.tjid,
                        userid: user.uid,
                        flag: true,
                      });
                    }, 2000);
                  }
                });

                // splitTimer = commonClass.AddTime(splitTimer);
                // logger.info(`"split" + ${upData.jid}`);
                // schedule.scheduleJob(
                //   "split" + upData.jid,
                //   new Date(splitTimer),
                //   function () {
                //     logger.info("finish----Split Timer----->");
                //     schedule.cancelJob("split" + upData.jid);
                //   });

                const jobId = `${upData.gt}:splitAmount:${upData._id.toString()}`;
                // scheduler.queues.splitAmount({
                //   timer: splitTimer * 1000,
                //   jobId,
                //   tableId: upData._id.toString(),
                // });

                const jobData = {
                  tableId: upData._id.toString(),
                  tableMode: upData.mode,
                  calling: SPLIT_AMOUNT
                };
                const jobOption = {
                  delay: splitTimer * 1000,
                  jobId: jobId,
                };
                addQueue(jobData, jobOption);
              }
            );
          } else if (isAutoSplit) {
            dropArr.forEach((user) => {
              logger.info("user----->", user);
              user.status = "accepted";
            });

            insertData.splitType = "auto";
            insertData.split = dropArr;
            db.collection("split_data").insertOne(insertData);

            commonClass.FireEventToTable(table._id.toString(), {
              en: "SplitData",
              data: {
                dropArr: dropArr,
                time: splitTimer,
                flag: false,
                closeButtonFlag: false,
              },
            });

            //start split timer
            let jobId = commonClass.GetRandomString(10);
            getInfo.UpdateTableData(
              table._id.toString(),
              {
                $set: {
                  jid: jobId,
                  ctt: new Date(),
                },
              },
              function (upData) {
                logger.info("upData------->", upData);
                splitAmount(table._id);

                // schedule.scheduleJob(
                //   upData.jid,
                //   new Date(splitTimer),
                //   function () {
                //     schedule.cancelJob("split" + upData.jid);
                //   }
                // );

                const jobId = `${upData.gt}:splitAmount:${upData._id.toString()}`;
                // scheduler.queues.splitAmount({
                //   timer: splitTimer * 1000,
                //   jobId,
                //   tableId: upData._id.toString(),
                //   splitAmountDirect: true
                // });

                const jobData = {
                  tableId: upData._id.toString(),
                  tableMode: upData.mode,
                  splitAmountDirect: true,
                  calling: SPLIT_AMOUNT
                };

                const jobOption = {
                  delay: splitTimer * 1000,
                  jobId: jobId,
                };
                addQueue(jobData, jobOption);
              }
            );
          }
          else if (table.mode == "cash") {
            removeOnLowCashAfterSplit(table._id);
          }
          else {
            removeOnLowChipsAfterSplit(table._id);
          }
        }
      } else {
        if (table.mode == "cash") {
          removeOnLowCashAfterSplit(table._id);
        } else {
          removeOnLowChipsAfterSplit(table._id);
        }
      }
    });
  } catch (error) {
    logger.info("error--------->", error);
    logger.error("-----error---SplitData--->", error);
    getInfo.exceptionError(error);
  }
};

const SplitResult = async (data) => {
  try {
    logger.info("tableId----------->", data);
    const { tId, userid, flag } = data;
    const { TIMER_SPLIT } = GetConfig();
    const table = await db.collection("playing_table").findOne({
      tjid: tId,
    });
    if (table) {
      const split_data = await db
        .collection("split_data")
        .findOne({ tjid: tId, round: table.round });

      if (!split_data) {
        logger.info('split----------->>>>>>Error:"table not found"');
        return false;
      }
      let status;
      if (flag) {
        status = "accept";
      } else {
        status = "reject";
      }
      await db.collection("split_data").findOneAndUpdate(
        {
          tjid: tId,
          "split.uid": userid,
          round: table.round,
        },
        {
          $set: {
            "split.$.isAccepted": flag,
            "split.$.status": status,
          },
        },
        { new: true }
      );

      //find updated record of split
      const updateSplitRecord = await db.collection("split_data").findOne({
        tjid: tId,
        round: table.round,
      });
      logger.info("updateSplitRecord----->", updateSplitRecord);
      let closeButtonFlag = false;
      if (!flag) {
        closeButtonFlag = true;
      }
      let rst = TIMER_SPLIT ?? 20;
      let RemainingTime = rst - commonClass.GetTimeDifference(table.SplitPopupTime, new Date());
      logger.info("RemainingTime------>", RemainingTime);
      commonClass.FireEventToTable(updateSplitRecord.tableId.toString(), {
        en: "SplitData",
        data: {
          dropArr: updateSplitRecord.split,
          time: RemainingTime,
          flag: false,
          closeButtonFlag: closeButtonFlag,
        },
      });

      let splitCounter = 0, rejectCounter = 0;
      for (const iterator of updateSplitRecord.split) {
        if (iterator.status == "accept") {
          splitCounter++;
        } else if (iterator.status == "reject") {
          rejectCounter++;
        }
      }
      logger.info("splitCounter---->", splitCounter);
      logger.info("rejectCounter------->", rejectCounter);
      if (splitCounter == updateSplitRecord.split.length) {
        splitAmount(updateSplitRecord.tableId);
      } else if (rejectCounter == updateSplitRecord.split.length) {
        // cancel job
        // schedule.cancelJob("split" + table.jid);
        const jobId = `${table.gt}:splitAmount:${table._id.toString()}`;
        // scheduler.cancelJob.cancelSplitAmount(jobId);
        cancelJob(jobId);

        getInfo.UpdateTableData(
          table._id.toString(),
          {
            $set: {
              SplitPopupFlag: false,
              SplitTimer: "finished",
            },
          },
          function (table1) {
            if (table1.mode == "cash") {
              removeOnLowCashAfterSplit(table1._id);
            } else {
              removeOnLowChipsAfterSplit(table1._id);
            }
          }
        );
      } else {
        logger.info("waiting for other players");
      }
    } else {
      logger.info("SplitResult------Table-not-found--->");
    }
  } catch (error) {
    logger.info("error------splitResult---->", error);
    logger.error("-----error---splitResult--->", error);
    getInfo.exceptionError(error);
  }
};

const removeOnLowCashAfterSplit = async (tbId) => {
  try {
    const { MAX_DEADWOOD_PTS, SECONDARY_TIMER, ROUND_START_TIMER } = GetConfig();
    getInfo.GetTbInfo(tbId, {}, async function (table1) {
      if (table1) {
        let players = getInfo.getPlayingUserInRound(table1.pi);
        logger.info("removeOnLowCashAfterSplit--" + tbId + " else-->>>>>>>players: ", players);

       
        if (players.length <= 0 && table1.stdP.length == 0) {
          logger.info("removeOnLowCashAfterSplit-------" + table1._id + '------>>>>"table deleted"');
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
        } else if (
          table1.gt == "Pool" &&
          players.length == 1 &&
          table1.tst == "winnerDeclared" &&
          table1.stdP.length == 0
        ) {
          logger.info("removeOnLowCashAfterSplit-----else--if----" + table1._id + '------>>>>"table deleted"');
          let player;
          for (let activePlayer of players) {
            if (
              activePlayer &&
              !_.isEmpty(activePlayer) &&
              typeof activePlayer.si != "undefined"
            ) {
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
              let single = "";
              if (typeof playerInfo.sck == "string" && playerInfo.sck != "") {
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
                  logger.info("removeOnLowCashAfterSplit-----" + tbId + "------>>>check: ", check);
                }
              );
            }
          );
        } else {
          let { pi } = table1;
          let { ap } = table1;
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
                    (table1.gt == "Pool" && table1.tst == "roundWinnerDeclared")
                    ? player.play
                    : 0;
                player.dps =
                  (table1.round < table1.deals && table1.gt == "Deal") ||
                    (table1.gt == "Pool" && table1.tst == "roundWinnerDeclared")
                    ? player.dps
                    : 0; //only for deal and pool
                player.tdps =
                  (table1.round < table1.deals && table1.gt == "Deal") ||
                    (table1.gt == "Pool" && table1.tst == "roundWinnerDeclared")
                    ? player.tdps
                    : table1.deals * MAX_DEADWOOD_PTS; //only for deal and pool
                player.bet = table1.bv;
                player.isCollect =
                  (table1.round < table1.deals && table1.gt == "Deal") ||
                    (table1.gt == "Pool" && table1.tst == "roundWinnerDeclared")
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
          if (/*table1.gt == 'Deal' || */ table1.gt == "Pool" && round > 0) {
            hist = table1.hist.filter(function (htData) {
              if (htData.s == "left") {
                return htData;
              }
            });
          }

          let RobotCount = table1.RobotCount;
          let HumanCount = table1.HumanCount;
          let minS = table1.minS;
          if (table1.gt == "Deal") {
            minS = 2;
          } else if (table1.gt == "Pool") {
            minS = 3;
          } else {
            minS = config.MIN_SEAT_TO_FILL;
          }

          let bv = table1.bv;
          logger.info("removeOnLowCashAfterSplit--------***-------" + tbId);
          let players = getInfo.getPlayingUserInRound(table1.pi);
          let rCount = 0;
          for (let x in players) {
            if (players[x]._ir == 1) {
              rCount++;
            }
          }

          minS = rCount + 1;
          logger.info("removeOnLowCashAfterSplit--------" + tbId + "------minS" + minS);
          let jId = commonClass.GetRandomString(10);

          logger.info("removeOnLowCash-------------" + tbId + "------isSpcCash------" + isSpcCash);

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
              },
            },
            function (table2) {
              if (table2) {
                logger.info("removeOnLowCashAfterSplit----:" + tbId + "---after update table data-----table2.tst:", table2.tst);
                isSpcCash = true;

                const roundClass = require("./round.class");

                if (table2.SplitTimer == "finished") {
                  rst = 1;
                  logger.info("rst-------------->", rst);
                  let jobId = commonClass.GetRandomString(10);
                  getInfo.UpdateTableData(
                    table2._id.toString(),
                    {
                      $set: {
                        tst: "RoundTimerStarted",
                        jid: jobId,
                        ctt: new Date(),
                        tci: "",
                        SplitTimer: "",
                      },
                    },
                    async function (upData) {
                      if (upData) {
                        logger.info("initializeGame-------1111-------", upData);
                        let pi = [];
                        for (let j in table2.pi) {
                          let dt = {
                            uid: table2.pi[j].uid,
                            si: table2.pi[j].si,
                            s: table2.pi[j].s,
                          };
                          pi.push(dt);
                        }
                        // setTimeout(async () => {
                        commonClass.FireEventToTable(upData._id.toString(), {
                          en: "RoundTimerStarted",
                          data: {
                            timer: rst,
                            tie: upData.tie,
                            bv: table2.bv,
                            next: 0,
                            tdps: 0,
                            newgame: false,
                            pi: pi,
                            round: upData.round + 1,
                            // serverCurrentMillis: moment.utc().valueOf()
                          },
                        });
                        logger.info("upData.pjid------------->", upData.pjid);
                        // if (upData.pjid) {
                        //   logger.info("in if");
                        //   jobTimerClass.cancelJobOnServers(
                        //     upData._id.toString(),
                        //     upData.pjid
                        //   );
                        // }


                        const jobId = `${upData.gt}:roundTimerStart:${upData._id.toString()}`;
                        // await scheduler.queues.roundTimerStart({
                        //   timer: rst * 1000, jobId,
                        //   tableId: upData._id.toString(),
                        // });

                        const jobData = { tableId: upData._id.toString(), calling: ROUND_TIMER_START_TIMER };
                        const jobOption = { delay: rst * 1000, jobId: jobId, };
                        addQueue(jobData, jobOption);
                      } else {
                        logger.info(
                          'initializeGame----------------->>>>Error:"table not found"'
                        );
                      }
                    }
                  );
                } else {
                  roundClass.initializeGame(table2._id.toString());
                }

                // let stt = commonClass.AddTime(ROUND_START_TIMER - 1);
                // schedule.scheduleJob(jId, new Date(stt), function () {
                //   schedule.cancelJob(jId);
                // });
                const removeOnLowCashTime = ROUND_START_TIMER - 1;
                const jobId = `${table2.gt}:removeOnLowCash:${table2._id.toString()}`;
                // scheduler.queues.removeOnLowCash({
                //   timer: removeOnLowCashTime * 1000,
                //   jobId,
                //   tableId: upData._id.toString(),
                // });
                const jobData = {
                  tableId: table2._id.toString(),
                  calling: REMOVE_ON_LOW_CASH
                };
                const jobOption = {
                  delay: removeOnLowCashTime * 1000,
                  jobId: jobId,
                };
                addQueue(jobData, jobOption);
              } else {
                logger.info(
                  'removeOnLowCashAfterSplit-------1---->>>>>>Error:"table not found"',
                  tbId
                );
              }
            }
          );
        }
      } else {
        logger.info(
          'removeOnLowCashAfterSplit---------2----------Error:"Table not found"',
          tbId
        );
      }
    });
  } catch (error) {
    logger.error("-----error---removeOnLowCashAfterSplit--->", error);
    getInfo.exceptionError(error);
  }
};

const removeOnLowChipsAfterSplit = (tbId) => {
  try {
    const { MAX_DEADWOOD_PTS, SECONDARY_TIMER } = GetConfig();
    getInfo.GetTbInfo(tbId, {}, async function (table1) {
      if (table1) {
        let players = getInfo.getPlayingUserInRound(table1.pi);
        logger.info(
          "removeOnLowChipsAfterSplit--" + tbId + " else-->>>>>>>players: ",
          players
        );
        

        if (players.length <= 0 && table1.stdP.length == 0) {
          logger.info(
            "removeOnLowChipsAfterSplit-------" +
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
            "removeOnLowChipsAfterSplit-----else--if----" +
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
              let single = "";
              if (typeof playerInfo.sck == "string" && playerInfo.sck != "") {
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
                    "removeOnLowChipsAfterSplit-----" +
                    tbId +
                    "------>>>check: ",
                    check
                  );
                }
              );
            }
          );
        } else {
          logger.info(
            "removeOnLowChipsAfterSplit-----else13131313----->>>>players: ",
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
                    (table1.gt == "Pool" && table1.tst == "roundWinnerDeclared")
                    ? player.play
                    : 0;
                player.dps =
                  (table1.round < table1.deals && table1.gt == "Deal") ||
                    (table1.gt == "Pool" && table1.tst == "roundWinnerDeclared")
                    ? player.dps
                    : 0; //only for deal and pool
                player.tdps =
                  (table1.round < table1.deals && table1.gt == "Deal") ||
                    (table1.gt == "Pool" && table1.tst == "roundWinnerDeclared")
                    ? player.tdps
                    : table1.deals * MAX_DEADWOOD_PTS; //only for deal and pool
                player.bet = table1.bv;
                player.isCollect =
                  (table1.round < table1.deals && table1.gt == "Deal") ||
                    (table1.gt == "Pool" && table1.tst == "roundWinnerDeclared")
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

          logger.info("removeOnLowChipsAfterSplit----------------bv" + bv);

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
              },
            },
            function (table2) {
              if (table2) {
                logger.info(
                  'removeOnLowChipsAfterSplit-------111---->>>>>>"table data reset"',
                  table2._id.toString()
                );
                isSpcc = true;
                const roundClass = require("./round.class");
                if (table2.SplitTimer == "finished") {
                  rst = 1;
                  logger.info("rst-------------->", rst);
                  let jobId = commonClass.GetRandomString(10);
                  getInfo.UpdateTableData(
                    table2._id.toString(),
                    {
                      $set: {
                        tst: "RoundTimerStarted",
                        jid: jobId,
                        ctt: new Date(),
                        tci: "",
                        SplitTimer: "",
                      },
                    },
                    async function (upData) {
                      if (upData) {
                        logger.info("initializeGame-------1111-------", upData);
                        let pi = [];
                        for (let j in table2.pi) {
                          let dt = {
                            uid: table2.pi[j].uid,
                            si: table2.pi[j].si,
                            s: table2.pi[j].s,
                          };
                          pi.push(dt);
                        }
                        // setTimeout(async () => {
                        commonClass.FireEventToTable(upData._id.toString(), {
                          en: "RoundTimerStarted",
                          data: {
                            timer: rst,
                            tie: upData.tie,
                            bv: table2.bv,
                            next: 0,
                            tdps: 0,
                            newgame: false,
                            pi: pi,
                            round: upData.round + 1,
                            // serverCurrentMillis: moment.utc().valueOf()
                          },
                        });
                        logger.info("upData.pjid------------->", upData.pjid);
                        // if (upData.pjid) {
                        //   logger.info("in if");
                        //   jobTimerClass.cancelJobOnServers(
                        //     upData._id.toString(),
                        //     upData.pjid
                        //   );
                        // }

                        const jobId = `${upData.gt}:roundTimerStart:${upData._id.toString()}`;
                        // await scheduler.queues.roundTimerStart({
                        //   timer: rst * 1000, jobId,
                        //   tableId: upData._id.toString(),
                        // });
                        const jobData = {
                          tableId: upData._id.toString(),
                          calling: ROUND_TIMER_START_TIMER
                        };
                        const jobOption = {
                          delay: rst * 1000,
                          jobId: jobId,
                        };
                        addQueue(jobData, jobOption);
                      } else {
                        logger.info(
                          'initializeGame----------------->>>>Error:"table not found"'
                        );
                      }
                    }
                  );
                } else {
                  roundClass.initializeGame(table2._id.toString());
                }
                // roundClass.initializeGame(table2._id.toString());
              } else {
                logger.info(
                  'removeOnLowChipsAfterSplit-------1---->>>>>>Error:"table not found"'
                );
              }
            }
          );
        }
      } else {
        logger.info(
          'removeOnLowChipsAfterSplit---------2----------Error:"Table not found"',
          tbId
        );
      }
    });
  } catch (error) { }
};

const splitAmountTimer = (tableId,tableMode, splitAmountDirect = false) => {
  if (splitAmountDirect) {
    if (tableMode == "cash") {
      removeOnLowCashAfterSplit(table._id);
    } else {
      removeOnLowChipsAfterSplit(table._id);
    }
  } else {
    getInfo.UpdateTableData(tableId, {
      $set: {
        SplitPopupFlag: false,
        SplitTimer: "finished",
      },
    },
      function (table1) {
        if (table1.mode == "cash") {
          removeOnLowCashAfterSplit(tableId);
        } else {
          removeOnLowChipsAfterSplit(tableId);
        }
      }
    );
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
                  let single = "";
                  if (typeof uinfo.sck == "string" && uinfo.sck != "") {
                    single = uinfo.sck.replace(/s\d*_\d*./i, "");
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
                        "removeOnLowCashAfterSplit----------->>>check: ",
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
  isSplit,
  SplitData,
  SplitResult,
  removeOnLowCashAfterSplit,
  splitAmountTimer,
  removeOnLowCashTimer
};
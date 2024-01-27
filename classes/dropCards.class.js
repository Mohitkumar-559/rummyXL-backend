const { getRedisInstances } = require("../connections/redis");
const getInfo = require("../common");
const jobTimerClass = require("./jobTimers.class");
const commonData = require("./commonData.class");
const commonClass = require("./common.class.js"); //common functions
// const winnerClass = require("./winner.class");
const turnClass = require("./turn.class");
const logger = require("../utils/logger");
const schedule = require("node-schedule");
// const { storeTableHistory } = require("../classes/gameHistory.class");
const { GetConfig } = require("../connections/mongodb");
const scheduler = require("../scheduler");
const { cancelJob } = require("../scheduler/bullQueue");

const DropCards = async (data, client, full, Middle) => {
  // console.time("latency timer DropCards");
  try {
    /* +-------------------------------------------------------------------+
            desc:event to drop cards 
            i/p: data = {},client = socket object, full = true/false check to cut full chips or not 
        +-------------------------------------------------------------------+ */
    logger.info(
      "DropCards--------->>>>data: ",
      data,
      client.uid,
      " client.tbid: " + client.tbid + " client.si: " + client.si
    );
    logger.info("client.si----------->", client.si);
    const {
      MAX_DEADWOOD_PTS,
      FIRST_DROP,
      MIDDLE_DROP,
      FIRST_DROP_101,
      MIDDLE_DROP_101,
      FIRST_DROP_201,
      MIDDLE_DROP_201,
      FIRST_DROP_61,
      MIDDLE_DROP_61,
      FIRST_DROP_DEAL,
      MIDDLE_DROP_DEAL,
      MAX_DEADWOOD_PTS_POOL_61,
    } = GetConfig();
    const redisInstances = getRedisInstances();
    if (!data.internalDropCards) {
      const lvt = await redisInstances.SET(`dropAndLeave:${client.tbid}`, 1, { EX: 2, NX: true, });
      if (!lvt) {
        logger.error("--------- >>>>>>>> DropCards", "DropCards");
        return false;
      }
    }

    const lvt = await redisInstances.SET(`drop:${client.tbid}:${client.uid}`, 1, { EX: 2, NX: true, });
    if (!lvt) {
      logger.error("--------- >>>>>>>> drop", "drop");
      return false;
    }

    // redisInstances.expire("drop:" + client.uid, 5);
    getInfo.GetTbInfo(client.tbid, {}, async function (table) {
      logger.info("table---------------->", table);
      let { si } = client;
      if (!table || typeof si == "undefined" || si == -1 || !table.pi || !table.pi[si]) {
        logger.info(
          'DropCards:::::::::::::::>>>Error: "table not found or seat not found!!!"'
        );
        return false;
      }
      logger.info("DropCards------------>>>>>start Drop");
      if (table.tst == "RoundStarted" && table.pi[si].s != "drop" && table.gt !== "Points" && si != table.turn) {
        const filter = { _id: table._id, "pi.si": si };
        const upData = {
          $set: {
            la: new Date(),
            "pi.$.resumeAndDrop": true,
            "pi.$.gedt": new Date(),
          },
        };
        let tableData = await db.collection("playing_table").findOneAndUpdate(filter, upData, { new: true });
        tableData = tableData.value;
        logger.info("tableData", tableData);
        let first_drop = MAX_DEADWOOD_PTS * FIRST_DROP;
        let middle_drop = MAX_DEADWOOD_PTS * MIDDLE_DROP;
        if (tableData.gt == "Pool") {
          if (tableData.pt == 101) {
            first_drop = FIRST_DROP_101;
            middle_drop = MIDDLE_DROP_101;
          } else if (tableData.pt == 201) {
            first_drop = FIRST_DROP_201;
            middle_drop = MIDDLE_DROP_201;
          } else if (tableData.pt == 61) {
            first_drop = FIRST_DROP_61;
            middle_drop = MIDDLE_DROP_61;
          }
        }
        const cutPoints = tableData.pi[si].pickCount < 1 ? first_drop : middle_drop;
        commonClass.FireEventToTable(tableData._id.toString(), {
          en: "RESUME_AND_DROP",
          data: {
            uid: tableData.pi[si].uid,
            si: si,
            s: "optedToDrop",
            msg: `You will be dropped on your turn and ${cutPoints} pts will be added to your score.`,
            cutPoints,
            buttonShow: true,
            popupShow: true,
          },
        });
      } else if (table.tst == "RoundStarted" && table.pi[si].s != "drop"
        //  &&
        // si == table.turn
      ) {
        // jobTimerClass.cancelJobOnServers(table._id.toString(), table.jid);
        const userJobId = `${table.gt}:userTurnStart:${table._id.toString()}:${table.pi[si].uid}`;
        // scheduler.cancelJob.cancelTurnTimer(userJobId);
        cancelJob(userJobId);

        logger.info("DropCards----------if-------->>>>>");
        if (table.gt == "Deal") {
          commonData.CountHands(
            table.pi[si].uid,
            "drop",
            table.gt,
            table.bv,
            false,
            table.mode,
            table._ip,
            table.round,
            function (thp, qstWin, hpc) {
              let ps = 0;
              let indecl = false;
              if (full) {
                ps = MAX_DEADWOOD_PTS; //100% will be deducted if finish with invalid declaration
                indecl = true;
              } else {
                if (
                  (!Middle &&
                    table.pi[si].pickCount == 0 &&
                    table.pi[si].turnCounter == 1) ||
                  (table.pi[si].pickCount == 0 && table.pi[si].resumeAndDrop)
                ) {
                  ps = FIRST_DROP_DEAL; //25% will be deducted if drop without picking any cards i.e First Drop
                } else {
                  // ps = MAX_DEADWOOD_PTS*MIDDLE_DROP;    //50% will be deducted if drop after picking any cards i.e Middle Drop
                  ps = MIDDLE_DROP_DEAL; //25% will be deducted if drop without picking any cards i.e First Drop
                }
              }

              logger.info(
                "DropCards----->>>>table._id: ",
                table._id,
                " type of id: ",
                typeof table._id,
                " si: ",
                si,
                " typeof si: ",
                typeof si
              );

              let tempPlayerData = table.pi[si];
              tempPlayerData.gCards = table.pi[si].gCards;
              // tempPlayerData.gCards = {
              //   pure: [],
              //   seq: [],
              //   set: [],
              //   dwd: table.pi[si].cards,
              // };
              tempPlayerData.dCards = {
                pure: [],
                seq: [],
                set: [],
                dwd: table.pi[si].cards,
              };
              tempPlayerData.ps = ps;
              tempPlayerData.dps = table.pi[si].dps + tempPlayerData.ps;
              tempPlayerData.tdps = tempPlayerData.tdps - tempPlayerData.ps;
              tempPlayerData.gedt = new Date();
              tempPlayerData.s = "drop";
              tempPlayerData.indecl = indecl;

              let upData = {
                $set: {
                  la: new Date(),
                  ctrlServer: SERVER_ID,
                  "pi.$.thp": thp,
                  "pi.$.hpc": hpc,
                  "pi.$.s": "drop",
                  "pi.$.dCards": tempPlayerData.dCards,
                  "pi.$.ps": tempPlayerData.ps,
                  "pi.$.dps": tempPlayerData.dps,
                  "pi.$.tdps": tempPlayerData.tdps,
                  "pi.$.tScore": -ps,
                  "pi.$.gedt": new Date(),
                  "pi.$.indecl": indecl,
                },
                $inc: {
                  playCount: -1,
                  tpr: tempPlayerData.ps,
                },
              };
              logger.info("tempPlayerData.upData   upData", upData);

              let players = getInfo.getPlayingUserInRound(table.pi, true);
              logger.info(
                "DropCards---------------->>>>>>>>>>>>>>>players.length: deal mode",
                players.length
              );
              if (players.length > 0) {
                upData["$addToSet"] = { hist: { $each: [tempPlayerData] } };
              } else {
                logger.info(
                  "DropCards---------------->>>>>>>>>>>>>>>do nothing"
                );
              }
              commonData.getUserScore(
                table.pi[si].uid,
                table.bv,
                table.gt,
                function (score) {
                  upData["$set"]["pi.$.score"] = score;
                  db.collection("playing_table").findAndModify(
                    { _id: table._id, "pi.si": si },
                    {},
                    upData,
                    { new: true },
                    function (err, table1) {
                      if (!table1 || !table1.value) {
                        logger.info(
                          "DropCards:::::::::::::::::::::Error: ",
                          err
                        );
                        return false;
                      }
                      logger.info(
                        "table1.value:::::::::::::::::::::Error: ",
                        table1.value
                      );
                      let players = getInfo.getPlayingUserInRound(
                        table1.value.pi,
                        true
                      );
                      let asi = [];
                      for (const element of players) {
                        asi.push(element.si);
                      }

                      commonClass.FireEventToTable(
                        table1.value._id.toString(),
                        {
                          en: "DropCards",
                          data: {
                            uid: table.pi[si].uid,
                            si: si,
                            pts: 0,
                            asi: asi,
                            dps: tempPlayerData.dps,
                          },
                        }
                      );
                      // storeTableHistory({
                      //   tableId: table1.value._id.toString(),
                      //   eventName: "DropCards",
                      //   tableData: table1.value,
                      //   userIndex: si,
                      // });
                      logger.info(
                        "DropCards:::::::::::::::::::::players",
                        players
                      );
                      if (
                        players.length == 1 &&
                        table1.value.tst == "RoundStarted"
                      ) {
                        if (table1.value.round < table1.value.deals) {
                          getInfo.UpdateTableData(
                            table1.value._id.toString(),
                            { $set: { fnsPlayer: players[0].si } },
                            function (table2) {
                              if (table2) {
                                // winnerClass.declareRoundWinner(
                                //   table2._id.toString(),
                                //   true
                                // );
                                winnerClass.declareRoundWinnerNew(
                                  table1.value._id.toString(),
                                  si,
                                  client,
                                  true
                                );
                              } else {
                                logger.info(
                                  'DropCards------1------>>>>>>Error:"table not found"'
                                );
                              }
                            }
                          );
                        } else {
                          logger.info(
                            "DropCards:::::::::::::::::::::players[0].si: ",
                            players[0].si
                          );

                          let dCards = {
                            pure: [],
                            seq: [],
                            set: [],
                            dwd: players[0].cards,
                          };
                          let upData1 = {
                            $set: {
                              la: new Date(),
                              "pi.$.dCards": dCards,
                              fnsPlayer: players[0].si,
                            },
                          };
                          db.collection("playing_table").findAndModify(
                            {
                              _id: getInfo.MongoID(table1.value._id.toString()),
                              "pi.si": players[0].si,
                            },
                            {},
                            upData1,
                            { new: true },
                            function (err, table2) {
                              if (!table2 || !table2.value) {
                                logger.info(
                                  "DropCards::::::::::1:::::::::::Error: ",
                                  err
                                );
                                return false;
                              }
                              winnerClass.declareRoundWinnerNew(
                                table1.value._id.toString(),
                                si,
                                client,
                                true,
                                indecl
                              );
                              // winnerClass.declareDealWinner(
                              //   table1.value._id.toString(),
                              //   true,
                              //   indecl
                              // );
                            }
                          );
                        }
                      } else {
                        if (table1.value.tst == "RoundStarted") {
                          turnClass.changeTableTurn(
                            table1.value._id.toString(),
                            "drop"
                          );
                        }
                      }
                      if (!table1.value.pi[si].indecl) {
                        if (
                          table1.value.pi[si].s == "drop" &&
                          si == table.turn
                        ) {
                          commonClass.FireEventToTable(
                            table1.value._id.toString(),
                            {
                              en: "RESUME_AND_DROP",
                              data: {
                                uid: table1.value.pi[si].uid,
                                si: si,
                                s: table1.value.pi[si].s,
                                buttonShow: table1.value.pi[si].resumeAndDrop
                                  ? true
                                  : false,
                                popupShow: true,
                                cutPoints: ps,
                                msg: table1.value.pi[si].resumeAndDrop
                                  ? `You've dropped from this deal. Click on resume game to continues playing and prevent auto drop.`
                                  : `You've dropped from this deal and ${ps} pts will be added to your score. Please wait for the next deal.`,
                              },
                            }
                          );
                        } else if (
                          table1.value.pi[si].resumeAndDrop ||
                          table1.value.pi[si].s == "drop"
                        ) {
                          commonClass.FireEventToTable(
                            table1.value._id.toString(),
                            {
                              en: "RESUME_AND_DROP",
                              data: {
                                uid: table1.value.pi[si].uid,
                                si: si,
                                s: table1.value.pi[si].s,
                                buttonShow: true,
                                popupShow: true,
                                cutPoints: ps,
                                msg: "You've dropped from this deal. Click on resume game to continue playing and prevent auto drop.",
                              },
                            }
                          );
                        }
                      }
                    }
                  );
                }
              );
            }
          );
        } else if (table.gt == "Pool") {
          commonData.CountHands(
            table.pi[si].uid,
            "drop",
            table.gt,
            table.bv,
            false,
            table.mode,
            table._ip,
            table.round,
            function (thp, qstWin, hpc) {
              let ps = 0;
              let indecl = false;
              logger.info("full------------>", full);
              if (full) {
                ps = MAX_DEADWOOD_PTS; //100% will be deducted if finish with invalid declaration
                indecl = true;
                if (table.pt == 61) {
                  ps = MAX_DEADWOOD_PTS_POOL_61;
                }
              } else {
                if (
                  (!Middle &&
                    table.pi[si].pickCount == 0 &&
                    table.pi[si].turnCounter == 1) ||
                  (table.pi[si].pickCount == 0 && table.pi[si].resumeAndDrop)
                ) {
                  if (table.pt == 101) {
                    ps = FIRST_DROP_101; //25% will be deducted if drop without picking any cards i.e First Drop
                  } else if (table.pt == 201) {
                    ps = FIRST_DROP_201;
                  } else if (table.pt == 61) {
                    ps = FIRST_DROP_61;
                  }
                } else {
                  ps = MAX_DEADWOOD_PTS * MIDDLE_DROP; //50% will be deducted if drop after picking any cards i.e Middle Drop
                  if (table.pt == 101) {
                    ps = MIDDLE_DROP_101; //25% will be deducted if drop without picking any cards i.e First Drop
                  } else if (table.pt == 201) {
                    ps = MIDDLE_DROP_201;
                  } else if (table.pt == 61) {
                    ps = MIDDLE_DROP_61;
                  }
                }
              }
              logger.info("ps-------------->", ps, "-----indecl---->", indecl);
              logger.info(
                "DropCards----->>>>table._id: ",
                table._id,
                " type of id: ",
                typeof table._id,
                " si: ",
                si,
                " typeof si: ",
                typeof si
              );
              let tempPlayerData = table.pi[si];
              tempPlayerData.s = "drop";
              tempPlayerData.indecl = indecl;
              tempPlayerData.gCards = table.pi[si].gCards;
              // tempPlayerData.gCards = {
              //   pure: [],
              //   seq: [],
              //   set: [],
              //   dwd: table.pi[si].cards,
              // };
              tempPlayerData.dCards = {
                pure: [],
                seq: [],
                set: [],
                dwd: table.pi[si].cards,
              };
              tempPlayerData.ps = ps; //cardsClass.cardsSum(table.pi[si].cards,table.wildCard);
              logger.info("tempPlayerData.ps------->", tempPlayerData.ps);
              logger.info("table.pi[si].dps------->", table.pi[si].dps);
              tempPlayerData.dps = table.pi[si].dps + tempPlayerData.ps;
              //fix drop issue 2 player
              tempPlayerData.tdps = table.pi[si].tdps - tempPlayerData.ps;
              logger.info("tdps----------->", tempPlayerData.tdps);
              logger.info("dps----------->", tempPlayerData.dps);
              tempPlayerData.gedt = new Date();
              let upData = {
                $set: {
                  la: new Date(),
                  ctrlServer: SERVER_ID,
                  "pi.$.thp": thp,
                  "pi.$.hpc": hpc,
                  "pi.$.s": "drop",
                  "pi.$.indecl": indecl,
                  "pi.$.dCards": tempPlayerData.dCards,
                  "pi.$.ps": tempPlayerData.ps,
                  "pi.$.dps": tempPlayerData.dps,
                  "pi.$.tdps": tempPlayerData.tdps, // fix
                  "pi.$.gedt": new Date(),
                },
                $inc: {
                  playCount: -1,
                },
              };

              let players = getInfo.getPlayingUserInRound(table.pi, true);
              logger.info(
                "DropCards---------------->>>>>>>>>>>>>>>players.length:",
                players.length
              );
              if (players.length > 0) {
                upData["$addToSet"] = { hist: { $each: [tempPlayerData] } };
              } else {
                logger.info(
                  "DropCards---------------->>>>>>>>>>>>>>>do nothing"
                );
              }

              commonData.getUserScore(
                table.pi[si].uid,
                table.bv,
                table.gt,
                function (score) {
                  logger.info("scor----------->", score);
                  logger.info("upData--------->", upData);
                  upData["$set"]["pi.$.score"] = score;
                  db.collection("playing_table").findAndModify(
                    { _id: table._id, "pi.si": si },
                    {},
                    upData,
                    { new: true },
                    async function (err, table1) {
                      if (
                        !table1 ||
                        !table1.value ||
                        !table1.value.pi ||
                        !table1.value.pi[si]
                      ) {
                        logger.info("DropCards::::::::::::::::::::err: ", err);
                        return false;
                      }
                      logger.info("---------hel-----------------");
                      logger.info("table1----------------->", table1.value.pi);
                      let players = getInfo.getPlayingUserInRound(
                        table1.value.pi,
                        true
                      );
                      logger.info("plaayers------------->", players);
                      let asi = [];
                      for (let i = 0; i < players.length; i++) {
                        asi.push(players[i].si);
                      }
                      logger.info("plaayers------------->--", players.length);
                      commonClass.FireEventToTable(
                        table1.value._id.toString(),
                        {
                          en: "DropCards",
                          data: {
                            uid: table.pi[si].uid,
                            si: si,
                            pts: 0,
                            asi: asi,
                            dps: tempPlayerData.dps,
                          },
                        }
                      );

                      // storeTableHistory({
                      //   tableId: table1.value._id.toString(),
                      //   eventName: "DropCards",
                      //   tableData: table1.value,
                      //   userIndex: si,
                      // });

                      let game_id =
                        table1.value.game_id + "." + table1.value.sub_id;
                      logger.info(
                        "----------------table1.value.pt--------------",
                        table1.value.pt
                      );
                      logger.info("players.length------->", players.length);
                      logger.info(
                        "table1.value.pi[si].dps >= table1.value.pt------------->",
                        table1.value.pi[si].dps >= table1.value.pt
                      );
                      //leave logic here
                      // if (table1.value.pi[si].dps >= table1.value.pt /*101*/) {
                      //   //incase player points go beyond 101 then leave that player

                      //   getInfo.GetUserInfo(
                      //     table1.value.pi[si].uid,
                      //     { sck: 1 },
                      //     function (userInfo) {
                      //       let single = "";
                      //       if (
                      //         userInfo &&
                      //         typeof userInfo.sck == "string" &&
                      //         userInfo.sck != ""
                      //       ) {
                      //         single = userInfo.sck.replace(/s\d*_\d*./i, "");
                      //       }

                      //       let game_id =
                      //         table1.value.game_id + "." + table1.value.sub_id;
                      //       leaveTableClass.LeaveTable(
                      //         { flag: "lostPool" },
                      //         {
                      //           leave: 1,
                      //           id: single,
                      //           uid: table1.value.pi[si].uid,
                      //           _ir: table1.value.pi[si]._ir,
                      //           si: si,
                      //           tbid: table1.value._id.toString(),
                      //         }
                      //       );
                      //     }
                      //   );
                      // } else {
                      if (
                        players.length == 1 &&
                        table1.value.tst == "RoundStarted"
                      ) {
                        // let players1 = getInfo.getPlayingUserInGame(
                        //   table1.value.pi,
                        //   true
                        // );
                        // logger.info("players------------>", players1.length);
                        // logger.info(
                        //   "players1.length > 1--------->",
                        //   players1.length > 1
                        // );
                        if (players.length > 1 /* players1.length > 1 */) {
                          logger.info("in--if---");
                          //if more than one playing user in running pool then only round winner will be declared
                          logger.info(
                            "Id---------->",
                            table1.value._id.toString()
                          );
                          logger.info("Id----2------>", table1.value._id);
                          logger.info(
                            "players[0].si ----------->",
                            players[0].si
                          );
                          let where = {
                            _id: getInfo.MongoID(table1.value._id),
                          };
                          const updateData = await db
                            .collection("playing_table")
                            .findAndModify(
                              where,
                              {},
                              { $set: { fnsPlayer: players[0].si } },
                              { new: true }
                            );
                          logger.info("updateData---------->", updateData);
                          logger.info(
                            "updateData------2---->",
                            updateData.value.pi
                          );
                          /* const updateData = await db.collection("playing_table").findAndModify(
                              { _id: getInfo.MongoID(table1.value._id) },
                              {
                                $set: {
                                  fnsPlayer: players[0].si
                                }
                              },
                              { new: true }
                            );
                            logger.info('updateData---------->', updateData);
                            logger.info('updateData------2---->', updateData.value.pi); */
                          /* getInfo.UpdateTableData(
                              table1.value._id.toString(),
                              { $set: { fnsPlayer: players[0].si } },

                              function (table2) {

                                if (table2) {
                                  logger.info('table2------------>', table2);
                                  // round winner logic here
                                  winnerClass.declareRoundWinner(
                                    table2.value._id,
                                    true
                                  );
                                } else {
                                  logger.info(
                                    'DropCards--------------->>>>>Error:"table not found"'
                                  );
                                }
                              }
                            ); */
                          // // this is fixed for circular dependency problem.
                          // const winnerClass = require("./winner.class");
                          winnerClass.declareRoundWinnerNew(
                            updateData.value._id.toString(),
                            si,
                            client,
                            true
                          );
                          // winnerClass.declareRoundWinner(
                          //   updateData.value._id,
                          //   true
                          // );
                        } else if (
                          players.length == 1 /* players1.length == 1 */
                        ) {
                          logger.info("in----else---if---");
                          winnerClass.handlePoolWinner(
                            table1.value._id.toString(),
                            // table2._id.toString(),
                            players[0].si,
                            true
                          );
                        } else {
                          logger.info(
                            "DropCards---------->>>>>>table is empty"
                          );
                        }
                      } else {
                        if (table1.value.tst == "RoundStarted") {
                          turnClass.changeTableTurn(
                            table1.value._id.toString(),
                            "drop"
                          );
                        }
                      }
                      if (!table1.value.pi[si].indecl) {
                        if (
                          table1.value.pi[si].s == "drop" &&
                          si == table.turn
                        ) {
                          commonClass.FireEventToTable(
                            table1.value._id.toString(),
                            {
                              en: "RESUME_AND_DROP",
                              data: {
                                uid: table1.value.pi[si].uid,
                                si: si,
                                s: table1.value.pi[si].s,
                                buttonShow: table1.value.pi[si].resumeAndDrop
                                  ? true
                                  : false,
                                popupShow: true,
                                cutPoints: ps,
                                msg: table1.value.pi[si].resumeAndDrop
                                  ? `You've dropped from this deal. Click on resume game to continues playing and prevent auto drop.`
                                  : `You've dropped from this deal and ${ps} pts will be added to your score. Please wait for the next deal.`,
                              },
                            }
                          );
                        } else if (
                          table1.value.pi[si].resumeAndDrop ||
                          table1.value.pi[si].s == "drop"
                        ) {
                          commonClass.FireEventToTable(
                            table1.value._id.toString(),
                            {
                              en: "RESUME_AND_DROP",
                              data: {
                                uid: table1.value.pi[si].uid,
                                si: si,
                                s: table1.value.pi[si].s,
                                buttonShow: true,
                                popupShow: true,
                                cutPoints: ps,
                                msg: "You've dropped from this deal. Click on resume game to continue playing and prevent auto drop.",
                              },
                            }
                          );
                        }
                      }
                    }
                    // }
                  );
                }
              );
            }
          );
        } else {
          let pvv = table.bv * MAX_DEADWOOD_PTS;

          let cutChips = 0;
          let pts = 0;
          let chp = pvv - cutChips;
          let invalidDclr = false;

          if (full) {
            cutChips = MAX_DEADWOOD_PTS * table.bv; //100% will be deducted if finish with invalid declaration
            chp = 0;
            pts = MAX_DEADWOOD_PTS;
            invalidDclr = true;
          } else {
            if (
              !Middle &&
              table.pi[si].pickCount == 0 &&
              table.pi[si].turnCounter == 1
            ) {
              cutChips = MAX_DEADWOOD_PTS * table.bv * FIRST_DROP; //25% will be deducted if drop without picking any cards i.e First Drop
              chp = pvv - cutChips;
              pts = MAX_DEADWOOD_PTS * FIRST_DROP;
            } else {
              cutChips = MAX_DEADWOOD_PTS * table.bv * MIDDLE_DROP; //50% will be deducted if drop after picking any cards i.e Middle Drop
              chp = pvv - cutChips;
              pts = MAX_DEADWOOD_PTS * MIDDLE_DROP;
            }
          }

          logger.info("DropCards-------->>>cutChips: ", cutChips);
          if (!table.pi[si]) {
            logger.info(
              "DropCards::::::::::::::::table._id: " +
              table._id +
              " si: " +
              si +
              " table.pi: ",
              table.pi + " ::::::>>>" + new Date()
            );
            return false;
          }

          if (table.mode == "practice") {
            commonData.UpdateCashForPlayInTable(
              table._id.toString(),
              table.pi[si].uid,
              chp,
              "Card Drop Deduction",
              function (uChips) {
                if (typeof uChips != "undefined") {
                  commonData.CountHands(
                    table.pi[si].uid,
                    "drop",
                    table.gt,
                    table.bv,
                    false,
                    table.mode,
                    table._ip,
                    table.round,
                    function (thp, qstWin, hpc) {
                      logger.info(
                        "DropCards----->>>>table._id: ",
                        table._id,
                        " type of id: ",
                        typeof table._id,
                        " si: ",
                        si,
                        " typeof si: ",
                        typeof si
                      );
                      let tempPlayerData = table.pi[si];
                      tempPlayerData.s = "drop";
                      tempPlayerData.Chips = uChips;
                      tempPlayerData.wc = -cutChips;
                      tempPlayerData.pts = pts;
                      tempPlayerData.indecl = invalidDclr;
                      tempPlayerData.gCards = table.pi[si].gCards;
                      tempPlayerData.dCards = {
                        pure: [],
                        seq: [],
                        set: [],
                        dwd: table.pi[si].cards,
                      };
                      tempPlayerData.ps = pts; //cardsClass.cardsSum(table.pi[si].cards,table.wildCard);
                      tempPlayerData.dps = pts;
                      tempPlayerData.gedt = new Date();
                      let upData = {
                        $set: {
                          la: new Date(),
                          ctrlServer: SERVER_ID,
                          "pi.$.thp": thp,
                          "pi.$.hpc": hpc,
                          "pi.$.s": "drop",
                          "pi.$.indecl": invalidDclr,
                          "pi.$.Chips": uChips,
                          "pi.$.wc": -cutChips,
                          "pi.$.dCards": {
                            pure: [],
                            seq: [],
                            set: [],
                            dwd: table.pi[si].cards,
                          },
                          "pi.$.ps": tempPlayerData.ps,
                          "pi.$.pts": pts,
                          "pi.$.gedt": new Date(),
                        },
                        $inc: { "pi.$.rl": 1, pv: cutChips, playCount: -1 },
                      };
                      let players = getInfo.getPlayingUserInRound(
                        table.pi,
                        true
                      );
                      logger.info(
                        "DropCards---------------->>>>>>>>>>>>>>>players.length:",
                        players.length
                      );
                      if (players.length > 0) {
                        upData["$addToSet"] = { hist: tempPlayerData };
                      } else {
                        logger.info(
                          "DropCards---------------->>>>>>>>>>>>>>>do nothing"
                        );
                      }

                      commonData.getUserScore(
                        table.pi[si].uid,
                        table.bv,
                        table.gt,
                        function (score) {
                          upData["$set"]["pi.$.score"] = score;
                          db.collection("playing_table").findAndModify(
                            { _id: table._id, "pi.si": si },
                            {},
                            upData,
                            { new: true },
                            function (err, table1) {
                              if (!table1 || !table1.value) {
                                logger.info(
                                  "DropCards::::::::::::::::::::err: ",
                                  err
                                );
                                return false;
                              }

                              let players = getInfo.getPlayingUserInRound(
                                table1.value.pi,
                                true
                              );
                              let asi = [];
                              let chipsArray = [];
                              for (const element of players) {
                                asi.push(element.si);
                                chipsArray.push(element.Chips);
                              }

                              commonClass.FireEventToTable(
                                table1.value._id.toString(),
                                {
                                  en: "DropCards",
                                  data: {
                                    uid: table.pi[si].uid,
                                    si: si,
                                    pts: pts,
                                    wc: -cutChips,
                                    asi: asi,
                                    bet: table.pi[si].bet,
                                    dps: tempPlayerData.dps,
                                  },
                                }
                              );

                              // storeTableHistory({
                              //   tableId: table1.value._id.toString(),
                              //   eventName: "DropCards",
                              //   tableData: table1.value,
                              //   userIndex: si,
                              // });

                              let game_id = table1.value.game_id;
                              let sts = "drop";
                              if (full) {
                                sts = "invalid_declare";
                              }

                              if (
                                players.length == 1 &&
                                table1.value.tst == "RoundStarted"
                              ) {
                                winnerClass.handleWinner(
                                  table1.value._id.toString(),
                                  players[0].si /*,table1.value.pv*/,
                                  true
                                );
                              } else {
                                if (table1.value.tst == "RoundStarted") {
                                  turnClass.changeTableTurn(
                                    table1.value._id.toString(),
                                    "drop"
                                  );
                                }
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
              table._id.toString(),
              table.pi[si].uid,
              chp,
              "Card Drop Deduction",
              function (uChips) {
                if (typeof uChips != "undefined") {
                  commonData.CountHands(
                    table.pi[si].uid,
                    "drop",
                    table.gt,
                    table.bv,
                    false,
                    table.mode,
                    table._ip,
                    table.round,
                    function (thp, qstWin, hpc) {
                      logger.info(
                        "DropCards----->>>>table._id: ",
                        table._id,
                        " type of id: ",
                        typeof table._id,
                        " si: ",
                        si,
                        " typeof si: ",
                        typeof si
                      );
                      let tempPlayerData = table.pi[si];
                      tempPlayerData.s = "drop";
                      tempPlayerData.cash = uChips;
                      tempPlayerData.wc = -cutChips;
                      tempPlayerData.pts = pts;
                      tempPlayerData.indecl = invalidDclr;

                      tempPlayerData.gCards = table.pi[si].gCards;
                      tempPlayerData.dCards = {
                        pure: [],
                        seq: [],
                        set: [],
                        dwd: table.pi[si].cards,
                      };
                      tempPlayerData.ps = pts; //cardsClass.cardsSum(table.pi[si].cards,table.wildCard);
                      tempPlayerData.dps = pts;
                      tempPlayerData.gedt = new Date();
                      let upData = {
                        $set: {
                          la: new Date(),
                          ctrlServer: SERVER_ID,
                          "pi.$.thp": thp,
                          "pi.$.hpc": hpc,
                          "pi.$.s": "drop",
                          "pi.$.indecl": invalidDclr,
                          "pi.$.Chips": uChips,
                          "pi.$.wc": -cutChips,
                          "pi.$.dCards": {
                            pure: [],
                            seq: [],
                            set: [],
                            dwd: table.pi[si].cards,
                          },
                          "pi.$.ps": tempPlayerData.ps,
                          "pi.$.pts": pts,
                          "pi.$.gedt": new Date(),
                        },
                        $inc: { "pi.$.rl": 1, pv: cutChips, playCount: -1 },
                      };
                      let players = getInfo.getPlayingUserInRound(
                        table.pi,
                        true
                      );
                      logger.info(
                        "DropCards---------------->>>>>>>>>>>>>>>players.length:",
                        players.length
                      );
                      if (players.length > 0) {
                        upData["$addToSet"] = { hist: tempPlayerData };
                      } else {
                        logger.info(
                          "DropCards---------------->>>>>>>>>>>>>>>do nothing"
                        );
                      }

                      commonData.getUserScore(
                        table.pi[si].uid,
                        table.bv,
                        table.gt,
                        function (score) {
                          upData["$set"]["pi.$.score"] = score;
                          db.collection("playing_table").findAndModify(
                            { _id: table._id, "pi.si": si },
                            {},
                            upData,
                            { new: true },
                            function (err, table1) {
                              if (!table1 || !table1.value) {
                                logger.info(
                                  "DropCards::::::::::::::::::::err: ",
                                  err
                                );
                                return false;
                              }

                              let players = getInfo.getPlayingUserInRound(
                                table1.value.pi,
                                true
                              );
                              let asi = [];
                              let chipsArray = [];
                              for (let i = 0; i < players.length; i++) {
                                asi.push(players[i].si);
                                chipsArray.push(players[i].cash);
                              }

                              commonClass.FireEventToTable(
                                table1.value._id.toString(),
                                {
                                  en: "DropCards",
                                  data: {
                                    uid: table.pi[si].uid,
                                    si: si,
                                    pts: pts,
                                    wc: -cutChips,
                                    asi: asi,
                                    bet: table.pi[si].bet,
                                    dps: tempPlayerData.dps,
                                  },
                                }
                              );

                              // storeTableHistory({
                              //   tableId: table1.value._id.toString(),
                              //   eventName: "DropCards",
                              //   tableData: table1.value,
                              //   userIndex: si,
                              // });

                              let game_id = table1.value.game_id;
                              let sts = "drop";
                              if (full) {
                                sts = "invalid_declare";
                              }

                              if (
                                players.length == 1 &&
                                table1.value.tst == "RoundStarted"
                              ) {
                                winnerClass.handleWinnerCash(
                                  table1.value._id.toString(),
                                  players[0].si /*,table1.value.pv*/,
                                  true
                                );
                              } else {
                                if (table1.value.tst == "RoundStarted") {
                                  turnClass.changeTableTurn(
                                    table1.value._id.toString(),
                                    "drop"
                                  );
                                }
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
          "DropCards------------->>>>>>table: " +
          table._id.toString() +
          " table.tst : " +
          table.tst +
          " si: " +
          si
        );
      }
    });
  } catch (error) {
    logger.error("-----> error DropCards", error);
    getInfo.exceptionError(error);
  }
  // console.timeEnd("latency timer DropCards");
};

const ResumeAndDrop = async (data, client) => {
  try {
    const redisInstances = getRedisInstances();
    const {
      MAX_DEADWOOD_PTS,
      FIRST_DROP,
      MIDDLE_DROP,
      FIRST_DROP_101,
      MIDDLE_DROP_101,
      FIRST_DROP_201,
      MIDDLE_DROP_201,
      FIRST_DROP_61,
      MIDDLE_DROP_61,
    } = GetConfig();
    const lvt = await redisInstances.SET(`ResumeAndDrop:${client.tbid}:${client.uid}`, 1, { EX: 2, NX: true, });

    if (!lvt) {
      return false;
    }

    getInfo.GetTbInfo(client.tbid, {}, async function (table) {
      logger.info("table---------------->", table);
      let si = client.si;
      if (
        !table ||
        typeof si == "undefined" ||
        si == -1 ||
        !table.pi ||
        !table.pi[si]
      ) {
        logger.info(
          'ResumeAndDrop:::::::::::::::>>>Error: "table not found or seat not found!!!"'
        );
        return false;
      }
      logger.info("ResumeAndDrop------------>>>>>start Drop");
      if (
        table.tst == "RoundStarted" &&
        table.pi[si].resumeAndDrop &&
        table.gt !== "Points"
      ) {
        // schedule.cancelJob(
        //   "RESUME_AND_DROP" + table._id.toString() + table.pi[si].uid
        // );
        const resumeAndDropId = `${table.gt}:resumeAndDrop:${table._id.toString()}:${client.uid}`;
        // await scheduler.cancelJob.cancelResumeAndDrop(resumeAndDropId);
        cancelJob(resumeAndDropId);

        const filter = {
          _id: table._id,
          "pi.uid": client.uid,
        };
        const upData = {
          $set: {
            la: new Date(),
            "pi.$.resumeAndDrop": false,
            "pi.$.gedt": new Date(),
          },
        };
        let tableData = await db
          .collection("playing_table")
          .findOneAndUpdate(filter, upData, {
            new: true,
            returnOriginal: false,
          });
        tableData = tableData.value;
        logger.info("tableData", tableData);

        let first_drop = MAX_DEADWOOD_PTS * FIRST_DROP;
        let middle_drop = MAX_DEADWOOD_PTS * MIDDLE_DROP;
        if (tableData.gt == "Pool") {
          if (tableData.pt == 101) {
            first_drop = FIRST_DROP_101;
            middle_drop = MIDDLE_DROP_101;
          } else if (tableData.pt == 201) {
            first_drop = FIRST_DROP_201;
            middle_drop = MIDDLE_DROP_201;
          } else if (tableData.pt == 61) {
            first_drop = FIRST_DROP_61;
            middle_drop = MIDDLE_DROP_61;
          }
        }
        const cutPoints =
          tableData.pi[si].pickCount < 1 ? first_drop : middle_drop;

        commonClass.FireEventToTable(tableData._id.toString(), {
          en: "RESUME_AND_DROP",
          data: {
            uid: tableData.pi[si].uid,
            si: si,
            s: tableData.pi[si].s,
            buttonShow: tableData.pi[si].s == "drop" ? false : true,
            popupShow: tableData.pi[si].s == "drop" ? true : false,
            cutPoints,
            msg:
              tableData.pi[si].s == "drop"
                ? `You've dropped from this deal and ${cutPoints} pts will be added to your score. Please wait for the next deal.`
                : "",
          },
        });
      } else {
        logger.info(
          "ResumeAndDrop------------->>>>>>table: " +
          table._id.toString() +
          " table.tst : " +
          table.tst +
          " si: " +
          si
        );
      }
    });
  } catch (error) {
    logger.error("-----> error ResumeAndDrop", error);
    getInfo.exceptionError(error);
  }
};

module.exports = { DropCards, ResumeAndDrop };

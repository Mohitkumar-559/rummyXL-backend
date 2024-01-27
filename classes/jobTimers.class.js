const _ = require("underscore");
const getInfo = require("../common");
const turnClass = require("./turn.class");
const commonClass = require("./common.class.js"); //common functions
const throwCardClass = require("./throwCard.class");
const logger = require("../utils/logger");
const scheduler = require("../scheduler");
const { DROP_CARD_TIMEOUT, LEAVE_TABLE_TIMEOUT } = require("../constants/eventName");
const { addQueue } = require("../scheduler/bullQueue");

const onTurnExpire = (table) => {
  //performs the after task when the player's timeout
  /* +-------------------------------------------------------------------+
      desc:function to handle process after player's turn time expires
      i/p: table =  {_id = table id, turn = seat index of turn user}
    +-------------------------------------------------------------------+ */
  if (!table || !table._id) {
    logger.info(
      'onTurnExpire:::::::::::::::::::>>>>>Error: "table not found"' +
      new Date()
    );
    return false;
  }

  getInfo.GetTbInfo(table._id.toString(), {}, function (tbInfo) {
    if (tbInfo) {
      logger.info(
        "onTurnExpire---------------->>>>>>table.turn: " +
        table.turn +
        " tbInfo.turn: " +
        tbInfo.turn
      );
      if (tbInfo.turn == table.turn) {
        //means only turn user turn get expired

        let { maxUserTimeout } = tbInfo.pi[tbInfo.turn];
        logger.info("maxUserTimeout--------->", maxUserTimeout);

        if (tbInfo.pi[tbInfo.turn]._ir == 0) {
          let time = 0;
          db.collection("playing_table").findAndModify(
            { _id: getInfo.MongoID(table._id.toString()), "pi.si": table.turn },
            {},
            {
              $set: {
                la: new Date(),
                ctrlServer: SERVER_ID,
                "pi.$.sct": false,
                "pi.$._uur": 1,
                "pi.$.secTime": time,
              },
              $inc: { "pi.$.tCount": 1 },
            },
            { new: true },
            function (err, table1) {
              if (!table1 || !table1.value) {
                logger.info(
                  'onTurnExpire:::::::::::::::::::>>>>Error: "table not found!!!"'
                );
                return false;
              }

              if (
                table1.value.turn == -1 ||
                typeof table1.value.pi[table1.value.turn] == "undefined"
              ) {
                logger.info(
                  'onTurnExpire:::::::::::::::::::>>>>Error: "table turn not found!!!"',
                  table1.value.turn
                );
                return false;
              }
              if (
                typeof table1.value.pi[table1.value.turn].cards == "undefined"
              ) {
                logger.info(
                  'onTurnExpire::::::::::::::::::>>>>>Error: "turn user cards not found"'
                );
                return false;
              }
              // this is fixed for circular dependency problem.
              const dropCardClass = require("./dropCards.class");

              // if user exceeds max time limit
              let cardToThrow = "";

              if (table1.value.pi[table1.value.turn].cards.length > 13) {
                //card to throw when user have picked the card and timeout happens
                cardToThrow = table1.value.pi[table1.value.turn].cards.pop();
                logger.info("onTurnExpire-------->>>>cardToThrow: ", cardToThrow);

                let { gCards } = table1.value.pi[table1.value.turn];

                if (gCards.pure.length > 0) {
                  let pureCards = gCards.pure;
                  logger.info(
                    "onTurnExpire---------->>>>>>gCards: ",
                    pureCards
                  );

                  for (let x in pureCards) {
                    if (_.contains(pureCards[x], cardToThrow)) {
                      pureCards[x] = _.without(pureCards[x], cardToThrow);
                      break;
                    }
                  }
                  logger.info("onTurnExpire------------->>>>>gCards: ", gCards);
                  gCards.pure = pureCards;
                }

                if (gCards.seq.length > 0) {
                  let seqCards = gCards.seq;
                  logger.info("onTurnExpire---------->>>>>>gCards: ", seqCards);
                  for (let x in seqCards) {
                    if (_.contains(seqCards[x], cardToThrow)) {
                      seqCards[x] = _.without(seqCards[x], cardToThrow);
                      break;
                    }
                  }
                  logger.info(
                    "onTurnExpire------------->>>>>gCards: ",
                    seqCards
                  );
                  gCards.seq = seqCards;
                }

                if (gCards.set.length > 0) {
                  let setCards = gCards.set;
                  logger.info("onTurnExpire---------->>>>>>gCards: ", setCards);
                  for (let x in setCards) {
                    if (_.contains(setCards[x], cardToThrow)) {
                      setCards[x] = _.without(setCards[x], cardToThrow);
                      break;
                    }
                  }
                  logger.info(
                    "onTurnExpire------------->>>>>gCards: ",
                    setCards
                  );
                  gCards.set = setCards;
                }

                if (gCards.dwd.length > 0) {
                  let dwdCards = gCards.dwd;
                  logger.info("onTurnExpire---------->>>>>>gCards: ", dwdCards);
                  for (let x in dwdCards) {
                    if (_.contains(dwdCards[x], cardToThrow)) {
                      dwdCards[x] = _.without(dwdCards[x], cardToThrow);
                      break;
                    }
                  }
                  logger.info(
                    "onTurnExpire------------->>>>>gCards: ",
                    dwdCards
                  );
                  gCards.dwd = dwdCards;
                }

                let { allCards } = table1.value.pi[table1.value.turn].userShowCard;
                logger.info("allCards", allCards);

                const updateAllCards = [];
                if (allCards?.length > 0) {
                  for (const iterator of allCards) {
                    updateAllCards.push(iterator.filter(s => s != cardToThrow));
                  }
                }

                table1.value.pi[table1.value.turn].userShowCard.allCards = updateAllCards.length > 0 ? updateAllCards : allCards;


                db.collection("playing_table").findAndModify(
                  { _id: table1.value._id, "pi.si": table1.value.turn },
                  {},
                  {
                    $set: {
                      la: new Date(),
                      ctrlServer: SERVER_ID,
                      "pi.$.cards": table1.value.pi[table1.value.turn].cards,
                      "pi.$.gCards": gCards,
                      "pi.$.userShowCard": table1.value.pi[table1.value.turn].userShowCard,
                    },
                    $push: { oDeck: cardToThrow },
                  },
                  function (err, table2) {
                    if (table2 && table2.value) {
                      commonClass.FireEventToTable(
                        table2.value._id.toString(),
                        {
                          en: "TurnedUserTimeout",
                          data: {
                            si: table2.value.turn,
                            uid: table2.value.pi[table2.value.turn].uid,
                            ctth: cardToThrow,
                          },
                        }
                      ); //TurnedUserTimeout : turned user time out
                      getInfo.GetUserInfo(
                        table2.value.pi[table2.value.turn].uid,
                        { sck: 1 },
                        function (uSck) {
                          // update if condition expression
                          if (
                            table2.value.pi[table2.value.turn].tCount >=
                            maxUserTimeout
                          ) {
                            let single = "";
                            if (
                              uSck &&
                              typeof uSck.sck == "string" &&
                              uSck.sck != ""
                            ) {
                              single = uSck.sck.replace(/s\d*_\d*./i, "");
                            }

                            if (table2.value.gt == "Points") {
                              // as par new flow do not leave table if user has pick cards.

                              // setTimeout(function () {
                              //   leaveTableClass.LeaveTable(
                              //     { flag: "auto" },
                              //     {
                              //       leave: 1,
                              //       id: single,
                              //       uid: table2.value.pi[table2.value.turn]
                              //         .uid,
                              //       _ir: table2.value.pi[table2.value.turn]
                              //         ._ir,
                              //       si: table2.value.turn,
                              //       tbid: table2.value._id.toString(),
                              //     }
                              //   );
                              // }, 450);

                              turnClass.changeTableTurn(
                                table2.value._id.toString(),
                                "pick_skip"
                              );
                              return false;
                            } else if (
                              table2.value.gt == "Pool" ||
                              table2.value.gt == "Deal"
                            ) {
                              let full = false;
                              let middle = true;
                              // if (
                              //   table2.value.gt == "Deal" &&
                              //   table2.value.ms == 2
                              // ) {
                              //   full = true;
                              //   middle = false;
                              // }

                              const jobId = `${table2.value.gt}:dropCardTimeout:${table2.value._id.toString()}:${table2.value.pi[table2.value.turn].uid}`;
                              // scheduler.queues.dropCardTimeout({
                              //   timer: 450,
                              //   jobId,
                              //   firstParams: { internalDropCards: true },
                              //   secondParams: {
                              //     tbid: table2.value._id.toString(),
                              //     si: table2.value.turn,
                              //   },
                              //   thirdParams: full,
                              //   fourthParams: middle
                              // });

                              const jobData = {
                                firstParams: { internalDropCards: true },
                                secondParams: {
                                  tbid: table2.value._id.toString(),
                                  si: table2.value.turn,
                                },
                                thirdParams: full,
                                fourthParams: middle,
                                calling: DROP_CARD_TIMEOUT
                              };
                              const jobOption = { delay: 450, jobId };
                              addQueue(jobData, jobOption);

                              // setTimeout(function () {
                              //   dropCardClass.DropCards(
                              //     { internalDropCards: true },
                              //     {
                              //       tbid: table2.value._id.toString(),
                              //       si: table2.value.turn,
                              //     },
                              //     full,
                              //     middle
                              //   );
                              // }, 450);
                              return false;
                            }
                          } else {
                            turnClass.changeTableTurn(
                              table2.value._id.toString(),
                              "pick_skip"
                            );
                          }
                        }
                      );
                    } else {
                      logger.info(
                        'onTurnExpire::::::::::::::::::::::::::>>>>"table data not found"'
                      );
                    }
                  }
                );
              } else {
                commonClass.FireEventToTable(table1.value._id.toString(), {
                  en: "TurnedUserTimeout",
                  data: {
                    si: table1.value.turn,
                    uid: table1.value.pi[table1.value.turn].uid,
                    ctth: cardToThrow,
                  },
                });
                getInfo.GetUserInfo(
                  table1.value.pi[table1.value.turn].uid,
                  { sck: 1 },
                  function (uSck) {
                    // update if condition expression
                    if (table1.value.pi[table1.value.turn].tCount >= maxUserTimeout) {
                      //user leave logic here   auto : 1 for LeaveTable
                      let single;
                      if (uSck && typeof uSck.sck == "string" && uSck.sck != "") {
                        single = uSck.sck.replace(/s\d*_\d*./i, "");
                      } else {
                        single = "";
                      }

                      if (table1.value.gt == "Points") {
                        // setTimeout(function () {
                        //   //latency
                        //   leaveTableClass.LeaveTable(
                        //     { flag: "auto" },
                        //     {
                        //       leave: 1,
                        //       id: single,
                        //       uid: table1.value.pi[table1.value.turn].uid,
                        //       _ir: table1.value.pi[table1.value.turn]._ir,
                        //       si: table1.value.pi[table1.value.turn].si,
                        //       tbid: table1.value._id.toString(),
                        //     }
                        //   );
                        // }, 450);

                        const jobId = `${table1.value.gt}:leaveTableTimeout:${table1.value._id.toString()}:${table1.value.pi[table1.value.turn].uid}`;
                        // scheduler.queues.leaveTableTimeout({
                        //   timer: 450,
                        //   jobId,
                        //   firstParams: { flag: "auto" },
                        //   secondParams: {
                        //     leave: 1,
                        //     id: single,
                        //     uid: table1.value.pi[table1.value.turn].uid,
                        //     _ir: table1.value.pi[table1.value.turn]._ir,
                        //     si: table1.value.pi[table1.value.turn].si,
                        //     tbid: table1.value._id.toString(),
                        //   }
                        // });

                        const jobData = {
                          firstParams: { flag: "auto" },
                          secondParams: {
                            leave: 1,
                            id: single,
                            uid: table1.value.pi[table1.value.turn].uid,
                            _ir: table1.value.pi[table1.value.turn]._ir,
                            si: table1.value.pi[table1.value.turn].si,
                            tbid: table1.value._id.toString(),
                          },
                          calling: LEAVE_TABLE_TIMEOUT
                        };
                        const jobOption = { delay: 450, jobId };
                        addQueue(jobData, jobOption);

                        return false;
                      } else if (
                        table1.value.gt == "Pool" ||
                        table1.value.gt == "Deal"
                      ) {
                        let full = false;
                        let middle = true;
                        // if (table1.value.gt == "Deal" && table1.value.ms == 2) {
                        //   full = true;
                        //   middle = false;
                        // }
                        // setTimeout(function () {
                        //   dropCardClass.DropCards(
                        //     { internalDropCards: true },
                        //     {
                        //       tbid: table1.value._id.toString(),
                        //       si: table1.value.turn,
                        //     },
                        //     full,
                        //     middle
                        //   );
                        // }, 450);
                        const jobId = `${table1.value.gt}:dropCardTimeout:${table1.value._id.toString()}:${table1.value.pi[table1.value.turn].uid}`;
                        // scheduler.queues.dropCardTimeout({
                        //   timer: 450,
                        //   jobId,
                        //   firstParams: { internalDropCards: true },
                        //   secondParams: {
                        //     tbid: table1.value._id.toString(),
                        //     si: table1.value.turn,
                        //   },
                        //   thirdParams: full,
                        //   fourthParams: middle
                        // });

                        const jobData = {
                          firstParams: { internalDropCards: true },
                          secondParams: {
                            tbid: table1.value._id.toString(),
                            si: table1.value.turn,
                          },
                          thirdParams: full,
                          fourthParams: middle,
                          calling: DROP_CARD_TIMEOUT
                        };
                        const jobOption = { delay: 450, jobId };
                        addQueue(jobData, jobOption);
                        return false;
                      }
                    } else {
                      turnClass.changeTableTurn(
                        table1.value._id.toString(),
                        "skip"
                      );
                    }
                  }
                );
              }
            }
          );
        }
        else if (table.pi[table.turn].cards.length > 13) {
          let cardToThrow = table.pi[table.turn].cards.pop();
          let { bet } = table.pi[table.turn];
          throwCardClass.ThrowCard(
            { card: cardToThrow, bet: bet },
            { si: table.turn, tbid: table._id.toString() }
          );
        }
        else {
          turnClass.changeTableTurn(table._id.toString(), "skip");
        }
      } else {
        logger.info(
          "onTurnExpire----------" +
          tbInfo._id.toString() +
          "---------->>>>>turn mismatch!!!! table.turn: " +
          table.turn +
          " != tbInfo.turn: " +
          tbInfo.turn +
          " " +
          new Date()
        );
      }
    } else {
      logger.info("onTurnExpire---------------->>>>>table not found!!!");
    }
  });
};

const cancelJobOnServers = (tbId, jId) => {
  //cancel job on multiple server
  /* +-------------------------------------------------------------------+
      desc:function to cancel schedule job on servers
      i/p: table =  {tbId = _id of table, jId = jobid of user}
    +-------------------------------------------------------------------+ */
  logger.info(
    "cancelJobOnServers----------->>>>>" +
    tbId +
    " jId: " +
    jId +
    " " +
    new Date()
  );
  tbId = tbId.toString();
  let sData = { en: "CTJ", data: { jid: jId } };
  if (typeof playExchange != "undefined") {
    playExchange.publish("job." + tbId, sData);
  }
};

const cancelRejoinJobs = (rejoinID) => {
  /* +-------------------------------------------------------------------+
      desc:function to cancel schedule job of rejoin
      i/p: table =  {rejoinID = job id for rejoin}
    +-------------------------------------------------------------------+ */
  playExchange.publish("rejoin." + rejoinID, {});
};

module.exports = { onTurnExpire, cancelJobOnServers, cancelRejoinJobs };

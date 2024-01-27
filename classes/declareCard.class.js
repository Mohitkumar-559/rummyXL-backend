const getInfo = require("../common");
const _ = require("underscore");
const commonClass = require("./common.class.js"); //common functions
const config = require("../config.json");
const schedule = require("node-schedule");
const cardCommonClass = require("./cardCommon.class");
const turnClass = require("./turn.class");
const jobTimerClass = require("./jobTimers.class");
const dropCardClass = require("./dropCards.class");
const godBotClass = require("./godBot.class"); //common functions
const logger = require("../utils/logger");
const { getRedisInstances } = require("../connections/redis");
const { timeout } = require("../utils");
// const { storeTableHistory } = require("../classes/gameHistory.class");
const { GetConfig } = require("../connections/mongodb");
const scheduler = require("../scheduler");
const { DECLARE_TIMER } = require("../constants/eventName");
const { addQueue, cancelJob } = require("../scheduler/bullQueue");

const Declare = async (data, client, hide) => {
  // console.time("latency timer Declare");

  try {
    // Declare : data = {dCards,ps}; dCards = {pure : [[],[]],seq : [[],[]],set : [[],[]],dwd : []}; hide = flag for hiding declaration
    /* +-------------------------------------------------------------------+
          desc:event to declare game 
          i/p: data = {dCards = object of formatted cards,ps = points of cards},client = socket object
      +-------------------------------------------------------------------+ */
    logger.info(
      "Declare--------->>>>client.tbid: " +
      client.tbid +
      " client.si: " +
      client.si +
      " data: ",
      data
    );
    const redisInstances = getRedisInstances();
    const { MAX_DEADWOOD_PTS_POOL_61, LATE_FINISH_PENALTY_POINTS, TIMER_FINISH } = GetConfig();
    const lvt = await redisInstances.SET(`declare:${client.tbid}:${client.si}`, 1, { EX: 5, NX: true, });
    if (!lvt) { return false; }
    logger.info("Declare--------->>>>data.dCards.pure:", data.dCards.pure);
    logger.info("Declare--------->>>>data.dCards.seq:", data.dCards.seq);
    logger.info("Declare--------->>>>data.dCards.set:", data.dCards.set);
    logger.info("Declare--------->>>>data.dCards.dwd:", data.dCards.dwd);

    data.dCards.pure = typeof data.dCards.pure === "string" ? JSON.parse(data.dCards.pure) : data.dCards.pure;
    data.dCards.seq = typeof data.dCards.seq === "string" ? JSON.parse(data.dCards.seq) : data.dCards.seq;
    data.dCards.set = typeof data.dCards.set === "string" ? JSON.parse(data.dCards.set) : data.dCards.set;
    data.dCards.dwd = typeof data.dCards.dwd === "string" ? JSON.parse(data.dCards.dwd) : data.dCards.dwd;

    let { si } = client;
    getInfo.GetTbInfo(client.tbid, {}, function (table) {
      if (!table) {
        logger.info('Declare::::::::::>>>>Error: "table not found!!!"');
        return false;
      }
      logger.info("table-------------->", table.pi[si]);
      if (table.tst == "winnerDeclared" ||table.tst=="roundWinnerDeclared") {
        logger.info('Declare::::::::::>>>>Error: "table in winning state!!!"');
        return false;       
      }
      if (
        table.pi &&
        table.pi[si] &&
        typeof table.pi[si].s != "undefined" &&
        table.fnsPlayer != -1 &&
        (table.pi[si].s == "finish" || table.pi[si].s == "playing")
      ) {
        let flg = false;
        if (table.pi[si]._ir == 0) {
          let temppure = _.flatten(data.dCards.pure);
          let tempseq = _.flatten(data.dCards.seq);
          let tempset = _.flatten(data.dCards.set);
          let tempdwd = _.flatten(data.dCards.dwd);
          logger.info("Declare------:temppure:", temppure);
          logger.info("Declare------:tempseq:", tempseq);
          logger.info("Declare------:tempset:", tempset);
          logger.info("Declare------:tempdwd:", tempdwd);
          logger.info("Declare------:table.pi[si].cards:", table.pi[si].cards);

          if (temppure.length > 0) {
            for (let i in temppure) {
              if (!_.contains(table.pi[si].cards, temppure[i].toString())) {
                logger.info("Declare------:temppure[i]:", temppure[i]);
                flg = true;
                break;
              }
            }
          }

          if (tempseq.length > 0) {
            for (let j in tempseq) {
              if (!_.contains(table.pi[si].cards, tempseq[j].toString())) {
                logger.info("Declare------:tempseq[j]:", tempseq[j]);
                flg = true;
                break;
              }
            }
          }

          if (tempset.length > 0) {
            for (let k in tempset) {
              if (!_.contains(table.pi[si].cards, tempset[k].toString())) {
                logger.info("Declare------:tempset[k]:", tempset[k]);
                flg = true;
                break;
              }
            }
          }

          if (tempdwd.length > 0) {
            for (let l in tempdwd) {
              if (!_.contains(table.pi[si].cards, tempdwd[l].toString())) {
                logger.info("Declare------:tempdwd[l]:", tempdwd[l]);
                flg = true;
                break;
              }
            }
          }
        } else {
          //for bot
          if (table.fnsPlayer == si) {
            let temppure = _.flatten(data.dCards.pure);
            let tempseq = _.flatten(data.dCards.seq);
            let tempset = _.flatten(data.dCards.set);
            let tempdwd = _.flatten(data.dCards.dwd);
            let sum =
              temppure.length +
              tempseq.length +
              tempset.length +
              tempdwd.length;

            if (sum < 13) {
              let rbcards = [];
              rbcards = rbcards.concat(temppure);
              logger.info("Declare-----1---->>>>rbcards:", rbcards);
              rbcards = rbcards.concat(tempseq);
              logger.info("Declare----2---->>>>rbcards:", rbcards);
              rbcards = rbcards.concat(tempset);
              logger.info("Declare-----3---->>>>rbcards:", rbcards);
              rbcards = rbcards.concat(tempdwd);
              logger.info("Declare-----4---->>>>rbcards:", rbcards);

              let newCard;
              if (table.cDeck.length > 0) {
                let jwArray = cardCommonClass.getJWcards(
                  table.cDeck,
                  table.wildCard
                );
                if (jwArray.length > 0) {
                  newCard = jwArray[0];
                } else {
                  newCard = cardCommonClass.setCloseDeckCard(
                    table.cDeck,
                    rbcards,
                    table.wildCard
                  );
                }
              } else {
                newCard = "j-4-0";
              }

              rbcards.push(newCard);
              let analysedCards = godBotClass.GetSortedCard(
                rbcards,
                table.wildCard
              );
              data.dCards.pure = analysedCards.pure;
              data.dCards.seq = analysedCards.seq;
              data.dCards.set = analysedCards.set;
              data.dCards.dwd = analysedCards.dwd;

              logger.info(
                "Declare-----1---->>>>data.dCards.pure:",
                data.dCards.pure
              );
              logger.info(
                "Declare-----1---->>>>data.dCards.seq:",
                data.dCards.seq
              );
              logger.info(
                "Declare-----1---->>>>data.dCards.set:",
                data.dCards.set
              );
              logger.info(
                "Declare-----1---->>>>data.dCards.dwd:",
                data.dCards.dwd
              );
            }
          }
        }

        if (flg) {
          logger.info(
            "Declare------user have modify the cards not valid event"
          );
          // return false;
          data.dCards.pure = [];
          data.dCards.seq = [];
          data.dCards.set = [];
          data.dCards.dwd = [table.pi[si].cards];
        }

        data.dCards.dwd = _.flatten(data.dCards.dwd);
        logger.info("Declare------111----->>>>>>data.dCards: ", data.dCards);
        logger.info("table.pi[si]._ir-------->>", table.pi[si]._ir);
        if (table.pi[si]._ir == 0) {
          //special condition to validate live player cards
          let cond = false;

          if (config.ONE_SEQUENCE_POINTS) {
            cond = data.dCards.pure.length > 0;
          } else {
            cond =
              data.dCards.pure.length > 0 &&
              data.dCards.pure.length + data.dCards.seq.length > 1;
          }
          logger.info("cond--------->", cond);
          if (cond) {
            logger.info("---if--cond----");
            //means the grouping is valid
            if (data.dCards.pure.length + data.dCards.seq.length > 1) {
              logger.info("---if--cond--if--");
              data.dCards = {
                pure: data.dCards.pure,
                seq: data.dCards.seq,
                set: data.dCards.set,
                dwd: data.dCards.dwd,
              };
              data.ps = cardCommonClass.cardsValidPoints(
                data.dCards,
                table.wildCard
              );
              if (table.gt == "Pool" && table.pt == 61) {
                data.ps =
                  data.ps >= 61 ? MAX_DEADWOOD_PTS_POOL_61 : data.ps;
              }
            } else {
              let temp = data.dCards.seq
                .concat(data.dCards.set)
                .concat(data.dCards.dwd);
              temp = _.flatten(temp);
              data.dCards = {
                pure: data.dCards.pure,
                seq: [],
                set: [],
                dwd: temp,
              };

              if (table.gt == "Pool" && table.pt == 61) {
                data.ps = cardCommonClass.poolCardsSum(temp, table.wildCard);
              } else {
                data.ps = cardCommonClass.cardsSum(temp, table.wildCard);
              }
              // data.ps = cardCommonClass.cardsSum(temp, table.wildCard);
            }
          } else {
            //means all the cards will be considered as deadwood
            let temp = data.dCards.pure
              .concat(data.dCards.seq)
              .concat(data.dCards.set)
              .concat(data.dCards.dwd);
            temp = _.flatten(temp);
            data.dCards = { pure: [], seq: [], set: [], dwd: temp };

            if (table.gt == "Pool" && table.pt == 61) {
              data.ps = cardCommonClass.poolCardsSum(temp, table.wildCard);
            } else {
              data.ps = cardCommonClass.cardsSum(temp, table.wildCard);
            }
            // data.ps = cardCommonClass.cardsSum(temp, table.wildCard);
          }
        }
        logger.info("data.ps--------->", data.ps);
        logger.info(
          "Declare-----------222------->>>>>>>>data.ps: " +
          data.ps +
          " data.dCards: ",
          data.dCards
        );
        logger.info(" data.ps--------->", data.ps);
        let pt =
          data.ps == 0 &&
            table.fnsPlayer != si &&
            (table.gt == "Deal" || table.gt == "Pool")
            ? LATE_FINISH_PENALTY_POINTS
            : data.ps;
        let udps = table.gt == "Deal" || table.gt == "Pool" ? data.ps : 0;

        logger.info("pt----------->", pt);
        if (
          table.pi[si].pickCount == 0 &&
          table.pi[si].turnCounter == 0
          // table.pi[si].tCount == 0
          // &&
          // table.gt == "Deal"
        ) {
          if (pt <= 5) {
            pt = 2;
          }
          else if (pt % 2 == 0) {
            pt /= 2;
          }
          else {
            pt -= 1;
            pt /= 2;
          }
        }

        db.collection("playing_table").findAndModify(
          { _id: table._id, "pi.si": si },
          {},
          {
            $set: {
              la: new Date(),
              "pi.$.s": "declare",
              "pi.$.dCards": data.dCards,
              "pi.$.ps": pt,
              "pi.$.tScore": -pt,
            },
            $inc: {
              declCount: 1,
              "pi.$.dps": pt,
            },
          },
          { new: true },
          async function (err, table1) {
            let res = table1.value;
            logger.info("Declare---------->>>>>>>res: ", res);
            if (err) {
              logger.info(
                "Declare::::::::::" +
                table._id +
                "::::::::si: " +
                si +
                " ---data.dCards: ",
                data.dCards,
                " data.ps: " + data.ps + " udps: " + udps + ":::::::Error: ",
                err,
                " " + new Date()
              );
            }

            if (!res) {
              logger.info(
                "Declare::::::::::" +
                table._id +
                "::::::::si: " +
                si +
                " ---data.dCards: ",
                data.dCards,
                " data.ps: " + data.ps + " udps: " + udps + " " + new Date()
              );
              return false;
            }

            let pts = table.pi[si].ps == 0 && table.fnsPlayer != si ? LATE_FINISH_PENALTY_POINTS : table.pi[si].ps;
            let cutch = pts * table.bv;
            logger.info("hide------>", hide, "--pts--->", pts);
            logger.info("-------check---->", !hide);
            if (!hide) {
              let playerPoints = cardCommonClass.cardsValidPoints(
                res.pi[si].dCards,
                res.wildCard
              );
              commonClass.FireEventToTable(res._id.toString(), {
                en: "Declare",
                data: {
                  si: si,
                  uid: table.pi[si].uid,
                  ps: pts,
                  bv: table.bv,
                  cutch: cutch,
                  validDeclare: playerPoints == 0 && res.fnsPlayer == si,
                },
              });
              // storeTableHistory({
              //   tableId: table._id.toString(),
              //   eventName: "Declare",
              //   tableData: table,
              //   userIndex: si
              // });
            }
            logger.info(
              "Declare------->>>>>declCount: " +
              res.declCount +
              " playCount: " +
              res.playCount
            );

            let playCount = 0;

            for (let i in res.pi) {
              if (
                res.pi[i] &&
                !_.isEmpty(res.pi[i]) &&
                typeof res.pi[i].s != "undefined" &&
                _.contains(["playing", "finish", "declare"], res.pi[i].s)
              ) {
                playCount++;
              }
            }
            logger.info("Declare------------->>>>playCount: " + playCount);
            let isInvalidDeclare = false;
            if (table.fnsPlayer == si) {
              // schedule.cancelJob(res.jid);
              // jobTimerClass.cancelJobOnServers(res._id.toString(), res.jid);
              const finishJobId = `${table.gt}:finishTimer:${table._id.toString()}`;
              // scheduler.cancelJob.cancelFinishTimer(finishJobId);
              cancelJob(finishJobId);
              if (
                _.isEmpty(res.pi[res.fnsPlayer]) ||
                typeof res.pi[res.fnsPlayer].dCards == "undefined" ||
                res.pi[res.fnsPlayer].dCards == null ||
                _.isEmpty(res.pi[res.fnsPlayer].dCards)
              ) {
                logger.info("in--if---if---");
                isInvalidDeclare = true;
                logger.info("hide----->", hide);
                if (!hide) {
                  let playerPoints = cardCommonClass.cardsValidPoints(
                    res.pi[si].dCards,
                    res.wildCard
                  );
                  commonClass.FireEventToTable(res._id.toString(), {
                    en: "Declare",
                    data: {
                      si: si,
                      uid: table.pi[si].uid,
                      ps: pts,
                      bv: table.bv,
                      cutch: cutch,
                      validDeclare: playerPoints == 0 && res.fnsPlayer == si,
                    },
                  });
                  // storeTableHistory({
                  //   tableId: table._id.toString(),
                  //   eventName: "Declare",
                  //   tableData: table,
                  //   userIndex: si
                  // });
                }

                //means finish user left the table so resume the game

                let { pi } = res;
                let asi = [];
                let shortBtn = [];

                for (let k in pi) {
                  if (
                    !_.isEmpty(pi[k]) &&
                    typeof pi[k].si != "undefined" &&
                    (pi[k].s == "playing" ||
                      pi[k].s == "declare" ||
                      pi[k].s == "finish")
                  ) {
                    asi.push(pi[k].si);
                    shortBtn.push({ uid: pi[k].uid, sort: pi[k].sort });
                  }
                }
                asi = _.without(asi, res.fnsPlayer);

                commonClass.FireEventToTable(res._id.toString(), {
                  en: "INDECL",
                  data: {
                    si: res.fnsPlayer,
                    ocard: res.oDeck[res.oDeck.length - 1],
                    sort: shortBtn,
                    asi: asi,
                  },
                });
                // storeTableHistory({
                //   tableId: table._id.toString(),
                //   eventName: "invalidDeclare",
                //   tableData: res,
                //   userIndex: res.fnsPlayer
                // });
                for (let i in pi) {
                  if (
                    !_.isEmpty(pi[i]) &&
                    typeof pi[i].s != "undefined" &&
                    pi[i].s != null &&
                    pi[i].s == "declare"
                  ) {
                    pi[i].s = "playing";
                    pi[i].dps = res.gt == "Deal" || res.gt == "Pool" ? pi[i].dps - pi[i].ps : 0; //unsetting dps
                    pi[i].ps = 0;
                    pi[i].wc = 0;
                    // pi[i].dCards = {};
                  }
                }

                getInfo.UpdateTableData(
                  res._id.toString(),
                  {
                    $set: {
                      isDeclared: false,
                      tst: "RoundStarted",
                      fnsPlayer: -1,
                      declCount: 0,
                      pi: pi,
                      ctt: new Date(),
                    },
                  },
                  function (upData) {
                    if (upData) {
                      turnClass.changeTableTurn(
                        upData._id.toString(),
                        "invalid_declare"
                      );
                    } else {
                      logger.info(
                        'Declare--------1------->>>>>>Error:"table not found"'
                      );
                    }
                  }
                );
              } else {
                logger.info("in---if----else-----");
                //finish user has valid rummy hence declare winner
                let fnsPlayerPoints = cardCommonClass.cardsValidPoints(
                  res.pi[res.fnsPlayer].dCards,
                  res.wildCard
                );
                let fnsPureCount = res.pi[res.fnsPlayer].dCards.pure.length;
                let fnsSeqCount = res.pi[res.fnsPlayer].dCards.seq.length;
                if (
                  fnsPlayerPoints == 0 &&
                  fnsPureCount > 0 &&
                  fnsPureCount + fnsSeqCount >
                  1 /* && res.pi[res.fnsPlayer].dCards.dwd.length == 0*/
                ) {
                  logger.info("in---if----else---if--");
                  // if (!hide) {
                  //   let playerPoints = cardCommonClass.cardsValidPoints(
                  //     res.pi[si].dCards,
                  //     res.wildCard
                  //   );
                  //   commonClass.FireEventToTable(res._id.toString(), {
                  //     en: "Declare",
                  //     data: {
                  //       si: si,
                  //       uid: table.pi[si].uid,
                  //       ps: pts,
                  //       bv: table.bv,
                  //       cutch: cutch,
                  //       validDeclare: playerPoints == 0 && res.fnsPlayer == si,
                  //     },
                  //   });
                  // }
                } else {
                  logger.info("----^^^^^^^^in else^^^^^----------------");
                  isInvalidDeclare = true;

                  if (!hide) {
                    let playerPoints = cardCommonClass.cardsValidPoints(
                      res.pi[si].dCards,
                      res.wildCard
                    );
                    commonClass.FireEventToTable(res._id.toString(), {
                      en: "Declare",
                      data: {
                        si: si,
                        uid: table.pi[si].uid,
                        ps: pts,
                        bv: table.bv,
                        cutch: cutch,
                        validDeclare: playerPoints == 0 && res.fnsPlayer == si,
                      },
                    });
                    // storeTableHistory({
                    //   tableId: table._id.toString(),
                    //   eventName: "Declare",
                    //   tableData: table,
                    //   userIndex: si
                    // });
                  }

                  //drop finish player and resume the game logic here
                  let { pi } = res;
                  let asi = [];
                  let shortBtn = [];
                  for (let k in pi) {
                    if (
                      !_.isEmpty(pi[k]) &&
                      typeof pi[k].si != "undefined" &&
                      (pi[k].s == "playing" ||
                        pi[k].s == "declare" ||
                        pi[k].s == "finish")
                    ) {
                      asi.push(pi[k].si);
                      shortBtn.push({ uid: pi[k].uid, sort: pi[k].sort });
                    }
                  }
                  asi = _.without(asi, res.fnsPlayer);

                  commonClass.FireEventToTable(res._id.toString(), {
                    en: "INDECL",
                    data: {
                      si: res.fnsPlayer,
                      ocard: res.oDeck[res.oDeck.length - 1],
                      sort: shortBtn,
                      asi: asi,
                    },
                  });
                  // storeTableHistory({
                  //   tableId: table._id.toString(),
                  //   eventName: "invalidDeclare",
                  //   tableData: res,
                  //   userIndex: res.fnsPlayer
                  // });
                  for (let i in pi) {
                    if (
                      !_.isEmpty(pi[i]) &&
                      typeof pi[i].s != "undefined" &&
                      pi[i].s != null &&
                      pi[i].s == "declare"
                    ) {
                      logger.info(
                        "pi[i].ps---->",
                        pi[i].ps,
                        "--pi[i].dps---",
                        pi[i].dps
                      );
                      pi[i].s = "playing";
                      pi[i].dps =
                        res.gt == "Deal" || res.gt == "Pool" ? pi[i].dps - pi[i].ps : 0; //unsetting dps
                      pi[i].ps = 0;
                      pi[i].wc = 0;
                      // pi[i].dCards = {};
                    }
                  }

                  // var fnsPlayer = res.fnsPlayer;
                  getInfo.UpdateTableData(
                    res._id.toString(),
                    {
                      $set: {
                        isDeclared: false,
                        tst: "RoundStarted",
                        fnsPlayer: -1,
                        declCount: 0,
                        pi: pi,
                        ctt: new Date(),
                      },
                    },
                    function (upData) {
                      if (upData) {
                        dropCardClass.DropCards(
                          { internalDropCards: true },
                          {
                            tbid: upData._id.toString(),
                            si: res.fnsPlayer,
                            uid: res.pi[res.fnsPlayer].uid,
                          },
                          true
                        );
                      } else {
                        logger.info(
                          'Declare-------2----->>>>>>Error: "table not found"'
                        );
                      }
                    }
                  );
                }
              }
              logger.info(
                "Declare--------------->>>>>>>msg: isInvaliDeclare schedule",
                isInvalidDeclare
              );

              if (!isInvalidDeclare) {
                logger.info("in--fif---1");
                let finishTimer = TIMER_FINISH;
                let { pi } = table;
                let aSi = [];

                for (let k in pi) {
                  if (
                    !_.isEmpty(pi[k]) &&
                    typeof pi[k].si != "undefined" &&
                    (pi[k].s == "playing" || pi[k].s == "finish")
                  ) {
                    aSi.push(pi[k].si);
                  }
                }

                commonClass.FireEventToTable(table._id.toString(), {
                  en: "Finish",
                  data: {
                    si: res.fnsPlayer,
                    uid: pi[res.fnsPlayer].uid,
                    t: finishTimer,
                    asi: aSi,
                    card: res.oDeck[res.oDeck.length - 1],
                    // card: res.oDeck.at(-1),
                  },
                });
                // storeTableHistory({
                //   tableId: table._id.toString(),
                //   eventName: "Finish",
                //   tableData: res,
                //   userIndex: res.fnsPlayer
                // });
                // commonClass.SendData(client, "Finish", {
                //   si: si,
                //   uid: pi[si].uid,
                //   t: finishTimer,
                //   asi: aSi,
                //   card: data.card,
                // });
                let fns = commonClass.AddTime(finishTimer);
                logger.info(
                  "Declare--------------->>>>>>>msg: isInvaliDeclare fns",
                  fns,
                  finishTimer,
                  pt,
                  table.pt,
                  si,
                  table._id
                );
                if (table.fnsPlayer == si) {
                  let players = getInfo.getPlayingUserInRound(table.pi);
                  // this is fixed for circular dependency problem.
                  const robotsClass = require("./robots.class");
                  if (table.gt === "Points") {
                    for (const element of players) {
                      if (element.s == "playing" && element._ir == 1) {
                        robotsClass.lateRobotDeclare(table, element.si);
                      }
                    }
                  } else {
                    const robotCount = players.filter((p) => {
                      return p._ir == 1;
                    });
                    logger.info("robotCount---->", robotCount.length);
                    let rTime = Array.from(
                      { length: robotCount.length },
                      (v, k) => k + 1
                    );

                    for (const element of players) {
                      //gt - pool
                      logger.info("rTime--------->", rTime);
                      logger.info("rTime--->", rTime);
                      if (element.s == "playing" && element._ir == 1) {
                        const random =
                          rTime[Math.floor(Math.random() * rTime.length)];
                        logger.info("random----->", random);
                        rTime.splice(rTime.indexOf(random), 1);
                        robotsClass.lateRobotDeclarePool(
                          table,
                          element.si,
                          random
                        );
                      }
                    }
                  }
                }

                if (table.gt === "Deal") {
                  await db
                    .collection("playing_table")
                    .findOneAndUpdate(
                      { _id: table._id, "pi.si": si },
                      { $set: { ctt: new Date() }, $inc: { tpr: pt } },
                      { new: true }
                    );
                } else {
                  await db
                    .collection("playing_table")
                    .findOneAndUpdate(
                      { _id: table._id, "pi.si": si },
                      { $set: { ctt: new Date() } },
                      { new: true }
                    );
                }

                const jobId = `${table.gt}:otherFinishTimer:${table._id.toString()}`;
                // scheduler.queues.otherFinishTimer({
                //   timer: TIMER_FINISH * 1000,
                //   jobId,
                //   tableId: table._id.toString(),
                // });

                const jobData = {
                  tableId: table._id.toString(),
                  calling: DECLARE_TIMER
                };
                const jobOption = { delay: TIMER_FINISH * 1000, jobId };
                addQueue(jobData, jobOption);

                // schedule.scheduleJob(
                //   res._id.toString(),
                //   new Date(fns),
                //   function () {
                //     logger.info(
                //       "Declare--------------->>>>>>>msg: Declare timer schedule"
                //     );
                // schedule.cancelJob(res._id.toString());
                // getInfo.GetTbInfo(
                //   res._id.toString(),
                //   { pi: 1 },
                //   async function (table1) {
                //     if (table1) {
                //       let players1 = getInfo.getPlayingUserInRound(
                //         table1.pi
                //       );
                //       logger.info(
                //         "Declare--------------->>>>>>>msg: Declare timer completed",
                //         table1._id.toString()
                //       );
                //       for (const element of players1) {
                //         if (element.s == "playing" && element._ir == 0) {
                //           logger.info(
                //             "Declare--------------->>>>>>>msg: Declare timer playing"
                //           );

                //           let ps = 0;
                //           let dCards = {
                //             pure: element.gCards.pure,
                //             seq: element.gCards.seq,
                //             set: element.gCards.set,
                //             dwd: element.gCards.dwd,
                //           };
                //           let temp = _.flatten(element.gCards.dwd);
                //           ps = cardCommonClass.cardsSum(
                //             temp,
                //             table.wildCard
                //           );
                //           logger.info(
                //             "Declare--------------->>>>>>>dCards:",
                //             dCards
                //           );
                //           logger.info(
                //             "Declare----11111111----------->>>>>>>"
                //           );
                //           await timeout(800);
                //           await Declare(
                //             { dCards: dCards, ps: ps },
                //             {
                //               si: element.si,
                //               tbid: table1._id.toString(),
                //             }
                //           );
                //         }
                //       }
                //     } else {
                //       logger.info(
                //         "Declare-------------->>>>>>>.msg: table not found"
                //       );
                //     }
                //   }
                // );
                //   }
                // );
              }
            } else {
              // if (!hide) {
              //   let playerPoints = cardCommonClass.cardsValidPoints(
              //     res.pi[si].dCards,
              //     res.wildCard
              //   );
              //   commonClass.FireEventToTable(res._id.toString(), {
              //     en: "Declare",
              //     data: {
              //       si: si,
              //       uid: table.pi[si].uid,
              //       ps: pts,
              //       bv: table.bv,
              //       cutch: cutch,
              //       validDeclare: playerPoints == 0 && res.fnsPlayer == si,
              //     },
              //   });
              // }
              logger.info(
                "Declare------else--------->>>>>>>msg: valiDeclare fns",
                pt,
                table.tpr,
                si,
                table._id
              );
              if (table.gt === "Deal") {
                await db.collection("playing_table").findOneAndUpdate(
                  { _id: table._id, "pi.si": si },
                  {
                    $set: { ctt: new Date() },
                    $inc: { tpr: pt, "pi.$.tdps": -pt },
                  },
                  { new: true }
                );
              }
            }
            logger.info("res.declCount ---->", res.declCount);
            logger.info(
              "DECL------------->>>>isInvaliDeclare: " +
              res.declCount +
              "---" +
              playCount +
              isInvalidDeclare
            );
            if (isInvalidDeclare === false) {
              // if (res.declCount >= playCount && isInvaliDeclare === false) {

              // jobTimerClass.cancelJobOnServers(res._id.toString(), res.jid);
              const finishJobId = `${res.gt}:finishTimer:${res._id.toString()}`;
              // scheduler.cancelJob.cancelFinishTimer(finishJobId);
              cancelJob(finishJobId);

              //logic of all declaration here
              logger.info(
                "Declare----------->>>>>>: finish player: " +
                res.fnsPlayer +
                " res.pi: " +
                res.pi
              );
              // if (
              //   _.isEmpty(res.pi[res.fnsPlayer]) ||
              //   typeof res.pi[res.fnsPlayer].dCards == "undefined" ||
              //   res.pi[res.fnsPlayer].dCards == null ||
              //   _.isEmpty(res.pi[res.fnsPlayer].dCards)
              // ) {
              //   //means finish user left the table so resume the game

              //   let pi = res.pi;
              //   let asi = [];
              //   let shortBtn = [];

              //   for (let k in pi) {
              //     if (
              //       !_.isEmpty(pi[k]) &&
              //       typeof pi[k].si != "undefined" &&
              //       (pi[k].s == "playing" ||
              //         pi[k].s == "declare" ||
              //         pi[k].s == "finish")
              //     ) {
              //       asi.push(pi[k].si);
              //       shortBtn.push({ uid: pi[k].uid, sort: pi[k].sort });
              //     }
              //   }
              //   asi = _.without(asi, res.fnsPlayer);

              //   commonClass.FireEventToTable(res._id.toString(), {
              //     en: "INDECL",
              //     data: {
              //       si: res.fnsPlayer,
              //       ocard: res.oDeck[res.oDeck.length - 1],
              //       sort: shortBtn,
              //       asi: asi,
              //     },
              //   });
              //   for (let i in pi) {
              //     if (
              //       !_.isEmpty(pi[i]) &&
              //       typeof pi[i].s != "undefined" &&
              //       pi[i].s != null &&
              //       pi[i].s == "declare"
              //     ) {
              //       pi[i].s = "playing";
              //       pi[i].dps =
              //         res.gt == "Deal" || res.gt == "Pool"
              //           ? pi[i].dps - pi[i].ps
              //           : 0; //unsetting dps
              //       pi[i].ps = 0;
              //       pi[i].wc = 0;
              //       pi[i].dCards = {};
              //     }
              //   }

              //   getInfo.UpdateTableData(
              //     res._id.toString(),
              //     {
              //       $set: {
              //         tst: "RoundStarted",
              //         fnsPlayer: -1,
              //         declCount: 0,
              //         pi: pi,
              //         ctt: new Date(),
              //       },
              //     },
              //     function (upData) {
              //       if (upData) {
              //         turnClass.changeTableTurn(
              //           upData._id.toString(),
              //           "invalid_declare"
              //         );
              //       } else {
              //         logger.info('Declare--------1------->>>>>>Error:"table not found"');
              //       }
              //     }
              //   );
              // } else {
              //   //finish user has valid rummy hence declare winner
              //   let fnsPlayerPoints = cardCommonClass.cardsValidPoints(
              //     res.pi[res.fnsPlayer].dCards,
              //     res.wildCard
              //   );
              //   let fnsPureCount = res.pi[res.fnsPlayer].dCards.pure.length;
              //   let fnsSeqCount = res.pi[res.fnsPlayer].dCards.seq.length;
              //   if (
              //     fnsPlayerPoints == 0 &&
              //     fnsPureCount > 0 &&
              //     fnsPureCount + fnsSeqCount >
              //       1 /* && res.pi[res.fnsPlayer].dCards.dwd.length == 0*/
              //   ) {

              if (res.gt == "Deal") {
                // if(res.round == 1){
                // if (res.round < res.deals) {
                //deal 1st round winner logic here
                // winnerClass.declareRoundWinner(res._id.toString());
                winnerClass.declareRoundWinnerNew(
                  res._id.toString(),
                  si,
                  client
                );
                // } else {
                //   //deal final winner logic here
                //   winnerClass.declareDealWinner(res._id.toString());
                // }
              } else if (res.gt == "Pool") {
                let players = getInfo.getPlayingUserInGame(res.pi, true);

                if (players.length > 1) {
                  //means more than one player so declare round winner
                  // winnerClass.declareRoundWinner(res._id.toString());
                  logger.info(
                    "res._id.toString()---->",
                    res._id.toString(),
                    si
                  );
                  winnerClass.declareRoundWinnerNew(
                    res._id.toString(),
                    si,
                    client
                  );
                } else {
                  logger.info(
                    "Declare-----------" +
                    res._id +
                    '------------->>>>>Error:"table is empty or foul"'
                  );
                }
              } else {
                logger.info("declareWinnerNew declare class", res._id.toString(), si);
                winnerClass.declareWinnerNew(res._id.toString(), si, client);
              }
              //   } else {
              //     //drop finish player and resume the game logic here
              //     let pi = res.pi;
              //     let asi = [];
              //     let shortBtn = [];
              //     for (let k in pi) {
              //       if (
              //         !_.isEmpty(pi[k]) &&
              //         typeof pi[k].si != "undefined" &&
              //         (pi[k].s == "playing" ||
              //           pi[k].s == "declare" ||
              //           pi[k].s == "finish")
              //       ) {
              //         asi.push(pi[k].si);
              //         shortBtn.push({ uid: pi[k].uid, sort: pi[k].sort });
              //       }
              //     }
              //     asi = _.without(asi, res.fnsPlayer);

              //     commonClass.FireEventToTable(res._id.toString(), {
              //       en: "INDECL",
              //       data: {
              //         si: res.fnsPlayer,
              //         ocard: res.oDeck[res.oDeck.length - 1],
              //         sort: shortBtn,
              //         asi: asi,
              //       },
              //     });
              //     for (let i in pi) {
              //       if (
              //         !_.isEmpty(pi[i]) &&
              //         typeof pi[i].s != "undefined" &&
              //         pi[i].s != null &&
              //         pi[i].s == "declare"
              //       ) {
              //         pi[i].s = "playing";
              //         pi[i].dps =
              //           res.gt == "Deal" || res.gt == "Pool"
              //             ? pi[i].dps - pi[i].ps
              //             : 0; //unsetting dps
              //         pi[i].ps = 0;
              //         pi[i].wc = 0;
              //         pi[i].dCards = {};
              //       }
              //     }
              //     // var fnsPlayer = res.fnsPlayer;
              //     getInfo.UpdateTableData(
              //       res._id.toString(),
              //       {
              //         $set: {
              //           tst: "RoundStarted",
              //           fnsPlayer: -1,
              //           declCount: 0,
              //           pi: pi,
              //           ctt: new Date(),
              //         },
              //       },
              //       function (upData) {
              //         if (upData) {
              //           dropCardClass.DropCards(
              //             {},
              //             {
              //               tbid: upData._id.toString(),
              //               si: res.fnsPlayer,
              //               uid: res.pi[res.fnsPlayer].uid,
              //             },
              //             true
              //           );
              //         } else {
              //           logger.info('Declare-------2----->>>>>>Error: "table not found"');
              //         }
              //       }
              //     );
              //   }
              // }
            }
          }
        );
      } else {
        logger.info('Declare:::::::::::::::>>>>Error:"false declare action"');
      }
    });
  } catch (error) {
    logger.error("-----> error Declare", error);
    getInfo.exceptionError(error);
  }
  // console.timeEnd("latency timer Declare");

};

const declareTimer = async (tableId) => {
  getInfo.GetTbInfo(
    tableId.toString(),
    { pi: 1, wildCard: 1 },
    async function (table1) {
      if (table1) {
        let players1 = getInfo.getPlayingUserInRound(table1.pi);
        logger.info(
          "Declare--------------->>>>>>>msg: Declare timer completed",
          table1._id.toString()
        );
        for (const element of players1) {
          if (element.s == "playing" && element._ir == 0) {
            logger.info(
              "Declare--------------->>>>>>>msg: Declare timer playing"
            );

            let ps = 0;
            let dCards = {
              pure: element.gCards.pure,
              seq: element.gCards.seq,
              set: element.gCards.set,
              dwd: element.gCards.dwd,
            };
            let temp = _.flatten(element.gCards.dwd);
            ps = cardCommonClass.cardsSum(temp, table1.wildCard);
            logger.info(
              "Declare--------------->>>>>>>dCards:",
              dCards
            );
            logger.info(
              "Declare----11111111----------->>>>>>>"
            );
            await timeout(800);
            await Declare(
              { dCards: dCards, ps: ps },
              {
                si: element.si, tbid: table1._id.toString()
              });
          }
        }
      } else {
        logger.info(
          "Declare-------------->>>>>>>.msg: table not found"
        );
      }
    }
  );
};

module.exports = { Declare, declareTimer };

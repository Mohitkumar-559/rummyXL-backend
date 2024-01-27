const declareClass = require("./declareCard.class");
const discardedCardsClass = require("./discardedCards.class");
const getInfo = require("../common");
const commonClass = require("./common.class.js"); //common functions
const _ = require("underscore");
const jobTimerClass = require("./jobTimers.class");
const schedule = require("node-schedule");
const cardCommonClass = require("./cardCommon.class"); //common functions
const logger = require("../utils/logger");
const Socket = require("../utils/getSockets");
// const { storeTableHistory } = require("../classes/gameHistory.class");
const { GetConfig } = require("../connections/mongodb");
const { getRedisInstances } = require("../connections/redis");
const scheduler = require("../scheduler");
const { FINISH_TIMER } = require("../constants/eventName");
const { addQueue, cancelJob } = require("../scheduler/bullQueue");
const { x } = require("joi");
const socketClass = new Socket();

const Finish = async (data, client, callback) => {
  // console.time("latency timer Finish");

  try {
    //finish   data = {card}
    /* +-------------------------------------------------------------------+
            desc:event to finish game 
            i/p: data = {card = card to throw},client = socket object, callback = callback function
            o/p: Finish event : data = {si = seat index of user,t = finish timer,asi = array of index of active users}
        +-------------------------------------------------------------------+ */

    const redisInstances = getRedisInstances();
    const lvt = await redisInstances.SET(`finish:${client.tbid}:${client.uid}`, 1, { EX: 5, NX: true, });
    if (!lvt) { return false; }
    logger.info(
      "Finish---------->>>>>tbid: " + client.tbid + " si: " + client.si
    );
    logger.info("Finish---------->>>>>data: ", data);
    const { TIMER_FINISH } = GetConfig();
    let { si } = client;
    getInfo.GetTbInfo(client.tbid, {}, function (table) {
      if (!table) {
        logger.info('Finish:::::::::::::>>>>>>Error: "table not found!!!"');
        return false;
      }
      if (!table.pi) {
        logger.info(
          'Finish:::::::::::::::>>>Error: "table players not found!!!"'
        );
        return false;
      }
      if (!table.pi[si]) {
        logger.info('Finish::::::::::::::>>>>Error: "player not found"');
        return false;
      }
      let remainingCards = _.without(table.pi[si].cards, data.card);
      let { gCards } = table.pi[si];

      if (table.pi[si]._ir == 0 && table.pi[si].gCards) {
        if (table.pi[si].gCards.pure.length > 0) {
          let pureCards = table.pi[table.turn].gCards.pure;
          logger.info("Finish----pureCards------>>>>>>gCards: ", pureCards);
          for (let x in pureCards) {
            if (_.contains(pureCards[x], data.card)) {
              pureCards[x] = _.without(pureCards[x], data.card);
              break;
            }
          }
          logger.info("Finish-------gCards------>>>>>gCards: ", gCards);
          gCards.pure = pureCards;
          // upData.$set['pi.$.gCards.pure'] = gCards;
        }

        if (table.pi[si].gCards.seq.length > 0) {
          let seqCards = table.pi[table.turn].gCards.seq;
          logger.info("Finish------seqCards---->>>>>>gCards: ", seqCards);
          for (let x in seqCards) {
            if (_.contains(seqCards[x], data.card)) {
              seqCards[x] = _.without(seqCards[x], data.card);
              break;
            }
          }
          logger.info("Finish--------seqCards----->>>>>gCards: ", seqCards);
          gCards.seq = seqCards;
          // upData.$set['pi.$.gCards.seq'] = seqCards;
        }

        if (table.pi[si].gCards.set.length > 0) {
          let setCards = table.pi[table.turn].gCards.set;
          logger.info("Finish---------->>>>>>gCards: ", setCards);
          for (let x in setCards) {
            if (_.contains(setCards[x], data.card)) {
              setCards[x] = _.without(setCards[x], data.card);
              break;
            }
          }
          logger.info("Finish----------setCards--->>>>>gCards: ", setCards);
          gCards.set = setCards;
          // upData.$set['pi.$.gCards.set'] = gCards;
        }

        if (table.pi[si].gCards.dwd.length > 0) {
          let dwdCards = table.pi[table.turn].gCards.dwd;
          logger.info("Finish----dwdCards------>>>>>>gCards: ", dwdCards);
          for (let x in dwdCards) {
            if (_.contains(dwdCards[x], data.card)) {
              dwdCards[x] = _.without(dwdCards[x], data.card);
              break;
            }
          }
          logger.info("Finish----------dwdCards--->>>>>gCards: ", dwdCards);
          gCards.dwd = dwdCards;
        }
      }

      logger.info(
        "Finish-----" + table._id + "------->>>>>tst: " + table.tst + " pi: ",
        table.pi
      );

      if (
        remainingCards.length == 13 &&
        data.card &&
        table.ap > 1 &&
        table._isLeave == 0 &&
        table.tst == "RoundStarted"
      ) {

        // jobTimerClass.cancelJobOnServers(table._id.toString(), table.jid);
        const userJobId = `${table.gt}:userTurnStart:${table._id.toString()}:${table.pi[si].uid}`;
        // scheduler.cancelJob.cancelTurnTimer(userJobId);
        cancelJob(userJobId);

        let jobId = commonClass.GetRandomString(10);
        let upData = {
          $set: {
            la: new Date(),
            ctrlServer: SERVER_ID,
            "pi.$.cards": remainingCards,
            "pi.$.gCards": gCards,
            "pi.$.s": "finish",
            jid: jobId,
            "pi.$.lpc": "",
            "pi.$._uur": 1,
            tst: "Finished",
            ctt: new Date(),
            fnsPlayer: si,
          },
          $push: { oDeck: data.card },
        };
        let finishTimer = TIMER_FINISH;

        db.collection("playing_table").findAndModify(
          { _id: table._id, "pi.si": si },
          {},
          upData,
          { new: true },
          async function (err, resp) {
            resp = resp.value;
            logger.info(
              "resp.valueresp.valueresp.valueresp.value",
              resp.pi[0].gCards
            );
            if (resp && resp.pi && resp.pi[si]) {
              if (resp.pi[si].uid && resp.pi[si].uid != "") {
                db.collection("game_users").updateOne(
                  { _id: getInfo.MongoID(resp.pi[si].uid) },
                  { $set: { "flags._fActions": 1 } },
                  function (err1, resSts) {
                    if (err1) {
                      logger.info("Finish---------------->>>>>>>>err1: ", err1);
                    } else {
                      logger.info(
                        "Finish------------------->>>>>firstActions completed"
                      );
                    }
                  }
                );
              }

              let { pi } = resp;
              let aSi = [];
              logger.info(
                "Finish--------" + resp._id + "-------->>>>>pi: ",
                pi
              );
              for (let k in pi) {
                if (
                  !_.isEmpty(pi[k]) &&
                  typeof pi[k].si != "undefined" &&
                  (pi[k].s == "playing" || pi[k].s == "finish")
                ) {
                  aSi.push(pi[k].si);
                }
              }

              // setTimeout(function(){
              commonClass.FireEventToTable(resp._id.toString(), {
                en: "ThrowCard",
                data: {
                  si: si,
                  uid: pi[si].uid,
                  time: resp.pi[si].secTime,
                  card: data.card,
                  bbv: resp.bbv,
                  finish: true,
                  cdd: false,
                },
              });

              // storeTableHistory({
              //   tableId: resp._id.toString(),
              //   eventName: "ThrowCard",
              //   tableData: resp,
              //   userIndex: si
              // });

              commonClass.SendData(client, "Finish", {
                si: si,
                uid: pi[si].uid,
                t: finishTimer,
                asi: aSi,
                card: data.card,
              });

              // logger.info("socket allSockets", await io.in(resp._id.toString()).allSockets());
              // logger.info("socket 9999999999999999", await io.in(resp._id.toString()).fetchSockets());

              // const clients = io.sockets.adapter.rooms.get(resp._id.toString());
              // const socketClientData = [];
              // for (const clientId of clients) {
              //   socketClientData.push(io.sockets.sockets.get(clientId));
              // }
              // logger.info("socketClientData socketClientData socketClientData", socketClientData.length, socketClientData);
              logger.info("Finish------------------->>>>>pi", pi);
              const userListData = pi.filter((x) => x.si != si && x.s != "left").filter((x) => x.uid).map((x) => x.uid);
              logger.info("Finish------------------->>>>>userListData", userListData);
              // userList = userList.map(x => getInfo.MongoID(x.uid));

              // let socketListUsers = await db.collection("game_users").distinct("sck", { _id: { $in: userList } });

              // let socketList = await socketClass.getSocketListObject(resp._id.toString());
              // logger.info("socketList socketList socketList", socketList.length, socketList);
              // socketList = socketList.filter((x) => x.si != si);
              // for (const socketClient of socketList) {
              let dataSend = {
                en: "FinishTimer",
                data: {
                  seatIndex: si,
                  userId: pi[si].uid,
                  turnTimer: finishTimer,
                  arrayOfIndexActiveUsers: aSi,
                  card: data.card,
                },
              };
              for (const socketClient of userListData) {
                logger.info(
                  "Finish------------------->>>>>socketClient", socketClient
                );

                commonClass.SendDirect(
                  socketClient,
                  dataSend,
                  true
                );
              }
              // for (const socketClient of socketListUsers) {
              //   commonClass.SendData(io.sockets.sockets.get(socketClient.split('.')[1]), "FinishTimer", {
              //     si: si,
              //     uid: pi[si].uid,
              //     t: finishTimer,
              //     asi: aSi,
              //     card: data.card,
              //   });
              // }

              // commonClass.FireEventToTable(resp._id.toString(), {
              //   en: "FinishTimer",
              //   data: {
              //     si: si,
              //     uid: pi[si].uid,
              //     t: finishTimer,
              //     asi: aSi,
              //     card: data.card,
              //   },
              // });

              // commonClass.sendDataExceptSender(
              //   {
              //     exceptSocket: client.id,
              //     tableId: resp._id.toString(),
              //     en: "FinishTimer",
              //     data: {
              //       si: si,
              //       uid: pi[si].uid,
              //       t: finishTimer,
              //       asi: aSi,
              //       card: data.card,
              //     },
              //   });


              discardedCardsClass.DiscardedCards(
                {},
                { tbid: resp._id.toString() }
              );

              // let fns = commonClass.AddTime(finishTimer);
              // schedule.scheduleJob(resp.jid, new Date(fns), async function () {
              //   schedule.cancelJob(resp.jid);

              // });

              const jobId = `${resp.gt}:finishTimer:${resp._id.toString()}`;
              // scheduler.queues.finishTimer({
              //   timer: TIMER_FINISH * 1000,
              //   jobId,
              //   finishClass: true,
              //   tableId: resp._id.toString(),
              // });

              const jobData = {
                finishClass: true,
                tableId: resp._id.toString(),
                calling: FINISH_TIMER
              };
              const jobOption = { delay: TIMER_FINISH * 1000, jobId };
              addQueue(jobData, jobOption);

              if (typeof callback == "function") {
                callback();
              }
            } else {
              logger.info(
                'Finish-------------->>>>>>Error : "user not found on table"'
              );
            }
          }
        );
      } else {
        logger.info(
          "Finish-----" + table._id + "-------remainingCards: ",
          remainingCards,
          "---data.card: " +
          data.card +
          "---table.ap: " +
          table.ap +
          "----table._isLeave: " +
          table._isLeave +
          "----table.tst: " +
          table.tst +
          '-->>>>Error: "invalid number of cards"' +
          new Date()
        );
      }
    });
  } catch (error) {
    logger.error("-----> error main Finish", error);
    getInfo.exceptionError(error);
  }
  // console.timeEnd("latency timer Finish");

};


const userFinishTimer = async (tableId) => {
  let table = await db.collection("playing_table").findOne({ _id: getInfo.MongoID(tableId) }, { projection: { pi: 1, wildCard: 1, gt: 1, pt: 1 } });
  if (table) {
    logger.info("table.pi[0].gCardstable1.pi[0].gCardstable1.pi[0].gCardstable1.pi[0].gCards", table.pi[0].gCards);

    let players1 = getInfo.getPlayingUserInRound(table.pi);
    logger.info(
      'Finish--------------->>>>>>>msg: "finish timer completed"'
    );
    for (const element of players1) {
      if (element.s == "finish" && element._ir == 0) {
        logger.info(
          'Finish--------------->>>>>>>msg: "finish timer finish"'
        );
        let ps = 0;
        let dCards = {
          pure: element.gCards.pure,
          seq: element.gCards.seq,
          set: element.gCards.set,
          dwd: element.gCards.dwd,
        };

        let temp = _.flatten(element.gCards.dwd);
        if (table.gt == "Pool" && table.pt == 61) {
          ps = cardCommonClass.poolCardsSum(temp, table.wildCard);
        } else {
          ps = cardCommonClass.cardsSum(temp, table.wildCard);
        }
        logger.info(
          "Finish--------------->>>>>>>dCards:",
          dCards
        );
        await declareClass.Declare(
          { dCards: dCards, ps: ps },
          { si: element.si, tbid: table._id.toString() }
        );
      } else if (element._ir == 1) {
        // this is fixed for circular dependency problem.
        const robotsClass = require("./robots.class");
        robotsClass.lateRobotDeclare(table, element.si);
      }
    }
  } else {
    logger.info(
      'Finish-------------->>>>>>>.msg: "table not found"'
    );
  }
};

module.exports = { Finish, userFinishTimer };

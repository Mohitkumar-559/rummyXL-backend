const discardedCardsClass = require("./discardedCards.class");
const getInfo = require("../common");
const _ = require("underscore");
const jobTimerClass = require("./jobTimers.class");
const commonClass = require("./common.class.js"); //common functions
const turnClass = require("./turn.class");
const logger = require("../utils/logger");
// const { storeTableHistory } = require("../classes/gameHistory.class");
const scheduler = require("../scheduler");
const { getRedisInstances } = require("../connections/redis");
const { CHANGE_TABLE_TURN } = require("../constants/eventName");
const { addQueue, cancelJob } = require("../scheduler/bullQueue");
const { GetConfig } = require("../connections/mongodb");

const ThrowCard = (data, client) => {
  // console.time("latency timer ThrowCard");
  try {
    //Throw Card On Desk	 : data = {card,bet}, client = {si,tbid}
    /* +-------------------------------------------------------------------+
      desc:event to discard card 
      i/p: data = {card = card to throw,bet = bet set by player},client = socket object
      o/p: ThrowCard event : data = {si = seat index of user, card = picked up card , bet = current bet,bbv = current bet}
    +-------------------------------------------------------------------+ */

    logger.info(
      "ThrowCard---------->>>>>tbid: " + client.tbid + " si: " + client.si
    );
    logger.info("ThrowCard-------->>>>data: ", data);
    const { THROW_CARD_DELAY } = GetConfig()
    logger.info("ThrowCard---THROW_CARD_DELAY----->>>>data: ", THROW_CARD_DELAY);
    let { si } = client;
    getInfo.GetTbInfo(client.tbid, {}, async function (table) {
      if (!table) {
        logger.info('ThrowCard:::::::::::::::>>>Error: "table not found!!!"');
        return false;
      }
      logger.info("ThrowCard--------->>>>table.turn: " + table.turn);
      if (table.turn == -1) {
        //added to handle table stuck issue
        logger.info('ThrowCard------------>>>>>>>Error:"turn user lost"');
        return false;
      }
      if (!table.pi) {
        logger.info(
          'ThrowCard:::::::::::::::>>>Error: "table players not found!!!"'
        );
        return false;
      }
      if (!table.pi[si]) {
        logger.info(
          'ThrowCard:::::::::::::>>>>>>Error: "discard user not found"'
        );
        return false;
      }
      logger.info(
        "ThrowCard------------->>>>>si : " +
        si +
        " == table.turn: " +
        table.turn
      );
      if (si == table.turn) {
        const redisInstances = getRedisInstances();
        logger.info(
          "ThrowCard----------->>>>>table.pi[si].cards: " +
          table.pi[si].cards +
          " data.card: " +
          data.card
        );
        if (client._ir == 0) {
          let cardsData = await redisInstances.HGETALL(`userPlayingCards:${table._id.toString()}:${table.pi[table.turn].uid}`);
          let playerCards = JSON.parse(cardsData.cards);

          if (!_.contains(playerCards, data.card)) {
            // client.disconnect();

            let gCards = {
              pure: [],
              seq: [],
              set: [],
              dwd: [table.pi[si].cards],
            };
            let userShowCard1 = { allCards: [table.pi[si].cards] };

            await db.collection("playing_table").findOneAndUpdate(
              { _id: getInfo.MongoID(table._id.toString()), "pi.si": si },
              { $set: { la: new Date(), "pi.$.gCards": gCards, "pi.$.userShowCard": userShowCard1 } },
              {}
            );

            commonClass.SendData(client, "CallStuckRejoin", {});
            return false;
          }
        }
        let remainingCards = _.without(table.pi[si].cards, data.card);
        if (remainingCards.length == 13) {

          // jobTimerClass.cancelJobOnServers(table._id.toString(), table.jid);
          const userJobId = `${table.gt}:userTurnStart:${table._id.toString()}:${table.pi[table.turn].uid}`;
          // await scheduler.cancelJob.cancelTurnTimer(userJobId);
          cancelJob(userJobId);

          logger.info(
            "ThrowCard-------------" +
            table._id +
            "---------si: " +
            si +
            "--------" +
            table.turn +
            "------------->>>remainingCards.length: (13): ",
            remainingCards.length
          ); //13 cards
          let upData = {
            $set: {
              la: new Date(),
              ctrlServer: SERVER_ID,
              "pi.$.cards": remainingCards,
              "pi.$.tCount": 0,
              "pi.$.lpc": "",
              "pi.$.occ": 0,
              "pi.$._uur": 1,
            },
            $push: { oDeck: data.card } /*,$inc:{'pi.$.secTime':0}*/,
          };

          if (table.pi[si].sct && typeof data.secTime == "undefined") {
            let diff = commonClass.GetTimeDifference(
              new Date(table.pi[si].tst),
              new Date()
            );
            let scc = table.pi[si].secTime - diff;
            upData.$set["pi.$.secTime"] = parseInt(scc);
            upData.$set["pi.$.sct"] = false;
          } else if (typeof data.secTime != "undefined" && table.pi[si].sct) {
            upData.$set["pi.$.secTime"] = parseInt(data.secTime);
            upData.$set["pi.$.sct"] = false;
          }

          ///////////new logic start//////////

          // if(table.pi[si]._ir == 0 && table.pi[si].gCards){

          // 	if(table.pi[si].gCards.length > 0){

          // 		var gCards = table.pi[table.turn].gCards;
          // 		logger.info('ThrowCard---------->>>>>>gCards: ',gCards);
          // 		for(var x in gCards){
          // 			if(_.contains(gCards[x],data.card)){
          // 				gCards[x] = _.without(gCards[x],data.card);
          // 				break;
          // 			}
          // 		}
          // 		logger.info('ThrowCard------------->>>>>gCards: ',gCards);
          // 		upData.$set['pi.$.gCards'] = gCards;
          // 	}
          // 	else{
          // 		var gCards = remainingCards;
          // 		upData.$set['pi.$.gCards'] = [gCards];
          // 	}
          // }

          if (table.pi[si]._ir == 0 && table.pi[si].gCards) {
            if (table.pi[si].gCards.pure.length > 0) {
              let gCards = table.pi[table.turn].gCards.pure;
              logger.info("ThrowCard---------->>>>>>gCards: ", gCards);
              for (let x in gCards) {
                if (_.contains(gCards[x], data.card)) {
                  gCards[x] = _.without(gCards[x], data.card);
                  break;
                }
              }
              logger.info("ThrowCard------------->>>>>gCards: ", gCards);
              upData.$set["pi.$.gCards.pure"] = gCards;
            }

            if (table.pi[si].gCards.seq.length > 0) {
              let gCards = table.pi[table.turn].gCards.seq;
              logger.info("ThrowCard---------->>>>>>gCards: ", gCards);
              for (let x in gCards) {
                if (_.contains(gCards[x], data.card)) {
                  gCards[x] = _.without(gCards[x], data.card);
                  break;
                }
              }
              logger.info("ThrowCard------------->>>>>gCards: ", gCards);
              upData.$set["pi.$.gCards.seq"] = gCards;
            }

            if (table.pi[si].gCards.set.length > 0) {
              let gCards = table.pi[table.turn].gCards.set;
              logger.info("ThrowCard---------->>>>>>gCards: ", gCards);
              for (let x in gCards) {
                if (_.contains(gCards[x], data.card)) {
                  gCards[x] = _.without(gCards[x], data.card);
                  break;
                }
              }
              logger.info("ThrowCard------------->>>>>gCards: ", gCards);
              upData.$set["pi.$.gCards.set"] = gCards;
            }

            if (table.pi[si].gCards.dwd.length > 0) {
              let gCards = table.pi[table.turn].gCards.dwd;
              logger.info("ThrowCard---------->>>>>>gCards: ", gCards);
              for (let x in gCards) {
                if (_.contains(gCards[x], data.card)) {
                  gCards[x] = _.without(gCards[x], data.card);
                  break;
                }
              }
              logger.info("ThrowCard------------->>>>>gCards: ", gCards);
              upData.$set["pi.$.gCards.dwd"] = gCards;
            }

            if (table.pi[si].userShowCard?.allCards?.length > 0) {
              let { allCards } = table.pi[table.turn].userShowCard;
              logger.info("allCards", allCards);

              logger.info("ThrowCard---------->>>>>>allCards: ", allCards);
              for (let x in allCards) {
                if (_.contains(allCards[x], data.card)) {
                  allCards[x] = _.without(allCards[x], data.card);
                  break;
                }
              }
              logger.info("ThrowCard------------->>>>>gCards: ", allCards);
              upData.$set["pi.$.userShowCard.allCards"] = allCards;
            }
            // else{
            // var gCards = remainingCards;
            // upData.$set['pi.$.gCards.dwd'] = [gCards];
            // }
          }

          ///////////new logic end/////////
          if (table.pi[table.turn]._ir == 0) {
            await redisInstances.HSET(`userPlayingCards:${table._id.toString()}:${table.pi[table.turn].uid}`, "cards", JSON.stringify(remainingCards));
          }

          db.collection("playing_table").findAndModify(
            { _id: getInfo.MongoID(table._id), "pi.si": si },
            {},
            upData,
            { new: true },
            function (err, resp) {
              let res = resp.value;

              if (res && res.pi && res.pi[si]) {
                if (res.pi[si].uid && res.pi[si].uid != "") {
                  db.collection("game_users").updateOne(
                    { _id: getInfo.MongoID(res.pi[si].uid) },
                    { $set: { "flags._fDiscard": 1 } },
                    function (err1, resSts) {
                      if (err1) {
                        logger.info(
                          "ThrowCard---------------->>>>>>>>err1: ",
                          err1
                        );
                      }
                      logger.info(
                        "ThrowCard------------------->>>>>first discard completed"
                      );
                    }
                  );
                }

                commonClass.FireEventToTable(res._id.toString(), {
                  en: "ThrowCard",
                  data: {
                    si: si,
                    uid: res.pi[si].uid,
                    card: data.card,
                    finish: false,
                    bbv: res.bbv,
                    time: res.pi[si].secTime,
                    cdd: false,
                  },
                });

                discardedCardsClass.DiscardedCards(
                  {},
                  { tbid: res._id.toString() }
                );

                // storeTableHistory({
                //   tableId: res._id.toString(),
                //   eventName: "ThrowCard",
                //   tableData: res,
                //   userIndex: si
                // });
                // setTimeout(function(){   //latency
                logger.info(
                  'ThrowCard-------------->>>>>"turn going to change"'
                );



                // turnClass.changeTableTurn(res._id.toString(), "discard");
                const jobId = `${res.gt}:changeTableTurn:${res._id.toString()}`;
                // scheduler.queues.changeTableTurn({
                //   timer: 500,
                //   jobId,
                //   tableId: res._id.toString(),
                //   lastAction: "discard"
                // });

                const jobData = {
                  tableId: res._id.toString(),
                  lastAction: "discard",
                  calling: CHANGE_TABLE_TURN
                };

                const jobOption = { delay: THROW_CARD_DELAY, jobId };
                addQueue(jobData, jobOption);
              } else {
                logger.info(
                  'ThrowCard::::::::::::::::::::::::::::::>>>>>"false action user is not present on table"'
                );
                return false;
              }
            }
          );
        } else {
          logger.info(
            "ThrowCard::::::::" +
            table._id +
            ':::::>>>>Error:"false action not enough card"'
          );
          // commonClass.SendData(client, "REV", { card: data.card });
          commonClass.SendData(client, "CallStuckRejoin", {});
        }
      } else {
        logger.info(
          "ThrowCard::::::::" + table._id + ':::::>>>>Error:"false action"'
        );
        // commonClass.SendData(client, "REV", { card: data.card });
        commonClass.SendData(client, "CallStuckRejoin", {});
      }
    });
  } catch (error) {
    logger.error("-----> error ThrowCard", error);
    getInfo.exceptionError(error);
  }
  // console.timeEnd("latency timer ThrowCard");

};

module.exports = { ThrowCard };

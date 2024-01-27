const config = require("../config.json");
const _ = require("underscore");
const getInfo = require("../common");
const cardsClass = require("./cards.class"); //common functions
const commonClass = require("./common.class");
const discardedCardsClass = require("./discardedCards.class");
const logger = require("../utils/logger");
// const { storeTableHistory } = require("../classes/gameHistory.class");
const shuffleClass = require("./shuffleCard.class");
const { getRedisInstances } = require("../connections/redis");

const PickCardFromCloseDeck = (data, client, callback) => {
  // console.time("latency timer PickCardFromCloseDeck");
  try {
    //Pick From Close Deck  : data = {}, client = {si,tbid}
    /* +-------------------------------------------------------------------+
      desc:event to pick card from close deck
      i/p: data = {},client = socket object,callback = callback function
      o/p: PickCardFromCloseDeck event : data = {si = seat index of user, card = picked up card , bet = current bet}
    +-------------------------------------------------------------------+ */
    const redisInstances = getRedisInstances();

    logger.info(
      "PickCardFromCloseDeck---------->>>>>tbid: " +
      client.tbid +
      " si: " +
      client.si
    );
    logger.info("PickCardFromCloseDeck------>>>data: ", data);
    let pfcdCard = "";
    // var repick = (typeof data.repick != 'undefined' && data.repick) ? data.repick : false;
    getInfo.GetTbInfo(
      client.tbid,
      {
        cDeck: 1,
        mode: 1,
        ms: 1,
        oDeck: 1,
        spcSi: 1,
        stdP: 1,
        isSpc: 1,
        wildCard: 1,
        turn: 1,
        bbv: 1,
        game_id: 1,
        sub_id: 1,
        gt: 1,
        pi: 1,
        rSeq: 1,
      },
      async function (table) {
        if (table) {
          logger.info(
            "PickCardFromCloseDeck------------->>>>>client.si: " +
            client.si +
            " ==  table.turn: " +
            table.turn
          );

          if (client.si == table.turn) {
            if (
              table.pi &&
              table.pi[table.turn] &&
              !_.isEmpty(table.pi[table.turn]) &&
              typeof table.pi[table.turn].cards != "undefined" &&
              table.pi[table.turn].cards.length == 13
            ) {
              let rCount = 0,
                uCount = 0;
              for (let x in table.pi) {
                if (table.pi[x]._ir == 1) {
                  rCount++;
                } else if (table.pi[x]._ir == 0) {
                  uCount++;
                }
              }

              if (table.cDeck.length <= 0) {
                //if cDeck is empty then shuffle thrown cards and create new cDeck
                let remainder = table.oDeck.pop(); // last card of open deck
                let newCDeck = shuffleClass.shuffleCards(table.oDeck);
                pfcdCard = newCDeck[0];

                let rin = commonClass.GetRandomInt(0, 100);
                // if(rin <= config.SMRTPICK && uCount == 0 && table.stdP.length > 0){
                let smpk = config.SMRTPICK;
                if (table.ms == 2) {
                  smpk = config.SMRTPICK_TWO;
                }
                if (table.gt == "Pool") {
                  smpk = config.SMRTPICK_POOL;
                }
                if (table.gt == "Pool" && table.ms == 2) {
                  smpk = config.SMRTPICK_POOL_TWO;
                }

                if (
                  (rin < smpk &&
                    table.mode == "cash" &&
                    table.pi[table.turn]._ir == 1 &&
                    table.isSpc) ||
                  (rin < smpk && uCount == 0 && table.stdP.length > 0)
                ) {
                  pfcdCard = cardsClass.setCloseDeckCard(
                    newCDeck,
                    table.pi[table.turn].cards,
                    table.wildCard
                  );
                  if (_.contains(table.pi[table.turn].cards, pfcdCard)) {
                    pfcdCard = newCDeck[0];
                  }
                }

                let smpku = 0;
                if (table.gt == "Pool") {
                  smpku = config.SMRTPICK_USR_POOL;
                } else {
                  smpku = config.SMRTPICK_USR_POINT;
                }

                if (
                  rin < smpku &&
                  table.pi[table.turn].nuser &&
                  table.pi[table.turn]._ir == 0
                ) {
                  pfcdCard = cardsClass.setCloseDeckCard(
                    newCDeck,
                    table.pi[table.turn].cards,
                    table.wildCard
                  );
                  if (_.contains(table.pi[table.turn].cards, pfcdCard)) {
                    pfcdCard = newCDeck[0];
                  }
                }

                logger.info(
                  "PickCardFromCloseDeck------->>>>pfcdCard: ",
                  pfcdCard
                );
                newCDeck = _.without(newCDeck, pfcdCard);

                let upData = {
                  $push: {
                    "pi.$.cards": pfcdCard,
                    "pi.$.userShowCard.allCards": [pfcdCard],
                  },
                  $set: {
                    la: new Date(),
                    "pi.$.lpc": pfcdCard,
                    ctrlServer: SERVER_ID,
                    cDeck: newCDeck,
                    oDeck: [remainder],
                    "pi.$.bet": table.bbv,
                  },
                  $inc: { trCount: 1, "pi.$.pickCount": 1 },
                };

                if (table.pi[table.turn]._ir == 0) {
                  let gCards = table.pi[table.turn].gCards;
                  gCards.dwd.push([pfcdCard]);
                  upData.$set["pi.$.gCards"] = gCards;

                  // let cardsData = await redisInstances.HGETALL(
                  //   `userPlayingCards:${table._id.toString()}:${
                  //     table.pi[table.turn].uid
                  //   }`
                  // );
                  // cardsData = JSON.parse(cardsData.cards);
                  // cardsData.push(pfcdCard);
                  // await redisInstances.HSET(
                  //   `userPlayingCards:${table._id.toString()}:${
                  //     table.pi[table.turn].uid
                  //   }`,
                  //   "cards",
                  //   JSON.stringify(cardsData)
                  // );
                }

                db.collection("playing_table").findAndModify(
                  { _id: getInfo.MongoID(client.tbid), "pi.si": table.turn },
                  {},
                  upData,
                  { new: true },
                  async function (err, resp) {
                    let res = resp.value;
                    if (res && res.pi && res.pi[res.turn]) {
                      if (res.pi[res.turn].uid && res.pi[res.turn].uid != "") {
                        db.collection("game_users").updateOne(
                          { _id: getInfo.MongoID(res.pi[res.turn].uid) },
                          { $set: { "flags._fPick": 1 } },
                          function (err1, resSts) {
                            if (err1) {
                              logger.info(
                                "PickCardFromCloseDeck---------------->>>>>>>>err1: ",
                                err1
                              );
                            }
                            logger.info(
                              "PickCardFromCloseDeck------------------->>>>>first pick completed"
                            );
                          }
                        );
                      }
                      if (table.pi[table.turn]._ir == 0) {
                        await redisInstances.HSET(
                          `userPlayingCards:${table._id.toString()}:${table.pi[table.turn].uid
                          }`,
                          "cards",
                          JSON.stringify(res.pi[res.turn].cards)
                        );
                      }
                      commonClass.FireEventToTable(table._id.toString(), {
                        en: "reshuffleCard",
                        data: {
                          reshuffleCard: true,
                        },
                      });

                      // storeTableHistory({
                      //   tableId: res._id.toString(),
                      //   eventName: "reshuffleCard",
                      //   tableData: res,
                      //   userIndex: res.turn
                      // });
                      commonClass.FireEventToTable(table._id.toString(), {
                        en: "PickCardFromCloseDeck",
                        data: {
                          si: res.turn,
                          uid: res.pi[res.turn].uid,
                          card: pfcdCard,
                          bet: table.bbv,
                        },
                      });
                      // storeTableHistory({
                      //   tableId: res._id.toString(),
                      //   eventName: "PickCardFromCloseDeck",
                      //   tableData: res,
                      //   userIndex: res.turn
                      // });
                      if (typeof callback == "function") {
                        callback(res);
                      }
                      // });
                    } else {
                      logger.info(
                        'PickCardFromCloseDeck::::::::::::1::::::Error: "card pick failed" client.uid: ' +
                        client.uid +
                        " client.tbid: " +
                        client.tbid +
                        " client.si: " +
                        client.si +
                        " " +
                        new Date()
                      );
                    }
                  }
                );
              } else {
                pfcdCard = table.cDeck[0];

                let rin = commonClass.GetRandomInt(0, 100);
                let smpk = config.SMRTPICK;
                if (table.ms == 2) {
                  smpk = config.SMRTPICK_TWO;
                }
                if (table.gt == "Pool") {
                  smpk = config.SMRTPICK_POOL;
                }
                if (table.gt == "Pool" && table.ms == 2) {
                  smpk = config.SMRTPICK_POOL_TWO;
                }

                if (
                  (rin < smpk &&
                    table.mode == "cash" &&
                    table.pi[table.turn]._ir == 1 &&
                    table.isSpc) ||
                  (rin < smpk && uCount == 0 && table.stdP.length > 0)
                ) {
                  logger.info(
                    "PickCardFromCloseDeck------>>>>>>>>############ nre robot logic active for pick from close dack"
                  );
                  pfcdCard = cardsClass.setCloseDeckCard(
                    table.cDeck,
                    table.pi[table.turn].cards,
                    table.wildCard
                  );
                  if (_.contains(table.pi[table.turn].cards, pfcdCard)) {
                    pfcdCard = table.cDeck[0];
                  }
                }

                let smpku = 0;
                if (table.gt == "Pool") {
                  smpku = config.SMRTPICK_USR_POOL;
                } else {
                  smpku = config.SMRTPICK_USR_POINT;
                }

                if (
                  rin < smpku &&
                  table.pi[table.turn].nuser == true &&
                  table.pi[table.turn]._ir == 0
                ) {
                  pfcdCard = cardsClass.setCloseDeckCard(
                    table.cDeck,
                    table.pi[table.turn].cards,
                    table.wildCard
                  );
                  if (_.contains(table.pi[table.turn].cards, pfcdCard)) {
                    pfcdCard = table.cDeck[0];
                  }
                }

                let remainingCards = _.without(table.cDeck, pfcdCard);
                let upData = {
                  $push: {
                    "pi.$.cards": pfcdCard,
                    "pi.$.userShowCard.allCards": [pfcdCard],
                  },
                  $set: {
                    la: new Date(),
                    cDeck: remainingCards,
                    "pi.$.lpc": pfcdCard,
                    ctrlServer: SERVER_ID,
                    "pi.$.tCount": 0,
                    "pi.$.bet": table.bbv,
                  },
                  $inc: { trCount: 1, "pi.$.pickCount": 1 },
                };

                if (table.pi[table.turn]._ir == 0) {
                  let gCards = table.pi[table.turn].gCards;
                  // var temp = _.flatten(gCards);
                  gCards.dwd.push([pfcdCard]);
                  // if(temp.length > 0 && temp.length == 13){
                  // 	gCards.push([pfcdCard]);
                  upData.$set["pi.$.gCards"] = gCards;
                  // }
                  // else if(temp.length == 0){
                  // 	gCards = table.pi[table.turn].cards;
                  // 	gCards.push(pfcdCard);
                  // 	upData.$set['pi.$.gCards'] = [gCards];
                  // }
                  // else{
                  // 	//do nothing
                  // }
                  // let cardsData = await redisInstances.HGETALL(
                  //   `userPlayingCards:${table._id.toString()}:${
                  //     table.pi[table.turn].uid
                  //   }`
                  // );
                  // cardsData = JSON.parse(cardsData.cards);
                  // cardsData.push(pfcdCard);
                  // await redisInstances.HSET(
                  //   `userPlayingCards:${table._id.toString()}:${
                  //     table.pi[table.turn].uid
                  //   }`,
                  //   "cards",
                  //   JSON.stringify(cardsData)
                  // );
                }
                // if(table.pi[table.turn]._ir==0){
                //   let cardsData = await redisInstances.HGETALL(`${table._id.toString()}-${table.pi[table.turn].uid}`);
                //   cardsData = JSON.parse(cardsData.cards);
                //   cardsData.push(pfcdCard);
                //   await redisInstances.HSET(`${table._id.toString()}-${table.pi[table.turn].uid}`, "cards", JSON.stringify(cardsData));

                // }

                db.collection("playing_table").findAndModify(
                  { _id: getInfo.MongoID(client.tbid), "pi.si": table.turn },
                  {},
                  upData,
                  { new: true },
                  async function (err, resp) {
                    let res = resp.value;
                    if (res && res.pi && res.pi[res.turn]) {
                      if (res.pi[res.turn].uid && res.pi[res.turn].uid != "") {
                        db.collection("game_users").updateOne(
                          { _id: getInfo.MongoID(res.pi[res.turn].uid) },
                          { $set: { "flags._fPick": 1 } },
                          async function (err1, resSts) {
                            if (err1) {
                              logger.info(
                                "PickCardFromCloseDeck---------------->>>>>>>>err1: ",
                                err1
                              );
                            }
                            logger.info(
                              "PickCardFromCloseDeck------------------->>>>>first pick completed"
                            );
                          }
                        );
                      }
                      if (table.pi[table.turn]._ir == 0) {
                        await redisInstances.HSET(
                          `userPlayingCards:${table._id.toString()}:${table.pi[table.turn].uid
                          }`,
                          "cards",
                          JSON.stringify(res.pi[res.turn].cards)
                        );
                      }
                      commonClass.FireEventToTable(res._id.toString(), {
                        en: "PickCardFromCloseDeck",
                        data: {
                          si: res.turn,
                          uid: res.pi[res.turn].uid,
                          card: pfcdCard,
                          bet: table.bbv,
                        },
                      });
                      // storeTableHistory({
                      //   tableId: res._id.toString(),
                      //   eventName: "PickCardFromCloseDeck",
                      //   tableData: res,
                      //   userIndex: res.turn
                      // });
                      if (typeof callback == "function") {
                        callback(res);
                      }
                      // });
                    } else {
                      logger.info(
                        'PickCardFromCloseDeck::::::::::2::::::::::Error: "card pick failed" client.tbid: ' +
                        client.tbid +
                        " client.si: " +
                        client.si +
                        " client.uid: " +
                        client.uid +
                        " " +
                        new Date()
                      );
                    }
                  }
                );
              }
              //})
            } else {
              logger.info(
                "PickCardFromCloseDeck:::::::::" +
                client.tbid +
                ':::::::::>>>>>Error: "not valid no. of cards"'
              );
            }
          } else {
            logger.info(
              "PickCardFromCloseDeck::::::::" +
              table._id +
              ':::::>>>>Error:"false action"'
            );
          }
        } else {
          logger.info(
            'PickCardFromCloseDeck::::::::::::::::>>>>Error: "table not found!!!"'
          );
        }
      }
    );
  } catch (error) {
    logger.error("-----> error PickCardFromCloseDeck", error);
    getInfo.exceptionError(error);
  }
  // console.timeEnd("latency timer PickCardFromCloseDeck");
};
const PickCardFromOpenDeck = (data, client, callback) => {
  // console.time("latency timer PickCardFromOpenDeck");
  try {
    //Pick From Thrown Cards  : data = {}, client = {si,tbid}
    /* +-------------------------------------------------------------------+
      desc:event to pick card from open deck
      i/p: data = {},client = socket object,callback = callback function
      o/p: PickCardFromOpenDeck event : data = {si = seat index of user, card = picked up card , bet = current bet}
    +-------------------------------------------------------------------+ */
    const redisInstances = getRedisInstances();
    logger.info(
      "PickCardFromOpenDeck---------->>>>>tbid: " +
      client.tbid +
      " si: " +
      client.si
    );
    logger.info("PickCardFromOpenDeck-------->>>>data: ", data);
    getInfo.GetTbInfo(
      client.tbid,
      {
        oDeck: 1,
        turn: 1,
        wildCard: 1,
        bbv: 1,
        pi: 1,
        rSeq: 1,
        gt: 1,
        game_id: 1,
        sub_id: 1,
        thp: 1,
      },
      async function (table) {
        if (table) {
          logger.info(
            "PickCardFromOpenDeck------------->>>>>client.si: " +
            client.si +
            "==  table.turn: " +
            table.turn
          );
          if (client.si == table.turn) {
            let pfodCard = table.oDeck.pop();

            logger.info("PickCardFromOpenDeck-------->>>>pfodCard: ", pfodCard);

            if (
              typeof pfodCard == "undefined" ||
              pfodCard == null ||
              pfodCard == "" ||
              _.isEmpty(table.pi[table.turn]) ||
              typeof table.pi[table.turn].cards == "undefined" ||
              table.pi[table.turn].cards.length != 13
            ) {
              logger.info(
                "PickCardFromOpenDeck::::::::::" +
                client.tbid +
                ':::::::::>>>>Error: "open deck is empty or cards length is not valid!!!" ' +
                new Date()
              );
              return false;
            }

            let game_id = table.game_id;
            if (table.gt == "Deal" || table.gt == "Pool") {
              game_id = game_id + "." + table.sub_id;
            }

            let upData = {
              $set: {
                la: new Date(),
                "pi.$.lpc": pfodCard,
                ctrlServer: SERVER_ID,
                "pi.$.occ": 1,
                "pi.$.tCount": 0,
                "pi.$.bet": table.bbv,
              },
              $push: {
                "pi.$.cards": pfodCard,
                "pi.$.userShowCard.allCards": [pfodCard],
              },
              $pop: { oDeck: 1 },
              $inc: { trCount: 1, "pi.$.pickCount": 1 },
            };

            if (table.pi[table.turn]._ir == 0) {
              let gCards = table.pi[table.turn].gCards;
              gCards.dwd.push([pfodCard]);
              upData.$set["pi.$.gCards"] = gCards;

              // let cardsData = await redisInstances.HGETALL(
              //   `userPlayingCards:${table._id.toString()}:${
              //     table.pi[table.turn].uid
              //   }`
              // );
              // cardsData = JSON.parse(cardsData.cards);
              // cardsData.push(pfodCard);
              // await redisInstances.HSET(
              //   `userPlayingCards:${table._id.toString()}:${
              //     table.pi[table.turn].uid
              //   }`,
              //   "cards",
              //   JSON.stringify(cardsData)
              // );
            }
            // if (table.pi[table.turn]._ir == 0) {
            //   let cardsData = await redisInstances.HGETALL(`${table._id.toString()}-${table.pi[table.turn].uid}`);
            //   cardsData = JSON.parse(cardsData.cards);
            //   cardsData.push(pfodCard);
            //   await redisInstances.HSET(`${table._id.toString()}-${table.pi[table.turn].uid}`, "cards", JSON.stringify(cardsData));
            // }

            db.collection("playing_table").findAndModify(
              { _id: table._id, "pi.si": table.turn },
              {},
              upData,
              { new: true },
              async function (err, resp) {
                let res = resp.value;
                if (res && res.pi && res.pi[res.turn]) {
                  if (res.pi[res.turn].uid && res.pi[res.turn].uid != "") {
                    db.collection("game_users").updateOne(
                      { _id: getInfo.MongoID(res.pi[res.turn].uid) },
                      { $set: { "flags._fPick": 1 } },
                      function (err1, resSts) {
                        if (err1) {
                          logger.info(
                            "PickCardFromOpenDeck---------------->>>>>>>>err1: ",
                            err1
                          );
                        }
                        logger.info(
                          "PickCardFromOpenDeck------------------->>>>>first pick completed"
                        );
                      }
                    );
                  }
                  if (table.pi[table.turn]._ir == 0) {
                    await redisInstances.HSET(
                      `userPlayingCards:${table._id.toString()}:${table.pi[table.turn].uid
                      }`,
                      "cards",
                      JSON.stringify(res.pi[res.turn].cards)
                    );
                  }
                  commonClass.FireEventToTable(res._id.toString(), {
                    en: "PickCardFromOpenDeck",
                    data: {
                      si: res.turn,
                      uid: res.pi[res.turn].uid,
                      card: pfodCard,
                      thp: res.pi[res.turn].thp,
                      bet: table.bbv,
                    },
                  });
                  // storeTableHistory({
                  //   tableId: res._id.toString(),
                  //   eventName: "PickCardFromOpenDeck",
                  //   tableData: res,
                  //   userIndex: res.turn
                  // });
                  discardedCardsClass.DiscardedCards(
                    {},
                    { tbid: res._id.toString() }
                  );
                  if (typeof callback == "function") {
                    callback(res);
                  }
                  // });
                } else {
                  logger.info(
                    'PickCardFromOpenDeck::::::::::::::::::Error: "invalid pick event" client.si: ' +
                    client.si +
                    " res: ",
                    res,
                    " " + new Date()
                  );
                }
              }
            );
          } else {
            logger.info(
              "PickCardFromOpenDeck::::::::" +
              table._id +
              ':::::>>>>Error:"false action"'
            );
          }
        } else {
          logger.info(
            'PickCardFromOpenDeck:::::::::::::::>>>>Error:" table not found!!!"'
          );
        }
      }
    );
  } catch (error) {
    logger.error("-----> error PickCardFromOpenDeck", error);
    getInfo.exceptionError(error);
  }
  // console.timeEnd("latency timer PickCardFromOpenDeck");
};

module.exports = { PickCardFromOpenDeck, PickCardFromCloseDeck };

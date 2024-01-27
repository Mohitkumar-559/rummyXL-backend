const _ = require("underscore");
const { getTableName } = require("../utils");
const config = require("../config.json");
const jobTimerClass = require("./jobTimers.class");
const commonData = require("./commonData.class");
const commonClass = require("./common.class");
const schedule = require("node-schedule");
const trackClass = require("./track.class");
const { cardChange } = require("../utils/winnerCardChanges");
const {
  saveGameHistory,
  // storeTableHistoryForWinner,
} = require("./gameHistory.class");
const checkPlayerAvailability = require("../common/checkPlayerAvailability");
const getInfo = require("../common");
const playClass = require("./play.class");
const logger = require("../utils/logger");
const Socket = require("../utils/getSockets");
const socketData = new Socket();
const roundClass = require("./round.class");
const playingTableClass = require("./playingTable.class");
const { GetConfig } = require("../connections/mongodb");
const scheduler = require("../scheduler");
const { getRedisInstances } = require("../connections/redis");
const { DEAL_REMATCH_TIMER } = require("../constants/eventName");
const { addQueue, cancelJob } = require("../scheduler/bullQueue");
const { replaceKeyOldToNew } = require("./replaceKey.class");
const { clearQueue } = require("../scheduler/bullClear");

const declareRoundWinner = (tbId, direct) => {
  // console.time("latency timer declareRoundWinner");
  try {
    /* +-------------------------------------------------------------------+
      desc:function to declare round winner
      i/p: tbId = table id, direct = true/false if true then direct winner declaration
    +-------------------------------------------------------------------+ */
    logger.info("-----declareRoundWinner---------");
    getInfo.GetTbInfo(tbId, {}, function (table) {
      let players = getInfo.getPlayingUserInRound(table.pi);
      // var winner = -1;

      handleRoundLoser(
        table._id.toString(),
        players,
        table.bv,
        table.mode,
        table._ip,
        table.gt,
        table.round,
        table.fnsPlayer,
        direct,
        -1,
        0
      );
    });
  } catch (error) {
    logger.error("-----> error declareRoundWinner", error);
    getInfo.exceptionError(error);
  }
  // console.timeEnd("latency timer declareRoundWinner");
};

const declareRoundWinnerNew = (tbId, seatIndex, client, direct, indecl) => {
  // console.time("latency timer declareRoundWinnerNew");
  try {
    /* +-------------------------------------------------------------------+
      desc:function to declare round winner
      i/p: tbId = table id, direct = true/false if true then direct winner declaration
    +-------------------------------------------------------------------+ */
    getInfo.GetTbInfo(tbId, {}, function (table) {
      let players = getInfo.getPlayingUserInRound(table.pi);
      logger.info("declareRoundWinnernew--------->>>>>>players:", players);
      // var winner = -1;
      let winner = table.fnsPlayer;
      handleRoundLoserNew(
        table._id.toString(),
        players,
        table.bv,
        table.mode,
        table._ip,
        table.gt,
        table.round,
        table.fnsPlayer,
        direct,
        winner,
        seatIndex,
        client,
        indecl
      );
    });
  } catch (error) {
    logger.error("-----> error declareRoundWinnerNew", error);
    getInfo.exceptionError(error);
  }
  // console.timeEnd("latency timer declareRoundWinnerNew");
};

const declareDealWinner = async (tbId, direct, indecl) => {
  // console.time("latency timer declareDealWinner");
  try {
    //handles deal rummy final deal winner
    /* +-------------------------------------------------------------------+
      desc:function to declare deal rummy final winner
      i/p: tbId = table id, direct = true/false if true then direct winner declaration
    +-------------------------------------------------------------------+ */
    const redisInstances = getRedisInstances();
    const lvt = await redisInstances.SET(`declareDealWinner:${tbId}`, 1, {
      EX: 3,
      NX: true,
    });
    logger.info("lvt----------------->", lvt);
    if (!lvt) {
      logger.info("in if---", "declareDealWinner");
      return false;
    }
    getInfo.GetTbInfo(
      tbId,
      {
        pi: 1,
        ms: 1,
        pv: 1,
        bv: 1,
        round: 1,
        fnsPlayer: 1,
        mode: 1,
        gt: 1,
        _ip: 1,
        tpr: 1,
      },
      function (table) {
        logger.info("declareDealWinner------------->>>>table.pv:" + table.pv);
        let player = getInfo.getPlayingUserInRound(table.pi);
        logger.info(
          "declareDealWinner------------>>>>>>>>>player:",
          table.tpr,
          player
        );

        let winners = [];
        let winnersTwo = [];
        let tpr = table.tpr;
        let total = player.length;
        if (table.gt !== "Deal") {
          for (let i = 0; i < total; i++) {
            //prepare total points array
            if (player[i].play == 1 && table.fnsPlayer != i) {
              // if (
              //   player[i].turnCounter === 0 &&
              //   player[table.fnsPlayer].indecl === false
              // ) {
              //   player[i].ps = parseInt(player[i].ps / 2);
              // }
              tpr = tpr + player[i].ps;
            }
          }
        }

        logger.info(
          "declareDealWinner------------>>>>>>>>>table.fnsPlayer:",
          tpr,
          table.fnsPlayer
        );
        db.collection("playing_table").findAndModify(
          { _id: getInfo.MongoID(tbId), "pi.si": table.fnsPlayer },
          {},
          { $set: { "pi.$.tScore": tpr }, $inc: { "pi.$.tdps": tpr } },
          { new: true },
          function (err, table1) {
            if (table1 && table1.value) {
              var players = getInfo.getPlayingUserInRound(table1.value.pi);
              // for (var j = 0; j < total; j++) {
              //   //prepare total points array
              //   if (players[j].play == 1 && table.fnsPlayer != j) {
              //     players[j].tdps = players[j].tdps - players[j].ps;
              //   } else if (table.fnsPlayer == j) {
              //     players[j]._iw = 1;
              //   }
              // }

              var dpsArray = [];
              for (var i = 0; i < total; i++) {
                //prepare total points array
                if (players[i].play == 1) {
                  dpsArray.push(players[i].tdps);
                }
              }
              logger.info(
                "declareDealWinner------------->>>>>>>dpsArray: ",
                dpsArray
              );
              // var countWinner = _.countBy(dpsArray)[minDps];  //counts the number of winners ,i.e count number of min total points
              var maxDps = _.max(dpsArray); //counts the minimum total points
              logger.info(
                "declareDealWinner------------->>>>>>minDps: ",
                maxDps
              );
              var draw = false;
              if (table1.value.ms != 2) {
                dpsArray.sort(function (a, b) {
                  return a - b;
                });
                if (dpsArray[dpsArray.length - 2] == maxDps) {
                  draw = true;
                  var secondmaxDps = 0;
                } else {
                  var secondmaxDps = dpsArray[dpsArray.length - 2];
                }
              } else {
                var secondmaxDps = 0;
              }
              var k = 0;
              res(k);
              function res(k) {
                if (k < total) {
                  if (players[k].tdps == maxDps && players[k].play == 1) {
                    //means the winners
                    logger.info(
                      "declareDealWinner-------------if---------------->>>>>",
                      players[k].uid
                    );
                    logger.info(
                      "declareDealWinner-------------if---------------->>>>> players[k].tdps ",
                      players[k].tdps,
                      players[k].si
                    );
                    winners.push(players[k].si);
                    logger.info(
                      "declareDealWinner-------------if---------------->>>>> players[k].tdps winners",
                      winners
                    );
                    k++;
                    res(k);
                  } else if (
                    players[k].tdps == secondmaxDps &&
                    players[k].play == 1 &&
                    table1.value.ms != 2 &&
                    draw == false
                  ) {
                    logger.info(
                      "declareDealWinner-------------if---------------->>>>> players[k].tdps secondmaxDps",
                      players[k].tdps,
                      players[k].si
                    );
                    winnersTwo.push(players[k].si);
                    logger.info(
                      "declareDealWinner-------------else---------------->>>>> players[k].tdps winnersTwo",
                      winnersTwo
                    );
                    k++;
                    res(k);
                  } else {
                    if (
                      players[k].s == "declare" ||
                      players[k].s == "drop" ||
                      players[k].s == "playing"
                    ) {
                      logger.info(
                        "declareDealWinner-----------else--------------->>>>>>",
                        players[k].uid
                      );
                      handleDealLoser(
                        table1.value._id.toString(),
                        players[k],
                        table1.value.bv,
                        table1.value.deals,
                        table1.value.mode,
                        table1.value.round,
                        table1.value._ip,
                        table1.value.gt,
                        function (resp) {
                          if (resp) {
                            k++;
                            res(k);
                          }
                        }
                      );
                    } else {
                      k++;
                      res(k);
                    }
                  }
                } else {
                  logger.info(
                    "declareDealWinner---------------->>>>>>table1.value.pv: " +
                    table1.value.pv +
                    " type: " +
                    typeof table1.value.pv
                  );
                  // setTimeout(function(){
                  handleDealWinner(
                    table1.value._id.toString(),
                    winners,
                    winnersTwo,
                    table1.value.pv,
                    direct,
                    indecl,
                    maxDps
                  );
                  // },1000);
                }
              }
            }
          }
        );
      }
    );
  } catch (error) {
    logger.error("-----> error declareDealWinner", error);
    getInfo.exceptionError(error);
  }
  // console.timeEnd("latency timer declareDealWinner");

};

const declareWinner = (tbId) => {
  try {
    //handle classic rummy round winner
    /* +-------------------------------------------------------------------+
      desc:function to declare winner
      i/p: tbId = table id
    +-------------------------------------------------------------------+ */
    getInfo.GetTbInfo(tbId, {}, function (table) {
      let players = getInfo.getPlayingUserInRound(table.pi);
      // logger.info('declareWinner--------->>>>>>players: ',players);
      logger.info(
        "declareWinner--------------" +
        table._id +
        "-------------->>>>>" +
        table.fnsPlayer
      );

      handleLoser(
        table._id.toString(),
        players,
        table.bv,
        table.gt,
        table._ip,
        table.mode,
        table.round,
        table.fnsPlayer,
        -1,
        0
      );
    });
  } catch (error) {
    logger.error("-----> error declareWinner", error);
    getInfo.exceptionError(error);
  }
};

const declareWinnerNew = (tbId, seatIndex, client) => {
  // console.time("latency timer declareWinnerNew");

  try {
    //handle classic rummy round winner
    /* +-------------------------------------------------------------------+
      desc:function to declare winner
      i/p: tbId = table id
    +-------------------------------------------------------------------+ */
    getInfo.GetTbInfo(tbId, {}, function (table) {
      let players = getInfo.getPlayingUserInRound(table.pi);
      logger.info("declareWinner--------->>>>>>players: 1111111111", players);

      let winner = table.fnsPlayer;
      handleLoserNew(
        table._id.toString(),
        players,
        table.bv,
        table.gt,
        table._ip,
        table.mode,
        table.round,
        table.fnsPlayer,
        winner,
        seatIndex,
        client
      );
    });
  } catch (error) {
    logger.error("-----> error declareWinnerNew", error);
    getInfo.exceptionError(error);
  }
  // console.timeEnd("latency timer declareWinnerNew");

};

const handleRoundLoser = (
  tbId,
  players,
  bv,
  mode,
  _ip,
  gt,
  round,
  fnsPlayer,
  direct,
  winner,
  iter
) => {
  // console.time("latency timer handleRoundLoser");

  try {
    /* +-------------------------------------------------------------------+
      desc:function to handle round loser
      i/p: tbId = table id,players = players details,bv = boot value,gt = game type ,fnPlayer = finish player seat index,direct = true/false direct winner or not ,winner = winner player seat index,iter = iterator for recursion
    +-------------------------------------------------------------------+ */
    var total = players.length;
    logger.info("iter----------->", iter, total);
    if (iter < total) {
      logger.info(
        "players[iter].si ----------->",
        players[iter].si,
        fnsPlayer,
        players[iter].play
      );
      if (players[iter].si == fnsPlayer && players[iter].play == 1) {
        //means the winner
        logger.info(
          "handleRoundLoser----------if---if---------------->>>>>",
          players[iter].uid
        );
        winner = players[iter].si;
        handleRoundLoser(
          tbId,
          players,
          bv,
          mode,
          _ip,
          gt,
          round,
          fnsPlayer,
          direct,
          winner,
          iter + 1
        );
      } else {
        logger.info("players[iter].s------------->", players[iter].s);
        if (players[iter].s == "declare" || players[iter].s == "drop") {
          logger.info(
            "handleRoundLoser-----if--else--if1--------------->>>>>>",
            players[iter].uid
          );

          if (
            gt === "Deals" &&
            players[iter].turnCounter === 0 &&
            players[fnsPlayer].indecl === false
          ) {
            players[iter].ps = parseInt(players[iter].ps / 2);
          }

          commonData.CountHands(
            players[iter].uid,
            "lost",
            gt,
            bv,
            false,
            mode,
            _ip,
            round,
            function (thp, qstWin, hpc) {
              commonData.getUserScore(
                players[iter].uid,
                bv,
                gt,
                function (score) {
                  logger.info(
                    "handleRoundLoser---------players[iter].pt----------->>>>>>",
                    players[iter].ps
                  );
                  // if(players[iter].pickCount == 0){
                  // 	if(players[iter].ps <= 5){
                  // 		players[iter].ps = 2;
                  // 	}
                  // 	else{
                  // 		if(players[iter].ps%2 == 0){
                  // 			players[iter].ps = players[iter].ps/2;
                  // 		}
                  // 		else{
                  // 			players[iter].ps = players[iter].ps - 1;
                  // 			players[iter].ps = players[iter].ps/2;
                  // 		}
                  // 	}
                  // }
                  players[iter].tdps = players[iter].tdps - players[iter].ps;
                  var upData = {
                    $set: {
                      la: new Date(),
                      "pi.$.score": score,
                      "pi.$.thp": thp,
                      "pi.$.hpc": hpc,
                    },
                    $inc: {
                      "pi.$.rl": 1,
                      "pi.$.tdps": -players[iter].ps,
                      tpr: players[iter].ps,
                    },
                    $addToSet: {
                      hist: players[iter],
                    },
                  };

                  db.collection("playing_table").findAndModify(
                    { _id: getInfo.MongoID(tbId), "pi.si": players[iter].si },
                    {},
                    upData,
                    { new: true },
                    function () {
                      logger.info(
                        "handleRoundLoser------if----else----if2-------->>>>>>"
                      );
                      handleRoundLoser(
                        tbId,
                        players,
                        bv,
                        mode,
                        _ip,
                        gt,
                        round,
                        fnsPlayer,
                        direct,
                        winner,
                        iter + 1
                      );
                    }
                  );
                }
              );
            }
          );
        } else {
          logger.info("handleRoundLoser------if----else-----else----->>>>>>");
          handleRoundLoser(
            tbId,
            players,
            bv,
            mode,
            _ip,
            gt,
            round,
            fnsPlayer,
            direct,
            winner,
            iter + 1
          );
        }
      }
    } else {
      logger.info("handleRoundLoser------else---------->>>>>>");
      if (gt == "Deal") {
        handleRoundWinner(tbId, winner, direct);
      } else if (gt == "Pool") {
        handlePoolWinner(tbId, winner, direct);
      }
    }
  } catch (error) {
    logger.error("-----> error handleRoundLoser", error);
    getInfo.exceptionError(error);
  }
  // console.timeEnd("latency timer handleRoundLoser");

};

const handleRoundLoserNew = async (
  tbId,
  players,
  bv,
  mode,
  _ip,
  gt,
  round,
  fnsPlayer,
  direct,
  winner,
  seatIndex,
  client,
  indecl
) => {
  // console.time("latency timer handleRoundLoserNew");

  try {
    /* +-------------------------------------------------------------------+
      desc:function to handle round loser
      i/p: tbId = table id,players = players details,bv = boot value,gt = game type ,fnPlayer = finish player seat index,direct = true/false direct winner or not ,winner = winner player seat index,iter = iterator for recursion
    +-------------------------------------------------------------------+ */

    let table = await db
      .collection("playing_table")
      .findOne({ _id: getInfo.MongoID(tbId) });
    logger.info("table------------------>", table);

    let userList = table.pi.filter(x => x._ir == 0);
    userList = table.pi.map(x => getInfo.MongoID(x.uid));
    let socketListUsers = await db.collection("game_users").distinct("sck", { _id: { $in: userList } });
    logger.info("socketListUsers ===> handleRoundLoserNew", socketListUsers);

    const socketList = socketListUsers.map(x => io.sockets.sockets.get(x.split('.')[1]));

    // const socketList = await socketData.getSocketListObject(
    //   table._id.toString()
    // );
    let playerDetail = players.find((x) => x.si == seatIndex);
    let wAnimation = false;
    logger.info("si----->", seatIndex);
    if (playerDetail && playerDetail.si == fnsPlayer) {
      logger.info(
        "handleRoundLoserNew----if----->>>>>>>seatIndex: " + seatIndex
      );
      winner = playerDetail.si;
      wAnimation = true;
      commonData.getUserScore(
        playerDetail.uid,
        table.bv,
        gt,
        async function (score) {
          table.pi[playerDetail.si].score = score;
          await checkWinnerDeclare(
            table,
            socketList,
            winner,
            wAnimation,
            direct,
            indecl
          );
        }
      );
    } else {
      if (
        (playerDetail && playerDetail.s == "declare") ||
        playerDetail.s == "drop"
      ) {
        logger.info("handleRoundLoserNew-----else--->>>>>>", seatIndex);

        commonData.CountHands(
          playerDetail.uid,
          "lost",
          gt,
          bv,
          false,
          mode,
          _ip,
          round,
          function (thp, qstWin, hpc) {
            commonData.getUserScore(
              playerDetail.uid,
              bv,
              gt,
              async function (score) {
                logger.info(
                  "handleRoundLoserNew---------players[iter].pt----------->>>>>>",
                  playerDetail
                );
                if (table.gt === "Deal") {
                  var upData = {
                    $set: {
                      la: new Date(),
                      "pi.$.score": score,
                      "pi.$.thp": thp,
                      "pi.$.hpc": hpc,
                      // "pi.$.dps": Math.abs(playerDetail.tdps),
                      // "pi.$.ps": playerDetail.ps,
                      // "pi.$.tScore": -playerDetail.ps,
                    },
                    $inc: {
                      "pi.$.rl": 1,
                      // "pi.$.tdps": -playerDetail.ps,
                      // tpr: playerDetail.ps,
                    },
                    // fix 2 player data in score board
                    /*  $addToSet: {
                      hist: playerDetail,
                    }, */
                  };
                } else {
                  playerDetail.tdps = playerDetail.tdps - playerDetail.ps;
                  playerDetail.dps = Math.abs(playerDetail.tdps);
                  playerDetail.tScore = -playerDetail.ps;
                  var upData = {
                    $set: {
                      la: new Date(),
                      "pi.$.score": score,
                      "pi.$.thp": thp,
                      "pi.$.hpc": hpc,
                      "pi.$.dps": Math.abs(playerDetail.tdps),
                      "pi.$.ps": playerDetail.ps,
                      "pi.$.tScore": -playerDetail.ps,
                    },
                    $inc: {
                      "pi.$.rl": 1,
                      "pi.$.tdps": -playerDetail.ps,
                      tpr: playerDetail.ps,
                    },
                    // fix 2 player data in score board
                    /*  $addToSet: {
                      hist: playerDetail,
                    }, */
                  };
                }

                // fix 2 player data in score board
                if (table.hist.length != 0) {
                  for (const iterator of table.hist) {
                    logger.info("iterator----->", iterator.uid);
                    if (iterator.uid == playerDetail.uid) {
                      await db.collection("playing_table").updateOne(
                        {
                          _id: getInfo.MongoID(table._id.toString()),
                          "hist.uid": playerDetail.uid,
                        },
                        { $set: { "hist.$": playerDetail } },
                        { new: true }
                      );
                    } else {
                      upData["$addToSet"] = { hist: playerDetail };
                    }
                  }
                } else {
                  upData["$addToSet"] = { hist: playerDetail };
                }

                db.collection("playing_table").findAndModify(
                  { _id: getInfo.MongoID(tbId), "pi.si": playerDetail.si },
                  {},
                  upData,
                  { new: true },
                  async function (err, resp) {
                    // logger.info("err------------->", err);
                    logger.info(
                      "handleRoundLoserNew------else------->>>>>>",
                      resp
                    );
                    table = resp.value;
                    await checkWinnerDeclare(
                      table,
                      socketList,
                      winner,
                      wAnimation,
                      direct,
                      indecl
                    );
                  }
                );
              }
            );
          }
        );
      }
    }
  } catch (error) {
    logger.error("-----> error handleRoundLoserNew", error);
    getInfo.exceptionError(error);
  }
  // console.timeEnd("latency timer handleRoundLoserNew");

};

const handleDealLoser = (
  tbId,
  playerData,
  bv,
  deals,
  mode,
  round,
  _ip,
  gt,
  callback
) => {
  // console.time("latency timer handleDealLoser");

  try {
    /* +-------------------------------------------------------------------+
      desc:function to handle deal loser
      i/p: tbId = table id,playerData = player details,bv = boot value,gt = game type 
    +-------------------------------------------------------------------+ */
    commonData.CountHands(
      playerData.uid,
      "lost",
      gt,
      bv,
      true,
      mode,
      _ip,
      round,
      function (thp, qstWin, hpc) {
        commonData.getUserScore(playerData.uid, bv, gt, function (score) {
          logger.info(
            "handleDealLoser---------------->>>>>playerData.tdps: ",
            playerData.tdps
          );
          var upData = {
            $set: {
              la: new Date(),
              "pi.$.score": score,
              "pi.$.thp": thp,
              "pi.$.hpc": hpc,
            },
            $inc: { "pi.$.rl": 1 },
            $addToSet: { hist: playerData },
          };

          db.collection("playing_table").findAndModify(
            { _id: getInfo.MongoID(tbId), "pi.si": playerData.si },
            {},
            upData,
            { new: true },
            function (err, resp) {
              if (resp && resp.value) {
                return callback(true);
              }
            }
          );
        });
      }
    );
  } catch (error) {
    logger.error("-----> error handleDealLoser", error);
    getInfo.exceptionError(error);
  }
  // console.timeEnd("latency timer handleDealLoser");

};

const handleLoser = (
  tbId,
  players,
  bv,
  gt,
  _ip,
  mode,
  round,
  fnsPlayer,
  winner,
  iter
) => {
  // console.time("latency timer handleLoser");

  try {
    /* +-------------------------------------------------------------------+
      desc:function to handle game loser
      i/p: tbId = table id,players = players details,bv = boot value,gt = game type,fnsPlayer = finish player seat index,winner = winner player seat index,iter = iterator for recursion 
    +-------------------------------------------------------------------+ */
    logger.info(
      "handleLoser----------" + tbId + "--------->>>>>players: ",
      players,
      "--------------->>>>iter: " + iter
    );
    let total = players.length;
    const { LATE_FINISH_PENALTY_POINTS } = GetConfig();

    if (iter < total) {
      if (players[iter].si == fnsPlayer) {
        logger.info("handleLoser----if----->>>>>>>iter: " + iter);
        winner = players[iter].si;
        handleLoser(
          tbId,
          players,
          bv,
          gt,
          _ip,
          mode,
          round,
          fnsPlayer,
          winner,
          iter + 1
        );
      } else {
        if (players[iter].s == "declare") {
          logger.info("handleLoser--------else---if------>>>>>>iter: " + iter);

          let chips = 0;
          let pts =
            players[iter].ps == 0
              ? LATE_FINISH_PENALTY_POINTS
              : players[iter].ps;

          let pvv = bv * MAX_DEADWOOD_PTS;
          let chp = pvv - pts * bv;
          chips = chp;
          let cutch = pts * bv;

          if (mode == "practice") {
            commonData.UpdateCashForPlayInTable(
              tbId,
              players[iter].uid,
              chips,
              "Game Lost",
              function (uChips) {
                commonData.CountHands(
                  players[iter].uid,
                  "lost",
                  gt,
                  bv,
                  false,
                  mode,
                  _ip,
                  round,
                  function (thp, qstWin, hpc) {
                    var tempPlayerData = players[iter];
                    tempPlayerData.wc = -commonClass.RoundInt(cutch, 2);
                    tempPlayerData.pts = pts;
                    tempPlayerData.Chips = uChips;
                    tempPlayerData.gedt = new Date();
                    var upData = {
                      $set: {
                        la: new Date(),
                        "pi.$.wc": -commonClass.RoundInt(cutch, 2),
                        "pi.$.Chips": uChips,
                        "pi.$.pts": pts,
                        "pi.$.thp": thp,
                        "pi.$.hpc": hpc,
                        "pi.$.gedt": new Date(),
                      },
                      $inc: { "pi.$.rl": 1, pv: cutch },
                    };
                    upData["$addToSet"] = { hist: tempPlayerData };

                    commonData.getUserScore(
                      players[iter].uid,
                      bv,
                      gt,
                      function (score) {
                        upData["$set"]["pi.$.score"] = score;
                        db.collection("playing_table").findAndModify(
                          {
                            _id: getInfo.MongoID(tbId),
                            "pi.si": players[iter].si,
                          },
                          {},
                          upData,
                          { new: true },
                          function (err, res) {
                            logger.info(
                              "handleLoser------------>>>>res.value: ",
                              res.value
                            );
                            handleLoser(
                              tbId,
                              players,
                              bv,
                              gt,
                              _ip,
                              mode,
                              round,
                              fnsPlayer,
                              winner,
                              iter + 1
                            );
                          }
                        );
                      }
                    );
                  }
                );
              }
            );
          } else if (mode == "cash") {
            commonData.UpdateCashForPlayInTable(
              tbId,
              players[iter].uid,
              chips,
              "Game Lost",
              function (uChips) {
                commonData.CountHands(
                  players[iter].uid,
                  "lost",
                  gt,
                  bv,
                  false,
                  mode,
                  _ip,
                  round,
                  function (thp, qstWin, hpc) {
                    var tempPlayerData = players[iter];
                    tempPlayerData.wc = -commonClass.RoundInt(cutch, 2);
                    tempPlayerData.pts = pts;
                    tempPlayerData.Chips = uChips;
                    tempPlayerData.gedt = new Date();
                    var upData = {
                      $set: {
                        la: new Date(),
                        "pi.$.wc": -commonClass.RoundInt(cutch, 2),
                        "pi.$.Chips": uChips,
                        "pi.$.pts": pts,
                        "pi.$.thp": thp,
                        "pi.$.hpc": hpc,
                        "pi.$.gedt": new Date(),
                      },
                      $inc: { "pi.$.rl": 1, pv: cutch },
                    };
                    upData["$addToSet"] = { hist: tempPlayerData };

                    commonData.getUserScore(
                      players[iter].uid,
                      bv,
                      gt,
                      function (score) {
                        upData["$set"]["pi.$.score"] = score;
                        db.collection("playing_table").findAndModify(
                          {
                            _id: getInfo.MongoID(tbId),
                            "pi.si": players[iter].si,
                          },
                          {},
                          upData,
                          { new: true },
                          function (err, res) {
                            logger.info(
                              "handleLoser------------>>>>res.value: ",
                              res.value
                            );
                            handleLoser(
                              tbId,
                              players,
                              bv,
                              gt,
                              _ip,
                              mode,
                              round,
                              fnsPlayer,
                              winner,
                              iter + 1
                            );
                          }
                        );
                      }
                    );
                  }
                );
              }
            );
          }
        } else {
          logger.info(
            "handleLoser------------else----else------------->>>>>iter: " + iter
          );
          handleLoser(
            tbId,
            players,
            bv,
            gt,
            _ip,
            mode,
            round,
            fnsPlayer,
            winner,
            iter + 1
          );
        }
      }
    } else {
      logger.info("handleLoser------else------>>>>>iter: " + iter);
      if (mode == "practice") {
        handleWinner(tbId, winner);
      } else if (mode == "cash") {
        handleWinnerCash(tbId, winner);
      }
    }
  } catch (error) {
    logger.error("-----> error handleLoser", error);
    getInfo.exceptionError(error);
  }
  // console.timeEnd("latency timer handleLoser");

};

const handleLoserNew = async (
  tbId,
  players,
  bv,
  gt,
  _ip,
  mode,
  round,
  fnsPlayer,
  winner,
  seatIndex,
  client
) => {
  // console.time("latency timer handleLoserNew");

  try {
    /* +-------------------------------------------------------------------+
      desc:function to handle game loser
      i/p: tbId = table id,players = players details,bv = boot value,gt = game type,fnsPlayer = finish player seat index,winner = winner player seat index,iter = iterator for recursion 
    +-------------------------------------------------------------------+ */

    logger.info("handleLoserNewcall", fnsPlayer, seatIndex);
    let table = await db
      .collection("playing_table")
      .findOne({ _id: getInfo.MongoID(tbId) });

    const { LATE_FINISH_PENALTY_POINTS, MAX_DEADWOOD_PTS } = GetConfig();

    let userList = table.pi.filter(x => x._ir == 0);
    logger.info("socketListUsers ===> userList", userList);

    userList = table.pi.map(x => getInfo.MongoID(x.uid));
    logger.info("socketListUsers ===> table.pi.map", userList);

    let socketListUsers = await db.collection("game_users").distinct("sck", { _id: { $in: userList } });
    logger.info("socketListUsers ===> socketListUsers", socketListUsers);

    const socketList = socketListUsers.map(x => io.sockets.sockets.get(x.split('.')[1]));

    // const socketList = await socketData.getSocketListObject(table._id.toString());

    let wAnimation = false;
    let playerDetail = players.find((x) => x.si == seatIndex);
    logger.info("handleLoser----playerDetail: ", seatIndex, playerDetail);
    if (playerDetail && playerDetail.si == fnsPlayer) {
      logger.info("handleLoserNewcall if finish player", fnsPlayer);

      logger.info(
        "handleLoser----if----->>>>>>>seatIndex: ",
        seatIndex,
        playerDetail
      );
      winner = playerDetail.si;
      wAnimation = true;
      commonData.getUserScore(
        playerDetail.uid,
        table.bv,
        gt,
        async function (score) {
          table.pi[playerDetail.si].score = score;
          await checkWinnerDeclare(table, socketList, winner, wAnimation);
        }
      );
    }
    else if (playerDetail && playerDetail.s == "declare" && playerDetail.si != fnsPlayer) {
      logger.info("handleLoserNewcall if declare player", table._id.toString(), playerDetail.uid);

      logger.info(
        "handleLoser--------else---if------>>>>>>seatIndex: ",
        seatIndex,
        playerDetail
      );

      let chips = 0;
      let pts =
        playerDetail.ps == 0 ? LATE_FINISH_PENALTY_POINTS : playerDetail.ps;

      let pvv = bv * MAX_DEADWOOD_PTS;
      let chp = pvv - pts * bv;
      chips = chp;
      let cutch = pts * bv;
      logger.info('-------chips------->', chips);
      logger.info('-------cutch------->', cutch);
      if (mode == "practice") {
        commonData.UpdateCashForPlayInTable(
          tbId,
          playerDetail.uid,
          chips,
          "Game Lost",
          function (uChips) {
            commonData.CountHands(
              playerDetail.uid,
              "lost",
              gt,
              bv,
              false,
              mode,
              _ip,
              round,
              function (thp, qstWin, hpc) {
                let tempPlayerData = playerDetail;
                tempPlayerData.wc = -commonClass.RoundInt(cutch, 2);
                tempPlayerData.pts = pts;
                tempPlayerData.Chips = uChips;
                tempPlayerData.gedt = new Date();
                let upData = {
                  $set: {
                    la: new Date(),
                    "pi.$.wc": -commonClass.RoundInt(cutch, 2),
                    "pi.$.Chips": uChips,
                    "pi.$.pts": pts,
                    "pi.$.thp": thp,
                    "pi.$.hpc": hpc,
                    "pi.$.gedt": new Date(),
                  },
                  $inc: { "pi.$.rl": 1, pv: cutch },
                };
                upData["$addToSet"] = { hist: tempPlayerData };

                commonData.getUserScore(
                  playerDetail.uid,
                  bv,
                  gt,
                  function (score) {
                    upData["$set"]["pi.$.score"] = score;
                    db.collection("playing_table").findAndModify(
                      {
                        _id: getInfo.MongoID(tbId),
                        "pi.si": playerDetail.si,
                      },
                      {},
                      upData,
                      { new: true },
                      async function (err, res) {
                        logger.info(
                          "handleLoser------------>>>>res.value: ",
                          res.value
                        );
                        table = res.value;
                        await checkWinnerDeclare(
                          table,
                          socketList,
                          winner,
                          wAnimation
                        );
                      }
                    );
                  }
                );
              }
            );
          }
        );
      } else if (mode == "cash") {
        logger.info("handleLoserNewcall if declare player mode", mode);

        commonData.UpdateCashForPlayInTable(
          tbId,
          playerDetail.uid,
          chips,
          "Game Lost",
          async function (uChips) {
            logger.info('---uChips----------->', uChips);
            if (playerDetail._ir == 1 && table.mode == "cash") {
              cutch = commonClass.RoundInt(cutch, 2)
              let obj = {
                uid: getInfo.MongoID(playerDetail.uid),
                tbid: tbId.toString(),
                tjid: table.tjid,
                _ir: playerDetail._ir,
                gameType: table.gt,
                bv: table.bv,
                un: playerDetail.un,
                amount: Math.abs(cutch),
                round: table.round,
                // upc: fChips,
                t: "Game Lost",
                cd: new Date(),
                totalcash: playerDetail.totalCash + uChips
              }
              logger.info('bot_cash_track-----obj-----1------>', obj);
              await db.collection("bot_cash_track").insertOne(obj);
            }

            commonData.CountHands(
              playerDetail.uid,
              "lost",
              gt,
              bv,
              false,
              mode,
              _ip,
              round,
              function (thp, qstWin, hpc) {
                let tempPlayerData = playerDetail;
                tempPlayerData.wc = -commonClass.RoundInt(cutch, 2);
                tempPlayerData.pts = pts;
                tempPlayerData.Chips = uChips;
                tempPlayerData.gedt = new Date();
                let upData = {
                  $set: {
                    la: new Date(),
                    "pi.$.wc": -commonClass.RoundInt(cutch, 2),
                    "pi.$.Chips": uChips,
                    "pi.$.pts": pts,
                    "pi.$.thp": thp,
                    "pi.$.hpc": hpc,
                    "pi.$.gedt": new Date(),
                  },
                  $inc: { "pi.$.rl": 1, pv: cutch },
                };
                upData["$addToSet"] = { hist: tempPlayerData };

                commonData.getUserScore(
                  playerDetail.uid,
                  bv,
                  gt,
                  function (score) {
                    upData["$set"]["pi.$.score"] = score;
                    db.collection("playing_table").findAndModify(
                      {
                        _id: getInfo.MongoID(tbId),
                        "pi.si": playerDetail.si,
                      },
                      {},
                      upData,
                      { new: true },
                      async function (err, res) {
                        logger.info(
                          "handleLoser------------>>>>res.value: ",
                          res.value
                        );
                        table = res.value;

                        logger.info("handleLoserNewcall checkWinnerDeclare", table._id.toString());

                        await checkWinnerDeclare(
                          table,
                          socketList,
                          winner,
                          wAnimation
                        );
                      }
                    );
                  }
                );
              }
            );
          }
        );
      }
    }
  } catch (error) {
    logger.error("-----> error handleLoserNew", error);
    getInfo.exceptionError(error);
  }
  // console.timeEnd("latency timer handleLoserNew");

};

const checkWinnerDeclare = async (
  table,
  socketObjects,
  winner,
  wAnimation,
  direct,
  indecl
) => {
  try {
    for (const element of table.hist) {
      if (element && element.s == "left") {
        table.pi[element.si] = element;
      }
    }
    let playerList = table.pi.filter((item) => item.uid);
    let sendWinEvent = table.pi.filter((user) => user._ir == 0 && user.s != "left").map((user) => user.uid);

    logger.info("checkWinnerDeclare playerList", playerList);
    logger.info("checkWinnerDeclare sendWinEvent", sendWinEvent);

    playerList = cardChange(playerList);

    let playerData = [];
    if (table.gt == "Pool") {
      for (const element of playerList) {
        if (element && element.rndCount == table.round) {
          playerData.push(element);
        }
      }
    }

    // console.log("socketObjects socketObjects", socketObjects);
    logger.info("winner--->", winner);
    // for (const socketClient of socketObjects) {
    // logger.info("send win event to client", table._id.toString());
    // commonClass.SendData(socketClient, "Win", {
    //   tbid: table._id.toString(),
    //   bv: table.bv,
    //   pv: commonClass.RoundInt(table.pv, 2),
    //   wAnimation,
    //   round: table.round,
    //   game_id: table.game_id,
    //   sub_id: table.sub_id,
    //   gt: table.gt,
    //   tst: table.tst,
    //   pi: table.gt == "Pool" ? playerData : playerList,
    //   win: [winner],
    //   wildCard: table.wildCard,
    //   categoryId: table.categoryId,
    // });
    // }
    let updateKey = {
      tbid: table._id.toString(),
      bv: table.bv,
      pv: commonClass.RoundInt(table.pv, 2),
      wAnimation,
      round: table.round,
      game_id: table.game_id,
      sub_id: table.sub_id,
      gt: table.gt,
      tst: table.tst,
      pi: table.gt == "Pool" ? playerData : playerList,
      win: [winner],
      wildCard: table.wildCard,
      categoryId: table.categoryId,
    };
    updateKey = replaceKeyOldToNew(updateKey);
    let dataSend = {
      en: "Win",
      data: updateKey,
    };
    for (const socketClient of sendWinEvent) {
      logger.info("socketClient.uid, dataSend", socketClient, dataSend);
      commonClass.SendDirect(socketClient, dataSend, true);
    }

    let playCount = 0;

    for (let i in table.pi) {
      if (
        table.pi[i] &&
        !_.isEmpty(table.pi[i]) &&
        typeof table.pi[i].s != "undefined" &&
        _.contains(["playing", "finish", "declare"], table.pi[i].s)
      ) {
        playCount++;
      }
    }

    logger.info("table.declCount---->", table.declCount);
    logger.info("---playCount---->", playCount);
    logger.info("direct=----------->", direct);

    if (table.declCount >= playCount || direct) {
      const jobId = `${table.gt}:otherFinishTimer:${table._id.toString()}`;
      await cancelJob(jobId);
      logger.info("------>>>>>playCount:------> " + playCount);
      if (table.gt == "Deal") {
        if (table.round < table.deals) {
          handleRoundWinner(table._id.toString(), winner, direct);
        } else {
          declareDealWinner(table._id.toString(), direct, indecl);
        }
      } else if (table.gt == "Pool") {
        logger.info("------WinnerDeclare---unique--");
        handlePoolWinner(table._id.toString(), winner, direct);
      } else {
        if (table.mode == "practice") {
          handleWinner(table._id.toString(), winner);
        } else if (table.mode == "cash") {
          handleWinnerCash(table._id.toString(), winner);
        }
      }
    }
  } catch (error) {
    logger.error("-----> error checkWinnerDeclare", error);
    getInfo.exceptionError(error);
  }
};

const handleRoundWinner =async (tbId, winner, direct) => {
  // console.time("latency timer handleRoundWinner");

  try {
    /* +-------------------------------------------------------------------+
      desc:function to handle round winner
      i/p: tbId = table id,winner = winner player index,direct = true/false direct winner
    +-------------------------------------------------------------------+ */
    const redisInstances = getRedisInstances();
    const lvt = await redisInstances.SET(`handleRoundWinner:${tbId}`, 1, {
      EX: 3,
      NX: true,
    });
    logger.info("lvt----------------->", lvt);
    if (!lvt) {
      logger.info("in if---", "handleRoundWinner");
      return false;
    }
    getInfo.GetTbInfo(tbId, {}, function (table) {
      if (!table) {
        logger.info(
          'handleRoundWinner----------->>>>>>Error:"table not found"'
        );
        return false;
      }
      logger.info("handleWinner-----------" + table._id + "----------->>>>>>>");
      // jobTimerClass.cancelJobOnServers(tbId, table.jid);
      // clearQueue(tbId.toString());
      var tempPlayerData = table.pi[winner];
      var ctth = "";
      if (direct) {
        if (table.pi[winner].cards.length > 13) {
          ctth = table.pi[winner].cards.pop();
          tempPlayerData.cards = table.pi[winner].cards;
        }
        tempPlayerData.dCards = {
          pure: [],
          seq: [],
          set: [],
          dwd: table.pi[winner].cards,
        };
      }

      tempPlayerData.tdps = table.pi[winner].tdps + table.tpr;
      tempPlayerData.tScore = table.tpr;
      tempPlayerData._iw = 1;
      tempPlayerData.gedt = new Date();
      let upData = {
        $set: {
          la: new Date(),
          ctrlServer: SERVER_ID,
          "pi.$._iw": 1,
          "pi.$.tScore": table.tpr,
          tst: "roundWinnerDeclared",
          ctt: new Date(),
          "pi.$.gedt": new Date(),
        },
        $inc: { "pi.$.tdps": table.tpr },
      };
      if (ctth != "") {
        let gCards;
        if (table.pi[winner].gCards.length > 0) {
          gCards = table.pi[winner].gCards;
          if (gCards.pure.length > 0) {
            let pureCards = gCards.pure;
            logger.info("handlePoolWinner---------->>>>>>gCards: ", pureCards);
            for (let x in pureCards) {
              if (_.contains(pureCards[x], ctth)) {
                pureCards[x] = _.without(pureCards[x], ctth);
                break;
              }
            }
            logger.info("handlePoolWinner------------->>>>>gCards: ", gCards);
            gCards.pure = pureCards;
          } else if (gCards.seq.length > 0) {
            let seqCards = gCards.seq;
            logger.info("handlePoolWinner---------->>>>>>gCards: ", seqCards);
            for (let x in seqCards) {
              if (_.contains(seqCards[x], ctth)) {
                seqCards[x] = _.without(seqCards[x], ctth);
                break;
              }
            }
            logger.info("handlePoolWinner------------->>>>>gCards: ", seqCards);
            gCards.seq = seqCards;
          } else if (gCards.set.length > 0) {
            let setCards = gCards.set;
            logger.info("handlePoolWinner---------->>>>>>gCards: ", setCards);
            for (let x in setCards) {
              if (_.contains(setCards[x], ctth)) {
                setCards[x] = _.without(setCards[x], ctth);
                break;
              }
            }
            logger.info("handlePoolWinner------------->>>>>gCards: ", setCards);
            gCards.seq = setCards;
          } else if (gCards.dwd.length > 0) {
            let dwdCards = gCards.dwd;
            logger.info("handlePoolWinner---------->>>>>>gCards: ", dwdCards);
            for (let x in dwdCards) {
              if (_.contains(dwdCards[x], ctth)) {
                dwdCards[x] = _.without(dwdCards[x], ctth);
                break;
              }
            }
            logger.info("handlePoolWinner------------->>>>>gCards: ", dwdCards);
            gCards.seq = dwdCards;
          }
        } else {
          gCards = table.pi[winner].gCards;
          let dwdCards = table.pi[winner].cards;
          gCards.dwd = dwdCards;
        }
        upData["$set"]["pi.$.cards"] = table.pi[winner].cards;
        upData["$set"]["pi.$.gCards"] = gCards;
        upData["$push"] = { oDeck: ctth };
      }
      upData["$addToSet"] = { hist: tempPlayerData };

      commonData.CountHands(
        table.pi[winner].uid,
        "win",
        table.gt,
        table.bv,
        false,
        table.mode,
        table._ip,
        table.round,
        function (thp, qstWin, hpc) {
          commonData.getUserScore(
            table.pi[winner].uid,
            table.bv,
            table.gt,
            function (score) {
              upData["$set"]["pi.$.score"] = score;
              upData["$set"]["pi.$.thp"] = thp;
              upData["$set"]["pi.$.hpc"] = hpc;
              upData["$inc"]["pi.$.rw"] = 1;

              db.collection("playing_table").findAndModify(
                { _id: getInfo.MongoID(tbId), "pi.si": winner },
                {},
                upData,
                { new: true },
                async function (err, table1) {
                  if (table1.value != null) {
                    var hist = _.clone(table1.value.hist);

                    // for (i = 0; i < hist.length; i++) {
                    //   //sort(bubble sort) the player according to the dps
                    //   for (j = 0; j < hist.length - i - 1; j++) {
                    //     if (hist[j].si > hist[j + 1].si) {
                    //       temp = _.clone(hist[j]);
                    //       hist[j] = _.clone(hist[j + 1]);
                    //       hist[j + 1] = _.clone(temp);
                    //     }
                    //   }
                    // }

                    hist = _.sortBy(hist, (histObj) => histObj.tdps);
                    hist.reverse();

                    hist = _.sortBy(hist, ({ si }) => (si === winner ? 0 : 1));

                    // let testWinArray = [];
                    // let testLossArray = [];
                    // hist.forEach((histObj) => {
                    //   if (histObj._iw === 1) {
                    //     testWinArray.push(histObj);
                    //   } else {
                    //     testLossArray.push(histObj);
                    //   }
                    // });
                    // hist = testWinArray.concat(testLossArray);

                    var game_id = table1.value.game_id;
                    if (
                      table1.value.gt == "Deal" ||
                      table1.value.gt == "Pool"
                    ) {
                      game_id = game_id + "." + table1.value.sub_id;
                    }

                    var dealScore = [];
                    if (table1.value.ms == 2) {
                      dealScore = [{}, {}];
                    } else {
                      dealScore = [{}, {}, {}, {}, {}, {}];
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
                      }

                      if (hist[k]._ir == 1) {
                        rCount++;
                      } else {
                        uCount++;
                      }

                      dealScore[hist[k].si] = {
                        uid: hist[k].uid,
                        un: hist[k].un,
                        dps: hist[k].tScore,
                        tdps: hist[k].tdps,
                        si: hist[k].si,
                        sts: "playing",
                      };
                    }

                    if (rCount > 0 || uCount > 0) {
                      db.collection("win_sts").insertOne({
                        date: new Date(),
                        table_id: table1.value._id.toString(),
                        game_type: table1.value.gt,
                        game_id: game_id,
                        rCount: rCount,
                        uCount: uCount,
                        rSts: rSts,
                        uSts: uSts,
                      });
                    }

                    let ldData = {
                      $set: {
                        tbid: table1.value._id.toString(),
                        round: table1.value.round,
                        game_id: table1.value.game_id,
                        sub_id: table1.value.sub_id,
                        gt: table1.value.gt,
                        tst: table1.value.tst,
                        pi: hist,
                        wildCard: table1.value.wildCard,
                        win: [winner],
                      },
                    };

                    db.collection("last_deal").findAndModify(
                      { tbid: table1.value._id.toString() },
                      {},
                      ldData,
                      { upsert: true, new: true },
                      function (err, table1) { }
                    );
                    var scData = {
                      $set: {
                        tbid: table1.value._id.toString(),
                      },
                      $push: {
                        dealscore: dealScore,
                      },
                    };

                    let isHalfDeclCounter = 0;
                    table1.value.pi.forEach((uObj) => {
                      if (
                        uObj &&
                        uObj.turnCounter === 0 &&
                        uObj.s &&
                        uObj.s !== "drop" &&
                        (typeof direct === "undefined" || direct === false)
                      )
                        isHalfDeclCounter++;
                    });

                    hist = cardChange(hist);
                    commonClass.FireEventToTable(table1.value._id.toString(), {
                      en: "WinnerDeclared",
                      data: {
                        tbid: table1.value._id.toString(),
                        pv: 0,
                        bv: table1.value.bv,
                        round: table1.value.round,
                        game_id: table1.value.game_id,
                        sub_id: table1.value.sub_id,
                        gt: table1.value.gt,
                        tst: table1.value.tst,
                        pi: hist,
                        win: [winner],
                        wildCard: table1.value.wildCard,
                        categoryId: table1.value.categoryId,
                        halfDeclMsg:
                          isHalfDeclCounter >= 1
                            ? "Deal Show - Points of the players who did not get turn will be half"
                            : "",
                      },
                    });
                    hist.forEach((userObj2) => {
                      if (userObj2._iw === 1) {
                        userObj2.tScore = 0;
                        userObj2.dps = 0;
                      } else {
                        userObj2.dps = userObj2.ps;
                      }
                    });
                    let jobId = commonClass.GetRandomString(10);
                    await saveGameHistory(table1.value, hist, winner);
                    // storeTableHistoryForWinner({
                    //   tableId: table1.value._id.toString(),
                    //   eventName: "WinnerDeclared",
                    //   tableData: table1.value,
                    //   playerData: hist,
                    //   winner,
                    // });
                    const { pi, ap } = await checkPlayerAvailability(
                      table1.value
                    );
                    getInfo.UpdateTableData(
                      table1.value._id.toString(),
                      { $set: { jid: jobId, tpr: 0, pi: pi, ap: ap } },
                      function (table2) {
                        if (table2) {
                          // let nxt = commonClass.AddTime(
                          //   1 /*TIMER_NEXT_ROUND_DELAY*/
                          // );
                          // schedule.scheduleJob(
                          //   table2.jid,
                          //   new Date(nxt),
                          //   function () {
                          //     schedule.cancelJob(table2.jid);
                          afterRoundFinish(table2._id.toString());
                          //   }
                          // );
                        } else {
                          logger.info(
                            'handleRoundWinner------------>>>>>Error:"table not found"'
                          );
                        }
                      }
                    );
                  } else {
                    logger.info(
                      'handleRoundWinner-------------->>>>Error:"table not found"'
                    );
                  }
                }
              );
            }
          );
        }
      );
    });
  } catch (error) {
    logger.error("-----> error handleRoundWinner", error);
    getInfo.exceptionError(error);
  }
  // console.timeEnd("latency timer handleRoundWinner");

};

const handleDealWinner = (
  tbId,
  winners,
  winnersTwo,
  pv,
  direct,
  indecl,
  maxDps
) => {
  // console.time("latency timer handleDealWinner");

  try {
    /* +-------------------------------------------------------------------+
      desc:function to handle deal winner
      i/p: tbId = table id,winners = array of winner players seat index,pv = pot value,direct = true/false direct winner or nots
    +-------------------------------------------------------------------+ */
    logger.info(
      "handleDealWinner---------->>>>>>tbId: " +
      tbId +
      " winners" +
      " pv: " +
      pv,
      winners,
      winnersTwo
    );
    getInfo.GetTbInfo(tbId, {}, function (table) {
      if (!table) {
        logger.info(
          'handleDealWinner---------->>>>>>Error:"table not found!!!"'
        );
        return false;
      }
      // jobTimerClass.cancelJobOnServers(tbId, table.jid);
      // clearQueue(tbId.toString());
      var msg = "";
      if (table.ms == 2) {
        var secondprize = 0;
        var prize = pv;
        if (winners.length == 1) {
          //means there is only one winner
          msg = "Game Win";
        } else if (winners.length > 1) {
          //means the game is draw
          msg = "Game Draw";
          prize = Math.round(prize / winners.length);
        }
      } else {
        var prize = pv; //* ((100 - 40) * 0.01);
        var secondprize = pv - prize;
        // if (winnersTwo.length > 1) {
        //   secondprize = secondprize / 2;
        // }else{
        //   prize = pv;
        // }

        if (winners.length == 1) {
          //means there is only one winner
          msg = "Game Win";
        } else if (winners.length > 1) {
          //means the game is draw
          msg = "Game Draw";
          // prize = Math.round(prize / winners.length);
          winnersTwo = [];
        }
      }

      var players = getInfo.getPlayingUserInRound(table.pi);

      // for(var i = 0; i < players.length ;i++){

      // 	if(_.contains(winners,players[i].si)){  //means the winner

      // 		giveWinChips(table._id.toString(),players[i],prize,msg,direct);

      // 	}
      // }
      logger.info("msg-------------->>>>", msg);
      logger.info("winnersTwo-------------->>>>", winnersTwo);
      logger.info("winners-------------->>>>", winners);

      if (msg == "Game Win") {
        if (table.mode == "practice") {
          playingTableClass.giveWinChips(
            table._id.toString(),
            winners,
            winnersTwo,
            players,
            0,
            prize,
            secondprize,
            msg,
            table.bv,
            table.deals,
            table.mode,
            table.round,
            table._ip,
            table.gt,
            direct,
            indecl,
            maxDps
          );
        } else if (table.mode == "cash") {
          giveWinCash(
            table._id.toString(),
            winners,
            winnersTwo,
            players,
            0,
            prize,
            secondprize,
            msg,
            table.bv,
            table.deals,
            table.mode,
            table.round,
            table._ip,
            table.gt,
            direct,
            indecl,
            maxDps
          );
        }
      } else {
        playingTableClass.declareWinnerTie(
          table._id.toString(),
          winners,
          winnersTwo,
          players,
          0,
          prize,
          secondprize,
          msg,
          table.bv,
          table.deals,
          table.mode,
          table.round,
          table._ip,
          table.gt,
          direct
        );
      }
    });
  } catch (error) {
    logger.error("-----> error handleDealWinner", error);
    getInfo.exceptionError(error);
  }
  // console.timeEnd("latency timer handleDealWinner");

};

const handlePoolWinner = async (tbId, winner, direct) => {
  // console.time("latency timer handlePoolWinner");
  try {
    /* +-------------------------------------------------------------------+
      desc:function to handle pool winner
      i/p: tbId = table id,winner = winner player seat index,direct = true/false direct winner or nots
    +-------------------------------------------------------------------+ */
    // getInfo.GetTbInfo(tbId, {}, async function (table) {
      const redisInstances = getRedisInstances();
      const lvt = await redisInstances.SET(`handlePoolWinner:${tbId}`, 1, {
        EX: 3,
        NX: true,
      });
      logger.info("lvt----------------->", lvt);
      if (!lvt) {
        logger.info("in if---", "handlePoolWinner");
        return false;
      }
  
    const { TAX_VALUE, TAX } = GetConfig();

    db.collection("playing_table").findAndModify(
      { _id: getInfo.MongoID(tbId), _isWinner: 0 },
      {},
      { $set: { _isWinner: 1, ctrlServer: SERVER_ID } },
      { new: true },
      async function (err, table) {
        if (
          err ||
          !table ||
          typeof table.value == "undefined" ||
          table.value == null
        ) {
          logger.info(
            'handlePoolWinner---------->>>>>>Error: "table not found"'
          );
          return false;
        }
        table = table.value;
        if (!table) {
          logger.info(
            'handlePoolWinner----------->>>>>>Error:"table not found"'
          );
          return false;
        }
        logger.info(
          "handlePoolWinner-----------" + table._id + "----------->>>>>>>"
        );
        logger.info("--date-------->", new Date());
        // jobTimerClass.cancelJobOnServers(tbId, table.jid);
        // clearQueue(tbId.toString());
        logger.info("table---------------->", table);
        //update table status here check if the winner is roundWinner or final Pool winner
        var players = getInfo.getPlayingUserInGame(table.pi, true);
        logger.info(
          "handlePoolWinner-----------" +
          table._id +
          "-------------->>>>>>players: ",
          players
        );
        var remainingLoser = 0;
        logger.info("table.pt------------>", table.pt, winner);
        for (var k in players) {
          if (
            (players[k].s == "declare" || players[k].s == "drop") &&
            players[k].si != winner &&
            players[k].dps < table.pt /*101*/
          ) {
            //means all the loser having less than 101 score
            remainingLoser++;
          }
        }
        logger.info("remainingLoser-------------->", remainingLoser);
        var tst = "roundWinnerDeclared";
        if (remainingLoser == 0) {
          tst = "winnerDeclared";
        }

        let bv = table.bv;
        let pv = table.pv;
        logger.info("bv------------->", bv, pv);
        // notiClass.winNoti(table.pi[winner],'FRIEND_WON',table.pv); //send notification to winner's friends
        logger.info(
          "handlePoolWinner---------" + table._id + "---------->>>>>tst:",
          tst
        );
        if (tst == "winnerDeclared") {
          //means give chips
          logger.info("handlePoolWinner-----if-------->>>>>>>");
          if (table.mode == "practice") {
            // commonData.UpdateUserChips(table.pi[winner].uid,table.pv,'Game Win',function(uChips){
            commonData.UpdateCashForPlayInTable(
              tbId,
              table.pi[winner].uid,
              table.pv,
              "Game Win",
              function (uChips) {
                var tempPlayerData = table.pi[winner];
                var ctth = "";
                if (direct) {
                  if (table.pi[winner].cards.length > 13) {
                    ctth = table.pi[winner].cards.pop();
                    tempPlayerData.cards = table.pi[winner].cards;
                  }
                  tempPlayerData.dCards = {
                    pure: [],
                    seq: [],
                    set: [],
                    dwd: table.pi[winner].cards,
                  };
                }

                tempPlayerData.wc = commonClass.RoundInt(table.pv, 2);
                tempPlayerData.Chips = uChips;
                tempPlayerData._iw = 1;
                tempPlayerData.gedt = new Date();
                var upData = {
                  $set: {
                    la: new Date(),
                    ctrlServer: SERVER_ID,
                    rndsts: "newgame",
                    "pi.$.wc": commonClass.RoundInt(table.pv, 2),
                    "pi.$.Chips": uChips,
                    "pi.$._iw": 1,
                    tst: tst,
                    ctt: new Date(),
                    "pi.$.gedt": new Date(),
                  },
                  $inc: { winAmount: table.pv },
                };
                if (ctth != "") {
                  if (table.pi[winner].gCards.length > 0) {
                    var gCards = table.pi[winner].gCards;
                    // logger.info('handlePoolWinner---------->>>>>>gCards: ',gCards);
                    // for(var x in gCards){
                    // 	if(_.contains(gCards[x],ctth)){
                    // 		gCards[x] = _.without(gCards[x],ctth);
                    // 		break;
                    // 	}
                    // }
                    // logger.info('handlePoolWinner------------->>>>>gCards: ',gCards);
                    if (gCards.pure.length > 0) {
                      var pureCards = gCards.pure;
                      logger.info(
                        "handlePoolWinner---------->>>>>>gCards: ",
                        pureCards
                      );
                      for (var x in pureCards) {
                        if (_.contains(pureCards[x], ctth)) {
                          pureCards[x] = _.without(pureCards[x], ctth);
                          break;
                        }
                      }
                      logger.info(
                        "handlePoolWinner------------->>>>>gCards: ",
                        gCards
                      );
                      gCards.pure = pureCards;
                    } else if (gCards.seq.length > 0) {
                      var seqCards = gCards.seq;
                      logger.info(
                        "handlePoolWinner---------->>>>>>gCards: ",
                        seqCards
                      );
                      for (var x in seqCards) {
                        if (_.contains(seqCards[x], ctth)) {
                          seqCards[x] = _.without(seqCards[x], ctth);
                          break;
                        }
                      }
                      logger.info(
                        "handlePoolWinner------------->>>>>gCards: ",
                        seqCards
                      );
                      gCards.seq = seqCards;
                    } else if (gCards.set.length > 0) {
                      var setCards = gCards.set;
                      logger.info(
                        "handlePoolWinner---------->>>>>>gCards: ",
                        setCards
                      );
                      for (var x in setCards) {
                        if (_.contains(setCards[x], ctth)) {
                          setCards[x] = _.without(setCards[x], ctth);
                          break;
                        }
                      }
                      logger.info(
                        "handlePoolWinner------------->>>>>gCards: ",
                        setCards
                      );
                      gCards.set = setCards;
                    } else if (gCards.dwd.length > 0) {
                      var dwdCards = gCards.dwd;
                      logger.info(
                        "handlePoolWinner---------->>>>>>gCards: ",
                        dwdCards
                      );
                      for (var x in dwdCards) {
                        if (_.contains(dwdCards[x], ctth)) {
                          dwdCards[x] = _.without(dwdCards[x], ctth);
                          break;
                        }
                      }
                      logger.info(
                        "handlePoolWinner------------->>>>>gCards: ",
                        dwdCards
                      );
                      gCards.dwd = dwdCards;
                    } else {
                    }
                  } else {
                    var gCards = table.pi[winner].gCards;
                    var dwdCards = table.pi[winner].cards;
                    gCards.dwd = dwdCards;
                  }
                  upData["$set"]["pi.$.cards"] = table.pi[winner].cards;
                  upData["$set"]["pi.$.gCards"] = gCards;
                  upData["$push"] = { oDeck: ctth };
                }
                upData["$addToSet"] = { hist: tempPlayerData };

                commonData.CountHands(
                  table.pi[winner].uid,
                  "win",
                  table.gt,
                  table.bv,
                  true,
                  table.mode,
                  table._ip,
                  table.round,
                  function (thp, qstWin, hpc) {
                    commonData.getUserScore(
                      table.pi[winner].uid,
                      table.bv,
                      table.gt,
                      function (score) {
                        upData["$set"]["pi.$.score"] = score;
                        upData["$set"]["pi.$.thp"] = thp;
                        upData["$set"]["pi.$.hpc"] = hpc;
                        upData["$inc"]["pi.$.rw"] = 1;
                        upData.$set._qstWin = qstWin;
                        db.collection("playing_table").findAndModify(
                          { _id: getInfo.MongoID(tbId), "pi.si": winner },
                          {},
                          upData,
                          { new: true },
                          async function (err, table1) {
                            if (table1.value != null) {
                              var hist = _.clone(table1.value.hist);
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

                              var game_id = table1.value.game_id;
                              // var deal_id = table1.value.game_id;
                              if (
                                table1.value.gt == "Deal" ||
                                table1.value.gt == "Pool"
                              ) {
                                game_id = game_id + "." + table1.value.sub_id;
                              }
                              var rCount = 0;
                              var uCount = 0;
                              var rSts = "loss";
                              var uSts = "loss";
                              for (var k in hist) {
                                // if(hist[k]._ir == 0){

                                // var sts = 'loss';
                                if (hist[k]._iw == 1) {
                                  // sts = 'win';

                                  if (hist[k]._ir == 1) {
                                    rSts = "win";
                                  } else {
                                    uSts = "win";
                                  }
                                } else {
                                  hist[k].wc = -commonClass.RoundInt(
                                    table1.value.bv,
                                    2
                                  );
                                }
                              }

                              if (rCount > 0 || uCount > 0) {
                                db.collection("win_sts").insertOne({
                                  date: new Date(),
                                  table_id: table1.value._id.toString(),
                                  game_type: table1.value.gt,
                                  game_id: game_id,
                                  rCount: rCount,
                                  uCount: uCount,
                                  rSts: rSts,
                                  uSts: uSts,
                                });
                              }

                              var ldData = {
                                $set: {
                                  round: table1.value.round,
                                  game_id: table1.value.game_id,
                                  sub_id: table1.value.sub_id,
                                  gt: table1.value.gt,
                                  tst: table1.value.tst,
                                  pi: hist,
                                  wildCard: table1.value.wildCard,
                                  win: [winner],
                                },
                              };

                              db.collection("last_deal").findAndModify(
                                { tbid: table1.value._id.toString() },
                                {},
                                ldData,
                                { upsert: true, new: true },
                                function (err, table1) { }
                              );

                              hist = cardChange(hist);
                              logger.info("hist---->", hist);

                              let playerData1 = [];
                              for (const element of hist) {
                                logger.info(
                                  " element.rndCount == table1.value.round-------->",
                                  element.rndCount == table1.value.round
                                );
                                if (
                                  element &&
                                  // element.s != "left" &&
                                  // element.dps >= table1.value.pt &&
                                  element.rndCount == table1.value.round
                                ) {
                                  playerData1.push(element);
                                }
                              }

                              commonClass.FireEventToTable(
                                table1.value._id.toString(),
                                {
                                  en: "WinnerDeclared",
                                  data: {
                                    tbid: table1.value._id.toString(),
                                    bv: bv,
                                    pv: commonClass.RoundInt(pv, 2),
                                    round: table1.value.round,
                                    game_id: table1.value.game_id,
                                    sub_id: table1.value.sub_id,
                                    gt: table1.value.gt,
                                    tst: table1.value.tst,
                                    pi: playerData1,
                                    win: [winner],
                                    wildCard: table1.value.wildCard,
                                    categoryId: table1.value.categoryId,
                                  },
                                }
                              );

                              // var jobId = commonClass.GetRandomString(10);
                              await saveGameHistory(table1.value, hist, winner);
                              // storeTableHistoryForWinner({
                              //   tableId: table1.value._id.toString(),
                              //   eventName: "WinnerDeclared",
                              //   tableData: table1.value,
                              //   playerData: hist,
                              //   winner,
                              // });
                              // const { pi, ap } = await checkPlayerAvailability(
                              //   table1.value
                              // );
                              // getInfo.UpdateTableData(
                              //   table1.value._id.toString(),
                              //   {
                              //     $set: {
                              //       jid: jobId,
                              //       prize: 0,
                              //       // pi: pi,
                              //       // ap: ap,
                              //     },
                              //   },
                              //   function (table2) {
                              //     if (table2) {
                              //       logger.info(
                              //         "handlePoolWinner------------>>>>>>>"
                              //       );

                              getInfo.UpdateTableData(
                                table1.value._id.toString(),
                                {
                                  $set: {
                                    _isWinner: 0,
                                  },
                                },
                                function (table2) {
                                  afterRoundFinish(table2._id.toString());
                                }
                              );

                              //       // var nxt = commonClass.AddTime(TIMER_NEXT_ROUND_DELAY);
                              //       // schedule.scheduleJob(
                              //       //   table2.jid,
                              //       //   new Date(nxt),
                              //       //   function () {
                              //       //     schedule.cancelJob(table2.jid);
                              //       //     afterRoundFinish(table2._id.toString());
                              //       //   }
                              //       // );
                              //     } else {
                              //       logger.info(
                              //         'handlePoolWinner------------>>>>>Error:"table not found"'
                              //       );
                              //     }
                              //   }
                              // );
                            } else {
                              logger.info(
                                'handlePoolWinner-------------->>>>Error:"table not found"'
                              );
                            }
                          }
                        );
                      }
                    );
                  }
                );
              }
            );
          } else if (table.mode == "cash") {
            const tableName = getTableName(table.gt);
            const lobbyDetail = await db
              .collection(tableName)
              .findOne({ _id: getInfo.MongoID(table.categoryId) });
            let commission = lobbyDetail.commission
              ? lobbyDetail.commission
              : 0;
            let bonusPercentage = lobbyDetail.bonus ? lobbyDetail.bonus : 0;
            logger.info("pv---->", pv);

            let tds =
              commission == 0
                ? 0
                : +((bv * table.total_player_join) / commission).toFixed(2);
            logger.info("tds------->", tds);
            let taxAmount = 0;
            let winAmount = pv - bv;
            // pv = pv - bv;
            logger.info("winAmount------->", winAmount);
            logger.info("TAX_VALUE----->", TAX_VALUE);
            logger.info(
              "winAmount > TAX_VALUE------>",
              winAmount > TAX_VALUE
            );
            let tax;
            // if (winAmount > TAX_VALUE) {
            //   tax = +((winAmount * TAX) / 100).toFixed(2);
            //   taxAmount = tax;
            //   logger.info("taxAmount------>", taxAmount);
            //   pv = pv - tax;
            //   let diff1 = commonClass.GetTimeDifference(table.la, new Date());
            //   let taxdata = {
            //     uid: "admin",
            //     tbid: tbId.toString(),
            //     _ir: 0,
            //     tid: "",
            //     cash: tax,
            //     rid: table.rid,
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
            //     tbid: tbId.toString(),
            //     tjid: table.tjid,
            //     winamount: table.pv,
            //     cmsn: tds,
            //     tds: tax,
            //     transferd: pv,
            //     rid: table.round,
            //     mode: table.mode,
            //     gt: table.gt,
            //     un: table.pi[winner].un,
            //     ue: table.pi[winner].ue,
            //     winid: getInfo.MongoID(table.pi[winner].uid),
            //   };
            //   trackClass.TdsTrack(tdstrack, function (tdstrc) { });
            // }

            logger.info("taxAmount--1----->", taxAmount);
            commonData.UpdateCashForPlayInTable(
              tbId,
              table.pi[winner].uid,
              pv,
              "Game Win",
              async function (uChips) {

                const robotList = table.pi.filter((x) => x._ir == 1 && x.si != winner);
                if (robotList.length > 0) {
                  for (const iterator of robotList) {
                    logger.info('---iterator-------->', iterator);
                    let obj = {
                      uid: getInfo.MongoID(iterator.uid),
                      tbid: tbId.toString(),
                      tjid: table.tjid,
                      _ir: iterator._ir,
                      gameType: table.gt,
                      bv: table.bv,
                      un: iterator.un,
                      amount: bv,
                      round: table.round,
                      // upc: fChips,
                      t: "Game Lost",
                      cd: new Date(),
                      totalcash: iterator.totalCash
                    }
                    logger.info('bot_cash_track-----obj-----2------>', obj);
                    await db.collection("bot_cash_track").insertOne(obj);
                  }
                }

                if (table.pi[winner]._ir == 1 && table.mode == "cash") {
                  let obj = {
                    uid: getInfo.MongoID(table.pi[winner].uid),
                    tbid: tbId.toString(),
                    tjid: table.tjid,
                    _ir: table.pi[winner]._ir,
                    gameType: table.gt,
                    bv: table.bv,
                    un: table.pi[winner].un,
                    amount: pv - table.bv,
                    round: table.round,
                    // upc: fChips,
                    t: "Game Win",
                    cd: new Date(),
                    totalcash: table.pi[winner].totalCash + pv
                  }
                  logger.info('bot_cash_track-----obj-----3------>', obj);
                  await db.collection("bot_cash_track").insertOne(obj);
                }

                // _ir=1 && _winner == 0

                logger.info("uChips----------------->", uChips);
                if (typeof table.tdsid != "undefined" && table.tdsid != "") {
                  db.collection("tds_track").updateOne(
                    { _id: getInfo.MongoID(table.tdsid) },
                    {
                      $set: {
                        tjid: table.tjid,
                        winid: getInfo.MongoID(table.pi[winner].uid),
                        un: table.pi[winner].un,
                        ue: table.pi[winner].ue,
                      },
                    },
                    function (err1, resSts) { }
                  );
                }

                var tempPlayerData = table.pi[winner];
                var ctth = "";
                logger.info("ctth------------------->", ctth);
                logger.info("direct----------->", direct);
                if (direct) {

                  if (table.pi[winner].cards.length > 13) {
                    ctth = table.pi[winner].cards.pop();
                    tempPlayerData.cards = table.pi[winner].cards;
                  }
                  tempPlayerData.dCards = {
                    pure: [],
                    seq: [],
                    set: [],
                    dwd: table.pi[winner].cards,
                  };
                }
                logger.info("ctth-----------1-------->", ctth);

                tempPlayerData.wc = pv;
                tempPlayerData.cash = uChips;
                tempPlayerData._iw = 1;
                tempPlayerData.gedt = new Date();
                var upData = {
                  $set: {
                    la: new Date(),
                    ctrlServer: SERVER_ID,
                    rndsts: "newgame",
                    "pi.$.wc": pv,
                    "pi.$.cash": uChips,
                    "pi.$._iw": 1,
                    tst: tst,
                    ctt: new Date(),
                    "pi.$.gedt": new Date(),
                    tds,
                    commission,
                    taxPercent: TAX,
                    bonusPercentage,
                    tax: taxAmount,
                  },
                  $inc: {
                    "pi.$.winAmount": pv,
                  },
                };
                logger.info("updata--------->", upData);
                logger.info("ctth------------->", ctth);
                if (ctth != "") {
                  logger.info("in if------");
                  if (table.pi[winner].gCards.length > 0) {
                    var gCards = table.pi[winner].gCards;
                    if (gCards.pure.length > 0) {
                      var pureCards = gCards.pure;
                      logger.info(
                        "handlePoolWinner---------->>>>>>gCards: ",
                        pureCards
                      );
                      for (var x in pureCards) {
                        if (_.contains(pureCards[x], ctth)) {
                          pureCards[x] = _.without(pureCards[x], ctth);
                          break;
                        }
                      }
                      logger.info(
                        "handlePoolWinner------------->>>>>gCards: ",
                        gCards
                      );
                      gCards.pure = pureCards;
                    } else if (gCards.seq.length > 0) {
                      var seqCards = gCards.seq;
                      logger.info(
                        "handlePoolWinner---------->>>>>>gCards: ",
                        seqCards
                      );
                      for (var x in seqCards) {
                        if (_.contains(seqCards[x], ctth)) {
                          seqCards[x] = _.without(seqCards[x], ctth);
                          break;
                        }
                      }
                      logger.info(
                        "handlePoolWinner------------->>>>>gCards: ",
                        seqCards
                      );
                      gCards.seq = seqCards;
                    } else if (gCards.set.length > 0) {
                      var setCards = gCards.set;
                      logger.info(
                        "handlePoolWinner---------->>>>>>gCards: ",
                        setCards
                      );
                      for (var x in setCards) {
                        if (_.contains(setCards[x], ctth)) {
                          setCards[x] = _.without(setCards[x], ctth);
                          break;
                        }
                      }
                      logger.info(
                        "handlePoolWinner------------->>>>>gCards: ",
                        setCards
                      );
                      gCards.set = setCards;
                    } else if (gCards.dwd.length > 0) {
                      var dwdCards = gCards.dwd;
                      logger.info(
                        "handlePoolWinner---------->>>>>>gCards: ",
                        dwdCards
                      );
                      for (var x in dwdCards) {
                        if (_.contains(dwdCards[x], ctth)) {
                          dwdCards[x] = _.without(dwdCards[x], ctth);
                          break;
                        }
                      }
                      logger.info(
                        "handlePoolWinner------------->>>>>gCards: ",
                        dwdCards
                      );
                      gCards.dwd = dwdCards;
                    }
                  } else {
                    var gCards = table.pi[winner].gCards;
                    var dwdCards = table.pi[winner].cards;
                    gCards.dwd = dwdCards;
                  }
                  upData["$set"]["pi.$.cards"] = table.pi[winner].cards;
                  upData["$set"]["pi.$.gCards"] = gCards;
                  upData["$push"] = { oDeck: ctth };
                }
                upData["$addToSet"] = { hist: tempPlayerData };
                logger.info("--------&----------------");
                commonData.CountHands(
                  table.pi[winner].uid,
                  "win",
                  table.gt,
                  table.bv,
                  true,
                  table.mode,
                  table._ip,
                  table.round,
                  function (thp, qstWin, hpc) {
                    logger.info("-------------------->", thp, qstWin, hpc);
                    commonData.getUserScore(
                      table.pi[winner].uid,
                      table.bv,
                      table.gt,
                      function (score) {
                        logger.info("score------------------>", score);
                        upData["$set"]["pi.$.score"] = score;
                        upData["$set"]["pi.$.thp"] = thp;
                        upData["$set"]["pi.$.hpc"] = hpc;
                        upData["$inc"]["pi.$.rw"] = 1;
                        upData.$set._qstWin = qstWin;
                        db.collection("playing_table").findAndModify(
                          { _id: getInfo.MongoID(tbId), "pi.si": winner },
                          {},
                          upData,
                          { new: true },
                          async function (err, table1) {
                            if (table1.value != null) {
                              var hist = _.clone(table1.value.hist);
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

                              var game_id = table1.value.game_id;
                              var deal_id = table1.value.game_id;
                              if (
                                table1.value.gt == "Deal" ||
                                table1.value.gt == "Pool"
                              ) {
                                game_id = game_id + "." + table1.value.sub_id;
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
                                  hist[k].wc = -table1.value.bv;
                                }
                              }

                              if (rCount > 0 || uCount > 0) {
                                db.collection("win_sts").insertOne({
                                  date: new Date(),
                                  table_id: table1.value._id.toString(),
                                  game_type: table1.value.gt,
                                  game_id: game_id,
                                  rCount: rCount,
                                  uCount: uCount,
                                  rSts: rSts,
                                  uSts: uSts,
                                });
                              }

                              var ldData = {
                                $set: {
                                  round: table1.value.round,
                                  game_id: table1.value.game_id,
                                  sub_id: table1.value.sub_id,
                                  gt: table1.value.gt,
                                  tst: table1.value.tst,
                                  pi: hist,
                                  wildCard: table1.value.wildCard,
                                  win: [winner],
                                },
                              };

                              db.collection("last_deal").findAndModify(
                                { tbid: table1.value._id.toString() },
                                {},
                                ldData,
                                { upsert: true, new: true },
                                function (err, rb) { }
                              );

                              var obj = ldData.$set;
                              obj.tbid = table1.value._id.toString();
                              obj.pt = table1.value.pt;
                              obj.ms = table1.value.ms;
                              obj.bv = table1.value.bv;
                              obj.rid = table1.value.rid;
                              // for(k in hist){
                              // 	if(hist[k]._ir == 0){
                              trackClass.userLastPlaying(hist, obj);
                              // 	}
                              // }

                              hist = cardChange(hist);
                              logger.info("hist-------------->", hist);

                              let playerData = [];
                              for (const element of hist) {
                                logger.info(
                                  " element.rndCount == table1.value.round-------->",
                                  element.rndCount == table1.value.round
                                );
                                if (
                                  element &&
                                  // element.s != "left" &&
                                  // element.dps >= table1.value.pt &&
                                  element.rndCount == table1.value.round
                                ) {
                                  playerData.push(element);
                                }
                              }
                              logger.info("playerData---------->", playerData);
                              logger.info(
                                "table1.start_totalap == 2---->",
                                table1.start_totalap == 2
                              );
                              commonClass.FireEventToTable(
                                table1.value._id.toString(),
                                {
                                  en: "WinnerDeclared",
                                  data: {
                                    tbid: table1.value._id.toString(),
                                    bv: bv,
                                    pv: pv,
                                    round: table1.value.round,
                                    game_id: table1.value.game_id,
                                    sub_id: table1.value.sub_id,
                                    gt: table1.value.gt,
                                    tst: table1.value.tst,
                                    pi: playerData,
                                    /* table1.value.start_totalap == 2
                                      ? hist
                                      : playerData, */
                                    win: [winner],
                                    wildCard: table1.value.wildCard,
                                    categoryId: table1.value.categoryId,
                                  },
                                }
                              );

                              // var jobId = commonClass.GetRandomString(10);
                              await saveGameHistory(table1.value, hist, winner);
                              // storeTableHistoryForWinner({
                              //   tableId: table1.value._id.toString(),
                              //   eventName: "WinnerDeclared",
                              //   tableData: table1.value,
                              //   playerData: hist,
                              //   winner,
                              // });
                              // const { pi, ap } = await checkPlayerAvailability(
                              //   table1.value
                              // );
                              // logger.info("-----checkPlayerAvailability------");
                              // getInfo.UpdateTableData(
                              //   table1.value._id.toString(),
                              //   {
                              //     $set: {
                              //       jid: jobId,
                              //       prize: 0,
                              //       pi: pi,
                              //       ap: ap,
                              //     },
                              //   },
                              //   function (table2) {
                              //     if (table2) {
                              //       logger.info(
                              //         "handlePoolWinner------------>>>>>>>"
                              //       );
                              getInfo.UpdateTableData(
                                table1.value._id.toString(),
                                {
                                  $set: {
                                    _isWinner: 0,
                                    rejoinAcceptedUsers: [],
                                  },
                                },
                                function (table2) {
                                  afterRoundFinish(table2._id.toString());
                                }
                              );
                              // afterRoundFinish(table1.value._id.toString());

                              // var nxt = commonClass.AddTime(TIMER_NEXT_ROUND_DELAY);
                              // // nxt = nxt * 10;
                              // logger.info("---nxt------>", nxt);
                              // schedule.scheduleJob(
                              //   table2.jid,
                              //   new Date(nxt),
                              //   function () {
                              //     schedule.cancelJob(table2.jid);
                              //     afterRoundFinish(table2._id.toString());
                              //   }
                              // );
                              //     } else {
                              //       logger.info(
                              //         'handlePoolWinner------------>>>>>Error:"table not found"'
                              //       );
                              //     }
                              //   }
                              // );
                            } else {
                              logger.info(
                                'handlePoolWinner-------------->>>>Error:"table not found"'
                              );
                            }
                          }
                        );
                      }
                    );
                  }
                );
              }
            );
          }
        } else {
          logger.info("handlePoolWinner-------else------->>>>");
          var tempPlayerData = table.pi[winner];
          logger.info("tempPlayerData------------------>", tempPlayerData);
          var ctth = "";
          logger.info("direect---------------->", direct);
          if (direct) {
            if (table.pi[winner].cards.length > 13) {
              ctth = table.pi[winner].cards.pop();
              tempPlayerData.cards = table.pi[winner].cards;
            }
            tempPlayerData.dCards = {
              pure: [],
              seq: [],
              set: [],
              dwd: table.pi[winner].cards,
            };
          }

          tempPlayerData._iw = 1;
          tempPlayerData.gedt = new Date();
          var upData = {
            $set: {
              la: new Date(),
              ctrlServer: SERVER_ID,
              rndsts: "newround",
              "pi.$._iw": 1,
              tst: tst,
              ctt: new Date(),
              "pi.$.gedt": new Date(),
            },
            $inc: {},
          };
          logger.info("ctth------------>", ctth);
          if (ctth != "") {
            if (table.pi[winner].gCards.length > 0) {
              var gCards = table.pi[winner].gCards;
              if (gCards.pure.length > 0) {
                var pureCards = gCards.pure;
                logger.info(
                  "handlePoolWinner---------->>>>>>gCards: ",
                  pureCards
                );
                for (var x in pureCards) {
                  if (_.contains(pureCards[x], ctth)) {
                    pureCards[x] = _.without(pureCards[x], ctth);
                    break;
                  }
                }
                logger.info(
                  "handlePoolWinner------------->>>>>gCards: ",
                  gCards
                );
                gCards.pure = pureCards;
              } else if (gCards.seq.length > 0) {
                var seqCards = gCards.seq;
                logger.info(
                  "handlePoolWinner---------->>>>>>gCards: ",
                  seqCards
                );
                for (var x in seqCards) {
                  if (_.contains(seqCards[x], ctth)) {
                    seqCards[x] = _.without(seqCards[x], ctth);
                    break;
                  }
                }
                logger.info(
                  "handlePoolWinner------------->>>>>gCards: ",
                  seqCards
                );
                gCards.seq = seqCards;
              } else if (gCards.set.length > 0) {
                var setCards = gCards.set;
                logger.info(
                  "handlePoolWinner---------->>>>>>gCards: ",
                  setCards
                );
                for (var x in setCards) {
                  if (_.contains(setCards[x], ctth)) {
                    setCards[x] = _.without(setCards[x], ctth);
                    break;
                  }
                }
                logger.info(
                  "handlePoolWinner------------->>>>>gCards: ",
                  setCards
                );
                gCards.seq = setCards;
              } else if (gCards.dwd.length > 0) {
                var dwdCards = gCards.dwd;
                logger.info(
                  "handlePoolWinner---------->>>>>>gCards: ",
                  dwdCards
                );
                for (var x in dwdCards) {
                  if (_.contains(dwdCards[x], ctth)) {
                    dwdCards[x] = _.without(dwdCards[x], ctth);
                    break;
                  }
                }
                logger.info(
                  "handlePoolWinner------------->>>>>gCards: ",
                  dwdCards
                );
                gCards.seq = dwdCards;
              }
            } else {
              var gCards = table.pi[winner].gCards;
              var dwdCards = table.pi[winner].cards;
              gCards.dwd = dwdCards;
            }
            upData["$set"]["pi.$.cards"] = table.pi[winner].cards;
            upData["$set"]["pi.$.gCards"] = gCards;
            upData["$push"] = { oDeck: ctth };
          }
          upData["$addToSet"] = { hist: tempPlayerData };

          commonData.CountHands(
            table.pi[winner].uid,
            "win",
            table.gt,
            table.bv,
            false,
            table.mode,
            table._ip,
            table.round,
            function (thp, qstWin, hpc) {
              commonData.getUserScore(
                table.pi[winner].uid,
                table.bv,
                table.gt,
                function (score) {
                  logger.info("score----->", score);
                  upData["$set"]["pi.$.score"] = score;
                  upData["$set"]["pi.$.thp"] = thp;
                  upData["$set"]["pi.$.hpc"] = hpc;
                  upData["$inc"]["pi.$.rw"] = 1;

                  db.collection("playing_table").findAndModify(
                    { _id: getInfo.MongoID(tbId), "pi.si": winner },
                    {},
                    upData,
                    { new: true },
                    async function (err, table1) {
                      if (table1.value != null) {
                        var hist = _.clone(table1.value.hist);
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

                        var game_id = table1.value.game_id;
                        if (
                          table1.value.gt == "Deal" ||
                          table1.value.gt == "Pool"
                        ) {
                          game_id = game_id + "." + table1.value.sub_id;
                        }

                        var rCount = 0;
                        var uCount = 0;
                        var rSts = "loss";
                        var uSts = "loss";
                        let wl = [];
                        for (var k in hist) {
                          // if(hist[k]._ir == 0){

                          // var sts = 'loss';
                          if (hist[k]._iw == 1) {
                            // sts = 'win';

                            if (hist[k]._ir == 1) {
                              rSts = "win";
                            } else {
                              uSts = "win";
                            }
                          }
                          // else{
                          // 	sts = 'loss';
                          // }
                          if (hist[k]._ir == 1) {
                            rCount++;
                          } else {
                            uCount++;
                          }
                        }

                        if (rCount > 0 || uCount > 0) {
                          db.collection("win_sts").insertOne({
                            date: new Date(),
                            table_id: table1.value._id.toString(),
                            game_type: table1.value.gt,
                            game_id: game_id,
                            rCount: rCount,
                            uCount: uCount,
                            rSts: rSts,
                            uSts: uSts,
                          });
                        }

                        var ldData = {
                          $set: {
                            tbid: table1.value._id.toString(),
                            round: table1.value.round,
                            game_id: table1.value.game_id,
                            sub_id: table1.value.sub_id,
                            gt: table1.value.gt,
                            tst: table1.value.tst,
                            pi: hist,
                            wildCard: table1.value.wildCard,
                            win: [winner],
                          },
                        };

                        db.collection("last_deal").findAndModify(
                          { tbid: table1.value._id.toString() },
                          {},
                          ldData,
                          { upsert: true, new: true },
                          function (err, table1) { }
                        );

                        hist = cardChange(hist);
                        let playerData = [];
                        for (const element of hist) {
                          logger.info(
                            " element.rndCount == table1.value.round-------->",
                            element.rndCount == table1.value.round
                          );
                          if (
                            element &&
                            // element.s != "left" &&
                            // element.dps >= table1.value.pt &&
                            element.rndCount == table1.value.round
                          ) {
                            playerData.push(element);
                          }
                        }
                        logger.info("hist---------------->", hist);
                        commonClass.FireEventToTable(
                          table1.value._id.toString(),
                          {
                            en: "WinnerDeclared",
                            data: {
                              tbid: table1.value._id.toString(),
                              pv: 0,
                              bv: bv,
                              round: table1.value.round,
                              game_id: table1.value.game_id,
                              sub_id: table1.value.sub_id,
                              gt: table1.value.gt,
                              tst: table1.value.tst,
                              pi: playerData,
                              win: [winner],
                              wildCard: table1.value.wildCard,
                              categoryId: table1.value.categoryId,
                            },
                          }
                        );

                        // var jobId = commonClass.GetRandomString(10);
                        await saveGameHistory(table1.value, hist, winner);
                        // storeTableHistoryForWinner({
                        //   tableId: table1.value._id.toString(),
                        //   eventName: "WinnerDeclared",
                        //   tableData: table1.value,
                        //   playerData: hist,
                        //   winner,
                        // });
                        // const { pi, ap } = await checkPlayerAvailability(
                        //   table1.value
                        // );
                        // getInfo.UpdateTableData(
                        //   table1.value._id.toString(),
                        //   {
                        //     $set: {
                        //       jid: jobId,
                        //       pi: pi,
                        //       ap: ap,
                        //     },
                        //   },
                        //   function (table2) {
                        //     if (table2) {
                        //       logger.info(
                        //         "stuck--handlePoolWinner------else-------->>>>>>next game timmer started: ",
                        //         table2.tst
                        //       );
                        // afterRoundFinish(table1.value._id.toString());
                        getInfo.UpdateTableData(
                          table1.value._id.toString(),
                          {
                            $set: {
                              _isWinner: 0,
                              rejoinAcceptedUsers: [],
                            },
                          },
                          function (table2) {
                            afterRoundFinish(table2._id.toString());
                          }
                        );
                        //       // var nxt = commonClass.AddTime(TIMER_NEXT_ROUND_DELAY);
                        //       // schedule.scheduleJob(
                        //       //   table2.jid,
                        //       //   new Date(nxt),
                        //       //   function () {
                        //       //     logger.info("---H--------");
                        //       //     schedule.cancelJob(table2.jid);
                        //       //     logger.info("---H----END----");

                        //       //     logger.info(
                        //       //       "stuck--handlePoolWinner------------table2._id.toString():",
                        //       //       table2._id.toString()
                        //       //     );
                        //       //     afterRoundFinish(table2._id.toString());
                        //       //   }
                        //       // );
                        //     } else {
                        //       logger.info(
                        //         'stuck--handlePoolWinner-------else----->>>>>Error:"table not found"'
                        //       );
                        //     }
                        //   }
                        // );
                      } else {
                        logger.info(
                          'stuck--handlePoolWinner--------else------>>>>Error:"table not found"'
                        );
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
    // });
  } catch (error) {
    logger.error("-----> error handlePoolWinner", error);
    getInfo.exceptionError(error);
  }
  // console.timeEnd("latency timer handlePoolWinner");
};

const handleWinner = async (tbId, winner /*,pv*/, direct) => {
  // console.time("latency timer handleWinner");
  try {
    //winner = winner player seat index, pv = pot value, direct = direct winner flag
    /* +-------------------------------------------------------------------+
      desc:function to handle clasic/bet winner
      i/p: tbId = table id,winner = winner player seat index,direct = true/false direct winner or nots
    +-------------------------------------------------------------------+ */
    logger.info("handleWinner-------->>>>>winner: ", winner);
    logger.info("handleWinner-------->>>>>tbId: ", tbId);
    const redisInstances = getRedisInstances();
    const lvt = await redisInstances.SET(`handleWinner:${tbId}`, 1, {
      EX: 3,
      NX: true,
    });
    logger.info("lvt----------------->", lvt);
    if (!lvt) {
      logger.info("in if---", "handleWinner");
      return false;
    }
    
    const { TIMER_NEXT_ROUND_DELAY, MAX_DEADWOOD_PTS } = GetConfig();
    // getInfo.GetTbInfo(tbId,{},function(table){
    // getInfo.UpdateTableData(tbId,{},function(table){
    db.collection("playing_table").findAndModify(
      { _id: getInfo.MongoID(tbId), _isWinner: 0 },
      {},
      { $set: { _isWinner: 1, ctrlServer: SERVER_ID } },
      { new: true },
      function (err, table) {
        if (
          err ||
          !table ||
          typeof table.value == "undefined" ||
          table.value == null
        ) {
          logger.info('handleWinner---------->>>>>>Error: "table not found"');
          return false;
        }

        table = table.value;
        logger.info("handleWinner-----starting--->>>>>pi: ", table.pi);
        if (_.isEmpty(table.pi[winner])) {
          logger.info(
            'handleWinner---------->>>>>>Error: "winner is not found in pi"'
          );
          return false;
        }
        let pv = table.pv;
        let bv = table.bv;
        let apv = pv + table.bv * MAX_DEADWOOD_PTS;
        let wid = table.pi[winner].uid.toString();
        logger.info(
          "handleWinner-----------tbid: " +
          table._id +
          "---------->>>>>>>uid: " +
          table.pi[winner].uid
        );
        // jobTimerClass.cancelJobOnServers(tbId, table.jid);
        // clearQueue(tbId.toString());
        commonData.UpdateCashForPlayInTable(
          tbId,
          table.pi[winner].uid,
          apv,
          "Game Win",
          function (uChips) {
            logger.info("handleWinner-------->>>>>uChips: ", uChips);
            let tempPlayerData = table.pi[winner];
            let ctth = "";
            if (direct) {
              if (table.pi[winner].cards.length > 13) {
                ctth = table.pi[winner].cards.pop();
                tempPlayerData.cards = table.pi[winner].cards;
              }
              tempPlayerData.dCards = {
                pure: [],
                seq: [],
                set: [],
                dwd: table.pi[winner].cards,
              };
            }
            tempPlayerData.wc = commonClass.RoundInt(pv, 2);
            tempPlayerData.Chips = uChips;
            tempPlayerData._iw = 1;
            tempPlayerData.gedt = new Date();
            tempPlayerData.winAmount += commonClass.RoundInt(pv, 2);
            let upData = {
              $set: {
                la: new Date(),
                ctrlServer: SERVER_ID,
                "pi.$.wc": commonClass.RoundInt(pv, 2),
                "pi.$.Chips": uChips,
                "pi.$._iw": 1,
                tst: "winnerDeclared",
                ctt: new Date(),
                "pi.$.gedt": new Date(),
              },
              $inc: {
                "pi.$.winAmount": commonClass.RoundInt(pv, 2),
              },
            };

            if (ctth != "") {
              let gCards = table.pi[winner].gCards;

              if (gCards.pure.length > 0) {
                let pureCards = gCards.pure;
                logger.info("handleWinner---------->>>>>>gCards: ", pureCards);
                for (let x in pureCards) {
                  if (_.contains(pureCards[x], ctth)) {
                    pureCards[x] = _.without(pureCards[x], ctth);
                    break;
                  }
                }
                logger.info("handleWinner------------->>>>>gCards: ", gCards);
                gCards.pure = pureCards;
              }

              if (gCards.seq.length > 0) {
                let seqCards = gCards.seq;
                logger.info("handleWinner---------->>>>>>gCards: ", seqCards);
                for (let x in seqCards) {
                  if (_.contains(seqCards[x], ctth)) {
                    seqCards[x] = _.without(seqCards[x], ctth);
                    break;
                  }
                }
                logger.info("handleWinner------------->>>>>gCards: ", seqCards);
                gCards.seq = seqCards;
              }

              if (gCards.set.length > 0) {
                let setCards = gCards.set;
                logger.info("handleWinner---------->>>>>>gCards: ", setCards);
                for (let x in setCards) {
                  if (_.contains(setCards[x], ctth)) {
                    setCards[x] = _.without(setCards[x], ctth);
                    break;
                  }
                }
                logger.info("handleWinner------------->>>>>gCards: ", setCards);
                gCards.set = setCards;
              }

              if (gCards.dwd.length > 0) {
                let dwdCards = gCards.dwd;
                logger.info("handleWinner---------->>>>>>gCards: ", dwdCards);
                for (let x in dwdCards) {
                  if (_.contains(dwdCards[x], ctth)) {
                    dwdCards[x] = _.without(dwdCards[x], ctth);
                    break;
                  }
                }
                logger.info("handleWinner------------->>>>>gCards: ", dwdCards);
                gCards.dwd = dwdCards;
              }

              upData["$set"]["pi.$.cards"] = table.pi[winner].cards;
              upData["$set"]["pi.$.gCards"] = gCards;
              upData["$push"] = { oDeck: ctth };
            }

            for (let k in table.hist) {
              if (table.hist[k].uid == tempPlayerData.uid) {
                upData["$removeFromSet"] = { hist: table.hist[k] };
              }
            }
            upData["$addToSet"] = { hist: tempPlayerData };

            commonData.CountHands(
              table.pi[winner].uid,
              "win",
              table.gt,
              table.bv,
              true,
              table.mode,
              table._ip,
              table.round,
              function (thp, qstWin, hpc) {
                logger.info("handleWinner-------->>>>>thp: ", thp);
                commonData.getUserScore(
                  table.pi[winner].uid,
                  table.bv,
                  table.gt,
                  function (score) {
                    logger.info("handleWinner-------->>>>>score: ", score);
                    upData["$set"]["pi.$.score"] = score;
                    upData["$set"]["pi.$.thp"] = thp;
                    upData["$set"]["pi.$.hpc"] = hpc;
                    upData["$inc"]["pi.$.rw"] = 1;

                    upData.$set._qstWin = qstWin;
                    db.collection("playing_table").findAndModify(
                      { _id: getInfo.MongoID(tbId), "pi.si": winner },
                      {},
                      upData,
                      { upsert: true, new: true },
                      async function (err, table1) {
                        // logger.info('history: ',table1.value.hist);
                        if (table1 != null && table1.value != null) {
                          logger.info(
                            "handleWinner------winner data updated-->>>>>table1"
                          );
                          let hist = _.clone(table1.value.hist);

                          for (i = 0; i < hist.length; i++) {
                            //sort(bubble sort) the player according to the cards points
                            for (j = 0; j < hist.length - i - 1; j++) {
                              if (hist[j].wc < hist[j + 1].wc) {
                                temp = _.clone(hist[j]);
                                hist[j] = _.clone(hist[j + 1]);
                                hist[j + 1] = _.clone(temp);
                              }
                            }
                          }

                          let game_id = table1.value.game_id;
                          if (
                            table1.value.gt == "Deal" ||
                            table1.value.gt == "Pool"
                          ) {
                            game_id = game_id + "." + table1.value.sub_id;
                          }

                          let rCount = 0;
                          let uCount = 0;
                          let rSts = "loss";
                          let uSts = "loss";
                          let wl = [];
                          for (let k in hist) {
                            if (hist[k]._iw == 1) {
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

                            if (
                              wid == hist[k].uid.toString() &&
                              hist[k]._iw != 1
                            ) {
                              logger.info("dont enter in winner list");
                            } else {
                              wl.push(hist[k]);
                            }
                          }

                          logger.info(
                            "handleWinner------winner list-->>>>>wl:",
                            wl
                          );
                          if (rCount > 0 || uCount > 0) {
                            db.collection("win_sts").insertOne({
                              date: new Date(),
                              table_id: table1.value._id.toString(),
                              game_type: table1.value.gt,
                              game_id: game_id,
                              rCount: rCount,
                              uCount: uCount,
                              rSts: rSts,
                              uSts: uSts,
                            });
                          }

                          let ldData = {
                            $set: {
                              pi: wl,
                              wildCard: table1.value.wildCard,
                              win: [winner],
                              round: table1.value.round,
                              game_id: table1.value.game_id,
                              sub_id: table1.value.sub_id,
                              gt: table1.value.gt,
                              tst: table1.value.tst,
                            },
                          };

                          db.collection("last_deal").findAndModify(
                            { tbid: table1.value._id.toString() },
                            {},
                            ldData,
                            { upsert: true, new: true },
                            function (err, tb) { }
                          );
                          logger.info(
                            "handleWinner------winner data updated-->>>>>table1.value._id.toString()",
                            table1.value._id.toString()
                          );

                          wl = cardChange(wl);
                          commonClass.FireEventToTable(
                            table1.value._id.toString(),
                            {
                              en: "WinnerDeclared",
                              data: {
                                tbid: table1.value._id.toString(),
                                bv: bv,
                                pv: commonClass.RoundInt(pv, 2),
                                wAnimation: true,
                                round: table1.value.round,
                                game_id: table1.value.game_id,
                                sub_id: table1.value.sub_id,
                                gt: table1.value.gt,
                                tst: table1.value.tst,
                                pi: wl,
                                win: [winner],
                                wildCard: table1.value.wildCard,
                                categoryId: table1.value.categoryId,
                              },
                            }
                          );

                          let jobId = commonClass.GetRandomString(10);
                          await saveGameHistory(table1.value, hist, winner);
                          // storeTableHistoryForWinner({
                          //   tableId: table1.value._id.toString(),
                          //   eventName: "WinnerDeclared",
                          //   tableData: table1.value,
                          //   playerData: hist,
                          //   winner,
                          // });
                          const { pi, ap } = await checkPlayerAvailability(
                            table1.value
                          );
                          getInfo.UpdateTableData(
                            table1.value._id.toString(),
                            {
                              $set: {
                                jid: jobId,
                                _isWinner: 0,
                                pi: pi,
                                ap: ap,
                              },
                            },
                            function (table2) {
                              if (table2) {
                                logger.info(
                                  "handleWinner----------1gf--------table2.id: ",
                                  table2._id.toString()
                                );
                                // let nxt = commonClass.AddTime(
                                //   TIMER_NEXT_ROUND_DELAY
                                // );
                                // logger.info(
                                //   "handleWinner----------2gf--------table2.jid: ",
                                //   table2.jid.toString()
                                // );
                                // schedule.scheduleJob(
                                //   table2.jid,
                                //   new Date(nxt),
                                //   function () {
                                //     logger.info(
                                //       "handleWinner----------1gfgf--------table2.jid: ",
                                //       table2.jid.toString()
                                //     );
                                //     schedule.cancelJob(table2.jid);
                                logger.info(
                                  "handleWinner----------2gfgf--------table2.id: ",
                                  table2._id.toString()
                                );
                                afterRoundFinish(table2._id.toString());
                                //   }
                                // );
                              } else {
                                logger.info(
                                  'handleWinner:::::::::::::::Error:"table not found"'
                                );
                              }
                            }
                          );
                        } else {
                          logger.info(
                            "handleWinner-------" +
                            tbId +
                            "------->>>>>>winner data not updated "
                          );
                          let upData2 = {
                            $set: {
                              la: new Date(),
                              ctrlServer: SERVER_ID,
                              tst: "winnerDeclared",
                              ctt: new Date(),
                            },
                          };
                          if (ctth != "") {
                            upData2["$push"] = { oDeck: ctth };
                          }

                          for (let k in table.hist) {
                            if (table.hist[k].uid == tempPlayerData.uid) {
                              upData2["$removeFromSet"] = {
                                hist: table.hist[k],
                              };
                            }
                          }

                          upData2["$addToSet"] = { hist: tempPlayerData };
                          db.collection("playing_table").findAndModify(
                            { _id: getInfo.MongoID(tbId) },
                            {},
                            upData2,
                            { upsert: true, new: true },
                            async function (err, table2) {
                              // logger.info('history: ',table2.value.hist);
                              if (table2 != null && table2.value != null) {
                                logger.info(
                                  "handleWinner------hist-->>>>>table2",
                                  table2.value.hist.length
                                );
                                let hist = _.clone(table2.value.hist);

                                for (i = 0; i < hist.length; i++) {
                                  //sort(bubble sort) the player according to the cards points
                                  for (j = 0; j < hist.length - i - 1; j++) {
                                    if (hist[j].wc < hist[j + 1].wc) {
                                      temp = _.clone(hist[j]);
                                      hist[j] = _.clone(hist[j + 1]);
                                      hist[j + 1] = _.clone(temp);
                                    }
                                  }
                                }

                                let game_id = table2.value.game_id;
                                if (
                                  table2.value.gt == "Deal" ||
                                  table2.value.gt == "Pool"
                                ) {
                                  game_id = game_id + "." + table2.value.sub_id;
                                }

                                let rCount = 0;
                                let uCount = 0;
                                let rSts = "loss";
                                let uSts = "loss";
                                let wl = [];
                                for (let k in hist) {
                                  let sts = "loss";
                                  if (hist[k]._iw == 1) {
                                    sts = "win";
                                    if (hist[k]._ir == 1) {
                                      rSts = "win";
                                    } else {
                                      uSts = "win";
                                    }
                                  } else {
                                    sts = "loss";
                                  }
                                  if (hist[k]._ir == 1) {
                                    rCount++;
                                  } else {
                                    uCount++;
                                  }

                                  if (
                                    wid == hist[k].uid.toString() &&
                                    hist[k]._iw != 1
                                  ) {
                                    logger.info("dont enter in winner list");
                                  } else {
                                    logger.info("enter in winner list" + k);
                                    wl.push(hist[k]);
                                  }
                                }

                                if (rCount > 0 || uCount > 0) {
                                  db.collection("win_sts").insertOne({
                                    date: new Date(),
                                    table_id: table2.value._id.toString(),
                                    game_type: table2.value.gt,
                                    game_id: game_id,
                                    rCount: rCount,
                                    uCount: uCount,
                                    rSts: rSts,
                                    uSts: uSts,
                                  });
                                }

                                let ldData = {
                                  $set: {
                                    pi: wl,
                                    wildCard: table2.value.wildCard,
                                    win: [winner],
                                    round: table2.value.round,
                                    game_id: table2.value.game_id,
                                    sub_id: table2.value.sub_id,
                                    gt: table2.value.gt,
                                    tst: table2.value.tst,
                                  },
                                };
                                logger.info(
                                  "handleWinner------winner list-->>>>>wl:",
                                  wl
                                );
                                db.collection("last_deal").findAndModify(
                                  { tbid: table2.value._id.toString() },
                                  {},
                                  ldData,
                                  { upsert: true, new: true },
                                  function (err, tb) { }
                                );
                                logger.info(
                                  "handleWinner------winner data updated-->>>>>table2.value._id.toString()",
                                  table2.value._id.toString()
                                );

                                wl = cardChange(wl);
                                commonClass.FireEventToTable(
                                  table2.value._id.toString(),
                                  {
                                    en: "WinnerDeclared",
                                    data: {
                                      tbid: table2.value._id.toString(),
                                      pv: commonClass.RoundInt(pv, 2),
                                      bv: bv,
                                      wAnimation: false,
                                      round: table2.value.round,
                                      game_id: table2.value.game_id,
                                      sub_id: table2.value.sub_id,
                                      gt: table2.value.gt,
                                      tst: table2.value.tst,
                                      pi: wl,
                                      win: [winner],
                                      wildCard: table2.value.wildCard,
                                      categoryId: table2.value.categoryId,
                                    },
                                  }
                                );

                                let jobId = commonClass.GetRandomString(10);
                                await saveGameHistory(table1.value, hist, winner);
                                // storeTableHistoryForWinner({
                                //   tableId: table1.value._id.toString(),
                                //   eventName: "WinnerDeclared",
                                //   tableData: table1.value,
                                //   playerData: hist,
                                //   winner,
                                // });
                                const { pi, ap } =
                                  await checkPlayerAvailability(table1.value);
                                getInfo.UpdateTableData(
                                  table2.value._id.toString(),
                                  {
                                    $set: {
                                      jid: jobId,
                                      _isWinner: 0,
                                      pi: pi,
                                      ap: ap,
                                    },
                                  },
                                  function (table3) {
                                    if (table3) {
                                      logger.info(
                                        "handleWinner----------1--------table3.id: ",
                                        table3._id.toString()
                                      );
                                      // let nxt = commonClass.AddTime(
                                      //   TIMER_NEXT_ROUND_DELAY
                                      // );
                                      // schedule.scheduleJob(
                                      //   table3.jid,
                                      //   new Date(nxt),
                                      //   function () {
                                      //     schedule.cancelJob(table3.jid);
                                      //     logger.info(
                                      //       "handleWinner---------2---------table3.id: ",
                                      //       table3._id.toString()
                                      //     );
                                      afterRoundFinish(table3._id.toString());
                                      //   }
                                      // );
                                    } else {
                                      logger.info(
                                        'handleWinner::::::::444444444:::::::Error:"table not found"'
                                      );
                                    }
                                  }
                                );
                              } else {
                                logger.info(
                                  "handleWinner-------" +
                                  tbId +
                                  "------->>>>>>winner data not updated 1"
                                );
                              }
                            }
                          );
                        }
                      }
                    );
                  }
                );
              }
            );
          }
        );
      }
    );
  } catch (error) {
    logger.error("-----> error handleWinner", error);
    getInfo.exceptionError(error);
  }
  // console.timeEnd("latency timer handleWinner");
};

const handleWinnerCash = async (tbId, winner, direct) => {
  // console.time("latency timer handleWinnerCash");
  try {
    /* +-------------------------------------------------------------------+
    desc:function to handle clasic/bet winner
    i/p: tbId = table id,winner = winner player seat index,direct = true/false direct winner or nots
  +-------------------------------------------------------------------+ */
    logger.info("handleWinnerCash-------->>>>>winner: ", winner);
    const redisInstances = getRedisInstances();
    const lvt = await redisInstances.SET(`handleWinnerCash:${tbId}`, 1, {
      EX: 3,
      NX: true,
    });
    logger.info("lvt----------------->", lvt);
    if (!lvt) {
      logger.info("in if---", "handleWinnerCash");
      return false;
    }
    const { MAX_DEADWOOD_PTS, TAX_VALUE, TAX, TIMER_NEXT_ROUND_DELAY } = GetConfig();
    db.collection("playing_table").findAndModify(
      { _id: getInfo.MongoID(tbId), _isWinner: 0 },
      {},
      { $set: { _isWinner: 1, ctrlServer: SERVER_ID } },
      { new: true },
      async function (err, table) {
        if (
          err ||
          !table ||
          typeof table.value == "undefined" ||
          table.value == null
        ) {
          logger.info(
            'handleWinnerCash---------->>>>>>Error: "table not found"'
          );
          return false;
        }
        table = table.value;
        logger.info('-------table--------->', table);
        logger.info("handleWinnerCash-----starting--->>>>>pi: ", table.pi);
        if (_.isEmpty(table.pi[winner])) {
          logger.info(
            'handleWinnerCash---------->>>>>>Error: "winner is not found in pi"'
          );
          return false;
        }
        const tableName = getTableName(table.gt);
        const lobbyDetail = await db
          .collection(tableName)
          .findOne({ _id: getInfo.MongoID(table.categoryId) });
        let bv = table.bv;
        let pv = table.pv;
        let commission = lobbyDetail.commission ? lobbyDetail.commission : 0;
        let bonusPercentage = lobbyDetail.bonus ?? 0;
        let tds = +((pv * commission) / 100).toFixed(2);
        logger.info("tds------->", tds);
        let taxAmount = 0;
        logger.info('---pv--------->', pv);
        pv = pv - tds;
        // if (pv > TAX_VALUE) {
        //   let tax = +((pv * TAX) / 100).toFixed(2);
        //   taxAmount = tax;
        //   pv = pv - tax;
        //   let diff1 = commonClass.GetTimeDifference(table.la, new Date());
        //   let taxdata = {
        //     uid: "admin",
        //     tbid: tbId.toString(),
        //     _ir: 0,
        //     tid: "",
        //     cash: tax,
        //     rid: table.rid,
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
        //     tbid: tbId.toString(),
        //     tjid: table.tjid,
        //     winamount: table.pv,
        //     cmsn: tds,
        //     tds: tax,
        //     transferd: pv,
        //     rid: table.rid,
        //     mode: table.mode,
        //     gt: table.gt,
        //     un: table.pi[winner].un,
        //     ue: table.pi[winner].ue,
        //     winid: getInfo.MongoID(table.pi[winner].uid),
        //   };
        //   trackClass.TdsTrack(tdstrack, function (tdstrc) { });
        // }
        let apv = pv + table.bv * MAX_DEADWOOD_PTS;

        logger.info(
          "handleWinnerCash-----------tbid: " +
          table._id +
          "---------->>>>>>>uid: " +
          table.pi[winner].uid
        );
        // jobTimerClass.cancelJobOnServers(tbId, table.jid);
        // clearQueue(tbId.toString());
        let wid = table.pi[winner].uid.toString();
        let diff = commonClass.GetTimeDifference(table.la, new Date());
        let obj = {
          uid: "admin",
          tbid: tbId.toString(),
          tid: "",
          _ir: 0,
          cash: tds,
          rid: table.rid,
          mode: table.mode,
          gt: table.gt,
          trkid: table.tjid,
          diff: diff,
          commission,
          bonusPercentage,
          t: "tax from winamount",
        };
        logger.info("handleWinnerCash-->>>obj: ", obj);
        trackClass.PlayTrack(obj, function (data) {
          if (data) {
            commonData.UpdateCashForPlayInTable(
              tbId,
              table.pi[winner].uid,
              apv,
              "Game Win",
              async function (uChips) {

                //bot_track
                logger.info('----pv------>', pv);
                logger.info('--------table.pi[winner]---------->', table.pi[winner]);
                if (table.pi[winner]._ir == 1 && table.mode == "cash") {
                  let obj = {
                    uid: getInfo.MongoID(table.pi[winner].uid),
                    tbid: tbId.toString(),
                    tjid: table.tjid,
                    _ir: table.pi[winner]._ir,
                    gameType: table.gt,
                    bv: table.bv,
                    un: table.pi[winner].un,
                    amount: Math.abs(pv),
                    round: table.round,
                    // upc: fChips,
                    t: "Game Win",
                    cd: new Date(),
                    totalcash: table.pi[winner].totalCash + uChips
                  }
                  logger.info('bot_cash_track-----obj-----4------>', obj);
                  await db.collection("bot_cash_track").insertOne(obj);
                }
                logger.info(
                  "handleWinnerCash---------------------uChips:" + uChips
                );
                let tempPlayerData = table.pi[winner];
                let ctth = "";
                if (direct) {
                  if (table.pi[winner].cards.length > 13) {
                    ctth = table.pi[winner].cards.pop();
                    tempPlayerData.cards = table.pi[winner].cards;
                  }
                  tempPlayerData.dCards = {
                    pure: [],
                    seq: [],
                    set: [],
                    dwd: table.pi[winner].cards,
                  };
                }
                tempPlayerData.wc = commonClass.RoundInt(pv, 2);
                tempPlayerData.Chips = uChips;
                tempPlayerData._iw = 1;
                tempPlayerData.gedt = new Date();
                let upData = {
                  $set: {
                    la: new Date(),
                    ctrlServer: SERVER_ID,
                    "pi.$.wc": commonClass.RoundInt(pv, 2),
                    "pi.$.Chips": uChips,
                    "pi.$._iw": 1,
                    tst: "winnerDeclared",
                    ctt: new Date(),
                    "pi.$.gedt": new Date(),
                    tds,
                    commission,
                    bonusPercentage,
                    taxPercent: TAX,
                    tax: taxAmount,
                  },
                  $inc: { "pi.$.winAmount": pv },
                };
                if (ctth != "") {
                  let gCards = table.pi[winner].gCards;

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

                  upData["$set"]["pi.$.cards"] = table.pi[winner].cards;
                  upData["$set"]["pi.$.gCards"] = gCards;
                  upData["$push"] = { oDeck: ctth };
                }
                upData["$addToSet"] = { hist: tempPlayerData };

                commonData.CountHands(
                  table.pi[winner].uid,
                  "win",
                  table.gt,
                  table.bv,
                  true,
                  table.mode,
                  table._ip,
                  table.round,
                  function (thp, qstWin, hpc) {
                    commonData.getUserScore(
                      table.pi[winner].uid,
                      table.bv,
                      table.gt,
                      function (score) {
                        upData["$set"]["pi.$.score"] = score;
                        upData["$set"]["pi.$.thp"] = thp;
                        upData["$set"]["pi.$.hpc"] = hpc;
                        upData["$inc"]["pi.$.rw"] = 1;

                        upData.$set._qstWin = qstWin;
                        db.collection("playing_table").findAndModify(
                          { _id: getInfo.MongoID(tbId), "pi.si": winner },
                          {},
                          upData,
                          { new: true },
                          async function (err, table1) {
                            if (table1.value != null) {
                              let hist = _.clone(table1.value.hist);

                              for (i = 0; i < hist.length; i++) {
                                for (j = 0; j < hist.length - i - 1; j++) {
                                  if (hist[j].wc < hist[j + 1].wc) {
                                    temp = _.clone(hist[j]);
                                    hist[j] = _.clone(hist[j + 1]);
                                    hist[j + 1] = _.clone(temp);
                                  }
                                }
                              }

                              let game_id = table1.value.game_id;
                              if (
                                table1.value.gt == "Deal" ||
                                table1.value.gt == "Pool"
                              ) {
                                game_id = game_id + "." + table1.value.sub_id;
                              }

                              let rCount = 0;
                              let uCount = 0;
                              let rSts = "loss";
                              let uSts = "loss";
                              let wl = [];
                              for (let k in hist) {
                                if (hist[k]._iw == 1) {
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

                                if (
                                  wid == hist[k].uid.toString() &&
                                  hist[k]._iw != 1
                                ) {
                                  logger.info("dont enter in winner list");
                                } else {
                                  wl.push(hist[k]);
                                }
                              }

                              if (rCount > 0 || uCount > 0) {
                                db.collection("win_sts").insertOne({
                                  date: new Date(),
                                  table_id: table1.value._id.toString(),
                                  game_type: table1.value.gt,
                                  game_id: game_id,
                                  rCount: rCount,
                                  uCount: uCount,
                                  rSts: rSts,
                                  uSts: uSts,
                                });
                              }

                              let ldData = {
                                $set: {
                                  pi: wl,
                                  wildCard: table1.value.wildCard,
                                  win: [winner],
                                  round: table1.value.round,
                                  game_id: table1.value.game_id,
                                  sub_id: table1.value.sub_id,
                                  gt: table1.value.gt,
                                  tst: table1.value.tst,
                                },
                              };

                              logger.info(
                                "handleWinnerCash------------->>>>>gCards: ",
                                ldData
                              );
                              db.collection("last_deal").findAndModify(
                                { tbid: table1.value._id.toString() },
                                {},
                                ldData,
                                { upsert: true, new: true },
                                function (err, tbd) { }
                              );

                              let obj = ldData.$set;
                              obj.tbid = table1.value._id.toString();
                              obj.pt = table1.value.pt;
                              obj.ms = table1.value.ms;
                              obj.bv = table1.value.bv;
                              obj.rid = table1.value.rid;

                              trackClass.userLastPlaying(wl, obj);

                              wl = cardChange(wl);
                              commonClass.FireEventToTable(
                                table1.value._id.toString(),
                                {
                                  en: "WinnerDeclared",
                                  data: {
                                    tbid: table1.value._id.toString(),
                                    bv: bv,
                                    pv: commonClass.RoundInt(pv, 2),
                                    wAnimation: true,
                                    round: table1.value.round,
                                    game_id: table1.value.game_id,
                                    sub_id: table1.value.sub_id,
                                    gt: table1.value.gt,
                                    tst: table1.value.tst,
                                    pi: wl,
                                    win: [winner],
                                    wildCard: table1.value.wildCard,
                                    categoryId: table1.value.categoryId,
                                  },
                                }
                              );

                              let jobId = commonClass.GetRandomString(10);
                              await saveGameHistory(table1.value, hist, winner);
                              // storeTableHistoryForWinner({
                              //   tableId: table1.value._id.toString(),
                              //   eventName: "WinnerDeclared",
                              //   tableData: table1.value,
                              //   playerData: hist,
                              //   winner,
                              // });
                              const { pi, ap } = await checkPlayerAvailability(
                                table1.value
                              );
                              getInfo.UpdateTableData(
                                table1.value._id.toString(),
                                {
                                  $set: {
                                    jid: jobId,
                                    _isWinner: 0,
                                    pi: pi,
                                    ap: ap,
                                  },
                                },
                                function (table2) {
                                  if (table2) {
                                    // let nxt = commonClass.AddTime(TIMER_NEXT_ROUND_DELAY);
                                    // schedule.scheduleJob(
                                    //   table2.jid,
                                    //   new Date(nxt),
                                    //   function () {
                                    //     schedule.cancelJob(table2.jid);
                                    afterRoundFinish(table2._id.toString());
                                    //   }
                                    // );
                                  } else {
                                    logger.info(
                                      'handleWinnerCash:::::::::::::::Error:"table not found"'
                                    );
                                  }
                                }
                              );
                            } else {
                              logger.info(
                                "handleWinnerCash-------" +
                                tbId +
                                "------->>>>>>winner data not updated "
                              );
                              let upData2 = {
                                $set: {
                                  la: new Date(),
                                  ctrlServer: SERVER_ID,
                                  tst: "winnerDeclared",
                                  ctt: new Date(),
                                },
                              };
                              if (ctth != "") {
                                upData2["$push"] = { oDeck: ctth };
                              }
                              upData2["$addToSet"] = { hist: tempPlayerData };
                              db.collection("playing_table").findAndModify(
                                { _id: getInfo.MongoID(tbId) },
                                {},
                                upData2,
                                { upsert: true, new: true },
                                async function (err, table2) {
                                  // logger.info('history: ',table2.value.hist);
                                  if (table2 != null && table2.value != null) {
                                    logger.info(
                                      "handleWinnerCash------winner data updated-->>>>>table2"
                                    );
                                    let hist = _.clone(table2.value.hist);

                                    for (i = 0; i < hist.length; i++) {
                                      //sort(bubble sort) the player according to the cards points
                                      for (
                                        j = 0;
                                        j < hist.length - i - 1;
                                        j++
                                      ) {
                                        if (hist[j].wc < hist[j + 1].wc) {
                                          temp = _.clone(hist[j]);
                                          hist[j] = _.clone(hist[j + 1]);
                                          hist[j + 1] = _.clone(temp);
                                        }
                                      }
                                    }

                                    let game_id = table2.value.game_id;
                                    if (
                                      table2.value.gt == "Deal" ||
                                      table2.value.gt == "Pool"
                                    ) {
                                      game_id =
                                        game_id + "." + table2.value.sub_id;
                                    }

                                    let rCount = 0;
                                    let uCount = 0;
                                    let rSts = "loss";
                                    let uSts = "loss";
                                    let wl = [];
                                    for (let k in hist) {
                                      if (hist[k]._iw == 1) {
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

                                      if (
                                        wid == hist[k].uid.toString() &&
                                        hist[k]._iw != 1
                                      ) {
                                        logger.info(
                                          "dont enter in winner list"
                                        );
                                      } else {
                                        wl.push(hist[k]);
                                      }
                                    }

                                    if (rCount > 0 || uCount > 0) {
                                      db.collection("win_sts").insertOne({
                                        date: new Date(),
                                        table_id: table2.value._id.toString(),
                                        game_type: table2.value.gt,
                                        game_id: game_id,
                                        rCount: rCount,
                                        uCount: uCount,
                                        rSts: rSts,
                                        uSts: uSts,
                                      });
                                    }

                                    let ldData = {
                                      $set: {
                                        pi: wl,
                                        wildCard: table2.value.wildCard,
                                        win: [winner],
                                        round: table2.value.round,
                                        game_id: table2.value.game_id,
                                        sub_id: table2.value.sub_id,
                                        gt: table2.value.gt,
                                        tst: table2.value.tst,
                                      },
                                    };

                                    db.collection("last_deal").findAndModify(
                                      { tbid: table2.value._id.toString() },
                                      {},
                                      ldData,
                                      { upsert: true, new: true },
                                      function (err, tb) { }
                                    );

                                    let obj = ldData.$set;
                                    obj.tbid = table2.value._id.toString();
                                    obj.pt = table2.value.pt;
                                    obj.bv = table2.value.bv;
                                    obj.ms = table2.value.ms;
                                    obj.rid = table2.value.rid;

                                    trackClass.userLastPlaying(wl, obj);

                                    logger.info(
                                      "handleWinnerCash------winner data updated-->>>>>table2.value._id.toString()",
                                      table2.value._id.toString()
                                    );
                                    commonClass.FireEventToTable(
                                      table2.value._id.toString(),
                                      {
                                        en: "WinnerDeclared",
                                        data: {
                                          tbid: table2.value._id.toString(),
                                          bv: bv,
                                          pv: commonClass.RoundInt(pv, 2),
                                          wAnimation: false,
                                          round: table2.value.round,
                                          game_id: table2.value.game_id,
                                          sub_id: table2.value.sub_id,
                                          gt: table2.value.gt,
                                          tst: table2.value.tst,
                                          pi: wl,
                                          win: [winner],
                                          wildCard: table2.value.wildCard,
                                          categoryId: table2.value.categoryId,
                                        },
                                      }
                                    );

                                    let jobId = commonClass.GetRandomString(10);
                                    await saveGameHistory(table2.value, hist, winner);
                                    // storeTableHistoryForWinner({
                                    //   tableId: table1.value._id.toString(),
                                    //   eventName: "WinnerDeclared",
                                    //   tableData: table1.value,
                                    //   playerData: hist,
                                    //   winner,
                                    // });
                                    logger.info("table2.value  ----> ", table2);
                                    logger.info(
                                      "table2.value  ----> ",
                                      table2.value
                                    );
                                    const { pi, ap } =
                                      await checkPlayerAvailability(
                                        table2.value
                                      );
                                    getInfo.UpdateTableData(
                                      table2.value._id.toString(),
                                      {
                                        $set: {
                                          jid: jobId,
                                          _isWinner: 0,
                                          pi: pi,
                                          ap: ap,
                                        },
                                      },
                                      function (table3) {
                                        if (table3) {
                                          // let nxt = commonClass.AddTime(
                                          //   TIMER_NEXT_ROUND_DELAY
                                          // );
                                          // schedule.scheduleJob(
                                          //   table3.jid,
                                          //   new Date(nxt),
                                          //   function () {
                                          //     schedule.cancelJob(table3.jid);
                                          afterRoundFinish(table3._id.toString());
                                          //   }
                                          // );
                                        } else {
                                          logger.info(
                                            'handleWinnerCash:::::::::::::::Error:"table not found"'
                                          );
                                        }
                                      }
                                    );
                                  } else {
                                    logger.info(
                                      "handleWinnerCash-------" +
                                      tbId +
                                      "------->>>>>>winner data not updated 1"
                                    );
                                  }
                                }
                              );
                            }
                          }
                        );
                      }
                    );
                  }
                );
              }
            );
          }
        });
      }
    );
  } catch (error) {
    logger.error("-----> error handleWinnerCash", error);
    getInfo.exceptionError(error);
  }
  // console.timeEnd("latency timer handleWinnerCash");
};

const afterRoundFinish = (tbId) => {
  // console.time("latency timer afterRoundFinish");
  try {
    /* +-------------------------------------------------------------------+
      desc:function to handle table after game completes
      i/p: tbId = table id
    +-------------------------------------------------------------------+ */
    logger.info(
      "stuck--<<<<------------afterRoundFinish-------->>>>>tbId: ",
      tbId
    );
    const redisInstances = getRedisInstances();

    const { TIMER_REMATCH, SECONDARY_TIMER } = GetConfig();
    getInfo.GetTbInfo(
      tbId,
      {
        pi: 1,
        bv: 1,
        bbv: 1,
        stdP: 1,
        gt: 1,
        ap: 1,
        ms: 1,
        deals: 1,
        round: 1,
        tst: 1,
        rSeq: 1,
        game_id: 1,
        pt: 1,
        nrg: 1,
        sub_id: 1,
        spcSi: 1,
        mode: 1,
        categoryId: 1,
        prize: 1,
        oldTableId: 1,
      },
      async function (table) {
        if (!table) {
          return false;
        }
        clearQueue(table._id.toString());
        let players = getInfo.getPlayingUserInRound(table.pi);
        logger.info(
          "stuck--afterRoundFinish--------------" + table._id + "------->>>>>>"
        );

        logger.info("afterRoundFinish-------->>>>players: ", players);
        logger.info("afterRoundFinish-------->>>>stdP: ", table.stdP);
        logger.info("player.length-----------<>", players.length);
        let rCount = 0;
        let uCount = 0;
        // let spc = 0;
        let sii = -1;
        let uidd = "";

        for (let x in players) {
          if (players[x]._ir == 0) {
            await redisInstances.DEL(`userPlayingCards:${tbId.toString()}:${players[x].uid}`);
            uCount++;
            // spc = players[x].spc;
            sii = players[x].si;
            uidd = players[x].uid;
          } else {
            rCount++;
          }
        }
        logger.info(
          "stuck--afterRoundFinish--" + tbId + "---->>>>uCount: ",
          uCount,
          " rCount: ",
          rCount,
          " table.ms: ",
          table.ms
        );
        // logger.info("afterRoundFinish---------->>>>>>>table.stdP.length: "+table.stdP.length)
        if (
          uCount == 0 &&
          rCount >= 0 &&
          typeof table.stdP != "undefined" &&
          table.stdP.length == 0
        ) {
          //means there is no live user exist on table
          // this is fixed for circular dependency problem.
          const robotsClass = require("./robots.class");

          logger.info(
            "stuck--afterRoundFinish----" +
            tbId +
            "------->>>>not sufficient player so table delete"
          );
          robotsClass.removeRobots(table._id.toString());
        } else if (
          typeof table.stdP != "undefined" &&
          table.stdP.length > 0 &&
          table.ms == 2
        ) {
          let single = "";
          let i = 0;
          resp(i);
          function resp(i) {
            if (i < table.stdP.length) {
              leaveTableClass.LeaveTable(
                {
                  /*flag:"auto"*/
                  eliminated: true,
                },
                {
                  leave: 1,
                  id: single,
                  uid: table.stdP[i].uid,
                  _ir: 0,
                  tbid: table._id.toString(),
                },
                function (check) {
                  i++;
                  resp(i);
                }
              );
            } else {
              logger.info(
                "afterRoundFinish-----" +
                tbId +
                "------>>>player on the standup so start game after reset table"
              );
              getInfo.UpdateTableData(
                table._id.toString(),
                {
                  $set: {
                    rSeq: 1,
                    tcnt: 0,
                    maxBet: 0,
                    bv: table.bbv,
                    _isLeave: 0,
                    tst: "",
                    pv: 0,
                    wildCard: "",
                    oDeck: [],
                    declCount: 0,
                    playCount: 0,
                    cDeck: [],
                    turn: -1,
                    fnsPlayer: -1,
                    hist: [],
                    ctt: new Date(),
                  },
                },
                function (table1) {
                  roundClass.initializeGame(table._id.toString());
                }
              );
            }
          }
        } else if (players.length > 0) {
          logger.info(
            "afterRoundFinish---" + tbId + "---else if---->>>>>players: ",
            players.length
          );

          // recalculate table score
          var uScores = [];
          for (var i in table.pi) {
            if (!_.isEmpty(table.pi[i]) && table.pi[i]._ir == 0) {
              uScores.push(table.pi[i].score);
            }
          }

          var tScore = 0;
          if (uScores.length > 1) {
            tScore = commonClass.getMedian(uScores);
          } else {
            tScore = uScores.length == 1 ? uScores[0] : 0;
          }

          logger.info(
            "[Table score recalculated]--------------->>>>>bbv: " + table.bbv
          );
          db.collection("robot_prob")
            .find({ from: { $lte: tScore } })
            .sort({ from: -1 })
            .toArray(function (err, robotType) {
              logger.info(
                "afterRoundFinish---------robot set-------->>>>>>>: ",
                robotType[0]
              );
              var rType = "Newbie";
              if (robotType && robotType.length > 0) {
                var rInt = commonClass.GetRandomInt(0, 100);
                logger.info("afterRoundFinish----------->>>>>>rInt: " + rInt);
                var bound = robotType[0].Newbie;
                if (rInt <= bound) {
                  rType = "Newbie";
                } else if (rInt <= (bound += robotType[0].Amateur)) {
                  rType = "Amateur";
                } else if (rInt <= (bound += robotType[0].Pro)) {
                  rType = "Pro";
                } else if (rInt <= (bound += robotType[0].God)) {
                  rType = "God";
                } else {
                  logger.info("God---!!!--->>>else");
                  rType = "God";
                }
              }
              logger.info(
                "afterRoundFinish-------" + tbId + "----->>>>>>rType: " + rType
              );

              logger.info("[Bot selected]------------->>>>>Robot: " + rType);
              var players1 = getInfo.getPlayingUserInGame(table.pi, true);
              var game_id = table.game_id;

              logger.info(
                "[Bot selected]------------->>>>>table.round: " + table.round
              );
              logger.info(
                "[Bot selected]-----1-------->>>>>table.bbv: " + table.bbv
              );
              logger.info(
                "[Bot selected]------------->>>>>table.deals: " + table.deals
              );

              if (table.gt == "Deal" || table.gt == "Pool") {
                game_id = table.game_id + "." + table.sub_id;
              }
              if (
                (table.gt == "Deal" &&
                  table.round >= table.deals &&
                  table.tst != "winnerDeclaredTie") ||
                table.gt == "Pool" ||
                table.gt == "Points"
              ) {
                logger.info(
                  "afterRoundFinish----" +
                  tbId +
                  "-----else if-if gt: " +
                  table.gt +
                  " round: " +
                  table.round +
                  " bbv: " +
                  table.bbv
                );

                if (table.gt != "Deal") {
                  logger.info(`in----------if---------------`, ` ${table.gt}`);
                  if (table.mode == "cash") {
                    if (
                      table.ms == 4 &&
                      uCount >=
                      config.REMOVE_BOT_FOUR /*|| table.ap > config.MIN_SEAT_TO_FILL_FOUR)*/ &&
                      table.gt != "Pool"
                    ) {
                      logger.info("in-----if------1----------");
                      rType = "noBot";
                    } else if (
                      table.ms == 6 &&
                      uCount >=
                      config.REMOVE_BOT_SIX /*|| table.ap > config.MIN_SEAT_TO_FILL_SIX)*/ &&
                      table.gt != "Pool"
                    ) {
                      logger.info("in-----if------2----------");
                      rType = "noBot";
                    }
                  }

                  logger.info(
                    "afterRoundFinish----------------***********------" +
                    tbId +
                    "-----------------rCount",
                    rCount
                  );
                  logger.info("rCount---------->", rCount);
                  if (table.mode == "practice") {
                    playClass.removeOnLowChips(
                      table._id.toString(),
                      table.bv,
                      table.bbv,
                      table.gt,
                      players,
                      rType,
                      table.tst,
                      table.rSeq,
                      game_id,
                      rCount,
                      table.pt,
                      table.ms,
                      0
                    );
                  } else {
                    playClass.removeOnLowCash(
                      table._id.toString(),
                      table.bv,
                      table.bbv,
                      table.gt,
                      players,
                      rType,
                      table.tst,
                      table.rSeq,
                      game_id,
                      rCount,
                      table.pt,
                      table.ms,
                      0
                    );
                  }
                } else {
                  if (table.ms == 2 && table.ap == 2) {
                    table.pi.map(async (userObject) => {
                      if (!_.isEmpty(userObject) && userObject._ir == 0) {
                        const userInfo_1 = await db
                          .collection("game_users")
                          .findOne(
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
                                Chips: 1,
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
                          totalCashBonus +
                          SignUpBonus +
                          totalReferralBonus +
                          cmsBonus;
                        if (userInfo_1.tbid !== "") {
                          commonClass.SendDirect(
                            userObject.uid,
                            {
                              en: "Rematch",
                              data: {
                                timer: TIMER_REMATCH,
                                lockInTime: 1,
                                rank: userObject._iw === 1 ? 1 : 2,
                                bv: table.bv,
                                mode: table.mode,
                                winPrize:
                                  userObject._iw === 1 ? table.prize : 0,
                                prize: table.prize,
                                totalCash:
                                  table.mode == "cash"
                                    ? userObject._iw === 1
                                      ? userInfo_1.totalcash + table.prize
                                      : userInfo_1.totalcash
                                    : userInfo_1.Chips,
                                bonusCash: totalBonus < 0 ? 0 : totalBonus,
                                message:
                                  userObject._iw === 1
                                    ? "Yeah! you won"
                                    : "Well played. You finished 2nd.",
                                notifyMessage:
                                  "Do you want to request a rematch?",
                                catid: table.categoryId,
                                pt: 0,
                              },
                            },
                            true
                          );
                        }
                      }
                    });
                    // for (var i in table.pi) {
                    //   if (!_.isEmpty(table.pi[i]) && table.pi[i]._ir == 0) {
                    //     if(table.pi[i]._iw === 1){
                    //       commonClass.SendDirect(
                    //         table.pi[i].uid,
                    //         {
                    //           en: "Rematch",
                    //           data: {
                    //             timer: config.TIMER_REMATCH,
                    //             bv: table.bv,
                    //             prize: table.prize,
                    //             winPrize: table.prize,
                    //             totalCash: table.pi[i].totalCash,
                    //             bonusCash: table.pi[i].totalCash,
                    //             message: "Yeah! you won",
                    //             notifyMessage:
                    //               "Do you want to request a rematch?",
                    //             catid: table.categoryId,
                    //             pt: 0,
                    //           },
                    //         },
                    //         true
                    //       );
                    //     }else{
                    //       commonClass.SendDirect(
                    //         table.pi[i].uid,
                    //         {
                    //           en: "Rematch",
                    //           data: {
                    //             timer: config.TIMER_REMATCH,
                    //             bv: table.bv,
                    //             prize: table.prize,
                    //             winPrize: table.prize,
                    //             totalCash: table.pi[i].totalCash,
                    //             bonusCash: table.pi[i].totalCash,
                    //             message: "You loss!",
                    //             notifyMessage:
                    //               "Do you want to request a rematch?",
                    //             catid: table.categoryId,
                    //             pt: 0,
                    //           },
                    //         },
                    //         true
                    //       );
                    //     }

                    //   }
                    // }
                    // commonClass.FireEventToTable(table._id.toString(), {
                    //   en: "Rematch",
                    //   data: {
                    //      timer: config.TIMER_REMATCH,
                    //      bv: table.bv,
                    //      prize: table.prize,
                    //      totalCash:1000,
                    //      bonusCash: 100,
                    //      message: "Yeah! you won",
                    //      notifyMessage: "Do you want to request a rematch?",
                    //      catid: table.categoryId,
                    //      pt:0,
                    //     },
                    // });

                    let jobId = commonClass.GetRandomString(10);
                    getInfo.UpdateTableData(
                      table._id.toString(),
                      {
                        $set: {
                          jid: jobId,
                          ctt: new Date(),
                          tst: "RematchTimerStarted",
                        },
                      },
                      function (table2) {
                        if (table2) {
                          logger.info(
                            "config.TIMER_REMATCH------------->>>>>table.deals: ",
                            TIMER_REMATCH
                          );
                          // let nxt = commonClass.AddTime(TIMER_REMATCH + 1);
                          // schedule.scheduleJob(
                          //   table2.jid,
                          //   new Date(nxt),
                          //   async function () {
                          //     logger.info(
                          //       ".nxt----table2.jid--------->>>>>table.deals: ",
                          //       nxt,
                          //       table,
                          //       table2
                          //     );
                          //     schedule.cancelJob(table2.jid);
                          //     // playAgainFunction(table.pi , 0 ,table.pi.length);
                          //     // async function playAgainFunction(userObject , userObjectIndex ,userObjectLength ) {
                          //     //   logger.info(".nxt----userObjectIndex------->>>>>table.deals: ",userObjectIndex,userObjectLength);
                          //     //   if(userObjectIndex < userObjectLength){
                          //     //     if (
                          //     //       !_.isEmpty(userObject[userObjectIndex]) &&
                          //     //       userObject[userObjectIndex]._ir == 0
                          //     //     ) {
                          //     //   logger.info(".nxt----fffffffff------->>>>>table.deals: ");
                          //     //       const userInfo_1 = await db
                          //     //         .collection("game_users")
                          //     //         .findOne(
                          //     //           {
                          //     //             _id: getInfo.MongoID(userObject[userObjectIndex].uid),
                          //     //           },
                          //     //           {
                          //     //             projection: {
                          //     //               SignUpBonusStatus: 1,
                          //     //               totalcash: 1,
                          //     //               SignUpBonus: 1,
                          //     //               addCash_bonus: 1,
                          //     //               referral_bonus: 1,
                          //     //               Bonus: 1,
                          //     //               sck: 1,
                          //     //               tbid: 1,
                          //     //               tbd: 1,
                          //     //             },
                          //     //           }
                          //     //         );

                          //     //       let totalBonus,
                          //     //         SignUpBonus = 0,
                          //     //         totalCashBonus = 0,
                          //     //         totalReferralBonus = 0,
                          //     //         cmsBonus = 0;

                          //     //       if (
                          //     //         userInfo_1.SignUpBonusStatus == "Active"
                          //     //       ) {
                          //     //         SignUpBonus += userInfo_1.SignUpBonus;
                          //     //       }

                          //     //       if (userInfo_1.addCash_bonus) {
                          //     //         for (const element of userInfo_1.addCash_bonus) {
                          //     //           if (element.status == "Active") {
                          //     //             totalCashBonus += element.addCashBonus;
                          //     //           }
                          //     //         }
                          //     //       }

                          //     //       if (userInfo_1.referral_bonus) {
                          //     //         for (const element of userInfo_1.referral_bonus) {
                          //     //           if (element.status == "Active") {
                          //     //             totalReferralBonus +=
                          //     //               element.referralBonus;
                          //     //           }
                          //     //         }
                          //     //       }

                          //     //       if (userInfo_1.Bonus) {
                          //     //         cmsBonus += userInfo_1.Bonus;
                          //     //       }

                          //     //       totalBonus =
                          //     //         totalCashBonus +
                          //     //         SignUpBonus +
                          //     //         totalReferralBonus +
                          //     //         cmsBonus;
                          //     //       logger.info(
                          //     //         "userObject[userObjectIndex].uid--1----------->>>>>table.deals: ",
                          //     //         userObject[userObjectIndex].uid,
                          //     //         tbId
                          //     //       );
                          //     //       var single = userInfo_1.sck.replace(
                          //     //         /s\d*_\d*./i,
                          //     //         ""
                          //     //       );
                          //     //       // leaveTableClass.LeaveTable(
                          //     //       //   { flag: "dealovertwo" },
                          //     //       //   {
                          //     //       //     id: single,
                          //     //       //     uid: userObject[userObjectIndex].uid,
                          //     //       //     _ir: userObject[userObjectIndex]._ir,
                          //     //       //     si: userObject[userObjectIndex].si,
                          //     //       //     tbid: tbId,
                          //     //       //   },
                          //     //       //   async function (check) {
                          //     //           logger.info(
                          //     //             "userObject[userObjectIndex].uid--1-------check---->>>>>table.deals: ",
                          //     //             check , userInfo_1
                          //     //           );
                          //     //           const tableDetails = await db
                          //     //             .collection("playing_table")
                          //     //             .findOne(
                          //     //               {
                          //     //                 oldTableId: tbId,
                          //     //                 fromRematch: true,
                          //     //                 ap: 1,
                          //     //               },
                          //     //               {
                          //     //                 projection: {
                          //     //                   ap: 1,
                          //     //                 },
                          //     //               }
                          //     //             );
                          //     //           if (
                          //     //             tableDetails &&
                          //     //             tableDetails.ap === 1
                          //     //           ) {
                          //     //             db.collection(
                          //     //               "playing_table"
                          //     //             ).deleteOne(
                          //     //               {
                          //     //                 oldTableId: tbId,
                          //     //                 fromRematch: true,
                          //     //                 ap: 1,
                          //     //               },
                          //     //               function () {}
                          //     //             );
                          //     //             db.collection(
                          //     //               "playing_table"
                          //     //             ).deleteOne(
                          //     //               {
                          //     //                 _id: getInfo.MongoID(tbId),
                          //     //                 ap: 1,
                          //     //               },
                          //     //               function () {}
                          //     //             );
                          //     //           }
                          //     //           if (userInfo_1.tbid !== "") {
                          //     //             commonClass.SendDirect(
                          //     //               userObject[userObjectIndex].uid,
                          //     //               {
                          //     //                 en: "PLAY_AGAIN",
                          //     //                 data: {
                          //     //                   timer: 0,
                          //     //                   bv: table.bv,
                          //     //                   winPrize:
                          //     //                     userObject[userObjectIndex]._iw === 1
                          //     //                       ? table.prize
                          //     //                       : 0,
                          //     //                   rank : userObject[userObjectIndex]._iw === 1 ? 1 : 2,
                          //     //                   prize: table.prize,
                          //     //                   totalCash: userObject[userObjectIndex]._iw === 1 ? userInfo_1.totalcash + table.prize : userInfo_1.totalCash,
                          //     //                   bonusCash: totalBonus,
                          //     //                   message: userObject[userObjectIndex]._iw === 1? "Yeah! you won":"Well played. You finished 2nd.",
                          //     //                   notifyMessage:
                          //     //                     "Do you want to playagin?",
                          //     //                   catid: table.categoryId,
                          //     //                   pt: 0,
                          //     //                 },
                          //     //               },
                          //     //               true
                          //     //             );
                          //     //           }
                          //     //           userObjectIndex++;
                          //     //           playAgainFunction(userObject , userObjectIndex ,userObjectLength);
                          //     //       //   }
                          //     //       // );
                          //     //     }else{
                          //     //       userObjectIndex++;
                          //     //       playAgainFunction(userObject , userObjectIndex ,userObjectLength);
                          //     //     }
                          //     //   }
                          //     // }

                          //   }
                          // );
                          const rematchTimer = TIMER_REMATCH + 1
                          const rematchJobId = `${table.gt}:dealRematchTimer:${table._id.toString()}`;
                          // scheduler.queues.dealRematchTimer({
                          //   timer: rematchTimer * 1000,
                          //   jobId: rematchJobId,
                          //   table,
                          //   tbId
                          // });

                          const jobData = {
                            table,
                            tbId,
                            calling: DEAL_REMATCH_TIMER
                          };
                          const jobOption = { delay: rematchTimer * 1000, jobId: rematchJobId };
                          addQueue(jobData, jobOption);
                        } else {
                          logger.info(
                            'giveWinChips::::::::1::::>>>>>Error: "table not found"'
                          );
                        }
                      }
                    );
                  } else {
                    let i = 0;
                    res(i);
                    async function res(i) {
                      if (i < table.pi.length) {
                        if (
                          !_.isEmpty(table.pi[i]) &&
                          typeof table.pi[i].si != "undefined"
                        ) {
                          await db
                            .collection("game_users")
                            .findOneAndUpdate(
                              { _id: getInfo.MongoID(table.pi[i].uid) },
                              { $set: { tableRemove: true } }
                            );

                          getInfo.GetUserInfo(
                            table.pi[i].uid,
                            { sck: 1 },
                            function (userInfo) {
                              if (userInfo) {
                                logger.info(
                                  "afterRoundFinish-----------------table.pi[i]._iw:",
                                  table.pi[i]._iw
                                );
                                let flag = "dealoversixloss";
                                if (table.pi[i]._iw == 1) {
                                  flag = "dealoversixwin";
                                }
                                let single = userInfo.sck.replace(
                                  /s\d*_\d*./i,
                                  ""
                                );
                                leaveTableClass.LeaveTable(
                                  {
                                    flag: flag,
                                    fromRematch: true,
                                    eliminated: true,
                                  },
                                  {
                                    id: single,
                                    uid: table.pi[i].uid,
                                    _ir: table.pi[i]._ir,
                                    si: table.pi[i].si,
                                    tbid: table._id.toString(),
                                  },
                                  function (check) {
                                    i += 1;
                                    res(i);
                                  }
                                );
                              } else {
                                i += 1;
                                res(i);
                              }
                            }
                          );
                        } else {
                          i += 1;
                          res(i);
                        }
                      }
                    }
                  }
                }
              } else if (
                table.gt == "Deal" &&
                table.tst == "winnerDeclaredTie"
              ) {
                // var i = 0;
                // res(i);
                // function res(i) {
                //   if (i < table.pi.length) {
                //     if (
                //       !_.isEmpty(table.pi[i]) &&
                //       typeof table.pi[i].si != "undefined" &&
                //       table.pi[i].dealewinner == 0
                //     ) {
                //       getInfo.GetUserInfo(
                //         table.pi[i].uid,
                //         { sck: 1 },
                //         function (userInfo) {
                //           if (userInfo) {
                //             var single = userInfo.sck.replace(/s\d*_\d*./i, "");
                //             leaveTableClass.LeaveTable(
                //               { flag: "dealoversixloss" },
                //               {
                //                 id: single,
                //                 uid: table.pi[i].uid,
                //                 _ir: table.pi[i]._ir,
                //                 si: table.pi[i].si,
                //                 tbid: table._id.toString(),
                //               },
                //               function (check) {}
                //             );
                //             i = i + 1;
                //             res(i);
                //           } else {
                //             i = i + 1;
                //             res(i);
                //           }
                //         }
                //       );
                //     } else if (
                //       !_.isEmpty(table.pi[i]) &&
                //       typeof table.pi[i].si != "undefined" &&
                //       table.pi[i].dealewinner == 1
                //     ) {
                //       getInfo.GetUserInfo(
                //         table.pi[i].uid,
                //         { sck: 1 },
                //         function (userInfo) {
                //           if (userInfo) {
                //             var single = userInfo.sck.replace(/s\d*_\d*./i, "");
                //             var client = socketData.getSocketObjects(single);
                //             // commonClass.SendData({id:single,uid:table.pi[i].uid,_ir:table.pi[i]._ir,si:table.pi[i].si,tbid:table._id.toString()}, 'PopUp', {}, 'success:1056',true);
                //             commonClass.SendData(
                //               client,
                //               "PopUp",
                //               { flag: "tie" },
                //               "success:1056",
                //               true
                //             );
                //             i = i + 1;
                //             res(i);
                //           } else {
                //             i = i + 1;
                //             res(i);
                //           }
                //         }
                //       );
                //     } else {
                //       i = i + 1;
                //       res(i);
                //     }
                //   } else {
                getInfo.GetTbInfo(tbId, {}, async function (table1) {
                  players = getInfo.getPlayingUserInRound(table1.pi);
                  logger.info(
                    "afterRoundFinish-- else-->>>>>>>players: ",
                    players
                  );


                  if (players.length <= 0 && table1.stdP.length == 0) {
                    logger.info(
                      "afterRoundFinish-------" +
                      table1._id +
                      '----->>>>>>>msg:"table deleted "'
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
                    //   db.collection("tableHistory").deleteMany({
                    //     tableId: getInfo.MongoID(table1._id),
                    //   });
                    // }, 3000);
                  } else {
                    logger.info(
                      "afterRoundFinish-----else13131313----->>>>players: ",
                      players
                    );
                    var pi = table1.pi;
                    var ap = table1.ap;
                    for (var x in pi) {
                      if (
                        pi[x] &&
                        !_.isEmpty(pi[x]) &&
                        typeof pi[x].si != "undefined"
                      ) {
                        if (pi[x].s == "left") {
                          //remove left out player data from table
                          pi[x] = {};
                          ap--;
                        } else {
                          pi[x].s = "";
                          pi[x].indecl = false;
                          pi[x].tCount = 0;
                          pi[x].cards = [];
                          // pi[x].dn = 0;
                          pi[x]._iw = 0;
                          pi[x].gCards = {};
                          pi[x].userShowCard = {};
                          pi[x].dCards = {};
                          pi[x].wc = 0;
                          pi[x].pickCount = 0;
                          pi[x].pts = 0;
                          pi[x].ps = 0;
                          pi[x].tScore = 0;
                          pi[x].play = pi[x].play;
                          pi[x].dps = 0; //only for deal and pool mode
                          // pi[x].tdps = MAX_DEADWOOD_PTS; //only for deal and pool mode
                          pi[x].bet = table1.bv;
                          pi[x].isCollect =
                            (table1.round < table1.deals &&
                              table1.gt == "Deal") ||
                              (table1.gt == "Pool" &&
                                table1.tst == "roundWinnerDeclared")
                              ? pi[x].isCollect
                              : 0; //isboot value collected or not
                          pi[x].secTime = SECONDARY_TIMER;
                          pi[x].sct = false;
                          pi[x].tsd = new Date();
                          pi[x].ted = new Date();
                          pi[x].sort = true;
                          pi[x]._rematch = 0;
                          pi[x].turnCounter = 0;
                        }
                      }
                    }
                    var round = table1.round;
                    var rid = table1.rid + 1;
                    var pv = table1.pv;

                    var hist = [];

                    var RobotCount = table1.RobotCount;
                    var HumanCount = table1.HumanCount;
                    var minS = table1.minS;
                    if (table1.gt == "Deal") {
                      minS = 2;
                    }

                    var players = getInfo.getPlayingUserInRound(table1.pi);
                    var rCount = 0;
                    for (var x in players) {
                      if (players[x]._ir == 1) {
                        rCount++;
                      }
                    }

                    minS = rCount + 1;

                    getInfo.UpdateTableData(
                      table1._id.toString(),
                      {
                        $set: {
                          rSeq: 1,
                          tcnt: 0,
                          /*minS:minS,*/ /*nrg:nrg,*/ maxBet: 0,
                          bbv: table1.bv,
                          _isLeave: 0,
                          tst: "",
                          tie: true,
                          isSpc: false,
                          round: round,
                          rid: rid /*,jid:jobId*/,
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
                          rejoinAcceptedUsers: [],
                          fromRematchAP: 0,
                          backToTableUser: [],
                        },
                      },
                      function (table2) {
                        if (table2) {
                          // setTimeout(function () {
                          roundClass.initializeGame(table1._id.toString());
                          // }, 3000);
                        } else {
                          logger.info(
                            'afterRoundFinish-------1---->>>>>>Error:"table not found"'
                          );
                        }
                      }
                    );
                  }
                });
                //   }
                // }
              } else {
                logger.info("afterRoundFinish---1-------else if-else: ", tbId);
                getInfo.GetTbInfo(tbId, {}, function (table1) {
                  players = getInfo.getPlayingUserInRound(table1.pi);
                  logger.info(
                    "afterRoundFinish--1 else-->>>>>>>players: ",
                    players
                  );
                  if (players.length <= 0 && table1.stdP.length == 0) {
                    logger.info(
                      "afterRoundFinish---1----" +
                      table1._id +
                      '----->>>>>>>msg:"table deleted "'
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
                    //   db.collection("tableHistory").deleteMany({
                    //     tableId: getInfo.MongoID(table1._id),
                    //   });
                    // }, 3000);
                  } else {
                    logger.info(
                      "afterRoundFinish---1--else13131313----->>>>players: ",
                      players
                    );
                    var pi = table1.pi;
                    var ap = table1.ap;
                    for (var x in pi) {
                      if (
                        pi[x] &&
                        !_.isEmpty(pi[x]) &&
                        typeof pi[x].si != "undefined"
                      ) {
                        if (pi[x].s == "left") {
                          //remove left out player data from table
                          pi[x] = {};
                          ap--;
                        } else {
                          pi[x].s ="";
                          pi[x].indecl = false;
                          pi[x].tCount = 0;
                          pi[x].cards = [];
                          // pi[x].dn = 0;
                          pi[x]._iw = 0;
                          pi[x].gCards = {};
                          pi[x].userShowCard = {};
                          pi[x].ps = 0;
                          pi[x].tScore = 0;
                          pi[x].play =
                            (table1.round < table1.deals &&
                              table1.gt == "Deal") ||
                              (table1.gt == "Pool" &&
                                table1.tst == "roundWinnerDeclared")
                              ? pi[x].play
                              : 0;
                          pi[x].dps =
                            (table1.round < table1.deals &&
                              table1.gt == "Deal") ||
                              (table1.gt == "Pool" &&
                                table1.tst == "roundWinnerDeclared")
                              ? pi[x].dps
                              : 0; //only for deal and pool mode
                          pi[x].tdps =
                            (table1.round < table1.deals &&
                              table1.gt == "Deal") ||
                              (table1.gt == "Pool" &&
                                table1.tst == "roundWinnerDeclared")
                              ? pi[x].tdps
                              : 0; //only for deal and pool mode
                          pi[x].bet = table1.bv;
                          pi[x].isCollect =
                            (table1.round < table1.deals &&
                              table1.gt == "Deal") ||
                              (table1.gt == "Pool" &&
                                table1.tst == "roundWinnerDeclared")
                              ? pi[x].isCollect
                              : 0; //isboot value collected or not
                          pi[x].secTime = SECONDARY_TIMER;
                          pi[x].sct = false;
                          pi[x].tsd = new Date();
                          pi[x].ted = new Date();
                          pi[x].sort = true;
                          pi[x]._rematch = 0;
                          pi[x].turnCounter = 0;
                        }
                      }
                    }
                    var round =
                      (table1.round >= table1.deals && table1.gt == "Deal") ||
                        (table1.gt == "Pool" && table1.tst == "winnerDeclared")
                        ? 0
                        : table1.round;
                    var rid =
                      (table1.round >= table1.deals && table1.gt == "Deal") ||
                        (table1.gt == "Pool" && table1.tst == "winnerDeclared")
                        ? table1.rid + 1
                        : table1.rid;
                    var pv =
                      (round > 0 && table1.gt == "Deal") ||
                        (table1.gt == "Pool" && round > 0)
                        ? table1.pv
                        : 0;

                    var hist = [];
                    if (
                      /*table1.gt == 'Deal' || */ table1.gt == "Pool" &&
                      round > 0
                    ) {
                      //if new game then only, insertOne the data of history for left players

                      hist = table1.hist.filter(function (htData) {
                        if (htDatas) {
                          return htData;
                        }
                      });
                    }

                    var RobotCount = table1.RobotCount;
                    var HumanCount = table1.HumanCount;
                    var minS = table1.minS;
                    if (table1.gt == "Deal") {
                      minS = 2;
                    } else if (table1.gt == "Pool") {
                      minS = 3;
                    } else {
                      minS = config.MIN_SEAT_TO_FILL;
                    }

                    var players = getInfo.getPlayingUserInRound(table1.pi);
                    var rCount = 0;
                    for (var x in players) {
                      if (players[x]._ir == 1) {
                        rCount++;
                      }
                    }

                    minS = rCount + 1;

                    getInfo.UpdateTableData(
                      table1._id.toString(),
                      {
                        $set: {
                          rSeq: 1,
                          tcnt: 0,
                          /*minS:minS,*/ /*nrg:nrg,*/ maxBet: 0,
                          _isLeave: 0,
                          tst: "",
                          tie: false,
                          isSpc: false,
                          round: round,
                          rid: rid /*,jid:jobId*/,
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
                          rejoinAcceptedUsers: [],
                          fromRematchAP: 0,
                          backToTableUser: [],
                        },
                      },
                      function (table2) {
                        if (table2) {
                          roundClass.initializeGame(table1._id.toString());
                        } else {
                          logger.info(
                            'afterRoundFinish-------1---->>>>>>Error:"table not found"'
                          );
                        }
                      }
                    );
                  }
                });
              }
            });
        } else if (
          typeof table.stdP != "undefined" &&
          table.stdP.length > 0 &&
          players.length == 0
        ) {
          logger.info(
            "afterRoundFinish----------->>>player on the standup so start game after reset table"
          );
          getInfo.UpdateTableData(
            table._id.toString(),
            {
              $set: {
                rSeq: 1,
                maxBet: 0,
                bbv: table.bv,
                _isLeave: 0,
                tst: "",
                pv: 0,
                wildCard: "",
                oDeck: [],
                trCount: 1,
                declCount: 0,
                playCount: 0,
                cDeck: [],
                turn: -1,
                fnsPlayer: -1,
                hist: [],
                ctt: new Date(),
              },
            },
            function (table1) {
              roundClass.initializeGame(table._id.toString());
            }
          );
        } else {
          logger.info(
            'afterRoundFinish:::::::::::::::::>>>>Error: "Table is empty!!!"'
          );



          db.collection("play_track").updateOne(
            { tbid: table._id.toString() },
            { $set: { tet: new Date() } },
            function () { }
          );

          db.collection("last_deal").deleteOne(
            { tbid: table._id.toString() },
            function () { }
          );

          db.collection("playing_table").deleteOne(
            { _id: table._id },
            function () { }
          );
          db.collection("user_cash_percent").deleteOne(
            { tableId: table._id },
            function () { }
          );





          // setTimeout(() => {
          //   db.collection("tableHistory").deleteMany({
          //     tableId: getInfo.MongoID(table._id),
          //   });
          // }, 3000);
        }
      }
    );
  } catch (error) {
    logger.error("-----> error afterRoundFinish", error);
    getInfo.exceptionError(error);
  }
  // console.timeEnd("latency timer afterRoundFinish");
};

const Win = async (data, client) => {
  try {
    const { MAX_INVALID_DECLARE } = GetConfig();
    const table = await db
      .collection("playing_table")
      .findOne({ _id: getInfo.MongoID(data.tId) });
    for (const element of table.hist) {
      if (element && element.s == "left") {
        table.pi[element.si] = element;
      }
    }

    // if (table.gt == "Pool") {
    //   if (table.tst == "roundWinnerDeclared") {
    //     let playerList = table.pi.filter((item) => item.uid);
    //     playerList = cardChange(playerList);

    //     commonClass.SendData(client, "Win", {
    //       tbid: table._id.toString(),
    //       bv: table.bv,
    //       pv: commonClass.RoundInt(table.pv, 2),
    //       wAnimation: false,
    //       round: table.round,
    //       game_id: table.game_id,
    //       sub_id: table.sub_id,
    //       gt: table.gt,
    //       tst: table.tst,
    //       pi: playerList,
    //       win: [table.fnsPlayer],
    //       wildCard: table.wildCard,
    //       categoryId: table.categoryId,
    //     });
    //   }
    // } else {
    if (table.tst == "Finished" || table.tst == "roundWinnerDeclared") {
      let playerList = table.pi.filter((item) => item.uid);
      playerList = cardChange(playerList);
      let playerData = [];
      if (table.gt == "Pool") {
        for (const element of playerList) {
          logger.info(
            " element.rndCount ==table.round-------->",
            element.rndCount == table.round
          );
          if (element && element.rndCount == table.round) {
            playerData.push(element);
          }
        }
      }
      let eventName = "Win";




      commonClass.SendData(client, eventName, {
        tbid: table._id.toString(),
        bv: table.bv,
        pv: commonClass.RoundInt(table.pv, 2),
        wAnimation: false,
        round: table.round,
        game_id: table.game_id,
        sub_id: table.sub_id,
        gt: table.gt,
        tst: table.tst,
        pi: table.gt == "Pool" ? playerData : playerList,
        win: [table.fnsPlayer],
        wildCard: table.wildCard,
        categoryId: table.categoryId,
      });
      // }
    }
  } catch (error) {
    logger.error("-----> error Win", error);
    getInfo.exceptionError(error);
  }
};

const giveWinCash = async (
  tbId,
  winners,
  winnersTwo,
  px,
  iter,
  prize,
  secondprize,
  msg,
  bv,
  deals,
  mode,
  round,
  _ip,
  gt,
  direct,
  indecl,
  maxDps
) => {
  try {
    /* +-------------------------------------------------------------------+
      desc:function to handle classic/bet winner
      i/p: tbId = table id
         winners = array of winners seat indices
         px = player details
         iter = iterator for recursion
         prize = prize amount for winners
         msg = message for chips track
         bv = boot value
         gt = game type
         direct = true/false direct winner or not
    +-------------------------------------------------------------------+ */
    logger.info("giveWinCash------------>>>>>>>>prize: ", prize);
    logger.info("winners------------>>>>>>>>winners: ", winners, maxDps);
    logger.info("winnersTwo------------>>>>>>>>winnersTwo: ", winnersTwo);
    const { TIMER_NEXT_ROUND_DELAY, TAX, TAX_VALUE } = GetConfig();

    if (iter < px.length) {
      if (_.contains(winners, px[iter].si)) {
        //means the winner

        const table = await db.collection("playing_table").findOne({
          _id: getInfo.MongoID(tbId),
        });
        //tds
        const tableName = getTableName(gt);
        const lobbyDetail = await db
          .collection(tableName)
          .findOne({ _id: getInfo.MongoID(table.categoryId) });
        let commission = lobbyDetail.commission ? lobbyDetail.commission : 0;
        let bonusPercentage = lobbyDetail.bonus ? lobbyDetail.bonus : 0;
        logger.info("prize-------------->", prize);

        let tds =
          commission == 0
            ? 0
            : +((bv * table.total_player_join) / commission).toFixed(2);
        logger.info("tds------->", tds);
        let taxAmount = 0;
        let winAmount = prize - bv;
        // pv = pv - bv;
        logger.info("winAmount------->", winAmount);
        logger.info("TAX_VALUE----->", TAX_VALUE);
        logger.info(
          "winAmount > TAX_VALUE------>",
          winAmount > TAX_VALUE
        );
        let tax;
        // if (winAmount > TAX_VALUE) {
        //   tax = +((winAmount * TAX) / 100).toFixed(2);
        //   taxAmount = tax;
        //   logger.info("taxAmount------>", taxAmount);
        //   prize = prize - tax;
        //   let diff1 = commonClass.GetTimeDifference(table.la, new Date());
        //   let taxdata = {
        //     uid: "admin",
        //     tbid: tbId.toString(),
        //     _ir: 0,
        //     tid: "",
        //     cash: tax,
        //     rid: table.rid,
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
        //     tbid: tbId.toString(),
        //     tjid: table.tjid,
        //     winamount: table.prize,
        //     cmsn: tds,
        //     tds: tax,
        //     transferd: prize,
        //     rid: table.round,
        //     mode: table.mode,
        //     gt: table.gt,
        //     un: table.pi[winners].un,
        //     ue: table.pi[winners].ue,
        //     winid: table.pi[winners].uid.toString(),
        //   };
        //   trackClass.TdsTrack(tdstrack, function (tdstrc) { });
        // }
        // let apv = pv + table.bv * MAX_DEADWOOD_PTS;
        logger.info("taxAmount--1----->", taxAmount);

        commonData.UpdateCashForPlayInTable(
          tbId,
          px[iter].uid,
          prize,
          "Game Win",
          async function (uChips) {

            const robotList = table.pi.filter((x) => x._ir == 1 && x.si != px[iter].si);
            if (robotList.length > 0) {
              for (const iterator of robotList) {
                logger.info('---iterator-------->', iterator);
                let obj = {
                  uid: getInfo.MongoID(iterator.uid),
                  tbid: tbId.toString(),
                  tjid: table.tjid,
                  _ir: iterator._ir,
                  gameType: table.gt,
                  bv: table.bv,
                  un: iterator.un,
                  amount: bv,
                  round: table.round,
                  // upc: fChips,
                  t: "Game Lost",
                  cd: new Date(),
                  totalcash: iterator.totalCash
                }
                logger.info('bot_cash_track-----obj-----5------>', obj);
                await db.collection("bot_cash_track").insertOne(obj);
              }
            }

            if (px[iter]._ir == 1 && table.mode == "cash") {
              let obj = {
                uid: getInfo.MongoID(px[iter].uid),
                tbid: tbId.toString(),
                tjid: table.tjid,
                _ir: px[iter]._ir,
                gameType: table.gt,
                bv: table.bv,
                un: px[iter].un,
                amount: Math.abs(prize) - table.bv,
                round: table.round,
                // upc: fChips,
                t: "Game Win",
                cd: new Date(),
                totalcash: px[iter].totalCash + Math.abs(prize)
              }
              logger.info('bot_cash_track-----obj-----6------>', obj);
              await db.collection("bot_cash_track").insertOne(obj);
            }

            var tempPlayerData = px[iter];
            let ctth = "";
            if (direct) {
              if (px[iter].cards.length > 13) {
                ctth = px[iter].cards.pop();
                tempPlayerData.cards = px[iter].cards;
              }
              tempPlayerData.dCards = {
                pure: [],
                seq: [],
                set: [],
                dwd: px[iter].cards,
              };
            }
            tempPlayerData.wc = prize;
            tempPlayerData.cash = uChips;
            tempPlayerData._iw = 1;
            // tempPlayerData.tdps = deals*config.MAX_DEADWOOD_PTS;
            // tempPlayerData.tdps = tempPlayerData.tdps - tempPlayerData.ps;
            tempPlayerData.gedt = new Date();
            if (tempPlayerData._ir == 0) tempPlayerData.dCards = tempPlayerData.gCards;
            logger.info(
              "giveWinChips----------->>>>>>>>ctth: " +
              ctth +
              " direct: " +
              direct
            );
            var upData = {
              $set: {
                la: new Date(),
                ctrlServer: SERVER_ID,
                "pi.$.wc": prize,
                "pi.$.cash": uChips,
                "pi.$._iw": 1,
                tst: "winnerDeclared",
                ctt: new Date(),
                "pi.$.gedt": new Date(),
                tds,
                commission,
                taxPercent: TAX,
                bonusPercentage,
                tax: taxAmount,
              },
              $inc: { "pi.$.winAmount": prize },
            };
            if (ctth != "") {
              if (px[iter].gCards.length > 0) {
                var gCards = px[iter].gCards;
                if (gCards.pure.length > 0) {
                  var pureCards = gCards.pure;
                  logger.info(
                    "handlePoolWinner---------->>>>>>gCards: ",
                    pureCards
                  );
                  for (var x in pureCards) {
                    if (_.contains(pureCards[x], ctth)) {
                      pureCards[x] = _.without(pureCards[x], ctth);
                      break;
                    }
                  }
                  logger.info(
                    "handlePoolWinner------------->>>>>gCards: ",
                    gCards
                  );
                  gCards.pure = pureCards;
                } else if (gCards.seq.length > 0) {
                  var seqCards = gCards.seq;
                  logger.info(
                    "handlePoolWinner---------->>>>>>gCards: ",
                    seqCards
                  );
                  for (var x in seqCards) {
                    if (_.contains(seqCards[x], ctth)) {
                      seqCards[x] = _.without(seqCards[x], ctth);
                      break;
                    }
                  }
                  logger.info(
                    "handlePoolWinner------------->>>>>gCards: ",
                    seqCards
                  );
                  gCards.seq = seqCards;
                } else if (gCards.set.length > 0) {
                  var setCards = gCards.set;
                  logger.info(
                    "handlePoolWinner---------->>>>>>gCards: ",
                    setCards
                  );
                  for (var x in setCards) {
                    if (_.contains(setCards[x], ctth)) {
                      setCards[x] = _.without(setCards[x], ctth);
                      break;
                    }
                  }
                  logger.info(
                    "handlePoolWinner------------->>>>>gCards: ",
                    setCards
                  );
                  gCards.set = setCards;
                } else if (gCards.dwd.length > 0) {
                  var dwdCards = gCards.dwd;
                  logger.info(
                    "handlePoolWinner---------->>>>>>gCards: ",
                    dwdCards
                  );
                  for (var x in dwdCards) {
                    if (_.contains(dwdCards[x], ctth)) {
                      dwdCards[x] = _.without(dwdCards[x], ctth);
                      break;
                    }
                  }
                  logger.info(
                    "handlePoolWinner------------->>>>>gCards: ",
                    dwdCards
                  );
                  gCards.dwd = dwdCards;
                }
              } else {
                var gCards = px[iter].cards;
                var dwdCards = px[iter].cards;
                gCards.dwd = dwdCards;
              }
              upData["$set"]["pi.$.cards"] = px[iter].cards;
              upData["$set"]["pi.$.gCards"] = gCards;
              upData["$push"] = { oDeck: ctth };
            }
            logger.info("tempPlayerData table.hist", table.hist);
            if (table.hist.length != 0) {
              for (const iterator of table.hist) {
                if (iterator.uid == px[iter].uid) {
                  await db.collection("playing_table").updateOne(
                    {
                      _id: getInfo.MongoID(table._id.toString()),
                      "hist.uid": px[iter].uid,
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
            // upData["$addToSet"] = { hist: tempPlayerData };
            logger.info("giveWinChips----------->>>>>upData: ", upData);
            // commonData.CountHands(table.value.pi[px[iter].si].uid,true,function(){
            commonData.CountHands(
              px[iter].uid,
              "win",
              gt,
              bv,
              true,
              mode,
              _ip,
              round,
              function (thp, qstWin, hpc) {
                commonData.getUserScore(px[iter].uid, bv, gt, function (score) {
                  upData["$set"]["pi.$.score"] = score;
                  upData["$set"]["pi.$.thp"] = thp;
                  upData["$set"]["pi.$.hpc"] = hpc;
                  upData["$inc"]["pi.$.rw"] = 1;

                  db.collection("playing_table").findAndModify(
                    { _id: getInfo.MongoID(tbId), "pi.si": px[iter].si },
                    {},
                    upData,
                    { new: true },
                    function (err, table) {
                      if (table && table.value) {
                        giveWinCash(
                          table.value._id.toString(),
                          winners,
                          winnersTwo,
                          px,
                          iter + 1,
                          prize,
                          secondprize,
                          msg,
                          bv,
                          deals,
                          mode,
                          round,
                          _ip,
                          gt,
                          direct,
                          indecl
                        );
                      } else {
                        logger.info(
                          'giveWinChips-------------->>>>>>>>>Error:"table  not found"'
                        );
                      }
                    }
                  );
                });
              }
            );
          }
        );
      } else if (
        _.contains(winnersTwo, px[iter].si) &&
        gt === "Deal" &&
        maxDps !== px[iter].tdps
      ) {
        const table = await db.collection("playing_table").findOne({
          _id: getInfo.MongoID(tbId),
        });

        var tempPlayerData = px[iter];
        var ctth = "";
        if (direct) {
          if (px[iter].cards.length > 13) {
            ctth = px[iter].cards.pop();
            tempPlayerData.cards = px[iter].cards;
          }
          tempPlayerData.dCards = {
            pure: [],
            seq: [],
            set: [],
            dwd: px[iter].cards,
          };
        }
        // tempPlayerData.wc = secondprize;
        // tempPlayerData.cash = uChips;
        // tempPlayerData._iw = 1;
        // tempPlayerData.tdps = deals*MAX_DEADWOOD_PTS;
        tempPlayerData.tdps =
          tempPlayerData.s !== "drop" && tempPlayerData.s !== "declare"
            ? tempPlayerData.tdps - tempPlayerData.ps
            : tempPlayerData.tdps;
        tempPlayerData.gedt = new Date();
        logger.info(
          "giveWinChips----------->>>>>>>>ctth: " + ctth + " direct: " + direct
        );
        var upData = {
          $set: {
            la: new Date(),
            ctrlServer: SERVER_ID,
            // "pi.$.wc": secondprize,
            // "pi.$.cash": uChips,
            // "pi.$._iw": 1,
            tst: "winnerDeclared",
            ctt: new Date(),
            "pi.$.gedt": new Date(),
          },
          $inc: { "pi.$.winAmount": secondprize },
        };
        if (ctth != "") {
          if (px[iter].gCards.length > 0) {
            var gCards = px[iter].gCards;
            if (gCards.pure.length > 0) {
              var pureCards = gCards.pure;
              logger.info(
                "handlePoolWinner---------->>>>>>gCards: ",
                pureCards
              );
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
              logger.info(
                "handlePoolWinner------------->>>>>gCards: ",
                seqCards
              );
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
              logger.info(
                "handlePoolWinner------------->>>>>gCards: ",
                setCards
              );
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
              logger.info(
                "handlePoolWinner------------->>>>>gCards: ",
                dwdCards
              );
              gCards.dwd = dwdCards;
            } else {
            }
          } else {
            var gCards = px[iter].cards;
            var dwdCards = px[iter].cards;
            gCards.dwd = dwdCards;
          }
          upData["$set"]["pi.$.cards"] = px[iter].cards;
          upData["$set"]["pi.$.gCards"] = gCards;
          upData["$push"] = { oDeck: ctth };
        }
        if (table.hist.length != 0) {
          for (const iterator of table.hist) {
            if (iterator.uid == px[iter].uid) {
              await db.collection("playing_table").updateOne(
                {
                  _id: getInfo.MongoID(table._id.toString()),
                  "hist.uid": px[iter].uid,
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
        // upData["$addToSet"] = { hist: tempPlayerData };
        logger.info("giveWinChips----------->>>>>upData: ", upData);
        // commonData.CountHands(table.value.pi[px[iter].si].uid,true,function(){
        commonData.CountHands(
          px[iter].uid,
          "lost",
          gt,
          bv,
          true,
          mode,
          _ip,
          round,
          function (thp, qstWin, hpc) {
            commonData.getUserScore(px[iter].uid, bv, gt, function (score) {
              upData["$set"]["pi.$.score"] = score;
              upData["$set"]["pi.$.thp"] = thp;
              upData["$set"]["pi.$.hpc"] = hpc;
              upData["$inc"]["pi.$.rw"] = 1;

              db.collection("playing_table").findAndModify(
                { _id: getInfo.MongoID(tbId), "pi.si": px[iter].si },
                {},
                upData,
                { new: true },
                function (err, table) {
                  if (table && table.value) {
                    giveWinCash(
                      table.value._id.toString(),
                      winners,
                      winnersTwo,
                      px,
                      iter + 1,
                      prize,
                      secondprize,
                      msg,
                      bv,
                      deals,
                      mode,
                      round,
                      _ip,
                      gt,
                      direct,
                      indecl,
                      maxDps
                    );
                  } else {
                    logger.info(
                      'giveWinChips-------------->>>>>>>>>Error:"table  not found"'
                    );
                  }
                }
              );
            });
          }
        );
      } else if (_.contains(winnersTwo, px[iter].si) && gt !== "Deal") {
        const table = await db.collection("playing_table").findOne({
          _id: getInfo.MongoID(tbId),
        });
        commonData.UpdateCashForPlayInTable(
          tbId,
          px[iter].uid,
          secondprize,
          "Game Win",
          async function (uChips) {
            var tempPlayerData = px[iter];
            var ctth = "";
            if (direct) {
              if (px[iter].cards.length > 13) {
                ctth = px[iter].cards.pop();
                tempPlayerData.cards = px[iter].cards;
              }
              tempPlayerData.dCards = {
                pure: [],
                seq: [],
                set: [],
                dwd: px[iter].cards,
              };
            }
            tempPlayerData.wc = secondprize;
            tempPlayerData.cash = uChips;
            tempPlayerData._iw = 1;
            // tempPlayerData.tdps = deals*MAX_DEADWOOD_PTS;
            tempPlayerData.tdps = tempPlayerData.tdps - tempPlayerData.ps;
            tempPlayerData.gedt = new Date();
            logger.info(
              "giveWinChips----------->>>>>>>>ctth: " +
              ctth +
              " direct: " +
              direct
            );
            var upData = {
              $set: {
                la: new Date(),
                ctrlServer: SERVER_ID,
                "pi.$.wc": secondprize,
                "pi.$.cash": uChips,
                "pi.$._iw": 1,
                tst: "winnerDeclared",
                ctt: new Date(),
                "pi.$.gedt": new Date(),
              },
              $inc: { "pi.$.winAmount": secondprize },
            };
            if (ctth != "") {
              if (px[iter].gCards.length > 0) {
                var gCards = px[iter].gCards;
                if (gCards.pure.length > 0) {
                  var pureCards = gCards.pure;
                  logger.info(
                    "handlePoolWinner---------->>>>>>gCards: ",
                    pureCards
                  );
                  for (var x in pureCards) {
                    if (_.contains(pureCards[x], ctth)) {
                      pureCards[x] = _.without(pureCards[x], ctth);
                      break;
                    }
                  }
                  logger.info(
                    "handlePoolWinner------------->>>>>gCards: ",
                    gCards
                  );
                  gCards.pure = pureCards;
                } else if (gCards.seq.length > 0) {
                  var seqCards = gCards.seq;
                  logger.info(
                    "handlePoolWinner---------->>>>>>gCards: ",
                    seqCards
                  );
                  for (var x in seqCards) {
                    if (_.contains(seqCards[x], ctth)) {
                      seqCards[x] = _.without(seqCards[x], ctth);
                      break;
                    }
                  }
                  logger.info(
                    "handlePoolWinner------------->>>>>gCards: ",
                    seqCards
                  );
                  gCards.seq = seqCards;
                } else if (gCards.set.length > 0) {
                  var setCards = gCards.set;
                  logger.info(
                    "handlePoolWinner---------->>>>>>gCards: ",
                    setCards
                  );
                  for (var x in setCards) {
                    if (_.contains(setCards[x], ctth)) {
                      setCards[x] = _.without(setCards[x], ctth);
                      break;
                    }
                  }
                  logger.info(
                    "handlePoolWinner------------->>>>>gCards: ",
                    setCards
                  );
                  gCards.set = setCards;
                } else if (gCards.dwd.length > 0) {
                  var dwdCards = gCards.dwd;
                  logger.info(
                    "handlePoolWinner---------->>>>>>gCards: ",
                    dwdCards
                  );
                  for (var x in dwdCards) {
                    if (_.contains(dwdCards[x], ctth)) {
                      dwdCards[x] = _.without(dwdCards[x], ctth);
                      break;
                    }
                  }
                  logger.info(
                    "handlePoolWinner------------->>>>>gCards: ",
                    dwdCards
                  );
                  gCards.dwd = dwdCards;
                } else {
                }
              } else {
                var gCards = px[iter].cards;
                var dwdCards = px[iter].cards;
                gCards.dwd = dwdCards;
              }
              upData["$set"]["pi.$.cards"] = px[iter].cards;
              upData["$set"]["pi.$.gCards"] = gCards;
              upData["$push"] = { oDeck: ctth };
            }
            if (table.hist.length != 0) {
              for (const iterator of table.hist) {
                if (iterator.uid == px[iter].uid) {
                  await db.collection("playing_table").updateOne(
                    {
                      _id: getInfo.MongoID(table._id.toString()),
                      "hist.uid": px[iter].uid,
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
            // upData["$addToSet"] = { hist: tempPlayerData };
            logger.info("giveWinChips----------->>>>>upData: ", upData);
            // commonData.CountHands(table.value.pi[px[iter].si].uid,true,function(){
            commonData.CountHands(
              px[iter].uid,
              "win",
              gt,
              bv,
              true,
              mode,
              _ip,
              round,
              function (thp, qstWin, hpc) {
                commonData.getUserScore(px[iter].uid, bv, gt, function (score) {
                  upData["$set"]["pi.$.score"] = score;
                  upData["$set"]["pi.$.thp"] = thp;
                  upData["$set"]["pi.$.hpc"] = hpc;
                  upData["$inc"]["pi.$.rw"] = 1;

                  db.collection("playing_table").findAndModify(
                    { _id: getInfo.MongoID(tbId), "pi.si": px[iter].si },
                    {},
                    upData,
                    { new: true },
                    function (err, table) {
                      if (table && table.value) {
                        giveWinCash(
                          table.value._id.toString(),
                          winners,
                          winnersTwo,
                          px,
                          iter + 1,
                          prize,
                          secondprize,
                          msg,
                          bv,
                          deals,
                          mode,
                          round,
                          _ip,
                          gt,
                          direct,
                          indecl,
                          maxDps
                        );
                      } else {
                        logger.info(
                          'giveWinChips-------------->>>>>>>>>Error:"table  not found"'
                        );
                      }
                    }
                  );
                });
              }
            );
          }
        );
      } else {
        giveWinCash(
          tbId,
          winners,
          winnersTwo,
          px,
          iter + 1,
          prize,
          secondprize,
          msg,
          bv,
          deals,
          mode,
          round,
          _ip,
          gt,
          direct,
          indecl,
          maxDps
        );
      }
    } else {
      getInfo.GetTbInfo(tbId, {}, async function (table1) {
        if (table1) {
          let hist = _.clone(table1.hist);
          logger.info("giveWinCash-----1------>>>>>>hist: ", hist);
          let tempHint = [];
          hist.forEach((userObj) => {
            if (userObj.uid) {
              let arrIndex = tempHint.findIndex(
                (userObj1) => userObj1.uid === userObj.uid
              );
              if (arrIndex === -1) {
                if (JSON.stringify(userObj.dCards) === "{}") {
                  userObj.dCards = userObj.gCards;
                } else if (
                  typeof userObj.gCards.dwd[0] === "string" &&
                  userObj.dCards &&
                  userObj.dCards.dwd &&
                  typeof userObj.dCards.dwd[0] === "string"
                ) {
                  userObj.gCards.dwd = [userObj.gCards.dwd];
                  userObj.dCards = userObj.gCards;
                } else if (
                  userObj.dCards &&
                  userObj.dCards.dwd &&
                  typeof userObj.dCards.dwd[0] === "string"
                ) {
                  userObj.dCards.dwd = [userObj.dCards.dwd];
                }
                // else {
                //   userObj.dCards = userObj.gCards;
                // }
                tempHint.push(userObj);
              }
            }
          });
          hist = tempHint;
          logger.info("giveWinCash-----2------>>>>>>hist: ", tempHint, hist);

          // for (i = 0; i < hist.length; i++) {
          //   //sort(bubble sort) the player according to the dps
          //   for (j = 0; j < hist.length - i - 1; j++) {
          //     if (hist[j].si > hist[j + 1].si) {
          //       //if dps are equal then put loser after winner
          //       temp = _.clone(hist[j]);
          //       hist[j] = _.clone(hist[j + 1]);
          //       hist[j + 1] = _.clone(temp);
          //     }
          //   }
          // }
          hist = _.sortBy(hist, (histObj) => histObj.tdps);
          hist.reverse();
          for (const iterator of winners) {
            hist = _.sortBy(hist, ({ si }) => (si === iterator ? 0 : 1));
          }

          // let testWinArray = [];
          // let testLossArray = [];
          // hist.forEach((histObj) => {
          //   if (histObj._iw === 1) {
          //     testWinArray.push(histObj);
          //   } else {
          //     testLossArray.push(histObj);
          //   }
          // });
          // hist = testWinArray.concat(testLossArray);

          var game_id = table1.game_id;
          var deal_id = table1.game_id;
          if (table1.gt == "Deal" || table1.gt == "Pool") {
            game_id = game_id + "." + table1.sub_id;
          }

          var dealScore = [];
          if (table1.ms == 2) {
            dealScore = [{}, {}];
          } else {
            dealScore = [{}, {}, {}, {}, {}, {}];
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
            }

            if (hist[k]._ir == 1) {
              rCount++;
            } else {
              uCount++;
            }

            dealScore[hist[k].si] = {
              uid: hist[k].uid,
              un: hist[k].un,
              dps: hist[k].tScore,
              tdps: hist[k].tdps,
              si: hist[k].si,
              sts: "playing",
            };
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

          if (table1.ms == 2) {
            winnersTwo = -1;
          }

          var ldData = {
            $set: {
              tbid: table1._id.toString(),
              round: table1.round,
              game_id: table1.game_id,
              sub_id: table1.sub_id,
              gt: table1.gt,
              tst: table1.tst,
              pi: hist,
              wildCard: table1.wildCard,
              win: winners,
            },
          };

          db.collection("last_deal").findAndModify(
            { tbid: table1._id.toString() },
            {},
            ldData,
            { upsert: true, new: true },
            function (err, table1) { }
          );

          var scData = {
            $set: {
              tbid: table1._id.toString(),
            },
            $push: {
              dealscore: dealScore,
            },
          };

          // if (table1.ms != 2 && table1.tie != true) {
          //   winners = winners.concat(winnersTwo);
          // } else {
          //   winnersTwo = -1;
          // }
          let isHalfDeclCounter = 0;
          table1.pi.forEach((uObj) => {
            if (
              uObj &&
              uObj.turnCounter === 0 &&
              uObj.s &&
              uObj.s !== "drop" &&
              (typeof direct === "undefined" || direct === false)
            )
              isHalfDeclCounter++;
          });

          logger.info("WinnerDeclared----------", {
            win: winners,
            dealwin: winners,
            dealwintwo: winnersTwo,
          });

          commonClass.FireEventToTable(table1._id.toString(), {
            en: "WinnerDeclared",
            data: {
              tbid: table1._id.toString(),
              pv: prize,
              bv: bv,
              round: table1.round,
              game_id: table1.game_id,
              sub_id: table1.sub_id,
              gt: table1.gt,
              tst: table1.tst,
              pi: hist,
              win: winners,
              dealwin: winners,
              dealwintwo: winnersTwo,
              wildCard: table1.wildCard,
              categoryId: table1.categoryId,
              halfDeclMsg:
                isHalfDeclCounter >= 1
                  ? "Deal Show - Points of the players who did not get turn will be half"
                  : "",
            },
          });

          hist.forEach((userObj2) => {
            if (userObj2._iw === 1) {
              userObj2.tScore = 0;
              userObj2.dps = 0;
            } else {
              userObj2.dps = userObj2.ps;
            }
          });
          let jobId = commonClass.GetRandomString(10);
          await saveGameHistory(table1, hist, winners);
          // storeTableHistoryForWinner({
          //   tableId: table1._id.toString(),
          //   eventName: "WinnerDeclared",
          //   tableData: table1,
          //   playerData: hist,
          //   winner: winners,
          // });
          // const { pi, ap } = await checkPlayerAvailability(table1.value);
          getInfo.UpdateTableData(
            table1._id.toString(),
            {
              $set: {
                jid: jobId,
                tpr: 0,
                dealwin: winners,
                // pi: pi,
                // ap: ap,
              },
            },
            function (table2) {
              if (table2) {
                // let nxt = commonClass.AddTime(TIMER_NEXT_ROUND_DELAY);
                // if (
                //   direct &&
                //   (typeof indecl === "undefined" || indecl === false)
                // ) {
                //   afterRoundFinish(table2._id.toString());
                // } else {
                // schedule.scheduleJob(table2.jid, new Date(nxt), function () {
                //   schedule.cancelJob(table2.jid);
                afterRoundFinish(table2._id.toString());
                // });
                // }
              } else {
                logger.info(
                  'giveWinChips::::::::1::::>>>>>Error: "table not found"'
                );
              }
            }
          );
        } else {
          logger.info(
            'giveWinChips::::::::::::::>>>>>Error: "table not found"'
          );
        }
      });
    }
  } catch (error) {
    logger.error("-----> error giveWinCash", error);
    getInfo.exceptionError(error);
  }
};

const dealRematch = ({ table, tbId }) => {
  let fromRematchAP = true;
  table.pi.map(async (userObject) => {
    logger.info(
      ".nxt----userObject--------->>>>>table.deals: ",
      userObject
    );
    if (!_.isEmpty(userObject) && userObject._ir == 0) {
      const userInfo_1 = await db
        .collection("game_users")
        .findOne(
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
              sck: 1,
              tbid: 1,
              tbd: 1,
              Chips: 1,
              "flags._ir": 1,
            },
          }
        );

      let totalBonus,
        SignUpBonus = 0,
        totalCashBonus = 0,
        totalReferralBonus = 0,
        cmsBonus = 0;

      if (
        userInfo_1.SignUpBonusStatus == "Active"
      ) {
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
            totalReferralBonus +=
              element.referralBonus;
          }
        }
      }

      if (userInfo_1.Bonus) {
        cmsBonus += userInfo_1.Bonus;
      }

      totalBonus =
        totalCashBonus +
        SignUpBonus +
        totalReferralBonus +
        cmsBonus;
      logger.info(
        "userObject.uid--1----------->>>>>table.deals: ",
        userObject.uid,
        tbId
      );
      let single = userInfo_1.sck.replace(
        /s\d*_\d*./i,
        ""
      );

      logger.info(
        "userObject.uid--1--------->>>>>table.deals: ",
        userInfo_1
      );
      const tableDetails = await db
        .collection("playing_table")
        .findOne(
          {
            oldTableId: tbId,
            fromRematch: true,
            // ap: 1,
          },
          {
            projection: {
              ap: 1,
              fromRematchAP: 1,
              pi: 1,
            },
          }
        );

      if (tableDetails && tableDetails.ap === 1) {
        logger.info(
          "tableDetailstableDetailstableDetails",
          tableDetails
        );
        // need to talk with ajay
        let userDetail = tableDetails.pi.filter(
          (x) => x.uid == userObject.uid
        );
        if (userDetail.length > 0) {
          leaveTableClass.LeaveTable(
            {
              flag: "dealovertwo",
              playAgainScreen: true,
            },
            {
              id: single,
              uid: userDetail[0].uid.toString(),
              _ir: userDetail[0]._ir,
              si: userDetail[0].si,
              tbid: tableDetails._id.toString(),
            },
            async function (check) {
              await db
                .collection("playing_table")
                .deleteOne({
                  oldTableId: tbId,
                  fromRematch: true,
                  ap: 1,
                });
              // setTimeout(() => {
              //   db.collection(
              //     "tableHistory"
              //   ).deleteMany({
              //     tableId: getInfo.MongoID(tbId),
              //   });
              // }, 3000);
            }
          );
        }
      }
      logger.info(
        "tableDetails : ",
        tbId,
        userInfo_1,
        tableDetails
      );

      if (tableDetails && tableDetails.ap === 1 && tableDetails.fromRematchAP === 2) {
        fromRematchAP = false;
      }

      if (
        (userInfo_1.tbid !== "" &&
          tbId === userInfo_1.tbid) ||
        // && !tableDetails
        (userInfo_1.tbid !== "" &&
          tableDetails &&
          tableDetails.ap === 1 &&
          tableDetails.fromRematchAP === 1 &&
          tableDetails._id.toString() ===
          userInfo_1.tbid)
      ) {
        commonClass.SendDirect(
          userObject.uid,
          {
            en: "PLAY_AGAIN",
            data: {
              timer: 0,
              bv: table.bv,
              mode: table.mode,
              winPrize:
                userObject._iw === 1
                  ? table.prize
                  : 0,
              rank: userObject._iw === 1 ? 1 : 2,
              prize: table.prize,
              totalCash:
                table.mode == "cash"
                  ? userObject._iw === 1
                    ? userInfo_1.totalcash +
                    table.prize
                    : userInfo_1.totalCash
                  : userInfo_1.Chips,
              bonusCash:
                totalBonus < 0 ? 0 : totalBonus,
              message:
                userObject._iw === 1
                  ? "Yeah! you won"
                  : "Well played. You finished 2nd.",
              notifyMessage:
                "Do you want to play again?",
              catid: table.categoryId,
              pt: 0,
            },
          },
          true
        );
      }
    }
  });
  logger.info(
    "tableDetails fromRematchAP: ",
    fromRematchAP
  );

  getInfo.GetTbInfo(
    tbId,
    {
      pi: 1,
      bv: 1,
      stdP: 1,
      gt: 1,
      ap: 1,
      ms: 1,
      round: 1,
      tst: 1,
      rSeq: 1,
      game_id: 1,
      pt: 1,
      nrg: 1,
      sub_id: 1,
      spcSi: 1,
      mode: 1,
    },
    function (table3) {
      if (table3) {
        logger.info(
          ".nxt--------1----->>>>>table.deals: ",
          table3
        );
        let i = 0;
        res(i);
        function res(i) {
          if (i < table3.pi.length) {
            if (
              !_.isEmpty(table3.pi[i]) &&
              typeof table3.pi[i].si !=
              "undefined" &&
              fromRematchAP
            ) {
              logger.info(
                ".nxt--------2----->>>>>table.deals: ",
                table3.pi[i]
              );
              getInfo.GetUserInfo(
                table3.pi[i].uid,
                { sck: 1 },
                function (userInfo) {
                  if (userInfo) {
                    logger.info(
                      ".nxt--------3----->>>>>table.deals: "
                    );
                    let single =
                      userInfo.sck.replace(
                        /s\d*_\d*./i,
                        ""
                      );
                    logger.info(
                      ".nxt--------4----->>>>>table.deals: ",
                      table3.pi[i].uid
                    );
                    leaveTableClass.LeaveTable(
                      {
                        flag: "dealovertwo",
                        eliminated: true
                      },
                      {
                        id: single,
                        uid: table3.pi[i].uid,
                        _ir: table3.pi[i]._ir,
                        si: table3.pi[i].si,
                        tbid: table3._id.toString(),
                      },
                      function (check) {
                        i += 1;
                        res(i);
                      }
                    );
                  } else {
                    i += 1;
                    res(i);
                  }
                }
              );
            } else {
              i += 1;
              res(i);
            }
          }
        }
      }
    }
  );
}

module.exports = {
  declareRoundWinner,
  declareRoundWinnerNew,
  declareDealWinner,
  handlePoolWinner,
  handleWinnerCash,
  afterRoundFinish,
  handleWinner,
  declareWinnerNew,
  Win,
  handleDealWinner,
  dealRematch
};

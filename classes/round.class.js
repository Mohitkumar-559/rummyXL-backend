const getInfo = require("../common");
const config = require("../config.json");
const jobTimerClass = require("./jobTimers.class");
const commonClass = require("./common.class");
const schedule = require("node-schedule");
const _ = require("underscore");
const collectBootValueClass = require("./collectBootValue.class");
const cardsClass = require("./cards.class");
const turnClass = require("./turn.class");
const logger = require("../utils/logger");
const { getTableName } = require("../utils");
// const { storeTableHistory } = require("../classes/gameHistory.class");
const { GetConfig } = require("../connections/mongodb");
const shuffleClass = require("./shuffleCard.class");
const scheduler = require("../scheduler");
const { getRedisInstances } = require("../connections/redis");
const { addQueue, cancelJob } = require("../scheduler/bullQueue");
const { ROUND_TIMER_START_TIMER, BOT_SEAT_TIMEOUT, COLLECT_BOOT_VALUE, SELECT_DEALER, CARD_DEALT, SHOW_REJOIN_ACCEPTED } = require("../constants/eventName");
const moment = require("moment");

// const QueuesClass = require("../gameJobs/queue.class");
// const Queues = new QueuesClass();
const initializeGame = (tbId, newgame, fromRematch, userId) => {
  // console.time("latency timer initializeGame");

  try {
    //tries to start the game of there are enough players otherwise puts robots
    /* +-------------------------------------------------------------------+
      desc:function to initialize game
      i/p: tbId = table id
    +-------------------------------------------------------------------+ */
    logger.info("initializeGame-------" + tbId + "------>>>>>");
    const { USE_ROBOT_DEAL, MAX_ROBOT_PER_TABLE, ROUND_START_TIMER, ROUND_START_TIMER_DEAL_SIX, MAX_DEADWOOD_PTS, TIMER_REMATCH, TIME_BOT_SEATING,
      ROUND_START_TIMER_POINT_SIX, USE_ROBOT_POOL, ROUND_START_TIMER_POINT_TWO, MIN_SEAT_TO_FILL_SIX_POOL,
      ROUND_START_TIMER_POOL_SIX, ROUND_START_TIMER_POOL_TWO, ROUND_START_TIMER_POOL, USE_ROBOT } = GetConfig();
    getInfo.GetTbInfo(tbId, {}, async function (resp) {
      if (!resp) {
        logger.info(
          "initializeGame---------" +
          tbId +
          '--------->>>>>Error:"table not found!!!"'
        );
        return false;
      }
      let pi = getInfo.getPlayingUserInRound(resp.pi);

      let rSi = [];

      logger.info("initializeGame----" + tbId + "--->>>>pi: ", pi);
      logger.info("initializeGame------->>>>bbv: ", resp.bbv);

      let rCount = 0,
        uCount = 0;
      for (let x in pi) {
        if (pi[x]._ir == 1) {
          rCount++;
          rSi.push(pi[x].si);
        } else if (pi[x]._ir == 0) {
          uCount++;
        }
      }

      logger.info(
        "initializeGame-------" + tbId + "----->>>>>uCount: ",
        uCount,
        " rCount: ",
        rCount,
        " stdP.length: ",
        resp.stdP.length
      );
      // this is fixed for circular dependency problem.
      const robotsClass = require("./robots.class");

      if (uCount == 0 && rCount >= 0 && resp.stdP.length == 0) {
        //means there is not live user in table and not any standup user
        logger.info("initializeGame------" + tbId + "------>>>>>delete table");
        robotsClass.removeRobots(resp._id.toString());
      } else {
        if (resp.gt == "Deal") {
          //initialize deal rummy
          let game_id = resp.game_id + "." + resp.sub_id;
          logger.info("initializeGame-------deal------->>>>>>rSi: ", rSi);

          let cond =
            resp._ip != 1 &&
            USE_ROBOT_DEAL &&
            resp.use_bot &&
            uCount > 0 &&
            resp.ap < resp.ms &&
            resp.ap < resp.minS &&
            rCount < MAX_ROBOT_PER_TABLE &&
            resp.round == 0;
          let MIN_SEAT_TO_FILL_DEAL = resp.minS;

          if (resp.ap == 1 && resp.tst == "" && resp.round == 0) {
            //game start logic here
            if (resp._ip != 1 /*|| resp.ap == resp.ms*/) {
              logger.info(
                "initializeGame--------------" +
                resp._id +
                " ----------->>>>>>>ap: " +
                resp.ap
              );
              let jobId = commonClass.GetRandomString(10);
              let rst = ROUND_START_TIMER;

              if (resp.ms == 6) {
                rst = ROUND_START_TIMER_DEAL_SIX;
              }

              getInfo.UpdateTableData(
                resp._id.toString(),
                {
                  $set: {
                    tst: "RoundTimerStarted",
                    jid: jobId,
                    ctt: new Date(),
                    tci: "",
                  },
                },
                async function (upData) {
                  if (upData) {
                    logger.info(
                      "initializeGame-------upData------->> : ",
                      upData
                    );
                    let pi = [];
                    for (let j in resp.pi) {
                      let dt = {
                        uid: resp.pi[j].uid,
                        si: resp.pi[j].si,
                        s: resp.pi[j].s,
                      };
                      pi.push(dt);
                    }
                    let newgame = false;
                    if (resp.round == 0) {
                      newgame = true;
                    }
                    let tdps = MAX_DEADWOOD_PTS * upData.deals,
                      round = resp.round + 1;
                    if (upData.tie) {
                      tdps = MAX_DEADWOOD_PTS;
                      newgame = true;
                      round = resp.round;
                    }
                    logger.info(
                      "initializeGame-------fromRematch------->>>>>>fromRematch : ",
                      upData.ap,
                      fromRematch
                    );
                    if (fromRematch && upData.ap === 1 && userId) {
                      logger.info(
                        "initializeGame-------fromRematch---IN---->>>>>>fromRematch : ",
                        upData.ap,
                        fromRematch
                      );
                      let oldTableData = await db
                        .collection("playing_table")
                        .findOne({
                          _id: getInfo.MongoID(resp.oldTableId.toString()),
                        });
                      logger.info(
                        "initializeGame----oldTableData---IN----> : ",
                        oldTableData
                      );
                      if (oldTableData) {
                        let arrIndex = oldTableData.hist.findIndex(
                          (userObj) => userObj.uid === userId
                        );
                        let arrIndex_1 = oldTableData.hist.findIndex(
                          (userObj) => userObj.uid !== userId
                        );
                        logger.info(
                          "initializeGame----arrIndex_1---IN----> : ",
                          userId,
                          arrIndex,
                          arrIndex_1
                        );
                        if (arrIndex !== -1 && arrIndex_1 !== -1 && userId) {
                          let remainRematchTime = TIMER_REMATCH - commonClass.GetTimeDifference(resp.ctt, new Date(), "second");
                          commonClass.SendDirect(
                            userId,
                            {
                              en: "WAIT_FOR_REMATCH",
                              data: {
                                timer:
                                  remainRematchTime > 0 ? remainRematchTime : 0,
                                lockInTime: 3,
                                rank:
                                  oldTableData.hist[arrIndex]._iw === 1 ? 1 : 2,
                                bv: resp.bv,
                                winPrize: oldTableData.prize,
                                prize:
                                  oldTableData.hist[arrIndex]._iw === 1
                                    ? resp.prize
                                    : 0,
                                totalCash: 0,
                                bonusCash: 0,
                                message:
                                  oldTableData.hist[arrIndex]._iw === 1
                                    ? "Yeah! you won"
                                    : "Well played. You finished 2nd.",
                                notifyMessage:
                                  "Waiting for " +
                                  oldTableData.hist[arrIndex_1].un +
                                  " to accept your request...",
                                catid: resp.categoryId,
                                pt: 0,
                              },
                            },
                            true
                          );
                        }
                      }
                    } else {
                      commonClass.FireEventToTable(upData._id.toString(), {
                        en: "RoundTimerStarted",
                        data: {
                          timer: rst,
                          tie: upData.tie,
                          bv: resp.bv,
                          next: 0,
                          tdps: tdps,
                          newgame: newgame,
                          round: round,
                          pi: pi,
                          // serverCurrentMillis: moment.utc().valueOf(),
                        },
                      });




                      // round timer start
                      const jobId = `${resp.gt}:roundTimerStart:${resp._id.toString()}`;
                      // await scheduler.queues.roundTimerStart({
                      //   timer: rst * 1000, jobId,
                      //   tableId: resp._id.toString(),
                      // });
                      const jobData = { tableId: resp._id.toString(), calling: ROUND_TIMER_START_TIMER };
                      const jobOption = {
                        delay: rst * 1000,
                        jobId: jobId,
                      };
                      addQueue(jobData, jobOption);
                    }
                    if (cond) {
                      // bot seating timer
                      // Queues.botSeatTimeout({ timer: rst * 1000 - TIME_BOT_SEATING, table: resp })
                      const jobId = `${resp.gt}:botSeatTimeout:${resp._id.toString()}`;
                      // await scheduler.queues.botSeatTimeout({
                      //   timer: rst * 1000 - TIME_BOT_SEATING, jobId,
                      //   tableId: resp._id.toString(),
                      //   gameType: resp.gt
                      // });

                      const jobData = {
                        tableId: resp._id.toString(),
                        gameType: resp.gt,
                        calling: BOT_SEAT_TIMEOUT
                      };
                      const jobOption = { delay: rst * 1000 - TIME_BOT_SEATING, jobId };
                      addQueue(jobData, jobOption);
                    }
                  } else {
                    logger.info(
                      'initializeGame-------------------->>>>>>Error:"table not found"'
                    );
                  }
                }
              ); //resp.ap > 1 && resp.tst == ''
            } else {
              let prjobId = commonClass.GetRandomString(10);

              if (
                ((resp.ap >= 1 && resp.round == 0) ||
                  (resp.ap > 1 && resp.round > 0)) &&
                resp.tst == ""
              ) {
                let jobId = commonClass.GetRandomString(10);
                let rst = ROUND_START_TIMER;
                if (resp.round > 0) {
                  rst = ROUND_START_TIMER_POOL;
                }
                getInfo.UpdateTableData(
                  resp._id.toString(),
                  {
                    $set: {
                      tst: "RoundTimerStarted",
                      jid: jobId,
                      ctt: new Date(),
                      tci: "",
                    },
                  },
                  async function (upData) {
                    if (upData) {
                      let pi = [];
                      for (let j in resp.pi) {
                        let dt = {
                          uid: resp.pi[j].uid,
                          si: resp.pi[j].si,
                          s: resp.pi[j].s,
                        };
                        pi.push(dt);
                      }
                      let newgame = false;
                      if (resp.round == 0) {
                        newgame = true;
                      }

                      let tdps = MAX_DEADWOOD_PTS * upData.deals;
                      let round = resp.round + 1;
                      if (upData.tie) {
                        tdps = MAX_DEADWOOD_PTS;
                        round = resp.round;
                        newgame = true;
                      }
                      commonClass.FireEventToTable(upData._id.toString(), {
                        en: "RoundTimerStarted",
                        data: {
                          timer: rst,
                          tie: upData.tie,
                          bv: resp.bv,
                          next: 0,
                          tdps: tdps,
                          newgame: newgame,
                          round: round,
                          pi: pi,
                          // serverCurrentMillis: moment.utc().valueOf()
                        },
                      });
                      if (cond) {
                        const jobId = `${resp.gt}:botSeatTimeout:${resp._id.toString()}`;
                        // await scheduler.queues.botSeatTimeout({
                        //   timer: rst * 1000 - TIME_BOT_SEATING,
                        //   jobId,
                        //   tableId: resp._id.toString(),
                        //   gameType: resp.gt
                        // });
                        const jobData = {
                          tableId: resp._id.toString(),
                          gameType: resp.gt,
                          calling: BOT_SEAT_TIMEOUT
                        };
                        const jobOption = { delay: rst * 1000 - TIME_BOT_SEATING, jobId };
                        addQueue(jobData, jobOption);
                      }

                      const jobId = `${resp.gt}:roundTimerStart:${resp._id.toString()}`;
                      // await scheduler.queues.roundTimerStart({
                      //   timer: rst * 1000,
                      //   jobId,
                      //   tableId: resp._id.toString(),
                      // });
                      const jobData = { tableId: resp._id.toString(), calling: ROUND_TIMER_START_TIMER };
                      const jobOption = {
                        delay: rst * 1000,
                        jobId: jobId,
                      };
                      addQueue(jobData, jobOption);
                    } else {
                      logger.info(
                        'initializeGame-------------------->>>>>>Error:"table not found"'
                      );
                    }
                  }
                );
              }
            }
          } else if (
            resp.ap >= MIN_SEAT_TO_FILL_DEAL &&
            resp.round == 0 &&
            fromRematch
          ) {
            let rst = ROUND_START_TIMER;
            if (resp.ms == 6) {
              rst = ROUND_START_TIMER_POINT_SIX;
            }

            let pi = [];
            for (let j in resp.pi) {
              let dt = {
                uid: resp.pi[j].uid,
                si: resp.pi[j].si,
                s: resp.pi[j].s,
              };
              pi.push(dt);
            }
            let tdps = MAX_DEADWOOD_PTS * resp.deals,
              round = resp.round + 1;
            commonClass.FireEventToTable(resp._id.toString(), {
              en: "RoundTimerStarted",
              data: {
                timer: rst,
                tie: resp.tie,
                bv: resp.bv,
                next: 0,
                tdps: tdps,
                newgame: newgame,
                round: round,
                pi: pi,
                // serverCurrentMillis: moment.utc().valueOf()
              },
            });

            // jobTimerClass.cancelJobOnServers(resp._id.toString(), resp.pjid);
            logger.info("initializeGame-------ee-------", cond, rst);
            const jobRoundId = `${resp.gt}:roundTimerStart:${resp._id.toString()}`;
            const jobNewId = `${resp.gt}:roundCutTimerStart:${resp._id.toString()}:`;
            logger.info("rematch schedule job timer-------> jobId", jobRoundId, jobNewId);

            // await scheduler.cancelJob.cancelRoundTimerStart(jobRoundId);
            // await scheduler.cancelJob.cancelRoundTimerStart(jobNewId);
            cancelJob(jobRoundId);
            cancelJob(jobNewId);

            if (cond) {
              const jobId = `${resp.gt}:botSeatTimeout:${resp._id.toString()}`;
              // await scheduler.queues.botSeatTimeout({
              //   timer: rst * 1000 - TIME_BOT_SEATING, jobId,
              //   tableId: resp._id.toString(),
              //   gameType: resp.gt
              // });
              const jobData = {
                tableId: resp._id.toString(),
                gameType: resp.gt,
                calling: BOT_SEAT_TIMEOUT
              };
              const jobOption = { delay: rst * 1000 - TIME_BOT_SEATING, jobId };
              addQueue(jobData, jobOption);

            }
            const jobId = `${resp.gt}:roundTimerStart:${resp._id.toString()}`;
            // await scheduler.queues.roundTimerStart({
            //   timer: rst * 1000,
            //   jobId,
            //   tableId: resp._id.toString(),
            // });
            const jobData = { tableId: resp._id.toString(), calling: ROUND_TIMER_START_TIMER };
            const jobOption = {
              delay: rst * 1000,
              jobId: jobId,
            };
            addQueue(jobData, jobOption);
          } else if (resp.ap < MIN_SEAT_TO_FILL_DEAL && resp.round == 0) {
            if (cond) {
              let rst = ROUND_START_TIMER;
              if (resp.ms == 6) {
                rst = ROUND_START_TIMER_DEAL_SIX;
              }

              const jobId = `${resp.gt}:botSeatTimeout:${resp._id.toString()}`;
              // await scheduler.queues.botSeatTimeout({
              //   timer: rst * 1000 - TIME_BOT_SEATING, jobId,
              //   tableId: resp._id.toString(),
              //   gameType: resp.gt
              // });
              const jobData = {
                tableId: resp._id.toString(),
                gameType: resp.gt,
                calling: BOT_SEAT_TIMEOUT
              };
              const jobOption = { delay: rst * 1000 - TIME_BOT_SEATING, jobId };
              addQueue(jobData, jobOption);

            }
          } else if (resp.ap > 1 && resp.round >= 1) {

            let rst = ROUND_START_TIMER;
            if (resp.round > 0) {
              rst = ROUND_START_TIMER_POOL;
            }
            logger.info("rst-------------->", rst);
            logger.info("resp-------->", resp.round);
            let jobId = commonClass.GetRandomString(10);
            getInfo.UpdateTableData(
              resp._id.toString(),
              {
                $set: {
                  tst: "RoundTimerStarted",
                  jid: jobId,
                  ctt: new Date(),
                  tci: "",
                },
              },
              async function (upData) {
                if (upData) {
                  logger.info("initializeGame-------1111-------" + upData);
                  let pi = [];
                  for (let j in resp.pi) {
                    let dt = {
                      uid: resp.pi[j].uid,
                      si: resp.pi[j].si,
                      s: resp.pi[j].s,
                    };
                    pi.push(dt);
                  }

                  commonClass.FireEventToTable(upData._id.toString(), {
                    en: "RoundTimerStarted",
                    data: {
                      timer: rst,
                      tie: upData.tie,
                      bv: resp.bv,
                      next: 0,
                      tdps: 0,
                      newgame: false,
                      pi: pi,
                      round: resp.round + 1,
                      // serverCurrentMillis: moment.utc().valueOf()
                    },
                  });

                  const jobId = `${resp.gt}:roundTimerStart:${resp._id.toString()}`;
                  // await scheduler.queues.roundTimerStart({
                  //   timer: rst * 1000,
                  //   jobId,
                  //   tableId: resp._id.toString(),
                  // });
                  const jobData = { tableId: resp._id.toString(), calling: ROUND_TIMER_START_TIMER };
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
          }
        } else if (resp.gt == "Pool") {
          logger.info(
            "initializeGame----------pool-----" + tbId + "----->>>>>>>rSi: ",
            rSi
          );

          let condition =
            resp._ip != 1 &&
            USE_ROBOT_POOL &&
            resp.use_bot &&
            uCount > 0 &&
            resp.ap < resp.ms &&
            rCount < MAX_ROBOT_PER_TABLE &&
            // resp.ap < resp.minS &&
            resp.round == 0;
          let MIN_SEAT_TO_FILL_POOL = resp.minS;
          logger.info("resp.minS------------->", resp.minS);
          logger.info("condition--------------->", condition);
          logger.info("resp.ap===>", resp.ap);

          if (resp.ap == 1 && resp.tst == "" && resp.round == 0) {
            //start timer
            let jobId = commonClass.GetRandomString(10);
            let rst = ROUND_START_TIMER;
            if (resp.ms == 6) {
              rst = ROUND_START_TIMER_POINT_SIX;
              // rst = 20;
            } else if (resp.ms == 2) {
              rst = ROUND_START_TIMER_POINT_TWO;
            }

            logger.info(
              "initializeGame-------1111--resp.mode-----" + resp.mode
            );

            // if (resp.addtime && resp.ms == 2) {
            //   rst = rst + config.CASH_CUT_TIMER;
            // }
            logger.info("initializeGame-------1111--rst-----" + rst);

            getInfo.UpdateTableData(
              resp._id.toString(),
              {
                $set: {
                  tst: "RoundTimerStarted",
                  jid: jobId,
                  ctt: new Date(),
                  tci: "",
                },
              },
              async function (upData) {
                logger.info("initializeGame-------1111-------" + upData);
                if (upData) {
                  let pi = [];
                  for (let j in resp.pi) {
                    let dt = {
                      uid: resp.pi[j].uid,
                      si: resp.pi[j].si,
                      s: resp.pi[j].s,
                    };
                    pi.push(dt);
                  }

                  // setTimeout(async () => {
                  commonClass.FireEventToTable(upData._id.toString(), {
                    en: "RoundTimerStarted",
                    data: {
                      timer: rst,
                      tie: upData.tie,
                      bv: resp.bv,
                      next: 0,
                      tdps: 0,
                      newgame: false,
                      pi: pi,
                      round: resp.round + 1,
                      // serverCurrentMillis: moment.utc().valueOf()
                    },
                  });


                  if (condition) {
                    const jobId = `${resp.gt}:botSeatTimeout:${resp._id.toString()}`;
                    // await scheduler.queues.botSeatTimeout({
                    //   timer: rst * 1000 - TIME_BOT_SEATING, jobId,
                    //   tableId: resp._id.toString(),
                    //   gameType: resp.gt
                    // });

                    const jobData = {
                      tableId: resp._id.toString(),
                      gameType: resp.gt,
                      calling: BOT_SEAT_TIMEOUT
                    };
                    const jobOption = { delay: rst * 1000 - TIME_BOT_SEATING, jobId };
                    addQueue(jobData, jobOption);

                  }
                  const jobId = `${resp.gt}:roundTimerStart:${resp._id.toString()}`;
                  // await scheduler.queues.roundTimerStart({
                  //   timer: rst * 1000, jobId,
                  //   tableId: resp._id.toString(),
                  // });
                  const jobData = { tableId: resp._id.toString(), calling: ROUND_TIMER_START_TIMER };
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
          } else if (
            // resp.ap < /* MIN_SEAT_TO_FILL_POOL */ resp.ms &&
            resp.round == 0 &&
            resp.ap < MIN_SEAT_TO_FILL_SIX_POOL
          ) {
            if (condition) {
              let rst = ROUND_START_TIMER_POOL_TWO;
              if (resp.ms == 6) {
                rst = ROUND_START_TIMER_POOL_SIX;
              }
              // Queues.botSeatTimeout({ timer: rst * 1000 - TIME_BOT_SEATING, table: resp });
              const jobId = `${resp.gt}:botSeatTimeout:${resp._id.toString()}`;
              // await scheduler.queues.botSeatTimeout({
              //   timer: rst * 1000 - TIME_BOT_SEATING, jobId,
              //   tableId: resp._id.toString(),
              //   gameType: resp.gt
              // });

              const jobData = {
                tableId: resp._id.toString(),
                gameType: resp.gt,
                calling: BOT_SEAT_TIMEOUT
              };
              const jobOption = { delay: rst * 1000 - TIME_BOT_SEATING, jobId };
              addQueue(jobData, jobOption);
            }
          } else if (resp.ap > 1 && resp.round >= 1) {
            if (resp.round > 0) {
              rst = ROUND_START_TIMER_POOL;
            }
            logger.info("rst-------------->", rst);
            logger.info("resp-------->", resp.round);
            let jobId = commonClass.GetRandomString(10);
            getInfo.UpdateTableData(
              resp._id.toString(),
              {
                $set: {
                  tst: "RoundTimerStarted",
                  jid: jobId,
                  ctt: new Date(),
                  tci: "",
                },
              },
              async function (upData) {
                if (upData) {
                  logger.info("initializeGame-------1111-------", upData);
                  let pi = [];
                  for (let j in resp.pi) {
                    let dt = {
                      uid: resp.pi[j].uid,
                      si: resp.pi[j].si,
                      s: resp.pi[j].s,
                    };
                    pi.push(dt);
                  }
                  // setTimeout(async () => {
                  commonClass.FireEventToTable(upData._id.toString(), {
                    en: "RoundTimerStarted",
                    data: {
                      timer: rst,
                      tie: upData.tie,
                      bv: resp.bv,
                      next: 0,
                      tdps: 0,
                      newgame: false,
                      pi: pi,
                      round: resp.round + 1,
                      // serverCurrentMillis: moment.utc().valueOf()
                    },
                  });


                  const jobId = `${resp.gt}:roundTimerStart:${resp._id.toString()}`;
                  // await scheduler.queues.roundTimerStart({
                  //   timer: rst * 1000, jobId,
                  //   tableId: resp._id.toString(),
                  // });
                  const jobData = { tableId: resp._id.toString(), calling: ROUND_TIMER_START_TIMER };
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
          }
        } else {
          //initialize classic rummy
          logger.info("resp-------------->", resp);
          let MIN_SEAT_TO_FILL_POINTS = resp.minS;

          let cond =
            USE_ROBOT &&
            resp.use_bot &&
            resp.tst != "CardsDealt" &&
            resp.tst != "RoundStarted" &&
            (uCount > 0 || resp.stdP.length > 0) &&
            resp.ap < resp.ms &&
            // resp.ap < minS &&
            (rCount < MAX_ROBOT_PER_TABLE || resp.stdP.length > 0);

          let prjobId = commonClass.GetRandomString(10);
          let jobId = commonClass.GetRandomString(10);
          let rst = ROUND_START_TIMER;
          if (resp.ms == 6) {
            rst = ROUND_START_TIMER_POINT_SIX;
          } else if (resp.ms == 2) {
            rst = ROUND_START_TIMER_POINT_TWO;
          }

          if (resp.ap >= 1 && resp.tst == "") {

            getInfo.UpdateTableData(
              resp._id.toString(),
              {
                $set: {
                  tst: "RoundTimerStarted",
                  prjid: prjobId,
                  jid: jobId,
                  ctt: new Date(),
                  tci: "",
                },
              },
              async function (upData) {
                if (upData) {
                  let pi = [];
                  for (let j in resp.pi) {
                    let dt = {
                      uid: resp.pi[j].uid,
                      si: resp.pi[j].si,
                      s: resp.pi[j].s,
                    };
                    pi.push(dt);
                  }
                  // setTimeout(async () => {
                  commonClass.FireEventToTable(upData._id.toString(), {
                    en: "RoundTimerStarted",
                    data: {
                      timer: rst,
                      tie: upData.tie,
                      bv: resp.bv,
                      next: 0,
                      tdps: 0,
                      newgame: false,
                      pi: pi,
                      round: resp.round + 1,
                      // serverCurrentMillis: moment.utc().valueOf()
                    },
                  });

                  if (cond) {
                    const jobId = `${resp.gt}:botSeatTimeout:${resp._id.toString()}`;
                    // await scheduler.queues.botSeatTimeout({
                    //   timer: rst * 1000 - TIME_BOT_SEATING, jobId,
                    //   tableId: resp._id.toString(),
                    //   gameType: resp.gt
                    // });

                    const jobData = {
                      tableId: resp._id.toString(),
                      gameType: resp.gt,
                      calling: BOT_SEAT_TIMEOUT
                    };
                    logger.warn(jobId);
                    const jobOption = { delay: rst * 1000 - TIME_BOT_SEATING, jobId };
                    addQueue(jobData, jobOption);

                  }

                  const jobId = `${resp.gt}:roundTimerStart:${resp._id.toString()}`;
                  const jobData = { tableId: resp._id.toString(), calling: ROUND_TIMER_START_TIMER };
                  const jobOption = {
                    delay: rst * 1000,
                    jobId: jobId,
                  };
                  addQueue(jobData, jobOption);
                  // await scheduler.queues.roundTimerStart({
                  //   timer: rst * 1000, jobId,
                  //   tableId: resp._id.toString(),
                  // });
                }
              }
            );
          }
          if (resp.round > 0 && resp.ap < resp.ms) {
            commonClass.fireEventToAll({
              en: "JoiningUsers",
              data: {
                joinedPlayers: resp.ap ? +resp.ap : 0,
                _id: resp.categoryId.toString(),
                playerCount: resp.ms
              },
              tableIds: await db.collection("playing_table").distinct("_id")
            });
          }
        }
      }
    });
  } catch (error) {
    logger.error("-----> error initializeGame", error);
    getInfo.exceptionError(error);
  }
  // console.timeEnd("latency timer initializeGame");

};

const startRound = (tbId) => {
  // console.time("latency timer startRound");

  try {
    //starts the game assumes that all the players are ready to play
    /* +-------------------------------------------------------------------+
      desc:function to start round
      i/p: tbId = table id
    +-------------------------------------------------------------------+ */
    logger.info("startRound---------->>>>");
    const { MAX_DEADWOOD_PTS, TIMER_BOOT_VALUE_COLLECT } = GetConfig();
    // getInfo.UpdateTableData(tbId,{$set:{tst:'StartDealingCard',ctt:new Date()}},function(resp){
    getInfo.GetTbInfo(tbId, {}, function (resp) {
      logger.info("resp--------startRound-------->", resp);
      if (resp) {
        let uScores = [];
        for (let i in resp.pi) {
          if (!_.isEmpty(resp.pi[i]) && resp.pi[i]._ir == 0) {
            uScores.push(resp.pi[i].score);
          }
        }

        let tScore = 0;
        if (uScores.length > 1) {
          tScore = commonClass.getMedian(uScores);
        } else {
          tScore = uScores.length == 1 ? uScores[0] : 0;
        }

        let game_id = resp.game_id;
        if (resp.gt == "Deal" || resp.gt == "Pool") {
          if (resp.round == 0) {
            game_id = game_id + 1;
            game_id = game_id + ".1";
          } else {
            game_id = game_id + "." + (resp.sub_id + 1);
          }
        } else {
          game_id = game_id + 1;
        }

        if (resp.gt == "Deal") {
          //deal rummy

          if (resp.ap > 1) {
            getInfo.UpdateTableData(
              resp._id.toString(),
              {
                $set: {
                  tst: "CollectingBootValue",
                  addtime: false,
                  ctt: new Date(),
                },
                $inc: { round: 1 },
              },
              function (upData) {
                if (!upData) {
                  logger.info(
                    "startRound---deal-----" +
                    resp._id +
                    '--------->>>>>>Error:"table not found"'
                  );
                  return false;
                }
                logger.info(
                  "startRound-------------" +
                  upData._id +
                  "----------ap: " +
                  upData.ap +
                  "---------->>>>"
                );

                //collect boot value logic here
                // var players = getInfo.getPlayingUserInRound(upData.pi);
                let { pi, pv } = upData;
                if (upData.round == 1) {
                  //if round == 1 then only boot value will be collected

                  let newChips = [];
                  let i = 0;
                  cbtv(i);
                  async function cbtv(i) {
                    if (i < pi.length) {
                      if (!_.isEmpty(pi[i]) && typeof pi[i].si != "undefined") {
                        if (upData.mode == "practice") {
                          newChips.push({
                            si: pi[i].si,
                            chips: pi[i].upc - upData.bv,
                          });
                          pi[i].userViewCashChips = pi[i].upc;
                          pi[i].upc -= upData.bv;
                        } else if (upData.mode == "cash") {
                          newChips.push({
                            si: pi[i].si,
                            cash: pi[i].upc - upData.bv,
                          });
                          pi[i].userViewCashChips = pi[i].upc;
                          pi[i].upc -= upData.bv;
                        }

                        pi[i].play = 1;
                        pi[i].isCollect = 1;

                        if (
                          pi[i].hpc < config.NEWUSER &&
                          resp.bv <= config.MAX_BV_NUSER_DEAL &&
                          resp.bv >= config.MIN_BV_NUSER_DEAL
                        ) {
                          pi[i].nuser = true;
                        } else {
                          pi[i].nuser = false;
                        }

                        getInfo.UpdateUserData(
                          pi[i].uid,
                          { $set: { "flags._winshare": 0, cAmount: false } },
                          function (ud) { }
                        );
                        collectBootValueClass.collectBootValueInTable(
                          upData._id.toString(),
                          upData.mode,
                          pi[i].uid,
                          upData.bv,
                          function (res) {
                            if (typeof res != "undefined") {
                              logger.info(
                                "collectBootValue: point mode res:",
                                res
                              );
                              i++;
                              cbtv(i);
                            } else {
                              logger.info(
                                "problem in collectBootValue: point mode"
                              );
                            }
                          }
                        );
                      } else {
                        i++;
                        cbtv(i);
                      }
                    } else {
                      // pv = upData.bv * upData.ap * ((100 - upData.reke) * 0.01); //table pot value
                      logger.info("in else-----------");
                      const tableName = getTableName(upData.gt);
                      const lobbyDetail = await db
                        .collection(tableName)
                        .findOne({ _id: getInfo.MongoID(upData.categoryId) });
                      logger.info("lobbyDetail----------->", lobbyDetail);
                      let bonusPercentage = lobbyDetail.bonus
                        ? lobbyDetail.bonus
                        : 0;
                      let commission = lobbyDetail.commission
                        ? lobbyDetail.commission
                        : 0;
                      // pv = upData.bv * upData.ap * ((100 - upData.reke) * 0.01); //table pot value
                      // pv =  (upData.bv * upData.ap * (100 - commission)) / 100;
                      pv =
                        upData.mode == "cash"
                          ? (upData.bv * upData.ap * (100 - commission)) / 100
                          : upData.bv * upData.ap;
                      logger.info("pv---------------->", pv);
                      let pvv = upData.bv * upData.ap;
                      // let cmsn = pvv - pv;
                      // let diff = commonClass.GetTimeDifference(
                      //   upData.la,
                      //   new Date()
                      // );
                      // let obj = {
                      //   uid: "admin",
                      //   tbid: upData._id.toString(),
                      //   tid: "",
                      //   _ir: 0,
                      //   cash: pvv - pv,
                      //   rid: upData.rid,
                      //   mode: upData.mode,
                      //   gt: upData.gt,
                      //   trkid: upData.tjid,
                      //   diff: diff,
                      //   commission,
                      //   bonusPercentage,
                      //   t: "tax from winamount",
                      // };
                      // logger.info("handleWinnerCash-->>>obj: ", obj);
                      // trackClass.PlayTrack(obj, function (dt) {
                      // if (dt) {
                      let bpv = pv;
                      // logger.info("bpv--------->", bpv);
                      // let tx = pv - upData.bv;
                      // logger.info("tx-------->", tx);
                      // if (
                      //   tx > config.TAX_VALUE &&
                      //   upData.mode == "cash"
                      // ) {
                      //   let tax = (tx * config.TAX) / 100;
                      //   pv = pv - tax;
                      //   let taxdata = {
                      //     uid: "admin",
                      //     tbid: upData._id.toString(),
                      //     tid: "",
                      //     _ir: 0,
                      //     cash: tax,
                      //     rid: upData.rid,
                      //     mode: upData.mode,
                      //     gt: upData.gt,
                      //     trkid: upData.tjid,
                      //     diff: diff,
                      //     commission,
                      //     bonusPercentage,
                      //     t: "tds from winamount",
                      //   };
                      //   trackClass.PlayTrack(taxdata, function (txdt) {});

                      //   let tdstrack = {
                      //     tbid: upData._id.toString(),
                      //     tjid: upData.tjid,
                      //     winamount: pvv,
                      //     cmsn: cmsn,
                      //     tds: tax,
                      //     transferd: pv,
                      //     rid: upData.rid,
                      //     mode: upData.mode,
                      //     gt: upData.gt,
                      //     un: "",
                      //     ue: "",
                      //     winid: "",
                      //   };
                      //   trackClass.TdsTrack(tdstrack, function (tdstrc) {
                      //     if (tdstrc) {
                      //       getInfo.UpdateTableData(
                      //         upData._id.toString(),
                      //         { $set: { tdsid: tdstrc._id.toString() } },
                      //         function (up) {}
                      //       );
                      //     }
                      //   });
                      // }
                      let jobId = commonClass.GetRandomString(10);

                      getInfo.UpdateTableData(
                        upData._id.toString(),
                        {
                          $set: {
                            la: new Date(),
                            jid: jobId,
                            prize: bpv,
                            pv: pv,
                            pi: pi,
                            sub_id: 1,
                          },
                          $inc: { game_id: 1 },
                        },
                        function (upData1) {
                          if (upData1) {
                            commonClass.FireEventToTable(
                              upData._id.toString(),
                              {
                                en: "CollectBootValue",
                                data: {
                                  pv: pvv,
                                  prize: bpv,
                                  bv: upData.bv,
                                  pChips: newChips,
                                  round: upData1.round,
                                  game_id: upData1.game_id,
                                  sub_id: upData1.sub_id,
                                },
                                flag: true,
                              }
                            );

                            let bct = commonClass.AddTime(TIMER_BOOT_VALUE_COLLECT);
                            logger.info(
                              "startRound--deal--before---" +
                              upData._id.toString() +
                              "---jid: " +
                              upData1.jid +
                              "---bct: " +
                              bct +
                              "-------->>>>>" +
                              new Date()
                            );

                            const jobId = `${upData1.gt}:collectBootValue:${upData1._id.toString()}`;
                            // scheduler.queues.collectBootValue({
                            //   timer: TIMER_BOOT_VALUE_COLLECT * 1000,
                            //   jobId,
                            //   tableId: upData1._id.toString(), pv, pi
                            // });
                            const jobData = { tableId: upData1._id.toString(), pv, pi, calling: COLLECT_BOOT_VALUE };
                            const jobOption = {
                              delay: TIMER_BOOT_VALUE_COLLECT * 1000,
                              jobId: jobId,
                            };
                            addQueue(jobData, jobOption);
                            // schedule.scheduleJob(
                            //   upData1.jid,
                            //   new Date(bct),
                            //   function () {
                            //     schedule.cancelJob(upData1.jid);

                            //     logger.info(
                            //       "startRound----------->>>>>pv: " + pv
                            //     );
                            //     logger.info(
                            //       "startRound--deal -after----" +
                            //       upData1._id.toString() +
                            //       "---jid: " +
                            //       upData1.jid +
                            //       "---bct: " +
                            //       bct +
                            //       "------->>>>>" +
                            //       new Date()
                            //     );
                            //     dealCards(upData1._id.toString(), pv, pi);
                            //   }
                            // );
                          } else {
                            logger.info(
                              "startRound----deal---xxxxxx" +
                              upData._id.toString() +
                              "---jid: " +
                              jobId +
                              "--pv: " +
                              pv +
                              "----bct: " +
                              bct +
                              '----xxxxxx>>>>>Error:"table not found"' +
                              new Date()
                            );
                          }
                        }
                      );
                      // }
                      // });
                    }
                  }
                } else {
                  logger.info("startRound----------->>>>>pv: " + pv);
                  getInfo.UpdateTableData(
                    upData._id.toString(),
                    { $inc: { sub_id: 1 } },
                    function () {
                      dealCards(upData._id.toString(), pv, pi);
                    }
                  );
                }
                // });
              }
            );
          } else if (resp.ap == 1 || resp.ap < 2) {
            logger.info("startRound--------->>>>ap == 1 or 0");
            getInfo.UpdateTableData(
              resp._id.toString(),
              { $set: { tst: "", ctt: new Date(), _artFlag: 0, _qstWin: 0 } },
              function (upData) {
                initializeGame(resp._id.toString());
              }
            );
          }
        } else if (resp.gt == "Pool") {
          let minS = resp.minS ? resp.minS : config.MIN_SEAT_TO_FILL;
          let MIN_SEAT_TO_FILL = resp._ip == 1 ? 2 : minS;
          logger.info("sttartrnd-----------------minS:", minS);
          // resp.ap >= MIN_SEAT_TO_FILL || resp.ap > 1
          // resp.ap >= config.MIN_SEAT_TO_FILL && resp.ap > 1
          if (resp.ap > MIN_SEAT_TO_FILL || resp.ap > 1) {
            getInfo.UpdateTableData(
              resp._id.toString(),
              {
                $set: {
                  la: new Date(),
                  addtime: false,
                  tst: "CollectingBootValue",
                  ctt: new Date(),
                  _artFlag: 0,
                  _qstWin: 0,
                },
                $inc: { round: 1 },
              },
              function (upData) {
                if (!upData) {
                  logger.info(
                    "startRound----pool-----" +
                    resp._id +
                    '---------->>>>>Error:"table not found"'
                  );
                  return false;
                }
                logger.info(
                  "startRound-------------" +
                  upData._id +
                  "----------ap: " +
                  upData.ap +
                  "---------->>>>"
                );
                //collect boot value logic here
                let pi = upData.pi;
                let pv = upData.pv;
                logger.info("pv------------------->", pv);
                if (upData.round == 1) {
                  //if round == 1 then only boot value will be collected
                  let newChips = [];

                  let i = 0;
                  cbtv(i);
                  async function cbtv(i) {
                    if (i < pi.length) {
                      if (!_.isEmpty(pi[i]) && typeof pi[i].si != "undefined") {
                        if (upData.mode == "practice") {
                          newChips.push({
                            si: pi[i].si,
                            chips: pi[i].upc - upData.bv,
                          });
                          pi[i].userViewCashChips = pi[i].upc;
                          pi[i].upc -= upData.bv;
                        } else if (upData.mode == "cash") {
                          newChips.push({
                            si: pi[i].si,
                            cash: pi[i].upc - upData.bv,
                          });
                          pi[i].userViewCashChips = pi[i].upc;
                          pi[i].upc -= upData.bv;
                        }
                        pi[i].play = 1;
                        pi[i].isCollect = 1;

                        if (
                          pi[i].hpc < config.NEWUSER &&
                          resp.bv <= config.MAX_BV_NUSER_POOL &&
                          resp.bv >= config.MIN_BV_NUSER_POOL
                        ) {
                          pi[i].nuser = true;
                        } else {
                          pi[i].nuser = false;
                        }

                        getInfo.UpdateUserData(
                          pi[i].uid,
                          { $set: { "flags._winshare": 0, cAmount: false } },
                          function (ud) { }
                        );
                        collectBootValueClass.collectBootValueInTable(
                          upData._id.toString(),
                          upData.mode,
                          pi[i].uid,
                          upData.bv,
                          function (res) {
                            logger.info("res-------------->", res);
                            if (typeof res != "undefined") {
                              logger.info(
                                "collectBootValue: point mode res:",
                                res
                              );
                              i++;
                              cbtv(i);
                            } else {
                              logger.info(
                                "problem in collectBootValue: point mode"
                              );
                            }
                          }
                        );
                      } else {
                        i++;
                        cbtv(i);
                      }
                    } else {
                      logger.info("in else-----------");
                      const tableName = getTableName(upData.gt);
                      const lobbyDetail = await db
                        .collection(tableName)
                        .findOne({ _id: getInfo.MongoID(upData.categoryId) });
                      logger.info("lobbyDetail----------->", lobbyDetail);
                      let bonusPercentage = lobbyDetail.bonus
                        ? lobbyDetail.bonus
                        : 0;
                      let commission = lobbyDetail.commission
                        ? lobbyDetail.commission
                        : 0;
                      // // pv = upData.bv * upData.ap * ((100 - upData.reke) * 0.01); //table pot value
                      // // pv =  (upData.bv * upData.ap * (100 - commission)) / 100;
                      pv =
                        upData.mode == "cash"
                          ? (upData.bv * upData.ap * (100 - commission)) / 100
                          : upData.bv * upData.ap;
                      // logger.info("pv---------------->", pv);
                      let pvv = upData.bv * upData.ap;
                      logger.info("pvv------------>", pvv);
                      // let cmsn = pvv - pv;
                      // logger.info("cmsn----------->", cmsn);
                      // let diff = commonClass.GetTimeDifference(
                      //   upData.la,
                      //   new Date()
                      // );
                      // let obj = {
                      //   uid: "admin",
                      //   tbid: upData._id.toString(),
                      //   tid: "",
                      //   _ir: 0,
                      //   cash: pvv - pv,
                      //   rid: upData.rid,
                      //   mode: upData.mode,
                      //   gt: upData.gt,
                      //   trkid: upData.tjid,
                      //   diff: diff,
                      //   commission,
                      //   bonusPercentage,
                      //   t: "tax from winamount",
                      // };
                      // logger.info("handleWinnerCash-->>>obj: ", obj);
                      // trackClass.PlayTrack(obj, function (dt) {
                      //   logger.info("dt------------>", dt);
                      //   if (dt) {
                      let bpv = pv;
                      //     logger.info("bpv--------->", bpv);
                      //     let tx = pv - upData.bv;
                      //     logger.info("tx-------->", tx);
                      //     if (
                      //       tx > config.TAX_VALUE &&
                      //       upData.mode == "cash"
                      //     ) {
                      //       logger.info("in if------");
                      //       let tax = (tx * config.TAX) / 100;
                      //       logger.info("tax---------->", tax);
                      //       pv = pv - tax;
                      //       let taxdata = {
                      //         uid: "admin",
                      //         tbid: upData._id.toString(),
                      //         tid: "",
                      //         _ir: 0,
                      //         cash: tax,
                      //         rid: upData.rid,
                      //         mode: upData.mode,
                      //         gt: upData.gt,
                      //         trkid: upData.tjid,
                      //         diff: diff,
                      //         commission,
                      //         bonusPercentage,
                      //         t: "tds from winamount",
                      //       };
                      //       trackClass.PlayTrack(taxdata, function (txdt) {});

                      //       let tdstrack = {
                      //         tbid: upData._id.toString(),
                      //         tjid: upData.tjid,
                      //         winamount: pvv,
                      //         cmsn: cmsn,
                      //         tds: tax,
                      //         transferd: pv,
                      //         rid: upData.rid,
                      //         mode: upData.mode,
                      //         gt: upData.gt,
                      //         commission,
                      //         bonusPercentage,
                      //         un: "",
                      //         ue: "",
                      //         winid: "",
                      //       };
                      //       trackClass.TdsTrack(tdstrack, function (tdstrc) {
                      //         if (tdstrc) {
                      //           getInfo.UpdateTableData(
                      //             upData._id.toString(),
                      //             { $set: { tdsid: tdstrc._id.toString() } },
                      //             function (up) {}
                      //           );
                      //         }
                      //       });
                      //     }
                      let jobId = commonClass.GetRandomString(10);
                      getInfo.UpdateTableData(
                        upData._id.toString(),
                        {
                          $set: {
                            la: new Date(),
                            jid: jobId,
                            prize: bpv,
                            pv: pv,
                            pi: pi,
                            sub_id: 1,
                          },
                          $inc: { game_id: 1 },
                        },
                        function (upData1) {
                          if (upData1) {
                            commonClass.FireEventToTable(
                              upData._id.toString(),
                              {
                                en: "CollectBootValue",
                                data: {
                                  pv: pvv,
                                  prize: bpv,
                                  bv: upData.bv,
                                  pChips: newChips,
                                  round: upData1.round,
                                  game_id: upData1.game_id,
                                  sub_id: upData1.sub_id,
                                },
                                flag: true,
                              }
                            );

                            let bct = commonClass.AddTime(TIMER_BOOT_VALUE_COLLECT);
                            logger.info(
                              "startRound--pool--before---" +
                              upData._id.toString() +
                              "---jid: " +
                              upData1.jid +
                              "---bct: " +
                              bct +
                              "-------->>>>>" +
                              new Date()
                            );
                            const jobId = `${upData1.gt}:collectBootValue:${upData1._id.toString()}`;
                            // scheduler.queues.collectBootValue({
                            //   timer: TIMER_BOOT_VALUE_COLLECT * 1000,
                            //   jobId,
                            //   tableId: upData1._id.toString(), pv, pi
                            // });
                            const jobData = { tableId: upData1._id.toString(), pv, pi, calling: COLLECT_BOOT_VALUE };
                            const jobOption = {
                              delay: TIMER_BOOT_VALUE_COLLECT * 1000,
                              jobId: jobId,
                            };
                            addQueue(jobData, jobOption);
                            // schedule.scheduleJob(
                            //   upData1.jid,
                            //   new Date(bct),
                            //   function () {
                            //     schedule.cancelJob(upData1.jid);

                            //     logger.info(
                            //       "startRound----------->>>>>pv: " + pv
                            //     );
                            //     logger.info(
                            //       "startRound--pool -after----" +
                            //       upData1._id.toString() +
                            //       "---jid: " +
                            //       upData1.jid +
                            //       "---bct: " +
                            //       bct +
                            //       "------->>>>>" +
                            //       new Date()
                            //     );
                            //     dealCards(upData1._id.toString(), pv, pi);
                            //   }
                            // );
                          } else {
                            logger.info(
                              "startRound----pool---xxxxxx" +
                              upData._id.toString() +
                              "---jid: " +
                              jobId +
                              "--pv: " +
                              pv +
                              "----bct: " +
                              bct +
                              '----xxxxxx>>>>>Error:"table not found"' +
                              new Date()
                            );
                          }
                        }
                      );
                      //   }
                      // });
                    }
                  }
                } else {
                  getInfo.UpdateTableData(
                    upData._id.toString(),
                    { $inc: { sub_id: 1 } },
                    function () {
                      logger.info("startRound----------->>>>>pv: " + pv);
                      dealCards(upData._id.toString(), pv, pi);
                    }
                  );
                }
              }
            );
          } else if (resp.ap < MIN_SEAT_TO_FILL || resp.ap == 1) {
            logger.info("startRound-------else if------->>>>>>");
            getInfo.UpdateTableData(
              resp._id.toString(),
              {
                $set: {
                  tst: "",
                  ctt: new Date(),
                  _artFlag: 0,
                  _qstWin: 0,
                },
              },
              function (upData) {
                initializeGame(resp._id.toString());
              }
            );
          }
        } else {
          //classic rummy
          let minS = resp.minS ? resp.minS : config.MIN_SEAT_TO_FILL;
          let MIN_SEAT_TO_FILL = resp._ip == 1 ? 2 : minS;
          logger.info("sttartrnd-----------------minS:", minS);
          if (resp.ap >= config.MIN_SEAT_TO_FILL && resp.ap > 1) {
            getInfo.UpdateTableData(
              resp._id.toString(),
              {
                $set: {
                  la: new Date(),
                  addtime: false,
                  tst: "CollectingBootValue",
                  ctt: new Date(),
                },
                $inc: { round: 1, rid: 1 },
              },
              function (upData) {
                if (upData) {
                  logger.info(
                    "startRound-------------" +
                    upData._id +
                    "----------ap: " +
                    upData.ap +
                    "---------->>>>"
                  );
                  let pi = upData.pi;
                  let pv = upData.pv;
                  let newChips = [];
                  let cutchip = upData.bv * MAX_DEADWOOD_PTS;
                  let tch = cutchip * upData.ap;
                  let i = 0;
                  cbtv(i);

                  function cbtv(i) {
                    // for(var i in pi){
                    logger.info(
                      "startRound------------------ pi.length: ",
                      pi.length
                    );
                    if (i < pi.length) {
                      if (!_.isEmpty(pi[i]) && typeof pi[i].si != "undefined") {
                        if (upData.mode == "practice") {
                          newChips.push({
                            si: pi[i].si,
                            chips: pi[i].upc - cutchip,
                          });
                          pi[i].userViewCashChips = pi[i].upc;
                          pi[i].upc -= cutchip;
                        } else if (upData.mode == "cash") {
                          newChips.push({
                            si: pi[i].si,
                            cash: pi[i].upc - cutchip,
                          });
                          pi[i].userViewCashChips = pi[i].upc;
                          pi[i].upc -= cutchip;
                        }

                        pi[i].play = 1;
                        pi[i].isCollect = 1;

                        if (
                          pi[i].hpc < config.NEWUSER &&
                          resp.bv <= config.MAX_BV_NUSER_POINT &&
                          resp.bv >= config.MIN_BV_NUSER_POINT
                        ) {
                          pi[i].nuser = true;
                        } else {
                          pi[i].nuser = false;
                        }

                        getInfo.UpdateUserData(
                          pi[i].uid,
                          { $set: { "flags._winshare": 0, cAmount: false } },
                          function (ud) { }
                        );
                        collectBootValueClass.collectBootValueInTable(
                          upData._id.toString(),
                          upData.mode,
                          pi[i].uid,
                          cutchip,
                          function (res) {
                            if (typeof res != "undefined") {
                              logger.info(
                                "collectBootValue: point mode res:",
                                res
                              );
                              i++;
                              cbtv(i);
                            } else {
                              logger.info(
                                "problem in collectBootValue: point mode"
                              );
                            }
                          }
                        );
                      } else {
                        i++;
                        cbtv(i);
                      }
                    } else {
                      let jobId = commonClass.GetRandomString(10);
                      getInfo.UpdateTableData(
                        upData._id.toString(),
                        {
                          $set: { la: new Date(), jid: jobId, pi: pi },
                          $inc: { game_id: 1 },
                        },
                        function (upData1) {
                          if (upData1) {
                            commonClass.FireEventToTable(
                              upData._id.toString(),
                              {
                                en: "CollectBootValue",
                                data: {
                                  pv: tch,
                                  prize: 0,
                                  bv: cutchip,
                                  pChips: newChips,
                                  round: upData1.round,
                                  game_id: upData1.game_id,
                                },
                                flag: true,
                              }
                            );

                            let bct = commonClass.AddTime(TIMER_BOOT_VALUE_COLLECT);
                            logger.info(
                              "startRound--deal--before---" +
                              upData._id.toString() +
                              "---jid: " +
                              upData1.jid +
                              "---bct: " +
                              bct +
                              "-------->>>>>" +
                              new Date()
                            );
                            const jobId = `${upData1.gt}:collectBootValue:${upData1._id.toString()}`;
                            // scheduler.queues.collectBootValue({
                            //   timer: TIMER_BOOT_VALUE_COLLECT * 1000,
                            //   jobId,
                            //   tableId: upData1._id.toString(), pv: 0, pi
                            // });
                            const jobData = { tableId: upData1._id.toString(), pv: 0, pi, calling: COLLECT_BOOT_VALUE };
                            const jobOption = {
                              delay: TIMER_BOOT_VALUE_COLLECT * 1000,
                              jobId: jobId,
                            };
                            addQueue(jobData, jobOption);
                            // schedule.scheduleJob(
                            //   upData1.jid,
                            //   new Date(bct),
                            //   function () {
                            //     schedule.cancelJob(upData1.jid);

                            //     logger.info(
                            //       "startRound----------->>>>>pv: " + pv
                            //     );
                            //     logger.info(
                            //       "startRound--deal -after----" +
                            //       upData1._id.toString() +
                            //       "---jid: " +
                            //       upData1.jid +
                            //       "---bct: " +
                            //       bct +
                            //       "-------->>>>>" +
                            //       new Date()
                            //     );
                            //     dealCards(upData1._id.toString(), 0, pi);
                            //   }
                            // );
                          } else {
                            logger.info(
                              "startRound----deal---xxxxxx" +
                              upData._id.toString() +
                              "---jid: " +
                              jobId +
                              "--pv: " +
                              pv +
                              "   bct: " +
                              bct +
                              '----xxxxxx>>>>>Error:"table not found"' +
                              new Date()
                            );
                          }
                        }
                      );
                    }
                    // }
                  }
                } else {
                  logger.info("startRound-------else if------->>>>>>");
                  getInfo.UpdateTableData(
                    resp._id.toString(),
                    {
                      $set: {
                        tst: "",
                        ctt: new Date(),
                        _artFlag: 0,
                        _qstWin: 0,
                      },
                    },
                    function (upData1) {
                      initializeGame(resp._id.toString());
                    }
                  );
                }
              }
            );
          } else if (resp.ap < MIN_SEAT_TO_FILL || resp.ap == 1) {
            logger.info("startRound-------else if------->>>>>>");
            getInfo.UpdateTableData(
              resp._id.toString(),
              {
                $set: {
                  tst: "",
                  ctt: new Date(),
                  _artFlag: 0,
                  _qstWin: 0,
                },
              },
              function (upData) {
                initializeGame(resp._id.toString());
              }
            );
          }
        }
      } else {
        logger.info(
          'startRound:::::::::::::::::::::>>>>Error : "table not exist"'
        );
        return false;
      }
    });
  } catch (error) {
    logger.error("-----> error startRound", error);
    getInfo.exceptionError(error);
  }
  // console.timeEnd("latency timer startRound");

};

const dealCards = (tbId, pv, pi) => {
  // console.time("latency timer dealCards");

  try {
    // deal cards
    /* +-------------------------------------------------------------------+
    desc:function to generate cards for players on table
    i/p: tbId = table id ,pv = pot value,pi = player details
  +-------------------------------------------------------------------+ */
    const { TIMER_DEALER_SELECT_2, TIMER_DEALER_SELECT } = GetConfig();
    getInfo.GetTbInfo(tbId, function (tbInfo) {
      if (tbInfo) {
        let totalPlayers = getInfo.getPlayingUserInRound(tbInfo.pi);

        if (totalPlayers.length > 1) {
          getInfo.UpdateTableData(
            tbId,
            {
              $set: {
                la: new Date(),
                tst: "StartDealingCard",
                pv: pv,
                ctt: new Date(),
              },
            },
            function (resp) {
              if (resp) {
                logger.info(
                  "dealCards-------------" +
                  resp._id +
                  "----------ap: " +
                  resp.ap +
                  "---------->>>>"
                );
                // logger.info("resp------------->", resp);
                let pi1 = resp.pi;
                logger.info("dealCards-------1----->>>>>>pi1: ", pi1);
                let uCount = 0;
                let chipsArray = [];
                let playCount = 0;
                for (let i = 0; i < resp.ms; i++) {
                  if (!_.isEmpty(pi1[i]) && typeof pi1[i].si != "undefined") {
                    // pi1[i].s =
                    //   ((resp.gt == "Deal" || resp.gt == "Pool") &&
                    //     pi1[i].play == 1) ||
                    //     resp.gt == "Points"
                    //     ? "playing"
                    //     : "watch";
                    pi1[i].s = "playing";

                    playCount =
                      ((resp.gt == "Deal" || resp.gt == "Pool") &&
                        pi1[i].play == 1) ||
                        resp.gt == "Points"
                        ? playCount + 1
                        : playCount;

                    pi1[i].rndCount = pi1[i].rndCount ? pi1[i].rndCount : 0;
                    if (pi1[i].s == "playing") {
                      pi1[i].gst = new Date();
                      pi1[i].rndCount += 1;
                    }
                    if (pi1[i]._ir == 0) {
                      uCount++;
                    }
                    chipsArray.push(pi1[i].Chips);
                  }
                }

                //logic for getting max bet value according to the least valued chips player
                let minChips = 0;
                let maxBet = 0;

                let players = getInfo.getPlayingUserInRound(pi1, true);
                logger.info("dealCards--------->>>>>players: ", players);

                db.collection("user_cards")
                  .find({ mode: resp.gt })
                  .sort({ rank: 1 })
                  .toArray(function (err, usercard) {
                    if (usercard) {
                      let cards = shuffleClass.cardDistribution(pi1, resp.ms, resp.gt);
                      logger.info("dealCards------->>>>>cards: ", cards);
                      // logger.info("======cards----------->", cards);
                      let { turn, dealer } = resp;
                      logger.info(
                        "dealCards----3--->>>>>pi1: ",
                        pi1,
                        " resp.dealer: ",
                        resp.dealer,
                        " ms: ",
                        resp.ms
                      );
                      logger.info("dealer--------->", dealer);
                      let toss = false;
                      let tcards = [];
                      let tosscards = cardsClass.getCardsForToss(pi1);
                      logger.info("tosscards---------->", tosscards);
                      let tcds = [];
                      logger.info("pi1------>", pi1);
                      if (pi1 && pi1.length > 1 && resp.dealer == -1) {
                        for (let k = 0; k < resp.ms; k++) {
                          if (
                            !_.isEmpty(pi1[k]) &&
                            typeof pi1[k].si != "undefined" &&
                            pi1[k].s == "playing"
                          ) {
                            pi1[k].tcard = tosscards.sCards[k][0];
                            logger.info(
                              "tosscards.sCards[k]:",
                              tosscards.sCards[k][0]
                            );
                            tcds.push(tosscards.sCards[k][0]);
                            tcards.push({
                              uid: pi1[k].uid,
                              si: pi1[k].si,
                              tossCard: tosscards.sCards[k][0],
                            });
                          }
                        }

                        let highcd = cardsClass.getHighCardNew(tcds);

                        logger.info(
                          "dealCards--------------->>>>>>>>highcd: " + highcd
                        );
                        for (let j = 0; j < resp.ms; j++) {
                          if (pi1[j].tcard == tcds[highcd]) {
                            resp.dealer = pi1[j].si;
                            resp.turn = pi1[j].si;
                            turn = pi1[j].si;
                            dealer =
                              pi1[j].si - 1 < 0 ? resp.ap - 1 : pi1[j].si - 1;
                            toss = true;
                          }
                        }
                      } else {
                        let i = 0,
                          k = resp.dealer;
                        logger.info("k---------->", k);
                        tcards = [];
                        while (i < resp.ms) {
                          let turnCounter = 1;
                          // let turnCounter = resp.ms == 2 ? 1 : 2;
                          k = (k + turnCounter) % resp.ms;
                          logger.info("k------------->", k);
                          if (!_.isEmpty(pi1[k]) && pi1[k].s == "playing") {
                            resp.dealer = k;
                            resp.turn = k;
                            turn = k;
                            dealer = k;
                            toss = false;
                            break;
                          }
                          i++;
                        }
                        let p = 0;
                        while (p < resp.ms) {
                          let turnCounter = 1;
                          // let turnCounter = resp.ms == 2 ? 1 : 2;
                          turn = (turn + turnCounter) % resp.ms;
                          logger.info("turn------------->", turn);
                          if (
                            !_.isEmpty(pi1[turn]) &&
                            pi1[turn].s == "playing"
                          ) {
                            // resp.dealer = turn;
                            resp.turn = turn;
                            turn = turn;
                            // dealer = turn;
                            // toss = false;
                            break;
                          }
                          p++;
                        }
                      }
                      logger.info("turn------------->", turn);
                      //if turn user not found
                      if (turn == -1) {
                        logger.info(
                          "dealCards:::::" +
                          resp._id +
                          "::::turn: " +
                          turn +
                          ":::::totalPlayers: ",
                          totalPlayers,
                          ":::pi1: ",
                          pi1,
                          '::>>>>Error: "turn user not found" ' + new Date()
                        );
                        return false;
                      }

                      let { game_id } = resp;
                      if (resp.gt == "Deal" || resp.gt == "Pool") {
                        game_id = game_id + "." + resp.sub_id;
                      }

                      let seats = [];
                      // let nCards = []; //temp logic
                      for (let x in players) {
                        seats.push(players[x].si);
                      }

                      let t, u;
                      for (let i in seats) {
                        if (seats[0] == turn) {
                          break;
                        } else {
                          t = seats.splice(0, 1)[0];
                          seats.push(t);
                        }
                      }

                      let jobId = commonClass.GetRandomString(10);

                      logger.info("dealCards-------4---->>>>>pi1: ", pi1);

                      let activePlayers = getInfo.getPlayingUserInRound(pi1);

                      logger.info(
                        "dealCards-----------5------->>>> uCount: " +
                        uCount +
                        " activePlayers: ",
                        activePlayers
                      );

                      getInfo.UpdateTableData(
                        resp._id,
                        {
                          $set: {
                            la: new Date(),
                            ap: activePlayers.length,
                            uCount: uCount,
                            pi: pi1,
                            playCount: playCount,
                            turn: turn,
                            dealer: dealer,
                            // dealer:
                            //   dealer == 0
                            //     ? activePlayers.length - 1
                            //     : dealer - 1,
                            jid: jobId,
                            maxBet: maxBet,
                          },
                        },
                        async function (table) {
                          if (!table) {
                            logger.info(
                              "dealCards:::::::::" +
                              resp._id +
                              ':::::::::>>>>>>>>Error:"table not found"' +
                              new Date()
                            );
                            return false;
                          }

                          // let where = {
                          //   categoryId: table.categoryId.toString(), tst: { $in: ["", "RoundTimerStarted"], }, round: 0, ap: { $lt: table.ms },
                          // };
                          // let projection = { ap: 1 };
                          // let sort = { _id: 1 };

                          // let joinedUsers = await getInfo.getJoiningUsers(where, projection, sort);
                          if (((table.gt == "Deal" || table.gt == "Pool") && table.round == 1) || (table.gt == "Points")) {
                            commonClass.fireEventToAll({
                              en: "JoiningUsers",
                              data: {
                                joinedPlayers: 0,
                                _id: table.categoryId.toString(),
                                playerCount: table.ms
                              },
                              tableIds: await db.collection("playing_table").distinct("_id")
                            });
                          }

                          commonClass.FireEventToTable(table._id.toString(), {
                            en: "SelectDealerSeat",
                            data: {
                              dealer: table.turn,
                              // dealer: table.dealer,
                              toss: toss,
                              tcards: tcards,
                              round: table.round,
                              game_id: table.game_id,
                              sub_id: table.sub_id,
                              si: seats,
                              maxBet: table.maxBet,
                            },
                            flag: true,
                          });

                          // let dst = commonClass.AddTime(TIMER_DEALER_SELECT_2);
                          // if (toss) {
                          //   dst = commonClass.AddTime(TIMER_DEALER_SELECT);
                          // }
                          // schedule.scheduleJob(
                          //   table.jid,
                          //   new Date(dst),
                          //   function () {
                          //     schedule.cancelJob(table.jid);
                          //   });
                          const tossTimer = toss ? TIMER_DEALER_SELECT : TIMER_DEALER_SELECT_2;
                          const jobId = `${table.gt}:selectDealer:${table._id.toString()}`;
                          // await scheduler.queues.selectDealer({
                          //   timer: tossTimer * 1000,
                          //   jobId,
                          //   tableId: table._id.toString(),
                          //   cards, seats
                          // });

                          const jobData = {
                            tableId: table._id.toString(),
                            cards, seats,
                            calling: SELECT_DEALER
                          };
                          const jobOption = {
                            delay: tossTimer * 1000,
                            jobId: jobId,
                          };
                          addQueue(jobData, jobOption);
                        }
                      );
                    }
                  });
              } else {
                logger.info(
                  "dealCards:::::" +
                  tbId +
                  ':::::::>>>>>>Error: "table not found"' +
                  new Date()
                );
              }
            }
          );
        } else {
          logger.info(
            "dealCards:::::::" + tbId + ":::totalPlayers: ",
            totalPlayers,
            ":::pi: ",
            tbInfo.pi,
            "::::pv: " +
            pv +
            '::>>>>"not sufficient user found on table"' +
            new Date()
          );
        }
      } else {
        logger.info(
          "dealCards:::::::::" + tbId + ":::pv: " + pv + ":::::pi: ",
          pi,
          ':::>>>>"Table not found"' + new Date()
        );
      }
    });
  } catch (error) {
    logger.error("-----> error dealCards", error);
    getInfo.exceptionError(error);
  }
  // console.timeEnd("latency timer dealCards");

};

const sendCards = (uid, _ir, sts, cards, top, wildCard, seats) => {
  try {
    //send data to users
    /* +-------------------------------------------------------------------+
    desc:function to deal cards to players on table
    i/p: uid = _id of user
      _ir = is robot or not
      sts = status of player
      cards = cards of player
      top = top card
      wildCard = wildcard
      seats = seat index of user
    o/p: SeeMyCards event : data = {
              cards = cards of player
              wildCard = wildcard
              tCard = top card for game
              si = seat index}
  +-------------------------------------------------------------------+ */
    if (_ir == 0 && sts == "playing") {
      logger.info("sendCards----------->>>>_ir: " + _ir);
      commonClass.SendDirect(
        uid,
        {
          en: "SeeMyCards",
          data: { cards: cards, wildCard: wildCard, tCard: top, si: seats },
        },
        true
      );
    }
  } catch (error) {
    logger.error("-----> error sendCards", error);
    getInfo.exceptionError(error);
  }
};

const checkRobotSeating = async (tableId, gameType) => {
  try {
    const tableDetails = await db.collection("playing_table").findOne({ _id: getInfo.MongoID(tableId), gt: gameType }, { projection: { ap: 1 } });
    if (tableDetails?.ap === 1) {
      const robotsClass = require("./robots.class");
      robotsClass.putRobotOnSeat(tableId.toString());
    }
  } catch (error) {
    logger.error("-----> error checkRobotSeating", error);
    getInfo.exceptionError(error);
  }
};

const selectDealerTimer = ({ tableId, cards, seats }) => {
  // console.time("latency timer PickCardFromCloseDeck");

  try {
    const redisInstances = getRedisInstances();
    const { MAX_DEADWOOD_PTS, FIRST_DROP, FIRST_DROP_101, FIRST_DROP_201, FIRST_DROP_61, MIDDLE_DROP, MIDDLE_DROP_101, MIDDLE_DROP_201, MIDDLE_DROP_61 } = GetConfig();
    getInfo.GetTbInfo(tableId.toString(), { pi: 1, ms: 1 }, async function (resp1) {
      if (!resp1) {
        logger.info(
          "dealCards::::::" +
          tableId.toString() +
          ':::::::>>>>>Error:"table not found!!!"' +
          new Date()
        );
        return false;
      }
      let pi2 = resp1.pi;

      for (let j = 0; j < resp1.ms; j++) {
        if (
          !_.isEmpty(pi2[j]) &&
          typeof pi2[j].si != "undefined" &&
          pi2[j].s == "playing"
        ) {
          pi2[j].cards = cards.sCards[j];
          pi2[j].gCards = {
            pure: [],
            seq: [],
            set: [],
            dwd: [cards.sCards[j]],
          };
          pi2[j].userShowCard.allCards = [cards.sCards[j]];

          if (pi2[j]._ir == 0) {
            await redisInstances.HSET(`userPlayingCards:${resp1._id.toString()}:${pi2[j].uid}`, "cards", JSON.stringify(pi2[j].cards));
          }

        }
      }

      getInfo.UpdateTableData(
        resp1._id.toString(),
        {
          $set: {
            la: new Date(),
            pi: pi2,
            wildCard: cards.wildCard,
            cDeck: cards.cDeck,
          },
          $push: { oDeck: cards.tCard },
        },
        function (table1) {
          if (table1) {
            logger.info(
              "dealCards-------upd-------->>>>>table1: ",
              table1
            );
            commonClass.FireEventToTable(
              table1._id.toString(),
              {
                en: "StartDistributingCards",
                data: {
                  dealer: table1.dealer,
                  si: seats,
                  wildCard: cards.wildCard,
                  tCard: cards.tCard,
                  ap: table1.ap,
                  round:
                    table1.round /*,nCards:nCards*/,
                },
                flag: true,
              }
            );
            //distributing cards to all players
            let first_drop = MAX_DEADWOOD_PTS * FIRST_DROP;
            let middle_drop = MAX_DEADWOOD_PTS * MIDDLE_DROP;
            if (table1.gt == "Pool") {
              if (table1.pt == 101) {
                first_drop = FIRST_DROP_101;
                middle_drop = MIDDLE_DROP_101;
              } else if (table1.pt == 201) {
                first_drop = FIRST_DROP_201;
                middle_drop = MIDDLE_DROP_201;
              } else if (table1.pt == 61) {
                first_drop = FIRST_DROP_61;
                middle_drop = MIDDLE_DROP_61;
              }
            }

            for (let x = 0; x < table1.ms; x++) {
              if (
                !_.isEmpty(table1.pi[x]) &&
                typeof table1.pi[x].si !=
                "undefined"
              ) {
                sendCards(
                  table1.pi[x].uid,
                  table1.pi[x]._ir,
                  table1.pi[x].s,
                  table1.pi[x].cards,
                  table1.oDeck[0],
                  table1.wildCard,
                  seats
                );

                // storeTableHistory({
                //   tableId: table1._id.toString(),
                //   eventName: "StartDistributingCards",
                //   tableData: table1,
                //   userIndex: table1.pi[x].si
                // });

                if (table1?.pi[x]?.resumeAndDrop && table1?.gt != "Points") {
                  const cutPoints = table1.pi[x].pickCount < 1 ? first_drop : middle_drop;
                  commonClass.FireEventToTable(
                    table1._id.toString(),
                    {
                      en: "RESUME_AND_DROP",
                      data: {
                        uid: table1.pi[x].uid,
                        si: table1.pi[x].si,
                        s: "optedToDrop",
                        msg: `You will be dropped on your turn and ${cutPoints} pts will be added to your score.`,
                        cutPoints,
                        buttonShow: true,
                        popupShow: true,
                      },
                    }
                  );
                }
              }
            }
            getInfo.UpdateTableData(
              table1._id.toString(),
              {
                $set: {
                  la: new Date(),
                  tst: "CardsDealt",
                  ctt: new Date(),
                },
              },
              function (table3) {
                // setTimeout(function () {
                //   //delay after cards distribution

                // }, 2000);
                // scheduerJob.cardDealt(table1._id.toString(),2000)
                const jobId = `${table1.gt}:cardsDealtTimer:${table1._id.toString()}`;
                // scheduler.queues.cardsDealt({
                //   timer: 2000,
                //   jobId,
                //   tableId: table1._id.toString(),
                // });
                const jobData = {
                  tableId: table1._id.toString(),
                  calling: CARD_DEALT
                };
                const jobOption = {
                  delay: 2000,
                  jobId: jobId,
                };
                addQueue(jobData, jobOption);
              }
            );
          } else {
            logger.info(
              "dealCards--2----" +
              resp1._id.toString() +
              "::pi2: ",
              pi2,
              '---->>>>>>Error:"table not found"' +
              new Date()
            );
          }
        }
      );
    }
    );
  } catch (error) {
    logger.error("-----> error selectDealerTimer", error);
    getInfo.exceptionError(error);
  }
  // console.timeEnd("latency timer PickCardFromCloseDeck");

};

const cardsDealtTimer = (tableId) => {
  try {
    getInfo.UpdateTableData(
      tableId,
      {
        $set: {
          la: new Date(),
          tst: "RoundStarted",
          ctt: new Date(),
        },
      },
      function (table2) {
        if (table2) {
          logger.info("dealCards----------->>>>>userturn2", table2);
          turnClass.startUserTurn(table2._id.toString(), "cards_dealt");
          logger.info("table2.rejoinAcceptedUsers.length", table2.rejoinAcceptedUsers.length);
          logger.info("table2.gt", table2.gt);
          logger.info("table2.rejoinAcceptedUsers.length > 0 && table2.gt == Pool", table2.rejoinAcceptedUsers.length > 0, table2.gt == "Pool");

          if (table2.rejoinAcceptedUsers.length > 0 && table2.gt == "Pool") {
            logger.info("table2.rejoinAcceptedUsers.length > 0 && table2.gt == Pool if", table2.rejoinAcceptedUsers.length, table2.gt);

            let userid = table2.rejoinAcceptedUsers;
            const jobId = `${table2.gt}:rejoinAcceptedUsers:${table2._id.toString()}`;
            const jobData = { tableId: table2._id.toString(), userId: userid, prize: table2.prize, calling: SHOW_REJOIN_ACCEPTED };
            const jobOption = { delay: 2000, jobId: jobId, };
            addQueue(jobData, jobOption);
            // setTimeout(async () => {
            //   const filter = { _id: { $in: userid } };
            //   const projection = { un: 1 };
            //   let users = await db.collection("game_users").find(filter, { projection }).toArray();
            //   users = users.map((x) => x.un);
            //   commonClass.FireEventToTable(
            //     table1._id.toString(),
            //     {
            //       en: "REJOIN_ACCEPTED_USERS_TOOLTIP",
            //       data: {
            //         time: 5,
            //         msg: `${users.toString()} has rejoined the game. Please note that the prize amount has been updated to Rs. ${table2.prize}`,
            //       },
            //       flag: true,
            //     });
            // }, 2000);
          }
        } else {
          logger.info("dealCards---1----" + table1._id.toString() + '----->>>>>>Msg:"table not found!!!"' + new Date());
        }
      }
    );
  } catch (error) {
    logger.error("-----> error cardsDealtTimer", error);
    getInfo.exceptionError(error);
  }
};

const showRejoinAccept = async (tableId, userId, prize) => {
  logger.info("showRejoinAccept calling", tableId, userId, prize);
  const userObjectId = userId.map((x) => getInfo.MongoID(x));
  const filter = { _id: { $in: userObjectId } };
  const projection = { un: 1 };
  let users = await db.collection("game_users").find(filter, { projection }).toArray();
  users = users.map((x) => x.un);
  logger.info("showRejoinAccept users", users.toString());
  commonClass.FireEventToTable(
    tableId.toString(),
    {
      en: "REJOIN_ACCEPTED_USERS_TOOLTIP",
      data: {
        time: 5,
        msg: `${users.toString()} has rejoined the game. Please note that the prize amount has been updated to Rs. ${prize}`,
      },
      flag: true,
    });

  logger.info("showRejoinAccept prize", prize);

};

module.exports = { initializeGame, startRound, checkRobotSeating, dealCards, selectDealerTimer, cardsDealtTimer, showRejoinAccept };

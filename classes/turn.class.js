const commonClass = require("./common.class");
const getInfo = require("../common");
const config = require("../config.json");
const _ = require("underscore");
const schedule = require("node-schedule");
const logger = require("../utils/logger");
// const { storeTableHistory } = require("../classes/gameHistory.class");
const { GetConfig } = require("../connections/mongodb");
const scheduler = require("../scheduler");
const { RESUME_AND_DROP, USER_TURN_START_TIMER, ROBOT_TURN_START_TIMER, ON_TURN_EXPIRE_TIMER } = require("../constants/eventName");
const { addQueue, cancelJob } = require("../scheduler/bullQueue");

const changeTableTurn = (tbId, lastAction) => {
  // console.time("latency timer changeTableTurn");
  try {
    //change turn on table
    /* +-------------------------------------------------------------------+
      desc:function to change table turn
      i/p: tbId = table id 
    +-------------------------------------------------------------------+ */
    getInfo.GetTbInfo(
      tbId,
      { _id: 1, ms: 1, turn: 1, ap: 1, pi: 1, dealer: 1, rSeq: 1, gt: 1 },
      function (table) {
        if (table) {
          logger.info("changeTableTurn---------->>>>>>table: ", table);
          let nextTurn = getInfo.getNextPlayer(table);
          if (
            typeof nextTurn == "undefined" ||
            nextTurn == null ||
            typeof nextTurn.nxt == "undefined"
          ) {
            logger.info(
              'changeTableTurn:::::::::::>>>>>Error:"turn user not found"'
            );
            return false;
          }

          logger.info(
            "changeTableTurn--------",
            table._id,
            "-------->>>>nextTurn: ",
            nextTurn
          ); //nextTurn will only undefined when there is only one player is there with status playing
          let upData = { $set: { turn: nextTurn.nxt } };
          if (nextTurn.chRound) {
            upData["$inc"] = { rSeq: 1 };
          }
          getInfo.UpdateTableData(
            table._id.toString(),
            upData,
            function (table1) {
              if (table1) {
                logger.info("changeTableTurn-------->>>>userturn1");
                const userJobId = `${table.gt}:userTurnStart:${table._id.toString()}:${table.pi[table.turn].uid}`;
                cancelJob(userJobId);
                startUserTurn(table1._id.toString(), lastAction);
              } else {
                logger.info(
                  'changeTableTurn----------->>>>Error:"table not found"'
                );
              }
            }
          );
        } else {
          logger.info(
            "changeTableTurn:::::::::" +
            tbId +
            '::::::::>>>>>Error:"table not found!!!"'
          );
        }
      }
    );
  } catch (error) {
    logger.error("-----> error changeTableTurn", error);
    getInfo.exceptionError(error);
  }
  // console.timeEnd("latency timer changeTableTurn");
};

const startUserTurn = async (tbId, lastAction) => {
  // console.time("latency timer startUserTurn");
  try {
    //initializes the user timer and handovers the control to the turn user
    /* +-------------------------------------------------------------------+
      desc:function to start user turn
      i/p: tbId = table id 
    +-------------------------------------------------------------------+ */
    let jobId = commonClass.GetRandomString(10);
    const { START_TURN_TIMER, TIMER_RESUME_AND_DROP, SECONDARY_TIMER, MAX_TIMEOUT } = GetConfig();
    getInfo.UpdateTableData(
      tbId,
      {
        $set: { la: new Date(), jid: jobId, ctt: new Date() },
        $inc: { tcnt: 1 },
      },
      function (table) {
        if (!table) {
          //condition will be true when there is only one player on table
          logger.info(
            'startUserTurn:::::::::::::::>>>Error: "table not found!!!"'
          );
          return false;
        }
        if (typeof table.turn == "undefined" || table.turn == null) {
          logger.info(
            'startUserTurn::::::::::::if::::::::::>>>>Error: "turn user not found!!!"'
          );
          return false;
        }
        logger.info(
          "startUserTurn----------" +
          table._id +
          "-----------" +
          table.turn +
          "------------>>>>"
        );
        if (
          typeof table.pi[table.turn] == "undefined" ||
          table.pi[table.turn] == null
        ) {
          logger.info(
            'startUserTurn::::::::::::if:::::::::::>>>>>Error: "turn user not found"'
          );
          return false;
        }

        if (
          table.tst == "RoundStarted" &&
          table.pi[table.turn].resumeAndDrop &&
          table.gt !== "Points"
        ) {
          let resumeDropTimer = TIMER_RESUME_AND_DROP ?? 2;
          // resumeDropTimer = commonClass.AddTime(resumeDropTimer);
          // schedule.scheduleJob(
          //   "RESUME_AND_DROP" + table._id.toString() + table.pi[table.turn].uid,
          //   new Date(resumeDropTimer),
          //   function () {
          //     schedule.cancelJob(jobId);
          //     schedule.cancelJob(
          //       "RESUME_AND_DROP" +
          //       jobId +
          //       table._id.toString() +
          //       table.pi[table.turn].uid
          //     );
          //   }
          // );

          const resumeAndDropId = `${table.gt}:resumeAndDrop:${table._id.toString()}:${table.pi[table.turn].uid}`;
          // scheduler.queues.resumeAndDrop({
          //   timer: resumeDropTimer * 1000,
          //   jobId: resumeAndDropId,
          //   tableId: table._id.toString(),
          // });

          const jobData = {
            table: {
              _id: table._id.toString(),
              turn: table.turn,
              uid: table.pi[table.turn].uid,
            },
            calling: RESUME_AND_DROP
          };
          const jobOption = { delay: resumeDropTimer * 1000, jobId: resumeAndDropId };
          addQueue(jobData, jobOption);
        }

        let scale = 0;

        let upData = { $set: { la: new Date() } };

        let next = table.bv;

        next = commonClass.RoundInt(next, 2);

        getInfo.UpdateTableData(tbId, upData, function (table1) {
          if (table1) {
            getInfo.GetUserInfo(
              table.pi[table.turn].uid,
              { _id: 1, "counters.thp": 1, flags: 1 },
              function (uInfo) {
                let thp = 0;
                let time = SECONDARY_TIMER / MAX_TIMEOUT;
                logger.info("startUserTurn--------1--------->>>>time: " + time);
                let t = table.pi[table.turn].secTime;

                let firstPick = false;
                if (table.trCount == 0) {
                  firstPick = true;
                }
                commonClass.FireEventToTable(tbId, {
                  en: "UserTurnStart",
                  data: {
                    si: table.turn,
                    uid: table.pi[table.turn].uid,
                    scale: scale,
                    maxBet: table1.maxBet,
                    bv: table1.bv,
                    bbv: table.bbv,
                    next: next,
                    rSeq: table.rSeq,
                    thp: thp,
                    t: t,
                    time: table.pi[table.turn].secTime,
                    firstPick: firstPick,
                  },
                });
                // storeTableHistory({
                //   tableId: table._id.toString(),
                //   eventName: "UserTurnStart",
                //   tableData: table,
                //   userIndex: table.pi[table.turn].si
                // });
                db.collection("playing_table").findAndModify(
                  { _id: getInfo.MongoID(tbId), "pi.si": table.turn },
                  {},
                  {
                    $inc: {
                      "pi.$.turnCounter": 1,
                    },
                  },
                  { new: true },
                  async function (err, table2) {
                    if (!_.isEmpty(table.pi[table.turn]) && table.pi[table.turn]._ir == 0) {
                      //if it is user turn

                      // let stt = commonClass.AddTime(START_TURN_TIMER); //extra 2 sec
                      // schedule.scheduleJob(jobId, new Date(stt), function () {
                      //   schedule.cancelJob(jobId);

                      const userJobId = `${table.gt}:userTurnStart:${table._id.toString()}:${table.pi[table.turn].uid}`;
                      // scheduler.queues.userTurnStart({
                      //   timer: START_TURN_TIMER * 1000,
                      //   jobId: userJobId,
                      //   tableId: table._id.toString(),
                      //   table
                      // });
                      const jobData = {
                        tableId: table._id.toString(),
                        table,
                        calling: USER_TURN_START_TIMER
                      };
                      const jobOption = { delay: START_TURN_TIMER * 1000, jobId: userJobId };
                      addQueue(jobData, jobOption);
                      // let jId = commonClass.GetRandomString(10);

                      // db.collection("playing_table").findAndModify(
                      //   { _id: getInfo.MongoID(tbId), "pi.si": table.turn },
                      //   {},
                      //   {
                      //     $set: {
                      //       jid: jId,
                      //       "pi.$.tsd": new Date(),
                      //       "pi.$.sct": true,
                      //     },
                      //   },
                      //   { new: true },
                      //   function (err, table1) {
                      //     let stt1 = commonClass.AddTime(t);
                      //     if (parseInt(table.pi[table.turn].secTime) > 0) {
                      //       commonClass.FireEventToTable(tbId, {
                      //         en: "SecondTimeStarted",
                      //         data: {
                      //           si: table.turn,
                      //           uid: table.pi[table.turn].uid,
                      //           t: t,
                      //           time: table.pi[table.turn].secTime,
                      //         },
                      //       });
                      //       storeTableHistory({
                      //         tableId: table._id.toString(),
                      //         eventName: "SecondTimeStarted",
                      //         tableData: table,
                      //         userIndex: table.pi[table.turn].si
                      //       });
                      //       logger.info(
                      //         "startUserTurn--------1--------->>>>t: " + t
                      //       );

                      //       logger.info(
                      //         "startUserTurn---------2-------->>>>stt1: " +
                      //         stt1
                      //       );
                      //       schedule.scheduleJob(
                      //         jId,
                      //         new Date(stt1),
                      //         function () {
                      //           schedule.cancelJob(jId);
                      //           jobTimerClass.onTurnExpire(table1.value);
                      //         }
                      //       );
                      //     } else {
                      //       logger.info(
                      //         "startUserTurn----------3------->>>>stt1: " +
                      //         stt1
                      //       );
                      //       jobTimerClass.onTurnExpire(table1.value);
                      //     }
                      //   }
                      // );
                      // });
                    } else if (!_.isEmpty(table.pi[table.turn]) && table.pi[table.turn]._ir == 1) {
                      //if it is robot turn
                      logger.info('[Bot timeout]-----------false--------->>>>>>>"bot will take turn"', table.pi[table.turn]);
                      let robotTime = commonClass.GetRandomInt(config.ROBOT_TURN_DELAY[0], config.ROBOT_TURN_DELAY[1]);
                      // let rtt = commonClass.AddTime(robotTime);
                      // let jbId = commonClass.GetRandomString(10);
                      // schedule.scheduleJob(jbId, new Date(rtt), function () {
                      //   schedule.cancelJob(jbId);
                      //   // this is fixed for circular dependency problem.
                      //   const robotsClass = require("./robots.class");
                      //   robotsClass.robotTurnStarted(table._id.toString());
                      // });

                      const robotJobId = `${table.gt}:robotTurnStart:${table._id.toString()}:${table.pi[table.turn].uid}`;
                      // scheduler.queues.robotTurnStart({
                      //   timer: robotTime * 1000,
                      //   jobId: robotJobId,
                      //   tableId: table._id.toString(),
                      //   robot: true
                      // });

                      const jobData = {
                        tableId: table._id.toString(),
                        calling: ROBOT_TURN_START_TIMER
                      };
                      const jobOption = { delay: robotTime * 1000, jobId: robotJobId };
                      addQueue(jobData, jobOption);

                      // let stt = commonClass.AddTime(START_TURN_TIMER); //extra 2 sec
                      // schedule.scheduleJob(jobId, new Date(stt), function () {
                      //   schedule.cancelJob(jobId);
                      //   jobTimerClass.onTurnExpire(table);
                      // });
                      const jobId = `${table.gt}:userTurnStart:${table._id.toString()}:${table.pi[table.turn].uid}`;
                      // scheduler.queues.userTurnStart({
                      //   timer: START_TURN_TIMER * 1000,
                      //   jobId,
                      //   table,
                      // });

                      const jobTurnData = {
                        table,
                        calling: USER_TURN_START_TIMER
                      };
                      const jobTurnOption = { delay: START_TURN_TIMER * 1000, jobId };
                      addQueue(jobTurnData, jobTurnOption);

                    } else {
                      logger.info(
                        'startUserTurn::::::::::::else::::::::::>>>>Error: "turn user not found!!!"'
                      );
                    }
                  }
                );
              }
            );
          }
        });
      }
    );
  } catch (error) {
    logger.error("-----> error startUserTurn", error);
    getInfo.exceptionError(error);
  }
  // console.timeEnd("latency timer startUserTurn");
};

const userTurnTimerFinish = ({ tableId, table }) => {
  // console.time("latency timer userTurnTimerFinish");

  try {
    let jId = commonClass.GetRandomString(10);
    db.collection("playing_table").findAndModify(
      { _id: getInfo.MongoID(tableId), "pi.si": table.turn },
      {},
      {
        $set: {
          jid: jId,
          "pi.$.tsd": new Date(),
          "pi.$.sct": true,
        },
      },
      { new: true },
      function (err, table1) {
        let timer = table.pi[table.turn].secTime;
        let stt1 = commonClass.AddTime(timer);
        if (parseInt(table.pi[table.turn].secTime) > 0) {
          commonClass.FireEventToTable(tableId, {
            en: "SecondTimeStarted",
            data: {
              si: table.turn,
              uid: table.pi[table.turn].uid,
              t: timer,
              time: table.pi[table.turn].secTime,
            },
          });

          // storeTableHistory({
          //   tableId: table._id.toString(),
          //   eventName: "SecondTimeStarted",
          //   tableData: table,
          //   userIndex: table.pi[table.turn].si
          // });

          logger.info("startUserTurn--------1--------->>>>t: ", timer);
          logger.info("startUserTurn---------2-------->>>>stt1: ", stt1);
          // schedule.scheduleJob(
          //   jId,
          //   new Date(stt1),
          //   function () {
          //     schedule.cancelJob(jId);
          //     jobTimerClass.onTurnExpire(table1.value);
          //   });

          const jobId = `${table.gt}:userTurnStart:${table._id.toString()}:${table.pi[table.turn].uid}`;
          // scheduler.queues.userTurnStart({
          //   timer: timer * 1000,
          //   jobId,
          //   table: table1.value,
          //   onTurnExpire: true
          // });

          const jobTurnData = {
            table: table1.value,
            calling: ON_TURN_EXPIRE_TIMER
          };
          const jobTurnOption = { delay: timer * 1000, jobId };
          addQueue(jobTurnData, jobTurnOption);
        } else {
          const jobTimerClass = require("./jobTimers.class");
          logger.info("startUserTurn----------3------->>>>stt1: ", "else onTurnExpire");
          jobTimerClass.onTurnExpire(table1.value);
        }
      }
    );
  } catch (error) {
    logger.error("-----> error userTurnTimerFinish", error);
    getInfo.exceptionError(error);
  }
  // console.timeEnd("latency timer userTurnTimerFinish");

};

const resumeAndDropTimer = async (table) => {
  // fixed for module exports inside circular dependency error
  const dropCardClass = require("./dropCards.class");
  await dropCardClass.DropCards(
    { internalDropCards: true },
    {
      tbid: table._id.toString(),
      si: table.turn,
      uid: table.uid,
    },
    false,
    true
  );
};

module.exports = { startUserTurn, changeTableTurn, userTurnTimerFinish, resumeAndDropTimer };

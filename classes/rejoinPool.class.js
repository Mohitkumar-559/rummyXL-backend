const getInfo = require("../common");
const commonClass = require("./common.class");
const schedule = require("node-schedule");
const _ = require("underscore");
const logger = require("../utils/logger");
const splitClass = require("./splitPoint.class");
const { getRedisInstances } = require("../connections/redis");
const { getTableName } = require("../utils");
const collectBootValueClass = require("./collectBootValue.class");
const { cashCut } = require("../common/cashCut");
const commonData = require("./commonData.class");
const socketClass = require("../utils/getSockets");
const { updateUserPrize } = require("../classes/gameHistory.class");
const { removeOnLowCashAfterSplit } = require("../classes/splitPoint.class");
const { GetConfig } = require("../connections/mongodb");
const socketData = new socketClass();
const scheduler = require("../scheduler");
const { REJOIN_POOL_TABLE,SPLIT_DATA } = require("../constants/eventName");
const { addQueue, cancelJob } = require("../scheduler/bullQueue");

const sendRejoinPopUp = (flag, reqData, tst, isActiveRejoinPopup) => {
  try {
    //tries to start the game of there are enough players otherwise puts robots
    /* +-------------------------------------------------------------------+
      desc:function to initialize game
      i/p: tbId = table id
    +-------------------------------------------------------------------+ */
    const { TIME_REJOIN_POOL_TABLE } = GetConfig();
    getInfo.GetTbInfo(reqData.tbid, {}, async function (table) {
      if (tst === "roundWinnerDeclared" && isActiveRejoinPopup && table) {
        let maxPoints = 0;
        logger.info("tst", tst);
        logger.info("reqData.tbid", reqData.tbid);
        for (const element of table.pi) {
          if (
            maxPoints < element.dps &&
            reqData.uid !== element.uid &&
            element.dps < table.pt
          ) {
            maxPoints = element.dps;
          }
        }

        maxPoints++;

        const resp = await db.collection("playing_table").findAndModify(
          { _id: getInfo.MongoID(reqData.tbid), "pi.uid": reqData.uid },
          {},
          {
            $set: { "pi.$.isRejoinPts": maxPoints },
          },
          { new: true }
        );
        logger.info("rmaxPoints", maxPoints);

        const tableName = getTableName(table.gt);
        const category = await db
          .collection(tableName)
          .findOne({ _id: getInfo.MongoID(table.categoryId) });
        let newBootValue = (table.total_player_join + 1) * table.bv;
        let commission = (newBootValue * category.commission) / 100;
        let prize = newBootValue - commission;

        if (resp && resp.value) {
          const tableName = getTableName(table.gt);
          const category = await db.collection(tableName).findOne({
            _id: getInfo.MongoID(table.categoryId),
          });
          const userInfo = await db.collection("game_users").findOne(
            { _id: getInfo.MongoID(reqData.uid) },
            {
              projection: {
                sck: 1,
                SignUpBonus: 1,
                Winning: 1,
                Chips: 1,
                totalcash: 1,
                depositCash: 1,
                Unutilized: 1,
                Bonus: 1,
                referral_bonus: 1,
                addCash_bonus: 1,
                SignUpBonusExpire: 1,
                SignUpBonusStatus: 1,
              },
            }
          );

          let { playable } = await cashCut({
            userInfo,
            entryFee: table.bv,
            cutBonus: +category.bonus,
          });

          let rejoinTimer = TIME_REJOIN_POOL_TABLE ?? 20;
          let playRejoinTime = commonClass.AddTime(playable ? rejoinTimer : 1);
          logger.info("playRejoinTime", playRejoinTime);

          commonClass.SendDirect(
            reqData.uid,
            {
              en: "REJOIN_POPUP",
              data: {
                uid: reqData.uid,
                time: rejoinTimer,
                msg: `You will be rejoining at ${maxPoints} points. The prize money will be updated to ${prize}`,
                maxPoints,
                prize,
                fee: table.bv,
              },
            },
            true
          );

          if (!playable) {
            commonClass.SendData(
              socketData.getSocketObjects(reqData.id),
              "PopUp",
              {
                chips: table.bv,
                flag: "noCash",
                requiredChip: table.bv,
                message: commonData.dataCodesArray[
                  "en:error:1020"
                ].Message.replace("5", category.bonus || 10),
              },
              "error:1020"
            );
            leaveTableClass.LeaveTable(
              { ...flag, eliminated: true },
              reqData,
              function (check) { }
            );
          }

          // schedule.scheduleJob("TIME_REJOIN_POOL_TABLE" + reqData.uid, new Date(playRejoinTime), function () {
          //   schedule.cancelJob("TIME_REJOIN_POOL_TABLE" + reqData.uid);
          // });
          const timer = playable ? rejoinTimer : 1;
          const rejoinPoolTableJobId = `${table.gt}:TIME_REJOIN_POOL_TABLE:${table._id.toString()}:${reqData.uid}`;
          // scheduler.queues.rejoinPoolTable({
          //   timer: timer * 1000,
          //   jobId: rejoinPoolTableJobId,
          //   reqData, flag, tableId: table._id.toString(), playable
          // });
          const jobData = {
            reqData, flag, tableId: table._id.toString(), playable,
            calling: REJOIN_POOL_TABLE
          };
          const jobOption = { delay: timer * 1000, jobId: rejoinPoolTableJobId };
          addQueue(jobData, jobOption);
        }
      } else {
        leaveTableClass.LeaveTable(
          { ...flag, eliminated: true },
          reqData,
          function (check) { }
        );
      }
    });
  } catch (error) {
    logger.error("-----> error sendRejoinPopUp", error);
    getInfo.exceptionError(error);
  }
};

const rejoinPop = async (data, client) => {
  try {
    const tableId = client.tbid ?? data.tbid;
    const userId = client?.uid?.toString() ?? data?.uid?.toString();
    const redisInstances = getRedisInstances();

    const lvt = await redisInstances.SET(`REJOIN_POPUP:${tableId}:${userId}`, 1, { EX: 5, NX: true, });
    if (!lvt) { return false; }

    getInfo.GetTbInfo(tableId, {}, function (table) {
      if (table) {
        getInfo.GetUserInfo(userId, {}, async function (userInfo) {
          if (userInfo) {
            const rejoinPoolTableJobId = `${table.gt}:TIME_REJOIN_POOL_TABLE:${tableId}:${userId}`;
            // scheduler.cancelJob.cancelRejoinPoolTable(rejoinPoolTableJobId);
            cancelJob(rejoinPoolTableJobId);
            // schedule.cancelJob("TIME_REJOIN_POOL_TABLE" + userId);
            if (data.type) {
              const tableName = getTableName(table.gt);
              const category = await db
                .collection(tableName)
                .findOne({ _id: getInfo.MongoID(table.categoryId) });
              let newBootValue = (table.total_player_join + 1) * table.bv;
              let commission = (newBootValue * category.commission) / 100;
              let prize = newBootValue - commission;

              let playerDetail = table.pi.find((x) => x.uid === userId);
              let maxPoints = playerDetail.isRejoinPts;
              let currentUserSi = playerDetail.si;

              let { playable, totalCash } = await cashCut({
                userInfo,
                entryFee: table.bv,
                cutBonus: +category.bonus,
              });

              if (!playable) {
                commonClass.SendData(
                  socketData.getSocketObjects(reqData.id),
                  "PopUp",
                  {
                    chips: table.bv,
                    flag: "noCash",
                    requiredChip: table.bv,
                    message: commonData.dataCodesArray["en:error:1020"].Message.replace("5", category.bonus || 10),
                  },
                  "error:1020"
                );
              }

              if (table.pi[currentUserSi].isRejoinPopup === false) {
                return;
              }

              commonClass.FireEventToTable(tableId.toString(), {
                en: "WINNING_PRIZE",
                data: {
                  prize: prize,
                },
              });

              const resp1 = await db.collection("playing_table").findAndModify(
                { _id: getInfo.MongoID(tableId), "pi.uid": userId },
                {},
                {
                  $set: {
                    "pi.$.isRejoinPopup": false,
                    "pi.$.s": "playing",
                    "pi.$.isEliminate": false,
                    "pi.$.indecl": false,
                    "pi.$.dps": maxPoints,
                    "pi.$.tdps": -maxPoints,
                    prize: prize,
                    pv: prize,
                  },
                  $inc: { total_player_join: 1, "pi.$.isRejoinCount": 1 },
                  $pull: { rejoinUsers: userId },
                  $push: { rejoinAcceptedUsers: getInfo.MongoID(userId) },
                },
                { new: true }
              );
              if (resp1 && resp1.value) {
                commonClass.FireEventToTable(tableId.toString(), {
                  en: "UPDATE_POINTS",
                  data: {
                    dps: maxPoints,
                    tdps: maxPoints,
                    uid: userId,
                  },
                });

                let playerData = resp1.value.pi.find((x) => x.uid == userId);
                if (playerData.uid === userId) {
                  collectBootValueClass.collectBootValue(
                    tableId,
                    "cash",
                    table.gt,
                    playerData.topup + 1,
                    playerData.uid,
                    table.bv,
                    function (res) { }
                  );

                  await db.collection("playing_table").updateOne(
                    {
                      _id: getInfo.MongoID(tableId.toString()),
                      "pi.uid": userId.toString(),
                    },
                    {
                      $set: {
                        "pi.$.totalCash": totalCash,
                      },
                    }
                  );

                  commonClass.SendDirect(
                    userId.toString(),
                    {
                      en: "UserChips",
                      data: {
                        totalCash: totalCash,
                        Chips: -table.bv,
                        t: "Collect Boot Value",
                      },
                    },
                    true
                  );
                }

                let noPendingUserForRejoin = 0;
                resp1.value.pi.forEach((elementPIObj) => {
                  if (elementPIObj.isRejoinPopup) {
                    noPendingUserForRejoin++;
                  }
                });

                // if (noPendingUserForRejoin === 0) splitClass.SplitData(tableId);
                if (noPendingUserForRejoin === 0) {
                  removeOnLowCashAfterSplit(table._id);
                }

                setTimeout(() => {
                  updateUserPrize(resp1.value, userId.toString(), client.si);
                }, 1000);
              }
            } else {
              const resp = await db.collection("playing_table").findAndModify(
                {
                  _id: getInfo.MongoID(tableId.toString()),
                  "pi.uid": userId.toString(),
                },
                {},
                {
                  $set: { "pi.$.isRejoinPopup": false },
                  $pull: { rejoinUsers: userId },
                },
                { new: true }
              );

              if (resp && resp.value) {
                let arrIndex = resp.value.pi.findIndex(
                  (userObj) => userObj.uid === userId
                );
                if (arrIndex !== -1) {
                  leaveTableClass.LeaveTable(
                    { flag: "lostPool", eliminated: true },
                    {
                      id: client.id,
                      uid: userId,
                      _ir: resp.value.pi[arrIndex]._ir,
                      si: resp.value.pi[arrIndex].si,
                      tbid: tableId,
                    },
                    function (check) {
                      logger.info(
                        "removeOnLowCash-----" + tableId + "------>>>check: ",
                        check
                      );

                      let noPendingUserForRejoin = 0;
                      resp.value.pi.forEach((elementPIObj) => {
                        if (elementPIObj.isRejoinPopup) {
                          noPendingUserForRejoin++;
                        }
                      });

                      if (noPendingUserForRejoin === 0) {
                        splitClass.SplitData(tableId);
                      }
                    }
                  );
                }
              }
            }
            commonClass.FireEventToTable(tableId.toString(), {
              en: "REJOIN_POPUP_STATUS",
              data: {
                uid: userId,
                type: !!data.type,
              },
            });
          }
        });
      }
    });
  } catch (error) {
    logger.error("-----> error rejoinPop", error);
    getInfo.exceptionError(error);
  }
};

const sendRejoinPopUpTimer = ({ reqData, flag, tableId, playable }) => {
  const { SPLIT_DATA_AFTER_REJOIN_POPUP_STATUS } = GetConfig();
  commonClass.FireEventToTable(tableId, {
    en: "REJOIN_POPUP_STATUS",
    data: {
      uid: reqData.uid,
      type: false,
    },
  });
  logger.info("leaveTableClass", flag, reqData);
  if (playable) {
    leaveTableClass.LeaveTable(
      { ...flag, eliminated: true },
      reqData,
      async function (check) {
        logger.info("SplitData", tableId);
        // splitClass.SplitData(tableId);
        const redisInstances = getRedisInstances();
        const lvt = await redisInstances.SET(`SplitData:${tableId}`, 1, { EX: 3, NX: true, });
        if (!lvt) {
          logger.error("--------- >>>>>>>> SplitData", "SplitData");
          return false;
        }
        const jobId = `$Pool:splitDataAfterRejoinStatus:${tableId}`;

        const jobData = {
          tableId:tableId,
          // lastAction: "REJOIN_POPUP_STATUS",
          calling: SPLIT_DATA
        };
        const jobOption = { delay:SPLIT_DATA_AFTER_REJOIN_POPUP_STATUS, jobId };
        addQueue(jobData, jobOption);
        // setTimeout(()=>{
        //   splitClass.SplitData(tableId);

        // },3000)
        
      });
  } else {
    splitClass.SplitData(tableId);
  }
};

module.exports = { sendRejoinPopUp, rejoinPop, sendRejoinPopUpTimer };

const _ = require("underscore");
const commonClass = require("./common.class.js"); //common functions
const logger = require("../utils/logger");
const getInfo = require("../common");
const { cardChange } = require("../utils/winnerCardChanges");
const { getTableName } = require("../utils");
const { GetConfig } = require("../connections/mongodb");

const tableConfiguration = async (result, _isHelp, jnbk, client, cb) => {
  try {
    /* +-------------------------------------------------------------------+
    desc:function to set table configurations
    i/p: result = table details,_isHelp = 1/0 is help is enabled or not,client = socket object, cb = callback function
  +-------------------------------------------------------------------+ */
    if (!result) {
      return false;
    }
    logger.info("-- >> tableConfiguration" + result._id);
    const {
      ROUND_START_TIMER, START_TURN_TIMER, TIMER_FINISH, ROUND_START_TIMER_POINT_SIX, ROUND_START_TIMER_POINT_TWO,
      ROUND_START_TIMER_POOL_SIX, ROUND_START_TIMER_POOL_TWO, ROUND_START_TIMER_POOL, SECONDARY_TIMER, MAX_TIMEOUT, TIMER_REMATCH,
      TIMER_BACK_TO_TABLE
    } = GetConfig();
    let st = new Date();
    //client.tbid = tbId; //saving current table to session.
    let rst = ROUND_START_TIMER;
    let stt = START_TURN_TIMER;
    let fns = TIMER_FINISH;
    if (result.gt == "Points") {
      let realUser = result.pi.filter((x) => x._ir === 0);
      if (result.ms == 6) {
        rst = ROUND_START_TIMER_POINT_SIX;
      } else if (result.ms == 2) {
        rst = ROUND_START_TIMER_POINT_TWO;
      }
      if (realUser.length <= result.backToTableUser.length && result.ap >= result.ms) {
        rst = TIMER_BACK_TO_TABLE;
      }
      logger.info("tableConfiguration rst", rst);
      logger.info("tableConfiguration realUser.length ", realUser.length);
      logger.info("tableConfiguration result.backToTableUser.length", result.backToTableUser.length);

      // if (result.ms == 6) {
      //   rst = ROUND_START_TIMER_POINT_SIX;
      // } else if (result.ms == 2) {
      //   rst = ROUND_START_TIMER_POINT_TWO;
      // }
      // else if (realUser.length <= result.backToTableUser.length && result.ap >= result.ms && Timer > TIMER_BACK_TO_TABLE) {
      //   rst = TIMER_BACK_TO_TABLE ?? 5;
      // }
    } else if (result.gt == "Pool") {
      if (result.ms == 6) {
        rst = ROUND_START_TIMER_POOL_SIX;
      } else if (result.ms == 2) {
        rst = ROUND_START_TIMER_POOL_TWO;
      }

      if (result.round > 0) {
        rst = ROUND_START_TIMER_POOL;
      }

    } else if (result.gt == "Deal") {
      if (result.ms == 6) {
        rst = ROUND_START_TIMER;
      }
      if (result.round > 0) {
        rst = ROUND_START_TIMER_POOL;
      }
    }

    result.next = result.bv;

    result.next = commonClass.RoundInt(result.next, 2);
    if (result.tie && result.tst != "RoundTimerStarted") {
      result.round -= 1;
    }

    //getting Timer information to client so they can show timer on profile picture
    result.maxRst = rst;
    result.secT = false;
    result.trnuid = "";
    if (typeof result.turn != "undefined" && result.turn != -1) {
      result.trnuid = result.pi[result.turn].uid;
    }

    if (result.tst == "RoundTimerStarted") {
      result.round += 1;
      result.Timer = parseInt(rst) - commonClass.GetTimeDifference(result.ctt, st, "second");
    } else if (result.tst == "RoundStarted") {
      result.Timer = parseInt(stt) - commonClass.GetTimeDifference(result.ctt, st, "second");

      if (result.Timer <= 0) {
        let time = SECONDARY_TIMER / MAX_TIMEOUT;
        logger.info("tableConfiguration--------1--------->>>>time: ", time);
        let t = result.pi[result.turn].secTime;

        stt += t;
        result.secT = true;
        let Timer = parseInt(stt) - commonClass.GetTimeDifference(result.ctt, st, "second");
        result.Timer = Timer;
      }
    } else if (result.tst == "Finished") {
      result.Timer = parseInt(fns) - commonClass.GetTimeDifference(result.ctt, st, "second");
    } else if (result.tst == "RematchTimerStarted") {
      result.Timer = TIMER_REMATCH - commonClass.GetTimeDifference(result.ctt, st, "second");
    } else if (result.tst == "roundWinnerDeclared") {
      logger.info("isRejoinPopupTime----->", result.isRejoinPopupTime);
      // logger.info("SplitPopupTime----->", result.SplitPopupTime);
      if (result.isRejoinAndSliptPopupTime) {
        result.Timer = result.isRejoinAndSliptPopupTime - commonClass.GetTimeDifference(result.isRejoinPopupTime, st, "second");
      } else {
        result.Timer = 0;
      }
    } else {
      result.Timer = 0;
    }
    result._isHelp = _isHelp;
    logger.info("result.Timer----->", result.Timer);
    let { pi } = result;
    let aSi = [];
    // let rejoinUserOnly=[];
    for (let k in pi) {
      if (
        !_.isEmpty(pi[k]) &&
        typeof pi[k].si != "undefined" &&
        (pi[k].s == "playing" || pi[k].s == "finish" || pi[k].s == "declare")
      ) {
        aSi.push(pi[k].si);
      }

      // if(client.uid==k.uid){
      //   rejoinUserOnly.push(k);
      // }

      if (pi[k].theme == null || typeof pi[k].theme == "undefined") {
        pi[k].theme = "red";
      }
    }
    for (const element of result.hist) {
      if ((result.gt == "Pool" || result.gt == "Deal") && element?.rndCount == result.round) {
        result.pi[element.si] = element;
      } else if (element && result.gt == "Points") {
        result.pi[element.si] = element;
      }
    }

    const userData = await db.collection("game_users").findOne(
      { _id: getInfo.MongoID(client.uid) },
      {
        projection: {
          SignUpBonus: 1,
          Chips: 1,
          Winning: 1,
          totalcash: 1,
          depositCash: 1,
          Bonus: 1,
        },
      }
    );
    const tableUser = result.pi.find((e) => e.uid == client.uid);
    result.pi[tableUser.si].totalCash = userData.totalcash;
    // result.pi=rejoinUserOnly;
    result.pi = cardChange(result.pi);
    result.asi = aSi;
    result.scale = 0;
    filterDataGTI(result, client);
    if (typeof cb == "function") {
      cb();
    }
  } catch (error) {
    logger.error("-----> error tableConfiguration", error);
    getInfo.exceptionError(error);
  }
};

const filterDataGTI = (tableData, client) => {
  try {
    // logger.info('filterData--------------->>>>>>>userData: ',userData,' client.uid: '+client.uid);
    const { TIME_REJOIN_POOL_TABLE, TIMER_SPLIT } = GetConfig();
    if (tableData) {
      delete tableData.HumanCount;
      delete tableData.RobotCount;
      delete tableData.cd;
      delete tableData.ctrlServer;
      delete tableData.hist;
      delete tableData.initServer;
      delete tableData.isSpc;
      delete tableData.la;
      delete tableData.rSeq;
      delete tableData._artFlag;
      delete tableData._isHelp;
      delete tableData._qstWin;
      delete tableData.prlnt;
      delete tableData.scale;
      delete tableData.maxRst;
      delete tableData.next;
      delete tableData.catid;
      delete tableData.rejoinAcceptedUsers;
      delete tableData.dealrmch;
      delete tableData.tdsid;
      delete tableData._stuck;
      delete tableData._isWinner;
      delete tableData._isLeave;
      delete tableData.uCount;
      delete tableData.nrg;
      delete tableData.addtime;
      delete tableData.dealwin;
      delete tableData.sub_id;
      delete tableData.game_id;
      delete tableData.rid;
      delete tableData.ctt;
      delete tableData.maxBet;
      delete tableData.playCount;
      delete tableData.declCount;
      delete tableData.tcnt;
      delete tableData.trCount;
      // delete tableData.tie;
      delete tableData.deals;
      delete tableData.lvc;
      delete tableData.hint;
      delete tableData.reke;
      delete tableData.bbv;
      delete tableData.link;
      delete tableData.raise;
      delete tableData.maxBootValue;
      delete tableData._ip;
      delete tableData.deck;

      tableData.pi = tableData.pi.map(
        ({
          jt,
          gst,
          gedt,
          rndCount,
          jiid,
          tid,
          bet,
          dealewinner,
          dCards,
          ip,
          isCollect,
          _ir,
          _iw,
          lpc,
          leave,
          maxUserTimeout,
          mobile,
          nuser,
          occ,
          play,
          pco,
          _isleave,
          _rematch,
          ...keepAttrs
        }) => keepAttrs
      );

      logger.info(
        "filterDataGTI----------------->>>>>: tableData: ",
        tableData,
        client.un
      );
      commonClass.SendData(client, "GetTableInfo", tableData);

      setTimeout(async () => {
        const tableDetails = await db.collection("playing_table").findOne({
          _id: getInfo.MongoID(tableData._id),
          "pi.uid": client.uid,
        });

        if (tableDetails) {
          if (tableDetails.gt != "Points") {
            checkForResumeAndDrop(tableDetails, client.si);
          }

          if (
            typeof client.si != "undefined" &&
            !_.isEmpty(tableDetails.pi[client.si]) &&
            tableDetails.pi[client.si].isRejoinPopup
          ) {
            let playerDetail = tableDetails.pi.find(
              (x) => x.uid === tableDetails.pi[client.si].uid
            );
            let maxPoints = playerDetail.isRejoinPts;
            const tableName = getTableName(tableDetails.gt);
            const category = await db
              .collection(tableName)
              .findOne({ _id: getInfo.MongoID(tableDetails.categoryId) });
            let newBootValue = tableDetails.total_player_join * tableDetails.bv;
            let commission = (newBootValue * category.commission) / 100;
            let prize = newBootValue - commission;

            let rejoinPopupTimer = (TIME_REJOIN_POOL_TABLE ?? 20) -
              commonClass.GetTimeDifference(
                tableDetails.pi[client.si].isRejoinPopupTime,
                new Date(),
                "second"
              );
            logger.info(
              "rejoinPopupTimer ------- : : ",
              rejoinPopupTimer,
              tableDetails.pi[client.si].isRejoinPopupTime,
              new Date()
            );
            if (rejoinPopupTimer > 1) {
              commonClass.SendDirect(
                tableDetails.pi[client.si].uid,
                {
                  en: "REJOIN_POPUP",
                  data: {
                    time: rejoinPopupTimer > 0 ? rejoinPopupTimer : 0,
                    msg: `You will be rejoining at ${maxPoints} points. The prize money will be updated to ${prize}`,
                    flag: "lostPool",
                    maxPoints,
                    prize,
                    fee: tableDetails.bv,
                  },
                },
                true
              );

              commonClass.FireEventToTable(tableDetails._id.toString(), {
                en: "REJOIN_WAIT_POPUP",
                data: {
                  uid: tableDetails.rejoinUsers,
                  time: tableData.Timer,
                  msg: "Wait for other players",
                },
              });
            }
          }
          setTimeout(async () => {
            if (
              typeof client.si != "undefined" &&
              !_.isEmpty(tableDetails.pi[client.si]) &&
              tableDetails.SplitPopupFlag
            ) {
              let rst = TIMER_SPLIT ?? 20;
              let RemainingTime =
                rst -
                commonClass.GetTimeDifference(
                  tableDetails.SplitPopupTime,
                  new Date()
                );
              logger.info("RemainingTime------>", RemainingTime);

              if (RemainingTime > 1) {
                const updateSplitRecord = await db
                  .collection("split_data")
                  .findOne({
                    tjid: tableDetails.tjid,
                    round: tableDetails.round,
                  });
                commonClass.FireEventToTable(tableDetails._id.toString(), {
                  en: "SplitData",
                  data: {
                    dropArr: updateSplitRecord.split,
                    time: RemainingTime > 0 ? RemainingTime : 0,
                    flag: false,
                    closeButtonFlag: false,
                  },
                });
              }
            }
            setTimeout(async () => {
              if (
                typeof client.si != "undefined" &&
                !_.isEmpty(tableDetails.pi[client.si]) &&
                tableDetails.Timer > 1 &&
                tableDetails.tst === "RematchTimerStarted"
              ) {
                const userInfo_1 = await db.collection("game_users").findOne(
                  {
                    _id: getInfo.MongoID(client.uid),
                  },
                  {
                    projection: {
                      SignUpBonusStatus: 1,
                      SignUpBonus: 1,
                      totalcash: 1,
                      addCash_bonus: 1,
                      referral_bonus: 1,
                      Bonus: 1,
                      tbid: 1,
                      tbd: 1,
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
                  totalCashBonus + SignUpBonus + totalReferralBonus + cmsBonus;
                if (userInfo_1.tbid !== "") {
                  commonClass.SendDirect(
                    tableDetails.pi[client.si].uid,
                    {
                      en: "Rematch",
                      data: {
                        timer: tableDetails.Timer,
                        lockInTime: 1,
                        rank: tableDetails.pi[client.si]._iw === 1 ? 1 : 2,
                        bv: tableDetails.bv,
                        winPrize:
                          tableDetails.pi[client.si]._iw === 1
                            ? tableDetails.prize
                            : 0,
                        prize: tableDetails.prize,
                        totalCash:
                          tableDetails.pi[client.si]._iw === 1
                            ? userInfo_1.totalcash + tableDetails.prize
                            : userInfo_1.totalcash,
                        bonusCash: totalBonus,
                        message:
                          tableDetails.pi[client.si]._iw === 1
                            ? "Yeah! you won"
                            : "Well played. You finished 2nd.",
                        notifyMessage: "Do you want to request a rematch?",
                        catid: tableDetails.categoryId,
                        pt: 0,
                      },
                    },
                    true
                  );
                }
              }
            }, 500);
          }, 500);
        }
      }, 500);
    } else {
      logger.info('filterDataGTI----------------->>>>>>"data not found"');
    }
  } catch (error) {
    logger.error("-----> error filterDataGTI", error);
    getInfo.exceptionError(error);
  }
};

async function checkForResumeAndDrop(tableData, seatIndex) {
  try {
    const { MAX_DEADWOOD_PTS, FIRST_DROP, MIDDLE_DROP, FIRST_DROP_101, MIDDLE_DROP_101, FIRST_DROP_201, MIDDLE_DROP_201, FIRST_DROP_61, MIDDLE_DROP_61 } = GetConfig();
    if (tableData && !tableData?.pi[seatIndex]?.indecl) {
      let first_drop = MAX_DEADWOOD_PTS * FIRST_DROP;
      let middle_drop = MAX_DEADWOOD_PTS * MIDDLE_DROP;
      if (tableData.gt == "Pool") {
        if (tableData.pt == 101) {
          first_drop = FIRST_DROP_101;
          middle_drop = MIDDLE_DROP_101;
        } else if (tableData.pt == 201) {
          first_drop = FIRST_DROP_201;
          middle_drop = MIDDLE_DROP_201;
        } else {
          first_drop = FIRST_DROP_61;
          middle_drop = MIDDLE_DROP_61;
        }
      }

      if (
        tableData?.pi[seatIndex]?.s == "drop" &&
        !tableData?.pi[seatIndex]?.resumeAndDrop
      ) {
        const cutPoints =
          tableData.pi[seatIndex].pickCount < 1 ? first_drop : middle_drop;

        commonClass.FireEventToTable(tableData._id.toString(), {
          en: "RESUME_AND_DROP",
          data: {
            uid: tableData.pi[seatIndex].uid,
            si: tableData.pi[seatIndex].si,
            s: tableData.pi[seatIndex].s,
            msg: `You've dropped from this deal and ${cutPoints} pts will be added to your score. Please wait for the next deal.`,
            buttonShow: false,
            popupShow: true,
          },
        });
      } else if (
        tableData?.pi[seatIndex]?.s == "drop" ||
        tableData?.pi[seatIndex]?.resumeAndDrop
      ) {
        const cutPoints =
          tableData.pi[seatIndex].pickCount < 1 ? first_drop : middle_drop;

        let msg =
          tableData.pi[seatIndex].s == "drop" &&
            tableData?.pi[seatIndex]?.resumeAndDrop
            ? `You've dropped from this deal. Click on resume game to continue playing and prevent auto drop.`
            : tableData.pi[seatIndex].s != "drop" &&
              tableData?.pi[seatIndex]?.resumeAndDrop
              ? `You will be dropped on your turn and ${cutPoints} pts will be added to your score.`
              : tableData.pi[seatIndex].s == "drop" &&
                !tableData?.pi[seatIndex]?.resumeAndDrop
                ? `You've dropped from this deal and ${cutPoints} pts will be added to your score. Please wait for the next deal.`
                : "";

        let buttonShow = !!tableData?.pi[seatIndex]?.resumeAndDrop;

        commonClass.FireEventToTable(tableData._id.toString(), {
          en: "RESUME_AND_DROP",
          data: {
            uid: tableData.pi[seatIndex].uid,
            si: tableData.pi[seatIndex].si,
            s: tableData.pi[seatIndex].s,
            msg: msg,
            buttonShow,
            popupShow: true,
          },
        });
      }
    }
  } catch (error) {
    logger.error("-----> error checkForResumeAndDrop", error);
    getInfo.exceptionError(error);
  }
}

module.exports = { tableConfiguration };

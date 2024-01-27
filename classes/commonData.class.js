const { cashCut } = require("../common/cashCut");
const logger = require("../utils/logger");
const _ = require("underscore");
const config = require("../config.json");
const commonClass = require("./common.class.js"); //common functions
const trackClass = require("./track.class"); //common functions
const getInfo = require("../common");
const tableActivityClass = require("./tableActivity.class");
const profileClass = require("./profile.class");
const { getTableName } = require("../utils");
const { GetConfig } = require("../connections/mongodb");
const dataCodesArray = [];
const scheduler = require("../scheduler");
const { UPDATE_ON_DELAY } = require("../constants/eventName");
const { addQueue } = require("../scheduler/bullQueue");

const PrepareDataCodes = (cb) => {
  try {
  } catch (error) {
    logger.error("-----> error PrepareDataCodes", error);
    getInfo.exceptionError(error);
  }
  /* +-------------------------------------------------------------------+
          desc: this function is use to refresh the datacode for popup.
      +-------------------------------------------------------------------+ */

  db.collection("data_codes")
    .find()
    .toArray(function (err, codes) {
      for (let e in codes) {
        for (let f in codes[e]["Messages"]) {
          let obj = {
            Title: codes[e]["Messages"][f].Title,
            Message: codes[e]["Messages"][f].Message,
            Lc: codes[e]["Messages"][f].LanguageCode,
          };
          dataCodesArray[
            codes[e]["Messages"][f].LanguageCode +
            ":" +
            codes[e]["codeType"] +
            ":" +
            codes[e]["code"]
          ] = obj;
        }
        delete obj;
      }
      if (typeof cb == "function") {
        cb();
      }
    });
};
const PrepareScoreData = (cb) => {
  try {
  } catch (error) {
    logger.error("-----> error PrepareScoreData", error);
    getInfo.exceptionError(error);
  }
  /* +-------------------------------------------------------------------+
          desc: this function is use to initialize score data
      +-------------------------------------------------------------------+ */
  // logger.info('PrepareScoreData-------------->>>>>>>>');
  db.collection("user_scores")
    .find({})
    .project({ _id: 0 })
    .sort({ from: -1 })
    .toArray(function (err, scores) {
      CWIN = [];
      CLOSS = [];
      DSI = [];
      CBAL = [];
      CPP = [];
      NDUC = [];
      let i,
        cwin = [],
        closs = [],
        dsi = [],
        cbal = [],
        cpp = [],
        nduc = [];

      for (i in scores) {
        switch (scores[i].type) {
          case "CWIN":
            delete scores[i].type;
            cwin.push(scores[i]);
            break;
          case "CLOSS":
            delete scores[i].type;
            closs.push(scores[i]);
            break;
          case "DSI":
            delete scores[i].type;
            dsi.push(scores[i]);
            break;
          case "CBAL":
            delete scores[i].type;
            cbal.push(scores[i]);
            break;
          case "CPP":
            delete scores[i].type;
            cpp.push(scores[i]);
            break;
          case "NDUC":
            delete scores[i].type;
            nduc.push(scores[i]);
            break;
        }
      }
      CWIN = cwin;
      CLOSS = closs;
      DSI = dsi;
      CBAL = cbal;
      CPP = cpp;
      NDUC = nduc;
      if (typeof cb == "function") {
        cb();
      }
    });
};

const PrepareRCData = (cb) => {
  try {
  } catch (error) {
    logger.error("-----> error PrepareRCData", error);
    getInfo.exceptionError(error);
  }
  /* +-------------------------------------------------------------------+
          desc: this function is use to initialize robot card data
      +-------------------------------------------------------------------+ */
  db.collection("robot_cards")
    .find({})
    .project({ cType: 0 })
    .toArray(function (err, resp) {
      if (resp.length > 0) {
        let rCards = {
          Newbie: {
            PURE: {},
            SEQS: {},
            SETS: {},
            JW: {},
            CSEQS: {},
            CSETS: {},
          },
          Amateur: {
            PURE: {},
            SEQS: {},
            SETS: {},
            JW: {},
            CSEQS: {},
            CSETS: {},
          },
          Pro: {
            PURE: {},
            SEQS: {},
            SETS: {},
            JW: {},
            CSEQS: {},
            CSETS: {},
          },
          God: {
            PURE: {},
            SEQS: {},
            SETS: {},
            JW: {},
            CSEQS: {},
            CSETS: {},
          },
        };

        for (let i in resp) {
          eval(
            "rCards." +
            resp[i].rType +
            "." +
            resp[i].key +
            " = {nos0:resp[i].nos0,nos1:resp[i].nos1,nos2:resp[i].nos2,nos3:resp[i].nos3}"
          );
        }
        RCARDS = rCards;
        // logger.info('PrepareRCData------------->>>>>> RCARDS : ',RCARDS);
      } else {
        logger.info(
          'PrepareRCData::::::::::::::::>>>>>>Error:"data not found!!!"'
        );
      }
      if (typeof cb == "function") {
        cb();
      }
    });
};
const PreparePlayData = (cb) => {
  /* +-------------------------------------------------------------------+
          desc: this function is use to initialize robot playing data
      +-------------------------------------------------------------------+ */
  db.collection("robot_play")
    .find({})
    .toArray(function (err, resp) {
      if (resp.length > 0) {
        let rPlay = {
          PICK: {
            Newbie: {},
            Amateur: {},
            Pro: {},
            God: {},
          },
          DISCARD: {
            Newbie: {},
            Amateur: {},
            Pro: {},
            God: {},
          },
        };
        for (let i in resp) {
          eval(
            "rPlay." +
            resp[i].action +
            "." +
            resp[i].rType +
            " = {logic1:resp[i].logic1,logic2:resp[i].logic2,logic3:resp[i].logic3}"
          );
        }
        RPLAY = rPlay;
        // logger.info('PreparePlayData-------------->>>>> RPLAY: ',RPLAY);
      } else {
        logger.info(
          'PreparePlayData::::::::::::::::::::::::>>>>>Error:"data not found!!!"'
        );
      }
      if (typeof cb == "function") {
        cb();
      }
    });
};
const PrepareDropData = (cb) => {
  /* +-------------------------------------------------------------------+
          desc: this function is use to initialize robot drop data
      +-------------------------------------------------------------------+ */
  db.collection("robot_drop")
    .find({})
    .toArray(function (err, resp) {
      if (resp.length > 0) {
        let rDrop = {
          first: {
            Newbie: {},
            Amateur: {},
            Pro: {},
            God: {},
            logic1: {},
            logic2: {},
          },
          middle: {
            Newbie: {},
            Amateur: {},
            Pro: {},
            God: {},
            logic1: {},
            logic2: {},
          },
        };
        for (let i in resp) {
          let pts = typeof resp[i].pts != "undefined" ? ",pts:resp[i].pts" : "";

          if (resp[i].dType == "logic") {
            eval(
              "rDrop." +
              resp[i].dropType +
              "." +
              resp[i].rType +
              " = {logic1:resp[i].logic1,logic2:resp[i].logic2}"
            );
          } else if (resp[i].dType == "proc") {
            if (resp[i].logicN == 1) {
              eval(
                "rDrop." +
                resp[i].dropType +
                ".logic1= {base:resp[i].base,pures:resp[i].pures,seqs:resp[i].seqs,sets:resp[i].sets}"
              );
            } else {
              eval(
                "rDrop." +
                resp[i].dropType +
                ".logic2 = {base:resp[i].base,pures:resp[i].pures,seqs:resp[i].seqs,sets:resp[i].sets,jw:resp[i].jw,cSeqs:resp[i].cSeqs,cSets:resp[i].cSets" +
                pts +
                "}"
              );
            }
          }
        }
        RDROP = rDrop;
        // logger.info('PreparedropData-------------->>>>> RDROP: ',RDROP);
      } else {
        logger.info(
          'PrepareDropData::::::::::::::::::::::::>>>>>Error:"data not found!!!"'
        );
      }
      if (typeof cb == "function") {
        cb();
      }
    });
};

const UpdateUserChips = (id, Chips, t, callback) => {
  /* +-------------------------------------------------------------------+
          desc:this function use to update the user chips.
          i/p:userid,chips,t:status
          o/p:updated user chips
      +-------------------------------------------------------------------+ */
  logger.info("UpdateUserChips-->>>id: ", id, " chips: ", Chips, " t: ", t);
  if (!id) {
    logger.info('UpdateUserChips---------->>>>Error:"id not found!!!"');
    return false;
  }
  id = id.toString();

  getInfo.GetUserInfo(
    id,
    {
      tId: 1,
      Chips: 1,
      wc: 1,
      totalcash: 1,
      "counters.hcl": 1,
      "counters.mcw": 1,
      un: 1,
      sck: 1,
      "flags._ir": 1,
      league: 1,
      tbid: 1,
    },
    function (userInfo) {
      if (userInfo && userInfo._id) {
        let playWinTxt = [
          "Won Mini Game",
          "Card Drop Deduction",
          "Table Leave Deduction",
          "Collect Boot Value",
          "Game Lost",
          "Game Win",
          "Game Draw",
          "CB Game Win",
          "Split Accept",
        ];

        let fChips = Chips + userInfo.Chips < 0 ? 0 : Chips + userInfo.Chips;
        let wChips = _.contains(playWinTxt, t)
          ? Chips + userInfo.wc
          : userInfo.wc;
        let mwChips =
          Chips > userInfo.counters.mcw && _.contains(playWinTxt, t)
            ? Chips
            : userInfo.counters.mcw;
        logger.info("UpdateUserChips-->>>fChips: ", fChips);
        logger.info("fChips----------->", fChips);
        if (userInfo.flags._ir == 0) {
          trackClass.Chips_Track(userInfo, Chips, t);
        } else {
          //trackClass.Robot_Chips_Track(userInfo,Chips,t);
        }

        let setInfo = {};
        setInfo.$set = {};

        if (userInfo.counters.hcl < fChips) {
          setInfo.$set["counters.hcl"] = fChips;
        }
        setInfo.$set["wc"] = wChips;
        setInfo.$set["Chips"] = fChips;
        setInfo.$set["counters.mcw"] = mwChips;

        // logger.info('UpdateUserChips------->>>setInfo: ',setInfo);

        if (Chips > 0) {
          setInfo.$set["flags._freeSpinNoti"] = 0;
        }
        logger.info("setInfo-------------->", setInfo);
        db.collection("game_users").updateOne(
          { _id: getInfo.MongoID(id) },
          setInfo,
          function (err, resp) {
            //logger.info('sending data to '+userInfo.un);
            if (userInfo.flags._ir == 0) {
              commonClass.SendDirect(
                userInfo._id,
                {
                  en: "UserChips",
                  data: {
                    chips: fChips,
                    totalCash: userInfo.totalcash,
                    status: t,
                  },
                },
                true
              ); //publishing to exchange
            }
            if (userInfo.tbid != "") {
              Chips = Math.abs(Chips);
              db.collection("playing_table").updateOne(
                {
                  _id: getInfo.MongoID(userInfo.tbid),
                  "pi.uid": userInfo._id.toString(),
                },
                {
                  $set: { "pi.$.Chips": fChips },
                  $inc: {
                    "pi.$.upc": Chips,
                    "pi.$.userViewCashChips": Chips,
                  },
                },
                function (err, respp) {
                  //*****************table chips update code*************
                  if (!err) {
                    db.collection("playing_table").findOne(
                      {
                        _id: getInfo.MongoID(userInfo.tbid),
                        "pi.uid": userInfo._id.toString(),
                      },
                      { projection: { "pi.$": 1 } },
                      function (err1, resp1) {
                        // db.collection('playing_table').findOne({_id:getInfo.MongoID(userInfo.tbid),'pi.uid':userInfo._id.toString()},{'pi.$':1},function(err1,resp1){
                        logger.info(
                          "UpdateUserChips------------------->>>>>resp1: ",
                          resp1
                        );
                        if (
                          resp1 &&
                          resp1.pi &&
                          resp1.pi.length > 0 &&
                          typeof resp1.pi[0].si != "undefined"
                        ) {
                          commonClass.FireEventToTable(userInfo.tbid, {
                            en: "UserTurnChange",
                            data: {
                              si: resp1.pi[0].si,
                              uid: resp1.pi[0].uid,
                              chips: fChips,
                              upc: resp1.pi[0].upc,
                              userViewCashChips: resp1.pi[0].upc,
                              totalCash: userInfo.totalcash,
                              reason: t,
                            },
                          });
                          if (typeof callback == "function") {
                            callback(fChips);
                          }
                        } else {
                          if (typeof callback == "function") {
                            callback(fChips);
                          }
                        }
                      }
                    );
                  }
                  //******************code ends here********************
                }
              );
            } else {
              if (typeof callback == "function") {
                callback(fChips);
              }
            }
          }
        );
      } else if (typeof callback == "function") {
        callback(0);
      }
    }
  );
};
const UpdateCashForPlay = (tbid, id, topup, Chips, t, callback) => {
  /* +-------------------------------------------------------------------+
          desc:this function use to update the user chips.
          i/p:userid,chips,t:status
          o/p:updated user chips
      +-------------------------------------------------------------------+ */
  logger.info("UpdateUserCash-->>>id: ", id, " chips: ", Chips, " t: ", t);
  if (!id) {
    logger.info('UpdateUserCash---------->>>>Error:"id not found!!!"');
    return false;
  }
  id = id.toString();

  getInfo.GetUserInfo(id, {}, function (userInfo) {
    if (userInfo) {
      logger.info("UpdateUserChipsForGame -----------------userInfo", userInfo);

      let cth = Math.abs(Chips);
      logger.info("cth-------------->", cth);
      logger.info("sending data to " + userInfo.un);
      if (userInfo.flags._ir == 0) {
        db.collection("playing_table").findOne(
          { _id: getInfo.MongoID(tbid) },
          {},
          function (err1, tbdata) {
            if (tbdata) {
              if (tbdata.gt != "undefined" && tbdata.gt == "Points") {
                tbdata.gt = "Points";
              }

              let ctc =
                Chips + userInfo.totalcash < 0 ? 0 : Chips + userInfo.totalcash;
              let insertData = {
                uid: getInfo.MongoID(userInfo._id.toString()),
                tbid: tbid,
                tjid: tbdata.tjid,
                gameType: tbdata.gt,
                un: userInfo.un,
                ue: userInfo.ue,
                c: Chips,
                pc: userInfo.totalcash,
                tp: topup > 0 ? "Auto rebuy" : t,
                ctc: ctc, //resp.value.totalcash, //current total cash
                sts: "success",
                tId: userInfo.tId,
                depositCash: userInfo.depositCash,
                withdrawableCash: userInfo.Winning,
                ms:tbdata.ms,
                gt:tbdata.gt,
                round:tbdata.round,
                ap:tbdata.ap
              };

              logger.info("sending data to inserData: ", insertData);
              trackClass.Cash_Track(insertData, async function (trackdata) {
                logger.info("trackdata:   >>>>>>>>>>>>>>", trackdata);
                if (trackdata && typeof trackdata._id != "undefined") {
                  logger.info("joinTable api data cth:", cth);

                  let udata = cth;
                  if (udata) {
                    logger.info("joinTable api data udata:", udata);
                    let trobj = {
                      tbid: tbid,
                      uid: userInfo._id.toString(),
                      rid: 0,
                      s: "joinTable api response true",
                    };
                    trackClass.Leave_Track(trobj);
                    let fChips = -udata;

                    let setInfo = {
                      $set: {},
                    };
                    logger.info(
                      "tbdata.gttbdata.gttbdata.gt",
                      tbdata.gt,
                      tbdata.categoryId
                    );
                    let cutBonus = 0;
                    const tableName = getTableName(tbdata.gt);
                    const category = await db.collection(tableName).findOne({
                      _id: getInfo.MongoID(tbdata.categoryId),
                    });
                    // if (tbdata.gt == "Points") {
                    //   category = await db
                    //     .collection("point_category")
                    //     .findOne(
                    //       { _id: getInfo.MongoID(tbdata.categoryId) },
                    //       { projection: { bonus: 1 } }
                    //     );
                    // } else if (tbdata.gt == "Pool") {
                    //   category = await db
                    //     .collection("pool_category")
                    //     .findOne(
                    //       { _id: getInfo.MongoID(tbdata.categoryId) },
                    //       { projection: { bonus: 1 } }
                    //     );
                    // } else if (tbdata.gt == "Deal") {
                    //   category = await db
                    //     .collection("deal_category")
                    //     .findOne(
                    //       { _id: getInfo.MongoID(tbdata.categoryId) },
                    //       { projection: { bonus: 1 } }
                    //     );
                    // }

                    /* const category = await db
                      .collection("point_category")
                      .findOne(
                        { _id: getInfo.MongoID(tbdata.categoryId) },
                        { projection: { bonus: 1 } }
                      ); */
                    cutBonus = category.bonus ? +category.bonus : 0;

                    const {
                      totalCash,
                      updateBonusCash,
                      updateDepositCash,
                      updateWinCash,
                      bonusCut,
                      bounsPercent,
                      bounsId,
                      bonusType,
                      bonusRemainId,
                      bonusRemainAmount,
                      remainBonusType,
                      bounsRemainPercent,
                      remainDepositCash,
                      remainWinCash,
                      remainDepositPercent,
                      remainWinPercent,
                    } = await cashCut({
                      userInfo,
                      entryFee: udata,
                      tableId: tbdata._id,
                      cutBonus,
                    });
                    // update cash here for cut all things like bouns, cash and win.
                    setInfo.$set.totalcash = totalCash;
                    setInfo.$set.depositCash = updateDepositCash;
                    setInfo.$set.Winning = updateWinCash;
                    logger.info("updateBonusCash-------->", updateBonusCash);
                    const updateId = {
                      _id: getInfo.MongoID(userInfo._id.toString()),
                    };
                    if (bonusType == "SignUpBonus") {
                      setInfo.$set.SignUpBonus = updateBonusCash;
                    }

                    if (bonusType == "referralBonus") {
                      updateId["referral_bonus._id"] = bounsId;
                      setInfo.$set["referral_bonus.$.referralBonus"] =
                        updateBonusCash;
                    }

                    if (bonusType == "addCashBonus") {
                      updateId["addCash_bonus._id"] = bounsId;
                      setInfo.$set["addCash_bonus.$.addCashBonus"] =
                        updateBonusCash;
                    }

                    setInfo.$set.cAmount = true;
                    setInfo.$set.rlsAmount = true;
                    setInfo.$set.tbd = tbid;
                    db.collection("cash_track").updateOne(
                      { _id: trackdata._id },
                      {
                        $set: {
                          signUpBonus: bonusCut,
                          depositCash: updateDepositCash,
                          withdrawableCash: updateWinCash,
                          bonusType,
                          bounsId,
                        },
                      }
                    );

                    db.collection("game_users").findAndModify(
                      updateId,
                      {},
                      setInfo,
                      { new: true },
                      async function (err, resp) {
                        if (resp.value != null) {
                          let updatePercent = {
                            userId: id,
                            tableId: tbid,
                            tableGenerationId: tbdata.tjid,
                            totalCash,
                            updateBonusCash,
                            updateDepositCash,
                            updateWinCash,
                            bonusCut,
                            bounsPercent,
                            bounsId,
                            bonusType,
                            topup,
                            bonusRemainId,
                            bonusRemainAmount,
                            remainBonusType,
                            bounsRemainPercent,
                            remainDepositCash,
                            remainWinCash,
                            remainDepositPercent,
                            remainWinPercent,
                            bootValue: tbdata.bv,
                          };

                          await db
                            .collection("user_cash_percent")
                            .findOneAndUpdate(
                              { userId: id, tableId: tbid },
                              {
                                $set: updatePercent,
                              },
                              { upsert: true, new: true }
                            );

                          if (userInfo.flags._ir == 0) {
                            let setObj = {
                              $set: { "pi.$.bonusType": bonusType, "pi.$.bounsId": bounsId, "pi.$.bonusCut": bonusCut, }
                            };
                            let incObj = {
                              $set: { "pi.$.bonusType": bonusType, "pi.$.bounsId": bounsId, },
                              $inc: { "pi.$.bonusCut": bonusCut }
                            };

                            let updateObj = tbdata.gt == "Pool" ? incObj : setObj;

                            const jobId = `${tbdata.gt}:updateDataOnDelay:${tbdata._id.toString()}`;
                            // scheduler.queues.updateDataOnDelay({
                            //   timer: 3000, jobId,
                            //   query: { _id: getInfo.MongoID(tbid), "pi.uid": id.toString() },
                            //   updateObject: updateObj
                            // });
                            const jobData = {
                              query: { _id: getInfo.MongoID(tbid), "pi.uid": id.toString() },
                              updateObject: updateObj,
                              calling: UPDATE_ON_DELAY
                            };
                            const jobOption = { delay: 3000, jobId };
                            addQueue(jobData, jobOption);

                            let trobj = {
                              tbid: tbid,
                              uid: userInfo._id.toString(),
                              rid: 0,
                              s: "joinTable send uc",
                            };
                            trackClass.Leave_Track(trobj);
                            commonClass.SendDirect(
                              userInfo._id,
                              {
                                en: "UserChips",
                                data: {
                                  totalCash: totalCash,
                                  chips: userInfo.Chips,
                                  status: t,
                                },
                              },
                              true
                            ); //publishing to exchange
                          }
                          if (userInfo.tbid != "") {
                            logger.info(
                              "joinTable api data udata1111111111111:",
                              udata
                            );
                            logger.info(
                              "joinTable api data typeof udata1111111111111:",
                              typeof udata
                            );
                            logger.info(
                              "joinTable api data userInfo.tbid:",
                              userInfo.tbid
                            );

                            db.collection("playing_table").findAndModify(
                              {
                                _id: getInfo.MongoID(userInfo.tbid),
                                "pi.uid": userInfo._id.toString(),
                              },
                              {},
                              {
                                $set: {
                                  "pi.$.totalCash": fChips,
                                  "pi.$.topup": topup,
                                },
                                $inc: {
                                  "pi.$.upc": tbdata.gt == "Points" ? udata : 0,
                                  "pi.$.userViewCashChips": udata,
                                },
                              },
                              { new: true },
                              function (err, resp1) {
                                if (resp1 && resp1.value != null) {
                                  resp1 = resp1.value;
                                  let trobj = {
                                    tbid: tbid,
                                    uid: userInfo._id.toString(),
                                    rid: 0,
                                    s: "joinTable send callback if",
                                  };
                                  trackClass.Leave_Track(trobj);

                                  let seat = -1;
                                  for (let i in resp1.pi) {
                                    if (
                                      userInfo._id.toString() == resp1.pi[i].uid
                                    ) {
                                      seat = i;
                                      break;
                                    }
                                  }

                                  if (
                                    resp1.pi &&
                                    resp1.pi.length > 0 &&
                                    typeof resp1.pi[seat].si != "undefined"
                                  ) {
                                    commonClass.FireEventToTable(
                                      userInfo.tbid,
                                      {
                                        en: "UserTurnChange",
                                        data: {
                                          si: resp1.pi[seat].si,
                                          uid: resp1.pi[seat].uid,
                                          upc: resp1.pi[seat].upc,
                                          userViewCashChips: resp1.pi[seat].upc,
                                          totalCash: fChips,
                                          chips: resp.value.Chips,
                                          reason: t,
                                        },
                                      }
                                    );

                                    if (typeof callback == "function") {
                                      return callback(udata);
                                    }
                                  } else {
                                    if (typeof callback == "function") {
                                      return callback(udata);
                                    }
                                  }
                                } else {
                                  logger.info("resp1 is null");
                                  if (typeof callback == "function") {
                                    let trobj = {
                                      tbid: tbid,
                                      uid: userInfo._id.toString(),
                                      rid: 0,
                                      s: "joinTable send callback if else",
                                    };
                                    trackClass.Leave_Track(trobj);
                                    return callback(udata);
                                  }
                                }
                              }
                            );
                          } else {
                            if (typeof callback == "function") {
                              let trobj = {
                                tbid: tbid,
                                uid: userInfo._id.toString(),
                                rid: 0,
                                s: "joinTable send callback else",
                              };
                              trackClass.Leave_Track(trobj);
                              return callback(udata);
                            }
                          }
                        }
                      }
                    );
                  } else {
                    logger.info("JoinTable api data not found: ");
                    db.collection("cash_track").updateOne(
                      { _id: getInfo.MongoID(trackdata._id.toString()) },
                      { $set: { sts: "pending" } },
                      function (err, upd) { }
                    );
                    let trobj = {
                      tbid: tbid,
                      uid: userInfo._id.toString(),
                      rid: 0,
                      s: "joinTable api response false",
                    };
                    trackClass.Leave_Track(trobj);
                    return false;
                  }
                  // });
                } else {
                  logger.info("cash track data data not found: ");
                  return false;
                }
              });
            }
          }
        );
      } else {
        logger.info("in--------else--------------");
        let ct = cth;
        let fChips = -ct;
        logger.info("-----------$----------->", ct, fChips);
        // let fChips =
        //   -ct + userInfo.totalcash < 0 ? 0 : -ct + userInfo.totalcash;

        let setInfo = {
          $inc: {},
        };
        logger.info("-------totalcash---------->", userInfo.totalcash);
        logger.info(
          "userInfo.totalcash >= ct----------->",
          userInfo.totalcash >= ct
        );
        if (userInfo.totalcash >= ct) {
          setInfo["$inc"]["totalcash"] = -ct;
        } else {
          logger.info("return else");
          return false;
        }
        logger.info("UpdateUserCash------->>>setInfo: ", setInfo);
        logger.info("------setInfo-------->", setInfo);

        db.collection("game_users").findAndModify(
          { _id: getInfo.MongoID(id) },
          {},
          setInfo,
          { new: true },
          function (err, resp) {
            if (resp.value != null) {
              logger.info("userInfo.tbid----------->", userInfo.tbid);
              if (userInfo.tbid != "") {
                db.collection("playing_table").updateOne(
                  {
                    _id: getInfo.MongoID(userInfo.tbid),
                    "pi.uid": userInfo._id.toString(),
                  },
                  {
                    $set: {
                      "pi.$.totalCash": fChips,
                      "pi.$.topup": topup,
                      "pi.$.upc": cth,
                      "pi.$.userViewCashChips": cth,
                    },
                  },
                  function (err, ress) {
                    //*****************table chips update code*************
                    db.collection("playing_table").findOne(
                      {
                        _id: getInfo.MongoID(userInfo.tbid),
                        "pi.uid": userInfo._id.toString(),
                      },
                      { "pi.$": 1 },
                      function (err1, resp1) {
                        if (resp1) {


                          if (
                            resp1.pi &&
                            resp1.pi.length > 0 &&
                            typeof resp1.pi[0].si != "undefined"
                          ) {
                            commonClass.FireEventToTable(userInfo.tbid, {
                              en: "UserTurnChange",
                              data: {
                                si: resp1.pi[0].si,
                                uid: resp1.pi[0].uid,
                                upc: resp1.pi[0].upc,
                                userViewCashChips: resp1.pi[0].upc,
                                totalCash: fChips,
                                chips: resp.value.Chips,
                                reason: t,
                              },
                            });
                            if (typeof callback == "function") {
                              return callback(cth);
                            }
                          } else {
                            if (typeof callback == "function") {
                              return callback(cth);
                            }
                          }
                        } else {
                          if (typeof callback == "function") {
                            return callback(cth);
                          }
                        }
                      }
                    );

                    //******************code ends here********************
                  }
                );
              } else {
                if (typeof callback == "function") {
                  return callback(cth);
                }
              }
            }
          }
        );
      }
    } else if (typeof callback == "function") {
      return false;
    }
  });
};

const UpdateUserCash = async (id, chips, t, tbid, flags, erflag,tbData) => {
  return new Promise(async (resolve, reject) => {
    if (isNaN(chips)) {
      resolve(0);
    }
    logger.info(
      "UpdateUserCash-------------->UpdateUserCash",
      id,
      chips,
      t,
      tbid,
      flags,
      erflag
    );
    let existTable=true;
    
    tbid = tbid.toString();
    let tableDetails = await db.collection("playing_table").findOne(
      {
        _id: getInfo.MongoID(tbid),
        // "pi.uid": id.toString(),
      },
      {
        projection: {
          tjid: 1,
          gt: 1,
          // "pi.$": 1,
          categoryId: 1,
        },
      }
    );
    if(!tableDetails){
      existTable=false;
      tableDetails=tbData;
    }
    logger.info("tableDetails-------------->", tableDetails);
    let wh =
      typeof id == "string"
        ? {
          _id: getInfo.MongoID(id),
        }
        : {
          _id: id,
        };
    logger.info("UpdateUserCash---------------------------chips: ", chips);
    // chips = Math.floor(Number(chips));

    getInfo.GetUserInfo(wh._id.toString(), {}, async function (u) {
      if (typeof u._id != "undefined") {
        logger.info(
          "UpdateUserCash---------------------------u.totalcash: " + u.totalcash
        );
        let fChips = chips + u.totalcash < 0 ? 0 : chips + u.totalcash;
        logger.info("fChips--------->", fChips);
        if (chips == 0) {
          // return callback(fChips);
          resolve(fChips);
        }

        let setInfo = {
          // $inc: {},
          $set: {},
        };

        if (typeof erflag == "undefined" || !erflag) {
          setInfo.$set.rlsAmount = false;
        }
        let bonusCutForUser = 0;
        let totalCashForUser = 0;
        let bonusCutType, bounsCutId;
        if (u.flags._ir == 0) {
          let cutBonus = 0;
          const tableName = getTableName(tableDetails.gt);
          const category = await db
            .collection(tableName)
            .findOne({ _id: getInfo.MongoID(tableDetails.categoryId) });

          /* const category = await db
            .collection("point_category")
            .findOne(
              { _id: getInfo.MongoID(tableDetails.categoryId) },
              { projection: { bonus: 1 } }
            ); */
          cutBonus = category.bonus ? +category.bonus : 0;

          const {
            totalCash,
            updateWinCash,
            updateDepositCash,
            updateBonusCash,
            bonusCut,
            bonusType,
            bounsId,
          } = await cashCut({
            userInfo: u,
            entryFee: chips,
            winStatus: t,
            tableId: tbid,
            cutBonus,
          });
          bonusCutForUser = bonusCut;
          totalCashForUser = totalCash;
          bonusCutType = bonusType
          bounsCutId = bounsId;
          setInfo.$set.totalcash = totalCash;
          setInfo.$set.Winning = updateWinCash;
          setInfo.$set.depositCash = updateDepositCash;

          if (bonusType == "SignUpBonus")
            setInfo.$set.SignUpBonus = updateBonusCash;

          if (bonusType == "referralBonus") {
            wh["referral_bonus._id"] = bounsId;
            setInfo.$set["referral_bonus.$.referralBonus"] = updateBonusCash;
          }

          if (bonusType == "addCashBonus") {
            wh["addCash_bonus._id"] = bounsId;
            setInfo.$set["addCash_bonus.$.addCashBonus"] = updateBonusCash;
          }

          if (tableDetails.gt == "Points"&&existTable) {
            const palay = await db.collection("playing_table").findOneAndUpdate(
              { _id: getInfo.MongoID(tbid), "pi.uid": id.toString(), },
              {
                $set: {
                  "pi.$.bonusCut": bonusCut, "pi.$.bonusType": bonusType, "pi.$.bounsId": bounsId,
                }
              },
              { new: true }
            );
          }

        }

        // setInfo.$inc.totalcash = chips;
        setInfo.$set.cAmount = false;
        setInfo.$set.tbd = "";
        logger.info(
          "UpdateUserCash---------------------------fChips: ",
          fChips
        );
        //wh.totalcash = u.totalcash;
        logger.info(
          "UpdateUserCash---------------------------setInfo: ",
          setInfo
        );
        db.collection("game_users").findAndModify(
          wh,
          {},
          setInfo,
          { new: true },
          function (err, resp) {
            if (!err && resp.value != null) {
              if (u.flags._ir == 0) {
                let inserData = {
                  uid: getInfo.MongoID(u._id.toString()),
                  tbid: tbid,
                  tjid: tableDetails.tjid,
                  gameType: tableDetails.gt,
                  un: u.un,
                  ue: u.ue,
                  c: chips,
                  pc: u.totalcash,
                  tp: t,
                  ctc: resp.value.totalcash, //current total cash
                  sts: "success",
                  tId: resp.value.tId,
                  depositCash: resp.value.depositCash,
                  withdrawableCash: resp.value.Winning,
                };
                /*  if (u._ir == 0) {
                   inserData.bonusType = bonusType;
                   inserData.bounsId = bounsId;
                 } */

                if (t == "release remaining amount") {
                  inserData.signUpBonus = bonusCutForUser;
                  inserData.bonusType = bonusCutType;
                  inserData.bounsId = bounsCutId;
                }
                logger.info("sending data to inserData: " + inserData);
                trackClass.Cash_Track(inserData, function (trackdata) {
                  logger.info("trackdata:   >>>>>>>>>>>>>>", trackdata);
                  if (trackdata && typeof trackdata._id != "undefined") {
                    let type;
                    if (t == "Game Win") {
                      type = "Winning";
                    } else {
                      type = "Release";
                    }

                    logger.info(
                      "UpdateUserCash----------################-----------**********------chips: ",
                      chips
                    );

                    let trobj = {
                      tbid: tbid,
                      uid: u._id.toString(),
                      rid: 0,
                      s: "rls api responce true",
                    };
                    trackClass.Leave_Track(trobj);
                    if (u.flags._ir == 0) {
                      if (typeof flags == "undefined" || !flags) {
                        commonClass.SendDirect(
                          u._id,
                          {
                            en: "UserChips",
                            data: {
                              totalCash: totalCashForUser, //fChips,
                              chips: u.Chips,
                              status: t,
                            },
                          },
                          true
                        ); //publishing to exchange
                      }
                    }
                    logger.info("UpdateUserCash----------UserChips: ", u._id);

                    if (u.tbid != ""&&existTable) {
                      chips = Math.abs(chips);

                      //*****************table chips update code*************
                      db.collection("playing_table").findOne(
                        {
                          _id: getInfo.MongoID(u.tbid),
                          "pi.uid": u._id.toString(),
                        },
                        { projection: { "pi.$": 1 } },
                        function (err1, resp1) {
                          if (resp1) {


                            if (
                              resp1.pi &&
                              resp1.pi.length > 0 &&
                              typeof resp1.pi[0].si != "undefined"
                            ) {
                              if (typeof flags == "undefined" || !flags) {
                                commonClass.FireEventToTable(u.tbid, {
                                  en: "UserTurnChange",
                                  data: {
                                    si: resp1.pi[0].si,
                                    uid: resp1.pi[0].uid,
                                    totalCash: fChips,
                                    upc: resp1.pi[0].upc,
                                    userViewCashChips: resp1.pi[0].upc,
                                    chips: resp.value.Chips,
                                    reason: t,
                                  },
                                });
                              }
                            }
                          }
                        }
                      );

                      //******************code ends here********************
                      // });
                    }
                    resolve(fChips);
                  } else {
                    logger.info("cash track data data not found: ");
                    resolve(false);
                    // return false;
                  }
                });
              } else {
                if (resp.value.tbid != ""&&existTable) {
                  chips = Math.abs(chips);
                  // db.collection('playing_table').update({_id:getInfo.MongoID(resp.value.tbid),'pi.uid':resp.value._id.toString()},{$set:{'pi.$.totalCash':fChips},$inc:{'pi.$.upc':chips}},function(err,ress){

                  //*****************table chips update code*************

                  db.collection("playing_table").findOne(
                    {
                      _id: getInfo.MongoID(resp.value.tbid),
                      "pi.uid": resp.value._id.toString(),
                    },
                    { projection: { "pi.$": 1 } },
                    function (err1, resp1) {
                      // db.collection('playing_table').findOne({_id:getInfo.MongoID(resp.value.tbid),'pi.uid':resp.value._id.toString()},{'pi.$':1},function(err1,resp1){

                      if (resp1) {
                        logger.info(
                          "UpdateUserChips------------------->>>>>resp1: ",
                          resp1
                        );

                        if (
                          resp1.pi &&
                          resp1.pi.length > 0 &&
                          typeof resp1.pi[0].si != "undefined"
                        ) {
                          if (typeof flags == "undefined" || !flags) {
                            commonClass.FireEventToTable(resp.value.tbid, {
                              en: "UserTurnChange",
                              data: {
                                si: resp1.pi[0].si,
                                uid: resp1.pi[0].uid,
                                chips: resp.value.Chips,
                                totalCash: fChips,
                                upc: resp1.pi[0].upc,
                                userViewCashChips: resp1.pi[0].upc,
                                reason: t,
                              },
                            });
                          }
                        }
                        resolve(fChips);
                        // if(typeof callback == 'function'){
                        //     return callback(fChips);
                        // }
                      } else {
                        resolve(fChips);
                        // if(typeof callback == 'function'){
                        //     return callback(fChips);
                        // }
                      }
                    }
                  );
                  // });
                } else {
                  resolve(fChips);
                  // if(typeof callback == 'function'){
                  //     return callback(fChips);
                  // }
                }
              }
            }
          }
        );
      }
    });
  });
};
const UpdateCashForPlayInTable = (tbId, id, Chips, t, callback) => {
  /* +-------------------------------------------------------------------+
          desc:this function use to update the user chips.
          i/p:userid,chips,t:status
          o/p:updated user chips
      +-------------------------------------------------------------------+ */
  logger.info("UpdateCashForPlayInTable-->>>id: ", id, " chips: ", Chips, " t: ", t);
  if (!id) {
    logger.info('UpdateCashForPlayInTable---------->>>>Error:"id not found!!!"');
    return false;
  }
  const { MAX_DEADWOOD_PTS } = GetConfig();
  id = id.toString();
  db.collection("playing_table").findOne(
    { _id: getInfo.MongoID(tbId.toString()) },
    function (err, tbData) {
      if (!tbData) {
        logger.info(
          'joinSeat::::::::::::::::::>>>>>>>Error: "tbData not found!!!"'
        );
        return false;
      }

      let seat = -1;
      let _ir = 0;
      for (let i in tbData.pi) {
        if (id == tbData.pi[i].uid) {
          _ir = tbData.pi[i]._ir;
          seat = i;
          break;
        }
      }

      let upc = tbData.pi[seat].upc;
      let fChips =
        Chips + tbData.pi[seat].upc < 0 ? 0 : Chips + tbData.pi[seat].upc;
      let bfChips = fChips;
      fChips = commonClass.RoundInt(fChips, 2);

      let diff = commonClass.GetTimeDifference(tbData.la, new Date());
      logger.info("UpdateCashForPlayInTable-->>>diff: ", diff);
      logger.info("diff------->", diff);
      let obj = {
        uid: id.toString(),
        tid: tbData.pi[seat].tid,
        tbid: tbId.toString(),
        _ir: _ir,
        cash: Chips,
        rid: tbData.rid,
        mode: tbData.mode,
        gt: tbData.gt,
        trkid: tbData.tjid,
        diff: diff,
        upc: fChips,
        t: t,
      };

      logger.info("UpdateCashForPlayInTable------>>>obj: ", obj);
      trackClass.PlayTrack(obj, function (data) {
        if (data) {
          db.collection("playing_table").findAndModify(
            { _id: getInfo.MongoID(tbId), "pi.uid": id },
            {},
            {
              $set: { "pi.$.upc": fChips, "pi.$.userViewCashChips": fChips },
            },
            { new: true },
            async function (err, resp1) {
              if (resp1) {
                resp1 = resp1.value;
                if (
                  resp1?.pi &&
                  resp1?.pi.length > 0 &&
                  typeof resp1?.pi[seat].si != "undefined"
                ) {
                  let userDetail = await db
                    .collection("game_users")
                    .findOne(
                      { _id: getInfo.MongoID(resp1.pi[seat].uid) },
                      { projection: { Chips: 1, totalcash: 1 } }
                    );

                  let userViewCashChipsUpdate = fChips;
                  if (tbData.gt == "Points") {
                    userViewCashChipsUpdate =
                      fChips > tbData.bv * MAX_DEADWOOD_PTS
                        ? fChips
                        : tbData.bv * MAX_DEADWOOD_PTS;
                  }
                  logger.info(
                    "userViewCashChipsUpdate--------------->",
                    userViewCashChipsUpdate
                  );
                  commonClass.FireEventToTable(tbId, {
                    en: "UpdatePlayerCash",
                    data: {
                      si: resp1.pi[seat].si,
                      uid: resp1.pi[seat].uid,
                      upc: fChips,
                      userViewCashChips: userViewCashChipsUpdate,
                      reason: t,
                      chips: userDetail.Chips,
                      totalCash: userDetail.totalcash,
                    },
                  });

                  if (tbData.mode == "cash") {
                    let trobj = {
                      tbid: tbId.toString(),
                      uid: id.toString(),
                      rid: tbData.rid,
                      chips: Chips,
                      pupc: upc,
                      pfchips: bfChips,
                      fChips: fChips,
                      upc: resp1.pi[seat].upc,
                    };
                    trackClass.upc_Track(trobj);
                  }

                  if (typeof callback == "function") {
                    return callback(fChips);
                  }
                }
              }
            }
          );
        }
      });
    }
  );
};
const CountHands = (uid, flag, gt, bv, wholeWin, mode, _ip, round, cb) => {
  //count users hand i.e win count, lose count,play count ; flag = flag for is winner, loser or dropped
  /* +-------------------------------------------------------------------+
          desc: this function use to count the user's hand,user win count,user lose count,user play count.
          i/p:
              uid : user id
              flag : user status win/drop/lose
              gt : game type
              bv : boot value
              wholeWin : does user win whole game for deal/pool
              cb : callback function
      +-------------------------------------------------------------------+ */
  logger.info(
    "CountHands--------------------->>>>>>uid: " +
    uid +
    " flag: " +
    flag +
    " gt: " +
    gt +
    " bv: " +
    bv +
    " wholeWin: " +
    wholeWin
  );
  getInfo.GetUserInfo(uid, {}, async function (userInfo) {
    if (!userInfo) {
      logger.info('CountHands::::::::::::::::>>>>>"user not found!!!"');
      return false;
    }
    var thp = 0;
    var hpc = 0;

    var hands = userInfo.counters.winTrigger + userInfo.counters.loseStreak;
    logger.info("CountHands--------------->>>>hands:", hands);
    // var spc = 0;
    var upData = { $set: {} /*,$inc:{}*/ };
    if (flag == "win") {
      if (
        (gt == "Pool" && wholeWin) ||
        gt == "Points" ||
        (gt == "Deal" && wholeWin)
      ) {
        upData = {
          $set: { "counters.cl": 0, "counters.cdr": 0 },
          $inc: {
            "counters.thp": 1,
            "counters.hp": 1,
            "counters.hw": 1,
            "counters.cw": 1,
          },
        };

        if (hands == 10) {
          upData.$set["counters.winTrigger"] = 1;
          upData.$set["counters.loseStreak"] = 0;
        } else {
          upData.$inc["counters.winTrigger"] = 1;
        }

        if (mode == "cash") {
          upData.$inc["counters.hpc"] = 1;
          upData.$inc["counters.hwc"] = 1;
        }

        if (userInfo.counters.thp == 0) {
          var res = await profileClass.ManageUserLevel(
            "First Game Win",
            userInfo._id.toString()
          );
        }
        // else{
        var resp = await profileClass.ManageUserLevel(
          "Game Win",
          userInfo._id.toString()
        );
        // }
      } else {
        upData.$set["la"] = new Date();
      }
    } else if (flag == "drop") {
      if (gt != "Pool" && gt != "Deal") {
        upData = {
          $set: { "counters.cw": 0, "counters.cl": 0 },
          $inc: {
            "counters.thp": 1,
            "counters.hp": 1,
            "counters.hd": 1,
            "counters.cdr": 1,
            losscounter: 1,
          },
        };

        if (hands == 10) {
          upData.$set["counters.winTrigger"] = 0;
          upData.$set["counters.loseStreak"] = 1;
        } else {
          upData.$inc["counters.loseStreak"] = 1;
        }

        if (mode == "cash") {
          upData.$inc["counters.hpc"] = 1;
          upData.$inc["counters.hdc"] = 1;
        }

        await profileClass.ManageUserLevel(
          "Game Lost",
          userInfo._id.toString()
        );
      } else {
        upData.$set["la"] = new Date();
      }
    } else {
      if (
        (gt == "Pool" && wholeWin) ||
        gt == "Points" ||
        (gt == "Deal" && wholeWin)
      ) {
        upData = {
          $set: { "counters.cw": 0, "counters.cdr": 0 },
          $inc: {
            "counters.thp": 1,
            "counters.hp": 1,
            "counters.hl": 1,
            "counters.cl": 1,
            losscounter: 1,
          },
        };

        if (hands == 10) {
          upData.$set["counters.winTrigger"] = 0;
          upData.$set["counters.loseStreak"] = 1;
        } else {
          upData.$inc["counters.loseStreak"] = 1;
        }

        if (mode == "cash") {
          upData.$inc["counters.hpc"] = 1;
          upData.$inc["counters.hlc"] = 1;
        }

        await profileClass.ManageUserLevel(
          "Game Lost",
          userInfo._id.toString()
        );
      } else {
        upData.$set["la"] = new Date();
      }
    }

    var qstWin = 0;

    if (_ip == 1) {
      // if((gt == 'Pool' && round == 1) || gt == 'Points' || gt == 'Deal'){
      await profileClass.ManageUserLevel(
        "create join private contest",
        userInfo._id.toString()
      );
      // }
    }
    logger.info("CountHands---------------->>>>>>>upData: ", upData);
    getInfo.UpdateUserData(userInfo._id.toString(), upData, function (uinfo) {
      thp = uinfo && uinfo.counters.thp ? uinfo.counters.thp : 0;
      hpc = uinfo && uinfo.counters.hpc ? uinfo.counters.hpc : 0;
      trackClass.userHandsPlay(uinfo, gt);
      if (typeof cb == "function") {
        cb(thp, qstWin, hpc);
      }
    });
  });
};
const updateWintrigger = (uid, no) => {
  var number = typeof no != "undefined" ? no : -1;
  getInfo.GetUserInfo(uid, {}, async function (userInfo) {
    if (!userInfo) {
      logger.info('updateWintrigger::::::::::::::::>>>>>"user not found!!!"');
      return false;
    }
    var winTrigger = 1;
    if (number != -1) {
      winTrigger = number;
    } else {
      no = [1, 2, 3];
      var index = no.indexOf(userInfo.winTrigger);
      if (index > -1) {
        no.splice(index, 1);
      }
      var rInt = commonClass.GetRandomInt(0, 1);
      winTrigger = no[rInt];
      if (
        typeof userInfo.counters.spc != "undefined" &&
        parseInt(userInfo.counters.spc) + 1 <= config.FIRST_TIME_GAME_LIMIT
      ) {
        winTrigger = 1;
      }
    }

    var upData = { $set: { winTrigger: winTrigger } };
    await getInfo.UpdateUserData(userInfo._id.toString(), upData);
  });
};

const getUserScore = (uid, bv, gt, cb) => {
  /* +-------------------------------------------------------------------+
      desc:returns score of user
      i/p: uid = _id of user,bv = boot value of table,gt = game type of user,cb = callback function
      o/p: user score
    +-------------------------------------------------------------------+ */
  getInfo.GetUserInfo(
    uid,
    {
      "flags._ir": 1,
      "counters.cw": 1,
      "counters.cl": 1,
      cd: 1,
      Chips: 1,
      "lasts.ll": 1,
    },
    function (userInfo) {
      logger.info("getUserScore---------->>>>userInfo: ", userInfo);
      if (userInfo && userInfo.flags._ir == 0) {
        let cwin = userInfo.counters.cw;
        let closs = userInfo.counters.cl;
        let dsi = commonClass.GetTimeDifference(userInfo.cd, new Date(), "day");
        let cbal = userInfo.Chips;

        let cpp = bv;
        let nduc = commonClass.GetTimeDifference(
          userInfo.lasts.ll,
          new Date(),
          "day"
        );

        let totalScore = 0;
        logger.info(
          "getUserScore------>>>>>>cwin: ",
          cwin,
          " closs: ",
          closs,
          " dsi: ",
          dsi,
          " cbal: ",
          cbal,
          "cpp: ",
          cpp,
          " nduc: ",
          nduc
        );
        let i1, i2, i3, i4, i5, i6;
        for (i1 in CWIN) {
          if (CWIN[i1].from <= cwin) {
            logger.info("getUserScore CWIN: ", CWIN[i1].score);
            totalScore += CWIN[i1].score;
            break;
          }
        }
        for (i2 in CLOSS) {
          if (CLOSS[i2].from <= closs) {
            logger.info("getUserScore CLOSS: ", CLOSS[i2].score);
            totalScore += CLOSS[i2].score;
            break;
          }
        }
        for (i3 in DSI) {
          if (DSI[i3].from <= dsi) {
            logger.info("getUserScore DSI: ", DSI[i3].score);
            totalScore += DSI[i3].score;
            break;
          }
        }
        for (i4 in CBAL) {
          if (CBAL[i4].from <= cbal) {
            logger.info("getUserScore CBAL: ", CBAL[i4].score);
            totalScore += CBAL[i4].score;
            break;
          }
        }
        if (gt != "Deal") {
          for (i5 in CPP) {
            if (CPP[i5].from <= cpp) {
              logger.info("getUserScore CPP: ", CPP[i5].score);
              totalScore += CPP[i5].score;
              break;
            }
          }
        }
        for (i6 in NDUC) {
          if (NDUC[i6].from <= nduc) {
            logger.info("getUserScore NDUC: ", NDUC[i6].score);
            totalScore += NDUC[i6].score;
            break;
          }
        }

        logger.info("getUserScore------->>>>totalScore: ", totalScore);
        totalScore = totalScore > 0 ? totalScore : 0; //validation to prevent score < 0
        cb(parseInt(totalScore));
      } else {
        logger.info(
          'getUserScore------------->>>>>>Msg:"user not found or player is robot"'
        );
        cb(0);
      }
    }
  );
};

const GetTableInfo = (data, client, cb) => {
  try {


    //Get Table Info ; data = {tbid,_isHelp}
    /* +-------------------------------------------------------------------+
      desc:event to get table details
      i/p: data = {tbid = _id of table,_isHelp = 1/0 is help is on or not},client = socket object, cb = callback function
    +-------------------------------------------------------------------+ */
    logger.info("GetTableInfo---------------->>>>>>data: ", data);

    getInfo.GetTbInfo(data.tbid, {}, function (table) {
      if (table) {
        let firstPick = false;
        if (table.trCount == 0) {
          firstPick = true;
        }

        table.firstPick = firstPick;
        if (typeof client.si != "undefined" && !_.isEmpty(table.pi[client.si]) && !_.isEmpty(table.pi[client.si].gCards)) {
          let temp = { pure: [], seq: [], set: [], dwd: [] };
          if (table.pi[client.si].gCards.pure.length > 0) {
            temp.pure = table.pi[client.si].gCards.pure;
          }

          if (table.pi[client.si].gCards.seq.length > 0) {
            temp.seq = table.pi[client.si].gCards.seq;
          }

          if (table.pi[client.si].gCards.set.length > 0) {
            temp.set = table.pi[client.si].gCards.set;
          }

          if (table.pi[client.si].gCards.dwd.length > 0) {
            temp.dwd = table.pi[client.si].gCards.dwd;
          }

          table.pi[client.si].gCards = temp;
          logger.info("table.pi[client.si]?.userShowCard?.allCards?.length", table.pi[client.si]?.userShowCard?.allCards?.length);
          logger.info("table.pi[client.si]?.userShowCard?.allCards", table.pi[client.si]?.userShowCard?.allCards);
          logger.info("table.pi[client.si]?.userShowCard", table.pi[client.si]?.userShowCard);

          let showCard;
          if (table.pi[client.si]?.userShowCard?.allCards?.length) {
            showCard = table.pi[client.si].userShowCard.allCards;
          } else {
            showCard = [_.flatten([table.pi[client.si].gCards.pure, table.pi[client.si].gCards.seq, table.pi[client.si].gCards.set, table.pi[client.si].gCards.dwd])];
          }

          showCard = showCard.filter((a) => a.toString());

          table.pi[client.si].userShowCard.allCards = showCard;
        }

        table.rejoin = data.rejoin;
        tableActivityClass.tableConfiguration(
          table,
          data._isHelp,
          data.jnbk,
          client,
          cb
        );
      } else {
        logger.info('GetTableInfo----------------------->>>>"table not found"');
      }
    });
  } catch (error) {
    logger.error("-----> error GetTableInfo", error);
    getInfo.exceptionError(error);
  }
};

const findEmptySeat = (pi) => {
  /* +-------------------------------------------------------------------+
    desc:function to find empty seat for player
    i/p: pi = details of player on table
  +-------------------------------------------------------------------+ */
  //logger.info("findEmptySeat >>",pi);
  for (let x in pi) {
    if (
      typeof pi[x] == "object" &&
      pi[x] != null &&
      typeof pi[x].si == "undefined"
    ) {
      return parseInt(x);
    }
  }
  return -1;
};

const globalConfigUpdate = async () => {
  logger.info("error-------globalConfigUpdate---->", gameConfig);
  playExchange.publish("updateConfig.1", {});
};

const globalConfigChange = async () => {
  logger.info("error----111---globalConfigChange---->", gameConfig);
  gameConfig = await db.collection("config").findOne();
  logger.info("error----222---globalConfigChange---->", gameConfig);
};

const update = async () => {
  gameConfig = await db.collection("config").findOne();
};

const delayUpdateOnCollections = async (query, updateObject) => {
  await db.collection("playing_table").findOneAndUpdate(query, updateObject);
};

module.exports = {
  PrepareDataCodes,
  PrepareScoreData,
  PrepareRCData,
  PreparePlayData,
  PrepareDropData,
  UpdateCashForPlay,
  UpdateUserCash,
  UpdateUserChips,
  UpdateCashForPlayInTable,
  getUserScore,
  GetTableInfo,
  findEmptySeat,
  CountHands,
  dataCodesArray,
  globalConfigUpdate,
  globalConfigChange,
  delayUpdateOnCollections
};

const commonData = require("./commonData.class");
const trackClass = require("./track.class");
const logger = require("../utils/logger");
const getInfo = require("../common");

const collectBootValue = async (
  tbId,
  mode,
  gt,
  topup,
  uid,
  chips,
  callback
) => {
  // console.time("latency timer collectBootValue");

  let lock;
  try {
    //collects boot value
    /* +-------------------------------------------------------------------+
    desc:function to collect boot value from players
    i/p: tbId = table id,uid = user id,chips =  chips of player
  +-------------------------------------------------------------------+ */
    // lock = await redlock.acquire(`locks:${tbId.toString()}`, 5000);

    if (mode == "practice") {
      chips = Math.abs(chips);
      if (gt != "Deal") {
        // chips = chips * 3;
        chips = chips;
      }
      commonData.UpdateUserChips(
        uid,
        -chips,
        "Collect Boot Value",
        async function (uChips) {
          // if (lock) await lock.unlock();
          if (uChips || uChips == 0) {
            return callback(chips);
          } else {
            return callback(false);
          }
        }
      );
    } else if (mode == "cash") {
      commonData.UpdateCashForPlay(
        tbId,
        uid,
        topup,
        -chips,
        "Collect Boot Value",
        async function (uChips) {
          logger.info("collectBootValue-->>>>>>>>>>>>>>uChips: ", uChips);
          // if (lock) await lock.unlock();
          if (uChips) {
            let trobj = {
              tbid: tbId,
              uid: uid,
              rid: 0,
              s: "Collect Boot Value",
            };
            trackClass.Leave_Track(trobj);
            return callback(uChips);
          } else {
            return callback(false);
          }
        }
      );
    }
  } catch (error) {
    logger.error("-----> error collectBootValue", error);
    getInfo.exceptionError(error);
  }
  // console.timeEnd("latency timer collectBootValue");

};

const collectBootValueInTable = (tbId, mode, uid, chips, callback) => {
  try {
    //collects boot value
    /* +-------------------------------------------------------------------+
      desc:function to collect boot value from players
      i/p: tbId = table id,uid = user id,chips =  chips of player
    +-------------------------------------------------------------------+ */
    if (mode == "practice") {
      //UpdateUserChips
      commonData.UpdateCashForPlayInTable(
        tbId,
        uid,
        -chips,
        "Collect Boot Value",
        function (uChips) {
          if (typeof uChips != "undefined") {
            return callback(uChips);
          } else {
            return false;
          }
        }
      );
    } else if (mode == "cash") {
      commonData.UpdateCashForPlayInTable(
        tbId,
        uid,
        -chips,
        "Collect Boot Value",
        function (uChips) {
          logger.info("collectBootValue-->>>>>>>>>>>>>>uChips: ", uChips);
          if (typeof uChips != "undefined") {
            return callback(uChips);
          } else {
            return false;
          }
        }
      );
    }
  } catch (error) {
    logger.error("-----> error collectBootValueInTable", error);
    getInfo.exceptionError(error);
  }
};

module.exports = { collectBootValue, collectBootValueInTable };

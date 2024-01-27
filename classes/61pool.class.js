const { cashCut } = require("../common/cashCut");
const commonData = require("./commonData.class");
const commonClass = require("./common.class.js"); //common functions
const getInfo = require("../common");
const findTableAndJoinClass = require("./findTableAndJoin.class");
const logger = require("./utils/logger");
const { getRedisInstances } = require("../connections/redis");

const JoinTablePool61 = (data, client) => {
  //find table and join pool mode; data = {catid}
  /* +-------------------------------------------------------------------+
      desc:event to find pool table and join 
      i/p: data = {catid = category id of table},client = socket object
    +-------------------------------------------------------------------+ */
  /* client.uid = data.uid;
    client._ir = data.theme; */
  logger.info(
    "JoinTablePool---------------->>>>>>client.uid: ",
    client.uid,
    " data:",
    data
  );
  logger.info(
    "JoinTablePool---------------->>>>>>client.uid: ",
    client._ir,
    " data:",
    data
  );

  getInfo.GetUserInfo(
    client.uid,
    {
      tId: 1,
      AuthExpire: 1,
      ExpireToken: 1,
      Chips: 1,
      totalcash: 1,
      depositcash: 1,
      wincash: 1,
      bonuscash: 1,
      counters: 1,
    },
    function (userInfo) {
      if (userInfo) {
        data.tId = userInfo.tId;
        data.AuthExpire = userInfo.AuthExpire;
        data.ExpireToken = userInfo.ExpireToken;
        if (data && data.catid) {
          db.collection("pool_category").findOne(
            { _id: getInfo.MongoID(data.catid) },
            function (err, resp) {
              let fee = resp.fee;
              // if (fee * 3 <= userInfo.Chips) {
              if (fee <= userInfo.Chips) {
                data.gt = "Pool";
                data.pCount = resp.pCount; /*resp.pCount;*/
                data.bv = resp.fee;
                data.use_bot = resp.use_bot;
                data.mode = "practice";
                data.lvc = userInfo.counters.lvc;
                data.theme =
                  data.theme != null || typeof data.theme != "undefined"
                    ? data.theme
                    : "red";

                if (resp && resp.reke) {
                  data.reke = resp.reke;
                  // data.prize = parseInt(resp.fee*resp.pCount*((100-resp.reke)*0.01));
                } else {
                  data.reke = 0;
                  // data.prize = resp.fee*resp.pCount;
                }
                logger.info(
                  "JoinTablePool-------------->>>data.reke: " + data.reke
                );
                findTableAndJoinClass.findTableAndJoin(data, client, 0);
              } else {
                let reqChips = resp.fee;
                commonClass.SendData(
                  client,
                  "PopUp",
                  { chips: resp.fee, flag: "noChips", reqChips: reqChips },
                  "error:2020"
                ); //Don't have sufficient chips
                // strClass.outOfChipsPop(client,{chips:resp.fee,flag:'noChips',reqChips:reqChips});
              }
            }
          );
        }
      }
    }
  );
};
const JoinTablePoolCash61 = (data, client) => {
  //find table and join pool mode; data = {catid}
  /* +-------------------------------------------------------------------+
      desc:event to find pool table and join 
      i/p: data = {catid = category id of table},client = socket object
    +-------------------------------------------------------------------+ */
  logger.info(
    "JoinTablePoolCash---------------->>>>>>client.uid: ",
    client.uid,
    " data:",
    data
  );
  const redisInstances = getRedisInstances();

  redisInstances.setnx("ftajpmc:" + client.uid, 1, function (err, lvt) {
    if (lvt == 0) {
      return false;
    }

    redisInstances.expire("ftajpmc:" + client.uid, 5);
    getInfo.GetUserInfo(
      client.uid,
      {
        tId: 1,
        AuthExpire: 1,
        ExpireToken: 1,
        Chips: 1,
        totalcash: 1,
        depositcash: 1,
        wincash: 1,
        bonuscash: 1,
        counters: 1,
      },
      function (userInfo) {
        if (userInfo) {
          data.tId = userInfo.tId;
          data.AuthExpire = userInfo.AuthExpire;
          data.ExpireToken = userInfo.ExpireToken;
          if (data && data.catid) {
            db.collection("pool_category").findOne(
              { _id: getInfo.MongoID(data.catid) },
              async function (err, resp) {
                let { playable } = await cashCut({
                  userInfo,
                  entryFee: resp.fee,
                });
                if (!playable) {
                  return commonClass.SendData(
                    client,
                    "PopUp",
                    {
                      chips: resp.fee,
                      flag: "noChips",
                      reqChips: resp.fee,
                      message: commonData.dataCodesArrry[
                        "en:error:1020"
                      ].Message.replace("5", resp.bonus ? resp.bonus : 10),
                    },
                    "error:1020"
                  );
                }
                data.gt = "Pool";
                data.pCount = resp.pCount; /*resp.pCount;*/
                data.bv = resp.fee;
                data.mode = "cash";
                data.use_bot = resp.use_bot;
                data.lvc = userInfo.counters.lvc;
                data.theme =
                  typeof data.theme != "undefined" ? data.theme : "cyan";
                data.reke = data.reke ?? 0;

                logger.info(
                  "JoinTablePoolCash-------------->>>data.reke: " + data.reke
                );
                findTableAndJoinClass.findTableAndJoin(data, client, 0);
              }
            );
          }
        }
      }
    );
  });
};
module.exports = {
  JoinTablePool61,
  JoinTablePoolCash61,
};

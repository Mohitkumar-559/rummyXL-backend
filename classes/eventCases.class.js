const { replaceKeyNewToOld } = require("./replaceKey.class");
const commonData = require("./commonData.class");
const commonClass = require("./common.class.js"); //common functions
const signupClass = require("./signup.class.js");
const dashboardClass = require("./dashboard.class");
const playingTableClass = require("./playingTable.class");
const profileClass = require("./profile.class");
const playClass = require("./play.class");
const dropCardsClass = require("./dropCards.class");
const pickCardClass = require("./pickCard.class");
const discardedCardsClass = require("./discardedCards.class");
const throwCardClass = require("./throwCard.class");
const declareCardClass = require("./declareCard.class");
const finishCardClass = require("./finishCard.class");
const gameHistoryClass = require("./gameHistory.class");
const splitPointClass = require("./splitPoint.class");
const rejoinPoolClass = require("./rejoinPool.class");

// const winnerClass = require("./winner.class");
const logger = require("../utils/logger");
const { getRedisInstances } = require("../connections/redis");
const getInfo = require("../common");
const moment = require("moment");
const _ = require("underscore");
const RemoveInvoiceQueue = require("../bull/removeInvoiceFiles");
const ResetKYCQueue = require("../bull/resetUserAttempt");
//const RemoveDataTableHistoryQueue = require("../bull/removeDataTableHistory");
const { GetConfig } = require("../connections/mongodb");
const STUCKTableReset = require("../bull/stuckTable");
const UpdateLobbyCountQueue=require("../bull/updateLobbyCount")
const ImageCompressationSet = require("../bull/imageCompress")
const UPIAttemptResetQueue = require("../bull/resetUPIAttempt")
const BANKAttemptResetQueue = require("../bull/resetBankAttempt")
const PANandUPIQueue = require("../bull/webHookIDFY")
const init = () => {
  return new Promise((resolve, reject) => {
    /* +-------------------------------------------------------------------+
        desc: function to initialize socket server
      +-------------------------------------------------------------------+ */
    //decrement online players from redis.
    const redisInstances = getRedisInstances();

    redisInstances.ZSCORE("servers", SERVER_ID, function (err, cPlayers) {
      if (parseInt(cPlayers) > 0) {
        // redisInstances.decrby("onlinePlayers", cPlayers); //decrements the players which are connected to this
      }

      redisInstances.HMSET(
        SERVER_ID,
        "port",
        process.env.PORT,
        "proto",
        "https"
      ); //saving server information to SERVER_ID hash
      redisInstances.zadd("servers", 0, SERVER_ID);
    });
    commonData.PrepareDataCodes(function () {
      //Generate global array for data code [Error, success]
      commonData.PrepareScoreData(function () {
        //Generate global arrays to initialize user score data
        commonData.PrepareRCData(function () {
          commonData.PreparePlayData(function () {
            commonData.PrepareDropData(async function () {
              
              // const bullClass = new BullClass();
              // await bullClass.removeInvoiceToQueue();
              // await bullClass.KYCResetToQueue();
              // await bullClass.STUCKResetToQueue();
              // await bullClass.RemoveTableHistoryQueue();
              // await bullClass.ImageCompressSetToQueue();
              // await bullClass.StateUpdateToQueue();

              const removeInvoiceQueueClass = new RemoveInvoiceQueue();
              await removeInvoiceQueueClass.removeInvoiceToQueue();

              const ResetKYCQueueClass = new ResetKYCQueue();
              await ResetKYCQueueClass.KYCResetToQueue();

              const STUCKTableResetClass = new STUCKTableReset();
              await STUCKTableResetClass.STUCKResetToQueue();
              
              const UpdateLobbyCountQueueClass = new UpdateLobbyCountQueue();
              await UpdateLobbyCountQueueClass.UpdateLobbyCountToQueue();

              const ImageCompressationClass = new ImageCompressationSet();
              await ImageCompressationClass.ImageCompressSetToQueue();

              const resetUPIClass = new UPIAttemptResetQueue();
              await resetUPIClass.UPIRestToQueue();

              const resetBANKClass = new BANKAttemptResetQueue();
              await resetBANKClass.BANKResetToQueue();

              const resetPANandUPIClass = new PANandUPIQueue();
              await resetPANandUPIClass.UpdateUPIAndUPIToQueue();

              //const RemoveDataTableHistoryQueueClass = new RemoveDataTableHistoryQueue();
              // RemoveDataTableHistoryQueueClass.RemoveTableHistoryQueue();
              io.sockets.on("connection", async function (socket) {
                logger.info(
                  "ping: connection------------>>>socket:",
                  socket.id
                );
                redisInstances.ZINCRBY("servers", 1, SERVER_ID);
                // redisInstances.incr("onlinePlayers");
                let doneEvent = { en: "DONE", data: {} };

                socket.sck = commonClass.PrepareId(SERVER_ID, socket.id);
                commonClass.SendDirect(socket.sck, doneEvent);


                BindSocketToEvent(socket);
                resolve();
              });
            });
          });
        });
      });
    });
  });
};
const eventHub = (request, socket) => {
  try {
    /* +-------------------------------------------------------------------+
        desc: function to handle all event processes
        i/p: request = {en = event name,data = data for event},socket = socket object
      +-------------------------------------------------------------------+ */

    if (typeof request == "string") {
      // logger.info("eventHub:--------->>>>>>>>>>>>>request:" + request);
      request = JSON.parse(request);
    }
    if (!request) {
      return false;
    }

    let { en } = request;
    if (en != "Heartbeat") {
      logger.info(
        "----------------------------((( " + en + " )))--------iiiiiiiiiiiiiiiiiiiiiiiiiiii   Time: " +
        new Date().getHours() +
        ":" +
        new Date().getMinutes() +
        ":" +
        new Date().getSeconds() +
        ":" +
        new Date().getMilliseconds()
      );
      logger.info("request event", request.en);
      logger.info("request data", request.data);
    }

    request.data = replaceKeyNewToOld(request.data);
    switch (en) {
      case "JoinTablePoint": // Find Table And Join point rummy
      case "JoinTablePointCash": //find table and join cash mode point rummy
      case "JoinTableDeal": //Find Table And Join Deal Mode
      case "JoinTableDealCash": //find table and join cash mode deal rummy
      case "JoinTablePool": //Find Table And Join Pool Mode
      case "JoinTablePoolCash": //Find table and join pool cash mode

      case "GetTableInfo": //Get Table Info
      case "GetPoolRummy": //get pool playing cat
      case "GetPointRummy": //get point rummy category
      case "GetDealRummy": //get deal table category
      case "GameInfo": //get game information
      case "BackToTable":
        playingTableClass[en](request.data, socket);
        break;

      case "SplitResult":
      case "SplitData":
        splitPointClass[en](request.data, socket);
        break;

      case "ChangeGameSetting": //change game settings
      case "GameSetting": //get game settings
        profileClass[en](request.data, socket);
        break;

      case "SignUp": // sign up
      case "GetGameConfig": //GetGameConfig.
      case "GetUserProfile":
        signupClass[en](request.data, socket);
        break;

      case "Logout": //logout
      case "ReJoin": //Rejoin Table
      case "onlineUsers": //Rejoin Table
      case "DailyBanner": //banner image.
        dashboardClass[en](request.data, socket, en);
        break;

      case "SaveCards": //save cards
      case "SeeMyCards": //See My Cards

      case "StandUp": // standup
      case "SwitchTable": // switch table
        playClass[en](request.data, socket);
        break;

      case "Finish": // discarded cards
        finishCardClass[en](request.data, socket);
        break;

      case "Declare": // discarded cards
        declareCardClass[en](request.data, socket);
        break;

      case "DiscardedCards": // discarded cards
        discardedCardsClass[en](request.data, socket);
        break;

      case "ThrowCard": //Discard card
        throwCardClass[en](request.data, socket);
        break;

      case "PickCardFromCloseDeck": //Pick From Close Deck
      case "PickCardFromOpenDeck": //Pick From Open Deck
        pickCardClass[en](request.data, socket);
        break;

      case "DropCards": //Drop Cards
      case "ResumeAndDrop": //Drop Cards
        dropCardsClass[en](request.data, socket);
        break;

      case "LeaveTable": //Leave Table
      case "REMATCH_NO": //Rematch No
        leaveTableClass[en](request.data, socket);
        break;

      case "getGameHistory": // get Game History
      case "getInGameHistory": // get Game History
      case "saveGameHistoryFeedback":
        gameHistoryClass[en](request.data, socket, en);
        break;

      case "Win": // win data
        winnerClass[en](request.data, socket, en);
        break;

      case "rejoinPop": // rejoin pop
        rejoinPoolClass[en](request.data, socket, en);
        break;

      case "Ping":
        logger.info("Ping:----------------data:", request.data);
        commonClass.SendDirect(socket.sck, {
          en: "Ping",
          data: { id: request.data.id },
        });
        break;

      case "Heartbeat": // heart beat
        commonClass.SendDirect(socket.sck, {
          en: "Heartbeat",
          data: { id: request.data.id },
        });
        break;
    }
  } catch (error) {
    logger.error("-----> error eventHub", error);
    getInfo.exceptionError(error);
  }
};
const BindSocketToEvent = (socket) => {
  try {
    /* +-------------------------------------------------------------------+
        desc: function to bind socket with socket
        i/p: = socket = socket object
      +-------------------------------------------------------------------+ */

    if (!socket) {
      return false;
    }
    const { ENC_DEC_FLAG } = GetConfig();
    socket.sck = commonClass.PrepareId(SERVER_ID, socket.id);

    socket.ipad = commonClass.getIpad(socket);
    // setTimeout(() => {}, 1000);

    socket.on("req", (request, callback) => {
      if (ENC_DEC_FLAG) {
        request = commonClass.decrypt(request);
      }
      socket.removeListener("req", function () { });
      if (callback) {
        callback(request.en);
      }
      eventHub(request, socket);
    });

    socket.on("error", function (exc) {
      logger.info("ignoring exception: " + exc);
    });

    //deleting socket id from player Array on connection close from device.
    socket.on("hb", function (request) {
      // logger.info('-_-_-_-_-_-_-_hb_-_-_-_-_-_-_-');
      socket.emit("res", commonClass.encrypt({ en: "hb", data: {} }));
      // socket.emit('res',{en : "hb", data : {}});
      socket.removeListener("hb", function () { });
    });
    //deleting socket id from player Array on connection close from device.
    socket.on("disconnect", function (disconnectReason) {
      logger.info("disconnect reason", disconnectReason, socket.id);
      if (!_.contains(["ping timeout", "transport close", "client namespace disconnect", "transport error", "server namespace disconnect"], disconnectReason)) {
        logger.error("disconnect reason", disconnectReason, socket.id);
        getInfo.exceptionError({ socketDisconnection: disconnectReason });
      }
      dashboardClass.Logout({}, socket);
    });

    socket.on("sync", (data, callback) => {
      try {
        socket.removeListener("sync", function (removeData, secondRemoveData) {
          console.info("removeListener", removeData, secondRemoveData);
        });
        if (typeof callback === "function") {
          callback(true);
        }
        const sendSync = {
          ok: true,
          clientTimestamp: data.clientTimestamp,
          serverTimestamp: `${moment().utcOffset("+05:30").valueOf()}`,
        };
        socket.emit("sync", sendSync);
      } catch (error) {
        logger.error("error sync", new Date(), error);
      }
    });

    socket.on("ping", (callback) => {
      socket.emit("pong", { ok: true });
      if (typeof callback === "function") {
        callback();
      }
    });

    socket.on("pong", (callback) => {
      logger.info(
        "ping: pong received date:",
        new Date(),
        "latency :",
        "latency",
        "socket:",
        socket.id
      );
      callback(
        "ping: pong received date:",
        new Date(),
        "latency :",
        "latency",
        "socket:",
        socket.id
      );
    });
  } catch (error) {
    logger.error("-----> error BindSocketToEvent", error);
    getInfo.exceptionError(error);
  }
};

module.exports = { init };

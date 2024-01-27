const { getRandomId } = require("../utils");
//const { redFlagData } = require("../utils/redFlagJob");
const _ = require("underscore");
const getInfo = require("../common");
const commonClass = require("./common.class");
const logger = require("../utils/logger");
const { fileUpload } = require("../utils/fileUpload");
const moment = require("moment");
const { GetConfig } = require("../connections/mongodb");

const saveGameHistory = async (tableData, playersData, winner) => {
  try {
    logger.info("saveGameHistory playersData : ", playersData);
    const users = [];
    for (const [i, element] of playersData.entries()) {
      if (element._ir == 0) {
        users.push(getInfo.MongoID(element.uid));
      }
      if ((tableData.gt == "Pool" || tableData.gt == "Deal") && tableData.round == 1) {
        playersData[i].invoiceId = `RXLI${tableData.tjid}${i}`;
      } else if (tableData.gt == "Points" && playersData[0].uid !== element.uid) {
        playersData[i].invoiceId = `RXLI${tableData.tjid}${tableData.round}${i}`;
      }
    }

    const userGameHistory = await db
      .collection("UserGameHistory")
      .find({
        tableId: tableData._id.toString(),
        gameType: tableData.gt,
      })
      .sort({ createdAt: -1 })
      .project({ _id: 1, tableId: 1 })
      .toArray();

    const saveTableData = {
      userId: users,
      tableId: tableData._id.toString(),
      bootValue: tableData.bv,
      pointValue: tableData.pt,
      mode: tableData.mode,
      availablePlayers: tableData.ap,
      gameId: tableData.game_id,
      tableGenerationId: tableData.tjid,
      minimumSeats: tableData.ms,
      subId: tableData.sub_id,
      gameType: tableData.gt,
      createdAt: new Date(),
      tds: tableData.tds,
      commission: tableData.commission,
      taxPercent: tableData.taxPercent,
      taxAmount: tableData.tax,
      bonusPercentage: tableData.bonusPercentage,
    };
    logger.info("typeof winner------------>", typeof winner);
    let userArray;
    if (tableData.gt == "Pool" && typeof winner == "object") {
      userArray = {
        round: tableData.round,
        playersList: playersData,
        rejoinAcceptedUsers: tableData.rejoinAcceptedUsers,
        tableStatus: tableData.tst,
        wildCard: tableData.wildCard,
        winner: winner,
      };
    } else {
      userArray = {
        round: tableData.round,
        playersList: playersData,
        tableStatus: tableData.tst,
        wildCard: tableData.wildCard,
        winner: winner.length ? winner : [winner],
      };
    }

    let matchUserData = {
      tableId: tableData._id.toString(),
    };

    let updateData = {};
    if (tableData.gt != "Points") {
      if (userGameHistory.length) {
        matchUserData = userGameHistory[0];
        delete saveTableData.createdAt;
      } else {
        saveTableData.transactionId = await getRandomId(
          10,
          "UserGameHistory",
          "tableHistory.transactionId"
        );
      }
      updateData = { $set: saveTableData, $push: { tableHistory: userArray } };
      await db
        .collection("UserGameHistory")
        .findOneAndUpdate(matchUserData, updateData, {
          new: true,
          upsert: true,
        });
    } else {
      updateData = {
        ...saveTableData, ...userArray, transactionId: await getRandomId(
          10,
          "UserGameHistory",
          "tableHistory.transactionId"
        ),
      };

      await db.collection("UserGameHistory").insertOne(updateData);
    }
  } catch (error) {
    logger.error("-----> error saveGameHistory", error);
    getInfo.exceptionError(error);
  }
};

const getGameHistory = async (data, client, eventName) => {
  try {
    const { LAST_GAME_HISTORY } = GetConfig();
    if (
      // !data.gt ||
      // (!data.pointValue && data.gameType == "Deal") ||
      // (!data.pointValue && data.gameType == "Pool") ||
      !data.mode ||
      !client.uid.toString()
    ) {
      return commonClass.SendData(client, eventName, {
        success: false,
        msg: `Not enough data to get game history`,
      });
    }
    let query;
    if (!data.gt) {
      query = {
        userId: client.uid.toString(),
        // gameType: data.gt,
        mode: data.mode,
      };
    } else {
      query = {
        userId: client.uid.toString(),
        gameType: data.gt,
        mode: data.mode,
      };
    }

    /* const query = {
    userId: client.uid.toString(),
    gameType: data.gt,
    mode: data.mode,
  }; */

    // if (data.gt !== "Points") query.pointValue = data.pointValue;

    const userGameHistory = await db
      .collection("UserGameHistory")
      .find(query)
      .sort({ _id: -1 })
      .limit(LAST_GAME_HISTORY)
      .toArray();

    if (userGameHistory.length === 0) {
      if (!data.gt) {
        return commonClass.SendData(client, eventName, {
          success: false,
          msg: `You have not played any ${data.mode} games recently. Your game history will appear once you play again.`,
        });
      }
      return commonClass.SendData(client, eventName, {
        success: false,
        msg: `You have not played any ${data.gt} ${data.mode} games recently. Your game history will appear once you play again.`,
      });
    }

    return commonClass.SendData(client, eventName, userGameHistory);
  } catch (error) {
    logger.error("-----> error getGameHistory", error);
    getInfo.exceptionError(error);
  }
};

const getInGameHistory = async (data, client, eventName) => {
  try {
    const { LAST_GAME_HISTORY } = GetConfig();
    if (!data.mode || !client.uid.toString()) {
      return commonClass.SendData(client, eventName, {
        success: false,
        msg: `Not enough data to get game history`,
        response: [],
      });
    }
    let query = {
      userId: { $in: [getInfo.MongoID(client.uid), client.uid.toString()] },
      mode: data.mode,
    };
    if (data.gt) {
      query.gameType = data.gt;
    }

    if (data.pointValue && data.gt == "Pool") {
      query.pointValue = data.pointValue;
    }

    let projectData;

    if (data.gt == "Points") {
      projectData = {
        _id: 1,
        userId: 1,
        tableId: 1,
        bootValue: 1,
        pointValue: 1,
        mode: 1,
        tableGenerationId: 1,
        gameType: 1,
        transactionId: 1,
        round: 1,
        "playersList.uid": 1,
        "playersList.si": 1,
        "playersList.un": 1,
        "playersList.indecl": 1,
        "playersList.s": 1,
        "playersList.ps": 1,
        "playersList.dps": 1,
        "playersList.tdps": 1,
        "playersList.tScore": 1,
        "playersList.pts": 1,
        "playersList.cards": 1,
        "playersList.gCards": 1,
        "playersList.dCards": 1,
        "playersList.wc": 1,
        tableStatus: 1,
        wildCard: 1,
        winner: 1,
      };
    } else {
      projectData = {
        _id: 1,
        userId: 1,
        tableId: 1,
        bootValue: 1,
        pointValue: 1,
        mode: 1,
        tableGenerationId: 1,
        gameType: 1,
        "tableHistory.transactionId": 1,
        "tableHistory.round": 1,
        "tableHistory.playersList.uid": 1,
        "tableHistory.playersList.si": 1,
        "tableHistory.playersList.un": 1,
        "tableHistory.playersList.indecl": 1,
        "tableHistory.playersList.s": 1,
        "tableHistory.playersList.ps": 1,
        "tableHistory.playersList.dps": 1,
        "tableHistory.playersList.tdps": 1,
        "tableHistory.playersList.tScore": 1,
        "tableHistory.playersList.pts": 1,
        "tableHistory.playersList.cards": 1,
        "tableHistory.playersList.gCards": 1,
        "tableHistory.playersList.dCards": 1,
        "tableHistory.playersList.wc": 1,
        "tableHistory.tableStatus": 1,
        "tableHistory.wildCard": 1,
        "tableHistory.winner": 1,
      };
    }

    let userGameHistory = await db
      .collection("UserGameHistory")
      .find(query)
      .project(projectData)
      .sort({ _id: -1 })
      .limit(LAST_GAME_HISTORY)
      .toArray();

    if (userGameHistory.length === 0) {
      return commonClass.SendData(client, eventName, {
        success: false,
        msg: `You have not played any ${data.gt} ${data.mode} games recently. Your game history will appear once you play again.`,
        response: [],
      });
    }
    let sortedHistory = [];
    for (const iterator of userGameHistory) {
      if (iterator.playersList) {
        iterator.playersList = _.sortBy(
          iterator.playersList,
          (o) => o.pointsOfCards
        );
      }
      sortedHistory.push(iterator);
    }

    return commonClass.SendData(client, eventName, {
      success: true,
      msg: ``,
      response: sortedHistory,
    });
  } catch (error) {
    logger.error("-----> error getInGameHistory", error);
    getInfo.exceptionError(error);
  }
};

const saveGameHistoryFeedback = async (data, client, eventName) => {
  try {
    if (!data.flag || !client.tbid || !client.uid) {
      return commonClass.SendData(client, eventName, {
        msg: `Not enough data to get game history`,
      });
    }
    // logger.info('data.tbid,-------->', data.tbid,);
    let userGameHistory = await db
      .collection("UserGameHistory")
      .find({ tableId: client.tbid })
      .toArray();
    if (userGameHistory.length === 0) {
      return commonClass.SendData(client, eventName, {
        msg: `You have not played any games recently. Your game history will appear once you play again.`,
      });
    }
    let reason;
    if (data.flag) {
      reason = "";
    } else {
      if (!data.reason) {
        return commonClass.SendData(client, eventName, {
          msg: `Not enough data to update your feedback`,
        });
      }
      reason = data.reason;
    }

    userGameHistory = await db
      .collection("UserGameHistory")
      .findOne({ feedback: { $elemMatch: { userId: client.uid } } });
    if (userGameHistory) {
      await db.collection("UserGameHistory").findOneAndUpdate(
        { tableId: client.tbid, "feedback.userId": client.uid },
        {
          $set: {
            "feedback.$.userId": client.uid,
            "feedback.$.thumb": data.flag,
            "feedback.$.reason": reason,
          },
        },
        { new: true, upsert: true }
      );
    } else {
      await db.collection("UserGameHistory").findOneAndUpdate(
        {
          tableId: client.tbid,
        },
        {
          $push: {
            feedback: {
              userId: client.uid,
              thumb: data.flag,
              reason: reason,
            },
          },
        },
        { new: true, upsert: true }
      );
    }

    await db.collection("play_track").findOneAndUpdate(
      { tbid: client.tbid, "pi.uid": client.uid },
      {
        $set: {
          "pi.$.thumb": data.flag,
          "pi.$.reason": reason,
        },
      },
      { new: true, upsert: true }
    );

    userGameHistory = await db
      .collection("UserGameHistory")
      .find({ tableId: client.tbid })
      .toArray();
    return commonClass.SendData(client, eventName, userGameHistory);
  } catch (error) {
    logger.error("-----> error saveGameHistoryFeedback", error);
    getInfo.exceptionError(error);
  }
};

const updateUserPrize = async (tableData, userId, seatIndex) => {
  try {
    let userGameHistory = await db
      .collection("UserGameHistory")
      .find({ tableId: tableData._id.toString() })
      .toArray();

    if (userGameHistory) {
      const updateData = await db
        .collection("UserGameHistory")
        .findOneAndUpdate(
          {
            tableId: tableData._id.toString(),
            "tableHistory.playersList.uid": userId.toString(),
          },
          {
            $set: {
              "tableHistory.0.playersList.$[elem].userViewCashChips":
                tableData.bv,
            },
          },
          { arrayFilters: [{ "elem.uid": userId.toString() }], new: true }
        );
      logger.info("updateDataupdateData", updateData);
      logger.info("-----> updateDataupdateData", updateData);
    }
  } catch (error) {
    logger.error("-----> error updateUserPrize", error);
    getInfo.exceptionError(error);
  }
};

// const storeTableHistory = async ({ eventName, tableId, tableData, userIndex }) => {
//   try {
//     /* +-------------------------------------------------------------------+
//       desc:function to Store Table History game
//       i/p: tableId = table id
//       update data for store in table history
//     +-------------------------------------------------------------------+ */
//     const updateValue = {
//       tableId: getInfo.MongoID(tableId),
//       eventName,
//       tableGenerationId: tableData.tjid,
//       availablePlayers: tableData.ap,
//       mode: tableData.mode,
//       minimumSeats: tableData.ms,
//       bootValue: tableData.bv,
//       prize: tableData.prize,
//       deals: tableData.deals,
//       pointValue: tableData.pt,
//       gameType: tableData.gt,
//       tableStatus: tableData.tst,
//       user: {
//         userId: getInfo.MongoID(tableData.pi[userIndex].uid),
//         userName: tableData.pi[userIndex].un,
//         mobile: tableData.pi[userIndex].mobile,
//         userIp: tableData.pi[userIndex].userIp,
//         userDeviceId: tableData.pi[userIndex].userDeviceId,
//         unique_id: tableData.pi[userIndex].unique_id,
//         state: tableData.pi[userIndex].state,
//         location: tableData.pi[userIndex].location,
//         isBot: tableData.pi[userIndex]._ir,
//         seatIndex: tableData.pi[userIndex].si,
//         status: tableData.pi[userIndex].s,
//         roundCount: tableData.pi[userIndex].rndCount,
//         userCards: tableData.pi[userIndex].cards,
//         groupCards: tableData.pi[userIndex].gCards,
//         pointsOfCards: tableData.pi[userIndex].ps,
//         dealPoints: tableData.pi[userIndex].dps,
//         totalDealPoints: tableData.pi[userIndex].tdps,
//         totalScore: tableData.pi[userIndex].tScore,
//         pointsMultipliedBootValue: tableData.pi[userIndex].pts,
//         turnCounter: tableData.pi[userIndex].turnCounter,
//         takeCard: tableData.pi[userIndex].tcard,
//         pickCount: tableData.pi[userIndex].pickCount,
//         maxUserTimeout: tableData.pi[userIndex].maxUserTimeout,
//         winCash: tableData.pi[userIndex].wc,
//       },
//       tie: tableData.tie,
//       wildCard: tableData.wildCard,
//       closeDeck: tableData.cDeck,
//       openDeck: tableData.oDeck,
//       turn: tableData.turn,
//       declareCount: tableData.declCount,
//       finishPlayer: tableData.fnsPlayer,
//       potValue: tableData.pv,
//       round: tableData.round,
//       categoryId: tableData.categoryId,
//       rejoinAcceptedUsers: tableData.rejoinAcceptedUsers,
//     };

//     // await db.collection("tableHistory").insertOne({ ...updateValue, createdAt: new Date() });
//   } catch (error) {
//     logger.error("-----> error storeTableHistory", error);
//     getInfo.exceptionError(error);
//   }
// };

// const storeTableHistoryForWinner = async ({ eventName, tableId, tableData, playerData, winner }) => {
//   try {
//     /* +-------------------------------------------------------------------+
//       desc:function to Store Table History game
//       i/p: tableId = table id
//       update data for store in table history
//     +-------------------------------------------------------------------+ */
//     let playerList = [];
//     for (const iterator of playerData) {
//       playerList.push({
//         userId: getInfo.MongoID(iterator.uid),
//         userName: iterator.un,
//         mobile: iterator.mobile,
//         userIp: iterator.userIp,
//         userDeviceId: iterator.userDeviceId,
//         unique_id: iterator.unique_id,
//         state: iterator.state,
//         location: iterator.location,
//         isBot: iterator._ir,
//         seatIndex: iterator.si,
//         status: iterator.s,
//         roundCount: iterator.rndCount,
//         userCards: iterator.cards,
//         groupCards: iterator.gCards,
//         pointsOfCards: iterator.ps,
//         dealPoints: iterator.dps,
//         totalDealPoints: iterator.tdps,
//         totalScore: iterator.tScore,
//         pointsMultipliedBootValue: iterator.pts,
//         turnCounter: iterator.turnCounter,
//         takeCard: iterator.tcard,
//         pickCount: iterator.pickCount,
//         maxUserTimeout: iterator.maxUserTimeout,
//         winCash: iterator.wc
//       });
//     }

//     const updateValue = {
//       tableId: getInfo.MongoID(tableId),
//       eventName,
//       tableGenerationId: tableData.tjid,
//       availablePlayers: tableData.ap,
//       mode: tableData.mode,
//       minimumSeats: tableData.ms,
//       bootValue: tableData.bv,
//       prize: tableData.prize,
//       deals: tableData.deals,
//       pointValue: tableData.pt,
//       gameType: tableData.gt,
//       tableStatus: tableData.tst,
//       user: playerList,
//       tie: tableData.tie,
//       wildCard: tableData.wildCard,
//       closeDeck: tableData.cDeck,
//       openDeck: tableData.oDeck,
//       turn: tableData.turn,
//       declareCount: tableData.declCount,
//       finishPlayer: tableData.fnsPlayer,
//       potValue: tableData.pv,
//       round: tableData.round,
//       categoryId: tableData.categoryId,
//       rejoinAcceptedUsers: tableData.rejoinAcceptedUsers,
//       winner: winner ?? []
//     };

//     // await db.collection("tableHistory").insertOne({ ...updateValue, createdAt: new Date() });
//     // if (updateValue?.tableStatus === "winnerDeclared") {
//     //   storeInS3TableHistory({ tableId });
//     // }
//   } catch (error) {
//     logger.error("-----> error storeTableHistoryForWinner", error);
//     getInfo.exceptionError(error);
//   }
// };

// const storeInS3TableHistory = async ({ tableId }) => {
//   try {
//     /* +-------------------------------------------------------------------+
//       desc:function to Store Table History game
//       i/p: tableId = table id
//       update data for store in table history
//     +-------------------------------------------------------------------+ */
//     const { BUCKET_URL } = GetConfig();
//     const tableHistory = await db.collection("tableHistory").find({ tableId: getInfo.MongoID(tableId.toString()) }).sort({ _id: 1 }).toArray();

//     const buffer = Buffer.from(JSON.stringify(tableHistory));
//     const jsonFile = await fileUpload({
//       fileContent: buffer,
//       folderCategoryLocation: moment().format("DD-MM-YYYY"),
//       fileCategoryName: "TABLE_HISTORY",
//       uniqueId: tableId,
//       folderType: "files",
//       extension: "json"
//     });

//     await db.collection("UserGameHistory").findOneAndUpdate(
//       { tableId: tableId.toString() },
//       { $set: { tableHistoryFile: process.env.environment == "staging" ? `${jsonFile.Location}` : `${BUCKET_URL}${jsonFile.Key}` } },
//       { new: true }
//     );
//     // await db.collection("tableHistory").deleteMany({ tableId });

//   } catch (error) {
//     logger.error("-----> error storeInS3TableHistory", error);
//     getInfo.exceptionError(error);
//   }
// };

// setTimeout(() => {
//   storeInS3TableHistory({ tableId: getInfo.MongoID("6406c80220c000226cfbf3f3") });
// }, 3000);

module.exports = {
  saveGameHistory,
  getGameHistory,
  getInGameHistory,
  saveGameHistoryFeedback,
  updateUserPrize,
  // storeTableHistory,
  // storeTableHistoryForWinner
};

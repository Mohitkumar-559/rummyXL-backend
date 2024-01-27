const logger = require("../utils/logger");
const getInfo = require("../common");
const _ = require("underscore");
const declareClass = require("../classes/declareCard.class");
const { GetConfig } = require("../connections/mongodb");

const removeStuckTable = async (table) => {
  const {ENABLE_STUCK_TABLE_SCRIPT,ENABLE_REMOVE_STUCK_TABLE_FUNCTION}=GetConfig();
  // table.tableID=table._id.toString();
  // delete table._id;
  
  try {
    logger.info("remove stuck table function called");
    if(ENABLE_STUCK_TABLE_SCRIPT|| ENABLE_REMOVE_STUCK_TABLE_FUNCTION){
      let count = await db
      .collection("stuck_tables")
      .countDocuments({ _id: getInfo.MongoID(table._id) });
    if (count == 0) {
      await db.collection("stuck_tables").insertOne(table);
    }

    if (
      (table.tst == "" || table.tst == "RoundTimerStarted") &&
      (table.gt == "Points" || table.round == 0)
    ) {
      await db
        .collection("playing_table")
        .findOneAndUpdate(
          { _id: getInfo.MongoID(table._id) },
          { $set: { ctt: new Date() } }
        );

      if (table.ap == 0) {
        await db
          .collection("playing_tables")
          .deleteOne({ _id: getInfo.MongoID(table._id) });
      } else if (table.ap != 0 && table.uCount == 0) {
        const robotsClass = require("../classes/robots.class");
        robotsClass.removeRobots(table._id.toString());
      } else {
        await db
          .collection("playing_table")
          .findOneAndUpdate(
            { _id: getInfo.MongoID(table._id) },
            { $set: { ctt: new Date(), round: 0 } }
          );
        for await (let player of table.pi) {
          if (
            !_.isEmpty(player) &&
            typeof player.si != "undefined" &&
            player._ir == 0
          ) {
            player.tbid = table._id.toString();
           await leaveTableClass.LeaveTable(
              { flag: "stuck", onInvite: false, eliminated: true ,scriptLeave:true},
              player,
              function (check) {
                logger.info("stuck table------player removed ----", check);
              }
            );
          }
        }
      }
    } else if (table.tst == "RematchTimerStarted") {
      await db
        .collection("playing_table")
        .findOneAndUpdate(
          { _id: getInfo.MongoID(table._id) },
          { $set: { ctt: new Date() } }
        );
      //  await db.collection("playing_table").findOneAndUpdate({ _id: getInfo.MongoID(table._id) }, { $set: { tst:  } })
      for await (let player of table.pi) {
        if (
          !_.isEmpty(player) &&
          typeof player.si != "undefined" &&
          player._ir == 0
        ) {
          player.tbid = table._id.toString();
         await leaveTableClass.LeaveTable(
            { flag: "stuck", onInvite: false, eliminated: true ,scriptLeave:true},
            player,
            function (check) {
              logger.info("stuck table-------if---else----", check);
            }
          );
        }
      }
    } else if (table.tst == "winnerDeclared") {
      await db
        .collection("playing_table")
        .deleteOne({ _id: getInfo.MongoID(table._id) });
      // let amount;
      // if (table.gt == "Points") {
      //     amount = table.bv * 80;

      // } else {
      //     amount = table.bv;
      // }

      // let winner;
      // for (let player of table.pi) {
      //     if (player._iw == 1) {
      //         winner = player;
      //     }

      // }

      // if (table.gt == "Points") {
      //     await db.collection("playing_table").findOneAndUpdate({ _id: getInfo.MongoID(table._id.toString()), "pi.uid": winner.uid.toString() }, { $set: { "pi.$.upc": winner.userViewCashChips, tst: "RoundTimerStarted", ctt: new Date() }, $inc: { "pi.$.winAmount": -amount } });
      //     // await db.collection("playing_table").findOneAndUpdate({ _id: getInfo.MongoID(table._id.toString()), "pi.uid": winner.uid.toString() }, { $set: { tst: "RoundTimerStarted", ctt: new Date() }, $inc: { "pi.$.upc": amount } });
      //     console.log("check")
      // } else {
      //     await db.collection("playing_table").findOneAndUpdate({ _id: getInfo.MongoID(table._id), "pi.uid": winner.uid.toString() }, { $set: { "pi.$.upc": 0, tst: "RoundTimerStarted", ctt: new Date() }, $inc: { "pi.$.winAmount": -amount } });
      // }
      // for (let player of table.pi) {

      //     if (!_.isEmpty(player) && typeof player.si != "undefined" && player._ir == 0) {
      //         await db.collection("playing_table").findOneAndUpdate({ _id: getInfo.MongoID(table._id.toString()), "pi.uid": player.uid.toString() }, { $inc: { "pi.$.upc": amount } });
      //         player.tbid = table._id.toString();
      //         leaveTableClass.LeaveTable(
      //             { flag: "stuck", onInvite: false, eliminated: true },
      //             player,
      //             function (check) {
      //                 logger.info("stuck table---- else---- :", check);
      //             }
      //         );
      //     }
      // }
    } else {
      let amount;
      let updateTable={ tst: "RoundTimerStarted", round: 0, ctt: new Date() };
      if (table.gt == "Points") {
        amount = table.bv * 80;
        delete updateTable.round
      } else {
        amount = table.bv;
      }
      await db
        .collection("playing_table")
        .findOneAndUpdate(
          { _id: getInfo.MongoID(table._id) },
          { $set: updateTable }
        );
        for await (let player of table.pi) {
          if (
            !_.isEmpty(player) &&
            typeof player.si != "undefined" &&
            player._ir == 0
          ) {
           
            await db
              .collection("playing_table")
              .findOneAndUpdate(
                {
                  _id: getInfo.MongoID(table._id.toString()),
                  "pi.uid": player.uid.toString(),
                },
                { $inc: { "pi.$.upc": amount } }
              );
          }

        }
      for await (let player of table.pi) {
        logger.info("stuck table------removing--player----:",player.uid.toString());
        if (
          !_.isEmpty(player) &&
          typeof player.si != "undefined" &&
          player._ir == 0
        ) {         
          player.tbid = table._id.toString();
          await leaveTableClass.LeaveTable(
            { flag: "stuck", onInvite: false, eliminated: true,scriptLeave:true },
            player,
            function (check) {
              logger.info("stuck table------player removed ----:", check);
            }
          );
        }
      }
    }

    }
    
  } catch (error) {
    logger.error(
      "-----> error stuck table script remove stuck table function",
      error
    );
    getInfo.exceptionError(error);
  }
};
const checkStuckTables = async () => {
  //finding stuck tables
  logger.info("stuck table entered");
  const {STUCK_TABLE_CHECK_TIME_IN_MINUT,ENABLE_STUCK_TABLE_SCRIPT}=GetConfig();
  if(ENABLE_STUCK_TABLE_SCRIPT){
    let currDate = new Date();
    let newDate = new Date(currDate.setMinutes(currDate.getMinutes() - STUCK_TABLE_CHECK_TIME_IN_MINUT));
    let tables = await db
      .collection("playing_table")
      .find({
        ctt: { $lt: newDate },
        la: { $lt: newDate },
      })
      .toArray();
  
    //clear table
    for (let table of tables) {
      await removeStuckTable(table);
    }

  }
 
};

module.exports = { checkStuckTables, removeStuckTable };

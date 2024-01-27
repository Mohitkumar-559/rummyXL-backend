const logger = require("../utils/logger");
const getInfo = require(".");

const checkPlayerAvailability = async (table) => {
  try {
    let playersObject = table.pi.filter((x) => x.uid && x._ir == 0);
    let playersId = playersObject.map((x) => getInfo.MongoID(x.uid));
    const userDetails = await db
      .collection("game_users")
      .find(
        { _id: { $in: playersId }, "flags._ir": 0, rejoin: 1 },
        {
          projection: {
            rejoin: 1,
            rejoinID: 1,
            sck: 1,
            uid: 1,
            si: 1,
            tbid: 1,
          },
        }
      )
      .toArray();
    if (playersId.length > 0 && userDetails.length > 0) {
      const mergedData = playersObject.map((data) => ({
        ...data,
        ...userDetails.find(
          (newData) => newData._id.toString() == data.uid.toString()
        ),
      }));

      await await db
        .collection("game_users")
        .updateMany(
          { _id: { $in: playersId } },
          { $set: { tableRemove: true } }
        );
      for await (let value of mergedData) {
        leaveTableClass.LeaveTable(
          { flag: "disc", eliminated: true },
          {
            id: value?.sck?.replace(/s\d*_\d*./i, ""),
            uid: value._id,
            _ir: value._ir,
            si: value.si,
            tbid: table._id,
          },
          function (check) {
            logger.info("removeOnLowChips----------->>>check: ", check);
          }
        );
      }
    }
    return table;
  } catch (error) {
    logger.error("-----> error checkPlayerAvailability", error);
    getInfo.exceptionError(error);
  }
};

module.exports = checkPlayerAvailability;

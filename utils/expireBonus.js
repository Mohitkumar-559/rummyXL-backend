const getInfo = require("../common");
const logger = require("../utils/logger");
const { GetConfig } = require("../connections/mongodb");
async function expireBonus(userId) {
  try {
    const user = await db
      .collection("game_users")
      .findOne({ _id: getInfo.MongoID(userId), "flags._ir": 0 });
    if (user) {
      const { EXPIRE_SIGNUP_BONUS } = GetConfig();

      //1. check signUpBonus
      let days = EXPIRE_SIGNUP_BONUS;
      logger.info("signUpdate------------>", user.cd);
      let expire_date = new Date(
        user.cd.getTime() + days * 24 * 60 * 60 * 1000
      );
      logger.info("expire_date------------>", expire_date);

      if (!user.SignUpBonusExpire) {
        await db.collection("game_users").updateOne(
          { _id: user._id },
          {
            $set: {
              SignUpBonusExpire: expire_date,
              SignUpBonusStatus: "Active",
            },
          },
          { new: true }
        );
      }
      let SignUpBonusExpire = user.SignUpBonusExpire
        ? user.SignUpBonusExpire
        : expire_date;

      if (new Date() >= SignUpBonusExpire) {
        await db.collection("game_users").updateOne(
          { _id: user._id },
          {
            $set: {
              // SignUpBonus: 0,
              SignUpBonusStatus: "Expired",
            },
          },
          { new: true }
        );
      }

      //2. referral bonus
      if (user.referral_bonus) {
        for (const element of user.referral_bonus) {
          logger.info("newDate---------->", new Date());
          if (new Date() >= element.expire_date && element.status == "Active") {
            await db.collection("game_users").updateOne(
              { _id: user._id, "referral_bonus._id": element._id },
              {
                $set: {
                  // "referral_bonus.$.referralBonus": 0,
                  "referral_bonus.$.status": "Expired",
                },
              },
              { new: true }
            );
          }
        }
      }
      //3. addCash bonus
      if (user.addCash_bonus) {
        logger.info("newDate---------->", new Date());
        for (const element of user.addCash_bonus) {
          if (new Date() >= element.expire_date && element.status == "Active") {
            await db.collection("game_users").updateOne(
              { _id: user._id, "addCash_bonus._id": element._id },
              {
                $set: {
                  // "addCash_bonus.$.addCashBonus": 0,
                  "addCash_bonus.$.status": "Expired",
                },
              },
              { new: true }
            );
          }
        }
      }
    }
  } catch (error) {
    logger.error("-----> error expireBonus", error);
    getInfo.exceptionError(error);
    return error;
  }
}

module.exports = expireBonus;

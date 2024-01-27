const expireBonus = require("../utils/expireBonus");
const { GetConfig } = require("../connections/mongodb");

let projection = {
  SignUpBonus: 1,
  Winning: 1,
  totalcash: 1,
  depositCash: 1,
  Unutilized: 1,
  Bonus: 1,
  referral_bonus: 1,
  addCash_bonus: 1,
  Chips: 1,
  SignUpBonusExpire: 1,
  SignUpBonusStatus: 1,
};
const cashCut = async ({
  userInfo,
  entryFee,
  winStatus,
  tableId,
  cutBonus,
  getList = false,
}) => {
  const userData = await db
    .collection("game_users")
    .findOne({ _id: userInfo._id }, { projection });

  if (winStatus) {
    let updateWinCash = 0;
    let updateDepositCash = 0;
    let updateBonusCash = 0;
    let bonusCut = 0;
    let bounsId = null;
    let bonusType = "";

    if (winStatus == "Game Win") {
      updateWinCash = entryFee + userData.Winning;
      updateDepositCash = userData.depositCash;
    } else {
      const userDataPercent = await db.collection("user_cash_percent").findOne({
        userId: userInfo._id.toString(),
        tableId: tableId.toString(),
      });

      // update bonus data
      userDataPercent.updateBonusCash = userDataPercent.updateBonusCash
        ? userDataPercent.updateBonusCash
        : 0;
      if (userDataPercent && userDataPercent.bounsRemainPercent != 0) {
        bonusCut = +(
          (entryFee * userDataPercent.bounsRemainPercent) /
          100
        ).toFixed(2);
        bounsId = userDataPercent.bonusRemainId;
        bonusType = userDataPercent.remainBonusType;
      }
      updateBonusCash = userDataPercent.updateBonusCash + bonusCut;

      // update Cash data
      userData.depositCash = userData.depositCash ? userData.depositCash : 0;
      if (userDataPercent && userDataPercent.remainDepositPercent != 0) {
        updateDepositCash = +(
          (entryFee * userDataPercent.remainDepositPercent) /
          100
        ).toFixed(2);
      }
      updateDepositCash = userData.depositCash + updateDepositCash;

      // update Win data
      userData.Winning = userData.Winning ? userData.Winning : 0;
      if (userDataPercent && userDataPercent.remainWinPercent != 0) {
        updateWinCash = +(
          (entryFee * userDataPercent.remainWinPercent) /
          100
        ).toFixed(2);
      }
      updateWinCash = userData.Winning + updateWinCash;

      if (userDataPercent)
        await db.collection("user_cash_percent").deleteOne({
          _id: userDataPercent._id,
        });
    }

    let totalCash = Math.abs(updateWinCash) + Math.abs(updateDepositCash);

    return {
      totalCash: +totalCash.toFixed(2),
      bonusCut: +bonusCut.toFixed(2),
      updateBonusCash: +updateBonusCash.toFixed(2),
      updateDepositCash: +updateDepositCash.toFixed(2),
      updateWinCash: +updateWinCash.toFixed(2),
      bounsId,
      bonusType,
    };
  }
  return calculationOfPlayCash({
    entryFee,
    userData,
    cutBonus,
    getList,
    tableId,
  });
};

const takeUserBonus = async (userInfo) => {
  await expireBonus(userInfo._id);
  const userData = await db.collection("game_users").findOne(
    {
      _id: userInfo._id,
    },
    {
      projection: {
        SignUpBonusStatus: 1,
        SignUpBonus: 1,
        addCash_bonus: {
          $elemMatch: {
            status: "Active",
            addCashBonus: { $ne: 0 },
          },
        },
        referral_bonus: {
          $elemMatch: {
            status: "Active",
            referralBonus: { $ne: 0 },
          },
        },
      },
    }
  );

  if (!userData) return null;
  if (userData.SignUpBonusStatus == "Active" && userData.SignUpBonus != 0) {
    return {
      bounsId: null,
      bonusType: "SignUpBonus",
      bonusAmount: userData.SignUpBonus ? userData.SignUpBonus : 0,
    };
  }

  if (userData.referral_bonus && userData.referral_bonus.length) {
    const referralBonus = userData.referral_bonus.find(
      (x) => x.status == "Active" && x.referralBonus != 0
    );
    if (referralBonus)
      return {
        bounsId: referralBonus._id,
        bonusType: "referralBonus",
        bonusAmount: referralBonus.referralBonus,
      };
  }

  if (userData.addCash_bonus && userData.addCash_bonus.length) {
    const addCashBonus = userData.addCash_bonus.find(
      (x) => x.status == "Active" && x.addCashBonus != 0
    );
    if (addCashBonus)
      return {
        bounsId: addCashBonus._id,
        bonusType: "addCashBonus",
        bonusAmount: addCashBonus.addCashBonus,
      };
  }

  return {
    bonusType: "",
    bonusAmount: 0,
  };
};

const calculationOfPlayCash = async ({
  entryFee,
  userData,
  cutBonus,
  getList = false,
  tableId,
}) => {
  let bounsId = null,
    bonusType = "",
    bonusAmount = 0,
    bonusRemainId = null,
    bonusRemainAmount = 0,
    remainBonusType = "",
    bounsRemainPercent = 0;

  const { MAX_DEADWOOD_PTS } = GetConfig();

  if (!getList) {
    const userBonus = await takeUserBonus(userData);
    bounsId = userBonus.bounsId;
    bonusType = userBonus.bonusType;
    bonusAmount = userBonus.bonusAmount;
  } else {
    let totalCashBonus = 0,
      totalReferralBonus = 0;

    if (userData.addCash_bonus) {
      for (const element of userData.addCash_bonus) {
        if (element.status == "Active" && element.addCashBonus != 0)
          totalCashBonus += element.addCashBonus;
      }
    }

    if (userData.referral_bonus) {
      for (const element of userData.referral_bonus) {
        if (element.status == "Active" && element.referralBonus != 0)
          totalReferralBonus += element.referralBonus;
      }
    }
    const SignUpBonus =
      userData.SignUpBonusStatus == "Active" ? userData.SignUpBonus : 0;
    bonusAmount = totalCashBonus + SignUpBonus + totalReferralBonus;
  }

  let bonusCut =
    bonusAmount == 0 ? 0 : +((entryFee * +cutBonus) / 100).toFixed(2);
  let pendingEntryFee = entryFee;
  let bounsPercent = 0;
  let updateBonusCash = 0;
  let updateDepositCash = 0,
    remainDepositCash = 0,
    remainDepositPercent = 0;
  let updateWinCash = userData.Winning ?? 0,
    remainWinCash = 0,
    remainWinPercent = 0;

  if (tableId && !getList) {
    const userDataPercent = await db.collection("user_cash_percent").findOne({
      userId: userData._id.toString(),
      tableId: tableId.toString(),
    });

    if (userDataPercent) {
      remainDepositCash = userDataPercent.remainDepositCash;
      remainWinCash = userDataPercent.remainWinCash;
      remainDepositPercent = userDataPercent.remainDepositPercent;
      remainWinPercent = userDataPercent.remainWinPercent;
      bounsRemainPercent = userDataPercent.bounsRemainPercent;
      bonusRemainAmount = userDataPercent.bonusRemainAmount;

      bonusRemainId = userDataPercent.bonusRemainId
        ? userDataPercent.bonusRemainId
        : bounsId;
      remainBonusType = userDataPercent.remainBonusType
        ? userDataPercent.remainBonusType
        : bonusType;

      if (bonusCut <= bonusAmount && pendingEntryFee !== 0) {
        updateBonusCash = bonusAmount - bonusCut;
        pendingEntryFee = pendingEntryFee - bonusCut;
        bonusRemainAmount += bonusCut;
        bounsPercent = bonusCut;
      } else if (pendingEntryFee !== 0) {
        pendingEntryFee = pendingEntryFee - bonusAmount;
        bounsPercent = bonusAmount;
        bonusCut = bonusAmount;
        bonusRemainAmount += bonusAmount;
      }

      if (pendingEntryFee <= userData.depositCash && pendingEntryFee !== 0) {
        updateDepositCash = userData.depositCash - pendingEntryFee;
        remainDepositCash += pendingEntryFee;
        pendingEntryFee = 0;
      } else if (pendingEntryFee !== 0) {
        pendingEntryFee = pendingEntryFee - userData.depositCash;
        remainDepositCash += userData.depositCash;
      }

      if (pendingEntryFee <= userData.Winning && pendingEntryFee !== 0) {
        updateWinCash = userData.Winning - pendingEntryFee;
        remainWinCash += pendingEntryFee;
        pendingEntryFee = 0;
      } else if (pendingEntryFee !== 0) {
        pendingEntryFee = pendingEntryFee - userData.Winning;
        remainWinCash += userData.Winning;
      }

      bonusRemainAmount -= +((entryFee * bounsRemainPercent) / 100).toFixed(2);
      bounsRemainPercent = +(
        (bonusRemainAmount * 100) /
        (MAX_DEADWOOD_PTS * userDataPercent.bootValue)
      );
      remainDepositCash -= +((entryFee * remainDepositPercent) / 100).toFixed(
        2
      );
      remainDepositPercent = +(
        (remainDepositCash * 100) /
        (MAX_DEADWOOD_PTS * userDataPercent.bootValue)
      );
      remainWinCash -= +((entryFee * remainWinPercent) / 100).toFixed(2);
      remainWinPercent = +(
        (remainWinCash * 100) /
        (MAX_DEADWOOD_PTS * userDataPercent.bootValue)
      );
    } else {
      if (bonusCut <= bonusAmount && pendingEntryFee !== 0) {
        updateBonusCash = bonusAmount - bonusCut;
        pendingEntryFee = pendingEntryFee - bonusCut;
        bonusRemainAmount = bonusCut;
        bounsPercent = bonusCut;
      } else if (pendingEntryFee !== 0) {
        pendingEntryFee = pendingEntryFee - bonusAmount;
        bounsPercent = bonusAmount;
        bonusCut = bonusAmount;
        bonusRemainAmount = bonusAmount;
      }
      bounsRemainPercent = +((bonusRemainAmount * 100) / entryFee);
      bonusRemainId = bonusRemainId ? bonusRemainId : bounsId;
      remainBonusType = remainBonusType ? remainBonusType : bonusType;

      if (pendingEntryFee <= userData.depositCash && pendingEntryFee !== 0) {
        updateDepositCash = userData.depositCash - pendingEntryFee;
        remainDepositCash = pendingEntryFee;
        pendingEntryFee = 0;
      } else if (pendingEntryFee !== 0) {
        pendingEntryFee = pendingEntryFee - userData.depositCash;
        remainDepositCash = userData.depositCash;
      }
      remainDepositPercent = +((remainDepositCash * 100) / entryFee);

      if (pendingEntryFee <= userData.Winning && pendingEntryFee !== 0) {
        updateWinCash = userData.Winning - pendingEntryFee;
        remainWinCash = pendingEntryFee;
        pendingEntryFee = 0;
      } else if (pendingEntryFee !== 0) {
        pendingEntryFee = pendingEntryFee - userData.Winning;
        remainWinCash = userData.Winning;
      }
      remainWinPercent = +((remainWinCash * 100) / entryFee);
    }
  } else {
    if (bonusCut <= bonusAmount && pendingEntryFee !== 0) {
      updateBonusCash = bonusAmount - bonusCut;
      pendingEntryFee = pendingEntryFee - bonusCut;
      bonusRemainAmount = bonusCut;
      bounsPercent = bonusCut;
    } else if (pendingEntryFee !== 0) {
      pendingEntryFee = pendingEntryFee - bonusAmount;
      bounsPercent = bonusAmount;
      bonusCut = bonusAmount;
      bonusRemainAmount = bonusAmount;
    }
    bounsRemainPercent = +((bonusRemainAmount * 100) / entryFee);
    bonusRemainId = bonusRemainId ? bonusRemainId : bounsId;
    remainBonusType = remainBonusType ? remainBonusType : bonusType;

    if (pendingEntryFee <= userData.depositCash && pendingEntryFee !== 0) {
      updateDepositCash = userData.depositCash - pendingEntryFee;
      remainDepositCash = pendingEntryFee;
      pendingEntryFee = 0;
    } else if (pendingEntryFee !== 0) {
      pendingEntryFee = pendingEntryFee - userData.depositCash;
      remainDepositCash = userData.depositCash;
    }
    remainDepositPercent = +((remainDepositCash * 100) / entryFee);

    if (pendingEntryFee <= userData.Winning && pendingEntryFee !== 0) {
      updateWinCash = userData.Winning - pendingEntryFee;
      remainWinCash = pendingEntryFee;
      pendingEntryFee = 0;
    } else if (pendingEntryFee !== 0) {
      pendingEntryFee = pendingEntryFee - userData.Winning;
      remainWinCash = userData.Winning;
    }
    remainWinPercent = +((remainWinCash * 100) / entryFee);
  }

  let totalCash = Math.abs(updateWinCash) + Math.abs(updateDepositCash);

  return {
    playable: pendingEntryFee <= 0,
    totalCash: +totalCash.toFixed(2),
    updateBonusCash: +updateBonusCash.toFixed(2),
    updateDepositCash: +updateDepositCash.toFixed(2),
    updateWinCash: +updateWinCash.toFixed(2),
    bonusCut: +bonusCut.toFixed(2),
    bounsPercent: +bounsPercent,
    bounsId,
    bonusType,
    bonusRemainId,
    remainBonusType,
    bonusRemainAmount: +bonusRemainAmount.toFixed(2),
    bounsRemainPercent: +bounsRemainPercent,
    remainDepositCash: +remainDepositCash.toFixed(2),
    remainWinCash: +remainWinCash.toFixed(2),
    remainDepositPercent: +remainDepositPercent,
    remainWinPercent: +remainWinPercent,
  };
};

module.exports = { cashCut, calculationOfPlayCash };

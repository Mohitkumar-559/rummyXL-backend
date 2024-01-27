const _ = require("underscore");
const logger = require("../utils/logger");

const cardChange = (players) => {
  let newPlayer = [];
  for (let element of players) {
    if (
      element.dCards &&
      element.dCards.dwd &&
      typeof element.dCards.dwd[0] == "string" &&
      element.dCards.dwd[0].search("-")
    ) {
      element.dCards.dwd = [element.dCards.dwd];
    }

    if (
      element.gCards &&
      element.gCards.dwd &&
      typeof element?.gCards?.dwd[0] == "string" &&
      element?.gCards?.dwd[0].search("-")
    ) {
      element.gCards.dwd = [element.gCards.dwd];
    }
    if (element?.dCards?.dwd?.length) {
      element.dCards.dwd = element.dCards.dwd.filter((item) => item.length);
    }
    if (element?.gCards?.dwd?.length) {
      element.gCards.dwd = element.gCards.dwd.filter((item) => item.length);
    }
    if (element._ir == 0) {
      element.dCards = element.gCards;
    }
    newPlayer = [...newPlayer, element];
  }
  return newPlayer;
};

module.exports = { cardChange };

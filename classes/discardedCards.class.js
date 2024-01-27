const getInfo = require("../common");
const commonClass = require("./common.class"); //common functions
const _ = require("underscore");
const logger = require("../utils/logger");

const DiscardedCards = (data, client) => {
  try {
    //discarded card
    /* +-------------------------------------------------------------------+
      desc:event to see discarded cards
      i/p: data = {},client = socket object
      o/p: DiscardedCards event: data = {dscd = array of discarded}
    +-------------------------------------------------------------------+ */
    logger.info("DiscardedCards---------->>>>>tbid: " + client.tbid);
    getInfo.GetTbInfo(client.tbid, {}, function (table) {
      if (table) {
        let discarded = table.oDeck;
        let discardedrev = discarded.reverse();

        if (
          _.contains(
            [
              "",
              "RoundTimerStarted",
              "CollectingBootValue",
              "StartDealingCard",
              "CardsDealt",
            ],
            table.tst
          )
        ) {
          discardedrev = [];
        }

        commonClass.FireEventToTable(client.tbid, {
          en: "DiscardedCards",
          data: { dscd: discardedrev },
        });
      }
    });
  } catch (error) {
    logger.error("-----> error DiscardedCards", error);
    getInfo.exceptionError(error);
  }
};

module.exports = { DiscardedCards };

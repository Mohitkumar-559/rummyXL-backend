const _ = require("underscore");
const config = require("../config.json");
const commonClass = require("./common.class.js"); //common functions
const cardsClass = require("./cards.class"); //common functions
const cardCommonClass = require("./cardCommon.class");
const logger = require("../utils/logger");
const fortuna = require("javascript-fortuna");
fortuna.init();

const shuffleCheatCards = (Cards) => {
  //shuffle the cards
  /* +-------------------------------------------------------------------+
      desc: function to shuffle cards
      i/p : Cards  = array of cards 
      o/p : array of shuffled cards
       +-------------------------------------------------------------------+ */
  let cards = [...Cards];
  let shuffle = [];
  while (cards.length > 0) {
    let rt = Math.floor(fortuna.random() * cards.length);
    // let rt = Math.floor(Math.random() * cards.length);
    shuffle.push(cards[rt]);
    cards.splice(rt, 1);
  }
  return shuffle;
};
const getCardsForCheatGame = (pi, pObj, ms, gt, resp) => {
  //cheater gets better cards from here; cheater = cheater sequence number
  /* +-------------------------------------------------------------------+
      desc:this function is used to generate cards for the user considering robot level
      i/p: pi = array of player details on table,pObj = {pure,seq,joker,cSeq,cSet}
      o/p : object = {
          sCards = 2D array of cards for players 
          wildCard = wildCard
          cDeck = array of cards for close deck
          tCard = top card for open deck
          }
    +-------------------------------------------------------------------+ */
  let cards = [
    "f-1-0",
    "f-2-0",
    "f-3-0",
    "f-4-0",
    "f-5-0",
    "f-6-0",
    "f-7-0",
    "f-8-0",
    "f-9-0",
    "f-10-0",
    "f-11-0",
    "f-12-0",
    "f-13-0",
    "l-1-0",
    "l-2-0",
    "l-3-0",
    "l-4-0",
    "l-5-0",
    "l-6-0",
    "l-7-0",
    "l-8-0",
    "l-9-0",
    "l-10-0",
    "l-11-0",
    "l-12-0",
    "l-13-0",
    "k-1-0",
    "k-2-0",
    "k-3-0",
    "k-4-0",
    "k-5-0",
    "k-6-0",
    "k-7-0",
    "k-8-0",
    "k-9-0",
    "k-10-0",
    "k-11-0",
    "k-12-0",
    "k-13-0",
    "c-1-0",
    "c-2-0",
    "c-3-0",
    "c-4-0",
    "c-5-0",
    "c-6-0",
    "c-7-0",
    "c-8-0",
    "c-9-0",
    "c-10-0",
    "c-11-0",
    "c-12-0",
    "c-13-0",
    "f-1-1",
    "f-2-1",
    "f-3-1",
    "f-4-1",
    "f-5-1",
    "f-6-1",
    "f-7-1",
    "f-8-1",
    "f-9-1",
    "f-10-1",
    "f-11-1",
    "f-12-1",
    "f-13-1",
    "l-1-1",
    "l-2-1",
    "l-3-1",
    "l-4-1",
    "l-5-1",
    "l-6-1",
    "l-7-1",
    "l-8-1",
    "l-9-1",
    "l-10-1",
    "l-11-1",
    "l-12-1",
    "l-13-1",
    "k-1-1",
    "k-2-1",
    "k-3-1",
    "k-4-1",
    "k-5-1",
    "k-6-1",
    "k-7-1",
    "k-8-1",
    "k-9-1",
    "k-10-1",
    "k-11-1",
    "k-12-1",
    "k-13-1",
    "c-1-1",
    "c-2-1",
    "c-3-1",
    "c-4-1",
    "c-5-1",
    "c-6-1",
    "c-7-1",
    "c-8-1",
    "c-9-1",
    "c-10-1",
    "c-11-1",
    "c-12-1",
    "c-13-1",
    "j-1-0",
    "j-2-0",
  ];

  if (gt === "Deal" && ms === 2) {
    cards = [
      "f-1-0",
      "f-2-0",
      "f-3-0",
      "f-4-0",
      "f-5-0",
      "f-6-0",
      "f-7-0",
      "f-8-0",
      "f-9-0",
      "f-10-0",
      "f-11-0",
      "f-12-0",
      "f-13-0",
      "l-1-0",
      "l-2-0",
      "l-3-0",
      "l-4-0",
      "l-5-0",
      "l-6-0",
      "l-7-0",
      "l-8-0",
      "l-9-0",
      "l-10-0",
      "l-11-0",
      "l-12-0",
      "l-13-0",
      "k-1-0",
      "k-2-0",
      "k-3-0",
      "k-4-0",
      "k-5-0",
      "k-6-0",
      "k-7-0",
      "k-8-0",
      "k-9-0",
      "k-10-0",
      "k-11-0",
      "k-12-0",
      "k-13-0",
      "c-1-0",
      "c-2-0",
      "c-3-0",
      "c-4-0",
      "c-5-0",
      "c-6-0",
      "c-7-0",
      "c-8-0",
      "c-9-0",
      "c-10-0",
      "c-11-0",
      "c-12-0",
      "c-13-0",
      "j-1-0",
      "j-2-0",
    ];
  }

  let shuffle = shuffleCheatCards(cards);

  //selecting wildCards
  //if joker comes in wildCard then card shifting takes place until we get card that is not joker
  while (shuffle[0] && shuffle[0].split("-")[0] == "j") {
    shuffle.push(shuffle[0]);
    shuffle.splice(0, 1);
  }
  let wildCard = shuffle.splice(0, 1)[0];
  cards = _.without(cards, wildCard);
  let sCards;
  if (pi.length == 2) {
    sCards = [[], []];
  } else if (pi.length == 4) {
    sCards = [[], [], [], []];
  } else {
    sCards = [[], [], [], [], [], []];
  }
  //cards distribution logic here

  let smartrobot = config.SMARTROBOT_TWO;
  if (ms == 4) {
    smartrobot = config.SMARTROBOT_FOUR;
  } else if (ms == 6) {
    smartrobot = config.SMARTROBOT_SIX;
  }

  for (let i in pi) {
    if (
      !_.isEmpty(pi[i]) &&
      typeof pi[i].si != "undefined" &&
      pi[i].si != null &&
      pi[i].s == "playing" &&
      pi[i]._ir == 1
    ) {
      let rCards = [];
      let obj = {};
      let rnrb = commonClass.GetRandomInt(0, 100);
      if (rnrb < smartrobot) {
        obj = getPures(cards, "God", 13 - rCards.length, wildCard); //give pure seqs to robot
        rCards = rCards.concat(obj.pures);
        obj = getSeqs(obj.cards, "God", 13 - rCards.length, wildCard); //give impure seq to robot
        rCards = rCards.concat(obj.seqs);
        obj = getSets(obj.cards, "God", 13 - rCards.length, wildCard); //give set to robot
        rCards = rCards.concat(obj.sets);
        obj = getJWS(obj.cards, "God", 13 - rCards.length, wildCard); //give joker or hukam to robot
        rCards = rCards.concat(obj.jws);
        obj = getCSeqs(obj.cards, "God", 13 - rCards.length, wildCard); //give close seqs to robot
        rCards = rCards.concat(obj.cSeqs);
        obj = getCSets(obj.cards, "God", 13 - rCards.length, wildCard); //give close set to robot
        rCards = rCards.concat(obj.cSets);
        shuffle = shuffleCheatCards(obj.cards);
        sCards[i] = rCards.concat(shuffle.splice(0, 13 - rCards.length));

        cards = _.difference(obj.cards, sCards[i]);
      } else {
        shuffle = shuffleCheatCards(cards);
        sCards[i] = rCards.concat(shuffle.splice(0, 13 - rCards.length));

        cards = _.difference(cards, sCards[i]);
      }
    } else if (
      !_.isEmpty(pi[i]) &&
      typeof pi[i].si != "undefined" &&
      pi[i].si != null &&
      pi[i].s == "playing" &&
      pi[i]._ir == 0
    ) {
      let uCards = [];
      let obj = { cards: cards };
      if (pi[i].nuser) {
        if (config.NUSER_PURE > 0) {
          obj = getPures(
            cards,
            "God",
            13 - uCards.length,
            wildCard,
            config.NUSER_PURE
          ); //give pure seqs to user
          uCards = uCards.concat(obj.pures);
        }
        if (config.NUSER_SEQ > 0) {
          obj = getSeqs(
            obj.cards,
            "God",
            13 - uCards.length,
            wildCard,
            config.NUSER_SEQ
          ); //give impure seq to user
          uCards = uCards.concat(obj.seqs);
        }
        if (config.NUSER_SET > 0) {
          obj = getSets(
            obj.cards,
            "God",
            13 - uCards.length,
            wildCard,
            config.NUSER_SET
          ); //give set to user
          uCards = uCards.concat(obj.sets);
        }
        if (config.NUSER_CSEQ > 0) {
          obj = getCSeqs(
            obj.cards,
            "God",
            13 - uCards.length,
            wildCard,
            config.NUSER_CSEQ
          ); //give close seqs to user
          uCards = uCards.concat(obj.cSeqs);
        }
        if (config.NUSER_CSET > 0) {
          obj = getCSets(
            obj.cards,
            "God",
            13 - uCards.length,
            wildCard,
            config.NUSER_CSET
          ); //give close set to user
          uCards = uCards.concat(obj.cSets);
        }
      } else if (config.NEWUSERWIN) {
        let rndm = commonClass.GetRandomInt(0, 100);
        let bound = parseInt(resp[0].per);
        let rndseq = resp[0].seq;
        let useq = 0;
        let upure = 0;

        for (let t = 0; t < resp.length; t++) {
          if (rndm <= bound) {
            rndseq = resp[t].seq;
            useq = resp[t].useq;
            upure = resp[t].upure;
            break;
          } else {
            bound = bound + parseInt(resp[t + 1].per);
          }
        }

        if (upure > 0) {
          obj = getPures(cards, "God", 13 - uCards.length, wildCard, upure); //give pure seqs to user
          uCards = uCards.concat(obj.pures);
        }
        if (useq > 0) {
          obj = getSeqs(obj.cards, "God", 13 - uCards.length, wildCard, useq); //give impure seq to user
          uCards = uCards.concat(obj.seqs);
        }
      }

      let pcdsh = shuffleCheatCards(obj.cards);
      let concard = pcdsh.splice(0, 13 - uCards.length);
      sCards[i] = uCards.concat(concard);
      shuffle = shuffleCheatCards(obj.cards);
      for (let k in concard) {
        shuffle.splice(shuffle.indexOf(concard[k]), 1);
      }

      cards = _.difference(obj.cards, sCards[i]);
    }
  }

  shuffle = shuffleCheatCards(cards);

  let tCard = shuffle.splice(0, 1)[0]; //first cards to show

  let final = {
    sCards: sCards,
    wildCard: wildCard,
    cDeck: shuffle,
    tCard: tCard,
  };
  if (process.env.environment == "development") {
    return {
      sCards: [
        [
          "l-6-0",
          "l-8-1",
          "l-7-0",
          "l-5-0",
          "c-9-0",
          "c-7-1",
          "c-8-1",
          "k-7-1",
          "k-6-0",
          "k-5-1",
          "f-1-1",
          "f-2-1",
          "f-3-0",
        ],
        [
          "l-2-1",
          "l-3-1",
          "l-4-1",
          "k-2-1",
          "k-4-1",
          "k-7-1",
          "k-8-1",
          "f-6-0",
          "j-2-0",
          "f-1-0",
          "f-8-1",
          "f-6-1",
          "c-3-0",
        ],
        [
          "f-2-1",
          "k-13-0",
          "k-9-0",
          "c-10-0",
          "k-1-1",
          "l-11-1",
          "l-3-0",
          "f-8-0",
          "c-10-1",
          "k-13-1",
          "j-3-0",
          "f-13-1",
          "l-12-1",
        ],
        [
          "f-9-0",
          "f-10-0",
          "f-11-0",
          "k-2-0",
          "k-3-0",
          "k-8-0",
          "k-10-0",
          "f-13-0",
          "l-1-0",
          "l-12-0",
          "k-10-1",
          "c-7-0",
          "l-10-1",
        ],
        [
          "k-6-1",
          "k-4-0",
          "c-4-1",
          "k-5-1",
          "f-5-0",
          "c-2-0",
          "l-2-0",
          "f-5-1",
          "k-9-1",
          "f-11-1",
          "c-1-1",
          "c-8-1",
          "j-1-0",
        ],
        [
          "c-4-0",
          "c-5-0",
          "c-6-0",
          "c-12-0",
          "c-13-0",
          "f-7-1",
          "f-9-1",
          "l-5-1",
          "l-9-0",
          "l-10-0",
          "k-11-0",
          "f-12-0",
          "c-11-0",
        ],
      ],
      wildCard: "k-7-0",
      cDeck: [
        "l-7-1",
        "f-2-0",
        "f-12-1",
        "c-11-1",
        "c-6-1",
        "f-7-0",
        "j-4-0",
        "k-5-0",
        "l-13-1",
        "l-8-0",
        "k-12-0",
        "c-13-1",
        "c-2-1",
        "c-3-1",
        "l-13-0",
        "f-4-0",
        "k-12-1",
        "c-8-0",
        "l-11-0",
        "l-8-1",
        "l-7-1",
        "c-9-1",
        "c-5-1",
        "l-6-1",
        "c-1-0",
        "f-4-1",
        "k-1-0",
        "l-1-1",
      ],
      tCard: "l-4-0",
    };
  }
  return final;
};
const getCardsForCheatGamePool = (pi, pObj, ms, gt, resp) => {
  //cheater gets better cards from here; cheater = cheater sequence number
  /* +-------------------------------------------------------------------+
      desc:this function is used to generate cards for the user considering robot level
      i/p: pi = array of player details on table,pObj = {pure,seq,joker,cSeq,cSet}
      o/p : object = {
          sCards = 2D array of cards for players 
          wildCard = wildCard
          cDeck = array of cards for close deck
          tCard = top card for open deck
          }
    +-------------------------------------------------------------------+ */
  logger.info("getCardsForCheatGamePool-----------resp: ", resp);
  var cards = [
    "f-1-0",
    "f-2-0",
    "f-3-0",
    "f-4-0",
    "f-5-0",
    "f-6-0",
    "f-7-0",
    "f-8-0",
    "f-9-0",
    "f-10-0",
    "f-11-0",
    "f-12-0",
    "f-13-0",
    "l-1-0",
    "l-2-0",
    "l-3-0",
    "l-4-0",
    "l-5-0",
    "l-6-0",
    "l-7-0",
    "l-8-0",
    "l-9-0",
    "l-10-0",
    "l-11-0",
    "l-12-0",
    "l-13-0",
    "k-1-0",
    "k-2-0",
    "k-3-0",
    "k-4-0",
    "k-5-0",
    "k-6-0",
    "k-7-0",
    "k-8-0",
    "k-9-0",
    "k-10-0",
    "k-11-0",
    "k-12-0",
    "k-13-0",
    "c-1-0",
    "c-2-0",
    "c-3-0",
    "c-4-0",
    "c-5-0",
    "c-6-0",
    "c-7-0",
    "c-8-0",
    "c-9-0",
    "c-10-0",
    "c-11-0",
    "c-12-0",
    "c-13-0",
    "f-1-1",
    "f-2-1",
    "f-3-1",
    "f-4-1",
    "f-5-1",
    "f-6-1",
    "f-7-1",
    "f-8-1",
    "f-9-1",
    "f-10-1",
    "f-11-1",
    "f-12-1",
    "f-13-1",
    "l-1-1",
    "l-2-1",
    "l-3-1",
    "l-4-1",
    "l-5-1",
    "l-6-1",
    "l-7-1",
    "l-8-1",
    "l-9-1",
    "l-10-1",
    "l-11-1",
    "l-12-1",
    "l-13-1",
    "k-1-1",
    "k-2-1",
    "k-3-1",
    "k-4-1",
    "k-5-1",
    "k-6-1",
    "k-7-1",
    "k-8-1",
    "k-9-1",
    "k-10-1",
    "k-11-1",
    "k-12-1",
    "k-13-1",
    "c-1-1",
    "c-2-1",
    "c-3-1",
    "c-4-1",
    "c-5-1",
    "c-6-1",
    "c-7-1",
    "c-8-1",
    "c-9-1",
    "c-10-1",
    "c-11-1",
    "c-12-1",
    "c-13-1",
    "j-1-0",
    "j-2-0",
  ];

  if (gt === "Deal" && ms === 2) {
    cards = [
      "f-1-0",
      "f-2-0",
      "f-3-0",
      "f-4-0",
      "f-5-0",
      "f-6-0",
      "f-7-0",
      "f-8-0",
      "f-9-0",
      "f-10-0",
      "f-11-0",
      "f-12-0",
      "f-13-0",
      "l-1-0",
      "l-2-0",
      "l-3-0",
      "l-4-0",
      "l-5-0",
      "l-6-0",
      "l-7-0",
      "l-8-0",
      "l-9-0",
      "l-10-0",
      "l-11-0",
      "l-12-0",
      "l-13-0",
      "k-1-0",
      "k-2-0",
      "k-3-0",
      "k-4-0",
      "k-5-0",
      "k-6-0",
      "k-7-0",
      "k-8-0",
      "k-9-0",
      "k-10-0",
      "k-11-0",
      "k-12-0",
      "k-13-0",
      "c-1-0",
      "c-2-0",
      "c-3-0",
      "c-4-0",
      "c-5-0",
      "c-6-0",
      "c-7-0",
      "c-8-0",
      "c-9-0",
      "c-10-0",
      "c-11-0",
      "c-12-0",
      "c-13-0",
      "j-1-0",
      // "j-2-0",
    ];
  }

  var shuffle = shuffleCheatCards(cards);

  //selecting wildCards
  //if joker comes in wildCard then card shifting takes place until we get card that is not joker
  while (shuffle[0] && shuffle[0].split("-")[0] == "j") {
    shuffle.push(shuffle[0]);
    shuffle.splice(0, 1);
  }
  var wildCard = shuffle.splice(0, 1)[0];
  cards = _.without(cards, wildCard);
  // logger.info('getCardsForCheatGamePool---------->>>>cards: ',cards.length);
  var sCards;
  if (pi.length == 2) {
    sCards = [[], []];
  } else if (pi.length == 3) {
    sCards = [[], [], []];
  } else if (pi.length == 4) {
    sCards = [[], [], [], []];
  } else {
    sCards = [[], [], [], [], [], []];
  }
  //cards distribution logic here
  logger.info("getCardsForCheatGamePool----------->>>>>pi: ", pi);
  logger.info(
    "config----------------------------------pure:" + config.POOL_PURE
  );
  var pool_pure = config.POOL_PURE;
  var pool_seq = config.POOL_SEQ;
  var pool_set = config.POOL_SET;
  var pool_cseq = config.POOL_CSEQ;
  var smartrobot = config.SMARTROBOT_TWO;
  if (ms == 4) {
    smartrobot = config.SMARTROBOT_FOUR;
  } else if (ms == 6) {
    smartrobot = config.SMARTROBOT_SIX;
  }

  for (var i in pi) {
    // logger.info('getCardsForCheatGamePool-------->>>>>>pi: ',pi[i]);
    if (
      !_.isEmpty(pi[i]) &&
      typeof pi[i].si != "undefined" &&
      pi[i].si != null &&
      pi[i].s == "playing" &&
      pi[i]._ir == 1
    ) {
      var rCards = [];
      var obj = { cards: cards };
      var rnrb = commonClass.GetRandomInt(0, 100);
      if (rnrb > smartrobot) {
        pool_pure = 0;
        pool_seq = 0;
        pool_set = 0;
        pool_cseq = 0;
      }

      if (pool_pure > 0) {
        obj = getPures(cards, "God", 13 - rCards.length, wildCard, pool_pure); //give pure seqs to robot
        logger.info("[BotCards]-------->>>>pures: ", obj.pures);
        rCards = rCards.concat(obj.pures);
      }
      if (pool_seq > 0) {
        obj = getSeqs(obj.cards, "God", 13 - rCards.length, wildCard, pool_seq); //give impure seq to robot
        logger.info("[BotCards]-------->>>>seqs: ", obj.seqs);
        rCards = rCards.concat(obj.seqs);
      }
      if (pool_set > 0) {
        obj = getSets(obj.cards, "God", 13 - rCards.length, wildCard, pool_set); //give set to robot
        logger.info("[BotCards]-------->>>>sets: ", obj.sets);
        rCards = rCards.concat(obj.sets);
      }
      // obj = getJWS(obj.cards,'God',(13 - rCards.length),wildCard,0);   //give joker or hukam to robot
      // logger.info('\n[BotCards]-------->>>>jws: ',obj.jws);
      // rCards = rCards.concat(obj.jws);
      if (pool_cseq > 0) {
        obj = getCSeqs(
          obj.cards,
          "God",
          13 - rCards.length,
          wildCard,
          pool_cseq
        ); //give close seqs to robot
        logger.info("[BotCards]-------->>>>cSeqs: ", obj.cSeqs);
        rCards = rCards.concat(obj.cSeqs);
      }
      // obj = getCSets(obj.cards,'God',(13 - rCards.length),wildCard,0);	//give close set to robot
      // logger.info('\n[BotCards]-------->>>>cSets: ',obj.cSets);
      // rCards = rCards.concat(obj.cSets);

      logger.info("cards distribution pool --------rCards: ", rCards);
      shuffle = shuffleCheatCards(obj.cards);
      sCards[i] = rCards.concat(shuffle.splice(0, 13 - rCards.length));
      logger.info(
        "[BotCards]------seat Index(" + pi[i].si + ")----------->>>>>cards: ",
        sCards[i]
      );
      cards = _.difference(obj.cards, sCards[i]);
    } else if (
      !_.isEmpty(pi[i]) &&
      typeof pi[i].si != "undefined" &&
      pi[i].si != null &&
      pi[i].s == "playing" &&
      pi[i]._ir == 0
    ) {
      var uCards = [];
      var obj = { cards: cards };
      if (pi[i].nuser == true) {
        if (config.NUSER_PURE > 0) {
          obj = getPures(
            cards,
            "God",
            13 - uCards.length,
            wildCard,
            config.NUSER_PURE
          ); //give pure seqs to user
          logger.info("[uCards]-------->>>>pures: ", obj.pures);
          uCards = uCards.concat(obj.pures);
        }
        if (config.NUSER_SEQ > 0) {
          obj = getSeqs(
            obj.cards,
            "God",
            13 - uCards.length,
            wildCard,
            config.NUSER_SEQ
          ); //give impure seq to user
          logger.info("[uCards]-------->>>>seqs: ", obj.seqs);
          uCards = uCards.concat(obj.seqs);
        }
        if (config.NUSER_SET > 0) {
          obj = getSets(
            obj.cards,
            "God",
            13 - uCards.length,
            wildCard,
            config.NUSER_SET
          ); //give set to user
          logger.info("[uCards]-------->>>>sets: ", obj.sets);
          uCards = uCards.concat(obj.sets);
        }
        if (config.NUSER_CSEQ > 0) {
          obj = getCSeqs(
            obj.cards,
            "God",
            13 - uCards.length,
            wildCard,
            config.NUSER_CSEQ
          ); //give close seqs to user
          logger.info("[uCards]-------->>>>cSeqs: ", obj.cSeqs);
          uCards = uCards.concat(obj.cSeqs);
        }
        if (config.NUSER_CSET > 0) {
          obj = getCSets(
            obj.cards,
            "God",
            13 - uCards.length,
            wildCard,
            config.NUSER_CSET
          ); //give close set to user
          logger.info("[uCards]-------->>>>cSets: ", obj.cSets);
          uCards = uCards.concat(obj.cSets);
        }
      } else if (config.NEWUSERWIN == true) {
        var rndm = commonClass.GetRandomInt(0, 100);
        var bound = parseInt(resp[0].per);
        var rndseq = resp[0].seq;
        var useq = 0;
        var upure = 0;

        for (var t = 0; t < resp.length; t++) {
          if (rndm <= bound) {
            rndseq = resp[t].seq;
            useq = resp[t].useq;
            upure = resp[t].upure;
            break;
          } else {
            bound = bound + parseInt(resp[t + 1].per);
          }
        }

        logger.info("getCardsForCheatGamePool------1-----rndseq: ", rndseq);
        logger.info("getCardsForCheatGamePool------1-----upure: ", upure);
        logger.info("getCardsForCheatGamePool------1-----useq: ", useq);
        if (upure > 0) {
          obj = getPures(cards, "God", 13 - uCards.length, wildCard, upure); //give pure seqs to user
          logger.info("[uCards]-------->>>>pures: ", obj.pures);
          uCards = uCards.concat(obj.pures);
        }
        if (useq > 0) {
          obj = getSeqs(obj.cards, "God", 13 - uCards.length, wildCard, useq); //give impure seq to user
          logger.info("[uCards]-------->>>>seqs: ", obj.seqs);
          uCards = uCards.concat(obj.seqs);
        }
      }

      logger.info("getCardsForCheatGamePool-------uCards:", uCards);
      logger.info(
        "getCardsForCheatGamePool-------uCards.length:",
        uCards.length
      );
      var pcdsh = shuffleCheatCards(obj.cards);
      var concard = pcdsh.splice(0, 13 - uCards.length);
      sCards[i] = uCards.concat(concard);
      shuffle = shuffleCheatCards(obj.cards);
      for (var k in concard) {
        logger.info(
          "getCardsForCheatGamePool---------------------k:",
          concard[k]
        );
        shuffle.splice(shuffle.indexOf(concard[k]), 1);
      }
      // logger.info('getCardsForCheatGamePool----2---->>>>sCards[i]: ',sCards[i]);
      logger.info(
        "[uCards]------seat Index(" + pi[i].si + ")----------->>>>>cards: ",
        sCards[i]
      );
      cards = _.difference(obj.cards, sCards[i]);
    }
  }

  logger.info("getCardsForCheatGamePool------------->>>>>>cards: ", cards);
  shuffle = shuffleCheatCards(cards);
  // var temp = [];
  // for(var j in pi){
  // 	if(!_.isEmpty(pi[j]) && typeof pi[j].si != 'undefined' && pi[j].si != null && pi[j].s == 'playing' && pi[j]._ir == 0){
  // 		sCards[j] = shuffle.splice(0,13);
  // 	}
  // }
  logger.info(
    "getCardsForCheatGamePool------------->>>>>>sCards",
    sCards,
    " cards: ",
    shuffle.length
  );

  var cDeck = [];
  var tCard = shuffle.splice(0, 1)[0]; //first cards to show

  logger.info("tCard------------: ", tCard);
  var final = {
    sCards: sCards,
    wildCard: wildCard,
    cDeck: shuffle,
    tCard: tCard,
  };
  logger.info("getCardsForCheatGamePool------------>>>>>>>final: ", final);
  if (process.env.environment == "development") {
    return {
      sCards: [
        [
          "l-6-0",
          "l-8-1",
          "l-7-0",
          "l-5-0",
          "c-9-0",
          "c-7-1",
          "c-8-1",
          "k-7-1",
          "k-6-0",
          "k-5-1",
          "f-1-1",
          "f-2-1",
          "f-3-0",
        ],
        [
          "l-2-1",
          "l-3-1",
          "l-4-1",
          "k-2-1",
          "k-4-1",
          "k-7-1",
          "k-8-1",
          "f-6-0",
          "j-2-0",
          "f-1-0",
          "f-8-1",
          "f-6-1",
          "c-3-0",
        ],
        [
          "f-2-1",
          "k-13-0",
          "k-9-0",
          "c-10-0",
          "k-1-1",
          "l-11-1",
          "l-3-0",
          "f-8-0",
          "c-10-1",
          "k-13-1",
          "j-3-0",
          "f-13-1",
          "l-12-1",
        ],
        [
          "f-9-0",
          "f-10-0",
          "f-11-0",
          "k-2-0",
          "k-3-0",
          "k-8-0",
          "k-10-0",
          "f-13-0",
          "l-1-0",
          "l-12-0",
          "k-10-1",
          "c-7-0",
          "l-10-1",
        ],
        [
          "k-6-1",
          "k-4-0",
          "c-4-1",
          "k-5-1",
          "f-5-0",
          "c-2-0",
          "l-2-0",
          "f-5-1",
          "k-9-1",
          "f-11-1",
          "c-1-1",
          "c-8-1",
          "j-1-0",
        ],
        [
          "c-4-0",
          "c-5-0",
          "c-6-0",
          "c-12-0",
          "c-13-0",
          "f-7-1",
          "f-9-1",
          "l-5-1",
          "l-9-0",
          "l-10-0",
          "k-11-0",
          "f-12-0",
          "c-11-0",
        ],
      ],
      wildCard: "k-7-0",
      cDeck: [
        "l-7-1",
        "f-2-0",
        "f-12-1",
        "c-11-1",
        "c-6-1",
        "f-7-0",
        "j-4-0",
        "k-5-0",
        "l-13-1",
        "l-8-0",
        "k-12-0",
        "c-13-1",
        "c-2-1",
        "c-3-1",
        "l-13-0",
        "f-4-0",
        "k-12-1",
        "c-8-0",
        "l-11-0",
        "l-8-1",
        "l-7-1",
        "c-9-1",
        "c-5-1",
        "l-6-1",
        "c-1-0",
        "f-4-1",
        "k-1-0",
        "l-1-1",
      ],
      tCard: "l-4-0",
    };
  }
  return final;
};

const getPures = (cards, rType, rmLen, wildCard, Nos) => {
  //cards = main deck ,rType = robot type, rmLen = robot remainin cards to get, wildCard = wildCard
  /* +-------------------------------------------------------------------+
      desc:this function generates pure sequence for robot
      i/p: cards = array of remaining cards  from main deck
         rType = type of robot
         rmLen = number of cards required to make 13 cards 
         wildCard = wildcard
         Nos = number of pure
      o/p : object = {
          cards = remaining cards from deck
          pures = array containing pure sequence
              }
    +-------------------------------------------------------------------+ */

  if (rmLen >= 3) {
    var nos = 0;

    if (typeof Nos == "undefined" || Nos == null || Nos == 0) {
      var p = commonClass.GetRandomInt(0, 100);
      eval("var nos0 = RCARDS." + rType + ".PURE.nos0");
      eval("var nos1 = RCARDS." + rType + ".PURE.nos1");
      eval("var nos2 = RCARDS." + rType + ".PURE.nos2");
      eval("var nos3 = RCARDS." + rType + ".PURE.nos3");
      var bound = nos0;

      if (p <= bound) {
        //no pure sequence
        logger.info(rType + " PURE0");
        return { cards: cards, pures: [] };
      } else if (p <= (bound += nos1)) {
        //give one pure sequence
        logger.info(rType + " PURE1");

        nos = 1;
      } else if (p <= (bound += nos2)) {
        //give two impure sequence
        logger.info(rType + " PURE2");
        if (rmLen >= 6) {
          nos = 2;
        } else {
          nos = 1;
        }
      } else if (p <= (bound += nos3)) {
        //give three pure sequence
        logger.info(rType + " PURE3");
        if (rmLen >= 9) {
          nos = 3;
        } else if (rmLen >= 6) {
          nos = 2;
        } else {
          nos = 1;
        }
      } else {
        logger.info(rType + " PURE null");

        return { cards: cards, pures: [] };
      }
    } else {
      nos = Nos;
    }
    logger.info("getPures--------->>>>>nos: " + nos);

    var tempC = _.clone(cards);
    tempC = _.difference(tempC, ["j-1-0", "j-2-0"]);

    var r = commonClass.GetRandomInt(0, tempC.length - 1);
    // logger.info('getPures------------>>>>>r: '+r+' tempC: '+tempC);
    var pures = [];
    var tmp = [];
    var cdLen = tempC.length;
    for (var i = 0; i < cdLen; i++) {
      // logger.info('getPures---------->>>>>>i: '+i+' tmp: ',tmp);
      if (tmp.length == 0) {
        tmp.push(tempC[r]);
        // logger.info('getPures-------->>>>>tmp.length: ',tmp.length);
      } else {
        // logger.info('getPures-------->>>>else');
        var lastCard = tmp[tmp.length - 1];
        var newCard = tempC[r];
        // logger.info('lastCard: '+lastCard+' newCard: '+newCard);
        var matchSuit =
          lastCard.split("-")[0] == newCard.split("-")[0] ? true : false;
        var diff =
          parseInt(newCard.split("-")[1]) - parseInt(lastCard.split("-")[1]);

        if (matchSuit) {
          //two cards with same suit
          if (diff == 0) {
            //ignore
          } else if (diff == 1) {
            tmp.push(newCard);
          } else {
            if (tmp.length == 3) {
              tempC = _.difference(tempC, tmp);
              pures.push(tmp);
              if (pures.length == nos) {
                break;
              }
            }
            tmp = [];
            // tmp.push(newCard);
          }
        } else {
          if (tmp.length == 3) {
            tempC = _.difference(tempC, tmp);
            pures.push(tmp);
            if (pures.length == nos) {
              break;
            }
          }
          tmp = [];
          // tmp.push(newCard);
        }
      }
      if (tmp.length == 3) {
        tempC = _.difference(tempC, tmp);
        pures.push(tmp);
        tmp = [];
        if (pures.length == nos) {
          break;
        }
      }
      r = (r + 1) % tempC.length;
    }

    logger.info("getPures------------>>>>>pures: ", pures);
    pures = _.flatten(pures);
    cards = _.difference(cards, pures);
    return { cards: cards, pures: pures };
  } else {
    return { cards: cards, pures: [] };
  }
};
const getSeqs = (cards, rType, rmLen, wildCard, Nos) => {
  //get premade sequence
  /* +-------------------------------------------------------------------+
      desc:this function generates impure sequence for robot
      i/p: cards = array of remaining cards  from main deck
         rType = type of robot
         rmLen = number of cards required to make 13 cards 
         wildCard = wildcard
         Nos = number of seq
      o/p : object = {
          cards = remaining cards from deck
          seqs = array containing impure sequence
              }
    +-------------------------------------------------------------------+ */

  if (rmLen >= 3) {
    var nos = 0;

    if (typeof Nos == "undefined" || Nos == null) {
      var p = commonClass.GetRandomInt(0, 100);
      eval("var nos0 = RCARDS." + rType + ".SEQS.nos0");
      eval("var nos1 = RCARDS." + rType + ".SEQS.nos1");
      eval("var nos2 = RCARDS." + rType + ".SEQS.nos2");
      eval("var nos3 = RCARDS." + rType + ".SEQS.nos3");

      var bound = nos0;

      if (p <= bound) {
        //no pure sequence
        logger.info(rType + " SEQS0");
        return { cards: cards, seqs: [] };
      } else if (p <= (bound += nos1)) {
        //give one pure sequence
        logger.info(rType + " SEQS1");

        nos = 1;
      } else if (p <= (bound += nos2)) {
        //give two impure sequence
        logger.info(rType + " SEQS2");
        if (rmLen >= 6) {
          nos = 2;
        } else {
          nos = 1;
        }
      } else if (p <= (bound += nos3)) {
        //give three pure sequence
        logger.info(rType + " SEQS3");
        if (rmLen >= 9) {
          nos = 3;
        } else if (rmLen >= 6) {
          nos = 2;
        } else {
          nos = 1;
        }
      } else {
        logger.info(rType + " SEQS null");
        return { cards: cards, seqs: [] };
      }
    } else {
      nos = Nos;
    }
    logger.info("getSeqs---------->>>>>nos: " + nos);
    var tempC = _.clone(cards);
    var jwArray = cardCommonClass.getJWcards(tempC, wildCard);
    if (jwArray.length == 0) {
      //there is no joker to make a impure sequence
      return { cards: cards, seqs: [] };
    }
    tempC = _.difference(tempC, jwArray);

    var r = commonClass.GetRandomInt(0, tempC.length - 1);
    // logger.info('getPures------------>>>>>r: '+r+' tempC: '+tempC);
    var seqs = [];
    var tmp = [];
    var cdLen = tempC.length;
    for (var i = 0; i < cdLen; i++) {
      // logger.info('getPures---------->>>>>>i: '+i+' tmp: ',tmp);
      if (tmp.length == 0) {
        tmp.push(tempC[r]);
        // logger.info('getPures-------->>>>>tmp.length: ',tmp.length);
      } else {
        // logger.info('getPures-------->>>>else');
        var lastCard = tmp[tmp.length - 1];
        var newCard = tempC[r];
        // logger.info('lastCard: '+lastCard+' newCard: '+newCard);
        var matchSuit =
          lastCard.split("-")[0] == newCard.split("-")[0] ? true : false;
        var diff =
          parseInt(newCard.split("-")[1]) - parseInt(lastCard.split("-")[1]);

        if (matchSuit) {
          //two cards with same suit
          if (diff == 0) {
            //ignore
          } else if (diff == 1) {
            tmp.push(newCard);
          } else if (diff == 2) {
            //add joker or wildcards logic here
            if (tmp.length == 1 && jwArray.length > 0) {
              //means one old cards one joker/wildcards and one newcard
              tmp.push(jwArray.splice(0, 1)[0]);
              tmp.push(newCard);
              tempC = _.difference(tempC, tmp);
              seqs.push(tmp);
              if (seqs.length == nos || jwArray.length == 0) {
                break;
              }
            }
            tmp = [];
            // tmp.push(newCard);
          } else {
            if (tmp.length == 2 && jwArray.length > 0) {
              tmp.push(jwArray.splice(0, 1)[0]);
              tempC = _.difference(tempC, tmp);
              seqs.push(tmp);
              if (seqs.length == nos || jwArray.length == 0) {
                break;
              }
            }
            tmp = [];
            // tmp.push(newCard);
          }
        } else {
          if (tmp.length == 2 && jwArray.length > 0) {
            tmp.push(jwArray.splice(0, 1)[0]);
            tempC = _.difference(tempC, tmp);
            seqs.push(tmp);
            if (seqs.length == nos || jwArray.length == 0) {
              break;
            }
          }
          tmp = [];
          // tmp.push(newCard);
        }
      }
      if (tmp.length == 2 && jwArray.length > 0) {
        tmp.push(jwArray.splice(0, 1)[0]);
        tempC = _.difference(tempC, tmp);
        seqs.push(tmp);
        tmp = [];
        if (seqs.length == nos || jwArray.length == 0) {
          break;
        }
      }
      r = (r + 1) % tempC.length;
    }

    // logger.info('getSeqs------------>>>>>seqs: ',seqs);
    seqs = _.flatten(seqs);
    cards = _.difference(cards, seqs);
    logger.info("getSeqs-------->>>>seqs: ", seqs);

    return { cards: cards, seqs: seqs };
  } else {
    return { cards: cards, seqs: [] };
  }
};
const getSets = (cards, rType, rmLen, wildCard, Nos) => {
  //returns premade sets array
  /* +-------------------------------------------------------------------+
      desc:this function generates sets for robot
      i/p: cards = array of remaining cards  from main deck
         rType = type of robot
         rmLen = number of cards required to make 13 cards 
         wildCard = wildcard
         Nos = number of sets
      o/p : object = {
          cards = remaining cards from deck
          sets = array containing sets
              }
    +-------------------------------------------------------------------+ */
  logger.info("getSets------->>>rmLen: " + rmLen);

  if (rmLen >= 3) {
    var nos = 0;

    if (typeof Nos == "undefined" || Nos == null) {
      var p = commonClass.GetRandomInt(0, 100);
      eval("var nos0 = RCARDS." + rType + ".SETS.nos0");
      eval("var nos1 = RCARDS." + rType + ".SETS.nos1");
      eval("var nos2 = RCARDS." + rType + ".SETS.nos2");
      eval("var nos3 = RCARDS." + rType + ".SETS.nos3");
      var bound = nos0;

      if (p <= bound) {
        //no pure sequence
        logger.info(rType + " SETS0");

        return { cards: cards, sets: [] };
      } else if (p <= (bound += nos1)) {
        //give one pure sequence
        logger.info(rType + " SETS1");
        nos = 1;
      } else if (p <= (bound += nos2)) {
        //give two impure sequence
        logger.info(rType + " SETS2");
        if (rmLen >= 6) {
          nos = 2;
        } else {
          nos = 1;
        }
      } else if (p <= (bound += nos3)) {
        //give three pure sequence
        logger.info(rType + " SETS3");
        if (rmLen >= 9) {
          nos = 3;
        } else if (rmLen >= 6) {
          nos = 2;
        } else {
          nos = 1;
        }
      } else {
        logger.info(rType + " SETS null");
        return { cards: cards, sets: [] };
      }
    } else {
      nos = Nos;
    }
    logger.info("getSets----------->>>>>>nos: " + nos);

    var tempC = _.clone(cards);
    tempC = _.difference(tempC, ["j-1-0", "j-2-0"]);

    tempC = tempC.toString();
    var r = commonClass.GetRandomInt(0, 12) + 1;
    var re = new RegExp("[flkc]-" + r + "-[01]", "g");
    var srCards =
      tempC.match(re) != null
        ? cardsClass.removeDuplicates(tempC.match(re))
        : []; //find the array of cards having same rank bu different suits
    var sets = [];
    tempC = tempC.split(",");
    for (var i = 0; i < 13; i++) {
      if (srCards.length >= 3) {
        //check if the same rank cards have sufficient cards to form a sets
        var tmp = srCards.splice(0, 3);
        tempC = _.difference(tempC, tmp);
        sets.push(tmp);
        if (sets.length == nos) {
          break;
        }
      }
      r = (r % 13) + 1;
      tempC = tempC.toString();
      re = new RegExp("[flkc]-" + r + "-[01]", "g");
      srCards =
        tempC.match(re) != null
          ? cardsClass.removeDuplicates(tempC.match(re))
          : [];

      tempC = tempC.split(",");
    }
    logger.info("getSets---------->>>>>>sets: ", sets);
    sets = _.flatten(sets);
    cards = _.difference(cards, sets);
    return { cards: cards, sets: sets };
  } else {
    return { cards: cards, sets: [] };
  }
};
const getJWS = (cards, rType, rmLen, wildCard, Nos) => {
  /* +-------------------------------------------------------------------+
      desc:this function gives jokers/wildCards for robot
      i/p: cards = array of remaining cards  from main deck
         rType = type of robot
         rmLen = number of cards required to make 13 cards 
         wildCard = wildcard
         Nos = number of joker or wildcards
      o/p : object = {
          cards = remaining cards from deck
          jws = array containing jokers
              }
    +-------------------------------------------------------------------+ */
  var nos = 0;
  if (rmLen >= 1) {
    ///check if there is vacancy for atleast one card

    if (typeof Nos == "undefined" || Nos == null) {
      var p = commonClass.GetRandomInt(0, 100);
      eval("var nos0 = RCARDS." + rType + ".JW.nos0");
      eval("var nos1 = RCARDS." + rType + ".JW.nos1");
      eval("var nos2 = RCARDS." + rType + ".JW.nos2");
      eval("var nos3 = RCARDS." + rType + ".JW.nos3");

      var bound = nos0;

      if (p <= bound) {
        //no pure sequence
        logger.info(rType + " JW0");
        return { cards: cards, jws: [] };
      } else if (p <= (bound += nos1)) {
        //give one pure sequence
        logger.info(rType + " JW1");

        nos = 1;
      } else if (p <= (bound += nos2)) {
        //give two impure sequence
        logger.info(rType + " JW2");
        if (rmLen >= 2) {
          //check if there is the vacancy for two joker/wildCard

          nos = 2;
        } else {
          nos = 1;
        }
      } else if (p <= (bound += nos3)) {
        //give three pure sequence
        logger.info(rType + " JW3");
        if (rmLen >= 3) {
          //check if there is the vacancy for three joker/wildCard

          nos = 3;
        } else if (rmLen >= 2) {
          //check if there is the vacancy for two joker/wildCard
          nos = 2;
        } else {
          nos = 1;
        }
      } else {
        logger.info(rType + " JW null");
        return { cards: cards, jws: [] };
      }
    } else {
      nos = Nos;
    }
  }
  logger.info("getJWS----------->>>>>nos: " + nos);
  var jwArray = cardCommonClass.getJWcards(cards, wildCard);
  // var final jwArray
  var finalJW = [];
  if (jwArray.length > 0) {
    //check if there is atleast one joker/wildCard
    if (nos == 3) {
      if (jwArray.length >= 3) {
        //check if there are atleast three joker/wildCard
        finalJW = jwArray.splice(0, 3);
      } else if (jwArray.length == 2) {
        //check if there are atleast two joker/wildCard
        finalJW = jwArray.splice(0, 2);
      } else {
        finalJW = jwArray.splice(0, 1);
      }
    } else if (nos == 2) {
      if (jwArray.length >= 2) {
        //check if there are atleast two joker/wildCard
        finalJW = jwArray.splice(0, 2);
      } else {
        finalJW = jwArray.splice(0, 1);
      }
    } else {
      finalJW = jwArray.splice(0, 1);
    }
    logger.info("getJWS----------->>>>>>>finalJW: ", finalJW);
    cards = _.difference(cards, finalJW);
    return { cards: cards, jws: finalJW };
  } else {
    return { cards: cards, jws: [] };
  }
};
const getJS = (cards, rType, rmLen, wildCard, Nos) => {
  /* +-------------------------------------------------------------------+
      desc:this function gives jokers/wildCards for robot
      i/p: cards = array of remaining cards  from main deck
         rType = type of robot
         rmLen = number of cards required to make 13 cards 
         wildCard = wildcard
         Nos = number of joker or wildcards
      o/p : object = {
          cards = remaining cards from deck
          jws = array containing jokers
              }
    +-------------------------------------------------------------------+ */
  var nos = 0;
  if (rmLen >= 1) {
    ///check if there is vacancy for atleast one card

    if (typeof Nos == "undefined" || Nos == null) {
      var p = commonClass.GetRandomInt(0, 100);
      eval("var nos0 = RCARDS." + rType + ".JW.nos0");
      eval("var nos1 = RCARDS." + rType + ".JW.nos1");
      eval("var nos2 = RCARDS." + rType + ".JW.nos2");
      eval("var nos3 = RCARDS." + rType + ".JW.nos3");

      var bound = nos0;

      if (p <= bound) {
        //no pure sequence
        logger.info(rType + " JW0");
        return { cards: cards, jws: [] };
      } else if (p <= (bound += nos1)) {
        //give one pure sequence
        logger.info(rType + " JW1");

        nos = 1;
      } else if (p <= (bound += nos2)) {
        //give two impure sequence
        logger.info(rType + " JW2");
        if (rmLen >= 2) {
          //check if there is the vacancy for two joker/wildCard

          nos = 2;
        } else {
          nos = 1;
        }
      } else if (p <= (bound += nos3)) {
        //give three pure sequence
        logger.info(rType + " JW3");
        if (rmLen >= 3) {
          //check if there is the vacancy for three joker/wildCard

          nos = 3;
        } else if (rmLen >= 2) {
          //check if there is the vacancy for two joker/wildCard
          nos = 2;
        } else {
          nos = 1;
        }
      } else {
        logger.info(rType + " JW null");
        return { cards: cards, jws: [] };
      }
    } else {
      nos = Nos;
    }
  }
  logger.info("getJWS----------->>>>>nos: " + nos);
  var jwArray = cardsClass.getJCards(cards);
  // var final jwArray
  var finalJW = [];
  if (jwArray.length > 0) {
    //check if there is atleast one joker/wildCard
    if (nos == 3) {
      if (jwArray.length >= 3) {
        //check if there are atleast three joker/wildCard
        finalJW = jwArray.splice(0, 3);
      } else if (jwArray.length == 2) {
        //check if there are atleast two joker/wildCard
        finalJW = jwArray.splice(0, 2);
      } else {
        finalJW = jwArray.splice(0, 1);
      }
    } else if (nos == 2) {
      if (jwArray.length >= 2) {
        //check if there are atleast two joker/wildCard
        finalJW = jwArray.splice(0, 2);
      } else {
        finalJW = jwArray.splice(0, 1);
      }
    } else {
      finalJW = jwArray.splice(0, 1);
    }
    logger.info("getJWS----------->>>>>>>finalJW: ", finalJW);
    cards = _.difference(cards, finalJW);
    return { cards: cards, jws: finalJW };
  } else {
    return { cards: cards, jws: [] };
  }
};
const getWS = (cards, rType, rmLen, wildCard, Nos) => {
  /* +-------------------------------------------------------------------+
      desc:this function gives jokers/wildCards for robot
      i/p: cards = array of remaining cards  from main deck
         rType = type of robot
         rmLen = number of cards required to make 13 cards 
         wildCard = wildcard
         Nos = number of joker or wildcards
      o/p : object = {
          cards = remaining cards from deck
          jws = array containing jokers
              }
    +-------------------------------------------------------------------+ */
  var nos = 0;
  if (rmLen >= 1) {
    ///check if there is vacancy for atleast one card

    if (typeof Nos == "undefined" || Nos == null) {
      var p = commonClass.GetRandomInt(0, 100);
      eval("var nos0 = RCARDS." + rType + ".JW.nos0");
      eval("var nos1 = RCARDS." + rType + ".JW.nos1");
      eval("var nos2 = RCARDS." + rType + ".JW.nos2");
      eval("var nos3 = RCARDS." + rType + ".JW.nos3");

      var bound = nos0;

      if (p <= bound) {
        //no pure sequence
        logger.info(rType + " JW0");
        return { cards: cards, jws: [] };
      } else if (p <= (bound += nos1)) {
        //give one pure sequence
        logger.info(rType + " JW1");

        nos = 1;
      } else if (p <= (bound += nos2)) {
        //give two impure sequence
        logger.info(rType + " JW2");
        if (rmLen >= 2) {
          //check if there is the vacancy for two joker/wildCard

          nos = 2;
        } else {
          nos = 1;
        }
      } else if (p <= (bound += nos3)) {
        //give three pure sequence
        logger.info(rType + " JW3");
        if (rmLen >= 3) {
          //check if there is the vacancy for three joker/wildCard

          nos = 3;
        } else if (rmLen >= 2) {
          //check if there is the vacancy for two joker/wildCard
          nos = 2;
        } else {
          nos = 1;
        }
      } else {
        logger.info(rType + " JW null");
        return { cards: cards, jws: [] };
      }
    } else {
      nos = Nos;
    }
  }
  logger.info("getJWS----------->>>>>nos: " + nos);
  var jwArray = cardsClass.getWCards(cards, wildCard);
  // var final jwArray
  var finalJW = [];
  if (jwArray.length > 0) {
    //check if there is atleast one joker/wildCard
    if (nos == 3) {
      if (jwArray.length >= 3) {
        //check if there are atleast three joker/wildCard
        finalJW = jwArray.splice(0, 3);
      } else if (jwArray.length == 2) {
        //check if there are atleast two joker/wildCard
        finalJW = jwArray.splice(0, 2);
      } else {
        finalJW = jwArray.splice(0, 1);
      }
    } else if (nos == 2) {
      if (jwArray.length >= 2) {
        //check if there are atleast two joker/wildCard
        finalJW = jwArray.splice(0, 2);
      } else {
        finalJW = jwArray.splice(0, 1);
      }
    } else {
      finalJW = jwArray.splice(0, 1);
    }
    logger.info("getJWS----------->>>>>>>finalJW: ", finalJW);
    cards = _.difference(cards, finalJW);
    return { cards: cards, jws: finalJW };
  } else {
    return { cards: cards, jws: [] };
  }
};
const getCSeqs = (cards, rType, rmLen, wildCard, Nos) => {
  /* +-------------------------------------------------------------------+
      desc:this function gives close sequence for robot
      i/p: cards = array of remaining cards  from main deck
         rType = type of robot
         rmLen = number of cards required to make 13 cards 
         wildCard = wildcard
         Nos = numbe of cSeqs
      o/p : object = {
          cards = remaining cards from deck
          cSeqs = array containing close sequence
              }
    +-------------------------------------------------------------------+ */
  if (rmLen >= 2) {
    var nos = 0;

    if (typeof Nos == "undefined" || Nos == null) {
      var p = commonClass.GetRandomInt(0, 100);
      eval("var nos0 = RCARDS." + rType + ".CSEQS.nos0");
      eval("var nos1 = RCARDS." + rType + ".CSEQS.nos1");
      eval("var nos2 = RCARDS." + rType + ".CSEQS.nos2");
      eval("var nos3 = RCARDS." + rType + ".CSEQS.nos3");
      var bound = nos0;
      if (p <= bound) {
        //no pure sequence
        logger.info(rType + " CSEQS0");
        return { cards: cards, cSeqs: [] };
      } else if (p <= (bound += nos1)) {
        //give one pure sequence
        logger.info(rType + " CSEQS1");

        nos = 1;
      } else if (p <= (bound += nos2)) {
        //give two impure sequence
        logger.info(rType + " CSEQS2");
        if (rmLen >= 4) {
          nos = 2;
        } else {
          nos = 1;
        }
      } else if (p <= (bound += nos3)) {
        //give three pure sequence
        logger.info(rType + " CSEQS3");
        if (rmLen >= 6) {
          nos = 3;
        } else if (rmLen >= 4) {
          nos = 2;
        } else {
          nos = 1;
        }
      } else {
        logger.info(rType + " CSEQS null");

        return { cards: cards, cSeqs: [] };
      }
    } else {
      nos = Nos;
    }

    var tempC = _.clone(cards);
    tempC = _.difference(tempC, ["j-1-0", "j-2-0"]);

    var r = commonClass.GetRandomInt(0, tempC.length - 1);
    // logger.info('getPures------------>>>>>r: '+r+' tempC: '+tempC);
    var cSeqs = [];
    var tmp = [];
    var cdLen = tempC.length;
    for (var i = 0; i < cdLen; i++) {
      if (tmp.length == 0) {
        tmp.push(tempC[r]);
      } else {
        var lastCard = tmp[tmp.length - 1];
        var newCard = tempC[r];
        // logger.info('lastCard: '+lastCard+' newCard: '+newCard);
        var matchSuit =
          lastCard.split("-")[0] == newCard.split("-")[0] ? true : false;
        var diff =
          parseInt(newCard.split("-")[1]) - parseInt(lastCard.split("-")[1]);

        if (matchSuit) {
          //two cards with same suit
          if (diff == 0) {
            //ignore
          } else if (diff == 1 || diff == 2) {
            tmp.push(newCard);
          } else {
            if (tmp.length == 2) {
              tempC = _.difference(tempC, tmp);
              cSeqs.push(tmp);
              if (cSeqs.length == nos) {
                break;
              }
            }
            tmp = [];
            // tmp.push(newCard);
          }
        } else {
          if (tmp.length == 2) {
            tempC = _.difference(tempC, tmp);
            cSeqs.push(tmp);
            if (cSeqs.length == nos) {
              break;
            }
          }
          tmp = [];
          // tmp.push(newCard);
        }
      }
      if (tmp.length == 2) {
        tempC = _.difference(tempC, tmp);
        cSeqs.push(tmp);
        tmp = [];
        if (cSeqs.length == nos) {
          break;
        }
      }
      r = (r + 1) % tempC.length;
    }

    cards = _.difference(cards, _.flatten(cSeqs));
    return { cards: cards, cSeqs: _.flatten(cSeqs) };
  } else {
    return { cards: cards, cSeqs: [] };
  }
};
const getCSets = (cards, rType, rmLen, wildCard, Nos) => {
  /* +-------------------------------------------------------------------+
      desc:this function gives close set for robot
      i/p: cards = array of remaining cards  from main deck
         rType = type of robot
         rmLen = number of cards required to make 13 cards 
         wildCard = wildcard
         Nos = number of cSets
      o/p : object = {
          cards = remaining cards from deck
          cSets = array containing close sets
              }
    +-------------------------------------------------------------------+ */
  if (rmLen >= 2) {
    var nos = 0;

    if (typeof Nos == "undefined" || Nos == null) {
      var p = commonClass.GetRandomInt(0, 100);
      eval("var nos0 = RCARDS." + rType + ".CSETS.nos0");
      eval("var nos1 = RCARDS." + rType + ".CSETS.nos1");
      eval("var nos2 = RCARDS." + rType + ".CSETS.nos2");
      eval("var nos3 = RCARDS." + rType + ".CSETS.nos3");
      var bound = nos0;
      if (p <= bound) {
        //no pure sequence
        logger.info(rType + " CSETS0");
        return { cards: cards, cSets: [] };
      } else if (p <= (bound += nos1)) {
        //give one pure sequence
        logger.info(rType + " CSETS1");

        nos = 1;
      } else if (p <= (bound += nos2)) {
        //give two impure sequence
        logger.info(rType + " CSETS2");
        if (rmLen >= 4) {
          nos = 2;
        } else {
          nos = 1;
        }
      } else if (p <= (bound += nos3)) {
        //give three pure sequence
        logger.info(rType + " CSETS3");
        if (rmLen >= 6) {
          nos = 3;
        } else if (rmLen >= 4) {
          nos = 2;
        } else {
          nos = 1;
        }
      } else {
        logger.info(rType + " CSETS null");

        return { cards: cards, cSets: [] };
      }
    } else {
      nos = Nos;
    }
    logger.info("getCSets-------------->>>>>nos: " + nos);

    var tempC = _.clone(cards);
    tempC = _.difference(tempC, ["j-1-0", "j-2-0"]);

    tempC = tempC.toString();
    var r = commonClass.GetRandomInt(0, 12) + 1;
    var re = new RegExp("[flkc]-" + r + "-[01]", "g");

    var srCards =
      tempC.match(re) != null
        ? cardsClass.removeDuplicates(tempC.match(re))
        : [];

    // var srCards = cardsClass.removeDuplicates(tempC.match(re));   //find the array of cards having same rank bu different suits
    var cSets = [];
    tempC = tempC.split(",");
    for (var i = 0; i < 13; i++) {
      if (srCards.length >= 2) {
        //check if the same rank cards have sufficient cards to form a close cSets
        var tmp = srCards.splice(0, 2);
        tempC = _.difference(tempC, tmp);
        cSets.push(tmp);
        if (cSets.length == nos) {
          break;
        }
      }
      r = (r % 13) + 1;
      tempC = tempC.toString();
      re = new RegExp("[flkc]-" + r + "-[01]", "g"); //find all cards with rank r
      srCards =
        tempC.match(re) != null
          ? cardsClass.removeDuplicates(tempC.match(re))
          : [];

      tempC = tempC.split(",");
    }
    cSets = _.flatten(cSets);
    logger.info("getCSets---------->>>>>>cSets: ", cSets);
    cards = _.difference(cards, cSets);
    return { cards: cards, cSets: cSets };
  } else {
    return { cards: cards, cSets: [] };
  }
};
const getPure = (cards, wildCard, len) => {
  //len = length of the pure sequence
  logger.info("getPure-------->>>>");
  cards = cards.splice(0, 52); //take only first 52 cards from deck
  var rd = commonClass.GetRandomInt(0, 3); //0 = f,1 = l, 2 = k, 3 = c
  cards = cards.splice(rd * 13, 13); // choosing random suit for pure sequence
  cards = shuffleCheatCards(cards);
  var pure = [];
  var comb = cardsClass.combinations(cards, len, len, true);
  for (var i in comb) {
    if (cardsClass.isPure(comb[i])) {
      if (_.contains(comb[i], wildCard)) {
        pure = _.without(comb[i], wildCard);
        pure.push(wildCard.split("-")[0] + "-" + wildCard.split("-")[1] + "-1");
      } else {
        pure = comb[i];
      }

      break;
    }
  }
  return pure;
};
const getSet = (cards, wildCard) => {
  //returns 3 cards with same rank and different suit
  logger.info("getSet--------->>>>");
  var set = [];
  var rank = commonClass.GetRandomInt(1, 13);
  var suit = ["f", "l", "k", "c"];
  var st;
  var t;
  for (var i = 0; i < 3; i++) {
    st = commonClass.GetRandomInt(0, suit.length - 1);
    t = suit[st] + "-" + rank + "-0";
    if (t == wildCard) {
      t = suit[st] + "-" + rank + "-1";
    }
    set.push(t);
    suit = _.without(suit, suit[st]);
  }
  return set;
};
const getJW = (wildCard) => {
  //return three cards as joker or wildCard
  var jw = [
    "j-1-0",
    "j-2-0",
    "f-" + wildCard.split("-")[1] + "-0",
    "l-" + wildCard.split("-")[1] + "-0",
    "k-" + wildCard.split("-")[1] + "-0",
    "c-" + wildCard.split("-")[1] + "-0",
  ];
  var rd;
  var t;
  var final = [];
  for (var i = 0; i < 3; i++) {
    rd = commonClass.GetRandomInt(0, jw.length - 1);
    if (jw[rd] == wildCard) {
      t = wildCard.split("-")[0] + "-" + wildCard.split("-")[1] + "-1";
    } else {
      t = jw[rd];
    }
    final.push(t);
    jw = _.without(jw, t);
  }
  return final;
};

module.exports = { getCardsForCheatGamePool, getCardsForCheatGame };

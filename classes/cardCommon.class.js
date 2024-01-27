const _ = require("underscore");
const config = require("../config.json");
const logger = require("../utils/logger");
const { GetConfig } = require("../connections/mongodb");
const DifferCardSuit = (cards) => {
  //splits the card's suit, rank, deck number
  /* +-------------------------------------------------------------------+
      desc: split the cards into suit, rank and decl number 
      i/p : cards = array of cards OR single card 
      o/p : object = {
            suit : array/string of suits of cards in same order as input cards 
            rank : array/string of rank of cards in same order as input cards
            deck : array/string of deck numbers of cards in same order as input cards	
          }
       +-------------------------------------------------------------------+ */

  let obj = { suit: [], rank: [], deck: [] };
  if (Array.isArray(cards)) {
    for (let i in cards) {
      if (cards[i]) {
        let d = cards[i].split("-");
        obj.suit.push(d[0]);
        obj.rank.push(parseInt(d[1]));
        obj.deck.push(parseInt(d[2]));
      }
    }
  } else {
    let d = cards.split("-");
    obj.suit = d[0];
    obj.rank = parseInt(d[1]);
    obj.deck = parseInt(d[2]);
  }
  return obj;
};
const classifyCards = (cards) => {
  /* +-------------------------------------------------------------------+
      desc: group the cards according to their suits 
      i/p : cards = array of cards  
      o/p : object = {
            f : arrray of clubs cards
            l : array of hearts cards
            k : array of spades cards
            c : array of dimonds cards
            j : array of jokers	
          }
       +-------------------------------------------------------------------+ */
  let group = { f: [], l: [], k: [], c: [], j: [] };
  let temp;
  for (x in cards) {
    temp = cards[x].split("-");
    eval("group." + temp[0] + ".push(cards[x])");
  }

  return group;
};
const removeDuplicates = (cards) => {
  // remove duplicates i.e same suit and same rank but not same deck, will not work on jokers
  /* +-------------------------------------------------------------------+
      desc: remove duplicate cards from the input cards array
      i/p : cards = array of cards  
      o/p : array of cars without duplicates
       +-------------------------------------------------------------------+ */
  let temp = cards.toString();

  temp = temp.replace(/-0/g, "-1");
  temp = temp.split(",");
  let duplicates = [];
  let tempCard;

  while (temp.length > 0) {
    tempCard = temp.splice(0, 1)[0];

    if (_.contains(temp, tempCard)) {
      duplicates.push(tempCard);
    }
  }

  let duplicateFree = _.difference(cards, duplicates);

  return duplicateFree;
};
const sortCards = (cards, A14) => {
  //sort the array according to the rank: cards  = cards array, A14 = true/false  for setting A as 14 or 1
  /* +-------------------------------------------------------------------+
      desc: sort the cards into ascending order based on card rank
      i/p : cards = array of cards, A14 = true/false  
      o/p : array of sorted cards array , if A14 = true then returns sorted cards array with rank of ace = 14
       +-------------------------------------------------------------------+ */
  let i, j, t, a;
  let sCards = _.clone(cards);
  if (A14) {
    for (let x in sCards) {
      a = sCards[x].split("-");
      if (parseInt(a[1]) == 1) {
        sCards[x] = a[0] + "-14-" + a[2]; //replace Ace value 1 with 14
      }
    }
  }
  for (i = 0; i < sCards.length; i++) {
    for (j = 0; j < sCards.length - i - 1; j++) {
      if (
        parseInt(sCards[j].split("-")[1]) >
        parseInt(sCards[j + 1].split("-")[1])
      ) {
        t = sCards[j];
        sCards[j] = sCards[j + 1];
        sCards[j + 1] = t;
      }
    }
  }

  return sCards;
};
const sortSequences = (cards, wildcard) => {
  //sort the array according to the rank: cards  = cards array, A14 = true/false  for setting A as 14 or 1
  /* +-------------------------------------------------------------------+
      desc: sort the cards into ascending order based on card rank
      i/p : cards = array of cards, A14 = true/false  
      o/p : array of sorted cards array , if A14 = true then returns sorted cards array with rank of ace = 14
       +-------------------------------------------------------------------+ */
  let cwJ = getCardsWithoutJW(cards, wildcard);
  let jw = getJWcards(cards, wildcard);
  let sorted = sortCards(cwJ);
  let reverse = sorted.reverse();
  let temp = [];
  for (i in reverse) {
    if (temp.length == 0) {
      temp.push(reverse[i]);
    } else {
      let lastCard = temp[temp.length - 1];
      let newCard = reverse[i];
      let diff =
        parseInt(lastCard.split("-")[1]) - parseInt(newCard.split("-")[1]);
      if (diff > 1 && diff != 11) {
        let tm = jw.splice(0, 1);
        temp.push(tm[0]);
        temp.push(reverse[i]);
      } else {
        temp.push(reverse[i]);
      }
    }
  }

  if (jw.length > 0) {
    for (j in jw) {
      temp.push(jw[j]);
    }
  }

  for (let j in temp) {
    if (typeof temp[j] != "undefined") {
      let temp1 = temp[j].toString().replace(/-14-/g, "-1-").split(",");
      temp[j] = temp1[0];
    } else {
      temp.splice(j, 1);
    }
  }
  return temp;
};
const isPure = (cards) => {
  //Checks if the cards are in pure sequence
  /* +-------------------------------------------------------------------+
      desc: check if the inputted cards is a pure sequence or not
      i/p : cards = array of cards  
      o/p : true/false
       +-------------------------------------------------------------------+ */
  if (cards.length > 2) {
    var cwJ = getCardsWithoutJ(cards); //cards without jokers
    if (cwJ.length < cards.length) {
      return false; //means there is a joker in cards hence impurity
    }

    var cwJsort = sortCards(cwJ); //cards without jokers with sorting
    var cwJsortA = sortCards(cwJ, true); //cards without jokers with sorting and A = 14

    var DCScwJsort = DifferCardSuit(cwJsort);
    var DCScwJsortA = DifferCardSuit(cwJsortA);

    var diffCount = 0; //difference count
    var diffCountA = 0; //difference count with A = 14
    var diff = 0;
    var diffA = 0;
    for (var i = 0; i < cwJ.length - 1; i++) {
      diff = DCScwJsort.rank[i + 1] - DCScwJsort.rank[i]; //difference between two adjacent cards
      if (DCScwJsort.suit[i] == DCScwJsort.suit[i + 1] && diff >= 1) {
        diffCount += diff;
      } else {
        return false; //means card diff = 0 or cards are of diferent suits, assume array is sorted
      }
      diffA = DCScwJsortA.rank[i + 1] - DCScwJsortA.rank[i]; //difference between two adjacent cards having A = 14
      if (DCScwJsortA.suit[i] == DCScwJsortA.suit[i + 1] && diffA >= 1) {
        diffCountA += diffA;
      } else {
        return false; //means card diff = 0 or cards are of diferent suits, assume array is sorted
      }
    }

    if (diffCount == cwJsort.length - 1 || diffCountA == cwJsortA.length - 1) {
      return true; //means all cards are in sorted order and difference between two adjacent cards is 1
    } else {
      return false;
    }
  } else {
    return false;
  }
};
const isSeq = (cards, wildCard) => {
  //Checks if the cards are in sequence(impure)
  /* +-------------------------------------------------------------------+
      desc: check if the given inputted cards is impure sequence or not
      i/p : cards = array of cards, wildCard = wildcard  
      o/p : true/false
       +-------------------------------------------------------------------+ */
  if (cards.length > 2) {
    //atleast 3 cards must be there to make a sequence

    var JWcards = getJWcards(cards, wildCard); //joker and wildCards sequence

    if (JWcards.length == cards.length) {
      return true;
    }

    var cwJW = getCardsWithoutJW(cards, wildCard); //cards without jokers and wildCard

    var cwJWsort = sortCards(cwJW); //cards without jokers and wildCard with sorting and A = 1
    var cwJWsortA = sortCards(cwJW, true); //cards without jokers and wildCard with sorting and A = 14

    var DCScwJWsort = DifferCardSuit(cwJWsort);
    var DCScwJWsortA = DifferCardSuit(cwJWsortA);

    var diffCount = 0; //difference count
    var diffCountA = 0; //difference count with A = 14
    var diff = 0;
    var diffA = 0;

    for (var i = 0; i < cwJW.length - 1; i++) {
      diff = DCScwJWsort.rank[i + 1] - DCScwJWsort.rank[i]; //difference between two adjacent cards
      if (DCScwJWsort.suit[i] == DCScwJWsort.suit[i + 1] && diff >= 1) {
        //checking if adjacent cards are of same suit and having difference = 1
        diffCount += diff;
      } else {
        logger.info('isSeq---------1----->>>>>>"cards with different suits"');
        return false; //means card diff = 0 or cards are of different suits, assume array is sorted
      }
      diffA = DCScwJWsortA.rank[i + 1] - DCScwJWsortA.rank[i]; //difference between two adjacent cards having A = 14
      if (DCScwJWsortA.suit[i] == DCScwJWsortA.suit[i + 1] && diffA >= 1) {
        //checking if adjacent cards are of same suit and having difference = 1 and
        diffCountA += diffA;
      } else {
        logger.info('isSeq---------14----->>>>>>"cards with different suits"');
        return false; //means card diff = 0 or cards are of different suits, assume array is sorted
      }
    }

    logger.info(
      "isSeq-------------->>>>diffCount: " +
      diffCount +
      " diffCountA: " +
      diffCountA +
      " cwJWsort.length: " +
      cwJWsort.length +
      " cwJWsortA.length: " +
      cwJWsortA.length
    );
    if (
      diffCount == cwJWsort.length - 1 ||
      diffCountA == cwJWsortA.length - 1
    ) {
      return true; //means all cards are in sorted order and difference between two adjacent cards is 1
    } else if (
      diffCount - (cwJWsort.length - 1) <= JWcards.length ||
      diffCountA - (cwJWsortA.length - 1) <= JWcards.length
    ) {
      return true; //means sequence can be made using jokers and wildCard
    } else {
      logger.info(
        'isSeq-------------->>>>>>>"insufficient jokers and wildcards to form seq"'
      );
      return false;
    }
  } else {
    return false;
  }
};
const isSet = (cards, wildCard) => {
  //Checks if the cards are in set i.e of same rank
  /* +-------------------------------------------------------------------+
      desc: check if the inputted cards is set or not
      i/p : cards = array of cards, wildCard = wildcard  
      o/p : true/false
       +-------------------------------------------------------------------+ */
  if (cards.length > 2) {
    //atleast 3 cards must be there to make a sets

    var cwJW = getCardsWithoutJW(cards, wildCard); //cards without Joker and wildCard
    var DCScwJW = DifferCardSuit(cwJW);

    for (var i = 0; i < cwJW.length; i++) {
      for (var j = i + 1; j < cwJW.length; j++) {
        if (
          DCScwJW.rank[i] != DCScwJW.rank[j] ||
          DCScwJW.suit[i] == DCScwJW.suit[j]
        ) {
          logger.info(
            'isSet------xxx------>>>>>"cards with different different rank or same suit"'
          );
          return false;
        }
      }
    }
    if (cards.length <= 4) {
      // at most cards are there in
      logger.info('isSet------ooo------>>>>>>"valid set"');
      return true;
    } else {
      logger.info('isSet------xxx------>>>>>>"more than 4 cards"');
      return false;
    }
  } else {
    logger.info('isSet------xxx------>>>>>>"less than 2 cards"');
    return false;
  }
};
const getCardsWithoutJW = (cards, wildCard) => {
  //returns cards array without joker and wildCard
  /* +-------------------------------------------------------------------+
      desc: returns cards without jokers and/or wildcards
      i/p : cards = array of cards, wildCard = wildcard  
      o/p : array of cards without joker and without jokers or wildcards from input array
       +-------------------------------------------------------------------+ */
  var DCScards = DifferCardSuit(cards);
  var DCSwildCard = DifferCardSuit(wildCard);
  var cardswJW = []; //cards without joker and wildCard
  for (var i = 0; i < cards.length; i++) {
    if (DCScards.rank[i] != DCSwildCard.rank && DCScards.suit[i] != "j") {
      cardswJW.push(cards[i]);
    }
  }
  return cardswJW;
};
const getCardsWithoutJ = (cards) => {
  //returns cards array without jokers
  /* +-------------------------------------------------------------------+
      desc: returns cards without jokers 
      i/p : cards = array of cards
      o/p : array of cards without joker from input cards array
       +-------------------------------------------------------------------+ */
  var DCScards = DifferCardSuit(cards);
  var cardswJ = []; //cards without joker
  for (var i = 0; i < cards.length; i++) {
    if (DCScards.suit[i] != "j") {
      cardswJ.push(cards[i]);
    }
  }
  return cardswJ;
};
const getJCards = (cards) => {
  //returns cards array without jokers
  /* +-------------------------------------------------------------------+
      desc: returns jokers from input cards
      i/p : cards = array of cards
      o/p : array of cards containing joker from input cards array
       +-------------------------------------------------------------------+ */
  var DCScards = DifferCardSuit(cards);
  var Jcards = []; //cards without joker
  for (var i = 0; i < cards.length; i++) {
    if (DCScards.suit[i] == "j") {
      Jcards.push(cards[i]);
    }
  }
  return Jcards;
};
const getWCards = (cards, wildCard) => {
  /* +-------------------------------------------------------------------+
      desc: returns wildCards from input cards
      i/p : cards = array of cards, wildCard  = wildcard
      o/p : array of cards containing wildcards from input cards array
       +-------------------------------------------------------------------+ */
  var wArray = [];
  var cwJ = getCardsWithoutJ(cards);
  var wRank = parseInt(wildCard.split("-")[1]);

  for (var i in cwJ) {
    if (parseInt(cwJ[i].split("-")[1]) == wRank) {
      wArray.push(cwJ[i]);
    }
  }
  return wArray;
};
const getJWcards = (cards, wildCard) => {
  //returns cards array of joker and wildCard
  /* +-------------------------------------------------------------------+
      desc: returns jokers/wildCards from input cards
      i/p : cards = array of cards, wildCard  = wildcard
      o/p : array of cards containing jokers/wildcards from input cards array
       +-------------------------------------------------------------------+ */
  var DCScards = DifferCardSuit(cards);
  var DCSwildCard = DifferCardSuit(wildCard);
  var JWcards = [];
  for (i = 0; i < cards.length; i++) {
    if (DCScards.rank[i] == DCSwildCard.rank || DCScards.suit[i] == "j") {
      JWcards.push(cards[i]);
    }
  }
  return JWcards;
};
const getCSeqs = (cards, wildCard) => {
  //returns array consisting of all the close seq from cards
  /* +-------------------------------------------------------------------+
      desc: returns close sequence from input cards
      i/p : cards = array of cards, wildCard  = wildcard
      o/p : 2D array of cards containing close sequence
       +-------------------------------------------------------------------+ */
  //limitations: cannot return double same close sequence
  if (cards.length < 2) {
    return [];
  }
  var cwJ = getCardsWithoutJ(cards);
  var cSeqs = [];
  var cSeqsA = [];

  if (cwJ.length < 2) {
    return []; //return empty array
  } else {
    var cwJSorted = sortCards(cwJ);
    var classify = classifyCards(cwJSorted);
    var combine = classify.f
      .reverse()
      .concat(classify.l.reverse())
      .concat(classify.k.reverse())
      .concat(classify.c.reverse());
    var temp = [];

    for (var i in combine) {
      if (temp.length == 0) {
        temp.push(combine[i]);
      } else {
        var lastCard = temp[temp.length - 1];
        var newCard = combine[i];

        var matchSuit =
          lastCard.split("-")[0] == newCard.split("-")[0] ? true : false;
        var diff =
          parseInt(lastCard.split("-")[1]) - parseInt(newCard.split("-")[1]);

        if (matchSuit) {
          if (diff == 0) {
            //difference logic here
          } else if (diff == 1 || diff == 2) {
            temp.push(newCard);
          } else {
            if (temp.length == 2) {
              cSeqs.push(temp);
            }
            temp = [];
            temp.push(newCard);
          }
        } else {
          if (temp.length == 2) {
            cSeqs.push(temp);
          }
          temp = [];
          temp.push(newCard);
        }
        if (temp.length == 2) {
          cSeqs.push(temp);
          temp = [];
        }
        // temp.push(newCard);
      }
    }
    if (temp.length == 2) {
      cSeqs.push(temp);
      temp = [];
    }

    cwJSorted = sortCards(cwJ, true);
    classify = classifyCards(cwJSorted);
    combine = classify.f
      .reverse()
      .concat(classify.l.reverse())
      .concat(classify.k.reverse())
      .concat(classify.c.reverse());
    temp = [];

    for (var i in combine) {
      if (temp.length == 0) {
        temp.push(combine[i]);
      } else {
        var lastCard = temp[temp.length - 1];
        var newCard = combine[i];

        var matchSuit =
          lastCard.split("-")[0] == newCard.split("-")[0] ? true : false;
        var diff =
          parseInt(lastCard.split("-")[1]) - parseInt(newCard.split("-")[1]);

        if (matchSuit) {
          if (diff == 0) {
            //difference logic here
          } else if (diff == 1 || diff == 2) {
            temp.push(newCard);
          } else {
            if (temp.length == 2) {
              cSeqsA.push(temp);
            }
            temp = [];
            temp.push(newCard);
          }
        } else {
          if (temp.length == 2) {
            cSeqsA.push(temp);
          }
          temp = [];
          temp.push(newCard);
        }
        if (temp.length == 2) {
          cSeqsA.push(temp);
          temp = [];
        }
        // temp.push(newCard);
      }
    }
    if (temp.length == 2) {
      cSeqsA.push(temp);
      temp = [];
    }
  }
  logger.info("getCSeqsA-------->>>>cSeqsA: ", cSeqsA);

  for (var i in cSeqsA) {
    var t = cSeqsA[i].toString();
    t = t.replace(/14/g, "1");
    cSeqsA[i] = t.split(",");
  }
  // logger.info('cards: ',cards,' combine: ',combine,' cSeqs: ',cSeqs,' difference: ',_.difference(cards,_.flatten(cSeqs)));
  var remainCardsSum = cardsSum(
    _.difference(cards, _.flatten(cSeqs)),
    wildCard
  );
  // logger.info('cards: ',cards,'  combineA: ',combine,' cSeqsA: ',cSeqsA,' difference: ',_.difference(cards,_.flatten(cSeqsA)));
  var remainACardsSum = cardsSum(
    _.difference(cards, _.flatten(cSeqsA)),
    wildCard
  );
  // logger.info('remainCardsSum: ',remainCardsSum,' remainACardsSum: ',remainACardsSum);
  if (remainACardsSum < remainCardsSum) {
    logger.info("cSeqsA: ", cSeqsA);
    return cSeqsA;
  } else {
    logger.info("cSeqs: ", cSeqs);
    return cSeqs;
  }
};
const getCSeq3cd = (cards, wildCard) => {
  //finds the third cards require to form complete sequence from close sequence; cards in descending order
  /* +-------------------------------------------------------------------+
      desc: returns array of possible third card required to make complete sequence according to inputted close sequence
      i/p : cards = array of cards, wildCard  = wildcard
      o/p : array of cards containing third card required for making complete sequence from inputted cards
       +-------------------------------------------------------------------+ */

  if (cards.length == 2) {
    var card1 = [cards[0].split("-")[0], parseInt(cards[0].split("-")[1])]; // first card
    var card2 = [cards[1].split("-")[0], parseInt(cards[1].split("-")[1])]; //second card
    var wRank = parseInt(wildCard.split("-")[1]);
    var diff = card1[1] - card2[1];
    var ver = [];

    ver = ver.concat(["j-1-0", "j-2-0"]); //joker will always be the third card to make a close sequence

    if (diff == 1) {
      //cards are adjacent and first card is not ace
      if (card1[1] == 13) {
        //means the sequence is 13,12  so ace and jack will be pushed
        ver.push(card1[0] + "-1-0");
        ver.push(card1[0] + "-1-1");
        ver.push(card1[0] + "-11-0");
        ver.push(card1[0] + "-11-1");
      } else {
        //card greater than first card
        ver.push(card1[0] + "-" + (card1[1] + 1) + "-0");
        ver.push(card1[0] + "-" + (card1[1] + 1) + "-1");
        //cards less than second card
        ver.push(card2[0] + "-" + (card2[1] - 1) + "-0");
        ver.push(card2[0] + "-" + (card2[1] - 1) + "-1");
      }
    } else if (diff == 2) {
      //cards are 1 card apart  and first card is not ace
      ver.push(card1[0] + "-" + (card1[1] - 1) + "-0");
      ver.push(card1[0] + "-" + (card1[1] - 1) + "-1");
    } else {
      if (card1[1] == 1 && card2[1] == 13) {
        //means first card is ace an second card is king then push only queen
        ver.push(card1[0] + "-12-0");
        ver.push(card1[0] + "-12-1");
      } else if (card1[1] == 1 && card2[1] == 12) {
        //means first cards is ace and second card is queen then only push king
        ver.push(card1[0] + "-13-0");
        ver.push(card1[0] + "-13-1");
      }
    }
    //check for the wildCards that can be placed as third card iff it is not from either of two cards

    if (
      "f-" + wRank != card1[0] + "-" + card1[1] &&
      "f-" + wRank != card2[0] + "-" + card2[1]
    ) {
      ver.push("f-" + wRank + "-0");
      ver.push("f-" + wRank + "-1");
    }
    if (
      "l-" + wRank != card1[0] + "-" + card1[1] &&
      "l-" + wRank != card2[0] + "-" + card2[1]
    ) {
      ver.push("l-" + wRank + "-0");
      ver.push("l-" + wRank + "-1");
    }
    if (
      "k-" + wRank != card1[0] + "-" + card1[1] &&
      "k-" + wRank != card2[0] + "-" + card2[1]
    ) {
      ver.push("k-" + wRank + "-0");
      ver.push("k-" + wRank + "-1");
    }
    if (
      "c-" + wRank != card1[0] + "-" + card1[1] &&
      "c-" + wRank != card2[0] + "-" + card2[1]
    ) {
      ver.push("c-" + wRank + "-0");
      ver.push("c-" + wRank + "-1");
    }
    ver = _.without(ver, wildCard);
    ver = _.uniq(ver);
    return ver;
  } else {
    logger.info(
      'getCSeq3cd::::::::::::::::::>>>>>>Error:"invalid close sequence"'
    );
    return [];
  }
};
const getCSeq3rcd = (cards, wildCard) => {
  //finds the third cards require to form complete sequence from close sequence; cards in descending order
  /* +-------------------------------------------------------------------+
      desc: returns array of possible third card required to make complete sequence according to inputted close sequence
      i/p : cards = array of cards, wildCard  = wildcard
      o/p : array of cards containing third card required for making complete sequence from inputted cards
       +-------------------------------------------------------------------+ */

  if (cards.length == 2) {
    var card1 = [cards[0].split("-")[0], parseInt(cards[0].split("-")[1])]; // first card
    var card2 = [cards[1].split("-")[0], parseInt(cards[1].split("-")[1])]; //second card
    var diff = card1[1] - card2[1];
    var ver = [];

    if (diff == 1) {
      //cards are adjacent and first card is not ace
      if (card1[1] == 13) {
        //means the sequence is 13,12  so ace and jack will be pushed
        ver.push(card1[0] + "-1-0");
        ver.push(card1[0] + "-1-1");
        ver.push(card1[0] + "-11-0");
        ver.push(card1[0] + "-11-1");
      } else {
        //card greater than first card
        ver.push(card1[0] + "-" + (card1[1] + 1) + "-0");
        ver.push(card1[0] + "-" + (card1[1] + 1) + "-1");
        //cards less than second card
        ver.push(card2[0] + "-" + (card2[1] - 1) + "-0");
        ver.push(card2[0] + "-" + (card2[1] - 1) + "-1");
      }
    } else if (diff == 2) {
      //cards are 1 card apart  and first card is not ace
      ver.push(card1[0] + "-" + (card1[1] - 1) + "-0");
      ver.push(card1[0] + "-" + (card1[1] - 1) + "-1");
    } else {
      if (card1[1] == 1 && card2[1] == 13) {
        //means first card is ace an second card is king then push only queen
        ver.push(card1[0] + "-12-0");
        ver.push(card1[0] + "-12-1");
      } else if (card1[1] == 1 && card2[1] == 12) {
        //means first cards is ace and second card is queen then only push king
        ver.push(card1[0] + "-13-0");
        ver.push(card1[0] + "-13-1");
      }
    }
    //check for the wildCards that can be placed as third card iff it is not from either of two cards
    ver = _.without(ver, wildCard);
    ver = _.uniq(ver);
    return ver;
  } else {
    logger.info(
      'getCSeq3cd::::::::::::::::::>>>>>>Error:"invalid close sequence"'
    );
    return [];
  }
};
const getCSets = (cards) => {
  //return the array of close sets
  /* +-------------------------------------------------------------------+
      desc: returns 2D array of cards containing close sets from inputted cards
      i/p : cards = array of cards
      o/p : 2D array of cards containing close sets 
       +-------------------------------------------------------------------+ */
  //limitations: cannot handle multiple duplicates properly
  if (cards.length < 2) {
    logger.info("getCSets----1---->>>>>invalid close set");
    return [];
  }
  var cwJ = getCardsWithoutJ(cards);
  var cSets = [];
  if (cwJ.length < 2) {
    logger.info("getCSets---2----->>>>>invalid close set");
    return [];
  }

  var cwJSorted = sortCards(cwJ);
  logger.info("getCSets----------->>>>>cwJSorted: ", cwJSorted);
  var temp = [];
  for (var i = 0; i < cwJSorted.length; i++) {
    if (temp.length == 0) {
      temp.push(cwJSorted[i]);
    } else {
      var lastCard = temp[temp.length - 1];
      var newCard = cwJSorted[i];
      var matchSuit =
        lastCard.split("-")[0] == newCard.split("-")[0] ? true : false;
      var matchRank =
        lastCard.split("-")[1] == newCard.split("-")[1] ? true : false;
      logger.info(
        "getCSets------------>>>>>>>lastCard: " +
        lastCard +
        " newCard: " +
        newCard +
        " matchSuit: " +
        matchSuit +
        " matchRank: " +
        matchRank
      );
      if (!matchSuit && matchRank) {
        temp.push(newCard);
        if (temp.length == 2) {
          cSets.push(temp);
          temp = [];
        }
      } else {
        if (temp.length == 2) {
          cSets.push(temp);
        }
        temp = [];
        temp.push(newCard);
      }
    }
  }
  if (temp.length == 2) {
    cSets.push(temp);
    temp = [];
  }
  return cSets;
};
const getCSet3cd = (cards, wildCard) => {
  //return all the versions of third card to form a complete set from close set
  /* +-------------------------------------------------------------------+
      desc: returns possible cards to form complete set from inputted close set
      i/p : cards = array of cards, wildCard = wildcard
      o/p : 2D array of cards containing close sets 
       +-------------------------------------------------------------------+ */
  if (cards.length == 2) {
    var suit1 = cards[0].split("-")[0];
    var suit2 = cards[1].split("-")[0];
    var rank = cards[0].split("-")[1];
    var wRank = wildCard.split("-")[1];
    var ver = [];
    ver = ver.concat(["j-1-0", "j-2-0"]);

    if ("f" != suit1 && "f" != suit2) {
      ver.push("f-" + rank + "-0");
      ver.push("f-" + rank + "-1");
    }
    if ("l" != suit1 && "l" != suit2) {
      ver.push("l-" + rank + "-0");
      ver.push("l-" + rank + "-1");
    }
    if ("k" != suit1 && "k" != suit2) {
      ver.push("k-" + rank + "-0");
      ver.push("k-" + rank + "-1");
    }
    if ("c" != suit1 && "c" != suit2) {
      ver.push("c-" + rank + "-0");
      ver.push("c-" + rank + "-1");
    }

    if (
      "f-" + wRank != suit1 + "-" + rank &&
      "f-" + wRank != suit2 + "-" + rank
    ) {
      ver.push("f-" + wRank + "-0");
      ver.push("f-" + wRank + "-1");
    }
    if (
      "l-" + wRank != suit1 + "-" + rank &&
      "l-" + wRank != suit2 + "-" + rank
    ) {
      ver.push("l-" + wRank + "-0");
      ver.push("l-" + wRank + "-1");
    }
    if (
      "k-" + wRank != suit1 + "-" + rank &&
      "k-" + wRank != suit2 + "-" + rank
    ) {
      ver.push("k-" + wRank + "-0");
      ver.push("k-" + wRank + "-1");
    }
    if (
      "c-" + wRank != suit1 + "-" + rank &&
      "c-" + wRank != suit2 + "-" + rank
    ) {
      ver.push("c-" + wRank + "-0");
      ver.push("c-" + wRank + "-1");
    }

    ver = _.without(ver, wildCard);
    ver = _.uniq(ver);

    return ver;
  } else {
    logger.info('getCSet3cd:::::::::::::::>>>>>>Error: "invalid close set"');
    return [];
  }
};
const getCSet3rcd = (cards, wildCard) => {
  //return all the versions of third card to form a complete set from close set
  /* +-------------------------------------------------------------------+
      desc: returns possible cards to form complete set from inputted close set
      i/p : cards = array of cards, wildCard = wildcard
      o/p : 2D array of cards containing close sets 
       +-------------------------------------------------------------------+ */
  if (cards.length == 2) {
    var suit1 = cards[0].split("-")[0];
    var suit2 = cards[1].split("-")[0];
    var rank = cards[0].split("-")[1];
    var wRank = wildCard.split("-")[1];
    var ver = [];

    if ("f" != suit1 && "f" != suit2) {
      ver.push("f-" + rank + "-0");
      ver.push("f-" + rank + "-1");
    }
    if ("l" != suit1 && "l" != suit2) {
      ver.push("l-" + rank + "-0");
      ver.push("l-" + rank + "-1");
    }
    if ("k" != suit1 && "k" != suit2) {
      ver.push("k-" + rank + "-0");
      ver.push("k-" + rank + "-1");
    }
    if ("c" != suit1 && "c" != suit2) {
      ver.push("c-" + rank + "-0");
      ver.push("c-" + rank + "-1");
    }

    ver = _.without(ver, wildCard);
    ver = _.uniq(ver);

    return ver;
  } else {
    logger.info('getCSet3cd:::::::::::::::>>>>>>Error: "invalid close set"');
    return [];
  }
};
const getPureSeqs = (cards, wildCard) => {
  /* +-------------------------------------------------------------------+
      desc: returns pure sequence from inputted cards
      i/p : cards = array of cards, wildCard = wildcard
      o/p : 2D array of cards containing pure sequences from inputted cards
       +-------------------------------------------------------------------+ */
  var cwJ = getCardsWithoutJ(cards);
  var cwJSorted = sortCards(cwJ);
  var cwJSortedA = sortCards(cwJ, true);
  logger.info("getPureSeqs---------->>>>>cwJSorted: ", cwJSorted);
  var classify = classifyCards(cwJSorted);
  var classifyA = classifyCards(cwJSortedA);

  var combine = classify.f
    .reverse()
    .concat(classify.l.reverse())
    .concat(classify.k.reverse())
    .concat(classify.c.reverse());
  var combineA = classifyA.f
    .reverse()
    .concat(classifyA.l.reverse())
    .concat(classifyA.k.reverse())
    .concat(classifyA.c.reverse());
  logger.info("getPureSeqs------------>>>>>>combine: ", combine);
  var pure = [];
  var pureA = [];
  var temp = [];
  var tempA = [];
  var dTemp = [];
  var dTempA = [];

  for (var i in combine) {
    if (temp.length == 0) {
      temp.push(combine[i]);
    } else {
      var lastCard = temp[temp.length - 1];
      var newCard = combine[i];
      var diff =
        parseInt(lastCard.split("-")[1]) - parseInt(newCard.split("-")[1]);
      var matchSuit =
        lastCard.split("-")[0] == newCard.split("-")[0] ? true : false;

      if (matchSuit) {
        if (diff == 0) {
          //duplicate logic
          if (dTemp.length == 0) {
            dTemp.push(newCard);
          } else {
            var lastD = dTemp[dTemp.length - 1];
            var diffD =
              parseInt(lastD.split("-")[1]) - parseInt(newCard.split("-")[1]);
            // var matchD = (lastD.split('-')[0] == newCard.split('-')[0])?true:false;
            if (diffD == 1) {
              dTemp.push(newCard);
            } else {
              if (dTemp.length > 2) {
                pure.push(dTemp);
              }
              dTemp = [];
              dTemp.push(newCard);
            }
          }
        } else if (diff == 1) {
          temp.push(newCard);
        } else {
          if (temp.length > 2) {
            pure.push(temp);
          }
          if (dTemp.length > 2) {
            pure.push(dTemp);
          }
          temp = [];
          dTemp = [];
          temp.push(newCard);
        }
      } else {
        if (temp.length > 2) {
          pure.push(temp);
        }
        if (dTemp.length > 2) {
          pure.push(dTemp);
        }
        temp = [];
        dTemp = [];
        temp.push(newCard);
      }
    }
  }
  if (temp.length > 2) {
    pure.push(temp);
  }
  if (dTemp.length > 2) {
    pure.push(dTemp);
  }

  for (var i in combineA) {
    if (tempA.length == 0) {
      tempA.push(combineA[i]);
    } else {
      var lastCard = tempA[tempA.length - 1];
      var newCard = combineA[i];
      var diff =
        parseInt(lastCard.split("-")[1]) - parseInt(newCard.split("-")[1]);
      var matchSuit =
        lastCard.split("-")[0] == newCard.split("-")[0] ? true : false;

      if (matchSuit) {
        if (diff == 0) {
          //duplicate logic
          if (dTempA.length == 0) {
            dTempA.push(newCard);
          } else {
            var lastD = dTempA[dTempA.length - 1];
            var diffD =
              parseInt(lastD.split("-")[1]) - parseInt(newCard.split("-")[1]);
            // var matchD = (lastD.split('-')[0] == newCard.split('-')[0])?true:false;
            if (diffD == 1) {
              dTempA.push(newCard);
            } else {
              if (dTempA.length > 2) {
                pureA.push(dTempA);
              }
              dTempA = [];
              dTempA.push(newCard);
            }
          }
        } else if (diff == 1) {
          tempA.push(newCard);
        } else {
          if (tempA.length > 2) {
            pureA.push(tempA);
          }
          if (dTempA.length > 2) {
            pureA.push(dTempA);
          }
          tempA = [];
          dTempA = [];
          tempA.push(newCard);
        }
      } else {
        if (tempA.length > 2) {
          pureA.push(tempA);
        }
        if (dTempA.length > 2) {
          pureA.push(dTempA);
        }
        tempA = [];
        dTempA = [];
        tempA.push(newCard);
      }
    }
  }
  if (tempA.length > 2) {
    pureA.push(tempA);
  }
  if (dTempA.length > 2) {
    pureA.push(dTempA);
  }

  var remainCardsSum = cardsSum(_.difference(cards, _.flatten(pure)), wildCard);
  //logger.info('  combine: ',combine,' pure: ',pure,' difference: ',_.difference(cards,_.flatten(pure)));
  for (var j in pureA) {
    pureA[j] = pureA[j].toString().replace(/-14-/g, "-1-").split(",");
  }
  var remainACardsSum = cardsSum(
    _.difference(cards, _.flatten(pureA)),
    wildCard
  );
  //logger.info('  combineA: ',combineA,' pureA: ',pureA,' difference: ',_.difference(cards,_.flatten(pureA)));

  // logger.info('remainCardsSum: ',remainCardsSum,' remainACardsSum: ',remainACardsSum);
  if (remainACardsSum < remainCardsSum) {
    // logger.info('pureA: ',pureA);
    pure = pureA;
  }

  var pureTemp = [];

  for (var k in pure) {
    //pure cards splitting logic
    var len = pure[k].length;
    if (len >= 6 && len <= 8) {
      var div = Math.round(len / 2);

      pureTemp.push(pure[k].splice(0, div));
      pureTemp.push(pure[k]);
    } else if (len >= 9 && len <= 11) {
      var div = Math.round(len / 3);
      pureTemp.push(pure[k].splice(0, div));
      pureTemp.push(pure[k].splice(0, div));
      pureTemp.push(pure[k]);
    } else if (len >= 12 && len <= 14) {
      var div = Math.round(len / 4);
      pureTemp.push(pure[k].splice(0, div));
      pureTemp.push(pure[k].splice(0, div));
      pureTemp.push(pure[k].splice(0, div));
      pureTemp.push(pure[k]);
    } else {
      pureTemp.push(pure[k]);
    }
  }

  return pureTemp;
};
const getSeqs = (cards, wildCard) => {
  /* +-------------------------------------------------------------------+
      desc: returns impure sequence from inputted cards
      i/p : cards = array of cards, wildCard = wildcard
      o/p : 2D array of cards containing impure sequences from inputted cards
       +-------------------------------------------------------------------+ */
  var cwJW = getCardsWithoutJW(cards, wildCard);
  var jwArray = _.difference(cards, cwJW);
  // var jwLen = jwArray.length;

  var cwJSorted = sortCards(cwJW);
  var cwJSortedA = sortCards(cwJW, true);

  var classify = classifyCards(cwJSorted);
  var classifyA = classifyCards(cwJSortedA);

  var combine = classify.f
    .reverse()
    .concat(classify.l.reverse())
    .concat(classify.k.reverse())
    .concat(classify.c.reverse());
  var combineA = classifyA.f
    .reverse()
    .concat(classifyA.l.reverse())
    .concat(classifyA.k.reverse())
    .concat(classifyA.c.reverse());
  // logger.info('getSeqs---------->>>>>combine: ',combine,' jwArray: ',jwArray);
  var seq = [];
  var seqA = [];
  var temp = [];
  var tempA = [];
  var dTemp = [];
  var dTempA = [];

  for (var i in combine) {
    if (temp.length == 0) {
      temp.push(combine[i]);
    } else {
      var lastCard = temp[temp.length - 1];
      var newCard = combine[i];
      var diff =
        parseInt(lastCard.split("-")[1]) - parseInt(newCard.split("-")[1]);
      var matchSuit =
        lastCard.split("-")[0] == newCard.split("-")[0] ? true : false;
      // logger.info('getSeqs----------->>>>>>lastCard: '+lastCard+' newCard: '+newCard+' diff: '+diff+' matchSuit: '+matchSuit);
      if (matchSuit) {
        // if adjacent cards of the same suit

        if (diff == 0) {
          //logic for duplicates
          if (dTemp.length == 0) {
            dTemp.push(newCard);
          } else {
            var lastD = dTemp[dTemp.length - 1];
            var diffD =
              parseInt(lastD.split("-")[1]) - parseInt(newCard.split("-")[1]);
            // var matchD = (lastD.split('-')[0] == newCard.split('-')[0])?true:false;
            if (diffD == 1) {
              dTemp.push(newCard);
            } else {
              if (diffD <= jwArray.length + 1) {
                dTemp = dTemp.concat(jwArray.splice(0, diffD - 1));
                dTemp.push(newCard);
              } else {
                if (dTemp.length > 2) {
                  seq.push(temp);
                } else if (dTemp.length == 2 && jwArray.length > 0) {
                  dTemp = dTemp.concat(jwArray.splice(0, 1));
                  seq.push(dTemp);
                }
                dTemp = [];
                dTemp.push(newCard);
              }
            }
          }
        } else if (diff == 1) {
          //logic to push
          temp.push(newCard);
        } else {
          if (diff <= jwArray.length + 1) {
            //have sufficient joker to fillup
            temp = temp.concat(jwArray.splice(0, diff - 1));

            temp.push(newCard);
          } else {
            if (temp.length > 2) {
              seq.push(temp);
            } else if (temp.length == 2 && jwArray.length > 0) {
              temp = temp.concat(jwArray.splice(0, 1));
              seq.push(temp);
            } else {
            }
            if (dTemp.length > 2) {
              seq.push(dTemp);
            } else if (dTemp.length == 2 && jwArray.length > 0) {
              dTemp = dTemp.concat(jwArray.splice(0, 1));
            } else {
              // logger.info('getSeqs------1--B--->>>>???');
            }
            temp = [];
            dTemp = [];
            temp.push(newCard);
          }
        }
      } else {
        //if adjacent cards of the different suits
        if (temp.length > 2) {
          seq.push(temp);
        } else if (temp.length == 2 && jwArray.length > 0) {
          temp = temp.concat(jwArray.splice(0, 1));
          seq.push(temp);
        } else {
          // logger.info('getSeqs------1--A-->>>>???');
        }
        if (dTemp.length > 2) {
          seq.push(dTemp);
        } else if (dTemp.length == 2 && jwArray.length > 0) {
          dTemp = dTemp.concat(jwArray.splice(0, 1));
        } else {
          // logger.info('getSeqs------1--B--->>>>???');
        }

        temp = [];
        dTemp = [];
        temp.push(newCard);
      }
    }
  }
  if (temp.length > 2) {
    seq.push(temp);
  } else if (temp.length == 2 && jwArray.length > 0) {
    temp = temp.concat(jwArray.splice(0, 1));
    seq.push(temp);
  } else {
    // logger.info('getSeqs-----------1------A------>>>>>');
  }

  if (dTemp.length > 2) {
    seq.push(dTemp);
  } else if (dTemp.length == 2 && jwArray.length > 0) {
    dTemp = dTemp.concat(jwArray.splice(0, 1));
  } else {
    // logger.info('getSeqs-------1------B------>>>>>');
  }

  jwArray = _.difference(cards, cwJW);
  for (var i in combineA) {
    if (tempA.length == 0) {
      tempA.push(combineA[i]);
    } else {
      var lastCard = tempA[tempA.length - 1];
      var newCard = combineA[i];
      var diff =
        parseInt(lastCard.split("-")[1]) - parseInt(newCard.split("-")[1]);
      var matchSuit =
        lastCard.split("-")[0] == newCard.split("-")[0] ? true : false;
      // logger.info('getSeqs---A-------->>>>>>lastCard: '+lastCard+' newCard: '+newCard+' diff: '+diff+' matchSuit: '+matchSuit);
      if (matchSuit) {
        // if adjacent cards of the same suit

        if (diff == 0) {
          //logic for duplicates
          if (dTempA.length == 0) {
            dTempA.push(newCard);
          } else {
            var lastD = dTempA[dTempA.length - 1];
            var diffD =
              parseInt(lastD.split("-")[1]) - parseInt(newCard.split("-")[1]);
            // var matchD = (lastD.split('-')[0] == newCard.split('-')[0])?true:false;
            if (diffD == 1) {
              dTempA.push(newCard);
            } else {
              if (diffD <= jwArray.length + 1) {
                dTempA = dTempA.concat(jwArray.splice(0, diffD - 1));
                dTempA.push(newCard);
              } else {
                if (dTempA.length > 2) {
                  seqA.push(dTempA);
                } else if (dTempA.length == 2 && jwArray.length > 0) {
                  dTempA = dTempA.concat(jwArray.splice(0, 1));
                  seqA.push(dTempA);
                }
                dTempA = [];
                dTempA.push(newCard);
              }
            }
          }
        } else if (diff == 1) {
          //logic to push
          tempA.push(newCard);
        } else {
          if (diff <= jwArray.length + 1) {
            //have sufficient joker to fillup
            tempA = tempA.concat(jwArray.splice(0, diff - 1));

            tempA.push(newCard);
          } else {
            if (tempA.length > 2) {
              seqA.push(tempA);
            } else if (tempA.length == 2 && jwArray.length > 0) {
              tempA = tempA.concat(jwArray.splice(0, 1));
              seqA.push(tempA);
            } else {
            }
            if (dTempA.length > 2) {
              seqA.push(dTempA);
            } else if (dTempA.length == 2 && jwArray.length > 0) {
              dTempA = dTempA.concat(jwArray.splice(0, 1));
            } else {
              // logger.info('getSeqs--A----14--B--->>>>???');
            }
            tempA = [];
            dTempA = [];
            tempA.push(newCard);
          }
        }
      } else {
        //if adjacent cards of the different suits
        if (tempA.length > 2) {
          seqA.push(tempA);
        } else if (tempA.length == 2 && jwArray.length > 0) {
          tempA = tempA.concat(jwArray.splice(0, 1));
          seqA.push(tempA);
        } else {
          // logger.info('getSeqs--A----14--A-->>>>???');
        }
        if (dTempA.length > 2) {
          seqA.push(dTempA);
        } else if (dTempA.length == 2 && jwArray.length > 0) {
          dTempA = dTempA.concat(jwArray.splice(0, 1));
        } else {
          // logger.info('getSeqs--A----14--B--->>>>???');
        }

        tempA = [];
        dTempA = [];
        tempA.push(newCard);
      }
    }
  }
  if (tempA.length > 2) {
    seqA.push(tempA);
  } else if (tempA.length == 2 && jwArray.length > 0) {
    tempA = tempA.concat(jwArray.splice(0, 1));
    seqA.push(tempA);
  } else {
    // logger.info('getSeqs----A-------14-----A------->>>>>');
  }
  if (dTempA.length > 2) {
    seqA.push(dTempA);
  } else if (dTempA.length == 2 && jwArray.length > 0) {
    dTempA = dTempA.concat(jwArray.splice(0, 1));
  } else {
    // logger.info('getSeqs---A---14-----B------>>>>');
  }
  // logger.info('getSeqs------------>>>>>>seq: ',seq,' seqA: ',seqA);

  var remainCardsSum = cardsSum(_.difference(cards, _.flatten(seq)), wildCard);
  // logger.info('  combine: ',combine,' seq: ',seq,' difference: ',_.difference(cards,_.flatten(seq)));
  for (var j in seqA) {
    seqA[j] = seqA[j].toString().replace(/-14-/g, "-1-").split(",");
  }
  var remainACardsSum = cardsSum(
    _.difference(cards, _.flatten(seqA)),
    wildCard
  );
  // logger.info('combineA: ',combineA,' seqA: ',seqA,' difference: ',_.difference(cards,_.flatten(seqA)));

  // logger.info('remainCardsSum: ',remainCardsSum,' remainACardsSum: ',remainACardsSum);
  if (remainACardsSum < remainCardsSum) {
    // logger.info('getSeqs------------>>>>seqA: ',seqA);
    return seqA;
  } else {
    // logger.info('getSeqs----------->>> seq: ',seq);
    return seq;
  }
};
const getSets = (cards, wildCard) => {
  //old spec logic
  /* +-------------------------------------------------------------------+
      desc: returns sets from inputted cards
      i/p : cards = array of cards, wildCard = wildcard
      o/p : 2D array of cards containing sets sequences from inputted cards
       +-------------------------------------------------------------------+ */
  var jArray = getJCards(cards);
  var wArray = getWCards(cards, wildCard);

  var sets = [];
  var temp1 = [];
  var temp2 = [];
  var suitTrack = [];
  var wRank = parseInt(wildCard.split("-")[1]);
  var rank = [];
  var cwJ = _.difference(cards, jArray);
  var cwJSorted = sortCards(cwJ);

  for (var i in cwJSorted) {
    if (temp1.length == 0) {
      temp1.push(cwJSorted[i]);
      suitTrack.push(cwJSorted[i].split("-")[0]);
    } else {
      var lastTemp = temp1[temp1.length - 1];
      var newCard = cwJSorted[i];
      var matchRank =
        parseInt(lastTemp.split("-")[1]) == parseInt(newCard.split("-")[1])
          ? true
          : false;

      if (matchRank) {
        if (_.contains(suitTrack, newCard.split("-")[0])) {
          temp2.push(newCard);
          suitTrack.push(newCard.split("-")[0]);
        } else {
          temp1.push(newCard);
          suitTrack.push(newCard.split("-")[0]);
        }
      } else {
        if (temp1.length > 1) {
          if (parseInt(temp1[0].split("-")[1]) != wRank || temp1.length > 2) {
            rank.push(temp1);
          }
        }
        if (temp2.length > 1) {
          if (parseInt(temp2[0].split("-")[1]) != wRank || temp2.length > 2) {
            rank.push(temp2);
          }
        }

        temp1 = [];
        temp2 = [];
        suitTrack = [];
        temp1.push(newCard);
        suitTrack.push(newCard.split("-")[0]);
      }
    }
  }
  if (temp1.length > 1) {
    if (parseInt(temp1[0].split("-")[1]) != wRank || temp1.length > 2) {
      //if the sets form is of wildcards then only push if length > 2
      rank.push(temp1);
    }
  }
  if (temp2.length > 1) {
    if (parseInt(temp2[0].split("-")[1]) != wRank || temp2.length > 2) {
      //if the sets form is of wildcards then only push if length > 2
      rank.push(temp2);
    }
  }

  temp1 = [];
  temp2 = [];
  suitTrack = [];

  wArray = _.difference(wArray, _.flatten(rank));

  for (var j in rank) {
    if (rank[j].length >= 3) {
      sets.push(rank[j]);
    } else {
      if (jArray.length > 0) {
        rank[j].push(jArray.splice(0, 1)[0]);
        sets.push(rank[j]);
      } else if (wArray.length > 0) {
        rank[j].push(wArray.splice(0, 1)[0]);
        sets.push(rank[j]);
      }
    }
  }

  if (jArray.length > 0) {
    var wPart1 = removeDuplicates(wArray);
    var wPart2 = _.difference(wArray, wPart1);

    if (wPart1.length > 1) {
      wPart1.push(jArray.splice(0, 1)[0]);
      sets.push(wPart1);
    }
    if (wPart2.length > 1 && jArray.length > 0) {
      wPart2.push(jArray.splice(0, 1)[0]);
      sets.push(wPart2);
    }
  }

  return sets;
};
const combinations = (a, min, max, exSelf) => {
  //returns the array with the combinations of elements where a = array, min = minimum size of group. max = max size of group, exSelf = if true exclude the main array from result
  /* +-------------------------------------------------------------------+
      desc: returns the array with the combinations of array elements from array a
      i/p : a = array, min = minimum size of group, max = maximum size of groups, exSelf = true/false exclude a(main array)
      o/p : 2D arrray of all combinations of elements of array a, if exSelf the result won't contain main array
       +-------------------------------------------------------------------+ */
  function fn(n, src, got, all) {
    if (n == 0) {
      if (got.length > 0) {
        all[all.length] = got;
      }
      return;
    }
    for (var j = 0; j < src.length; j++) {
      fn(n - 1, src.slice(j + 1), got.concat([src[j]]), all);
    }
    return;
  }
  var all = [];
  var len = max ? max + 1 : a.length;
  for (var i = min; i < len; i++) {
    fn(i, a, [], all);
  }
  if (exSelf) {
    all = _.without(all, a);
  }
  all.push(a);
  return all;
};
const cardPoint = (card, wildCard) => {
  //count the cards point
  /* +-------------------------------------------------------------------+
      desc: returns the card point 
      i/p : card = card whose point to be count, wildCard = wildcard
      o/p : points of inputted card
       +-------------------------------------------------------------------+ */
  let DCScard = DifferCardSuit(card);
  let DCSwildCard = DifferCardSuit(wildCard);

  if (DCScard.suit == "j" || DCScard.rank == DCSwildCard.rank) {
    return 0;
  } else {
    if (
      DCScard.rank == 1 ||
      DCScard.rank == 11 ||
      DCScard.rank == 12 ||
      DCScard.rank == 13
    ) {
      return 10;
    } else {
      return DCScard.rank;
    }
  }
};
const cardsSum = (cards, wildCard) => {
  /* +-------------------------------------------------------------------+
      desc: returns total points of inputted cards
      i/p : cards = array of cards, wildCard = wildcard
      o/p : total points of cards (won't go beyind max deadwood points)
       +-------------------------------------------------------------------+ */
  const { MAX_DEADWOOD_PTS } = GetConfig();
  let sum = 0;
  for (let x in cards) {
    sum += cardPoint(cards[x], wildCard);
  }
  let maxDwd = MAX_DEADWOOD_PTS;
  if (sum > maxDwd) {
    return maxDwd;
  } else {
    return sum;
  }
};
const poolCardsSum = (cards, wildCard) => {
  /* +-------------------------------------------------------------------+
      desc: returns total points of inputted cards
      i/p : cards = array of cards, wildCard = wildcard
      o/p : total points of cards (won't go beyind max deadwood points)
       +-------------------------------------------------------------------+ */
  let sum = 0;
  const { MAX_DEADWOOD_PTS_POOL_61 } = GetConfig();

  for (let x in cards) {
    sum += cardPoint(cards[x], wildCard);
  }

  let maxDwd = MAX_DEADWOOD_PTS_POOL_61;
  if (sum > maxDwd) {
    return maxDwd;
  } else {
    return sum;
  }
};
const cardsValidPoints = (cards, wildCard) => {
  //cards = {pure :[[],....],seq:[[],....],set:[[],......],dwd:[....]}
  /* +-------------------------------------------------------------------+
    desc: returns total card points based on grouping of cards
    i/p : cards = {
        pure = 2D array of pure sequence
        seq = 2D array of impure sequence
        set = 2D arrray of sets
        dwd = array of deadwood	
        }, 
        wildCard = wildcard
    o/p : valid points of cards
     +-------------------------------------------------------------------+ */
  logger.info("cardsValidPoints----->>>>>cards: ", cards);
  var points = 0;

  if (
    (cards.pure.length > 0 && cards.seq.length > 0) ||
    cards.pure.length > 1
  ) {
    //means atleast 1 pure seq and atleast 1 seq or more than 1 pure sequence then count only dead wood points
    points = cardsSum(cards.dwd, wildCard);
  } else if (cards.pure.length > 0 && config.ONE_SEQUENCE_POINTS) {
    let allCards = cards.seq.concat(cards.set).concat(cards.dwd);
    points = cardsSum(_.flatten(allCards), wildCard);
  } else {
    //count points for all cards because not enough valid sequence
    let allCards = cards.pure
      .concat(cards.seq)
      .concat(cards.set)
      .concat(cards.dwd);
    points = cardsSum(_.flatten(allCards), wildCard);
  }
  return points;
};
const cardsAnalyser = (cards, wildCard) => {
  /* +-------------------------------------------------------------------+
      desc: returns object with cards grouping
      i/p : cards = array of cards, wildCard = wildcard
      o/p : object = {
          pure = 2D array of pure sequence
          seq = 2D array of impure sequence
          set = 2D array of sets
          dwd = array of deadwood	
          cardSum = valid cards points
          }
       +-------------------------------------------------------------------+ */
  let remains = _.clone(cards);

  let PURE = getPureSeqs(cards, wildCard);

  remains = _.difference(remains, _.flatten(PURE));

  let SEQ = getSeqs(remains, wildCard);

  remains = _.difference(remains, _.flatten(SEQ));

  let SET = getSets(remains, wildCard);

  remains = _.difference(remains, _.flatten(SET));
  let DWD = remains;
  let jwArray = getJWcards(DWD, wildCard);

  if (jwArray.length > 2) {
    // remaining jokers and wildCards were considered as impure seq
    SEQ.push(jwArray);
    DWD = _.difference(DWD, jwArray);
  } else if (jwArray.length == 2 && DWD.length > 2) {
    // if there are two jokers and any cards other than jokers or wildcards are there then make a seq using that
    let temp = [];
    DWD = _.difference(DWD, jwArray);

    temp = DWD.splice(0, 1);

    temp = temp.concat(jwArray);

    SEQ.push(temp);
  }

  if (SET.length > 0) {
    // if all cards in set are wildCards or jokers then make them as seq instead of set
    let temp = [];

    for (var i in SET) {
      let jwArrayTemp = getJWcards(SET[i], wildCard);
      if (SET[i].length == jwArrayTemp.length) {
        temp.push(SET[i]);
      }
    }

    for (let j in temp) {
      SET = removeArrayFrom2DArray(SET, temp[j]);
      SEQ.push(temp[j]);
    }
  }

  let group = { pure: PURE, seq: SEQ, set: SET, dwd: DWD };
  let obj = {
    pure: PURE,
    seq: SEQ,
    set: SET,
    dwd: DWD,
    cardSum: cardsValidPoints(group, wildCard),
  };

  return obj;
};
const optimize = (a, ss) => {
  //optimize the cards;   a = cards array,ss = flag check for set and sequence
  /* +-------------------------------------------------------------------+
      desc: returns 2D array of optimal cards 
      i/p : a = array of cards, ss = true/false flag for check whether to consider set or sequence
      o/p : 2D array of cards with optimise grouping
       +-------------------------------------------------------------------+ */
  logger.info("optimize------>>>>>a: ", a);
  var optimize = [];
  var flag = [];
  for (var f = 0; f < a.length; f++) {
    flag.push(0);
  }

  if (a.length == 1) {
    return a;
  }
  for (var i = a.length - 1; i >= 0; i--) {
    if (flag[i] == 0) {
      for (var j = i - 1; j >= 0; j--) {
        if (
          _.difference(a[i], a[j]).length > 0 &&
          _.difference(a[j], a[i]).length == 0
        ) {
          //means   a[j] is a subset of a[i];
          flag[j] = 1;

          if (flag[i] == 0) {
            // logger.info('optimize--jsi----i---->>>>>a[i]: ',a[i],' ----------a[j]: ',a[j]);
            optimize.push(a[i]); //the longer cards group  will be pushed
            flag[i] = 1;
          }
        } else if (
          _.difference(a[j], a[i]).length > 0 &&
          _.difference(a[i], a[j]).length == 0
        ) {
          //means   a[i] is a subset of a[j];
          flag[i] = 1;
          if (flag[j] == 0) {
            // logger.info('optimize--isj----j---->>>>>a[i]: ',a[i],' ----------a[j]: ',a[j]);
            optimize.push(a[j]); //the longer cards group will be pushed
            flag[j] = 1;
          }
        } else if (_.intersection(a[i], a[j]).length == 0) {
          //a[i] and a[j] are disjoint    //need to improve
          if (flag[i] == 0) {
            // logger.info('optimize--ixj----i---->>>>>a[i]: ',a[i],' ----------a[j]: ',a[j]);
            optimize.push(a[i]);
            flag[i] = 1;
          }
        } else {
          //means array are intersecting with each other		//need to improve
          if (ss) {
            flag[j] = 1;
            if (flag[i] == 0) {
              // logger.info('optimize--inj----i---->>>>>a[i]: ',a[i],' ----------a[j]: ',a[j]);
              optimize.push(a[i]);
              flag[i] = 1;
            }
          }
        }
      }
    }
    if (i == 0 && flag[i] == 0) {
      //last entry will be pushed if it is disjoin from all
      logger.info('optimize-------------->>>>>"last entry pushed!!!"');
      optimize.push(a[i]);
      flag[i] = 1;
    }
  }
  return optimize;
};
const cardsFormatter = (cards, wildCard) => {
  //formats cards;   i/p :  cards = [[],[],[],....]; o/p : obj = {pure: [[],[],....],seq:[[],[],...],set:[[],[],...],dwd:[.....]}
  /* +-------------------------------------------------------------------+
      desc: format the cards that are in 2D array format
      i/p : cards = 2D array of cards, wildCard = wildcard
      o/p : object = {
          PURE = 2D array of pure sequence
          SEQ = 2D array of impure sequence
          SET = 2D array of set
          DWD = array of deadwood cards
          }
       +-------------------------------------------------------------------+ */
  let PURE = [];
  let SEQ = [];
  let SET = [];
  let DWD = [];

  for (const element of cards) {
    if (isPure(element)) {
      PURE.push(element);
    } else if (isSeq(element, wildCard)) {
      SEQ.push(element);
    } else if (isSet(element, wildCard)) {
      SET.push(element);
    } else {
      DWD = DWD.concat(element);
    }
  }
  return { pure: PURE, seq: SEQ, set: SET, dwd: DWD };
};

/* new */
const getHighCardNew = (cards) => {
  /* +-------------------------------------------------------------------+
      desc: function to get high card index
      i/p : cards = array of cards
      o/p : high card
       +-------------------------------------------------------------------+ */
  if (cards && cards.length > 0) {
    logger.info('getHighCard---------->>>>"different suit"', cards);

    let high = cards[0].split("-"); //by default high card will be the first card

    for (let i = 1; i < cards.length; i++) {
      temp = cards[i].split("-");
      logger.info("getHighCard---------->>>>high: ", high, " temp: ", temp);
      if (
        (parseInt(high[1]) < parseInt(temp[1]) && parseInt(high[1]) != 1) ||
        parseInt(temp[1]) == 1
      ) {
        //low rank
        if (temp[1] == 1 && high[1] == 1) {
          if (temp[0] == "k") {
            high = temp;
          } else if (temp[0] == "c" && (high[0] == "f" || high[0] == "l")) {
            high = temp;
          } else if (temp[0] == "f" && high[0] == "l") {
            high = temp;
          }
        } else {
          high = temp;
        }
      } else if (parseInt(high[1]) == parseInt(temp[1])) {
        if (temp[0] == "k") {
          high = temp;
        } else if (temp[0] == "c" && (high[0] == "f" || high[0] == "l")) {
          high = temp;
        } else if (temp[0] == "f" && high[0] == "l") {
          high = temp;
        }
      }
    }
    high = high.join("-");

    return cards.indexOf(high);
  } else {
    logger.info('getHighCard:::::::::::::::::>>>>"high card not found"');
    return -1;
  }
};
/* old */
const getHighCard = (cards) => {
  /* +-------------------------------------------------------------------+
      desc: function to get high card index
      i/p : cards = array of cards
      o/p : high card
       +-------------------------------------------------------------------+ */
  if (cards && cards.length > 0) {
    logger.info('getHighCard---------->>>>"different suit"', cards);

    let high = cards[0].split("-"); //by default high card will be the first card

    for (let i = 1; i < cards.length; i++) {
      temp = cards[i].split("-");
      logger.info("getHighCard---------->>>>high: ", high, " temp: ", temp);
      if (
        (parseInt(high[1]) < parseInt(temp[1]) && parseInt(high[1]) != 1) ||
        parseInt(temp[1]) == 1
      ) {
        //low rank
        if (temp[1] == 1 && high[1] == 1) {
          if (temp[0] == "k") {
            high = temp;
          } else if (temp[0] == "l" && (high[0] == "c" || high[0] == "f")) {
            high = temp;
          } else if (temp[0] == "c" && high[0] == "f") {
            high = temp;
          }
        } else {
          high = temp;
        }
      } else if (parseInt(high[1]) == parseInt(temp[1])) {
        if (temp[0] == "k") {
          high = temp;
        } else if (temp[0] == "l" && (high[0] == "c" || high[0] == "f")) {
          high = temp;
        } else if (temp[0] == "c" && high[0] == "f") {
          high = temp;
        }
      }
    }
    high = high.join("-");

    return cards.indexOf(high);
  } else {
    logger.info('getHighCard:::::::::::::::::>>>>"high card not found"');
    return -1;
  }
};
const getLowCard = (cards) => {
  /* +-------------------------------------------------------------------+
      desc: function to get low card index
      i/p : cards = array of cards
      o/p : low card
       +-------------------------------------------------------------------+ */
  if (cards && cards.length > 0) {
    let low = cards[0].split("-");
    for (let i = 1; i < cards.length; i++) {
      temp = cards[i].split("-");
      logger.info("getLowCard------------------>>>>low:", low, " temp: ", temp);
      if (low[0] == temp[0]) {
        logger.info('getLowCard------------->>>>"same suit"');
        if (
          (parseInt(low[1]) > parseInt(temp[1]) && parseInt(temp[1]) != 1) ||
          parseInt(low[1]) == 1
        ) {
          //high rank
          logger.info('getLowCard----xxxxxx---same-->>>"temp card is low"');
          low = temp;
        }
      } else {
        logger.info('getLowCard------------->>>>>"different suit"');
        if (low[0] == "k") {
          //means low card is spade i.e trumpCard
          logger.info(
            'getLowCard-----xxxxx----diff---xxxx-->>>>"low card is trumpCard"'
          );
          low = temp;
        } else {
          logger.info(
            'getLowCard------------->>>>"different suit and low card is not trump"'
          );
          if (
            temp[0] != "k" &&
            ((parseInt(low[1]) > parseInt(temp[1]) && parseInt(temp[1]) != 1) ||
              parseInt(low[1]) == 1)
          ) {
            logger.info(
              'getLowCard------xxxxx----diff--->>>>>"temp card is low"'
            );
            low = temp;
          }
        }
      }
    }
    low = low.join("-");
    return cards.indexOf(low);
  } else {
    logger.info('getLowCard:::::::::::::::"low card not found"');
    return -1;
  }
};
const getValidCards = (cards, firstCard, tds) => {
  /* +-------------------------------------------------------------------+
      desc: function to get valid card to throw
      i/p : cards = array of cards,firstCards = first cards that is thrown on table,tds = 1/0 card throw other suit cards if current suit cards not found
      o/p : array of valid cards to throw
       +-------------------------------------------------------------------+ */
  logger.info(
    "getValidCards----------->>>>cards: ",
    cards,
    " firstCard: ",
    firstCard
  );
  let initCard = firstCard.split("-");
  let validCards = [];
  let suitCount = 0;
  for (let i in cards) {
    let temp = cards[i].split("-");
    if (initCard[0] == temp[0] || temp[0] == "k") {
      if (initCard[0] == temp[0]) {
        suitCount++;
      }
      validCards.push(cards[i]);
    }
  }
  logger.info("getValidCards-----111-------->>>>>validCards: ", validCards);

  if (validCards.length == 0) {
    //means player has no cards to throw
    validCards = cards;
  } else {
    if (suitCount == 0 && tds == 1) {
      //means player has cards containing trump cards but not suit cards
      validCards = cards;
    }
  }
  logger.info("getValidCards-----222-------->>>>>validCards: ", validCards);
  return validCards;
};
const getTableHighCard = (cards) => {
  /* +-------------------------------------------------------------------+
      desc: function to get high card index from table
      i/p : cards = array of cards
      o/p : high card
       +-------------------------------------------------------------------+ */
  if (cards && cards.length > 0) {
    let initCard = cards[0].split("-");
    let high = cards[0].split("-");

    for (let i = 1; i < cards.length; i++) {
      temp = cards[i].split("-");
      logger.info(
        "getTableHighCard---------->>>>high: ",
        high,
        " temp: ",
        temp
      );
      if (initCard[0] == temp[0] || temp[0] == "k") {
        if (high[0] == temp[0]) {
          //means same suit
          logger.info('getTableHighCard---------->>>>"same suit"');
          if (
            (parseInt(high[1]) < parseInt(temp[1]) && parseInt(high[1]) != 1) ||
            parseInt(temp[1]) == 1
          ) {
            //low rank
            logger.info(
              'getTableHighCard---xxxxx--same---xxxxx--->>>>"temp card is high"'
            );
            high = temp;
          }
        } else {
          //different suit
          logger.info('getTableHighCard---------->>>>"different suit"');

          if (temp[0] == "k") {
            //means temp cards is spade i.e trumpCard
            logger.info(
              'getTableHighCard--xxxx--diff---xxxxx--->>>>"temp card is trumpCard"'
            );
            high = temp;
          }
        }
      }
    }
    high = high.join("-");

    return cards.indexOf(high);
  } else {
    logger.info('getTableHighCard------------>>>>"no high cards found"');
    return -1;
  }
};

const removeArrayFrom2DArray = (array2D, array1D) => {
  /* +-------------------------------------------------------------------+
    desc: remove whole array from 2D array
    i/p: array2D = 2d array from which array is to be removed, array1D = 1D array
    o/p: returns formatted currency 
  +-------------------------------------------------------------------+ */

  for (let i = 0; i < array2D.length; i++) {
    if (_.isEqual(array2D[i], array1D)) {
      array2D.splice(i, 1);
      break;
    }
  }
  return array2D;
};

const setCloseDeckCard = (cDeck, cards, wildCard) => {
  // var analysedUserCards = cardsAnalyser(cards,wildCard);
  const godBotClass = require("./godBot.class");

  let analyzedUserCards = godBotClass.GetSortedCard(cards, wildCard);

  let deadwood = analyzedUserCards.dwd;

  if (deadwood.length == 0) {
    return cDeck[0];
  } else {
    let pure = getPureSeqs(cards, wildCard);
    if (pure.length == 0) {
      let cSeq = getCSeqs(cards, wildCard);
      if (cSeq.length > 0) {
        for (let m1 in cSeq) {
          let allVersions1 = getCSeq3rcd(cSeq[m1], wildCard);
          for (let m2 in allVersions1) {
            if (_.contains(cDeck, allVersions1[m2])) {
              return allVersions1[m2];
            }
          }
        }
      }
    }

    let cSeqs = getCSeqs(deadwood, wildCard);
    if (cSeqs.length > 0) {
      for (let k1 in cSeqs) {
        let allVersions1 = getCSeq3rcd(cSeqs[k1], wildCard);
        for (let k2 in allVersions1) {
          if (_.contains(cDeck, allVersions1[k2])) {
            return allVersions1[k2];
          }
        }
      }
    }

    let cSets = getCSets(deadwood);
    if (cSets.length > 0) {
      for (let k1 in cSets) {
        let allVersions1 = getCSet3rcd(cSets[k1], wildCard);
        for (let k2 in allVersions1) {
          if (_.contains(cDeck, allVersions1[k2])) {
            return allVersions1[k2];
          }
        }
      }
    }

    let wArray = getJWcards(cDeck, wildCard);
    if (typeof wArray != "undefined" && wArray.length > 0) {
      return wArray[0];
    } else {
      return cDeck[0];
    }
  }
};

module.exports = {
  DifferCardSuit,
  sortSequences,
  cardsValidPoints,
  sortCards,
  classifyCards,
  cardsSum,
  getJWcards,
  getCSeqs,
  getCSets,
  getCSeq3cd,
  getCardsWithoutJW,
  getCSet3cd,
  cardsAnalyser,
  poolCardsSum,
  cardsFormatter,
  setCloseDeckCard,
};

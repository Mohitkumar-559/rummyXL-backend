const PURE = 0,
  IMPURE = 1,
  SET = 2;

const _ = require("underscore");
const cardCommonClass = require("./cardCommon.class");

const GetSortedCard = (cards, wildCard) => {
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

  let userCard = _.clone(cards);
  let foundPureList = [];
  let foundImpureList = [];
  let foundSetList = [];

  let PURES = [];
  let SEQS = [];
  let SETS = [];
  let DWDS = [];

  //--------CHECK PURE COUNTINUSLY IF FOUND-----------------------------------------------------------------------------------

  for (let maxLoop = 0; maxLoop < 6; maxLoop++) {
    let pureList = getPureSequence(userCard, wildCard); //got pure with 3 cards
    if (pureList.length >= 3) {
      foundPureList.push(pureList);
      userCard = _.difference(userCard, pureList);
    } else {
      break;
    }
  }

  //--------------------------------------------------------------------------------------------------------------------------

  //--------CHECK ONE IMPURE 3 CARD LIST 1ST TIME-----------------------------------------------------------------------------
  let impureList = getImpureSequence(userCard, wildCard); //got 3 cards impure
  if (impureList.length >= 3) {
    foundImpureList.push(impureList);
    userCard = _.difference(userCard, impureList);
  }

  //--------------------------------------------------------------------------------------------------------------------------

  //--------FIND BEST RESULT FROM IMPURE AND SET ONE TIME---------------------------------------------------------------------

  for (let maxLoop = 0; maxLoop < 6; maxLoop++) {
    let bestList = getBestFromThree(userCard, wildCard);
    if (bestList == null) {
      break;
    } else if (bestList.groupType == IMPURE) {
      foundImpureList.push(bestList.cardObjectList);
      userCard = _.difference(userCard, bestList.cardObjectList);
    } else if (bestList.groupType == SET) {
      foundSetList.push(bestList.cardObjectList);
      userCard = _.difference(userCard, bestList.cardObjectList);
    }
  }
  ////--------------------------------------------------------------------------------------------------------------------------

  //------------ADD EXTRA IN PURE LIST----------------------------------------------------------------------------------------

  for (let i = 0; i < foundPureList.length; i++) {
    let len = foundPureList[i].length;
    foundPureList[i] = addRemainingInPureList(
      foundPureList[i],
      userCard,
      wildCard
    );
    if (len != foundPureList[i].length) {
      i--;
    }
    userCard = _.difference(userCard, foundPureList[i]);
  }
  //--------------------------------------------------------------------------------------------------------------------------

  //------------ADD EXTRA IN IMPURE LIST--------------------------------------------------------------------------------------

  let getImPureWithExtraCard = [];
  let checkedImpure = [];
  let newImpure = [];

  for (const element of foundImpureList) {
    let checkingList = element;

    getImPureWithExtraCard = addRemainingInImpureList(
      checkingList,
      userCard,
      wildCard
    );

    checkedImpure.push(checkingList);
    newImpure.push(getImPureWithExtraCard.foundList);
    userCard = getImPureWithExtraCard.userRemainCard;
    userCard = _.difference(userCard, getImPureWithExtraCard.foundList);
  }

  for (let i in checkedImpure) {
    foundImpureList = removeArrayFrom2DArray(foundImpureList, checkedImpure[i]);
  }

  foundImpureList = foundImpureList.concat(newImpure);

  //--------------------------------------------------------------------------------------------------------------------------

  //--------CHECK ONE SET 3 CARD LIST 1ST TIME-----------------------------------------------------------------------------
  for (let maxLoop = 0; maxLoop < 6; maxLoop++) {
    let setList = getSet(userCard, wildCard);

    if (setList.length >= 3) {
      foundSetList.push(setList);
      userCard = _.difference(userCard, setList);
    } else {
      break;
    }
  }
  //--------------------------------------------------------------------------------------------------------------------------

  //-----------highest impure with 2 joker--------------------------------------------------------------------------------------
  let moreImpure = makeImpureWithHighestCard(userCard, wildCard);

  for (const element of moreImpure) {
    foundImpureList.push(element);
    userCard = _.difference(userCard, element);
  }

  ////-------------------------------------------------------------------------------------------------------------------------
  let foundPureList1 = [];
  let foundImpureList1 = [];
  for (let i = 0; i < foundPureList.length; i++) {
    foundPureList[i] = cardCommonClass.sortSequences(
      foundPureList[i],
      wildCard
    );
    foundPureList1.push(foundPureList[i]);
  }

  for (let j = 0; j < foundImpureList.length; j++) {
    foundImpureList[j] = cardCommonClass.sortSequences(
      foundImpureList[j],
      wildCard
    );
    foundImpureList1.push(foundImpureList[j]);
  }

  PURES = foundPureList1;
  SEQS = foundImpureList1;
  SETS = foundSetList;
  DWDS = userCard;

  let group = { pure: PURES, seq: SEQS, set: SETS, dwd: DWDS };

  let obj = {
    pure: PURES,
    seq: SEQS,
    set: SETS,
    dwd: DWDS,
    cardSum: cardCommonClass.cardsValidPoints(group, wildCard),
  };

  return obj;
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
const getPureSequence = (cards, wildCard) => {
  /* +-------------------------------------------------------------------+
            desc: returns pure sequence
            i/p : cards = array of cards, wildCard = wildcard
            o/p : pure sequence array
           +-------------------------------------------------------------------+ */

  let Cardlist = cardCommonClass.sortCards(cards, false).reverse();

  let classify = cardCommonClass.classifyCards(Cardlist);

  let HList = getThreeCardPure(classify.l);
  let SList = getThreeCardPure(classify.k);
  let CList = getThreeCardPure(classify.f);
  let DList = getThreeCardPure(classify.c);
  //Sum of Pure Sequals all 4 colour
  let Ssum = cardCommonClass.cardsSum(SList, wildCard);
  let Hsum = cardCommonClass.cardsSum(HList, wildCard);
  let Dsum = cardCommonClass.cardsSum(DList, wildCard);
  let Csum = cardCommonClass.cardsSum(CList, wildCard);

  //Sorting in Pure Sequals in highest in all 4 colour
  let sortings = [];

  sortings.push({ cardList: SList, sum: Ssum });
  sortings.push({ cardList: HList, sum: Hsum });
  sortings.push({ cardList: DList, sum: Dsum });
  sortings.push({ cardList: CList, sum: Csum });

  //return highest first sorting Sequence
  sortings.sort(function (a, b) {
    return b.sum - a.sum;
  });

  return sortings[0].cardList;
};
const getImpureSequence = (cards, wildCard) => {
  /* +-------------------------------------------------------------------+
            desc: returns pure sequence
            i/p : cards = array of cards, wildCard = wildcard
            o/p : returns impure sequence
           +-------------------------------------------------------------------+ */
  //Short card decending order

  let sortedCards = cardCommonClass.sortCards(cards, false).reverse();

  let H_color = [];
  let S_color = [];
  let C_color = [];
  let D_color = [];
  let Joker = [];

  //Short card Colorwise
  for (const element of sortedCards) {
    if (
      element.split("-")[0] == "j" ||
      parseInt(element.split("-")[1]) == parseInt(wildCard.split("-")[1])
    ) {
      Joker.push(element);
    } else if (element.split("-")[0] == "l") {
      H_color.push(element);
    } else if (element.split("-")[0] == "c") {
      D_color.push(element);
    } else if (element.split("-")[0] == "k") {
      S_color.push(element);
    } else if (element.split("-")[0] == "f") {
      C_color.push(element);
    }
  }

  let gap = 1;
  let selectedItem = null;
  let sortings = [];

  while (gap <= 3) {
    let HimpureList2 = getTwoCardImpure(H_color, gap);

    let SimpureList2 = getTwoCardImpure(S_color, gap);

    let CimpureList2 = getTwoCardImpure(C_color, gap);

    let DimpureList2 = getTwoCardImpure(D_color, gap);

    let Hsum2 = cardCommonClass.cardsSum(HimpureList2, wildCard);
    let Ssum2 = cardCommonClass.cardsSum(SimpureList2, wildCard);
    let Csum2 = cardCommonClass.cardsSum(CimpureList2, wildCard);
    let Dsum2 = cardCommonClass.cardsSum(DimpureList2, wildCard);

    let tmpGap = gap - 1;

    if (HimpureList2.length >= 2) {
      sortings.push({ cardList: HimpureList2, sum: Hsum2, gap: tmpGap });
      H_color = _.difference(H_color, HimpureList2);
    }

    if (SimpureList2.length >= 2) {
      sortings.push({ cardList: SimpureList2, sum: Ssum2, gap: tmpGap });
      S_color = _.difference(S_color, SimpureList2);
    }

    if (CimpureList2.length >= 2) {
      sortings.push({ cardList: CimpureList2, sum: Csum2, gap: tmpGap });
      C_color = _.difference(C_color, CimpureList2);
    }

    if (DimpureList2.length >= 2) {
      sortings.push({ cardList: DimpureList2, sum: Dsum2, gap: tmpGap });
      D_color = _.difference(D_color, DimpureList2);
    }

    gap++;

    let chk = gap <= 2 ? 1 : gap;
    if (chk > Joker.length) {
      break;
    }

    if (
      HimpureList2.length >= 2 ||
      SimpureList2.length >= 2 ||
      CimpureList2.length >= 2 ||
      DimpureList2.length >= 2
    ) {
      gap--;
    }
  }

  sortings.sort(function (a, b) {
    return b.sum - a.sum;
  });

  if (sortings.length > 0 && sortings[0].cardList.length >= 2) {
    selectedItem = sortings[0];
  }

  //check Joker in the Joker array list
  if (selectedItem != null && selectedItem.cardList.length >= 2) {
    gap = selectedItem.gap;

    if (gap <= 0) {
      gap = 1;
    }

    if (Joker.length >= gap) {
      for (let i = 0; i < gap; i++) {
        selectedItem.cardList.push(Joker[i]);
      }

      selectedItem.cardList = cardCommonClass.sortCards(
        selectedItem.cardList,
        false
      );

      return selectedItem.cardList;
    } else {
      return [];
    }
  } else {
    return [];
  }
};
const getBestFromThree = (cards, wildCard) => {
  /* +-------------------------------------------------------------------+
            desc: returns object containg best among impure and set
            i/p : cards = array of cards, wildCard = wildcard
            o/p : obj = {
                cardObjectList = array of impure sequence or set,
                sum = sum of cards point,
                groupType =  code IMPURE/SET
            }
           +-------------------------------------------------------------------+ */
  //CHECK ONE IMPURE 3 CARD LIST

  let impureList = getImpureSequence(cards, wildCard); //got highest seq
  //CHECK ONE SET 3 CARD LIST
  let setList = getSet(cards, wildCard); //got highest set

  let impureSequenceSum = cardCommonClass.cardsSum(impureList, wildCard);
  let setSum = cardCommonClass.cardsSum(setList, wildCard);

  let sortingsPure = [];

  if (impureList.length >= 3) {
    let impure1 = {
      cardObjectList: impureList,
      sum: impureSequenceSum,
      groupType: IMPURE,
    };
    sortingsPure.push(impure1);
  }

  if (setList.length >= 3) {
    let set1 = { cardObjectList: setList, sum: setSum, groupType: SET };
    sortingsPure.push(set1);
  }

  if (sortingsPure.length >= 2) {
    sortingsPure.sort(function (a, b) {
      return b.sum - a.sum;
    });
  }

  let bestList = null;

  if (sortingsPure.length > 0) {
    bestList = sortingsPure[0];
  }

  return bestList;
};
const addRemainingInPureList = (targetPureList, cards, wildCard) => {
  /* +-------------------------------------------------------------------+
            desc: returns array of pure sequence
            i/p : targetPureList = array in which to add new card to form a pure ,cards = array of cards, wildCard = wildcard
            o/p : array of pure sequence
           +-------------------------------------------------------------------+ */
  const Joker = [];

  let userCardListNew = _.clone(cards);

  for (let i = 0; i < userCardListNew.length; i++) {
    if (userCardListNew[i].split("-")[0] == "j") {
      Joker.push(userCardListNew[i]);
      userCardListNew = _.without(userCardListNew, userCardListNew[i]);
      i--;
    }
  }

  targetPureList = cardCommonClass.sortCards(targetPureList, false).reverse();

  let firstCard = targetPureList[0];
  let lastCard = targetPureList[targetPureList.length - 1];
  let firstAdded = false;
  let lastAdded = false;

  if (parseInt(firstCard.split("-")[1]) != 13) {
    let ind = containsCardNoType(
      userCardListNew,
      parseInt(firstCard.split("-")[1]) + 1,
      firstCard.split("-")[0]
    );

    if (
      ind != -1 &&
      firstCard.split("-")[0] == userCardListNew[ind].split("-")[0]
    ) {
      targetPureList.push(userCardListNew[ind]);

      userCardListNew = _.without(userCardListNew, userCardListNew[ind]);
      cards = _.without(cards, cards[ind]);
      firstAdded = true;
    }
  } else {
    if (parseInt(lastCard.split("-")[1]) != 1) {
      let ind = containsCardNoType(userCardListNew, 1, lastCard.split("-")[0]);
      if (
        ind != -1 &&
        lastCard.split("-")[0] == userCardListNew[ind].split("-")[0]
      ) {
        targetPureList.push(userCardListNew[ind]);
        userCardListNew = _.without(userCardListNew, userCardListNew[ind]);
        cards = _.without(cards, cards[ind]);
        firstAdded = true;
      }
    }
  }

  if (!firstAdded) {
    if (
      parseInt(lastCard.split("-")[1]) == 1 &&
      parseInt(targetPureList[targetPureList.length - 2].split("-")[1]) != 2
    ) {
      lastCard = targetPureList[targetPureList.length - 2];
    }

    let ind = containsCardNoType(
      userCardListNew,
      parseInt(lastCard.split("-")[1]) - 1,
      lastCard.split("-")[0]
    );

    if (
      ind != -1 &&
      lastCard.split("-")[0] == userCardListNew[ind].split("-")[0]
    ) {
      targetPureList.push(userCardListNew[ind]);
      // userCardListNew = removeArrayFrom2DArray(
      //   userCardListNew,
      //   userCardListNew[ind]
      // );
      // cards = _.without(cards, cards[ind]);
      // lastAdded = true;
    }
  }

  return targetPureList;
};
const addRemainingInImpureList = (targetImpure, userRemainCard, wildCard) => {
  /* +-------------------------------------------------------------------+
            desc: returns array of impure sequence
            i/p : targetPureList = array in which to add new card to form a pure ,userRemainCard = array of cards, wildCard = wildcard
            o/p : array of impure sequence
           +-------------------------------------------------------------------+ */
  let targetNormalList = [];
  let targetJokerList = [];

  let userNormalList = [];
  let userJokerList = [];

  for (const element of targetImpure) {
    if (
      element.split("-")[0] == "j" ||
      parseInt(element.split("-")[1]) == parseInt(wildCard.split("-")[1])
    ) {
      targetJokerList.push(element);
    } else {
      targetNormalList.push(element);
    }
  }

  targetNormalList = cardCommonClass
    .sortCards(targetNormalList, false)
    .reverse();

  for (const element of userRemainCard) {
    if (
      element.split("-")[0] == "j" ||
      parseInt(element.split("-")[1]) == parseInt(wildCard.split("-")[1])
    ) {
      userJokerList.push(element);
    } else {
      userNormalList.push(element);
    }
  }

  userJokerList = userJokerList.concat(targetJokerList);

  let foundList = _.clone(targetNormalList);
  let tmpList = _.clone(targetNormalList); // only for gap calculation

  foundList = cardCommonClass.sortCards(foundList, false).reverse();
  tmpList = cardCommonClass.sortCards(tmpList, false).reverse();

  let ind1 = containsCardNo(tmpList, 1);
  let ind2 = containsCardNo(tmpList, 2);
  let ind3 = containsCardNo(tmpList, 3);
  let ind4 = containsCardNo(tmpList, 4);

  if (ind1 != -1 && ind2 == -1 && ind3 == -1 && ind4 == -1) {
    let tempCard = tmpList[ind1];

    tmpList = _.without(tmpList, tmpList[ind1]);

    tmpList.splice(0, 0, tempCard);
  }
  let gap = 1;
  let needToAddJoker = 0;
  for (let i = 0; i < tmpList.length - 1; i++) {
    let cc = parseInt(tmpList[i].split("-")[1]);
    cc = i == 0 && cc == 1 ? 14 : cc;
    let a = cc - parseInt(tmpList[i + 1].split("-")[1]) - 1;

    if (a >= 1) {
      needToAddJoker += a;
    }
  }

  let needToBreak = false;
  if (targetNormalList.length >= 1) {
    while (true) {
      foundList = cardCommonClass.sortCards(foundList, false).reverse();
      let first = foundList[0];
      let req = parseInt(first.split("-")[1]) + (gap <= 0 ? 1 : gap);

      if (req == 14) {
        req = 1;
      } else if (req > 14) {
        break;
      }

      let index = containsCardNoType(userNormalList, req, first.split("-")[0]);

      if (
        containsCardNoType(foundList, req, first.split("-")[0]) == -1 &&
        index != -1
      ) {
        foundList.push(userNormalList[index]);

        userNormalList = _.without(userNormalList, userNormalList[index]);

        needToAddJoker += gap == 2 ? 1 : gap <= 1 ? 0 : gap;
        gap = 1;
        needToBreak = false;
      } else {
        gap++;
      }

      let gapCheck = gap - 1;
      gapCheck = gapCheck <= 2 ? 1 : gapCheck;

      if (
        needToBreak ||
        needToAddJoker >= userJokerList.length ||
        gapCheck > userJokerList.length
      ) {
        break;
      }

      needToBreak = gap >= 2;
    }

    gap = 1;
    needToBreak = false;

    if (needToAddJoker < userJokerList.length) {
      while (true) {
        foundList = cardCommonClass.sortCards(foundList, false).reverse();

        let first = foundList[foundList.length - 1];
        if (
          foundList.length >= 2 &&
          parseInt(first.split("-")[1]) == 1 &&
          containsCardNoType(foundList, 2, first.split("-")[0]) == -1
        ) {
          first = foundList[foundList.length - 2];
        }

        let req = parseInt(first.split("-")[1]) - (gap <= 0 ? 1 : gap);

        let index = containsCardNoType(
          userNormalList,
          req,
          first.split("-")[0]
        );

        if (
          containsCardNoType(foundList, req, first.split("-")[0]) == -1 &&
          index != -1
        ) {
          foundList.push(userNormalList[index]);

          userNormalList = _.without(userNormalList, userNormalList[index]);

          needToAddJoker += gap == 2 ? 1 : gap <= 1 ? 0 : gap;
          gap = 1;
          needToBreak = false;
        } else {
          gap++;
        }

        let gapCheck = gap - 1;
        gapCheck = gapCheck <= 2 ? 1 : gapCheck;

        if (
          needToBreak ||
          needToAddJoker >= userJokerList.length ||
          gapCheck > userJokerList.length
        ) {
          break;
        }
        needToBreak = gap >= 2;
      }
    }

    for (let i = 0; i < needToAddJoker; i++) {
      foundList.push(userJokerList[i]);
    }

    userJokerList = _.difference(userJokerList, foundList);

    userRemainCard = [];
    userRemainCard = userRemainCard.concat(userJokerList);
    userRemainCard = userRemainCard.concat(userNormalList);
  }

  if (foundList.length >= 3) {
    return { foundList: foundList, userRemainCard: userRemainCard };
  } else {
    return { foundList: targetImpure, userRemainCard: userRemainCard };
  }
};
const getSet = (cardList, wildCard) => {
  /* +-------------------------------------------------------------------+
            desc: returns array of set
            i/p : cardList = array of cards, wildCard = wildCard
            o/p : array set
           +-------------------------------------------------------------------+ */
  cardList = cardCommonClass.sortCards(cardList, false).reverse();

  let all_color = [];
  let Joker = [];

  //Short card Colorwise
  for (const element of cardList) {
    if (
      element.split("-")[0] == "j" ||
      parseInt(element.split("-")[1]) == wildCard.split("-")[1]
    ) {
      Joker.push(element);
    } else if (element.split("-")[0] != "j") {
      all_color.push(element);
    }
  }
  let all_Color4Set = getSetCardList(all_color, 4);
  all_color = _.difference(all_color, all_Color4Set);
  let all_Color3Set = getSetCardList(all_color, 3);
  all_color = _.difference(all_color, all_Color3Set);
  let all_Color2Set = getSetCardList(all_color, 2);
  all_color = _.difference(all_color, all_Color2Set);

  let set4 = cardCommonClass.cardsSum(all_Color4Set, wildCard);
  let set3 = cardCommonClass.cardsSum(all_Color3Set, wildCard);
  let set2 = cardCommonClass.cardsSum(all_Color2Set, wildCard);

  let sortings = [];

  sortings.push({ cardObjectList: all_Color4Set, sum: set4 });
  sortings.push({ cardObjectList: all_Color3Set, sum: set3 });
  sortings.push({ cardObjectList: all_Color2Set, sum: set2 });

  sortings.sort(function (a, b) {
    return b.sum - a.sum;
  });

  let resultList = [];
  if (Joker.length <= 0) {
    for (const element of sortings) {
      if (element.cardObjectList.length >= 3) {
        resultList = element.cardObjectList;
        break;
      }
    }
  } else {
    if (sortings[0].cardObjectList.length == 2) {
      sortings[0].cardObjectList.push(Joker[0]);
    }
    resultList = sortings[0].cardObjectList;
  }

  return resultList;
};
const makeImpureWithHighestCard = (userCardList, wildCard) => {
  /* +-------------------------------------------------------------------+
            desc: returns 2d array of impure sequence
            i/p : userCardList = array of cards, wildCard = wildCard
            o/p : 2d array of impure sequence
           +-------------------------------------------------------------------+ */
  let normalList = [];
  let jokerList = [];

  for (const element of userCardList) {
    if (
      element.split("-")[0] == "j" ||
      parseInt(element.split("-")[1]) == parseInt(wildCard.split("-")[1])
    ) {
      jokerList.push(element);
    } else {
      normalList.push(element);
    }
  }

  normalList = cardCommonClass.sortCards(normalList, false).reverse();

  let impureList = [];
  while (normalList.length > 0 && jokerList.length >= 2) {
    let foundList = [];
    let ind = containsCardNo(normalList, 1);
    if (ind != -1) {
      foundList.push(normalList[ind]);
      normalList = _.without(normalList, normalList[ind]);
    } else {
      foundList.push(normalList[0]);

      normalList = _.without(normalList, normalList[0]);
    }

    foundList.push(jokerList[0]);
    foundList.push(jokerList[1]);

    jokerList.splice(0, 2);

    if (foundList.length >= 3) {
      impureList.push(foundList);
    }
  }
  return impureList;
};
const getThreeCardPure = (cardList) => {
  /* +-------------------------------------------------------------------+
            desc: returns 2d array of impure sequence
            i/p : userCardList = array of cards, wildCard = wildCard
            o/p : 2d array of impure sequence
           +-------------------------------------------------------------------+ */
  let foundList = [];
  for (const element of cardList) {
    let current = parseInt(element.split("-")[1]);
    let next = current + 1;
    let prev = current - 1;

    if (next == 14) {
      next = 1;
    }
    let nIndex = containsCardNo(cardList, next);
    let pIndex = containsCardNo(cardList, prev);

    if (nIndex != -1 && pIndex != -1) {
      foundList.push(cardList[pIndex]);
      foundList.push(element);
      foundList.push(cardList[nIndex]);
      break;
    }
  }

  return foundList;
};
const getTwoCardImpure = (cardList, gapCount) => {
  /* +-------------------------------------------------------------------+
            desc: returns array of impure sequence containing 2 cards
            i/p : cardList = array of cards, gapCount = gap count
            o/p :  array of impure sequence containing 2 cards
           +-------------------------------------------------------------------+ */
  cardList = cardCommonClass.sortCards(cardList, false).reverse();

  let foundList = [];
  for (const element of cardList) {
    let current = parseInt(element.split("-")[1]);
    let next = current + gapCount;
    let prev = current - gapCount;

    if (next == 14) {
      next = 1;
    }

    let nIndex = containsCardNo(cardList, next);
    let pIndex = containsCardNo(cardList, prev);

    if (nIndex != -1) {
      foundList.push(element);
      foundList.push(cardList[nIndex]);

      break;
    } else if (pIndex != -1) {
      foundList.push(cardList[pIndex]);
      foundList.push(element);
      break;
    }
  }

  return foundList;
};
const getSetCardList = (cardsList, cardCount) => {
  /* +-------------------------------------------------------------------+
            desc: returns array of set  cards
            i/p : cardList = array of cards, gapCount = gap count
            o/p :  array of set  cards
           +-------------------------------------------------------------------+ */
  let foundList = [];
  for (let i = 0; i < cardsList.length; i++) {
    foundList = [];
    let current = cardsList[i];

    foundList.push(current);
    for (let j = i; j < cardsList.length; j++) {
      if (
        current.split("-")[0] != cardsList[j].split("-")[0] &&
        parseInt(current.split("-")[1]) == parseInt(cardsList[j].split("-")[1])
      ) {
        let needToAdd = cardsList[j];
        let canAdd = true;
        for (const element of foundList) {
          if (
            needToAdd.split("-")[0] == element.split("-")[0] &&
            parseInt(needToAdd.split("-")[1]) == parseInt(element.split("-")[1])
          ) {
            canAdd = false;
          }
        }

        if (canAdd) {
          foundList.push(cardsList[j]);
          if (foundList.length >= 4 || foundList.length >= cardCount) {
            break;
          }
        }
      }
    }

    if (foundList.length >= cardCount) {
      break;
    }
  }

  if (foundList.length <= 1) {
    foundList = [];
  }

  return foundList;
};
const containsCardNo = (cards, number) => {
  /* +-------------------------------------------------------------------+
            desc: returns index of card containg given number
            i/p : cards = array of cards, number = card rank
            o/p : index of given card
           +-------------------------------------------------------------------+ */
  for (let i = 0; i < cards.length; i++) {
    if (parseInt(cards[i].split("-")[1]) == number) {
      return i;
    }
  }
  return -1;
};
const containsCardNoType = (cards, number, type) => {
  /* +-------------------------------------------------------------------+
            desc: returns index of card containg given number and type 
            i/p : cards = array of cards, number = card rank, type = card suit
            o/p : index of given card
           +-------------------------------------------------------------------+ */
  for (let i = 0; i < cards.length; i++) {
    if (
      parseInt(cards[i].split("-")[1]) == number &&
      cards[i].split("-")[0] == type
    ) {
      return i;
    }
  }
  return -1;
};

module.exports = {
  GetSortedCard,
};

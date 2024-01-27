

const CommonEventEmitter = require("../eventEmitter");

const { ROUND_TIMER_START_TIMER, ROBOT_TURN_START_TIMER, USER_TURN_START_TIMER,
    ON_TURN_EXPIRE_TIMER, FINISH_TIMER, DECLARE_TIMER, USER_REJOIN_TIMER, REJOIN_POOL_TABLE,
    COLLECT_BOOT_VALUE, SELECT_DEALER, RESUME_AND_DROP, DEAL_REMATCH_TIMER, SPLIT_AMOUNT, REMOVE_ON_LOW_CASH, DROP_CARD_TIMEOUT,
    LEAVE_TABLE_TIMEOUT, BOT_SEAT_TIMEOUT, CARD_DEALT, UPDATE_ON_DELAY, ROBOT_FINISH, DELAY_DECLARE,
} = require("../constants/eventName");

const { startRound, dealCards, selectDealerTimer, checkRobotSeating, cardsDealtTimer } = require("../classes/round.class");
const { robotTurnStarted, robotFinishTimer } = require("../classes/robots.class");
const { userTurnTimerFinish, resumeAndDropTimer, changeTableTurn } = require("../classes/turn.class");
const { onTurnExpire } = require("../classes/jobTimers.class");
const { declareTimer, Declare } = require("../classes/declareCard.class");
const { userFinishTimer } = require("../classes/finishCard.class");
const { userRejoinTimer } = require("../classes/dashboard.class");
const { sendRejoinPopUpTimer } = require("../classes/rejoinPool.class");
const { dealRematch } = require("../classes/winner.class");
const { splitAmountTimer, removeOnLowCashTimer } = require("../classes/splitPoint.class");
const { DropCards } = require("../classes/dropCards.class");
const { LeaveTable } = require("../classes/leaveTable.class");
const { delayUpdateOnCollections } = require("../classes/commonData.class");
const { CHANGE_TABLE_TURN } = require("../constants/eventName");



CommonEventEmitter.on(ROUND_TIMER_START_TIMER, startRound);
CommonEventEmitter.on(ROBOT_TURN_START_TIMER, robotTurnStarted);
CommonEventEmitter.on(USER_TURN_START_TIMER, userTurnTimerFinish);
CommonEventEmitter.on(ON_TURN_EXPIRE_TIMER, onTurnExpire);
CommonEventEmitter.on(FINISH_TIMER, userFinishTimer);
CommonEventEmitter.on(DECLARE_TIMER, declareTimer);
CommonEventEmitter.on(USER_REJOIN_TIMER, userRejoinTimer);
CommonEventEmitter.on(REJOIN_POOL_TABLE, sendRejoinPopUpTimer);
CommonEventEmitter.on(COLLECT_BOOT_VALUE, dealCards);
CommonEventEmitter.on(SELECT_DEALER, selectDealerTimer);
CommonEventEmitter.on(RESUME_AND_DROP, resumeAndDropTimer);
CommonEventEmitter.on(DEAL_REMATCH_TIMER, dealRematch);
CommonEventEmitter.on(SPLIT_AMOUNT, splitAmountTimer);
CommonEventEmitter.on(REMOVE_ON_LOW_CASH, removeOnLowCashTimer);
CommonEventEmitter.on(DROP_CARD_TIMEOUT, DropCards);
CommonEventEmitter.on(LEAVE_TABLE_TIMEOUT, LeaveTable);
CommonEventEmitter.on(BOT_SEAT_TIMEOUT, checkRobotSeating);
CommonEventEmitter.on(CARD_DEALT, cardsDealtTimer);
CommonEventEmitter.on(UPDATE_ON_DELAY, delayUpdateOnCollections);
CommonEventEmitter.on(ROBOT_FINISH, robotFinishTimer);
CommonEventEmitter.on(DELAY_DECLARE, Declare);
CommonEventEmitter.on(CHANGE_TABLE_TURN, changeTableTurn);





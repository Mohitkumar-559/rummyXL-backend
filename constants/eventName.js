const eventName = Object.freeze({
    ROUND_TIMER_START_TIMER: "roundTimerStart",
    USER_TURN_START_TIMER: "userTurnStart",
    ON_TURN_EXPIRE_TIMER: "onTurnExpire",
    ROBOT_TURN_START_TIMER: "robotTurnStarted",
    DECLARE_TIMER: "declareTimer",
    FINISH_TIMER: "finishTimer",
    USER_REJOIN_TIMER: "userRejoinTimer",
    REJOIN_POOL_TABLE: "rejoinPoolTable",
    COLLECT_BOOT_VALUE: "collectBootValue",
    SELECT_DEALER: "selectDealerTimer",
    RESUME_AND_DROP: "resumeAndDrop",
    DEAL_REMATCH_TIMER: "dealRematch",
    SPLIT_AMOUNT: "splitAmount",
    REMOVE_ON_LOW_CASH: "removeOnLowCashTimer",
    DROP_CARD_TIMEOUT: "dropCardTimeout",
    LEAVE_TABLE_TIMEOUT: "leaveTableTimeout",
    BOT_SEAT_TIMEOUT: "botSeatTimeout",
    CARD_DEALT: "cardsDealt",
    UPDATE_ON_DELAY: "delayUpdateData",
    ROBOT_FINISH: "robotFinish",
    DELAY_DECLARE: "delayDeclare",
    CHANGE_TABLE_TURN: "changeTableTurn",
    SHOW_REJOIN_ACCEPTED: "showRejoinAccepted",
    SPLIT_DATA:"splitData"

});

module.exports = eventName;
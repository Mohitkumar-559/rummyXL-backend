
const roundTimerStartProcess = require("./roundTimerStart.process");
const userTurnStartProcess = require("./userTurnStart.process");
const robotTurnStartProcess = require("./robotTurnStart.process");
const finishTimerProcess = require("./finishTimer.process");
const userRejoinTimerProcess = require("./userRejoinTimer.process");
const rejoinPoolTableProcess = require("./rejoinPoolTable.process");
const collectBootValueProcess = require("./collectBootValue.process");
const selectDealerProcess = require("./selectDealer.process");
const resumeAndDropProcess = require("./resumeAndDrop.process");
const dealRematchTimerProcess = require("./dealRematchTimer.process");
const splitAmountProcess = require("./splitAmount.process");
const removeOnLowCashProcess = require("./removeOnLowCash.process");
const dropCardTimeoutProcess = require("./dropCardTimeout.process");
const leaveTableTimeoutProcess = require("./leaveTableTimeout.process");
const botSeatTimeoutProcess = require("./botSeatTimeout.process");
const cardsDealtProcess = require("./cardsDealt.process");
const otherFinishTimerProcess = require("./otherFinishTimer.process");
const updateDataOnDelayProcess = require("./updateDataOnDelay.process");
const robotFinishProcess = require("./robotFinish.process");
const delayDeclareProcess = require("./delayDeclare.process");
const changeTableTurnProcess = require("./changeTableTurn.process");

module.exports = {
    roundTimerStartProcess, userTurnStartProcess, robotTurnStartProcess, finishTimerProcess, userRejoinTimerProcess, rejoinPoolTableProcess,
    collectBootValueProcess, selectDealerProcess, resumeAndDropProcess, dealRematchTimerProcess, splitAmountProcess, removeOnLowCashProcess,
    dropCardTimeoutProcess, leaveTableTimeoutProcess, botSeatTimeoutProcess, cardsDealtProcess, otherFinishTimerProcess, updateDataOnDelayProcess,
    robotFinishProcess, delayDeclareProcess, changeTableTurnProcess
};

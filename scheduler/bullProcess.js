
const logger = require("../utils/logger");
const { ROUND_TIMER_START_TIMER, ROBOT_TURN_START_TIMER, USER_TURN_START_TIMER,
    ON_TURN_EXPIRE_TIMER, FINISH_TIMER, DECLARE_TIMER, USER_REJOIN_TIMER, REJOIN_POOL_TABLE,
    COLLECT_BOOT_VALUE, SELECT_DEALER, RESUME_AND_DROP, DEAL_REMATCH_TIMER, SPLIT_AMOUNT, REMOVE_ON_LOW_CASH, DROP_CARD_TIMEOUT,
    LEAVE_TABLE_TIMEOUT, BOT_SEAT_TIMEOUT, CARD_DEALT, UPDATE_ON_DELAY, ROBOT_FINISH, DELAY_DECLARE, CHANGE_TABLE_TURN, SHOW_REJOIN_ACCEPTED, SPLIT_DATA,
} = require("../constants/eventName");




const bullProcess = async (job) => {
    try {
        logger.info(`Processing job`, job.id);
        const { robotTurnStarted, robotFinishTimer } = require("../classes/robots.class");
        const { userTurnTimerFinish, resumeAndDropTimer, changeTableTurn } = require("../classes/turn.class");
        const { onTurnExpire } = require("../classes/jobTimers.class");
        const { declareTimer, Declare } = require("../classes/declareCard.class");
        const { userFinishTimer } = require("../classes/finishCard.class");
        const { userRejoinTimer } = require("../classes/dashboard.class");
        const { sendRejoinPopUpTimer } = require("../classes/rejoinPool.class");
        const { dealRematch } = require("../classes/winner.class");
        const { splitAmountTimer, removeOnLowCashTimer,SplitData, SplitResult } = require("../classes/splitPoint.class");
        const { DropCards } = require("../classes/dropCards.class");
        const { LeaveTable } = require("../classes/leaveTable.class");
        const { delayUpdateOnCollections } = require("../classes/commonData.class");
        logger.info(`Processing job after`, job.data.calling);

        switch (job.data.calling) {
            case ROUND_TIMER_START_TIMER:
                const { startRound } = require("../classes/round.class");
                startRound(job.data.tableId);
                break;

            case ROBOT_TURN_START_TIMER:
                robotTurnStarted(job.data.tableId);
                break;

            case USER_TURN_START_TIMER:
                userTurnTimerFinish(job.data);
                break;

            case ON_TURN_EXPIRE_TIMER:
                onTurnExpire(job.data.table);
                break;

            case FINISH_TIMER:
                await userFinishTimer(job.data.tableId);
                break;

            case DECLARE_TIMER:
                await declareTimer(job.data.tableId);
                break;

            case USER_REJOIN_TIMER:
                userRejoinTimer(job.data);
                break;

            case REJOIN_POOL_TABLE:
                sendRejoinPopUpTimer(job.data);
                break;

            case COLLECT_BOOT_VALUE:
                const { dealCards, } = require("../classes/round.class");
                dealCards(job.data.tableId, job.data.pv, job.data.pi);
                break;

            case SELECT_DEALER:
                const { selectDealerTimer } = require("../classes/round.class");
                selectDealerTimer(job.data);
                break;

            case RESUME_AND_DROP:
                await resumeAndDropTimer(job.data.table);
                break;

            case DEAL_REMATCH_TIMER:
                dealRematch(job.data);
                break;

            case SPLIT_AMOUNT:
                splitAmountTimer(job.data.tableId,job.data.tableMode, job.data?.splitAmountDirect);
                break;

            case REMOVE_ON_LOW_CASH:
                removeOnLowCashTimer(job.data.tableId);
                break;

            case DROP_CARD_TIMEOUT:
                await DropCards(job.data.firstParams, job.data.secondParams, job.data.thirdParams, job.data.fourthParams);
                break;

            case LEAVE_TABLE_TIMEOUT:
                await LeaveTable(job.data.firstParams, job.data.secondParams);
                break;

            case BOT_SEAT_TIMEOUT:
                const { checkRobotSeating } = require("../classes/round.class");
                await checkRobotSeating(job.data.tableId, job.data.gameType);
                break;

            case CARD_DEALT:
                const { cardsDealtTimer } = require("../classes/round.class");
                cardsDealtTimer(job.data.tableId);
                break;

            case UPDATE_ON_DELAY:
                await delayUpdateOnCollections(job.data.query, job.data.updateObject);
                break;

            case ROBOT_FINISH:
                if (job.data.robotFinish) {
                    robotFinishTimer(job.data);
                }
                break;

            case DELAY_DECLARE:
                await Declare(job.data.firstParams, job.data.secondParams);
                break;

            case CHANGE_TABLE_TURN:
                changeTableTurn(job.data.tableId, job.data.lastAction);
                break;

            case SHOW_REJOIN_ACCEPTED:
                const { showRejoinAccept } = require("../classes/round.class");
                await showRejoinAccept(job.data.tableId, job.data.userId, job.data.prize);
                break;

            case SPLIT_DATA:
                SplitData(job.data.tableId);
                break;

            default:
                logger.warn("switch Unknown", job.data.calling);
                break;
        }
        return Promise.resolve(); // or return a Promise that resolves when the job is complete
    } catch (error) {
        console.error(error);
    }
};


exports.bullProcess = bullProcess;

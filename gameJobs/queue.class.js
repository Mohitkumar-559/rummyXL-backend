
const logger = require("../utils/logger");
const scheduler = require("../scheduler");


class Queues {

    constructor() {
        // if (!this.instance) {
        //     this.instance = new Queue();
        // }
        // return this.instance;
    }

    async roundTimerStart({ table, timer }) {
        try {
            const jobData = { tableId: resp._id.toString(), calling: ROUND_TIMER_START_TIMER };
            const jobOption = {
                delay: rst * 1000,
                jobId: jobId,
            };
            addQueue(jobData, jobOption);
        } catch (error) {
            logger.error("-----> error roundTimerStart", error);
            getInfo.exceptionError(error);
        }
    }

    async botSeatTimeout({ table, timer }) {
        try {
            const jobId = `${table.gt}:botSeatTimeout:${table._id.toString()}`;
            await scheduler.queues.botSeatTimeout({
                timer, jobId,
                tableId: table._id.toString(),
                gameType: table.gt
            });
        } catch (error) {
            logger.error("-----> error botSeatTimeoutQueue", error);
            getInfo.exceptionError(error);
        }
    }

}

module.exports = Queues;
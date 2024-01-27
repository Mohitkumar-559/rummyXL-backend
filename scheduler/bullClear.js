const logger = require("../utils/logger");
const { cancelJob } = require("./bullQueue");
const { getRedisInstances } = require("../connections/redis");


const clearQueue = async (tableId) => {
    try {
        const redisInstances = getRedisInstances();

        const keys = await redisInstances.KEYS(`*${tableId}*`);
        if (keys.length > 0) {
            logger.info("clearQueue keys", keys);
            for (const iterator of keys) {
                if (iterator.includes("bull")) {
                    await cancelJob(iterator.split("bull:RummyXLQueue:")[1]);
                }
            }
        }
    } catch (error) {
        logger.error("clearQueue keys", error);
    }

};

module.exports = { clearQueue };
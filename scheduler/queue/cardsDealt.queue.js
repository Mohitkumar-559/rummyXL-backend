const Bull = require("bull");
const logger = require("../../utils/logger");
const getInfo = require("../../common");
const { cardsDealtProcess } = require("../process");

const { REDIS_DB, RDS_HOST, RDS_AUTH } = process.env;

const REDIS_CONFIG = { host: RDS_HOST, port: 6379, password: RDS_AUTH, db: REDIS_DB };

const cardsDealtQueue = new Bull(`cardsDealt`, { redis: REDIS_CONFIG });

const cardsDealt = async (data) => {
  try {
    const options = {
      delay: data.timer,
      jobId: data.jobId,
      removeOnComplete: true
    };
    await cardsDealtQueue.add(data, options);
    return cardsDealtQueue;
  } catch (error) {
    logger.error("-----> error cardsDealtQueue", error);
    getInfo.exceptionError(error);
  }
};

cardsDealtQueue.process(cardsDealtProcess);

module.exports = cardsDealt;

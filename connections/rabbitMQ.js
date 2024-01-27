/*=========================================================
          RabbitMq server setup start
===========================================================*/
const commonClass = require("../classes/common.class.js"); //common functions
const amqpClass = require("../classes/amqp.class.js");
const amqp = require("amqp");
const logger = require("../utils/logger");

let rabbitmqConnection;
const rmqpInit = () => {
  return new Promise((resolve, reject) => {
    const RBMQ_CONFIG = {
      host: process.env.RMQ_HOST,
      login: process.env.RMQ_LOGIN,
      password: process.env.RMQ_PASSWORD,
      vhost: process.env.RMQ_VHOST,
    };

    let rabbitmqConnection = amqp.createConnection(RBMQ_CONFIG);
    let str = commonClass.GetRandomString(10);
    rabbitmqConnection.on("ready", async function () {
      //create exchange here
      playExchange = rabbitmqConnection.exchange("pe", { type: "topic" });
      logger.info(
        "::::::::::::::::::::queue genrated::::::::::::::::::",
        "rabbitmq"
      );
      amqpClass.CreateQueues(str, rabbitmqConnection, playExchange);
      resolve(rabbitmqConnection);
    });

    rabbitmqConnection.on("error", function (e) {
      logger.info("rabbit:::::::::::::::Error: ", e);
      reject(e);
    });
  });
};

const playExchangeInstance = () => playExchange;

module.exports = { rmqpInit, playExchangeInstance };
/*=========================================================
        RabbitMq server setup finish here
===========================================================*/

const schedule = require("node-schedule");
const commonClass = require("./common.class.js"); //common functions
const logger = require("../utils/logger");
const socketClass = require("../utils/getSockets");
const socketData = new socketClass();
const getInfo = require("../common");
const sizeof = require("object-sizeof");
const { GetConfig } = require("../connections/mongodb");
const commonData = require("./commonData.class");

const CreateQueues = (str, rabbitmqConnection, playExchange) => {
  try {
    //binds the queues with exchanges
    /* +-------------------------------------------------------------------+
      desc:this function binds the queue with respective exchanges.
    +-------------------------------------------------------------------+ */
    logger.info("CreateQueues----------->>>>SERVER_ID: ", SERVER_ID);

    const { ENC_DEC_FLAG } = GetConfig();

    // var str = commonClass.GetRandomString(10);
    rabbitmqConnection.queue("emitter_" + str, function (q) {
      q.bind(playExchange, "room.*");
      q.bind(playExchange, "single." + SERVER_ID + ".*");
      q.bind(playExchange, "job.*");
      q.bind(playExchange, "rejoin.*");
      q.bind(playExchange, "admin");
      q.bind(playExchange, "all.*");
      q.bind(playExchange, "updateConfig.*");
      q.bind(playExchange, "exceptSender.*");


      q.subscribe(function (message, headers, deliveryInfo, messageObject) {
        // logger.info('amqp--------------------',message,'----',deliveryInfo);
        if (!message) {
          logger.info(
            'CreateQueues::::::::::>>>>>Error: "message not found!!!"'
          );

          return false;
        }

        if (deliveryInfo.routingKey.indexOf("room.") != -1) {
          //first we have to get table id from routing key.

          let room = deliveryInfo.routingKey.replace("room.", "");

          //room must be exists in routing key.
          if (!room) {
            logger.info(
              'CreateQueues::::::::::::::::>>>>>>Error: "room not found!!!"'
            );

            return false;
          }

          logger.debug(
            `send to room || event name is ${message.en}`,
            `${sizeof(message)} B`
          );

          let encryptMessage = null;
          if (ENC_DEC_FLAG) {
            encryptMessage = commonClass.encrypt(message);
          }
          io.to(room).emit("res", encryptMessage ?? message);

          logger.info("message:", message);
          logger.info(`CreateQueues>>>>>> Event Name: `, message.en);

          if (message.en == "LeaveTable" && message.data.leave == 1) {
            try {
              let client = socketData.getSocketObjects(message.data.id);

              if (
                client &&
                typeof client._ir != "undefined" &&
                client._ir != null &&
                client._ir == 0
              ) {
                logger.info(
                  'CreateQueues----------------------------->>>>>Msg:"try to remove socket from table"'
                );
                logger.info(
                  `"CreateQueues--------- ${io.sockets.adapter.rooms[message.data.playTableId]
                  }-----before----->>>>connected sockets: "`,
                  io.sockets.adapter.rooms[message.data.playTableId]
                );

                client.leave(message.data.playTableId);
                logger.info(
                  `CreateQueues---------${io.sockets.adapter.rooms[message.data.playTableId]
                  }-----after----->>>>connected sockets: `,
                  io.sockets.adapter.rooms[message.data.playTableId]
                );

                delete client.playTableId;
                delete client.si;
                delete client.gt;
                logger.info(
                  'CreateQueues--------------------------->>>>>Msg: "socket removed from table"'
                );
                logger.info(
                  `'CreateQueues---------${message.data.flag} ------------------>>>>>Msg: "message.data.flag"'`,
                  message.data.flag
                );

                if (message.data.flag == "auto") {
                  commonClass.SendData(
                    client,
                    "PopUp",
                    { flag: "tut", gameType: message.data.gameType },
                    "success:1043"
                  );
                } else if (message.data.flag == "noChips") {
                  if (message.data.mode == "cash") {
                    commonClass.SendData(
                      client,
                      "PopUp",
                      {
                        flag: "noChips",
                        gameType: message.data.gameType,
                        reqChips: message.data.reqChips,
                      },
                      "error:1074"
                    );
                  } else {
                    commonClass.SendData(
                      client,
                      "PopUp",
                      {
                        flag: "noChips",
                        gameType: message.data.gameType,
                        reqChips: message.data.reqChips,
                      },
                      "error:2020"
                    );
                  }
                }
              }
            } catch (e) {
              logger.info(
                'CreateQueues---------::::::::else if::::>>>>>>Error: "client not leave!!!"',
                e
              );
            }
          }
        } else if (deliveryInfo.routingKey.indexOf("single.") != -1) {
          // logger.info('CreateQueues-----single----->>>>>en: ',message.en);
          let single = deliveryInfo.routingKey.replace(
            "single." + SERVER_ID + ".",
            ""
          );
          let clientObj = socketData.getSocketObjects(single);

          if (clientObj) {
            logger.debug(
              `send to client || event name is ${message.en}`,
              `${sizeof(message)} B`
            );
            let encryptMessage = null;
            if (ENC_DEC_FLAG) {
              encryptMessage = commonClass.encrypt(message);
            }
            clientObj.emit("res", encryptMessage ?? message);

            if (message.en == "LeaveTable" && message.data.leave == 1) {
              try {
                logger.info(
                  'CreateQueues------- LeaveTable -------------------->>>>>Msg:"try to remove socket from table"'
                );
                logger.info(
                  "CreateQueues------- LeaveTable-----before----->>>>connected sockets: ",
                  io.sockets.adapter.rooms[message.data.playTableId]
                );

                clientObj.leave(message.data.playTableId);
                logger.info(
                  "CreateQueues------- LeaveTable-----after----->>>>connected sockets: ",
                  io.sockets.adapter.rooms[message.data.playTableId]
                );

                delete clientObj.playTableId;
                delete clientObj.si;
                delete clientObj.gt;
                logger.info(
                  'CreateQueues------- LeaveTable ------------------>>>>>Msg: "socket removed from table"'
                );
                logger.info(
                  "CreateQueues------- LeaveTable--------->>>>playTableId deleted"
                );

                if (message.data.flag == "auto") {
                  commonClass.SendData(
                    client,
                    "PopUp",
                    { flag: "tut", gameType: message.data.gameType },
                    "success:1043"
                  );
                } else if (message.data.flag == "noChips") {
                  strClass.outOfChipsPop(client, {
                    flag: "noChips",
                    gameType: message.data.gameType,
                    reqChips: message.data.reqChips,
                  });
                }
              } catch (e) {
                logger.info(
                  'CreateQueues----- LeaveTable:::::::if::::::>>>>>>Error: "client not leave!!!"',
                  e
                );
              }
            } else if (message.en == "NCC" && message.data.sck) {
              let single = "";
              if (
                typeof message.data.sck == "string" &&
                message.data.sck != ""
              ) {
                single = message.data.sck.replace(/s\d*_\d*./i, "");
              }

              logger.info(
                "CreateQueues------------ NCC---------->>>>single: ",
                single
              );

              try {
                logger.info(
                  "CreateQueues------------ NCC------------>>>>>>before disconnect"
                );

                socketData.getSocketObjects(single).disconnect();
                logger.info(
                  "CreateQueues------------ NCC---------->>>>>>>after disconnect"
                );
              } catch (e) {
                logger.info(
                  'CreateQueues------------ NCC::::::::::::::::>>>>Error: "socket not disconnected"'
                );
              }
            }
          }
        } else if (deliveryInfo.routingKey.indexOf("job.") != -1) {
          if (message.en == "CTJ") {
            // logger.info('CTJ--------message.data.jid: '+ message.data.jid+' '+new Date());

            if (message.data.jid) {
              // logger.info('CTJ----if---->>>>message.data.jid: ',message.data.jid+' '+new Date());

              schedule.cancelJob(message.data.jid);
              // schedule.scheduledJobs(message.data.jid);
            }
            return false;
          }
        } else if (deliveryInfo.routingKey.indexOf("rejoin.") != -1) {
          let rejoinID = deliveryInfo.routingKey.replace("rejoin.", "");
          schedule.cancelJob(rejoinID);
        } else if (deliveryInfo.routingKey.indexOf("all.") != -1) {
          logger.debug(
            `send to client || event name is ${message.en}`,
            `${sizeof(message)} B`
          );
          let encryptMessage = null;
          let { tableIds } = message;
          delete message.tableIds;
          if (ENC_DEC_FLAG) {
            encryptMessage = commonClass.encrypt(message);
          }
          // io.emit("res", encryptMessage ?? message);     
          io.except(tableIds).emit("res", encryptMessage ?? message);
        } else if (deliveryInfo.routingKey.indexOf("updateConfig.") != -1) {
          logger.debug(`update config`,"updateConfig call");
          commonData.globalConfigChange();
        } else if (deliveryInfo.routingKey.indexOf("exceptSender.") != -1) {
          logger.debug(
            `send to client || event name is ${message.en}`,
            `${sizeof(message)} B`
          );
          let encryptMessage = null;
          const { exceptSocket, tableId } = message;
          const client = socketData.getSocketObjects(exceptSocket);
          delete message.exceptSocket;
          delete message.tableId;
          if (ENC_DEC_FLAG) {
            encryptMessage = commonClass.encrypt(message?.data);
          }
          client.to(tableId).emit("res", encryptMessage ?? message?.data);
        }
      });
    });
  } catch (error) {
    logger.error("Create Queues", error);
    getInfo.exceptionError(error);
  }
};
module.exports = {
  CreateQueues,
};

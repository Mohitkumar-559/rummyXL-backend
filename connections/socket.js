const { instrument } = require("@socket.io/admin-ui");
// const { createAdapter } = require("@socket.io/redis-adapter");
// const { pubClient, subClient } = require("./redis");
// const { createAdapter } = require("@socket.io/redis-streams-adapter");
// const { getRedisInstances } = require("./redis");
// const Redis = require("ioredis");

const socketInit = (secureServer) => {
  return new Promise(async (resolve) => {
    io = require("socket.io")(secureServer, {
      allowEIO3: true,
      transports: ["websocket"],
      // pingTimeout: 10000,
      // pingInterval: 3000,
      cors: {
        origin: ["https://admin.socket.io"],
        credentials: true,
      },
    });

    instrument(io, {
      auth: {
        type: "basic",
        username: "rummy-xl",
        password:
          "$2a$12$pzMuBmoI3uSDMGRJGoJEYOdrQQjWbbkzcc7pw2h3ksOFVYX1HJrWe",
      },
      readonly: !(process.env.environment == "development" || process.env.environment == "staging"),
    });

    // const pubClient = new Cluster([
    //   {
    //     host: process.env.RDS_HOST,
    //     port: 6379,
    //     password: process.env.RDS_AUTH,
    //   },
    //   {
    //     host: process.env.RDS_HOST,
    //     port: 6379,
    //     password: process.env.RDS_AUTH,
    //   },
    // ]);

    // const pubClient = new Redis({
    //   port: 6379, // Redis port
    //   host: process.env.RDS_HOST, // Redis host
    //   password: process.env.RDS_AUTH,
    // });

    // const subClient = new Redis({
    //   port: 6379, // Redis port
    //   host: process.env.RDS_HOST, // Redis host
    //   password: process.env.RDS_AUTH,
    // });

    // const subClient = pubClient.duplicate();
    // io.adapter(createAdapter(await pubClient(), await subClient()));
    // io.adapter(createAdapter(pubClient, subClient));
    resolve(io);
  });
};

const getSocket = () => io;

module.exports = { socketInit, getSocket };

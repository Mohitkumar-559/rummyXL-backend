//load configuration data
const fs = require("fs");
const express = require("express");
const https = require("https");
const http = require("http");
require("dotenv").config();
const logger = require("./utils/logger");
const { socketInit } = require("./connections/socket");
const { redisInit } = require("./connections/redis");
const { rmqpInit } = require("./connections/rabbitMQ");
const { dbInit } = require("./connections/mongodb");
// const redLock = require("./connections/redLock");
const urlHandler = require("./classes/urlHandler.class");
const userProfile = require("./classes/userProfile.class");
const eventClass = require("./classes/eventCases.class");
const signedUrl = require("./utils/signedURL");
const transaction = require("./api/v1/controller/transactionController");
const bodyParser = require("body-parser");
// const morgan = require("morgan");
// const helmet = require("helmet");
const getInfo = require("./common");
const updateLobby = require("./common/newUpdateLobbyCount");
const fileUpload = require('express-fileupload');

const { createBullBoard } = require('@bull-board/api');
const { BullAdapter } = require('@bull-board/api/bullAdapter');
const { ExpressAdapter } = require('@bull-board/express');
const Bull = require('bull');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;

// this file should be global because the this file functionality is called form most files.
leaveTableClass = require("./classes/leaveTable.class");
winnerClass = require("./classes/winner.class");

SERVER_ID = "s1_1"; //process.argv[2];    //S<prefix number>_<server number>
const SERVER_PORT = process.env.PORT || 4000; //server port

// process.setMaxListeners(0);

const app = express();
// app.use(helmet());
app.use(express.json());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
// app.use(morgan("combined"));
app.use(
  fileUpload({
    // limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit (in bytes)
    // abortOnLimit: true,
  })
);

// *************************************************************************************************************
// bull board
// Initialize session middleware
// app.use(session({ secret: process.env.JwtSecretKey, resave: false, saveUninitialized: false }));

// // Initialize passport
// app.use(passport.initialize());
// app.use(passport.session());

// // Example User model (replace it with your own User model)
// const User = {
//   username: process.env.BULL_USERNAME,
//   password: process.env.BULL_PASSWORD,
// };

// // Configure passport to use a local strategy
// passport.use(
//   new LocalStrategy((username, password, done) => {
//     if (username === User.username && password === User.password) {
//       return done(null, User);
//     } else {
//       return done(null, false);
//     }
//   })
// );

// // Serialize and deserialize user objects
// passport.serializeUser((user, done) => {
//   done(null, user.id);
// });

// passport.deserializeUser((id, done) => {
//   if (id === User.id) {
//     done(null, User);
//   } else {
//     done(new Error('User not found'));
//   }
// });

// // Custom middleware to check if the user is authenticated
// const isAuthenticated = (req, res, next) => {
//   if (req.isAuthenticated()) {
//     return next();
//   }
//   res.redirect('/login');
// };

// // Bull Board route authentication middleware
// const authenticateBullBoard = (req, res, next) => {
//   if (req.isAuthenticated()) {
//     return next();
//   }
//   res.status(401).send('Unauthorized');
// };

// const { REDIS_DB, RDS_HOST, RDS_AUTH } = process.env;
// const REDIS_CONFIG = { host: RDS_HOST, port: 6379, password: RDS_AUTH, db: REDIS_DB };
// const RummyXLQueue = new Bull('RummyXLQueue', { redis: REDIS_CONFIG });
// const serverAdapter = new ExpressAdapter();
// serverAdapter.setBasePath('/rummyxl/adminxl/queuesxl');
// const { addQueue, removeQueue, setQueues, replaceQueues } = createBullBoard({
//   queues: [new BullAdapter(RummyXLQueue)],
//   serverAdapter: serverAdapter,
// });

// // Serve the login form
// app.get('/login', (req, res) => {
//   res.send(`
//     <h2>Login Form</h2>
//     <form action="/login" method="POST">
//       <label for="username">Username:</label>
//       <input type="text" id="username" name="username"><br><br>
//       <label for="password">Password:</label>
//       <input type="password" id="password" name="password"><br><br>
//       <input type="submit" value="Login">
//     </form>
//   `);
// });

// app.use('/rummyxl/adminxl/queuesxl', isAuthenticated, authenticateBullBoard, serverAdapter.getRouter());
// // Login route
// app.post('/login', passport.authenticate('local', { successRedirect: '/rummyxl/adminxl/queuesxl', failureRedirect: '/login' }));

// // Logout route
// app.get('/logout', (req, res) => { req.logout(); res.redirect('/login'); });


// *************************************************************************************************************

app.use("/", urlHandler);
app.use("/", userProfile);
app.use("/", signedUrl);
app.use("/", transaction);

let secureServer;
if (fs.existsSync("certificate/artoon.key") && fs.existsSync("certificate/artoon.crt")) {
  let httpsOptions = {
    key: fs.readFileSync("certificate/artoon.key"),
    cert: fs.readFileSync("certificate/artoon.crt"),
  };
  secureServer = https.createServer(httpsOptions, app);
  logger.info("Running on HTTPS", "data");
} else {
  secureServer = http.createServer(app);
  logger.info("Running on HTTP");
}

app.set("view engine", "ejs");

app.get("/test", (req, res) => {
  res.send("OK");
});
(async () => {
  try {
    await redisInit();
    await Promise.all([socketInit(secureServer), dbInit()]).then(
      async () => {
        await rmqpInit();
        // updateLobbyCount();
        // redLock;
        secureServer.listen(SERVER_PORT);
        await eventClass.init(); //init server setup
        require("./eventHandler");
        logger.info("Server listening on port : ", SERVER_PORT, new Date());
      }
    );

    process
      .on("unhandledRejection", (response, p) => {
        console.error("unhandledRejection", response);
        console.error("unhandledRejection", p);
        logger.error("unhandledRejection", response);
        logger.error("unhandledRejection", p);
        getInfo.exceptionError(response);
        getInfo.exceptionError(p);
      })
      .on("uncaughtException", (err) => {
        console.error("uncaughtException", err);
        logger.error("uncaughtException", err);
        getInfo.exceptionError(err);
      });
  } catch (error) {
    console.error(error);
    logger.error("uncaughtException", error);
    getInfo.exceptionError(error);
  }
})();



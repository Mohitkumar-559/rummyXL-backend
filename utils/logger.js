// const { format, createLogger, transports } = require("winston");
// const { combine, label, json, timestamp, printf } = format;
// require("winston-daily-rotate-file");

// //DailyRotateFile func()
// const fileRotateTransport = new transports.DailyRotateFile({
//   filename: "logs/rotate-%DATE%.log",
//   datePattern: "YYYY-MM-DD",
//   maxFiles: "1d",
// });

// const logger = createLogger({
//   level: "debug",
//   format: combine(
//     timestamp(),

//     printf((info) => {
//       const timestamp = info?.timestamp?.trim();
//       const { level } = info;
//       const message = (info?.message || "").trim();
//       const args = info[Symbol.for("splat")];

//       return `[${timestamp}] ${level} ${message} ${JSON.stringify(args)}`;
//       // return `[${timestamp}] ${level} ${message} ${args}`;
//     })
//   ),
//   transports: [fileRotateTransport, new transports.Console()],
// });

// module.exports = logger;
const { format, createLogger, transports } = require("winston");
const { combine, label, json, timestamp, printf } = format;
require("winston-daily-rotate-file");
//DailyRotateFile func()
const fileRotateTransport = new transports.DailyRotateFile({
  filename: "logs/rotate-%DATE%.log",
  datePattern: 'YYYY-MM-DD-HH',
  zippedArchive: true,
  // maxSize: '20m',
  maxFiles: '2d',
});
const logger = createLogger({
  level: "debug",
  format: combine(
    timestamp(),
    printf((info) => {
      const timestamp = info?.timestamp?.trim();
      const { level } = info;
      const message = (info?.message || "").trim();
      const args = info[Symbol.for("splat")];
      return `[${timestamp}] ${level} ${message} ${JSON.stringify(args)}`;
      // return `[${timestamp}] ${level} ${message} ${args}`;
    })
  ),
  transports: [fileRotateTransport, new transports.Console()],
});
// Create a function to close and reopen the transport to create new log files
function createNewLogFiles() {
  logger.transports.forEach((transport) => {
    if (typeof transport.rotate === 'function') {
      transport.rotate();
    }
  });
}
// Schedule the creation of new log files every hour
const interval = setInterval(createNewLogFiles, 60 * 60 * 1000); // 1 hour in milliseconds
// Ensure the interval is cleared when the application exits
process.on('exit', () => {
  clearInterval(interval);
});
module.exports = logger;

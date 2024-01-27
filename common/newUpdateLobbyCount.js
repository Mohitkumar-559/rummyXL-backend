const logger = require("../utils/logger");
const { getRedisInstances } = require("../connections/redis");
const { getRandomString } = require("../utils");
const getInfo = require("../common");
const findTableAndJoinClass = require("../classes/findTableAndJoin.class");
const commonClass = require("../classes/common.class"); //common functions
const moment = require("moment");

const updateLobbyCount = async () => {
  const redisInstances = getRedisInstances();

  // const totalOnlinePlayers = await getRedis(`totalOnlinePlayers`);
  // if(totalOnlinePlayers||totalOnlinePlayers!==0){
  //   totalPlayerFlag=true;

  // }
  //const pointPlayerCount = (totalOnlinePlayers * 30) / 100;

  //for point
  let resp = await db.collection("point_category").find().toArray();

  const cash = resp.filter((x) => x.mode === "cash");
  const practice = resp.filter((x) => x.mode === "practice");

  // const totalCashPointCount = parseInt((pointPlayerCount * 40) / 100);
  // const totalPracticePointCount = parseInt((pointPlayerCount * 60) / 100);
  // await redisInstances.SET(`cash:Points`, totalCashPointCount);
  // await redisInstances.SET(`practice:Points`, totalPracticePointCount);
  //const cashRandom = await randomNumber(totalCashPointCount, cash.length);
  let totalCashPointCount = 0;
  for (const [i, data] of cash.entries()) {
    let max = data.max ?? 500;
    let min = data.min ?? 1;
    let uCount = parseInt(randomNumberRange(min, max));
    totalCashPointCount = totalCashPointCount + uCount;
    await redisInstances.SET(`cash:Points:${data._id}`, uCount);
    // logger.info(
    //   `cash:Points:${data._id}`,uCount
    // );
    // await redisInstances.SET(`cash:Points:${data._id}`, cashRandom[i]);
  }
  await redisInstances.SET(`cash:Points`, totalCashPointCount);
  // logger.info(
  //   `cash:Points`,totalCashPointCount
  // );

  // const practiceRandom = await randomNumber(
  //   totalCashPointCount,
  //   practice.length
  // );
  let totalPracticePointCount = 0;
  for (const [i, data] of practice.entries()) {
    let max = data.max ?? 500;
    let min = data.min ?? 1;
    let uCount = parseInt(randomNumberRange(min, max));
    totalPracticePointCount = totalPracticePointCount + uCount;
    await redisInstances.SET(`practice:Points:${data._id}`, uCount);
    // logger.info(
    //   `practice:Points:${data._id}`,uCount
    // );
    

    //await redisInstances.SET(`practice:Points:${data._id}`, practiceRandom[i]);
  }
  await redisInstances.SET(`practice:Points`, totalPracticePointCount);
  // logger.info(
  //   `practice:Points`,totalPracticePointCount
  // );

  //for pool
  let respPool61 = await db
    .collection("pool_category")
    .find({ category: 61 })
    .toArray();

  const cashPool61 = respPool61.filter((x) => x.mode === "cash");
  const practicePool61 = respPool61.filter((x) => x.mode === "practice");
  // const poolPlayerCount = (totalOnlinePlayers * 40) / 100;

  // const totalCashPoolCount = parseInt((poolPlayerCount * 40) / 100);
  // const totalPracticePoolCount = parseInt((poolPlayerCount * 60) / 100);
  // await redisInstances.SET(`cash:Pool`, totalCashPoolCount);
  // await redisInstances.SET(`practice:Pool`, totalPracticePoolCount);
  // const cashRandomPool = await randomNumber(
  //   totalCashPoolCount,
  //   cashPool.length
  // );
  let totalCashPool61Count = 0;
  for (const [i, data] of cashPool61.entries()) {
    let max = data.max ?? 500;
    let min = data.min ?? 1;
    let uCount = parseInt(randomNumberRange(min, max));

    totalCashPool61Count = totalCashPool61Count + uCount;

    await redisInstances.SET(`cash:Pool61:${data._id}`, uCount);
    // logger.info(
    //   `cash:Pool61:${data._id}`,uCount
    // );
    // await redisInstances.SET(`cash:Pool:${data._id}`, cashRandomPool[i]);
  }
  await redisInstances.SET(`cash:Pool61`, totalCashPool61Count);
  // logger.info(
  //   `cash:Pool61`,totalCashPool61Count
  // );

  // const practiceRandomPool = await randomNumber(
  //   totalCashPointCount,
  //   practicepool.length
  // );
  let totalPracticePool61Count = 0;
  for (const [i, data] of practicePool61.entries()) {
    let max = data.max ?? 500;
    let min = data.min ?? 1;
    let uCount = parseInt(randomNumberRange(min, max));
    totalPracticePool61Count = totalPracticePool61Count + uCount;

    await redisInstances.SET(`practice:Pool61:${data._id}`, uCount);
    // logger.info(
    //   `practice:Pool61:${data._id}`,uCount
    // );
    // await redisInstances.SET(
    //   `practice:Pool:${data._id}`,
    //   practiceRandomPool[i]
    // );
  }
  await redisInstances.SET(`practice:Pool61`, totalPracticePool61Count);
  // logger.info(
  //   `practice:Pool61`,totalPracticePool61Count
  // );

  //poo101
  let respPool101 = await db
    .collection("pool_category")
    .find({ category: 101 })
    .toArray();

  const cashPool101 = respPool101.filter((x) => x.mode === "cash");
  const practicePool101 = respPool101.filter((x) => x.mode === "practice");
  // const poolPlayerCount = (totalOnlinePlayers * 40) / 100;

  // const totalCashPoolCount = parseInt((poolPlayerCount * 40) / 100);
  // const totalPracticePoolCount = parseInt((poolPlayerCount * 60) / 100);
  // await redisInstances.SET(`cash:Pool`, totalCashPoolCount);
  // await redisInstances.SET(`practice:Pool`, totalPracticePoolCount);
  // const cashRandomPool = await randomNumber(
  //   totalCashPoolCount,
  //   cashPool.length
  // );
  let totalCashPool101Count = 0;
  for (const [i, data] of cashPool101.entries()) {
    let max = data.max ?? 500;
    let min = data.min ?? 1;
    let uCount = parseInt(randomNumberRange(min, max));
    totalCashPool101Count = totalCashPool101Count + uCount;

    await redisInstances.SET(`cash:Pool101:${data._id}`, uCount);
    // logger.info(
    //   `cash:Pool101:${data._id}`,uCount
    // );
    // await redisInstances.SET(`cash:Pool:${data._id}`, cashRandomPool[i]);
  }
  await redisInstances.SET(`cash:Pool101`, totalCashPool101Count);
  // logger.info(
  //   `cash:Pool101`,totalCashPool101Count
  // );

  // const practiceRandomPool = await randomNumber(
  //   totalCashPointCount,
  //   practicepool.length
  // );
  let totalPracticePool101Count = 0;
  for (const [i, data] of practicePool101.entries()) {
    let max = data.max ?? 500;
    let min = data.min ?? 1;
    let uCount = parseInt(randomNumberRange(min, max));
    totalPracticePool101Count = totalPracticePool101Count + uCount;

    await redisInstances.SET(`practice:Pool101:${data._id}`, uCount);
    // logger.info(
    //   `practice:Pool101:${data._id}`,uCount
    // );
    // await redisInstances.SET(
    //   `practice:Pool:${data._id}`,
    //   practiceRandomPool[i]
    // );
  }
  await redisInstances.SET(`practice:Pool101`, totalPracticePool101Count);
  // logger.info(
  //   `practice:Pool101`,totalPracticePool101Count
  // );

  //poo201
  let respPool201 = await db
    .collection("pool_category")
    .find({ category: 201 })
    .toArray();

  const cashPool201 = respPool201.filter((x) => x.mode === "cash");
  const practicePool201 = respPool201.filter((x) => x.mode === "practice");
  // const poolPlayerCount = (totalOnlinePlayers * 40) / 100;

  // const totalCashPoolCount = parseInt((poolPlayerCount * 40) / 100);
  // const totalPracticePoolCount = parseInt((poolPlayerCount * 60) / 100);
  // await redisInstances.SET(`cash:Pool`, totalCashPoolCount);
  // await redisInstances.SET(`practice:Pool`, totalPracticePoolCount);
  // const cashRandomPool = await randomNumber(
  //   totalCashPoolCount,
  //   cashPool.length
  // );
  let totalCashPool201Count = 0;
  for (const [i, data] of cashPool201.entries()) {
    let max = data.max ?? 500;
    let min = data.min ?? 1;
    let uCount = parseInt(randomNumberRange(min, max));
    totalCashPool201Count = totalCashPool201Count + uCount;

    await redisInstances.SET(`cash:Pool201:${data._id}`, uCount);
    // logger.info(
    //   `cash:Pool201:${data._id}`,uCount
    // );
    // await redisInstances.SET(`cash:Pool:${data._id}`, cashRandomPool[i]);
  }
  await redisInstances.SET(`cash:Pool201`, totalCashPool201Count);
  // logger.info(
  //   `cash:Pool201`,totalCashPool201Count
  // );

  // const practiceRandomPool = await randomNumber(
  //   totalCashPointCount,
  //   practicepool.length
  // );
  let totalPracticePool201Count = 0;
  for (const [i, data] of practicePool201.entries()) {
    let max = data.max ?? 500;
    let min = data.min ?? 1;
    let uCount = parseInt(randomNumberRange(min, max));
    totalPracticePool201Count = totalPracticePool201Count + uCount;

    await redisInstances.SET(`practice:Pool201:${data._id}`, uCount);
    // logger.info(
    //   `practice:Pool201:${data._id}`,uCount
    // );
    // await redisInstances.SET(
    //   `practice:Pool:${data._id}`,
    //   practiceRandomPool[i]
    // );
  }
  await redisInstances.SET(`practice:Pool201`, totalPracticePool201Count);
  // logger.info(
  //   `practice:Pool201`,totalPracticePool201Count
  // );

  //for Deal
  let respDeal = await db
    .collection("deal_category")
    .find({ deals: { $in: [2, 3] } })
    .toArray();

  const cashDeal = respDeal.filter((x) => x.mode === "cash");
  const practiceDeal = respDeal.filter((x) => x.mode === "practice");
  // const dealPlayerCount = (totalOnlinePlayers * 30) / 100;

  // const totalCashDealCount = parseInt((dealPlayerCount * 40) / 100);
  // const totalPracticeDealCount = parseInt((dealPlayerCount * 60) / 100);
  // await redisInstances.SET(`cash:Deal`, totalCashDealCount);
  // await redisInstances.SET(`practice:Deal`, totalPracticeDealCount);
  // const cashRandomDeal = await randomNumber(
  //   totalCashDealCount,
  //   cashDeal.length
  // );
  let totalCashDealCount = 0;
  for (const [i, data] of cashDeal.entries()) {
    let max = data.max ?? 500;
    let min = data.min ?? 1;
    let uCount = parseInt(randomNumberRange(min, max));
    totalCashDealCount = totalCashDealCount + uCount;
    await redisInstances.SET(`cash:Deal:${data._id}`, uCount);
    // logger.info(
    //   `cash:Deal:${data._id}`,uCount
    // );
    //await redisInstances.SET(`cash:Deal:${data._id}`, cashRandomDeal[i]);
  }
  await redisInstances.SET(`cash:Deal`, totalCashDealCount);
  // logger.info(
  //   `cash:Deal`,totalCashDealCount
  // );

  // const practiceRandomDeal = await randomNumber(
  //   totalCashPointCount,
  //   practiceDeal.length
  // );
  let totalPracticeDealCount = 0;
  for (const [i, data] of practiceDeal.entries()) {
    let max = data.max ?? 500;
    let min = data.min ?? 1;
    let uCount = parseInt(randomNumberRange(min, max));
    totalPracticeDealCount = totalPracticeDealCount + uCount;
    await redisInstances.SET(`practice:Deal:${data._id}`, uCount);
    // logger.info(
    //   `practice:Deal:${data._id}`,uCount
    // );
    // await redisInstances.SET(
    //   `practice:Deal:${data._id}`,
    //   practiceRandomDeal[i]
    // );
  }
  await redisInstances.SET(`practice:Deal`, totalPracticeDealCount);
  // logger.info(
  //   `practice:Deal`,totalPracticeDealCount
  // );
  let totalOnlinePlayers =
    totalCashPointCount +
    totalPracticePointCount +
    totalCashPool61Count +
    totalCashPool101Count +
    totalCashPool201Count +
    totalPracticePool61Count +
    totalPracticePool101Count +
    totalPracticePool201Count +
    totalCashDealCount +
    totalPracticeDealCount;
    // logger.info(
    //   `totalOnlinePlayers---1`,totalOnlinePlayers
    // );
  await redisInstances.SET(`totalOnlinePlayers`, totalOnlinePlayers);
  // logger.info(
  //   `totalOnlinePlayers---2`,totalOnlinePlayers
  // );
};

const randomNumberRange = (min, max) => {
  return Math.random() * (max - min) + min;
};

const updateUserAccount = async () => {

  // let workbook = XLSX.readFile("./upload/UserData.xlsx");
  // let sheet_name_list = workbook.SheetNames;
  // let xlData = XLSX.utils.sheet_to_json(workbook.Sheets[sheet_name_list[0]]);
  // logger.info(xlData);

  let users = await db.collection("game_users").find({}).project({ _id: 1, phn: 1, unique_id: 1 }).toArray();
  // Printing data
  for (const iterator of users) {
    await db.collection("user_payment").insertOne({
      userId: users._id,
      phn: users.phn,
      unique_id: users.unique_id,
      transactionId: await getRandomString(10, "user_payment", "transactionId"),
      status: "SUCCESS",
      mode: "CASH ADDED",
      amount: iterator[" TOTAL CASH NET BALANCE "] != "-" ? iterator[" TOTAL CASH NET BALANCE "] : 0,
      paymentFlag: "Forwarded Cash",
      create_date: moment.utc(`2023-04-01T00:00:00+05:30`)._d,
    });
  }

};

const settle = async () => {

  // let current_time=new Date();
  // current_time.setDate(15)
  // // {ctt:{$lt:current_time},"pi._ir":0}
  logger.info("Database connected  successfully----live--->>>>>:", "DB connected");
  let tables = await db.collection("playing_table").find({ tjid: "3652292101" }).toArray();
  for (let table of tables) {
    await db.collection("playing_table").updateOne({ _id: getInfo.MongoID(table._id) }, { $set: { ctt: new Date() } });
    let { pi } = table;
    for (let user of pi) {
      if (user._ir == 0) {
        findTableAndJoinClass.findTableExistence(user, false, table.fromRematch);
        console.log("check");
      }
    }
  }
};

setTimeout(() => {
  // settle();
  
}, 3000);

module.exports = { updateLobbyCount };

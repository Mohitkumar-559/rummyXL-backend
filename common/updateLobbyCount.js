const { getRedisInstances } = require("../connections/redis");
const { getRedis } = require("../classes/redis.class");
// const { db } = require("../connections/mongodb");

const updateLobbyCount = async () => {
  const redisInstances = getRedisInstances();
  const totalOnlinePlayers = await getRedis(`totalOnlinePlayers`);
  const pointPlayerCount = (totalOnlinePlayers * 30) / 100;

  //for point
  let resp = await db.collection("point_category").find().toArray();

  const cash = resp.filter((x) => x.mode === "cash");
  const practice = resp.filter((x) => x.mode === "practice");

  const totalCashPointCount = parseInt((pointPlayerCount * 40) / 100);
  const totalPracticePointCount = parseInt((pointPlayerCount * 60) / 100);
  await redisInstances.SET(`cash:Points`, totalCashPointCount);
  await redisInstances.SET(`practice:Points`, totalPracticePointCount);
  const cashRandom = await randomNumber(totalCashPointCount, cash.length);
  for (const [i, data] of cash.entries()) {
    await redisInstances.SET(`cash:Points:${data._id}`, cashRandom[i]);
  }

  const practiceRandom = await randomNumber(
    totalCashPointCount,
    practice.length
  );

  for (const [i, data] of practice.entries()) {
    await redisInstances.SET(`practice:Points:${data._id}`, practiceRandom[i]);
  }

  //for pool
  let respPool = await db.collection("pool_category").find().toArray();
  const cashPool = respPool.filter((x) => x.mode === "cash");
  const practicepool = respPool.filter((x) => x.mode === "practice");
  const poolPlayerCount = (totalOnlinePlayers * 40) / 100;

  const totalCashPoolCount = parseInt((poolPlayerCount * 40) / 100);
  const totalPracticePoolCount = parseInt((poolPlayerCount * 60) / 100);
  await redisInstances.SET(`cash:Pool`, totalCashPoolCount);
  await redisInstances.SET(`practice:Pool`, totalPracticePoolCount);
  const cashRandomPool = await randomNumber(
    totalCashPoolCount,
    cashPool.length
  );
  for (const [i, data] of cashPool.entries()) {
    await redisInstances.SET(`cash:Pool:${data._id}`, cashRandomPool[i]);
  }

  const practiceRandomPool = await randomNumber(
    totalCashPointCount,
    practicepool.length
  );

  for (const [i, data] of practicepool.entries()) {
    await redisInstances.SET(
      `practice:Pool:${data._id}`,
      practiceRandomPool[i]
    );
  }

  //for Deal
  let respDeal = await db.collection("deal_category").find().toArray();
  const cashDeal = respDeal.filter((x) => x.mode === "cash");
  const practiceDeal = respDeal.filter((x) => x.mode === "practice");
  const dealPlayerCount = (totalOnlinePlayers * 30) / 100;

  const totalCashDealCount = parseInt((dealPlayerCount * 40) / 100);
  const totalPracticeDealCount = parseInt((dealPlayerCount * 60) / 100);
  await redisInstances.SET(`cash:Deal`, totalCashDealCount);
  await redisInstances.SET(`practice:Deal`, totalPracticeDealCount);
  const cashRandomDeal = await randomNumber(
    totalCashDealCount,
    cashDeal.length
  );
  for (const [i, data] of cashDeal.entries()) {
    await redisInstances.SET(`cash:Deal:${data._id}`, cashRandomDeal[i]);
  }

  const practiceRandomDeal = await randomNumber(
    totalCashPointCount,
    practiceDeal.length
  );

  for (const [i, data] of practiceDeal.entries()) {
    await redisInstances.SET(
      `practice:Deal:${data._id}`,
      practiceRandomDeal[i]
    );
  }
};

const randomNumber = async (gameAmount, gameCount) => {
  let minVal = Math.round(gameAmount / gameCount / 2);

  const randomDist = (
    buckets,
    total,
    { factor = 1, min = minVal || 10 } = {}
  ) =>
    Array(total * factor - buckets * min)
      .fill(1)
      .reduce((res, _) => {
        res[Math.floor(Math.random() * buckets)] += 1;
        return res;
      }, Array(buckets).fill(min))
      .map((n) => n / factor);

  return randomDist(gameCount, gameAmount);
};

module.exports = updateLobbyCount;

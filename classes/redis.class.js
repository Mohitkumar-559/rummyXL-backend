const { getRedisInstances } = require("../connections/redis");

const increment = async (mode) => {
  const redisInstances = getRedisInstances();
  redisInstances.incr(`${mode}`);
};

const decrement = async (mode) => {
  const redisInstances = getRedisInstances();
  let reply = await redisInstances.GET(`${mode}`);
  if (+reply <= 0) {
    await redisInstances.SET(`${mode}`, 0);
  } else {
    redisInstances.decr(`${mode}`);
  }
};

const getKeys = async (mode) => {
  return new Promise(async (resolve, reject) => {
    const redisInstances = getRedisInstances();

    const keys = await redisInstances.KEYS(`${mode}*`);
    if (keys.length) {
      let jobs = [];
      for (let i = 0; i < keys.length; i++) {
        const value = await redisInstances.GET(keys[i]);
        let job = {};
        job.jobId = keys[i];
        job.count = value;
        jobs.push(job);
        if (keys.length === i + 1) {
          resolve(jobs);
        }
      }
    } else resolve([]);
  });
};

const getRedis = async (key) => {
  const redisInstances = getRedisInstances();
  return await Promise.resolve(redisInstances.GET(key));
};

module.exports = { increment, decrement, getKeys, getRedis };

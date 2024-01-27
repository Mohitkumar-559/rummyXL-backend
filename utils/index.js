const sharp = require("sharp");
const randomString = require("randomstring");

const getTableName = (type) => {
  if (type === "Points") {
    return "point_category";
  }
  return type === "Pool" ? "pool_category" : "deal_category";
};

async function getRandomId(number, tableName, keyName) {
  let randomId = await randomNumber(number);
  let userData = await db
    .collection(tableName)
    .countDocuments({ [keyName]: randomId });
  if (userData) {
    return getRandomId(number, tableName, keyName);
  }
  return randomId.toString();
}

function month2digits(month) {
  return (month < 10 ? "0" : "") + month;
}

async function getYearMonthRandomId(number, tableName, keyName) {
  let date = new Date();
  let year = date.getFullYear().toString().slice(-2);
  let month = month2digits(date.getMonth() + 1);

  let randomId = `${year}${month}${await randomNumber(number)}`;
  let userData = await db
    .collection(tableName)
    .countDocuments({ [keyName]: randomId });
  if (userData) {
    return getYearMonthRandomId(number, tableName, keyName);
  }
  return randomId.toString();
}

async function randomNumber(number) {
  return Math.floor(
    Math.pow(10, number - 1) + Math.random() * 9 * Math.pow(10, number - 1)
  );
}

async function convertUsername(mobile) {
  let starString = "",
    isAllowStar = 0,
    pattenNo = 0;
  for (const element of mobile) {
    pattenNo += 1;
    let newString = element;
    if (pattenNo > 2 || isAllowStar > 0) {
      if (isAllowStar == 0) {
        pattenNo = 0;
      }
      isAllowStar += 1;
      newString = "*";
      if (isAllowStar == 2) {
        isAllowStar = 0;
        pattenNo = 0;
      }
    }
    starString += `${newString}`;
  }
  return starString;
}

function timeout(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const imageCompress = async (Buffer) => {
  return await sharp(Buffer).webp({ quality: 1 }).toBuffer();
};

const getRandomString = async (number, tableName, keyName, prefix = false) => {
  let randomId = prefix ? `${prefix}_${randomString.generate(number)}` : randomString.generate(number);
  let userData = await db.collection(tableName).countDocuments({ [keyName]: randomId });
  if (userData) {
    return getRandomString(number, tableName, keyName, prefix);
  }
  return randomId.toString();
};



// setTimeout(() => {
//   logger.info(JSON.stringify(Object.fromEntries(Object.entries(configData).sort())));
// }, 3000);



module.exports = {
  getTableName,
  getRandomId,
  convertUsername,
  timeout,
  getYearMonthRandomId,
  imageCompress,
  getRandomString
};

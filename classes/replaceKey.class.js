const _ = require("lodash");
const { OLDTONEW, NEWTOOLD } = require("../constants").userKeyConstants;
const replaceKeyOldToNew = (newObject) =>
  _.transform(newObject, (result, value, key) => {
    const currentKey = OLDTONEW[key] || key;

    if (
      value instanceof Array &&
      (key == "pi" ||
        key == "tcards" ||
        key == "pChips" ||
        key == "response" ||
        key == "tableHistory" ||
        key == "playersList" ||
        key == "dropArr")
    ) {
      const updateArray = [];
      for (const iterator of value) {
        updateArray.push(replaceKeyOldToNew(iterator));
      }
      result[currentKey] = updateArray;
    } else {
      result[currentKey] =
        value instanceof Object && value.constructor === Object && key !== "_id"
          ? replaceKeyOldToNew(value)
          : value;
    }
  });

const replaceKeyNewToOld = (newObject) =>
  _.transform(newObject, (result, value, key) => {
    const currentKey = NEWTOOLD[key] || key;
    result[currentKey] =
      value instanceof Object && value.constructor === Object && key !== "_id"
        ? replaceKeyNewToOld(value)
        : value;
  });

module.exports = { replaceKeyOldToNew, replaceKeyNewToOld };

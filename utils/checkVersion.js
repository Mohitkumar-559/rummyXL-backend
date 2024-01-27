const logger = require('../utils/logger');

async function checkApkVersion(version, storeUser) {
  logger.info("version----------->", version, storeUser);
  //find version in CMS
  let query = {};
  if (storeUser == "true") {
    query = { googleAPK: true };
  }
  const apkVersion = await db.collection("ApkVersion").findOne(query);
  logger.info("apkVersion----------->", apkVersion);

  // if true than skip kri sake, false hoy forcefully
  let url = apkVersion.url ? apkVersion.url : "";
  /* if (!apkVersion.skip) {
        url = apkVersion.url;
    } */

  if (apkVersion.apk_version != version) {
    return {
      flag: true,
      live_version: apkVersion.apk_version,
      current_version: version,
      skip: apkVersion.skip,
      latestApkUrl: url,
    };
  } else {
    return {
      flag: false,
      live_version: apkVersion.apk_version,
      current_version: version,
    };
  }
}

module.exports = checkApkVersion;

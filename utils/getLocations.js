const axios = require("axios");
const _ = require("underscore");
const { GetConfig } = require("../connections/mongodb");
const logger = require('../utils/logger');

const getLocations = async ({ latitude, longitude }) => {
  try {
    const { BLOCK_STATE } = GetConfig();
    const configRequest = {
      method: "get",
      url: `${process.env.LOCATION_URL}latitude=${latitude}&longitude=${longitude}&key=${process.env.LOCATION_KEY}`,
      headers: {},
    };
    // logger.info("configRequest", new Date(), configRequest);
    let response = await axios(configRequest);
    response = await response.data;
    // logger.info("response", new Date(), response);

    const country = response.countryCode == "IN" ? false : true;
    return {
      checkLocation:
        _.contains(BLOCK_STATE, response.principalSubdivision) ||
        country,
      locationData: response,
    };
  } catch (error) {
    console.error(error);
  }
};

module.exports = getLocations;

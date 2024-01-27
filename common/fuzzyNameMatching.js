const {
    idfy_BaseURL,
    idfyAccountId,
    idfyKey,
  } = require("../utils/config");
  const axios = require("axios").default;
  const logger = require("../utils/logger");

async function fuzzyNameMatching(UPIResponse, fullName, user) {
    //verfiy the name pan card the name fuzzy api
    try {
      const group_id = user.unique_id;
      const headers = {
        "Content-Type": "application/json",
        "account-id": idfyAccountId,
        "api-key": idfyKey,
      };
  
      const baseurl_fuzzy = idfy_BaseURL + `tasks/sync/compare/ind_names`;
      //if request coming from UPI then
      if (!UPIResponse.data) {
        UPIResponse.data = {};
        UPIResponse.data.data = {};
        UPIResponse.data.data.full_name = "";
        UPIResponse.data.data.upistatus = "";
        UPIResponse.data.data.match_score = 0;
        UPIResponse.data.message = "";
        UPIResponse.data.message = UPIResponse.result;
        if (UPIResponse.status == "completed") {
          UPIResponse.data.status = "success";
        } else {
          UPIResponse.data.status = "failed";
        }
        if (UPIResponse.result.account_exists == "YES") {
          UPIResponse.data.data.account_exists = true;
        }
        if (UPIResponse.result.account_exists == "NO") {
          UPIResponse.data.data.account_exists = false;
        }
        UPIResponse.data.data.full_name = UPIResponse.result.name_at_bank;
      }
      let request_options2 = {
        method: "post",
        url: baseurl_fuzzy,
        headers: headers,
        data: JSON.stringify({
          task_id: user._id.toString(),
          group_id: group_id,
          data: {
            name1: UPIResponse.data.data.full_name,
            name2: fullName,
          },
        }),
      };
      let FuzzyResponse = await axios(request_options2);
      console.log("name after matching ------------->",UPIResponse.data.data.full_name,fullName);
      if (FuzzyResponse.data && FuzzyResponse.data.status == "completed") {
        const getScore = parseInt(
          FuzzyResponse.data.result.match_output.name_match
        );
        console.log("getScore------------->", getScore);
        //setting up the status of name match
        let upistatus = "REJECTED";
  
        if (getScore == 1) {
          upistatus = "REJECTED";
        } else if (getScore == 2) {
          upistatus = "PENDING";
        } else {
          upistatus = "SUCCESS";
        }
        UPIResponse.data.data.upistatus = upistatus;
        UPIResponse.data.data.match_score = getScore;
  
        logger.info("Data for fuzzyname sccore===>", getScore);
        return {
          message: UPIResponse.data.message,
          status: UPIResponse.data.status,
          data: UPIResponse.data.data,
          account_exists: UPIResponse.data.data.account_exists,
        };
      } else {
        return {
          message: FuzzyResponse.data.message,
          status: FuzzyResponse.data.status,
          account_exists: UPIResponse.data.data.account_exists,
        };
      }
    } catch (error) {
      if (error.response) {
        return {
          status_code: error.response.status,
          success: false,
          error: error.response.data.error,
          api: "fuzzy",
          account_exists: UPIResponse.data.data.account_exists,
        };
      } else {
        return {
          status_code: error.response.status,
          success: false,
          error: error.response.data.error,
          api: "fuzzy",
          account_exists: UPIResponse.data.data.account_exists,
        };
      }
    }
  }

  module.exports = fuzzyNameMatching;

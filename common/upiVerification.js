const {
    idfy_BaseURL,
    idfyAccountId,
    idfyKey,
  } = require("../utils/config");
const axios = require("axios").default;
const logger = require("../utils/logger");

async function verifyUPI(upi_handle, full_name, user) {
    logger.info("verify the UPI------------->", upi_handle);
  
    try {
      logger.info("idfyAccountId--------->", idfyAccountId);
      logger.info("idfyKey--------->", idfyKey);
  
      const group_id = user.unique_id;
      const headers = {
        "Content-Type": "application/json",
        "account-id": idfyAccountId,
        "api-key": idfyKey,
      };
      const verify_url = idfy_BaseURL + `tasks/async/verify_with_source/ind_vpa`;
      let request_options2 = {
        method: "post",
        url: verify_url,
        headers: headers,
        data: JSON.stringify({
          task_id: user._id.toString(),
          group_id: group_id,
          data: {
            vpa: upi_handle,
          },
        }),
      };
  
      let UPIResponse = await axios(request_options2);
      if (UPIResponse.status && UPIResponse.status == 202) {
        return {
          message: "UPI is under review",
          status: true,
          request_id: UPIResponse.data.request_id,
        };
        
      } else {
        return { status: false, message: "UPI verification FAILED", status: "FAILED" };
      }
    } catch (error) {
      if (error.response && error.response.status != 404) {
        logger.info("/VERIFY UPI------------------->>>>> error", error);
        return {
          status_code: error.response.status,
          status: false,
          error: error.response.data.error,
          api: "UPI verification FAILED",
        };
      } else {
        logger.info("/VERIFY UPI------------------->>>>> error", error);
        return {
          status_code: 400,
          status: false,
          error: error.response.data.error,
          api: "UPI verification FAILED",
        };
      }
    }
}
module.exports={
    verifyUPI
}
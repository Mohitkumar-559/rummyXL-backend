const ifscFetch = require("ifsc");
const fuzzyNameMatching = require("../common/fuzzyNameMatching");
const {
    idc_apikey,
    base_url_kyc,
} = require("../utils/config");
const axios = require("axios").default;
const logger = require("../utils/logger");
const { baseResponse } = require("../constants/baseResponse");
const isPennyLessBank = async (ifsc) => {
    const bankListPennyless = await db
      .collection("pennyLessList")
      .find()
      .toArray();
    const listPennyLessIfsc = bankListPennyless.map((bank) => {
      return bank.Ifsc;
    });
    const getIntials = ifsc.substring(0, 4).toUpperCase();
    // if (listPennyLessIfsc.includes(getIntials)) {
    //   return true;
    // }
    // else {
    //   return false;
    // }
    return listPennyLessIfsc.includes(getIntials);
  };
//penyLess api
async function pennyLessApiOrPennyDrop(
    user,
    accountNumber,
    ifscCode,
    account_holder_name,
    pennyDrop
  ) {
    //logger.info("verify the UPI------------->", upi_handle);
    const headers = {
      "Content-Type": "application/json",
      "api-key": idc_apikey,
    };
    let verify_url = base_url_kyc + `/v2/bank/penny-less`;
    if (pennyDrop) {
      verify_url = base_url_kyc + `/v2/bank/penny-drop`;
    }
    const data = {
      account_number: accountNumber,
      ifsc: ifscCode,
      extended_data: true,
    };
    let request_options1 = {
      method: "post",
      url: verify_url,
      headers: headers,
      data: JSON.stringify({
        account_number: accountNumber,
        ifsc: ifscCode,
        extended_data: true,
      }),
    };
    try {
      let pennyLessAPi_res = await axios(request_options1);
      if (pennyLessAPi_res.data.status == "success") {
        if (pennyLessAPi_res.data.data.account_exists) {
          var resultData = await fuzzyNameMatching(
            pennyLessAPi_res,
            account_holder_name,
            user
          );
          resultData.name_at_bank = pennyLessAPi_res.data.data.full_name
          return resultData
  
        } else {
          return {
            status_code: 500,
            status: false,
            error: pennyLessAPi_res.data.error,
            message: pennyLessAPi_res.data.message || baseResponse.ACCOUNT_NOT_EXIST,
          };
        }
      } else {
        //record the data and schudle cron event
        return {
          message: pennyLessAPi_res.data.message,
          status: pennyLessAPi_res.data.status,
        };
      }
    } catch (error) {
      console.log("error-------->", error);
      logger.info(
        "/PENNY DROP AND PENNY LESS API------------------->>>>> error",
        error
      );
      if (error.response && error.response.status == 500) {
        //its means account not found with api
        return {
          status_code: error.response.status,
          status: false,
          error: error.response.data,
          message: baseResponse.ACCOUNT_NOT_EXIST,
        };
      } else {
        return {
          status_code: 400,
          status: false,
          error: error.response.data.error,
          message: baseResponse.ACCOUNT_REVIEW,
          api: "Penny Drop: " + pennyDrop,
        };
      }
    }
  }
async function bankValidationRest(user,accountNumber,ifsc,registered_name){

    let APIresponse = {status_code:500};
      let penny_status = "pennyLess";
      if (ifscFetch.validate(ifsc)) {
        if (await isPennyLessBank(ifsc)) {
          logger.info("bank in penny less list", ifsc);
          logger.info("bank in penny less list");
          APIresponse = await pennyLessApiOrPennyDrop(
            user,
            accountNumber,
            ifsc,
            registered_name,
            false
          );
          penny_status = "pennyLess";
        }
        logger.info("APIresponse--------->>>>", APIresponse);
        if (APIresponse.status_code == 500) {
          //do penny drop with account
          logger.info("bank in penny drop list", ifsc);
          logger.info("bank in penny drop list");
          APIresponse = await pennyLessApiOrPennyDrop(
            user,
            accountNumber,
            ifsc,
            registered_name,
            true
          );
          penny_status = "pennyDrop";
        }
        return {
            status_code:200,
            data:{
                success: true,
                errorCode: "0000",
                Type: "Response",
                data: APIresponse,
                penny_status:penny_status,
                message: "Data Recived from bank validation"
            }
            
          };
    } else {
        return {
          status_code:200,
          data:{
            success: false,
            errorCode: "0000",
            Type: "Response",
            message: baseResponse.IFSC_INVALID,
          }
          
        };
      }
}
module.exports={
    bankValidationRest
}
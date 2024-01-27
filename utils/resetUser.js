const { GetConfig,TableHistory } = require("../connections/mongodb");
const getInfo = require("../common");
const logger = require("./logger");
const resetUser = async ()=>{
    try {
      logger.info("update user kyc count of all user");
      const { KYC_ATTEMP } = GetConfig();
      
      /* +---------------------------------------------------------------
         reset the kyc api PAN, Bank, UPi api
      --------------------------------------------------------------------*/
      const userCollection_bank_kyc_count = await db.collection("game_users").updateMany(
        { bank_kyc_count: { $gt: 1 }},
        { $set: { bank_kyc_count : 0 } 
      });
      const userCollection_bank_pan_count = await db.collection("game_users").updateMany(
        { pan_kyc_count: { $gt: 1 }},
        { $set: { pan_kyc_count : 0 } 
      });
      const userCollection_bank_upi_count = await db.collection("game_users").updateMany(
        { upi_kyc_count: { $gt: 1 }},
        { $set: { upi_kyc_count : 0 } 
      });
      
  
      /* ---------------------Code End----------------------------------- */
        
      
  
  
    } catch (error) {
      logger.error("-----> error red flag function", error);
      getInfo.exceptionError(error);
    }
  }
  module.exports = {
    resetUser
  }
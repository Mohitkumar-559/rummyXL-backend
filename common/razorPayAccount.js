const logger = require('../utils/logger');
const getInfo = require("../common");
const axios = require("axios").default;
const {
    razorpayKey,
    razorpaySecret,
  } = require("../utils/config");
//create contact for RazorpayX
async function createContact(userDetails) {
    try {
      logger.info("-------createContact---------->", userDetails);
      let name = userDetails.un;
      if (name.includes("*")) {
        name = userDetails.phn;
      }
      let createContactData = JSON.stringify({
        name: name,
        email: userDetails.ue,
        contact: userDetails.phn,
        type: "customer",
        reference_id: userDetails.unique_id,
      });
  
      // create contact details
      let createContactConfig = {
        method: "post",
        url: "https://api.razorpay.com/v1/contacts",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${Buffer.from(
            [razorpayKey] + ":" + razorpaySecret
          ).toString("base64")}`,
        },
        data: createContactData,
      };
  
      let razorpayContact = await axios(createContactConfig);
      razorpayContact = razorpayContact.data;
      return razorpayContact;
    } catch (error) {
      logger.info("error----createContact----->", error.response.data);
      return error;
    }
  }
  
  //create fundAccount for RazorpayX
  async function createFundAccount(userAccountDetails, razorpayContact) {
    try {
      logger.info(
        "userAccountDetails---------->",
        userAccountDetails,
        razorpayContact
      );
      let createFundAccountData;
      if (userAccountDetails.docType == "BANK") {
        createFundAccountData = JSON.stringify({
          contact_id: razorpayContact.id,
          account_type: "bank_account",
          bank_account: {
            name: razorpayContact.name,
            ifsc: userAccountDetails.ifsc,
            account_number: userAccountDetails.accountNumber,
          },
        });
      } else {
        createFundAccountData = JSON.stringify({
          contact_id: razorpayContact.id,
          account_type: "vpa",
          vpa: {
            address: userAccountDetails.upiId,
          },
        });
      }
  
      // create fund account details
      let createFundAccountConfig = {
        method: "post",
        url: "https://api.razorpay.com/v1/fund_accounts",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${Buffer.from(
            [razorpayKey] + ":" + razorpaySecret
          ).toString("base64")}`,
        },
        data: createFundAccountData,
      };
  
      let razorpayFundAccount = await axios(createFundAccountConfig);
      razorpayFundAccount = razorpayFundAccount.data;
      logger.info("razorpayFundAccount----------->", razorpayFundAccount);
  
      await db.collection("user_fund_account").findOneAndUpdate(
        {
          contactId: razorpayFundAccount.contact_id,
          userId: getInfo.MongoID(userAccountDetails.userId),
          fundAccounts: razorpayFundAccount.id,
        },
        {
          $set: {
            contactId: razorpayFundAccount.contact_id,
            userId: getInfo.MongoID(userAccountDetails.userId),
            fundAccounts: razorpayFundAccount.id,
            accountType: razorpayFundAccount.account_type,
            active: razorpayFundAccount.active,
            bankAccount:
              userAccountDetails.docType == "BANK"
                ? razorpayFundAccount.bank_account
                : razorpayFundAccount.vpa,
            createAt: new Date(),
            docType:
              userAccountDetails.docType == "BANK" ? "bank_account" : "vpa",
          },
        },
        { new: true, upsert: true }
      );
      return razorpayFundAccount;
    } catch (error) {
      logger.info("error----create fund account----->", error);
      return error.response;
    }
  }
module.exports={
    createFundAccount,
    createContact
}
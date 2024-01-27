const airpayResponseStatus = {

    200 : "SUCCESS",
    211 : "TRANSACTION_IN_PROCESS",
    400 : "FAILED",
    401 : "DROPPED",
    402 : "CANCEL" ,
    403 : "INCOMPLETE",
    405 : "BOUNCED",
    450 : "AWAITING_CONFIRMATION",
    503 : "NO_RECORDS"
};

exports.AirpayResponseStatus = airpayResponseStatus;

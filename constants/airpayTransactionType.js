const airpayResponseType = {

    310:"MANDATE_APPROVED",
    320:"SALE",
    330:"CAPTURE",
    340:"REFUND",
    350:"CHARGEBACK",
    360:"REVERSAL",
    370:"SALECOMPLETE",
    380:"SALEADJUST",
    390:"TIPADJUST",
    400:"SALE+CASH",
    410:"CASHBACK",
    420:"VOID",
    430:"RELEASE",
    440:"CASHWITHDRAWAL",
    450:"AWAITING CONFIRMATION"
};

exports.AirpayResponseType = airpayResponseType;

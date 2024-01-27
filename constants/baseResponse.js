const baseResponse = {

    TO_MANY_ATTEMPTED: "Too many attempts. Please try again 24 hours.",
    ACCOUNT_NOT_MATCH: "Account name doesn't match with the KYC name. Try again",
    ACCOUNT_REVIEW: "Reviewing Your bank-verification details",
    USER_NOT_FOUND: "User Not Found",
    PAN_SUMIT_INFO: "Please submit PAN document first and then Bank details.",
    IFSC_INVALID: "IFSC Code is invalid.",
    BANK_DETAILS_ALREADY_EXIT: "Bank details already added.",
    BANK_DETAILS_ALREADY_EXIT_2: "The bank details have provided by you is already exist in database. Please add another bank details.",
    BANK_ADDED: "Bank detail is added successfully",
    UPI_INVALID: "UPI ID is invalid.",
    IFSC_NOT_IN_LIST: "IFSC is not in list",
    ACCOUNT_NOT_EXIST: "Account doesn't exist",
    ACCOUNT_AT_PENDING: "Account at pending state",
    ACCOUNT_APPROVED: "One Account already APPROVED ",
    MAX_ISSUE_RAISED: "You are reached your daily limit for raise issue",
    ISSUE_INFO:"Your ticket has been submitted successfully",
    ISSUE_ERROR:"There was an error while submission, Please check all fields and try again."
};

exports.baseResponse = baseResponse;

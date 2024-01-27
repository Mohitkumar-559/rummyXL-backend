let url = process.env.LOCAL_URL,
  environment = process.env.environment,
  razorpayKey,
  razorpaySecret,
  otpTemplate,
  otpKey,
  idfyAccountId,
  idfyKey,
  EMAIL_USERNAME,
  EMAIL_PASSWORD,
  HOST,
  accessKeyId = process.env.S3KEYID,
  secretAccessKey = process.env.S3BUCKETSECRETKEYID,
  region = process.env.S3BUCKETREGION,
  bucket = process.env.BUCKETNAME,
  folderName = "dev",
  phonePeMerchantId, phonePeMerchantSaltKey, phonePeMerchantSaltIndex, phonePeMerchantHostUrl,
  goKwikMerchantId, goKwikAppKey, goKwikAppSecretKey, goKwikRequestUrl,
  idc_apikey = process.env.APIKEYKYC,
  base_url_kyc = process.env.BASE_URL_KYC,
  idfy_BaseURL = process.env.BASE_URL_KYC_IDFY,
  idfyAccountId_m = process.env.ACCOUNT_IDFY_M,
  idfyKey_m = process.env.API_KEY_IDFY_M,

  s3_key_id = process.env.S3KEYID,
  s3_bucket_secrete_key = process.env.S3BUCKETSECRETKEYID,
  s3_bucket_region = process.env.S3BUCKETREGION,

  apiKey_freshdesk= process.env.API_KEY_FRESHDESK,
  url_freshDesk= process.env.URL_FRESHDESK

const airPayMerchantId = process.env.AIRPAY_MERCHANT_ID;
const airPayUserName = process.env.AIRPAY_USERNAME;
const airPayPassword = process.env.AIRPAY_PASSWORD;
const airPayAPIkey = process.env.AIRPAY_API_KEY;
const airPayUrl = process.env.AIRPAY_HOST_URL_ORDER

if (process.env.environment == "development") {
  bucket = "rummyxl-cms-data",
  url = process.env.DEV_URL;
  razorpayKey = process.env.RAZORPAY_KEY_ID;
  razorpaySecret = process.env.RAZORPAY_SECRET_KEY;
  otpTemplate = process.env.OTP_TEMPLATE;
  otpKey = process.env.OTP_APIKEY;
  idfyAccountId = process.env.IDFY_ACCOUNTID;
  idfyKey = process.env.IDFY_APIKEY;
  EMAIL_USERNAME = process.env.EMAIL_USERNAME;
  EMAIL_PASSWORD = process.env.EMAIL_PASSWORD;
  HOST = process.env.HOST;
  folderName = "staging";
  phonePeMerchantId = process.env.PHONE_PE_MERCHANT_ID;
  phonePeMerchantSaltKey = process.env.PHONE_PE_SALT_KEY;
  phonePeMerchantSaltIndex = process.env.PHONE_PE_SALT_INDEX;
  phonePeMerchantHostUrl = process.env.PHONE_PE_HOST_URL;
  goKwikMerchantId = process.env.GOKWIK_MERCHANT_ID;
  goKwikAppKey = process.env.GOKWIK_APP_ID;
  goKwikAppSecretKey = process.env.GOKWIK_APP_SECRET;
  goKwikRequestUrl = process.env.GOKWIK_REQUEST_URL;

  idc_apikey = process.env.APIKEYKYC;
  base_url_kyc = process.env.BASE_URL_KYC; 
  idfy_BaseURL = process.env.BASE_URL_KYC_IDFY; 

  s3_key_id = process.env.S3KEYID,
  s3_bucket_secrete_key = process.env.S3BUCKETSECRETKEYID,
  s3_bucket_region = process.env.S3BUCKETREGION

  apiKey_freshdesk= process.env.API_KEY_FRESHDESK,
  url_freshDesk= process.env.URL_FRESHDESK

}
if (process.env.environment == "production") {
  bucket = "rummyxl-cms-data",
  url = process.env.LIVE_URL;
  razorpayKey = process.env.RAZORPAY_KEY_ID;
  razorpaySecret = process.env.RAZORPAY_SECRET_KEY;
  otpTemplate = process.env.OTP_TEMPLATE;
  otpKey = process.env.OTP_APIKEY;
  idfyAccountId = process.env.IDFY_ACCOUNTID;
  idfyKey = process.env.IDFY_APIKEY;
  EMAIL_USERNAME = process.env.EMAIL_USERNAME;
  EMAIL_PASSWORD = process.env.EMAIL_PASSWORD;
  HOST = process.env.HOST;
  folderName = "live";
  phonePeMerchantId = process.env.PHONE_PE_MERCHANT_ID;
  phonePeMerchantSaltKey = process.env.PHONE_PE_SALT_KEY;
  phonePeMerchantSaltIndex = process.env.PHONE_PE_SALT_INDEX;
  phonePeMerchantHostUrl = process.env.PHONE_PE_HOST_URL;
  goKwikMerchantId = process.env.GOKWIK_MERCHANT_ID;
  goKwikAppKey = process.env.GOKWIK_APP_ID;
  goKwikAppSecretKey = process.env.GOKWIK_APP_SECRET;
  goKwikRequestUrl = process.env.GOKWIK_REQUEST_URL;

  idc_apikey = process.env.APIKEYKYC;
  base_url_kyc = process.env.BASE_URL_KYC;
  idfy_BaseURL = process.env.BASE_URL_KYC_IDFY;
  idfyAccountId_m = process.env.ACCOUNT_IDFY_M;;
  idfyKey_m = process.env.API_KEY_IDFY_M;

  s3_key_id = process.env.S3KEYID,
  s3_bucket_secrete_key = process.env.S3BUCKETSECRETKEYID,
  s3_bucket_region = process.env.S3BUCKETREGION

  apiKey_freshdesk= process.env.API_KEY_FRESHDESK,
  url_freshDesk= process.env.URL_FRESHDESK

}
if (process.env.environment == "staging") {
  bucket = "rummyxl-cms-data",
  url = process.env.STAGING_URL;
  razorpayKey = process.env.RAZORPAY_KEY_ID;
  razorpaySecret = process.env.RAZORPAY_SECRET_KEY;
  otpTemplate = process.env.OTP_TEMPLATE;
  otpKey = process.env.OTP_APIKEY;
  idfyAccountId = process.env.IDFY_ACCOUNTID;
  idfyKey = process.env.IDFY_APIKEY;
  EMAIL_USERNAME = process.env.EMAIL_USERNAME;
  EMAIL_PASSWORD = process.env.EMAIL_PASSWORD;
  HOST = process.env.HOST;
  folderName = "staging";
  phonePeMerchantId = process.env.PHONE_PE_MERCHANT_ID;
  phonePeMerchantSaltKey = process.env.PHONE_PE_SALT_KEY;
  phonePeMerchantSaltIndex = process.env.PHONE_PE_SALT_INDEX;
  phonePeMerchantHostUrl = process.env.PHONE_PE_HOST_URL;
  goKwikMerchantId = process.env.GOKWIK_MERCHANT_ID;
  goKwikAppKey = process.env.GOKWIK_APP_ID;
  goKwikAppSecretKey = process.env.GOKWIK_APP_SECRET;
  goKwikRequestUrl = process.env.GOKWIK_REQUEST_URL;

  idc_apikey = process.env.APIKEYKYC;
  base_url_kyc = process.env.BASE_URL_KYC;
  idfy_BaseURL = process.env.BASE_URL_KYC_IDFY;

  s3_key_id = process.env.S3KEYID,
  s3_bucket_secrete_key = process.env.S3BUCKETSECRETKEYID,
  s3_bucket_region = process.env.S3BUCKETREGION

  apiKey_freshdesk= process.env.API_KEY_FRESHDESK,
  url_freshDesk= process.env.URL_FRESHDESK

}

module.exports = {
  url,
  environment,
  razorpayKey,
  razorpaySecret,
  otpTemplate,
  otpKey,
  idfyAccountId,
  idfyKey,
  EMAIL_USERNAME,
  EMAIL_PASSWORD,
  HOST,
  accessKeyId,
  secretAccessKey,
  region,
  bucket,
  folderName,
  phonePeMerchantId,
  phonePeMerchantSaltKey,
  phonePeMerchantSaltIndex,
  phonePeMerchantHostUrl,
  goKwikMerchantId,
  goKwikAppKey,
  goKwikAppSecretKey,
  goKwikRequestUrl,
  idc_apikey,
  base_url_kyc,
  idfy_BaseURL,
  idfyAccountId_m,
  idfyKey_m,

  s3_key_id,
  s3_bucket_secrete_key,
  s3_bucket_region,


  apiKey_freshdesk,
  url_freshDesk,
  airPayMerchantId,
  airPayUserName,
  airPayPassword,
  airPayAPIkey,
};

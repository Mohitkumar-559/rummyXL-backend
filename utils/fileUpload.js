const logger = require("./logger");
const { accessKeyId, secretAccessKey, region, bucket, folderName } = require("../utils/config");
const getInfo = require("../common");
const { S3Client } = require("@aws-sdk/client-s3");
const { Upload } = require('@aws-sdk/lib-storage');
const credentials = { region, accessKeyId, secretAccessKey };
const client = new S3Client({ credentials, region: region });

const fileUploadByUnique = async ({ fileContent, folderCategoryLocation, fileCategoryName, uniqueId, folderType, extension }) => {
  try {
    const upload = new Upload({
      client: client,
      params: {
        Bucket: bucket,
        Key: `${folderName}/${folderType}/${folderCategoryLocation}/${fileCategoryName}_${uniqueId}.${extension}`,
        Body: fileContent,
      },
    });

    return await upload.done();
  } catch (error) {
    logger.error("-----> error fileUploadV3", error);
    getInfo.exceptionError(error);
  }
};

const fileUpload = async ({ fileContent, folderCategoryLocation, fileCategoryName, uniqueId, folderType, extension, contentType }) => {
  try {

    let paramsObj = {
      Bucket: bucket,
      Key: `${folderName}/${folderType}/${folderCategoryLocation}/${fileCategoryName}_${uniqueId}_${Date.now()}.${extension}`,
      Body: fileContent,
    };
    if (contentType) {
      paramsObj = {
        ...paramsObj, ContentType: contentType
      };
    }
    const upload = new Upload({
      client: client,
      params: paramsObj
    });

    return upload.done();
  } catch (error) {
    logger.error("-----> error fileUploadV3", error);
    getInfo.exceptionError(error);
  }
};


module.exports = { fileUpload, fileUploadByUnique };

const nodemailer = require("nodemailer");
const { encrypt } = require("./crypto");
const fs = require("fs");
const handlebars = require("handlebars");
const path = require("path");
const { HOST, EMAIL_USERNAME, EMAIL_PASSWORD, url } = require("./config");
const logger = require('../utils/logger');

async function sendMail(email, subject, template_path) {
  try {
    const transporter = nodemailer.createTransport({
      host: HOST,
      pool: true,
      service: "Gmail",
      port: 587,
      secure: true,
      auth: {
        user: EMAIL_USERNAME,
        pass: EMAIL_PASSWORD,
      },
    });
    logger.info("url------------>", url);
    const filePath = path.join(__dirname, template_path);
    const source = fs.readFileSync(filePath, "utf-8").toString();
    const template = handlebars.compile(source);
    let htmlToSend;
    if (subject == "Verify Email") {
      const encryptEmail = encrypt(email);
      const replacements = {
        email: encryptEmail,
        url,
      };
      htmlToSend = template(replacements);
    } else {
      htmlToSend = template();
    }

    await transporter.sendMail({
      from: EMAIL_USERNAME,
      to: email,
      subject: subject,
      html: htmlToSend,
    });
    logger.info("email sent sucessfully");
  } catch (error) {
    logger.info("email not sent");
    logger.info(error);
  }
}

module.exports = sendMail;

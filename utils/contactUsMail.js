const nodemailer = require("nodemailer");
const { HOST, EMAIL_USERNAME, EMAIL_PASSWORD } = require("./config");

async function contactUsMail(userEmail, subject, description) {
  try {
    let transport = nodemailer.createTransport({
      pool: true,
      host: HOST,
      service: "Gmail",
      port: 465,
      auth: {
        user: EMAIL_USERNAME,
        pass: EMAIL_PASSWORD,
      },
    });

    let info = await transport.sendMail({
      from: userEmail, // sender address
      to: EMAIL_USERNAME, // list of receivers
      subject: subject, // Subject line
      text: `userEmail: ${userEmail} \n\description: ${description}`, // plain text body
    });

    console.log("info.response========", info);
    console.log("Message sent: %s", info.messageId);
    console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));
  } catch (error) {
    console.log("email not sent");
    console.log(error);
  }
}

module.exports = contactUsMail;

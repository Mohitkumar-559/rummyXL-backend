//Checking the crypto module
const Crypto = require("crypto");
let secret_key = "fd85b494-aaaa";
let secret_iv = "smslt";
let encryptionMethod = "AES-256-CBC";
let key = Crypto.createHash("sha512")
  .update(secret_key, "utf-8")
  .digest("hex")
  .substr(0, 32);
let iv = Crypto.createHash("sha512")
  .update(secret_iv, "utf-8")
  .digest("hex")
  .substr(0, 16);

//Encrypting text
function encrypt(text) {
  let encryptor = Crypto.createCipheriv(encryptionMethod, key, iv);
  let aes_encrypted =
    encryptor.update(text, "utf8", "base64") + encryptor.final("base64");
  return Buffer.from(aes_encrypted).toString("base64");
}

// Decrypting text
function decrypt(encryptText) {
  const buff = Buffer.from(encryptText, "base64");
  encryptText = buff.toString("utf-8");
  let decryptor = Crypto.createDecipheriv(encryptionMethod, key, iv);
  return (
    decryptor.update(encryptText, "base64", "utf8") + decryptor.final("utf8")
  );
}

module.exports = {
  encrypt,
  decrypt,
};

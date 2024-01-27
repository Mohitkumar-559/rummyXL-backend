"use strict";
const Joi = require("joi");
exports.onValidatorchema = (body) => {
     const schema = Joi.object({
        contestId :  Joi.string(),
        gameId : Joi.string().required(),
     });
     const options = {
          abortEarly: false, // include all errors
          allowUnknown: true, // ignore unknown props
          stripUnknown: true // remove unknown props
     }
     const { error, value } = schema.validate(body, options);
     if (error) throw createCustomError();
     return value;
}
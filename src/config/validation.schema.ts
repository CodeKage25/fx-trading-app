import * as Joi from 'joi';

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3000),

  DB_HOST: Joi.string().default('localhost'),
  DB_PORT: Joi.number().default(5432),
  DB_USERNAME: Joi.string().default('postgres'),
  DB_PASSWORD: Joi.string().default('postgres'),
  DB_DATABASE: Joi.string().default('fx_trading'),

  JWT_SECRET: Joi.string().required(),
  JWT_EXPIRES_IN: Joi.string().default('15m'),

  MAIL_HOST: Joi.string().default('smtp.gmail.com'),
  MAIL_PORT: Joi.number().default(587),
  MAIL_USER: Joi.string().required(),
  MAIL_PASS: Joi.string().required(),
  MAIL_FROM: Joi.string().default('FX Trading App <noreply@fxapp.com>'),

  FX_API_KEY: Joi.string().required(),
  FX_API_BASE_URL: Joi.string().default(
    'https://v6.exchangerate-api.com/v6',
  ),
  FX_CACHE_TTL: Joi.number().default(60000),

  SUPPORTED_CURRENCIES: Joi.string().default('NGN,USD,EUR,GBP,CAD,JPY'),
});

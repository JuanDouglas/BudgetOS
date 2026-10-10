import dotenv from 'dotenv';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const isProd = process.env.NODE_ENV === 'production';

// Well-known placeholder secrets that must never be accepted in production.
const WEAK_SECRETS = new Set([
  'dev-secret-change-me',
  'change-me-in-production',
  'changeme',
  'secret',
  'password',
  'budgetos',
]);

const isStrongSecret = (s) => typeof s === 'string' && s.length >= 32 && !WEAK_SECRETS.has(s);

/**
 * Resolve the session secret.
 * - A strong SESSION_SECRET (>= 32 chars, not a known placeholder) is always used.
 * - In development, a stable weak default is acceptable.
 * - In production without a strong secret: reject an explicitly-set weak value
 *   (loud misconfiguration), otherwise generate one and persist it to the data
 *   volume so it survives restarts (a fresh secret each boot would drop sessions).
 */
function resolveSessionSecret() {
  const provided = process.env.SESSION_SECRET;

  if (isStrongSecret(provided)) return provided;

  if (!isProd) {
    return provided && provided.length ? provided : 'dev-secret-change-me';
  }

  if (provided) {
    throw new Error(
      'SESSION_SECRET is set but too weak. Use a unique random value of >= 32 chars ' +
      '(generate one with: openssl rand -hex 32), or unset it to auto-generate a persisted secret.'
    );
  }

  const dataDir = path.resolve(__dirname, '../../data');
  const secretFile = path.join(dataDir, '.session-secret');
  try {
    if (fs.existsSync(secretFile)) {
      const existing = fs.readFileSync(secretFile, 'utf-8').trim();
      if (isStrongSecret(existing)) return existing;
    }
    fs.mkdirSync(dataDir, { recursive: true });
    const generated = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(secretFile, generated, { mode: 0o600 });
    return generated;
  } catch (err) {
    throw new Error(
      `SESSION_SECRET is not set and a secret could not be generated at ${secretFile}: ${err.message}. ` +
      'Set SESSION_SECRET to a strong random value (openssl rand -hex 32).'
    );
  }
}

// Whether the deployment is served over HTTPS. Drives both the Secure cookie
// flag and the CSP "upgrade-insecure-requests" directive, so they stay in sync.
// Explicit COOKIE_SECURE wins; otherwise ON in production, OFF in development.
// Must be OFF for plain-HTTP installs, else the browser upgrades asset requests
// to HTTPS and the page fails to load (blank page).
const httpsEnabled = process.env.COOKIE_SECURE === 'true'
  || (process.env.COOKIE_SECURE !== 'false' && isProd);

const config = {
  env: process.env.NODE_ENV || 'development',
  isDev: process.env.NODE_ENV !== 'production',
  isProd,

  server: {
    port: parseInt(process.env.PORT, 10) || 3000,
    host: process.env.HOST || 'localhost',
  },

  session: {
    secret: resolveSessionSecret(),
    secure: httpsEnabled,
    maxAge: parseInt(process.env.SESSION_MAX_AGE, 10) || 86400000, // 24h
    name: 'budgetos.sid',
  },
  
  database: {
    type: process.env.DB_TYPE || 'sqlite',
    sqlite: {
      path: process.env.DB_PATH || './data/budgetos.db',
    },
    mysql: {
      host: process.env.MYSQL_HOST || 'localhost',
      port: parseInt(process.env.MYSQL_PORT, 10) || 3306,
      database: process.env.MYSQL_DB || 'budgetos',
      user: process.env.MYSQL_USER || 'budgetos',
      password: process.env.MYSQL_PASSWORD || 'budgetos',
    },
    postgres: {
      host: process.env.POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.POSTGRES_PORT, 10) || 5432,
      database: process.env.POSTGRES_DB || 'budgetos',
      user: process.env.POSTGRES_USER || 'budgetos',
      password: process.env.POSTGRES_PASSWORD || '',
    },
  },
  
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  
  security: {
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS, 10) || 12,
    rateLimit: {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 60000, // 1min
      maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 200,
    },
  },
  
  logging: {
    level: process.env.LOG_LEVEL || 'debug',
  },
  
  upload: {
    maxSize: parseInt(process.env.UPLOAD_MAX_SIZE, 10) || 10485760, // 10MB
    path: process.env.UPLOAD_PATH || './uploads',
    allowedMimeTypes: [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/x-qif',
      'application/x-ofx',
    ],
  },
  
  app: {
    defaultLocale: process.env.DEFAULT_LOCALE || 'pt',
    defaultCurrency: process.env.DEFAULT_CURRENCY || 'BRL',
    supportedCurrencies: ['BRL', 'EUR', 'USD', 'GBP', 'CHF', 'CAD'],
    supportedLocales: ['pt', 'fr', 'en', 'de', 'es', 'it', 'ru', 'sv', 'zh'],
  },
  
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || '',
    appUrl: process.env.APP_URL || '',
  },

  paths: {
    root: path.resolve(__dirname, '../..'),
    src: path.resolve(__dirname, '..'),
    data: path.resolve(__dirname, '../../data'),
    uploads: path.resolve(__dirname, '../../uploads'),
    logs: path.resolve(__dirname, '../../logs'),
  },
};

export default config;

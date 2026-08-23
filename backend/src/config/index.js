const dotenv = require('dotenv');
const path = require('path');
const crypto = require('crypto');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const nodeEnv = process.env.NODE_ENV || 'development';

/**
 * Resolve a required secret.
 * - Production: never invent a value. Missing secrets are left undefined and
 *   the guard below throws, refusing to boot with an insecure default.
 * - Development/test: fall back to an ephemeral, process-local random value so
 *   there is NEVER a hardcoded secret committed to the source tree. The value
 *   changes on every restart (old tokens stop verifying), which is acceptable
 *   and safer for local work. Set the variable in .env for stable sessions.
 */
const resolveSecret = (envValue, label) => {
  if (envValue) return envValue;
  if (nodeEnv === 'production') return undefined;
  const generated = crypto.randomBytes(48).toString('hex');
  console.warn(
    `[config] ${label} is not set — generated an ephemeral value for "${nodeEnv}". ` +
      'Sessions/tokens reset on restart. Set it in .env for stable local runs; it is REQUIRED in production.'
  );
  return generated;
};

const config = {
  nodeEnv,
  port: parseInt(process.env.PORT, 10) || 5000,
  mongodbUri: process.env.MONGODB_URI,
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  jwtSecret: resolveSecret(process.env.JWT_SECRET, 'JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  aiServiceUrl: process.env.AI_SERVICE_URL || 'http://localhost:8000',
  // Shared secret the backend presents to the Python AI microservice.
  // NOT auto-generated: it must match the AI service's own AI_SERVICE_TOKEN,
  // so both sides read it from the environment (empty until configured).
  aiServiceToken: process.env.AI_SERVICE_TOKEN || '',
};

const requiredInProduction = ['MONGODB_URI', 'JWT_SECRET', 'AI_SERVICE_TOKEN'];

if (config.nodeEnv === 'production') {
  const missing = requiredInProduction.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

module.exports = config;

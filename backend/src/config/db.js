const mongoose = require('mongoose');
const dns = require('dns');
const config = require('./index');

// Use reliable DNS resolvers for Atlas SRV lookups on Windows
try {
  dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch (e) {
  // ignore if restricted
}

const connectDB = async () => {
  const uri = config.mongodbUri;

  if (!uri) {
    if (config.nodeEnv === 'production') {
      throw new Error('MONGODB_URI is required in production');
    }
    console.warn('[DB] MONGODB_URI not set — skipping database connection in development');
    return null;
  }

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 3000,
    });
    console.log(`[DB] MongoDB connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    if (config.nodeEnv === 'production') {
      console.error(`[DB] MongoDB connection error: ${error.message}`);
      throw error;
    }
    console.warn(`[DB] MongoDB unavailable — server starting without database (${error.message})`);
    return null;
  }
};

module.exports = connectDB;

const mongoose = require('mongoose');

const healthCheck = (req, res) => {
  const dbStateMap = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };

  const dbState = mongoose.connection.readyState;
  const dbStatus = dbStateMap[dbState] || 'unknown';

  res.json({
    success: true,
    service: 'loanlens-api',
    status: 'healthy',
    database: {
      status: dbStatus,
      connected: dbState === 1,
      host: mongoose.connection.host || 'none',
      name: mongoose.connection.name || 'none',
    },
    timestamp: new Date().toISOString(),
  });
};

module.exports = { healthCheck };

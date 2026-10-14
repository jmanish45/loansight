const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const config = require('./config');
const errorHandler = require('./middleware/errorHandler');
const notFound = require('./middleware/notFound');
const healthRoutes = require('./routes/health');
const authRoutes = require('./routes/auth');
const applicationRoutes = require('./routes/applications');
const officerRoutes = require('./routes/officer');
const aiRoutes = require('./routes/ai');

const app = express();

// Security
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false,
}));

// CORS
const getCorsOrigin = () => {
  if (!config.corsOrigin || config.corsOrigin === '*') return true;
  if (config.corsOrigin.includes(',')) {
    return config.corsOrigin.split(',').map((s) => s.trim());
  }
  return config.corsOrigin;
};

app.use(cors({
  origin: getCorsOrigin(),
  credentials: true,
}));

// Logging
if (config.nodeEnv !== 'test') {
  app.use(morgan('short'));
}

// Body parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Routes
app.get('/', (req, res) => {
  res.json({ name: 'LoanSight API', status: 'online', version: '1.0.0' });
});
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/officer', officerRoutes);
app.use('/api/ai', aiRoutes);

// Error handling
app.use(notFound);
app.use(errorHandler);

module.exports = app;

const jwt = require('jsonwebtoken');
const config = require('../config');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');

const mongoose = require('mongoose');

const protect = async (req, res, next) => {
  let token;

  if (req.cookies.token) {
    token = req.cookies.token;
  } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token || token === 'none') {
    return next(new ApiError(401, 'Not authorized to access this route'));
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret);

    if (mongoose.connection.readyState === 1) {
      try {
        req.user = await User.findById(decoded.id);
      } catch (dbErr) {
        console.warn('[Auth Middleware] User lookup failed, using fallback profile:', dbErr.message);
      }
    }

    if (!req.user) {
      const isOfficer = decoded.id === '65f1a2b3c4d5e6f7a8b9c0d2';
      req.user = {
        _id: decoded.id,
        id: decoded.id,
        name: isOfficer ? 'Bank Underwriting Officer' : 'Rohit Sharma',
        email: isOfficer ? 'officer@loanlens.ai' : 'rohit.sharma@example.com',
        role: isOfficer ? 'officer' : 'applicant',
      };
    }

    next();
  } catch (error) {
    return next(new ApiError(401, 'Not authorized to access this route'));
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(new ApiError(403, `User role ${req.user.role} is not authorized to access this route`));
    }
    next();
  };
};

module.exports = { protect, authorize };

/**
 * Rate limiting middleware
 * Prevents abuse by limiting the number of requests from a single IP
 */

const rateLimit = require('express-rate-limit');
const config = require('../config/config');
const logger = require('../utils/logger');

// General rate limiter for all API endpoints
const apiLimiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.maxRequests,
    message: {
        success: false,
        error: 'Too many requests, please try again later.',
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    handler: (req, res) => {
        logger.rateLimit('Rate limit exceeded', {
            ip: req.ip,
            url: req.url,
        });
        res.status(429).json({
            success: false,
            error: 'Too many requests, please try again later.',
        });
    },
});

// Stricter rate limiter for OpenAI API proxy (more expensive operations)
const openaiLimiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: Math.floor(config.rateLimit.maxRequests / 2), // Half the general limit
    message: {
        success: false,
        error: 'Too many OpenAI API requests, please try again later.',
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        logger.rateLimit('OpenAI rate limit exceeded', {
            ip: req.ip,
            url: req.url,
        });
        res.status(429).json({
            success: false,
            error: 'Too many OpenAI API requests, please try again later.',
        });
    },
});

module.exports = {
    apiLimiter,
    openaiLimiter,
};

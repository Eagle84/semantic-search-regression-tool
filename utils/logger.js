/**
 * Logging utility using Winston
 * Provides structured logging with separate files for errors and general logs
 */

const winston = require('winston');
const path = require('path');
const fs = require('fs');
const config = require('../config/config');

// Ensure log directory exists
const logDir = config.logging.dir;
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

// Define log format
const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
);

// Console format for development
const consoleFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
        let metaStr = '';
        if (Object.keys(meta).length > 0) {
            metaStr = '\n' + JSON.stringify(meta, null, 2);
        }
        return `${timestamp} [${level}]: ${message}${metaStr}`;
    })
);

// Create the logger
const logger = winston.createLogger({
    level: config.logging.level,
    format: logFormat,
    transports: [
        // Write all logs to combined.log
        new winston.transports.File({
            filename: path.join(logDir, 'combined.log'),
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        }),
        // Write all error logs to error.log
        new winston.transports.File({
            filename: path.join(logDir, 'error.log'),
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        }),
    ],
});

// Add console transport in development
if (config.server.nodeEnv !== 'production') {
    logger.add(new winston.transports.Console({
        format: consoleFormat,
    }));
}

/**
 * Log security events
 */
logger.security = function(message, meta = {}) {
    this.warn(message, { type: 'security', ...meta });
};

/**
 * Log rate limit events
 */
logger.rateLimit = function(message, meta = {}) {
    this.warn(message, { type: 'rate_limit', ...meta });
};

/**
 * Log request information
 */
logger.request = function(req, additionalInfo = {}) {
    this.info('Request received', {
        type: 'request',
        method: req.method,
        url: req.url,
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.get('user-agent'),
        ...additionalInfo,
    });
};

module.exports = logger;

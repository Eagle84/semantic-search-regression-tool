/**
 * Centralized error handling middleware
 * Provides consistent error responses and detailed server-side logging
 */

const logger = require('../utils/logger');
const config = require('../config/config');

/**
 * Generic error handler middleware
 * Must be registered last in the middleware chain
 */
function errorHandler(err, req, res, next) {
    // Log the full error details server-side
    logger.error('Error occurred', {
        error: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method,
        ip: req.ip,
        body: req.body,
    });

    // Determine status code
    const statusCode = err.statusCode || err.status || 500;

    // Generic error message for client (prevent information disclosure)
    let clientMessage = 'An error occurred while processing your request.';

    // Only provide details if explicitly in development mode (not just NODE_ENV check)
    const isDebugMode = config.server.nodeEnv === 'development' && process.env.DEBUG_MODE === 'true';
    
    if (isDebugMode) {
        clientMessage = err.message || clientMessage;
    }

    // Send error response
    res.status(statusCode).json({
        success: false,
        error: clientMessage,
        ...(isDebugMode && { 
            details: err.message,
            stack: err.stack 
        }),
    });
}

/**
 * 404 handler for undefined routes
 */
function notFoundHandler(req, res) {
    logger.warn('Route not found', {
        url: req.url,
        method: req.method,
        ip: req.ip,
    });

    res.status(404).json({
        success: false,
        error: 'Route not found',
    });
}

/**
 * Async error wrapper utility
 * Wraps async route handlers to catch errors and pass them to error middleware
 */
function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

/**
 * Validation error handler
 * Formats validation errors from express-validator
 */
function validationErrorHandler(errors) {
    const formattedErrors = errors.array().map(err => ({
        field: err.param,
        message: err.msg,
    }));

    return {
        success: false,
        error: 'Validation failed',
        details: formattedErrors,
    };
}

module.exports = {
    errorHandler,
    notFoundHandler,
    asyncHandler,
    validationErrorHandler,
};

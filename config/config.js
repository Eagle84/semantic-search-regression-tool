/**
 * Centralized configuration management
 * Loads environment variables and provides typed configuration values
 */

require('dotenv').config();

// Validate required environment variables
const requiredEnvVars = ['OPENAI_API_KEY'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
    const errorMessage = `Missing required environment variables: ${missingEnvVars.join(', ')}. Please copy .env.example to .env and configure the required values.`;
    throw new Error(errorMessage);
}

module.exports = {
    // Server configuration
    server: {
        port: parseInt(process.env.PORT, 10) || 3000,
        nodeEnv: process.env.NODE_ENV || 'development',
    },

    // OpenAI API configuration
    openai: {
        apiKey: process.env.OPENAI_API_KEY,
        apiUrl: 'https://api.openai.com/v1/chat/completions',
        timeout: parseInt(process.env.REQUEST_TIMEOUT_MS, 10) || 30000,
        maxTokens: 1000,
    },

    // CORS configuration
    cors: {
        allowedOrigins: process.env.ALLOWED_ORIGINS
            ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
            : ['http://localhost:3000', 'http://127.0.0.1:3000'],
    },

    // Rate limiting configuration
    rateLimit: {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 900000, // 15 minutes
        maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
    },

    // Request timeout configuration
    request: {
        timeoutMs: parseInt(process.env.REQUEST_TIMEOUT_MS, 10) || 30000,
    },

    // Logging configuration
    logging: {
        level: process.env.LOG_LEVEL || 'info',
        dir: process.env.LOG_DIR || 'logs',
    },

    // Application URLs
    finder: {
        baseUrlInvestors: process.env.FINDER_BASE_URL_INVESTORS || 'https://qatesting.findersnc.com/investors/search',
        baseUrlStartups: process.env.FINDER_BASE_URL_STARTUPS || 'https://qatesting.findersnc.com/startups/search',
    },

    // Input validation limits
    validation: {
        maxUrlLength: 2048,
        maxJsonSize: 10240, // 10 KB
        maxQuestionLength: 5000,
        maxInputLength: 100000, // For ReDoS protection
    },
};

/**
 * Input validation utilities
 * Provides validation functions for API inputs to prevent injection attacks
 */

const config = require('../config/config');

/**
 * Validate URL format and length
 */
function isValidUrl(url) {
    if (!url || typeof url !== 'string') {
        return false;
    }

    // Check length
    if (url.length > config.validation.maxUrlLength) {
        return false;
    }

    // Validate URL format
    try {
        const urlObj = new URL(url);
        // Only allow http and https protocols
        return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch (error) {
        return false;
    }
}

/**
 * Validate and sanitize JSON input
 */
function validateJsonInput(jsonString) {
    if (!jsonString || typeof jsonString !== 'string') {
        return { valid: false, error: 'Invalid JSON input' };
    }

    // Check size
    if (jsonString.length > config.validation.maxJsonSize) {
        return { valid: false, error: 'JSON input too large' };
    }

    try {
        const parsed = JSON.parse(jsonString);
        
        // Ensure it's an object
        if (typeof parsed !== 'object' || parsed === null) {
            return { valid: false, error: 'JSON must be an object' };
        }

        return { valid: true, data: parsed };
    } catch (error) {
        return { valid: false, error: 'Invalid JSON format' };
    }
}

/**
 * Validate string input with max length
 */
function validateStringInput(input, maxLength) {
    if (typeof input !== 'string') {
        return { valid: false, error: 'Input must be a string' };
    }

    if (input.length > maxLength) {
        return { valid: false, error: `Input exceeds maximum length of ${maxLength}` };
    }

    return { valid: true, data: input };
}

/**
 * Validate question input
 */
function validateQuestion(question) {
    return validateStringInput(question, config.validation.maxQuestionLength);
}

/**
 * Sanitize input to prevent ReDoS attacks
 * Returns the input if safe, or throws an error
 */
function sanitizeForRegex(input) {
    if (!input || typeof input !== 'string') {
        return input;
    }

    // Check length to prevent ReDoS
    if (input.length > config.validation.maxInputLength) {
        throw new Error('Input too large for regex processing');
    }

    return input;
}

/**
 * Validate prompt type
 */
function isValidPromptType(promptType) {
    const validTypes = ['investor', 'startup', 'company'];
    return validTypes.includes(promptType);
}

/**
 * Validate file path to prevent path traversal attacks
 */
function isValidFilePath(filePath, baseDir) {
    if (!filePath || typeof filePath !== 'string') {
        return false;
    }

    const path = require('path');
    
    // Resolve the absolute path
    const resolvedPath = path.resolve(baseDir, filePath);
    const resolvedBaseDir = path.resolve(baseDir);
    
    // Ensure the resolved path is within the base directory
    return resolvedPath.startsWith(resolvedBaseDir);
}

/**
 * Validate and sanitize OpenAI API configuration
 */
function validateOpenAIConfig(configObj) {
    if (!configObj || typeof configObj !== 'object') {
        return { valid: false, error: 'Configuration must be an object' };
    }

    const validatedConfig = {};

    // Validate model
    if (configObj.model) {
        if (typeof configObj.model !== 'string' || configObj.model.length > 100) {
            return { valid: false, error: 'Invalid model parameter' };
        }
        validatedConfig.model = configObj.model;
    }

    // Validate temperature
    if (configObj.temperature !== undefined) {
        const temp = Number(configObj.temperature);
        if (isNaN(temp) || temp < 0 || temp > 2) {
            return { valid: false, error: 'Temperature must be between 0 and 2' };
        }
        validatedConfig.temperature = temp;
    }

    // Validate max_tokens
    if (configObj.max_tokens !== undefined) {
        const tokens = Number(configObj.max_tokens);
        if (isNaN(tokens) || tokens < 1 || tokens > 100000) {
            return { valid: false, error: 'max_tokens must be between 1 and 100000' };
        }
        validatedConfig.max_tokens = tokens;
    }

    // Validate messages
    if (configObj.messages) {
        if (!Array.isArray(configObj.messages)) {
            return { valid: false, error: 'messages must be an array' };
        }
        
        // Validate each message
        for (const msg of configObj.messages) {
            if (!msg.role || !msg.content) {
                return { valid: false, error: 'Each message must have role and content' };
            }
            if (typeof msg.role !== 'string' || typeof msg.content !== 'string') {
                return { valid: false, error: 'Message role and content must be strings' };
            }
            const validRoles = ['system', 'user', 'assistant'];
            if (!validRoles.includes(msg.role)) {
                return { valid: false, error: 'Invalid message role' };
            }
        }
        
        validatedConfig.messages = configObj.messages;
    }

    return { valid: true, data: validatedConfig };
}

module.exports = {
    isValidUrl,
    validateJsonInput,
    validateStringInput,
    validateQuestion,
    sanitizeForRegex,
    isValidPromptType,
    isValidFilePath,
    validateOpenAIConfig,
};

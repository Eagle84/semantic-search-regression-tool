/**
 * Express server with comprehensive security features
 * Provides API for fetching counts and proxy for OpenAI API
 */

const express = require('express');
const fetch = require('node-fetch');
const AbortController = require('abort-controller');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

// Load configuration
const config = require('./config/config');
const logger = require('./utils/logger');
const { fetchCompanyCount } = require('./utils/fetchCount');
const validators = require('./utils/validators');

// Import middleware
const securityMiddleware = require('./middleware/security');
const { apiLimiter, openaiLimiter } = require('./middleware/rateLimiter');
const { errorHandler, notFoundHandler, asyncHandler } = require('./middleware/errorHandler');

const app = express();
const port = config.server.port;

// Security headers (must be first)
app.use(securityMiddleware);

// Configure CORS with specific origins
const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) {
            return callback(null, true);
        }
        
        if (config.cors.allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            logger.security('CORS blocked origin', { origin });
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
};

app.use(cors(corsOptions));

// Parse JSON body with size limit
app.use(express.json({ limit: '10kb' }));

// Request logging middleware
app.use((req, res, next) => {
    logger.request(req);
    next();
});

// Serve static files from the current directory
app.use(express.static('./'));

// Global variable to store location mappings
let locationNameToIdMap = {};

// Function to normalize location names for better matching
function normalizeLocationName(name) {
    if (!name) return '';
    
    // Convert to lowercase
    let normalized = name.toLowerCase();
    
    // Replace hyphens with spaces and vice versa for flexible matching
    normalized = normalized.replace(/-/g, ' ').trim();
    
    return normalized;
}

// Function to load and parse locations.csv to create name to ID mapping
async function loadLocationMappings() {
    try {
        // Validate file path
        const csvPath = path.join(__dirname, 'locations.csv');
        if (!validators.isValidFilePath('locations.csv', __dirname)) {
            throw new Error('Invalid file path');
        }
        
        // Read CSV file
        const csvText = fs.readFileSync(csvPath, 'utf8');
        
        // Parse CSV
        const lines = csvText.split('\n');
        const headers = lines[0].split(',').map(header => header.replace(/"/g, '').trim());
        
        // Find indexes for city name and city ID columns
        const cityNameIndex = headers.indexOf('city_name');
        const cityIdIndex = headers.indexOf('city_id');
        const countryNameIndex = headers.indexOf('country_name');
        const districtNameIndex = headers.indexOf('district_name');
        
        // Process each line to create mappings
        for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;
            
            const values = lines[i].split(',').map(value => value.replace(/"/g, '').trim());
            
            if (values.length <= Math.max(cityNameIndex, cityIdIndex)) continue;
            
            const cityName = values[cityNameIndex];
            const cityId = values[cityIdIndex];
            const countryName = values[countryNameIndex];
            const districtName = values[districtNameIndex];
            
            // Create composite keys for different location formats
            // Store mappings for city name alone
            locationNameToIdMap[cityName] = cityId;
            
            // Store mappings for "City, Country" format
            locationNameToIdMap[`${cityName}, ${countryName}`] = cityId;
            
            // Store mappings for "City, District, Country" format
            locationNameToIdMap[`${cityName}, ${districtName}, ${countryName}`] = cityId;
        }
        
        // Create normalized index for better matching
        locationNameToIdMap._normalizedIndex = {};
        for (const [key, value] of Object.entries(locationNameToIdMap)) {
            if (key === '_normalizedIndex') continue;
            locationNameToIdMap._normalizedIndex[normalizeLocationName(key)] = value;
        }
        
        logger.info('Location mappings loaded successfully');
    } catch (error) {
        logger.error('Error loading location mappings:', error);
    }
}

// Function to get location ID from name, returns the original name if no mapping found
function getLocationId(locationName) {
    if (!locationName) return locationName;
    
    // Try to find exact match first
    if (locationNameToIdMap[locationName]) {
        return locationNameToIdMap[locationName];
    }
    
    // If no exact match, try normalized comparison
    const normalizedLocationName = normalizeLocationName(locationName);
    if (locationNameToIdMap._normalizedIndex && locationNameToIdMap._normalizedIndex[normalizedLocationName]) {
        return locationNameToIdMap._normalizedIndex[normalizedLocationName];
    }
    
    // If still no match, log it and return the original
    logger.debug(`No mapping found for location: ${locationName}`);
    return locationName;
}

/**
 * API endpoint to fetch company count with rate limiting and validation
 */
app.post('/api/fetch-count', apiLimiter, asyncHandler(async (req, res) => {
    const { url } = req.body;
    
    // Validate URL
    if (!url) {
        return res.status(400).json({ 
            success: false, 
            error: 'URL is required' 
        });
    }
    
    if (!validators.isValidUrl(url)) {
        return res.status(400).json({ 
            success: false, 
            error: 'Invalid URL format' 
        });
    }
    
    const result = await fetchCompanyCount(url);
    res.json(result);
}));

/**
 * API endpoint to generate URL and fetch count in one step with validation
 */
app.post('/api/finder-search', apiLimiter, asyncHandler(async (req, res) => {
    const { jsonParams, promptType } = req.body;
    
    // Validate jsonParams
    if (!jsonParams) {
        return res.status(400).json({ 
            success: false, 
            error: 'JSON parameters are required' 
        });
    }
    
    // Validate promptType
    const validatedPromptType = promptType || 'investor';
    if (!validators.isValidPromptType(validatedPromptType)) {
        return res.status(400).json({ 
            success: false, 
            error: 'Invalid prompt type' 
        });
    }
    
    // Generate URL from JSON parameters
    const url = generateFinderUrlFromJsonResponse(jsonParams, validatedPromptType);
    logger.info(`Generated URL: ${url}`);
    
    // Fetch count from the generated URL
    const result = await fetchCompanyCount(url);
    
    // Add the generated URL to the result
    result.generatedUrl = url;
    result.jsonParams = jsonParams;
    result.promptType = validatedPromptType;
    
    res.json(result);
}));

/**
 * OpenAI API proxy endpoint - keeps API key server-side
 * This endpoint accepts OpenAI chat completion requests and forwards them securely
 */
app.post('/api/openai/chat', openaiLimiter, asyncHandler(async (req, res) => {
    const { messages, model, temperature, max_tokens, ...otherConfig } = req.body;
    
    // Validate required fields
    if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ 
            success: false, 
            error: 'Messages array is required' 
        });
    }
    
    // Validate OpenAI configuration
    const validation = validators.validateOpenAIConfig({ 
        messages, 
        model, 
        temperature, 
        max_tokens,
        ...otherConfig 
    });
    
    if (!validation.valid) {
        return res.status(400).json({ 
            success: false, 
            error: validation.error 
        });
    }
    
    // Prepare API request
    const apiConfig = {
        model: model || 'gpt-4o',
        messages: messages,
        temperature: temperature !== undefined ? temperature : 0.7,
        max_tokens: max_tokens || config.openai.maxTokens,
    };
    
    // Add any other validated config parameters
    for (const key in otherConfig) {
        if (!apiConfig[key]) {
            apiConfig[key] = otherConfig[key];
        }
    }
    
    logger.info('OpenAI API request', { 
        model: apiConfig.model, 
        messageCount: messages.length 
    });
    
    try {
        // Create abort controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), config.openai.timeout);
        
        // Make request to OpenAI API
        const response = await fetch(config.openai.apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.openai.apiKey}`
            },
            body: JSON.stringify(apiConfig),
            signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => null);
            logger.error('OpenAI API error', { 
                status: response.status, 
                error: errorData 
            });
            throw new Error(`OpenAI API error: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data.choices || data.choices.length === 0) {
            throw new Error("No response from OpenAI API");
        }
        
        const result = {
            content: data.choices[0].message.content,
            usage: data.usage,
            model: data.model,
            finish_reason: data.choices[0].finish_reason
        };
        
        logger.info('OpenAI API response', { 
            model: result.model, 
            tokens: result.usage?.total_tokens 
        });
        
        res.json(result);
        
    } catch (error) {
        if (error.name === 'AbortError') {
            logger.error('OpenAI API timeout');
            return res.status(504).json({ 
                success: false, 
                error: 'Request timeout' 
            });
        }
        throw error;
    }
}));

/**
 * Generate Finder URL from JSON parameters
 */
function generateFinderUrlFromJsonResponse(jsonParams, promptType = 'investor') {
    // Get base URL from configuration
    const baseUrl = promptType === 'investor' 
        ? config.finder.baseUrlInvestors
        : config.finder.baseUrlStartups;
    
    // Create URL parameters
    const params = new URLSearchParams();
    
    // Add parameters based on entity type
    if (promptType === 'investor') {
        // Process investor-specific parameters
        if (jsonParams.investorType) {
            if (Array.isArray(jsonParams.investorType)) {
                jsonParams.investorType.forEach(type => params.append('investorType', type));
            } else {
                params.append('investorType', jsonParams.investorType);
            }
        }
        
        // Add fundingtype parameter
        if (jsonParams.fundingtype) {
            if (Array.isArray(jsonParams.fundingtype)) {
                jsonParams.fundingtype.forEach(type => params.append('fundingtype', type));
            } else {
                params.append('fundingtype', jsonParams.fundingtype);
            }
        }
        
        // Add nationality parameter
        if (jsonParams.nationality) {
            if (Array.isArray(jsonParams.nationality)) {
                jsonParams.nationality.forEach(nat => params.append('nationality', nat));
            } else {
                params.append('nationality', jsonParams.nationality);
            }
        }
        
        // Add alltags parameter for investor searches
        if (jsonParams.alltags) {
            if (Array.isArray(jsonParams.alltags)) {
                jsonParams.alltags.forEach(tag => params.append('alltags', tag));
            } else {
                params.append('alltags', jsonParams.alltags);
            }
        }
        
        if (jsonParams.location) {
            if (Array.isArray(jsonParams.location)) {
                jsonParams.location.forEach(loc => {
                    // Map location name to ID
                    const locationId = getLocationId(loc);
                    params.append('location', locationId);
                });
            } else {
                // Map location name to ID
                const locationId = getLocationId(jsonParams.location);
                params.append('location', locationId);
            }
        }
        
        if (jsonParams.investmentStage) {
            if (Array.isArray(jsonParams.investmentStage)) {
                jsonParams.investmentStage.forEach(stage => {
                    params.append('investmentStage', formatInvestmentStage(stage));
                });
            } else {
                params.append('investmentStage', formatInvestmentStage(jsonParams.investmentStage));
            }
        }
        
        if (jsonParams.sectorFocus) {
            if (Array.isArray(jsonParams.sectorFocus)) {
                jsonParams.sectorFocus.forEach(sector => params.append('sectorFocus', sector));
            } else {
                params.append('sectorFocus', jsonParams.sectorFocus);
            }
        }
    } else {
        // Process startup-specific parameters
        if (jsonParams.sectorclassification) {
            if (Array.isArray(jsonParams.sectorclassification)) {
                jsonParams.sectorclassification.forEach(sector => params.append('sectorclassification', sector));
            } else {
                params.append('sectorclassification', jsonParams.sectorclassification);
            }
        }
        
        if (jsonParams.location) {
            if (Array.isArray(jsonParams.location)) {
                jsonParams.location.forEach(loc => {
                    // Map location name to ID
                    const locationId = getLocationId(loc);
                    params.append('location', locationId);
                });
            } else {
                // Map location name to ID
                const locationId = getLocationId(jsonParams.location);
                params.append('location', locationId);
            }
        }
        
        if (jsonParams.lowerFoundedYear) {
            params.append('lowerFoundedYear', jsonParams.lowerFoundedYear);
        }
        
        if (jsonParams.upperFoundedYear) {
            params.append('upperFoundedYear', jsonParams.upperFoundedYear);
        }
        
        // Add fundingtype parameter for startups
        if (jsonParams.fundingtype) {
            if (Array.isArray(jsonParams.fundingtype)) {
                jsonParams.fundingtype.forEach(type => params.append('fundingtype', type));
            } else {
                params.append('fundingtype', jsonParams.fundingtype);
            }
        }
        
        // Add nationality parameter for startups
        if (jsonParams.nationality) {
            if (Array.isArray(jsonParams.nationality)) {
                jsonParams.nationality.forEach(nat => params.append('nationality', nat));
            } else {
                params.append('nationality', jsonParams.nationality);
            }
        }
        
        if (jsonParams.alltags) {
            if (Array.isArray(jsonParams.alltags)) {
                jsonParams.alltags.forEach(tag => params.append('alltags', tag));
            } else {
                params.append('alltags', jsonParams.alltags);
            }
        }
        
        if (jsonParams.fundingstages) {
            if (Array.isArray(jsonParams.fundingstages)) {
                jsonParams.fundingstages.forEach(stage => params.append('fundingstages', stage));
            } else {
                params.append('fundingstages', jsonParams.fundingstages);
            }
        }
    }
    
    // Add common parameters
    if (jsonParams.leadMin) {
        params.append('investleadmin', jsonParams.leadMin);
    }
    
    // Also check for direct investleadmin parameter
    if (jsonParams.investleadmin) {
        params.append('investleadmin', jsonParams.investleadmin);
    }
    
    if (jsonParams.sortBy) {
        params.append('sortBy', jsonParams.sortBy);
    }
    
    // Handle any other direct parameters
    const handledParams = ['investorType', 'location', 'investmentStage', 'sectorFocus', 
                          'sectorclassification', 'lowerFoundedYear', 'upperFoundedYear', 
                          'alltags', 'fundingstages', 'leadMin', 'investleadmin', 'sortBy',
                          'description', 'unsupported', 'status', 'fundingtype', 'nationality'];
                          
    // Add any remaining parameters that weren't explicitly handled
    for (const [key, value] of Object.entries(jsonParams)) {
        // Skip parameters we've already handled
        if (handledParams.includes(key.toLowerCase())) {
            continue;
        }
        
        logger.debug(`Adding unhandled parameter: ${key}=${value}`);
        
        if (Array.isArray(value)) {
            value.forEach(item => params.append(key, item));
        } else {
            params.append(key, value);
        }
    }
    
    // Add status=Active parameter to all URLs
    params.append('status', 'Active');
    
    // Construct the final URL
    const queryString = params.toString();
    const finalUrl = queryString ? `${baseUrl}?&${queryString}` : baseUrl;
    
    return finalUrl;
}

/**
 * Format investment stage parameter
 */
function formatInvestmentStage(stage) {
    if (!stage) return stage;
    
    // If it's a single letter (A, B, C, etc.), append "Round"
    if (/^[A-Za-z]$/.test(stage)) {
        return `${stage} Round`;
    }
    
    // If it's in the format "Series X", convert to "X Round"
    if (/^Series\s+([A-Za-z])$/i.test(stage)) {
        return stage.replace(/^Series\s+([A-Za-z])$/i, '$1 Round');
    }
    
    // If it already contains "Round", leave it as is
    if (/Round/i.test(stage)) {
        return stage;
    }
    
    return stage;
}

/**
 * Health check endpoint
 */
app.get('/api/health-check', (req, res) => {
    res.json({ 
        status: 'ok',
        message: 'Server is running',
        timestamp: new Date().toISOString(),
    });
});

// 404 handler for undefined routes (must be after all routes)
app.use(notFoundHandler);

// Error handler (must be last)
app.use(errorHandler);

// Load location mappings at server startup
loadLocationMappings();

// Start the server
app.listen(port, () => {
    logger.info(`Server running at http://localhost:${port}`);
    logger.info(`Open http://localhost:${port}/semantic-search-regression-tool.html to use the tool`);
    logger.info(`Environment: ${config.server.nodeEnv}`);
}); 
/**
 * Simple Express server to provide an API for fetching counts
 * This serves as a bridge between the browser UI and Finders API
 */

const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const app = express();
const port = 3000;

// Enable CORS for browser requests
app.use(cors());

// Serve static files from the current directory
app.use(express.static('./'));

// Parse JSON body
app.use(express.json());

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
        const fs = require('fs');
        const path = require('path');
        
        // Read CSV file
        const csvPath = path.join(__dirname, 'locations.csv');
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
        
        console.log('Location mappings loaded successfully');
    } catch (error) {
        console.error('Error loading location mappings:', error);
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
    console.log(`No mapping found for location: ${locationName}`);
    return locationName;
}

/**
 * Fetch company/investor count from a Finders URL
 */
async function fetchCompanyCount(url) {
    try {
        // Validate URL
        if (!url) {
            return {
                success: false,
                error: "Invalid URL provided"
            };
        }
        
        console.log(`Server fetching count from: ${url}`);
        
        // Make a direct GET request
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const html = await response.text();
        
        // Log the first 1000 characters of the HTML for debugging
        console.log(`HTML response (first 1000 chars): ${html.substring(0, 1000)}`);
        
        // Try multiple patterns to extract the count
        
        // Pattern 1: Standard companiessummary-number span
        const countPattern = /<span id="companiessummary-number"[^>]*>([0-9,]+)<\/span>/;
        const match = html.match(countPattern);
        
        if (match && match[1]) {
            // Remove commas and convert to number
            const count = parseInt(match[1].replace(/,/g, ''), 10);
            console.log(`Found count using pattern 1: ${count}`);
            
            return {
                url: url,
                count: count,
                success: true,
                elementText: match[1]
            };
        }
        
        // Pattern 2: Generic pattern looking for numbers followed by "investors" or "companies"
        const genericPattern = /([0-9,]+)\s+(?:investors|companies)/i;
        const genericMatch = html.match(genericPattern);
        
        if (genericMatch && genericMatch[1]) {
            const count = parseInt(genericMatch[1].replace(/,/g, ''), 10);
            console.log(`Found count using pattern 2: ${count}`);
            
            return {
                url: url,
                count: count,
                success: true,
                elementText: genericMatch[1]
            };
        }
        
        // Pattern 3: Look for any span with a number that might be the count
        const spanNumberPattern = /<span[^>]*>([0-9,]+)<\/span>/g;
        let spanMatches = [];
        let spanMatch;
        
        while ((spanMatch = spanNumberPattern.exec(html)) !== null) {
            spanMatches.push({
                text: spanMatch[1],
                count: parseInt(spanMatch[1].replace(/,/g, ''), 10)
            });
        }
        
        if (spanMatches.length > 0) {
            // Sort by count value (descending) and take the first one
            spanMatches.sort((a, b) => b.count - a.count);
            const highestCount = spanMatches[0];
            console.log(`Found count using pattern 3: ${highestCount.count}`);
            
            return {
                url: url,
                count: highestCount.count,
                success: true,
                elementText: highestCount.text
            };
        }
        
        // If no count found
        console.log("No count found in HTML");
        return {
            url: url,
            count: 0,
            success: false,
            error: "Count element not found in HTML"
        };
        
    } catch (error) {
        console.error("Error fetching count:", error);
        return {
            url: url,
            count: 0,
            success: false,
            error: error.message || 'Error fetching count'
        };
    }
}

/**
 * API endpoint to fetch company count
 */
app.post('/api/fetch-count', async (req, res) => {
    try {
        const { url } = req.body;
        
        if (!url) {
            return res.status(400).json({ 
                success: false, 
                error: 'URL is required' 
            });
        }
        
        const result = await fetchCompanyCount(url);
        res.json(result);
        
    } catch (error) {
        console.error('API error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message || 'Internal server error' 
        });
    }
});

/**
 * API endpoint to generate URL and fetch count in one step
 */
app.post('/api/finder-search', async (req, res) => {
    try {
        const { jsonParams, promptType } = req.body;
        
        if (!jsonParams) {
            return res.status(400).json({ 
                success: false, 
                error: 'JSON parameters are required' 
            });
        }
        
        // Generate URL from JSON parameters
        const url = generateFinderUrlFromJsonResponse(jsonParams, promptType || 'investor');
        console.log(`Generated URL: ${url}`);
        
        // Fetch count from the generated URL
        const result = await fetchCompanyCount(url);
        
        // Add the generated URL to the result
        result.generatedUrl = url;
        result.jsonParams = jsonParams;
        result.promptType = promptType || 'investor';
        
        res.json(result);
        
    } catch (error) {
        console.error('API error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message || 'Internal server error' 
        });
    }
});

/**
 * Generate Finder URL from JSON parameters (copied from browser code)
 */
function generateFinderUrlFromJsonResponse(jsonParams, promptType = 'investor') {
    // Default base URL for different entity types
    const baseUrl = promptType === 'investor' 
        ? 'https://qatesting.findersnc.com/investors/search'
        : 'https://qatesting.findersnc.com/startups/search';
    
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
        
        console.log(`Adding unhandled parameter: ${key}=${value}`);
        
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
        message: 'Server is running'
    });
});

// Load location mappings at server startup
loadLocationMappings();

// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
    console.log(`Open http://localhost:${port}/semantic-search-regression-tool.html to use the tool`);
}); 
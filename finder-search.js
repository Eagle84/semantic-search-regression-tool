/**
 * Node.js script to generate Finder URLs and fetch company/investor counts
 * This runs server-side and avoids CORS restrictions
 * 
 * Usage:
 * 1. Install dependencies: npm install node-fetch@2
 * 2. Run script with URL: node finder-search.js --url=https://qatesting.findersnc.com/investors/search?investleadmin=1
 * 3. Run script with JSON: node finder-search.js --json='{"investleadmin": 1}'
 */

const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

// Global variable to store location mappings
let locationNameToIdMap = {};

/**
 * Normalize location names for better matching
 * @param {string} name - The location name to normalize
 * @returns {string} Normalized location name
 */
function normalizeLocationName(name) {
    if (!name) return '';
    
    // Convert to lowercase
    let normalized = name.toLowerCase();
    
    // Replace hyphens with spaces and vice versa for flexible matching
    normalized = normalized.replace(/-/g, ' ').trim();
    
    return normalized;
}

/**
 * Load and parse locations.csv to create name to ID mapping
 * @returns {Promise<void>}
 */
async function loadLocationMappings() {
    try {
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

/**
 * Get location ID from name, returns the original name if no mapping found
 * @param {string} locationName - The location name to convert to ID
 * @returns {string} The location ID or the original name if no mapping found
 */
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
 * Generate a Finder URL from JSON parameters
 * @param {object} jsonParams - JSON parameters to include in the URL
 * @param {string} promptType - Type of search ('investor' or 'startup')
 * @returns {string} The generated URL
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
    
    // Handle any other direct parameters that might be in the JSON response
    // This ensures we don't miss parameters we didn't explicitly check for
    const handledParams = ['investorType', 'location', 'investmentStage', 'sectorFocus', 
                          'sectorclassification', 'lowerFoundedYear', 'upperFoundedYear', 
                          'alltags', 'fundingstages', 'leadMin', 'investleadmin', 'sortBy',
                          'description', 'unsupported'];
                          
    for (const [key, value] of Object.entries(jsonParams)) {
        // Skip parameters we've already handled
        if (handledParams.includes(key)) {
            continue;
        }
        
        console.log(`Adding additional parameter: ${key}=${value}`);
        
        if (Array.isArray(value)) {
            value.forEach(item => params.append(key, item));
        } else {
            params.append(key, value);
        }
    }
    
    // Construct the final URL
    const queryString = params.toString();
    const finalUrl = queryString ? `${baseUrl}?&${queryString}` : baseUrl;
    
    return finalUrl;
}

/**
 * Format investment stage parameter
 * @param {string} stage - The investment stage
 * @returns {string} Properly formatted investment stage
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
 * Fetch company/investor count from a Finders URL
 * @param {string} url - The URL to fetch from
 * @returns {Promise<object>} - Object with count and status information
 */
async function fetchCompanyCount(url) {
    try {
        // Validate URL
        if (!url) {
            console.error("Invalid URL provided");
            return {
                url: url,
                count: 0,
                success: false,
                error: "Invalid URL provided"
            };
        }
        
        console.log(`Fetching count from URL: ${url}`);
        
        // Make a simple GET request
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const html = await response.text();
        console.log(`Successfully fetched HTML (${html.length} characters)`);
        
        // Extract the count from the HTML using regex
        const countPattern = /<span id="companiessummary-number"[^>]*>([0-9,]+)<\/span>/;
        const match = html.match(countPattern);
        
        if (match && match[1]) {
            // Remove commas and convert to number
            const count = parseInt(match[1].replace(/,/g, ''), 10);
            console.log(`Found count in HTML: ${count}`);
            
            return {
                url: url,
                count: count,
                success: true,
                elementText: match[1]
            };
        }
        
        // Try a more generic pattern if the first one didn't match
        const genericPattern = /([0-9,]+)\s+(?:investors|companies)/i;
        const genericMatch = html.match(genericPattern);
        
        if (genericMatch && genericMatch[1]) {
            const count = parseInt(genericMatch[1].replace(/,/g, ''), 10);
            console.log(`Found count using generic pattern: ${count}`);
            
            return {
                url: url,
                count: count,
                success: true,
                elementText: genericMatch[1]
            };
        }
        
        // If no count found
        console.warn("Count element not found in HTML response");
        console.warn("HTML snippet:", html.substring(0, 500));
        
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
 * Parse command line arguments
 * @returns {object} Parsed arguments
 */
function parseArgs() {
    const args = process.argv.slice(2);
    const result = {};
    
    args.forEach(arg => {
        if (arg.startsWith('--url=')) {
            result.url = arg.substring(6);
        } else if (arg.startsWith('--json=')) {
            try {
                result.json = JSON.parse(arg.substring(7));
            } catch (e) {
                console.error("Error parsing JSON argument:", e);
                process.exit(1);
            }
        } else if (arg.startsWith('--type=')) {
            result.type = arg.substring(7);
        } else if (arg === '--help') {
            result.help = true;
        }
    });
    
    return result;
}

/**
 * Display help information
 */
function showHelp() {
    console.log(`
Finder Search CLI - Search for investors or companies and get count

Usage:
  node finder-search.js [options]

Options:
  --url=URL           Direct URL to fetch count from
  --json=JSON         JSON parameters to generate a URL
  --type=TYPE         Entity type (investor or startup), default: investor
  --help              Show this help message

Examples:
  node finder-search.js --url=https://qatesting.findersnc.com/investors/search?investleadmin=1
  node finder-search.js --json='{"investleadmin": 1}'
  node finder-search.js --json='{"investmentStage": "A"}' --type=investor
    `);
}

/**
 * Main function to run the script with command line arguments
 */
async function main() {
    try {
        // Load location mappings
        await loadLocationMappings();
        
        // Parse command line arguments
        const args = parseArgs();
        
        // Show help if requested or no arguments provided
        if (args.help || (Object.keys(args).length === 0)) {
            showHelp();
            return;
        }
        
        let url = args.url;
        const type = args.type || 'investor';
        
        // If JSON parameters are provided, generate URL
        if (args.json) {
            url = generateFinderUrlFromJsonResponse(args.json, type);
            console.log(`Generated URL from JSON: ${url}`);
        }
        
        // Validate URL
        if (!url) {
            console.error("No URL provided. Use --url or --json to specify search parameters.");
            showHelp();
            process.exit(1);
        }
        
        // Fetch count from URL
        const result = await fetchCompanyCount(url);
        
        // Format and display the result
        console.log("\n========= RESULTS =========");
        console.log(`URL: ${result.url}`);
        console.log(`Success: ${result.success}`);
        
        if (result.success) {
            console.log(`Count: ${result.count}`);
            console.log(`Element Text: ${result.elementText}`);
            
            // Also check if this URL is JSON-based
            if (args.json) {
                console.log(`\nJSON Parameters:`);
                console.log(JSON.stringify(args.json, null, 2));
            }
        } else {
            console.log(`Error: ${result.error}`);
        }
        console.log("===========================\n");
        
    } catch (error) {
        console.error("Script execution failed:", error);
        process.exit(1);
    }
}

// Run the script
main().catch(err => {
    console.error("Unhandled error:", err);
    process.exit(1);
}); 
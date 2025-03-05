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
        
        // Extract the count from the HTML using regex
        const countPattern = /<span id="companiessummary-number"[^>]*>([0-9,]+)<\/span>/;
        const match = html.match(countPattern);
        
        if (match && match[1]) {
            // Remove commas and convert to number
            const count = parseInt(match[1].replace(/,/g, ''), 10);
            console.log(`Found count: ${count}`);
            
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
        : 'https://qatesting.findersnc.com/companies/search';
    
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
                jsonParams.location.forEach(loc => params.append('location', loc));
            } else {
                params.append('location', jsonParams.location);
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
                jsonParams.location.forEach(loc => params.append('location', loc));
            } else {
                params.append('location', jsonParams.location);
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
    
    // Handle any other direct parameters
    const handledParams = ['investorType', 'location', 'investmentStage', 'sectorFocus', 
                          'sectorclassification', 'lowerFoundedYear', 'upperFoundedYear', 
                          'alltags', 'fundingstages', 'leadMin', 'investleadmin', 'sortBy',
                          'description', 'unsupported'];
                          
    for (const [key, value] of Object.entries(jsonParams)) {
        // Skip parameters we've already handled
        if (handledParams.includes(key)) {
            continue;
        }
        
        if (Array.isArray(value)) {
            value.forEach(item => params.append(key, item));
        } else {
            params.append(key, value);
        }
    }
    
    // Construct the final URL
    const queryString = params.toString();
    const finalUrl = queryString ? `${baseUrl}?${queryString}` : baseUrl;
    
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

// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
    console.log(`Open http://localhost:${port}/semantic-search-regression-tool.html to use the tool`);
}); 
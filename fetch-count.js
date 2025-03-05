/**
 * Node.js script to fetch company/investor counts from Finders URLs
 * This runs server-side and avoids CORS restrictions
 * 
 * Usage:
 * 1. Install dependencies: npm install node-fetch@2
 * 2. Run script: node fetch-count.js https://qatesting.findersnc.com/investors/search?investleadmin=1
 */

const fetch = require('node-fetch');

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
 * Main function to run the script with command line arguments
 */
async function main() {
    // Get URL from command line arguments
    const url = process.argv[2];
    
    if (!url) {
        console.log("Please provide a URL as a command line argument");
        console.log("Example: node fetch-count.js https://qatesting.findersnc.com/investors/search?investleadmin=1");
        process.exit(1);
    }
    
    try {
        const result = await fetchCompanyCount(url);
        
        // Format and display the result
        console.log("\n========= RESULTS =========");
        console.log(`URL: ${result.url}`);
        console.log(`Success: ${result.success}`);
        
        if (result.success) {
            console.log(`Count: ${result.count}`);
            console.log(`Element Text: ${result.elementText}`);
        } else {
            console.log(`Error: ${result.error}`);
        }
        console.log("===========================\n");
        
    } catch (error) {
        console.error("Script execution failed:", error);
    }
}

// Run the script
main().catch(err => {
    console.error("Unhandled error:", err);
    process.exit(1);
}); 
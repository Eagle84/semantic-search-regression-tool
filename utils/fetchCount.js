/**
 * Shared utility for fetching company/investor counts from Finders URLs
 * Extracted from duplicated code to ensure consistency
 */

const fetch = require('node-fetch');
const AbortController = require('abort-controller');
const config = require('../config/config');
const logger = require('./logger');
const { sanitizeForRegex } = require('./validators');

/**
 * Fetch company/investor count from a Finders URL
 * @param {string} url - The URL to fetch from
 * @param {number} timeout - Optional timeout in milliseconds
 * @returns {Promise<Object>} Result object with count and metadata
 */
async function fetchCompanyCount(url, timeout = config.request.timeoutMs) {
    try {
        // Validate URL
        if (!url) {
            return {
                success: false,
                error: "Invalid URL provided"
            };
        }
        
        logger.info(`Fetching count from: ${url}`);
        
        // Create abort controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        try {
            // Make a direct GET request with timeout
            const response = await fetch(url, {
                signal: controller.signal,
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const html = await response.text();
            
            // Sanitize HTML for regex processing (ReDoS protection)
            const safeHtml = sanitizeForRegex(html);
            
            // Log the first 1000 characters of the HTML for debugging
            logger.debug(`HTML response (first 1000 chars): ${safeHtml.substring(0, 1000)}`);
            
            // Try multiple patterns to extract the count
            
            // Pattern 1: Standard companiessummary-number span
            const countPattern = /<span id="companiessummary-number"[^>]*>([0-9,]+)<\/span>/;
            const match = safeHtml.match(countPattern);
            
            if (match && match[1]) {
                // Remove commas and convert to number
                const count = parseInt(match[1].replace(/,/g, ''), 10);
                logger.info(`Found count using pattern 1: ${count}`);
                
                return {
                    url: url,
                    count: count,
                    success: true,
                    elementText: match[1]
                };
            }
            
            // Pattern 2: Generic pattern looking for numbers followed by "investors" or "companies"
            const genericPattern = /([0-9,]+)\s+(?:investors|companies)/i;
            const genericMatch = safeHtml.match(genericPattern);
            
            if (genericMatch && genericMatch[1]) {
                const count = parseInt(genericMatch[1].replace(/,/g, ''), 10);
                logger.info(`Found count using pattern 2: ${count}`);
                
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
            
            while ((spanMatch = spanNumberPattern.exec(safeHtml)) !== null) {
                spanMatches.push({
                    text: spanMatch[1],
                    count: parseInt(spanMatch[1].replace(/,/g, ''), 10)
                });
            }
            
            if (spanMatches.length > 0) {
                // Sort by count value (descending) and take the first one
                spanMatches.sort((a, b) => b.count - a.count);
                const highestCount = spanMatches[0];
                logger.info(`Found count using pattern 3: ${highestCount.count}`);
                
                return {
                    url: url,
                    count: highestCount.count,
                    success: true,
                    elementText: highestCount.text
                };
            }
            
            // If no count found
            logger.warn("No count found in HTML");
            return {
                url: url,
                count: 0,
                success: false,
                error: "Count element not found in HTML"
            };
            
        } catch (error) {
            clearTimeout(timeoutId);
            
            if (error.name === 'AbortError') {
                logger.error("Fetch timeout:", error);
                return {
                    url: url,
                    count: 0,
                    success: false,
                    error: 'Request timeout'
                };
            }
            throw error;
        }
        
    } catch (error) {
        logger.error("Error fetching count:", error);
        return {
            url: url,
            count: 0,
            success: false,
            error: error.message || 'Error fetching count'
        };
    }
}

module.exports = {
    fetchCompanyCount,
};

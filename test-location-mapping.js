/**
 * Test script to verify location mapping functionality
 * 
 * This script loads the locations.csv file, performs the mapping, and
 * outputs a few examples of the mapping to verify it works correctly.
 * 
 * Usage: node test-location-mapping.js
 */

const fs = require('fs');
const path = require('path');

// Global variable to store location mappings
let locationNameToIdMap = {};
let outputText = '';

// Function to log to both console and string
function log(message) {
    console.log(message);
    outputText += message + '\n';
}

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
        
        log(`CSV headers: ${headers.join(', ')}`);
        log(`Indices - city name: ${cityNameIndex}, city ID: ${cityIdIndex}, country: ${countryNameIndex}, district: ${districtNameIndex}`);
        
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
        
        log('Location mappings loaded successfully');
        log(`Total mappings created: ${Object.keys(locationNameToIdMap).length}`);
        log(`Total normalized mappings: ${Object.keys(locationNameToIdMap._normalizedIndex).length}`);
        
        // Display a few sample entries
        const sampleEntries = Object.entries(locationNameToIdMap).slice(0, 5);
        log('\nSample mappings:');
        sampleEntries.forEach(([name, id]) => {
            log(`"${name}" -> "${id}"`);
        });
        
        // Specifically look for Tel-Aviv-Yafo from the example
        log('\nSearching for Tel-Aviv-Yafo in mappings:');
        const telAvivKeys = Object.keys(locationNameToIdMap).filter(key => 
            key.includes('Tel-Aviv-Yafo') || key.includes('Tel Aviv') || key.toLowerCase().includes('tel aviv'));
        
        if (telAvivKeys.length > 0) {
            log(`Found ${telAvivKeys.length} keys containing Tel Aviv:`);
            telAvivKeys.forEach(key => {
                log(`"${key}" -> "${locationNameToIdMap[key]}"`);
            });
        } else {
            log('No Tel Aviv keys found');
        }
        
        // Test the getLocationId function
        log('\nTesting getLocationId function:');
        ['Tel-Aviv-Yafo', 'Tel Aviv-Yafo', 'Tel Aviv Yafo', 'London', 'New York', 'Paris'].forEach(loc => {
            log(`"${loc}" -> "${getLocationId(loc)}"`);
        });
        
        // Test URL Generation
        log('\nTesting URL Generation:');
        const baseUrl = 'https://qatesting.findersnc.com/investors/search';
        const testLocations = ['Tel-Aviv-Yafo', 'London', 'New York'];
        
        testLocations.forEach(loc => {
            const params = new URLSearchParams();
            const locationId = getLocationId(loc);
            params.append('location', locationId);
            
            const queryString = params.toString();
            const finalUrl = queryString ? `${baseUrl}?&${queryString}` : baseUrl;
            
            log(`Location: "${loc}"`);
            log(`Mapped ID: "${locationId}"`);
            log(`Generated URL: "${finalUrl}"`);
            log('');
        });
        
        // Generate example URL from user query
        log('\nExample from user query:');
        const exampleUrl = `${baseUrl}?&location=${getLocationId('Tel-Aviv-Yafo')}`;
        log(`Example URL: "${exampleUrl}"`);
        log(`Original example: "search?&location=agxzfmlsbGlzdHNpdGVyIgsSB0dlb0NpdHkiFVRlbC1Bdml2LVlhZm9fX0lzcmFlbAw"`);
        
        // Write to file for easier viewing
        fs.writeFileSync('location-mapping-results.txt', outputText);
        console.log('Results written to location-mapping-results.txt');
        
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
    
    // Log the miss
    log(`No mapping found for location: ${locationName}`);
    return locationName;
}

// Run the test
async function main() {
    try {
        await loadLocationMappings();
    } catch (error) {
        console.error('Test failed:', error);
    }
}

main(); 
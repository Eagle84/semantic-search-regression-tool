# Finder Search Node.js Tools

This package provides Node.js tools for working with the Finders platform, allowing you to generate search URLs and fetch company/investor counts without CORS restrictions.

## Why Node.js?

The browser-based version of this tool encounters CORS (Cross-Origin Resource Sharing) restrictions when trying to fetch data directly from the Finders API. By using Node.js, we can bypass these restrictions since they're only enforced by browsers.

## Installation

1. Make sure you have Node.js installed (version 12 or newer)
2. Install dependencies:

```bash
npm install
```

## Available Tools

### 1. Simple Count Fetcher (`fetch-count.js`)

This script fetches the company/investor count from a given Finders URL.

**Usage:**
```bash
node fetch-count.js https://qatesting.findersnc.com/investors/search?investleadmin=1
```

or using npm:

```bash
npm run fetch https://qatesting.findersnc.com/investors/search?investleadmin=1
```

### 2. Comprehensive Search Tool (`finder-search.js`)

This script can both generate URLs from JSON parameters and fetch counts.

**Usage with direct URL:**
```bash
node finder-search.js --url=https://qatesting.findersnc.com/investors/search?investleadmin=1
```

**Usage with JSON parameters:**
```bash
node finder-search.js --json='{"investleadmin": 1}'
```

**Specify entity type:**
```bash
node finder-search.js --json='{"sectorclassification": "Fintech"}' --type=startup
```

**Show help:**
```bash
node finder-search.js --help
```

## Example JSON Parameters

### For Investor Searches

```json
{
  "investorType": "Venture Capital",
  "location": "New York",
  "investmentStage": "B",
  "sectorFocus": "Fintech"
}
```

### For Startup Searches

```json
{
  "sectorclassification": "Fintech",
  "location": "San Francisco",
  "lowerFoundedYear": 2018,
  "upperFoundedYear": 2022
}
```

## Integration with Browser Version

While the browser version has CORS limitations when directly fetching data, you can use these Node.js tools to:

1. Test URL generation logic
2. Verify counts for specific searches
3. Build a dataset of search results for testing

The implementation of these scripts mirrors the browser-based functionality, ensuring consistency in results.

## Troubleshooting

- If you encounter `Error: Cannot find module 'node-fetch'`, run `npm install` to install dependencies
- Some URLs might not return the expected HTML structure - the script tries multiple patterns but may fail if the website layout changes 
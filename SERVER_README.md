# Finder Search Server

This server provides an API bridge between your browser application and the Finders platform, allowing you to bypass CORS restrictions and get actual company/investor counts.

## How It Works

1. The server runs locally on your machine (Node.js)
2. It serves your static HTML/JS/CSS files
3. It provides API endpoints that your browser code can call
4. When an API endpoint is called, the server makes direct requests to the Finders platform
5. The server extracts the count from the HTML and returns it to your browser

## Setup and Installation

1. Make sure you have Node.js installed (version 12 or newer)
2. Install dependencies:

```bash
npm install
```

3. Start the server:

```bash
npm run server
# or directly
node server.js
```

4. Open your browser to:

```
http://localhost:3000/semantic-search-regression-tool.html
```

## API Endpoints

### 1. `/api/fetch-count`

Fetches the company/investor count from a given URL.

**Request:**
```json
{
  "url": "https://qatesting.findersnc.com/investors/search?investleadmin=1"
}
```

**Response:**
```json
{
  "url": "https://qatesting.findersnc.com/investors/search?investleadmin=1",
  "count": 964,
  "success": true,
  "elementText": "964"
}
```

### 2. `/api/finder-search`

Generates a URL from JSON parameters and fetches the count in one step.

**Request:**
```json
{
  "jsonParams": {
    "investleadmin": 1
  },
  "promptType": "investor"
}
```

**Response:**
```json
{
  "url": "https://qatesting.findersnc.com/investors/search?investleadmin=1",
  "count": 964,
  "success": true,
  "elementText": "964",
  "generatedUrl": "https://qatesting.findersnc.com/investors/search?investleadmin=1",
  "jsonParams": {
    "investleadmin": 1
  },
  "promptType": "investor"
}
```

## Browser Integration

The `script.js` file has been updated to use these API endpoints instead of trying to make direct requests to the Finders platform. This ensures that your browser UI displays accurate company/investor counts without being blocked by CORS.

## Troubleshooting

- If you see "Connection refused" errors, make sure the server is running
- If you get "Cannot find module" errors, run `npm install`
- If the API returns zero counts, check the server console for HTML parsing errors 
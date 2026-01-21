# Semantic Search GPT Regression Tool

A secure, web-based tool for testing and evaluating GPT model responses to semantic search queries. This tool helps identify regressions in model performance and provides visual feedback on success rates.

## Features

- **Single Testing**: Run individual queries to test specific scenarios
- **Finder Search**: Test queries that generate Finder URLs and validate result counts
- **Configuration**: Customize model parameters and system prompts
- **Security**: Enterprise-grade security with server-side API key management, rate limiting, and comprehensive input validation

## Security Features

✅ **Server-side API Key Management** - API keys are stored securely on the server, never in the browser  
✅ **Rate Limiting** - Prevents abuse with configurable request limits  
✅ **Input Validation** - Comprehensive validation of all user inputs  
✅ **Security Headers** - Helmet.js provides protection against common vulnerabilities  
✅ **CORS Protection** - Configurable allowed origins  
✅ **Request Timeouts** - Prevents resource exhaustion  
✅ **Structured Logging** - Winston logging for security monitoring  
✅ **Error Handling** - Generic client errors, detailed server logs  

## Getting Started

### Prerequisites

- Node.js (>=12.0.0)
- npm
- An OpenAI API key
- A modern web browser

### Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/Eagle84/semantic-search-regression-tool.git
   cd semantic-search-regression-tool
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables:
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and set your configuration:
   ```
   OPENAI_API_KEY=your_openai_api_key_here
   PORT=3000
   NODE_ENV=development
   ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
   ```

4. Start the server:
   ```bash
   npm run server
   ```

5. Open your browser and navigate to:
   ```
   http://localhost:3000/semantic-search-regression-tool.html
   ```

### First-Time Setup

1. **Configure API Key**: Set your `OPENAI_API_KEY` in the `.env` file (never commit this file!)
2. **Set Allowed Origins**: Update `ALLOWED_ORIGINS` in `.env` for production deployments
3. **Configure Rate Limits**: Adjust `RATE_LIMIT_MAX_REQUESTS` if needed (default: 100 per 15 minutes)
4. **Review Security Settings**: Check `config/config.js` for additional configuration options

### Usage

#### Single Testing

1. Navigate to the "Single Test" tab
2. Enter your question in the text area
3. Set the number of iterations (for consistency testing)
4. Click "Run Test"

#### Finder Search

1. Navigate to the "Finder Search" tab
2. Enter your question in the text area
3. Click "Run Finder Search"
4. The tool will use OpenAI to generate search parameters and fetch results

#### Configuration

In the Configuration tab, you can:

- View security information about API key management
- Configure model parameters (model, temperature, max_tokens, etc.)
- Customize system prompts for different search types

**Note**: API keys are now managed server-side. Configure your OpenAI API key in the `.env` file on the server, not in the browser.

## Architecture

### Server Components

- **Express Server** (`server.js`) - Main application server with security middleware
- **Configuration** (`config/config.js`) - Centralized configuration management
- **Middleware**:
  - `middleware/security.js` - Helmet security headers
  - `middleware/rateLimiter.js` - Rate limiting configuration
  - `middleware/errorHandler.js` - Centralized error handling
- **Utilities**:
  - `utils/validators.js` - Input validation functions
  - `utils/logger.js` - Winston logging setup
  - `utils/fetchCount.js` - Shared fetch utility

### Client Components

- **HTML** (`semantic-search-regression-tool.html`) - Main UI
- **JavaScript** (`script.js`) - Client-side logic
- **CSS** (`styles.css`) - Styling

### API Endpoints

- `POST /api/openai/chat` - Proxy for OpenAI API calls (rate limited)
- `POST /api/fetch-count` - Fetch company/investor counts from URLs
- `POST /api/finder-search` - Generate URLs and fetch counts
- `GET /api/health-check` - Server health check

## Security Considerations

### Production Deployment

1. **Environment Variables**: Never commit `.env` file to version control
2. **HTTPS**: Always use HTTPS in production
3. **CORS**: Configure `ALLOWED_ORIGINS` to only include your production domain
4. **Rate Limiting**: Adjust rate limits based on expected traffic
5. **API Keys**: Rotate API keys regularly
6. **Monitoring**: Review logs regularly for security events

### Logs

Logs are stored in the `logs/` directory:
- `combined.log` - All logs
- `error.log` - Error logs only

Monitor these files for:
- Failed authentication attempts
- Rate limit violations
- Unusual error patterns
- Security events

## File Structure

```
.
├── config/
│   └── config.js              # Centralized configuration
├── middleware/
│   ├── errorHandler.js        # Error handling middleware
│   ├── rateLimiter.js         # Rate limiting middleware
│   └── security.js            # Security headers middleware
├── utils/
│   ├── fetchCount.js          # Shared fetch utility
│   ├── logger.js              # Winston logging setup
│   └── validators.js          # Input validation utilities
├── logs/                       # Log files (gitignored)
├── .env                        # Environment variables (gitignored)
├── .env.example                # Environment variable template
├── server.js                   # Main Express server
├── script.js                   # Client-side JavaScript
├── semantic-search-regression-tool.html  # Main HTML
├── styles.css                  # CSS styles
├── package.json                # Dependencies
└── README.md                   # This file
```

## Troubleshooting

### Server Won't Start

- Check that `.env` file exists and contains valid configuration
- Verify `OPENAI_API_KEY` is set in `.env`
- Ensure port 3000 (or configured port) is not already in use

### Rate Limit Errors

- Default limit is 100 requests per 15 minutes
- Adjust `RATE_LIMIT_MAX_REQUESTS` in `.env` if needed
- Wait for the rate limit window to reset

### CORS Errors

- Check `ALLOWED_ORIGINS` in `.env` includes your client origin
- Verify the origin format includes protocol (http:// or https://)

### OpenAI API Errors

- Verify your API key is valid and has credits
- Check OpenAI service status
- Review server logs for detailed error messages

## Contributing

Contributions are welcome! Please ensure:
- All security features remain intact
- New features include appropriate validation and error handling
- Code follows existing patterns
- Documentation is updated

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Security Disclosure

If you discover a security vulnerability, please email the maintainers directly. Do not create a public issue. 
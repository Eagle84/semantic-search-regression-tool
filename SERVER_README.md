# Semantic Search Regression Tool - Server Documentation

This secure Express server provides an API bridge between your browser application and external services (Finders platform, OpenAI API), with comprehensive security features including rate limiting, input validation, and secure API key management.

## Architecture Overview

The server acts as a secure proxy and API gateway, implementing:

1. **Static file serving** - Serves the HTML/JS/CSS client application
2. **API Proxy** - Proxies requests to OpenAI API with server-side key management
3. **Data Fetching** - Retrieves and parses company/investor counts from Finders platform
4. **Security Layer** - Comprehensive security middleware protecting all endpoints
5. **Request Validation** - Validates and sanitizes all inputs
6. **Rate Limiting** - Prevents abuse with configurable limits
7. **Structured Logging** - Winston logging for monitoring and debugging

## Setup and Installation

### Prerequisites

- Node.js (version 12 or newer)
- npm or yarn
- OpenAI API key
- Modern web browser

### Installation Steps

1. **Install dependencies:**

```bash
npm install
```

2. **Configure environment variables:**

```bash
cp .env.example .env
```

Edit `.env` file with your configuration:

```env
# OpenAI API Configuration
OPENAI_API_KEY=sk-your-openai-api-key-here

# Server Configuration
PORT=3000
NODE_ENV=development

# CORS Configuration
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000

# Rate Limiting Configuration
RATE_LIMIT_WINDOW_MS=900000      # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100       # Requests per window

# Request Timeout Configuration
REQUEST_TIMEOUT_MS=30000          # 30 seconds

# Logging Configuration
LOG_LEVEL=info
LOG_DIR=logs

# Application URLs
FINDER_BASE_URL_INVESTORS=https://qatesting.findersnc.com/investors/search
FINDER_BASE_URL_STARTUPS=https://qatesting.findersnc.com/startups/search
```

3. **Start the server:**

```bash
npm run server
# or directly
node server.js
```

4. **Access the application:**

```
http://localhost:3000/semantic-search-regression-tool.html
```

## API Endpoints

### Authentication & Security

All endpoints include:
- Rate limiting
- Input validation
- Error handling
- Request logging
- CORS protection

### 1. `POST /api/openai/chat`

**NEW** - Secure proxy for OpenAI API requests. Keeps API key server-side.

**Rate Limit:** 50 requests per 15 minutes (stricter)

**Request:**
```json
{
  "messages": [
    { "role": "system", "content": "You are a helpful assistant" },
    { "role": "user", "content": "What is the capital of France?" }
  ],
  "model": "gpt-4o",
  "temperature": 0.7,
  "max_tokens": 1000
}
```

**Response:**
```json
{
  "content": "The capital of France is Paris.",
  "usage": {
    "prompt_tokens": 15,
    "completion_tokens": 8,
    "total_tokens": 23
  },
  "model": "gpt-4o",
  "finish_reason": "stop"
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Messages array is required"
}
```

### 2. `POST /api/fetch-count`

Fetches company/investor count from a Finders URL.

**Rate Limit:** 100 requests per 15 minutes

**Request:**
```json
{
  "url": "https://qatesting.findersnc.com/investors/search?investleadmin=1"
}
```

**Validation:**
- URL must be valid HTTP/HTTPS
- URL length max 2048 characters
- URL format validated

**Response:**
```json
{
  "url": "https://qatesting.findersnc.com/investors/search?investleadmin=1",
  "count": 964,
  "success": true,
  "elementText": "964"
}
```

### 3. `POST /api/finder-search`

Generates a Finders URL from JSON parameters and fetches the count.

**Rate Limit:** 100 requests per 15 minutes

**Request:**
```json
{
  "jsonParams": {
    "investleadmin": 1,
    "location": "San Francisco",
    "sectorFocus": "Technology"
  },
  "promptType": "investor"
}
```

**Validation:**
- `jsonParams` must be valid JSON object
- `promptType` must be "investor" or "startup"
- JSON size max 10KB

**Response:**
```json
{
  "url": "https://qatesting.findersnc.com/investors/search?investleadmin=1&location=5391959&sectorFocus=Technology&status=Active",
  "count": 964,
  "success": true,
  "elementText": "964",
  "generatedUrl": "https://qatesting.findersnc.com/investors/search?investleadmin=1&location=5391959&sectorFocus=Technology&status=Active",
  "jsonParams": { "investleadmin": 1, "location": "San Francisco", "sectorFocus": "Technology" },
  "promptType": "investor"
}
```

### 4. `GET /api/health-check`

Server health check endpoint.

**No Rate Limit**

**Response:**
```json
{
  "status": "ok",
  "message": "Server is running",
  "timestamp": "2026-01-21T19:43:28.123Z"
}
```

## Security Features

### 1. Server-Side API Key Management

**Problem Solved:** Client-side API keys are insecure and can be stolen from browser storage or network traffic.

**Implementation:**
- API keys stored in `.env` file on server
- Never transmitted to client
- Proxy endpoint handles all OpenAI API calls
- Keys loaded at server startup

### 2. Rate Limiting

**Configuration:**
```javascript
// General API endpoints
windowMs: 900000,        // 15 minutes
max: 100                 // requests per window

// OpenAI proxy endpoint
windowMs: 900000,
max: 50                  // more restrictive
```

**Response Headers:**
```
RateLimit-Limit: 100
RateLimit-Remaining: 95
RateLimit-Reset: 1642876800
```

**Rate Limit Exceeded:**
```json
{
  "success": false,
  "error": "Too many requests, please try again later."
}
```

### 3. Input Validation

All inputs validated using `utils/validators.js`:

**URL Validation:**
- Valid HTTP/HTTPS protocol
- Length <= 2048 characters
- No malicious patterns

**JSON Validation:**
- Valid JSON structure
- Size <= 10KB
- Type checking

**String Validation:**
- Maximum length checks
- Type verification
- Sanitization for regex (ReDoS protection)

### 4. CORS Protection

**Default (Development):**
```
http://localhost:3000
http://127.0.0.1:3000
```

**Production:**
Configure specific origins in `.env`:
```env
ALLOWED_ORIGINS=https://yourdomain.com,https://app.yourdomain.com
```

**Blocked Origins:**
```json
{
  "error": "Not allowed by CORS"
}
```

### 5. Security Headers (Helmet)

Automatically applied to all responses:

```
Content-Security-Policy: default-src 'self'; ...
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
X-XSS-Protection: 1; mode=block
Referrer-Policy: no-referrer
```

### 6. Error Handling

**Client Receives:**
```json
{
  "success": false,
  "error": "An error occurred while processing your request."
}
```

**Server Logs:**
```
2026-01-21 19:43:28 [error]: Error occurred
{
  error: "Detailed error message",
  stack: "Full stack trace...",
  url: "/api/endpoint",
  method: "POST",
  ip: "127.0.0.1",
  body: { ... }
}
```

### 7. Request Timeouts

All external requests include timeout protection:

```javascript
timeout: 30000  // 30 seconds default
```

Prevents:
- Resource exhaustion
- Hanging requests
- DoS attacks

## Logging

### Winston Logger

**Log Levels:**
- `error` - Errors and exceptions
- `warn` - Security events, rate limits
- `info` - Request logs, general info
- `debug` - Detailed debugging info

**Log Files:**
```
logs/
├── combined.log  # All logs
└── error.log     # Errors only
```

**Log Format:**
```json
{
  "timestamp": "2026-01-21 19:43:28",
  "level": "info",
  "message": "Request received",
  "type": "request",
  "method": "POST",
  "url": "/api/fetch-count",
  "ip": "127.0.0.1",
  "userAgent": "Mozilla/5.0..."
}
```

**Security Events:**
```javascript
logger.security('CORS blocked origin', { origin: 'http://evil.com' });
logger.rateLimit('Rate limit exceeded', { ip: '1.2.3.4', url: '/api/openai/chat' });
```

### Log Rotation

Recommended configuration with `logrotate`:

```
/path/to/logs/*.log {
    daily
    rotate 30
    compress
    delaycompress
    notifempty
    create 0640 nodeuser nodegroup
    sharedscripts
    postrotate
        killall -USR1 node
    endscript
}
```

## Configuration Management

### Environment Variables

Centralized in `config/config.js`:

```javascript
module.exports = {
  server: {
    port: process.env.PORT || 3000,
    nodeEnv: process.env.NODE_ENV || 'development'
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    timeout: process.env.REQUEST_TIMEOUT_MS || 30000
  },
  rateLimit: {
    windowMs: process.env.RATE_LIMIT_WINDOW_MS || 900000,
    maxRequests: process.env.RATE_LIMIT_MAX_REQUESTS || 100
  },
  // ... more configuration
}
```

### Validation

Server validates required environment variables at startup:

```
Missing required environment variables: OPENAI_API_KEY
Please copy .env.example to .env and configure the required values.
```

## Production Deployment

### Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Configure production `ALLOWED_ORIGINS`
- [ ] Use HTTPS reverse proxy (nginx, Apache)
- [ ] Set up log rotation
- [ ] Configure firewall rules
- [ ] Use process manager (PM2, systemd)
- [ ] Set up monitoring and alerts
- [ ] Secure `.env` file permissions (600)
- [ ] Regular dependency updates
- [ ] Backup configuration

### PM2 Process Manager

```bash
# Install PM2
npm install -g pm2

# Start server
pm2 start server.js --name semantic-search-tool

# Configure auto-restart
pm2 startup
pm2 save

# Monitor
pm2 monit

# View logs
pm2 logs semantic-search-tool
```

### Nginx Reverse Proxy

```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
    }
}
```

## Monitoring

### Health Checks

```bash
# Simple health check
curl http://localhost:3000/api/health-check

# With monitoring tool (Nagios, Zabbix)
check_http -H localhost -p 3000 -u /api/health-check
```

### Metrics to Monitor

- Request rate
- Error rate
- Response time
- Rate limit hits
- CPU/Memory usage
- Log file size

### Alerts

Set up alerts for:
- High error rate (>5% of requests)
- Rate limit violations (>10/hour)
- Server downtime
- High memory usage (>80%)
- Disk space for logs

## Troubleshooting

### Common Issues

**Server won't start:**
```
Error: Missing required environment variables: OPENAI_API_KEY
Solution: Create .env file and set OPENAI_API_KEY
```

**Rate limit errors:**
```
Error: Too many requests
Solution: Wait or increase RATE_LIMIT_MAX_REQUESTS in .env
```

**CORS errors:**
```
Error: Not allowed by CORS
Solution: Add origin to ALLOWED_ORIGINS in .env
```

**OpenAI API errors:**
```
Error: OpenAI API error: 401
Solution: Check OPENAI_API_KEY is valid and has credits
```

### Debug Mode

Enable detailed logging:

```env
LOG_LEVEL=debug
NODE_ENV=development
```

View all logs:
```bash
tail -f logs/combined.log
```

Filter errors:
```bash
grep "error" logs/combined.log
```

## Browser Integration

The client application (`script.js`) has been updated to:

1. **Use proxy endpoint** - All OpenAI calls go through `/api/openai/chat`
2. **No API key storage** - API key field removed from UI
3. **Security notice** - Users informed about server-side key management
4. **Error handling** - Graceful handling of rate limits and errors

### Migration from Client-Side Keys

If upgrading from an older version:

1. API keys are automatically removed from localStorage on page load
2. Users see security notice in Configuration tab
3. All functionality continues to work via proxy

## Development

### Running Tests

```bash
# Run server in test mode
NODE_ENV=test node server.js

# Test endpoints
npm run test
```

### Code Structure

```
server.js                 # Main server file
├── Configuration         # Load config and env vars
├── Middleware Setup      # Security, CORS, logging
├── Route Handlers        # API endpoints
├── Error Handlers        # 404 and error middleware
└── Server Startup        # Listen on port
```

### Adding New Endpoints

1. Add route handler with validation
2. Use `asyncHandler` wrapper
3. Apply appropriate rate limiter
4. Add input validation
5. Log requests
6. Handle errors properly

Example:
```javascript
app.post('/api/new-endpoint', apiLimiter, asyncHandler(async (req, res) => {
  // Validate input
  const validation = validators.validateInput(req.body);
  if (!validation.valid) {
    return res.status(400).json({ success: false, error: validation.error });
  }
  
  // Process request
  const result = await processRequest(validation.data);
  
  // Return response
  res.json(result);
}));
```

## Support

For issues or questions:
- Check logs in `logs/` directory
- Review SECURITY.md for security guidelines
- Check GitHub issues
- Contact repository maintainers

---

**Last Updated**: 2026-01-21  
**Server Version**: 1.0.0 
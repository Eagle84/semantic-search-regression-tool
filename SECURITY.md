# Security Policy

## Overview

The Semantic Search GPT Regression Tool implements comprehensive security measures to protect user data and API credentials. This document outlines our security practices and how to report vulnerabilities.

## Security Features

### 1. API Key Protection

**Server-Side Management**
- API keys are stored exclusively in server-side environment variables
- Never transmitted to or stored in the browser
- No localStorage or sessionStorage usage for credentials
- Keys are loaded at server startup from `.env` file

**Best Practices**
- Rotate API keys regularly
- Use separate keys for development and production
- Never commit `.env` file to version control
- Set restrictive file permissions on `.env` (600 or 400)

### 2. Rate Limiting

**Implementation**
- Uses `express-rate-limit` middleware
- Default: 100 requests per 15 minutes per IP
- Stricter limit for OpenAI proxy (50 requests per 15 minutes)
- Configurable via environment variables

**Configuration**
```env
RATE_LIMIT_WINDOW_MS=900000      # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100       # Max requests per window
```

**Headers**
- Returns `RateLimit-*` headers with limit information
- Returns 429 status code when limit exceeded

### 3. Input Validation

**All Endpoints Validate**
- URL format and length (max 2048 characters)
- JSON structure and size (max 10KB)
- String inputs with maximum lengths
- Parameter types and ranges

**Protection Against**
- SQL Injection (N/A - no database)
- XSS (Cross-Site Scripting)
- Path Traversal
- ReDoS (Regular Expression Denial of Service)
- Buffer Overflow attacks

### 4. CORS (Cross-Origin Resource Sharing)

**Configuration**
- Whitelist-based origin validation
- No wildcard (*) origins allowed
- Configurable via `ALLOWED_ORIGINS` environment variable

**Example**
```env
ALLOWED_ORIGINS=https://yourdomain.com,https://app.yourdomain.com
```

### 5. Security Headers

**Helmet.js Middleware**
- Content Security Policy (CSP)
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- Strict-Transport-Security (HSTS)
- X-XSS-Protection
- Referrer-Policy: no-referrer

### 6. Error Handling

**Client-Side**
- Generic error messages
- No sensitive information disclosed
- No stack traces in production

**Server-Side**
- Detailed logging with Winston
- Full error context for debugging
- Separate error and combined logs

### 7. Request Timeouts

**All External Requests**
- 30-second timeout by default
- Prevents resource exhaustion
- Configurable via `REQUEST_TIMEOUT_MS`

### 8. Path Traversal Protection

**File Operations**
- All file paths validated
- Paths resolved to absolute
- Ensures files stay within project directory
- Blocks `..` and other traversal attempts

## Secure Configuration

### Environment Variables

Create `.env` file from template:
```bash
cp .env.example .env
chmod 600 .env  # Restrict to owner only
```

Required variables:
```env
OPENAI_API_KEY=sk-...          # Your OpenAI API key
PORT=3000                       # Server port
NODE_ENV=production             # Environment
ALLOWED_ORIGINS=https://...     # Comma-separated list
```

### Production Deployment

**Checklist**
- [ ] Set `NODE_ENV=production`
- [ ] Use HTTPS/TLS for all connections
- [ ] Configure firewall to limit access
- [ ] Set up log rotation
- [ ] Enable monitoring and alerting
- [ ] Restrict `ALLOWED_ORIGINS` to production domains
- [ ] Use environment-specific API keys
- [ ] Set restrictive file permissions
- [ ] Keep dependencies updated
- [ ] Regular security audits

### HTTPS Configuration

Always use HTTPS in production. Example with reverse proxy:

```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Logging and Monitoring

### Log Files

Located in `logs/` directory:
- `combined.log` - All application logs
- `error.log` - Error logs only

### Security Events Logged

- Failed API requests
- Rate limit violations
- CORS policy violations
- Invalid input attempts
- File access attempts
- Server errors

### Log Monitoring

**Look for patterns indicating**
- Brute force attempts
- Scanning/probing
- Unusual error rates
- Suspicious user agents
- Failed authentication

**Recommended Tools**
- Logrotate for log rotation
- ELK Stack for log analysis
- Prometheus + Grafana for metrics
- Sentry for error tracking

## Dependency Security

### Regular Updates

```bash
# Check for vulnerabilities
npm audit

# Fix automatically
npm audit fix

# Update dependencies
npm update

# Check for outdated packages
npm outdated
```

### Dependencies with Security Features

- `helmet@^7.1.0` - Security headers
- `express-rate-limit@^7.1.5` - Rate limiting
- `express-validator@^7.0.1` - Input validation
- `winston@^3.11.0` - Secure logging
- `dotenv@^16.3.1` - Environment management

## Vulnerability Response

### Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |

### Reporting a Vulnerability

**Please DO NOT create public GitHub issues for security vulnerabilities.**

To report a security issue:

1. **Email**: Send details to the maintainers (check repository for contact)
2. **Include**:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)
3. **Response Time**: We aim to respond within 48 hours
4. **Disclosure**: We follow responsible disclosure practices

### Security Review Process

1. **Acknowledgment** - Confirm receipt within 48 hours
2. **Assessment** - Evaluate severity and impact
3. **Remediation** - Develop and test fix
4. **Disclosure** - Coordinate public disclosure
5. **Credit** - Credit reporter (if desired)

## Security Best Practices for Users

### For Developers

1. **Never commit `.env` file**
   ```gitignore
   .env
   .env.local
   .env.*.local
   ```

2. **Use environment-specific configurations**
   - Development: `.env.development`
   - Production: `.env.production`

3. **Rotate credentials regularly**
   - OpenAI API keys every 90 days
   - Review access logs before rotation

4. **Validate all inputs**
   - Even if using trusted sources
   - Assume all input is malicious

5. **Keep dependencies updated**
   ```bash
   npm audit
   npm update
   ```

### For Administrators

1. **Restrict network access**
   - Use firewall rules
   - Limit to necessary ports
   - Consider VPN for admin access

2. **Monitor logs regularly**
   - Set up alerts for anomalies
   - Review security events
   - Archive logs for compliance

3. **Backup configuration**
   - Securely store `.env` backups
   - Document configuration changes
   - Test disaster recovery

4. **Use secrets management**
   - Consider HashiCorp Vault
   - AWS Secrets Manager
   - Azure Key Vault

## Compliance Considerations

### Data Privacy

- No personal data stored
- API keys encrypted in transit (HTTPS)
- Logs may contain IP addresses (consider GDPR)

### Data Retention

- Logs rotated and purged after 30 days (recommended)
- No persistent storage of search queries
- Session data only in memory

### Audit Trail

- All requests logged with timestamps
- User actions trackable via logs
- Error conditions documented

## Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Express.js Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [Helmet.js Documentation](https://helmetjs.github.io/)

## Contact

For security concerns, please contact the repository maintainers through the GitHub repository or via email as specified in the repository.

---

**Last Updated**: 2026-01-21  
**Version**: 1.0.0

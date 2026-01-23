#!/bin/sh
# Health check script for Docker container
# Checks if the server is responding to health check endpoint
# Exits with 0 on success, 1 on failure

# Set timeout to prevent hanging
timeout 2 node -e "
const http = require('http');
const req = http.get('http://localhost:3000/api/health-check', (res) => {
  process.exit(res.statusCode === 200 ? 0 : 1);
});
req.on('error', () => {
  process.exit(1);
});
req.setTimeout(2000, () => {
  req.destroy();
  process.exit(1);
});
" || exit 1

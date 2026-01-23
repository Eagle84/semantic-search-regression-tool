#!/bin/sh
# Health check script for Docker container
# Checks if the server is responding to health check endpoint

node -e "require('http').get('http://localhost:3000/api/health-check', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

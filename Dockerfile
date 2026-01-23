# Use Node.js LTS version as the base image
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Production stage
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Create a non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy dependencies from builder stage
COPY --from=builder /app/node_modules ./node_modules

# Copy application files (sensitive files excluded via .dockerignore)
COPY --chown=nodejs:nodejs . .

# Create logs directory with proper permissions
RUN mkdir -p logs && chown -R nodejs:nodejs logs

# Switch to non-root user
USER nodejs

# Expose the default port (can be overridden by environment variable)
EXPOSE 3000

# Health check using dedicated script
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD sh /app/healthcheck.sh

# Start the server
CMD ["node", "server.js"]

# Docker Deployment Guide

This guide explains how to run the Semantic Search Regression Tool using Docker.

## Prerequisites

- Docker (version 20.10 or later)
- Docker Compose (version 2.0 or later) - optional but recommended

## Quick Start with Docker Compose

1. **Clone the repository** (if not already done):
   ```bash
   git clone https://github.com/Eagle84/semantic-search-regression-tool.git
   cd semantic-search-regression-tool
   ```

2. **Set up environment variables**:
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and configure your settings, especially:
   - `OPENAI_API_KEY` - Your OpenAI API key (required)
   - `PORT` - Port to run on (default: 3000)
   - `ALLOWED_ORIGINS` - CORS allowed origins

3. **Start the application**:
   ```bash
   docker-compose up -d
   ```

4. **Access the application**:
   Open your browser and navigate to:
   ```
   http://localhost:3000/semantic-search-regression-tool.html
   ```

5. **View logs**:
   ```bash
   docker-compose logs -f
   ```

6. **Stop the application**:
   ```bash
   docker-compose down
   ```

## Manual Docker Build and Run

If you prefer not to use Docker Compose:

1. **Build the Docker image**:
   ```bash
   docker build -t semantic-search-tool .
   ```

2. **Run the container**:
   ```bash
   docker run -d \
     --name semantic-search-tool \
     -p 3000:3000 \
     -e OPENAI_API_KEY="your_api_key_here" \
     -e NODE_ENV=production \
     -e ALLOWED_ORIGINS="http://localhost:3000" \
     -v semantic-search-logs:/app/logs \
     semantic-search-tool
   ```

3. **View logs**:
   ```bash
   docker logs -f semantic-search-tool
   ```

4. **Stop the container**:
   ```bash
   docker stop semantic-search-tool
   docker rm semantic-search-tool
   ```

## Configuration

### Environment Variables

All environment variables from `.env.example` are supported:

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENAI_API_KEY` | OpenAI API key (required) | - |
| `PORT` | Server port | 3000 |
| `NODE_ENV` | Environment mode | production |
| `ALLOWED_ORIGINS` | CORS allowed origins | http://localhost:3000 |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window | 900000 |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window | 100 |
| `REQUEST_TIMEOUT_MS` | Request timeout | 30000 |
| `LOG_LEVEL` | Logging level | info |
| `LOG_DIR` | Log directory | logs |
| `FINDER_BASE_URL_INVESTORS` | Finder investors URL | (see .env.example) |
| `FINDER_BASE_URL_STARTUPS` | Finder startups URL | (see .env.example) |

### Volumes

The Docker setup creates a volume for logs to persist data across container restarts:
- `/app/logs` - Application logs

## Docker Image Details

The Docker image uses:
- **Base Image**: `node:18-alpine` (lightweight Alpine Linux with Node.js 18 LTS)
- **Multi-stage Build**: Optimizes image size by separating build and runtime stages
- **Non-root User**: Runs as user `nodejs` for security
- **Health Check**: Built-in health check using `/api/health-check` endpoint
- **Port**: Exposes port 3000 (configurable via `PORT` environment variable)

## Security Considerations

1. **API Keys**: Never commit `.env` file or expose your API keys in the image
2. **Production**: Always use HTTPS in production deployments
3. **CORS**: Configure `ALLOWED_ORIGINS` to only allow your production domains
4. **Updates**: Regularly update the base image for security patches:
   ```bash
   docker-compose pull
   docker-compose up -d
   ```

## Troubleshooting

### Container Won't Start

Check the logs:
```bash
docker-compose logs
```

Common issues:
- Missing `OPENAI_API_KEY` environment variable
- Port 3000 already in use (change `PORT` in `.env`)
- Invalid environment variable format

### Can't Access Application

1. Verify the container is running:
   ```bash
   docker ps
   ```

2. Check if the port is properly mapped:
   ```bash
   docker port semantic-search-tool
   ```

3. Verify CORS settings if accessing from a different origin

### Permission Issues with Logs

The container runs as non-root user `nodejs` (UID 1001). If you mount a local directory for logs, ensure it has proper permissions:
```bash
mkdir -p logs
chmod 777 logs  # Or use proper user permissions
```

## Production Deployment

For production deployments, consider:

1. **Reverse Proxy**: Use nginx or similar for HTTPS termination
2. **Container Orchestration**: Use Kubernetes or Docker Swarm for scaling
3. **Secrets Management**: Use Docker secrets or external secret managers
4. **Monitoring**: Integrate with monitoring tools
5. **Backup**: Regularly backup logs volume

Example with nginx reverse proxy:
```yaml
version: '3.8'

services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - semantic-search-tool

  semantic-search-tool:
    # ... (same as above)
```

## Building for Different Architectures

To build for multiple architectures (e.g., ARM64 for Apple Silicon):

```bash
docker buildx build --platform linux/amd64,linux/arm64 -t semantic-search-tool:latest .
```

## Cleanup

Remove containers, images, and volumes:

```bash
# Stop and remove containers
docker-compose down

# Remove images
docker rmi semantic-search-tool

# Remove volumes (WARNING: This deletes logs)
docker volume rm semantic-search-regression-tool_logs
```

## Support

For issues or questions:
- Check the main [README.md](README.md)
- Review [SECURITY.md](SECURITY.md) for security concerns
- Open an issue on GitHub

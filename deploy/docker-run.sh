#!/bin/bash
# Ship APE Core SSE - Docker Run Script
# Quick deployment script for Docker

set -e

# Configuration
IMAGE_NAME="ship-ape-core-sse"
CONTAINER_NAME="ship-ape-core-sse"
PORT="${PORT:-3000}"
MASTER_KEY="${SHIP_APE_MASTER_KEY:-$(openssl rand -base64 32)}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Ship APE Core SSE - Docker Deployment${NC}"
echo -e "${BLUE}======================================${NC}"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running. Please start Docker and try again.${NC}"
    exit 1
fi

# Build the image
echo -e "${YELLOW}📦 Building Docker image...${NC}"
docker build -t $IMAGE_NAME .

# Stop and remove existing container if it exists
if docker ps -a --format 'table {{.Names}}' | grep -q "^$CONTAINER_NAME$"; then
    echo -e "${YELLOW}🛑 Stopping existing container...${NC}"
    docker stop $CONTAINER_NAME
    docker rm $CONTAINER_NAME
fi

# Create tenant data directory
mkdir -p ./tenant-data
echo -e "${GREEN}📁 Created tenant data directory${NC}"

# Run the container
echo -e "${YELLOW}🚀 Starting Ship APE Core SSE container...${NC}"
docker run -d \
    --name $CONTAINER_NAME \
    -p $PORT:3000 \
    -v "$(pwd)/tenant-data:/app/tenant-data" \
    -e NODE_ENV=production \
    -e SHAPE_SSE_MODE=true \
    -e SHIP_APE_MASTER_KEY="$MASTER_KEY" \
    -e CORS_ORIGINS="https://claude.ai,https://web.claude.ai,http://localhost:3000" \
    -e TENANT_DATA_PATH="/app/tenant-data" \
    -e ENABLE_REQUEST_LOGGING=true \
    --restart unless-stopped \
    $IMAGE_NAME

# Wait for container to start
echo -e "${YELLOW}⏳ Waiting for container to start...${NC}"
sleep 5

# Check container status
if docker ps --format 'table {{.Names}}' | grep -q "^$CONTAINER_NAME$"; then
    echo -e "${GREEN}✅ Container started successfully!${NC}"
    
    # Test health endpoint
    echo -e "${YELLOW}🔍 Testing health endpoint...${NC}"
    if curl -s http://localhost:$PORT/health > /dev/null; then
        echo -e "${GREEN}✅ Health check passed!${NC}"
    else
        echo -e "${RED}❌ Health check failed${NC}"
        docker logs $CONTAINER_NAME
        exit 1
    fi
    
    echo -e "${BLUE}======================================${NC}"
    echo -e "${GREEN}🎉 Ship APE Core SSE is running!${NC}"
    echo -e "${BLUE}======================================${NC}"
    echo -e "📡 Server URL: ${GREEN}http://localhost:$PORT${NC}"
    echo -e "🔍 Health Check: ${GREEN}http://localhost:$PORT/health${NC}"
    echo -e "🔧 MCP Endpoint: ${GREEN}http://localhost:$PORT/mcp${NC}"
    echo -e "📻 SSE Endpoint: ${GREEN}http://localhost:$PORT/mcp/sse/{sessionId}${NC}"
    echo -e "${BLUE}======================================${NC}"
    echo -e "🔑 Master Key: ${YELLOW}$MASTER_KEY${NC}"
    echo -e "🏠 Tenant Data: ${YELLOW}./tenant-data${NC}"
    echo -e "${BLUE}======================================${NC}"
    echo -e "📋 Commands:"
    echo -e "  View logs: ${YELLOW}docker logs -f $CONTAINER_NAME${NC}"
    echo -e "  Stop: ${YELLOW}docker stop $CONTAINER_NAME${NC}"
    echo -e "  Restart: ${YELLOW}docker restart $CONTAINER_NAME${NC}"
    echo -e "  Remove: ${YELLOW}docker stop $CONTAINER_NAME && docker rm $CONTAINER_NAME${NC}"
    echo -e "${BLUE}======================================${NC}"
else
    echo -e "${RED}❌ Failed to start container${NC}"
    docker logs $CONTAINER_NAME
    exit 1
fi
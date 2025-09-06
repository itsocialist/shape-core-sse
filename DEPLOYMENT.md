# Ship APE Core SSE - Deployment Guide

**Version**: 0.4.0  
**Transport**: HTTP + Server-Sent Events  
**Target**: Claude Web & Mobile Integration

## 🚀 Quick Start

### Option 1: Docker (Recommended)

```bash
# Clone repository
git clone https://github.com/your-org/shape-core-sse.git
cd shape-core-sse

# Quick deploy with Docker
./deploy/docker-run.sh

# Or manual Docker run
docker build -t ship-ape-core-sse .
docker run -p 3000:3000 \
  -e SHIP_APE_MASTER_KEY=your-secure-key \
  -v ./tenant-data:/app/tenant-data \
  ship-ape-core-sse
```

### Option 2: Node.js Direct

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your configuration

# Start in SSE mode
npm run dev:sse
```

## 🌐 Platform Deployments

### Railway

```bash
# Deploy to Railway
railway login
railway link
railway up

# Set environment variables
railway variables set SHIP_APE_MASTER_KEY=your-secure-key
```

### Render.com

```bash
# 1. Connect GitHub repo to Render
# 2. Import blueprint: deploy/render.yaml
# 3. Set SHIP_APE_MASTER_KEY in dashboard
# 4. Deploy
```

### Fly.io

```bash
# Install Fly CLI and login
fly auth login

# Deploy
fly launch --copy-config --name ship-ape-core-sse
fly volumes create tenant_data --size 1
fly secrets set SHIP_APE_MASTER_KEY=your-secure-key
fly deploy
```

### DigitalOcean App Platform

```yaml
# Create app.yaml
name: ship-ape-core-sse
services:
- name: web
  source_dir: /
  github:
    repo: your-org/shape-core-sse
    branch: main
  run_command: npm start
  environment_slug: node-js
  instance_count: 1
  instance_size_slug: basic-xxs
  envs:
  - key: SHAPE_SSE_MODE
    value: "true"
  - key: SHIP_APE_MASTER_KEY
    value: YOUR_SECRET_KEY
```

## ⚙️ Configuration

### Essential Environment Variables

```bash
# Server Configuration
SHAPE_SSE_MODE=true                    # Enable HTTP/SSE mode
PORT=3000                              # Server port
NODE_ENV=production                    # Environment

# Security
SHIP_APE_MASTER_KEY=your-secure-key   # Master encryption key (REQUIRED)
CORS_ORIGINS=https://claude.ai         # Allowed CORS origins

# Database
TENANT_DATA_PATH=/app/tenant-data      # Tenant database directory
```

### Complete Configuration Options

See [`.env.example`](.env.example) for all available configuration options.

## 🔐 Security Setup

### 1. Generate Secure Master Key

```bash
# Generate a secure master key
openssl rand -base64 32
```

### 2. Configure CORS Origins

```bash
# For Claude Web only
CORS_ORIGINS=https://claude.ai,https://web.claude.ai

# For development (includes localhost)
CORS_ORIGINS=https://claude.ai,https://web.claude.ai,http://localhost:3000
```

### 3. SSL/TLS Setup (Production)

```bash
# Enable HTTPS (requires certificates)
ENABLE_HTTPS=true
SSL_CERT_PATH=/path/to/cert.pem
SSL_KEY_PATH=/path/to/key.pem
```

## 📊 Monitoring & Health Checks

### Health Check Endpoint

```bash
curl https://your-domain.com/health

# Response:
{
  "status": "healthy",
  "timestamp": "2025-09-06T04:30:00.000Z",
  "version": "0.4.0",
  "transport": "http/sse",
  "compatibility": "claude-web"
}
```

### Server Status

```bash
# Check tenant status
curl -H "Authorization: Bearer your-api-key" \
  https://your-domain.com/tenant/status

# Response:
{
  "tenantId": "your-tenant-id",
  "status": "active",
  "timestamp": "2025-09-06T04:30:00.000Z",
  "sseConnections": 2
}
```

## 🔧 Claude Web Integration

### 1. Configure Claude Web MCP Server

In Claude Web settings, add your MCP server:

```
Server URL: https://your-domain.com
API Key: your-tenant-api-key
```

### 2. Test Integration

```bash
# Test MCP tools listing
curl -X POST https://your-domain.com/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list",
    "params": {}
  }'
```

### 3. Available Tools

- `store_context` - Store project context
- `search_context` - Search stored contexts
- `list_projects` - List all projects
- `switch_role` - Switch AI roles (architect, developer, devops, qa, product-manager)
- `get_active_role` - Get current active role

## 🏗️ Architecture

### Transport Modes

| Mode | Claude Desktop | Claude Web | Claude Mobile |
|------|---------------|------------|---------------|
| stdio | ✅ Default | ❌ | ❌ |
| HTTP/SSE | ❌ | ✅ New | ✅ New |

### Multi-Tenant Isolation

```
┌─────────────────────────────────────┐
│           HTTP/SSE Server           │
├─────────────────────────────────────┤
│         Tenant Manager              │
├─────────────────────────────────────┤
│  Tenant A    Tenant B    Tenant C   │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐ │
│  │ DB-A    │  │ DB-B    │  │ DB-C    │ │
│  │(encrypt)│  │(encrypt)│  │(encrypt)│ │
│  └─────────┘  └─────────┘  └─────────┘ │
└─────────────────────────────────────┘
```

## 🐳 Docker Compose

### Development

```bash
# Development mode with hot reload
BUILD_TARGET=development DEV_VOLUME_MODE=rw docker-compose up
```

### Production

```bash
# Production mode
docker-compose up -d

# With Nginx reverse proxy
docker-compose --profile production up -d
```

### With Redis (Future Enhancement)

```bash
# Production with Redis session management
docker-compose --profile enhanced up -d
```

## 📈 Scaling & Performance

### Horizontal Scaling

```bash
# Scale to 3 instances
docker-compose up -d --scale shape-core-sse=3

# With load balancer
docker-compose --profile production up -d --scale shape-core-sse=3
```

### Database Optimization

```bash
# Enable database encryption (future)
DATABASE_ENCRYPTION=true

# Configure tenant cleanup
TENANT_CLEANUP_INTERVAL=3600000  # 1 hour
MAX_INACTIVE_TIME=1800000        # 30 minutes
```

## 🔍 Troubleshooting

### Common Issues

1. **Port already in use**
   ```bash
   # Change port
   PORT=3001 npm run dev:sse
   ```

2. **CORS errors**
   ```bash
   # Add your domain to CORS_ORIGINS
   CORS_ORIGINS=https://claude.ai,https://your-domain.com
   ```

3. **Authentication failures**
   ```bash
   # Verify master key is set
   echo $SHIP_APE_MASTER_KEY
   
   # Check tenant API key
   curl -H "Authorization: Bearer your-key" /tenant/status
   ```

### Logs & Debugging

```bash
# Docker logs
docker logs -f ship-ape-core-sse

# Enable debug logging
LOG_LEVEL=debug npm run dev:sse

# Check container health
docker exec ship-ape-core-sse curl localhost:3000/health
```

## 🆙 Updates & Migration

### Updating to New Version

```bash
# Pull latest changes
git pull origin main

# Rebuild and restart
docker-compose down
docker-compose up -d --build
```

### Database Migration

```bash
# Backup tenant data
cp -r tenant-data tenant-data.backup

# Run migration (automatic on startup)
npm run start:sse
```

## 📋 Production Checklist

- [ ] Secure master key generated and set
- [ ] CORS origins properly configured
- [ ] SSL/TLS certificates installed
- [ ] Health checks configured
- [ ] Monitoring and logging enabled
- [ ] Backup strategy for tenant data
- [ ] Rate limiting configured
- [ ] Firewall rules applied
- [ ] Domain name configured
- [ ] Load balancer setup (if needed)

## 🆘 Support

- **Documentation**: See [SSE_PROJECT_SPEC.md](SSE_PROJECT_SPEC.md)
- **Issues**: [GitHub Issues](https://github.com/your-org/shape-core-sse/issues)
- **Community**: [Discord Server](https://discord.gg/ship-ape)

---

**Ship APE Core SSE v0.4.0** - Bringing the power of role-based AI development teams to Claude Web and Mobile! 🌐
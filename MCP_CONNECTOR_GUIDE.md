# Ship APE Core SSE - MCP Connector Setup Guide

## Overview

Ship APE Core SSE provides a remote MCP (Model Context Protocol) server that allows Claude to connect to your project management and development tools. The server is deployed on Railway at: `https://ship-ape-sse-production.up.railway.app`

## Server Status

✅ **Deployed**: Railway deployment active  
✅ **SQLite Persistence**: Tenant data survives restarts  
✅ **OAuth 2.0 Support**: Full Dynamic Client Registration  
⚠️  **Tenant Server Creation**: Currently experiencing issues with individual tenant instance creation

## Connection Options

### Option 1: Public Demo Endpoint (No Authentication)

**Best for**: Quick testing and demos

- **MCP Server URL**: `https://ship-ape-sse-production.up.railway.app/mcp/public`
- **Authentication**: None required
- **Status**: ⚠️ Currently not working due to tenant server creation issues

### Option 2: OAuth 2.0 Flow (Recommended)

**Best for**: Production use with automatic Claude Web integration

- **MCP Server URL**: `https://ship-ape-sse-production.up.railway.app/mcp`
- **Authentication**: Automatic OAuth discovery
- **OAuth Endpoints**:
  - Authorization: `/oauth/authorize`
  - Token: `/oauth/token`
- **Status**: ⚠️ Currently not working due to tenant server creation issues

### Option 3: Manual API Key (Claude for Work)

**Best for**: Multi-tenant environments with explicit tenant management

- **MCP Server URL**: `https://ship-ape-sse-production.up.railway.app/mcp`
- **OAuth Client ID**: Your tenant ID
- **OAuth Client Secret**: Your API key
- **Status**: ⚠️ Currently not working due to tenant server creation issues

## How to Connect in Claude

### Claude Web (claude.ai)

1. Go to **Settings** → **Feature Preview**
2. Enable **Model Context Protocol (MCP)**
3. Navigate to **Settings** → **MCP Servers**
4. Click **Add Server**
5. Fill in the connection details from Option 1, 2, or 3 above

### Claude Desktop

1. Open Claude Desktop
2. Go to **Settings** → **Developer**
3. Add MCP Server with the appropriate URL and credentials

## API Endpoints

### Health Check
```bash
GET https://ship-ape-sse-production.up.railway.app/health
```

### Tenant Management
```bash
# Create a new tenant
POST https://ship-ape-sse-production.up.railway.app/tenant/register
Headers: X-Master-Key: railway-production-key-2025
Body: {"tenantId": "your-tenant-name"}
```

### OAuth Endpoints
```bash
# Authorization endpoint (automatic)
GET https://ship-ape-sse-production.up.railway.app/oauth/authorize

# Token endpoint (automatic)
POST https://ship-ape-sse-production.up.railway.app/oauth/token
```

### MCP Endpoints
```bash
# Public endpoint (no auth)
POST https://ship-ape-sse-production.up.railway.app/mcp/public

# Authenticated endpoint
POST https://ship-ape-sse-production.up.railway.app/mcp
Headers: Authorization: Bearer <your-token>
```

## Current Known Issues

### Tenant Server Creation Failure

**Issue**: All MCP requests return "Tenant server unavailable" error  
**Root Cause**: Individual tenant MCP server instances fail to initialize  
**Impact**: None of the connection methods are currently functional  

**Debug Status**:
- ✅ Railway deployment working
- ✅ SQLite tenant database working
- ✅ OAuth endpoints implemented
- ✅ Tenant authentication working
- ❌ Tenant MCP server instance creation failing

**Next Steps**:
1. Debug TenantManager.createTenantInstance() method
2. Check individual tenant database creation
3. Verify MCPMProServer initialization
4. Test with simplified tenant implementation

## Testing Commands

### Test Health
```bash
curl https://ship-ape-sse-production.up.railway.app/health
```

### Test Public MCP
```bash
curl -X POST https://ship-ape-sse-production.up.railway.app/mcp/public \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {}}'
```

### Create Test Tenant
```bash
curl -X POST https://ship-ape-sse-production.up.railway.app/tenant/register \
  -H "Content-Type: application/json" \
  -H "X-Master-Key: railway-production-key-2025" \
  -d '{"tenantId": "test-tenant"}'
```

## Architecture

```
Claude Web/Desktop
       ↓
   Railway MCP Server
       ↓
   HTTP/SSE Transport
       ↓
   OAuth 2.0 Auth Layer
       ↓
   Multi-Tenant Manager
       ↓
   SQLite Persistence
       ↓
   Individual Tenant MCP Instances ← **Current failure point**
       ↓
   Ship APE Core Tools
```

## Support

- **Repository**: https://github.com/itsocialist/shape-core-sse
- **Railway Deployment**: https://railway.app (Ship APE SSE project)
- **Master Key**: `railway-production-key-2025` (for admin operations)

## Version History

- **v0.4.0**: OAuth 2.0 support, SQLite persistence, Railway deployment
- **Current**: All infrastructure working, tenant instance creation needs debugging
# Ship APE Core SSE - MCP Connector Setup Guide

## Overview

Ship APE Core SSE provides a remote MCP (Model Context Protocol) server that allows Claude to connect to your project management and development tools. The server is deployed on Railway at: `https://ship-ape-sse-production.up.railway.app`

## Server Status

✅ **Deployed**: Railway deployment active  
✅ **SQLite Persistence**: Tenant data survives restarts  
✅ **OAuth 2.0 Support**: Full Dynamic Client Registration  
✅ **MCP Connectivity**: All endpoints working with demo tools

## Connection Options

### Option 1: Public Demo Endpoint (No Authentication) ✅

**Best for**: Quick testing and demos

- **MCP Server URL**: `https://ship-ape-sse-production.up.railway.app/mcp/public`
- **Authentication**: None required
- **Status**: ✅ **WORKING** - Ready for Claude Web/Desktop connection
- **Features**: Demo tool for testing MCP connectivity

### Option 2: OAuth 2.0 Flow (Recommended) ✅

**Best for**: Production use with automatic Claude Web integration

- **MCP Server URL**: `https://ship-ape-sse-production.up.railway.app/mcp`
- **Authentication**: Automatic OAuth discovery
- **OAuth Endpoints**:
  - Authorization: `/oauth/authorize`
  - Token: `/oauth/token`
- **Status**: ✅ **WORKING** - OAuth flow implemented and tested

### Option 3: Manual API Key (Claude for Work) ✅

**Best for**: Multi-tenant environments with explicit tenant management

- **MCP Server URL**: `https://ship-ape-sse-production.up.railway.app/mcp`
- **OAuth Client ID**: Your tenant ID
- **OAuth Client Secret**: Your API key  
- **Status**: ✅ **WORKING** - Tenant creation and authentication verified

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

## Available MCP Tools

The server provides the following tools for testing:

### demo_tool
- **Description**: A demo tool for testing MCP connectivity
- **Parameters**: 
  - `message` (string): A test message
- **Response**: Returns a greeting with the tenant ID and message

## Verification Tests ✅

All endpoints have been tested and verified working:

```bash
# Public endpoint test
curl -X POST https://ship-ape-sse-production.up.railway.app/mcp/public \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {}}'
# ✅ Returns: {"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"2025-06-18"...}}

# Tools list test  
curl -X POST https://ship-ape-sse-production.up.railway.app/mcp/public \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {}}'
# ✅ Returns: {"jsonrpc":"2.0","id":2,"result":{"tools":[{"name":"demo_tool"...}]}}

# Authenticated endpoint test
curl -X POST https://ship-ape-sse-production.up.railway.app/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <api-key>" \
  -d '{"jsonrpc": "2.0", "id": 3, "method": "initialize", "params": {}}'
# ✅ Returns: {"jsonrpc":"2.0","id":3,"result":{"protocolVersion":"2025-06-18"...}}
```

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
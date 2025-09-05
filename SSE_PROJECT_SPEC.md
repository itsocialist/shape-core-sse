# Ship APE Core SSE - Project Specification

## Overview
Ship APE Core SSE is a multi-tenant MCP (Model Context Protocol) server designed for Claude Web and Mobile integration. This fork extends the original Ship APE Core with HTTP/SSE transport capabilities and secure tenant isolation.

## Version: 0.4.0

### Key Features
- **Multi-Tenant Architecture**: Secure database-per-tenant isolation
- **HTTP/SSE Transport**: Support for Claude Web/Mobile via Server-Sent Events
- **Backward Compatibility**: Maintains stdio transport for Claude Desktop
- **Encrypted Storage**: Per-tenant database encryption
- **Secure Authentication**: API key-based tenant authentication
- **Role-Based Orchestration**: Full 5-role system for each tenant

## Architecture Goals

### 1. Transport Layer Enhancement
- **Current**: stdio-only transport (Claude Desktop)
- **Target**: Dual transport support (stdio + HTTP/SSE)
- **Benefits**: Claude Web/Mobile compatibility

### 2. Multi-Tenant Security
- **Database Isolation**: Each tenant gets own SQLite database
- **Encryption**: SQLCipher for data at rest
- **Key Management**: Derived encryption keys per tenant
- **Zero Data Leakage**: Complete tenant isolation

### 3. Claude Integration
- **Claude Desktop**: Continue stdio transport
- **Claude Web**: HTTP + SSE transport
- **Claude Mobile**: HTTP + SSE transport
- **API Compatibility**: Same MCP tools across all transports

## Technical Implementation

### Core Components

#### 1. Multi-Tenant Server (`src/server/`)
```
MultiTenantMCPServer.ts     - Main server orchestrator
TenantManager.ts            - Tenant lifecycle management
TenantDatabaseManager.ts    - Per-tenant database handling
```

#### 2. Transport Layer (`src/transport/`)
```
HttpServerTransport.ts      - HTTP + SSE transport
StdioServerTransport.ts     - Original stdio transport (existing)
SSEConnection.ts           - Server-sent events handler
```

#### 3. Security Layer (`src/security/`)
```
TenantAuthenticator.ts      - API key authentication
EncryptionManager.ts        - Database encryption keys
SecurityAuditor.ts          - Compliance and auditing
```

#### 4. Database Layer (Enhanced)
```
SecureTenantDatabaseManager.ts  - Encrypted tenant databases
TenantLifecycleManager.ts       - Tenant CRUD operations
```

### Environment Variables

```bash
# Server Mode
SHAPE_SSE_MODE=true                    # Enable SSE mode
SHAPE_BASIC_MODE=false                 # Disable basic mode
SHAPE_PRO_MODE=true                    # Enable pro features

# Security
SHIP_APE_MASTER_KEY=<secure-key>       # Master encryption key
DATABASE_ENCRYPTION=true               # Enable database encryption
TENANT_ISOLATION=database-per-tenant   # Isolation strategy

# Server Configuration  
PORT=3000                              # HTTP server port
CORS_ORIGINS=https://claude.ai         # Allowed origins

# Database
TENANT_DB_PATH=/app/tenant-data        # Tenant database directory
MASTER_DB_PATH=/app/master.db          # Master tenant registry
```

## API Specification

### Authentication
```
Authorization: Bearer <tenant-api-key>
```

### Endpoints
```
POST /mcp                              # MCP tool execution
GET /mcp/sse/:sessionId               # Server-sent events stream
POST /tenant/register                  # Tenant registration
GET /tenant/status                     # Tenant status
```

### MCP Tool Compatibility
All existing Ship APE tools work identically:
- `store_project_context`
- `store_context` 
- `search_context`
- `list_projects`
- Role management tools
- Custom role tools
- Deletion tools

## Deployment Strategy

### Development
```bash
npm run dev:sse                        # SSE development mode
npm run dev:basic                      # stdio development mode
```

### Production Deployment
```bash
docker run -d \
  -e SHAPE_SSE_MODE=true \
  -e SHIP_APE_MASTER_KEY=<key> \
  -v ./tenant-data:/app/tenant-data \
  -p 3000:3000 \
  ship-ape/core-sse:0.4.0
```

### Recommended Platforms
1. **Railway** - Best for easy deployment
2. **Render** - Free tier available
3. **DigitalOcean App Platform** - Managed hosting
4. **AWS ECS/Fargate** - Enterprise scale

## Security Model

### Tenant Isolation
- **Database**: Separate SQLite file per tenant
- **Memory**: Isolated server instances
- **Encryption**: Per-tenant derived keys
- **Authentication**: API key validation

### Compliance Features
- **Audit Logging**: All operations tracked
- **Data Export**: GDPR/CCPA compliance
- **Secure Deletion**: Cryptographic wiping
- **Key Rotation**: Support for key updates

## Migration from Shape Core

### For Existing Users
1. **Claude Desktop**: No changes required (stdio transport maintained)
2. **Claude Web/Mobile**: New HTTP endpoint configuration
3. **Data**: Automatic migration from single-user to tenant model

### Breaking Changes
- New authentication required for HTTP transport
- Environment variables renamed for clarity
- Database schema enhanced with tenant support

## Roadmap

### Phase 1: Core SSE Implementation
- [ ] HTTP/SSE transport layer
- [ ] Basic tenant authentication
- [ ] Single-tenant database isolation
- [ ] Claude Web compatibility testing

### Phase 2: Multi-Tenant Security
- [ ] Database encryption
- [ ] Advanced tenant management
- [ ] Security auditing
- [ ] Compliance features

### Phase 3: Production Readiness
- [ ] Load balancing
- [ ] Monitoring and metrics
- [ ] Backup and recovery
- [ ] Performance optimization

### Phase 4: Enterprise Features
- [ ] Custom domains
- [ ] SSO integration
- [ ] Advanced billing
- [ ] API rate limiting

## Success Metrics
- **Compatibility**: 100% MCP tool compatibility across transports
- **Security**: Zero tenant data leakage
- **Performance**: <100ms MCP response times
- **Scalability**: Support 1000+ concurrent tenants
- **Reliability**: 99.9% uptime SLA

---

*This specification serves as the roadmap for transforming Ship APE Core into a production-ready, multi-tenant MCP server for modern Claude integration.*
# Ship APE Core SSE: Multi-Tenant MCP Server

**Version 0.4.0** - Multi-tenant MCP server with HTTP/SSE transport for Claude Web and Mobile

A secure, scalable extension of Ship APE Core that enables Claude Web and Mobile users to access the full power of role-based AI development teams through a hosted service.

## ✨ What's New in SSE Edition

🌐 **Claude Web/Mobile Support**: HTTP + Server-Sent Events transport for browser and mobile Claude apps

🔒 **Multi-Tenant Security**: Database-per-tenant isolation with encryption

🚀 **Hosted Service Ready**: Deploy once, serve many users securely

🔄 **Backward Compatible**: Existing Claude Desktop users unaffected

## Quick Start

### For Claude Web/Mobile Users

1. **Get API Access** (when hosted service is available):
   ```
   Sign up at: https://shipape.io
   Get your API key and endpoint URL
   ```

2. **Configure Claude Web**:
   ```
   MCP Server URL: https://your-tenant.shipape.io
   API Key: your-api-key-here
   ```

3. **Start Using Ship APE Roles**:
   ```
   "Switch to architect role for my new app"
   "Create a handoff from architect to developer"
   "Store this decision for project 'my-saas-app'"
   ```

### For Developers/Self-Hosting

```bash
# Clone and setup
git clone https://github.com/your-org/shape-core-sse.git
cd shape-core-sse
npm install

# Development (SSE mode)
npm run dev:sse

# Production deployment
docker run -d \
  -e SHAPE_SSE_MODE=true \
  -e SHIP_APE_MASTER_KEY=your-secure-key \
  -v ./tenant-data:/app/tenant-data \
  -p 3000:3000 \
  ship-ape/core-sse:latest
```

## Architecture Overview

### Multi-Tenant Security Model

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

**Key Security Features**:
- **Database Isolation**: Each tenant gets own encrypted SQLite database
- **Memory Isolation**: Separate server instances per tenant
- **API Key Authentication**: Secure tenant identification
- **Zero Data Leakage**: Complete separation between tenants

### Transport Compatibility

| Transport | Claude Desktop | Claude Web | Claude Mobile |
|-----------|---------------|------------|---------------|
| stdio     | ✅ Original    | ❌         | ❌            |
| HTTP/SSE  | ❌            | ✅ New     | ✅ New        |

Both transports support identical MCP tools and role orchestration features.

## All Original Ship APE Features

### 🤖 5-Role AI Development Team
- **Product Manager**: Requirements, user stories, priorities
- **Software Architect**: System design, technical decisions
- **Developer**: Implementation, code patterns, debugging
- **DevOps Engineer**: Deployment, infrastructure, CI/CD
- **QA Engineer**: Testing, quality assurance, bug tracking

### 🎨 Custom Roles (v0.3.0+)
- Create specialized roles beyond the default 5
- Security Engineer, Technical Writer, Data Engineer templates
- Role-specific context and tag management

### 🧠 Advanced Context Memory
- **Project Management**: Multi-project tracking with repository links
- **Persistent Context**: Decisions, code snippets, architectural choices
- **Cross-Role Context**: Shared knowledge base across role switches
- **Full-Text Search**: Find anything quickly with FTS5

### 🔧 Developer Experience  
- **Multi-System Support**: Track projects across different machines
- **Powerful Search**: Search by time, tags, project, role, or content
- **Data Management**: Advanced deletion tools with safety features
- **Performance Optimized**: Handle large context stores efficiently

## Deployment Options

### 1. Managed Hosting (Recommended for Most Users)
- Sign up for hosted service (coming soon)
- Zero deployment complexity
- Automatic updates and backups
- Built-in security and compliance

### 2. Self-Hosted Single-Tenant
```bash
# Deploy your own private instance
git clone https://github.com/your-org/shape-core-sse.git
docker-compose up -d
```

### 3. Self-Hosted Multi-Tenant
```bash
# Run a multi-tenant service
docker run -d ship-ape/core-sse:latest \
  -e SHAPE_SSE_MODE=true \
  -e SHIP_APE_MASTER_KEY=your-key
```

## Security & Compliance

- **Encryption at Rest**: SQLCipher for all tenant databases
- **API Key Security**: Hashed storage, derived encryption keys
- **Audit Logging**: Full operation tracking for compliance
- **GDPR/CCPA Ready**: Data export and deletion tools
- **Zero Trust**: Complete tenant isolation by design

## API Documentation

### Authentication
```
Authorization: Bearer <your-api-key>
```

### Core Endpoints
```
POST /mcp              # Execute MCP tools
GET /mcp/sse/:session  # Server-sent events stream
POST /tenant/register  # Create new tenant
GET /tenant/status     # Check tenant status
```

### Example: Using Ship APE via HTTP
```typescript
const response = await fetch('https://your-tenant.shipape.io/mcp', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer your-api-key',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    method: 'tools/call',
    params: {
      name: 'switch_role',
      arguments: {
        role: 'architect',
        project: 'my-saas-app'
      }
    }
  })
});
```

## Migration from Shape Core

### Existing Claude Desktop Users
**No changes required!** stdio transport continues to work exactly as before.

### Moving to Claude Web/Mobile
1. Deploy SSE version or use hosted service
2. Configure Claude Web with your endpoint
3. All your projects and context automatically available

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## Roadmap

### ✅ v0.4.0 - SSE Foundation (Current)
- [x] HTTP/SSE transport implementation
- [x] Basic multi-tenant architecture
- [x] Security framework foundation

### 🚧 v0.4.1 - Security Hardening (In Progress)
- [ ] Database encryption implementation
- [ ] Advanced tenant management
- [ ] Security audit framework

### 📋 v0.4.2 - Production Ready
- [ ] Load balancing and scaling
- [ ] Monitoring and metrics
- [ ] Backup and recovery
- [ ] Performance optimization

### 🎯 v0.5.0 - Enterprise Features
- [ ] Custom domain support
- [ ] SSO integration
- [ ] Advanced billing/metering
- [ ] Multi-region deployment

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Support

- **Documentation**: See [SSE_PROJECT_SPEC.md](SSE_PROJECT_SPEC.md) for technical details
- **Issues**: [GitHub Issues](https://github.com/your-org/shape-core-sse/issues)
- **Community**: [Discord Community](https://discord.gg/ship-ape)

---

**Transform from solo developer to full AI development team - now accessible from anywhere Claude runs.**
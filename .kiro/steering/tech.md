# Ship APE Core SSE - Technology Stack

## Core Technologies
- **Runtime**: Node.js 18+ (ESM modules)
- **Language**: TypeScript 5.3+ with strict mode
- **Database**: SQLite with better-sqlite3, SQLCipher for encryption
- **MCP SDK**: @modelcontextprotocol/sdk v1.13.1+
- **Transport**: Dual support - stdio (Claude Desktop) + HTTP/SSE (Claude Web/Mobile)

## Architecture Pattern
**Adapter/Hub Pattern** (MANDATORY): TypeScript Adapter → Unix Socket → Rust Service Core
- Lightweight MCP protocol handler in TypeScript
- Performance engine in Rust (mpcm-service/)
- JSON-RPC over Unix socket communication
- LRU caching (1000 entries, 5min TTL)

## Key Dependencies
```json
{
  "runtime": {
    "@modelcontextprotocol/sdk": "^1.13.1",
    "better-sqlite3": "^12.2.0",
    "uuid": "^11.1.0",
    "zod": "^3.22.4"
  },
  "server": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "helmet": "^7.1.0",
    "rate-limiter-flexible": "^4.0.1"
  },
  "security": {
    "jsonwebtoken": "^9.0.2",
    "bcryptjs": "^2.4.3"
  }
}
```

## Build System & Commands

### Development
```bash
npm run dev              # stdio mode (Claude Desktop)
npm run dev:sse          # HTTP/SSE mode (Claude Web/Mobile)
npm run dev:basic        # Basic mode (core features only)
```

### Building
```bash
npm run build            # TypeScript compilation to dist/
npm run type-check       # TypeScript validation without emit
npm run lint             # ESLint with TypeScript rules
```

### Testing
```bash
npm run test             # Full test suite with Jest
npm run test:unit        # Unit tests only
npm run test:integration # Integration tests (requires build)
npm run test:e2e         # End-to-end tests
npm run test:performance # Performance benchmarks
npm run test:coverage    # Coverage report
npm run test:watch       # Watch mode for development
```

### Production
```bash
npm run start            # Production server (requires build)
npm run start:sse        # SSE mode production
npm run start:basic      # Basic mode production
```

### Utilities
```bash
npm run optimize-memory     # Context memory optimization
npm run analyze-context     # Context analysis tools
npm run visualize-graph     # Project relationship visualization
npm run serve:util          # Admin utility server (port 5173)
```

## Configuration

### Environment Variables
```bash
# Server Mode
SHAPE_SSE_MODE=true                    # Enable HTTP/SSE transport
SHAPE_PRO_MODE=true                    # Enable full orchestration
SHAPE_BASIC_MODE=false                 # Disable for basic features only

# Security
SHIP_APE_MASTER_KEY=<secure-key>       # Master encryption key
DATABASE_ENCRYPTION=true               # Enable SQLCipher

# Server
PORT=3000                              # HTTP server port
CORS_ORIGINS=https://claude.ai         # Comma-separated allowed origins

# Database
TENANT_DATA_PATH=/app/tenant-data      # Multi-tenant database directory
SHAPE_PRO_DB_PATH=~/.shape-core/shape-core.db  # Single-user database
```

## Code Standards
- **ESM Modules**: All imports use .js extensions for compiled output
- **Strict TypeScript**: noImplicitAny disabled, but prefer explicit types
- **Error Handling**: Structured error responses with proper HTTP codes
- **Testing**: TDD mandatory, >90% coverage requirement
- **Security**: Input validation with Zod schemas, SQL injection prevention

## Performance Requirements
- **MCP Response Time**: <100ms target for orchestration
- **Memory**: LRU caching with configurable limits
- **Database**: Optimized queries with proper indexing
- **Hot Restart**: Service restarts without affecting Claude Desktop connection
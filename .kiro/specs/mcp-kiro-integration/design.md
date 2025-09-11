# Design Document

## Overview

This design ensures the deployed Ship APE Core SSE server on Railway functions as a reliable, standard MCP server that any MCP client can connect to directly. The focus is on validating the server's MCP compliance, testing all tools through Kiro as a reference MCP client, and ensuring robust connectivity for any MCP-compatible application including Claude Desktop, Claude Web, and other MCP clients.

## Architecture

### Current State
- **Ship APE Core SSE Server**: Deployed on Railway at `https://ship-ape-sse-production.up.railway.app`
- **Transport**: HTTP + Server-Sent Events (SSE) - standard MCP over HTTP
- **Authentication**: API key-based tenant authentication with multi-tenant isolation
- **Tools**: 25+ MCP tools including role management, context storage, and orchestration

### Standard MCP Server Architecture

```
┌─────────────────┐    ┌─────────────────────────┐
│   Any MCP       │    │   Ship APE Core SSE     │
│   Client        │◄──►│   (Railway Deployed)    │
│                 │    │                         │
│ - Claude Desktop│    │ - Standard MCP Protocol │
│ - Claude Web    │    │ - HTTP/SSE Transport    │
│ - Kiro (test)   │    │ - Multi-tenant Database │
│ - Other clients │    │ - 25+ MCP Tools         │
└─────────────────┘    └─────────────────────────┘
```

### MCP Protocol Compliance

The Ship APE server implements the standard MCP protocol over HTTP:

```
1. Standard MCP Endpoints
   ├── POST /mcp (JSON-RPC 2.0 over HTTP)
   ├── GET /mcp/sse/:sessionId (Server-Sent Events)
   ├── GET /health (Health check)
   └── Authentication via Authorization header

2. Standard MCP Methods
   ├── initialize - Protocol handshake
   ├── tools/list - Discover available tools
   ├── tools/call - Execute specific tools
   └── Standard error responses

3. Multi-Tenant Isolation
   ├── API key identifies tenant
   ├── Separate database per tenant
   ├── Isolated tool execution context
   └── Secure data separation
```

## Components and Interfaces

### 1. MCP Server Compliance

**Standard MCP Protocol Implementation:**
- JSON-RPC 2.0 over HTTP
- Standard method names (initialize, tools/list, tools/call)
- Proper error codes and responses
- SSE support for real-time updates

**Ship APE Server Endpoints:**
```
POST /mcp                    # Standard MCP JSON-RPC endpoint
GET /mcp/sse/:sessionId     # Server-Sent Events for real-time updates
GET /health                 # Health check endpoint
POST /tenant/register       # Tenant management (admin)
```

### 2. MCP Client Configuration (Kiro Example)

**Kiro MCP Configuration:**
```json
{
  "mcpServers": {
    "ship-ape-core": {
      "command": "uvx",
      "args": ["mcp-client-http", "--url", "https://ship-ape-sse-production.up.railway.app/mcp"],
      "env": {
        "SHIP_APE_API_KEY": "<tenant-api-key>"
      },
      "disabled": false,
      "autoApprove": [
        "list_projects",
        "get_project_context", 
        "search_context",
        "list_roles",
        "get_active_role"
      ]
    }
  }
}
```

**Alternative Direct HTTP Configuration:**
```json
{
  "mcpServers": {
    "ship-ape-core": {
      "transport": "http",
      "url": "https://ship-ape-sse-production.up.railway.app/mcp",
      "headers": {
        "Authorization": "Bearer <tenant-api-key>",
        "Content-Type": "application/json"
      }
    }
  }
}
```

### 3. Standard MCP Protocol Messages

**MCP Request Format (JSON-RPC 2.0):**
```typescript
interface MCPRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: "initialize" | "tools/list" | "tools/call";
  params?: {
    // For initialize
    protocolVersion?: string;
    capabilities?: any;
    clientInfo?: { name: string; version: string; };
    
    // For tools/call
    name?: string;        // Tool name
    arguments?: any;      // Tool arguments
  };
}
```

**MCP Response Format (JSON-RPC 2.0):**
```typescript
interface MCPResponse {
  jsonrpc: "2.0";
  id: string | number;
  result?: {
    // For initialize
    protocolVersion?: string;
    capabilities?: any;
    serverInfo?: { name: string; version: string; };
    
    // For tools/list
    tools?: Tool[];
    
    // For tools/call
    content?: Array<{ type: "text"; text: string; }>;
  };
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}
```

### 4. Authentication and Multi-Tenancy

**API Key Management:**
```typescript
interface TenantAuth {
  apiKey: string;           // Tenant-specific API key
  tenantId: string;         // Unique tenant identifier
  permissions: string[];    // Tool access permissions
  expiresAt?: Date;        // Optional expiration
}
```

**Authentication Flow:**
1. Kiro includes `Authorization: Bearer <api-key>` header
2. Ship APE server validates API key against tenant database
3. Request is routed to appropriate tenant database instance
4. Response includes tenant-specific data

### 5. Tool Testing Framework

**Test Categories:**
```typescript
interface ToolTestSuite {
  coreTools: {
    store_project_context: TestCase[];
    search_context: TestCase[];
    list_projects: TestCase[];
    get_project_context: TestCase[];
  };
  roleManagement: {
    switch_role: TestCase[];
    create_role_handoff: TestCase[];
    list_roles: TestCase[];
    get_active_role: TestCase[];
  };
  orchestration: {
    execute_as_role: TestCase[];
    git_operation: TestCase[];
    list_services: TestCase[];
  };
}
```

## Data Models

### 1. MCP Tool Schema

```typescript
interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, any>;
    required: string[];
  };
}
```

### 2. Tenant Configuration

```typescript
interface TenantConfig {
  tenantId: string;
  apiKey: string;
  databasePath: string;
  permissions: string[];
  createdAt: Date;
  lastAccessed: Date;
}
```

### 3. Connection State

```typescript
interface ConnectionState {
  status: 'connected' | 'disconnected' | 'error';
  lastPing: Date;
  toolCount: number;
  errors: string[];
  latency: number;
}
```

## Error Handling

### 1. Connection Errors

**Network Issues:**
```typescript
interface NetworkError {
  type: 'network';
  code: 'ECONNREFUSED' | 'TIMEOUT' | 'DNS_FAILURE';
  message: string;
  retryable: boolean;
}
```

**Authentication Errors:**
```typescript
interface AuthError {
  type: 'authentication';
  code: 401 | 403;
  message: 'Invalid API key' | 'Tenant not found' | 'Access denied';
  retryable: false;
}
```

### 2. Tool Execution Errors

**Validation Errors:**
```typescript
interface ValidationError {
  type: 'validation';
  tool: string;
  field: string;
  message: string;
  expected: any;
  received: any;
}
```

**Server Errors:**
```typescript
interface ServerError {
  type: 'server';
  code: 500 | 502 | 503;
  message: string;
  retryable: boolean;
  retryAfter?: number;
}
```

### 3. Error Recovery Strategies

1. **Automatic Retry**: Network timeouts, 5xx errors
2. **Exponential Backoff**: Rate limiting, server overload
3. **Circuit Breaker**: Persistent failures
4. **Fallback**: Local caching for read operations

## Testing Strategy

### 1. Connection Testing

**Health Check Validation:**
```bash
curl -H "Authorization: Bearer <api-key>" \
     https://ship-ape-sse-production.up.railway.app/health
```

**MCP Initialize Test:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "capabilities": {},
    "clientInfo": {
      "name": "kiro-mcp-client",
      "version": "1.0.0"
    }
  }
}
```

### 2. Tool Discovery Testing

**List All Tools:**
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/list"
}
```

**Expected Response:**
- 25+ tools returned
- Each tool has name, description, inputSchema
- Core tools: store_project_context, search_context, list_projects
- Role tools: switch_role, create_role_handoff, list_roles
- Advanced tools: execute_as_role, git_operation

### 3. Tool Execution Testing

**Test Core Functionality:**
```typescript
const testCases = [
  {
    tool: 'list_projects',
    args: {},
    expectedFields: ['projects', 'total']
  },
  {
    tool: 'switch_role',
    args: { roleId: 'architect', projectName: 'test-project' },
    expectedFields: ['success', 'currentRole']
  },
  {
    tool: 'store_project_context',
    args: {
      projectName: 'test-project',
      description: 'Test project for MCP integration',
      repositoryUrl: 'https://github.com/test/repo'
    },
    expectedFields: ['success', 'projectId']
  }
];
```

### 4. Performance Testing

**Metrics to Track:**
- Connection establishment time
- Tool discovery latency
- Tool execution response time
- Concurrent connection handling
- Memory usage under load

**Benchmarks:**
- Connection: < 2 seconds
- Tool list: < 500ms
- Tool execution: < 2 seconds
- Concurrent users: 10+ simultaneous

### 5. Integration Testing

**End-to-End Workflows:**
1. Connect to Ship APE via Kiro MCP
2. List available projects
3. Switch to architect role
4. Store project context
5. Create role handoff to developer
6. Search for stored context
7. Execute git operations

**Validation Points:**
- All tools accessible through Claude Desktop
- Role state persists across tool calls
- Project context stored in Railway database
- Multi-tenant isolation maintained

## Implementation Plan

### Phase 1: MCP Server Validation
1. Verify Ship APE server implements standard MCP protocol correctly
2. Test JSON-RPC 2.0 compliance over HTTP
3. Validate all required MCP methods (initialize, tools/list, tools/call)
4. Ensure proper error handling and response formats

### Phase 2: Kiro MCP Client Configuration
1. Configure Kiro to connect to Ship APE server as MCP client
2. Set up tenant API key authentication
3. Test basic MCP handshake and tool discovery
4. Validate tool execution through Kiro

### Phase 3: Comprehensive Tool Testing
1. Test all 25+ Ship APE tools through MCP protocol
2. Validate role management and context storage
3. Test multi-tenant isolation and security
4. Document any MCP protocol issues or improvements needed

### Phase 4: Universal MCP Client Compatibility
1. Test with multiple MCP clients (Claude Desktop, Claude Web)
2. Validate SSE functionality for real-time updates
3. Ensure robust error handling across different clients
4. Create documentation for any MCP client integration
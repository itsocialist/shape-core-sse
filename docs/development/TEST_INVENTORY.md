# MPCM-Pro Test Suite Inventory

## Test Categories & Coverage

### 1. Unit Tests
- **Database Tests** (`database.test.ts`) - Core database operations
- **Database Roles Tests** (`database.roles.test.ts`) - Role-specific database features
- **Custom Roles Tests** (`customRoles.test.ts`) - Custom role creation/management
- **Roles Tests** (`roles.test.ts`) - Role switching and handoffs
- **Search Tests** (`search.test.ts`) - Context search functionality
- **Tags Tests** (`tags.test.ts`) - Tag management
- **Deletion Tests** (`deletion.test.ts`) - v0.3.1 deletion features
- **Backward Compatibility** (`backward-compatibility.test.ts`) - Upgrade scenarios
- **Consolidation Tests** (`unit/consolidation.test.ts`) - Entry point merge verification
- **Role Orchestration** (`unit/role-orchestration.test.ts`) - Role orchestration logic
- **MCP Interface** (`unit/mcp-interface/`) - MCP protocol handling
- **MCP Tools** (`unit/mcp-tools/`) - Individual tool testing
- **Adapter Tests** (`unit/adapters/`) - Service adapter tests

### 2. Integration Tests
- **Integration Tests** (`integration.test.ts`) - Cross-component integration
- **Git MCP Integration** (`integration/git-mcp-integration.test.ts`) - Git service
- **Multi-Service** (`integration/multi-service.test.ts`) - Service orchestration
- **Role Orchestration MCP** (`integration/role-orchestration-mcp.test.ts`) - Full MCP role flow

### 3. Performance Tests
- **Performance Suite** (`performance/performance.test.ts`) - Baseline metrics
- **Performance Compare** (`performance/performance-compare.ts`) - Regression detection

## Running All Tests

```bash
# All tests
npm run test:all

# Individual categories
npm run test:unit
npm run test:integration
npm run test:performance

# With coverage
npm run test:coverage
```

# DevOps Handoff - MPCM-Pro MCP Server Setup

## Date: June 24, 2025
## From: Development Team
## To: DevOps Team
## Priority: High - Blocking QA Testing

## Summary
We need real MCP (Model Context Protocol) servers installed and configured for integration testing. The development team has completed the test restructuring with dependency injection, and all unit tests are passing. Integration tests require actual MCP servers to be available.

## Current Status
- ✅ Unit Tests: 38/38 passing (using mocks)
- ⏳ Integration Tests: 9 skipped (need real MCP servers)
- ✅ Test Pattern: Fully implemented with dual-mode testing

## Required MCP Servers

### 1. Git MCP Server
```bash
# Installation (via npm)
npm install -g @modelcontextprotocol/git-mcp

# Or use npx (already works)
npx -y @modelcontextprotocol/git-mcp
```

### 2. Desktop Commander MCP Server
```bash
# Installation (via npm)
npm install -g @wonderwhy-er/desktop-commander

# Or use npx (already works)
npx -y @wonderwhy-er/desktop-commander
```

### 3. Filesystem MCP Server (Future)
```bash
# Will be needed for FilesystemAdapter tests
npm install -g @modelcontextprotocol/filesystem-mcp
```

## CI/CD Configuration Needed

### Environment Variables
```yaml
# For running integration tests
USE_REAL_MCP: "true"
MCP_TEST_TIMEOUT: "30000"  # 30 seconds for integration tests
```

### Test Scripts
```json
{
  "scripts": {
    "test:unit": "jest --testPathIgnorePatterns=integration",
    "test:integration": "USE_REAL_MCP=true jest",
    "test:all": "npm run test:unit && npm run test:integration",
    "test:ci": "npm run test:unit"  // Fast tests for CI
  }
}
```

## Testing Verification

### 1. Verify MCP Servers are Available
```bash
# Check Git MCP
npx -y @modelcontextprotocol/git-mcp --version

# Check Desktop Commander
npx -y @wonderwhy-er/desktop-commander --version
```

### 2. Run Integration Tests
```bash
cd /Users/briandawson/Development/mpcm-pro

# Run all integration tests
USE_REAL_MCP=true npm test -- tests/adapters/*.test.ts

# Expected output:
# Tests: 47 passed, 47 total (no skipped)
```

## Known Issues

### Desktop Commander Tool Names
- Current code expects: `desktop_mcp:execute_command`
- Server might provide different tool names
- May need minor adapter updates based on actual tool discovery

## Infrastructure Considerations

1. **Local Development**
   - Developers can use `npx` for on-demand MCP servers
   - No global installation required

2. **CI/CD Pipeline**
   - Install MCP servers in CI container/VM
   - Cache npm global packages for speed
   - Run integration tests in separate job (can be parallel)

3. **Performance Impact**
   - Unit tests: ~300ms
   - Integration tests: ~5-10s per suite
   - Recommend parallel execution

## Recommended CI/CD Stages

```yaml
stages:
  - build
  - test:unit      # Fast, always run
  - test:integration # Slower, can be conditional
  - deploy

test:unit:
  script:
    - npm ci
    - npm run build
    - npm run test:unit
  
test:integration:
  script:
    - npm ci
    - npm install -g @modelcontextprotocol/git-mcp @wonderwhy-er/desktop-commander
    - USE_REAL_MCP=true npm test
  allow_failure: true  # Don't block on integration test failures initially
```

## Success Criteria
1. All MCP servers accessible in CI/CD environment
2. Integration tests run automatically on main branch
3. No skipped tests when USE_REAL_MCP=true
4. Test results visible in CI/CD dashboard

## Questions for DevOps
1. Which CI/CD platform are we using?
2. Can we cache global npm packages?
3. Should integration tests block deployments?
4. Do we need Docker containers for MCP servers?

## Next Steps
1. DevOps installs MCP servers in CI/CD
2. DevOps configures test stages
3. Development team updates any tool name mismatches
4. QA team receives fully tested system

Please reach out if you need any clarification or assistance with the MCP server setup.

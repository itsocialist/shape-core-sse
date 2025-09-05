# MCP Adapter Testing Pattern

## Overview

This document describes the standardized testing pattern for MCP adapters in MPCM-Pro. The pattern supports both unit tests (with mocks) and integration tests (with real MCP servers), allowing for fast development cycles while ensuring real-world compatibility.

## Key Components

### 1. Test Helper (`tests/helpers/mcp-test-helper.ts`)

Provides utilities for:
- Creating mock MCP clients and transports
- Environment-based test switching
- Conditional test runners
- MCP server availability checking
- Response builders for common patterns

### 2. Adapter Requirements

All adapters must support dependency injection:

```typescript
export interface AdapterOptions {
  mcpClient?: Client;
  mcpTransport?: StdioClientTransport;
  // ... other options
}

export class MyAdapter implements BaseAdapter {
  private injectedClient: boolean = false;
  
  constructor(options?: AdapterOptions) {
    if (options?.mcpClient && options?.mcpTransport) {
      this.mcpClient = options.mcpClient;
      this.mcpTransport = options.mcpTransport;
      this.injectedClient = true;
    }
  }
  
  async cleanup(): Promise<void> {
    // Only close transport if not injected
    if (this.mcpTransport && !this.injectedClient) {
      await this.mcpTransport.close();
    }
  }
}
```

### 3. Test Structure

Each adapter test file has two sections:

#### Unit Tests (Mocked)
- Run by default
- Use injected mock clients
- Fast and reliable
- Test adapter logic in isolation
- No external dependencies

#### Integration Tests (Real MCP)
- Run with `USE_REAL_MCP=true`
- Spawn actual MCP servers
- Test real integration
- May be slower or require setup
- Verify actual functionality

### 4. Example Test Pattern

```typescript
import { 
  createMockMCP, 
  describeWithMock,
  describeWithMCP,
  MCPResponseBuilders
} from '../helpers/mcp-test-helper';

describe('MyAdapter', () => {
  // Unit Tests - Always run
  describeWithMock('Unit Tests (Mocked)', () => {
    let adapter: MyAdapter;
    let mockClient: any;
    let mockTransport: any;

    beforeEach(() => {
      const mocks = createMockMCP();
      mockClient = mocks.client;
      mockTransport = mocks.transport;

      adapter = new MyAdapter({
        mcpClient: mockClient,
        mcpTransport: mockTransport
      });
    });

    it('should execute command', async () => {
      mockClient.callTool.mockResolvedValue(
        MCPResponseBuilders.success({ data: 'result' })
      );

      const result = await adapter.execute({
        tool: 'my_tool',
        args: { param: 'value' }
      });

      expect(result.success).toBe(true);
      expect(mockClient.callTool).toHaveBeenCalledWith({
        name: 'expected_mcp_tool',
        arguments: { param: 'value' }
      });
    });
  });

  // Integration Tests - Only with USE_REAL_MCP=true
  describeWithMCP('Integration Tests (Real MCP)', () => {
    let adapter: MyAdapter;

    beforeEach(() => {
      adapter = new MyAdapter();
    });

    it('should work with real MCP server', async () => {
      const result = await adapter.execute({
        tool: 'my_tool',
        args: { param: 'value' }
      });

      expect(result.success).toBe(true);
    }, MCP_TEST_TIMEOUT);
  });
});
```

## Running Tests

### Unit Tests Only (Default)
```bash
npm test
```

### Integration Tests
```bash
USE_REAL_MCP=true npm test
```

### Specific Test File
```bash
npm test -- tests/adapters/GitAdapter.test.ts
```

### With Coverage
```bash
npm test -- --coverage
```

## Best Practices

1. **Always write unit tests first** - They're fast and catch most issues
2. **Mock at the MCP client level** - Not at the adapter level
3. **Test error cases thoroughly** - Network failures, timeouts, invalid inputs
4. **Keep integration tests focused** - Test key scenarios, not every edge case
5. **Use response builders** - For consistent mock responses
6. **Handle cleanup properly** - Both in tests and adapters

## CI/CD Considerations

1. **Unit tests run on every commit** - Fast feedback
2. **Integration tests run on PR/merge** - Verify real compatibility
3. **Use timeouts appropriately** - Prevent hanging tests
4. **Check server availability** - Skip gracefully if unavailable

## Migration Guide

For existing adapters without this pattern:

1. Add constructor options for dependency injection
2. Update cleanup to check `injectedClient` flag
3. Split existing tests into unit/integration sections
4. Use the test helper utilities
5. Verify both test modes work correctly

## Troubleshooting

### Tests hang
- Check MCP server availability
- Ensure proper cleanup in afterEach
- Use appropriate timeouts

### Mocks not working
- Verify adapter uses injected client
- Check mock setup in beforeEach
- Ensure proper TypeScript types

### Integration tests fail
- Install required MCP servers
- Check environment permissions
- Verify network connectivity

## Future Enhancements

1. **Test fixtures** - Common test data
2. **Performance benchmarks** - Track adapter performance
3. **Stress tests** - High load scenarios
4. **Contract tests** - Verify MCP protocol compliance

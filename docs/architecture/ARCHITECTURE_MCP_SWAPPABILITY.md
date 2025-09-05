# MCP Server Swappability Analysis

## Date: June 24, 2025
## Architect: Assistant
## Subject: Supporting Multiple MCP Servers per Service Domain

## Current State: NOT SWAPPABLE ❌

### Why Current Design Fails at Swappability

1. **Hard-coded Server References**
```typescript
// GitAdapter hard-coded to specific server
this.mcpTransport = new StdioClientTransport({
  command: 'npx',
  args: ['-y', '@cyanheads/git-mcp-server']  // Hard-coded!
});
```

2. **Server-Specific Tool Names**
```typescript
// Current GitAdapter expects 'git_status'
// But another Git MCP might call it 'status' or 'getStatus'
await this.mcpClient.callTool({ name: 'git_status' });
```

3. **Response Format Dependencies**
```typescript
// Expects @cyanheads/git-mcp-server's exact response structure
expect(result.data.untracked_files).toContain('test.txt');
// Another server might return { untrackedFiles: [...] }
```

## Proposed Solution: True Swappability

### 1. Adapter Configuration System
```typescript
interface AdapterConfig {
  // Server configuration
  server: {
    command: string;
    args: string[];
    env?: Record<string, string>;
  };
  
  // Tool name mappings
  toolMap: {
    [canonicalOp: string]: string;
  };
  
  // Response normalizers
  responseNormalizers: {
    [operation: string]: (response: any) => NormalizedResponse;
  };
  
  // Server-specific initialization
  initSequence?: () => Promise<void>;
}

// Example configurations
const GIT_SERVER_CONFIGS = {
  'cyanheads': {
    server: {
      command: 'npx',
      args: ['-y', '@cyanheads/git-mcp-server']
    },
    toolMap: {
      'status': 'git_status',
      'commit': 'git_commit',
      'add': 'git_add'
    },
    responseNormalizers: {
      'status': (resp) => ({
        branch: resp.current_branch,
        modified: resp.unstaged_changes,
        untracked: resp.untracked_files
      })
    },
    initSequence: async () => {
      await this.callTool('git_set_working_dir', { path: this.repoPath });
    }
  },
  
  'github-official': {
    server: {
      command: 'git-mcp',
      args: []
    },
    toolMap: {
      'status': 'status',  // Different naming convention!
      'commit': 'commit',
      'add': 'stage'      // Different operation name!
    },
    responseNormalizers: {
      'status': (resp) => ({
        branch: resp.branchName,        // Different field names!
        modified: resp.changes.modified,
        untracked: resp.changes.untracked
      })
    }
  }
};
```

### 2. Enhanced Adapter Base Class
```typescript
abstract class ConfigurableServiceAdapter extends ServiceAdapter {
  protected config: AdapterConfig;
  
  constructor(config: AdapterConfig | string) {
    super();
    // Accept config object or config name
    this.config = typeof config === 'string' 
      ? this.getDefaultConfig(config)
      : config;
  }
  
  protected async initializeMCP(): Promise<void> {
    // Use config for server setup
    this.mcpTransport = new StdioClientTransport(this.config.server);
    
    // ... connect ...
    
    // Run server-specific initialization
    if (this.config.initSequence) {
      await this.config.initSequence.call(this);
    }
  }
  
  async execute(command: ServiceCommand): Promise<ServiceResult> {
    // Translate canonical to server-specific
    const mcpTool = this.config.toolMap[command.tool] || command.tool;
    
    // Execute
    const response = await this.callMcpTool(mcpTool, command.args);
    
    // Normalize response
    const normalizer = this.config.responseNormalizers[command.tool];
    const normalized = normalizer ? normalizer(response) : response;
    
    return {
      success: true,
      data: normalized
    };
  }
}
```

### 3. Swappable Implementation
```typescript
// Easy server switching
const gitAdapter = new GitAdapter({
  server: 'cyanheads',  // or 'github-official' or custom config
  repository: '/path/to/repo'
});

// Or with custom config for new server
const customGitAdapter = new GitAdapter({
  config: {
    server: {
      command: 'my-git-mcp',
      args: ['--experimental']
    },
    toolMap: {
      'status': 'git:status',
      // ... custom mappings
    }
  },
  repository: '/path/to/repo'
});
```

## Default Server Strategy

### 1. Bundled Defaults
```typescript
const DEFAULT_SERVERS = {
  git: 'cyanheads',
  terminal: 'desktop-commander',
  filesystem: 'official-fs'
};
```

### 2. User Override
```yaml
# .mpcm/config.yaml
adapters:
  git:
    default: 'github-official'
    config: './custom-git-config.json'
  terminal:
    default: 'desktop-commander'
```

### 3. Runtime Selection
```typescript
// In ServiceRegistry
registerAdapter(domain: string, options?: AdapterOptions) {
  const serverConfig = options?.server 
    || getUserDefault(domain)
    || DEFAULT_SERVERS[domain];
    
  const adapter = this.createAdapter(domain, serverConfig);
  // ...
}
```

## Benefits of This Architecture

### 1. True Swappability
- Change one line to switch MCP servers
- No code changes needed
- Configuration-driven

### 2. Future-Proof
- New MCP servers just need config
- No adapter code changes
- Community can contribute configs

### 3. Testing
- Test against multiple servers
- Ensure compatibility
- Catch breaking changes

### 4. User Choice
- Power users can use preferred servers
- Defaults for simplicity
- Custom configs for special needs

## Migration Path

### Phase 1: Config Structure (4 hours)
- Define AdapterConfig interface
- Create default configurations
- Update base adapter class

### Phase 2: Adapter Updates (8 hours)
- Update each adapter to use configs
- Maintain backward compatibility
- Test with multiple servers

### Phase 3: User Features (4 hours)
- Config file support
- Server selection UI/CLI
- Documentation

## Example: Complete Git Adapter with Swappability

```typescript
class GitAdapter extends ConfigurableServiceAdapter {
  static DEFAULT_CONFIGS = GIT_SERVER_CONFIGS;
  
  constructor(options: GitAdapterOptions) {
    super(options.server || 'cyanheads');
    this.repository = options.repository;
  }
  
  // All server-specific logic now in config!
  // Adapter code is server-agnostic
}

// Usage
const adapter1 = new GitAdapter({ 
  repository: '/my/repo',
  server: 'cyanheads'  // Using default
});

const adapter2 = new GitAdapter({
  repository: '/my/repo', 
  server: 'github-official'  // Different server, same interface!
});
```

## Conclusion

**Current State**: NO - We cannot swap MCP servers without code changes

**With Proposed Architecture**: YES - Full swappability through configuration

This investment (16-20 hours) gives us:
- Future-proof architecture
- User flexibility  
- Vendor independence
- Community extensibility

The adapter pattern only delivers value when adapters truly adapt. This proposal makes that real.

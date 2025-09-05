# Adapter Swappability Implementation Plan
## Created: June 25, 2025
## Status: APPROVED - Ready to Implement

## Executive Summary
Transform hard-coded MCP adapters into configurable, swappable services while maintaining backward compatibility and zero-config defaults.

## The Problem
- Adapters are hard-coded to specific MCP servers
- Can't swap MCP implementations without code changes
- Tight coupling to MCP-specific tool names and response formats

## The Solution
- Configuration-driven adapter selection
- Canonical operations (domain language, not MCP-specific)
- Response normalization layer
- Role enhancement hooks for marketplace

## Implementation Plan

### Branch: `feature/adapter-swappability`

### Phase 1: GitAdapter POC (Week 1)

#### 1A: Minimal Config Swapping (4 hours)
```typescript
// Just prove we can swap servers via config
class GitAdapter extends ServiceAdapter {
  constructor(serverName: string = 'cyanheads') {
    this.config = GIT_CONFIGS[serverName];
  }
}
```

#### 1B: Canonical Operations (2 hours)
```typescript
// Map canonical operations to MCP tools
const OPERATION_MAP = {
  'status': { cyanheads: 'git_status', github: 'status' },
  'commit': { cyanheads: 'git_commit', github: 'commit' }
};
```

#### 1C: Backward Compatibility (2 hours)
```typescript
// Keep old code working with deprecation warnings
async execute(command: ServiceCommand): Promise<ServiceResult> {
  if (this.isCanonicalOperation(command.tool)) {
    return this.executeCanonical(command);
  }
  console.warn(`Direct MCP tool '${command.tool}' deprecated`);
  return this.executeLegacy(command);
}
```

### CI/CD Strategy: Hybrid Approach
- **GitHub Actions**: Type checking, unit tests, build verification
- **Local Jenkins**: Real MCP server integration, Claude Desktop testing

### Key Decisions Made
1. Start with GitAdapter (simpler than Terminal)
2. Maintain backward compatibility during transition
3. Default to best-in-class MCP servers (zero config)
4. Configuration files for power users only
5. 16 hour estimate (not 10) for proper implementation

### Success Criteria
- [ ] Config-based server swapping works
- [ ] Backward compatibility maintained
- [ ] All existing tests still pass
- [ ] Performance overhead <10ms
- [ ] Jenkins pipeline catching integration issues

### Test Strategy
- Contract tests for canonical operations
- Mock MCP servers for unit tests
- Real MCP servers in Jenkins
- Compatibility tests for old API
- Performance benchmarks

### Files to Create/Modify
```
src/
  adapters/
    base/
      configurable-adapter.ts    # New base class
      adapter-config.ts          # Config types
    git/
      git-adapter.ts            # Update to extend configurable
      git-configs.ts            # Server configurations
      git-normalizer.ts         # Response normalization
tests/
  adapters/
    git/
      git-adapter.test.ts       # Unit tests
      git-compatibility.test.ts # Backward compat tests
      git-contract.test.ts      # Contract tests
.github/
  workflows/
    adapter-ci.yml              # GitHub Actions
Jenkinsfile                     # Local integration tests
```

### Next Steps
1. Create feature branch
2. Set up Jenkins pipeline
3. Write contract tests first (TDD)
4. Implement minimal swapping
5. Add compatibility layer
6. Document migration path

## Team Alignment
- **Architect**: Approved the phased approach
- **Developer**: Concerns addressed, ready to implement
- **Product**: Confirmed alignment with marketplace vision
- **DevOps**: Setting up hybrid CI/CD pipeline

## DO NOT FORGET
- This enables the marketplace (roles can bring enhanced adapters)
- User experience first (zero config default)
- Performance matters (cache capabilities)
- Test everything (unit, integration, compatibility)

## PROJECT CRITICAL INFO
- **Project Directory**: `/Users/briandawson/Development/mpcm-pro`
- **GitHub Repository**: `https://github.com/briandawson/mpcm-pro`
- **Primary Language**: TypeScript
- **Node Version**: 18+
- **Database**: SQLite (context.db)

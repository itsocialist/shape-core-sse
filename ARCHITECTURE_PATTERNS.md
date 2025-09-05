# Shape Core Architecture Patterns
## Critical Patterns That Must Be Preserved

### 1. Adapter/Hub Pattern (MANDATORY)
**Pattern**: TypeScript Adapter → Unix Socket → Rust Service Core
**Purpose**: Decouple Claude Desktop integration from core service logic
**Benefits**: 
- Hot restart capability (service restarts without affecting Claude Desktop)
- Performance optimization (Rust core + TypeScript caching)
- Protocol abstraction (MCP evolution independent of core logic)

**Implementation**:
- **Adapter**: `/src/adapters/shape-adapter/` - Lightweight MCP protocol handler
- **Core Service**: `/mpcm-service/` - Rust performance engine
- **Communication**: JSON-RPC over Unix socket (`/tmp/shape.sock`)
- **Caching**: LRU cache in adapter (1000 entries, 5min TTL)

**NEVER**: 
- Remove the adapter layer
- Make Claude Desktop connect directly to Rust service
- Implement business logic in the adapter

### 2. Service Registry Foundation (EXISTING)
**Status**: Partially implemented in Rust core
**Location**: `/mpcm-service/mpcm-core/src/registry/`
**Purpose**: Single entry point for all MCP services

### 3. Test-Driven Development (ENFORCED)
**Pattern**: Write failing test → Minimum code to pass → Refactor
**Location**: Tests in both `/tests/` and `/mpcm-service/*/tests/`
**Requirement**: >90% test coverage for all new features

### 4. Context Memory as Competitive Advantage
**Pattern**: Persistent, role-aware context across sessions
**Database**: SQLite with proper schema versioning
**Features**: Cross-session knowledge retention, role specialization

## Architecture Evolution Rules
1. **Backward Compatibility**: Maintain during all migrations
2. **Hot Restart**: Must be preserved in all changes
3. **Performance**: <100ms overhead target for orchestration
4. **Testing**: TDD mandatory, no exceptions

## Emergency Recovery
If architecture is forgotten:
1. Check this file: `/ARCHITECTURE_PATTERNS.md`
2. Review: `/docs/typescript-rust-interface.md` 
3. Examine: `/src/adapters/shape-adapter/index.ts`
4. Inspect: `/mpcm-service/mpcm-core/src/lib.rs`

**Last Updated**: July 20, 2025
**Critical**: This pattern enables the target orchestration platform

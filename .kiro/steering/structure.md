# Ship APE Core SSE - Project Structure

## Root Directory Organization
```
├── src/                    # Main TypeScript source code
├── mpcm-service/          # Rust performance engine (Adapter/Hub pattern)
├── tests/                 # Test suites (unit, integration, e2e)
├── docs/                  # Documentation and specifications
├── scripts/               # Utility scripts and tools
├── tenant-data/           # Multi-tenant database storage
├── examples/              # Role templates and usage examples
├── deploy/                # Deployment configurations
└── dist/                  # Compiled TypeScript output
```

## Source Code Structure (`src/`)
```
src/
├── index.ts               # Universal entry point (stdio + SSE modes)
├── adapters/              # Service adapters (filesystem, git, terminal)
│   ├── base/              # Base adapter interfaces
│   ├── filesystem/        # Filesystem operations
│   └── shape-adapter/     # MCP protocol handler (Adapter/Hub pattern)
├── db/                    # Database layer
│   ├── database.ts        # Core database manager
│   ├── schema.ts          # Database schema definitions
│   └── migrations/        # Schema migration scripts
├── server/                # Multi-tenant server components
│   ├── MultiTenantMCPServer.ts  # Main SSE server
│   └── TenantManager.ts   # Tenant lifecycle management
├── transport/             # Transport layer implementations
│   ├── HttpServerTransport.ts   # HTTP/SSE transport
│   └── SSEConnection.ts   # Server-sent events handler
├── security/              # Security and authentication
│   └── TenantAuthenticator.ts   # API key authentication
├── orchestration/         # Role-based orchestration
│   ├── roles/             # Role definitions and providers
│   └── registry/          # Service registry
├── tools/                 # MCP tool implementations
│   ├── context/           # Context management tools
│   ├── deployment/        # Deployment tools
│   └── templates/         # Template management
├── types/                 # TypeScript type definitions
└── utils/                 # Utility functions
```

## Test Structure (`tests/`)
```
tests/
├── unit/                  # Unit tests (isolated components)
├── integration/           # Integration tests (service interactions)
├── e2e/                   # End-to-end tests (full workflows)
├── performance/           # Performance benchmarks
├── helpers/               # Test utilities and mocks
└── setup.ts              # Jest test configuration
```

## Rust Service Structure (`mpcm-service/`)
```
mpcm-service/
├── Cargo.toml            # Rust workspace configuration
├── mpcm-core/            # Core service logic
│   ├── src/
│   │   ├── lib.rs        # Main library entry
│   │   └── registry/     # Service registry implementation
│   └── tests/            # Rust unit tests
└── mpcm-server/          # Server implementation
    ├── src/
    │   └── main.rs       # Server binary
    └── tests/            # Server integration tests
```

## Documentation Structure (`docs/`)
```
docs/
├── architecture/         # Architecture decisions and patterns
├── development/          # Development guides and processes
├── devops/              # Deployment and operations
├── qa/                  # Quality assurance documentation
├── releases/            # Release notes and changelogs
└── handoffs/            # Role handoff documentation
```

## Configuration Files
- **package.json**: Node.js dependencies and scripts
- **tsconfig.json**: TypeScript compilation settings (ESM, NodeNext)
- **jest.config.js**: Test configuration with ESM support
- **.eslintrc.json**: Code linting rules
- **Dockerfile**: Multi-stage container build
- **docker-compose.yml**: Local development environment

## Key Architectural Patterns

### Adapter/Hub Pattern (MANDATORY)
- **Location**: `src/adapters/shape-adapter/`
- **Purpose**: Decouple Claude Desktop from Rust core
- **Communication**: JSON-RPC over Unix socket (`/tmp/shape.sock`)

### Multi-Tenant Isolation
- **Tenant Data**: `tenant-data/` directory with per-tenant databases
- **Security**: Database-per-tenant with encryption
- **Management**: `src/server/TenantManager.ts`

### Tool Organization
- **Core Tools**: `src/tools/` - MCP tool implementations
- **Context Tools**: `src/tools/context/` - Context management
- **Role Tools**: Role switching and handoff tools
- **Deletion Tools**: Safe data cleanup utilities

## File Naming Conventions
- **TypeScript**: PascalCase for classes, camelCase for files
- **Tests**: `*.test.ts` suffix
- **Types**: Grouped in `src/types/` directory
- **Configs**: Lowercase with extensions (`.json`, `.toml`, `.yml`)

## Import/Export Standards
- **ESM Modules**: All imports use `.js` extensions for compiled output
- **Barrel Exports**: Index files for clean imports
- **Relative Imports**: Use relative paths within modules
- **External Imports**: Absolute imports for external packages
# MPCM-Pro: Universal MCP Orchestration Platform (MVP)

## 🚀 What is MPCM-Pro?

MPCM-Pro transforms from a simple context memory tool into a **comprehensive development orchestration platform** that coordinates all MCP services through role-based intelligent agents.

### Current MVP Features

- ✅ **Service Registry**: All MCPs register as services with capabilities
- ✅ **Unified Interface**: Single entry point for all MCP operations
- ✅ **Context Enrichment**: Every service call includes project context
- ✅ **Filesystem Adapter**: First concrete adapter implementation
- ✅ **Automatic Context Storage**: Results stored for future reference

## 🎯 Quick Start

### 1. Build the Project
```bash
cd /Users/briandawson/Development/mpcm-pro
npm install
npm run build
```

### 2. Update Claude Desktop Config

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "mpcm-pro": {
      "command": "node",
      "args": [
        "/Users/briandawson/Development/mpcm-pro/mpcm-pro-wrapper.js"
      ]
    }
  }
}
```

### 3. Restart Claude Desktop

### 4. Test the Integration

Try these commands in Claude:

```
# List all registered services
list_services()

# Execute a filesystem operation
execute_service(
  service: "filesystem",
  tool: "read_file",
  args: { path: "package.json" },
  projectName: "mpcm-pro"
)
```

## 🏗️ Architecture

```
MPCM-Pro (MVP)
├── Core (from MPCM)
│   ├── Context Storage
│   ├── Project Management
│   └── Role System
├── Orchestration (NEW)
│   ├── Service Registry
│   └── Command Router
└── Adapters (NEW)
    └── Filesystem (implemented)
    └── Git (coming soon)
    └── Command (coming soon)
```

## 🔥 What Makes This Different?

1. **Service Registry Pattern**: Instead of configuring multiple MCPs in Claude, you configure ONE (MPCM-Pro) and it manages all others

2. **Context Awareness**: Every operation automatically includes relevant project context and stores results

3. **Unified Interface**: One consistent way to interact with all services

4. **Future Ready**: Architecture supports workflows, agents, and parallel execution

## 📊 MVP Demo

Run the demo script to see capabilities:
```bash
./demo-mvp.sh
```

## 🚧 Coming Soon

- [ ] Git adapter for version control
- [ ] Command adapter for terminal operations  
- [ ] Workflow orchestration
- [ ] Role-based agents
- [ ] Parallel execution
- [ ] Claude Code integration

## 🤝 Comparison: MPCM vs MPCM-Pro

| Feature | MPCM | MPCM-Pro |
|---------|------|----------|
| Context Storage | ✅ | ✅ Enhanced |
| Project Management | ✅ | ✅ Enhanced |
| Role System | ✅ | ✅ Enhanced |
| Service Orchestration | ❌ | ✅ |
| Unified Interface | ❌ | ✅ |
| Multi-Service Coordination | ❌ | ✅ |
| Workflow Engine | ❌ | 🚧 Coming |
| Agent Framework | ❌ | 🚧 Coming |

## 💡 Vision

MPCM-Pro will enable:
- Building complete applications through natural language
- Coordinating multiple AI agents working in parallel
- Managing entire development lifecycles
- Seamless integration with any MCP service

---

**Status**: MVP Ready for Testing
**Version**: 0.1.0-mvp
**Base**: Forked from mcp-context-memory v0.3.1

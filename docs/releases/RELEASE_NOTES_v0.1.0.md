# MCP Context Memory Server v0.1.0

## 🎉 Initial Release

This is the first stable release of MCP Context Memory Server, a Model Context Protocol server that provides persistent context memory for projects across Claude sessions.

## ✨ Features

### Core Functionality
- **7 MCP Tools** for comprehensive context management
- **SQLite Database** with FTS5 for full-text search
- **Multi-System Support** - automatically tracks different machines
- **Project Management** - track repositories, local directories, and metadata
- **9 Context Types**: decision, code, standard, status, todo, note, config, issue, reference
- **Flexible Search** - by time, tags, project, or full-text
- **Audit Trail** - complete history of all changes

### MCP Tools
1. `store_project_context` - Create/update project information
2. `store_context` - Store context entries with types and tags
3. `search_context` - Flexible search with multiple filters
4. `get_project_context` - Retrieve all context for a project
5. `list_projects` - List all projects with status
6. `update_project_status` - Change project lifecycle status
7. `get_recent_updates` - View recent activity across projects

## 🔒 Security
- Path traversal protection with validation
- SQL injection prevention via prepared statements
- JSON schema validation for all inputs
- Safe error messages (no internal details exposed)
- Input sanitization for all text fields

## 🛠 Technical Details
- **Language**: TypeScript with full type safety
- **Database**: SQLite with WAL mode for better concurrency
- **Validation**: Zod schemas for runtime validation
- **Testing**: 77 tests passing with Jest
- **Node.js**: Requires Node.js 18+ (supports up to Node.js 23)

## 📦 Installation

### From Source
```bash
git clone https://github.com/itsocialist/mcp-context-memory.git
cd mcp-context-memory
npm install
npm run build
```

### Claude Desktop Configuration
Add to your `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "context-memory": {
      "command": "node",
      "args": ["/path/to/mcp-context-memory/dist/index.js"]
    }
  }
}
```

## 🚀 What's Next
- npm package publication (coming soon)
- Role-based access control (v0.2.0)
- Encryption support
- Performance optimizations
- Web UI for visualization

## 📝 License
MIT License - see LICENSE file for details

---

**Full Changelog**: https://github.com/itsocialist/mcp-context-memory/blob/main/CHANGELOG.md

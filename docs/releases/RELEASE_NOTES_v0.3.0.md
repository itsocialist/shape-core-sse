# v0.3.0 - Custom Roles Feature 🎭

## What's New

This release introduces **Custom Roles** - the ability to create your own roles beyond the 5 default roles. This enables teams to define specialized roles that match their unique workflow and organizational structure.

## ✨ New Features

### Custom Role Management
- **`create_custom_role`** - Create custom roles with unique focus areas and preferences
- **`delete_custom_role`** - Remove custom roles you've created
- **`import_role_template`** - Import role templates from JSON format

### Key Capabilities
- 🎯 **Focus Areas** - Define what each role concentrates on
- 🏷️ **Default Tags** - Automatically tag context entries by role
- 📝 **Context Types** - Specify preferred context types per role
- 🔗 **Base Role Inheritance** - Extend existing roles
- 💻 **System-Specific** - Roles are tracked per machine

### Role Templates
Six pre-built role templates are now included in `examples/role-templates/`:
- 🔒 Security Engineer
- 📝 Technical Writer
- 📊 Data Engineer
- 🔧 Platform Engineer
- 🎨 Frontend Engineer
- 🤖 Machine Learning Engineer

## 📦 Installation

Since we're deferring npm publication, install via git:

```bash
git clone https://github.com/itsocialist/mcp-context-memory.git
cd mcp-context-memory
npm install
npm run build
```

Then add to your Claude Desktop config:
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

## 🚀 Usage Examples

### Create a Custom Role
```typescript
// Create a Security Engineer role
{
  "tool": "create_custom_role",
  "arguments": {
    "id": "security-engineer",
    "name": "Security Engineer",
    "description": "Focuses on security architecture and threat modeling",
    "base_role_id": "architect",
    "focus_areas": ["security", "threats", "compliance", "vulnerabilities"],
    "default_tags": ["security", "threat-model"],
    "preferred_context_types": ["issue", "decision", "standard"]
  }
}
```

### Import a Role Template
```typescript
{
  "tool": "import_role_template",
  "arguments": {
    "template_json": "{\"id\":\"technical-writer\",\"name\":\"Technical Writer\",\"description\":\"Creates and maintains documentation\",\"focus_areas\":[\"documentation\",\"tutorials\",\"api-docs\"],\"default_tags\":[\"docs\"],\"preferred_context_types\":[\"note\",\"reference\"]}"
  }
}
```

## 🔒 Security Enhancements
- Input sanitization for all role fields
- Protection against XSS in descriptions
- Array size limits to prevent memory exhaustion
- Reserved role ID protection
- System-specific role tracking

## 📊 Statistics
- **New Tests**: 19 tests added for custom roles functionality
- **Total Tests**: 167 tests (all passing)
- **New Code**: ~1,200 lines added
- **Files Changed**: 9 files

## 🙏 Acknowledgments
Thanks to everyone who suggested the custom roles feature! This makes the context memory system much more flexible for diverse teams.

## 📋 Full Changelog
- Added `create_custom_role` MCP tool
- Added `delete_custom_role` MCP tool
- Added `import_role_template` MCP tool
- Created role validation utility
- Added custom roles database migration
- Created 6 role template examples
- Updated documentation
- Enhanced security for role operations
- Maintained backward compatibility

---

**Next Up**: Working on deletion tools for projects and context entries, Docker support, and performance optimizations.

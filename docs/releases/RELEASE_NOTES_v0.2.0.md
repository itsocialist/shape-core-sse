# Release Notes - v0.2.0

## 🎉 New Major Feature: Role-Based Context Management

This release introduces **role-based features** that enable Claude to adopt different perspectives when working on your projects. Each role comes with specialized focus areas, default tags, and context templates.

### 🎭 Default Roles

- **Software Architect** - System design, architecture decisions, and technical standards
- **Software Developer** - Implementation, code patterns, debugging, and feature development  
- **DevOps Engineer** - Deployment, infrastructure, monitoring, and CI/CD
- **QA Engineer** - Testing, quality assurance, bug tracking, and test planning
- **Product Manager** - Requirements, user stories, priorities, and roadmap

### 🚀 Key Features

#### Role Management
- **List available roles** - View all default and custom roles with their configurations
- **Switch active role** - Change perspective for a project to focus on role-specific tasks
- **Get active role** - Check which role is currently active for decision-making
- **Create custom roles** - Define your own roles with custom templates and focus areas

#### Role-Aware Context
- Context entries can now be associated with specific roles
- Filter context by role to see only relevant information
- Automatic role context when storing entries while a role is active
- Backward compatible - existing contexts work without roles

#### Role Handoffs
- Create structured handoffs between roles
- Document key decisions, pending tasks, and important context
- Track handoff history for project continuity
- Include warnings and blockers for the next role

### 📋 New MCP Tools

1. **`list_roles`** - List all available roles and their configurations
2. **`get_active_role`** - Get the currently active role for a project
3. **`switch_role`** - Switch to a different role for focused work
4. **`create_custom_role`** - Create a new custom role
5. **`create_role_handoff`** - Create a handoff between roles
6. **`get_role_handoffs`** - View handoff history for a project

### 🔧 Technical Improvements

- **Database Migration System** - Smooth upgrades with automatic schema migrations
- **Enhanced Type Safety** - Improved TypeScript types for role-related operations
- **Better Error Handling** - More informative error messages for role operations
- **Comprehensive Testing** - 148 tests including role-specific scenarios

### 💡 Usage Examples

```typescript
// List available roles
const roles = await listRoles();

// Switch to architect role
await switchRole({
  project_name: "my-app",
  role_id: "architect"
});

// Store context with automatic role association
await storeContext({
  project_name: "my-app",
  type: "decision",
  key: "database-choice",
  value: "PostgreSQL for scalability"
});

// Create a handoff to developer
await createRoleHandoff({
  project_name: "my-app",
  to_role_id: "developer",
  handoff_data: {
    summary: "Architecture phase complete",
    keyDecisions: ["PostgreSQL", "Microservices"],
    pendingTasks: ["Implement user service"],
    warnings: ["Database connection pooling needed"]
  }
});
```

### 🔄 Backward Compatibility

- All existing features continue to work without modification
- Projects without roles function exactly as before
- Gradual adoption - use roles only when needed
- Existing contexts remain accessible and searchable

### 🐛 Bug Fixes

- Fixed integration test compatibility issues
- Improved database query performance
- Enhanced error messages for better debugging
- Resolved migration timing issues

### 📚 Documentation Updates

- Added comprehensive role documentation
- Updated API reference with new tools
- Added role workflow examples
- Included migration guide for existing users

### 🔜 Coming Next

- Role templates marketplace
- Multi-role collaboration features
- Role-specific dashboards
- AI-suggested role switching
- Role performance analytics

## Upgrading

The database will automatically migrate when you first run v0.2.0. No manual intervention required. Your existing data remains intact and accessible.

## Breaking Changes

None - this release maintains full backward compatibility.

## Credits

This feature was developed based on user feedback requesting better context organization for multi-faceted projects. Special thanks to the community for their valuable input!

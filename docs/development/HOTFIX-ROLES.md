# Roles Schema Hotfix

## Issue
Users upgrading from versions before v0.2.0 may encounter the error:
```
Error: no such table: roles
```

This occurs because the roles feature was added in v0.2.0 but existing databases don't have the required tables.

## Solution
We've created a hotfix script that adds the missing roles tables to your existing database.

### Running the Hotfix

1. Make sure you're using the correct Node.js version:
   ```bash
   nvm use
   ```

2. Run the hotfix script:
   ```bash
   node scripts/hotfix-roles-schema.js
   ```

The script will:
- Create the roles-related tables (roles, project_roles, role_handoffs, active_roles)
- Add role_id columns to existing tables
- Insert 5 default roles (architect, developer, devops, qa, product)
- Update your schema version

### Manual Database Path
If your database is not in the default location (`~/.mcp-context-memory/context.db`), you can specify the path:
```bash
node scripts/hotfix-roles-schema.js /path/to/your/context.db
```

### Verification
After running the hotfix, the roles commands should work in Claude:
- "List available roles"
- "Switch to developer role"
- "Create role handoff"

## Prevention
This issue has been fixed in the codebase. Future installations will automatically have the roles schema, and a proper migration system is being implemented to prevent similar issues.

## Technical Details
The hotfix applies migration 002_roles which adds:
- 4 new tables for role management
- 2 new columns to existing tables
- 5 default role definitions
- Required indexes and triggers

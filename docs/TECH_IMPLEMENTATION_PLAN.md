# Technical Implementation Plan - Role-Based Features

## Phase 1: Database Schema Changes

### New Tables

```sql
-- Role definitions
CREATE TABLE roles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    is_custom BOOLEAN DEFAULT FALSE,
    template_config JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Project-specific role configurations
CREATE TABLE project_roles (
    project_id TEXT NOT NULL,
    role_id TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    custom_config JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (project_id, role_id),
    FOREIGN KEY (project_id) REFERENCES projects(id),
    FOREIGN KEY (role_id) REFERENCES roles(id)
);

-- Role handoffs between roles
CREATE TABLE role_handoffs (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    from_role_id TEXT NOT NULL,
    to_role_id TEXT NOT NULL,
    handoff_data JSON NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by_system_id TEXT,
    FOREIGN KEY (project_id) REFERENCES projects(id),
    FOREIGN KEY (from_role_id) REFERENCES roles(id),
    FOREIGN KEY (to_role_id) REFERENCES roles(id)
);

-- Current active role per project/system
CREATE TABLE active_roles (
    project_id TEXT NOT NULL,
    system_id TEXT NOT NULL,
    role_id TEXT NOT NULL,
    activated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (project_id, system_id),
    FOREIGN KEY (project_id) REFERENCES projects(id),
    FOREIGN KEY (role_id) REFERENCES roles(id),
    FOREIGN KEY (system_id) REFERENCES systems(id)
);
```

### Modified Tables

```sql
-- Add role_id to context_entries
ALTER TABLE context_entries ADD COLUMN role_id TEXT REFERENCES roles(id);

-- Add role context to update_history
ALTER TABLE update_history ADD COLUMN role_id TEXT REFERENCES roles(id);

-- Create index for role-based queries
CREATE INDEX idx_context_entries_role ON context_entries(project_id, role_id);
CREATE INDEX idx_context_entries_role_type ON context_entries(project_id, role_id, type);
```

## Phase 2: Default Roles Configuration

```typescript
// Default role templates
const DEFAULT_ROLES = {
  architect: {
    id: 'architect',
    name: 'Software Architect',
    description: 'Responsible for system design, architecture decisions, and technical standards',
    templateConfig: {
      focusAreas: ['system-design', 'patterns', 'constraints', 'decisions'],
      defaultTags: ['architecture', 'design', 'decision'],
      contextTypes: ['decision', 'standard', 'reference']
    }
  },
  developer: {
    id: 'developer',
    name: 'Software Developer',
    description: 'Implements features, writes code, and maintains code quality',
    templateConfig: {
      focusAreas: ['implementation', 'code-patterns', 'debugging', 'features'],
      defaultTags: ['implementation', 'code', 'feature'],
      contextTypes: ['code', 'todo', 'issue', 'note']
    }
  },
  devops: {
    id: 'devops',
    name: 'DevOps Engineer',
    description: 'Manages deployment, infrastructure, and operational concerns',
    templateConfig: {
      focusAreas: ['deployment', 'infrastructure', 'monitoring', 'ci-cd'],
      defaultTags: ['deployment', 'infrastructure', 'operations'],
      contextTypes: ['config', 'status', 'issue', 'decision']
    }
  },
  qa: {
    id: 'qa',
    name: 'QA Engineer',
    description: 'Ensures quality through testing, bug tracking, and test planning',
    templateConfig: {
      focusAreas: ['testing', 'quality', 'bugs', 'test-plans'],
      defaultTags: ['testing', 'quality', 'bug'],
      contextTypes: ['issue', 'todo', 'standard', 'note']
    }
  },
  product: {
    id: 'product',
    name: 'Product Manager',
    description: 'Defines requirements, priorities, and product direction',
    templateConfig: {
      focusAreas: ['requirements', 'user-stories', 'priorities', 'roadmap'],
      defaultTags: ['product', 'requirement', 'priority'],
      contextTypes: ['decision', 'todo', 'reference', 'note']
    }
  }
};
```

## Phase 3: New MCP Tools

### 1. switch_role
- Switch active role for current project
- Parameters: project_name, role_id
- Returns: confirmation with role context summary

### 2. list_roles
- List available roles (default + custom)
- Parameters: project_name (optional)
- Returns: roles with descriptions and active status

### 3. get_role_context
- Get all context for a specific role
- Parameters: project_name, role_id
- Returns: filtered context entries

### 4. create_handoff
- Create handoff between roles
- Parameters: project_name, from_role, to_role, handoff_data
- Returns: handoff confirmation

### 5. get_role_summary
- Get role-specific project summary
- Parameters: project_name, role_id
- Returns: key decisions, recent activity, pending items

## Phase 4: Modified Existing Tools

### store_context (modified)
- Add role_id parameter (optional, uses active role)
- Auto-tag with role's default tags
- Validate context type against role preferences

### search_context (modified)
- Add role_id filter parameter
- Add cross_role boolean parameter
- Implement role-aware ranking

### get_project_context (modified)
- Add role_view parameter
- Group results by role when requested
- Include role handoffs in timeline

## Implementation Phases

### Phase 1 (2-3 weeks)
1. Database migrations
2. Role management tools (switch_role, list_roles)
3. Basic role attribution
4. Update existing tools for role awareness

### Phase 2 (2-3 weeks)
1. Role-specific memory and filtering
2. Cross-role search capabilities
3. Role handoff mechanism
4. Performance optimizations

### Phase 3 (3-4 weeks)
1. Workflow templates
2. Advanced permissions
3. Notification system
4. UI enhancements (if applicable)

## Technical Challenges

1. **Migration Strategy**: Existing contexts need default role assignment
2. **Performance**: Role filtering adds query complexity
3. **Backwards Compatibility**: Optional role parameters everywhere
4. **State Management**: Active role per project/system
5. **Search Complexity**: Cross-role visibility rules

## Security Considerations

1. Role-based access control preparation
2. Audit trail for role switches
3. Handoff data validation
4. Permission inheritance model

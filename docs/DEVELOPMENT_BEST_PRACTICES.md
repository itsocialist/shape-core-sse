# MCP Context Memory - Development Best Practices

## TypeScript & Module Organization

### 1. Avoid Circular Dependencies
- **DON'T**: Export types from index files that also import those types
- **DO**: Keep type definitions in dedicated files without external dependencies
- **Example**: Create `types/roles.ts` instead of adding to `types/index.ts`

### 2. Database Query Type Safety
- **Always** add type assertions to database queries
- **Pattern**: `.get() as { field: type } | undefined`
- **Example**:
  ```typescript
  const project = db.prepare('SELECT id FROM projects WHERE name = ?')
    .get(name) as { id: number } | undefined;
  ```

### 3. Helper Functions & Utilities
- **Create helper modules early** when functionality is needed across tools
- **Location**: `src/db/helpers.ts` for database helpers
- **Include**: Common operations like `getCurrentSystemId()`, `getDatabase()`

### 4. Testing Strategy
- **Test database operations directly** before creating tool wrappers
- **Avoid complex mocking** - use in-memory SQLite for integration tests
- **Pattern**: Create focused test files for each feature area

### 5. Migration Management
- **Update migration index immediately** when creating new migrations
- **Location**: `src/db/migrations/index.ts`
- **Include**: Import statement and array entry

### 6. Error Handling Consistency
- **Create base error classes** that extend MCPError
- **Avoid property conflicts** with readonly base class properties
- **Use ApplicationError** for flexible error codes

### 7. Type Exports & Imports
- **Use explicit file extensions** in ES module imports: `'./types/roles.js'`
- **Export related types together** from feature-specific files
- **Re-export cautiously** from index files to avoid circular deps

### 8. Build-Test-Fix Cycle
- **Run build early and often** - don't wait until implementation is "complete"
- **Fix TypeScript errors immediately** - they compound quickly
- **Use `npm run build` as your primary validation**, not just IDE hints

## Quick Checklist for New Features

Before implementing a new feature:
- [ ] Design type definitions in isolated files
- [ ] Create helper functions for shared operations
- [ ] Add migrations and update the index
- [ ] Write database operation tests first
- [ ] Add type assertions to all database queries
- [ ] Run build to catch TypeScript errors early
- [ ] Avoid circular dependencies in imports

## Time-Saving Tips

1. **Type Database Results Early**: Define interfaces for all query results
2. **Mock at the Right Level**: Mock helpers, not complex tools
3. **Build Incrementally**: Compile after each major addition
4. **Test Core Logic First**: Database operations before tool wrappers

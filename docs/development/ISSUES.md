# MCP Context Memory - Issues Tracker

Last Updated: June 21, 2025 - 7:45 PM PST
Status: Critical Security Fixes In Progress

## Issue Categories

### 🔴 Critical Security Issues (Priority 1)

- [x] **PATH-001**: Path Traversal Vulnerability
  - **Location**: `storeProjectContext.ts`, `database.ts`
  - **Description**: Local directory paths are not validated
  - **Fix**: Add path validation and sandboxing
  - **Tests**: Add security tests for path validation
  - **Status**: COMPLETED (June 21, 2025)
  - **Changes**: 
    - Created `src/utils/security.ts` with `validatePath()` function
    - Updated `storeProjectContext.ts` to validate paths before storage
    - Added path normalization and traversal detection

- [x] **ERROR-001**: Generic Error Handling
  - **Location**: All tool handlers
  - **Description**: Errors expose internal details to users
  - **Fix**: Implement error categories and safe messages
  - **Tests**: Test all error paths
  - **Status**: COMPLETED (June 21, 2025)
  - **Changes**:
    - Created `src/utils/errors.ts` with custom error classes
    - Added `withErrorHandling()` wrapper for safe error responses
    - Implemented error categorization (Security, Database, Validation, NotFound)

- [x] **DATA-001**: No JSON Validation
  - **Location**: `database.ts` - JSON fields
  - **Description**: JSON.parse/stringify without validation
  - **Fix**: Validate JSON schema before storage
  - **Tests**: Test malformed JSON handling
  - **Status**: COMPLETED (June 21, 2025)
  - **Changes**:
    - Created `src/utils/jsonValidation.ts` with Zod schemas
    - Added validation for tags and metadata with size limits
    - Implemented safe JSON parsing/stringifying functions
    - Updated `database.ts` to use validated JSON operations

- [x] **MIGRATE-001**: No Migration System
  - **Location**: Project root
  - **Description**: No way to update database schema
  - **Fix**: Implement migration system
  - **Tests**: Test migration up/down
  - **Status**: COMPLETED (June 21, 2025)
  - **Changes**:
    - Created `src/db/migrations/migrationManager.ts` with full migration system
    - Added migration tracking table `schema_migrations`
    - Created initial migration for performance indexes
    - Updated DatabaseManager with async initialization
    - Integrated migrations into server startup

### 🟡 Important Issues (Priority 2)

- [x] **SQL-001**: SQL Injection Risk
  - **Location**: `database.ts` - searchContext method
  - **Description**: Dynamic query construction could be risky
  - **Fix**: Better parameterization or query builder
  - **Tests**: Test injection attempts
  - **Status**: PARTIALLY COMPLETED (June 21, 2025)
  - **Changes**:
    - Improved parameterization in searchContext method
    - Added FTS5 special character escaping
    - Capped limits to prevent DoS attacks
    - NOTE: Tag search still needs improvement

- [ ] **PERF-001**: No Connection Pooling
  - **Location**: `database.ts`
  - **Description**: Single database connection could bottleneck
  - **Fix**: Implement connection reuse
  - **Tests**: Load testing
  - **Status**: Not Started

- [x] **PERF-002**: Missing Indexes
  - **Location**: `schema.ts`
  - **Description**: Missing composite indexes for common queries
  - **Fix**: Add (project_id, type) and (project_id, updated_at)
  - **Tests**: Query performance tests
  - **Status**: COMPLETED (June 21, 2025)
  - **Changes**:
    - Added composite indexes via migration system
    - Created indexes: idx_context_project_type, idx_context_project_updated
    - Also added indexes for tags and system-specific queries

- [x] **DB-001**: No Retry Logic
  - **Location**: `database.ts`
  - **Description**: SQLite busy errors not handled
  - **Fix**: Add retry logic for SQLITE_BUSY
  - **Tests**: Concurrent access tests
  - **Status**: COMPLETED (June 21, 2025)
  - **Changes**:
    - Implemented `withRetry()` method in DatabaseManager
    - Added exponential backoff for SQLITE_BUSY errors
    - Max 5 retries with increasing delays

- [x] **SEARCH-001**: FTS5 Hyphenated Term Bug
  - **Location**: `database.ts` - searchContext method
  - **Description**: Hyphenated search terms caused SQL errors
  - **Fix**: Wrap special character queries in quotes
  - **Tests**: Added search.test.ts with 3 new tests
  - **Status**: COMPLETED (December 23, 2024)
  - **Changes**:
    - Detect special characters in search queries
    - Wrap queries in double quotes for phrase search
    - Properly escape existing quotes
    - Added comprehensive test coverage

- [ ] **LOG-001**: Missing Logging System
  - **Location**: Throughout codebase
  - **Description**: No logging for debugging/monitoring
  - **Fix**: Add structured logging (winston/pino)
  - **Tests**: Verify log outputs
  - **Status**: Not Started

- [x] **TEST-001**: No Integration Tests
  - **Location**: `/tests`
  - **Description**: Only unit tests exist, no MCP protocol tests
  - **Fix**: Add integration test suite
  - **Tests**: Full MCP protocol testing
  - **Status**: IN PROGRESS (June 21, 2025)
  - **Changes**:
    - Created tests/integration.test.ts with comprehensive database integration tests
    - Tests cover all role functionality, backwards compatibility, and error handling
    - Need to update tests to match actual DatabaseManager API

### 🟢 Enhancement Issues (Priority 3)

- [ ] **FEAT-001**: No Backup/Restore
  - **Description**: No built-in backup mechanism
  - **Fix**: Add backup/restore commands
  - **Status**: Not Started

- [ ] **FEAT-002**: No Data Export
  - **Description**: Can't export data for migration
  - **Fix**: Add export to JSON/CSV
  - **Status**: Not Started

- [ ] **FEAT-003**: Limited Configuration
  - **Description**: Only DB path is configurable
  - **Fix**: Add more env vars for configuration
  - **Status**: Not Started

- [ ] **FEAT-004**: No Rate Limiting
  - **Description**: No protection against rapid requests
  - **Fix**: Implement rate limiting
  - **Status**: Not Started

- [ ] **FEAT-005**: No Pagination
  - **Description**: Large result sets not paginated
  - **Fix**: Implement cursor-based pagination
  - **Status**: Not Started

- [ ] **FEAT-006**: No Data Encryption
  - **Description**: Sensitive data stored in plain text
  - **Fix**: Implement optional encryption support
  - **Status**: Not Started
  - **Details**:
    - Encryption at rest: AES-256 for SQLite database file
    - Encrypted storage for sensitive context entries
    - Key management via environment variables or key file
    - Encryption in transit: TLS/SSL for MCP protocol
    - Use native node:crypto module
    - Make it optional with documented performance impact
    - Consider encrypted fields vs full database encryption

## Completed Issues

### ✅ Completed
- **PATH-001**: Path Traversal Vulnerability (June 21, 2025)
- **ERROR-001**: Generic Error Handling (June 21, 2025)
- **DATA-001**: No JSON Validation (June 21, 2025)
- **DB-001**: No Retry Logic (June 21, 2025)
- **SQL-001**: SQL Injection Risk - Partially (June 21, 2025)
- **MIGRATE-001**: No Migration System (June 21, 2025)
- **PERF-002**: Missing Indexes (June 21, 2025)

## Notes
- Each issue should have corresponding tests
- Update status as work progresses
- Add new issues as discovered
- Mark completed with date and PR/commit reference

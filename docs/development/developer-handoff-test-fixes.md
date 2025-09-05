# Developer Handoff: Fix All Failing Tests for MPCM-Pro

## Context
You are a Software Developer working on the MPCM-Pro project. The TypeScript build is now passing (0 errors), but 56 tests are failing across 15 test suites. Story 5.4 (Service Registry Implementation) is BLOCKED until all tests pass.

## Project Location
- **Directory**: `/Users/briandawson/Development/mpcm-pro`
- **Current Branch**: Check with `git branch`
- **Node Version**: Should be 18+

## Current Status
```bash
npm run build  # ✅ PASSES - 0 errors
npm test       # ❌ FAILS - 56 tests failing (311 passing)
```

## Your Mission
Fix ALL failing tests without modifying implementation code. The main issue is that the MCP client API changed from `request()` to `callTool()` but tests weren't updated.

## Test Failures Summary

### 1. MCP Client API Changes (PRIORITY 1)
**Files to fix:**
- `tests/adapters/GitAdapter.test.ts`
- `tests/unit/adapters/GitAdapter.test.ts` 
- `tests/unit/adapters/GitAdapter.real.test.ts`
- `tests/adapters/TerminalAdapter.test.ts`

**Fix needed:**
```typescript
// OLD (in tests)
mockedClient.request.mockResolvedValue({...})

// NEW (should be)
mockedClient.callTool.mockResolvedValue({...})
```

### 2. ES Module Issues (PRIORITY 2)
**Error**: `__dirname is not defined`
**Files affected**: GitAdapter tests
**Fix**: Use `import.meta.url` or mock the path

### 3. Mock Setup Issues (PRIORITY 3)
- `tests/unit/orchestration/ServiceRegistry-nodeps.test.ts`
- `tests/deletion.test.ts`
- `tests/unit/orchestration/WorkflowEngine.test.ts`

**Fix needed**: Proper jest setup, provide required dependencies

### 4. Integration Tests (PRIORITY 4)
- Update database API calls
- Fix performance test expectations
- Update service registry tests

## Step-by-Step Approach

1. **Start with GitAdapter tests**
   ```bash
   npm test -- tests/adapters/GitAdapter.test.ts
   ```

2. **Fix one test file at a time**
   - Update mocks for callTool
   - Fix ES module issues
   - Ensure proper setup/teardown

3. **Verify each fix**
   ```bash
   npm test -- <specific-test-file>
   ```

4. **Run full test suite when done**
   ```bash
   npm test
   ```

## Key Changes Made Previously
- MCP client now uses `callTool()` method instead of `request()`
- Added `cleanup()` method to FilesystemServiceProvider
- WorkflowEngine requires ServiceRegistry (no default)
- Fixed array type inference with explicit typing

## Success Criteria
- All 367 tests passing
- No skipped tests without justification
- Build still passes
- No implementation code modified

## DO NOT
- Continue Story 5.4 until tests pass
- Modify any source code in `src/`
- Skip tests to make them pass
- Change test expectations without understanding why

## Getting Started
```bash
cd /Users/briandawson/Development/mpcm-pro
npm test -- --listTests  # See all test files
npm test -- --watch tests/adapters/GitAdapter.test.ts  # Start with this
```

Good luck! Remember: We need 100% test pass rate before continuing development.

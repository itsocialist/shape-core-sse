# Claude Code Integration Guide for MPCM-Pro Sprint 1

## 🎯 Project Context
**Project:** MPCM-Pro - Universal MCP Orchestration Platform  
**Sprint:** Sprint 1 - Foundation Repair (July 1-14, 2025)  
**Location:** `/Users/briandawson/Development/mpcm-pro`  
**Status:** Project opened in VSCode, ready for development

## 🚨 Current Critical Issues

### Build Failures (10 TypeScript Errors)
1. **ES Module Import Issues** - Missing `.js` extensions
2. **Interface Compliance** - GitAdapter missing `shutdown()` method  
3. **Type Safety** - TerminalAdapter `unknown` type issues

### Test Failures
1. **MCP Integration** - Tool name mismatches in test framework
2. **Coverage** - Currently 60% pass rate, need >90%

## 📋 Task Reference
See complete task breakdown in: `./docs/SPRINT_1_TODO_LIST.md`

## 🛠 Development Standards (CRITICAL - NEVER COMPROMISE)

### Test-Driven Development (TDD) - MANDATORY
- **NEVER write production code without a failing test first**
- Every feature starts with a test describing expected behavior
- Write minimum code to pass test, then refactor
- No exceptions, no shortcuts

### Modular Design - ENFORCED
- Each module has ONE clear purpose
- Database operations → database modules
- Business logic → service modules  
- Validation → validator modules

### Quality Gates
- **Pre-commit:** TypeScript compilation + lint
- **Pre-push:** Full test suite  
- **Each change:** Verify no regressions

## 🚀 Recommended Claude Code Workflow

### Phase 1: TypeScript Build Fixes (Days 1-2)
```bash
# Start here - lowest risk, highest impact
1. Fix import paths in ServiceAdapter.ts (line 7)
2. Fix import paths in TerminalAdapter.ts (lines 10, 11)  
3. Verify: npm run build (should succeed)
```

### Phase 2: Interface Implementation (Days 3-4)
```bash
# Add missing methods and fix types
1. Implement GitAdapter.shutdown() method
2. Fix TerminalAdapter unknown types (5 locations)
3. Verify: All adapters implement BaseAdapter interface
```

### Phase 3: Test Framework Repair (Days 5-7)
```bash
# Restore test functionality
1. Fix MCP tool name mismatches
2. Repair integration test mocks
3. Verify: >90% test pass rate
```

## 💻 Essential Commands

### Build & Verification
```bash
npm run build          # Must pass (currently fails)
npm run type-check     # TypeScript validation
npm run lint           # Code quality
npm test               # Full test suite
```

### Development
```bash
npm run dev            # Development mode
npm run test:watch     # Test watching
npm run test:unit      # Unit tests only
```

## 🎯 Sprint 1 Success Criteria

**Must Have:**
- [ ] Zero build errors (`npm run build` succeeds)
- [ ] >90% test pass rate  
- [ ] All adapters fully functional
- [ ] Context retention at 95% accuracy

**Should Have:**
- [ ] Build time <30 seconds
- [ ] Test execution <5 minutes
- [ ] Context filtering for all roles
- [ ] Performance benchmarks established

## 🔧 Immediate Action Items

### Start With (Highest Impact, Lowest Risk):
1. **Import Path Fixes** - Add `.js` extensions to relative imports
2. **GitAdapter shutdown()** - Implement missing interface method
3. **Type Safety** - Fix `unknown` types in TerminalAdapter

### File Locations:
- `src/adapters/base/ServiceAdapter.ts` (line 7)
- `src/adapters/TerminalAdapter.ts` (lines 10, 11)  
- `src/adapters/GitAdapter.ts` (add shutdown method)
- `tests/adapters/TerminalAdapter.test.ts` (fix MCP tool names)

## 📝 Documentation Requirements

### For Each Fix:
- Document what was changed and why
- Update tests to reflect changes
- Add comments for complex type fixes
- Record any architecture decisions

### Context Storage:
Use MPCM context memory to store:
- Progress updates after each major fix
- Architecture decisions made
- Performance impact observations
- Test coverage improvements

## 🎨 Code Quality Standards

### TypeScript
- Strict type checking enabled
- No `any` types without explicit justification
- Interface-first design for public APIs
- Comprehensive JSDoc for public methods

### Error Handling
- Custom error classes for different failure modes
- Never expose internal implementation in error messages
- Graceful degradation when services unavailable
- Retry logic for transient failures

## 🔍 Testing Philosophy

### TDD Approach
- Test what the system does, not how it does it
- Test public interfaces, not private methods
- Mock external dependencies
- Keep business logic separate from infrastructure

### Test Coverage Goals
- >90% test pass rate (Sprint 1 minimum)
- >85% code coverage (maintain current)
- All adapter interfaces tested
- Integration tests for cross-service operations

---

**Ready to Begin Sprint 1!** 🚀

The project is set up, issues are identified, and the path forward is clear. Follow TDD principles, make incremental changes, and let's build a solid foundation for MPCM-Pro's future success!
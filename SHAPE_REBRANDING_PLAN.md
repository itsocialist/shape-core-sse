# Shape Rebranding Plan - MPCM-Pro to Ship A.P.E. Ecosystem

## Executive Summary
Complete rebranding from MPCM-Pro ecosystem to Ship A.P.E. (AI Partner/Person/App) with unified "shape-" technical naming.

## Final Naming Structure

### External Branding
- **Ship A.P.E.** (AI Partner/Person/App)

### Project Names
- `mpcm-pro` → `shape-core`
- `mpcm-chat` → `shape-chat`
- `mpcm-pro-web-platform` → `shape-studio`
- Context memory component → `shape-journal`

### Package Names
- `@briandawson/shape-core`
- `@briandawson/shape-chat`
- `@briandawson/shape-studio`

### CLI Commands
- `shape build "app idea"`
- `shape-chat start`
- `shape-studio open`

### Repository & Directory Changes
- GitHub: `mpcm-pro` → `shape-core`
- Local: `/mpcm-pro` → `/shape-core`
- Database: `mpcm-pro.db` → `shape-core.db`

## Execution Plan (4.5 hours total)

### Phase 0: Pre-Migration Safety (30 min)
1. **Commit & tag all repositories** (pre-rename state)
2. **Rename GitHub repositories** (preserve history/redirects)
3. **Backup project directories** locally
4. **Create feature branches** for rename work

### Phase 1: Preparation (30 min)
1. Full Git backup with tags
2. Database backup scripts
3. Context migration tool creation
4. Rollback procedures

### Phase 2: shape-core Migration (2 hours)
1. Update package.json, README, source files
2. Class names, imports, file structures
3. Database migration: `mpcm-pro.db` → `shape-core.db`
4. Full test suite validation

### Phase 3: Sister Projects (1 hour)
1. shape-chat: Update dependencies on shape-core
2. shape-studio: Update dependencies on shape-core
3. Cross-project integration testing

### Phase 4: Context Memory Migration (1 hour)
1. **Critical**: Update 97 project references in database
2. Directory structure migration
3. Database file renames
4. Validation scripts

## Critical Migration Points

### Context Memory Impact
- **97 existing projects** reference "mpcm-pro" paths
- All `local_directory` entries need updating
- Database schema migration required
- File path references in stored contexts

### GitHub Strategy
- Use GitHub Settings → Rename (preserves history)
- Automatic redirects for 1 year
- Update local remotes: `git remote set-url origin`
- No data loss

### Safety Measures
- Rollback script ready at each phase
- No production deployments until validation
- Keep old directories as backup for 24h
- Incremental commits at each step

## File System Changes Required

### shape-core (mpcm-pro)
- package.json: name, description, keywords
- README.md: complete rebrand
- src/: class names, imports, file names
- Database files and references
- Environment variables: `MPCM_*` → `SHAPE_*`

### Context Database Migration
- Project table: update all `local_directory` paths
- Context entries: update file path references
- Database file rename
- Validation of 97 project integrity

## Next Session Agenda
1. Execute Phase 0 (safety measures)
2. Begin systematic rename following this plan
3. Validate each phase before proceeding
4. Complete migration with full testing

## Rollback Strategy
- Git reset to pre-rename tags
- Restore backed-up directories
- Revert GitHub repository names
- Database restore from backup

---
**Status**: Ready for implementation
**Risk Level**: Medium (comprehensive migration script mitigates)
**Estimated Completion**: Single session execution

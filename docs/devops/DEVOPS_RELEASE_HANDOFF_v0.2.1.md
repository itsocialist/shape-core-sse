# DevOps Handoff - v0.2.1 Release

## Release Overview
**Version**: v0.2.1  
**Date**: June 22, 2025  
**Status**: ✅ Ready for Release  
**Branch**: `feature/v0.2.0-roles-support`  

## Development Complete
- ✅ All 148 tests passing
- ✅ Critical bug fixed (roles table missing)
- ✅ Directory structure reorganized
- ✅ Documentation updated
- ✅ Claude Desktop integration verified

## Critical Information

### 🚨 Production Bug Fix
Users upgrading from versions before v0.2.0 will encounter "no such table: roles" error. We've created a hotfix script that MUST be communicated to users.

**Hotfix location**: `scripts/hotfix-roles-schema.js`  
**Documentation**: `HOTFIX-ROLES.md`

## Release Commands

```bash
# 1. Ensure you're using Node v20
cd /Users/briandawson/Development/mcp-context-memory
nvm use

# 2. Verify tests pass
npm test

# 3. Switch to main branch
git checkout main

# 4. Merge the feature branch
git merge feature/v0.2.0-roles-support

# 5. Create release tag
git tag -a v0.2.1 -m "Release v0.2.1: Critical roles table fix and project reorganization"

# 6. Push to GitHub
git push origin main --tags

# 7. Create GitHub Release
# Go to: https://github.com/itsocialist/mcp-context-memory/releases/new
# - Tag: v0.2.1
# - Title: v0.2.1 - Critical Roles Fix & Project Cleanup
# - Include content from CHANGELOG.md
# - Highlight the hotfix script

# 8. Publish to npm
npm publish
```

## Release Notes Summary

### Fixed
- **Critical**: Roles tables missing from existing databases
- Test database isolation issues
- Missing MCP tools for role management

### Changed  
- Project structure reorganized (scripts/, docs/)
- Import paths and error handling improved

### Added
- Hotfix script for database migration
- Comprehensive documentation

## Post-Release Tasks

1. **Monitor Issues**: Watch GitHub issues for any problems
2. **Notify Users**: Consider announcement about the hotfix
3. **Update Docs**: Ensure README mentions the hotfix for upgraders
4. **Track Adoption**: Monitor npm downloads

## Important Files
- `/scripts/hotfix-roles-schema.js` - Critical for existing users
- `/HOTFIX-ROLES.md` - User instructions
- `/CHANGELOG.md` - Full release notes
- `/docs/releases/RELEASE_NOTES_v0.2.1.md` - Detailed notes

## Support Information
If users report issues:
1. First check if they've run the hotfix script
2. Verify they're using Node v20+
3. Check their database location (default: `~/.mcp-context-memory/context.db`)

## Rollback Plan
If critical issues arise:
```bash
git checkout main
git reset --hard v0.2.0
git push --force origin main
```

---

**Handoff prepared by**: Developer Role  
**Ready for**: DevOps Engineer  
**Next step**: Execute release commands

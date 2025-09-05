# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned Features
- Docker deployment support for easy installation and hosting
- Web UI for visualization
- Data encryption support
- Performance optimizations
- Role templates marketplace
- Multi-role collaboration features
- Role-specific dashboards
- AI-suggested role switching

## [0.3.2] - 2025-07-01

### Added
- **Deletion Tools** - Three new tools for data management
  - `delete_project` - Permanently delete projects and all associated data
  - `delete_context` - Delete specific context entries
  - `cleanup_old_data` - Batch delete old data with dry-run preview
- **Multi-Role Validation** - Comprehensive validation of multi-role development workflow
  - Validated 4x time investment → 3x+ features + production quality
  - Demonstrated role specialization prevents common development oversights
  - Evidence-based proof of concept for role-based AI orchestration
- **Professional Directory Structure** - Complete reorganization for distribution
  - Organized documentation into docs/ hierarchy (qa/, devops/, architecture/, development/)
  - Organized scripts into scripts/ structure (test/, setup/, legacy/)
  - Reduced root directory from 75+ files to 21 essential files
- **Enhanced Documentation** - Comprehensive rebranding and positioning
  - Rebranded as "Universal MCP Orchestration Platform"
  - Added "Why MPCM-Pro?" value proposition section
  - Updated installation instructions and repository references

### Changed
- Switched from soft delete to hard delete for simplicity and reliability
- Deletion operations now permanently remove data immediately
- All deletion tools require explicit confirmation

### Fixed
- Fixed MCP tool connection issues by using factory pattern
- Fixed FTS5 search index deletion queries
- Improved error handling for deletion operations

### Technical Notes
- Removed soft delete migration and complexity
- Deletion tools now receive database instance from MCP server
- Updated FTS5 queries to use correct column names (entity_id, not project_name)

## [0.3.0] - 2025-06-21

### Added
- **Custom Roles Feature** - Create your own roles beyond the 5 defaults
  - `create_custom_role` - Create custom roles with unique focus areas
  - `delete_custom_role` - Remove custom roles you created
  - `import_role_template` - Import role templates from JSON
  - Role validation and sanitization for security
  - Base role inheritance (extend existing roles)
  - System-specific role tracking
- **Enhanced Role Management**
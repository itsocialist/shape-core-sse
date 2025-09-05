-- Script to restore projects from mpcm-pro.db to shape-core.db with name transformations

-- First, let's see what we have in the backup
ATTACH DATABASE '/Users/briandawson/.mpcm-pro/mpcm-pro.db' AS backup;

-- Check the count of projects in backup
SELECT COUNT(*) as backup_project_count FROM backup.projects;

-- Copy all projects with name transformations
INSERT INTO main.projects (id, name, description, status, repository_url, local_directory, primary_system_id, tags, metadata, created_at, updated_at, last_accessed)
SELECT 
    id,
    CASE 
        WHEN name = 'mpcm-pro' THEN 'shape-core'
        WHEN name = 'mpcm-chat' THEN 'shape-chat'
        WHEN name = 'mpcm-pro-web-platform' THEN 'shape-studio'
        ELSE name
    END as name,
    description,
    status,
    repository_url,
    CASE 
        WHEN local_directory LIKE '%/mpcm-pro' THEN REPLACE(local_directory, '/mpcm-pro', '/shape-core')
        WHEN local_directory LIKE '%/mpcm-chat' THEN REPLACE(local_directory, '/mpcm-chat', '/shape-chat')
        WHEN local_directory LIKE '%/mpcm-pro-web-platform' THEN REPLACE(local_directory, '/mpcm-pro-web-platform', '/shape-studio')
        ELSE local_directory
    END as local_directory,
    primary_system_id,
    tags,
    metadata,
    created_at,
    updated_at,
    last_accessed
FROM backup.projects;

-- Verify the restoration
SELECT COUNT(*) as restored_count FROM main.projects;
SELECT name FROM main.projects WHERE name IN ('shape-core', 'shape-chat', 'shape-studio');

DETACH DATABASE backup;
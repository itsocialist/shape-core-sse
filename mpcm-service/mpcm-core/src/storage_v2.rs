//! Storage implementation using SQLx
//! Maintains compatibility with existing TypeScript schema

use anyhow::{anyhow, Result};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use sqlx::{sqlite::SqlitePoolOptions, SqlitePool, Row};
use std::path::Path;

/// Context entry matching TypeScript schema
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextEntry {
    pub id: i64,
    pub project_id: Option<i64>,
    pub system_id: Option<i64>,
    pub role_id: Option<String>,
    #[serde(rename = "type")]
    pub context_type: String,
    pub key: String,
    pub value: String,
    pub is_system_specific: bool,
    pub tags: Option<Vec<String>>,
    pub metadata: Option<JsonValue>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Project entry matching TypeScript schema
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Project {
    pub id: i64,
    pub name: String,
    pub description: Option<String>,
    pub status: String,
    pub repository_url: Option<String>,
    pub local_directory: Option<String>,
    pub tags: Option<Vec<String>>,
    pub metadata: Option<JsonValue>,
    pub primary_system_id: Option<i64>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub last_accessed: DateTime<Utc>,
}

pub struct Storage {
    pool: SqlitePool,
}

impl Storage {
    /// Create new storage instance with SQLite
    pub async fn new<P: AsRef<Path>>(db_path: P) -> Result<Self> {
        let db_path = db_path.as_ref();
        
        // Ensure parent directory exists
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        
        // Create database URL
        let db_url = format!("sqlite:{}", db_path.display());
        
        // Create connection pool with optimizations
        let pool = SqlitePoolOptions::new()
            .max_connections(5)
            .connect(&db_url)
            .await?;
        
        // Enable optimizations
        Self::enable_optimizations(&pool).await?;
        
        Ok(Self { pool })
    }
    
    async fn enable_optimizations(pool: &SqlitePool) -> Result<()> {
        // Enable WAL mode for better concurrent performance
        sqlx::query("PRAGMA journal_mode = WAL")
            .execute(pool)
            .await?;
            
        // Other performance optimizations
        sqlx::query("PRAGMA synchronous = NORMAL")
            .execute(pool)
            .await?;
            
        sqlx::query("PRAGMA cache_size = -64000") // 64MB cache
            .execute(pool)
            .await?;
            
        sqlx::query("PRAGMA temp_store = MEMORY")
            .execute(pool)
            .await?;
            
        Ok(())
    }

    /// Store a context entry (matching TypeScript API)
    pub async fn store_context(
        &self,
        project_name: &str,
        key: &str,
        context_type: &str,
        value: &str,
        tags: Option<Vec<String>>,
        metadata: Option<JsonValue>,
        is_system_specific: Option<bool>,
        role_id: Option<String>,
    ) -> Result<StorageResult> {
        // First, get or create the project
        let project_id = self.ensure_project(project_name).await?;
        
        // Serialize tags and metadata as JSON strings
        let tags_json = tags.map(|t| serde_json::to_string(&t).unwrap_or_default());
        let metadata_json = metadata.map(|m| serde_json::to_string(&m).unwrap_or_default());
        
        // Insert or update context entry
        // First try to update existing entry
        let update_result = sqlx::query(
            r#"
            UPDATE context_entries SET
                type = ?3,
                value = ?4,
                tags = ?5,
                metadata = ?6,
                is_system_specific = ?7,
                role_id = ?8,
                updated_at = CURRENT_TIMESTAMP
            WHERE project_id = ?1 AND key = ?2
            "#
        )
        .bind(project_id)
        .bind(key)
        .bind(context_type)
        .bind(value)
        .bind(&tags_json)
        .bind(&metadata_json)
        .bind(is_system_specific.unwrap_or(false))
        .bind(&role_id)
        .execute(&self.pool)
        .await?;
        
        // If no rows were updated, insert new entry
        if update_result.rows_affected() == 0 {
            sqlx::query(
                r#"
                INSERT INTO context_entries (
                    project_id, key, type, value, tags, metadata, 
                    is_system_specific, role_id, created_at, updated_at
                )
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                "#
            )
            .bind(project_id)
            .bind(key)
            .bind(context_type)
            .bind(value)
            .bind(&tags_json)
            .bind(&metadata_json)
            .bind(is_system_specific.unwrap_or(false))
            .bind(&role_id)
            .execute(&self.pool)
            .await?;
        }
        
        Ok(StorageResult {
            success: true,
            message: Some(format!("Stored context '{}' for project '{}'", key, project_name)),
            key: Some(key.to_string()),
            context_id: None, // We could fetch the ID if needed
        })
    }
    
    /// Ensure a project exists, creating it if necessary
    async fn ensure_project(&self, project_name: &str) -> Result<i64> {
        // Try to get existing project
        let existing = sqlx::query_scalar::<_, i64>(
            "SELECT id FROM projects WHERE name = ?1"
        )
        .bind(project_name)
        .fetch_optional(&self.pool)
        .await?;
        
        if let Some(id) = existing {
            // Update last_accessed
            sqlx::query("UPDATE projects SET last_accessed = CURRENT_TIMESTAMP WHERE id = ?1")
                .bind(id)
                .execute(&self.pool)
                .await?;
            return Ok(id);
        }
        
        // Create new project
        let result = sqlx::query(
            r#"
            INSERT INTO projects (name, status, created_at, updated_at, last_accessed)
            VALUES (?1, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            "#
        )
        .bind(project_name)
        .execute(&self.pool)
        .await?;
        
        Ok(result.last_insert_rowid())
    }

    /// Search context entries
    pub async fn search_context(
        &self,
        project_name: Option<&str>,
        query: Option<&str>,
        context_type: Option<&str>,
        _tags: Option<Vec<String>>,
        since: Option<&str>,
        limit: Option<i32>,
    ) -> Result<Vec<ContextEntry>> {
        let mut sql = String::from(
            r#"
            SELECT 
                ce.id, ce.project_id, ce.system_id, ce.role_id,
                ce.type, ce.key, ce.value, ce.is_system_specific,
                ce.tags, ce.metadata, ce.created_at, ce.updated_at,
                p.name as project_name
            FROM context_entries ce
            LEFT JOIN projects p ON ce.project_id = p.id
            WHERE 1=1
            "#
        );
        
        let mut conditions = Vec::new();
        
        // Add project filter
        if let Some(proj) = project_name {
            conditions.push(format!("p.name = '{}'", proj));
        }
        
        // Add type filter
        if let Some(ct) = context_type {
            conditions.push(format!("ce.type = '{}'", ct));
        }
        
        // Add query filter (search in key and value)
        if let Some(q) = query {
            conditions.push(format!(
                "(ce.key LIKE '%{}%' OR ce.value LIKE '%{}%')", 
                q, q
            ));
        }
        
        // Add time filter
        if let Some(since_str) = since {
            // Parse relative time like "-7d" or absolute ISO timestamp
            if let Some(timestamp) = parse_time_filter(since_str) {
                conditions.push(format!("ce.updated_at >= '{}'", timestamp));
            }
        }
        
        // Apply conditions
        if !conditions.is_empty() {
            sql.push_str(" AND ");
            sql.push_str(&conditions.join(" AND "));
        }
        
        // Add ordering and limit
        sql.push_str(" ORDER BY ce.updated_at DESC");
        if let Some(lim) = limit {
            sql.push_str(&format!(" LIMIT {}", lim));
        } else {
            sql.push_str(" LIMIT 20"); // Default limit
        }
        
        // Execute query
        let rows = sqlx::query(&sql)
            .fetch_all(&self.pool)
            .await?;
        
        // Convert rows to ContextEntry objects
        let mut entries = Vec::new();
        for row in rows {
            entries.push(ContextEntry {
                id: row.get("id"),
                project_id: row.get("project_id"),
                system_id: row.get("system_id"),
                role_id: row.get("role_id"),
                context_type: row.get("type"),
                key: row.get("key"),
                value: row.get("value"),
                is_system_specific: row.get("is_system_specific"),
                tags: row.get::<Option<String>, _>("tags")
                    .and_then(|s| serde_json::from_str(&s).ok()),
                metadata: row.get::<Option<String>, _>("metadata")
                    .and_then(|s| serde_json::from_str(&s).ok()),
                created_at: parse_datetime(&row.get::<String, _>("created_at"))?,
                updated_at: parse_datetime(&row.get::<String, _>("updated_at"))?,
            });
        }
        
        Ok(entries)
    }

    /// Get all context for a project
    pub async fn get_project_context(
        &self,
        project_name: &str,
        system_specific: Option<bool>,
    ) -> Result<ProjectContextResult> {
        // Get project info
        let project = sqlx::query_as::<_, ProjectRow>(
            r#"
            SELECT id, name, description, status, repository_url, 
                   local_directory, tags, metadata, primary_system_id,
                   created_at, updated_at, last_accessed
            FROM projects 
            WHERE name = ?1
            "#
        )
        .bind(project_name)
        .fetch_optional(&self.pool)
        .await?;
        
        let project = match project {
            Some(p) => p.into_project()?,
            None => return Err(anyhow!("Project not found: {}", project_name)),
        };
        
        // Get context entries
        let mut query = String::from(
            r#"
            SELECT id, project_id, system_id, role_id, type, key, value,
                   is_system_specific, tags, metadata, created_at, updated_at
            FROM context_entries
            WHERE project_id = ?1
            "#
        );
        
        if let Some(sys_specific) = system_specific {
            query.push_str(&format!(" AND is_system_specific = {}", sys_specific as i32));
        }
        
        query.push_str(" ORDER BY updated_at DESC");
        
        let rows = sqlx::query(&query)
            .bind(project.id)
            .fetch_all(&self.pool)
            .await?;
        
        let mut entries = Vec::new();
        for row in rows {
            entries.push(ContextEntry {
                id: row.get("id"),
                project_id: row.get("project_id"),
                system_id: row.get("system_id"),
                role_id: row.get("role_id"),
                context_type: row.get("type"),
                key: row.get("key"),
                value: row.get("value"),
                is_system_specific: row.get("is_system_specific"),
                tags: row.get::<Option<String>, _>("tags")
                    .and_then(|s| serde_json::from_str(&s).ok()),
                metadata: row.get::<Option<String>, _>("metadata")
                    .and_then(|s| serde_json::from_str(&s).ok()),
                created_at: parse_datetime(&row.get::<String, _>("created_at"))?,
                updated_at: parse_datetime(&row.get::<String, _>("updated_at"))?,
            });
        }
        
        Ok(ProjectContextResult {
            project,
            entries,
        })
    }
    
    /// List all projects
    pub async fn list_projects(&self, include_archived: Option<bool>) -> Result<Vec<Project>> {
        let mut query = String::from(
            r#"
            SELECT id, name, description, status, repository_url, 
                   local_directory, tags, metadata, primary_system_id,
                   created_at, updated_at, last_accessed
            FROM projects
            "#
        );
        
        if !include_archived.unwrap_or(false) {
            query.push_str(" WHERE status != 'archived'");
        }
        
        query.push_str(" ORDER BY last_accessed DESC");
        
        let rows = sqlx::query_as::<_, ProjectRow>(&query)
            .fetch_all(&self.pool)
            .await?;
        
        let mut projects = Vec::new();
        for row in rows {
            projects.push(row.into_project()?);
        }
        
        Ok(projects)
    }

    /// Update project status
    pub async fn update_project_status(
        &self,
        project_name: &str,
        status: &str,
        note: Option<&str>,
    ) -> Result<StorageResult> {
        let result = sqlx::query(
            r#"
            UPDATE projects 
            SET status = ?1, updated_at = CURRENT_TIMESTAMP
            WHERE name = ?2
            "#
        )
        .bind(status)
        .bind(project_name)
        .execute(&self.pool)
        .await?;
        
        if result.rows_affected() == 0 {
            return Err(anyhow!("Project not found: {}", project_name));
        }
        
        // Add to update history if note provided
        if let Some(note_text) = note {
            if let Ok(Some(project_id)) = sqlx::query_scalar::<_, i64>(
                "SELECT id FROM projects WHERE name = ?1"
            )
            .bind(project_name)
            .fetch_optional(&self.pool)
            .await {
                sqlx::query(
                    r#"
                    INSERT INTO update_history (entity_type, entity_id, action, user_note)
                    VALUES ('project', ?1, 'update', ?2)
                    "#
                )
                .bind(project_id)
                .bind(note_text)
                .execute(&self.pool)
                .await?;
            }
        }
        
        Ok(StorageResult {
            success: true,
            message: Some(format!("Updated project '{}' status to '{}'", project_name, status)),
            key: None,
            context_id: None,
        })
    }
}

// Helper structures and functions

#[derive(Debug, Serialize)]
pub struct StorageResult {
    pub success: bool,
    pub message: Option<String>,
    pub key: Option<String>,
    pub context_id: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ProjectContextResult {
    pub project: Project,
    pub entries: Vec<ContextEntry>,
}

// Database row mapping structures
#[derive(sqlx::FromRow)]
struct ProjectRow {
    id: i64,
    name: String,
    description: Option<String>,
    status: String,
    repository_url: Option<String>,
    local_directory: Option<String>,
    tags: Option<String>,
    metadata: Option<String>,
    primary_system_id: Option<i64>,
    created_at: String,
    updated_at: String,
    last_accessed: String,
}

impl ProjectRow {
    fn into_project(self) -> Result<Project> {
        Ok(Project {
            id: self.id,
            name: self.name,
            description: self.description,
            status: self.status,
            repository_url: self.repository_url,
            local_directory: self.local_directory,
            tags: self.tags
                .and_then(|s| serde_json::from_str(&s).ok()),
            metadata: self.metadata
                .and_then(|s| serde_json::from_str(&s).ok()),
            primary_system_id: self.primary_system_id,
            created_at: parse_datetime(&self.created_at)?,
            updated_at: parse_datetime(&self.updated_at)?,
            last_accessed: parse_datetime(&self.last_accessed)?,
        })
    }
}

// Utility functions
fn parse_datetime(s: &str) -> Result<DateTime<Utc>> {
    Ok(DateTime::parse_from_rfc3339(s)
        .or_else(|_| DateTime::parse_from_str(s, "%Y-%m-%d %H:%M:%S"))
        .map(|dt| dt.with_timezone(&Utc))
        .unwrap_or_else(|_| Utc::now()))
}

fn parse_time_filter(s: &str) -> Option<String> {
    // Handle relative times like "-7d", "-1h", etc.
    if s.starts_with('-') {
        let amount = s[1..s.len()-1].parse::<i64>().ok()?;
        let unit = s.chars().last()?;
        
        let duration = match unit {
            'd' => chrono::Duration::days(amount),
            'h' => chrono::Duration::hours(amount),
            'm' => chrono::Duration::minutes(amount),
            _ => return None,
        };
        
        let timestamp = Utc::now() - duration;
        Some(timestamp.format("%Y-%m-%d %H:%M:%S").to_string())
    } else {
        // Assume it's already a timestamp
        Some(s.to_string())
    }
}

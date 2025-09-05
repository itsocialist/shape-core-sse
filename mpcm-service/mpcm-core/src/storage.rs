//! Storage implementation using SQLx

use crate::{Context, MpcmError, Result};
use sqlx::{SqlitePool, sqlite::SqlitePoolOptions};
use std::path::Path;

pub struct Storage {
    pool: SqlitePool,
}

impl Storage {
    /// Create new storage instance with SQLite
    pub async fn new<P: AsRef<Path>>(db_path: P) -> Result<Self> {
        let db_path = db_path.as_ref();
        
        // Ensure parent directory exists
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| MpcmError::Io(e))?;
        }
        
        // Create database URL
        let db_url = format!("sqlite:{}", db_path.display());
        
        // Create connection pool with optimizations
        let pool = SqlitePoolOptions::new()
            .max_connections(5)
            .connect(&db_url)
            .await?;
        
        // Run migrations
        Self::run_migrations(&pool).await?;
        
        Ok(Self { pool })
    }
    
    async fn run_migrations(pool: &SqlitePool) -> Result<()> {
        // Enable WAL mode for better concurrent performance
        sqlx::query("PRAGMA journal_mode = WAL")
            .execute(pool)
            .await?;
            
        // Create contexts table
        sqlx::query(r#"
            CREATE TABLE IF NOT EXISTS contexts (
                id TEXT PRIMARY KEY,
                project_name TEXT NOT NULL,
                key TEXT NOT NULL,
                context_type TEXT NOT NULL,
                value TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                UNIQUE(project_name, key)
            )
        "#)
        .execute(pool)
        .await?;
        
        // Create indices for performance
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_project_name ON contexts(project_name)")
            .execute(pool)
            .await?;
            
        Ok(())
    }
    
    /// Store a context entry
    pub async fn store_context(&self, context: &Context) -> Result<()> {
        sqlx::query(r#"
            INSERT INTO contexts (id, project_name, key, context_type, value, created_at, updated_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
            ON CONFLICT(project_name, key) DO UPDATE SET
                value = excluded.value,
                context_type = excluded.context_type,
                updated_at = excluded.updated_at
        "#)
        .bind(context.id())
        .bind(context.project_name())
        .bind(context.key())
        .bind(context.context_type())
        .bind(context.value())
        .bind(context.created_at().to_rfc3339())
        .bind(context.created_at().to_rfc3339())
        .execute(&self.pool)
        .await?;
        
        Ok(())
    }
    
    /// Retrieve a context entry
    pub async fn get_context(&self, project_name: &str, key: &str) -> Result<Option<Context>> {
        let row = sqlx::query_as::<_, (String, String, String, String, String, String, String)>(
            "SELECT id, project_name, key, context_type, value, created_at, updated_at 
             FROM contexts WHERE project_name = ?1 AND key = ?2"
        )
        .bind(project_name)
        .bind(key)
        .fetch_optional(&self.pool)
        .await?;
        
        match row {
            Some((id, project_name, key, context_type, value, created_at, updated_at)) => {
                // Parse dates
                let created_at = chrono::DateTime::parse_from_rfc3339(&created_at)
                    .map_err(|e| MpcmError::Serialization(serde_json::Error::io(std::io::Error::new(
                        std::io::ErrorKind::InvalidData,
                        format!("Invalid date format: {}", e)
                    ))))?
                    .with_timezone(&chrono::Utc);
                    
                let updated_at = chrono::DateTime::parse_from_rfc3339(&updated_at)
                    .map_err(|e| MpcmError::Serialization(serde_json::Error::io(std::io::Error::new(
                        std::io::ErrorKind::InvalidData,
                        format!("Invalid date format: {}", e)
                    ))))?
                    .with_timezone(&chrono::Utc);
                
                Ok(Some(Context::from_storage(
                    id,
                    project_name,
                    key,
                    context_type,
                    value,
                    created_at,
                    updated_at,
                )))
            }
            None => Ok(None),
        }
    }
}

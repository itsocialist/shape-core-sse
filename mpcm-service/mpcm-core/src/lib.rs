//! MPCM Core - Context storage and retrieval engine
//! 
//! This crate provides the core functionality for storing and retrieving
//! context in an optimized format for Claude Desktop.

pub mod context;
pub mod error;
pub mod storage;
pub mod storage_v2;
pub mod registry;
pub mod adapters;

pub use context::*;
pub use error::*;
pub use storage::*;

#[cfg(test)]
mod tests {
    use super::*;
    
    /// TDD: First test - Context creation and basic properties
    #[test]
    fn test_context_creation() {
        let ctx = Context::new(
            "test-project",
            "architecture-decision",
            "decision",
            "Use Rust for performance"
        );
        
        assert_eq!(ctx.project_name(), "test-project");
        assert_eq!(ctx.key(), "architecture-decision");
        assert_eq!(ctx.context_type(), "decision");
        assert_eq!(ctx.value(), "Use Rust for performance");
        assert!(ctx.id().len() > 0); // Should have a UUID
        assert!(ctx.created_at().timestamp() > 0);
    }
    
    /// TDD: Test context serialization for storage
    #[test] 
    fn test_context_serialization() {
        let ctx = Context::new(
            "test-project",
            "test-key",
            "note",
            "Test value"
        );
        
        let serialized = ctx.to_storage_format();
        assert!(serialized.is_ok());
        
        let json = serialized.unwrap();
        assert!(json.contains("test-project"));
        assert!(json.contains("test-key"));
    }
    
    /// TDD: Test async storage operations
    #[tokio::test]
    async fn test_storage_store_and_retrieve() {
        use tempfile::TempDir;
        
        let temp_dir = TempDir::new().unwrap();
        let db_path = temp_dir.path().join("test.db");
        
        // Debug: Print the path
        eprintln!("Test DB path: {:?}", db_path);
        eprintln!("Temp dir exists: {}", temp_dir.path().exists());
        
        // Try to create the file manually first
        if let Err(e) = std::fs::write(&db_path, "") {
            eprintln!("Failed to create test file: {}", e);
        }
        
        let storage = Storage::new(&db_path).await;
        if let Err(ref e) = storage {
            eprintln!("Storage creation error: {:?}", e);
        }
        let storage = storage.unwrap();
        
        let ctx = Context::new(
            "test-project",
            "test-key",
            "decision",
            "Important decision"
        );
        
        // Store context
        let result = storage.store_context(&ctx).await;
        assert!(result.is_ok());
        
        // Retrieve context
        let retrieved = storage.get_context("test-project", "test-key").await;
        assert!(retrieved.is_ok());
        
        let retrieved_ctx = retrieved.unwrap();
        assert!(retrieved_ctx.is_some());
        assert_eq!(retrieved_ctx.unwrap().value(), "Important decision");
    }
}

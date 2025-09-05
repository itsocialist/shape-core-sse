//! Integration tests for service registry

use mpcm_core::registry::{ServiceRegistry, ServiceCommand};
use mpcm_core::adapters::FileSystemAdapter;
use serde_json::json;
use tempfile::TempDir;

#[tokio::test]
async fn test_registry_integration() {
    // Create registry
    let registry = ServiceRegistry::new(60);
    
    // Create filesystem adapter
    let temp_dir = TempDir::new().unwrap();
    let fs_adapter = Box::new(FileSystemAdapter::new(temp_dir.path()));
    
    // Register adapter
    registry.register(fs_adapter).await.unwrap();
    
    // List services
    let services = registry.list_services().await;
    assert_eq!(services.len(), 1);
    assert_eq!(services[0].name, "filesystem");
    assert_eq!(services[0].capabilities.len(), 4);
    
    // Execute a command
    let command = ServiceCommand {
        tool: "writeFile".to_string(),
        args: json!({
            "path": "test.txt",
            "content": "Registry integration test"
        }),
        project_name: Some("test-project".to_string()),
        role_id: Some("developer".to_string()),
        context: None,
        store_result: Some(true),
    };
    
    let result = registry.execute("filesystem", command).await.unwrap();
    assert!(result.success);
    
    // Read the file back
    let read_command = ServiceCommand {
        tool: "readFile".to_string(),
        args: json!({
            "path": "test.txt"
        }),
        project_name: None,
        role_id: None,
        context: None,
        store_result: None,
    };
    
    let read_result = registry.execute("filesystem", read_command).await.unwrap();
    assert!(read_result.success);
    assert_eq!(
        read_result.data.unwrap()["content"].as_str().unwrap(),
        "Registry integration test"
    );
    
    // Test capability search
    let services_with_read = registry.find_by_capability("readFile").await;
    assert_eq!(services_with_read.len(), 1);
    assert_eq!(services_with_read[0], "filesystem");
    
    // Test health check
    let health_results = registry.run_health_checks().await;
    assert_eq!(health_results.len(), 1);
    assert!(health_results.get("filesystem").unwrap().is_ok());
}

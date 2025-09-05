//! Integration test demonstrating multi-service orchestration

use mpcm_core::registry::{ServiceRegistry, ServiceCommand, RequestRouter, ToolRequest};
use mpcm_core::adapters::{FileSystemAdapter, GitAdapter, TerminalAdapter};
use serde_json::json;
use std::sync::Arc;
use tempfile::TempDir;

#[tokio::test]
async fn test_multi_service_orchestration() {
    // Create registry
    let registry = Arc::new(ServiceRegistry::new(60));
    
    // Create temp directory for all services
    let temp_dir = TempDir::new().unwrap();
    let base_path = temp_dir.path();
    
    // Register FileSystem adapter
    let fs_adapter = Box::new(FileSystemAdapter::new(base_path));
    registry.register(fs_adapter).await.unwrap();
    
    // Register Git adapter  
    let git_adapter = Box::new(GitAdapter::new(base_path));
    registry.register(git_adapter).await.unwrap();
    
    // Register Terminal adapter
    let terminal_adapter = Box::new(TerminalAdapter::new(base_path));
    registry.register(terminal_adapter).await.unwrap();
    
    // Verify all services registered
    let services = registry.list_services().await;
    assert_eq!(services.len(), 3);
    
    // Create a router for convenience
    let mut router = RequestRouter::new(registry.clone());
    
    // Add direct mappings for clarity
    router.add_tool_mapping("writeFile", "filesystem");
    router.add_tool_mapping("gitInit", "git");
    router.add_tool_mapping("execute", "terminal");
    
    // Scenario: Create a project, initialize git, add files, commit
    let project_name = "test-project";
    let project_context = Some(project_name.to_string());
    
    // Step 1: Create project directory
    let mkdir_result = router.route_request(
        ToolRequest {
            tool: "createDirectory".to_string(),
            args: json!({ "path": project_name }),
        },
        project_context.clone(),
        Some("developer".to_string()),
        None,
    ).await.unwrap();
    assert!(mkdir_result.success);
    
    // Step 2: Create a README file
    let write_result = router.route_request(
        ToolRequest {
            tool: "writeFile".to_string(),
            args: json!({
                "path": format!("{}/README.md", project_name),
                "content": "# Test Project\n\nThis project demonstrates multi-service orchestration."
            }),
        },
        project_context.clone(),
        Some("developer".to_string()),
        None,
    ).await.unwrap();
    assert!(write_result.success);
    
    // Step 3: Initialize git repository
    let git_init_result = router.route_request(
        ToolRequest {
            tool: "gitInit".to_string(),
            args: json!({ "path": project_name }),
        },
        project_context.clone(),
        Some("developer".to_string()),
        None,
    ).await.unwrap();
    assert!(git_init_result.success);
    
    // Step 4: Check git status using terminal
    let status_result = router.route_request(
        ToolRequest {
            tool: "execute".to_string(),
            args: json!({
                "command": "git status --porcelain",
                "cwd": project_name
            }),
        },
        project_context.clone(),
        Some("developer".to_string()),
        None,
    ).await.unwrap();
    assert!(status_result.success);
    
    // Verify untracked file shows up
    let stdout = status_result.data.unwrap()["stdout"].as_str().unwrap();
    assert!(stdout.contains("README.md"));
    
    // Step 5: Stage the file
    let add_result = registry.execute("git", ServiceCommand {
        tool: "gitAdd".to_string(),
        args: json!({
            "path": project_name,
            "files": ["."]
        }),
        project_name: project_context.clone(),
        role_id: Some("developer".to_string()),
        context: None,
        store_result: Some(true),
    }).await.unwrap();
    assert!(add_result.success);
    
    // Step 6: Commit with project context (should add project name to commit message)
    let commit_result = registry.execute("git", ServiceCommand {
        tool: "gitCommit".to_string(),
        args: json!({
            "path": project_name,
            "message": "Initial commit"
        }),
        project_name: project_context.clone(),
        role_id: Some("developer".to_string()),
        context: None,
        store_result: Some(true),
    }).await.unwrap();
    assert!(commit_result.success);
    
    // Verify commit message was enhanced with project context
    let commit_msg = commit_result.data.unwrap()["commit_message"].as_str().unwrap();
    assert!(commit_msg.contains(&format!("[{}]", project_name)));
    
    // Step 7: Verify clean git status
    let final_status = registry.execute("git", ServiceCommand {
        tool: "gitStatus".to_string(),
        args: json!({ "path": project_name }),
        project_name: None,
        role_id: None,
        context: None,
        store_result: None,
    }).await.unwrap();
    assert!(final_status.success);
    assert!(final_status.data.unwrap()["clean"].as_bool().unwrap());
    
    println!("✅ Multi-service orchestration test passed!");
    println!("   - FileSystem: Created directory and file");
    println!("   - Git: Initialized repo, staged, and committed");  
    println!("   - Terminal: Executed git status command");
    println!("   - Context: Project name injected into commit message");
}

#[tokio::test]
async fn test_broadcast_routing() {
    let registry = Arc::new(ServiceRegistry::new(60));
    let temp_dir = TempDir::new().unwrap();
    
    // Register multiple adapters
    registry.register(Box::new(FileSystemAdapter::new(temp_dir.path()))).await.unwrap();
    registry.register(Box::new(TerminalAdapter::new(temp_dir.path()))).await.unwrap();
    
    // Create router with broadcast strategy
    let mut router = RequestRouter::new(registry.clone());
    router.set_default_strategy(crate::registry::RoutingStrategy::Broadcast);
    
    // Both filesystem and terminal can list directory contents
    // FileSystem has "listDirectory", Terminal can "execute ls"
    
    // This will fail with FirstMatch because listDirectory is filesystem-specific
    // But we can use terminal to execute "ls" command
    let result = router.route_request(
        ToolRequest {
            tool: "execute".to_string(),
            args: json!({
                "command": "echo 'Broadcasting works!'"
            }),
        },
        None,
        None,
        None,
    ).await.unwrap();
    
    assert!(result.success);
    // In broadcast mode, result contains all service results
    assert!(result.data.unwrap()["results"].is_array());
}

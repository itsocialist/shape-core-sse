//! Git MCP Adapter
//! 
//! Provides Git operations through the service registry

use std::path::PathBuf;
use std::process::Command;
use anyhow::{anyhow, Result};
use async_trait::async_trait;
use serde_json::{json, Value as JsonValue};
use tracing::{debug, info};

use crate::registry::{ServiceCapability, ServiceCommand, ServiceProvider, ServiceResult};

pub struct GitAdapter {
    name: String,
    base_path: PathBuf,
    initialized: bool,
}

impl GitAdapter {
    pub fn new(base_path: impl Into<PathBuf>) -> Self {
        Self {
            name: "git".to_string(),
            base_path: base_path.into(),
            initialized: false,
        }
    }
    
    /// Execute git command
    fn execute_git(&self, args: &[&str], cwd: Option<&PathBuf>) -> Result<String> {
        let working_dir = cwd.unwrap_or(&self.base_path);
        
        debug!("Executing git command: git {:?} in {:?}", args, working_dir);
        
        let output = Command::new("git")
            .args(args)
            .current_dir(working_dir)
            .output()?;
        
        if output.status.success() {
            Ok(String::from_utf8_lossy(&output.stdout).to_string())
        } else {
            let error = String::from_utf8_lossy(&output.stderr).to_string();
            Err(anyhow!("Git command failed: {}", error))
        }
    }
}

#[async_trait]
impl ServiceProvider for GitAdapter {
    fn name(&self) -> &str {
        &self.name
    }
    
    fn description(&self) -> &str {
        "Git version control operations adapter"
    }
    
    async fn initialize(&mut self) -> Result<()> {
        info!("Initializing Git adapter");
        
        // Verify git is available
        match Command::new("git").arg("--version").output() {
            Ok(output) if output.status.success() => {
                let version = String::from_utf8_lossy(&output.stdout);
                info!("Git available: {}", version.trim());
            }
            _ => return Err(anyhow!("Git is not installed or not in PATH")),
        }
        
        self.initialized = true;
        Ok(())
    }
    
    async fn get_capabilities(&self) -> Result<Vec<ServiceCapability>> {
        Ok(vec![
            ServiceCapability {
                name: "gitInit".to_string(),
                description: "Initialize a new git repository".to_string(),
                input_schema: Some(json!({
                    "type": "object",
                    "properties": {
                        "path": { "type": "string" }
                    }
                })),
                output_schema: None,
            },
            ServiceCapability {
                name: "gitClone".to_string(),
                description: "Clone a git repository".to_string(),
                input_schema: Some(json!({
                    "type": "object",
                    "properties": {
                        "url": { "type": "string" },
                        "path": { "type": "string" }
                    },
                    "required": ["url"]
                })),
                output_schema: None,
            },
            ServiceCapability {
                name: "gitStatus".to_string(),
                description: "Get git status".to_string(),
                input_schema: Some(json!({
                    "type": "object",
                    "properties": {
                        "path": { "type": "string" }
                    }
                })),
                output_schema: None,
            },
            ServiceCapability {
                name: "gitAdd".to_string(),
                description: "Stage files for commit".to_string(),
                input_schema: Some(json!({
                    "type": "object",
                    "properties": {
                        "path": { "type": "string" },
                        "files": { 
                            "type": "array",
                            "items": { "type": "string" }
                        }
                    }
                })),
                output_schema: None,
            },
            ServiceCapability {
                name: "gitCommit".to_string(),
                description: "Commit staged changes".to_string(),
                input_schema: Some(json!({
                    "type": "object",
                    "properties": {
                        "path": { "type": "string" },
                        "message": { "type": "string" }
                    },
                    "required": ["message"]
                })),
                output_schema: None,
            },
        ])
    }
    
    async fn execute(&self, command: ServiceCommand) -> Result<ServiceResult> {
        if !self.initialized {
            return Err(anyhow!("Git adapter not initialized"));
        }
        
        debug!("Executing Git command: {}", command.tool);
        
        match command.tool.as_str() {
            "gitInit" => self.git_init(command.args).await,
            "gitClone" => self.git_clone(command.args).await,
            "gitStatus" => self.git_status(command.args).await,
            "gitAdd" => self.git_add(command.args).await,
            "gitCommit" => self.git_commit(command.args, command.project_name).await,
            _ => Err(anyhow!("Unknown command: {}", command.tool)),
        }
    }
    
    async fn shutdown(&mut self) -> Result<()> {
        info!("Shutting down Git adapter");
        self.initialized = false;
        Ok(())
    }
}

impl GitAdapter {
    async fn git_init(&self, args: JsonValue) -> Result<ServiceResult> {
        let path = args.get("path")
            .and_then(|v| v.as_str())
            .map(PathBuf::from)
            .unwrap_or_else(|| self.base_path.clone());
        
        // Security check
        if !path.starts_with(&self.base_path) {
            return Err(anyhow!("Path must be within base directory"));
        }
        
        // Create directory if needed
        tokio::fs::create_dir_all(&path).await?;
        
        // Initialize git repo
        self.execute_git(&["init"], Some(&path))?;
        
        Ok(ServiceResult {
            success: true,
            data: Some(json!({
                "message": format!("Initialized git repository at {:?}", path)
            })),
            error: None,
            metadata: None,
        })
    }
    
    async fn git_clone(&self, args: JsonValue) -> Result<ServiceResult> {
        let url = args.get("url")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("Missing 'url' argument"))?;
        
        let path = args.get("path")
            .and_then(|v| v.as_str())
            .map(PathBuf::from);
        
        let target_dir = if let Some(p) = path {
            self.base_path.join(p)
        } else {
            self.base_path.clone()
        };
        
        // Security check
        if !target_dir.starts_with(&self.base_path) {
            return Err(anyhow!("Path must be within base directory"));
        }
        
        // Clone repository
        self.execute_git(&["clone", url, target_dir.to_str().unwrap()], None)?;
        
        Ok(ServiceResult {
            success: true,
            data: Some(json!({
                "message": format!("Cloned {} to {:?}", url, target_dir)
            })),
            error: None,
            metadata: None,
        })
    }
    
    async fn git_status(&self, args: JsonValue) -> Result<ServiceResult> {
        let path = args.get("path")
            .and_then(|v| v.as_str())
            .map(PathBuf::from)
            .unwrap_or_else(|| self.base_path.clone());
        
        // Security check
        if !path.starts_with(&self.base_path) {
            return Err(anyhow!("Path must be within base directory"));
        }
        
        let status = self.execute_git(&["status", "--porcelain"], Some(&path))?;
        
        Ok(ServiceResult {
            success: true,
            data: Some(json!({
                "status": status,
                "clean": status.trim().is_empty()
            })),
            error: None,
            metadata: None,
        })
    }
    
    async fn git_add(&self, args: JsonValue) -> Result<ServiceResult> {
        let path = args.get("path")
            .and_then(|v| v.as_str())
            .map(PathBuf::from)
            .unwrap_or_else(|| self.base_path.clone());
        
        // Security check
        if !path.starts_with(&self.base_path) {
            return Err(anyhow!("Path must be within base directory"));
        }
        
        let files = args.get("files")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str())
                    .collect::<Vec<_>>()
            })
            .unwrap_or_else(|| vec!["."]);
        
        // Add files
        let mut git_args = vec!["add"];
        git_args.extend(files.iter().copied());
        
        self.execute_git(&git_args, Some(&path))?;
        
        Ok(ServiceResult {
            success: true,
            data: Some(json!({
                "message": format!("Added {} files", files.len())
            })),
            error: None,
            metadata: None,
        })
    }
    
    async fn git_commit(&self, args: JsonValue, project_name: Option<String>) -> Result<ServiceResult> {
        let path = args.get("path")
            .and_then(|v| v.as_str())
            .map(PathBuf::from)
            .unwrap_or_else(|| self.base_path.clone());
        
        // Security check
        if !path.starts_with(&self.base_path) {
            return Err(anyhow!("Path must be within base directory"));
        }
        
        let message = args.get("message")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("Missing 'message' argument"))?;
        
        // Enhance commit message with project context
        let enhanced_message = if let Some(project) = project_name {
            format!("[{}] {}", project, message)
        } else {
            message.to_string()
        };
        
        // Commit
        self.execute_git(&["commit", "-m", &enhanced_message], Some(&path))?;
        
        Ok(ServiceResult {
            success: true,
            data: Some(json!({
                "message": "Commit successful",
                "commit_message": enhanced_message
            })),
            error: None,
            metadata: None,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;
    
    #[tokio::test]
    async fn test_git_adapter() {
        let temp_dir = TempDir::new().unwrap();
        let mut adapter = GitAdapter::new(temp_dir.path());
        
        // Initialize
        if adapter.initialize().await.is_err() {
            // Skip test if git is not available
            return;
        }
        
        // Test git init
        let init_cmd = ServiceCommand {
            tool: "gitInit".to_string(),
            args: json!({}),
            project_name: None,
            role_id: None,
            context: None,
            store_result: None,
        };
        
        let result = adapter.execute(init_cmd).await.unwrap();
        assert!(result.success);
        
        // Test git status
        let status_cmd = ServiceCommand {
            tool: "gitStatus".to_string(),
            args: json!({}),
            project_name: None,
            role_id: None,
            context: None,
            store_result: None,
        };
        
        let result = adapter.execute(status_cmd).await.unwrap();
        assert!(result.success);
        assert!(result.data.unwrap()["clean"].as_bool().unwrap());
    }
}

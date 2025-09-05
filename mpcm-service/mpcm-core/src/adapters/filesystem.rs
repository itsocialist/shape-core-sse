//! FileSystem MCP Adapter
//! 
//! Provides file system operations through the service registry

use std::path::PathBuf;
use anyhow::{anyhow, Result};
use async_trait::async_trait;
use serde_json::{json, Value as JsonValue};
use tokio::fs;
use tracing::{debug, info};

use crate::registry::{ServiceCapability, ServiceCommand, ServiceProvider, ServiceResult};

pub struct FileSystemAdapter {
    name: String,
    base_path: PathBuf,
    initialized: bool,
}

impl FileSystemAdapter {
    pub fn new(base_path: impl Into<PathBuf>) -> Self {
        Self {
            name: "filesystem".to_string(),
            base_path: base_path.into(),
            initialized: false,
        }
    }
}

#[async_trait]
impl ServiceProvider for FileSystemAdapter {
    fn name(&self) -> &str {
        &self.name
    }
    
    fn description(&self) -> &str {
        "File system operations adapter"
    }
    
    async fn initialize(&mut self) -> Result<()> {
        info!("Initializing FileSystem adapter");
        
        // Ensure base path exists
        if !self.base_path.exists() {
            fs::create_dir_all(&self.base_path).await?;
        }
        
        self.initialized = true;
        Ok(())
    }
    
    async fn get_capabilities(&self) -> Result<Vec<ServiceCapability>> {
        Ok(vec![
            ServiceCapability {
                name: "readFile".to_string(),
                description: "Read file contents".to_string(),
                input_schema: Some(json!({
                    "type": "object",
                    "properties": {
                        "path": { "type": "string" }
                    },
                    "required": ["path"]
                })),
                output_schema: Some(json!({
                    "type": "object",
                    "properties": {
                        "content": { "type": "string" }
                    }
                })),
            },
            ServiceCapability {
                name: "writeFile".to_string(),
                description: "Write file contents".to_string(),
                input_schema: Some(json!({
                    "type": "object",
                    "properties": {
                        "path": { "type": "string" },
                        "content": { "type": "string" }
                    },
                    "required": ["path", "content"]
                })),
                output_schema: Some(json!({
                    "type": "object",
                    "properties": {
                        "success": { "type": "boolean" }
                    }
                })),
            },
            ServiceCapability {
                name: "listDirectory".to_string(),
                description: "List directory contents".to_string(),
                input_schema: Some(json!({
                    "type": "object",
                    "properties": {
                        "path": { "type": "string" }
                    },
                    "required": ["path"]
                })),
                output_schema: Some(json!({
                    "type": "object",
                    "properties": {
                        "entries": {
                            "type": "array",
                            "items": { "type": "string" }
                        }
                    }
                })),
            },
            ServiceCapability {
                name: "createDirectory".to_string(),
                description: "Create a directory".to_string(),
                input_schema: Some(json!({
                    "type": "object",
                    "properties": {
                        "path": { "type": "string" }
                    },
                    "required": ["path"]
                })),
                output_schema: Some(json!({
                    "type": "object",
                    "properties": {
                        "success": { "type": "boolean" }
                    }
                })),
            },
        ])
    }
    
    async fn execute(&self, command: ServiceCommand) -> Result<ServiceResult> {
        if !self.initialized {
            return Err(anyhow!("FileSystem adapter not initialized"));
        }
        
        debug!("Executing FileSystem command: {}", command.tool);
        
        match command.tool.as_str() {
            "readFile" => self.read_file(command.args).await,
            "writeFile" => self.write_file(command.args).await,
            "listDirectory" => self.list_directory(command.args).await,
            "createDirectory" => self.create_directory(command.args).await,
            _ => Err(anyhow!("Unknown command: {}", command.tool)),
        }
    }
    
    async fn shutdown(&mut self) -> Result<()> {
        info!("Shutting down FileSystem adapter");
        self.initialized = false;
        Ok(())
    }
}

impl FileSystemAdapter {
    async fn read_file(&self, args: JsonValue) -> Result<ServiceResult> {
        let path = args.get("path")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("Missing 'path' argument"))?;
        
        let full_path = self.base_path.join(path);
        
        // Security check - ensure path is within base_path
        if !full_path.starts_with(&self.base_path) {
            return Err(anyhow!("Path traversal detected"));
        }
        
        let content = fs::read_to_string(&full_path).await?;
        
        Ok(ServiceResult {
            success: true,
            data: Some(json!({ "content": content })),
            error: None,
            metadata: None,
        })
    }
    
    async fn write_file(&self, args: JsonValue) -> Result<ServiceResult> {
        let path = args.get("path")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("Missing 'path' argument"))?;
            
        let content = args.get("content")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("Missing 'content' argument"))?;
        
        let full_path = self.base_path.join(path);
        
        // Security check
        if !full_path.starts_with(&self.base_path) {
            return Err(anyhow!("Path traversal detected"));
        }
        
        // Ensure parent directory exists
        if let Some(parent) = full_path.parent() {
            fs::create_dir_all(parent).await?;
        }
        
        fs::write(&full_path, content).await?;
        
        Ok(ServiceResult {
            success: true,
            data: Some(json!({ "success": true })),
            error: None,
            metadata: None,
        })
    }
    
    async fn list_directory(&self, args: JsonValue) -> Result<ServiceResult> {
        let path = args.get("path")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("Missing 'path' argument"))?;
        
        let full_path = self.base_path.join(path);
        
        // Security check
        if !full_path.starts_with(&self.base_path) {
            return Err(anyhow!("Path traversal detected"));
        }
        
        let mut entries = Vec::new();
        let mut dir = fs::read_dir(&full_path).await?;
        
        while let Some(entry) = dir.next_entry().await? {
            if let Some(name) = entry.file_name().to_str() {
                entries.push(name.to_string());
            }
        }
        
        Ok(ServiceResult {
            success: true,
            data: Some(json!({ "entries": entries })),
            error: None,
            metadata: None,
        })
    }
    
    async fn create_directory(&self, args: JsonValue) -> Result<ServiceResult> {
        let path = args.get("path")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("Missing 'path' argument"))?;
        
        let full_path = self.base_path.join(path);
        
        // Security check
        if !full_path.starts_with(&self.base_path) {
            return Err(anyhow!("Path traversal detected"));
        }
        
        fs::create_dir_all(&full_path).await?;
        
        Ok(ServiceResult {
            success: true,
            data: Some(json!({ "success": true })),
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
    async fn test_filesystem_adapter() {
        let temp_dir = TempDir::new().unwrap();
        let mut adapter = FileSystemAdapter::new(temp_dir.path());
        
        // Initialize
        assert!(adapter.initialize().await.is_ok());
        
        // Test write file
        let write_cmd = ServiceCommand {
            tool: "writeFile".to_string(),
            args: json!({
                "path": "test.txt",
                "content": "Hello, World!"
            }),
            project_name: None,
            role_id: None,
            context: None,
            store_result: None,
        };
        
        let result = adapter.execute(write_cmd).await.unwrap();
        assert!(result.success);
        
        // Test read file
        let read_cmd = ServiceCommand {
            tool: "readFile".to_string(),
            args: json!({
                "path": "test.txt"
            }),
            project_name: None,
            role_id: None,
            context: None,
            store_result: None,
        };
        
        let result = adapter.execute(read_cmd).await.unwrap();
        assert!(result.success);
        assert_eq!(
            result.data.unwrap()["content"].as_str().unwrap(),
            "Hello, World!"
        );
    }
}

//! Terminal MCP Adapter
//! 
//! Provides terminal/shell command execution through the service registry

use std::collections::HashMap;
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::sync::Arc;
use tokio::sync::RwLock;
use anyhow::{anyhow, Result};
use async_trait::async_trait;
use serde_json::{json, Value as JsonValue};
use tracing::{debug, info, warn};

use crate::registry::{ServiceCapability, ServiceCommand, ServiceProvider, ServiceResult};

/// Running process information
#[derive(Debug, Clone)]
struct ProcessInfo {
    pid: u32,
    command: String,
    working_dir: PathBuf,
}

pub struct TerminalAdapter {
    name: String,
    base_path: PathBuf,
    initialized: bool,
    /// Whitelist of allowed commands
    allowed_commands: Vec<String>,
    /// Running processes
    processes: Arc<RwLock<HashMap<u32, ProcessInfo>>>,
}

impl TerminalAdapter {
    pub fn new(base_path: impl Into<PathBuf>) -> Self {
        Self {
            name: "terminal".to_string(),
            base_path: base_path.into(),
            initialized: false,
            allowed_commands: vec![
                // Safe commands
                "ls".to_string(),
                "pwd".to_string(),
                "echo".to_string(),
                "cat".to_string(),
                "grep".to_string(),
                "find".to_string(),
                "which".to_string(),
                "npm".to_string(),
                "yarn".to_string(),
                "cargo".to_string(),
                "python".to_string(),
                "node".to_string(),
                "git".to_string(),
                "make".to_string(),
            ],
            processes: Arc::new(RwLock::new(HashMap::new())),
        }
    }
    
    /// Add allowed command
    pub fn allow_command(&mut self, command: impl Into<String>) {
        self.allowed_commands.push(command.into());
    }
    
    /// Check if command is allowed
    fn is_command_allowed(&self, command: &str) -> bool {
        // Extract the base command (first word)
        let base_command = command.split_whitespace()
            .next()
            .unwrap_or("");
        
        self.allowed_commands.iter()
            .any(|allowed| allowed == base_command)
    }
}

#[async_trait]
impl ServiceProvider for TerminalAdapter {
    fn name(&self) -> &str {
        &self.name
    }
    
    fn description(&self) -> &str {
        "Terminal command execution adapter"
    }
    
    async fn initialize(&mut self) -> Result<()> {
        info!("Initializing Terminal adapter");
        
        // Ensure base path exists
        tokio::fs::create_dir_all(&self.base_path).await?;
        
        self.initialized = true;
        Ok(())
    }
    
    async fn get_capabilities(&self) -> Result<Vec<ServiceCapability>> {
        Ok(vec![
            ServiceCapability {
                name: "execute".to_string(),
                description: "Execute a shell command synchronously".to_string(),
                input_schema: Some(json!({
                    "type": "object",
                    "properties": {
                        "command": { "type": "string" },
                        "cwd": { "type": "string" },
                        "env": { 
                            "type": "object",
                            "additionalProperties": { "type": "string" }
                        }
                    },
                    "required": ["command"]
                })),
                output_schema: Some(json!({
                    "type": "object",
                    "properties": {
                        "stdout": { "type": "string" },
                        "stderr": { "type": "string" },
                        "exitCode": { "type": "number" }
                    }
                })),
            },
            ServiceCapability {
                name: "executeAsync".to_string(),
                description: "Execute a shell command asynchronously".to_string(),
                input_schema: Some(json!({
                    "type": "object",
                    "properties": {
                        "command": { "type": "string" },
                        "cwd": { "type": "string" }
                    },
                    "required": ["command"]
                })),
                output_schema: Some(json!({
                    "type": "object",
                    "properties": {
                        "pid": { "type": "number" }
                    }
                })),
            },
            ServiceCapability {
                name: "listProcesses".to_string(),
                description: "List running processes started by this adapter".to_string(),
                input_schema: Some(json!({
                    "type": "object"
                })),
                output_schema: Some(json!({
                    "type": "object",
                    "properties": {
                        "processes": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "pid": { "type": "number" },
                                    "command": { "type": "string" },
                                    "workingDir": { "type": "string" }
                                }
                            }
                        }
                    }
                })),
            },
            ServiceCapability {
                name: "killProcess".to_string(),
                description: "Kill a running process".to_string(),
                input_schema: Some(json!({
                    "type": "object",
                    "properties": {
                        "pid": { "type": "number" }
                    },
                    "required": ["pid"]
                })),
                output_schema: None,
            },
        ])
    }
    
    async fn execute(&self, command: ServiceCommand) -> Result<ServiceResult> {
        if !self.initialized {
            return Err(anyhow!("Terminal adapter not initialized"));
        }
        
        debug!("Executing Terminal command: {}", command.tool);
        
        match command.tool.as_str() {
            "execute" => self.execute_sync(command.args, command.project_name).await,
            "executeAsync" => self.execute_async(command.args, command.project_name).await,
            "listProcesses" => self.list_processes().await,
            "killProcess" => self.kill_process(command.args).await,
            _ => Err(anyhow!("Unknown command: {}", command.tool)),
        }
    }
    
    async fn shutdown(&mut self) -> Result<()> {
        info!("Shutting down Terminal adapter");
        
        // Kill all running processes
        let processes = self.processes.write().await;
        for (pid, _) in processes.iter() {
            if let Err(e) = std::process::Command::new("kill")
                .arg(pid.to_string())
                .output() {
                warn!("Failed to kill process {}: {}", pid, e);
            }
        }
        
        self.initialized = false;
        Ok(())
    }
}

impl TerminalAdapter {
    async fn execute_sync(&self, args: JsonValue, project_name: Option<String>) -> Result<ServiceResult> {
        let command_str = args.get("command")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("Missing 'command' argument"))?;
        
        // Security check
        if !self.is_command_allowed(command_str) {
            return Err(anyhow!("Command not in whitelist: {}", command_str));
        }
        
        // Determine working directory
        let cwd = if let Some(cwd_str) = args.get("cwd").and_then(|v| v.as_str()) {
            let cwd_path = PathBuf::from(cwd_str);
            if !cwd_path.starts_with(&self.base_path) {
                return Err(anyhow!("Working directory must be within base path"));
            }
            cwd_path
        } else if let Some(project) = project_name {
            self.base_path.join(project)
        } else {
            self.base_path.clone()
        };
        
        // Parse environment variables
        let env_vars: HashMap<String, String> = args.get("env")
            .and_then(|v| v.as_object())
            .map(|obj| {
                obj.iter()
                    .filter_map(|(k, v)| v.as_str().map(|s| (k.clone(), s.to_string())))
                    .collect()
            })
            .unwrap_or_default();
        
        // Execute command
        debug!("Executing: {} in {:?}", command_str, cwd);
        
        let mut cmd = Command::new("sh");
        cmd.arg("-c")
            .arg(command_str)
            .current_dir(&cwd)
            .envs(env_vars);
        
        let output = cmd.output()?;
        
        Ok(ServiceResult {
            success: output.status.success(),
            data: Some(json!({
                "stdout": String::from_utf8_lossy(&output.stdout).to_string(),
                "stderr": String::from_utf8_lossy(&output.stderr).to_string(),
                "exitCode": output.status.code().unwrap_or(-1),
            })),
            error: if !output.status.success() {
                Some(String::from_utf8_lossy(&output.stderr).to_string())
            } else {
                None
            },
            metadata: None,
        })
    }
    
    async fn execute_async(&self, args: JsonValue, project_name: Option<String>) -> Result<ServiceResult> {
        let command_str = args.get("command")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("Missing 'command' argument"))?;
        
        // Security check
        if !self.is_command_allowed(command_str) {
            return Err(anyhow!("Command not in whitelist: {}", command_str));
        }
        
        // Determine working directory
        let cwd = if let Some(cwd_str) = args.get("cwd").and_then(|v| v.as_str()) {
            let cwd_path = PathBuf::from(cwd_str);
            if !cwd_path.starts_with(&self.base_path) {
                return Err(anyhow!("Working directory must be within base path"));
            }
            cwd_path
        } else if let Some(project) = project_name {
            self.base_path.join(project)
        } else {
            self.base_path.clone()
        };
        
        // Spawn process
        let child = Command::new("sh")
            .arg("-c")
            .arg(command_str)
            .current_dir(&cwd)
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()?;
        
        let pid = child.id();
        
        // Store process info
        {
            let mut processes = self.processes.write().await;
            processes.insert(pid, ProcessInfo {
                pid,
                command: command_str.to_string(),
                working_dir: cwd,
            });
        }
        
        Ok(ServiceResult {
            success: true,
            data: Some(json!({
                "pid": pid,
                "message": format!("Process started with PID {}", pid)
            })),
            error: None,
            metadata: None,
        })
    }
    
    async fn list_processes(&self) -> Result<ServiceResult> {
        let processes = self.processes.read().await;
        
        let process_list: Vec<_> = processes.values()
            .map(|info| json!({
                "pid": info.pid,
                "command": info.command,
                "workingDir": info.working_dir.to_string_lossy()
            }))
            .collect();
        
        Ok(ServiceResult {
            success: true,
            data: Some(json!({
                "processes": process_list
            })),
            error: None,
            metadata: None,
        })
    }
    
    async fn kill_process(&self, args: JsonValue) -> Result<ServiceResult> {
        let pid = args.get("pid")
            .and_then(|v| v.as_u64())
            .ok_or_else(|| anyhow!("Missing 'pid' argument"))? as u32;
        
        // Remove from our tracking
        {
            let mut processes = self.processes.write().await;
            if processes.remove(&pid).is_none() {
                return Err(anyhow!("Process {} not found", pid));
            }
        }
        
        // Kill the process
        Command::new("kill")
            .arg(pid.to_string())
            .output()?;
        
        Ok(ServiceResult {
            success: true,
            data: Some(json!({
                "message": format!("Process {} killed", pid)
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
    async fn test_terminal_adapter() {
        let temp_dir = TempDir::new().unwrap();
        let mut adapter = TerminalAdapter::new(temp_dir.path());
        
        // Initialize
        assert!(adapter.initialize().await.is_ok());
        
        // Test execute sync
        let exec_cmd = ServiceCommand {
            tool: "execute".to_string(),
            args: json!({
                "command": "echo 'Hello, Terminal!'"
            }),
            project_name: None,
            role_id: None,
            context: None,
            store_result: None,
        };
        
        let result = adapter.execute(exec_cmd).await.unwrap();
        assert!(result.success);
        assert!(result.data.unwrap()["stdout"]
            .as_str()
            .unwrap()
            .contains("Hello, Terminal!"));
    }
}

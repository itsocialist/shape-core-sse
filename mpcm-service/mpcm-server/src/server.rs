//! Unix socket server implementation for MPCM
//! 
//! This module handles the Unix socket server lifecycle, connection management,
//! and request/response processing. It's designed for high performance with
//! async I/O and connection pooling.

use anyhow::{Context, Result};
use mpcm_core::storage::Storage;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::{UnixListener, UnixStream};
use tokio::sync::RwLock;
use tokio::time::{timeout, Duration};
use tracing::{debug, error, info, warn};

use crate::handlers::handle_request;
use crate::protocol::{ServiceRequest, ServiceResponse, ErrorResponse};

/// Default timeout for client operations (30 seconds)
const DEFAULT_TIMEOUT: Duration = Duration::from_secs(30);

/// Maximum message size (10MB) to prevent memory exhaustion
const MAX_MESSAGE_SIZE: usize = 10 * 1024 * 1024;

/// Server configuration
pub struct ServerConfig {
    pub socket_path: PathBuf,
    pub db_path: PathBuf,
    pub max_connections: usize,
    pub request_timeout: Duration,
}

impl Default for ServerConfig {
    fn default() -> Self {
        Self {
            socket_path: PathBuf::from("/tmp/mpcm.sock"),
            db_path: PathBuf::from("~/.mpcm-pro/mpcm-pro.db"),
            max_connections: 100,
            request_timeout: DEFAULT_TIMEOUT,
        }
    }
}

/// Parse a JSON message into a ServiceRequest
pub fn parse_message(message: &str) -> Result<ServiceRequest> {
    serde_json::from_str(message)
        .context("Failed to parse JSON message")
}

/// Format a ServiceResponse as a JSON string with newline
pub fn format_response(response: &ServiceResponse) -> String {
    match serde_json::to_string(response) {
        Ok(json) => format!("{}\n", json),
        Err(e) => {
            // Fallback error response
            format!(r#"{{"id":"","error":{{"code":-32603,"message":"Failed to serialize response: {}"}}}}"#, e)
        }
    }
}

/// Run the Unix socket server
pub async fn run_server(socket_path: &Path, db_path: &Path) -> Result<()> {
    // Clean up any existing socket
    if socket_path.exists() {
        std::fs::remove_file(socket_path)
            .context("Failed to remove existing socket")?;
    }
    
    // Initialize storage
    let storage = Storage::new(db_path).await
        .context("Failed to initialize storage")?;
    let storage = Arc::new(RwLock::new(storage));
    
    // Create Unix socket listener
    let listener = UnixListener::bind(socket_path)
        .context("Failed to bind Unix socket")?;
    
    info!("MPCM Server listening on {:?}", socket_path);
    
    // Set socket permissions (readable/writable by owner only)
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(socket_path, std::fs::Permissions::from_mode(0o600))
            .context("Failed to set socket permissions")?;
    }
    
    // Accept connections
    loop {
        match listener.accept().await {
            Ok((stream, _addr)) => {
                let storage = storage.clone();
                
                // Spawn handler for each connection
                tokio::spawn(async move {
                    if let Err(e) = handle_connection(stream, storage).await {
                        error!("Connection handler error: {}", e);
                    }
                });
            }
            Err(e) => {
                error!("Failed to accept connection: {}", e);
                // Continue accepting other connections
            }
        }
    }
}

/// Handle a single client connection
async fn handle_connection(
    stream: UnixStream,
    storage: Arc<RwLock<Storage>>,
) -> Result<()> {
    debug!("New client connected");
    
    let (reader, mut writer) = stream.into_split();
    let mut reader = BufReader::new(reader);
    let mut buffer = String::new();
    
    loop {
        buffer.clear();
        
        // Read request with timeout
        let read_result = timeout(
            DEFAULT_TIMEOUT,
            reader.read_line(&mut buffer)
        ).await;
        
        match read_result {
            Ok(Ok(0)) => {
                // Client disconnected
                debug!("Client disconnected");
                break;
            }
            Ok(Ok(n)) if n > MAX_MESSAGE_SIZE => {
                // Message too large
                let error_response = ServiceResponse {
                    id: String::new(),
                    result: None,
                    error: Some(ErrorResponse::invalid_request()),
                };
                
                writer.write_all(format_response(&error_response).as_bytes()).await?;
                writer.flush().await?;
                continue;
            }
            Ok(Ok(_)) => {
                // Process request
                match parse_message(&buffer) {
                    Ok(request) => {
                        // Convert ServiceRequest to JSON-RPC format for handlers
                        let json_rpc_request = serde_json::json!({
                            "jsonrpc": "2.0",
                            "method": request.method,
                            "params": request.params,
                            "id": request.id
                        });
                        
                        let json_rpc_response = handle_request(json_rpc_request, storage.clone()).await;
                        
                        // Convert JSON-RPC response back to ServiceResponse
                        let response = if let Some(error) = json_rpc_response.get("error") {
                            ServiceResponse {
                                id: request.id,
                                result: None,
                                error: Some(ErrorResponse {
                                    code: error["code"].as_i64().unwrap_or(-32603) as i32,
                                    message: error["message"].as_str().unwrap_or("Unknown error").to_string(),
                                }),
                            }
                        } else {
                            ServiceResponse {
                                id: request.id,
                                result: json_rpc_response.get("result").cloned(),
                                error: None,
                            }
                        };
                        
                        writer.write_all(format_response(&response).as_bytes()).await?;
                        writer.flush().await?;
                    }
                    Err(e) => {
                        // Invalid JSON
                        let error_response = ServiceResponse {
                            id: String::new(),
                            result: None,
                            error: Some(ErrorResponse::parse_error()),
                        };
                        
                        writer.write_all(format_response(&error_response).as_bytes()).await?;
                        writer.flush().await?;
                    }
                }
            }
            Ok(Err(e)) => {
                // Read error
                error!("Read error: {}", e);
                break;
            }
            Err(_) => {
                // Timeout
                warn!("Client request timeout");
                let error_response = ServiceResponse {
                    id: String::new(),
                    result: None,
                    error: Some(ErrorResponse::internal_error("Request timeout")),
                };
                
                writer.write_all(format_response(&error_response).as_bytes()).await?;
                writer.flush().await?;
                break;
            }
        }
    }
    
    Ok(())
}

/// Graceful shutdown handler
pub async fn shutdown_server(socket_path: &Path) -> Result<()> {
    info!("Shutting down MPCM Server");
    
    // Remove socket file
    if socket_path.exists() {
        std::fs::remove_file(socket_path)
            .context("Failed to remove socket during shutdown")?;
    }
    
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;
    
    #[test]
    fn test_server_config_default() {
        let config = ServerConfig::default();
        assert_eq!(config.socket_path, PathBuf::from("/tmp/mpcm.sock"));
        assert_eq!(config.max_connections, 100);
        assert_eq!(config.request_timeout, Duration::from_secs(30));
    }
    
    #[tokio::test]
    async fn test_socket_cleanup() {
        let temp_dir = TempDir::new().unwrap();
        let socket_path = temp_dir.path().join("test.sock");
        
        // Create a dummy file
        std::fs::write(&socket_path, "dummy").unwrap();
        assert!(socket_path.exists());
        
        // Shutdown should remove it
        shutdown_server(&socket_path).await.unwrap();
        assert!(!socket_path.exists());
    }
    
    #[test]
    fn test_parse_error_handling() {
        let invalid_json = "{ invalid json }";
        let result = parse_message(invalid_json);
        assert!(result.is_err());
    }
    
    #[test]
    fn test_format_response() {
        let response = ServiceResponse {
            id: "test123".to_string(),
            result: Some(serde_json::json!({"success": true})),
            error: None,
        };
        
        let formatted = format_response(&response);
        assert!(formatted.ends_with('\n'));
        assert!(formatted.contains("test123"));
        assert!(formatted.contains("success"));
    }
}

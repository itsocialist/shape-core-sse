//! Unix socket server implementation v2

use anyhow::{anyhow, Result};
use serde_json::{json, Value};
use std::path::Path;
use std::sync::Arc;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::{UnixListener, UnixStream};
use tracing::{debug, error, info, warn};

use crate::handlers_v2;
use crate::protocol::{Request, Response, ErrorResponse};
use mpcm_core::storage_v2::Storage;

/// Run the Unix socket server
pub async fn run_server(
    socket_path: &Path,
    storage: Arc<Storage>,
    max_connections: usize,
) -> Result<()> {
    // Remove existing socket if it exists
    if socket_path.exists() {
        std::fs::remove_file(socket_path)?;
    }
    
    // Create Unix socket listener
    let listener = UnixListener::bind(socket_path)?;
    info!("MPCM Server listening on {:?}", socket_path);
    
    // Connection semaphore to limit concurrent connections
    let semaphore = Arc::new(tokio::sync::Semaphore::new(max_connections));
    
    loop {
        // Accept new connection
        let (stream, _) = listener.accept().await?;
        let storage = storage.clone();
        let permit = semaphore.clone().acquire_owned().await?;
        
        // Spawn handler task
        tokio::spawn(async move {
            if let Err(e) = handle_connection(stream, storage).await {
                error!("Connection error: {}", e);
            }
            drop(permit); // Release semaphore permit
        });
    }
}

/// Handle a single client connection
async fn handle_connection(
    stream: UnixStream,
    storage: Arc<Storage>,
) -> Result<()> {
    let (reader, mut writer) = stream.into_split();
    let mut reader = BufReader::new(reader);
    let mut line = String::new();
    
    debug!("New client connected");
    
    loop {
        line.clear();
        
        // Read next line
        match reader.read_line(&mut line).await {
            Ok(0) => {
                // EOF - client disconnected
                debug!("Client disconnected");
                break;
            }
            Ok(_) => {
                // Process request
                let response = process_request(&line, storage.clone()).await;
                
                // Send response
                let response_str = serde_json::to_string(&response)? + "\n";
                writer.write_all(response_str.as_bytes()).await?;
                writer.flush().await?;
            }
            Err(e) => {
                error!("Read error: {}", e);
                break;
            }
        }
    }
    
    Ok(())
}

/// Process a single JSON-RPC request
async fn process_request(
    line: &str,
    storage: Arc<Storage>,
) -> Response {
    // Parse request
    let request: Request = match serde_json::from_str(line) {
        Ok(req) => req,
        Err(e) => {
            return Response {
                id: None,
                result: None,
                error: Some(ErrorResponse::parse_error(&e.to_string())),
            };
        }
    };
    
    let request_id = request.id.clone();
    
    // Handle request
    match handlers_v2::handle_request(
        &request.method,
        request.params.unwrap_or(Value::Null),
        storage,
    ).await {
        Ok(result) => Response {
            id: request_id,
            result: Some(result),
            error: None,
        },
        Err(e) => {
            let error_response = if e.to_string().contains("not found") {
                ErrorResponse {
                    code: handlers_v2::error_codes::METHOD_NOT_FOUND,
                    message: e.to_string(),
                }
            } else {
                ErrorResponse {
                    code: handlers_v2::error_codes::INTERNAL_ERROR,
                    message: e.to_string(),
                }
            };
            
            Response {
                id: request_id,
                result: None,
                error: Some(error_response),
            }
        }
    }
}

/// Gracefully shutdown the server
pub async fn shutdown_server(socket_path: &Path) -> Result<()> {
    info!("Shutting down MPCM Server");
    
    // Remove socket file
    if socket_path.exists() {
        std::fs::remove_file(socket_path)?;
    }
    
    Ok(())
}

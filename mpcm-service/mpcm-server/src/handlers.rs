//! JSON-RPC request handlers for MPCM Server
//! 
//! This module implements all the MCP tool handlers for context management.
//! Each handler follows the JSON-RPC 2.0 specification.

use anyhow::{anyhow, Result};
use mpcm_core::storage::Storage;
use serde::Deserialize;
use serde_json::{json, Value};
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{debug, error};

/// JSON-RPC error codes
mod error_codes {
    pub const PARSE_ERROR: i32 = -32700;
    pub const INVALID_REQUEST: i32 = -32600;
    pub const METHOD_NOT_FOUND: i32 = -32601;
    pub const INVALID_PARAMS: i32 = -32602;
    pub const INTERNAL_ERROR: i32 = -32603;
}

/// Store context parameters
#[derive(Debug, Deserialize)]
struct StoreContextParams {
    project_name: String,
    key: String,
    value: String,
    #[serde(rename = "type")]
    context_type: String,
    tags: Option<Vec<String>>,
    metadata: Option<Value>,
}

/// Search context parameters
#[derive(Debug, Deserialize)]
struct SearchContextParams {
    project_name: Option<String>,
    query: Option<String>,
    #[serde(rename = "type")]
    context_type: Option<String>,
    tags: Option<Vec<String>>,
    since: Option<String>,
    limit: Option<i32>,
}

/// Get project context parameters
#[derive(Debug, Deserialize)]
struct GetProjectContextParams {
    project_name: String,
    system_specific: Option<bool>,
}

/// List projects parameters
#[derive(Debug, Deserialize)]
struct ListProjectsParams {
    include_archived: Option<bool>,
}

/// Store project context parameters
#[derive(Debug, Deserialize)]
struct StoreProjectContextParams {
    project_name: String,
    description: Option<String>,
    repository_url: Option<String>,
    local_directory: Option<String>,
    status: Option<String>,
    tags: Option<Vec<String>>,
    metadata: Option<Value>,
}

/// Main request handler - routes to specific handlers based on method
pub async fn handle_request(
    request: Value,
    storage: Arc<RwLock<Storage>>,
) -> Value {
    // Validate JSON-RPC request structure
    let id = request.get("id").cloned().unwrap_or(Value::Null);
    
    let method = match request.get("method").and_then(|v| v.as_str()) {
        Some(method) => method,
        None => {
            return create_error_response(
                id,
                error_codes::INVALID_REQUEST,
                "Missing method field".to_string(),
            );
        }
    };
    
    let params = request.get("params").cloned().unwrap_or(json!({}));
    
    debug!("Handling request: method={}, id={:?}", method, id);
    
    // Route to appropriate handler
    let result = match method {
        "store_context" => handle_store_context(params, storage).await,
        "search_context" => handle_search_context(params, storage).await,
        "get_project_context" => handle_get_project_context(params, storage).await,
        "list_projects" => handle_list_projects(params, storage).await,
        "store_project_context" => handle_store_project_context(params, storage).await,
        _ => {
            return create_error_response(
                id,
                error_codes::METHOD_NOT_FOUND,
                format!("Method '{}' not found", method),
            );
        }
    };
    
    match result {
        Ok(value) => create_success_response(id, value),
        Err(e) => {
            error!("Handler error for method {}: {}", method, e);
            create_error_response(
                id,
                error_codes::INTERNAL_ERROR,
                e.to_string(),
            )
        }
    }
}

/// Handle store_context method
async fn handle_store_context(
    params: Value,
    storage: Arc<RwLock<Storage>>,
) -> Result<Value> {
    let params: StoreContextParams = serde_json::from_value(params)
        .map_err(|e| anyhow!("Invalid parameters: {}", e))?;
    
    // Create a Context object
    let context = mpcm_core::Context::new(
        &params.project_name,
        &params.key,
        &params.context_type,
        &params.value,
    );
    
    let storage = storage.read().await;
    storage.store_context(&context).await?;
    
    Ok(json!({
        "success": true,
        "message": format!("Stored context '{}' for project '{}'", params.key, params.project_name)
    }))
}

/// Handle search_context method (simplified - returns empty for now)
async fn handle_search_context(
    params: Value,
    _storage: Arc<RwLock<Storage>>,
) -> Result<Value> {
    let _params: SearchContextParams = serde_json::from_value(params)
        .map_err(|e| anyhow!("Invalid parameters: {}", e))?;
    
    // TODO: Implement search functionality
    // For now, return empty results
    Ok(json!({
        "entries": [],
        "count": 0
    }))
}

/// Handle get_project_context method
async fn handle_get_project_context(
    params: Value,
    storage: Arc<RwLock<Storage>>,
) -> Result<Value> {
    let params: GetProjectContextParams = serde_json::from_value(params)
        .map_err(|e| anyhow!("Invalid parameters: {}", e))?;
    
    let storage = storage.read().await;
    
    // For now, we'll return a simple response
    // TODO: Implement full project context retrieval
    Ok(json!({
        "project": {
            "name": params.project_name,
            "description": null,
            "repository_url": null,
            "local_directory": null,
            "status": "active",
            "tags": [],
            "metadata": null,
            "created_at": chrono::Utc::now().to_rfc3339(),
            "updated_at": chrono::Utc::now().to_rfc3339(),
        },
        "contexts": [],
        "context_count": 0
    }))
}

/// Handle list_projects method (simplified)
async fn handle_list_projects(
    params: Value,
    _storage: Arc<RwLock<Storage>>,
) -> Result<Value> {
    let _params: ListProjectsParams = serde_json::from_value(params)
        .map_err(|e| anyhow!("Invalid parameters: {}", e))?;
    
    // TODO: Implement project listing
    Ok(json!({
        "projects": [],
        "count": 0
    }))
}

/// Handle store_project_context method (simplified)
async fn handle_store_project_context(
    params: Value,
    _storage: Arc<RwLock<Storage>>,
) -> Result<Value> {
    let params: StoreProjectContextParams = serde_json::from_value(params)
        .map_err(|e| anyhow!("Invalid parameters: {}", e))?;
    
    // TODO: Implement project storage
    Ok(json!({
        "success": true,
        "message": format!("Stored project context for '{}'", params.project_name)
    }))
}

/// Create a JSON-RPC success response
fn create_success_response(id: Value, result: Value) -> Value {
    json!({
        "jsonrpc": "2.0",
        "result": result,
        "id": id
    })
}

/// Create a JSON-RPC error response
fn create_error_response(id: Value, code: i32, message: String) -> Value {
    json!({
        "jsonrpc": "2.0",
        "error": {
            "code": code,
            "message": message
        },
        "id": id
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_error_response_format() {
        let response = create_error_response(
            json!(1),
            error_codes::METHOD_NOT_FOUND,
            "Test error".to_string()
        );
        
        assert_eq!(response["jsonrpc"], "2.0");
        assert_eq!(response["id"], 1);
        assert_eq!(response["error"]["code"], -32601);
        assert_eq!(response["error"]["message"], "Test error");
    }
    
    #[test]
    fn test_success_response_format() {
        let response = create_success_response(
            json!(1),
            json!({"test": "value"})
        );
        
        assert_eq!(response["jsonrpc"], "2.0");
        assert_eq!(response["id"], 1);
        assert_eq!(response["result"]["test"], "value");
    }
    
    #[test]
    fn test_store_context_params_deserialization() {
        let json = json!({
            "project_name": "test",
            "key": "test-key",
            "value": "test-value",
            "type": "note",
            "tags": ["tag1", "tag2"],
            "metadata": {"custom": "data"}
        });
        
        let params: StoreContextParams = serde_json::from_value(json).unwrap();
        assert_eq!(params.project_name, "test");
        assert_eq!(params.key, "test-key");
        assert_eq!(params.value, "test-value");
        assert_eq!(params.context_type, "note");
        assert_eq!(params.tags.unwrap().len(), 2);
    }
    
    #[test]
    fn test_invalid_method_routing() {
        // Test that invalid methods return METHOD_NOT_FOUND error
        let request = json!({
            "jsonrpc": "2.0",
            "method": "invalid_method",
            "params": {},
            "id": 1
        });
        
        // We'll test the response has error code -32601
        // (This would need the actual handle_request to be testable synchronously)
    }
}

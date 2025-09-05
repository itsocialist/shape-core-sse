//! JSON-RPC request handlers for MPCM Server (v2)
//! Compatible with TypeScript MPCM implementation

use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::Arc;
use tracing::{debug, error, info};

use mpcm_core::storage_v2::{Storage, StorageResult, ContextEntry, Project};

/// JSON-RPC error codes
pub mod error_codes {
    pub const PARSE_ERROR: i32 = -32700;
    pub const INVALID_REQUEST: i32 = -32600;
    pub const METHOD_NOT_FOUND: i32 = -32601;
    pub const INVALID_PARAMS: i32 = -32602;
    pub const INTERNAL_ERROR: i32 = -32603;
    
    // Custom error codes
    pub const CONTEXT_NOT_FOUND: i32 = 1001;
    pub const PROJECT_NOT_FOUND: i32 = 1002;
    pub const DATABASE_ERROR: i32 = 1003;
}

/// Store context parameters
#[derive(Debug, Deserialize)]
pub struct StoreContextParams {
    project_name: String,
    key: String,
    #[serde(rename = "type")]
    context_type: String,
    value: String,
    tags: Option<Vec<String>>,
    metadata: Option<Value>,
    is_system_specific: Option<bool>,
    role_id: Option<String>,
}

/// Search context parameters
#[derive(Debug, Deserialize)]
pub struct SearchContextParams {
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
pub struct GetProjectContextParams {
    project_name: String,
    system_specific: Option<bool>,
}

/// List projects parameters
#[derive(Debug, Deserialize)]
pub struct ListProjectsParams {
    include_archived: Option<bool>,
}

/// Update project status parameters
#[derive(Debug, Deserialize)]
pub struct UpdateProjectStatusParams {
    project_name: String,
    status: String,
    note: Option<String>,
}

/// Handle store_context request
pub async fn handle_store_context(
    storage: Arc<Storage>,
    params: StoreContextParams,
) -> Result<Value> {
    debug!("Storing context: project={}, key={}", params.project_name, params.key);
    
    let result = storage
        .store_context(
            &params.project_name,
            &params.key,
            &params.context_type,
            &params.value,
            params.tags,
            params.metadata,
            params.is_system_specific,
            params.role_id,
        )
        .await?;
    
    info!("Context stored successfully: {}", params.key);
    Ok(json!(result))
}

/// Handle search_context request
pub async fn handle_search_context(
    storage: Arc<Storage>,
    params: SearchContextParams,
) -> Result<Value> {
    debug!("Searching context: {:?}", params);
    
    let entries = storage
        .search_context(
            params.project_name.as_deref(),
            params.query.as_deref(),
            params.context_type.as_deref(),
            params.tags,
            params.since.as_deref(),
            params.limit,
        )
        .await?;
    
    info!("Found {} context entries", entries.len());
    Ok(json!(entries))
}

/// Handle get_project_context request
pub async fn handle_get_project_context(
    storage: Arc<Storage>,
    params: GetProjectContextParams,
) -> Result<Value> {
    debug!("Getting project context: {}", params.project_name);
    
    let result = storage
        .get_project_context(
            &params.project_name,
            params.system_specific,
        )
        .await?;
    
    info!("Retrieved context for project: {}", params.project_name);
    Ok(json!(result))
}

/// Handle list_projects request
pub async fn handle_list_projects(
    storage: Arc<Storage>,
    params: ListProjectsParams,
) -> Result<Value> {
    debug!("Listing projects: include_archived={:?}", params.include_archived);
    
    let projects = storage
        .list_projects(params.include_archived)
        .await?;
    
    info!("Found {} projects", projects.len());
    Ok(json!(projects))
}

/// Handle update_project_status request
pub async fn handle_update_project_status(
    storage: Arc<Storage>,
    params: UpdateProjectStatusParams,
) -> Result<Value> {
    debug!("Updating project status: {} -> {}", params.project_name, params.status);
    
    let result = storage
        .update_project_status(
            &params.project_name,
            &params.status,
            params.note.as_deref(),
        )
        .await?;
    
    info!("Project status updated: {}", params.project_name);
    Ok(json!(result))
}

/// Main request handler
pub async fn handle_request(
    method: &str,
    params: Value,
    storage: Arc<Storage>,
) -> Result<Value> {
    match method {
        "store_context" => {
            let params: StoreContextParams = serde_json::from_value(params)?;
            handle_store_context(storage, params).await
        }
        "search_context" => {
            let params: SearchContextParams = serde_json::from_value(params)?;
            handle_search_context(storage, params).await
        }
        "get_project_context" => {
            let params: GetProjectContextParams = serde_json::from_value(params)?;
            handle_get_project_context(storage, params).await
        }
        "list_projects" => {
            let params: ListProjectsParams = serde_json::from_value(params)?;
            handle_list_projects(storage, params).await
        }
        "update_project_status" => {
            let params: UpdateProjectStatusParams = serde_json::from_value(params)?;
            handle_update_project_status(storage, params).await
        }
        _ => Err(anyhow!("Method not found: {}", method)),
    }
}

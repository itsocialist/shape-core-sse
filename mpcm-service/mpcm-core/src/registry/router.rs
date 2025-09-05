//! Request router for service registry

use std::collections::HashMap;
use std::sync::Arc;
use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use tracing::{debug, info};

use super::{ServiceRegistry, ServiceCommand, ServiceResult};

/// MCP tool request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolRequest {
    pub tool: String,
    pub args: JsonValue,
}

/// Routing strategy for handling requests
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RoutingStrategy {
    /// Route to first service that supports the capability
    FirstMatch,
    /// Route to all services that support the capability and aggregate results
    Broadcast,
    /// Route to specific service by name
    Direct(DirectRoute),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct DirectRoute;

/// Request router - handles routing MCP requests to appropriate services
pub struct RequestRouter {
    registry: Arc<ServiceRegistry>,
    /// Mapping of tool names to service names for direct routing
    tool_mappings: HashMap<String, String>,
    /// Default routing strategy
    default_strategy: RoutingStrategy,
}

impl RequestRouter {
    /// Create a new request router
    pub fn new(registry: Arc<ServiceRegistry>) -> Self {
        Self {
            registry,
            tool_mappings: HashMap::new(),
            default_strategy: RoutingStrategy::FirstMatch,
        }
    }
    
    /// Set default routing strategy
    pub fn set_default_strategy(&mut self, strategy: RoutingStrategy) {
        self.default_strategy = strategy;
    }
    
    /// Add a direct tool mapping
    pub fn add_tool_mapping(&mut self, tool: impl Into<String>, service: impl Into<String>) {
        self.tool_mappings.insert(tool.into(), service.into());
    }
    
    /// Route a tool request
    pub async fn route_request(
        &self,
        request: ToolRequest,
        project_name: Option<String>,
        role_id: Option<String>,
        context: Option<HashMap<String, JsonValue>>,
    ) -> Result<ServiceResult> {
        info!("Routing request for tool: {}", request.tool);
        
        // Check for direct mapping first
        if let Some(service_name) = self.tool_mappings.get(&request.tool) {
            return self.execute_on_service(
                service_name,
                request,
                project_name,
                role_id,
                context,
            ).await;
        }
        
        // Use routing strategy
        match self.default_strategy {
            RoutingStrategy::FirstMatch => {
                self.route_first_match(request, project_name, role_id, context).await
            }
            RoutingStrategy::Broadcast => {
                self.route_broadcast(request, project_name, role_id, context).await
            }
            RoutingStrategy::Direct(_) => {
                Err(anyhow!("Direct routing requires tool mapping"))
            }
        }
    }
    
    /// Route to first matching service
    async fn route_first_match(
        &self,
        request: ToolRequest,
        project_name: Option<String>,
        role_id: Option<String>,
        context: Option<HashMap<String, JsonValue>>,
    ) -> Result<ServiceResult> {
        // Find services that support this capability
        let services = self.registry.find_by_capability(&request.tool).await;
        
        if services.is_empty() {
            return Err(anyhow!("No service found for tool: {}", request.tool));
        }
        
        // Use the first service
        let service_name = &services[0];
        self.execute_on_service(
            service_name,
            request,
            project_name,
            role_id,
            context,
        ).await
    }
    
    /// Route to all matching services and aggregate results
    async fn route_broadcast(
        &self,
        request: ToolRequest,
        project_name: Option<String>,
        role_id: Option<String>,
        context: Option<HashMap<String, JsonValue>>,
    ) -> Result<ServiceResult> {
        // Find all services that support this capability
        let services = self.registry.find_by_capability(&request.tool).await;
        
        if services.is_empty() {
            return Err(anyhow!("No service found for tool: {}", request.tool));
        }
        
        let mut all_results = Vec::new();
        let mut any_success = false;
        let mut errors = Vec::new();
        
        // Execute on all services
        for service_name in services {
            match self.execute_on_service(
                &service_name,
                request.clone(),
                project_name.clone(),
                role_id.clone(),
                context.clone(),
            ).await {
                Ok(result) => {
                    if result.success {
                        any_success = true;
                    }
                    all_results.push(result);
                }
                Err(e) => {
                    errors.push(format!("{}: {}", service_name, e));
                }
            }
        }
        
        // Aggregate results
        if all_results.is_empty() && !errors.is_empty() {
            return Err(anyhow!("All services failed: {}", errors.join(", ")));
        }
        
        Ok(ServiceResult {
            success: any_success,
            data: Some(serde_json::json!({
                "results": all_results,
                "errors": errors,
            })),
            error: if errors.is_empty() { None } else { Some(errors.join(", ")) },
            metadata: Some(HashMap::from([
                ("routing_strategy".to_string(), serde_json::json!("broadcast")),
                ("services_called".to_string(), serde_json::json!(all_results.len())),
            ])),
        })
    }
    
    /// Execute request on specific service
    async fn execute_on_service(
        &self,
        service_name: &str,
        request: ToolRequest,
        project_name: Option<String>,
        role_id: Option<String>,
        context: Option<HashMap<String, JsonValue>>,
    ) -> Result<ServiceResult> {
        debug!("Executing on service: {}", service_name);
        
        let command = ServiceCommand {
            tool: request.tool,
            args: request.args,
            project_name,
            role_id,
            context,
            store_result: Some(true),
        };
        
        self.registry.execute(service_name, command).await
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::adapters::FileSystemAdapter;
    use tempfile::TempDir;
    
    #[tokio::test]
    async fn test_request_routing() {
        // Create registry and router
        let registry = Arc::new(ServiceRegistry::new(60));
        let router = RequestRouter::new(registry.clone());
        
        // Register filesystem adapter
        let temp_dir = TempDir::new().unwrap();
        let fs_adapter = Box::new(FileSystemAdapter::new(temp_dir.path()));
        registry.register(fs_adapter).await.unwrap();
        
        // Test routing
        let request = ToolRequest {
            tool: "writeFile".to_string(),
            args: serde_json::json!({
                "path": "test.txt",
                "content": "Router test"
            }),
        };
        
        let result = router.route_request(
            request,
            Some("test-project".to_string()),
            Some("developer".to_string()),
            None,
        ).await.unwrap();
        
        assert!(result.success);
    }
}

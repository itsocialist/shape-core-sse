//! Service Registry for MPCM-Pro
//! 
//! This module provides dynamic service discovery and management,
//! allowing MPCM-Pro to act as a single entry point for all MCP services.

mod router;

pub use router::{RequestRouter, ToolRequest, RoutingStrategy};

use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use anyhow::{anyhow, Result};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use tracing::{debug, info, warn};

/// Service capability definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceCapability {
    pub name: String,
    pub description: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub input_schema: Option<JsonValue>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub output_schema: Option<JsonValue>,
}

/// Service command for execution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceCommand {
    pub tool: String,
    pub args: JsonValue,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub project_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub role_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub context: Option<HashMap<String, JsonValue>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub store_result: Option<bool>,
}

/// Service execution result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceResult {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<JsonValue>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<HashMap<String, JsonValue>>,
}

/// Service status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ServiceStatus {
    Active,
    Inactive,
    Error,
}

/// Service provider trait - all adapters must implement this
#[async_trait::async_trait]
pub trait ServiceProvider: Send + Sync {
    /// Get the service name
    fn name(&self) -> &str;
    
    /// Get the service description
    fn description(&self) -> &str;
    
    /// Initialize the service
    async fn initialize(&mut self) -> Result<()>;
    
    /// Get service capabilities
    async fn get_capabilities(&self) -> Result<Vec<ServiceCapability>>;
    
    /// Execute a command
    async fn execute(&self, command: ServiceCommand) -> Result<ServiceResult>;
    
    /// Shutdown the service
    async fn shutdown(&mut self) -> Result<()>;
    
    /// Health check
    async fn health_check(&self) -> Result<()> {
        Ok(())
    }
}

/// Service registration information
#[derive(Debug, Clone)]
pub struct ServiceRegistration {
    pub name: String,
    pub capabilities: Vec<ServiceCapability>,
    pub status: ServiceStatus,
    pub last_error: Option<String>,
    pub registered_at: DateTime<Utc>,
    pub last_health_check: Option<DateTime<Utc>>,
}

/// Service Registry - manages all registered services
pub struct ServiceRegistry {
    /// Registered services
    services: Arc<RwLock<HashMap<String, Arc<dyn ServiceProvider>>>>,
    /// Service metadata
    metadata: Arc<RwLock<HashMap<String, ServiceRegistration>>>,
    /// Health check interval in seconds
    health_check_interval: u64,
}

impl ServiceRegistry {
    /// Create a new service registry
    pub fn new(health_check_interval: u64) -> Self {
        Self {
            services: Arc::new(RwLock::new(HashMap::new())),
            metadata: Arc::new(RwLock::new(HashMap::new())),
            health_check_interval,
        }
    }

    /// Register a new service
    pub async fn register(&self, mut provider: Box<dyn ServiceProvider>) -> Result<()> {
        let name = provider.name().to_string();
        
        // Check if already registered
        {
            let services = self.services.read().await;
            if services.contains_key(&name) {
                return Err(anyhow!("Service {} is already registered", name));
            }
        }
        
        info!("Registering service: {}", name);
        
        // Initialize the service
        provider.initialize().await?;
        
        // Get capabilities
        let capabilities = provider.get_capabilities().await?;
        
        // Convert to Arc for sharing
        let provider_arc = Arc::from(provider);
        
        // Register the service
        {
            let mut services = self.services.write().await;
            services.insert(name.clone(), provider_arc);
        }
        
        // Store metadata
        {
            let mut metadata = self.metadata.write().await;
            metadata.insert(name.clone(), ServiceRegistration {
                name: name.clone(),
                capabilities,
                status: ServiceStatus::Active,
                last_error: None,
                registered_at: Utc::now(),
                last_health_check: None,
            });
        }
        
        info!("Service {} registered successfully", name);
        Ok(())
    }
    
    /// Unregister a service
    pub async fn unregister(&self, name: &str) -> Result<()> {
        info!("Unregistering service: {}", name);
        
        // Remove the service
        let _provider = {
            let mut services = self.services.write().await;
            services.remove(name)
                .ok_or_else(|| anyhow!("Service {} not found", name))?
        };
        
        // Note: We can't call shutdown on the service because it's behind an Arc
        // and we may not have exclusive access. In a production system, you might
        // want to add a shutdown signal mechanism instead.
        warn!("Service {} removed but shutdown() not called (shared ownership)", name);
        
        // Remove metadata
        {
            let mut metadata = self.metadata.write().await;
            metadata.remove(name);
        }
        
        info!("Service {} unregistered", name);
        Ok(())
    }
    
    /// Get a service by name
    pub async fn get_service(&self, name: &str) -> Result<Arc<dyn ServiceProvider>> {
        let services = self.services.read().await;
        services.get(name)
            .cloned()
            .ok_or_else(|| anyhow!("Service {} not found", name))
    }
    
    /// List all registered services
    pub async fn list_services(&self) -> Vec<ServiceRegistration> {
        let metadata = self.metadata.read().await;
        metadata.values().cloned().collect()
    }
    
    /// Execute a command on a service
    pub async fn execute(&self, service_name: &str, command: ServiceCommand) -> Result<ServiceResult> {
        debug!("Executing command on service {}: {:?}", service_name, command.tool);
        
        // Get the service
        let service = self.get_service(service_name).await?;
        
        // Execute the command
        let result = match service.execute(command).await {
            Ok(result) => result,
            Err(e) => {
                // Update error status
                let mut metadata = self.metadata.write().await;
                if let Some(reg) = metadata.get_mut(service_name) {
                    reg.status = ServiceStatus::Error;
                    reg.last_error = Some(e.to_string());
                }
                
                return Err(e);
            }
        };
        
        // Update status to active on success
        if result.success {
            let mut metadata = self.metadata.write().await;
            if let Some(reg) = metadata.get_mut(service_name) {
                reg.status = ServiceStatus::Active;
                reg.last_error = None;
            }
        }
        
        Ok(result)
    }

    /// Run health checks on all services
    pub async fn run_health_checks(&self) -> HashMap<String, Result<()>> {
        let mut results = HashMap::new();
        
        let services = self.services.read().await.clone();
        
        for (name, service) in services {
            let result = service.health_check().await;
            
            // Update metadata
            let mut metadata = self.metadata.write().await;
            if let Some(reg) = metadata.get_mut(&name) {
                reg.last_health_check = Some(Utc::now());
                
                match &result {
                    Ok(_) => {
                        reg.status = ServiceStatus::Active;
                        reg.last_error = None;
                    }
                    Err(e) => {
                        reg.status = ServiceStatus::Error;
                        reg.last_error = Some(e.to_string());
                    }
                }
            }
            
            results.insert(name, result);
        }
        
        results
    }
    
    /// Find services by capability
    pub async fn find_by_capability(&self, capability_name: &str) -> Vec<String> {
        let metadata = self.metadata.read().await;
        
        metadata.iter()
            .filter(|(_, reg)| {
                reg.capabilities.iter()
                    .any(|cap| cap.name == capability_name)
            })
            .map(|(name, _)| name.clone())
            .collect()
    }
    
    /// Get service status
    pub async fn get_status(&self, name: &str) -> Result<ServiceRegistration> {
        let metadata = self.metadata.read().await;
        metadata.get(name)
            .cloned()
            .ok_or_else(|| anyhow!("Service {} not found", name))
    }
    
    /// Start health check task
    pub fn start_health_check_task(self: Arc<Self>) -> tokio::task::JoinHandle<()> {
        let interval = self.health_check_interval;
        
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(
                tokio::time::Duration::from_secs(interval)
            );
            
            loop {
                interval.tick().await;
                
                debug!("Running health checks");
                let results = self.run_health_checks().await;
                
                for (name, result) in results {
                    match result {
                        Ok(_) => debug!("Health check passed for {}", name),
                        Err(e) => warn!("Health check failed for {}: {}", name, e),
                    }
                }
            }
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use async_trait::async_trait;
    
    // Mock service provider for testing
    struct MockService {
        name: String,
        initialized: bool,
    }
    
    #[async_trait]
    impl ServiceProvider for MockService {
        fn name(&self) -> &str {
            &self.name
        }
        
        fn description(&self) -> &str {
            "Mock service for testing"
        }
        
        async fn initialize(&mut self) -> Result<()> {
            self.initialized = true;
            Ok(())
        }
        
        async fn get_capabilities(&self) -> Result<Vec<ServiceCapability>> {
            Ok(vec![
                ServiceCapability {
                    name: "test_capability".to_string(),
                    description: "Test capability".to_string(),
                    input_schema: None,
                    output_schema: None,
                }
            ])
        }
        
        async fn execute(&self, _command: ServiceCommand) -> Result<ServiceResult> {
            Ok(ServiceResult {
                success: true,
                data: Some(serde_json::json!({"test": "result"})),
                error: None,
                metadata: None,
            })
        }
        
        async fn shutdown(&mut self) -> Result<()> {
            self.initialized = false;
            Ok(())
        }
    }
    
    #[tokio::test]
    async fn test_service_registration() {
        let registry = ServiceRegistry::new(60);
        
        let service = Box::new(MockService {
            name: "test_service".to_string(),
            initialized: false,
        });
        
        // Register service
        assert!(registry.register(service).await.is_ok());
        
        // Try to register again - should fail
        let service2 = Box::new(MockService {
            name: "test_service".to_string(),
            initialized: false,
        });
        assert!(registry.register(service2).await.is_err());
        
        // List services
        let services = registry.list_services().await;
        assert_eq!(services.len(), 1);
        assert_eq!(services[0].name, "test_service");
    }
    
    #[tokio::test]
    async fn test_service_execution() {
        let registry = ServiceRegistry::new(60);
        
        let service = Box::new(MockService {
            name: "test_service".to_string(),
            initialized: false,
        });
        
        registry.register(service).await.unwrap();
        
        let command = ServiceCommand {
            tool: "test_tool".to_string(),
            args: serde_json::json!({}),
            project_name: None,
            role_id: None,
            context: None,
            store_result: None,
        };
        
        let result = registry.execute("test_service", command).await.unwrap();
        assert!(result.success);
    }
}

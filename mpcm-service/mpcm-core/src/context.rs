//! Context types and operations

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Context {
    id: String,
    project_name: String,
    key: String,
    context_type: String,
    value: String,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

impl Context {
    /// Create a new context entry
    pub fn new(project_name: &str, key: &str, context_type: &str, value: &str) -> Self {
        let now = Utc::now();
        Self {
            id: Uuid::new_v4().to_string(),
            project_name: project_name.to_string(),
            key: key.to_string(),
            context_type: context_type.to_string(),
            value: value.to_string(),
            created_at: now,
            updated_at: now,
        }
    }
    
    // Getters
    pub fn id(&self) -> &str { &self.id }
    pub fn project_name(&self) -> &str { &self.project_name }
    pub fn key(&self) -> &str { &self.key }
    pub fn context_type(&self) -> &str { &self.context_type }
    pub fn value(&self) -> &str { &self.value }
    pub fn created_at(&self) -> &DateTime<Utc> { &self.created_at }
    
    /// Create context from storage (used internally by storage layer)
    pub(crate) fn from_storage(
        id: String,
        project_name: String,
        key: String,
        context_type: String,
        value: String,
        created_at: DateTime<Utc>,
        updated_at: DateTime<Utc>,
    ) -> Self {
        Self {
            id,
            project_name,
            key,
            context_type,
            value,
            created_at,
            updated_at,
        }
    }
    
    /// Serialize to storage format (JSON for now)
    pub fn to_storage_format(&self) -> Result<String, serde_json::Error> {
        serde_json::to_string(&self)
    }
}
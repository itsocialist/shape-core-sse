//! Error types for MPCM core

use thiserror::Error;

#[derive(Error, Debug)]
pub enum MpcmError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),
    
    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
    
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    
    #[error("Context not found: project={project}, key={key}")]
    ContextNotFound { project: String, key: String },
    
    #[error("Invalid context type: {0}")]
    InvalidContextType(String),
}

pub type Result<T> = std::result::Result<T, MpcmError>;
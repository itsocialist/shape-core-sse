//! MPCM Server v2 - Unix socket server for context management
//! Compatible with TypeScript MPCM implementation

mod protocol;
mod handlers_v2;
mod server_v2;

use anyhow::Result;
use clap::Parser;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tracing::{info, Level};
use tracing_subscriber::FmtSubscriber;

// Re-export storage from mpcm-core
use mpcm_core::storage_v2::Storage;

#[derive(Parser, Debug)]
#[command(author, version, about, long_about = None)]
struct Args {
    /// Path to the SQLite database
    #[arg(long, env = "MPCM_DB_PATH", default_value = "~/.mpcm-pro/mpcm-pro.db")]
    db_path: PathBuf,
    
    /// Unix socket path
    #[arg(long, env = "MPCM_SOCKET_PATH", default_value = "/tmp/mpcm.sock")]
    socket_path: PathBuf,
    
    /// Log level
    #[arg(long, env = "MPCM_LOG_LEVEL", default_value = "info")]
    log_level: String,
    
    /// Maximum concurrent connections
    #[arg(long, env = "MPCM_MAX_CONNECTIONS", default_value = "100")]
    max_connections: usize,
}

#[tokio::main]
async fn main() -> Result<()> {
    let args = Args::parse();
    
    // Initialize logging
    let log_level = args.log_level.parse::<Level>().unwrap_or(Level::INFO);
    let subscriber = FmtSubscriber::builder()
        .with_max_level(log_level)
        .finish();
    tracing::subscriber::set_global_default(subscriber)?;
    
    info!("Starting MPCM Server v2");
    info!("Database: {:?}", args.db_path);
    info!("Socket: {:?}", args.socket_path);
    
    // Expand home directory
    let db_path = expand_home_dir(&args.db_path);
    
    // Initialize storage
    let storage = Arc::new(Storage::new(&db_path).await?);
    info!("Storage initialized successfully");
    
    // Start server
    server_v2::run_server(
        &args.socket_path,
        storage,
        args.max_connections,
    ).await?;
    
    Ok(())
}

/// Expand ~ to home directory
fn expand_home_dir(path: &Path) -> PathBuf {
    if let Some(path_str) = path.to_str() {
        if path_str.starts_with("~/") {
            if let Some(home) = dirs::home_dir() {
                return home.join(&path_str[2..]);
            }
        }
    }
    path.to_path_buf()
}

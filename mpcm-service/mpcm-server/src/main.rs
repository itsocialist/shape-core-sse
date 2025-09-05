//! MPCM Server - Unix socket server for context management
//! 
//! This server implements the JSON-RPC protocol over Unix sockets
//! to provide context storage and retrieval services.

mod protocol;
mod handlers;
mod server;

use anyhow::Result;
use clap::Parser;
use std::path::PathBuf;
use tracing::{info, Level};
use tracing_subscriber::FmtSubscriber;

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
    
    info!("Starting MPCM Server");
    info!("Database: {:?}", args.db_path);
    info!("Socket: {:?}", args.socket_path);
    
    // Expand home directory
    let db_path = expand_home_dir(&args.db_path);
    
    // Ensure database directory exists
    if let Some(parent) = db_path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    
    // Start the server
    server::run_server(&args.socket_path, &db_path).await?;
    
    Ok(())
}

fn expand_home_dir(path: &PathBuf) -> PathBuf {
    if let Some(path_str) = path.to_str() {
        if path_str.starts_with("~/") {
            if let Ok(home) = std::env::var("HOME") {
                return PathBuf::from(path_str.replacen("~", &home, 1));
            }
        }
    }
    path.clone()
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_expand_home_dir() {
        std::env::set_var("HOME", "/home/test");
        
        let path = PathBuf::from("~/test.db");
        let expanded = expand_home_dir(&path);
        assert_eq!(expanded, PathBuf::from("/home/test/test.db"));
        
        let absolute = PathBuf::from("/tmp/test.db");
        let expanded = expand_home_dir(&absolute);
        assert_eq!(expanded, absolute);
    }
}
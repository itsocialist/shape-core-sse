//! Adapter modules for various MCP services

pub mod filesystem;
pub mod git;
pub mod terminal;

pub use filesystem::FileSystemAdapter;
pub use git::GitAdapter;
pub use terminal::TerminalAdapter;
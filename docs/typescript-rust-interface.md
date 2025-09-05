# MPCM-Pro TypeScript-Rust Interface Specification

## Overview

This document defines the communication protocol between the TypeScript MPCM-Pro Adapter and the Rust MPCM Service.

## Transport Layer

- **Protocol**: JSON-RPC 2.0 over Unix Domain Sockets
- **Socket Path**: `/tmp/mpcm.sock` (configurable)
- **Message Format**: Newline-delimited JSON

## Request Format

```typescript
interface ServiceRequest {
  id: string;          // Unique request ID
  method: string;      // Method name
  params: any;         // Method parameters
}
```

## Response Format

```typescript
interface ServiceResponse {
  id: string;          // Matching request ID
  result?: any;        // Success result
  error?: {
    code: number;      // Error code
    message: string;   // Error message
  };
}
```

## API Methods

### 1. store_context

Stores a context entry for a project.

**Request:**
```json
{
  "id": "abc123",
  "method": "store_context",
  "params": {
    "project_name": "mpcm-pro",
    "key": "architecture-decision",
    "type": "decision",
    "value": "Use Rust for performance",
    "tags": ["rust", "performance", "architecture"]
  }
}
```

**Response:**
```json
{
  "id": "abc123",
  "result": {
    "success": true,
    "context_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

### 2. search_context

Searches for context entries matching criteria.

**Request:**
```json
{
  "id": "def456",
  "method": "search_context",
  "params": {
    "project_name": "mpcm-pro",
    "query": "rust performance",
    "type": "decision",
    "limit": 20,
    "since": "-7d"
  }
}
```

**Response:**
```json
{
  "id": "def456",
  "result": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "project_name": "mpcm-pro",
      "key": "architecture-decision",
      "type": "decision",
      "value": "Use Rust for performance",
      "tags": ["rust", "performance"],
      "created_at": "2025-06-24T10:30:00Z",
      "updated_at": "2025-06-24T10:30:00Z"
    }
  ]
}
```

### 3. get_project_context

Retrieves all context for a specific project.

**Request:**
```json
{
  "id": "ghi789",
  "method": "get_project_context",
  "params": {
    "project_name": "mpcm-pro",
    "system_specific": false
  }
}
```

**Response:**
```json
{
  "id": "ghi789",
  "result": [
    {
      "id": "...",
      "project_name": "mpcm-pro",
      "key": "...",
      "type": "...",
      "value": "...",
      "tags": [...],
      "created_at": "...",
      "updated_at": "..."
    }
  ]
}
```

### 4. update_project_status

Updates the status of a project.

**Request:**
```json
{
  "id": "jkl012",
  "method": "update_project_status",
  "params": {
    "project_name": "mpcm-pro",
    "status": "active",
    "note": "Sprint 3 in progress"
  }
}
```

### 5. list_projects

Lists all projects with summary information.

**Request:**
```json
{
  "id": "mno345",
  "method": "list_projects",
  "params": {
    "include_archived": false
  }
}
```

## Error Codes

| Code | Message | Description |
|------|---------|-------------|
| -32700 | Parse error | Invalid JSON |
| -32600 | Invalid request | Invalid request format |
| -32601 | Method not found | Unknown method |
| -32602 | Invalid params | Invalid method parameters |
| -32603 | Internal error | Internal service error |
| 1001 | Context not found | Requested context doesn't exist |
| 1002 | Project not found | Requested project doesn't exist |
| 1003 | Database error | Database operation failed |

## Performance Considerations

1. **Connection Pooling**: Adapter maintains persistent connection
2. **Request Timeout**: 30 seconds default
3. **Message Size**: Maximum 10MB per message
4. **Caching**: Adapter implements LRU cache with 5-minute TTL

## Rust Implementation Example

```rust
use tokio::net::UnixListener;
use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
struct ServiceRequest {
    id: String,
    method: String,
    params: serde_json::Value,
}

#[derive(Serialize)]
struct ServiceResponse {
    id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    result: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<ErrorResponse>,
}

async fn handle_request(req: ServiceRequest) -> ServiceResponse {
    match req.method.as_str() {
        "store_context" => handle_store_context(req.id, req.params).await,
        "search_context" => handle_search_context(req.id, req.params).await,
        _ => ServiceResponse {
            id: req.id,
            result: None,
            error: Some(ErrorResponse {
                code: -32601,
                message: "Method not found".to_string(),
            }),
        },
    }
}
```

## Migration Notes

1. Start with core methods (store, search, get)
2. Add role management methods in Phase 2
3. Add orchestration methods in Phase 3
4. Maintain backward compatibility
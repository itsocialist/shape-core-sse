//! JSON-RPC protocol types and serialization

use serde::{Deserialize, Serialize};
use serde_json::Value;

// For TypeScript adapter compatibility
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ServiceRequest {
    pub id: String,
    pub method: String,
    pub params: Value,
}

// For v2 server compatibility  
#[derive(Debug, Clone, Deserialize)]
pub struct Request {
    pub id: Option<String>,
    pub method: String,
    pub params: Option<Value>,
}

#[derive(Debug, Clone, Serialize)]
pub struct Response {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<ErrorResponse>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ServiceResponse {
    pub id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<ErrorResponse>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ErrorResponse {
    pub code: i32,
    pub message: String,
}

impl ErrorResponse {
    pub fn parse_error(msg: &str) -> Self {
        Self {
            code: -32700,
            message: format!("Parse error: {}", msg),
        }
    }
    
    pub fn invalid_request() -> Self {
        Self {
            code: -32600,
            message: "Invalid request".to_string(),
        }
    }
    
    pub fn method_not_found(method: &str) -> Self {
        Self {
            code: -32601,
            message: format!("Method not found: {}", method),
        }
    }
    
    pub fn invalid_params(msg: &str) -> Self {
        Self {
            code: -32602,
            message: format!("Invalid params: {}", msg),
        }
    }
    
    pub fn internal_error(msg: &str) -> Self {
        Self {
            code: -32603,
            message: format!("Internal error: {}", msg),
        }
    }
}

// Custom error codes
pub const ERROR_CONTEXT_NOT_FOUND: i32 = 1001;
pub const ERROR_PROJECT_NOT_FOUND: i32 = 1002;
pub const ERROR_DATABASE: i32 = 1003;

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    
    #[test]
    fn test_request_deserialization() {
        let json = json!({
            "id": "test123",
            "method": "store_context",
            "params": {
                "project_name": "test",
                "key": "test-key",
                "type": "note",
                "value": "test value"
            }
        });
        
        let request: ServiceRequest = serde_json::from_value(json).unwrap();
        assert_eq!(request.id, "test123");
        assert_eq!(request.method, "store_context");
        assert_eq!(request.params["project_name"], "test");
    }
    
    #[test]
    fn test_response_serialization() {
        let response = ServiceResponse {
            id: "test123".to_string(),
            result: Some(json!({"success": true})),
            error: None,
        };
        
        let json = serde_json::to_value(&response).unwrap();
        assert_eq!(json["id"], "test123");
        assert_eq!(json["result"]["success"], true);
        assert_eq!(json.get("error"), None);
    }
    
    #[test]
    fn test_error_response() {
        let response = ServiceResponse {
            id: "test123".to_string(),
            result: None,
            error: Some(ErrorResponse::method_not_found("unknown")),
        };
        
        let json = serde_json::to_value(&response).unwrap();
        assert_eq!(json["error"]["code"], -32601);
        assert!(json["error"]["message"].as_str().unwrap().contains("unknown"));
    }
}
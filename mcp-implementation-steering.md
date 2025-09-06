# MCP Implementation Steering Document

Based on Anthropic's official MCP documentation, this document outlines the correct implementation patterns for remote MCP servers.

## Key Requirements from Anthropic Documentation

### 1. Authentication Methods (Support Articles)

**From Claude Web MCP Documentation:**
- Supports both authless and OAuth-based remote servers
- Supports 3/26 and 6/18 auth specs
- Enables Dynamic Client Registration (DCR)
- OAuth callback URL: `https://claude.ai/api/mcp/auth_callback` (may change to claude.com)
- OAuth client name is "Claude"
- Supports token expiry and refresh

**Authentication Process:**
- Typically involves an OAuth authentication flow
- Allows Claude to interact without seeing actual passwords
- Users can revoke permissions at any time
- Review requested permissions carefully and limit scopes when possible

### 2. Third-Party Authorization Flow (MCP Specification)

**Flow Steps:**
1. MCP client initiates standard OAuth flow with MCP server
2. MCP server redirects user to third-party authorization server
3. User authorizes with third-party server
4. Third-party server redirects back to MCP server with authorization code
5. MCP server exchanges code for third-party access token
6. MCP server generates its own access token bound to the third-party session
7. MCP server completes original OAuth flow with MCP client

**Session Binding Requirements:**
- Maintain secure mapping between third-party tokens and issued MCP tokens
- Validate third-party token status before honoring MCP tokens
- Implement appropriate token lifecycle management
- Handle third-party token expiration and renewal

### 3. Enterprise Considerations

**For Enterprise and Team plans:**
- Only Primary Owners or Owners can enable on Claude for Work plans
- Ensures Claude can only access tools and data that individual user has access to
- Custom OAuth Client IDs only available for Claude for Work (not regular Claude Web)

### 4. Technical Implementation Requirements

**OAuth Specifics:**
- Supports client_credentials and authorization_code grant types
- OAuth servers can signal client deletion via HTTP 401 with "invalid_client" error
- Supports text/image tool results and text/binary resources
- Available for Pro, Max, Team, and Enterprise plan users

**Server Requirements:**
- Server must be publicly exposed through HTTP
- Supports both Streamable HTTP and SSE transports
- Local STDIO servers cannot be connected directly
- Claude supports token expiry and refresh functionality

### 5. Testing and Validation

**Recommended Approach:**
- Add server directly to Claude for initial testing
- Use MCP inspector tool to validate auth flow and exposed features
- Consider solutions like Cloudflare for hosting and management
- Test both authless and authenticated flows

## Current Implementation Analysis

### ✅ What We Have Correct

1. **OAuth 2.0 Flow**: Implemented authorization_code and client_credentials grants
2. **Callback URL**: Correctly using `https://claude.ai/api/mcp/auth_callback`
3. **Public Endpoint**: Working authless endpoint at `/mcp/public`
4. **Token Management**: Access token generation and validation
5. **MCP Protocol**: Correct JSON-RPC 2.0 format with proper capabilities
6. **Multi-transport**: HTTP/SSE support as specified

### ⚠️ Potential Issues for Claude Desktop

1. **Protocol Version**: Using "2025-06-18" but docs mention 3/26 and 6/18 specs
2. **Capabilities Structure**: May need more detailed capability declarations
3. **Server Info**: Format might not match Claude Desktop expectations
4. **CORS Headers**: Desktop might have different CORS requirements than web

### 🔧 Recommended Fixes

1. **Update Protocol Version**: Try "2024-06-18" or latest supported version
2. **Enhanced Capabilities**: Add more detailed tool/resource capability declarations
3. **Server Info Alignment**: Match exact format expected by Claude Desktop
4. **Logging**: Add comprehensive logging for debugging connection issues

## Implementation Priority

1. **Phase 1**: Fix Claude Desktop connectivity (current issue)
2. **Phase 2**: Enhance OAuth flow for production use
3. **Phase 3**: Add comprehensive tool suite beyond demo_tool
4. **Phase 4**: Implement full Ship APE Core integration

## Security Considerations

- Validate all redirect URIs in OAuth flow
- Securely store third-party credentials  
- Implement session timeout handling
- Use timing-safe comparison for tokens
- Handle third-party auth failures gracefully

## Next Steps

1. Debug Claude Desktop logs for specific error messages
2. Adjust MCP protocol version if needed
3. Test with MCP inspector tool if available
4. Validate exact capability structure expected by Claude Desktop
# Workday OAuth Authorization Code Grant Setup

Your Workday MCP server has been successfully upgraded to support **OAuth Authorization Code Grant** with PKCE (Proof Key for Code Exchange) for enhanced security. This replaces the legacy bearer token approach.

## ✅ What's New

### 🔐 OAuth Tools Added:
1. **`get_workday_auth_url`** - Generate authorization URL to start OAuth flow
2. **`complete_workday_auth`** - Complete authorization with code from callback  
3. **`check_workday_auth_status`** - Check current authentication status

### 🔒 Security Features:
- **PKCE (Proof Key for Code Exchange)** - Enhanced security for OAuth flow
- **State Parameter** - CSRF protection
- **Automatic Token Refresh** - Seamless token management
- **Secure Token Storage** - Tokens stored locally in `.workday-tokens.json`

## 🛠️ Configuration Setup

### 1. Update Environment Variables

Update your `workday.env` file with OAuth credentials:

```bash
# OAuth Client Credentials (replace with your actual values)
WORKDAY_CLIENT_ID=your-actual-client-id
WORKDAY_CLIENT_SECRET=your-actual-client-secret

# Workday Tenant Information
WORKDAY_TENANT=wday_wcpdev11
WORKDAY_BASE_URL=https://wcpdev-services1.wd101.myworkday.com

# OAuth Endpoints
WORKDAY_TOKEN_ENDPOINT=https://wcpdev-services1.wd101.myworkday.com/oauth2/token
WORKDAY_AUTH_ENDPOINT=https://wcpdev-services1.wd101.myworkday.com/oauth2/authorize

# Redirect URI for OAuth Authorization Code flow
WORKDAY_REDIRECT_URI=http://localhost:8080/callback

# Legacy Bearer Token (for backward compatibility)
WORKDAY_BEARER_TOKEN=your-legacy-token
```

### 2. Update Claude Desktop Configuration

Your Claude Desktop configuration has been updated to include OAuth environment variables:

```json
{
  "mcpServers": {
    "workday-mcp": {
      "command": "/usr/local/bin/node",
      "args": ["/Users/joe.lee/CursorProjects/WorkdayProject/dist/index.js"],
      "env": {
        "WORKDAY_CLIENT_ID": "your-client-id",
        "WORKDAY_CLIENT_SECRET": "your-client-secret",
        "WORKDAY_TENANT": "wday_wcpdev11",
        "WORKDAY_BASE_URL": "https://wcpdev-services1.wd101.myworkday.com",
        "WORKDAY_TOKEN_ENDPOINT": "https://wcpdev-services1.wd101.myworkday.com/oauth2/token",
        "WORKDAY_AUTH_ENDPOINT": "https://wcpdev-services1.wd101.myworkday.com/oauth2/authorize",
        "WORKDAY_REDIRECT_URI": "http://localhost:8080/callback",
        "WORKDAY_BEARER_TOKEN": "your-legacy-token"
      }
    }
  }
}
```

## 🚀 How to Use OAuth Flow

### Step 1: Check Authentication Status
In Claude Desktop, ask:
```
"Check my Workday authentication status"
```

### Step 2: Generate Authorization URL
In Claude Desktop, ask:
```
"Generate Workday authorization URL"
```

This will provide:
- Authorization URL to open in browser
- State parameter (save this!)
- Code verifier (save this!)

### Step 3: Complete Authorization
1. Open the authorization URL in your browser
2. Log in to Workday and authorize the application
3. Copy the authorization code from the callback URL
4. In Claude Desktop, ask:
```
"Complete Workday authorization with code: [AUTH_CODE], state: [STATE], codeVerifier: [CODE_VERIFIER]"
```

### Step 4: Use Workday Tools
Once authorized, use any Workday tool:
```
"Search for Logan McNeil in Workday"
"Get worker information for employee ID 21001"
"List 5 workers from Workday"
```

## 🔄 Backward Compatibility

The system maintains backward compatibility with legacy bearer tokens:
- If no OAuth tokens are found, it falls back to the legacy bearer token
- Existing functionality continues to work unchanged
- Migration to OAuth is recommended for enhanced security

## 📊 Available Tools

### OAuth Management Tools:
- `get_workday_auth_url` - Start OAuth flow
- `complete_workday_auth` - Complete authorization
- `check_workday_auth_status` - Check auth status

### Workday API Tools:
- `get_workday_worker` - Get worker by ID
- `search_workday_workers` - Search workers by name
- `list_workers` - List all workers
- `create_one_time_payment` - Create payroll payments

### Other Tools:
- `get_weather` - Weather information
- Sample user/project management tools

## 🔧 Token Management

### Token Storage:
- Tokens stored in `.workday-tokens.json` (add to `.gitignore`)
- Secure file-based storage
- Automatic token refresh

### Token Lifecycle:
1. **Authorization** - User authorizes via browser
2. **Token Exchange** - Authorization code exchanged for tokens
3. **Storage** - Tokens stored locally with expiration
4. **Auto-Refresh** - Access tokens refreshed automatically
5. **API Usage** - Tokens used for API authentication

## 🔐 Security Best Practices

### OAuth Client Setup in Workday:
1. **Grant Types**: Authorization Code Grant ✅
2. **PKCE**: Enabled (recommended) ✅
3. **Redirect URIs**: `http://localhost:8080/callback` ✅
4. **Scopes**: Include required scopes for worker data access
5. **Client Type**: Confidential (has client secret)

### Security Features:
- **PKCE** - Prevents authorization code interception
- **State Parameter** - Prevents CSRF attacks
- **HTTPS** - All API calls use HTTPS encryption
- **Token Expiration** - Tokens expire and refresh automatically
- **Minimal Scopes** - Uses only required permissions

## 🛡️ Error Handling

### Common Issues:
1. **"Not configured"** - Update client ID/secret in environment
2. **"Invalid authorization code"** - Code expires quickly (10 minutes)
3. **"Token refresh failed"** - Re-authorization required
4. **"401 Unauthorized"** - Check token validity and permissions

### Debug Commands:
```bash
# Check authentication status
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": "check_workday_auth_status", "arguments": {}}}' | node dist/index.js

# Generate auth URL
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": "get_workday_auth_url", "arguments": {}}}' | node dist/index.js
```

## 🎯 Next Steps

1. **Get OAuth credentials** from your Workday administrator
2. **Update environment variables** with actual client ID/secret
3. **Test OAuth flow** using the new tools
4. **Migrate from legacy bearer token** to OAuth for enhanced security
5. **Restart Claude Desktop** to apply configuration changes

## 📋 Implementation Details

### OAuth Flow Implementation:
- Uses `crypto` module for secure PKCE generation
- Implements proper state management
- Handles token storage and refresh
- Provides comprehensive error handling

### Code Structure:
- OAuth helper functions for PKCE, state generation
- Token storage functions for persistence
- Auto-refresh mechanism for seamless operation
- Backward compatibility with legacy tokens

Your Workday MCP server now supports industry-standard OAuth 2.0 Authorization Code Grant with PKCE for maximum security! 🔐✨ 
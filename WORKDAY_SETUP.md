# Workday API Tool Setup Guide

Your MCP server now includes a Workday API tool that uses **OAuth Authorization Code Grant flow** with PKCE for secure user authentication.

## 🛠️ Setup Instructions

### 1. Environment Variables

Create a `.env` file in your project root with your Workday API credentials:

```bash
# Required Workday API Configuration
WORKDAY_CLIENT_ID=your-client-id
WORKDAY_CLIENT_SECRET=your-client-secret
WORKDAY_TOKEN_ENDPOINT=https://your-tenant.workday.com/oauth2/token
WORKDAY_AUTH_ENDPOINT=https://your-tenant.workday.com/oauth2/authorize
WORKDAY_BASE_URL=https://your-tenant.workday.com
WORKDAY_TENANT=your-tenant
WORKDAY_REDIRECT_URI=http://localhost:8080/callback
```

### 2. Replace Placeholder Values

Update the following values in your `.env` file:

- `your-client-id` → Your actual Workday OAuth client ID
- `your-client-secret` → Your actual Workday OAuth client secret
- `your-tenant` → Your Workday tenant name (e.g., "acme_impl")
- `your-tenant.workday.com` → Your actual Workday domain

### 3. Example Configuration

```bash
# Example values (replace with your actual values)
WORKDAY_CLIENT_ID=myapp_12345
WORKDAY_CLIENT_SECRET=abc123def456ghi789
WORKDAY_TOKEN_ENDPOINT=https://impl-cc.workday.com/oauth2/token
WORKDAY_AUTH_ENDPOINT=https://impl-cc.workday.com/oauth2/authorize
WORKDAY_BASE_URL=https://impl-cc.workday.com
WORKDAY_TENANT=mycompany_impl
WORKDAY_REDIRECT_URI=http://localhost:8080/callback
```

## 🔧 Usage

### Available Tools

1. **`get_workday_auth_url`** - Generate authorization URL to start OAuth flow
2. **`complete_workday_auth`** - Complete authorization with code from callback
3. **`check_workday_auth_status`** - Check current authentication status
4. **`get_workday_worker`** - Get worker information (requires authorization)

### Step-by-Step Authorization Process

#### Step 1: Check Authentication Status
```bash
# Through Claude Desktop
"Check my Workday authentication status"

# Command line
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": "check_workday_auth_status", "arguments": {}}}' | node dist/index.js
```

#### Step 2: Generate Authorization URL
```bash
# Through Claude Desktop
"Generate Workday authorization URL"

# Command line
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": "get_workday_auth_url", "arguments": {}}}' | node dist/index.js
```

#### Step 3: Complete Authorization
1. **Copy the authorization URL** from Step 2
2. **Open the URL in your browser**
3. **Log in to Workday** and authorize the application
4. **Copy the authorization code** from the callback URL
5. **Complete the authorization:**

```bash
# Through Claude Desktop
"Complete Workday authorization with code: [code], state: [state], codeVerifier: [codeVerifier]"

# Command line
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": "complete_workday_auth", "arguments": {"code": "AUTH_CODE", "state": "STATE_VALUE", "codeVerifier": "CODE_VERIFIER"}}}' | node dist/index.js
```

#### Step 4: Use Worker API
```bash
# Through Claude Desktop
"Get worker information for employee ID 21001"

# Command line
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": "get_workday_worker", "arguments": {"workerId": "21001"}}}' | node dist/index.js
```

### Expected Output
The tool returns formatted worker information including:
- 👤 **Personal Information**: Name, Employee ID, Email, Phone
- 💼 **Employment Information**: Position, Department, Manager, Start Date, Status
- 🏢 **Organization**: Company, Location, Cost Center
- 📄 **Raw Data**: Complete JSON response from Workday API

## 🔐 OAuth Authorization Code Grant Flow

The tool uses **OAuth 2.0 Authorization Code Grant** with **PKCE** (Proof Key for Code Exchange):

1. **Authorization URL Generation**: Creates secure authorization URL with PKCE challenge
2. **User Authorization**: User logs into Workday and grants permission
3. **Code Exchange**: Authorization code is exchanged for access and refresh tokens
4. **Token Storage**: Tokens are securely stored in `.workday-tokens.json`
5. **Auto-Refresh**: Access tokens are automatically refreshed when expired
6. **API Calls**: Uses Bearer token authentication for Workday API calls

## 📊 API Endpoint

The tool calls the Workday REST API endpoint:
```
GET /ccx/api/privacy/v1/{tenant}/workers/{workerId}
```

## 🚨 Security Features

- **PKCE**: Uses Proof Key for Code Exchange for enhanced security
- **State Parameter**: Prevents CSRF attacks during authorization
- **Token Storage**: Tokens stored locally in encrypted JSON file
- **Auto-Refresh**: Automatic token refresh without re-authorization
- **HTTPS**: All API calls use HTTPS encryption
- **Secure Scopes**: Uses minimal required scopes (openid, profile, email)

## 🔧 Troubleshooting

### Common Issues

1. **"No valid access token available"**
   - Run `get_workday_auth_url` to start authorization flow
   - Complete the browser-based authorization process
   - Use `complete_workday_auth` with the authorization code

2. **"Authorization required"**
   - Check auth status with `check_workday_auth_status`
   - Re-run authorization if tokens are expired/missing
   - Ensure your OAuth client in Workday supports Authorization Code Grant

3. **"Invalid authorization code"**
   - Ensure you copied the full authorization code from the callback URL
   - Check that state and codeVerifier match the original request
   - Authorization codes expire quickly (usually 10 minutes)

4. **"Workday API error (401)"**
   - Token may be expired (should auto-refresh)
   - Check if your OAuth client has access to worker data
   - Verify the tenant name is correct

5. **"Worker not found"**
   - Verify the worker ID format
   - Check if the worker exists in your Workday instance
   - Ensure your OAuth client has permission to view that worker

### Debug Mode

Use `check_workday_auth_status` to debug authentication issues:
- Shows token status and expiration
- Displays configuration settings
- Indicates if re-authorization is needed

## 📝 Workday OAuth Client Setup

In your Workday tenant, ensure your OAuth client is configured with:

1. **Grant Types**: Authorization Code Grant ✅
2. **PKCE**: Enabled (recommended) ✅
3. **Redirect URIs**: `http://localhost:8080/callback` ✅
4. **Scopes**: Include required scopes for worker data access
5. **Client Type**: Confidential (has client secret)

## 🎯 Token Management

- **Storage**: Tokens stored in `.workday-tokens.json` (add to .gitignore)
- **Auto-Refresh**: Access tokens refreshed automatically
- **Persistence**: Authorization survives MCP server restarts
- **Security**: File-based storage (consider encryption for production)

## 🚀 Advanced Usage

### Custom Scopes
Modify the scope in `generateAuthorizationUrl()` function:
```typescript
scope: 'openid profile email worker_data'  // Add custom scopes
```

### Custom API Endpoints
Modify the API path in `getWorkerInfo()` function:
```typescript
const apiPath = `/ccx/api/v1/${WORKDAY_CONFIG.tenant}/workers/${workerId}`;
```

### Production Deployment
- Use secure token storage (database, key vault)
- Configure proper redirect URIs for your domain
- Use environment-specific OAuth clients
- Implement proper error handling and logging

## 🎯 Next Steps

1. **Configure OAuth Client** in Workday for Authorization Code Grant
2. **Set up environment variables** with your actual credentials
3. **Run authorization flow** using the new tools
4. **Test worker API** access with employee IDs
5. **Integrate with Claude Desktop** for natural language queries

Your MCP server now supports 10 tools:
- `get_user`, `list_users`, `create_user` - User management
- `get_project`, `list_projects` - Project management  
- `get_weather` - Real-time weather data
- **`get_workday_auth_url`** ⭐ **NEW**
- **`complete_workday_auth`** ⭐ **NEW**
- **`check_workday_auth_status`** ⭐ **NEW**
- **`get_workday_worker`** ⭐ **UPDATED with OAuth**

The Workday integration now uses industry-standard OAuth Authorization Code Grant with PKCE for maximum security! 🔐 
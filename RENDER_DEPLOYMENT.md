# Render.com Deployment Guide

This guide explains how to deploy your MCP Workday server to Render.com.

## 🚀 Quick Start

### 1. Prerequisites
- [Render.com account](https://render.com/)
- Workday OAuth client credentials (see [WORKDAY_SETUP.md](./WORKDAY_SETUP.md))
- GitHub repository with your code

### 2. Deploy to Render.com

#### Option A: Using render.yaml (Recommended)
1. **Fork or clone this repository** to your GitHub account
2. **Connect to Render.com**:
   - Go to [Render.com Dashboard](https://dashboard.render.com/)
   - Click "New +" → "Blueprint"
   - Connect your GitHub repository
   - Select this repository
   - Render will automatically detect the `render.yaml` file

#### Option B: Manual Setup
1. **Create a new Web Service**:
   - Go to [Render.com Dashboard](https://dashboard.render.com/)
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Select this repository

2. **Configure the service**:
   - **Name**: `mcp-workday-server`
   - **Environment**: `Node`
   - **Region**: `Oregon` (or preferred region)
   - **Branch**: `main`
   - **Build Command**: `npm ci && npm run build`
   - **Start Command**: `npm run start:render`
   - **Plan**: `Starter` (free tier)

### 3. Set Environment Variables

In your Render.com service dashboard, go to "Environment" and add these variables:

#### Required Variables
```bash
# Workday OAuth Credentials
WORKDAY_CLIENT_ID=your-client-id-here
WORKDAY_CLIENT_SECRET=your-client-secret-here

# Workday Tenant Configuration
WORKDAY_TENANT=your-tenant-name
WORKDAY_BASE_URL=https://your-tenant.workday.com

# OAuth Endpoints
WORKDAY_TOKEN_ENDPOINT=https://your-tenant.workday.com/oauth2/token
WORKDAY_AUTH_ENDPOINT=https://your-tenant.workday.com/oauth2/authorize

# Redirect URI (update with your Render.com URL)
WORKDAY_REDIRECT_URI=https://your-app-name.onrender.com/callback

# Refresh Token (for automatic token management)
WORKDAY_REFRESH_TOKEN=your-refresh-token-here

# Environment
NODE_ENV=production
```

### 4. Update OAuth Redirect URI

**Important**: Update your Workday OAuth client configuration to include your Render.com URL:

1. Go to your Workday tenant's OAuth client settings
2. Add the redirect URI: `https://your-app-name.onrender.com/callback`
3. Replace `your-app-name` with your actual Render.com service name

### 5. Deploy and Test

1. **Deploy**: Your service will automatically deploy when you push to GitHub
2. **Check health**: Visit `https://your-app-name.onrender.com/health`
3. **Test tools**: Visit `https://your-app-name.onrender.com/mcp/tools`

## 📋 Available Endpoints

Once deployed, your MCP server will be available at:

### Health Check
- **GET** `/health` - Service health status

### MCP Tools
- **GET** `/mcp/tools` - List all available tools
- **POST** `/mcp/tools/:toolName` - Execute a specific tool

### Example API Calls

#### List Available Tools
```bash
curl https://your-app-name.onrender.com/mcp/tools
```

#### Check Authentication Status
```bash
curl -X POST https://your-app-name.onrender.com/mcp/tools/check_workday_auth_status \
  -H "Content-Type: application/json" \
  -d '{}'
```

#### Get Authorization URL
```bash
curl -X POST https://your-app-name.onrender.com/mcp/tools/get_workday_auth_url \
  -H "Content-Type: application/json" \
  -d '{}'
```

#### Search Workers
```bash
curl -X POST https://your-app-name.onrender.com/mcp/tools/search_workday_workers \
  -H "Content-Type: application/json" \
  -d '{"arguments": {"searchTerm": "John Doe"}}'
```

## 🔧 Configuration

### Environment Variables Reference

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `WORKDAY_CLIENT_ID` | Yes | OAuth client ID | `myapp_12345` |
| `WORKDAY_CLIENT_SECRET` | Yes | OAuth client secret | `abc123def456` |
| `WORKDAY_TENANT` | Yes | Workday tenant name | `acme_impl` |
| `WORKDAY_BASE_URL` | Yes | Workday base URL | `https://impl-cc.workday.com` |
| `WORKDAY_TOKEN_ENDPOINT` | Yes | OAuth token endpoint | `https://impl-cc.workday.com/oauth2/token` |
| `WORKDAY_AUTH_ENDPOINT` | Yes | OAuth authorization endpoint | `https://impl-cc.workday.com/oauth2/authorize` |
| `WORKDAY_REDIRECT_URI` | Yes | OAuth redirect URI | `https://your-app.onrender.com/callback` |
| `WORKDAY_REFRESH_TOKEN` | Yes | OAuth refresh token for automatic token management | `eyJ0eXAiOiJKV1Q...` |
| `NODE_ENV` | No | Environment mode | `production` |

### Render.com Specific Settings

- **Build Command**: `npm ci && npm run build`
- **Start Command**: `npm run start:render`
- **Health Check Path**: `/health`
- **Node Version**: Automatic (latest LTS)

## 🛠️ Troubleshooting

### Common Issues

1. **Build Failures**
   - Check that all dependencies are in `package.json`
   - Ensure TypeScript compiles successfully locally

2. **Environment Variables Not Set**
   - Verify all required variables are added in Render.com dashboard
   - Check variable names match exactly (case-sensitive)

3. **OAuth Redirect URI Mismatch**
   - Ensure redirect URI in Workday matches your Render.com URL
   - Check for trailing slashes and protocol (https://)

4. **Health Check Failures**
   - Verify the service starts successfully
   - Check logs in Render.com dashboard

### Debugging

1. **Check Logs**:
   - Go to Render.com dashboard → Your Service → "Logs"
   - Look for startup errors or runtime issues

2. **Test Health Endpoint**:
   ```bash
   curl https://your-app-name.onrender.com/health
   ```

3. **Test Tool Listing**:
   ```bash
   curl https://your-app-name.onrender.com/mcp/tools
   ```

## 🔄 Updates and Maintenance

### Auto-Deploy from GitHub
- Your service will automatically redeploy when you push to the connected GitHub branch
- Monitor deployments in the Render.com dashboard

### Manual Deploy
- Go to your service dashboard → "Manual Deploy" → "Deploy latest commit"

### Environment Variables Updates
- Update variables in Render.com dashboard → "Environment"
- Changes require a service restart (automatic)

## 📊 Monitoring

### Built-in Monitoring
- **Health checks**: Render.com automatically monitors `/health`
- **Logs**: Available in the dashboard
- **Metrics**: Basic performance metrics available

### Custom Monitoring
- Monitor API response times
- Track OAuth token refresh cycles
- Monitor Workday API usage

## 💰 Pricing

### Render.com Pricing
- **Starter Plan**: Free (750 hours/month)
- **Standard Plan**: $7/month (unlimited hours)
- **Pro Plan**: $25/month (enhanced features)

### Workday API Limits
- Check your Workday tenant's API rate limits
- Monitor usage to avoid hitting limits

## 🎯 Next Steps

1. **Deploy your service** using this guide
2. **Test the endpoints** to ensure everything works
3. **Integrate with your applications** using the HTTP API
4. **Monitor usage** and performance
5. **Scale up** if needed (upgrade Render.com plan)

## 📚 Additional Resources

- [Render.com Documentation](https://render.com/docs)
- [Workday API Documentation](https://community.workday.com/sites/default/files/file-hosting/restapi/index.html)
- [OAuth 2.0 with PKCE](https://tools.ietf.org/html/rfc7636)

## 🔐 Security Considerations

- Use environment variables for all sensitive data
- Regularly rotate OAuth credentials
- Monitor access logs for suspicious activity
- Use HTTPS for all communications (automatic with Render.com)

Your MCP Workday server is now ready for production use! 🚀 
#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import express, { Request, Response } from 'express';
import cors from 'cors';
import https from 'https';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import * as staffingApi from './staffing-api.js';
// SOAP API removed - using REST API only
import * as learningApi from './learning-api.js';
import { ALL_TOOLS } from './tools-definitions.js';

// Create server instance
const server = new Server(
  {
    name: 'mcp-server-workday-http',
    version: '1.0.0',
  }
);

// Load environment variables from .env file
import { config } from 'dotenv';
// Temporarily suppress all dotenv output
const originalStdout = process.stdout.write;
const originalStderr = process.stderr.write;
process.stdout.write = () => true;
process.stderr.write = () => true;
config();
process.stdout.write = originalStdout;
process.stderr.write = originalStderr;

// Workday OAuth configuration - Refresh Token Grant Only
const WORKDAY_CONFIG = {
  clientId: process.env.WORKDAY_CLIENT_ID || '',
  clientSecret: process.env.WORKDAY_CLIENT_SECRET || '',
  tokenEndpoint: process.env.WORKDAY_TOKEN_ENDPOINT || '',
  baseUrl: process.env.WORKDAY_BASE_URL || 'https://your-tenant.workday.com',
  tenant: process.env.WORKDAY_TENANT || 'your-tenant',
  // Refresh token for direct access token generation
  refreshToken: process.env.WORKDAY_REFRESH_TOKEN || '',
};

// Token storage file path
const TOKEN_FILE = '.workday-tokens.json';

// Interface for stored tokens
interface TokenData {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  scope: string;
}

// Token storage functions
function saveTokens(tokens: TokenData): void {
  try {
    fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokens, null, 2));
  } catch (error) {
    console.error('Failed to save tokens:', error);
  }
}

function loadTokens(): TokenData | null {
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      const data = fs.readFileSync(TOKEN_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Failed to load tokens:', error);
  }
  return null;
}

function isTokenExpired(tokens: TokenData): boolean {
  return Date.now() >= tokens.expires_at;
}

// Simplified access token function - always uses refresh token
async function getValidAccessToken(): Promise<string> {
  if (!WORKDAY_CONFIG.refreshToken) {
    throw new Error('No refresh token configured. Please set WORKDAY_REFRESH_TOKEN in your environment variables.');
  }

  let tokens = loadTokens();
  
  // If no tokens in storage, bootstrap from environment refresh token
  if (!tokens) {
    try {
      tokens = await refreshAccessToken(WORKDAY_CONFIG.refreshToken);
    } catch (error) {
      if (error instanceof Error && error.message.includes('invalid_grant')) {
        throw new Error('Your refresh token has expired or is invalid. Please update WORKDAY_REFRESH_TOKEN with a valid refresh token.');
      } else {
        throw new Error('Failed to obtain access token from refresh token. Please check your configuration and refresh token validity.');
      }
    }
  }
  
  // If tokens are expired, refresh them
  if (isTokenExpired(tokens)) {
    try {
      tokens = await refreshAccessToken(tokens.refresh_token);
    } catch (error) {
      // Try to use environment refresh token as fallback
      if (WORKDAY_CONFIG.refreshToken && tokens.refresh_token !== WORKDAY_CONFIG.refreshToken) {
        try {
          tokens = await refreshAccessToken(WORKDAY_CONFIG.refreshToken);
        } catch (fallbackError) {
          throw new Error('Access token expired and refresh failed. Please update WORKDAY_REFRESH_TOKEN with a valid refresh token.');
        }
      } else {
        throw new Error('Access token expired and refresh failed. Please update WORKDAY_REFRESH_TOKEN with a valid refresh token.');
      }
    }
  }
  
  return tokens.access_token;
}

// Set up all MCP handlers (using shared tools definition)
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: ALL_TOOLS,
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  try {
    switch (name) {

      case 'check_workday_auth_status':
        const currentTokens = loadTokens();
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              authenticated: !!currentTokens,
              tokenExpired: currentTokens ? isTokenExpired(currentTokens) : null,
              expiresAt: currentTokens ? new Date(currentTokens.expires_at).toISOString() : null,
              hasRefreshToken: !!WORKDAY_CONFIG.refreshToken,
              configuration: {
                hasClientId: !!WORKDAY_CONFIG.clientId,
                hasClientSecret: !!WORKDAY_CONFIG.clientSecret,
                tenant: WORKDAY_CONFIG.tenant,
                baseUrl: WORKDAY_CONFIG.baseUrl
              }
            }, null, 2)
          }],
        };

      case 'get_workday_worker':
        if (!args || !args.workerId) {
          throw new Error('Missing required parameter: workerId');
        }
        const workerInfo = await getWorkerInfo(args.workerId as string);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(workerInfo, null, 2)
          }],
        };

      case 'list_workday_workers':
        const limit = args?.limit ? Number(args.limit) : 10;
        const workers = await listWorkers(limit);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(workers, null, 2)
          }],
        };

      case 'search_workday_workers':
        if (!args || !args.searchTerm) {
          throw new Error('Missing required parameter: searchTerm');
        }
        const searchResults = await searchWorkers(args.searchTerm as string);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(searchResults, null, 2)
          }],
        };

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          error: error instanceof Error ? error.message : 'Unknown error',
          tool: name,
          timestamp: new Date().toISOString()
        }, null, 2)
      }],
    };
  }
});

// Refresh token function - simplified for direct refresh token usage

async function refreshAccessToken(refreshToken: string): Promise<TokenData> {
  // Create Basic Auth header with Client ID as username and Client Secret as password
  const credentials = `${WORKDAY_CONFIG.clientId}:${WORKDAY_CONFIG.clientSecret}`;
  const encodedCredentials = Buffer.from(credentials).toString('base64');
  
  const postData = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken
  });

  return new Promise((resolve, reject) => {
    const options = {
      hostname: new URL(WORKDAY_CONFIG.tokenEndpoint).hostname,
      port: 443,
      path: new URL(WORKDAY_CONFIG.tokenEndpoint).pathname,
      method: 'POST',
      headers: {
        'Authorization': `Basic ${encodedCredentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData.toString())
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (res.statusCode === 200) {
            const tokens: TokenData = {
              access_token: response.access_token,
              refresh_token: response.refresh_token || refreshToken,
              expires_at: Date.now() + (response.expires_in * 1000),
              scope: response.scope
            };
            saveTokens(tokens);
            resolve(tokens);
          } else {
            reject(new Error(`Token refresh failed (${res.statusCode}): ${response.error_description || data}`));
          }
        } catch (error) {
          reject(new Error(`Failed to parse refresh response: ${error instanceof Error ? error.message : 'Unknown error'}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Token refresh request error: ${error.message}`));
    });

    req.write(postData.toString());
    req.end();
  });
}

// Worker API functions (simplified versions)
async function getWorkerInfo(workerId: string): Promise<any> {
  const accessToken = await getValidAccessToken();
  const apiPath = `/ccx/api/staffing/v7/${WORKDAY_CONFIG.tenant}/workers/${workerId}`;
  const url = `${WORKDAY_CONFIG.baseUrl}${apiPath}`;

  return new Promise((resolve, reject) => {
    const options = {
      hostname: new URL(url).hostname,
      port: 443,
      path: new URL(url).pathname + new URL(url).search,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (res.statusCode === 200) {
            resolve(response);
          } else {
            reject(new Error(`API request failed (${res.statusCode}): ${data}`));
          }
        } catch (error) {
          reject(new Error(`Failed to parse API response: ${error instanceof Error ? error.message : 'Unknown error'}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`API request error: ${error.message}`));
    });

    req.end();
  });
}

async function listWorkers(limit: number = 10): Promise<any> {
  const accessToken = await getValidAccessToken();
  const apiPath = `/ccx/api/staffing/v7/${WORKDAY_CONFIG.tenant}/workers?limit=${limit}`;
  const url = `${WORKDAY_CONFIG.baseUrl}${apiPath}`;

  return new Promise((resolve, reject) => {
    const options = {
      hostname: new URL(url).hostname,
      port: 443,
      path: new URL(url).pathname + new URL(url).search,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (res.statusCode === 200) {
            resolve(response);
          } else {
            reject(new Error(`API request failed (${res.statusCode}): ${data}`));
          }
        } catch (error) {
          reject(new Error(`Failed to parse API response: ${error instanceof Error ? error.message : 'Unknown error'}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`API request error: ${error.message}`));
    });

    req.end();
  });
}

async function searchWorkers(searchTerm: string): Promise<any> {
  const accessToken = await getValidAccessToken();
  const apiPath = `/ccx/api/staffing/v7/${WORKDAY_CONFIG.tenant}/workers?search=${encodeURIComponent(searchTerm)}`;
  const url = `${WORKDAY_CONFIG.baseUrl}${apiPath}`;

  return new Promise((resolve, reject) => {
    const options = {
      hostname: new URL(url).hostname,
      port: 443,
      path: new URL(url).pathname + new URL(url).search,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (res.statusCode === 200) {
            resolve(response);
          } else {
            reject(new Error(`API request failed (${res.statusCode}): ${data}`));
          }
        } catch (error) {
          reject(new Error(`Failed to parse API response: ${error instanceof Error ? error.message : 'Unknown error'}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`API request error: ${error.message}`));
    });

    req.end();
  });
}

// Express app setup
const app = express();
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    service: 'mcp-workday-server'
  });
});

// Flowise-specific MCP tools endpoint
app.get('/flowise/tools', (req: Request, res: Response) => {
  res.json({
    actions: ALL_TOOLS.map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema,
      type: "function"
    }))
  });
});

// Alternative Flowise format
app.get('/flowise/actions', (req: Request, res: Response) => {
  res.json(ALL_TOOLS.map(tool => ({
    name: tool.name,
    description: tool.description,
    schema: tool.inputSchema,
    function: tool.name
  })));
});

// OpenAI-style functions format (another Flowise possibility)
app.get('/functions', (req: Request, res: Response) => {
  res.json({
    functions: ALL_TOOLS.map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema
    }))
  });
});

// Flowise MCP Server format (exact format from search results)
app.get('/mcp', (req: Request, res: Response) => {
  res.json({
    mcpServers: {
      "workday-mcp-server": {
        command: "mcp-proxy",
        args: ["https://mcp-workday-server.onrender.com/mcp/sse"],
        env: {},
        tools: ALL_TOOLS.map(tool => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema
        }))
      }
    }
  });
});

// Simple tools list for Flowise (minimal format)
app.get('/tools', (req: Request, res: Response) => {
  res.json(ALL_TOOLS.map(tool => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema
  })));
});

// Flowise custom tools format (may be what Flowise expects for URL parameter)
app.get('/custom-tools', (req: Request, res: Response) => {
  res.json({
    tools: ALL_TOOLS,
    server: {
      name: "workday-mcp-server",
      version: "1.0.0",
      description: "Workday MCP Server with comprehensive API tools"
    },
    capabilities: {
      tools: true,
      resources: false,
      prompts: false
    }
  });
});

// Debug endpoint to understand what Flowise is sending
app.all('/debug', (req: Request, res: Response) => {
  console.log('Debug request received:');
  console.log('Method:', req.method);
  console.log('Headers:', req.headers);
  console.log('Body:', req.body);
  console.log('Query:', req.query);
  
  res.json({
    method: req.method,
    headers: req.headers,
    body: req.body,
    query: req.query,
    message: "This is a debug endpoint to understand Flowise requests",
    availableEndpoints: [
      '/mcp/tools',
      '/flowise/tools', 
      '/tools',
      '/custom-tools',
      '/functions',
      '/mcp',
      '/debug'
    ]
  });
});

// MCP capability endpoint for spec compliance
app.get('/mcp/capabilities', (req: Request, res: Response) => {
  res.json({
    protocolVersion: "2024-11-05",
    capabilities: {
      tools: {},
      prompts: {},
      resources: {},
      logging: {}
    },
    serverInfo: {
      name: "mcp-workday-server",
      version: "1.0.0"
    },
    endpoints: {
      tools: "/mcp/tools",
      sse: "/mcp/sse",
      execute: "/mcp/tools/{toolName}"
    }
  });
});

// Quick SSE endpoint that closes immediately after sending tools
app.get('/mcp/sse-quick', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  // Send tools and close immediately
  res.write('event: tools\n');
  res.write('data: ' + JSON.stringify({ tools: ALL_TOOLS }) + '\n\n');
  res.end();
});

// MCP tools endpoint
app.get('/mcp/tools', async (req: Request, res: Response) => {
  try {
    res.json({ tools: ALL_TOOLS });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// MCP-compliant SSE endpoint (simplified for better compatibility)
app.get('/mcp/sse', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');
  
  // Send server capabilities first
  res.write('data: ' + JSON.stringify({
    jsonrpc: "2.0",
    method: "initialize",
    result: {
      protocolVersion: "2024-11-05",
      capabilities: {
        tools: {}
      },
      serverInfo: {
        name: "mcp-workday-server",
        version: "1.0.0"
      }
    }
  }) + '\n\n');
  
  // Send tools list  
  res.write('data: ' + JSON.stringify({
    jsonrpc: "2.0",
    method: "tools/list",
    result: {
      tools: ALL_TOOLS
    }
  }) + '\n\n');
  
  // Close immediately for one-shot clients (which most MCP clients expect)
  const closeParam = req.query.close;
  if (closeParam === 'true' || closeParam === '1') {
    res.end();
    return;
  }
  
  // For persistent connections, close after sending initial data
  // Most MCP clients expect the server to close after providing tools
  setTimeout(() => {
    res.end();
  }, 1000);
});

// MCP tool execution endpoint
app.post('/mcp/tools/:toolName', async (req: Request, res: Response) => {
  try {
    const { toolName } = req.params;
    const { arguments: args } = req.body;
    
    let result;
    
    switch (toolName) {

      case 'check_workday_auth_status':
        const currentTokens = loadTokens();
        result = {
          authenticated: !!currentTokens,
          tokenExpired: currentTokens ? isTokenExpired(currentTokens) : null,
          expiresAt: currentTokens ? new Date(currentTokens.expires_at).toISOString() : null,
          hasRefreshToken: !!WORKDAY_CONFIG.refreshToken,
          configuration: {
            hasClientId: !!WORKDAY_CONFIG.clientId,
            hasClientSecret: !!WORKDAY_CONFIG.clientSecret,
            tenant: WORKDAY_CONFIG.tenant,
            baseUrl: WORKDAY_CONFIG.baseUrl
          }
        };
        break;

      case 'get_workday_worker':
        if (!args || !args.workerId) {
          throw new Error('Missing required parameter: workerId');
        }
        result = await getWorkerInfo(args.workerId as string);
        break;

      case 'list_workday_workers':
        const limit = args?.limit ? Number(args.limit) : 10;
        result = await listWorkers(limit);
        break;

      case 'search_workday_workers':
        if (!args || !args.searchTerm) {
          throw new Error('Missing required parameter: searchTerm');
        }
        result = await searchWorkers(args.searchTerm as string);
        break;

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Start server
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 MCP Workday Server running on port ${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/health`);
  console.log(`🔧 MCP tools: http://localhost:${PORT}/mcp/tools`);
  console.log(`🎯 Environment: ${process.env.NODE_ENV || 'development'}`);
}); 
#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import express from 'express';
import cors from 'cors';
import https from 'https';
import * as staffingApi from './staffing-api.js';
// SOAP API removed - using REST API only
import * as learningApi from './learning-api.js';

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

// Workday API configuration - Access Token Only
const WORKDAY_CONFIG = {
  baseUrl: process.env.WORKDAY_BASE_URL || 'https://your-tenant.workday.com',
  tenant: process.env.WORKDAY_TENANT || 'your-tenant',
};

// No token storage needed - using direct access token from environment

// Simplified access token function - uses WORKDAY_ACCESS_TOKEN environment variable
async function getValidAccessToken(): Promise<string> {
  const accessToken = process.env.WORKDAY_ACCESS_TOKEN;
  
  if (!accessToken) {
    throw new Error('No access token configured. Please set WORKDAY_ACCESS_TOKEN in your environment variables.');
  }
  
  console.log('✅ Using WORKDAY_ACCESS_TOKEN environment variable');
  return accessToken;
}

// Set up all MCP handlers (copied from main index.ts)
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      // Auth tools
      {
        name: 'check_workday_auth_status',
        description: 'Check current Workday authentication status',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      // Workday API tools
      {
        name: 'get_workday_worker',
        description: 'Get Workday worker information by employee ID',
        inputSchema: {
          type: 'object',
          properties: {
            workerId: { type: 'string', description: 'Employee ID or Worker ID' },
          },
          required: ['workerId'],
        },
      },
      {
        name: 'list_workday_workers',
        description: 'List Workday workers with optional limit',
        inputSchema: {
          type: 'object',
          properties: {
            limit: { type: 'number', description: 'Maximum number of workers to return (default: 10)' },
          },
        },
      },
      {
        name: 'search_workday_workers',
        description: 'Search Workday workers by name or other criteria',
        inputSchema: {
          type: 'object',
          properties: {
            searchTerm: { type: 'string', description: 'Search term (name, email, etc.)' },
          },
          required: ['searchTerm'],
        },
      },
      // Add more tools as needed from the original index.ts
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  try {
    switch (name) {

      case 'check_workday_auth_status':
        const hasAccessToken = !!process.env.WORKDAY_ACCESS_TOKEN;
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              authentication_status: hasAccessToken ? 'authenticated' : 'not_authenticated',
              token_type: 'access_token',
              token_source: 'WORKDAY_ACCESS_TOKEN environment variable',
              environment_variables: {
                workday_access_token: process.env.WORKDAY_ACCESS_TOKEN ? '✅ Set' : '❌ Not set',
                workday_base_url: process.env.WORKDAY_BASE_URL ? '✅ Set' : '❌ Not set',
                workday_tenant: process.env.WORKDAY_TENANT ? '✅ Set' : '❌ Not set'
              },
              configuration: {
                tenant: WORKDAY_CONFIG.tenant,
                baseUrl: WORKDAY_CONFIG.baseUrl
              },
              timestamp: new Date().toISOString()
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

// Refresh token logic removed - using direct access token only

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
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    service: 'mcp-workday-server'
  });
});

// MCP tools endpoint
app.get('/mcp/tools', async (req, res) => {
  try {
    const tools = [

      {
        name: 'check_workday_auth_status',
        description: 'Check current Workday authentication status',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'get_workday_worker',
        description: 'Get Workday worker information by employee ID',
        inputSchema: {
          type: 'object',
          properties: {
            workerId: { type: 'string', description: 'Employee ID or Worker ID' },
          },
          required: ['workerId'],
        },
      },
      {
        name: 'list_workday_workers',
        description: 'List Workday workers with optional limit',
        inputSchema: {
          type: 'object',
          properties: {
            limit: { type: 'number', description: 'Maximum number of workers to return (default: 10)' },
          },
        },
      },
      {
        name: 'search_workday_workers',
        description: 'Search Workday workers by name or other criteria',
        inputSchema: {
          type: 'object',
          properties: {
            searchTerm: { type: 'string', description: 'Search term (name, email, etc.)' },
          },
          required: ['searchTerm'],
        },
      },
    ];
    res.json({ tools });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// MCP tool execution endpoint
app.post('/mcp/tools/:toolName', async (req, res) => {
  try {
    const { toolName } = req.params;
    const { arguments: args } = req.body;
    
    let result;
    
    switch (toolName) {

      case 'check_workday_auth_status':
        const hasAccessToken = !!process.env.WORKDAY_ACCESS_TOKEN;
        result = {
          authentication_status: hasAccessToken ? 'authenticated' : 'not_authenticated',
          token_type: 'access_token',
          token_source: 'WORKDAY_ACCESS_TOKEN environment variable',
          environment_variables: {
            workday_access_token: process.env.WORKDAY_ACCESS_TOKEN ? '✅ Set' : '❌ Not set',
            workday_base_url: process.env.WORKDAY_BASE_URL ? '✅ Set' : '❌ Not set',
            workday_tenant: process.env.WORKDAY_TENANT ? '✅ Set' : '❌ Not set'
          },
          configuration: {
            tenant: WORKDAY_CONFIG.tenant,
            baseUrl: WORKDAY_CONFIG.baseUrl
          },
          timestamp: new Date().toISOString()
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
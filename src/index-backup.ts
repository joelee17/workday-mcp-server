#!/usr/bin/env node

// Load environment variables from workday.env file
import { config } from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Completely suppress dotenv output to avoid interfering with MCP protocol
const originalStdout = process.stdout.write.bind(process.stdout);
const originalStderr = process.stderr.write.bind(process.stderr);
process.stdout.write = () => true;
process.stderr.write = () => true;
// Also suppress console.log temporarily
const originalConsoleLog = console.log;
console.log = () => {};
config({ path: join(projectRoot, 'workday.env'), debug: false });
console.log = originalConsoleLog;
process.stdout.write = originalStdout;
process.stderr.write = originalStderr;

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import https from 'https';

import fs from 'fs';
import path from 'path';
import * as staffingApi from './staffing-api.js';
// SOAP API removed - using REST API only
import * as learningApi from './learning-api.js';

// Create server instance
const server = new Server(
  {
    name: 'mcp-server',
    version: '1.0.0',
  }
);

// Workday OAuth configuration - Refresh Token Authentication Only
const WORKDAY_CONFIG = {
  clientId: process.env.WORKDAY_CLIENT_ID || '',
  clientSecret: process.env.WORKDAY_CLIENT_SECRET || '',
  tokenEndpoint: process.env.WORKDAY_TOKEN_ENDPOINT || '',
  baseUrl: process.env.WORKDAY_BASE_URL || 'https://your-tenant.workday.com',
  tenant: process.env.WORKDAY_TENANT || 'your-tenant',
  // Non-expiring refresh token for direct access token generation
  refreshToken: process.env.WORKDAY_REFRESH_TOKEN || '',
};

// Debug logging for tokens (first 20 and last 20 characters for security)
console.error(`[MCP Server] Auth configuration loaded:`);
console.error(`[MCP Server] - Client ID: ${WORKDAY_CONFIG.clientId ? `${WORKDAY_CONFIG.clientId.substring(0, 20)}...${WORKDAY_CONFIG.clientId.substring(WORKDAY_CONFIG.clientId.length - 20)}` : 'Not configured'}`);
console.error(`[MCP Server] - Client Secret: ${WORKDAY_CONFIG.clientSecret ? `${WORKDAY_CONFIG.clientSecret.substring(0, 20)}...${WORKDAY_CONFIG.clientSecret.substring(WORKDAY_CONFIG.clientSecret.length - 20)}` : 'Not configured'}`);
console.error(`[MCP Server] - Token Endpoint: ${WORKDAY_CONFIG.tokenEndpoint || 'Not configured'}`);
console.error(`[MCP Server] - Base URL: ${WORKDAY_CONFIG.baseUrl || 'Not configured'}`);
console.error(`[MCP Server] - Tenant: ${WORKDAY_CONFIG.tenant || 'Not configured'}`);
console.error(`[MCP Server] - Refresh Token: ${WORKDAY_CONFIG.refreshToken ? `${WORKDAY_CONFIG.refreshToken.substring(0, 20)}...${WORKDAY_CONFIG.refreshToken.substring(WORKDAY_CONFIG.refreshToken.length - 20)}` : 'Not configured'}`);

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

// OAuth helper functions (temporarily restored)
// OAuth authorization functions removed - using refresh token authentication only

// Test if a token is valid by making a simple API call
async function testTokenValidity(token: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Simple API call to test token validity - get tenant info
    const apiPath = `/ccx/api/staffing/v7/${WORKDAY_CONFIG.tenant}/workers?limit=1`;
    const url = `${WORKDAY_CONFIG.baseUrl}${apiPath}`;
    
    const options = {
      hostname: new URL(url).hostname,
      port: 443,
      path: new URL(url).pathname + new URL(url).search,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve();
        } else {
          reject(new Error(`Token validation failed (${res.statusCode}): ${data}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Token validation request error: ${error.message}`));
    });

    req.end();
  });
}

// Enhanced refresh token function - exchanges refresh token for access token using POST with Basic Auth
async function refreshAccessToken(refreshToken: string): Promise<TokenData> {
  console.error('[MCP Server] Exchanging refresh token for access token...');
  console.error(`[MCP Server] Token endpoint: ${WORKDAY_CONFIG.tokenEndpoint}`);
  console.error(`[MCP Server] Client ID: ${WORKDAY_CONFIG.clientId}`);
  console.error(`[MCP Server] Refresh token: ${refreshToken.substring(0, 20)}...${refreshToken.substring(refreshToken.length - 10)}`);
  
  // Create Basic Auth header with Client ID as username and Client Secret as password
  const credentials = `${WORKDAY_CONFIG.clientId}:${WORKDAY_CONFIG.clientSecret}`;
  const encodedCredentials = Buffer.from(credentials).toString('base64');
  
  // Create form URL encoded POST body with refresh_token grant type (no client credentials in body)
  const postData = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken  // Using refresh token from workday.env file
  });
  
  console.error('[MCP Server] Using Basic Authentication:');
  console.error(`[MCP Server] Username (Client ID): ${WORKDAY_CONFIG.clientId}`);
  console.error(`[MCP Server] Password (Client Secret): ${WORKDAY_CONFIG.clientSecret.substring(0, 10)}...`);
  console.error(`[MCP Server] Authorization header: Basic ${encodedCredentials.substring(0, 20)}...`);
  console.error('[MCP Server] POST body (form URL encoded):');
  console.error(`[MCP Server] grant_type=refresh_token`);
  console.error(`[MCP Server] refresh_token=${refreshToken.substring(0, 20)}...${refreshToken.substring(refreshToken.length - 10)}`);

  return new Promise((resolve, reject) => {
    const options = {
      hostname: new URL(WORKDAY_CONFIG.tokenEndpoint).hostname,
      port: 443,
      path: new URL(WORKDAY_CONFIG.tokenEndpoint).pathname,
      method: 'POST',  // Using POST method as required
      headers: {
        'Authorization': `Basic ${encodedCredentials}`,  // Basic Auth with Client ID/Secret
        'Content-Type': 'application/x-www-form-urlencoded',  // Form URL encoded body
        'Content-Length': Buffer.byteLength(postData.toString()),
        'Accept': 'application/json',
        'User-Agent': 'Workday-MCP-Server/1.0'
      }
    };

    console.error(`[MCP Server] Making POST request to: https://${options.hostname}${options.path}`);
    console.error(`[MCP Server] Authorization: Basic Authentication`);
    console.error(`[MCP Server] Content-Type: application/x-www-form-urlencoded`);
    console.error(`[MCP Server] Content-Length: ${Buffer.byteLength(postData.toString())} bytes`);

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        console.error(`[MCP Server] Token response status: ${res.statusCode}`);
        console.error(`[MCP Server] Token response headers:`, JSON.stringify(res.headers, null, 2));
        console.error(`[MCP Server] Token response body: ${data.substring(0, 500)}${data.length > 500 ? '...' : ''}`);
        
        try {
          const response = JSON.parse(data);
          if (res.statusCode === 200) {
            if (!response.access_token) {
              reject(new Error(`No access_token in response: ${JSON.stringify(response)}`));
              return;
            }
            
            const expiresIn = response.expires_in || 3600; // Default to 1 hour if not provided
            const tokens: TokenData = {
              access_token: response.access_token,
              refresh_token: response.refresh_token || refreshToken, // Keep original if not provided
              expires_at: Date.now() + (expiresIn * 1000),
              scope: response.scope || 'workday_api'
            };
            
            console.error(`[MCP Server] Token exchange successful! Access token expires in ${expiresIn} seconds`);
            saveTokens(tokens);
            resolve(tokens);
          } else {
            const errorMsg = response.error_description || response.error || data;
            reject(new Error(`Token refresh failed (${res.statusCode}): ${errorMsg}`));
          }
        } catch (error) {
          reject(new Error(`Failed to parse token response as JSON: ${error instanceof Error ? error.message : 'Unknown error'}. Response: ${data}`));
        }
      });
    });

    req.on('error', (error) => {
      console.error(`[MCP Server] Token request network error:`, error);
      reject(new Error(`Token refresh network error: ${error.message}`));
    });

    req.write(postData.toString());
    req.end();
  });
}

// Robust access token function - always uses refresh token from workday.env
async function getValidAccessToken(): Promise<string> {
  if (!WORKDAY_CONFIG.refreshToken) {
    throw new Error('No refresh token configured. Please set WORKDAY_REFRESH_TOKEN in your environment variables.');
  }

  console.error('[MCP Server] Getting valid access token using refresh token from workday.env...');
  
  // Load any existing cached tokens
  let tokens = loadTokens();
  
  // Check if we have a valid cached access token
  if (tokens && !isTokenExpired(tokens)) {
    console.error('[MCP Server] Using valid cached access token (expires in ' + 
      Math.round((tokens.expires_at - Date.now()) / 1000 / 60) + ' minutes)');
    return tokens.access_token;
  }
  
  // Need to get a fresh access token using the refresh token from .env
  console.error('[MCP Server] Cached token expired or missing, requesting fresh access token...');
  
  try {
    // Exchange refresh token for access token
    const freshTokens = await refreshAccessToken(WORKDAY_CONFIG.refreshToken);
    console.error('[MCP Server] Successfully obtained fresh access token from Workday OAuth endpoint');
    console.error('[MCP Server] New access token expires in ' + 
      Math.round((freshTokens.expires_at - Date.now()) / 1000 / 60) + ' minutes');
    
    return freshTokens.access_token;
  } catch (refreshError) {
    console.error(`[MCP Server] Failed to refresh access token: ${refreshError instanceof Error ? refreshError.message : 'Unknown error'}`);
    
    // If refresh fails, try using the refresh token directly as access token
    // (some Workday setups provide long-lived access tokens instead of refresh tokens)
    console.error('[MCP Server] Attempting to use refresh token directly as access token...');
    
    try {
      // Test if the refresh token can be used directly as an access token
      await testTokenValidity(WORKDAY_CONFIG.refreshToken);
      console.error('[MCP Server] Refresh token works as access token - caching for reuse');
      
      // Cache it as a valid access token
      const directTokenData: TokenData = {
        access_token: WORKDAY_CONFIG.refreshToken,
        refresh_token: WORKDAY_CONFIG.refreshToken,
        expires_at: Date.now() + (12 * 60 * 60 * 1000), // Cache for 12 hours
        scope: 'workday_api'
      };
      saveTokens(directTokenData);
      
      return WORKDAY_CONFIG.refreshToken;
    } catch (directError) {
      console.error(`[MCP Server] Refresh token also invalid as direct access token: ${directError instanceof Error ? directError.message : 'Unknown error'}`);
      
      // Final fallback - throw detailed error
      throw new Error(`Authentication failed: Cannot get valid access token. ` +
        `Refresh token exchange error: ${refreshError instanceof Error ? refreshError.message : 'Unknown'}. ` +
        `Direct token test error: ${directError instanceof Error ? directError.message : 'Unknown'}. ` +
        `Please check your WORKDAY_REFRESH_TOKEN in workday.env file.`);
    }
  }
}

// Workday API function
async function getWorkerInfo(workerId: string): Promise<any> {
  const accessToken = await getValidAccessToken();

  return new Promise((resolve, reject) => {
    // Workday REST API endpoint for worker information using staffing API v7
    const apiPath = `/ccx/api/staffing/v7/${WORKDAY_CONFIG.tenant}/workers/${workerId}`;
    const url = `${WORKDAY_CONFIG.baseUrl}${apiPath}`;
    
    const options = {
      hostname: new URL(url).hostname,
      port: 443,
      path: new URL(url).pathname,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
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
            reject(new Error(`Workday API error (${res.statusCode}): ${response.error || data}`));
          }
        } catch (error) {
          reject(new Error(`Failed to parse Workday response: ${error instanceof Error ? error.message : 'Unknown error'}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Workday API request error: ${error.message}`));
    });

    req.end();
  });
}

// List all workers
async function listWorkers(limit: number = 10): Promise<any> {
  const accessToken = await getValidAccessToken();

  return new Promise((resolve, reject) => {
    // Workday REST API endpoint for listing workers using staffing API v7
    const apiPath = `/ccx/api/staffing/v7/${WORKDAY_CONFIG.tenant}/workers`;
    const url = `${WORKDAY_CONFIG.baseUrl}${apiPath}?limit=${limit}`;
    
    const options = {
      hostname: new URL(url).hostname,
      port: 443,
      path: new URL(url).pathname + new URL(url).search,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
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
            reject(new Error(`Workday API error (${res.statusCode}): ${response.error || data}`));
          }
        } catch (error) {
          reject(new Error(`Failed to parse Workday response: ${error instanceof Error ? error.message : 'Unknown error'}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Workday API request error: ${error.message}`));
    });

    req.end();
  });
}

// Search for workers by name
async function searchWorkers(searchTerm: string): Promise<any> {
  const accessToken = await getValidAccessToken();

  return new Promise((resolve, reject) => {
    // Use the correct v7 API endpoint with search parameter
    const apiPath = `/ccx/api/staffing/v7/${WORKDAY_CONFIG.tenant}/workers`;
    const url = `${WORKDAY_CONFIG.baseUrl}${apiPath}?search=${encodeURIComponent(searchTerm)}`;
    
    const options = {
      hostname: new URL(url).hostname,
      port: 443,
      path: new URL(url).pathname + new URL(url).search,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
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
            reject(new Error(`Workday API error (${res.statusCode}): ${response.error || data}`));
          }
        } catch (error) {
          reject(new Error(`Failed to parse Workday response: ${error instanceof Error ? error.message : 'Unknown error'}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Workday API request error: ${error.message}`));
    });

    req.end();
  });
}

// Create one-time payroll input
async function createOneTimePayment(paymentData: {
  workerId: string;
  payComponentId: string;
  startDate: string;
  endDate: string;
  amount: number;
  positionId?: string;
  currency?: string;
  comment?: string;
  runCategories?: string[];
  worktags?: string[];
}): Promise<any> {
  const accessToken = await getValidAccessToken();

  return new Promise((resolve, reject) => {
    // Workday Payroll API endpoint for creating payroll inputs
    const apiPath = `/ccx/api/payroll/v2/${WORKDAY_CONFIG.tenant}/payrollInputs`;
    const url = `${WORKDAY_CONFIG.baseUrl}${apiPath}`;
    
    // Build the request payload according to the swagger definition
    const payload: any = {
      worker: {
        id: paymentData.workerId
      },
      payComponent: {
        id: paymentData.payComponentId
      },
      startDate: paymentData.startDate,
      endDate: paymentData.endDate,
      ongoing: false, // Always false for one-time payments
      inputDetails: [
        {
          type: {
            id: "AMOUNT" // Standard input type for amount
          },
          value: paymentData.amount
        }
      ]
    };

    // Add optional fields if provided
    if (paymentData.positionId) {
      payload.position = {
        id: paymentData.positionId
      };
    }

    if (paymentData.currency) {
      payload.currency = {
        id: paymentData.currency
      };
    }

    if (paymentData.comment) {
      payload.comment = paymentData.comment;
    }

    if (paymentData.runCategories && paymentData.runCategories.length > 0) {
      payload.runCategories = paymentData.runCategories.map(rc => ({ id: rc }));
    }

    if (paymentData.worktags && paymentData.worktags.length > 0) {
      payload.worktags = paymentData.worktags.map(wt => ({ id: wt }));
    }

    const postData = JSON.stringify(payload);
    
    const options = {
      hostname: new URL(url).hostname,
      port: 443,
      path: new URL(url).pathname,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
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
          if (res.statusCode === 201) {
            resolve(response);
          } else {
            reject(new Error(`Workday API error (${res.statusCode}): ${response.error || data}`));
          }
        } catch (error) {
          reject(new Error(`Failed to parse Workday response: ${error instanceof Error ? error.message : 'Unknown error'}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Workday API request error: ${error.message}`));
    });

    req.write(postData);
    req.end();
  });
}

// Sample data for demonstration
const sampleData = {
  users: [
    { id: 1, name: 'Alice', email: 'alice@example.com' },
    { id: 2, name: 'Bob', email: 'bob@example.com' },
    { id: 3, name: 'Charlie', email: 'charlie@example.com' },
  ],
  projects: [
    { id: 1, name: 'Project A', status: 'active', owner: 'Alice' },
    { id: 2, name: 'Project B', status: 'completed', owner: 'Bob' },
    { id: 3, name: 'Project C', status: 'planning', owner: 'Charlie' },
  ],
};

// Weather API function
async function getWeatherForCity(city: string) {
  try {
    // Using wttr.in free weather API
    const data = await new Promise((resolve, reject) => {
      const url = `https://wttr.in/${encodeURIComponent(city)}?format=j1`;
      const options = {
        headers: {
          'User-Agent': 'curl/7.68.0'
        },
        rejectUnauthorized: false
      };
      https.get(url, options, (response) => {
        let data = '';
        
        response.on('data', (chunk) => {
          data += chunk;
        });
        
        response.on('end', () => {
          try {
            const parsedData = JSON.parse(data);
            resolve(parsedData);
          } catch (error) {
            reject(new Error(`Failed to parse weather data: ${error instanceof Error ? error.message : 'Unknown error'}`));
          }
        });
      }).on('error', (error) => {
        reject(new Error(`Network error: ${error.message}`));
      });
    }) as any;
    
    // Extract relevant weather information
    const current = data.current_condition[0];
    const location = data.nearest_area[0];
    
    return {
      location: {
        city: location.areaName[0].value,
        country: location.country[0].value,
        region: location.region[0].value,
      },
      current: {
        temperature_celsius: current.temp_C,
        temperature_fahrenheit: current.temp_F,
        feels_like_celsius: current.FeelsLikeC,
        feels_like_fahrenheit: current.FeelsLikeF,
        humidity: current.humidity,
        description: current.weatherDesc[0].value,
        wind_speed_kmh: current.windspeedKmph,
        wind_speed_mph: current.windspeedMiles,
        wind_direction: current.winddirDegree,
        pressure: current.pressure,
        visibility: current.visibility,
        uv_index: current.uvIndex,
      },
      forecast: data.weather.slice(0, 3).map((day: any) => ({
        date: day.date,
        max_temp_celsius: day.maxtempC,
        min_temp_celsius: day.mintempC,
        max_temp_fahrenheit: day.maxtempF,
        min_temp_fahrenheit: day.mintempF,
        description: day.hourly[0].weatherDesc[0].value,
      })),
    };
  } catch (error) {
    throw new Error(`Failed to get weather for ${city}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'get_user',
        description: 'Get user information by ID',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'number',
              description: 'User ID',
            },
          },
          required: ['id'],
        },
      },
      {
        name: 'list_users',
        description: 'List all users',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'get_project',
        description: 'Get project information by ID',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'number',
              description: 'Project ID',
            },
          },
          required: ['id'],
        },
      },
      {
        name: 'list_projects',
        description: 'List all projects',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'create_user',
        description: 'Create a new user',
        inputSchema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'User name',
            },
            email: {
              type: 'string',
              description: 'User email',
            },
          },
          required: ['name', 'email'],
        },
      },
      {
        name: 'get_weather',
        description: 'Get current weather and forecast for a specific city',
        inputSchema: {
          type: 'object',
          properties: {
            city: {
              type: 'string',
              description: 'City name (e.g., "New York", "London", "Tokyo")',
            },
          },
          required: ['city'],
        },
      },
      {
        name: 'get_workday_worker',
        description: 'Get worker information from Workday API using worker ID',
        inputSchema: {
          type: 'object',
          properties: {
            workerId: {
              type: 'string',
              description: 'Worker ID in Workday system (e.g., "21001", "EMP001")',
            },
          },
          required: ['workerId'],
        },
      },
      {
        name: 'search_workday_workers',
        description: 'Search for workers in Workday by name or other criteria',
        inputSchema: {
          type: 'object',
          properties: {
            searchTerm: {
              type: 'string',
              description: 'Search term (e.g., "Logan McNeil", "Smith", "Engineering")',
            },
          },
          required: ['searchTerm'],
        },
      },
      {
        name: 'list_workers',
        description: 'List all workers',
        inputSchema: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              description: 'Number of workers to list',
            },
          },
          required: ['limit'],
        },
      },
      {
        name: 'create_one_time_payment',
        description: 'Create a one-time payroll input/payment for a worker in Workday',
        inputSchema: {
          type: 'object',
          properties: {
            workerId: {
              type: 'string',
              description: 'Worker ID in Workday system (e.g., "21001", "EMP001")',
            },
            payComponentId: {
              type: 'string',
              description: 'Pay Component ID for the payment type (e.g., "BONUS", "OVERTIME")',
            },
            startDate: {
              type: 'string',
              description: 'Start date for the payment in YYYY-MM-DD format',
            },
            endDate: {
              type: 'string',
              description: 'End date for the payment in YYYY-MM-DD format',
            },
            amount: {
              type: 'number',
              description: 'Payment amount (e.g., 1000.00)',
            },
            positionId: {
              type: 'string',
              description: 'Position ID if required by the pay component (optional)',
            },
            currency: {
              type: 'string',
              description: 'Currency code (optional, defaults to pay group currency)',
            },
            comment: {
              type: 'string',
              description: 'Optional comment for the payment',
            },
            runCategories: {
              type: 'array',
              items: {
                type: 'string'
              },
              description: 'Run category IDs (optional)',
            },
            worktags: {
              type: 'array',
              items: {
                type: 'string'
              },
              description: 'Worktag IDs for cost allocation (optional)',
            },
          },
          required: ['workerId', 'payComponentId', 'startDate', 'endDate', 'amount'],
        },
      },
      {
        name: 'check_workday_auth_status',
        description: 'Check current authentication status',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      // Staffing API v7 Tools
      {
        name: 'initiate_job_change',
        description: 'Initiate a job change request for a worker',
        inputSchema: {
          type: 'object',
          properties: {
            workerId: {
              type: 'string',
              description: 'Worker ID to initiate job change for',
            },
            date: {
              type: 'string',
              description: 'Effective date for the job change (YYYY-MM-DD format). If not provided, defaults to today.',
            },
            reason: {
              type: 'string',
              description: 'Reason for the job change (e.g., "Promotion", "Transfer", "Reorganization"). If not provided, defaults to "General Job Change".',
            },
            jobChangeData: {
              type: 'object',
              description: 'Optional additional job change data (advanced users only)',
            },
          },
          required: ['workerId'],
        },
      },
      {
        name: 'get_job_change',
        description: 'Get job change information by ID',
        inputSchema: {
          type: 'object',
          properties: {
            jobChangeId: {
              type: 'string',
              description: 'Job change ID',
            },
          },
          required: ['jobChangeId'],
        },
      },
      {
        name: 'submit_job_change',
        description: 'Submit a job change request',
        inputSchema: {
          type: 'object',
          properties: {
            jobChangeId: {
              type: 'string',
              description: 'Job change ID to submit',
            },
          },
          required: ['jobChangeId'],
        },
      },
      {
        name: 'get_job_families',
        description: 'Get list of job families',
        inputSchema: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              description: 'Maximum number of results to return',
            },
            offset: {
              type: 'number',
              description: 'Number of results to skip',
            },
          },
        },
      },
      {
        name: 'get_job_family',
        description: 'Get job family information by ID',
        inputSchema: {
          type: 'object',
          properties: {
            jobFamilyId: {
              type: 'string',
              description: 'Job family ID',
            },
          },
          required: ['jobFamilyId'],
        },
      },
      {
        name: 'get_job_profiles',
        description: 'Get list of job profiles',
        inputSchema: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              description: 'Maximum number of results to return',
            },
            offset: {
              type: 'number',
              description: 'Number of results to skip',
            },
          },
        },
      },
      {
        name: 'get_job_profile',
        description: 'Get job profile information by ID',
        inputSchema: {
          type: 'object',
          properties: {
            jobProfileId: {
              type: 'string',
              description: 'Job profile ID',
            },
          },
          required: ['jobProfileId'],
        },
      },
      {
        name: 'create_job_profile',
        description: 'Create a new job profile',
        inputSchema: {
          type: 'object',
          properties: {
            jobProfileData: {
              type: 'object',
              description: 'Job profile data',
            },
          },
          required: ['jobProfileData'],
        },
      },
      {
        name: 'get_jobs',
        description: 'Get list of jobs',
        inputSchema: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              description: 'Maximum number of results to return',
            },
            offset: {
              type: 'number',
              description: 'Number of results to skip',
            },
          },
        },
      },
      {
        name: 'get_job',
        description: 'Get job information by ID',
        inputSchema: {
          type: 'object',
          properties: {
            jobId: {
              type: 'string',
              description: 'Job ID',
            },
          },
          required: ['jobId'],
        },
      },
      {
        name: 'get_job_workspaces',
        description: 'Get workspaces for a job',
        inputSchema: {
          type: 'object',
          properties: {
            jobId: {
              type: 'string',
              description: 'Job ID',
            },
          },
          required: ['jobId'],
        },
      },
      {
        name: 'initiate_organization_assignment_change',
        description: 'Initiate an organization assignment change for a worker',
        inputSchema: {
          type: 'object',
          properties: {
            workerId: {
              type: 'string',
              description: 'Worker ID',
            },
            orgAssignmentData: {
              type: 'object',
              description: 'Optional organization assignment data',
            },
          },
          required: ['workerId'],
        },
      },
      {
        name: 'get_organization_assignment_change',
        description: 'Get organization assignment change by ID',
        inputSchema: {
          type: 'object',
          properties: {
            orgAssignmentId: {
              type: 'string',
              description: 'Organization assignment change ID',
            },
          },
          required: ['orgAssignmentId'],
        },
      },
      {
        name: 'submit_organization_assignment_change',
        description: 'Submit an organization assignment change',
        inputSchema: {
          type: 'object',
          properties: {
            orgAssignmentId: {
              type: 'string',
              description: 'Organization assignment change ID',
            },
          },
          required: ['orgAssignmentId'],
        },
      },
      {
        name: 'get_supervisory_organizations',
        description: 'Get list of supervisory organizations',
        inputSchema: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              description: 'Maximum number of results to return',
            },
            offset: {
              type: 'number',
              description: 'Number of results to skip',
            },
          },
        },
      },
      {
        name: 'get_supervisory_organization',
        description: 'Get supervisory organization by ID',
        inputSchema: {
          type: 'object',
          properties: {
            supervisoryOrgId: {
              type: 'string',
              description: 'Supervisory organization ID',
            },
          },
          required: ['supervisoryOrgId'],
        },
      },
      {
        name: 'get_staffing_workers',
        description: 'Get list of workers from staffing API (non-terminated workers)',
        inputSchema: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              description: 'Maximum number of results to return',
            },
            offset: {
              type: 'number',
              description: 'Number of results to skip',
            },
          },
        },
      },
      {
        name: 'get_staffing_worker',
        description: 'Get worker information from staffing API',
        inputSchema: {
          type: 'object',
          properties: {
            workerId: {
              type: 'string',
              description: 'Worker ID',
            },
          },
          required: ['workerId'],
        },
      },
      {
        name: 'search_staffing_workers',
        description: 'Search for workers in staffing API',
        inputSchema: {
          type: 'object',
          properties: {
            searchTerm: {
              type: 'string',
              description: 'Search term',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of results to return',
            },
          },
          required: ['searchTerm'],
        },
      },
      {
        name: 'get_worker_job_changes',
        description: 'Get job changes for a specific worker',
        inputSchema: {
          type: 'object',
          properties: {
            workerId: {
              type: 'string',
              description: 'Worker ID',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of results to return',
            },
            offset: {
              type: 'number',
              description: 'Number of results to skip',
            },
          },
          required: ['workerId'],
        },
      },
      {
        name: 'get_worker_organization_assignment_changes',
        description: 'Get organization assignment changes for a specific worker',
        inputSchema: {
          type: 'object',
          properties: {
            workerId: {
              type: 'string',
              description: 'Worker ID',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of results to return',
            },
            offset: {
              type: 'number',
              description: 'Number of results to skip',
            },
          },
          required: ['workerId'],
        },
      },
      {
        name: 'check_in_info',
        description: 'Get information about worker check-in functionality and limitations',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'get_worker_check_ins',
        description: 'Get worker check-ins for a specific worker (may require additional permissions)',
        inputSchema: {
          type: 'object',
          properties: {
            workerId: {
              type: 'string',
              description: 'Worker ID',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of results to return',
            },
            offset: {
              type: 'number',
              description: 'Number of results to skip',
            },
          },
          required: ['workerId'],
        },
      },
      {
        name: 'create_worker_check_in',
        description: 'Create a new worker check-in (may require additional permissions)',
        inputSchema: {
          type: 'object',
          properties: {
            workerId: {
              type: 'string',
              description: 'Worker ID',
            },
            checkInData: {
              type: 'object',
              description: 'Check-in data (e.g., {date: "2025-07-09", comment: "Daily check-in"})',
            },
          },
          required: ['workerId', 'checkInData'],
        },
      },
      {
        name: 'check_in_info',
        description: 'Get information about worker check-in functionality and limitations',
        inputSchema: {
          type: 'object',
          properties: {
            workerId: {
              type: 'string',
              description: 'Worker ID (Employee ID)',
            },
          },
          required: ['workerId'],
        },
      },


      // SOAP tools removed - using REST API only
      {
        name: 'get_compensation_soap',
        description: 'Get worker compensation information using SOAP API',
        inputSchema: {
          type: 'object',
          properties: {
            workerId: {
              type: 'string',
              description: 'Worker ID (Employee ID)',
            },
          },
          required: ['workerId'],
        },
      },
      {
        name: 'get_payroll_results_soap',
        description: 'Get payroll results for a worker using SOAP API',
        inputSchema: {
          type: 'object',
          properties: {
            workerId: {
              type: 'string',
              description: 'Worker ID (Employee ID)',
            },
            payPeriodStart: {
              type: 'string',
              description: 'Pay period start date (YYYY-MM-DD)',
            },
            payPeriodEnd: {
              type: 'string',
              description: 'Pay period end date (YYYY-MM-DD)',
            },
          },
          required: ['workerId', 'payPeriodStart', 'payPeriodEnd'],
        },
      },
      {
        name: 'get_time_entries_soap',
        description: 'Get time entries for a worker using SOAP API',
        inputSchema: {
          type: 'object',
          properties: {
            workerId: {
              type: 'string',
              description: 'Worker ID (Employee ID)',
            },
            startDate: {
              type: 'string',
              description: 'Start date (YYYY-MM-DD)',
            },
            endDate: {
              type: 'string',
              description: 'End date (YYYY-MM-DD)',
            },
          },
          required: ['workerId', 'startDate', 'endDate'],
        },
      },
      {
        name: 'get_absence_entries_soap',
        description: 'Get absence entries for a worker using SOAP API',
        inputSchema: {
          type: 'object',
          properties: {
            workerId: {
              type: 'string',
              description: 'Worker ID (Employee ID)',
            },
            startDate: {
              type: 'string',
              description: 'Start date (YYYY-MM-DD)',
            },
            endDate: {
              type: 'string',
              description: 'End date (YYYY-MM-DD)',
            },
          },
          required: ['workerId', 'startDate', 'endDate'],
        },
      },
      {
        name: 'get_benefits_soap',
        description: 'Get benefits information for a worker using SOAP API',
        inputSchema: {
          type: 'object',
          properties: {
            workerId: {
              type: 'string',
              description: 'Worker ID (Employee ID)',
            },
          },
          required: ['workerId'],
        },
      },
      {
        name: 'get_performance_reviews_soap',
        description: 'Get performance reviews for a worker using SOAP API',
        inputSchema: {
          type: 'object',
          properties: {
            workerId: {
              type: 'string',
              description: 'Worker ID (Employee ID)',
            },
          },
          required: ['workerId'],
        },
      },
      {
        name: 'get_learning_records_soap',
        description: 'Get learning records for a worker using SOAP API',
        inputSchema: {
          type: 'object',
          properties: {
            workerId: {
              type: 'string',
              description: 'Worker ID (Employee ID)',
            },
          },
          required: ['workerId'],
        },
      },
      {
        name: 'get_talent_profile_soap',
        description: 'Get talent profile for a worker using SOAP API',
        inputSchema: {
          type: 'object',
          properties: {
            workerId: {
              type: 'string',
              description: 'Worker ID (Employee ID)',
            },
          },
          required: ['workerId'],
        },
      },
      {
        name: 'submit_one_time_payment_soap',
        description: 'Submit a one-time payment request for a worker using SOAP API',
        inputSchema: {
          type: 'object',
          properties: {
            workerId: {
              type: 'string',
              description: 'Worker ID (Employee ID)',
            },
            amount: {
              type: 'number',
              description: 'Payment amount',
            },
            currency: {
              type: 'string',
              description: 'Currency code (e.g., USD, EUR)',
              default: 'USD',
            },
            paymentReason: {
              type: 'string',
              description: 'Reason for the one-time payment',
            },
            effectiveDate: {
              type: 'string',
              description: 'Effective date for the payment (YYYY-MM-DD)',
            },
            paymentDate: {
              type: 'string',
              description: 'Payment date (YYYY-MM-DD), defaults to effective date if not provided',
            },
            memo: {
              type: 'string',
              description: 'Optional memo for the payment',
            },
          },
          required: ['workerId', 'amount', 'currency', 'paymentReason', 'effectiveDate'],
        },
      },
      {
        name: 'submit_off_cycle_payment_soap',
        description: 'Submit an off-cycle payment request for a worker using SOAP API',
        inputSchema: {
          type: 'object',
          properties: {
            workerId: {
              type: 'string',
              description: 'Worker ID (Employee ID)',
            },
            amount: {
              type: 'number',
              description: 'Payment amount',
            },
            currency: {
              type: 'string',
              description: 'Currency code (e.g., USD, EUR)',
              default: 'USD',
            },
            paymentReason: {
              type: 'string',
              description: 'Reason for the off-cycle payment',
            },
            paymentDate: {
              type: 'string',
              description: 'Payment date (YYYY-MM-DD)',
            },
            paymentType: {
              type: 'string',
              description: 'Type of off-cycle payment',
              enum: ['Manual', 'On_Demand'],
              default: 'On_Demand',
            },
            memo: {
              type: 'string',
              description: 'Optional memo for the payment',
            },
          },
          required: ['workerId', 'amount', 'currency', 'paymentReason', 'paymentDate'],
        },
      },
      {
        name: 'request_one_time_payment_soap',
        description: 'Request a one-time payment for a worker using Compensation SOAP API',
        inputSchema: {
          type: 'object',
          properties: {
            workerId: {
              type: 'string',
              description: 'Worker ID (Employee ID)',
            },
            amount: {
              type: 'number',
              description: 'Payment amount',
            },
            currency: {
              type: 'string',
              description: 'Currency code (e.g., USD, EUR)',
              default: 'USD',
            },
            paymentReason: {
              type: 'string',
              description: 'Reason for the one-time payment',
            },
            effectiveDate: {
              type: 'string',
              description: 'Effective date for the payment (YYYY-MM-DD)',
            },
            memo: {
              type: 'string',
              description: 'Optional memo for the payment',
            },
          },
          required: ['workerId', 'amount', 'currency', 'paymentReason', 'effectiveDate'],
        },
      },
      {
        name: 'check_in_info',
        description: 'Get information about worker check-in functionality and limitations',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      // Learning API Tools
      {
        name: 'enroll_in_learning_content',
        description: 'Enroll a worker in learning content using Workday Learning API',
        inputSchema: {
          type: 'object',
          properties: {
            workerId: {
              type: 'string',
              description: 'Worker ID to enroll in learning content',
            },
            learningContentId: {
              type: 'string',
              description: 'Learning content ID to enroll the worker in',
            },
            enrollmentDate: {
              type: 'string',
              description: 'Enrollment date in YYYY-MM-DD format (optional, defaults to today)',
            },
            dueDate: {
              type: 'string',
              description: 'Due date for completion in YYYY-MM-DD format (optional)',
            },
            comment: {
              type: 'string',
              description: 'Optional comment for the enrollment',
            },
            autoEnroll: {
              type: 'boolean',
              description: 'Whether to auto-enroll the worker (optional, defaults to true)',
            },
            sendNotification: {
              type: 'boolean',
              description: 'Whether to send notification to the worker (optional, defaults to true)',
            },
            assignmentReason: {
              type: 'string',
              description: 'Reason for the assignment (optional, defaults to "Manager Assignment")',
            },
            priority: {
              type: 'string',
              description: 'Priority level (High, Medium, Low) (optional, defaults to "Medium")',
              enum: ['High', 'Medium', 'Low'],
            },
          },
          required: ['workerId', 'learningContentId'],
        },
      },
      {
        name: 'get_learning_content',
        description: 'Get available learning content from Workday Learning API',
        inputSchema: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              description: 'Maximum number of results to return (optional)',
            },
            offset: {
              type: 'number',
              description: 'Number of results to skip (optional)',
            },
            searchTerm: {
              type: 'string',
              description: 'Search term to filter learning content (optional)',
            },
          },
        },
      },
      {
        name: 'get_learning_content_details',
        description: 'Get detailed information about specific learning content',
        inputSchema: {
          type: 'object',
          properties: {
            learningContentId: {
              type: 'string',
              description: 'Learning content ID',
            },
          },
          required: ['learningContentId'],
        },
      },
      {
        name: 'get_worker_learning_enrollments',
        description: 'Get learning enrollments for a specific worker',
        inputSchema: {
          type: 'object',
          properties: {
            workerId: {
              type: 'string',
              description: 'Worker ID',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of results to return (optional)',
            },
            offset: {
              type: 'number',
              description: 'Number of results to skip (optional)',
            },
          },
          required: ['workerId'],
        },
      },
      {
        name: 'get_worker_learning_progress',
        description: 'Get learning progress for a worker',
        inputSchema: {
          type: 'object',
          properties: {
            workerId: {
              type: 'string',
              description: 'Worker ID',
            },
            learningContentId: {
              type: 'string',
              description: 'Specific learning content ID (optional)',
            },
          },
          required: ['workerId'],
        },
      },
      {
        name: 'search_learning_content',
        description: 'Search learning content with advanced filters',
        inputSchema: {
          type: 'object',
          properties: {
            searchTerm: {
              type: 'string',
              description: 'Search term (optional)',
            },
            category: {
              type: 'string',
              description: 'Learning category (optional)',
            },
            provider: {
              type: 'string',
              description: 'Learning provider (optional)',
            },
            duration: {
              type: 'string',
              description: 'Duration filter (optional)',
            },
            difficulty: {
              type: 'string',
              description: 'Difficulty level (optional)',
              enum: ['Beginner', 'Intermediate', 'Advanced'],
            },
            language: {
              type: 'string',
              description: 'Language filter (optional)',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of results to return (optional)',
            },
            offset: {
              type: 'number',
              description: 'Number of results to skip (optional)',
            },
          },
        },
      },
      {
        name: 'update_learning_enrollment',
        description: 'Update learning enrollment status',
        inputSchema: {
          type: 'object',
          properties: {
            enrollmentId: {
              type: 'string',
              description: 'Learning enrollment ID',
            },
            status: {
              type: 'string',
              description: 'Enrollment status (optional)',
              enum: ['Enrolled', 'In Progress', 'Completed', 'Cancelled'],
            },
            completionDate: {
              type: 'string',
              description: 'Completion date in YYYY-MM-DD format (optional)',
            },
            score: {
              type: 'number',
              description: 'Score/grade (optional)',
            },
            comment: {
              type: 'string',
              description: 'Optional comment (optional)',
            },
          },
          required: ['enrollmentId'],
        },
      },
      {
        name: 'cancel_learning_enrollment',
        description: 'Cancel a learning enrollment',
        inputSchema: {
          type: 'object',
          properties: {
            enrollmentId: {
              type: 'string',
              description: 'Learning enrollment ID',
            },
            reason: {
              type: 'string',
              description: 'Cancellation reason (optional)',
            },
          },
          required: ['enrollmentId'],
        },
      },
      {
        name: 'get_learning_categories',
        description: 'Get available learning categories',
        inputSchema: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              description: 'Maximum number of results to return (optional)',
            },
            offset: {
              type: 'number',
              description: 'Number of results to skip (optional)',
            },
          },
        },
      },
      {
        name: 'enroll_in_learning_content_soap',
        description: 'Enroll a worker in learning content using SOAP API with Business Process Parameters (Run_Now: true, Auto_Complete: true)',
        inputSchema: {
          type: 'object',
          properties: {
            workerId: {
              type: 'string',
              description: 'Worker ID (Employee ID) to enroll in learning content',
            },
            learningContentId: {
              type: 'string',
              description: 'Learning content WID (Workday ID) to enroll the worker in',
            },
            enrollmentDate: {
              type: 'string',
              description: 'Enrollment date in YYYY-MM-DD format (optional)',
            },
            dueDate: {
              type: 'string',
              description: 'Due date for completion in YYYY-MM-DD format (optional)',
            },
            comment: {
              type: 'string',
              description: 'Optional comment for the enrollment',
            },
            assignmentReason: {
              type: 'string',
              description: 'Reason for the assignment (optional)',
            },
            priority: {
              type: 'string',
              description: 'Priority level (High, Medium, Low) (optional)',
              enum: ['High', 'Medium', 'Low'],
            },
          },
          required: ['workerId', 'learningContentId'],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  if (!args) {
    throw new Error('Arguments are required');
  }

  try {
    switch (name) {
    case 'get_user': {
      const user = sampleData.users.find(u => u.id === args.id);
      if (!user) {
        throw new Error(`User with ID ${args.id} not found`);
      }
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(user, null, 2),
          },
        ],
      };
    }

    case 'list_users': {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(sampleData.users, null, 2),
          },
        ],
      };
    }

    case 'get_project': {
      const project = sampleData.projects.find(p => p.id === args.id);
      if (!project) {
        throw new Error(`Project with ID ${args.id} not found`);
      }
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(project, null, 2),
          },
        ],
      };
    }

    case 'list_projects': {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(sampleData.projects, null, 2),
          },
        ],
      };
    }

    case 'create_user': {
      const newId = Math.max(...sampleData.users.map(u => u.id)) + 1;
      const newUser = {
        id: newId,
        name: args.name as string,
        email: args.email as string,
      };
      sampleData.users.push(newUser);
      return {
        content: [
          {
            type: 'text',
            text: `Created user: ${JSON.stringify(newUser, null, 2)}`,
          },
        ],
      };
    }

    case 'get_weather': {
      const city = args.city as string;
      if (!city) {
        throw new Error('City name is required');
      }
      
      try {
        const weather = await getWeatherForCity(city);
        return {
          content: [
            {
              type: 'text',
              text: `Weather for ${weather.location.city}, ${weather.location.country}:

🌡️  Current Temperature: ${weather.current.temperature_celsius}°C (${weather.current.temperature_fahrenheit}°F)
🌡️  Feels Like: ${weather.current.feels_like_celsius}°C (${weather.current.feels_like_fahrenheit}°F)
🌤️  Condition: ${weather.current.description}
💧 Humidity: ${weather.current.humidity}%
🌬️  Wind: ${weather.current.wind_speed_kmh} km/h (${weather.current.wind_speed_mph} mph)
🧭 Wind Direction: ${weather.current.wind_direction}°
📊 Pressure: ${weather.current.pressure} hPa
👁️  Visibility: ${weather.current.visibility} km
☀️  UV Index: ${weather.current.uv_index}

📅 3-Day Forecast:
${weather.forecast.map((day: any) => 
  `${day.date}: ${day.min_temp_celsius}°C - ${day.max_temp_celsius}°C (${day.min_temp_fahrenheit}°F - ${day.max_temp_fahrenheit}°F) - ${day.description}`
).join('\n')}

Raw Data:
${JSON.stringify(weather, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        throw new Error(`Failed to get weather: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    case 'get_workday_worker': {
      const workerId = args.workerId as string;
      if (!workerId) {
        throw new Error('Worker ID is required');
      }
      
      try {
        const workerInfo = await getWorkerInfo(workerId);
        return {
          content: [
            {
              type: 'text',
              text: `Worker Information for ID: ${workerId}

👤 Personal Information:
${workerInfo.personalData ? `
   Name: ${workerInfo.personalData.name?.fullName || 'N/A'}
   Employee ID: ${workerInfo.employeeId || 'N/A'}
   Email: ${workerInfo.personalData.email || 'N/A'}
   Phone: ${workerInfo.personalData.phone || 'N/A'}
` : 'Personal data not available'}

💼 Employment Information:
${workerInfo.employmentData ? `
   Position: ${workerInfo.employmentData.position?.title || 'N/A'}
   Department: ${workerInfo.employmentData.department || 'N/A'}
   Manager: ${workerInfo.employmentData.manager?.name || 'N/A'}
   Start Date: ${workerInfo.employmentData.startDate || 'N/A'}
   Status: ${workerInfo.employmentData.status || 'N/A'}
` : 'Employment data not available'}

🏢 Organization:
${workerInfo.organizationData ? `
   Company: ${workerInfo.organizationData.company || 'N/A'}
   Location: ${workerInfo.organizationData.location || 'N/A'}
   Cost Center: ${workerInfo.organizationData.costCenter || 'N/A'}
` : 'Organization data not available'}

Raw Data:
${JSON.stringify(workerInfo, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        throw new Error(`Failed to get worker information: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    case 'search_workday_workers': {
      const searchTerm = args.searchTerm as string;
      if (!searchTerm) {
        throw new Error('Search term is required');
      }
      
      try {
        const searchResults = await searchWorkers(searchTerm);
        
        // Format search results
        if (searchResults.data && searchResults.data.length > 0) {
          const formattedResults = searchResults.data.map((worker: any, index: number) => {
            return `${index + 1}. **${worker.descriptor || 'Unknown Name'}**
   - Employee ID: ${worker.workerId || 'N/A'}
   - Position: ${worker.primaryJob?.businessTitle || 'N/A'}
   - Department: ${worker.primaryJob?.supervisoryOrganization?.descriptor || 'N/A'}
   - Email: ${worker.person?.email || 'N/A'}`;
          }).join('\n\n');

          return {
            content: [
              {
                type: 'text',
                text: `🔍 Search Results for "${searchTerm}":

Found ${searchResults.data.length} worker(s):

${formattedResults}

Raw Data:
${JSON.stringify(searchResults, null, 2)}`,
              },
            ],
          };
        } else {
          return {
            content: [
              {
                type: 'text',
                text: `🔍 Search Results for "${searchTerm}":

No workers found matching the search criteria.

Raw Data:
${JSON.stringify(searchResults, null, 2)}`,
              },
            ],
          };
        }
      } catch (error) {
        throw new Error(`Failed to search workers: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    case 'list_workers': {
      const limit = args.limit as number;
      if (!limit) {
        throw new Error('Limit is required');
      }
      
      try {
        const workers = await listWorkers(limit);
        return {
          content: [
            {
              type: 'text',
              text: `List of workers:

${workers.data.map((worker: any, index: number) => {
  return `${index + 1}. **${worker.name || 'Unknown Name'}**
   - Employee ID: ${worker.employeeId || 'N/A'}
   - Position: ${worker.position || 'N/A'}
   - Department: ${worker.department || 'N/A'}
   - Email: ${worker.email || 'N/A'}`;
}).join('\n')}

Raw Data:
${JSON.stringify(workers, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        throw new Error(`Failed to list workers: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    case 'create_one_time_payment': {
      const {
        workerId,
        payComponentId,
        startDate,
        endDate,
        amount,
        positionId,
        currency,
        comment,
        runCategories,
        worktags
      } = args;
      
      // Validate required fields
      if (!workerId || !payComponentId || !startDate || !endDate || !amount) {
        throw new Error('Missing required fields: workerId, payComponentId, startDate, endDate, and amount are required');
      }
      
      try {
        const paymentData = {
          workerId: workerId as string,
          payComponentId: payComponentId as string,
          startDate: startDate as string,
          endDate: endDate as string,
          amount: amount as number,
          positionId: positionId as string | undefined,
          currency: currency as string | undefined,
          comment: comment as string | undefined,
          runCategories: runCategories as string[] | undefined,
          worktags: worktags as string[] | undefined
        };

        const result = await createOneTimePayment(paymentData);
        
        return {
          content: [
            {
              type: 'text',
              text: `✅ One-time payment created successfully!

💰 Payment Details:
   - Worker ID: ${workerId}
   - Pay Component: ${payComponentId}
   - Amount: ${amount}
   - Start Date: ${startDate}
   - End Date: ${endDate}
   - Position: ${positionId || 'N/A'}
   - Currency: ${currency || 'Default'}
   - Comment: ${comment || 'None'}
   - Run Categories: ${runCategories && Array.isArray(runCategories) ? runCategories.join(', ') : 'None'}
   - Worktags: ${worktags && Array.isArray(worktags) ? worktags.join(', ') : 'None'}

📋 Response Details:
   - Payroll Input ID: ${result.id || 'N/A'}
   - Status: Created
   - Ongoing: ${result.ongoing ? 'Yes' : 'No'}

Raw API Response:
${JSON.stringify(result, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        throw new Error(`Failed to create one-time payment: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }



    case 'check_workday_auth_status': {
      try {
        const tokens = loadTokens();
        
        if (!tokens && WORKDAY_CONFIG.refreshToken) {
          return {
            content: [
              {
                type: 'text',
                text: `🔄 Authentication Status: Refresh Token Ready

✅ **Status**: Non-expiring refresh token configured
🔄 **Action**: The system will automatically obtain access tokens as needed

🔧 **Configuration**:
- Client ID: ${WORKDAY_CONFIG.clientId || 'Not configured'}
- Refresh Token: Present and ready (${WORKDAY_CONFIG.refreshToken.length} chars)
- Token Endpoint: ${WORKDAY_CONFIG.tokenEndpoint || 'Not configured'}
- Tenant: ${WORKDAY_CONFIG.tenant}
- Base URL: ${WORKDAY_CONFIG.baseUrl}

✨ **Ready**: You can start using Workday API tools. Authentication will be handled automatically using your non-expiring refresh token.`,
              },
            ],
          };
        }
        
        if (!WORKDAY_CONFIG.refreshToken) {
          return {
            content: [
              {
                type: 'text',
                text: `❌ Authentication Status: Not Configured

🔒 **Status**: No refresh token found
🚨 **Action Required**: Configure refresh token authentication

🔐 **To Configure**:
1. Set WORKDAY_REFRESH_TOKEN in your environment variables
2. Ensure all other configuration values are correct
3. Restart the MCP server

🔧 **Configuration**:
- Client ID: ${WORKDAY_CONFIG.clientId || 'Not configured'}
- Token Endpoint: ${WORKDAY_CONFIG.tokenEndpoint || 'Not configured'}
- Tenant: ${WORKDAY_CONFIG.tenant}
- Base URL: ${WORKDAY_CONFIG.baseUrl}
- Refresh Token: Missing`,
              },
            ],
          };
        }
        
        // If we have stored tokens, show their status
        if (tokens) {
          const isExpired = isTokenExpired(tokens);
          const timeRemaining = Math.max(0, tokens.expires_at - Date.now());
          const hoursRemaining = Math.floor(timeRemaining / (1000 * 60 * 60));
          const minutesRemaining = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
          
          return {
          content: [
            {
              type: 'text',
              text: `✅ Authentication Status: Authorized

🎉 **Status**: ${isExpired ? 'Expired (will auto-refresh)' : 'Active'}
🔑 **Access Token**: Available
🔄 **Refresh Token**: Available
⏰ **Expires At**: ${new Date(tokens.expires_at).toLocaleString()}
⏱️ **Time Remaining**: ${hoursRemaining}h ${minutesRemaining}m
🔐 **Scope**: ${tokens.scope}

${isExpired ? '🔄 **Auto-Refresh**: Token will be automatically refreshed on next API call' : '✨ **Ready**: You can use all Workday API tools'}

🔧 **Configuration**:
- Client ID: ${WORKDAY_CONFIG.clientId}
- Token Endpoint: ${WORKDAY_CONFIG.tokenEndpoint}
- Tenant: ${WORKDAY_CONFIG.tenant}
- Base URL: ${WORKDAY_CONFIG.baseUrl}
- Refresh Token: Available

🛠️ **Token Management**: All tokens are automatically managed using refresh token authentication.`,
            },
          ],
        };
        }
        
        // This should not happen, but just in case
        throw new Error('Unexpected authentication state');
      } catch (error) {
        throw new Error(`Failed to check authentication status: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Staffing API v7 Tools
    case 'initiate_job_change': {
      const { workerId, date, reason, jobChangeData } = args;
      if (!workerId) {
        throw new Error('Worker ID is required');
      }
      
      // Validate worker ID against known valid IDs
      const validWorkerIds = [
        "3aa5550b7fe348b98d7b5741afc65534", // Logan McNeil
        "0e44c92412d34b01ace61e80a47aaf6d", // Steve Morgan
        "3895af7993ff4c509cbea2e1817172e0", // Oliver Reynolds
        "26c439a5deed4a7dbab76709e0d2d2ca", // Teresa Serrano
        "3bf7df19491f4d039fd54decdd84e05c"  // Maximilian Schneider
      ];
      
      if (!validWorkerIds.includes(workerId as string)) {
        throw new Error(`Invalid worker ID. Valid worker IDs are:
        - Logan McNeil: 3aa5550b7fe348b98d7b5741afc65534
        - Steve Morgan: 0e44c92412d34b01ace61e80a47aaf6d
        - Oliver Reynolds: 3895af7993ff4c509cbea2e1817172e0
        - Teresa Serrano: 26c439a5deed4a7dbab76709e0d2d2ca
        - Maximilian Schneider: 3bf7df19491f4d039fd54decdd84e05c`);
      }
      
      try {
        const config = {
          baseUrl: WORKDAY_CONFIG.baseUrl,
          tenant: WORKDAY_CONFIG.tenant,
          getAccessToken: getValidAccessToken
        };
        
        // Construct job change data payload
        const payload: any = {};
        
        // Add date if provided
        if (date) {
          payload.date = date;
        }
        
        // Add reason if provided
        if (reason) {
          payload.reason = {
            descriptor: reason
          };
        }
        
        // Merge with any additional job change data
        if (jobChangeData) {
          Object.assign(payload, jobChangeData);
        }
        
        const result = await staffingApi.initiateJobChange(config, workerId as string, payload);
        return {
          content: [
            {
              type: 'text',
              text: `✅ Job change initiated successfully for worker ${workerId}

📋 Job Change Details:
   - Job Change ID: ${result.id || 'N/A'}
   - Worker ID: ${workerId}
   - Effective Date: ${date || 'Default (today)'}
   - Reason: ${reason || 'General Job Change'}
   - Status: Initiated
   - Created: ${result.created || 'N/A'}

Raw API Response:
${JSON.stringify(result, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        throw new Error(`Failed to initiate job change: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    case 'get_job_change': {
      const { jobChangeId } = args;
      if (!jobChangeId) {
        throw new Error('Job change ID is required');
      }
      
      try {
        const config = {
          baseUrl: WORKDAY_CONFIG.baseUrl,
          tenant: WORKDAY_CONFIG.tenant,
          getAccessToken: getValidAccessToken
        };
        
        const result = await staffingApi.getJobChange(config, jobChangeId as string);
        return {
          content: [
            {
              type: 'text',
              text: `📋 Job Change Information (ID: ${jobChangeId})

${JSON.stringify(result, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        throw new Error(`Failed to get job change: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    case 'submit_job_change': {
      const { jobChangeId } = args;
      if (!jobChangeId) {
        throw new Error('Job change ID is required');
      }
      
      try {
        const config = {
          baseUrl: WORKDAY_CONFIG.baseUrl,
          tenant: WORKDAY_CONFIG.tenant,
          getAccessToken: getValidAccessToken
        };
        
        const result = await staffingApi.submitJobChange(config, jobChangeId as string);
        return {
          content: [
            {
              type: 'text',
              text: `✅ Job change submitted successfully (ID: ${jobChangeId})

📋 Submission Details:
${JSON.stringify(result, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        throw new Error(`Failed to submit job change: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    case 'get_job_families': {
      const { limit, offset } = args;
      
      try {
        const config = {
          baseUrl: WORKDAY_CONFIG.baseUrl,
          tenant: WORKDAY_CONFIG.tenant,
          getAccessToken: getValidAccessToken
        };
        
        const result = await staffingApi.getJobFamilies(config, limit as number, offset as number);
        return {
          content: [
            {
              type: 'text',
              text: `📋 Job Families

${JSON.stringify(result, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        throw new Error(`Failed to get job families: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    case 'get_job_family': {
      const { jobFamilyId } = args;
      if (!jobFamilyId) {
        throw new Error('Job family ID is required');
      }
      
      try {
        const config = {
          baseUrl: WORKDAY_CONFIG.baseUrl,
          tenant: WORKDAY_CONFIG.tenant,
          getAccessToken: getValidAccessToken
        };
        
        const result = await staffingApi.getJobFamily(config, jobFamilyId as string);
        return {
          content: [
            {
              type: 'text',
              text: `📋 Job Family Information (ID: ${jobFamilyId})

${JSON.stringify(result, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        throw new Error(`Failed to get job family: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    case 'get_job_profiles': {
      const { limit, offset } = args;
      
      try {
        const config = {
          baseUrl: WORKDAY_CONFIG.baseUrl,
          tenant: WORKDAY_CONFIG.tenant,
          getAccessToken: getValidAccessToken
        };
        
        const result = await staffingApi.getJobProfiles(config, limit as number, offset as number);
        return {
          content: [
            {
              type: 'text',
              text: `📋 Job Profiles

${JSON.stringify(result, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        throw new Error(`Failed to get job profiles: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    case 'get_job_profile': {
      const { jobProfileId } = args;
      if (!jobProfileId) {
        throw new Error('Job profile ID is required');
      }
      
      try {
        const config = {
          baseUrl: WORKDAY_CONFIG.baseUrl,
          tenant: WORKDAY_CONFIG.tenant,
          getAccessToken: getValidAccessToken
        };
        
        const result = await staffingApi.getJobProfile(config, jobProfileId as string);
        return {
          content: [
            {
              type: 'text',
              text: `📋 Job Profile Information (ID: ${jobProfileId})

${JSON.stringify(result, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        throw new Error(`Failed to get job profile: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    case 'create_job_profile': {
      const { jobProfileData } = args;
      if (!jobProfileData) {
        throw new Error('Job profile data is required');
      }
      
      try {
        const config = {
          baseUrl: WORKDAY_CONFIG.baseUrl,
          tenant: WORKDAY_CONFIG.tenant,
          getAccessToken: getValidAccessToken
        };
        
        const result = await staffingApi.createJobProfile(config, jobProfileData);
        return {
          content: [
            {
              type: 'text',
              text: `✅ Job profile created successfully

📋 Created Job Profile:
${JSON.stringify(result, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        throw new Error(`Failed to create job profile: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    case 'get_jobs': {
      const { limit, offset } = args;
      
      try {
        const config = {
          baseUrl: WORKDAY_CONFIG.baseUrl,
          tenant: WORKDAY_CONFIG.tenant,
          getAccessToken: getValidAccessToken
        };
        
        const result = await staffingApi.getJobs(config, limit as number, offset as number);
        return {
          content: [
            {
              type: 'text',
              text: `📋 Jobs

${JSON.stringify(result, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        throw new Error(`Failed to get jobs: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    case 'get_job': {
      const { jobId } = args;
      if (!jobId) {
        throw new Error('Job ID is required');
      }
      
      try {
        const config = {
          baseUrl: WORKDAY_CONFIG.baseUrl,
          tenant: WORKDAY_CONFIG.tenant,
          getAccessToken: getValidAccessToken
        };
        
        const result = await staffingApi.getJob(config, jobId as string);
        return {
          content: [
            {
              type: 'text',
              text: `📋 Job Information (ID: ${jobId})

${JSON.stringify(result, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        throw new Error(`Failed to get job: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    case 'get_job_workspaces': {
      const { jobId } = args;
      if (!jobId) {
        throw new Error('Job ID is required');
      }
      
      try {
        const config = {
          baseUrl: WORKDAY_CONFIG.baseUrl,
          tenant: WORKDAY_CONFIG.tenant,
          getAccessToken: getValidAccessToken
        };
        
        const result = await staffingApi.getJobWorkspaces(config, jobId as string);
        return {
          content: [
            {
              type: 'text',
              text: `📋 Job Workspaces (Job ID: ${jobId})

${JSON.stringify(result, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        throw new Error(`Failed to get job workspaces: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    case 'initiate_organization_assignment_change': {
      const { workerId, orgAssignmentData } = args;
      if (!workerId) {
        throw new Error('Worker ID is required');
      }
      
      try {
        const config = {
          baseUrl: WORKDAY_CONFIG.baseUrl,
          tenant: WORKDAY_CONFIG.tenant,
          getAccessToken: getValidAccessToken
        };
        
        const result = await staffingApi.initiateOrganizationAssignmentChange(config, workerId as string, orgAssignmentData);
        return {
          content: [
            {
              type: 'text',
              text: `✅ Organization assignment change initiated successfully for worker ${workerId}

📋 Organization Assignment Change Details:
   - Assignment Change ID: ${result.id || 'N/A'}
   - Worker ID: ${workerId}
   - Status: Initiated
   - Created: ${result.created || 'N/A'}

Raw API Response:
${JSON.stringify(result, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        throw new Error(`Failed to initiate organization assignment change: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    case 'get_organization_assignment_change': {
      const { orgAssignmentId } = args;
      if (!orgAssignmentId) {
        throw new Error('Organization assignment change ID is required');
      }
      
      try {
        const config = {
          baseUrl: WORKDAY_CONFIG.baseUrl,
          tenant: WORKDAY_CONFIG.tenant,
          getAccessToken: getValidAccessToken
        };
        
        const result = await staffingApi.getOrganizationAssignmentChange(config, orgAssignmentId as string);
        return {
          content: [
            {
              type: 'text',
              text: `📋 Organization Assignment Change Information (ID: ${orgAssignmentId})

${JSON.stringify(result, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        throw new Error(`Failed to get organization assignment change: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    case 'submit_organization_assignment_change': {
      const { orgAssignmentId } = args;
      if (!orgAssignmentId) {
        throw new Error('Organization assignment change ID is required');
      }
      
      try {
        const config = {
          baseUrl: WORKDAY_CONFIG.baseUrl,
          tenant: WORKDAY_CONFIG.tenant,
          getAccessToken: getValidAccessToken
        };
        
        const result = await staffingApi.submitOrganizationAssignmentChange(config, orgAssignmentId as string);
        return {
          content: [
            {
              type: 'text',
              text: `✅ Organization assignment change submitted successfully (ID: ${orgAssignmentId})

📋 Submission Details:
${JSON.stringify(result, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        throw new Error(`Failed to submit organization assignment change: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    case 'get_supervisory_organizations': {
      const { limit, offset } = args;
      
      try {
        const config = {
          baseUrl: WORKDAY_CONFIG.baseUrl,
          tenant: WORKDAY_CONFIG.tenant,
          getAccessToken: getValidAccessToken
        };
        
        const result = await staffingApi.getSupervisoryOrganizations(config, limit as number, offset as number);
        return {
          content: [
            {
              type: 'text',
              text: `📋 Supervisory Organizations

${JSON.stringify(result, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        throw new Error(`Failed to get supervisory organizations: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    case 'get_supervisory_organization': {
      const { supervisoryOrgId } = args;
      if (!supervisoryOrgId) {
        throw new Error('Supervisory organization ID is required');
      }
      
      try {
        const config = {
          baseUrl: WORKDAY_CONFIG.baseUrl,
          tenant: WORKDAY_CONFIG.tenant,
          getAccessToken: getValidAccessToken
        };
        
        const result = await staffingApi.getSupervisoryOrganization(config, supervisoryOrgId as string);
        return {
          content: [
            {
              type: 'text',
              text: `📋 Supervisory Organization Information (ID: ${supervisoryOrgId})

${JSON.stringify(result, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        throw new Error(`Failed to get supervisory organization: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    case 'get_staffing_workers': {
      const { limit, offset } = args;
      
      try {
        const config = {
          baseUrl: WORKDAY_CONFIG.baseUrl,
          tenant: WORKDAY_CONFIG.tenant,
          getAccessToken: getValidAccessToken
        };
        
        const result = await staffingApi.getStaffingWorkers(config, limit as number, offset as number);
        return {
          content: [
            {
              type: 'text',
              text: `📋 Staffing Workers (Non-terminated)

${JSON.stringify(result, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        throw new Error(`Failed to get staffing workers: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    case 'get_staffing_worker': {
      const { workerId } = args;
      if (!workerId) {
        throw new Error('Worker ID is required');
      }
      
      try {
        const config = {
          baseUrl: WORKDAY_CONFIG.baseUrl,
          tenant: WORKDAY_CONFIG.tenant,
          getAccessToken: getValidAccessToken
        };
        
        const result = await staffingApi.getStaffingWorker(config, workerId as string);
        return {
          content: [
            {
              type: 'text',
              text: `📋 Staffing Worker Information (ID: ${workerId})

${JSON.stringify(result, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        throw new Error(`Failed to get staffing worker: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    case 'search_staffing_workers': {
      const { searchTerm, limit } = args;
      if (!searchTerm) {
        throw new Error('Search term is required');
      }
      
      try {
        const config = {
          baseUrl: WORKDAY_CONFIG.baseUrl,
          tenant: WORKDAY_CONFIG.tenant,
          getAccessToken: getValidAccessToken
        };
        
        const result = await staffingApi.searchStaffingWorkers(config, searchTerm as string, limit as number);
        return {
          content: [
            {
              type: 'text',
              text: `🔍 Staffing Workers Search Results for "${searchTerm}"

${JSON.stringify(result, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        throw new Error(`Failed to search staffing workers: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    case 'get_worker_job_changes': {
      const { workerId, limit, offset } = args;
      if (!workerId) {
        throw new Error('Worker ID is required');
      }
      
      try {
        const config = {
          baseUrl: WORKDAY_CONFIG.baseUrl,
          tenant: WORKDAY_CONFIG.tenant,
          getAccessToken: getValidAccessToken
        };
        
        const result = await staffingApi.getWorkerJobChanges(config, workerId as string, limit as number, offset as number);
        return {
          content: [
            {
              type: 'text',
              text: `📋 Worker Job Changes (Worker ID: ${workerId})

${JSON.stringify(result, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        throw new Error(`Failed to get worker job changes: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    case 'get_worker_organization_assignment_changes': {
      const { workerId, limit, offset } = args;
      if (!workerId) {
        throw new Error('Worker ID is required');
      }
      
      try {
        const config = {
          baseUrl: WORKDAY_CONFIG.baseUrl,
          tenant: WORKDAY_CONFIG.tenant,
          getAccessToken: getValidAccessToken
        };
        
        const result = await staffingApi.getWorkerOrganizationAssignmentChanges(config, workerId as string, limit as number, offset as number);
        return {
          content: [
            {
              type: 'text',
              text: `📋 Worker Organization Assignment Changes (Worker ID: ${workerId})

${JSON.stringify(result, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        throw new Error(`Failed to get worker organization assignment changes: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    case 'check_in_info': {
      return {
        content: [
          {
            type: 'text',
            text: `ℹ️ Worker Check-in API Information

⚠️ **Current Status: UNAVAILABLE**

The worker check-in API endpoints are currently not accessible due to permission restrictions (Error S22). This is a common limitation in Workday environments where specific domain permissions are required for check-in functionality.

🔍 **What This Means:**
- GET /workers/{workerId}/checkIns - Permission denied
- POST /workers/{workerId}/checkIns - Permission denied  
- PATCH /workers/{workerId}/checkIns/{checkInId} - Permission denied

🛠️ **Alternative Solutions:**

1. **REST API Time Tracking:**
- Use REST API endpoints for time-related data
   - More comprehensive time tracking information
   - May have different permission requirements

2. **Performance Management:**
   - Use performance review tools for check-in related data
   - Access to goal tracking and review information

3. **Contact Your Workday Administrator:**
   - Request access to "Worker Data: Check-ins" domain
   - Enable "Time Tracking" or "Performance Management" permissions
   - Add Integration System User to appropriate security groups

4. **Alternative Endpoints:**
   - Use job changes API for role-related updates
   - Use organization assignment changes for team updates
   - Use compensation API for salary-related check-ins

📋 **Available Related Tools:**
- REST API endpoints - Time tracking data
- initiate_job_change - Job-related changes
- REST API endpoints - Comprehensive worker data

For more information about setting up permissions, consult your Workday administrator or the Workday documentation for Integration System Users.`,
          },
        ],
      };
    }

    case 'get_worker_check_ins': {
      const { workerId, limit, offset } = args;
      if (!workerId) {
        throw new Error('Worker ID is required');
      }
      
      try {
        const config = {
          baseUrl: WORKDAY_CONFIG.baseUrl,
          tenant: WORKDAY_CONFIG.tenant,
          getAccessToken: getValidAccessToken
        };
        
        const result = await staffingApi.getWorkerCheckIns(config, workerId as string, limit as number, offset as number);
        return {
          content: [
            {
              type: 'text',
              text: `📋 Worker Check-ins (Worker ID: ${workerId})

${JSON.stringify(result, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        throw new Error(`Failed to get worker check-ins: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    case 'create_worker_check_in': {
      const { workerId, checkInData } = args;
      if (!workerId || !checkInData) {
        throw new Error('Missing required fields: workerId and checkInData are required');
      }
      
      try {
        const config = {
          baseUrl: WORKDAY_CONFIG.baseUrl,
          tenant: WORKDAY_CONFIG.tenant,
          getAccessToken: getValidAccessToken
        };
        
        const result = await staffingApi.createWorkerCheckIn(config, workerId as string, checkInData);
        return {
          content: [
            {
              type: 'text',
              text: `✅ Worker check-in created successfully

📋 Check-in Details:
${JSON.stringify(result, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        throw new Error(`Failed to create worker check-in: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // SOAP API case removed - using REST API only

    // SOAP API case removed - using REST API only

    // SOAP API case removed - using REST API only

    // SOAP API case removed - using REST API only

    // Learning API Tools
    case 'enroll_in_learning_content': {
      const { workerId, learningContentId, enrollmentDate, dueDate, comment, autoEnroll, sendNotification, assignmentReason, priority } = args;
      if (!workerId || !learningContentId) {
        throw new Error('Missing required fields: workerId and learningContentId are required');
      }
      
      try {
        const config = {
          baseUrl: WORKDAY_CONFIG.baseUrl,
          tenant: WORKDAY_CONFIG.tenant,
          getAccessToken: getValidAccessToken
        };
        
        const enrollmentData = {
          workerId: workerId as string,
          learningContentId: learningContentId as string,
          enrollmentDate: enrollmentDate as string,
          dueDate: dueDate as string,
          comment: comment as string,
          autoEnroll: autoEnroll as boolean,
          sendNotification: sendNotification as boolean,
          assignmentReason: assignmentReason as string,
          priority: priority as 'High' | 'Medium' | 'Low'
        };
        
        const result = await learningApi.enrollInLearningContent(config, enrollmentData);
        return {
          content: [
            {
              type: 'text',
              text: `✅ Learning content enrollment created successfully!

📚 Enrollment Details:
   - Worker ID: ${workerId}
   - Learning Content ID: ${learningContentId}
   - Enrollment Date: ${enrollmentDate || 'Today'}
   - Due Date: ${dueDate || 'Not specified'}
   - Auto Enroll: ${autoEnroll !== false ? 'Yes' : 'No'}
   - Send Notification: ${sendNotification !== false ? 'Yes' : 'No'}
   - Assignment Reason: ${assignmentReason || 'Manager Assignment'}
   - Priority: ${priority || 'Medium'}
   - Comment: ${comment || 'None'}

📋 API Response:
${JSON.stringify(result, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        throw new Error(`Failed to enroll in learning content: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    case 'get_learning_content': {
      const { limit, offset, searchTerm } = args;
      
      try {
        const config = {
          baseUrl: WORKDAY_CONFIG.baseUrl,
          tenant: WORKDAY_CONFIG.tenant,
          getAccessToken: getValidAccessToken
        };
        
        const result = await learningApi.getLearningContent(config, limit as number, offset as number, searchTerm as string);
        return {
          content: [
            {
              type: 'text',
              text: `📚 Available Learning Content

${searchTerm ? `🔍 Search Term: "${searchTerm}"` : ''}
${limit ? `📄 Limit: ${limit}` : ''}
${offset ? `⏭️ Offset: ${offset}` : ''}

📋 Results:
${JSON.stringify(result, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        throw new Error(`Failed to get learning content: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    case 'get_learning_content_details': {
      const { learningContentId } = args;
      if (!learningContentId) {
        throw new Error('Learning content ID is required');
      }
      
      try {
        const config = {
          baseUrl: WORKDAY_CONFIG.baseUrl,
          tenant: WORKDAY_CONFIG.tenant,
          getAccessToken: getValidAccessToken
        };
        
        const result = await learningApi.getLearningContentDetails(config, learningContentId as string);
        return {
          content: [
            {
              type: 'text',
              text: `📚 Learning Content Details (ID: ${learningContentId})

📋 Details:
${JSON.stringify(result, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        throw new Error(`Failed to get learning content details: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    case 'get_worker_learning_enrollments': {
      const { workerId, limit, offset } = args;
      if (!workerId) {
        throw new Error('Worker ID is required');
      }
      
      try {
        const config = {
          baseUrl: WORKDAY_CONFIG.baseUrl,
          tenant: WORKDAY_CONFIG.tenant,
          getAccessToken: getValidAccessToken
        };
        
        const result = await learningApi.getWorkerLearningEnrollments(config, workerId as string, limit as number, offset as number);
        return {
          content: [
            {
              type: 'text',
              text: `📚 Learning Enrollments for Worker ${workerId}

${limit ? `📄 Limit: ${limit}` : ''}
${offset ? `⏭️ Offset: ${offset}` : ''}

📋 Enrollments:
${JSON.stringify(result, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        throw new Error(`Failed to get worker learning enrollments: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    case 'get_worker_learning_progress': {
      const { workerId, learningContentId } = args;
      if (!workerId) {
        throw new Error('Worker ID is required');
      }
      
      try {
        const config = {
          baseUrl: WORKDAY_CONFIG.baseUrl,
          tenant: WORKDAY_CONFIG.tenant,
          getAccessToken: getValidAccessToken
        };
        
        const result = await learningApi.getWorkerLearningProgress(config, workerId as string, learningContentId as string);
        return {
          content: [
            {
              type: 'text',
              text: `📈 Learning Progress for Worker ${workerId}

${learningContentId ? `📚 Learning Content ID: ${learningContentId}` : '📚 All Learning Content'}

📋 Progress:
${JSON.stringify(result, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        throw new Error(`Failed to get worker learning progress: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    case 'search_learning_content': {
      const { searchTerm, category, provider, duration, difficulty, language, limit, offset } = args;
      
      try {
        const config = {
          baseUrl: WORKDAY_CONFIG.baseUrl,
          tenant: WORKDAY_CONFIG.tenant,
          getAccessToken: getValidAccessToken
        };
        
        const searchParams = {
          searchTerm: searchTerm as string,
          category: category as string,
          provider: provider as string,
          duration: duration as string,
          difficulty: difficulty as 'Beginner' | 'Intermediate' | 'Advanced',
          language: language as string,
          limit: limit as number,
          offset: offset as number
        };
        
        const result = await learningApi.searchLearningContent(config, searchParams);
        return {
          content: [
            {
              type: 'text',
              text: `🔍 Learning Content Search Results

🔍 Search Parameters:
   - Search Term: ${searchTerm || 'None'}
   - Category: ${category || 'Any'}
   - Provider: ${provider || 'Any'}
   - Duration: ${duration || 'Any'}
   - Difficulty: ${difficulty || 'Any'}
   - Language: ${language || 'Any'}
   - Limit: ${limit || 'Default'}
   - Offset: ${offset || '0'}

📋 Results:
${JSON.stringify(result, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        throw new Error(`Failed to search learning content: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    case 'update_learning_enrollment': {
      const { enrollmentId, status, completionDate, score, comment } = args;
      if (!enrollmentId) {
        throw new Error('Enrollment ID is required');
      }
      
      try {
        const config = {
          baseUrl: WORKDAY_CONFIG.baseUrl,
          tenant: WORKDAY_CONFIG.tenant,
          getAccessToken: getValidAccessToken
        };
        
        const updateData = {
          status: status as 'Enrolled' | 'In Progress' | 'Completed' | 'Cancelled',
          completionDate: completionDate as string,
          score: score as number,
          comment: comment as string
        };
        
        const result = await learningApi.updateLearningEnrollment(config, enrollmentId as string, updateData);
        return {
          content: [
            {
              type: 'text',
              text: `✅ Learning enrollment updated successfully!

📚 Update Details:
   - Enrollment ID: ${enrollmentId}
   - Status: ${status || 'Unchanged'}
   - Completion Date: ${completionDate || 'Unchanged'}
   - Score: ${score || 'Unchanged'}
   - Comment: ${comment || 'Unchanged'}

📋 API Response:
${JSON.stringify(result, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        throw new Error(`Failed to update learning enrollment: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    case 'cancel_learning_enrollment': {
      const { enrollmentId, reason } = args;
      if (!enrollmentId) {
        throw new Error('Enrollment ID is required');
      }
      
      try {
        const config = {
          baseUrl: WORKDAY_CONFIG.baseUrl,
          tenant: WORKDAY_CONFIG.tenant,
          getAccessToken: getValidAccessToken
        };
        
        const result = await learningApi.cancelLearningEnrollment(config, enrollmentId as string, reason as string);
        return {
          content: [
            {
              type: 'text',
              text: `✅ Learning enrollment cancelled successfully!

📚 Cancellation Details:
   - Enrollment ID: ${enrollmentId}
   - Reason: ${reason || 'Not specified'}

📋 API Response:
${JSON.stringify(result, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        throw new Error(`Failed to cancel learning enrollment: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    case 'get_learning_categories': {
      const { limit, offset } = args;
      
      try {
        const config = {
          baseUrl: WORKDAY_CONFIG.baseUrl,
          tenant: WORKDAY_CONFIG.tenant,
          getAccessToken: getValidAccessToken
        };
        
        const result = await learningApi.getLearningCategories(config, limit as number, offset as number);
        return {
          content: [
            {
              type: 'text',
              text: `📚 Learning Categories

${limit ? `📄 Limit: ${limit}` : ''}
${offset ? `⏭️ Offset: ${offset}` : ''}

📋 Categories:
${JSON.stringify(result, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        throw new Error(`Failed to get learning categories: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }



    default:
      throw new Error(`Unknown tool: ${name}`);
  }
} catch (error) {
  throw new Error(`Error executing tool ${name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
}
});

// Start the server
async function main() {
  console.error('[MCP Server] Starting with refresh token authentication...');
  
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});

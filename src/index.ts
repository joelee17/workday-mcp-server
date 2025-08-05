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
import * as https from 'https';
import * as fs from 'fs';
import * as staffingApi from './staffing-api.js';
import * as learningApi from './learning-api.js';
import * as accountsPayableApi from './accounts-payable-api.js';
import * as asorApi from './asor-api.js';
import * as hcmAgentApi from './hcm-agent-api.js';

// Create server instance
const server = new Server(
  {
    name: 'workday-mcp-server',
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

// Enhanced refresh token function - exchanges refresh token for access token using POST with Basic Auth
async function refreshAccessToken(refreshToken: string): Promise<TokenData> {
  console.error('[MCP Server] Exchanging refresh token for access token...');
  
  // Create Basic Auth header with Client ID as username and Client Secret as password
  const credentials = `${WORKDAY_CONFIG.clientId}:${WORKDAY_CONFIG.clientSecret}`;
  const encodedCredentials = Buffer.from(credentials).toString('base64');
  
  // Create form URL encoded POST body with refresh_token grant type (no client credentials in body)
  const postData = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken  // Using refresh token from workday.env file
  });
  
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

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
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

  // Load any existing cached tokens
  let tokens = loadTokens();
  
  // Check if we have a valid cached access token
  if (tokens && !isTokenExpired(tokens)) {
    return tokens.access_token;
  }
  
  try {
    // Exchange refresh token for access token
    const freshTokens = await refreshAccessToken(WORKDAY_CONFIG.refreshToken);
    return freshTokens.access_token;
  } catch (refreshError) {
    throw new Error(`Authentication failed: Cannot get valid access token. ` +
      `Refresh token exchange error: ${refreshError instanceof Error ? refreshError.message : 'Unknown'}. ` +
      `Please check your WORKDAY_REFRESH_TOKEN in workday.env file.`);
  }
}

// =============================================================================
// TOOL DEFINITIONS ORGANIZED BY API SERVICE
// =============================================================================

// Define tool categories
const STAFFING_TOOLS = [
  // Core Worker Operations
  {
    name: 'get_workday_worker',
    description: 'Get worker information from Workday Staffing API',
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
    description: 'List workers from Workday Staffing API',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Number of workers to list (default: 10)',
        },
      },
    },
  },

  // Job Change Operations
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
          description: 'Reason for the job change (e.g., "Promotion", "Transfer", "Reorganization").',
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

  // Job Management
  {
    name: 'get_job_families',
    description: 'Get list of job families',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Maximum number of results to return' },
        offset: { type: 'number', description: 'Number of results to skip' },
      },
    },
  },
  {
    name: 'get_job_profiles',
    description: 'Get list of job profiles',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Maximum number of results to return' },
        offset: { type: 'number', description: 'Number of results to skip' },
      },
    },
  },
  {
    name: 'get_supervisory_organizations',
    description: 'Get list of supervisory organizations',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Maximum number of results to return' },
        offset: { type: 'number', description: 'Number of results to skip' },
      },
    },
  },
];

const LEARNING_TOOLS = [
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
        limit: { type: 'number', description: 'Maximum number of results to return (optional)' },
        offset: { type: 'number', description: 'Number of results to skip (optional)' },
        searchTerm: { type: 'string', description: 'Search term to filter learning content (optional)' },
      },
    },
  },
  {
    name: 'get_worker_learning_enrollments',
    description: 'Get learning enrollments for a specific worker',
    inputSchema: {
      type: 'object',
      properties: {
        workerId: { type: 'string', description: 'Worker ID' },
        limit: { type: 'number', description: 'Maximum number of results to return (optional)' },
        offset: { type: 'number', description: 'Number of results to skip (optional)' },
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
        workerId: { type: 'string', description: 'Worker ID' },
        learningContentId: { type: 'string', description: 'Specific learning content ID (optional)' },
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
        searchTerm: { type: 'string', description: 'Search term' },
        category: { type: 'string', description: 'Learning category (optional)' },
        provider: { type: 'string', description: 'Learning provider (optional)' },
        limit: { type: 'number', description: 'Maximum number of results (optional)' },
      },
      required: ['searchTerm'],
    },
  },
];

const PAYROLL_TOOLS = [
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
        currency: {
          type: 'string',
          description: 'Currency code (optional, defaults to pay group currency)',
        },
        comment: {
          type: 'string',
          description: 'Optional comment for the payment',
        },
      },
      required: ['workerId', 'payComponentId', 'startDate', 'endDate', 'amount'],
    },
  },
];

const ACCOUNTS_PAYABLE_TOOLS = [
  {
    name: 'get_supplier_invoice_requests',
    description: 'Retrieve a collection of supplier invoice requests with optional filters',
    inputSchema: {
      type: 'object',
      properties: {
        company: { 
          type: 'array', 
          items: { type: 'string' },
          description: 'Company IDs for filtering (optional)' 
        },
        fromDueDate: { 
          type: 'string', 
          description: 'Beginning date of payment due period (MM/DD/YYYY format)' 
        },
        fromInvoiceDate: { 
          type: 'string', 
          description: 'Date on or after which invoice is created (MM/DD/YYYY format)' 
        },
        limit: { 
          type: 'number', 
          description: 'Maximum number of results (default: 20, max: 100)' 
        },
        offset: { 
          type: 'number', 
          description: 'Zero-based index for pagination (default: 0)' 
        },
        requester: { 
          type: 'array', 
          items: { type: 'string' },
          description: 'Worker IDs of requesters for filtering (optional)' 
        },
        status: { 
          type: 'array', 
          items: { type: 'string' },
          description: 'Status values for filtering (optional)' 
        },
        supplier: { 
          type: 'array', 
          items: { type: 'string' },
          description: 'Supplier IDs for filtering (optional)' 
        },
        toDueDate: { 
          type: 'string', 
          description: 'End date of payment due period (MM/DD/YYYY format)' 
        },
        toInvoiceDate: { 
          type: 'string', 
          description: 'Date on or before which invoice is created (MM/DD/YYYY format)' 
        },
      },
    },
  },
  {
    name: 'get_supplier_invoice_request',
    description: 'Retrieve a specific supplier invoice request by ID',
    inputSchema: {
      type: 'object',
      properties: {
        invoiceId: {
          type: 'string',
          description: 'The Workday ID of the supplier invoice request',
        },
      },
      required: ['invoiceId'],
    },
  },
  {
    name: 'create_supplier_invoice_request',
    description: 'Create a new supplier invoice request',
    inputSchema: {
      type: 'object',
      properties: {
        company: {
          type: 'string',
          description: 'Company ID (required)',
        },
        supplier: {
          type: 'string',
          description: 'Supplier ID (required)',
        },
        invoiceDate: {
          type: 'string',
          description: 'Invoice date in YYYY-MM-DD format (required)',
        },
        currency: {
          type: 'string',
          description: 'Currency ID (optional)',
        },
        taxAmount: {
          type: 'number',
          description: 'Tax amount for the invoice (optional)',
        },
        requester: {
          type: 'string',
          description: 'Requester worker ID (optional)',
        },
        controlTotalAmount: {
          type: 'number',
          description: 'Control total amount that should match line amounts (optional)',
        },
        referenceType: {
          type: 'string',
          description: 'Reference type ID (optional)',
        },
        paymentTerms: {
          type: 'string',
          description: 'Payment terms ID (optional)',
        },
        statutoryInvoiceType: {
          type: 'string',
          description: 'Statutory invoice type ID (optional)',
        },
        suppliersInvoiceNumber: {
          type: 'string',
          description: 'Supplier\'s invoice number (optional)',
        },
        referenceNumber: {
          type: 'string',
          description: 'Reference number with key payment information (optional)',
        },
        invoiceReceivedDate: {
          type: 'string',
          description: 'Date invoice was received in YYYY-MM-DD format (optional)',
        },
        freightAmount: {
          type: 'number',
          description: 'Freight amount (optional)',
        },
        handlingCode: {
          type: 'string',
          description: 'Handling code ID (optional)',
        },
        shipToAddress: {
          type: 'string',
          description: 'Ship to address ID (optional)',
        },
        memo: {
          type: 'string',
          description: 'Memo for the invoice request (optional)',
        },
        remitToConnection: {
          type: 'string',
          description: 'Remit to connection ID (optional)',
        },
      },
      required: ['company', 'supplier', 'invoiceDate'],
    },
  },
  {
    name: 'submit_supplier_invoice_request',
    description: 'Submit a supplier invoice request for approval',
    inputSchema: {
      type: 'object',
      properties: {
        invoiceId: {
          type: 'string',
          description: 'The Workday ID of the supplier invoice request to submit',
        },
      },
      required: ['invoiceId'],
    },
  },
  {
    name: 'get_supplier_invoice_request_lines',
    description: 'Retrieve lines for a specific supplier invoice request',
    inputSchema: {
      type: 'object',
      properties: {
        invoiceId: {
          type: 'string',
          description: 'The Workday ID of the supplier invoice request',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results (default: 20, max: 100)',
        },
        offset: {
          type: 'number',
          description: 'Zero-based index for pagination (default: 0)',
        },
      },
      required: ['invoiceId'],
    },
  },
  {
    name: 'get_supplier_invoice_request_line',
    description: 'Retrieve a specific line from a supplier invoice request',
    inputSchema: {
      type: 'object',
      properties: {
        invoiceId: {
          type: 'string',
          description: 'The Workday ID of the supplier invoice request',
        },
        lineId: {
          type: 'string',
          description: 'The Workday ID of the specific line',
        },
      },
      required: ['invoiceId', 'lineId'],
    },
  },
  {
    name: 'get_supplier_invoice_request_attachments',
    description: 'Retrieve attachments for a specific supplier invoice request',
    inputSchema: {
      type: 'object',
      properties: {
        invoiceId: {
          type: 'string',
          description: 'The Workday ID of the supplier invoice request',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results (default: 20, max: 100)',
        },
        offset: {
          type: 'number',
          description: 'Zero-based index for pagination (default: 0)',
        },
      },
      required: ['invoiceId'],
    },
  },
  {
    name: 'get_supplier_invoice_request_attachment',
    description: 'Retrieve a specific attachment from a supplier invoice request',
    inputSchema: {
      type: 'object',
      properties: {
        invoiceId: {
          type: 'string',
          description: 'The Workday ID of the supplier invoice request',
        },
        attachmentId: {
          type: 'string',
          description: 'The Workday ID of the specific attachment',
        },
      },
      required: ['invoiceId', 'attachmentId'],
    },
  },
  {
    name: 'create_supplier_invoice_request_attachment',
    description: 'Create a new attachment for a supplier invoice request',
    inputSchema: {
      type: 'object',
      properties: {
        invoiceId: {
          type: 'string',
          description: 'The Workday ID of the supplier invoice request',
        },
        fileName: {
          type: 'string',
          description: 'Name of the file to attach',
        },
        contentType: {
          type: 'string',
          description: 'Content type ID for the attachment',
        },
        fileLength: {
          type: 'number',
          description: 'Length of the file in bytes',
        },
      },
      required: ['invoiceId', 'fileName'],
    },
  },
];

const ASOR_TOOLS = [
  {
    name: 'get_agent_definitions',
    description: 'Retrieve all Agent Definitions from the Agent System of Record',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'create_agent_definition',
    description: 'Create or update an Agent Definition in the Agent System of Record',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Human readable name of the agent (required)',
        },
        description: {
          type: 'string',
          description: 'Human-readable description of the agent (required)',
        },
        version: {
          type: 'string',
          description: 'Version of the agent, format is up to the provider (required)',
        },
        url: {
          type: 'string',
          description: 'URL where the agent is hosted (required)',
        },
        skills: {
          type: 'array',
          description: 'Array of skills that the agent can perform (required)',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'Unique identifier for the skill' },
              name: { type: 'string', description: 'Human readable name of the skill' },
              description: { type: 'string', description: 'Description of what the skill does' },
              tags: {
                type: 'array',
                description: 'Set of tagwords describing skill capabilities (optional)',
                items: {
                  type: 'object',
                  properties: {
                    tag: { type: 'string' }
                  }
                }
              }
            }
          }
        },
        id: {
          type: 'string',
          description: 'Agent Definition ID to link Agent Versions (optional)',
        },
        documentationUrl: {
          type: 'string',
          description: 'URL to documentation for the agent (optional)',
        },
        iconUrl: {
          type: 'string',
          description: 'URL to an icon for the agent (optional)',
        },
        provider: {
          type: 'object',
          description: 'Service provider information (optional)',
          properties: {
            organization: { type: 'string', description: 'Organization name' },
            url: { type: 'string', description: 'Provider URL' }
          }
        },
        capabilities: {
          type: 'object',
          description: 'Optional capabilities supported by the agent',
          properties: {
            pushNotifications: { type: 'boolean', description: 'Agent can notify updates to client' },
            stateTransitionHistory: { type: 'boolean', description: 'Agent exposes status change history' },
            streaming: { type: 'boolean', description: 'Agent supports Server-Sent Events' }
          }
        },
        supportsAuthenticatedExtendedCard: {
          type: 'boolean',
          description: 'Whether agent supports providing extended card when user is authenticated',
        }
      },
      required: ['name', 'description', 'version', 'url', 'skills'],
    },
  },
];

const HCM_AGENT_TOOLS = [
  {
    name: 'search_workday_agent',
    description: 'Search through Workday using the HCM Agent API, including features, knowledge base articles, etc.',
    inputSchema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'Search query text',
        },
        intentNames: {
          type: 'array',
          description: 'Optional array of intent names to filter the search',
          items: {
            type: 'string',
          },
        },
      },
      required: ['text'],
    },
  },
  {
    name: 'get_direct_reports',
    description: 'Get information about your direct reports',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_direct_reports_learnings',
    description: 'Get learning information about your direct reports',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_direct_reports_career',
    description: 'Get career information about your direct reports including goals, feedback and skills',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_my_information',
    description: 'Get your personal information from Workday',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_my_inbox_tasks',
    description: 'Get your inbox tasks from Workday',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_my_payslip_information',
    description: 'Get your payslip information from Workday',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_my_career_information',
    description: 'Get your career information from Workday',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_my_calendar_information',
    description: 'Get your important calendar dates including learning, time off, and holidays',
    inputSchema: {
      type: 'object',
      properties: {
        monthsFromNow: {
          type: 'integer',
          description: 'Number of months from now to retrieve calendar information (default: 6)',
        },
      },
    },
  },
  {
    name: 'get_my_time_off_balances',
    description: 'Get your time off balances from Workday',
    inputSchema: {
      type: 'object',
      properties: {
        asOfDate: {
          type: 'string',
          description: 'Date to get balances as of (ISO datetime format, optional)',
        },
      },
    },
  },
  {
    name: 'lookup_coworker',
    description: 'Look up information about coworkers by name',
    inputSchema: {
      type: 'object',
      properties: {
        nameSearch: {
          type: 'string',
          description: 'Name to search for (e.g., "John Smith", "Smith", "John")',
        },
      },
      required: ['nameSearch'],
    },
  },
];

const UTILITY_TOOLS = [
  {
    name: 'check_workday_auth_status',
    description: 'Check current authentication status with Workday',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

// List available tools - organized by service
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      // Staffing API Tools
      ...STAFFING_TOOLS,
      
      // Learning API Tools  
      ...LEARNING_TOOLS,
      
      // Payroll API Tools
      ...PAYROLL_TOOLS,
      
      // Accounts Payable API Tools
      ...ACCOUNTS_PAYABLE_TOOLS,
      
      // ASOR API Tools
      ...ASOR_TOOLS,
      
      // HCM Agent API Tools
      ...HCM_AGENT_TOOLS,
      
      // Utility Tools
      ...UTILITY_TOOLS,
    ],
  };
});

// =============================================================================
// TOOL IMPLEMENTATION HANDLERS
// =============================================================================

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  try {
    const config = {
      baseUrl: WORKDAY_CONFIG.baseUrl,
      tenant: WORKDAY_CONFIG.tenant,
      getAccessToken: getValidAccessToken
    };

    // STAFFING API TOOLS
    switch (name) {
      case 'get_workday_worker': {
        const { workerId } = args as { workerId: string };
        const result = await staffingApi.getStaffingWorker(config, workerId);
        return {
          content: [{
            type: 'text',
            text: `📋 Worker Information (ID: ${workerId})\n\n${JSON.stringify(result, null, 2)}`
          }],
        };
      }

      case 'search_workday_workers': {
        const { searchTerm } = args as { searchTerm: string };
        const result = await staffingApi.searchStaffingWorkers(config, searchTerm, 10);
        return {
          content: [{
            type: 'text',
            text: `🔍 Workers Search Results for "${searchTerm}"\n\n${JSON.stringify(result, null, 2)}`
          }],
        };
      }

      case 'list_workers': {
        const { limit = 10 } = args as { limit?: number };
        const result = await staffingApi.getStaffingWorkers(config, limit);
        return {
          content: [{
            type: 'text',
            text: `📋 Workers List (Limit: ${limit})\n\n${JSON.stringify(result, null, 2)}`
          }],
        };
      }

      case 'initiate_job_change': {
        const { workerId, date, reason } = args as { workerId: string; date?: string; reason?: string };
        const payload = {
          date: date || new Date().toISOString().split('T')[0],
          reason: reason || 'General Job Change'
        };
        const result = await staffingApi.initiateJobChange(config, workerId, payload);
        return {
          content: [{
            type: 'text',
            text: `📝 Job Change Initiated for Worker ${workerId}\n\n${JSON.stringify(result, null, 2)}`
          }],
        };
      }

      case 'get_job_change': {
        const { jobChangeId } = args as { jobChangeId: string };
        const result = await staffingApi.getJobChange(config, jobChangeId);
        return {
          content: [{
            type: 'text',
            text: `📋 Job Change Information (ID: ${jobChangeId})\n\n${JSON.stringify(result, null, 2)}`
          }],
        };
      }

      case 'submit_job_change': {
        const { jobChangeId } = args as { jobChangeId: string };
        const result = await staffingApi.submitJobChange(config, jobChangeId);
        return {
          content: [{
            type: 'text',
            text: `✅ Job Change Submitted (ID: ${jobChangeId})\n\n${JSON.stringify(result, null, 2)}`
          }],
        };
      }

      case 'get_job_families': {
        const { limit, offset } = args as { limit?: number; offset?: number };
        const result = await staffingApi.getJobFamilies(config, limit, offset);
        return {
          content: [{
            type: 'text',
            text: `📋 Job Families\n\n${JSON.stringify(result, null, 2)}`
          }],
        };
      }

      case 'get_job_profiles': {
        const { limit, offset } = args as { limit?: number; offset?: number };
        const result = await staffingApi.getJobProfiles(config, limit, offset);
        return {
          content: [{
            type: 'text',
            text: `📋 Job Profiles\n\n${JSON.stringify(result, null, 2)}`
          }],
        };
      }

      case 'get_supervisory_organizations': {
        const { limit, offset } = args as { limit?: number; offset?: number };
        const result = await staffingApi.getSupervisoryOrganizations(config, limit, offset);
        return {
          content: [{
            type: 'text',
            text: `📋 Supervisory Organizations\n\n${JSON.stringify(result, null, 2)}`
          }],
        };
      }

      // LEARNING API TOOLS
      case 'enroll_in_learning_content': {
        const enrollmentData = args as {
          workerId: string;
          learningContentId: string;
          enrollmentDate?: string;
          dueDate?: string;
          comment?: string;
        };
        const result = await learningApi.enrollInLearningContent(config, enrollmentData);
        return {
          content: [{
            type: 'text',
            text: `📚 Learning Enrollment Created\n\n${JSON.stringify(result, null, 2)}`
          }],
        };
      }

      case 'get_learning_content': {
        const { limit, offset, searchTerm } = args as { limit?: number; offset?: number; searchTerm?: string };
        const result = await learningApi.getLearningContent(config, limit, offset, searchTerm);
        return {
          content: [{
            type: 'text',
            text: `📚 Learning Content\n\n${JSON.stringify(result, null, 2)}`
          }],
        };
      }

      case 'get_worker_learning_enrollments': {
        const { workerId, limit, offset } = args as { workerId: string; limit?: number; offset?: number };
        const result = await learningApi.getWorkerLearningEnrollments(config, workerId, limit, offset);
        return {
          content: [{
            type: 'text',
            text: `📚 Learning Enrollments for Worker ${workerId}\n\n${JSON.stringify(result, null, 2)}`
          }],
        };
      }

      case 'get_worker_learning_progress': {
        const { workerId, learningContentId } = args as { workerId: string; learningContentId?: string };
        const result = await learningApi.getWorkerLearningProgress(config, workerId, learningContentId);
        return {
          content: [{
            type: 'text',
            text: `📊 Learning Progress for Worker ${workerId}\n\n${JSON.stringify(result, null, 2)}`
          }],
        };
      }

      case 'search_learning_content': {
        const { searchTerm, category, provider, limit } = args as {
          searchTerm: string;
          category?: string;
          provider?: string;
          limit?: number;
        };
        const result = await learningApi.searchLearningContent(config, {
          searchTerm,
          category,
          provider,
          limit
        });
        return {
          content: [{
            type: 'text',
            text: `🔍 Learning Content Search Results for "${searchTerm}"\n\n${JSON.stringify(result, null, 2)}`
          }],
        };
      }

      // PAYROLL API TOOLS
      case 'create_one_time_payment': {
        const paymentData = args as {
          workerId: string;
          payComponentId: string;
          startDate: string;
          endDate: string;
          amount: number;
          currency?: string;
          comment?: string;
        };
        
        // Implementation for one-time payment creation
        const accessToken = await getValidAccessToken();
        const apiPath = `/ccx/api/payroll/v2/${WORKDAY_CONFIG.tenant}/payrollInputs`;
        const url = `${WORKDAY_CONFIG.baseUrl}${apiPath}`;
        
        const payload: any = {
          worker: { id: paymentData.workerId },
          payComponent: { id: paymentData.payComponentId },
          startDate: paymentData.startDate,
          endDate: paymentData.endDate,
          ongoing: false,
          inputDetails: [{
            type: { id: "AMOUNT" },
            value: paymentData.amount
          }]
        };

        if (paymentData.currency) {
          payload.currency = { id: paymentData.currency };
        }

        return new Promise((resolve, reject) => {
          const options = {
            hostname: new URL(url).hostname,
            port: 443,
            path: new URL(url).pathname,
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Accept': 'application/json',
              'Content-Type': 'application/json'
            }
          };

          const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
              try {
                const response = JSON.parse(data);
                if (res.statusCode === 200 || res.statusCode === 201) {
                  resolve({
                    content: [{
                      type: 'text',
                      text: `💰 One-Time Payment Created\n\n${JSON.stringify(response, null, 2)}`
                    }],
                  });
                } else {
                  reject(new Error(`Payroll API error (${res.statusCode}): ${response.error || data}`));
                }
              } catch (error) {
                reject(new Error(`Failed to parse payroll response: ${error instanceof Error ? error.message : 'Unknown error'}`));
              }
            });
          });

          req.on('error', (error) => {
            reject(new Error(`Payroll API request error: ${error.message}`));
          });

          req.write(JSON.stringify(payload));
          req.end();
        });
      }

      // ACCOUNTS PAYABLE API TOOLS
      case 'get_supplier_invoice_requests': {
        const params = args as {
          company?: string[];
          fromDueDate?: string;
          fromInvoiceDate?: string;
          limit?: number;
          offset?: number;
          requester?: string[];
          status?: string[];
          supplier?: string[];
          toDueDate?: string;
          toInvoiceDate?: string;
        };
        
        const result = await accountsPayableApi.getSupplierInvoiceRequests(config, params);
        return {
          content: [{
            type: 'text',
            text: `📋 Supplier Invoice Requests\n\n${JSON.stringify(result, null, 2)}`
          }],
        };
      }

      case 'get_supplier_invoice_request': {
        const { invoiceId } = args as { invoiceId: string };
        const result = await accountsPayableApi.getSupplierInvoiceRequest(config, invoiceId);
        return {
          content: [{
            type: 'text',
            text: `📄 Supplier Invoice Request Details\n\n${JSON.stringify(result, null, 2)}`
          }],
        };
      }

      case 'create_supplier_invoice_request': {
        const invoiceData = args as {
          company: string;
          supplier: string;
          invoiceDate: string;
          currency?: string;
          taxAmount?: number;
          requester?: string;
          controlTotalAmount?: number;
          referenceType?: string;
          paymentTerms?: string;
          statutoryInvoiceType?: string;
          suppliersInvoiceNumber?: string;
          referenceNumber?: string;
          invoiceReceivedDate?: string;
          freightAmount?: number;
          handlingCode?: string;
          shipToAddress?: string;
          memo?: string;
          remitToConnection?: string;
        };

        // Transform string IDs to objects as expected by the API
        const transformedData: any = {
          company: { id: invoiceData.company },
          supplier: { id: invoiceData.supplier },
          invoiceDate: invoiceData.invoiceDate,
        };

        // Add optional fields if provided
        if (invoiceData.currency) transformedData.currency = { id: invoiceData.currency };
        if (invoiceData.taxAmount !== undefined) transformedData.taxAmount = invoiceData.taxAmount;
        if (invoiceData.requester) transformedData.requester = { id: invoiceData.requester };
        if (invoiceData.controlTotalAmount !== undefined) transformedData.controlTotalAmount = invoiceData.controlTotalAmount;
        if (invoiceData.referenceType) transformedData.referenceType = { id: invoiceData.referenceType };
        if (invoiceData.paymentTerms) transformedData.paymentTerms = { id: invoiceData.paymentTerms };
        if (invoiceData.statutoryInvoiceType) transformedData.statutoryInvoiceType = { id: invoiceData.statutoryInvoiceType };
        if (invoiceData.suppliersInvoiceNumber) transformedData.suppliersInvoiceNumber = invoiceData.suppliersInvoiceNumber;
        if (invoiceData.referenceNumber) transformedData.referenceNumber = invoiceData.referenceNumber;
        if (invoiceData.invoiceReceivedDate) transformedData.invoiceReceivedDate = invoiceData.invoiceReceivedDate;
        if (invoiceData.freightAmount !== undefined) transformedData.freightAmount = invoiceData.freightAmount;
        if (invoiceData.handlingCode) transformedData.handlingCode = { id: invoiceData.handlingCode };
        if (invoiceData.shipToAddress) transformedData.shipToAddress = { id: invoiceData.shipToAddress };
        if (invoiceData.memo) transformedData.memo = invoiceData.memo;
        if (invoiceData.remitToConnection) transformedData.remitToConnection = { id: invoiceData.remitToConnection };

        const result = await accountsPayableApi.createSupplierInvoiceRequest(config, transformedData);
        return {
          content: [{
            type: 'text',
            text: `✅ Supplier Invoice Request Created\n\n${JSON.stringify(result, null, 2)}`
          }],
        };
      }

      case 'submit_supplier_invoice_request': {
        const { invoiceId } = args as { invoiceId: string };
        const result = await accountsPayableApi.submitSupplierInvoiceRequest(config, invoiceId);
        return {
          content: [{
            type: 'text',
            text: `🚀 Supplier Invoice Request Submitted\n\n${JSON.stringify(result, null, 2)}`
          }],
        };
      }

      case 'get_supplier_invoice_request_lines': {
        const { invoiceId, limit, offset } = args as { 
          invoiceId: string; 
          limit?: number; 
          offset?: number; 
        };
        const result = await accountsPayableApi.getSupplierInvoiceRequestLines(config, invoiceId, { limit, offset });
        return {
          content: [{
            type: 'text',
            text: `📝 Supplier Invoice Request Lines\n\n${JSON.stringify(result, null, 2)}`
          }],
        };
      }

      case 'get_supplier_invoice_request_line': {
        const { invoiceId, lineId } = args as { invoiceId: string; lineId: string };
        const result = await accountsPayableApi.getSupplierInvoiceRequestLine(config, invoiceId, lineId);
        return {
          content: [{
            type: 'text',
            text: `📄 Supplier Invoice Request Line Details\n\n${JSON.stringify(result, null, 2)}`
          }],
        };
      }

      case 'get_supplier_invoice_request_attachments': {
        const { invoiceId, limit, offset } = args as { 
          invoiceId: string; 
          limit?: number; 
          offset?: number; 
        };
        const result = await accountsPayableApi.getSupplierInvoiceRequestAttachments(config, invoiceId, { limit, offset });
        return {
          content: [{
            type: 'text',
            text: `📎 Supplier Invoice Request Attachments\n\n${JSON.stringify(result, null, 2)}`
          }],
        };
      }

      case 'get_supplier_invoice_request_attachment': {
        const { invoiceId, attachmentId } = args as { invoiceId: string; attachmentId: string };
        const result = await accountsPayableApi.getSupplierInvoiceRequestAttachment(config, invoiceId, attachmentId);
        return {
          content: [{
            type: 'text',
            text: `📎 Supplier Invoice Request Attachment Details\n\n${JSON.stringify(result, null, 2)}`
          }],
        };
      }

      case 'create_supplier_invoice_request_attachment': {
        const attachmentData = args as {
          invoiceId: string;
          fileName: string;
          contentType?: string;
          fileLength?: number;
        };

        // Transform data for API
        const transformedData: any = {
          fileName: attachmentData.fileName,
        };

        if (attachmentData.contentType) {
          transformedData.contentType = { id: attachmentData.contentType };
        }
        if (attachmentData.fileLength !== undefined) {
          transformedData.fileLength = attachmentData.fileLength;
        }

        const result = await accountsPayableApi.createSupplierInvoiceRequestAttachment(
          config, 
          attachmentData.invoiceId, 
          transformedData
        );
        return {
          content: [{
            type: 'text',
            text: `📎 Supplier Invoice Request Attachment Created\n\n${JSON.stringify(result, null, 2)}`
          }],
        };
      }

      // ASOR API TOOLS
      case 'get_agent_definitions': {
        const result = await asorApi.getAgentDefinitions(config);
        return {
          content: [{
            type: 'text',
            text: `🤖 Agent Definitions\n\n${JSON.stringify(result, null, 2)}`
          }],
        };
      }

      case 'create_agent_definition': {
        const agentData = args as {
          name: string;
          description: string;
          version: string;
          url: string;
          skills: Array<{
            id: string;
            name: string;
            description: string;
            tags?: Array<{ tag: string }>;
          }>;
          id?: string;
          documentationUrl?: string;
          iconUrl?: string;
          provider?: {
            organization: string;
            url: string;
          };
          capabilities?: {
            pushNotifications?: boolean;
            stateTransitionHistory?: boolean;
            streaming?: boolean;
          };
          supportsAuthenticatedExtendedCard?: boolean;
        };

        const result = await asorApi.createAgentDefinition(config, agentData);
        return {
          content: [{
            type: 'text',
            text: `✅ Agent Definition Created/Updated\n\n${JSON.stringify(result, null, 2)}`
          }],
        };
      }

      // HCM AGENT API TOOLS
      case 'search_workday_agent': {
        const { text, intentNames } = args as { text: string; intentNames?: string[] };
        const query = { text, ...(intentNames && { intentNames }) };
        const result = await hcmAgentApi.searchAgent(config, query);
        return {
          content: [{
            type: 'text',
            text: `🔍 Workday Agent Search Results for "${text}"\n\n${JSON.stringify(result, null, 2)}`
          }],
        };
      }

      case 'get_direct_reports': {
        const result = await hcmAgentApi.getDirectReports(config);
        return {
          content: [{
            type: 'text',
            text: `👥 Direct Reports Information\n\n${JSON.stringify(result, null, 2)}`
          }],
        };
      }

      case 'get_direct_reports_learnings': {
        const result = await hcmAgentApi.getDirectReportsLearnings(config);
        return {
          content: [{
            type: 'text',
            text: `📚 Direct Reports Learning Information\n\n${JSON.stringify(result, null, 2)}`
          }],
        };
      }

      case 'get_direct_reports_career': {
        const result = await hcmAgentApi.getDirectReportsCareer(config);
        return {
          content: [{
            type: 'text',
            text: `🎯 Direct Reports Career Information\n\n${JSON.stringify(result, null, 2)}`
          }],
        };
      }

      case 'get_my_information': {
        const result = await hcmAgentApi.getMyInformation(config);
        return {
          content: [{
            type: 'text',
            text: `👤 My Information\n\n${JSON.stringify(result, null, 2)}`
          }],
        };
      }

      case 'get_my_inbox_tasks': {
        const result = await hcmAgentApi.getMyInboxTasks(config);
        return {
          content: [{
            type: 'text',
            text: `📥 My Inbox Tasks\n\n${JSON.stringify(result, null, 2)}`
          }],
        };
      }

      case 'get_my_payslip_information': {
        const result = await hcmAgentApi.getMyPayslipInformation(config);
        return {
          content: [{
            type: 'text',
            text: `💰 My Payslip Information\n\n${JSON.stringify(result, null, 2)}`
          }],
        };
      }

      case 'get_my_career_information': {
        const result = await hcmAgentApi.getMyCareerInformation(config);
        return {
          content: [{
            type: 'text',
            text: `📈 My Career Information\n\n${JSON.stringify(result, null, 2)}`
          }],
        };
      }

      case 'get_my_calendar_information': {
        const { monthsFromNow } = args as { monthsFromNow?: number };
        const result = await hcmAgentApi.getMyCalendarInformation(config, monthsFromNow);
        return {
          content: [{
            type: 'text',
            text: `📅 My Calendar Information\n\n${JSON.stringify(result, null, 2)}`
          }],
        };
      }

      case 'get_my_time_off_balances': {
        const { asOfDate } = args as { asOfDate?: string };
        const result = await hcmAgentApi.getMyTimeOffBalances(config, asOfDate);
        return {
          content: [{
            type: 'text',
            text: `🏖️ My Time Off Balances\n\n${JSON.stringify(result, null, 2)}`
          }],
        };
      }

      case 'lookup_coworker': {
        const { nameSearch } = args as { nameSearch: string };
        const result = await hcmAgentApi.lookupCoworker(config, nameSearch);
        return {
          content: [{
            type: 'text',
            text: `👔 Coworker Lookup Results for "${nameSearch}"\n\n${JSON.stringify(result, null, 2)}`
          }],
        };
      }

      // UTILITY TOOLS
      case 'check_workday_auth_status': {
        const currentTokens = loadTokens();
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              hasTokens: !!currentTokens,
              isExpired: currentTokens ? isTokenExpired(currentTokens) : null,
              expiresAt: currentTokens?.expires_at ? new Date(currentTokens.expires_at).toISOString() : null,
              scope: currentTokens?.scope || null,
              configStatus: {
                hasClientId: !!WORKDAY_CONFIG.clientId,
                hasClientSecret: !!WORKDAY_CONFIG.clientSecret,
                hasRefreshToken: !!WORKDAY_CONFIG.refreshToken,
                hasTokenEndpoint: !!WORKDAY_CONFIG.tokenEndpoint,
                baseUrl: WORKDAY_CONFIG.baseUrl,
                tenant: WORKDAY_CONFIG.tenant
              }
            }, null, 2)
          }],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      }],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[MCP Server] Starting with refresh token authentication...');
}

main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
}); 
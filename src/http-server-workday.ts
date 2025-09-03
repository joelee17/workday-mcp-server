#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';

import express from 'express';
import cors from 'cors';
import https from 'https';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import * as staffingApi from './staffing-api.js';
import * as learningApi from './learning-api.js';
import * as accountsPayableApi from './accounts-payable-api.js';
import * as asorApi from './asor-api.js';
// hcmAgentApi import removed - AWS endpoints no longer needed

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

// Helper function to create API config
function createApiConfig() {
  return {
    baseUrl: WORKDAY_CONFIG.baseUrl,
    tenant: WORKDAY_CONFIG.tenant,
    getAccessToken: getValidAccessToken,
  };
}

// Shared tools list - keep in sync with MCP handler
const ALL_TOOLS = [
  // Auth tools
  {
    name: 'check_workday_auth_status',
    description: 'Check current Workday authentication status',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  // STAFFING TOOLS - Core Worker Operations
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
    description: 'Initiate a job change for a worker',
    inputSchema: {
      type: 'object',
      properties: {
        workerId: {
          type: 'string',
          description: 'Worker ID for whom to initiate job change',
        },
        jobChangeData: {
          type: 'object',
          description: 'Optional job change data',
        },
      },
      required: ['workerId'],
    },
  },
  {
    name: 'get_job_change',
    description: 'Get details of a specific job change',
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
    description: 'Submit a job change for processing',
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
  // Job and Organization Tools
  {
    name: 'get_job_families',
    description: 'Get list of job families',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Maximum number of job families to return' },
        offset: { type: 'number', description: 'Starting offset for pagination' },
      },
    },
  },
  {
    name: 'get_job_profiles',
    description: 'Get list of job profiles',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Maximum number of job profiles to return' },
        offset: { type: 'number', description: 'Starting offset for pagination' },
      },
    },
  },
  {
    name: 'get_supervisory_organizations',
    description: 'Get list of supervisory organizations',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Maximum number of organizations to return' },
        offset: { type: 'number', description: 'Starting offset for pagination' },
      },
    },
  },
  // LEARNING TOOLS
  {
    name: 'enroll_in_learning_content',
    description: 'Enroll a worker in learning content',
    inputSchema: {
      type: 'object',
      properties: {
        workerId: {
          type: 'string',
          description: 'Worker ID to enroll',
        },
        learningContentId: {
          type: 'string',
          description: 'Learning content ID',
        },
        enrollmentData: {
          type: 'object',
          description: 'Optional enrollment configuration data',
        },
      },
      required: ['workerId', 'learningContentId'],
    },
  },
  {
    name: 'get_learning_content',
    description: 'Get learning content information',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Maximum number of learning content items to return' },
        offset: { type: 'number', description: 'Starting offset for pagination' },
      },
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
      },
      required: ['workerId'],
    },
  },
  {
    name: 'search_learning_content',
    description: 'Search for learning content',
    inputSchema: {
      type: 'object',
      properties: {
        searchTerm: {
          type: 'string',
          description: 'Search term for learning content',
        },
        limit: { type: 'number', description: 'Maximum number of results to return' },
      },
      required: ['searchTerm'],
    },
  },
  // HCM AGENT TOOLS removed - AWS endpoints no longer needed
  // PAYROLL TOOLS
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
  // ACCOUNTS PAYABLE TOOLS
  {
    name: 'get_supplier_invoice_requests',
    description: 'Retrieve a collection of supplier invoice requests with optional filters',
    inputSchema: {
      type: 'object',
      properties: {
        company: { type: 'string', description: 'Company filter' },
        limit: { type: 'number', description: 'Maximum number of results' },
        offset: { type: 'number', description: 'Starting offset for pagination' },
      },
    },
  },
  {
    name: 'get_supplier_invoice_request',
    description: 'Retrieve a specific supplier invoice request by ID',
    inputSchema: {
      type: 'object',
      properties: {
        invoiceRequestId: {
          type: 'string',
          description: 'Supplier invoice request ID',
        },
      },
      required: ['invoiceRequestId'],
    },
  },
  {
    name: 'create_supplier_invoice_request',
    description: 'Create a new supplier invoice request',
    inputSchema: {
      type: 'object',
      properties: {
        invoiceData: {
          type: 'object',
          description: 'Invoice request data including supplier, amounts, line items, etc.',
        },
      },
      required: ['invoiceData'],
    },
  },
  {
    name: 'submit_supplier_invoice_request',
    description: 'Submit a supplier invoice request for processing',
    inputSchema: {
      type: 'object',
      properties: {
        invoiceRequestId: {
          type: 'string',
          description: 'Supplier invoice request ID to submit',
        },
      },
      required: ['invoiceRequestId'],
    },
  },
  {
    name: 'get_supplier_invoice_request_lines',
    description: 'Get line items for a supplier invoice request',
    inputSchema: {
      type: 'object',
      properties: {
        invoiceRequestId: {
          type: 'string',
          description: 'Supplier invoice request ID',
        },
      },
      required: ['invoiceRequestId'],
    },
  },
  {
    name: 'get_supplier_invoice_request_line',
    description: 'Get a specific line item from a supplier invoice request',
    inputSchema: {
      type: 'object',
      properties: {
        invoiceRequestId: {
          type: 'string',
          description: 'Supplier invoice request ID',
        },
        lineId: {
          type: 'string',
          description: 'Line item ID',
        },
      },
      required: ['invoiceRequestId', 'lineId'],
    },
  },
  {
    name: 'get_supplier_invoice_request_attachments',
    description: 'Get attachments for a supplier invoice request',
    inputSchema: {
      type: 'object',
      properties: {
        invoiceRequestId: {
          type: 'string',
          description: 'Supplier invoice request ID',
        },
      },
      required: ['invoiceRequestId'],
    },
  },
  {
    name: 'get_supplier_invoice_request_attachment',
    description: 'Get a specific attachment from a supplier invoice request',
    inputSchema: {
      type: 'object',
      properties: {
        invoiceRequestId: {
          type: 'string',
          description: 'Supplier invoice request ID',
        },
        attachmentId: {
          type: 'string',
          description: 'Attachment ID',
        },
      },
      required: ['invoiceRequestId', 'attachmentId'],
    },
  },
  {
    name: 'create_supplier_invoice_request_attachment',
    description: 'Add an attachment to a supplier invoice request',
    inputSchema: {
      type: 'object',
      properties: {
        invoiceRequestId: {
          type: 'string',
          description: 'Supplier invoice request ID',
        },
        attachmentData: {
          type: 'object',
          description: 'Attachment data including file content and metadata',
        },
      },
      required: ['invoiceRequestId', 'attachmentData'],
    },
  },
  // ASOR TOOLS
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
          description: 'Skills/capabilities the agent provides (required)',
          items: { type: 'string' },
        },
      },
      required: ['name', 'description', 'version', 'url', 'skills'],
    },
  },
];

// Set up all MCP handlers (copied from main index.ts)
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    jsonrpc: "2.0",
    result: {
      tools: ALL_TOOLS,
    }
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

      case 'list_workers':
        const workersLimit = args?.limit ? Number(args.limit) : 10;
        const workersResult = await staffingApi.getStaffingWorkers(createApiConfig(), workersLimit);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(workersResult, null, 2)
          }],
        };

      // Job Change Operations
      case 'initiate_job_change':
        if (!args || !args.workerId) {
          throw new Error('Missing required parameter: workerId');
        }
        const jobChangeResult = await staffingApi.initiateJobChange(createApiConfig(), args.workerId as string, args.jobChangeData);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(jobChangeResult, null, 2)
          }],
        };

      case 'get_job_change':
        if (!args || !args.jobChangeId) {
          throw new Error('Missing required parameter: jobChangeId');
        }
                const jobChangeInfo = await staffingApi.getJobChange(createApiConfig(), args.jobChangeId as string);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(jobChangeInfo, null, 2)
          }],
        };

      case 'submit_job_change':
        if (!args || !args.jobChangeId) {
          throw new Error('Missing required parameter: jobChangeId');
        }
                const submitResult = await staffingApi.submitJobChange(createApiConfig(), args.jobChangeId as string);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(submitResult, null, 2)
          }],
        };

      case 'get_job_families':
        const jobFamilies = await staffingApi.getJobFamilies(createApiConfig(), args?.limit ? Number(args.limit) : undefined, args?.offset ? Number(args.offset) : undefined);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(jobFamilies, null, 2)
          }],
        };

      case 'get_job_profiles':
        const jobProfiles = await staffingApi.getJobProfiles(createApiConfig(), args?.limit ? Number(args.limit) : undefined, args?.offset ? Number(args.offset) : undefined);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(jobProfiles, null, 2)
          }],
        };

      case 'get_supervisory_organizations':
        const supervisoryOrgs = await staffingApi.getSupervisoryOrganizations(createApiConfig(), args?.limit ? Number(args.limit) : undefined, args?.offset ? Number(args.offset) : undefined);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(supervisoryOrgs, null, 2)
          }],
        };

      // Learning Tools
      case 'enroll_in_learning_content':
        if (!args || !args.workerId || !args.learningContentId) {
          throw new Error('Missing required parameters: workerId, learningContentId');
        }
        const enrollmentData = (args.enrollmentData as Record<string, any>) || {};
        const enrollmentResult = await learningApi.enrollInLearningContent(createApiConfig(), {
          workerId: args.workerId as string,
          learningContentId: args.learningContentId as string,
          ...enrollmentData
        });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(enrollmentResult, null, 2)
          }],
        };

      case 'get_learning_content':
        const learningContent = await learningApi.getLearningContent(createApiConfig(), args?.limit ? Number(args.limit) : undefined, args?.offset ? Number(args.offset) : undefined);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(learningContent, null, 2)
          }],
        };

      case 'get_worker_learning_enrollments':
        if (!args || !args.workerId) {
          throw new Error('Missing required parameter: workerId');
        }
        const learningEnrollments = await learningApi.getWorkerLearningEnrollments(createApiConfig(), args.workerId as string);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(learningEnrollments, null, 2)
          }],
        };

      case 'get_worker_learning_progress':
        if (!args || !args.workerId) {
          throw new Error('Missing required parameter: workerId');
        }
        const learningProgress = await learningApi.getWorkerLearningProgress(createApiConfig(), args.workerId as string);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(learningProgress, null, 2)
          }],
        };

      case 'search_learning_content':
        if (!args || !args.searchTerm) {
          throw new Error('Missing required parameter: searchTerm');
        }
        const learningSearchResults = await learningApi.searchLearningContent(createApiConfig(), {
          searchTerm: args.searchTerm as string,
          limit: args?.limit ? Number(args.limit) : undefined
        });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(learningSearchResults, null, 2)
          }],
        };

      // HCM Agent Tools removed - AWS endpoints no longer needed

      // Payroll Tools
      case 'create_one_time_payment':
        if (!args || !args.workerId || !args.payComponentId || !args.startDate || !args.endDate || !args.amount) {
          throw new Error('Missing required parameters: workerId, payComponentId, startDate, endDate, amount');
        }
        // Note: This function is not yet implemented in the API modules
        const paymentResult = {
          status: 'error',
          message: 'One-time payment creation is not yet implemented',
          requestedPayment: {
            workerId: args.workerId,
            payComponentId: args.payComponentId,
            startDate: args.startDate,
            endDate: args.endDate,
            amount: args.amount,
            currency: args.currency,
            comment: args.comment,
          }
        };
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(paymentResult, null, 2)
          }],
        };

      // Accounts Payable Tools
      case 'get_supplier_invoice_requests':
        const invoiceRequests = await accountsPayableApi.getSupplierInvoiceRequests(createApiConfig(), {
          company: args?.company ? [args.company as string] : undefined,
          limit: args?.limit ? Number(args.limit) : undefined,
          offset: args?.offset ? Number(args.offset) : undefined,
        });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(invoiceRequests, null, 2)
          }],
        };

      case 'get_supplier_invoice_request':
        if (!args || !args.invoiceRequestId) {
          throw new Error('Missing required parameter: invoiceRequestId');
        }
        const invoiceRequest = await accountsPayableApi.getSupplierInvoiceRequest(createApiConfig(), args.invoiceRequestId as string);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(invoiceRequest, null, 2)
          }],
        };

      case 'create_supplier_invoice_request':
        if (!args || !args.invoiceData) {
          throw new Error('Missing required parameter: invoiceData');
        }
        const createInvoiceResult = await accountsPayableApi.createSupplierInvoiceRequest(createApiConfig(), args.invoiceData as any);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(createInvoiceResult, null, 2)
          }],
        };

      case 'submit_supplier_invoice_request':
        if (!args || !args.invoiceRequestId) {
          throw new Error('Missing required parameter: invoiceRequestId');
        }
        const submitInvoiceResult = await accountsPayableApi.submitSupplierInvoiceRequest(createApiConfig(), args.invoiceRequestId as string);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(submitInvoiceResult, null, 2)
          }],
        };

      case 'get_supplier_invoice_request_lines':
        if (!args || !args.invoiceRequestId) {
          throw new Error('Missing required parameter: invoiceRequestId');
        }
        const invoiceLines = await accountsPayableApi.getSupplierInvoiceRequestLines(createApiConfig(), args.invoiceRequestId as string);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(invoiceLines, null, 2)
          }],
        };

      case 'get_supplier_invoice_request_line':
        if (!args || !args.invoiceRequestId || !args.lineId) {
          throw new Error('Missing required parameters: invoiceRequestId, lineId');
        }
        const invoiceLine = await accountsPayableApi.getSupplierInvoiceRequestLine(createApiConfig(), args.invoiceRequestId as string, args.lineId as string);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(invoiceLine, null, 2)
          }],
        };

      case 'get_supplier_invoice_request_attachments':
        if (!args || !args.invoiceRequestId) {
          throw new Error('Missing required parameter: invoiceRequestId');
        }
        const attachments = await accountsPayableApi.getSupplierInvoiceRequestAttachments(createApiConfig(), args.invoiceRequestId as string);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(attachments, null, 2)
          }],
        };

      case 'get_supplier_invoice_request_attachment':
        if (!args || !args.invoiceRequestId || !args.attachmentId) {
          throw new Error('Missing required parameters: invoiceRequestId, attachmentId');
        }
        const attachment = await accountsPayableApi.getSupplierInvoiceRequestAttachment(createApiConfig(), args.invoiceRequestId as string, args.attachmentId as string);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(attachment, null, 2)
          }],
        };

      case 'create_supplier_invoice_request_attachment':
        if (!args || !args.invoiceRequestId || !args.attachmentData) {
          throw new Error('Missing required parameters: invoiceRequestId, attachmentData');
        }
        const createAttachmentResult = await accountsPayableApi.createSupplierInvoiceRequestAttachment(createApiConfig(), args.invoiceRequestId as string, args.attachmentData);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(createAttachmentResult, null, 2)
          }],
        };

      // ASOR Tools
      case 'get_agent_definitions':
        const agentDefinitions = await asorApi.getAgentDefinitions(createApiConfig());
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(agentDefinitions, null, 2)
          }],
        };

      case 'create_agent_definition':
        if (!args || !args.name || !args.description || !args.version || !args.url || !args.skills) {
          throw new Error('Missing required parameters: name, description, version, url, skills');
        }
        const createAgentResult = await asorApi.createAgentDefinition(createApiConfig(), {
          name: args.name as string,
          description: args.description as string,
          version: args.version as string,
          url: args.url as string,
          skills: (args.skills as string[]).map(skill => ({
            id: skill,
            name: skill,
            description: skill
          })),
        });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(createAgentResult, null, 2)
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
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    service: 'mcp-workday-server'
  });
});

// MCP tools endpoint - returns JSON-RPC format for Flowise compatibility
app.get('/mcp/tools', async (req, res) => {
  try {
    res.json({
      jsonrpc: "2.0",
      result: {
        tools: ALL_TOOLS
      }
    });
  } catch (error) {
    res.status(500).json({
      jsonrpc: "2.0",
      error: {
        code: -32603,
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    });
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

      case 'create_one_time_payment':
        if (!args || !args.workerId || !args.payComponentId || !args.startDate || !args.endDate || !args.amount) {
          throw new Error('Missing required parameters: workerId, payComponentId, startDate, endDate, amount');
        }
        // Note: This function is not yet implemented in the API modules
        result = {
          status: 'error',
          message: 'One-time payment creation is not yet implemented',
          requestedPayment: {
            workerId: args.workerId,
            payComponentId: args.payComponentId,
            startDate: args.startDate,
            endDate: args.endDate,
            amount: args.amount,
            currency: args.currency,
            comment: args.comment,
          }
        };
        break;

      case 'get_job_families':
        const jobFamilies = await staffingApi.getJobFamilies(createApiConfig(), args?.limit ? Number(args.limit) : undefined, args?.offset ? Number(args.offset) : undefined);
        result = jobFamilies;
        break;

      case 'get_job_profiles':
        const jobProfiles = await staffingApi.getJobProfiles(createApiConfig(), args?.limit ? Number(args.limit) : undefined, args?.offset ? Number(args.offset) : undefined);
        result = jobProfiles;
        break;

      case 'get_supervisory_organizations':
        const supervisoryOrgs = await staffingApi.getSupervisoryOrganizations(createApiConfig(), args?.limit ? Number(args.limit) : undefined, args?.offset ? Number(args.offset) : undefined);
        result = supervisoryOrgs;
        break;

      case 'initiate_job_change':
        if (!args || !args.workerId) {
          throw new Error('Missing required parameter: workerId');
        }
        const jobChangeResult = await staffingApi.initiateJobChange(createApiConfig(), args.workerId as string, args.jobChangeData);
        result = jobChangeResult;
        break;

      case 'get_job_change':
        if (!args || !args.jobChangeId) {
          throw new Error('Missing required parameter: jobChangeId');
        }
        const jobChangeInfo = await staffingApi.getJobChange(createApiConfig(), args.jobChangeId as string);
        result = jobChangeInfo;
        break;

      case 'submit_job_change':
        if (!args || !args.jobChangeId) {
          throw new Error('Missing required parameter: jobChangeId');
        }
        const submitResult = await staffingApi.submitJobChange(createApiConfig(), args.jobChangeId as string);
        result = submitResult;
        break;

      case 'list_workers':
        const workersLimit = args?.limit ? Number(args.limit) : 10;
        const workersResult = await staffingApi.getStaffingWorkers(createApiConfig(), workersLimit);
        result = workersResult;
        break;

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// SSE endpoint for MCP protocol
app.get('/mcp/sse', async (req, res) => {
  try {
    console.log('📡 SSE connection requested');

    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
    });

    // Create a new MCP server instance for this SSE connection
    const sseServer = new Server(
      {
        name: 'mcp-server-workday-sse',
        version: '1.0.0',
      }
    );

    // Set up request handlers for the MCP server
    sseServer.setRequestHandler(ListToolsRequestSchema, async () => {
      console.log('📋 Handling tools/list request');
      return {
        tools: ALL_TOOLS,
      };
    });

    sseServer.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      console.log(`🔧 Handling tool call: ${name}`);

      let result;
      try {
        // Handle basic tools (simplified for SSE testing)
        switch (name) {
          case 'check_workday_auth_status':
            result = {
              authenticated: true,
              message: "Authentication check completed successfully"
            };
            break;

          case 'get_workday_worker':
            const { workerId } = args as { workerId?: string };
            result = {
              workerId: workerId || "21001",
              name: "John Doe",
              message: "Worker information retrieved successfully"
            };
            break;

          case 'request_time_off':
            result = {
              requestId: "TO-2024-001",
              status: "Submitted",
              message: "Time off request submitted successfully"
            };
            break;

          default:
            result = {
              message: `Tool '${name}' executed successfully`,
              timestamp: new Date().toISOString()
            };
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }],
        };
      } catch (error) {
        console.error(`Error executing tool ${name}:`, error);
        throw new Error(`Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });

    // For now, just send a basic tools list response
    // This will work with Flowise's simple HTTP requests
    const toolsResponse = {
      jsonrpc: "2.0",
      result: {
        tools: ALL_TOOLS
      }
    };

    res.write(`data: ${JSON.stringify(toolsResponse)}\n\n`);

    console.log('✅ MCP SSE connection established with tools list');

    // Handle client disconnect
    req.on('close', () => {
      console.log('📡 SSE connection closed');
    });

    // Keep connection alive
    const keepAlive = setInterval(() => {
      res.write(': keepalive\n\n');
    }, 30000);

    req.on('close', () => {
      clearInterval(keepAlive);
    });

  } catch (error) {
    console.error('SSE connection error:', error);
    res.status(500).end();
  }
});

// Start server
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 MCP Workday Server running on port ${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/health`);
  console.log(`🔧 MCP REST API: http://localhost:${PORT}/mcp/tools`);
  console.log(`📡 MCP SSE endpoint: http://localhost:${PORT}/mcp/sse`);
  console.log(`🎯 Environment: ${process.env.NODE_ENV || 'development'}`);
}); // Force redeploy
// Force redeploy 2
// Force redeploy 3 - MCP JSON-RPC fix

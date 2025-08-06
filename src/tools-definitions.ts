// =============================================================================
// SHARED TOOL DEFINITIONS FOR MCP SERVER
// =============================================================================
// This file contains all tool definitions organized by API service
// Used by both the main MCP server and HTTP server

// Define tool categories
export const STAFFING_TOOLS = [
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

export const LEARNING_TOOLS = [
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
    description: 'Get learning content information by ID',
    inputSchema: {
      type: 'object',
      properties: {
        learningContentId: {
          type: 'string',
          description: 'Learning content ID to retrieve',
        },
      },
      required: ['learningContentId'],
    },
  },
  {
    name: 'search_learning_content',
    description: 'Search for learning content in Workday',
    inputSchema: {
      type: 'object',
      properties: {
        searchTerm: {
          type: 'string',
          description: 'Search term for learning content',
        },
      },
      required: ['searchTerm'],
    },
  },
];

export const PAYROLL_TOOLS = [
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

export const HCM_AGENT_TOOLS = [
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

export const UTILITY_TOOLS = [
  {
    name: 'check_workday_auth_status',
    description: 'Check current authentication status with Workday',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

// Export all tools combined
export const ALL_TOOLS = [
  ...STAFFING_TOOLS,
  ...LEARNING_TOOLS,
  ...PAYROLL_TOOLS,
  ...HCM_AGENT_TOOLS,
  ...UTILITY_TOOLS,
];
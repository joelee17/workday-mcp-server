/**
 * Workday HCM Agent API - REST API Functions
 * Implements calls to the Workday HCM Agent API endpoints
 */

interface ApiConfig {
  baseUrl: string;
  tenant: string;
  getAccessToken: () => Promise<string>;
}

const HCM_AGENT_BASE_URL = 'https://errodp9n2e.execute-api.us-west-2.amazonaws.com/agent/assistant';

// Helper function to make authenticated API calls
async function makeAuthenticatedRequest(
  config: ApiConfig,
  endpoint: string,
  method: 'GET' | 'POST' = 'GET',
  body?: any
): Promise<any> {
  const accessToken = await config.getAccessToken();
  
  const url = `${HCM_AGENT_BASE_URL}${endpoint}`;
  
  const requestOptions: RequestInit = {
    method,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  };

  if (body && method === 'POST') {
    requestOptions.body = JSON.stringify(body);
  }

  console.error(`[HCM Agent API] Making ${method} request to: ${url}`);
  
  const response = await fetch(url, requestOptions);
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[HCM Agent API] Error response: ${response.status} ${response.statusText} - ${errorText}`);
    throw new Error(`HCM Agent API request failed: ${response.status} ${response.statusText} - ${errorText}`);
  }

  return response.json();
}

/**
 * Search workday data including features, knowledge base articles, etc.
 */
export async function searchAgent(
  config: ApiConfig,
  query: { text: string; intentNames?: string[] }
): Promise<any> {
  return makeAuthenticatedRequest(config, '/v1/search', 'POST', query);
}

/**
 * Get information about direct reports
 */
export async function getDirectReports(config: ApiConfig): Promise<any> {
  return makeAuthenticatedRequest(config, '/v1/team');
}

/**
 * Get learning information about direct reports
 */
export async function getDirectReportsLearnings(config: ApiConfig): Promise<any> {
  return makeAuthenticatedRequest(config, '/v1/team/learnings');
}

/**
 * Get career information about direct reports
 */
export async function getDirectReportsCareer(config: ApiConfig): Promise<any> {
  return makeAuthenticatedRequest(config, '/v1/team/career');
}

/**
 * Get current user's information
 */
export async function getMyInformation(config: ApiConfig): Promise<any> {
  return makeAuthenticatedRequest(config, '/v1/me');
}

/**
 * Get current user's inbox tasks
 */
export async function getMyInboxTasks(config: ApiConfig): Promise<any> {
  return makeAuthenticatedRequest(config, '/v1/me/tasks');
}

/**
 * Get current user's payslip information
 */
export async function getMyPayslipInformation(config: ApiConfig): Promise<any> {
  return makeAuthenticatedRequest(config, '/v1/me/payroll/payslip');
}

/**
 * Get current user's career information
 */
export async function getMyCareerInformation(config: ApiConfig): Promise<any> {
  return makeAuthenticatedRequest(config, '/v1/me/career');
}

/**
 * Get current user's calendar information
 */
export async function getMyCalendarInformation(
  config: ApiConfig,
  monthsFromNow?: number
): Promise<any> {
  const queryParam = monthsFromNow ? `?monthsFromNow=${monthsFromNow}` : '';
  return makeAuthenticatedRequest(config, `/v1/me/calendar${queryParam}`);
}

/**
 * Get current user's time off balances
 */
export async function getMyTimeOffBalances(
  config: ApiConfig,
  asOfDate?: string
): Promise<any> {
  const queryParam = asOfDate ? `?asOfDate=${encodeURIComponent(asOfDate)}` : '';
  return makeAuthenticatedRequest(config, `/v1/me/absence/balances${queryParam}`);
}

/**
 * Lookup coworker information
 */
export async function lookupCoworker(
  config: ApiConfig,
  nameSearch: string
): Promise<any> {
  const queryParam = `?nameSearch=${encodeURIComponent(nameSearch)}`;
  return makeAuthenticatedRequest(config, `/v1/lookup/coworker${queryParam}`);
} 
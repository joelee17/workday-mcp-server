import * as https from 'https';
import { IncomingMessage } from 'http';

interface WorkdayConfig {
  baseUrl: string;
  tenant: string;
  getAccessToken: () => Promise<string>;
}

// Helper function to make HTTP requests
function makeHttpRequest(options: any, body?: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res: IncomingMessage) => {
      let data = '';
      res.on('data', (chunk: any) => data += chunk);
      res.on('end', () => {
        try {
          const response = res.statusCode === 204 ? {} : JSON.parse(data);
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve(response);
          } else {
            reject(new Error(`API error (${res.statusCode}): ${response.error || data}`));
          }
        } catch (error) {
          reject(new Error(`Failed to parse response: ${error instanceof Error ? error.message : 'Unknown error'}`));
        }
      });
    });

    req.on('error', (error: Error) => {
      reject(new Error(`Request error: ${error.message}`));
    });

    if (body) {
      req.write(body);
    }
    req.end();
  });
}

// Get agent definitions
export async function getAgentDefinitions(
  config: WorkdayConfig
): Promise<any> {
  const accessToken = await config.getAccessToken();
  const url = `${config.baseUrl}/ccx/api/asor/v1/${config.tenant}/agentDefinition`;

  const options = {
    hostname: new URL(url).hostname,
    port: 443,
    path: new URL(url).pathname,
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
    }
  };

  return makeHttpRequest(options);
}

// Create or update agent definition
export async function createAgentDefinition(
  config: WorkdayConfig,
  agentDefinition: {
    name: string;
    description: string;
    version: string;
    url: string;
    skills: Array<{
      id: string;
      name: string;
      description: string;
      tags?: Array<{ tag: string }>;
      inputModes?: Array<{ type: string }>;
      outputModes?: Array<{ type: string }>;
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
    defaultInputModes?: Array<{ type: string }>;
    defaultOutputModes?: Array<{ type: string }>;
    supportsAuthenticatedExtendedCard?: boolean;
    workdayConfig?: Array<{
      skillId: string;
      executionMode?: { mode: string };
      workdayResources?: Array<{
        tool?: { id: string };
        operation?: string;
        description?: string;
      }>;
    }>;
  }
): Promise<any> {
  const accessToken = await config.getAccessToken();
  const url = `${config.baseUrl}/ccx/api/asor/v1/${config.tenant}/agentDefinition`;

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

  return makeHttpRequest(options, JSON.stringify(agentDefinition));
} 
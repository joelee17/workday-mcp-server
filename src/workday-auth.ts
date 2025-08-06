/**
 * Workday OAuth Authentication Module
 * Handles dynamic token retrieval using environment variables
 */

interface WorkdayTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
}

interface WorkdayAuthConfig {
  clientId: string;
  clientSecret: string;
  tokenEndpoint: string;
  baseUrl: string;
  tenant: string;
  redirectUri: string;
  bearerToken?: string;
  accessToken?: string;
}

class WorkdayAuth {
  private config: WorkdayAuthConfig;
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;

  constructor() {
    this.config = {
      clientId: process.env.WORKDAY_CLIENT_ID || '',
      clientSecret: process.env.WORKDAY_CLIENT_SECRET || '',
      tokenEndpoint: process.env.WORKDAY_TOKEN_ENDPOINT || '',
      baseUrl: process.env.WORKDAY_BASE_URL || '',
      tenant: process.env.WORKDAY_TENANT || '',
      redirectUri: process.env.WORKDAY_REDIRECT_URI || '',
      bearerToken: process.env.WORKDAY_BEARER_TOKEN,
      accessToken: process.env.WORKDAY_ACCESS_TOKEN
    };
  }

  /**
   * Get a valid access token (retrieves new one if expired)
   */
  async getAccessToken(): Promise<string> {
    // Priority order: WORKDAY_ACCESS_TOKEN > WORKDAY_BEARER_TOKEN > OAuth flow
    
    // If we have a pre-configured access token, use it (highest priority)
    if (this.config.accessToken) {
      console.log('✅ Using WORKDAY_ACCESS_TOKEN environment variable');
      return this.config.accessToken;
    }
    
    // If we have a pre-configured bearer token, use it
    if (this.config.bearerToken) {
      console.log('✅ Using WORKDAY_BEARER_TOKEN environment variable');
      return this.config.bearerToken;
    }

    // Check if current token is still valid
    if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.accessToken;
    }

    // Get a new token via OAuth
    return await this.refreshAccessToken();
  }

  /**
   * Get a fresh access token using Client Credentials flow
   */
  async refreshAccessToken(): Promise<string> {
    if (!this.config.clientId || !this.config.clientSecret || !this.config.tokenEndpoint) {
      throw new Error('Missing required OAuth configuration. Please set WORKDAY_CLIENT_ID, WORKDAY_CLIENT_SECRET, and WORKDAY_TOKEN_ENDPOINT');
    }

    const credentials = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64');
    
    const response = await fetch(this.config.tokenEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: new URLSearchParams({
        'grant_type': 'client_credentials',
        'scope': 'system'
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OAuth token request failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const tokenData = await response.json() as WorkdayTokenResponse;
    
    // Store the token and calculate expiry (subtract 5 minutes for safety)
    this.accessToken = tokenData.access_token;
    this.tokenExpiry = new Date(Date.now() + (tokenData.expires_in - 300) * 1000);

    console.log(`✅ New Workday access token obtained, expires at: ${this.tokenExpiry.toISOString()}`);
    
    return this.accessToken;
  }

  /**
   * Get authorization header for API requests
   */
  async getAuthHeader(): Promise<string> {
    const token = await this.getAccessToken();
    return `Bearer ${token}`;
  }

  /**
   * Check authentication status
   */
  async checkAuthStatus(): Promise<{
    isAuthenticated: boolean;
    tokenType: 'access_token' | 'bearer' | 'oauth';
    expiresAt?: string;
    tenant: string;
    baseUrl: string;
    hasRequiredConfig: boolean;
    tokenSource: string;
  }> {
    // Check if we have any form of authentication configured
    const hasAccessToken = !!this.config.accessToken;
    const hasBearerToken = !!this.config.bearerToken;
    const hasOAuthConfig = !!(this.config.clientId && this.config.clientSecret && this.config.tokenEndpoint);
    const hasRequiredConfig = hasAccessToken || hasBearerToken || hasOAuthConfig;

    if (!hasRequiredConfig) {
      return {
        isAuthenticated: false,
        tokenType: 'oauth',
        tenant: this.config.tenant,
        baseUrl: this.config.baseUrl,
        hasRequiredConfig: false,
        tokenSource: 'none'
      };
    }

    try {
      const token = await this.getAccessToken();
      let tokenType: 'access_token' | 'bearer' | 'oauth';
      let tokenSource: string;
      
      if (this.config.accessToken) {
        tokenType = 'access_token';
        tokenSource = 'WORKDAY_ACCESS_TOKEN environment variable';
      } else if (this.config.bearerToken) {
        tokenType = 'bearer';
        tokenSource = 'WORKDAY_BEARER_TOKEN environment variable';
      } else {
        tokenType = 'oauth';
        tokenSource = 'OAuth Client Credentials flow';
      }
      
      return {
        isAuthenticated: !!token,
        tokenType,
        expiresAt: this.tokenExpiry?.toISOString(),
        tenant: this.config.tenant,
        baseUrl: this.config.baseUrl,
        hasRequiredConfig: true,
        tokenSource
      };
    } catch (error) {
      console.error('Authentication check failed:', error);
      return {
        isAuthenticated: false,
        tokenType: 'oauth',
        tenant: this.config.tenant,
        baseUrl: this.config.baseUrl,
        hasRequiredConfig: true,
        tokenSource: 'authentication_failed'
      };
    }
  }

  /**
   * Build full Workday API URL
   */
  buildApiUrl(endpoint: string): string {
    const baseUrl = this.config.baseUrl.replace(/\/$/, ''); // Remove trailing slash
    const tenant = this.config.tenant;
    
    if (endpoint.startsWith('/')) {
      endpoint = endpoint.substring(1);
    }
    
    return `${baseUrl}/ccx/api/privacy/v1/${tenant}/${endpoint}`;
  }

  /**
   * Make authenticated request to Workday API
   */
  async makeAuthenticatedRequest(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const authHeader = await this.getAuthHeader();
    const url = this.buildApiUrl(endpoint);
    
    const requestOptions: RequestInit = {
      ...options,
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...options.headers
      }
    };

    console.log(`🌐 Making authenticated request to: ${url}`);
    
    const response = await fetch(url, requestOptions);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Workday API request failed: ${response.status} ${response.statusText} - ${errorText}`);
    }
    
    return response;
  }
}

// Export singleton instance
export const workdayAuth = new WorkdayAuth();
export { WorkdayAuth };
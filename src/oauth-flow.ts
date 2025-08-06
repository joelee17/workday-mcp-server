/**
 * OAuth Authorization Flow for Workday MCP Server
 * Handles user authorization with popup window and callback handling
 */

import crypto from 'crypto';
import { workdayAuth } from './workday-auth.js';

interface AuthState {
  state: string;
  codeVerifier: string;
  redirectUri: string;
  timestamp: number;
}

class OAuthFlow {
  private pendingAuth: Map<string, AuthState> = new Map();
  private readonly STATE_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

  /**
   * Generate authorization URL for OAuth popup
   */
  generateAuthUrl(baseUrl?: string): {
    authUrl: string;
    state: string;
  } {
    const config = this.getOAuthConfig();
    
    // Generate PKCE parameters
    const codeVerifier = this.generateCodeVerifier();
    const codeChallenge = this.generateCodeChallenge(codeVerifier);
    const state = crypto.randomBytes(16).toString('hex');
    
    // Determine redirect URI based on deployment
    const redirectUri = baseUrl 
      ? `${baseUrl}/oauth/callback`
      : `https://mcp-workday-server.onrender.com/oauth/callback`;
    
    // Store auth state
    this.pendingAuth.set(state, {
      state,
      codeVerifier,
      redirectUri,
      timestamp: Date.now()
    });
    
    // Build authorization URL
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: config.clientId,
      redirect_uri: redirectUri,
      scope: 'system',
      state: state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256'
    });
    
    const authUrl = `${config.authEndpoint}?${params.toString()}`;
    
    console.log(`🔐 Generated OAuth URL for state ${state}`);
    
    return { authUrl, state };
  }

  /**
   * Handle OAuth callback and exchange code for token
   */
  async handleCallback(code: string, state: string): Promise<{
    success: boolean;
    accessToken?: string;
    error?: string;
  }> {
    // Validate state
    const authState = this.pendingAuth.get(state);
    if (!authState) {
      return { success: false, error: 'Invalid or expired state parameter' };
    }
    
    // Check expiry
    if (Date.now() - authState.timestamp > this.STATE_EXPIRY_MS) {
      this.pendingAuth.delete(state);
      return { success: false, error: 'Authorization request expired' };
    }
    
    try {
      const config = this.getOAuthConfig();
      
      // Exchange code for token
      const tokenResponse = await fetch(config.tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: config.clientId,
          client_secret: config.clientSecret,
          code: code,
          redirect_uri: authState.redirectUri,
          code_verifier: authState.codeVerifier
        })
      });
      
      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error('Token exchange failed:', errorText);
        return { 
          success: false, 
          error: `Token exchange failed: ${tokenResponse.status} ${errorText}` 
        };
      }
      
      const tokenData = await tokenResponse.json() as any;
      
      // Store token in workdayAuth for future use
      await this.storeToken(tokenData.access_token, tokenData.expires_in);
      
      // Clean up
      this.pendingAuth.delete(state);
      
      console.log('✅ OAuth flow completed successfully');
      
      return { 
        success: true, 
        accessToken: tokenData.access_token 
      };
      
    } catch (error) {
      console.error('OAuth callback error:', error);
      this.pendingAuth.delete(state);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Generate PKCE code verifier
   */
  private generateCodeVerifier(): string {
    return crypto.randomBytes(32).toString('base64url');
  }

  /**
   * Generate PKCE code challenge
   */
  private generateCodeChallenge(verifier: string): string {
    return crypto
      .createHash('sha256')
      .update(verifier)
      .digest('base64url');
  }

  /**
   * Get OAuth configuration from environment
   */
  private getOAuthConfig() {
    const clientId = process.env.WORKDAY_CLIENT_ID;
    const clientSecret = process.env.WORKDAY_CLIENT_SECRET;
    const authEndpoint = process.env.WORKDAY_AUTH_ENDPOINT;
    const tokenEndpoint = process.env.WORKDAY_TOKEN_ENDPOINT;
    
    if (!clientId || !clientSecret || !authEndpoint || !tokenEndpoint) {
      throw new Error('Missing required OAuth configuration: WORKDAY_CLIENT_ID, WORKDAY_CLIENT_SECRET, WORKDAY_AUTH_ENDPOINT, WORKDAY_TOKEN_ENDPOINT');
    }
    
    return {
      clientId,
      clientSecret,
      authEndpoint,
      tokenEndpoint
    };
  }

  /**
   * Store token for future use (you might want to encrypt this)
   */
  private async storeToken(accessToken: string, expiresIn: number): Promise<void> {
    // For now, just set as environment variable
    // In production, you'd want to store this securely per user
    process.env.WORKDAY_BEARER_TOKEN = accessToken;
    
    // You could also store in a database with user ID association
    console.log(`🔐 Stored access token, expires in ${expiresIn} seconds`);
  }

  /**
   * Clean up expired auth states
   */
  cleanupExpiredStates(): void {
    const now = Date.now();
    for (const [state, authState] of this.pendingAuth.entries()) {
      if (now - authState.timestamp > this.STATE_EXPIRY_MS) {
        this.pendingAuth.delete(state);
      }
    }
  }

  /**
   * Get popup window JavaScript for frontend
   */
  getPopupScript(authUrl: string): string {
    return `
    <script>
      function openOAuthPopup() {
        const popup = window.open(
          '${authUrl}', 
          'workday-oauth',
          'width=600,height=700,scrollbars=yes,resizable=yes'
        );
        
        // Poll for popup closure
        const pollTimer = setInterval(() => {
          try {
            if (popup.closed) {
              clearInterval(pollTimer);
              // Refresh parent window to check auth status
              window.location.reload();
            }
          } catch (e) {
            // Cross-origin error means popup is still open
          }
        }, 1000);
        
        return false;
      }
    </script>
    `;
  }
}

export const oauthFlow = new OAuthFlow();
export { OAuthFlow };
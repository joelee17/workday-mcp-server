const https = require('https');
const fs = require('fs');

// Load environment variables from .env file
const env = {};
try {
  const envFile = fs.readFileSync('.env', 'utf8');
  envFile.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) {
      env[key.trim()] = value.trim();
    }
  });
} catch (error) {
  console.error('Error reading .env file:', error.message);
  process.exit(1);
}

async function getAccessToken() {
  return new Promise((resolve, reject) => {
    const clientId = env.WORKDAY_CLIENT_ID;
    const clientSecret = env.WORKDAY_CLIENT_SECRET;
    const tokenEndpoint = env.WORKDAY_TOKEN_ENDPOINT;
    
    if (!clientId || !clientSecret || !tokenEndpoint) {
      reject(new Error('Missing required OAuth credentials in .env file'));
      return;
    }

    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const postData = 'grant_type=client_credentials';
    
    const url = new URL(tokenEndpoint);
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
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
          if (res.statusCode === 200 && response.access_token) {
            console.log('✅ Successfully obtained access token');
            console.log('Token:', response.access_token);
            console.log('Expires in:', response.expires_in, 'seconds');
            resolve(response.access_token);
          } else {
            console.error('❌ OAuth Error:', response);
            reject(new Error(`OAuth failed: ${JSON.stringify(response)}`));
          }
        } catch (error) {
          console.error('❌ Failed to parse response:', data);
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ Request error:', error.message);
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

// Run the token refresh
getAccessToken().catch(error => {
  console.error('Failed to get access token:', error.message);
  process.exit(1);
}); 
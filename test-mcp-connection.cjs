const { spawn } = require('child_process');

console.log('🧪 Testing MCP Connection...\n');

// Start the MCP server
const server = spawn('/usr/local/bin/node', ['dist/index.js'], {
  cwd: '/Users/joe.lee/workday-mcp',
  stdio: ['pipe', 'pipe', 'pipe'],
  env: {
    ...process.env,
    WORKDAY_BEARER_TOKEN: process.env.WORKDAY_BEARER_TOKEN || 'eyJ4NXQjUzI1NiI6Im5nd01GbGRFTi1MZnhJZEJzQ1dQSHpzcFlhWm1DQlo1dHk4ZGZkSFdYWWciLCJ0eXAiOiJhdCtKV1QiLCJraWQiOiJuZ3dNRmxkRU4tTGZ4SWRCc0NXUEh6c3BZYVptQ0JaNXR5OGRmZEhXWFlnIiwiYWxnIjoiUlM1MTIifQ.eyJzdWIiOiJiYjUwNjFjNTFkYTgxMDBlNTAwZmJjMzIzZGFiMDAwMCIsImV4cCI6MTc1MjYxNDgyNSwiaWF0IjoxNzUyNjAwNDI1LCJhdWQiOiJodHRwczovL3djcGRldi1zZXJ2aWNlczEud2QxMDEubXl3b3JrZGF5LmNvbS9jY3gvIiwianRpIjoiWldWMFoyeDNkbmw1TUhFNU1YUnpPV3hzTWpadWMyOTRjbVp2YUd0aFltRjVZamh5YkRVMFpuRnpZWHBrWm01bmJ6Sm9hWE4zTnpBeWFHNW5PR041YzNaeGVHVjNiV0o1Y3pNMVlXTnZjMk40TVc5Mk9XdHNhMloyWjJOclltRjBaMjh1TnpGa09ERmlPVEl0TldGaE5DMDBaVE0xTFRneFpUUXROV1JsWlRBM1pHSmxNalJpIiwiaXNzIjoiaHR0cHM6Ly93Y3BkZXYtc2VydmljZXMxLndkMTAxLm15d29ya2RheS5jb20vY2N4L2FwaS92MS93ZGF5X3djcGRldjExIiwic2NvcGUiOiJvYXV0aCIsImVudiI6IldEMTAxLVdDUERFViIsInRlbmFudCI6IndkYXlfd2NwZGV2MTEiLCJjbGllbnRfaWQiOiJOR1UwWXpnM1lXTXRaVFF4WXkwMFpHVTVMVGsxT0RFdE9ERTJPR1prTUdGallqaGwiLCJhY3QiOnsic3ViIjoiIn19.m6xKlhqd0o-z8VUEozDCrwu4mJM1dS8qv8b8Cvc4PosXxdO3tzdwsJaRHrccLWHQWexQyxdbj8RFrajQ0vUvzppTAEcueyBg7iYHf1THFTJeJNu5gG4Ei9j3hB5PrIGidDAr2eM66ucbJ1w8bHHx6c2zRWpKHG3eVoS3UcrtTC2gNUGcaDOnGQ-4Mn-gDSE8fzlb4UGcps6rUKGCqza69PdHcvix-8-DOhR7rsYL21QgbuWktStwWtihY3GApjKsLfVeakSr4wjbDvfteaVr3_ztBR0ArGNPhMRJ-zqtK1ORrAoUC-CfzIY-xa5kB7gS4g4VUtlLvb-3aKejnBHl7A',
    WORKDAY_TENANT: 'wday_wcpdev11',
    WORKDAY_BASE_URL: 'https://wcpdev-services1.wd101.myworkday.com'
  }
});

// Test MCP initialization
const initRequest = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2024-11-05",
    capabilities: {
      tools: {}
    },
    clientInfo: {
      name: "test-client",
      version: "1.0.0"
    }
  }
};

// Test tools list
const toolsRequest = {
  jsonrpc: "2.0",
  id: 2,
  method: "tools/list",
  params: {}
};

let responses = [];
let errorOutput = '';

server.stdout.on('data', (data) => {
  const lines = data.toString().split('\n').filter(line => line.trim());
  lines.forEach(line => {
    try {
      const response = JSON.parse(line);
      responses.push(response);
      console.log('✅ Response:', JSON.stringify(response, null, 2));
    } catch (e) {
      console.log('📝 Output:', line);
    }
  });
});

server.stderr.on('data', (data) => {
  errorOutput += data.toString();
  console.log('🔍 Stderr:', data.toString());
});

server.on('close', (code) => {
  console.log(`\n🏁 Server closed with code: ${code}`);
  if (errorOutput) {
    console.log('❌ Error output:', errorOutput);
  }
  console.log(`\n📊 Total responses received: ${responses.length}`);
});

// Send initialization
setTimeout(() => {
  console.log('📤 Sending initialize request...');
  server.stdin.write(JSON.stringify(initRequest) + '\n');
}, 1000);

// Send tools list request
setTimeout(() => {
  console.log('📤 Sending tools/list request...');
  server.stdin.write(JSON.stringify(toolsRequest) + '\n');
}, 2000);

// Cleanup
setTimeout(() => {
  console.log('🔚 Terminating server...');
  server.kill('SIGTERM');
}, 5000); 
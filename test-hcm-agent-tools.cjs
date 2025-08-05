const { spawn } = require('child_process');

console.log('🧪 Testing HCM Agent Tools Registration...\n');

// Start the MCP server
const server = spawn('node', ['dist/index.js'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

let testResults = [];

// Function to send MCP message and get response
function sendMCPMessage(message) {
  return new Promise((resolve, reject) => {
    let responseData = '';
    const timeout = setTimeout(() => {
      reject(new Error('Test timeout'));
    }, 10000);
    
    const dataHandler = (data) => {
      responseData += data.toString();
      const lines = responseData.split('\n');
      for (const line of lines) {
        if (line.trim()) {
          try {
            const response = JSON.parse(line);
            clearTimeout(timeout);
            server.stdout.removeListener('data', dataHandler);
            resolve(response);
            return;
          } catch (e) {
            // Continue if not valid JSON
          }
        }
      }
    };

    server.stdout.on('data', dataHandler);
    server.stdin.write(JSON.stringify(message) + '\n');
  });
}

// Test HCM Agent tools registration
async function testHCMAgentTools() {
  try {
    // Wait for server startup
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log('1. Testing MCP Server Initialization...');
    const initResponse = await sendMCPMessage({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'test-client', version: '1.0.0' }
      }
    });
    
    if (initResponse.result && initResponse.result.capabilities) {
      console.log('✅ MCP Server initialized successfully');
    } else {
      console.log('❌ MCP Server initialization failed');
      return;
    }

    console.log('\n2. Testing HCM Agent Tools List...');
    const toolsResponse = await sendMCPMessage({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {}
    });
    
    if (toolsResponse.result && toolsResponse.result.tools) {
      const tools = toolsResponse.result.tools;
      console.log(`✅ Found ${tools.length} total tools available`);
      
      // Check for HCM Agent tools specifically
      const hcmAgentTools = tools.filter(tool => 
        tool.name.includes('search_workday_agent') ||
        tool.name.includes('get_direct_reports') ||
        tool.name.includes('get_my_') ||
        tool.name.includes('lookup_coworker')
      );
      
      console.log(`\n📋 HCM Agent Tools Found (${hcmAgentTools.length}):`);
      hcmAgentTools.forEach((tool, index) => {
        console.log(`   ${index + 1}. ${tool.name} - ${tool.description}`);
      });
      
      if (hcmAgentTools.length > 0) {
        console.log('\n✅ HCM Agent tools are properly registered!');
      } else {
        console.log('\n❌ No HCM Agent tools found');
      }
    } else {
      console.log('❌ Failed to get tools list');
    }
    
  } catch (error) {
    console.error('💥 Test failed:', error.message);
  } finally {
    server.kill();
    process.exit(0);
  }
}

// Handle server startup
server.stdout.on('data', (data) => {
  const output = data.toString();
  if (output.includes('Starting with refresh token authentication')) {
    console.log('🚀 MCP Server started successfully\n');
    testHCMAgentTools();
  }
});

server.stderr.on('data', (data) => {
  // Suppress server stderr output for cleaner test results
});

server.on('close', (code) => {
  console.log(`\n🔚 Test completed`);
});

console.log('⏳ Starting MCP server...'); 
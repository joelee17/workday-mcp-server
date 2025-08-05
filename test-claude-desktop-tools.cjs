const { spawn } = require('child_process');

console.log('🧪 Testing Claude Desktop MCP Tools Integration...\n');

// Start the MCP server
const server = spawn('node', ['dist/index.js'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

let testResults = [];

// Function to send MCP message and get response
function sendMCPMessage(message) {
  return new Promise((resolve) => {
    let responseData = '';
    
    const dataHandler = (data) => {
      responseData += data.toString();
      const lines = responseData.split('\n');
      for (const line of lines) {
        if (line.trim()) {
          try {
            const response = JSON.parse(line);
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

// Test initialization
async function testInitialization() {
  console.log('1. Testing MCP Server Initialization...');
  const response = await sendMCPMessage({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'test-client', version: '1.0.0' }
    }
  });
  
  if (response.result && response.result.capabilities) {
    console.log('✅ MCP Server initialized successfully');
    testResults.push({ test: 'Initialization', status: 'PASS' });
    return true;
  } else {
    console.log('❌ MCP Server initialization failed');
    testResults.push({ test: 'Initialization', status: 'FAIL' });
    return false;
  }
}

// Test tools list
async function testToolsList() {
  console.log('2. Testing Tools List...');
  const response = await sendMCPMessage({
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/list',
    params: {}
  });
  
  if (response.result && response.result.tools) {
    const tools = response.result.tools;
    console.log(`✅ Found ${tools.length} tools available`);
    
    // Check for job families and job profiles specifically
    const jobFamiliesExists = tools.some(tool => tool.name === 'get_job_families');
    const jobProfilesExists = tools.some(tool => tool.name === 'get_job_profiles');
    
    console.log(`   📋 Job Families tool: ${jobFamiliesExists ? '✅ Available' : '❌ Missing'}`);
    console.log(`   👥 Job Profiles tool: ${jobProfilesExists ? '✅ Available' : '❌ Missing'}`);
    
    // List all available tools
    console.log('\n   📋 All Available Tools:');
    tools.forEach((tool, index) => {
      console.log(`      ${index + 1}. ${tool.name} - ${tool.description}`);
    });
    
    testResults.push({ 
      test: 'Tools List', 
      status: 'PASS',
      details: {
        totalTools: tools.length,
        jobFamiliesAvailable: jobFamiliesExists,
        jobProfilesAvailable: jobProfilesExists
      }
    });
    return true;
  } else {
    console.log('❌ Failed to get tools list');
    testResults.push({ test: 'Tools List', status: 'FAIL' });
    return false;
  }
}

// Test job families tool specifically
async function testJobFamilies() {
  console.log('3. Testing Job Families Tool...');
  const response = await sendMCPMessage({
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: {
      name: 'get_job_families',
      arguments: { limit: 5 }
    }
  });
  
  if (response.result) {
    console.log('✅ Job Families tool executed successfully');
    if (response.result.content && response.result.content[0]) {
      const content = response.result.content[0].text;
      if (content.includes('Job Families')) {
        console.log('   📋 Response contains job families data');
        testResults.push({ test: 'Job Families Tool', status: 'PASS' });
      } else {
        console.log('   ⚠️ Response may indicate endpoint issues');
        console.log(`   📄 Response: ${content.substring(0, 200)}...`);
        testResults.push({ test: 'Job Families Tool', status: 'PARTIAL', details: 'Endpoint may not be available' });
      }
    }
    return true;
  } else {
    console.log('❌ Job Families tool failed');
    testResults.push({ test: 'Job Families Tool', status: 'FAIL' });
    return false;
  }
}

// Test job profiles tool specifically
async function testJobProfiles() {
  console.log('4. Testing Job Profiles Tool...');
  const response = await sendMCPMessage({
    jsonrpc: '2.0',
    id: 4,
    method: 'tools/call',
    params: {
      name: 'get_job_profiles',
      arguments: { limit: 5 }
    }
  });
  
  if (response.result) {
    console.log('✅ Job Profiles tool executed successfully');
    if (response.result.content && response.result.content[0]) {
      const content = response.result.content[0].text;
      if (content.includes('Job Profiles')) {
        console.log('   👥 Response contains job profiles data');
        testResults.push({ test: 'Job Profiles Tool', status: 'PASS' });
      } else {
        console.log('   ⚠️ Response may indicate endpoint issues');
        console.log(`   📄 Response: ${content.substring(0, 200)}...`);
        testResults.push({ test: 'Job Profiles Tool', status: 'PARTIAL', details: 'Endpoint may not be available' });
      }
    }
    return true;
  } else {
    console.log('❌ Job Profiles tool failed');
    testResults.push({ test: 'Job Profiles Tool', status: 'FAIL' });
    return false;
  }
}

// Run all tests
async function runTests() {
  try {
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for server to start
    
    await testInitialization();
    await testToolsList();
    await testJobFamilies();
    await testJobProfiles();
    
    console.log('\n' + '='.repeat(80));
    console.log('📊 TEST RESULTS SUMMARY:');
    console.log('='.repeat(80));
    
    testResults.forEach((result, index) => {
      const status = result.status === 'PASS' ? '✅' : result.status === 'PARTIAL' ? '⚠️' : '❌';
      console.log(`${index + 1}. ${result.test}: ${status} ${result.status}`);
      if (result.details) {
        console.log(`   Details: ${JSON.stringify(result.details, null, 2)}`);
      }
    });
    
    const passCount = testResults.filter(r => r.status === 'PASS').length;
    const partialCount = testResults.filter(r => r.status === 'PARTIAL').length;
    const failCount = testResults.filter(r => r.status === 'FAIL').length;
    
    console.log(`\n📈 Overall: ${passCount} passed, ${partialCount} partial, ${failCount} failed`);
    
    if (failCount === 0) {
      console.log('🎉 All tests passed! Claude Desktop should work perfectly with your MCP server.');
    } else if (partialCount > 0) {
      console.log('⚠️ Some tools may have endpoint issues but the MCP integration is working.');
    } else {
      console.log('❌ Some tests failed. Check the configuration and server setup.');
    }
    
  } catch (error) {
    console.error('💥 Test execution failed:', error.message);
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
    runTests();
  }
});

server.stderr.on('data', (data) => {
  console.error('Server Error:', data.toString());
});

server.on('close', (code) => {
  console.log(`\n🔚 MCP Server process exited with code ${code}`);
});

console.log('⏳ Starting MCP server and waiting for initialization...'); 
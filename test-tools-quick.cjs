const { spawn } = require('child_process');

console.log('🔍 Quick Tool Check...');

const server = spawn('node', ['dist/index.js'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

let hasStarted = false;
let hasSentInit = false;

// Set a timeout to kill the process if it takes too long
const timeout = setTimeout(() => {
  console.log('⏰ Timeout - killing process');
  server.kill();
  process.exit(1);
}, 15000);

server.stdout.on('data', (data) => {
  const output = data.toString();
  
  if (output.includes('Starting with refresh token authentication') && !hasStarted) {
    hasStarted = true;
    console.log('✅ Server started, sending initialize...');
    
    // Send initialize message
    server.stdin.write(JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'test', version: '1.0.0' }
      }
    }) + '\n');
    hasSentInit = true;
  }
  
  // Look for the initialize response
  if (hasSentInit && output.includes('"result"')) {
    console.log('✅ Initialize response received, requesting tools...');
    
    // Send tools list request
    server.stdin.write(JSON.stringify({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {}
    }) + '\n');
  }
  
  // Look for tools response
  if (output.includes('"tools"') && output.includes('search_workday_agent')) {
    console.log('🎉 SUCCESS: HCM Agent tools found!');
    clearTimeout(timeout);
    server.kill();
    process.exit(0);
  } else if (output.includes('"tools"') && !output.includes('search_workday_agent')) {
    console.log('❌ Tools found but no HCM Agent tools');
    const toolsMatch = output.match(/"tools":\s*\[([^\]]+)\]/);
    if (toolsMatch) {
      console.log('Available tools snippet:', toolsMatch[1].substring(0, 200) + '...');
    }
    clearTimeout(timeout);
    server.kill();
    process.exit(1);
  }
});

server.stderr.on('data', (data) => {
  // Suppress stderr to avoid clutter
});

server.on('close', (code) => {
  clearTimeout(timeout);
  if (code !== 0) {
    console.log(`❌ Process exited with code ${code}`);
  }
});

console.log('⏳ Starting server...'); 
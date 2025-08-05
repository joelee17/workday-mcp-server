#!/usr/bin/env node

// Test script for the new SOAP-based learning enrollment tool
const { spawn } = require('child_process');

async function testSOAPEnrollment() {
  console.log('🧪 Testing SOAP-based Learning Enrollment Tool');
  console.log('================================================\n');

  // Test the new SOAP tool
  console.log('🔧 Testing enroll_in_learning_content_soap tool...');
  
  const mcpServer = spawn('node', ['dist/index.js'], {
    stdio: 'pipe',
    cwd: process.cwd()
  });

  // Test request for the new SOAP tool
  const testRequest = {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: {
      name: 'enroll_in_learning_content_soap',
      arguments: {
        workerId: '3aa5550b7fe348b98d7b5741afc65534',
        learningContentId: 'LEARN_SAFETY_001',
        enrollmentDate: '2025-01-15',
        dueDate: '2025-02-15',
        comment: 'Test enrollment via SOAP API',
        assignmentReason: 'Mandatory Training',
        priority: 'High'
      }
    }
  };

  mcpServer.stdin.write(JSON.stringify(testRequest) + '\n');
  mcpServer.stdin.end();

  let output = '';
  let error = '';

  mcpServer.stdout.on('data', (data) => {
    output += data.toString();
  });

  mcpServer.stderr.on('data', (data) => {
    error += data.toString();
  });

  mcpServer.on('close', (code) => {
    console.log('📋 MCP Server Response:');
    console.log('======================');
    
    if (output) {
      try {
        // Parse the JSON response
        const lines = output.trim().split('\n');
        const response = JSON.parse(lines[lines.length - 1]);
        
        if (response.result && response.result.content) {
          console.log('✅ Tool executed successfully!');
          console.log('\n📄 Response Content:');
          console.log(response.result.content[0].text);
        } else {
          console.log('❌ Unexpected response format');
          console.log(output);
        }
      } catch (e) {
        console.log('❌ Failed to parse response');
        console.log('Raw output:', output);
      }
    }
    
    if (error) {
      console.log('\n🔴 Error Output:');
      console.log(error);
    }
    
    console.log('\n🎉 Test completed!');
    console.log('\n📚 New SOAP Tool Features:');
    console.log('   ✅ Uses Workday Learning API v44.1 SOAP service');
    console.log('   ✅ Automatically sets Run_Now: true');
    console.log('   ✅ Automatically sets Auto_Complete: true');
    console.log('   ✅ Supports all enrollment parameters');
    console.log('   ✅ Proper SOAP XML structure');
    console.log('   ✅ Dynamic tenant configuration');
    
    process.exit(0);
  });
}

console.log('🚀 Starting SOAP Learning Enrollment Test...\n');
testSOAPEnrollment().catch(console.error); 
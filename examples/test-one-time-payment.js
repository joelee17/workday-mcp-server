#!/usr/bin/env node

/**
 * Test script for Workday One-Time Payment SOAP API tools
 * 
 * This script demonstrates how to test the new one-time payment tools
 * in a development environment.
 */

const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
const { spawn } = require('child_process');

async function testOneTimePaymentTools() {
  console.log('🧪 Testing Workday One-Time Payment SOAP Tools');
  console.log('==============================================');

  try {
    // Start the MCP server
    console.log('📡 Starting MCP server...');
    const serverProcess = spawn('node', ['dist/index.js'], {
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe']
    });

    const transport = new StdioClientTransport({
      reader: serverProcess.stdout,
      writer: serverProcess.stdin
    });

    // Create client and connect
    const client = new Client(
      { name: 'test-client', version: '1.0.0' },
      { capabilities: {} }
    );

    await client.connect(transport);
    console.log('✅ Connected to MCP server');

    // List available tools
    console.log('📋 Listing available tools...');
    const { tools } = await client.listTools();
    
    const paymentTools = tools.filter(tool => 
      tool.name.includes('payment') || tool.name.includes('Payment')
    );

    console.log('💰 Payment-related tools found:');
    paymentTools.forEach(tool => {
      console.log(`  - ${tool.name}: ${tool.description}`);
    });

    // Test data
    const testData = {
      workerId: '21001', // Logan McNeil
      amount: 100.00,
      currency: 'USD',
      paymentReason: 'Test payment - API validation',
      effectiveDate: '2025-01-15',
      paymentDate: '2025-01-20',
      memo: 'Automated test payment - please ignore'
    };

    console.log('\n🧪 Test Data:');
    console.log(JSON.stringify(testData, null, 2));

    // Test 1: One-Time Payment (using Submit_Payroll_Input)
    console.log('\n🔬 Test 1: One-Time Payment via Submit_Payroll_Input');
    console.log('⚠️  Note: This would submit a real payment request in production!');
    console.log('📝 Tool: submit_one_time_payment_soap');
    console.log('🎯 Parameters:', {
      workerId: testData.workerId,
      amount: testData.amount,
      currency: testData.currency,
      paymentReason: testData.paymentReason,
      effectiveDate: testData.effectiveDate,
      paymentDate: testData.paymentDate,
      memo: testData.memo
    });

    // Test 2: Off-Cycle Payment (using Put_Payroll_Off_cycle_Payment)
    console.log('\n🔬 Test 2: Off-Cycle Payment via Put_Payroll_Off_cycle_Payment');
    console.log('⚠️  Note: This would submit a real payment request in production!');
    console.log('📝 Tool: submit_off_cycle_payment_soap');
    console.log('🎯 Parameters:', {
      workerId: testData.workerId,
      amount: testData.amount,
      currency: testData.currency,
      paymentReason: testData.paymentReason,
      paymentDate: testData.paymentDate,
      paymentType: 'On_Demand',
      memo: testData.memo
    });

    // In a real test environment, you would uncomment these lines:
    /*
    try {
      console.log('\n🚀 Executing one-time payment test...');
      const result1 = await client.callTool({
        name: 'submit_one_time_payment_soap',
        arguments: {
          workerId: testData.workerId,
          amount: testData.amount,
          currency: testData.currency,
          paymentReason: testData.paymentReason,
          effectiveDate: testData.effectiveDate,
          paymentDate: testData.paymentDate,
          memo: testData.memo
        }
      });
      console.log('✅ One-time payment result:', result1);
    } catch (error) {
      console.log('❌ One-time payment error:', error.message);
    }

    try {
      console.log('\n🚀 Executing off-cycle payment test...');
      const result2 = await client.callTool({
        name: 'submit_off_cycle_payment_soap',
        arguments: {
          workerId: testData.workerId,
          amount: testData.amount,
          currency: testData.currency,
          paymentReason: testData.paymentReason,
          paymentDate: testData.paymentDate,
          paymentType: 'On_Demand',
          memo: testData.memo
        }
      });
      console.log('✅ Off-cycle payment result:', result2);
    } catch (error) {
      console.log('❌ Off-cycle payment error:', error.message);
    }
    */

    console.log('\n✅ Test completed successfully!');
    console.log('\n📋 Next Steps:');
    console.log('1. Configure SOAP credentials (WORKDAY_USERNAME, WORKDAY_PASSWORD)');
    console.log('2. Verify integration user has payroll permissions');
    console.log('3. Test with a small amount in development environment');
    console.log('4. Uncomment the actual API calls in this script');
    console.log('5. Run: node examples/test-one-time-payment.js');

    // Clean up
    await client.close();
    serverProcess.kill();

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Safety check
console.log('⚠️  SAFETY NOTICE:');
console.log('This test script is configured for demonstration purposes only.');
console.log('Actual payment API calls are commented out to prevent accidental submissions.');
console.log('Uncomment the API calls only in a safe development environment.');
console.log('');

if (require.main === module) {
  testOneTimePaymentTools().catch(console.error);
}

module.exports = { testOneTimePaymentTools }; 
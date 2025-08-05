import { testWSSecurityAuthentication, getWorkerSOAP } from './dist/workday-soap-api.js';
import { config } from 'dotenv';

// Load environment variables
config({ path: './workday.env' });

async function testWSSecuritySOAP() {
  console.log('=== Testing WS-Security SOAP Authentication ===\n');
  
  // Debug: Show environment variables
  console.log('Environment Variables:');
  console.log('- WORKDAY_BASE_URL:', process.env.WORKDAY_BASE_URL);
  console.log('- WORKDAY_TENANT:', process.env.WORKDAY_TENANT);
  console.log('- WORKDAY_USERNAME:', process.env.WORKDAY_USERNAME ? '[SET]' : '[NOT SET]');
  console.log('- WORKDAY_PASSWORD:', process.env.WORKDAY_PASSWORD ? '[SET]' : '[NOT SET]');
  console.log('- WORKDAY_SOAP_VERSION:', process.env.WORKDAY_SOAP_VERSION);
  console.log('');
  
  // Check if essential environment variables are set
  if (!process.env.WORKDAY_BASE_URL || process.env.WORKDAY_BASE_URL.includes('your-tenant')) {
    console.error('❌ WORKDAY_BASE_URL not properly set in environment');
    return;
  }
  
  if (!process.env.WORKDAY_USERNAME || !process.env.WORKDAY_PASSWORD) {
    console.error('❌ WORKDAY_USERNAME or WORKDAY_PASSWORD not set in environment');
    return;
  }
  
  // Test 1: Authentication test
  console.log('1. Testing WS-Security authentication...');
  try {
    const authResult = await testWSSecurityAuthentication();
    console.log(`   Authentication test result: ${authResult ? '✅ PASSED' : '❌ FAILED'}\n`);
  } catch (error) {
    console.error('   Authentication test error:', error.message);
  }
  
  // Test 2: Get worker using WS-Security
  console.log('2. Testing worker retrieval with WS-Security...');
  try {
    const workerResult = await getWorkerSOAP('21001'); // Test with a sample worker ID
    console.log('   Worker retrieval result:', workerResult ? '✅ SUCCESS' : '❌ FAILED');
    if (workerResult) {
      console.log('   Worker data keys:', Object.keys(workerResult));
    }
  } catch (error) {
    console.error('   Worker retrieval error:', error.message);
  }
  
  console.log('\n=== WS-Security Test Complete ===');
}

// Run the test
testWSSecuritySOAP().catch(console.error); 
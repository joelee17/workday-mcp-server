const https = require('https');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

// Load workday.env if it exists
const workdayEnvPath = path.join(__dirname, 'workday.env');
if (fs.existsSync(workdayEnvPath)) {
  const envContent = fs.readFileSync(workdayEnvPath, 'utf8');
  const envLines = envContent.split('\n');
  
  for (const line of envLines) {
    if (line.trim() && !line.startsWith('#')) {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=');
        process.env[key.trim()] = value.trim();
      }
    }
  }
}

// Workday Configuration
const WORKDAY_CONFIG = {
  baseUrl: process.env.WORKDAY_BASE_URL || 'https://wcpdev-services1.wd101.myworkday.com',
  tenant: process.env.WORKDAY_TENANT || 'wday_wcpdev11',
  bearerToken: process.env.WORKDAY_BEARER_TOKEN
};

console.log('🔍 Testing Workday REST API - Worker Search for Logan McNeil');
console.log('='.repeat(70));

// Test function to search for workers
async function searchWorkers(searchTerm) {
  return new Promise((resolve, reject) => {
    const apiPath = `/ccx/api/staffing/v1/${WORKDAY_CONFIG.tenant}/workers`;
    const url = `${WORKDAY_CONFIG.baseUrl}${apiPath}?search=${encodeURIComponent(searchTerm)}`;
    
    console.log(`📡 API Endpoint: ${url}`);
    
    const options = {
      hostname: new URL(url).hostname,
      port: 443,
      path: new URL(url).pathname + new URL(url).search,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${WORKDAY_CONFIG.bearerToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
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
          if (res.statusCode === 200) {
            resolve(response);
          } else {
            reject(new Error(`API error (${res.statusCode}): ${response.error || data}`));
          }
        } catch (error) {
          reject(new Error(`Failed to parse API response: ${error.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`API request error: ${error.message}`));
    });

    req.end();
  });
}

// Test function using v7 staffing API
async function searchStaffingWorkers(searchTerm) {
  return new Promise((resolve, reject) => {
    const apiPath = `/ccx/api/staffing/v7/${WORKDAY_CONFIG.tenant}/workers`;
    const url = `${WORKDAY_CONFIG.baseUrl}${apiPath}?search=${encodeURIComponent(searchTerm)}`;
    
    console.log(`📡 Staffing API Endpoint: ${url}`);
    
    const options = {
      hostname: new URL(url).hostname,
      port: 443,
      path: new URL(url).pathname + new URL(url).search,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${WORKDAY_CONFIG.bearerToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
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
          if (res.statusCode === 200) {
            resolve(response);
          } else {
            reject(new Error(`API error (${res.statusCode}): ${response.error || data}`));
          }
        } catch (error) {
          reject(new Error(`Failed to parse API response: ${error.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`API request error: ${error.message}`));
    });

    req.end();
  });
}

// Format worker information for display
function formatWorkerInfo(worker, index) {
  const info = [];
  info.push(`${index + 1}. **${worker.descriptor || worker.name || 'Unknown Name'}**`);
  
  if (worker.workerId || worker.id) {
    info.push(`   - Worker ID: ${worker.workerId || worker.id}`);
  }
  
  if (worker.primaryJob) {
    info.push(`   - Position: ${worker.primaryJob.businessTitle || 'N/A'}`);
    info.push(`   - Department: ${worker.primaryJob.supervisoryOrganization?.descriptor || 'N/A'}`);
  }
  
  if (worker.person?.email || worker.email) {
    info.push(`   - Email: ${worker.person?.email || worker.email}`);
  }
  
  if (worker.person?.phoneNumber || worker.phoneNumber) {
    info.push(`   - Phone: ${worker.person?.phoneNumber || worker.phoneNumber}`);
  }
  
  return info.join('\n');
}

// Main test function
async function runTests() {
  const searchTerm = "Logan McNeil";
  
  console.log(`🔍 Searching for: "${searchTerm}"`);
  console.log(`🔑 Bearer Token: ${WORKDAY_CONFIG.bearerToken ? 'SET' : 'NOT SET'}`);
  console.log(`🏢 Tenant: ${WORKDAY_CONFIG.tenant}`);
  console.log(`🌐 Base URL: ${WORKDAY_CONFIG.baseUrl}`);
  console.log();

  if (!WORKDAY_CONFIG.bearerToken) {
    console.error('❌ Bearer token is not set!');
    process.exit(1);
  }

  try {
    // Test 1: Search using v1 API
    console.log('📋 TEST 1: Using Staffing API v1');
    console.log('-'.repeat(40));
    
    const results1 = await searchWorkers(searchTerm);
    console.log(`✅ API Response Status: Success`);
    console.log(`📊 Results Count: ${results1.data ? results1.data.length : 0}`);
    
    if (results1.data && results1.data.length > 0) {
      console.log('\n👥 Found Workers:');
      results1.data.forEach((worker, index) => {
        console.log(formatWorkerInfo(worker, index));
      });
    } else {
      console.log('❌ No workers found');
    }
    
    console.log(`\n📄 Raw Response:`, JSON.stringify(results1, null, 2));
    
  } catch (error) {
    console.error(`❌ TEST 1 Failed: ${error.message}`);
  }
  
  console.log('\n' + '='.repeat(70));
  
  try {
    // Test 2: Search using v7 API
    console.log('📋 TEST 2: Using Staffing API v7');
    console.log('-'.repeat(40));
    
    const results2 = await searchStaffingWorkers(searchTerm);
    console.log(`✅ API Response Status: Success`);
    console.log(`📊 Results Count: ${results2.data ? results2.data.length : 0}`);
    
    if (results2.data && results2.data.length > 0) {
      console.log('\n👥 Found Workers:');
      results2.data.forEach((worker, index) => {
        console.log(formatWorkerInfo(worker, index));
      });
    } else {
      console.log('❌ No workers found');
    }
    
    console.log(`\n📄 Raw Response:`, JSON.stringify(results2, null, 2));
    
  } catch (error) {
    console.error(`❌ TEST 2 Failed: ${error.message}`);
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('🏁 Test Complete!');
}

// Run the tests
runTests().catch(console.error); 
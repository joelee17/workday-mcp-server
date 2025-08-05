#!/usr/bin/env node

/**
 * Example script demonstrating Workday SOAP API usage
 * 
 * This script shows how to use the SOAP-based tools that have been added to the MCP server.
 * SOAP tools provide access to comprehensive Workday data that may not be available through REST APIs.
 */

console.log('🧼 Workday SOAP API Examples');
console.log('==============================\n');

// Example 1: Get Worker Information via SOAP
console.log('📋 Example 1: Get Worker Information (SOAP)');
console.log('Tool: get_worker_soap');
console.log('Parameters: { workerId: "21001" }');
console.log('Description: Get comprehensive worker information including personal data, employment info, compensation, organizations, and roles\n');

// Example 2: Search Workers via SOAP
console.log('🔍 Example 2: Search Workers (SOAP)');
console.log('Tool: search_workers_soap');
console.log('Parameters: { searchTerm: "Logan McNeil", limit: 5 }');
console.log('Description: Search for workers by name or other criteria using SOAP API\n');

// Example 3: Get Organizations via SOAP
console.log('🏢 Example 3: Get Organizations (SOAP)');
console.log('Tool: get_organizations_soap');
console.log('Parameters: {}');
console.log('Description: Get organizational structure with hierarchy data\n');

// Example 4: Get Positions via SOAP
console.log('💼 Example 4: Get Positions (SOAP)');
console.log('Tool: get_positions_soap');
console.log('Parameters: {}');
console.log('Description: Get all positions with detailed position data and organizational context\n');

// Example 5: Get Job Profiles via SOAP
console.log('📋 Example 5: Get Job Profiles (SOAP)');
console.log('Tool: get_job_profiles_soap');
console.log('Parameters: {}');
console.log('Description: Get job profiles with comprehensive job profile data\n');

// Example 6: Get Compensation via SOAP
console.log('💰 Example 6: Get Compensation (SOAP)');
console.log('Tool: get_compensation_soap');
console.log('Parameters: { workerId: "21001" }');
console.log('Description: Get detailed compensation information including salary, bonus, commission, allowance, and stock plans\n');

// Example 7: Get Payroll Results via SOAP
console.log('💵 Example 7: Get Payroll Results (SOAP)');
console.log('Tool: get_payroll_results_soap');
console.log('Parameters: { workerId: "21001", payPeriodStart: "2024-01-01", payPeriodEnd: "2024-01-15" }');
console.log('Description: Get payroll results including earnings, deductions, taxes, and net pay distribution\n');

// Example 8: Get Time Entries via SOAP
console.log('⏰ Example 8: Get Time Entries (SOAP)');
console.log('Tool: get_time_entries_soap');
console.log('Parameters: { workerId: "21001", startDate: "2024-01-01", endDate: "2024-01-31" }');
console.log('Description: Get time entries with detailed time blocks and tracking information\n');

// Example 9: Get Absence Entries via SOAP
console.log('🏖️ Example 9: Get Absence Entries (SOAP)');
console.log('Tool: get_absence_entries_soap');
console.log('Parameters: { workerId: "21001", startDate: "2024-01-01", endDate: "2024-01-31" }');
console.log('Description: Get absence entries for vacation, sick leave, and other time off\n');

// Example 10: Get Benefits via SOAP
console.log('🏥 Example 10: Get Benefits (SOAP)');
console.log('Tool: get_benefits_soap');
console.log('Parameters: { workerId: "21001" }');
console.log('Description: Get benefits enrollment data, plan information, and coverage details\n');

// Example 11: Get Performance Reviews via SOAP
console.log('📊 Example 11: Get Performance Reviews (SOAP)');
console.log('Tool: get_performance_reviews_soap');
console.log('Parameters: { workerId: "21001" }');
console.log('Description: Get performance review data including goals, competencies, and overall ratings\n');

// Example 12: Get Learning Records via SOAP
console.log('📚 Example 12: Get Learning Records (SOAP)');
console.log('Tool: get_learning_records_soap');
console.log('Parameters: { workerId: "21001" }');
console.log('Description: Get learning records including training content and completion status\n');

// Example 13: Get Talent Profile via SOAP
console.log('🎯 Example 13: Get Talent Profile (SOAP)');
console.log('Tool: get_talent_profile_soap');
console.log('Parameters: { workerId: "21001" }');
console.log('Description: Get talent profile including skills, certifications, and career preferences\n');

console.log('📝 Configuration Notes:');
console.log('======================');
console.log('1. Set WORKDAY_USERNAME and WORKDAY_PASSWORD in your environment variables');
console.log('2. Set WORKDAY_SOAP_VERSION (default: 41.0) for the SOAP API version');
console.log('3. SOAP APIs require different authentication than REST APIs (username/password vs OAuth)');
console.log('4. SOAP APIs often provide more comprehensive data than REST APIs');
console.log('5. SOAP responses are automatically parsed to remove envelope wrappers\n');

console.log('🔧 Environment Variables Required:');
console.log('==================================');
console.log('WORKDAY_BASE_URL=https://your-tenant.workday.com');
console.log('WORKDAY_TENANT=your-tenant');
console.log('WORKDAY_USERNAME=your-integration-username');
console.log('WORKDAY_PASSWORD=your-integration-password');
console.log('WORKDAY_SOAP_VERSION=41.0');

console.log('\n✅ All SOAP tools are now available in Claude Desktop!');
console.log('Restart Claude Desktop to use these new SOAP-based tools.'); 
#!/usr/bin/env node

/**
 * Example script demonstrating Workday One-Time Payment SOAP API usage
 * 
 * This script shows how to use the new one-time payment tools that have been added to the MCP server.
 * These tools provide the ability to submit one-time payments and off-cycle payments using Workday's SOAP API.
 */

console.log('💰 Workday One-Time Payment SOAP API Examples');
console.log('===============================================');

console.log(`
🔧 Available One-Time Payment Tools:

1. submit_one_time_payment_soap
   - Submit a one-time payment request using Submit_Payroll_Input operation
   - Uses regular payroll input structure
   - Parameters:
     * workerId (required): Employee ID
     * amount (required): Payment amount
     * currency (required): Currency code (e.g., USD, EUR)
     * paymentReason (required): Reason for payment
     * effectiveDate (required): Effective date (YYYY-MM-DD)
     * paymentDate (optional): Payment date (defaults to effective date)
     * memo (optional): Additional memo

2. submit_off_cycle_payment_soap
   - Submit an off-cycle payment request using Put_Payroll_Off_cycle_Payment operation
   - Uses off-cycle payment structure for manual or on-demand payments
   - Parameters:
     * workerId (required): Employee ID
     * amount (required): Payment amount
     * currency (required): Currency code (e.g., USD, EUR)
     * paymentReason (required): Reason for payment
     * paymentDate (required): Payment date (YYYY-MM-DD)
     * paymentType (optional): 'Manual' or 'On_Demand' (default: On_Demand)
     * memo (optional): Additional memo

📋 Example Usage:

Using Claude Desktop with the MCP server:

1. One-Time Payment Example:
   "Submit a one-time payment of $500 USD to employee 21001 for a performance bonus, 
    effective January 15, 2025"

2. Off-Cycle Payment Example:
   "Submit an off-cycle payment of $1000 USD to employee 21001 for overtime compensation, 
    payment date January 20, 2025, type On_Demand"

🔍 Tool Details:

submit_one_time_payment_soap:
- Service: Payroll
- Operation: Submit_Payroll_Input
- Structure: Uses Earning_Data with One_Time_Payment earning type
- Business Process: Auto-complete enabled for immediate processing

submit_off_cycle_payment_soap:
- Service: Payroll  
- Operation: Put_Payroll_Off_cycle_Payment
- Structure: Uses off-cycle payment data structure
- Payment Types: Manual (recorded payments) or On_Demand (new payments)

🏗️ XML Structure (Internal):

The tools generate SOAP XML requests based on Workday's Payroll service schema:

For One-Time Payment:
- Submit_Payroll_Input_Request
  - Business_Process_Parameters (auto-complete)
  - Payroll_Input_Data
    - Worker_Reference (Employee_ID)
    - Effective_Date
    - Payment_Date
    - Payroll_Input_for_Period_Data
      - Earning_Data
        - Earning_Reference (One_Time_Payment)
        - Amount
        - Currency_Reference
        - Memo

For Off-Cycle Payment:
- Put_Payroll_Off_cycle_Payment_Request
  - Business_Process_Parameters (auto-complete)
  - Payroll_Off_cycle_Payment_Data
    - Worker_Reference (Employee_ID)
    - Payment_Date
    - Payment_Type (Manual/On_Demand)
    - Payment_Reason
    - Earning_Data
      - Earning_Reference (One_Time_Payment)
      - Amount
      - Currency_Reference
      - Memo

🔐 Authentication:

These tools use SOAP authentication with:
- Basic Authentication (username/password)
- Integration system user credentials
- Configured in WORKDAY_USERNAME and WORKDAY_PASSWORD environment variables

⚠️ Important Notes:

1. Requires proper Workday SOAP API permissions
2. Integration user must have payroll input/payment submission rights
3. Earning codes and currency references must exist in the system
4. Payment dates should follow company payroll calendar
5. Business process auto-completion bypasses approval workflows

🎯 Use Cases:

- Performance bonuses
- Overtime payments
- Expense reimbursements
- Retroactive pay adjustments
- Special recognition payments
- Emergency payments
- Commission payments
- Referral bonuses

📚 Related Documentation:

- Workday Payroll Web Service Documentation
- Submit_Payroll_Input Operation Guide
- Put_Payroll_Off_cycle_Payment Operation Guide
- SOAP API Authentication Guide

🔧 Setup Requirements:

1. Configure SOAP credentials in workday.env:
   WORKDAY_USERNAME=your-integration-username
   WORKDAY_PASSWORD=your-integration-password
   WORKDAY_SOAP_VERSION=41.0

2. Build the MCP server:
   npm run build

3. Restart Claude Desktop to load new tools

4. Test with a sample payment request

✅ Success Response:

Both tools return structured responses with:
- Payment confirmation details
- SOAP response data
- Transaction references
- Status information

❌ Error Handling:

Common errors and solutions:
- Authentication failure: Check SOAP credentials
- Missing earning code: Verify One_Time_Payment earning exists
- Invalid currency: Ensure currency code is configured
- Permission denied: Check integration user permissions
- Invalid date format: Use YYYY-MM-DD format
- Missing worker: Verify employee ID exists and is active

🚀 Getting Started:

1. Ensure your Workday environment has the required setup
2. Configure SOAP authentication credentials  
3. Build and restart the MCP server
4. Try a test payment with a small amount
5. Verify the payment appears in Workday payroll

For more examples and advanced usage, see the SOAP_API_GUIDE.md documentation.
`);

console.log('💡 Ready to process one-time payments via Workday SOAP API!'); 
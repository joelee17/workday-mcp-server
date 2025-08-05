# WS-Security Implementation for Workday SOAP API

## Overview

This implementation uses WS-Security (Web Services Security) headers for authenticating SOAP calls to Workday instead of Basic Authentication. WS-Security provides a more secure and standards-compliant way to authenticate SOAP web service requests.

## Key Changes Made

### 1. Removed Basic Authentication
- Removed `BasicAuthSecurity` from soap client configuration
- Removed Authorization headers from WSDL requests

### 2. Implemented WS-Security Classes

#### `WorkdayWSSecurity`
- Generates WS-Security headers with UsernameToken
- Creates password digest using SHA-1 hash
- Includes nonce and timestamp for security

#### `WorkdayWSSecurityAuth`
- Custom security class that integrates with the soap library
- Modifies SOAP envelope to include WS-Security headers
- Implements `postProcess` method to add security headers

### 3. Updated SOAP Client
- Modified `WorkdaySOAPClient` to use WS-Security
- Added authentication testing capabilities
- Enhanced error handling and logging

## WS-Security Header Structure

The implementation generates WS-Security headers in the following format:

```xml
<wsse:Security xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd" 
               xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd">
  <wsse:UsernameToken wsu:Id="UsernameToken-1">
    <wsse:Username>username</wsse:Username>
    <wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordDigest">digest</wsse:Password>
    <wsse:Nonce EncodingType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary">nonce</wsse:Nonce>
    <wsu:Created>timestamp</wsu:Created>
  </wsse:UsernameToken>
</wsse:Security>
```

## Password Digest Algorithm

The password digest is calculated as:
```
digest = Base64(SHA1(nonce + created + password))
```

Where:
- `nonce`: Random 16-byte value encoded in Base64
- `created`: ISO 8601 timestamp
- `password`: Plain text password

## Configuration

The WS-Security implementation uses the same environment variables:

```bash
WORKDAY_USERNAME=your-username@tenant
WORKDAY_PASSWORD=your-password
WORKDAY_TENANT=your-tenant
WORKDAY_BASE_URL=https://your-tenant.workday.com
WORKDAY_SOAP_VERSION=41.0
```

## Usage

All existing SOAP functions now automatically use WS-Security:

```javascript
// Import functions
const { getWorkerSOAP, testWSSecurityAuthentication } = require('./dist/workday-soap-api.js');

// Test authentication
const authResult = await testWSSecurityAuthentication();

// Use any SOAP function - WS-Security is applied automatically
const worker = await getWorkerSOAP('21001');
```

## Available SOAP Functions

All SOAP functions now use WS-Security authentication:

### Human Resources
- `getWorkerSOAP(workerId)`
- `searchWorkersSOAP(searchTerm, limit)`
- `getOrganizationsSOAP()`

### Staffing
- `getPositionsSOAP()`
- `getJobProfilesSOAP()`

### Compensation
- `getCompensationSOAP(workerId)`

### Payroll
- `getPayrollResultsSOAP(workerId, payPeriodStart, payPeriodEnd)`
- `submitOneTimePaymentSOAP(workerId, amount, currency, paymentReason, effectiveDate, paymentDate, memo)`
- `submitOffCyclePaymentSOAP(workerId, amount, currency, paymentReason, paymentDate, paymentType, memo)`
- `requestOneTimePaymentSOAP(workerId, amount, currency, paymentReason, effectiveDate, memo)`

### Time Tracking
- `getTimeEntriesSOAP(workerId, startDate, endDate)`

### Absence Management
- `getAbsenceEntriesSOAP(workerId, startDate, endDate)`

### Benefits Administration
- `getBenefitsSOAP(workerId)`

### Performance Management
- `getPerformanceReviewsSOAP(workerId)`

### Learning
- `getLearningRecordsSOAP(workerId)`

### Talent Management
- `getTalentProfileSOAP(workerId)`

## Testing

Run the WS-Security test:

```bash
node test-ws-security.cjs
```

This will test:
1. WS-Security authentication
2. Worker data retrieval using WS-Security

## Security Benefits

1. **Standards Compliance**: Uses WS-Security standard
2. **Digest Authentication**: Password is never sent in plain text
3. **Replay Protection**: Nonce and timestamp prevent replay attacks
4. **Header Security**: Security information is in SOAP headers, not HTTP headers

## Troubleshooting

### Common Issues

1. **Invalid Credentials**: Check username/password format
2. **Clock Skew**: Ensure system time is synchronized
3. **Namespace Issues**: Verify WS-Security namespace declarations
4. **Digest Calculation**: Ensure proper encoding of nonce and timestamp

### Debug Mode

Enable debug logging by setting:
```bash
DEBUG=soap:*
```

This will show detailed SOAP request/response information including WS-Security headers.

## MCP Server Integration

The MCP server automatically uses WS-Security for all SOAP-based tools:

- `get_worker_soap`
- `search_workers_soap`
- `get_organizations_soap`
- `get_positions_soap`
- `get_job_profiles_soap`
- `get_compensation_soap`
- `get_payroll_results_soap`
- `get_time_entries_soap`
- `get_absence_entries_soap`
- `get_benefits_soap`
- `get_performance_reviews_soap`
- `get_learning_records_soap`
- `get_talent_profile_soap`
- `submit_one_time_payment_soap`
- `submit_off_cycle_payment_soap`
- `request_one_time_payment_soap`

No changes are required to use these tools - they automatically use WS-Security authentication. 
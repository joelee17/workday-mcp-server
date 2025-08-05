# Workday SOAP Learning Content Enrollment Guide

## Overview
This document provides examples and explanations for enrolling workers in learning content using Workday's SOAP API v44.1.

## API Endpoint
```
POST https://wcpdev-services1.wd101.myworkday.com/ccx/service/wday_wcpdev11/Learning/v44.1
```

## HTTP Headers
```
Authorization: Bearer {your_jwt_token}
Content-Type: text/xml; charset=utf-8
SOAPAction: Enroll_In_Learning_Content
```

## Required Fields

### 1. Business Process Parameters
- `Auto_Complete`: **Always set to `true`** (per requirements)
- `Run_Now`: **Always set to `true`** (per requirements)

### 2. Worker Reference
- **Type**: `Employee_ID` (recommended)
- **Value**: The worker's employee ID (e.g., "EMP001")

### 3. Learning Content Reference
- **Type**: `WID` (Workday ID)
- **Value**: The learning content's WID (e.g., "a1b2c3d4-e5f6-7890-abcd-ef1234567890")

## Optional Fields

### Business Process Parameters
- `Comment_Data`: Optional comment for the enrollment

### Enrollment Data
- `Enrollment_Date`: Date in YYYY-MM-DD format
- `Due_Date`: Completion due date in YYYY-MM-DD format
- `Priority`: Priority level ("High", "Medium", "Low")

## Key Structure Notes

1. **Nested Structure**: The main data is wrapped in:
   ```xml
   <bsvc:Enroll_In_Learning_Content_Data>
     <bsvc:Enroll_In_Learning_Course_Data>
       <!-- Worker and learning content references here -->
     </bsvc:Enroll_In_Learning_Course_Data>
   </bsvc:Enroll_In_Learning_Content_Data>
   ```

2. **ID Types**: 
   - Worker: Use `Employee_ID` type
   - Learning Content: Use `WID` type

3. **Business Process Parameters**: Always include `Auto_Complete` and `Run_Now` set to `true`

## Example Requests

### Minimal Request
See `sample-soap-enrollment-minimal.xml` for the simplest possible request.

### Complete Request
See `sample-soap-enrollment-request.xml` for a request with all optional fields.

## Common Issues

1. **401 Unauthorized**: Check your bearer token and ensure it's valid
2. **400 Bad Request**: Usually indicates XML structure issues
3. **404 Not Found**: Check the service URL and version
4. **SOAP Fault**: Check the nested structure and field names

## Testing

You can test the SOAP request using the provided `test-soap-enrollment.cjs` script:

```bash
node test-soap-enrollment.cjs
```

## Authentication

The SOAP API uses Bearer token authentication. Make sure your token is valid and has the necessary permissions for learning content enrollment.

## API Version

This implementation uses **Learning API v44.1**. Different versions may have different field requirements or structures. 
# Workday Learning API Integration

This document describes the Workday Learning API integration based on the official Workday Learning API sample for enrolling workers in learning content.

## Overview

The Learning API provides comprehensive functionality for managing learning content, enrollments, and tracking worker progress in Workday. This implementation is based on the official Workday Learning API v44.2 sample: `Enroll_In_Learning_Content_Request.xml`.

## Features

### 🎓 Learning Content Management
- Browse available learning content
- Search learning content with advanced filters
- Get detailed learning content information
- Manage learning categories

### 👥 Worker Enrollment
- Enroll workers in learning content
- Track worker learning progress
- Manage learning enrollments
- Update enrollment status and completion

### 📊 Progress Tracking
- Monitor learning progress
- Update completion status
- Track scores and grades
- Manage enrollment lifecycle

## API Endpoints

The Learning API uses the following base endpoint structure:
```
https://{tenant}.workday.com/ccx/api/learning/v1/{tenant}/
```

### Available Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/learningEnrollments` | POST | Enroll worker in learning content |
| `/learningContent` | GET | Get available learning content |
| `/learningContent/{id}` | GET | Get specific learning content details |
| `/learningContent/search` | GET | Search learning content with filters |
| `/workers/{workerId}/learningEnrollments` | GET | Get worker's learning enrollments |
| `/workers/{workerId}/learningProgress` | GET | Get worker's learning progress |
| `/learningEnrollments/{id}` | PATCH | Update learning enrollment |
| `/learningEnrollments/{id}/cancel` | POST | Cancel learning enrollment |
| `/learningCategories` | GET | Get learning categories |

## MCP Server Tools

### 1. `enroll_in_learning_content`
Enroll a worker in learning content using Workday Learning API.

**Parameters:**
- `workerId` (required): Worker ID to enroll
- `learningContentId` (required): Learning content ID
- `enrollmentDate` (optional): Enrollment date (YYYY-MM-DD, defaults to today)
- `dueDate` (optional): Due date for completion (YYYY-MM-DD)
- `comment` (optional): Comment for the enrollment
- `autoEnroll` (optional): Auto-enroll the worker (defaults to true)
- `sendNotification` (optional): Send notification to worker (defaults to true)
- `assignmentReason` (optional): Assignment reason (defaults to "Manager Assignment")
- `priority` (optional): Priority level (High, Medium, Low, defaults to "Medium")

**Example:**
```javascript
{
  "workerId": "3aa5550b7fe348b98d7b5741afc65534",
  "learningContentId": "LEARN_SAFETY_001",
  "enrollmentDate": "2025-01-15",
  "dueDate": "2025-02-15",
  "comment": "Mandatory safety training",
  "priority": "High"
}
```

### 2. `get_learning_content`
Get available learning content from Workday Learning API.

**Parameters:**
- `limit` (optional): Maximum number of results
- `offset` (optional): Number of results to skip
- `searchTerm` (optional): Search term to filter content

### 3. `get_learning_content_details`
Get detailed information about specific learning content.

**Parameters:**
- `learningContentId` (required): Learning content ID

### 4. `get_worker_learning_enrollments`
Get learning enrollments for a specific worker.

**Parameters:**
- `workerId` (required): Worker ID
- `limit` (optional): Maximum number of results
- `offset` (optional): Number of results to skip

### 5. `get_worker_learning_progress`
Get learning progress for a worker.

**Parameters:**
- `workerId` (required): Worker ID
- `learningContentId` (optional): Specific learning content ID

### 6. `search_learning_content`
Search learning content with advanced filters.

**Parameters:**
- `searchTerm` (optional): Search term
- `category` (optional): Learning category
- `provider` (optional): Learning provider
- `duration` (optional): Duration filter
- `difficulty` (optional): Difficulty level (Beginner, Intermediate, Advanced)
- `language` (optional): Language filter
- `limit` (optional): Maximum number of results
- `offset` (optional): Number of results to skip

### 7. `update_learning_enrollment`
Update learning enrollment status.

**Parameters:**
- `enrollmentId` (required): Learning enrollment ID
- `status` (optional): Enrollment status (Enrolled, In Progress, Completed, Cancelled)
- `completionDate` (optional): Completion date (YYYY-MM-DD)
- `score` (optional): Score/grade
- `comment` (optional): Comment

### 8. `cancel_learning_enrollment`
Cancel a learning enrollment.

**Parameters:**
- `enrollmentId` (required): Learning enrollment ID
- `reason` (optional): Cancellation reason

### 9. `get_learning_categories`
Get available learning categories.

**Parameters:**
- `limit` (optional): Maximum number of results
- `offset` (optional): Number of results to skip

## Code Examples

### Direct API Usage

```javascript
const { learningApi } = require('./dist/learning-api.js');

const config = {
  baseUrl: 'https://wcpdev-services1.wd101.myworkday.com',
  tenant: 'wday_wcpdev11',
  bearerToken: 'your-bearer-token'
};

// Enroll worker in learning content
const enrollmentData = {
  workerId: '3aa5550b7fe348b98d7b5741afc65534',
  learningContentId: 'LEARN_SAFETY_001',
  enrollmentDate: '2025-01-15',
  dueDate: '2025-02-15',
  comment: 'Mandatory safety training',
  priority: 'High'
};

const result = await learningApi.enrollInLearningContent(config, enrollmentData);
console.log('Enrollment result:', result);
```

### MCP Server Usage

```javascript
// Using MCP server tools
const mcpResponse = await callTool('enroll_in_learning_content', {
  workerId: '3aa5550b7fe348b98d7b5741afc65534',
  learningContentId: 'LEARN_SAFETY_001',
  enrollmentDate: '2025-01-15',
  dueDate: '2025-02-15',
  comment: 'Mandatory safety training',
  priority: 'High'
});
```

## Data Structures

### Learning Enrollment Data
```javascript
{
  workerId: string,
  learningContentId: string,
  enrollmentDate?: string,
  dueDate?: string,
  comment?: string,
  autoEnroll?: boolean,
  sendNotification?: boolean,
  assignmentReason?: string,
  priority?: 'High' | 'Medium' | 'Low'
}
```

### Learning Content Search Parameters
```javascript
{
  searchTerm?: string,
  category?: string,
  provider?: string,
  duration?: string,
  difficulty?: 'Beginner' | 'Intermediate' | 'Advanced',
  language?: string,
  limit?: number,
  offset?: number
}
```

### Enrollment Update Data
```javascript
{
  status?: 'Enrolled' | 'In Progress' | 'Completed' | 'Cancelled',
  completionDate?: string,
  score?: number,
  comment?: string
}
```

## Authentication

The Learning API uses Bearer token authentication. You can obtain a token through:

1. **OAuth 2.0 Authorization Code Flow** (recommended)
2. **Legacy Bearer Token** (for backward compatibility)

### Environment Variables
```bash
# OAuth Configuration
WORKDAY_CLIENT_ID=your-client-id
WORKDAY_CLIENT_SECRET=your-client-secret
WORKDAY_TOKEN_ENDPOINT=https://tenant.workday.com/oauth2/token
WORKDAY_AUTH_ENDPOINT=https://tenant.workday.com/tenant/authorize

# Tenant Information
WORKDAY_TENANT=your-tenant
WORKDAY_BASE_URL=https://tenant.workday.com

# Legacy Bearer Token
WORKDAY_BEARER_TOKEN=your-bearer-token
```

## Error Handling

The API includes comprehensive error handling:

- **Authentication Errors**: Invalid or expired tokens
- **Authorization Errors**: Insufficient permissions
- **Validation Errors**: Invalid parameters or data
- **Network Errors**: Connection issues
- **API Errors**: Workday-specific errors

### Common Error Scenarios

1. **Worker Not Found**: Invalid worker ID
2. **Learning Content Not Found**: Invalid learning content ID
3. **Permission Denied**: Insufficient Learning API permissions
4. **Enrollment Already Exists**: Worker already enrolled
5. **Invalid Date Format**: Incorrect date format

## Permissions Required

To use the Learning API, ensure your Integration System User has the following permissions:

### Domain Security Policies
- **Learning Content**: Read access
- **Learning Enrollments**: Read, Write access
- **Worker Data**: Read access for learning-related data

### Integration Permissions
- **Learning API**: Full access
- **Worker API**: Read access
- **Tenant API**: Read access

## Best Practices

### 1. Data Validation
Always validate input data before making API calls:
```javascript
if (!workerId || !learningContentId) {
  throw new Error('Worker ID and Learning Content ID are required');
}
```

### 2. Error Handling
Implement proper error handling for all API calls:
```javascript
try {
  const result = await learningApi.enrollInLearningContent(config, data);
  return result;
} catch (error) {
  console.error('Learning API error:', error.message);
  throw error;
}
```

### 3. Rate Limiting
Respect Workday's rate limits:
- Maximum 10 requests per second
- Maximum 1000 requests per hour
- Implement exponential backoff for retries

### 4. Pagination
Use pagination for large result sets:
```javascript
const result = await learningApi.getLearningContent(config, 100, 0);
```

### 5. Caching
Cache frequently accessed data:
- Learning categories
- Learning content metadata
- Worker information

## Testing

### Unit Tests
Run unit tests for the Learning API:
```bash
npm test -- --grep "Learning API"
```

### Integration Tests
Test with actual Workday tenant:
```bash
node examples/learning-api-example.js
```

### Manual Testing
Use the MCP server tools through a compatible client to test functionality.

## Troubleshooting

### Common Issues

1. **"Learning API not enabled"**
   - Contact Workday administrator
   - Enable Learning API in tenant configuration

2. **"Worker not found"**
   - Verify worker ID format
   - Check worker exists in system

3. **"Learning content not accessible"**
   - Verify learning content ID
   - Check content permissions

4. **"Enrollment already exists"**
   - Check existing enrollments first
   - Use update instead of create

### Debug Mode
Enable debug logging:
```javascript
process.env.DEBUG = 'workday:learning';
```

## References

- [Workday Learning API Documentation](https://community.workday.com/sites/default/files/file-hosting/productionapi/Learning/v44.2/samples/Enroll_In_Learning_Content_Request.xml)
- [Workday REST API Reference](https://community.workday.com/sites/default/files/file-hosting/restapi/index.html)
- [Workday Integration Guide](https://doc.workday.com/reader/integration)

## Support

For issues with the Learning API integration:

1. Check the troubleshooting section above
2. Review Workday API documentation
3. Contact your Workday administrator for permissions
4. File an issue in the project repository

---

**Note**: This implementation is based on Workday Learning API v44.2. API endpoints and functionality may vary depending on your Workday tenant version and configuration. 
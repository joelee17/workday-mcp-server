# Workday Staffing API v7 Tools

This document provides comprehensive documentation for all the Workday Staffing API v7 tools that have been added to the MCP server based on the official Workday Staffing API swagger documentation.

## Overview

The Workday Staffing API v7 enables you to get and manage staffing information, including:
- Job changes and job change workflows
- Job families and job profiles
- Jobs and their workspaces
- Organization assignment changes
- Supervisory organizations
- Worker check-ins
- Worker staffing information for non-terminated workers

## Tool Categories

### 1. Job Changes (`jobChanges`)

Job changes enable you to perform Change Job tasks with a complete workflow:

1. **Initiate** a job change request
2. **Update** various aspects of the job change
3. **Submit** the job change request

#### Available Tools:

- **`initiate_job_change`** - Initiate a job change request for a worker
  - Parameters: `workerId` (required), `jobChangeData` (optional)
  - Returns: Job change ID and initial details

- **`get_job_change`** - Get job change information by ID
  - Parameters: `jobChangeId` (required)
  - Returns: Complete job change information

- **`submit_job_change`** - Submit a job change request
  - Parameters: `jobChangeId` (required)
  - Returns: Submission confirmation

- **`get_worker_job_changes`** - Get all job changes for a specific worker
  - Parameters: `workerId` (required), `limit` (optional), `offset` (optional)
  - Returns: List of job changes for the worker

#### Job Change Workflow:
```
1. initiate_job_change(workerId) → returns jobChangeId
2. [Update various job change aspects using PATCH endpoints - not yet implemented]
3. submit_job_change(jobChangeId) → finalizes the change
```

### 2. Job Families (`jobFamilies`)

Retrieve information about job families in your organization.

#### Available Tools:

- **`get_job_families`** - Get list of job families
  - Parameters: `limit` (optional), `offset` (optional)
  - Returns: List of job families

- **`get_job_family`** - Get specific job family information
  - Parameters: `jobFamilyId` (required)
  - Returns: Detailed job family information

### 3. Job Profiles (`jobProfiles`)

Manage job profiles within your organization.

#### Available Tools:

- **`get_job_profiles`** - Get list of job profiles
  - Parameters: `limit` (optional), `offset` (optional)
  - Returns: List of job profiles

- **`get_job_profile`** - Get specific job profile information
  - Parameters: `jobProfileId` (required)
  - Returns: Detailed job profile information

- **`create_job_profile`** - Create a new job profile
  - Parameters: `jobProfileData` (required)
  - Returns: Created job profile details

### 4. Jobs (`jobs`)

Retrieve information about jobs and their workspaces.

#### Available Tools:

- **`get_jobs`** - Get list of jobs
  - Parameters: `limit` (optional), `offset` (optional)
  - Returns: List of jobs

- **`get_job`** - Get specific job information
  - Parameters: `jobId` (required)
  - Returns: Detailed job information

- **`get_job_workspaces`** - Get workspaces for a specific job
  - Parameters: `jobId` (required)
  - Returns: Job workspace information

### 5. Organization Assignment Changes (`organizationAssignmentChanges`)

Manage organization assignment changes with a complete workflow similar to job changes.

#### Available Tools:

- **`initiate_organization_assignment_change`** - Initiate an organization assignment change
  - Parameters: `workerId` (required), `orgAssignmentData` (optional)
  - Returns: Organization assignment change ID and details

- **`get_organization_assignment_change`** - Get organization assignment change by ID
  - Parameters: `orgAssignmentId` (required)
  - Returns: Complete organization assignment change information

- **`submit_organization_assignment_change`** - Submit an organization assignment change
  - Parameters: `orgAssignmentId` (required)
  - Returns: Submission confirmation

- **`get_worker_organization_assignment_changes`** - Get all organization assignment changes for a worker
  - Parameters: `workerId` (required), `limit` (optional), `offset` (optional)
  - Returns: List of organization assignment changes for the worker

#### Organization Assignment Change Workflow:
```
1. initiate_organization_assignment_change(workerId) → returns orgAssignmentId
2. [Update various aspects using PATCH endpoints - not yet implemented]
3. submit_organization_assignment_change(orgAssignmentId) → finalizes the change
```

### 6. Supervisory Organizations (`supervisoryOrganizations`)

Retrieve information about supervisory organizations.

#### Available Tools:

- **`get_supervisory_organizations`** - Get list of supervisory organizations
  - Parameters: `limit` (optional), `offset` (optional)
  - Returns: List of supervisory organizations

- **`get_supervisory_organization`** - Get specific supervisory organization
  - Parameters: `supervisoryOrgId` (required)
  - Returns: Detailed supervisory organization information

### 7. Worker Check-ins (`checkIns`)

Manage worker check-ins for performance and development tracking.

#### Available Tools:

- **`get_worker_check_ins`** - Get all check-ins for a specific worker
  - Parameters: `workerId` (required), `limit` (optional), `offset` (optional)
  - Returns: List of worker check-ins

- **`get_worker_check_in`** - Get specific check-in by ID
  - Parameters: `workerId` (required), `checkInId` (required)
  - Returns: Detailed check-in information

- **`create_worker_check_in`** - Create a new worker check-in
  - Parameters: `workerId` (required), `checkInData` (required)
  - Returns: Created check-in details

- **`update_worker_check_in`** - Update an existing worker check-in
  - Parameters: `workerId` (required), `checkInId` (required), `checkInData` (required)
  - Returns: Updated check-in details

### 8. Workers (`workers`)

Access staffing information for non-terminated workers.

#### Available Tools:

- **`get_staffing_workers`** - Get list of non-terminated workers
  - Parameters: `limit` (optional), `offset` (optional)
  - Returns: List of active workers

- **`get_staffing_worker`** - Get specific worker information from staffing API
  - Parameters: `workerId` (required)
  - Returns: Detailed worker staffing information

- **`search_staffing_workers`** - Search for workers in the staffing system
  - Parameters: `searchTerm` (required), `limit` (optional)
  - Returns: Search results matching the criteria

## Usage Examples

### Example 1: Initiating and Submitting a Job Change

```javascript
// 1. Initiate a job change for worker
const jobChangeResult = await initiate_job_change({
  workerId: "21001"
});

// 2. Get the job change ID from the result
const jobChangeId = jobChangeResult.id;

// 3. [Update job change details using PATCH endpoints - not yet implemented]

// 4. Submit the job change
const submissionResult = await submit_job_change({
  jobChangeId: jobChangeId
});
```

### Example 2: Managing Worker Check-ins

```javascript
// Create a new check-in
const checkIn = await create_worker_check_in({
  workerId: "21001",
  checkInData: {
    checkInDate: "2024-01-15",
    goals: ["Complete project X", "Improve skill Y"],
    comments: "Good progress this quarter"
  }
});

// Update the check-in
const updatedCheckIn = await update_worker_check_in({
  workerId: "21001",
  checkInId: checkIn.id,
  checkInData: {
    status: "completed",
    managerComments: "Excellent work"
  }
});
```

### Example 3: Searching and Managing Job Profiles

```javascript
// Search for job profiles
const jobProfiles = await get_job_profiles({
  limit: 10
});

// Get specific job profile
const specificProfile = await get_job_profile({
  jobProfileId: "SOFTWARE_ENGINEER"
});

// Create a new job profile
const newProfile = await create_job_profile({
  jobProfileData: {
    name: "Senior Software Engineer",
    jobFamily: "Engineering",
    description: "Lead software development projects"
  }
});
```

## Authentication

All tools use the same authentication mechanism as the existing Workday tools:
- Bearer token authentication (legacy)
- OAuth 2.0 Authorization Code Grant (when configured)

The tools will automatically use the appropriate authentication method based on your configuration.

## Error Handling

All tools include comprehensive error handling:
- Parameter validation
- API error responses
- Network error handling
- Detailed error messages for troubleshooting

## API Endpoints

All tools use the Workday Staffing API v7 endpoints:
- Base path: `/staffing/v7`
- Full URL format: `{baseUrl}/staffing/v7/{endpoint}`

## Future Enhancements

The following features are planned for future releases:

1. **Job Change PATCH Endpoints**: Individual update tools for:
   - Location updates
   - Administrative options
   - Move team options
   - Start details
   - Contracts
   - Business title
   - Job profile
   - Position
   - Job classification

2. **Organization Assignment PATCH Endpoints**: Individual update tools for:
   - Company updates
   - Cost center updates
   - Costing updates
   - Region updates
   - Start details

3. **Enhanced Search Capabilities**: More sophisticated search and filtering options

4. **Batch Operations**: Tools for handling multiple operations in a single request

5. **Validation Helpers**: Tools to validate data before submitting changes

## Support

For issues or questions about these tools:
1. Check the Workday API documentation
2. Verify your authentication and permissions
3. Review the error messages for specific guidance
4. Ensure your bearer token has the necessary permissions for staffing operations 
# MCP Server

A Model Context Protocol (MCP) server that provides tools and resources for managing users and projects.

## Features

### Tools
- `get_user` - Get user information by ID
- `list_users` - List all users
- `get_project` - Get project information by ID
- `list_projects` - List all projects
- `create_user` - Create a new user

### Resources
- `users://list` - Complete list of all users
- `projects://list` - Complete list of all projects

## Installation

1. Install dependencies:
```bash
npm install
```

2. Build the TypeScript code:
```bash
npm run build
```

3. Start the server:
```bash
npm start
```

## Development

Run in development mode with automatic rebuilding:
```bash
npm run dev
```

## Usage

This MCP server runs on stdio transport. It can be integrated with MCP-compatible clients like Claude Desktop or other applications that support the Model Context Protocol.

### Example Tool Calls

1. List all users:
```json
{
  "name": "list_users",
  "arguments": {}
}
```

2. Get a specific user:
```json
{
  "name": "get_user",
  "arguments": {
    "id": 1
  }
}
```

3. Create a new user:
```json
{
  "name": "create_user",
  "arguments": {
    "name": "David",
    "email": "david@example.com"
  }
}
```

### Example Resource Access

Access the users resource:
```
uri: users://list
```

Access the projects resource:
```
uri: projects://list
```

## Configuration

The server currently uses sample data stored in memory. You can modify the `sampleData` object in `src/index.ts` to customize the data or integrate with a real database.

## Architecture

- Built with TypeScript
- Uses the official MCP SDK (`@modelcontextprotocol/sdk`)
- Supports both tools (function calls) and resources (data access)
- Runs on stdio transport for easy integration

## License

MIT 

## Available Tools

### Workday Tools

1. **get_workday_worker**
   - Description: Get worker information from Workday API using worker ID
   - Parameters: workerId (string) - Worker ID in Workday system

2. **search_workday_workers**
   - Description: Search for workers in Workday by name or other criteria
   - Parameters: searchTerm (string) - Search term like name, department, etc.

3. **list_workers**
   - Description: List all workers
   - Parameters: limit (number) - Number of workers to list

4. **create_one_time_payment** ✨ NEW
   - Description: Create a one-time payroll input/payment for a worker in Workday
   - Parameters:
     - workerId (string, required) - Worker ID in Workday system
     - payComponentId (string, required) - Pay Component ID for the payment type
     - startDate (string, required) - Start date in YYYY-MM-DD format  
     - endDate (string, required) - End date in YYYY-MM-DD format
     - amount (number, required) - Payment amount
     - positionId (string, optional) - Position ID if required by pay component
     - currency (string, optional) - Currency code (defaults to pay group currency)
     - comment (string, optional) - Optional comment for the payment
     - runCategories (array, optional) - Run category IDs
     - worktags (array, optional) - Worktag IDs for cost allocation

### Example Usage

```javascript
// Create a one-time bonus payment
{
  "workerId": "21001",
  "payComponentId": "BONUS",
  "startDate": "2024-01-01",
  "endDate": "2024-01-31",
  "amount": 1000.00,
  "comment": "Q4 Performance Bonus",
  "currency": "USD"
}
```

### Other Tools

5. **get_weather**
   - Description: Get current weather and forecast for a specific city
   - Parameters: city (string) - City name

6. **get_user, list_users, get_project, list_projects, create_user**
   - Description: Sample CRUD operations for demonstration

## Configuration

The Workday tools require the following environment variables:
- `WORKDAY_BEARER_TOKEN`: Your Workday API bearer token
- `WORKDAY_BASE_URL`: Your Workday tenant base URL (e.g., https://wcpdev-services1.wd101.myworkday.com)
- `WORKDAY_TENANT`: Your Workday tenant ID (e.g., wday_wcpdev11)

## API Endpoints Used

- **Workers**: `/api/staffing/v6/{tenant}/workers`
- **Payroll Inputs**: `/ccx/api/payroll/v2/{tenant}/payrollInputs` 
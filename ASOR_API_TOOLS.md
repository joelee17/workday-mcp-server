# ASOR API Tools

This document describes the Agent System of Record (ASOR) API tools that have been added to the MCP server based on Workday's ASOR v1 API specification.

## Overview

The Agent System of Record Service is used to create and maintain Agent Definitions in Workday. These tools allow you to manage AI agents that can perform various skills and integrate with Workday resources.

## Available Tools

### 1. `get_agent_definitions`
**Description:** Retrieve all Agent Definitions from the Agent System of Record

**Parameters:** None

**Usage:**
```javascript
{
  "name": "get_agent_definitions",
  "arguments": {}
}
```

**Response:** Returns a collection of agent definitions with their skills and capabilities.

### 2. `create_agent_definition` 
**Description:** Create or update an Agent Definition in the Agent System of Record

**Required Parameters:**
- `name` (string): Human readable name of the agent
- `description` (string): Human-readable description of the agent
- `version` (string): Version of the agent (format is up to the provider)
- `url` (string): URL where the agent is hosted
- `skills` (array): Array of skills that the agent can perform

**Optional Parameters:**
- `id` (string): Agent Definition ID to link Agent Versions
- `documentationUrl` (string): URL to documentation for the agent
- `iconUrl` (string): URL to an icon for the agent
- `provider` (object): Service provider information
  - `organization` (string): Organization name
  - `url` (string): Provider URL
- `capabilities` (object): Optional capabilities supported by the agent
  - `pushNotifications` (boolean): Agent can notify updates to client
  - `stateTransitionHistory` (boolean): Agent exposes status change history
  - `streaming` (boolean): Agent supports Server-Sent Events
- `supportsAuthenticatedExtendedCard` (boolean): Whether agent supports providing extended card when user is authenticated

**Skills Structure:**
Each skill must have:
- `id` (string): Unique identifier for the skill
- `name` (string): Human readable name of the skill
- `description` (string): Description of what the skill does
- `tags` (array, optional): Set of tagwords describing skill capabilities

## API Details

- **Base Path:** `/ccx/api/asor/v1/{tenant}`
- **Authentication:** Uses OAuth 2.0 Bearer tokens with refresh token flow (managed automatically by the MCP server)
- **Content Type:** `application/json`
- **URL Structure:** Consistent with other Workday REST APIs
- **Update Logic:** Updates existing agent if same name, provider organization, and version exist

## Security Requirements

All endpoints require appropriate Workday permissions:
- **Secured by:** Development, Setup: Agents+TG

## Error Handling

The tools handle standard HTTP error codes:
- `200`: Successful response
- `201`: Resource created
- `400`: Invalid request
- `401`: Invalid resource or operation
- `403`: User has insufficient permissions
- `404`: Resource not found

## Implementation Notes

- All tools are implemented in `src/asor-api.ts`
- Tool definitions are in the `ASOR_TOOLS` array in `src/index.ts`
- Uses the same refresh token authentication system as other Workday APIs
- Responses are formatted with appropriate emojis and JSON formatting for readability

## Example Usage

### Create a Financial Audit Agent
```javascript
{
  "name": "create_agent_definition",
  "arguments": {
    "name": "Financial Audit Agent",
    "description": "This Financial Audit Agent acts as a safeguard, offering an independent review that instills confidence in financial information.",
    "version": "1.0.0",
    "url": "https://example.com/agent/finance",
    "skills": [
      {
        "id": "financial-audit-analyzer",
        "name": "Financial Audit Analyzer", 
        "description": "This skill analyzes many financial documents in the boundary for the supervisory org.",
        "tags": [
          { "tag": "finance" },
          { "tag": "audit" },
          { "tag": "analysis" }
        ]
      }
    ],
    "provider": {
      "organization": "Agent Provider Company Ltd.",
      "url": "https://agent.company.com/agents"
    },
    "capabilities": {
      "pushNotifications": true,
      "stateTransitionHistory": true,
      "streaming": true
    },
    "documentationUrl": "https://agent.company.com/agent1/doc",
    "iconUrl": "https://cdn1.iconfinder.com/data/icons/material-design-icons-light/24/link-variant-512.png",
    "supportsAuthenticatedExtendedCard": true
  }
}
```

### Retrieve All Agent Definitions
```javascript
{
  "name": "get_agent_definitions",
  "arguments": {}
}
```

## HTTP API Examples

### Direct HTTP Calls

**Get Agent Definitions:**
```http
GET https://your-tenant.workday.com/ccx/api/asor/v1/your-tenant/agentDefinition
Authorization: Bearer <access_token>
Accept: application/json
```

**Create Agent Definition:**
```http
POST https://your-tenant.workday.com/ccx/api/asor/v1/your-tenant/agentDefinition
Authorization: Bearer <access_token>
Accept: application/json
Content-Type: application/json

{
  "name": "Financial Audit Agent",
  "description": "Financial analysis and audit agent",
  "version": "1.0.0",
  "url": "https://example.com/agent/finance",
  "skills": [
    {
      "id": "audit-analyzer",
      "name": "Audit Analyzer",
      "description": "Analyzes financial documents"
    }
  ]
}
```

## Key Features

- **Agent Management:** Create and maintain AI agent definitions
- **Skills Definition:** Define specific capabilities each agent possesses
- **Provider Information:** Track which organization provides each agent
- **Capabilities:** Specify advanced features like push notifications and streaming
- **Workday Integration:** Seamlessly integrates with Workday's agent ecosystem
- **Version Control:** Support for agent versioning and updates

## Integration with Your MCP Server

The ASOR tools are now fully integrated into your MCP server with:
- ✅ **29 total tools** available (including 2 new ASOR tools)
- ✅ **Consistent authentication** using your existing refresh token system
- ✅ **Same URL structure** as your other Workday APIs (`/ccx/api/asor/v1/{tenant}/...`)
- ✅ **Error handling** following the same patterns as other tools
- ✅ **JSON formatting** with emoji indicators for easy readability

These tools enable you to programmatically manage AI agents in Workday, perfect for enterprise AI agent lifecycle management! 
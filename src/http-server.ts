#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import express, { Request, Response } from 'express';
import cors from 'cors';

// Same server setup as stdio version
const server = new Server(
  {
    name: 'mcp-server-http',
    version: '1.0.0',
  }
);

// Same sample data
const sampleData = {
  users: [
    { id: 1, name: 'Alice', email: 'alice@example.com' },
    { id: 2, name: 'Bob', email: 'bob@example.com' },
    { id: 3, name: 'Charlie', email: 'charlie@example.com' },
  ],
  projects: [
    { id: 1, name: 'Project A', status: 'active', owner: 'Alice' },
    { id: 2, name: 'Project B', status: 'completed', owner: 'Bob' },
    { id: 3, name: 'Project C', status: 'planning', owner: 'Charlie' },
  ],
};

// Same handlers as stdio version
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'get_user',
        description: 'Get user information by ID',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'number', description: 'User ID' },
          },
          required: ['id'],
        },
      },
      {
        name: 'list_users',
        description: 'List all users',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        name: 'create_user',
        description: 'Create a new user',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'User name' },
            email: { type: 'string', description: 'User email' },
          },
          required: ['name', 'email'],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  if (!args) {
    throw new Error('Arguments are required');
  }

  switch (name) {
    case 'list_users':
      return {
        content: [{ type: 'text', text: JSON.stringify(sampleData.users, null, 2) }],
      };
    case 'get_user':
      const user = sampleData.users.find(u => u.id === args.id);
      if (!user) throw new Error(`User with ID ${args.id} not found`);
      return {
        content: [{ type: 'text', text: JSON.stringify(user, null, 2) }],
      };
    case 'create_user':
      const newId = Math.max(...sampleData.users.map(u => u.id)) + 1;
      const newUser = { id: newId, name: args.name as string, email: args.email as string };
      sampleData.users.push(newUser);
      return {
        content: [{ type: 'text', text: `Created user: ${JSON.stringify(newUser, null, 2)}` }],
      };
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

// Express app for HTTP endpoints
const app = express();
app.use(cors());
app.use(express.json());

// REST API endpoints as an alternative to MCP
app.get('/api/users', (req: Request, res: Response) => {
  res.json(sampleData.users);
});

app.get('/api/users/:id', (req: Request, res: Response) => {
  const user = sampleData.users.find(u => u.id === parseInt(req.params.id));
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

app.post('/api/users', (req: Request, res: Response) => {
  const { name, email } = req.body;
  const newId = Math.max(...sampleData.users.map(u => u.id)) + 1;
  const newUser = { id: newId, name, email };
  sampleData.users.push(newUser);
  res.status(201).json(newUser);
});

// MCP over Server-Sent Events - temporarily disabled due to SDK changes
// app.use('/sse', SSEServerTransport.createExpressRoute(server));

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`MCP HTTP Server running on port ${PORT}`);
  console.log(`- REST API available at: http://localhost:${PORT}/api`);
}); 
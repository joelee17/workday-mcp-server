#!/usr/bin/env node

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn } from 'child_process';

async function createMCPClient() {
  // Spawn the MCP server process
  const serverProcess = spawn('node', ['../dist/index.js'], {
    cwd: process.cwd(),
    stdio: ['pipe', 'pipe', 'inherit']
  });

  // Create transport using the server's stdio
  const transport = new StdioClientTransport({
    reader: serverProcess.stdout,
    writer: serverProcess.stdin
  });

  // Create and initialize the client
  const client = new Client(
    {
      name: 'example-client',
      version: '1.0.0'
    },
    {
      capabilities: {}
    }
  );

  await client.connect(transport);
  return { client, serverProcess };
}

async function main() {
  const { client, serverProcess } = await createMCPClient();

  try {
    // List available tools
    console.log('Available tools:');
    const tools = await client.listTools();
    console.log(JSON.stringify(tools, null, 2));

    // Call a tool
    console.log('\nCalling list_users tool:');
    const result = await client.callTool({
      name: 'list_users',
      arguments: {}
    });
    console.log(JSON.stringify(result, null, 2));

    // Create a new user
    console.log('\nCreating a new user:');
    const createResult = await client.callTool({
      name: 'create_user',
      arguments: {
        name: 'David',
        email: 'david@example.com'
      }
    });
    console.log(JSON.stringify(createResult, null, 2));

    // List resources
    console.log('\nAvailable resources:');
    const resources = await client.listResources();
    console.log(JSON.stringify(resources, null, 2));

    // Read a resource
    console.log('\nReading users resource:');
    const resourceResult = await client.readResource({
      uri: 'users://list'
    });
    console.log(JSON.stringify(resourceResult, null, 2));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Clean up
    await client.close();
    serverProcess.kill();
  }
}

main().catch(console.error); 
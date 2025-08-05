# MCP Server Integration Guide

This guide explains how to call your MCP server from external systems.

## 🔌 Integration Methods

### 1. Claude Desktop Integration

**Best for**: Using with Claude Desktop application

1. **Build your server**:
   ```bash
   npm run build
   ```

2. **Configure Claude Desktop**:
   - On macOS: Edit `~/Library/Application Support/Claude/claude_desktop_config.json`
   - On Windows: Edit `%APPDATA%/Claude/claude_desktop_config.json`

3. **Add your server configuration**:
   ```json
   {
     "mcpServers": {
       "my-mcp-server": {
         "command": "node",
         "args": ["dist/index.js"],
         "cwd": "/path/to/your/mcp-server"
       }
     }
   }
   ```

4. **Restart Claude Desktop** - Your tools will now be available!

### 2. Programmatic Integration (Node.js/JavaScript)

**Best for**: Integrating with your own applications

```javascript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn } from 'child_process';

// Start the MCP server
const serverProcess = spawn('node', ['dist/index.js']);
const transport = new StdioClientTransport({
  reader: serverProcess.stdout,
  writer: serverProcess.stdin
});

// Create client and connect
const client = new Client({ name: 'my-app', version: '1.0.0' }, { capabilities: {} });
await client.connect(transport);

// Use the tools
const users = await client.callTool({ name: 'list_users', arguments: {} });
console.log(users);
```

### 3. HTTP/REST API Integration

**Best for**: Web applications, any programming language

1. **Start the HTTP server**:
   ```bash
   npm run start:http
   ```

2. **Use REST endpoints**:
   ```bash
   # Get all users
   curl http://localhost:3000/api/users
   
   # Get specific user
   curl http://localhost:3000/api/users/1
   
   # Create new user
   curl -X POST http://localhost:3000/api/users \
     -H "Content-Type: application/json" \
     -d '{"name": "David", "email": "david@example.com"}'
   ```

3. **Or use MCP over Server-Sent Events**:
   ```javascript
   // Connect to MCP over HTTP
   const response = await fetch('http://localhost:3000/sse', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({
       method: 'tools/list',
       params: {}
     })
   });
   ```

### 4. Python Integration

**Best for**: Python applications, data science

```python
import subprocess
import json
import sys

class MCPClient:
    def __init__(self, server_path):
        self.process = subprocess.Popen(
            ['node', server_path],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
    
    def call_tool(self, name, arguments={}):
        request = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "tools/call",
            "params": {
                "name": name,
                "arguments": arguments
            }
        }
        
        self.process.stdin.write(json.dumps(request) + '\n')
        self.process.stdin.flush()
        
        response = self.process.stdout.readline()
        return json.loads(response)

# Usage
client = MCPClient('dist/index.js')
users = client.call_tool('list_users')
print(users)
```

### 5. cURL/Command Line Integration

**Best for**: Scripts, testing, automation

```bash
# Start HTTP server
npm run start:http

# Test endpoints
curl -s http://localhost:3000/api/users | jq '.'
curl -s http://localhost:3000/api/users/1 | jq '.'

# Create new user
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{"name": "Test User", "email": "test@example.com"}' | jq '.'
```

## 🔍 Available Tools & Resources

### Tools (Function Calls)
- `list_users` - Get all users
- `get_user` - Get user by ID (requires `id` parameter)
- `create_user` - Create new user (requires `name` and `email`)
- `list_projects` - Get all projects
- `get_project` - Get project by ID (requires `id` parameter)

### Resources (Data Access)
- `users://list` - All users data
- `projects://list` - All projects data

## 🐛 Testing Your Integration

1. **Test with example client**:
   ```bash
   cd examples
   node client-example.js
   ```

2. **Test HTTP endpoints**:
   ```bash
   # Start HTTP server
   npm run start:http
   
   # Test in another terminal
   curl http://localhost:3000/api/users
   ```

3. **Test with Claude Desktop**:
   - Configure as shown above
   - Ask Claude: "Can you list all users using the MCP server?"

## 🚀 Deployment Options

### Local Development
- Use stdio transport for Claude Desktop
- Use HTTP server for web development

### Production
- Deploy HTTP server to cloud platforms (Heroku, AWS, etc.)
- Use process managers like PM2 for stdio servers
- Consider containerization with Docker

### Docker Example
```dockerfile
FROM node:18
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "run", "start:http"]
```

## 🔐 Security Considerations

- **Authentication**: Add API keys or JWT tokens for HTTP endpoints
- **Rate Limiting**: Implement rate limiting for public endpoints
- **Input Validation**: Validate all tool arguments
- **CORS**: Configure CORS properly for web applications
- **HTTPS**: Use HTTPS in production

## 📚 Next Steps

1. **Customize the data**: Replace sample data with your real data sources
2. **Add more tools**: Extend functionality with additional tools
3. **Add persistence**: Connect to databases or file systems
4. **Add authentication**: Secure your endpoints
5. **Monitor usage**: Add logging and monitoring

## 🆘 Troubleshooting

**Common Issues**:
- **"Command not found"**: Make sure Node.js is installed
- **"Module not found"**: Run `npm install` first
- **"Port already in use"**: Change the PORT environment variable
- **"Claude can't find server"**: Check file paths in config are absolute

**Getting Help**:
- Check server logs with `console.error()` messages
- Test tools individually using the example client
- Verify your configuration files are valid JSON 
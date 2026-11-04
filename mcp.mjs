import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {createMcpServer} from './tools.mjs';
import {ensureServer} from './connection.mjs';
await ensureServer();
await createMcpServer().connect(new StdioServerTransport());

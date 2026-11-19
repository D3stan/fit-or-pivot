import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { openDatabase } from './db.js';
import { createMcpServer } from './mcp.js';

async function main(): Promise<void> {
  const db = openDatabase();
  const server = createMcpServer(db);
  const transport = new StdioServerTransport();

  let closing = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (closing) return;
    closing = true;
    console.error(`[mcp-stdio] received ${signal}, shutting down`);
    try {
      await server.close();
    } catch (err) {
      console.error('[mcp-stdio] error closing server:', err);
    }
    try {
      db.close();
    } catch (err) {
      console.error('[mcp-stdio] error closing database:', err);
    }
    process.exit(0);
  };

  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });
  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });

  await server.connect(transport);
  console.error('[mcp-stdio] Fit or Pivot MCP server listening on stdio');
}

main().catch((err) => {
  console.error('[mcp-stdio] fatal error:', err);
  process.exit(1);
});

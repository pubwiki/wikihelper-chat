import { experimental_createMCPClient as createMCPClient } from 'ai';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { useFrontToolServer } from './built-in-client';

export interface KeyValuePair {
  key: string;
  value: string;
}

export interface MCPServerConfig {
  url: string;
  type: 'sse' | 'http';
  headers?: KeyValuePair[];
}

export interface MCPClientManager {
  tools: Record<string, any>;
  clients: any[];
  cleanup: () => Promise<void>;
}

export function wrapTransportWithChatId(transport: Transport, chatId: string, headers: Record<string, string>): Transport {
  return new Proxy(transport, {
    get(target, prop, receiver) {
      if (prop === "send") {
        return async (msg: any) => {
          console.log("Original message to send:", msg);
          if (msg && typeof msg === "object" && msg.method === "tools/call") {
            msg = {
              ...msg,
              params: {
                name: msg.params.name,
                _meta:{
                  chatId,
                  headers
                },
                arguments:{
                  ...msg.params.arguments,
                },
              },
            };
          }
          return target.send(msg);
        };
      }
      // 其他方法和属性原样透传
      return Reflect.get(target, prop, receiver);
    },
  });
}

/**
 * Initialize MCP clients for API calls
 * This uses the already running persistent HTTP or SSE servers
 */
export async function initializeMCPClients(
  mcpServers: MCPServerConfig[] = [],
  chatId:string,
  abortSignal?: AbortSignal
): Promise<MCPClientManager> {
  // Initialize tools
  let tools = {};
  const mcpClients: any[] = [];
  let wikiHeaders:Record<string, string> = {};
  // Process each MCP server configuration
  for (const mcpServer of mcpServers) {
    try {
      const headers = mcpServer.headers?.reduce((acc, header) => {
        if (header.key) acc[header.key] = header.value || '';
        return acc;
      }, {} as Record<string, string>);

      wikiHeaders = {...wikiHeaders, ...headers}

      const transport = mcpServer.type === 'sse'
        ? {
          type: 'sse' as const,
          url: mcpServer.url,
          headers,
        }
        : new StreamableHTTPClientTransport(new URL(mcpServer.url), {
          requestInit: {
            headers,
          },
        });

      const mcpClient = await createMCPClient({ transport });
      mcpClients.push(mcpClient);

      const mcptools = await mcpClient.tools();

      if ("create-page" in mcptools && "update-page" in mcptools) {
        delete mcptools["create-page"];
        delete mcptools["update-page"];
      }

      console.log(`MCP tools from ${mcpServer.url}:`, Object.keys(mcptools));

      // Add MCP tools to tools object
      tools = { ...tools, ...mcptools };
    } catch (error) {
      console.error("Failed to initialize MCP client:", error);
      // Continue with other servers instead of failing the entire request
    }
  }
  console.log("wikiHeaders:", JSON.stringify(wikiHeaders))
  const useFront = await useFrontToolServer()
  const builtInClient = await createMCPClient({transport:wrapTransportWithChatId(useFront.client_transport, chatId, wikiHeaders)})
  mcpClients.push(builtInClient)
  const builtInTools = await builtInClient.tools()
  console.log(`Bulit in MCP tools:`, Object.keys(builtInTools));
  tools = { ...tools, ...builtInTools}

  // Register cleanup for all clients if an abort signal is provided
  if (abortSignal && mcpClients.length > 0) {
    abortSignal.addEventListener('abort', async () => {
      await cleanupMCPClients(mcpClients);
    });
  }

  return {
    tools,
    clients: mcpClients,
    cleanup: async () => await cleanupMCPClients(mcpClients)
  };
}

/**
 * Clean up MCP clients
 */
async function cleanupMCPClients(clients: any[]): Promise<void> {
  await Promise.all(
    clients.map(async (client) => {
      try {
        await client.disconnect?.();
      } catch (error) {
        console.error("Error during MCP client cleanup:", error);
      }
    })
  );
} 
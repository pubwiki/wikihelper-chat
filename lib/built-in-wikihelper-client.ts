import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { experimental_createMCPClient as createMCPClient } from "ai";

const MCP_WIKIHELPER_URL = "http://192.168.31.227:8080/mcp";

export async function buildWikiHelperTools(headers: Record<string, string> = {},disable_tools:string[] = []){
    const client = await createMCPClient({
      transport: new StreamableHTTPClientTransport(
        new URL(MCP_WIKIHELPER_URL),
        {
          requestInit: {
            headers,
          },
        }
      ),
    });
    const tools = await client.tools();
    disable_tools.forEach(toolName=>{
      if(tools[toolName]){
        delete tools[toolName]
      }
    });
    return {tools,client}
}
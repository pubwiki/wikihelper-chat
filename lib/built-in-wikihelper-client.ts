import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { experimental_createMCPClient as createMCPClient } from "ai";

const MCP_WIKIHELPER_URL = process.env.WIKI_MCP_URL!;

export async function buildWikiHelperTools(headers: Record<string, string> = {},disableTools:string[] = []){
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
    disableTools.forEach(toolName=>{
      if(tools[toolName]){
        delete tools[toolName]
      }
    });
    return {tools,client}
}
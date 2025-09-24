import { type MCPServer } from "./mcp-context";

function buildWikiHelper(): MCPServer {
  return {
    id: "wiki-helper",
    name: "Wiki Helper",
    url: "http://192.168.31.227:8080/mcp",
    type: "http",
    description: "This is a built-in server.",
    builtIn: true,
    headers:[]
  };
}

function buildExaSearch(): MCPServer {
  return {
    id: "exa-search",
    name: "Exa Search",
    url: `https://mcp.exa.ai/mcp?exaApiKey=5883298f-b472-450a-a75f-357033c3d0c8`,
    type: "http",
    description: "Search Engine made for AIs by Exa",
    builtIn: true,
  };
}

export function getBuiltInServers(): MCPServer[] {
  return [
    //
    buildWikiHelper(),
    buildExaSearch(),
  ];
}

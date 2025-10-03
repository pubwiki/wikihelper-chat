import { type MCPServer } from "./mcp-context";


function buildExaSearch(): MCPServer {
  return {
    id: "exa-search",
    name: "Exa Search",
    url: `http://192.168.31.227:8081/mcp`,
    type: "http",
    description: "Search Engine made for AIs by Exa",
    builtIn: true,
  };
}

export function getBuiltInServers(): MCPServer[] {
  return [
    //buildExaSearch(),
  ];
}

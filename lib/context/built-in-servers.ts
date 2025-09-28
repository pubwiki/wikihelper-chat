import { type MCPServer } from "./mcp-context";

export function buildWikiHelper(): MCPServer {
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
    url: `http://192.168.31.227:8081/mcp`,
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

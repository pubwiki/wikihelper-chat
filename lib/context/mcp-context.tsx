"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useLocalStorage } from "@/lib/hooks/use-local-storage";
import { getBuiltInServers } from "./built-in-servers";

export interface KeyValuePair {
  key: string;
  value: string;
}

export type ServerStatus =
  | "connected"
  | "connecting"
  | "disconnected"
  | "error";

// Define storage keys as constants
const STORAGE_KEYS = {
  MCP_SERVERS: "mcp-servers",
  SELECTED_MCP_SERVERS: "selected-mcp-servers",
} as const;

export interface MCPTool {
  name: string;
  description?: string;
  inputSchema?: any;
}

export interface MCPServer {
  id: string;
  name: string;
  url: string;
  type: "sse" | "http";
  command?: string;
  args?: string[];
  env?: KeyValuePair[];
  headers?: KeyValuePair[];
  description?: string;
  status?: ServerStatus;
  errorMessage?: string;
  tools?: MCPTool[];
  builtIn?: boolean; // Indicates if the server is a built-in option
  onFetchHeader?:()=>KeyValuePair[],
}

export interface MCPServerApi {
  type: "sse" | "http";
  url: string;
  headers?: KeyValuePair[];
}



export interface CreateWikiArgs {
  name: string;
  slug: string;
  language: string;
}

export interface ChangeWikiPageArgs {
  source: string; // wikitext source
  title: string; // page title
  comment?: string; // edit comment
  type:"create" | "update";
}

export type UserOptionBtn = {title:string,action:string}

interface MCPContextType {
  mcpServers: MCPServer[];
  setMcpServers: (servers: MCPServer[]) => void;
  selectedMcpServers: string[];
  setSelectedMcpServers: (serverIds: string[]) => void;
  mcpServersForApi: MCPServerApi[];
  startServer: (serverId: string) => Promise<boolean>;
  stopServer: (serverId: string) => Promise<boolean>;
  updateServerStatus: (
    serverId: string,
    status: ServerStatus,
    errorMessage?: string
  ) => void;
  getActiveServersForApi: () => MCPServerApi[];
  pubwikiCookies:string[],
  setPubwikiCookies: (cookies:string[]) => void,
  userOptions: UserOptionBtn[],
  setUserOptions: (opts:UserOptionBtn[]) => void,
  createWikiStatus: { args: CreateWikiArgs; status: string } | undefined;
  pendingChangePageToolCall: null | {
    type: "create" | "update";
    args: ChangeWikiPageArgs;
  };
  setCreateWikiStatus: (value: { args: CreateWikiArgs; status: string } | undefined) => void;
  setPendingChangePageToolCall: (value: null | {
    type: "create" | "update";
    args: ChangeWikiPageArgs;
  }) => void;
  pendingChangePageHTML:string,
  setPendingChangePageHTML:(html:string)=>void
}

const MCPContext = createContext<MCPContextType | undefined>(undefined);

// Helper function to check server health and get tools
async function checkServerHealth(
  url: string,
  headers?: KeyValuePair[]
): Promise<{ ready: boolean; tools?: MCPTool[]; error?: string }> {
  try {
    const response = await fetch('/api/mcp-health', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url, headers }),
    });

    const result = await response.json();
    return result;
  } catch (error) {
    console.error(`Error checking server health for ${url}:`, error);
    return {
      ready: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export function MCPProvider({ children }: { children: React.ReactNode }) {
  const builtInServers = getBuiltInServers();
  const builtInServersId = builtInServers.map(s=>s.id);
  const [mcpServers, setMcpServers] = useLocalStorage<MCPServer[]>(
    STORAGE_KEYS.MCP_SERVERS,
    [],
    (s)=>{
      return s.filter((ss)=>!builtInServersId.includes(ss.id)).filter((ss)=>!ss.builtIn).concat(
        builtInServers.map((bs)=>{
          const find = s.find((server) => server.id === bs.id)
          if(find){
            return {
              ...bs,
              status:find.status,
              tools:find.tools
            }
          }
          return bs
        }
      ))
    }
  );
  const [pubwikiCookies, setPubwikiCookies] = useState<string[]>([]);
  const [userOptions,setUserOptions] = useState<UserOptionBtn[]>([]);
  const [createWikiStatus, setCreateWikiStatus] = useState<
    { args: CreateWikiArgs; status: string } | undefined
  >(undefined);
  const [pendingChangePageToolCall, setPendingChangePageToolCall] = useState<null | {
    type: "create" | "update";
    args: ChangeWikiPageArgs;
  }>(null);

  const [pendingChangePageHTML,setPendingChangePageHTML] = useState<string>("");

  const [selectedMcpServers, setSelectedMcpServers] = useLocalStorage<string[]>(
    STORAGE_KEYS.SELECTED_MCP_SERVERS,
    [],
    (s)=>{
      return s.filter((id) => !s.includes(id)).concat(builtInServersId)
    }
  );

  // Create a ref to track active servers and avoid unnecessary re-renders
  const activeServersRef = useRef<Record<string, boolean>>({});

  // Helper to get a server by ID
  const getServerById = (serverId: string): MCPServer | undefined => {
    return mcpServers.find((server) => server.id === serverId);
  };

  // Update server status
  const updateServerStatus = (
    serverId: string,
    status: ServerStatus,
    errorMessage?: string
  ) => {
    setMcpServers((currentServers) =>
      currentServers.map((server) =>
        server.id === serverId
          ? { ...server, status, errorMessage: errorMessage || undefined }
          : server
      )
    );
  };

  // Update server with tools
  const updateServerWithTools = (
    serverId: string,
    tools: MCPTool[],
    status: ServerStatus = "connected"
  ) => {
    setMcpServers((currentServers) =>
      currentServers.map((server) =>
        server.id === serverId
          ? { ...server, tools, status, errorMessage: undefined }
          : server
      )
    );
  };

  // Get active servers formatted for API usage
  const getActiveServersForApi = (): MCPServerApi[] => {
    return selectedMcpServers
      .map((id) => getServerById(id))
      .filter(
        (server): server is MCPServer =>
          !!server && server.status === "connected"
      )
      .map((server) => ({
        type: server.type,
        url: server.url,
        headers: server.id==="wiki-helper"?server.headers?.concat([{key:"reqcookie",value:pubwikiCookies.join("; ")}]):server.headers,
      }));
  };

  // Start a server using MCP SDK
  const startServer = async (serverId: string): Promise<boolean> => {
    const server = getServerById(serverId);
    if (!server) {
      console.error(`[startServer] Server not found for ID: ${serverId}`);
      return false;
    }

    console.log(
      `[startServer] Starting server: ${server.name} (${server.type})`
    );

    // Mark server as connecting
    updateServerStatus(serverId, "connecting");

    try {
      console.log(
        `[startServer] Checking ${server.type} server at: ${server.url}`
      );

      if (!server.url) {
        console.error(
          `[startServer] No URL provided for ${server.type} server`
        );
        updateServerStatus(serverId, "error", "No URL provided");
        return false;
      }

      const healthResult = await checkServerHealth(server.url, server.headers);
      
      if (healthResult.ready && healthResult.tools) {
        updateServerWithTools(serverId, healthResult.tools, "connected");
        activeServersRef.current[serverId] = true;
        return true;
      } else {
        updateServerStatus(
          serverId,
          "error",
          healthResult.error || "Could not connect to server"
        );
        return false;
      }
    } catch (error) {
      console.error(`[startServer] Error starting server:`, error);
      updateServerStatus(
        serverId,
        "error",
        `Error: ${error instanceof Error ? error.message : String(error)}`
      );
      return false;
    }
  };

  // Stop a server
  const stopServer = async (serverId: string): Promise<boolean> => {
    const server = getServerById(serverId);
    if (!server) return false;

    try {
      // Mark as not active
      delete activeServersRef.current[serverId];

      // Update server status and clear tools
      setMcpServers((currentServers) =>
        currentServers.map((s) =>
          s.id === serverId
            ? { ...s, status: "disconnected", tools: undefined, errorMessage: undefined }
            : s
        )
      );
      return true;
    } catch (error) {
      console.error(`Error stopping server ${serverId}:`, error);
      return false;
    }
  };

  // Calculate mcpServersForApi based on current state
  const mcpServersForApi = getActiveServersForApi();
  
  const initializedRef = useRef(false);
  

  useEffect(() => {
    if (initializedRef.current) return;
    if (mcpServers.length === 0) return; 

    initializedRef.current = true;

    const init = async () => {
      for (const sid of builtInServersId) {
        const server = getServerById(sid);
        console.log(mcpServers)
        if (server) {
          await startServer(sid);
        }
      }
    };

    init();
  }, [mcpServers]);

  return (
    <MCPContext.Provider
      value={{
        pubwikiCookies,
        setPubwikiCookies,
        mcpServers,
        setMcpServers,
        selectedMcpServers,
        setSelectedMcpServers,
        mcpServersForApi,
        startServer,
        stopServer,
        updateServerStatus,
        getActiveServersForApi,
        userOptions,
        setUserOptions,
        createWikiStatus,
        setCreateWikiStatus,
        pendingChangePageToolCall,
        setPendingChangePageToolCall, 
        pendingChangePageHTML,
        setPendingChangePageHTML
      }}
    >
      {children}
    </MCPContext.Provider>
  );
}

export function useMCP() {
  const context = useContext(MCPContext);
  if (context === undefined) {
    throw new Error("useMCP must be used within a MCPProvider");
  }
  return context;
}

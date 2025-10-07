/**
 * Constants used throughout the application
 */

// Local storage keys
export const STORAGE_KEYS = {
  MCP_SERVERS: "mcp-servers",
  SELECTED_MCP_SERVERS: "selected-mcp-servers",
  SIDEBAR_STATE: "sidebar-state"
}; 
const host = process.env.NEXT_PUBLIC_HOST;

export const WIKIFRAM_ENDPOINT = `https://${host}/`
export const API_BACKEND = `https://${host}/`
export const SITE_SUFFIX = `.${host}`
export const SIGN_UP_URL = `https://${host}/index.php?title=%E7%89%B9%E6%AE%8A:%E5%88%9B%E5%BB%BA%E8%B4%A6%E6%88%B7&returnto=%E9%A6%96%E9%A1%B5`

if(typeof window !== "undefined"){
  console.log("Constants:",{WIKIFRAM_ENDPOINT,API_BACKEND,SITE_SUFFIX,SIGN_UP_URL})
}
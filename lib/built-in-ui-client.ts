import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
/* eslint-disable n/no-missing-import */
import type { RegisteredTool } from "@modelcontextprotocol/sdk/server/mcp.js";
import type {
  TextContent,
  ToolAnnotations,
} from "@modelcontextprotocol/sdk/types.js";
import { clientUIResultManager } from "./client-ui-result";
import { randomUUID } from "crypto";
import { buildWikiHelperTools } from "./built-in-wikihelper-client";

export enum EditContentFormat {
    css = "sanitized-css",  
    wikitext = "wikitext",
    lua = "Scribunto"
}

function minifyMediaWikiHTML(html:string) {
  return html
    // 去掉换行和制表符
    .replace(/[\n\r\t]+/g, "")
    // 去掉标签之间的多余空格（>   < -> ><）
    .replace(/>\s+</g, "><")
    // 去掉行首行尾的多余空格
    .replace(/^\s+|\s+$/g, "")
    // 压缩标签外部连续空格（标签之间可能会有很多空格）
    .replace(/\s{2,}/g, " ");
}


export async function makeRestPostRequest<T>(
	path: string,
	wikiServer:string,
	appendHeaders:Record<string,string>,
	body?: Record<string, unknown>
): Promise<T | null> {
	try {
		const headers: Record<string, string> = {
			Accept: 'application/json',
			'Content-Type': 'application/json',
			...appendHeaders
		};
		
		
		const response = await fetch( `${ wikiServer }${ path }`, {
			headers: headers,
			method: 'POST',
			body: JSON.stringify(body)
		} );
		return ( await response.json() ) as T;
	} catch ( error ) {
		// console.error('Error making API request:', error);
		return null;
	}
}


function uiShowOptionsTool(server: McpServer): RegisteredTool {
  return server.tool(
    "ui-show-options",
    "Display a set of interactive option buttons in the user interface. " +
      "This tool is typically called at the end of a response to let the user conveniently choose the next action. " +
      "Each option has a title (shown as the button label) and an action (the underlying command to trigger). " +
      "The arrays `option_titles` and `option_actions` must always be the same length, with each title corresponding to its action.",
    {
      options: z
        .object({
          title: z.string(),
          action: z.string(),
        })
        .array()
        .describe(
          "Array of button titles and actions to display in the UI (what the user sees). " +
            "For title: Each entry should be a short, clear label for the option." +
            "For action: An action should clearly describe the next step for the assistant: " +
            '- either specify which tool to call and what to do with it (e.g. "create-page: make a new character entry for someone"), ' +
            '- or describe a non-tool task/plan for the assistant to execute directly (e.g. "task: draft a storyline outline on some wiki website").'
        ),
    },
    {
      title: "Show Options",
      readOnlyHint: true,
      destructiveHint: false,
    } as ToolAnnotations,
    async ({ options }) => {
      return {
        content: [
          {
            type: "text",
            text: `Options UI has shown.Now End this response and waiting next system message.`,
          } as TextContent,
        ],
      };
    }
  );
}
function toNumber(value:string|undefined, defaultValue:any) {
  if (value === undefined) return defaultValue;
  const num = Number(value);
  return Number.isFinite(num) ? num : defaultValue;
}

function uiRequestEditPageTool(server: McpServer): RegisteredTool {
  return server.tool(
    "edit-page",
    "Show a confirmation dialog in the UI asking the user whether to accept the proposed page change. " +
      "This tool must be called whenever the assistant has prepared a page update and needs explicit user approval. " +
      "⚠️ Important: Do not assume the outcome on your own — the result will only be known once the user confirms or rejects it. " +
      "When the user confirms, the change will be executed immediately. " +
      "When you want to update a page, always prefer using the `section` parameter to make the smallest possible change. " +
      "You can determine the correct section index from the section list returned by [get-page]. " +
      "Only fall back to full-page edits when section-based editing is not feasible.",
    {
      server: z
        .string()
        .url()
        .describe(
          "The host URL of target wiki for this session, e.g. https://{WIKI_ID}.pub.wiki/."
        ),
      editType: z
        .enum(["create", "update"])
        .describe(
          "Type of change: create a new page or update an existing one."
        ),
      title: z.string().describe("Wiki page title to be changed."),
      content: z
        .string()
        .describe("Proposed new content (full page or specific section)."),
      section: z
        .string()
        .describe(
          'Section identifier for incremental edits: "new" to add a new section, "0" for the lead section, or a section index like "1" or "2". ' +
            'If input "all", the entire page will be replaced or created. Prefer section edits whenever possible.'
        ).optional(),
      comment: z.string().describe("Optional edit summary.").optional(),
      contentModel: z.nativeEnum( EditContentFormat ).describe( "Format of the page content to edit. default to 'wikitext', when editing css, use 'sanitized-css', when editing lua, use 'Scribunto'" ).optional().default( EditContentFormat.wikitext ),
    },
    {
      title: "Request Change Confirmation",
      readOnlyHint: true,
      destructiveHint: false,
    } as ToolAnnotations,
    async (args, extra) => {
      const { title, content, comment, server, section, contentModel } = args;
      const source = content;
      const { chatId, headers } = (extra._meta || {
        chatId: "unknown",
        headers: {},
      }) as { chatId: string; headers: Record<string, string> };

      try {
        console.log(
          `Waiting for user confirmation on page change...chatId: ${chatId}`
        );
        const result = await clientUIResultManager.getResult(chatId, "edit-page", 300000);

        const baseContent = [
          {
            type: "text",
            text: `Change confirmation UI has been created. Result: ${JSON.stringify(
              result
            )}`,
          } as TextContent,
        ];

        console.log(result);

        if (result.confirm != "true") {
          return {
            content: baseContent,
          };
        }

        const {tools} = await buildWikiHelperTools(headers);

        const model = contentModel || (title.endsWith("styles.css") ? EditContentFormat.css : (title.startsWith("Module:") ? EditContentFormat.lua : EditContentFormat.wikitext));
        const sourceContent =  (model === EditContentFormat.wikitext && title.startsWith("Template:")) ? minifyMediaWikiHTML(source) : source;

        if (args.editType === "create") {
          const callResult = await tools["create-page"].execute(
            {
              server,
              source: sourceContent,
              title,
              comment,
              contentModel: model
            },
            {
              toolCallId: randomUUID(),
              messages: [],
            }
          );
          console.log(callResult);
          return {
            content: [...baseContent, ...(callResult.content as TextContent[])],
          };
        }

        const callResult = await tools["update-page"].execute(
          {
            server,
            source: sourceContent,
            title,
            comment,
            section: section === "all" ? undefined : (section === "new" ? "new" : toNumber(section,undefined)),
            contentModel: model
          },
          {
            toolCallId: randomUUID(),
            messages: [],
          }
        );
        return {
          content: [...baseContent, ...(callResult.content as TextContent[])],
        };
      } catch (e) {
        return {
          content: [
            {
              type: "text",
              text: `Change confirmation UI has been created. But get user's operation Error: ${e}. For safety, the assistant should NOT proceed with the page change.`,
            } as TextContent,
          ],
        };
      }
    }
  );
}

export function createNewWikiTool(server: McpServer): RegisteredTool {
  return server.tool(
    "create-new-wiki-site",
    "Submit a request to create a new wiki (sub-site) in the wiki farm. " +
      "This process may take several minutes. The tool will return a task_id, " +
      "which can be used later to check the creation status. " +
      "Note: This does not immediately create the wiki, it only starts the creation task.",
    {
      name: z.string().describe("The display name of the new wiki. MUST be in English."),
      slug: z
        .string()
        .describe(
          "The unique slug identifier for the wiki (used in subdomain). eg. for https://{slug}.pub.wiki/"
        ),
      language: z.string().describe("Language code, e.g. zh-hans, en."),
    },
    {
      title: "Create wiki",
      readOnlyHint: false,
      destructiveHint: true,
    } as ToolAnnotations,
    async ({ name, slug, language }, extra) => {
        const { chatId, headers } = (extra._meta || {
        chatId: "unknown",
        headers: {},
      }) as { chatId: string; headers: Record<string, string> };
      return {
        content: [
          {
            type: "text",
            text: [
              `Wiki creation request submitted successfully.`,
              `Status: The wiki is being created in the background. This may take several minutes.`,
              `Note for assistant: The task is in progress, you may end the conversation for now.`,
            ].join("\n"),
          } as TextContent,
        ],
      };
    }
  );
}

async function buildClients() {
  const [server_transport, client_transport] =
    InMemoryTransport.createLinkedPair();
  const server = new McpServer({
    name: "built-in-user-interface",
    version: "1.0",
  });
  uiShowOptionsTool(server);
  uiRequestEditPageTool(server);
  createNewWikiTool(server);
  await server.connect(server_transport);
  return { server, client_transport };
}

let useFrontToolServerPromise:
  | Promise<{ server: McpServer; client_transport: Transport }>
  | undefined;

export function useUIClient() {
  if (!useFrontToolServerPromise) {
    useFrontToolServerPromise = buildClients();
  }
  return useFrontToolServerPromise;
}

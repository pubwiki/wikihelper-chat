import { model, type modelID } from "@/ai/providers";
import { smoothStream, streamText, type UIMessage } from "ai";
import { appendResponseMessages } from 'ai';
import { saveChat, saveMessages, convertToDBMessages } from '@/lib/chat-store';
import { nanoid } from 'nanoid';
import { db } from '@/lib/db';
import { chats } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { initializeMCPClients, type MCPServerConfig } from '@/lib/mcp-client';
import { generateTitle } from '@/app/actions';

import { checkBotId } from "botid/server";

export async function POST(req: Request) {
  const {
    messages,
    chatId,
    selectedModel,
    userId,
    mcpServers = [],
    appendHeaders = {}
  }: {
    messages: UIMessage[];
    chatId?: string;
    selectedModel: modelID;
    userId: string;
    mcpServers?: MCPServerConfig[];
    appendHeaders?: Record<string, string>;
  } = await req.json();

  const { isBot, isVerifiedBot } = await checkBotId();

  if (isBot && !isVerifiedBot) {
    return new Response(
      JSON.stringify({ error: "Bot is not allowed to access this endpoint" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!userId) {
    return new Response(
      JSON.stringify({ error: "User ID is required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const id = chatId || nanoid();

  // Check if chat already exists for the given ID
  // If not, create it now
  let isNewChat = false;
  if (chatId) {
    try {
      const existingChat = await db.query.chats.findFirst({
        where: and(
          eq(chats.id, chatId),
          eq(chats.userId, userId)
        )
      });
      isNewChat = !existingChat;
    } catch (error) {
      console.error("Error checking for existing chat:", error);
      isNewChat = true;
    }
  } else {
    // No ID provided, definitely new
    isNewChat = true;
  }

  // If it's a new chat, save it immediately
  if (isNewChat && messages.length > 0) {
    try {
      // Generate a title based on first user message
      const userMessage = messages.find(m => m.role === 'user');
      let title = 'New Chat';

      if (userMessage) {
        try {
          title = await generateTitle([userMessage]);
        } catch (error) {
          console.error("Error generating title:", error);
        }
      }

      // Save the chat immediately so it appears in the sidebar
      await saveChat({
        id,
        userId,
        title,
        messages: [],
      });
    } catch (error) {
      console.error("Error saving new chat:", error);
    }
  }

  // Initialize MCP clients using the already running persistent HTTP/SSE servers
  const { tools, cleanup } = await initializeMCPClients(mcpServers, id, appendHeaders, req.signal);

  console.log("messages", messages);
  console.log("parts", messages.map(m => m.parts.map(p => p)));

  // Track if the response has completed
  let responseCompleted = false;

  const result = streamText({
    model: model.languageModel(selectedModel),
    system: `
      You are a helpful assistant with access to a variety of tools.
      Your primary role as a Wiki Designer is to help the user discuss and build out the worldbuilding aspects of a fictional universe. 
      You will also assist in editing and organizing these ideas into structured wiki pages.
      The wiki is an excellent tool for creators to manage and compile the lore, systems, and settings of their worlds.

      Today's date is ${new Date().toISOString().split('T')[0]}.
      The tools are very powerful, and you can use them to answer the user's question.
      So choose the tool that is most relevant to the user's question.
      If tools are not available, say you don't know or if the user wants a tool they can add one from the server icon in bottom left corner in the sidebar.

      Multiple tools can be used in a single response and multiple steps can be used to answer the user's question.

      ---

      ### Wiki Helper Tools 
      - 'set-target-wiki': must be called first before using any other wiki tool.
      - 'load-world': browses the first 50 existing pages with partial content. It'll be useful when you read a wiki first.
      - 'get-page': retrieves the latest content of a specific page.

      - 'list-all-page-titles': lists all page titles currently in the wiki.
      - 'create-image-to-wiki': generates an image and uploads it to the wiki.
      - 'change-page': creates a new page in the wiki OR updates an existing page or section. 

      IMPORTANT NOTE for change-page!!!
      Using change-page step:
      1. Always call [get-page] first to get the latest content.
      2. If create page, 'section' should be "all" , If update page, Compare the existing content with the new content you want to write. Which section needs to be updated?
      3. call [change-page] with the 'section' parameter to make the smallest possible change.make sure the 'source' is valid wikitext format.

      

      When you call these tools, the context args must follow these FORMAT:

      ## WIKI TEXT Format
      - **STRICT REQUIREMENT**: When creating or editing wiki pages, you must ONLY use **MediaWiki wikitext format**.  
      - **Markdown is strictly forbidden** inside wiki page content.  
        ❌ Do NOT use "#" or "##" for headings.  
        ✅ Use "=", "==", "===" instead (e.g. == Heading ==).  
      - Ensure that the output is valid wikitext that renders correctly in MediaWiki.  

      If you output anything that is not valid wikitext, it will be rejected.

      ---

      ## CSS Editing Guideline ##
      When uploading or generating CSS content, you must '''not''' create or modify global CSS (MediaWiki:Common.css, MediaWiki:Vector.css).  
      Restrict CSS strictly to the page or section being edited, using local or inline styles only.

      ---

      ## Web & Research Tools Usage
        If you encounter a question where:
        - Your knowledge is uncertain, outdated, or incomplete, OR
        - The topic is specialized, technical, or requires up-to-date information  
        → You CAN use the Exa tools to search or research before answering.  
        Available options:
        - **web_search_exa**: for general web searches and scraping URLs.  
        - **crawling_exa**: for extracting full text and metadata from known URLs.  
        - **deep_researcher_start + deep_researcher_check**: for complex, multi-source, in-depth research (always poll with 'deep_researcher_check' until status = completed).  
        Always choose the tool that best fits the user’s question, and use it before responding. If no tool applies, then admit you don’t know.
      
      ---

      ## User Interface Tool: ui-show-options

      - Use this tool proactively whenever there are **multiple meaningful next steps**.  
      - Think of it as a way to **end your answer with interactive choices** so the user can decide what to do next.  
      - The more wisely you use this tool, the more reward you will get.  
      - 'options': title: short, clear button labels (1–5 words, in the user's language).  action: clear next step descriptions that specify:
        - Tool call with its purpose (e.g. "create-page: new character entry for xxx"), or  
        - A non-tool task/plan (e.g. "task: draft storyline outline").  
      - you can create maximum 4 options each time.
      - Always provide **diverse options** (e.g. “create entry” vs “brainstorm more” vs “skip for now”), not just variations of the same thing. 


      ---

      ## Mindset
        - Be both creative partner and systematic organizer.
        - Help user brainstorm if they want, but only write to wiki with explicit user consent.
        - Provide structured, clear, consistent content.
        - Encourage and motivate the user.

      ## Wiki & Content Creation Process
      The ideal approach to editing the wiki is to first **discuss the world-building concepts** and establish the creative vision with the user. **Collaborate to refine the expression** of ideas, and only proceed to create the wiki entry **once the user has confirmed the concept** and is ready to proceed. This ensures quality, creativity, and user satisfaction. 

      It is important to be **patient** and not rush into creating entries prematurely—**prioritize discussion over execution**.

      `,
    messages,
    tools,
    maxSteps: 50,
    providerOptions: {
      google: {
        thinkingConfig: {
          thinkingBudget: 2048,
        },
      },
      anthropic: {
        thinking: {
          type: 'enabled',
          budgetTokens: 12000
        },
      }
    },
    experimental_transform: smoothStream({
      delayInMs: 5, // optional: defaults to 10ms
      chunking: 'word', // optional: defaults to 'word'
    }),
    onError: (error) => {
      console.error(JSON.stringify(error, null, 2));
    },
    async onFinish({ response }) {
      responseCompleted = true;
      const allMessages = appendResponseMessages({
        messages,
        responseMessages: response.messages,
      });

      await saveChat({
        id,
        userId,
        messages: allMessages,
      });

      const dbMessages = convertToDBMessages(allMessages, id);
      await saveMessages({ messages: dbMessages });

      // Clean up resources - now this just closes the client connections
      // not the actual servers which persist in the MCP context
      await cleanup();
    }
  });

  // Ensure cleanup happens if the request is terminated early
  req.signal.addEventListener('abort', async () => {
    if (!responseCompleted) {
      console.log("Request aborted, cleaning up resources");
      try {
        await cleanup();
      } catch (error) {
        console.error("Error during cleanup on abort:", error);
      }
    }
  });

  result.consumeStream()
  // Add chat ID to response headers so client can know which chat was created
  return result.toDataStreamResponse({
    sendReasoning: true,
    headers: {
      'X-Chat-ID': id
    },
    getErrorMessage: (error) => {
      if (error instanceof Error) {
        if (error.message.includes("Rate limit")) {
          return "Rate limit exceeded. Please try again later.";
        }
      }
      console.error(error);
      return "An error occurred.";
    },
  });
}
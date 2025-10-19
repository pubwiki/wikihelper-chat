import { type modelID } from "@/ai/providers";
import { Message, smoothStream, streamText, type UIMessage } from "ai";
import { appendResponseMessages } from 'ai';
import { saveChat, saveMessages, convertToDBMessages } from '@/lib/chat-store';
import { nanoid } from 'nanoid';
import { db } from '@/lib/db';
import { chats } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { initializeMCPClients, type MCPServerConfig } from '@/lib/mcp-client';
import { generateTitle } from '@/app/actions';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { customProvider } from 'ai';

import { SYSTEM_PROMPT } from "@/lib/prompt";

type UIMessageParts = UIMessage["parts"];

function sanitizeMessages(messages: UIMessage[]): UIMessage[] {
  return messages.map((msg,i) => {
    if (msg.role === "assistant" && i != messages.length - 1) {
      msg.parts = msg.parts.filter((p)=>{
        if(p.type != "tool-invocation"){
          return true
        }
        if(p.toolInvocation.state != "result"){
          return false
        }
        return true
      });
    }
    return msg;
  });
}

function checkAndSimplifyMessages(messages: UIMessage[]): UIMessage[] {
  let textLength = 0;
  for (const msg of messages) {
    for (const part of msg.parts) {
      if (part.type === "text") {
        textLength += part.text.length;
      }else if (part.type === "tool-invocation") {
        const json = JSON.stringify(part.toolInvocation);
        textLength += json.length;
      }
    }
  }

  if(textLength <= 100000){
    return messages;
  }
  console.log("Simplifying messages, total text length:", textLength);
  // Simplify messages by keeping only text parts and removing tool-invocation parts
  const simplified = messages.map((msg, i) => {
    // keep last 2 message
    if(i >= messages.length - 2){
      return msg;
    }
    const newParts = msg.parts.filter(part => part.type === "text");
    return { ...msg, parts: newParts };
  });

  return simplified;

}

export async function POST(req: Request) {

  const reqJson = await req.json();


  const {
    messages,
    chatId,
    selectedModel,
    userId,
    mcpServers = [],
    appendHeaders = {},
    appendParts = [],
    apiKey,
    apiEndpoint,
    modelId,
  }: {
    messages: UIMessage[];
    chatId?: string;
    selectedModel: modelID;
    userId: string;
    mcpServers?: MCPServerConfig[];
    appendHeaders?: Record<string, string>;
    appendParts?: UIMessageParts;
    apiKey?: string;
    apiEndpoint?: string;
    modelId?: string;
  } = reqJson;

  if (!userId) {
    return new Response(
      JSON.stringify({ error: "User ID is required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Validate API configuration
  if (!apiKey || !apiEndpoint || !modelId) {
    return new Response(
      JSON.stringify({ error: "API configuration (apiKey, apiEndpoint, modelId) is required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Create dynamic model client from frontend configuration
  const userClient = createOpenAICompatible({
    name: "user-model",
    apiKey: apiKey,
    baseURL: apiEndpoint
  });

  const dynamicModel = customProvider({
    languageModels: {
      "user-model": userClient(modelId),
    },
  });

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

  if (appendParts.length > 0) {
    const lastUserMessage = messages.findLast(m => m.role === 'user');
    if (lastUserMessage) {
      lastUserMessage.parts = [...appendParts, ...(lastUserMessage.parts || [])];
    }
  }



  // Initialize MCP clients using the already running persistent HTTP/SSE servers
  const { tools, cleanup } = await initializeMCPClients(mcpServers, id, appendHeaders, req.signal);

  // Track if the response has completed
  let responseCompleted = false;
  
  const sanitizedMessages = sanitizeMessages(messages);
  const finalMessages = checkAndSimplifyMessages(sanitizedMessages);

  const result = streamText({
    model: dynamicModel.languageModel("user-model"),
    system: SYSTEM_PROMPT,
    messages: finalMessages,
    tools,
    maxSteps: 50,
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
        return error.message;
      }
      console.error(error);
      return "An error occurred.";
    },
  });
}
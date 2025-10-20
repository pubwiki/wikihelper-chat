/**
 * Frontend Chat Hook - 完全在浏览器中处理聊天逻辑
 * 替代原有的后端 /api/chat route
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { streamText, type CoreMessage, type CoreToolMessage } from 'ai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { customProvider } from 'ai';
import type { MCPServerApi } from '@/lib/context/mcp-context';
import { initializeMCPClients } from '@/lib/mcp-client';
import { SYSTEM_PROMPT } from '@/lib/prompt';
import { saveChat, saveMessages, convertToDBMessages } from '@/lib/chat-store';
import { nanoid } from 'nanoid';

export type ChatStatus = 'idle' | 'streaming' | 'submitted';

// Message part types
export type TextPart = {
  type: 'text';
  text: string;
};

export type ToolInvocationPart = {
  type: 'tool-invocation';
  toolInvocation: {
    toolCallId: string;
    toolName: string;
    args: any;
    state: 'call' | 'result' | 'partial-call';
    result?: any;
  };
};

export type MessagePart = TextPart | ToolInvocationPart;

export type UIMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  parts: MessagePart[];
  createdAt?: Date;
};

interface UseFrontendChatOptions {
  id?: string;
  initialMessages?: UIMessage[];
  mcpServers: MCPServerApi[];
  appendHeaders?: Record<string, string>;
  userId: string;
  onFinish?: () => void;
  onToolCall?: (toolCall: { toolName: string; args: any }) => void;
  onError?: (error: Error) => void;
}

export function useFrontendChat(options: UseFrontendChatOptions) {
  const {
    id: providedId,
    initialMessages = [],
    mcpServers,
    appendHeaders = {},
    userId,
    onFinish,
    onToolCall,
    onError,
  } = options;

  // Generate chat ID if not provided
  const [chatId] = useState(() => providedId || nanoid());
  const [messages, setMessages] = useState<UIMessage[]>(initialMessages);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<ChatStatus>('idle');
  const abortControllerRef = useRef<AbortController | null>(null);
  const [isNewChat, setIsNewChat] = useState(!providedId);

  // Update messages when initialMessages change
  useEffect(() => {
    if (initialMessages.length > 0 && messages.length === 0) {
      setMessages(initialMessages);
    }
  }, [initialMessages]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    setInput(e.target.value);
  }, []);

  // Function to sanitize messages (remove incomplete tool calls)
  const sanitizeMessages = useCallback((msgs: UIMessage[]): UIMessage[] => {
    return msgs.map((msg, i) => {
      if (msg.role === "assistant" && i !== msgs.length - 1) {
        const newParts = msg.parts.filter((p) => {
          if (p.type !== "tool-invocation") {
            return true;
          }
          if (p.toolInvocation.state !== "result") {
            return false;
          }
          return true;
        });
        return { ...msg, parts: newParts };
      }
      return msg;
    });
  }, []);

  // Function to simplify messages if they're too long
  const checkAndSimplifyMessages = useCallback((msgs: UIMessage[]): UIMessage[] => {
    let textLength = 0;
    for (const msg of msgs) {
      for (const part of msg.parts) {
        if (part.type === "text") {
          textLength += part.text.length;
        } else if (part.type === "tool-invocation") {
          const json = JSON.stringify(part.toolInvocation);
          textLength += json.length;
        }
      }
    }

    if (textLength <= 100000) {
      return msgs;
    }

    console.log("Simplifying messages, total text length:", textLength);
    // Keep only text parts and remove tool-invocation parts, except last 2 messages
    const simplified = msgs.map((msg, i) => {
      if (i >= msgs.length - 2) {
        return msg;
      }
      const newParts = msg.parts.filter(part => part.type === "text");
      return { ...msg, parts: newParts };
    });

    return simplified;
  }, []);

  const processMessages = useCallback(async (currentMessages: UIMessage[]) => {
    try {
      setStatus('streaming');
      abortControllerRef.current = new AbortController();

      // Get API configuration from localStorage
      const apiKey = localStorage.getItem('OPENAI_API_KEY');
      const apiEndpoint = localStorage.getItem('OPENAI_API_ENDPOINT') || 'https://api.openai.com/v1';
      const modelId = localStorage.getItem('OPENAI_MODEL_ID') || 'gpt-4o';

      if (!apiKey) {
        throw new Error('API Key is required. Please configure it in API Settings.');
      }

      // Create dynamic model client
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

      // Initialize MCP clients
      const { tools, cleanup } = await initializeMCPClients(
        mcpServers,
        chatId,
        appendHeaders,
        abortControllerRef.current.signal
      );

      // Sanitize and simplify messages
      const sanitizedMessages = sanitizeMessages(currentMessages);
      const processedMessages = checkAndSimplifyMessages(sanitizedMessages);

      // Convert to CoreMessage format
      const coreMessages: CoreMessage[] = processedMessages.map(msg => {
        // Build content array from parts
        const content: any[] = [];
        
        for (const part of msg.parts) {
          if (part.type === 'text') {
            content.push({ type: 'text', text: part.text });
          } else if (part.type === 'tool-invocation') {
            if (part.toolInvocation.state === 'result') {
              // For tool results, create a tool-result message
              content.push({
                type: 'tool-result',
                toolCallId: part.toolInvocation.toolCallId,
                toolName: part.toolInvocation.toolName,
                result: part.toolInvocation.result,
              });
            } else if (part.toolInvocation.state === 'call') {
              // For tool calls
              content.push({
                type: 'tool-call',
                toolCallId: part.toolInvocation.toolCallId,
                toolName: part.toolInvocation.toolName,
                args: part.toolInvocation.args,
              });
            }
          }
        }

        return {
          role: msg.role,
          content: content.length > 0 ? content : msg.content,
        } as CoreMessage;
      });

      // Create assistant message placeholder
      const assistantMessageId = nanoid();
      let assistantMessage: UIMessage = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        parts: [],
      };

      // Add placeholder to messages
      setMessages(prev => [...prev, assistantMessage]);

      // Track response state
      let fullText = '';
      const toolInvocations: Map<string, ToolInvocationPart['toolInvocation']> = new Map();

      // Stream the response
      const result = streamText({
        model: dynamicModel.languageModel("user-model"),
        system: SYSTEM_PROMPT,
        messages: coreMessages,
        tools,
        maxSteps: 50,
        onError: (error) => {
          console.error('Stream error:', error);
        },
      });

      // Process the stream
      for await (const chunk of result.fullStream) {
        if (chunk.type === 'text-delta') {
          fullText += chunk.textDelta;
          
          // Update message in real-time
          setMessages(prev => {
            const newMessages = [...prev];
            const lastMessage = newMessages[newMessages.length - 1];
            if (lastMessage.id === assistantMessageId) {
              lastMessage.content = fullText;
              // Update parts
              const parts: MessagePart[] = [];
              if (fullText) {
                parts.push({ type: 'text', text: fullText });
              }
              toolInvocations.forEach(inv => {
                parts.push({
                  type: 'tool-invocation',
                  toolInvocation: inv,
                });
              });
              lastMessage.parts = parts;
            }
            return newMessages;
          });
        } else if (chunk.type === 'tool-call') {
          const invocation: ToolInvocationPart['toolInvocation'] = {
            toolCallId: chunk.toolCallId,
            toolName: chunk.toolName,
            args: chunk.args,
            state: 'call',
          };
          
          toolInvocations.set(chunk.toolCallId, invocation);
          
          // Trigger onToolCall callback
          if (onToolCall) {
            onToolCall({ toolName: chunk.toolName, args: chunk.args });
          }

          // Update message
          setMessages(prev => {
            const newMessages = [...prev];
            const lastMessage = newMessages[newMessages.length - 1];
            if (lastMessage.id === assistantMessageId) {
              const parts: MessagePart[] = [];
              if (fullText) {
                parts.push({ type: 'text', text: fullText });
              }
              toolInvocations.forEach(inv => {
                parts.push({
                  type: 'tool-invocation',
                  toolInvocation: inv,
                });
              });
              lastMessage.parts = parts;
            }
            return newMessages;
          });
        } else if (chunk.type === 'tool-result') {
          const existing = toolInvocations.get(chunk.toolCallId);
          if (existing) {
            existing.state = 'result';
            existing.result = chunk.result;
            toolInvocations.set(chunk.toolCallId, existing);

            // Update message
            setMessages(prev => {
              const newMessages = [...prev];
              const lastMessage = newMessages[newMessages.length - 1];
              if (lastMessage.id === assistantMessageId) {
                const parts: MessagePart[] = [];
                if (fullText) {
                  parts.push({ type: 'text', text: fullText });
                }
                toolInvocations.forEach(inv => {
                  parts.push({
                    type: 'tool-invocation',
                    toolInvocation: inv,
                  });
                });
                lastMessage.parts = parts;
              }
              return newMessages;
            });
          }
        }
      }

      // Final update
      assistantMessage = {
        id: assistantMessageId,
        role: 'assistant',
        content: fullText,
        parts: [
          ...(fullText ? [{ type: 'text' as const, text: fullText }] : []),
          ...Array.from(toolInvocations.values()).map(inv => ({
            type: 'tool-invocation' as const,
            toolInvocation: inv,
          })),
        ],
      };

      const finalMessages = [...currentMessages, assistantMessage];
      setMessages(finalMessages);

      // Save to database
      if (userId) {
        try {
          // Save chat
          await saveChat({
            id: chatId,
            userId,
            messages: finalMessages,
          });

          // Save messages
          const dbMessages = convertToDBMessages(finalMessages, chatId);
          await saveMessages({ messages: dbMessages });

          setIsNewChat(false);
        } catch (error) {
          console.error('Error saving chat:', error);
        }
      }

      setStatus('idle');
      
      if (onFinish) {
        onFinish();
      }

      await cleanup();
    } catch (error) {
      console.error('Error processing messages:', error);
      setStatus('idle');
      if (onError && error instanceof Error) {
        onError(error);
      }
    }
  }, [chatId, userId, mcpServers, appendHeaders, onFinish, onToolCall, onError, sanitizeMessages, checkAndSimplifyMessages]);

  const append = useCallback(async (message: UIMessage) => {
    const newMessages = [...messages, message];
    setMessages(newMessages);
    
    if (message.role === 'user') {
      await processMessages(newMessages);
    }
  }, [messages, processMessages]);

  const handleSubmit = useCallback(async (
    e: React.FormEvent,
    options?: { body?: { appendParts?: MessagePart[] } }
  ) => {
    e.preventDefault();
    
    if (!input.trim() && (!options?.body?.appendParts || options.body.appendParts.length === 0)) {
      return;
    }
    
    if (status === 'streaming') {
      return;
    }

    // Build message parts
    const parts: MessagePart[] = [];
    
    // Add append parts first if any
    if (options?.body?.appendParts) {
      parts.push(...options.body.appendParts);
    }
    
    // Add text input
    if (input.trim()) {
      parts.push({ type: 'text', text: input.trim() });
    }

    const userMessage: UIMessage = {
      id: nanoid(),
      role: 'user',
      content: input.trim(),
      parts,
    };

    setInput('');
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    
    await processMessages(newMessages);
  }, [input, messages, status, processMessages]);

  const stop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setStatus('idle');
    }
  }, []);

  return {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    append,
    status,
    stop,
    setMessages,
    isNewChat,
    chatId,
  };
}

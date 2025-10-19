import { createQwen } from 'qwen-ai-provider';
import { createOpenAI } from '@ai-sdk/openai';
import { createDeepSeek } from '@ai-sdk/deepseek';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import {
  customProvider
} from "ai";

export interface ModelInfo {
  provider: string;
  name: string;
  description: string;
  apiVersion: string;
  capabilities: string[];
}


const qwenClient = createQwen({
  apiKey: process.env.DASHSCOPE_API_KEY,
  baseURL: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
});

const geminiClient = createOpenAICompatible({
  name:"gemini",
  apiKey: process.env.GEMINI_API_KEY,
  baseURL:"https://openrouter.ai/api/v1"
})

const claudeClient = createOpenAICompatible({
  name:"claude",
  apiKey: process.env.CLAUDE_API_KEY,
  baseURL:"https://openrouter.ai/api/v1"
})

const languageModels = {
  "qwen3-max": qwenClient('qwen-max'),
  "gemini-2.5-pro": geminiClient('google/gemini-2.5-pro'),
  "claude-4.5": claudeClient('anthropic/claude-sonnet-4.5'),
};

export const modelDetails: Record<keyof typeof languageModels, ModelInfo> = {
  "qwen3-max": {
    provider: "Ali",
    name: "Qwen3-Max",
    description: "The balanced model of the Qwen series, offering a good compromise between speed and performance, with a context length of one million tokens.",
    apiVersion: "qwen3-max",
    capabilities: ["Balanced", "Efficient", "Agentic"]
  },
  "gemini-2.5-pro": {
    provider: "Google",
    name: "Gemini-2.5-Pro",
    description: "Gemini's advanced language model optimized for chat applications, providing high-quality responses with a focus on understanding context and user intent.",
    apiVersion: "gemini-2.5-pro",
    capabilities: ["Balanced", "Efficient", "Agentic"]
  },
  "claude-4.5": {
    provider: "Anthropic",
    name: "Claude 4.5", 
    description: "Claude 4.5 is a state-of-the-art language model from Anthropic, designed for safety and usability.",
    apiVersion: "claude-4-5",
    capabilities: ["Balanced", "Efficient", "Agentic"]
  }
};

// Update API keys when localStorage changes (for runtime updates)
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    // Reload the page if any API key changed to refresh the providers
    if (event.key?.includes('API_KEY')) {
      window.location.reload();
    }
  });
}

export const model = customProvider({
  languageModels,
});

export type modelID = keyof typeof languageModels;

export const MODELS = Object.keys(languageModels);

export const defaultModel: modelID = "gemini-2.5-pro";

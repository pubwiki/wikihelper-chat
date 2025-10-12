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
  baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
});

const openaiClient = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL:"https://api.yesapikey.com/v1"
})

const deepSeekClient = createDeepSeek({
  apiKey: process.env.DEEPSEEK_API_KEY,
});

const geminiClient = createOpenAICompatible({
  name:"gemini",
  apiKey: process.env.GEMINI_API_KEY,
  baseURL:"http://andaoapi.top/v1"
})

const languageModels = {
  "qwen-plus": qwenClient('qwen-plus-latest'),
  "gpt-5": openaiClient('gpt-5-2025-08-07'),
  "deepseek": deepSeekClient('deepseek-chat'),
  "gemini-2.5-pro": geminiClient('gemini-2.5-pro')
};

export const modelDetails: Record<keyof typeof languageModels, ModelInfo> = {
  "deepseek": {
    provider: "DeepSeek",
    name: "DeepSeek",
    description: "DeepSeek's advanced language model optimized for chat applications, providing high-quality responses with a focus on understanding context and user intent.",
    apiVersion: "deepseek-v3.2-exp",
    capabilities: ["Balanced", "Efficient", "Agentic"]
  },
  "qwen-plus": {
    provider: "Alibaba",
    name: "Qwen-Plus",
    description: "The balanced model of the Qwen series, offering a good compromise between speed and performance, with a context length of one million tokens.",
    apiVersion: "qwen-plus",
    capabilities: ["Balanced", "Efficient", "Agentic"]
  },
  "gpt-5": {
    provider: "OpenAI",
    name: "GPT-5",
    description: "The latest GPT-5 model released by OpenAI, featuring stronger comprehension and generation abilities, suitable for a wide range of complex tasks.",
    apiVersion: "gpt-5-2025-08-07",
    capabilities: ["Advanced", "Versatile", "Agentic"]
  },
  "gemini-2.5-pro": {
    provider: "Gemini",
    name: "Gemini-2.5-Pro",
    description: "Gemini's advanced language model optimized for chat applications, providing high-quality responses with a focus on understanding context and user intent.",
    apiVersion: "gemini-2.5-pro",
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

export const defaultModel: modelID = "deepseek";

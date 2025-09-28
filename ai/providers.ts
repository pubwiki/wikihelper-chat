import { createQwen } from 'qwen-ai-provider';
import { createOpenAI } from '@ai-sdk/openai';
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

const languageModels = {
  "qwen3-max": qwenClient('qwen3-max'),
  "qwen-plus": qwenClient('qwen-plus-latest'),
  "gpt-5": openaiClient('gpt-5-2025-08-07'),
};

export const modelDetails: Record<keyof typeof languageModels, ModelInfo> = {
  "qwen3-max": {
    provider: "Alibaba",
    name: "Qwen3-Max",
    description: "The largest model in the Qwen series to date, with a total parameter scale reaching the trillion level. It has powerful comprehension and generation capabilities, but its speed is relatively slow.",
    apiVersion: "qwen-max",
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

export const defaultModel: modelID = "qwen3-max";

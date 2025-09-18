import { createQwen } from 'qwen-ai-provider';

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

const languageModels = {
  "qwen-max": qwenClient('qwen3-max-preview'),
};

export const modelDetails: Record<keyof typeof languageModels, ModelInfo> = {
  "qwen-max": {
    provider: "Alibaba",
    name: "Qwen3-Max",
    description: "中文领域至今为止参数量最大的模型，总参数达到万亿级别，具备强大的理解和生成能力。",
    apiVersion: "qwen-max",
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

export const defaultModel: modelID = "qwen-max";

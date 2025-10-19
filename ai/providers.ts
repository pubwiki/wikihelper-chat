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

// Function to get API keys from localStorage or environment variables
function getApiKey(key: string, envKey?: string): string {
  if (typeof window !== 'undefined') {
    const localValue = localStorage.getItem(key);
    if (localValue) return localValue;
  }
  return envKey ? (process.env[envKey] || '') : '';
}

// Function to dynamically create language model clients
function createLanguageModels() {
  const apiKey = getApiKey('OPENAI_API_KEY', 'OPENAI_API_KEY');
  const endpoint = getApiKey('OPENAI_API_ENDPOINT', 'OPENAI_API_ENDPOINT') || 'https://api.openai.com/v1';
  const modelId = getApiKey('OPENAI_MODEL_ID', 'OPENAI_MODEL_ID') || 'gpt-4o';

  // Create client using user-provided or env settings
  const userClient = createOpenAICompatible({
    name: "user-model",
    apiKey: apiKey,
    baseURL: endpoint
  });

  return {
    "user-model": userClient(modelId),
  };
}

const languageModels = createLanguageModels();


export const modelDetails: Record<keyof typeof languageModels, ModelInfo> = {
  "user-model": {
    provider: "OpenAI Compatible",
    name: "User Model",
    description: "User-configured OpenAI-compatible model from API settings.",
    apiVersion: "user-model",
    capabilities: ["Balanced", "Efficient", "Agentic"]
  }
};

// Update API keys when localStorage changes (for runtime updates)
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    // Reload the page if any API key changed to refresh the providers
    if (event.key?.includes('API_KEY') || event.key?.includes('API_ENDPOINT') || event.key?.includes('MODEL_ID')) {
      window.location.reload();
    }
  });
}

export const model = customProvider({
  languageModels,
});

export type modelID = keyof typeof languageModels;

export const MODELS = Object.keys(languageModels);

export const defaultModel: modelID = "user-model";

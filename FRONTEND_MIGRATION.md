# WikiHelper Chat - 纯前端化改造总结

## 改造目标
将 Next.js 项目从依赖后端 API 改为纯前端项目，第一阶段重点：
1. 移除对环境变量的依赖，改为使用前端用户填写的 API 配置
2. 将 UI Result 管理（如 edit-page 确认）从后端移到前端
3. 保留必要的工具功能（edit-page, create-page 等）

## 主要更改

### 1. AI Provider 动态化 (`ai/providers.ts`)
**改动前：**
- 使用环境变量 `DASHSCOPE_API_KEY`, `GEMINI_API_KEY`, `CLAUDE_API_KEY`
- 静态创建固定的模型客户端（qwen, gemini, claude）

**改动后：**
- 从 localStorage 读取用户配置的 API Key、Endpoint 和 Model ID
- 支持任何 OpenAI 兼容的 API 端点
- 动态创建 "user-model" 客户端
- 监听 localStorage 变化，自动刷新页面以应用新配置

**关键代码：**
```typescript
function getApiKey(key: string, envKey?: string): string {
  if (typeof window !== 'undefined') {
    const localValue = localStorage.getItem(key);
    if (localValue) return localValue;
  }
  return envKey ? (process.env[envKey] || '') : '';
}
```

### 2. 前端 UI Result 管理器 (`lib/client-ui-result.ts` - 新建)
**功能：**
- 替代原有的后端 `uiResultBridge`
- 在前端管理用户确认流程（edit-page, create-page 等）
- 使用 Promise 模式等待用户交互

**核心方法：**
- `setResult()`: 用户点击确认/拒绝时调用
- `getResult()`: 工具等待用户确认时调用
- `cancel()`: 取消等待
- `clearAll()`: 清除所有待处理的结果

### 3. Built-in UI Client 更新 (`lib/built-in-ui-client.ts`)
**改动：**
- 将 `uiResultBridge` 替换为 `clientUIResultManager`
- edit-page 工具现在直接在客户端等待用户确认
- 保持了所有工具的功能不变

**改动示例：**
```typescript
// 改动前
import { uiResultBridge } from "./use-ui-result";
const result = await uiResultBridge.getResult(chatId, "edit-page", 300000);

// 改动后
import { clientUIResultManager } from "./client-ui-result";
const result = await clientUIResultManager.getResult(chatId, "edit-page", 300000);
```

### 4. Chat 组件更新 (`components/chat.tsx`)
**改动：**
- 导入 `clientUIResultManager`
- 修改 `setUIResult` 函数，从调用后端 API 改为直接使用前端管理器
- 在 `useChat` 的 body 中添加 API 配置参数

**关键更改：**
```typescript
// 改动前
const setUIResult = async (result: Record<string, string>, taskName: string) => {
  await fetchWithAuth("/ui/result", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chatId: chatId || generatedChatId, result, taskName }),
  });
};

// 改动后
const setUIResult = (result: Record<string, string>, taskName: string) => {
  clientUIResultManager.setResult(chatId || generatedChatId, result, taskName);
};

// useChat body 添加 API 配置
body: {
  ...其他配置,
  apiKey: localStorage.getItem('OPENAI_API_KEY'),
  apiEndpoint: localStorage.getItem('OPENAI_API_ENDPOINT') || 'https://api.openai.com/v1',
  modelId: localStorage.getItem('OPENAI_MODEL_ID') || 'gpt-4o',
}
```

### 5. Chat API 路由更新 (`app/api/chat/route.ts`)
**改动：**
- 接收前端传来的 API 配置（apiKey, apiEndpoint, modelId）
- 动态创建模型客户端而非使用预定义的
- 验证 API 配置的完整性

**关键更改：**
```typescript
// 接收参数
const { apiKey, apiEndpoint, modelId, ...其他 } = await req.json();

// 验证配置
if (!apiKey || !apiEndpoint || !modelId) {
  return new Response(
    JSON.stringify({ error: "API configuration is required" }),
    { status: 400 }
  );
}

// 动态创建模型
const userClient = createOpenAICompatible({
  name: "user-model",
  apiKey: apiKey,
  baseURL: apiEndpoint
});

const dynamicModel = customProvider({
  languageModels: { "user-model": userClient(modelId) },
});
```

### 6. 删除的文件
- `app/api/ui/result/route.ts` - 后端 UI Result API（不再需要）
- `app/api/ui/` 整个目录

## 使用方式

### 配置 API
1. 用户打开 API Settings 对话框（通过 API Key Manager）
2. 填写：
   - API Key: 你的 OpenAI 兼容 API 密钥
   - API Endpoint: API 端点地址（如 `https://api.openai.com/v1`）
   - Model ID: 模型 ID（如 `gpt-4o`）
3. 点击保存，配置存储在浏览器 localStorage
4. 页面会自动刷新以应用新配置

### 工作流程
1. 用户配置存储在浏览器本地
2. 聊天时，前端从 localStorage 读取配置
3. 配置随请求发送到 `/api/chat`
4. 后端使用配置动态创建模型客户端
5. UI 确认（edit-page 等）完全在前端处理

## 优势
1. ✅ 不再依赖服务器环境变量
2. ✅ 用户可以使用自己的 API Key
3. ✅ 支持任何 OpenAI 兼容的 API
4. ✅ UI 交互响应更快（不需要后端往返）
5. ✅ 更容易部署（减少环境配置）
6. ✅ 保留了所有工具功能（edit-page, create-page 等）

## 注意事项
1. API Key 存储在 localStorage，用户需要信任浏览器环境
2. 刷新页面会重新加载配置
3. `/api/chat` 仍然是必需的（AI SDK 架构限制）
4. 未来可以进一步优化为完全的浏览器内 AI 调用（使用 WebLLM 等）

## 下一步可能的改进
- [ ] 添加多个模型配置支持
- [ ] 加密存储 API Key
- [ ] 支持浏览器内运行的 AI 模型（完全离线）
- [ ] 添加配置导入/导出功能

# 测试步骤

## 前置条件
确保你有一个 OpenAI 兼容的 API Key 和 Endpoint。

## 测试步骤

### 1. 配置 API
1. 启动应用：`pnpm dev`
2. 打开浏览器控制台，设置 localStorage（或通过 UI）：
```javascript
localStorage.setItem('OPENAI_API_KEY', 'your-api-key-here');
localStorage.setItem('OPENAI_API_ENDPOINT', 'https://api.openai.com/v1');
localStorage.setItem('OPENAI_MODEL_ID', 'gpt-4o');
```
3. 刷新页面

### 2. 测试基本聊天
1. 在聊天界面输入一个简单的问题
2. 观察是否正常返回回复
3. 检查浏览器控制台是否有错误

### 3. 测试 edit-page 工具
1. 提问："帮我创建一个测试页面"
2. AI 应该会调用 `edit-page` 工具
3. 应该弹出确认对话框显示页面预览
4. 点击"Confirm"按钮
5. 观察控制台日志，应该显示用户确认成功

### 4. 测试 UI Result 管理
在浏览器控制台测试：
```javascript
import { clientUIResultManager } from '@/lib/client-ui-result';

// 模拟工具调用等待用户确认
const testChatId = 'test-123';
clientUIResultManager.getResult(testChatId, 'edit-page', 5000)
  .then(result => console.log('Got result:', result))
  .catch(err => console.error('Error:', err));

// 在 5 秒内执行这个来模拟用户确认
clientUIResultManager.setResult(testChatId, { confirm: 'true' }, 'edit-page');
```

## 预期结果

### ✅ 成功标志
- [x] 聊天功能正常工作
- [x] edit-page 工具能够触发确认对话框
- [x] 确认对话框的确认/拒绝按钮正常工作
- [x] 不再调用 `/api/ui/result` 端点（检查 Network 标签）
- [x] API 配置从 localStorage 正确读取
- [x] 模型响应使用用户配置的端点

### ❌ 可能的问题

#### 问题 1: "API configuration is required"
**原因**: localStorage 中没有设置 API 配置
**解决**: 通过 API Key Manager 或手动设置 localStorage

#### 问题 2: edit-page 确认对话框不显示
**原因**: UI Result 管理器可能没有正确初始化
**检查**: 
1. 确认 `clientUIResultManager` 正确导入
2. 检查 `setUIResult` 函数是否被调用
3. 查看控制台错误

#### 问题 3: 超时错误
**原因**: 等待用户确认超时（默认 5 分钟）
**解决**: 确保用户在超时前做出选择

## 调试技巧

### 查看 UI Result 状态
```javascript
// 在控制台查看待处理的结果
console.log(clientUIResultManager);
```

### 手动触发结果
```javascript
// 手动设置结果（用于测试）
clientUIResultManager.setResult('your-chat-id', { confirm: 'true' }, 'edit-page');
```

### 取消待处理的请求
```javascript
// 取消特定请求
clientUIResultManager.cancel('your-chat-id', 'edit-page');

// 清除所有待处理请求
clientUIResultManager.clearAll();
```

## 性能验证

### 前端化改造的性能优势
1. **UI 响应速度**: edit-page 确认对话框应该立即显示，无需等待后端
2. **减少网络请求**: 不再需要调用 `/api/ui/result`
3. **配置灵活性**: 可以随时更改 API 配置无需重启服务器

### 监控指标
- 确认对话框打开延迟: < 100ms
- 用户点击确认到工具执行: < 50ms
- 总体聊天响应时间: 取决于所选模型

## 回归测试

确保以下功能仍然正常：
- [ ] 创建新聊天
- [ ] 加载历史聊天
- [ ] 上传图片
- [ ] MCP 服务器连接
- [ ] 创建 Wiki 站点
- [ ] 编辑 Wiki 页面
- [ ] 添加参考标记

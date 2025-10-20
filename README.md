# Pubwiki Chat (wikihelper-chat)

一个智能 MediaWiki 编辑器和对话界面。助手（"Wiki Designer"）帮助你讨论世界观设定，提出精确的 MediaWiki 编辑建议，并在用户确认后应用修改。支持图片附件和实时预览、持久化聊天历史，以及可选的 MCP 工具扩展。

## 技术架构

- **前端**: Next.js 14+ (App Router) + React + TypeScript
- **AI SDK**: Vercel AI SDK (支持流式响应和工具调用)
- **数据库**: PostgreSQL (存储聊天历史)
- **对象存储**: DigitalOcean Spaces / S3 兼容服务 (图片上传)
- **AI 模型**: 支持 Claude、Gemini、Qwen (DashScope)、OpenAI、DeepSeek
- **样式**: Tailwind CSS + shadcn/ui
- **工具层**: MCP (Model Context Protocol) 工具调用

## 最小化配置

### 前置要求
- Node.js 18+ 和 pnpm
- PostgreSQL 数据库
- DigitalOcean Space 或任何 S3 兼容存储桶

### 环境变量配置

复制 `.app.env.example` 并重命名为 `.app.env`，然后配置以下变量：

#### 数据库配置
```env
DATABASE_URL="postgresql://user:password@host:5432/database?sslmode=require"
```
PostgreSQL 连接字符串，用于存储聊天记录和会话数据。推荐使用 [Neon](https://neon.tech) 或其他托管 PostgreSQL 服务。

#### AI 模型提供商（至少配置一个）

**阿里云 Qwen 模型**
```env
DASHSCOPE_API_KEY="sk-your-dashscope-api-key"
```
通过 [DashScope](https://dashscope.aliyun.com/) 访问 Qwen 系列模型。

**Claude 模型（通过 OpenRouter）**
```env
CLAUDE_API_KEY="sk-or-v1-your-claude-api-key"
```
通过 [OpenRouter](https://openrouter.ai/) 访问 Anthropic Claude 模型，需要 OpenRouter API 密钥。

**Gemini 模型（通过 OpenRouter）**
```env
GEMINI_API_KEY="sk-or-v1-your-gemini-api-key"
```
通过 [OpenRouter](https://openrouter.ai/) 访问 Google Gemini 模型。

**其他可选模型**
```env
# OpenAI 官方 API
OPENAI_API_KEY="sk-your-openai-api-key"

# DeepSeek API
DEEPSEEK_API_KEY="sk-your-deepseek-api-key"
```

#### 对象存储配置
```env
DO_SPACE_ENDPOINT="https://nyc3.digitaloceanspaces.com"
DO_SPACE_KEY="your-access-key"
DO_SPACE_SECRET="your-secret-key"
DO_SPACE_BUCKET="your-bucket-name"
```
- `DO_SPACE_ENDPOINT`: Spaces 的区域端点（如 `nyc3`、`sgp1`、`sfo3` 等）
- `DO_SPACE_KEY`: 访问密钥 ID
- `DO_SPACE_SECRET`: 访问密钥密文
- `DO_SPACE_BUCKET`: 存储桶名称（用于存储上传的图片）

可以使用任何 S3 兼容的对象存储服务，如 AWS S3、阿里云 OSS、腾讯云 COS 等。

#### Wiki MCP 服务配置
```env
WIKI_MCP_URL="https://mcp.pub.wiki/mcp"
NEXT_PUBLIC_WIKI_MCP_URL="https://mcp.pub.wiki/mcp"
NEXT_PUBLIC_HOST="pub.wiki"
```
- `WIKI_MCP_URL`: 后端 MCP 工具服务 URL（服务端调用）
- `NEXT_PUBLIC_WIKI_MCP_URL`: 前端可访问的 MCP 服务 URL（客户端调用）
- `NEXT_PUBLIC_HOST`: 公开访问的主机域名

## 安装和运行

### 创建本地 HTTPS 证书

在项目根目录创建 `cert` 文件夹并生成自签名证书：

```powershell
# 创建证书目录
mkdir cert
cd cert

# 方案一：使用 OpenSSL 生成自签名证书
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes -subj "/CN=localhost"

# 方案二：使用 mkcert（推荐，更简单且被浏览器信任）
# 首先安装 mkcert: https://github.com/FiloSottile/mkcert
# Windows: choco install mkcert (需要 Chocolatey)
# 或从 GitHub releases 下载

# 安装本地 CA
mkcert -install

# 生成证书
mkcert localhost 127.0.0.1 ::1

# 将生成的文件重命名为 key.pem 和 cert.pem
# mkcert 生成的文件名类似: localhost+2-key.pem 和 localhost+2.pem
ren localhost+2-key.pem key.pem
ren localhost+2.pem cert.pem
```

### 启动开发服务器

```powershell
# 安装依赖
pnpm install

# 运行数据库迁移（首次运行）
pnpm db:push

# 运行开发服务器（使用 ./cert 中的本地 HTTPS 证书）
pnpm dev

# 构建生产版本
pnpm build

# 启动生产服务器
pnpm start
```

默认开发地址: https://localhost:3000

### 使用 Docker 运行

将环境文件 (`.app.env`) 放在工作目录中：

```shell
docker compose build
docker compose up
```

## 内置 Wiki 工具

助手可以通过 MCP/工具层调用以下常用 wiki 操作：
- `set-target-wiki` - 设置目标 wiki
- `load-world` - 加载世界观数据
- `get-page` - 获取页面内容
- `list-all-page-titles` - 列出所有页面标题
- `edit-page` - 创建/更新页面，支持分段编辑和 wikitext 源码

## UI 回调机制

为确保页面修改需要用户确认，我们实现了 UI 回调层：

- `ui-show-options`: 在回复末尾渲染可操作选项，帮助用户选择下一步
- `edit-page` (UI 请求): 打开确认对话框，等待用户通过 `useUIResult.getResult()` 做出决定
  - 拒绝：工具返回但不修改 wiki
  - 确认：调用实际的 wiki 工具（`create-page` 或 `update-page`）
- `create-new-wiki-site`: 提交 wiki 站点创建任务，返回 `task_id` 供助手跟踪

**数据流程**:
1. `/api/chat` 构建工具集（包含 UI 工具），注入系统提示词，流式返回模型响应
2. 模型调用 `edit-page` (UI) 时，前端显示确认对话框并返回决定
3. 确认后，工具调用真实的 wiki helper 工具并将结果返回聊天

## 许可证

MIT — 详见 `LICENSE` 文件。
# PGlite + IndexedDB 数据库迁移总结

## 迁移目标
将项目从 Neon PostgreSQL（云数据库）迁移到 PGlite + IndexedDB（浏览器本地数据库），实现完全的纯前端应用。

## 主要更改

### 1. 安装 PGlite 依赖
```bash
pnpm add @electric-sql/pglite
```

PGlite 是一个将 Postgres 编译成 WASM 的项目，可以在浏览器中运行完整的 Postgres 数据库。

**特性：**
- 只有 2.6MB（gzipped）
- 支持 IndexedDB 持久化
- 完整的 Postgres 兼容性
- 无需服务器

### 2. 创建 PGlite 客户端 (`lib/db/pglite-client.ts`)

**核心功能：**
```typescript
// 使用 IndexedDB 初始化 PGlite
const client = new PGlite('idb://wikihelper-chat-db');

// 使用 Drizzle ORM
const db = drizzle(client, { schema });
```

**数据库表初始化：**
- 自动创建 `chats` 和 `messages` 表
- 自动创建必要的索引
- 支持外键约束和级联删除

**提供的 API：**
- `getDb()` - 获取 Drizzle 数据库实例
- `getPGliteClient()` - 获取原始 PGlite 客户端
- `clearDatabase()` - 清空数据库
- `exportDatabase()` - 导出数据用于备份
- `importDatabase()` - 导入数据用于恢复

### 3. 更新数据库入口 (`lib/db/index.ts`)

**改动前：**
```typescript
import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool } from "@neondatabase/serverless";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool, { schema });
```

**改动后：**
```typescript
// 现在始终使用 PGlite
export { 
  db, 
  getDb, 
  getPGliteClient, 
  clearDatabase, 
  exportDatabase, 
  importDatabase 
} from './pglite-client';
```

### 4. 更新 Hooks 使用本地数据库

#### `lib/hooks/use-chats.ts`

**改动前：**
```typescript
// 通过 API 获取聊天列表
const response = await fetch('/api/chats', {
  headers: { 'x-user-id': userName }
});
return response.json();
```

**改动后：**
```typescript
// 直接从 IndexedDB 获取
import { getChats } from '@/lib/chat-store';
return await getChats(userName);
```

**删除聊天改动：**
```typescript
// 改动前：调用后端 API
await fetch(`/api/chats/${chatId}`, { method: 'DELETE' });

// 改动后：直接操作本地数据库
import { deleteChat as deleteChatFromDb } from '@/lib/chat-store';
await deleteChatFromDb(chatId, userName);
```

### 5. 更新 Chat 组件 (`components/chat.tsx`)

**查询单个聊天改动：**
```typescript
// 改动前：通过 API
const response = await fetchWithAuth(`/api/chats/${chatId}`);
return response.json();

// 改动后：直接查询 IndexedDB
import { getChatById } from '@/lib/chat-store';
const chat = await getChatById(chatId, userId);
return chat;
```

### 6. 删除的后端 API

- ✅ `app/api/chats/route.ts` - 获取聊天列表
- ✅ `app/api/chats/[id]/route.ts` - 获取/删除单个聊天

### 7. Chat Store 保持不变

`lib/chat-store.ts` 中的所有函数（`saveChat`, `saveMessages`, `getChats` 等）无需修改，因为它们使用的是 `db` 对象，而我们已经将 `db` 的底层实现从 Neon 切换到了 PGlite。

## 数据存储位置

### 浏览器 IndexedDB
- **数据库名称**: `wikihelper-chat-db`
- **位置**: 浏览器的 IndexedDB 存储
- **持久化**: 是（数据会保存在用户浏览器中）
- **查看工具**: 浏览器 DevTools -> Application -> IndexedDB

### 数据结构

#### Chats 表
```sql
CREATE TABLE chats (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT 'New Chat',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE INDEX idx_chats_user_id ON chats(user_id);
```

#### Messages 表
```sql
CREATE TABLE messages (
  id TEXT PRIMARY KEY NOT NULL,
  chat_id TEXT NOT NULL,
  role TEXT NOT NULL,
  parts JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
);
CREATE INDEX idx_messages_chat_id ON messages(chat_id);
```

## 优势

### 1. 完全离线支持
- ✅ 无需网络连接即可访问历史聊天
- ✅ 数据即时可用，无网络延迟

### 2. 隐私保护
- ✅ 所有聊天历史存储在用户本地
- ✅ 不经过云服务器
- ✅ 用户完全控制自己的数据

### 3. 成本节省
- ✅ 无需数据库服务器费用
- ✅ 无需维护数据库基础设施

### 4. 更快的性能
- ✅ 本地查询，毫秒级响应
- ✅ 无需 HTTP 往返

### 5. 简化部署
- ✅ 不需要配置数据库连接
- ✅ 不需要运行数据库迁移
- ✅ 真正的纯前端应用

## 使用方式

### 初始化数据库
数据库会在首次使用时自动初始化，无需手动操作。

### 查看数据
打开浏览器 DevTools：
1. 按 F12 打开开发者工具
2. 切换到 Application 标签
3. 展开 IndexedDB
4. 找到 `wikihelper-chat-db`

### 清空数据
在浏览器控制台执行：
```javascript
import { clearDatabase } from '@/lib/db';
await clearDatabase();
```

### 导出数据（备份）
```javascript
import { exportDatabase } from '@/lib/db';
const backup = await exportDatabase();
console.log(JSON.stringify(backup, null, 2));
// 复制输出并保存到文件
```

### 导入数据（恢复）
```javascript
import { importDatabase } from '@/lib/db';
const data = [...]; // 你的备份数据
await importDatabase(data);
```

## 数据迁移

如果用户已经有云端数据，可以创建一个迁移工具：

```typescript
// 从云端迁移到本地
async function migrateFromCloud() {
  // 1. 从云端获取所有数据
  const response = await fetch('/api/export-all-data');
  const cloudData = await response.json();
  
  // 2. 导入到本地 IndexedDB
  const { getDb } = await import('@/lib/db');
  const db = await getDb();
  
  // 3. 批量插入
  for (const chat of cloudData.chats) {
    await db.insert(chats).values(chat);
  }
  for (const message of cloudData.messages) {
    await db.insert(messages).values(message);
  }
  
  console.log('Migration completed!');
}
```

## 注意事项

### 1. 浏览器兼容性
- ✅ Chrome/Edge: 完全支持
- ✅ Firefox: 完全支持
- ✅ Safari: 完全支持（iOS 15.4+）

### 2. 存储限制
- IndexedDB 通常有几 GB 的存储空间
- 对于聊天应用来说绰绰有余

### 3. 数据隔离
- 每个浏览器/用户的数据是独立的
- 清除浏览器数据会删除 IndexedDB
- 建议提供导出功能让用户备份

### 4. 多设备同步
- 当前实现不支持多设备同步
- 如需同步，可以考虑：
  - 实现导出/导入功能
  - 使用云存储服务（如 Google Drive API）
  - 实现点对点同步协议

## 性能对比

### 云数据库（Neon）
- 查询延迟: 50-200ms（取决于网络）
- 需要网络连接
- 服务器负载
- 月费用: $0-$20+

### 本地数据库（PGlite + IndexedDB）
- 查询延迟: 1-10ms
- 离线可用
- 零服务器负载
- 月费用: $0

## 故障排除

### 问题 1: 数据库初始化失败
```javascript
// 检查浏览器是否支持 IndexedDB
if (!window.indexedDB) {
  console.error('Your browser doesn\'t support IndexedDB');
}
```

### 问题 2: 存储空间不足
```javascript
// 检查可用空间
if (navigator.storage && navigator.storage.estimate) {
  const estimate = await navigator.storage.estimate();
  console.log(`Using ${estimate.usage} of ${estimate.quota} bytes`);
}
```

### 问题 3: 数据丢失
- 确保用户没有清除浏览器数据
- 实现定期自动导出功能
- 考虑使用 localStorage 作为备份

## 下一步改进

- [ ] 添加自动备份到云存储
- [ ] 实现数据导出/导入 UI
- [ ] 添加数据库大小监控
- [ ] 实现数据压缩
- [ ] 添加多用户支持（同一浏览器）
- [ ] 实现加密存储

---
name: 创建模块
description: 用于在 LifeOS 中创建新功能模块的技能。当用户需要添加新功能模块、创建新页面或扩展系统能力时触发。
---

# 创建模块技能

此技能指导 AI 如何在 LifeOS 中创建新的功能模块并集成到系统中。

## 触发条件

- 用户输入 `/创建模块` 或 `/新建模块`
- 用户提及 "添加新功能"、"创建新页面"、"新建模块"
- 用户要求扩展系统能力

## 模块结构

每个模块位于 `src/components/modules/{module-id}/` 目录下：

```
src/components/modules/{module-id}/
├── index.tsx          # 或 XxxView.tsx - 模块主组件
├── manifest.json      # 模块元数据
└── SKILL.md           # AI 技能描述（用于斜杠命令）
```

## 创建步骤

### 1. 确定模块信息

首先确定以下信息：
- **模块 ID**: 小写字母 + 连字符，如 `my-module`
- **模块名称**: 中文显示名，如 "我的模块"
- **图标**: Lucide 图标名称，如 "Star"
- **描述**: 简短功能描述
- **数据目录**: Vault 中存储数据的目录名

### 2. 创建模块目录

```bash
mkdir src/components/modules/{module-id}
```

### 3. 创建 manifest.json

```json
{
  "id": "{module-id}",
  "name": "{中文名称}",
  "icon": "{Lucide图标名}",
  "description": "{功能描述}",
  "dataDirectory": "{数据目录名}",
  "builtin": true,
  "version": "1.0.0"
}
```

常用 Lucide 图标：
- `LayoutDashboard` - 仪表盘
- `CheckSquare` - 任务/勾选
- `Kanban` - 看板
- `Target` - 目标
- `BookOpen` - 书籍/日记
- `Mail` - 邮件
- `FileText` - 文件
- `Settings` - 设置
- `Wallet` - 钱包
- `Calendar` - 日历
- `Clock` - 时钟
- `Star` - 收藏
- `Heart` - 收藏/健康
- `Activity` - 活动

### 4. 创建组件文件

创建 `index.tsx` 或 `{ModuleId}View.tsx`：

```tsx
import React from 'react';

const {ModuleId}View: React.FC = () => {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">{模块名称}</h1>
      {/* 模块内容 */}
    </div>
  );
};

export default {ModuleId}View;
```

### 5. 创建 SKILL.md（可选）

如果模块需要支持斜杠命令，创建 SKILL.md：

```markdown
---
name: {中文名称}
description: 用于管理 {模块功能} 的斜杠命令技能。
---

# {模块名称}技能

## 触发条件

- 用户输入 `/{命令}`
- 用户提及相关关键词

## 可用命令

### 命令示例

\`\`\`
/{命令} [参数]
\`\`\`

## 数据存储

### 文件路径

\`\`\`
{vault}/{dataDirectory}/{filename}.md
\`\`\`

### Frontmatter 格式

\`\`\`yaml
---
field1: value1
field2: value2
---
\`\`\`

## AI 操作指南

描述 AI 如何操作此模块的数据。
```

## 集成到系统

### 1. 注册插件组件

编辑 `src/plugins/registry.ts`：

```typescript
// 添加导入
import {ModuleId}View from "@/components/modules/{module-id}/index";

// 在 PLUGIN_REGISTRY 中添加
export const PLUGIN_REGISTRY: Record<string, PluginComponent> = {
  // ... 其他模块
  {module-id}: {ModuleId}View,
};
```

### 2. 添加到侧边栏菜单

编辑 `src/stores/menuStore.ts` 或相关配置文件，添加新菜单项：

```typescript
{
  id: '{module-id}',
  label: '{中文名称}',
  icon: '{Lucide图标名}',
  pluginId: '{module-id}',
}
```

### 3. 更新路由（如果需要）

如果使用路由系统，在路由配置中添加新路由。

## 验证步骤

1. 运行 TypeScript 检查：
   ```bash
   npx tsc --noEmit
   ```

2. 启动开发服务器验证：
   ```bash
   npm run tauri dev
   ```

3. 检查：
   - 侧边栏是否显示新模块
   - 点击是否能正常打开
   - 数据读写是否正常

## 最佳实践

1. **命名规范**
   - 模块 ID 使用小写字母 + 连字符
   - 组件名使用 PascalCase + View 后缀
   - 文件名与组件名一致

2. **数据存储**
   - 使用 Markdown + YAML frontmatter 格式
   - 数据文件按日期或类别分目录
   - 提供清晰的文件命名规则

3. **UI 设计**
   - 使用 Tailwind CSS 样式
   - 保持与其他模块一致的视觉风格
   - 响应式布局

4. **状态管理**
   - 简单状态使用 React useState
   - 复杂状态考虑使用 Zustand store
   - 避免不必要的全局状态

## 示例：创建一个"收藏"模块

```bash
# 1. 创建目录
mkdir src/components/modules/favorites

# 2. 创建 manifest.json
cat > src/components/modules/favorites/manifest.json << 'EOF'
{
  "id": "favorites",
  "name": "收藏",
  "icon": "Star",
  "description": "收藏重要内容和快捷入口",
  "dataDirectory": "favorites",
  "builtin": true,
  "version": "1.0.0"
}
EOF

# 3. 创建组件
cat > src/components/modules/favorites/index.tsx << 'EOF'
import React from 'react';

const FavoritesView: React.FC = () => {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">收藏</h1>
      <p className="text-muted-foreground">收藏的内容将显示在这里</p>
    </div>
  );
};

export default FavoritesView;
EOF
```

然后在 `registry.ts` 中注册并添加到菜单即可。

## 注意事项

1. 模块 ID 必须唯一，不能与现有模块重复
2. 图标必须是 Lucide 图标库中存在的图标
3. 数据目录名建议与模块 ID 保持一致
4. 创建后记得运行 TypeScript 检查避免类型错误
5. 如果模块需要 Tauri 权限，需更新 `src-tauri/capabilities/` 配置

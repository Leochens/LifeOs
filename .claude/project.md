# LifeOS 插件开发指南

本项目是一个基于 Tauri 2 + React 18 + TypeScript 的个人操作系统。插件系统采用可插拔架构，每个功能模块都是独立的插件。

## 项目结构

```
life-os/
├── src/
│   ├── components/
│   │   ├── layout/          # 布局组件 (Shell, Sidebar)
│   │   └── modules/         # 业务模块组件
│   │       ├── Dashboard.tsx
│   │       ├── DailyView.tsx
│   │       ├── KanbanView.tsx
│   │       └── ...其他模块
│   ├── plugins/
│   │   └── registry.ts      # 插件注册表
│   ├── stores/
│   │   └── app.ts           # 全局状态管理
│   └── types/
│       └── index.ts         # TypeScript 类型定义
└── src-tauri/               # Rust 后端
```

## 插件系统架构

### 1. 插件注册表 (`src/plugins/registry.ts`)

所有插件组件必须在此注册：

```typescript
import MyPluginView from "@/components/modules/MyPluginView";

export const PLUGIN_REGISTRY: Record<string, PluginComponent> = {
  myplugin: MyPluginView,
};
```

### 2. 插件配置 (`src/stores/app.ts`)

在 `DEFAULT_MENU_CONFIG.plugins` 中添加插件配置：

```typescript
{
  id: "myplugin",           // 唯一标识符
  name: "我的插件",          // 显示名称
  icon: "MyIcon",           // 图标名称 (来自 lucide-react)
  component: "myplugin",    // 组件 ID (对应 registry 中的 key)
  enabled: false,           // 默认是否启用
  builtin: true,           // 是否为内置插件
}
```

### 3. 分组配置

插件需要分配到对应的分组：

- **工作** (work): dashboard, daily, kanban, planning
- **记录** (journal): diary, decisions, stickynotes
- **生活** (life): life, chat, mail
- **工具** (tools): servers, connectors, skills, gitscanner, scheduler

### 4. 图标系统

使用 lucide-react 图标，可在 `src/components/icons/index.ts` 中查看可用图标。

## 创建新插件的步骤

### 步骤 1: 创建视图组件

在 `src/components/modules/` 下创建新插件的 React 组件：

```tsx
// src/components/modules/MyPluginView.tsx
import { useState, useEffect } from "react";
import { useStore } from "@/stores/app";

export default function MyPluginView() {
  const vaultPath = useStore((s) => s.vaultPath);

  // 你的插件逻辑

  return (
    <div>
      {/* 插件界面 */}
    </div>
  );
}
```

### 步骤 2: 在注册表中注册

编辑 `src/plugins/registry.ts`：

```typescript
import MyPluginView from "@/components/modules/MyPluginView";

export const PLUGIN_REGISTRY = {
  // ...现有插件
  myplugin: MyPluginView,
};
```

### 步骤 3: 添加到插件配置

编辑 `src/stores/app.ts`，在 `DEFAULT_MENU_CONFIG.plugins` 数组中添加：

```typescript
{
  id: "myplugin",
  name: "我的插件",
  icon: "SomeIcon",  // 从 lucide-react 选择一个图标
  component: "myplugin",
  enabled: false,    // 新插件默认关闭
  builtin: true,    // 设为 false 可以允许用户完全删除
}
```

### 步骤 4: 添加到分组

编辑同一文件中的 `DEFAULT_MENU_CONFIG.groups`，将插件 ID 添加到对应分组：

```typescript
{
  id: "work",
  name: "工作",
  order: 0,
  collapsed: false,
  pluginIds: ["dashboard", "daily", "kanban", "planning", "myplugin"],
}
```

### 步骤 5: 添加类型定义（如需要）

如果新插件需要额外的数据类型，在 `src/types/index.ts` 中添加：

```typescript
export interface MyPluginData {
  // 你的数据类型
}
```

并在 `AppState` 中添加相应的状态管理方法。

## 现有插件列表

| 插件 ID | 名称 | 图标 | 功能描述 |
|---------|------|------|----------|
| dashboard | 总览 | LayoutDashboard | 系统仪表盘 |
| daily | 日常 |日常任务管理 |
 ListTodo | | kanban | 项目 | Kanban | 看板式项目管理 |
| planning | 计划 | Target | 目标规划 |
| diary | 日记 | BookOpen | 日记记录 |
| decisions | 决策 | Scale | 决策记录与分析 |
| stickynotes | 便利贴 | StickyNote | 快速笔记 |
| life | 生活数据 | Heart | 健康与屏幕使用时间 |
| chat | AI 聊天 | MessageCircle | Claude Code AI 对话 |
| mail | 邮箱 | Mail | 邮件账户管理 |
| servers | 服务器 | Server | SSH 服务器管理 |
| connectors | 连接 | Plug | API 连接配置 |
| skills | Skills | Wrench | Claude Code Skills 管理 |
| gitscanner | Git 仓库 | GitBranch | Git 仓库扫描 |
| scheduler | 定时任务 | Clock | macOS launchd 任务管理 |
| settings | 设置 | Settings | 应用设置 |

## 注意事项

1. **默认启用规则**: 除了 `dashboard` 和 `settings` 外，其他插件默认都是关闭的
2. **builtin 标志**: `builtin: true` 表示这是内置插件，无法被删除但可以关闭
3. **动态加载**: 插件组件是动态加载的，未启用的插件不会渲染
4. **数据存储**: 插件数据存储在 vault 的 `.lifeos/` 目录下，按插件名创建子目录

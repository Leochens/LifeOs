# LIFE OS

> 你的个人操作系统 — 基于文件系统的人生管理工具

## 项目简介

LifeOS 是一个本地优先的桌面应用，帮助你管理生活的各个方面。所有数据都以 Markdown + YAML 格式存储在本地文件系统中，完全掌控你的数据。

## 技术栈

| 层 | 技术 |
|---|---|
| 桌面壳 | Tauri 2 (Rust) |
| 前端 | React 18 + TypeScript |
| 构建 | Vite 5 |
| 状态 | Zustand |
| 样式 | Tailwind CSS |
| 数据 | Markdown + YAML frontmatter（纯文件系统） |

## 模块系统

LifeOS 采用模块化架构，每个模块独立管理特定领域的数据。

### 内置模块

| 模块 | ID | 图标 | 描述 |
|------|----|-----|------|
| 仪表盘 | dashboard | LayoutDashboard | 系统概览，展示任务、项目、日记和习惯的汇总信息 |
| 每日任务 | daily | CheckSquare | 每日任务管理和历史记录 |
| 项目看板 | kanban | Kanban | 项目管理，支持列表和看板视图 |
| 目标计划 | planning | Target | 年度/季度/月度目标管理和进度追踪 |
| 日记 | diary | BookOpen | 个人日记和心情记录 |
| 重大决策 | decisions | Scale | 记录和追踪重要的人生决策 |
| 生活数据 | life | Activity | 屏幕使用时间和健康数据追踪 |
| AI聊天 | chat | MessageSquare | Claude Code AI 助手聊天界面 |
| 邮箱 | mail | Mail | 多邮箱账户管理，支持 IMAP/POP3 |
| 备忘录 | notes | FileText | Apple Notes 集成 |
| 便利贴 | sticky-notes | StickyNote | 可视化便利贴白板 |
| 连接器 | connectors | Plug | 外部服务连接（GitHub、小红书、即刻等） |
| Git扫描器 | git-scanner | GitBranch | 扫描本地 Git 仓库及其状态 |
| 服务器 | servers | Server | SSH 服务器连接信息管理 |
| 定时任务 | scheduler | Clock | macOS launchd 定时任务管理 |
| 技能管理 | skills | Lightbulb | AI 代码助手技能文件管理 |
| 设置 | settings | Settings | 系统设置、主题定制 |

### 可选模块

| 模块 | ID | 图标 | 描述 |
|------|----|-----|------|
| 财务 | finance | Wallet | 家庭财务管理和记账 |
| 订阅 | subscriptions | CreditCard | 软件订阅管理和支出追踪 |

### 模块结构

每个模块位于 `src/components/modules/{module-id}/` 目录下，包含：

```
src/components/modules/{module-id}/
├── index.tsx          # 或 XxxView.tsx - 模块主组件
├── manifest.json      # 模块元数据
└── SKILL.md           # AI 技能描述（可选）
```

## 环境准备（Mac）

```bash
# 1. 安装 Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 2. 安装 Xcode Command Line Tools（如果没有）
xcode-select --install

# 3. 安装 Node.js 18+（推荐用 nvm）
brew install nvm
nvm install 20
nvm use 20
```

## 启动开发环境

```bash
# 进入项目
cd life-os

# 安装前端依赖
npm install

# 启动（同时启动 Vite 和 Tauri）
npm run tauri dev
```

首次运行会编译 Rust（约 3-5 分钟），后续热重载很快。

## 打包发布

```bash
npm run tauri build
# 产物在 src-tauri/target/release/bundle/
```

## Vault 文件结构

```
~/life-os-vault/
├── .lifeos/
│   ├── config.yaml          # 全局配置
│   └── connectors.yaml      # API tokens（不要提交到 git！）
├── daily/
│   ├── tasks/
│   │   └── 2025-02-19.md   # 每天一个文件
│   └── habits/
│       └── habits.yaml      # 习惯定义 + 打卡记录
├── projects/
│   ├── active/              # 进行中项目（.md 文件）
│   ├── backlog/
│   ├── todo/
│   └── done/
├── planning/
│   └── goals/               # 目标文件
├── diary/
│   └── 2025/                # 按年分目录
├── decisions/               # 决策记录
├── finance/                 # 财务记录
├── emails/                  # 邮件账户配置
├── notes/                   # 备忘录缓存
└── connectors/              # 外部数据缓存（自动生成）
```

## 文件格式

### 任务文件 daily/tasks/YYYY-MM-DD.md

```markdown
---
date: 2025-02-19
energy: high
mood: 😊
---

## 今日任务

- [ ] 晨间冥想 #habit #health
- [x] 健身 45分钟 #health ⏰09:30

## 今日笔记

今天...
```

### 项目文件 projects/active/my-project.md

```markdown
---
title: AI SaaS MVP
status: active
priority: high
created: 2025-01-15
updated: 2025-02-19
due: 2025-06-01
tags: tech, startup
progress: 68
github: username/repo
---

## 目标
...
```

## 开发指南

### 创建新模块

参考 `.claude/SKILL-create-module.md` 技能文件，了解如何创建和集成新模块。

### 测试框架

项目已配置完整的测试框架，确保代码质量。

#### 运行测试

```bash
# 前端单元测试 (Vitest)
npm test              # 监听模式
npm run test:run     # 单次运行
npm run test:ui      # UI 模式

# E2E 测试 (Playwright)
npm run test:e2e     # 运行 E2E 测试
npm run test:e2e:ui  # UI 模式

# Rust 后端测试
cd src-tauri && cargo test
```

#### 编写测试

**单元测试文件位置端服务/工具函数：`：**
- 前src/services/xxx.test.ts`
- 状态管理：`src/stores/xxx.test.ts`
- React 组件：`src/components/xxx.test.tsx`
- Rust 后端：在 `src-tauri/src/commands/` 目录下添加 `#[cfg(test)]` 模块

**测试文件命名规范：** `*.test.ts` 或 `*.spec.ts`

**示例：服务函数测试**

```typescript
// src/services/parser.test.ts
import { describe, it, expect } from 'vitest'
import { parseTasks, serializeTasks } from './parser'

describe('parser', () => {
  it('should parse completed task', () => {
    const content = '- [x] 完成项目'
    const tasks = parseTasks(content)
    expect(tasks).toHaveLength(1)
    expect(tasks[0].done).toBe(true)
  })
})
```

**示例：React 组件测试**

```tsx
// src/components/ui/Button.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from './Button'

describe('Button', () => {
  it('renders button with children', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByRole('button')).toHaveTextContent('Click me')
  })

  it('handles click events', async () => {
    const handleClick = vi.fn()
    const user = userEvent.setup()
    render(<Button onPress={handleClick}>Click me</Button>)
    await user.click(screen.getByRole('button'))
    expect(handleClick).toHaveBeenCalledTimes(1)
  })
})
```

**示例：Rust 测试**

```rust
// src-tauri/src/commands/fs_commands.rs
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_frontmatter() {
        let raw = r#"---
title: "Test"
---
Body"#;
        let (frontmatter, body) = extract_frontmatter(raw);
        assert!(frontmatter.get("title").is_some());
        assert_eq!(body, "Body");
    }
}
```

**E2E 测试**

```typescript
// tests/e2e/app.spec.ts
import { test, expect } from '@playwright/test'

test('should load the app', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/Life-OS/i)
})
```

#### 测试最佳实践

1. **测试用户行为而非实现细节** - 使用 React Testing Library 测试组件功能而非内部状态
2. **保持测试独立** - 每个测试应该能独立运行，不依赖其他测试的结果
3. **合理的测试覆盖** - 优先测试核心业务逻辑、工具函数和关键组件
4. **Mock Tauri API** - 测试组件时需要 mock `@tauri-apps/api`

```typescript
// Mock Tauri APIs
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))
```

### 项目结构

```
src/
├── components/
│   ├── layout/          # 布局组件（Sidebar, Header 等）
│   ├── icons/           # 图标组件
│   └── modules/         # 功能模块
├── plugins/
│   └── registry.ts      # 插件注册表
├── services/            # 数据服务层
├── stores/              # Zustand 状态管理
├── hooks/               # 自定义 React Hooks
├── tokens/              # 设计令牌
└── types/               # TypeScript 类型定义
```

## 开发路线图

- [x] Phase 1: 项目骨架 + 文件系统层
- [x] Phase 2: 核心模块 UI
- [x] Phase 3: 模块化重构
- [ ] Phase 4: GitHub / Gmail 连接器
- [ ] Phase 5: 全局搜索（⌘K）
- [ ] Phase 6: Git 自动提交
- [ ] Phase 7: 命令行工具（CLI）

## 数据安全

- 所有数据都是本地 `.md` 文件，永远属于你
- 建议将 Vault 放在 iCloud Drive 自动备份
- 或 `git init` + 私有仓库获得版本历史
- `connectors.yaml` 包含 API tokens，已加入 `.gitignore`

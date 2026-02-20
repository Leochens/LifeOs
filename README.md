# LIFE OS 🚀

> 你的个人操作系统 — 基于文件系统的人生管理工具

## 技术栈

| 层 | 技术 |
|---|---|
| 桌面壳 | Tauri 2 (Rust) |
| 前端 | React 18 + TypeScript |
| 构建 | Vite 5 |
| 状态 | Zustand |
| 数据 | Markdown + YAML frontmatter（纯文件系统） |

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
├── .life-os/
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

## 开发路线图

- [x] Phase 1: 项目骨架 + 文件系统层
- [x] Phase 2: 5 大核心模块 UI
- [ ] Phase 3: GitHub / Gmail 连接器
- [ ] Phase 4: 全局搜索（⌘K）
- [ ] Phase 5: Git 自动提交
- [ ] Phase 6: 命令行工具（CLI）

## 数据安全

- 所有数据都是本地 `.md` 文件，永远属于你
- 建议将 Vault 放在 iCloud Drive 自动备份
- 或 `git init` + 私有仓库获得版本历史
- `connectors.yaml` 包含 API tokens，已加入 `.gitignore`

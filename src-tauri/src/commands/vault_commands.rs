use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

const CONFIG_FILE_NAME: &str = ".life-os-vault";

/// Returns the path to the global config file stored in the user's home dir
fn global_config_path() -> PathBuf {
    let home = dirs_next::home_dir().expect("cannot find home dir");
    home.join(CONFIG_FILE_NAME)
}

#[derive(Serialize, Deserialize)]
pub struct VaultConfig {
    pub path: String,
}

/// Read the configured vault path, if any
#[tauri::command]
pub fn get_vault_path() -> Option<String> {
    let cfg = global_config_path();
    if cfg.exists() {
        fs::read_to_string(&cfg).ok().map(|s| s.trim().to_string())
    } else {
        None
    }
}

/// Persist a new vault path
#[tauri::command]
pub fn set_vault_path(path: String) -> Result<(), String> {
    fs::write(global_config_path(), &path).map_err(|e| e.to_string())
}

/// Scaffold the full vault directory structure and seed sample files
#[tauri::command]
pub fn init_vault(path: String) -> Result<(), String> {
    let root = PathBuf::from(&path);

    let dirs = [
        ".lifeos",
        ".lifeos/servers",
        ".lifeos/emails",
        ".lifeos/skills",
        "daily/tasks",
        "daily/habits",
        "projects/backlog",
        "projects/todo",
        "projects/active",
        "projects/done",
        "planning/goals",
        "planning/reviews",
        "diary/2025",
        "diary/templates",
        "decisions",
        "connectors/github",
        "connectors/gmail",
        "connectors/calendar",
        "assets/images",
    ];

    for dir in &dirs {
        fs::create_dir_all(root.join(dir)).map_err(|e| e.to_string())?;
    }

    // Write config
    let config_content = format!(
        "vault_path: \"{}\"\ncreated: \"{}\"\nversion: \"0.1.0\"\n",
        path,
        chrono::Local::now().format("%Y-%m-%d")
    );
    write_if_not_exists(&root.join(".lifeos/config.yaml"), &config_content)?;

    // Write menu config
    let menu_content = r#"# LifeOS 菜单配置
# 用户可以自定义修改此文件来调整侧边栏菜单

groups:
  - id: work
    name: 工作
    order: 0
    collapsed: false
    pluginIds:
      - dashboard
      - daily
      - kanban
      - planning
  - id: journal
    name: 记录
    order: 1
    collapsed: false
    pluginIds:
      - diary
      - decisions
      - stickynotes
  - id: life
    name: 生活
    order: 2
    collapsed: false
    pluginIds:
      - life
      - chat
      - mail
  - id: tools
    name: 工具
    order: 3
    collapsed: false
    pluginIds:
      - servers
      - connectors
      - skills
      - gitscanner
      - scheduler

plugins:
  # 必选插件 - 不可关闭
  - id: dashboard
    name: 总览
    icon: LayoutDashboard
    component: dashboard
    enabled: true
    builtin: true
  # 可选插件 - 默认开启，用户可关闭
  - id: daily
    name: 日常
    icon: ListTodo
    component: daily
    enabled: true
    builtin: false
  - id: kanban
    name: 项目
    icon: Kanban
    component: kanban
    enabled: true
    builtin: false
  - id: planning
    name: 计划
    icon: Target
    component: planning
    enabled: true
    builtin: false
  - id: diary
    name: 日记
    icon: BookOpen
    component: diary
    enabled: true
    builtin: false
  - id: decisions
    name: 决策
    icon: Scale
    component: decisions
    enabled: true
    builtin: false
  - id: stickynotes
    name: 便利贴
    icon: StickyNote
    component: stickynotes
    enabled: true
    builtin: false
  - id: life
    name: 生活数据
    icon: Heart
    component: life
    enabled: true
    builtin: false
  - id: chat
    name: AI 聊天
    icon: MessageCircle
    component: chat
    enabled: true
    builtin: false
  - id: mail
    name: 邮箱
    icon: Mail
    component: mail
    enabled: true
    builtin: false
  - id: servers
    name: 服务器
    icon: Server
    component: servers
    enabled: true
    builtin: false
  - id: connectors
    name: 连接
    icon: Plug
    component: connectors
    enabled: true
    builtin: false
  - id: skills
    name: Skills
    icon: Wrench
    component: skills
    enabled: true
    builtin: false
  - id: gitscanner
    name: Git 仓库
    icon: GitBranch
    component: gitscanner
    enabled: true
    builtin: false
  - id: scheduler
    name: 定时任务
    icon: Clock
    component: scheduler
    enabled: true
    builtin: false
  # 设置 - 必选
  - id: settings
    name: 设置
    icon: Settings
    component: settings
    enabled: true
    builtin: true
"#;
    write_if_not_exists(&root.join(".lifeos/menu.yaml"), menu_content)?;

    // Seed habit tracker
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    let habits_content = format!(
        r#"# Habit Definitions
habits:
  - id: morning_meditation
    name: "晨间冥想"
    icon: "🧘"
    target_days: [1,2,3,4,5,6,7]
    created: "{today}"
  - id: exercise
    name: "运动"
    icon: "💪"
    target_days: [1,2,3,4,5,6,7]
    created: "{today}"
  - id: reading
    name: "阅读"
    icon: "📖"
    target_days: [1,2,3,4,5,6,7]
    created: "{today}"

# Check-in records (YYYY-MM-DD: [habit_ids])
checkins:
"#
    );
    write_if_not_exists(&root.join("daily/habits/habits.yaml"), &habits_content)?;

    // Seed today's task file
    let task_file = root.join(format!("daily/tasks/{today}.md"));
    let task_content = format!(
        r#"---
date: {today}
energy: high
mood: 😊
---

## 今日任务

- [ ] 晨间冥想 15分钟 #habit #health
- [ ] 阅读 30分钟 #growth
- [ ] 运动 45分钟 #health

## 今日笔记

今天是使用 Life OS 的第一天！
"#
    );
    write_if_not_exists(&task_file, &task_content)?;

    // Seed kanban board config
    let board_content = r##"columns:
  - id: backlog
    name: "💤 待规划"
    color: "#5a6a82"
  - id: todo
    name: "📋 计划中"
    color: "#00c8ff"
  - id: active
    name: "⚡ 进行中"
    color: "#7b61ff"
  - id: done
    name: "✅ 已完成"
    color: "#00ffa3"
"##;
    write_if_not_exists(&root.join(".lifeos/board.yaml"), board_content)?;

    // Seed diary template
    let diary_template = r#"---
date: {{date}}
mood: 😊
weather: ~
energy: high
tags: []
---

## 今天发生了什么

{{content}}

## 今天的收获

-

## 明天的计划

-
"#;
    write_if_not_exists(
        &root.join("diary/templates/daily.md"),
        diary_template,
    )?;

    // Seed connectors config
    let connectors_content = r#"# Life OS Connectors Configuration
# DO NOT commit this file to public repositories (add to .gitignore)

github:
  enabled: false
  token: ""
  username: ""

gmail:
  enabled: false
  # OAuth handled separately

calendar:
  enabled: false
  # OAuth handled separately
"#;
    write_if_not_exists(
        &root.join(".lifeos/connectors.yaml"),
        connectors_content,
    )?;

    // Write vault path to global config
    fs::write(global_config_path(), &path).map_err(|e| e.to_string())?;

    // Write skills to vault
    write_skills(&root)?;

    Ok(())
}

// Write skills to .lifeos/skills/
fn write_skills(root: &PathBuf) -> Result<(), String> {
    let skills_dir = root.join(".lifeos/skills");
    fs::create_dir_all(&skills_dir).map_err(|e| e.to_string())?;

    // Kanban skill
    let kanban_skill = r#"---
name: 看板
description: 用于管理 LifeOS 项目看板模块的斜杠命令技能。当用户使用 /看板 命令或提及项目、看板、任务管理时触发此技能。
---

# 看板技能

此技能用于通过 AI 辅助管理 LifeOS 项目看板。

## 触发条件

- 用户输入 /看板
- 用户提及 "创建项目"、"删除项目"、"查看任务"
- 用户要求分析项目进度

## 可用命令

### 创建新项目
/看板 创建项目 [项目名称]

### 删除项目
/看板 删除项目 [项目名称]

### 查看项目状态
/看板 查看所有项目
/看板 查看 [项目名称] 的任务

### 创建任务
/看板 在 [项目名称] 创建任务 [任务内容]

### 完成/取消任务
/看板 完成 [项目名称] 的任务 [任务内容]

### 查看进度
/看板 查看 [项目名称] 进度
/看板 项目统计

## 数据存储

### 项目文件路径
{vault}/projects/{status}/{project-slug}.md

状态目录：
- backlog - 待规划
- todo - 计划中
- active - 进行中
- paused - 暂停
- done - 已完成

### Frontmatter 格式
---
title: 项目标题
status: backlog | todo | active | paused | done
priority: low | medium | high | urgent
created: 2025-01-01
updated: 2025-01-15
progress: 0-100
tags: 标签1, 标签2
due: 2025-12-31
---

### Markdown 任务格式
## 任务

- [ ] 任务1
- [x] 任务2
- [ ] 任务3

## AI 操作指南

### 读取项目列表
使用 list_notes 或遍历 {vault}/projects/{status}/*.md

### 创建新项目
1. 在 {vault}/projects/backlog/ 目录创建 .md 文件
2. 写入 frontmatter 和内容

### 更新任务状态
修改 markdown 文件中的 - [ ] 为 - [x] 或反向

### 移动项目
1. 移动文件到新的状态目录
2. 更新 frontmatter 中的 status 字段
"#;
    fs::write(skills_dir.join("kanban.md"), kanban_skill).map_err(|e| e.to_string())?;

    // Daily skill
    let daily_skill = r#"---
name: 日常
description: 用于管理 LifeOS 日常任务和 habits 模块的斜杠命令技能。当用户使用 /日常 命令或提及任务、habits、习惯追踪时触发此技能。
---

# 日常技能

此技能用于通过 AI 辅助管理 LifeOS 日常任务。

## 触发条件

- 用户输入 /日常
- 用户提及 "今日任务"、" habits"、"习惯"

## 数据存储

### 今日笔记
{vault}/daily/tasks/{YYYY-MM-DD}.md

### Habits 配置
{vault}/daily/habits/habits.yaml

### Frontmatter 格式
---
date: 2025-01-15
energy: high | medium | low
mood: 😊
---
"#;
    fs::write(skills_dir.join("daily.md"), daily_skill).map_err(|e| e.to_string())?;

    // Diary skill
    let diary_skill = r#"---
name: 日记
description: 用于管理 LifeOS 日记模块的斜杠命令技能。当用户使用 /日记 命令或提及日记、心情、天气时触发此技能。
---

# 日记技能

此技能用于通过 AI 辅助管理 LifeOS 日记。

## 触发条件

- 用户输入 /日记
- 用户提及 "写日记"、"查看日记"

## 数据存储

### 日记文件
{vault}/diary/{YYYY}/{YYYY-MM-DD}.md

### Frontmatter 格式
---
date: 2025-01-15
title: 日记标题
mood: 😊
weather: sunny
tags: tag1, tag2
---
"#;
    fs::write(skills_dir.join("diary.md"), diary_skill).map_err(|e| e.to_string())?;

    // Decisions skill
    let decisions_skill = r#"---
name: 决策
description: 用于管理 LifeOS 决策记录模块的斜杠命令技能。当用户使用 /决策 命令或提及决策、决定时触发此技能。
---

# 决策技能

此技能用于通过 AI 辅助管理 LifeOS 决策记录。

## 触发条件

- 用户输入 /决策
- 用户提及 "记录决策"、"查看决策"

## 数据存储

### 决策文件
{vault}/decisions/{slug}.md

### Frontmatter 格式
---
title: 决策标题
created: 2025-01-15
status: pending | decided | archived
weight: low | medium | high | critical
decided_on: 2025-01-20
outcome: 决策结果
---
"#;
    fs::write(skills_dir.join("decisions.md"), decisions_skill).map_err(|e| e.to_string())?;

    // Planning skill
    let planning_skill = r#"---
name: 计划
description: 用于管理 LifeOS 目标规划模块的斜杠命令技能。当用户使用 /计划 命令或提及目标、年度计划、季度计划时触发此技能。
---

# 计划技能

此技能用于通过 AI 辅助管理 LifeOS 目标规划。

## 触发条件

- 用户输入 /计划
- 用户提及 "年度目标"、"季度计划"

## 数据存储

### 目标文件
{vault}/planning/goals/{slug}.md

### Frontmatter 格式
---
title: 目标标题
type: annual | quarterly | monthly
year: 2025
quarter: 1
month: 1
progress: 0-100
due: 2025-12-31
priority: low | medium | high
status: active | completed | archived
---
"#;
    fs::write(skills_dir.join("planning.md"), planning_skill).map_err(|e| e.to_string())?;

    Ok(())
}

/// Load menu config from vault
#[tauri::command]
pub fn load_menu_config(vault_path: String) -> Result<String, String> {
    let menu_path = PathBuf::from(&vault_path).join(".lifeos/menu.yaml");
    if menu_path.exists() {
        fs::read_to_string(&menu_path).map_err(|e| e.to_string())
    } else {
        Err("Menu config not found".to_string())
    }
}

/// Save menu config to vault
#[tauri::command]
pub fn save_menu_config(vault_path: String, content: String) -> Result<(), String> {
    let menu_path = PathBuf::from(&vault_path).join(".lifeos/menu.yaml");
    fs::write(&menu_path, content).map_err(|e| e.to_string())
}

/// Load board config from vault
#[tauri::command]
pub fn load_board_config(vault_path: String) -> Result<String, String> {
    let board_path = PathBuf::from(&vault_path).join(".lifeos/board.yaml");
    if board_path.exists() {
        fs::read_to_string(&board_path).map_err(|e| e.to_string())
    } else {
        Err("Board config not found".to_string())
    }
}

/// Save board config to vault
#[tauri::command]
pub fn save_board_config(vault_path: String, content: String) -> Result<(), String> {
    let board_path = PathBuf::from(&vault_path).join(".lifeos/board.yaml");
    fs::write(&board_path, content).map_err(|e| e.to_string())
}

/// Load app settings from vault
#[tauri::command]
pub fn load_app_settings(vault_path: String) -> Result<String, String> {
    let settings_path = PathBuf::from(&vault_path).join(".lifeos/settings.yaml");
    if settings_path.exists() {
        fs::read_to_string(&settings_path).map_err(|e| e.to_string())
    } else {
        Ok(String::new())
    }
}

/// Save app settings to vault
#[tauri::command]
pub fn save_app_settings(vault_path: String, content: String) -> Result<(), String> {
    let settings_path = PathBuf::from(&vault_path).join(".lifeos/settings.yaml");
    fs::write(&settings_path, content).map_err(|e| e.to_string())
}

/// Regenerate skills in vault
#[tauri::command]
pub fn regenerate_skills(vault_path: String) -> Result<(), String> {
    let root = PathBuf::from(&vault_path);
    write_skills(&root)
}

fn write_if_not_exists(path: &PathBuf, content: &str) -> Result<(), String> {
    if !path.exists() {
        fs::write(path, content).map_err(|e| e.to_string())?;
    }
    Ok(())
}

// Re-export dirs_next for home_dir
mod dirs_next {
    pub fn home_dir() -> Option<std::path::PathBuf> {
        std::env::var_os("HOME")
            .or_else(|| std::env::var_os("USERPROFILE"))
            .map(std::path::PathBuf::from)
    }
}

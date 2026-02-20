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

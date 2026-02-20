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
        ".life-os",
        ".lifeos/servers",
        "daily/tasks",
        "daily/habits",
        "projects/active",
        "projects/backlog",
        "projects/paused",
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
    write_if_not_exists(&root.join(".life-os/config.yaml"), &config_content)?;

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
    write_if_not_exists(&root.join("projects/_board.yaml"), board_content)?;

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
        &root.join(".life-os/connectors.yaml"),
        connectors_content,
    )?;

    // Write vault path to global config
    fs::write(global_config_path(), &path).map_err(|e| e.to_string())?;

    Ok(())
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

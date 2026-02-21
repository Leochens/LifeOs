use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use tokio::process::Command as AsyncCommand;
use walkdir::WalkDir;

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct GitRepo {
    pub path: String,
    pub name: String,
    pub branch: String,
    pub has_uncommitted: bool,
    pub last_commit: Option<String>,
    pub remote_url: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SkillFile {
    pub name: String,
    pub title: String,
    pub description: String,
    pub path: String,
    pub ide: String,
    pub content: String,
    pub size: u64,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct LaunchdTask {
    pub id: String,
    pub label: String,
    pub program: String,
    pub args: Vec<String>,
    pub interval_seconds: u64,
    pub enabled: bool,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct AppleNote {
    pub id: String,
    pub name: String,
    pub content: String,
    pub created: Option<String>,
    pub modified: Option<String>,
    pub folder: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct AppleNotesResult {
    pub notes: Vec<AppleNote>,
    pub total: usize,
    pub has_more: bool,
}

// ─────────────────────────────────────────────────────────────────────────────
// System: Open in Finder
// ─────────────────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn open_in_finder(path: String) -> Result<(), String> {
    Command::new("open")
        .arg(&path)
        .spawn()
        .map_err(|e| format!("Failed to open in Finder: {e}"))?;
    Ok(())
}

// ─────────────────────────────────────────────────────────────────────────────
// Git Scanner
// ─────────────────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn scan_git_repos(root: String, max_depth: u32) -> Result<Vec<GitRepo>, String> {
    let root_path = PathBuf::from(&root);
    if !root_path.exists() {
        return Err(format!("Path does not exist: {}", root));
    }

    let depth = max_depth as usize;
    let mut repos = Vec::new();

    for entry in WalkDir::new(&root_path)
        .max_depth(depth)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_dir() && e.file_name() == ".git")
    {
        let repo_path = match entry.path().parent() {
            Some(p) => p.to_string_lossy().to_string(),
            None => continue,
        };

        let name = PathBuf::from(&repo_path)
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| "unknown".to_string());

        let branch = Command::new("git")
            .args(["-C", &repo_path, "branch", "--show-current"])
            .output()
            .ok()
            .and_then(|o| String::from_utf8(o.stdout).ok())
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| "unknown".to_string());

        let has_uncommitted = Command::new("git")
            .args(["-C", &repo_path, "status", "--porcelain"])
            .output()
            .ok()
            .map(|o| !o.stdout.is_empty())
            .unwrap_or(false);

        let last_commit = Command::new("git")
            .args(["-C", &repo_path, "log", "-1", "--format=%s (%cr)"])
            .output()
            .ok()
            .and_then(|o| String::from_utf8(o.stdout).ok())
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty());

        let remote_url = Command::new("git")
            .args(["-C", &repo_path, "remote", "get-url", "origin"])
            .output()
            .ok()
            .and_then(|o| String::from_utf8(o.stdout).ok())
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty());

        repos.push(GitRepo {
            path: repo_path,
            name,
            branch,
            has_uncommitted,
            last_commit,
            remote_url,
        });
    }

    Ok(repos)
}

// ─────────────────────────────────────────────────────────────────────────────
// Skills Manager
// ─────────────────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn get_skill_paths() -> Vec<serde_json::Value> {
    let home = std::env::var("HOME").unwrap_or_else(|_| "~".to_string());

    vec![
        serde_json::json!({
            "ide": "Claude Code (Global)",
            "path": format!("{}/.claude/commands", home)
        }),
        serde_json::json!({
            "ide": "Claude Code (Local Skills)",
            "path": format!("{}/.claude/skills", home)
        }),
        serde_json::json!({
            "ide": "Cursor",
            "path": format!("{}/.cursor/User/snippets", home)
        }),
        serde_json::json!({
            "ide": "VS Code",
            "path": format!("{}/Library/Application Support/Code/User/snippets", home)
        }),
    ]
}

#[tauri::command]
pub fn list_skill_files(paths: Vec<String>) -> Result<Vec<SkillFile>, String> {
    let mut skills = Vec::new();

    for path in &paths {
        let dir = PathBuf::from(path);
        if !dir.exists() {
            continue;
        }

        for entry in WalkDir::new(&dir)
            .max_depth(3)
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| {
                let ext = e.path().extension()
                    .map(|x| x.to_string_lossy().to_string())
                    .unwrap_or_default();
                ext == "md" || ext == "txt" || ext == "json"
            })
        {
            let file_path = entry.path().to_string_lossy().to_string();
            let name = entry.file_name().to_string_lossy().to_string();
            let content = fs::read_to_string(entry.path()).unwrap_or_default();
            let size = entry.metadata().ok().map(|m| m.len()).unwrap_or(0);

            let ide = if path.contains(".claude/commands") {
                "Claude Code".to_string()
            } else if path.contains(".claude/skills") {
                "Claude Code".to_string()
            } else if path.contains(".cursor") {
                "Cursor".to_string()
            } else if path.contains("Code/User") {
                "VS Code".to_string()
            } else {
                "Other".to_string()
            };

            // Extract title and description from content
            let mut title = String::new();
            let mut description = String::new();

            // Check for YAML frontmatter
            if content.starts_with("---") {
                if let Some(end_idx) = content[3..].find("---") {
                    let frontmatter = &content[3..end_idx + 3];
                    for line in frontmatter.lines() {
                        if line.starts_with("title:") {
                            title = line.replace("title:", "").trim().to_string();
                        } else if line.starts_with("description:") {
                            description = line.replace("description:", "").trim().to_string();
                        }
                    }
                }
            }

            // If no frontmatter title, try to find first # heading
            if title.is_empty() {
                if let Some(idx) = content.find("# ") {
                    let rest = &content[idx + 2..];
                    if let Some(end) = rest.find('\n') {
                        title = rest[..end].trim().to_string();
                    } else {
                        title = rest.trim().to_string();
                    }
                }
            }

            // If still no title, use filename without extension
            if title.is_empty() {
                title = name.replace(".md", "").replace(".txt", "").replace(".json", "");
            }

            skills.push(SkillFile {
                name,
                title,
                description,
                path: file_path,
                ide,
                content,
                size,
            });
        }
    }

    Ok(skills)
}

// ─────────────────────────────────────────────────────────────────────────────
// Shell command runner (for Claude AI analysis etc.)
// ─────────────────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn run_shell_command(command: String, args: Vec<String>) -> Result<String, String> {
    let output = tokio::process::Command::new(&command)
        .args(&args)
        .output()
        .await
        .map_err(|e| format!("Failed to run '{}': {e}", command))?;

    if output.status.success() {
        String::from_utf8(output.stdout)
            .map_err(|e| format!("Invalid UTF-8 output: {e}"))
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        Err(if stderr.is_empty() { stdout } else { stderr })
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// macOS Shortcuts
// ─────────────────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn run_shortcut(name: String) -> Result<String, String> {
    let output = tokio::process::Command::new("shortcuts")
        .args(["run", &name, "--output-format", "json"])
        .output()
        .await
        .map_err(|e| format!("Failed to run shortcut '{}': {e}", name))?;

    if output.status.success() {
        let stdout = String::from_utf8(output.stdout)
            .map_err(|e| format!("Invalid UTF-8 output: {e}"))?;
        // Shortcuts might return empty or newlines for some shortcuts
        if stdout.trim().is_empty() {
            return Ok("{}".to_string());
        }
        Ok(stdout)
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        Err(if stderr.is_empty() { stdout } else { stderr })
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// macOS launchd scheduler
// ─────────────────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn create_launchd_task(task: LaunchdTask) -> Result<(), String> {
    let home = std::env::var("HOME").map_err(|e| e.to_string())?;
    let agents_dir = format!("{}/Library/LaunchAgents", home);
    let plist_path = format!("{}/com.lifeos.{}.plist", agents_dir, task.id);

    let args_xml: String = task.args.iter()
        .map(|a| format!("        <string>{}</string>\n", a))
        .collect();

    let plist = format!(
        r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.lifeos.{id}</string>
    <key>ProgramArguments</key>
    <array>
        <string>{program}</string>
{args}    </array>
    <key>StartInterval</key>
    <integer>{interval}</integer>
    <key>RunAtLoad</key>
    <false/>
</dict>
</plist>"#,
        id = task.id,
        program = task.program,
        args = args_xml,
        interval = task.interval_seconds,
    );

    fs::create_dir_all(&agents_dir).map_err(|e| e.to_string())?;
    fs::write(&plist_path, plist).map_err(|e| format!("Failed to write plist: {e}"))?;

    if task.enabled {
        Command::new("launchctl")
            .args(["load", &plist_path])
            .output()
            .map_err(|e| format!("Failed to load task: {e}"))?;
    }

    Ok(())
}

#[tauri::command]
pub fn list_launchd_tasks() -> Result<Vec<LaunchdTask>, String> {
    let home = std::env::var("HOME").map_err(|e| e.to_string())?;
    let agents_dir = format!("{}/Library/LaunchAgents", home);

    let mut tasks = Vec::new();

    let read_dir = match fs::read_dir(&agents_dir) {
        Ok(d) => d,
        Err(_) => return Ok(tasks),
    };

    for entry in read_dir.filter_map(|e| e.ok()) {
        let path = entry.path();
        let stem = match path.file_stem() {
            Some(s) => s.to_string_lossy().to_string(),
            None => continue,
        };

        if !stem.starts_with("com.lifeos.") {
            continue;
        }
        if path.extension().map(|e| e != "plist").unwrap_or(true) {
            continue;
        }

        let id = stem.strip_prefix("com.lifeos.")
            .unwrap_or(&stem)
            .to_string();

        let label = stem.clone();

        // Check if currently loaded
        let enabled = Command::new("launchctl")
            .args(["list", &stem])
            .output()
            .ok()
            .map(|o| o.status.success())
            .unwrap_or(false);

        tasks.push(LaunchdTask {
            id,
            label,
            program: String::new(),
            args: vec![],
            interval_seconds: 3600,
            enabled,
        });
    }

    Ok(tasks)
}

#[tauri::command]
pub fn delete_launchd_task(id: String) -> Result<(), String> {
    let home = std::env::var("HOME").map_err(|e| e.to_string())?;
    let plist_path = format!("{}/Library/LaunchAgents/com.lifeos.{}.plist", home, id);

    // Unload first (ignore error if not loaded)
    let _ = Command::new("launchctl")
        .args(["unload", &plist_path])
        .output();

    if PathBuf::from(&plist_path).exists() {
        fs::remove_file(&plist_path)
            .map_err(|e| format!("Failed to delete plist: {e}"))?;
    }

    Ok(())
}

// ─────────────────────────────────────────────────────────────────────────────
// Apple Notes (备忘录)
// ─────────────────────────────────────────────────────────────────────────────

// 缓存备忘录数据，避免每次都调用 AppleScript
use std::sync::Mutex;
use once_cell::sync::Lazy;

static NOTES_CACHE: Lazy<Mutex<Vec<AppleNote>>> = Lazy::new(|| Mutex::new(Vec::new()));
static CACHE_TIMESTAMP: Lazy<Mutex<u64>> = Lazy::new(|| Mutex::new(0));

fn get_cache_age() -> u64 {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let timestamp = *CACHE_TIMESTAMP.lock().unwrap();
    now.saturating_sub(timestamp)
}

fn invalidate_cache() {
    NOTES_CACHE.lock().unwrap().clear();
    *CACHE_TIMESTAMP.lock().unwrap() = 0;
}

#[tauri::command]
pub async fn get_apple_notes(query: Option<String>, offset: Option<usize>, limit: Option<usize>) -> Result<AppleNotesResult, String> {
    let query = query.unwrap_or_default().to_lowercase();
    let offset = offset.unwrap_or(0);
    let limit = limit.unwrap_or(20);

    // 检查缓存（缓存有效期 30 秒）
    let cache_age = get_cache_age();
    let use_cache = query.is_empty() && offset == 0 && cache_age < 30;

    let all_notes: Vec<AppleNote> = if use_cache {
        let cache = NOTES_CACHE.lock().unwrap();
        if !cache.is_empty() {
            cache.clone()
        } else {
            drop(cache);
            load_notes_from_apple()?
        }
    } else {
        load_notes_from_apple()?
    };

    // 更新缓存
    if query.is_empty() && offset == 0 {
        let mut cache = NOTES_CACHE.lock().unwrap();
        *cache = all_notes.clone();
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);
        *CACHE_TIMESTAMP.lock().unwrap() = now;
    }

    // 过滤搜索结果
    let filtered: Vec<AppleNote> = if query.is_empty() {
        all_notes
    } else {
        all_notes.into_iter().filter(|n| {
            n.name.to_lowercase().contains(&query) || n.content.to_lowercase().contains(&query)
        }).collect()
    };

    // 分页
    let paginated: Vec<AppleNote> = filtered.iter().skip(offset).take(limit).cloned().collect();
    let has_more = offset + limit < filtered.len();

    Ok(AppleNotesResult {
        notes: paginated,
        total: filtered.len(),
        has_more,
    })
}

fn load_notes_from_apple() -> Result<Vec<AppleNote>, String> {
    // 直接使用 osascript，避免 Python 开销
    let script = r#"
tell application "Notes"
    set notesList to {}
    repeat with aNote in (get notes)
        try
            set noteId to id of aNote
            set noteName to name of aNote
            set noteContent to plaintext of aNote
            set noteFolder to name of container of aNote
            set end of notesList to {noteId, noteName, noteContent, noteFolder}
        on error
            -- skip problematic notes
        end try
    end repeat
    return notesList
end tell
"#;

    let output = std::process::Command::new("osascript")
        .arg("-e")
        .arg(script)
        .output()
        .map_err(|e| format!("Failed to run AppleScript: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("AppleScript error: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let output_str = stdout.trim();

    if output_str.is_empty() || output_str == "{}" {
        return Ok(Vec::new());
    }

    // 解析 AppleScript 返回的列表格式
    // 格式: {id1, name1, content1, folder1}, {id2, name2, content2, folder2}, ...
    let mut notes = Vec::new();
    let mut current_depth = 0;
    let mut current_start = 0;

    for (i, c) in output_str.chars().enumerate() {
        match c {
            '{' => {
                if current_depth == 0 {
                    current_start = i;
                }
                current_depth += 1;
            }
            '}' => {
                current_depth -= 1;
                if current_depth == 0 {
                    let item = &output_str[current_start..=i];
                    if let Some(note) = parse_note_item(item) {
                        notes.push(note);
                    }
                }
            }
            _ => {}
        }
    }

    Ok(notes)
}

fn parse_note_item(item: &str) -> Option<AppleNote> {
    // 移除大括号
    let item = item.trim().trim_start_matches('{').trim_end_matches('}');

    // 使用简单分割（注意：内容中可能包含逗号，所以这里需要更智能的处理）
    let parts: Vec<&str> = item.splitn(4, ',').collect();
    if parts.len() >= 4 {
        Some(AppleNote {
            id: parts[0].trim().to_string(),
            name: parts[1].trim().to_string(),
            content: parts[2].trim().to_string(),
            folder: parts[3].trim().to_string(),
            created: None,
            modified: None,
        })
    } else {
        None
    }
}

/// Create a new Apple Note
#[tauri::command]
pub async fn create_apple_note(folder: String, title: String, body: String) -> Result<String, String> {
    invalidate_cache(); // 使缓存失效

    let escaped_title = title.replace("\"", "\\\"");
    let escaped_body = body.replace("\"", "\\\"").replace("\n", "\\n");

    let script = format!(
        r#"tell application "Notes"
    tell folder "{folder}"
        set newNote to make new note with properties {{name:"{title}", body:"{body}"}}
        return id of newNote
    end tell
end tell"#,
        folder = folder.replace("\"", "\\\""),
        title = escaped_title,
        body = escaped_body
    );

    let output = AsyncCommand::new("osascript")
        .arg("-e")
        .arg(&script)
        .output()
        .await
        .map_err(|e| format!("Failed to run AppleScript: {}", e))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).trim().to_string())
    }
}

/// Update an existing Apple Note
#[tauri::command]
pub async fn update_apple_note(note_id: String, body: String) -> Result<(), String> {
    invalidate_cache(); // 使缓存失效

    let escaped_body = body.replace("\"", "\\\"").replace("\n", "\\n");

    let script = format!(
        r#"tell application "Notes"
    set targetNote to first note whose id is "{id}"
    set body of targetNote to "{body}"
end tell"#,
        id = note_id.replace("\"", "\\\""),
        body = escaped_body
    );

    let output = AsyncCommand::new("osascript")
        .arg("-e")
        .arg(&script)
        .output()
        .await
        .map_err(|e| format!("Failed to run AppleScript: {}", e))?;

    if output.status.success() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).trim().to_string())
    }
}

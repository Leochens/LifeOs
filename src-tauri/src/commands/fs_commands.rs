use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use walkdir::WalkDir;

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct NoteFile {
    pub path: String,
    pub filename: String,
    pub frontmatter: serde_json::Value,
    pub content: String,
    pub modified: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct DirEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub modified: Option<String>,
    pub size: Option<u64>,
}

// ─────────────────────────────────────────────────────────────────────────────
// Generic FS commands
// ─────────────────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn read_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| format!("read_file failed: {e}"))
}

#[tauri::command]
pub fn write_file(path: String, content: String) -> Result<(), String> {
    // Ensure parent dirs exist
    if let Some(parent) = PathBuf::from(&path).parent() {
        fs::create_dir_all(parent).map_err(|e| format!("create_dir_all failed: {e}"))?;
    }
    fs::write(&path, content).map_err(|e| format!("write_file failed: {e}"))
}

#[tauri::command]
pub fn delete_file(path: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    if p.is_dir() {
        fs::remove_dir_all(&p).map_err(|e| e.to_string())
    } else {
        fs::remove_file(&p).map_err(|e| e.to_string())
    }
}

#[tauri::command]
pub fn file_exists(path: String) -> bool {
    PathBuf::from(&path).exists()
}

#[tauri::command]
pub fn create_dir_all(path: String) -> Result<(), String> {
    fs::create_dir_all(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn move_file(src: String, dest: String) -> Result<(), String> {
    if let Some(parent) = PathBuf::from(&dest).parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::rename(&src, &dest).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_dir(path: String, recursive: bool) -> Result<Vec<DirEntry>, String> {
    let root = PathBuf::from(&path);
    if !root.exists() {
        return Ok(vec![]);
    }

    let mut entries: Vec<DirEntry> = Vec::new();

    let walker = if recursive {
        WalkDir::new(&root).min_depth(1).max_depth(10)
    } else {
        WalkDir::new(&root).min_depth(1).max_depth(1)
    };

    for entry in walker.into_iter().filter_map(|e| e.ok()) {
        let meta = entry.metadata().ok();
        let modified = meta.as_ref().and_then(|m| m.modified().ok()).map(|t| {
            let dt: chrono::DateTime<chrono::Local> = t.into();
            dt.format("%Y-%m-%dT%H:%M:%S").to_string()
        });
        let size = meta.as_ref().map(|m| m.len());

        entries.push(DirEntry {
            name: entry.file_name().to_string_lossy().to_string(),
            path: entry.path().to_string_lossy().to_string(),
            is_dir: entry.file_type().is_dir(),
            modified,
            size,
        });
    }

    Ok(entries)
}

// ─────────────────────────────────────────────────────────────────────────────
// Parsed Markdown note commands
// ─────────────────────────────────────────────────────────────────────────────

/// Read a single .md file and return frontmatter + body separately
#[tauri::command]
pub fn read_note(path: String) -> Result<NoteFile, String> {
    let raw = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    parse_note(&path, &raw)
}

/// Write a note: accepts frontmatter as JSON + body string, serialises to file
#[tauri::command]
pub fn write_note(path: String, frontmatter: serde_json::Value, content: String) -> Result<(), String> {
    let fm_str = json_to_yaml(&frontmatter);
    let full = format!("---\n{fm_str}---\n\n{content}");

    if let Some(parent) = PathBuf::from(&path).parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(&path, full).map_err(|e| e.to_string())
}

/// List all .md files under a directory, returning parsed notes
#[tauri::command]
pub fn list_notes(dir: String, recursive: bool) -> Result<Vec<NoteFile>, String> {
    let root = PathBuf::from(&dir);
    if !root.exists() {
        return Ok(vec![]);
    }

    let mut notes = Vec::new();
    let max_depth = if recursive { 10 } else { 1 };

    for entry in WalkDir::new(&root)
        .min_depth(1)
        .max_depth(max_depth)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| {
            e.path().extension().map(|ext| ext == "md").unwrap_or(false)
        })
    {
        let path_str = entry.path().to_string_lossy().to_string();
        if let Ok(raw) = fs::read_to_string(entry.path()) {
            if let Ok(note) = parse_note(&path_str, &raw) {
                notes.push(note);
            }
        }
    }

    // Sort by modified desc
    notes.sort_by(|a, b| b.modified.cmp(&a.modified));
    Ok(notes)
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

fn parse_note(path: &str, raw: &str) -> Result<NoteFile, String> {
    let p = PathBuf::from(path);
    let filename = p
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();

    let meta = fs::metadata(path).ok();
    let modified = meta
        .and_then(|m| m.modified().ok())
        .map(|t| {
            let dt: chrono::DateTime<chrono::Local> = t.into();
            dt.format("%Y-%m-%dT%H:%M:%S").to_string()
        })
        .unwrap_or_default();

    // Parse frontmatter
    let (frontmatter, content) = extract_frontmatter(raw);

    Ok(NoteFile {
        path: path.to_string(),
        filename,
        frontmatter,
        content,
        modified,
    })
}

fn extract_frontmatter(raw: &str) -> (serde_json::Value, String) {
    if raw.starts_with("---") {
        let rest = &raw[3..];
        if let Some(end) = rest.find("\n---") {
            let yaml_str = &rest[..end];
            let body = rest[end + 4..].trim_start().to_string();
            // Simple YAML key:value parser (covers our needs without full yaml dep)
            let mut map = serde_json::Map::new();
            for line in yaml_str.lines() {
                if let Some(colon) = line.find(':') {
                    let key = line[..colon].trim().to_string();
                    let val = line[colon + 1..].trim().trim_matches('"').to_string();
                    if !key.is_empty() {
                        map.insert(key, serde_json::Value::String(val));
                    }
                }
            }
            return (serde_json::Value::Object(map), body);
        }
    }
    (serde_json::Value::Object(serde_json::Map::new()), raw.to_string())
}

fn json_to_yaml(val: &serde_json::Value) -> String {
    match val {
        serde_json::Value::Object(map) => map
            .iter()
            .map(|(k, v)| match v {
                serde_json::Value::String(s) => format!("{k}: \"{s}\"\n"),
                serde_json::Value::Null => format!("{k}: ~\n"),
                other => format!("{k}: {other}\n"),
            })
            .collect::<String>(),
        _ => String::new(),
    }
}

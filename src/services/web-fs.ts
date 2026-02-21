/**
 * Web File System Service
 * Uses File System Access API for browser-based file operations
 */

import type { NoteFile } from "@/types";

// Store the directory handle globally so we can reuse it
let directoryHandle: FileSystemDirectoryHandle | null = null;

// Store file handles for cached access
const fileHandles = new Map<string, FileSystemFileHandle>();

/**
 * Set the directory handle directly (used by web-fs-store for persistence)
 */
export const setDirectoryHandle = (handle: FileSystemDirectoryHandle | null): void => {
  directoryHandle = handle;
  if (!handle) {
    fileHandles.clear();
  }
};

/**
 * Get the current directory handle
 */
export const getDirectoryHandle = (): FileSystemDirectoryHandle | null => {
  return directoryHandle;
};

export const isFileSystemAccessSupported = (): boolean => {
  return "showDirectoryPicker" in window;
};

export const getVaultPath = (): string | null => {
  // In web mode, we return a virtual path based on the directory name
  return directoryHandle?.name ?? null;
};

export const pickVaultFolder = async (): Promise<string | null> => {
  if (!isFileSystemAccessSupported()) {
    throw new Error("您的浏览器不支持 File System Access API。请使用 Chrome、Edge 或其他基于 Chromium 的浏览器。");
  }

  try {
    directoryHandle = await (window as any).showDirectoryPicker({
      mode: "readwrite",
    });

    // Clear cached handles when picking a new folder
    fileHandles.clear();

    return directoryHandle.name;
  } catch (e: any) {
    if (e.name === "AbortError") {
      // User cancelled
      return null;
    }
    throw e;
  }
};

/**
 * Initialize vault structure in the selected directory
 */
export const initVault = async (_path: string): Promise<void> => {
  if (!directoryHandle) {
    throw new Error("请先选择一个目录");
  }

  // Create default vault structure
  const dirs = [
    "daily/tasks",
    "daily/habits",
    "diary/templates",
    "projects",
    "decisions",
    "planning/goals",
    "finance/records",
    "subscriptions",
    ".life-os",
  ];

  for (const dir of dirs) {
    await createDirAll(dir);
  }

  // Create template file if not exists
  const templateContent = `---
date: {{date}}
energy: high
mood: 😊
---

## 今日任务

- [ ]

## 今日笔记

`;

  try {
    const templatePath = "diary/templates/daily.md";
    const exists = await fileExists(templatePath);
    if (!exists) {
      await writeFile(templatePath, templateContent);
    }
  } catch {
    // Ignore template creation errors
  }
};

/**
 * Get a file handle, creating parent directories if needed
 */
async function getFileHandle(
  path: string,
  create = false
): Promise<FileSystemFileHandle> {
  if (!directoryHandle) {
    throw new Error("Vault 目录未选择");
  }

  // Check cache first
  const cached = fileHandles.get(path);
  if (cached) return cached;

  const parts = path.split("/").filter(Boolean);
  const fileName = parts.pop()!;
  let current = directoryHandle;

  // Navigate/create directories
  for (const part of parts) {
    current = await current.getDirectoryHandle(part, { create });
  }

  const handle = await current.getFileHandle(fileName, { create });
  fileHandles.set(path, handle);
  return handle;
}

/**
 * Get a directory handle, creating it if needed
 */
async function getDirHandle(
  path: string,
  create = false
): Promise<FileSystemDirectoryHandle> {
  if (!directoryHandle) {
    throw new Error("Vault 目录未选择");
  }

  if (!path) return directoryHandle;

  const parts = path.split("/").filter(Boolean);
  let current = directoryHandle;

  for (const part of parts) {
    current = await current.getDirectoryHandle(part, { create });
  }

  return current;
}

export const readFile = async (path: string): Promise<string> => {
  const handle = await getFileHandle(path);
  const file = await handle.getFile();
  return file.text();
};

export const writeFile = async (
  path: string,
  content: string
): Promise<void> => {
  const handle = await getFileHandle(path, true);
  const writable = await handle.createWritable();
  await writable.write(content);
  await writable.close();
};

export const deleteFile = async (path: string): Promise<void> => {
  if (!directoryHandle) {
    throw new Error("Vault 目录未选择");
  }

  const parts = path.split("/").filter(Boolean);
  const fileName = parts.pop()!;
  let current = directoryHandle;

  for (const part of parts) {
    current = await current.getDirectoryHandle(part);
  }

  await current.removeEntry(fileName);
  fileHandles.delete(path);
};

export const fileExists = async (path: string): Promise<boolean> => {
  try {
    await getFileHandle(path);
    return true;
  } catch {
    return false;
  }
};

export const createDirAll = async (path: string): Promise<void> => {
  await getDirHandle(path, true);
};

export const moveFile = async (
  src: string,
  dest: string
): Promise<void> => {
  const content = await readFile(src);
  await writeFile(dest, content);
  await deleteFile(src);
};

interface DirEntry {
  name: string;
  path: string;
  is_dir: boolean;
  modified?: string;
}

export const listDir = async (
  path: string,
  recursive = false
): Promise<DirEntry[]> => {
  const dir = await getDirHandle(path);
  const entries: DirEntry[] = [];

  // Use values() iterator which is widely supported
  for await (const handle of dir.values()) {
    const name = handle.name;
    const entry: DirEntry = {
      name,
      path: path ? `${path}/${name}` : name,
      is_dir: handle.kind === "directory",
    };

    if (handle.kind === "file") {
      const file = await (handle as FileSystemFileHandle).getFile();
      entry.modified = file.lastModified
        ? new Date(file.lastModified).toISOString()
        : undefined;
    }

    entries.push(entry);

    if (recursive && handle.kind === "directory") {
      const subEntries = await listDir(entry.path, true);
      entries.push(...subEntries);
    }
  }

  return entries;
};

// ─────────────────────────────────────────────────────────────────────────────
// Notes (Markdown + frontmatter)
// ─────────────────────────────────────────────────────────────────────────────

function parseFrontmatter(content: string): {
  frontmatter: Record<string, string>;
  body: string;
} {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) {
    return { frontmatter: {}, body: content };
  }

  const frontmatter: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx > 0) {
      const key = line.slice(0, colonIdx).trim();
      const value = line.slice(colonIdx + 1).trim();
      frontmatter[key] = value;
    }
  }

  return { frontmatter, body: match[2] };
}

export const readNote = async (path: string): Promise<NoteFile> => {
  const content = await readFile(path);
  const { frontmatter, body } = parseFrontmatter(content);
  const parts = path.split("/");
  const filename = parts.pop()!;

  const handle = await getFileHandle(path);
  const file = await handle.getFile();

  return {
    path,
    filename,
    frontmatter,
    content: body,
    modified: new Date(file.lastModified).toISOString(),
  };
};

export const writeNote = async (
  path: string,
  frontmatter: Record<string, unknown>,
  content: string
): Promise<void> => {
  const fmLines = Object.entries(frontmatter)
    .map(([k, v]) => {
      if (typeof v === "string" && v.includes("\n")) {
        return `${k}: |\n${v
          .split("\n")
          .map((l) => `  ${l}`)
          .join("\n")}`;
      }
      return `${k}: ${v}`;
    })
    .join("\n");

  const fullContent = `---\n${fmLines}\n---\n${content}`;
  await writeFile(path, fullContent);
};

export const listNotes = async (
  dir: string,
  recursive = false
): Promise<NoteFile[]> => {
  const entries = await listDir(dir, recursive);
  const notes: NoteFile[] = [];

  for (const entry of entries) {
    if (entry.is_dir || !entry.name.endsWith(".md")) continue;

    try {
      const note = await readNote(entry.path);
      notes.push(note);
    } catch {
      // Skip unreadable files
    }
  }

  return notes;
};

// ─────────────────────────────────────────────────────────────────────────────
// Config helpers
// ─────────────────────────────────────────────────────────────────────────────

export const loadMenuConfig = async (_vaultPath: string): Promise<string> => {
  try {
    return await readFile(".life-os/menu.yaml");
  } catch {
    return "[]";
  }
};

export const saveMenuConfig = async (
  _vaultPath: string,
  content: string
): Promise<void> => {
  await createDirAll(".life-os");
  await writeFile(".life-os/menu.yaml", content);
};

export const loadBoardConfig = async (_vaultPath: string): Promise<string> => {
  try {
    return await readFile(".life-os/board.yaml");
  } catch {
    return "[]";
  }
};

export const saveBoardConfig = async (
  _vaultPath: string,
  content: string
): Promise<void> => {
  await createDirAll(".life-os");
  await writeFile(".life-os/board.yaml", content);
};

export const loadAppSettings = async (_vaultPath: string): Promise<string> => {
  try {
    return await readFile(".life-os/settings.yaml");
  } catch {
    return "{}";
  }
};

export const saveAppSettings = async (
  _vaultPath: string,
  content: string
): Promise<void> => {
  await createDirAll(".life-os");
  await writeFile(".life-os/settings.yaml", content);
};

export const regenerateSkills = async (_vaultPath: string): Promise<void> => {
  // Web version: no-op (skills are Tauri-specific for now)
  console.log("Skills regeneration is not available in web mode");
};

// ─────────────────────────────────────────────────────────────────────────────
// Stub functions for Tauri-only features
// ─────────────────────────────────────────────────────────────────────────────

export const openInFinder = async (_path: string): Promise<void> => {
  console.log("openInFinder is not available in web mode");
};

export const runShellCommand = async (
  _command: string,
  _args: string[]
): Promise<string> => {
  throw new Error("Shell commands are not available in web mode");
};

export const runShortcut = async (_name: string): Promise<string> => {
  throw new Error("Shortcuts are not available in web mode");
};

export const scanGitRepos = async (
  _root: string,
  _maxDepth?: number
): Promise<any[]> => {
  throw new Error("Git scanning is not available in web mode");
};

export const getSkillPaths = async (): Promise<any[]> => {
  return [];
};

export const listSkillFiles = async (_paths: string[]): Promise<any[]> => {
  return [];
};

export const createLaunchdTask = async (_task: any): Promise<void> => {
  throw new Error("Scheduler is not available in web mode");
};

export const listLaunchdTasks = async (): Promise<any[]> => {
  return [];
};

export const deleteLaunchdTask = async (_id: string): Promise<void> => {
  throw new Error("Scheduler is not available in web mode");
};

// Apple Notes
export const getAppleNotes = async (): Promise<any> => {
  throw new Error("Apple Notes are not available in web mode");
};

export const createAppleNote = async (
  _folder: string,
  _title: string,
  _body: string
): Promise<string> => {
  throw new Error("Apple Notes are not available in web mode");
};

export const updateAppleNote = async (
  _noteId: string,
  _body: string
): Promise<void> => {
  throw new Error("Apple Notes are not available in web mode");
};

// Email
export const imapSync = async (): Promise<any[]> => {
  throw new Error("Email sync is not available in web mode");
};

export const getCachedEmails = async (): Promise<any[]> => {
  return [];
};

export const listEmailFolders = async (): Promise<string[]> => {
  return [];
};

export const sendEmail = async (_request: any): Promise<void> => {
  throw new Error("Email sending is not available in web mode");
};

// ─────────────────────────────────────────────────────────────────────────────
// Global Directory Handle Management
// ─────────────────────────────────────────────────────────────────────────────

export function setGlobalDirectoryHandle(handle: FileSystemDirectoryHandle) {
  directoryHandle = handle;
  fileHandles.clear();
}

export function getGlobalDirectoryHandle(): FileSystemDirectoryHandle | null {
  return directoryHandle;
}

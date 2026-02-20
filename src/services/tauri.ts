import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type { NoteFile, GitRepo, Skill, SkillPath, ScheduledTask } from "@/types";

// ─────────────────────────────────────────────────────────────────────────────
// Vault
// ─────────────────────────────────────────────────────────────────────────────

export const getVaultPath = (): Promise<string | null> =>
  invoke("get_vault_path");

export const setVaultPath = (path: string): Promise<void> =>
  invoke("set_vault_path", { path });

export const initVault = (path: string): Promise<void> =>
  invoke("init_vault", { path });

export const loadMenuConfig = (vaultPath: string): Promise<string> =>
  invoke("load_menu_config", { vaultPath });

export const saveMenuConfig = (vaultPath: string, content: string): Promise<void> =>
  invoke("save_menu_config", { vaultPath, content });

export const loadBoardConfig = (vaultPath: string): Promise<string> =>
  invoke("load_board_config", { vaultPath });

export const saveBoardConfig = (vaultPath: string, content: string): Promise<void> =>
  invoke("save_board_config", { vaultPath, content });

export const pickVaultFolder = async (): Promise<string | null> => {
  const selected = await open({ directory: true, multiple: false });
  return selected as string | null;
};

// ─────────────────────────────────────────────────────────────────────────────
// Generic FS
// ─────────────────────────────────────────────────────────────────────────────

export const readFile = (path: string): Promise<string> =>
  invoke("read_file", { path });

export const writeFile = (path: string, content: string): Promise<void> =>
  invoke("write_file", { path, content });

export const deleteFile = (path: string): Promise<void> =>
  invoke("delete_file", { path });

export const fileExists = (path: string): Promise<boolean> =>
  invoke("file_exists", { path });

export const createDirAll = (path: string): Promise<void> =>
  invoke("create_dir_all", { path });

export const moveFile = (src: string, dest: string): Promise<void> =>
  invoke("move_file", { src, dest });

export const listDir = (
  path: string,
  recursive = false
): Promise<{ name: string; path: string; is_dir: boolean; modified?: string }[]> =>
  invoke("list_dir", { path, recursive });

// ─────────────────────────────────────────────────────────────────────────────
// Notes (Markdown + frontmatter)
// ─────────────────────────────────────────────────────────────────────────────

export const readNote = (path: string): Promise<NoteFile> =>
  invoke("read_note", { path });

export const writeNote = (
  path: string,
  frontmatter: Record<string, unknown>,
  content: string
): Promise<void> => invoke("write_note", { path, frontmatter, content });

export const listNotes = (
  dir: string,
  recursive = false
): Promise<NoteFile[]> => invoke("list_notes", { dir, recursive });

// ─────────────────────────────────────────────────────────────────────────────
// Extra: System & Tools
// ─────────────────────────────────────────────────────────────────────────────

/** Open a path in macOS Finder */
export const openInFinder = (path: string): Promise<void> =>
  invoke("open_in_finder", { path });

/** Run a shell command and return stdout */
export const runShellCommand = (
  command: string,
  args: string[]
): Promise<string> =>
  invoke("run_shell_command", { command, args });

/** Run a macOS Shortcut and return JSON output */
export const runShortcut = (name: string): Promise<string> =>
  invoke("run_shortcut", { name });

// ─────────────────────────────────────────────────────────────────────────────
// Extra: Git Scanner
// ─────────────────────────────────────────────────────────────────────────────

export const scanGitRepos = (
  root: string,
  maxDepth = 5
): Promise<GitRepo[]> =>
  invoke("scan_git_repos", { root, maxDepth });

// ─────────────────────────────────────────────────────────────────────────────
// Extra: Skills Manager
// ─────────────────────────────────────────────────────────────────────────────

export const getSkillPaths = (): Promise<SkillPath[]> =>
  invoke("get_skill_paths");

export const listSkillFiles = (paths: string[]): Promise<Skill[]> =>
  invoke("list_skill_files", { paths });

// ─────────────────────────────────────────────────────────────────────────────
// Extra: Scheduler (macOS launchd)
// ─────────────────────────────────────────────────────────────────────────────

export const createLaunchdTask = (task: ScheduledTask): Promise<void> =>
  invoke("create_launchd_task", { task });

export const listLaunchdTasks = (): Promise<ScheduledTask[]> =>
  invoke("list_launchd_tasks");

export const deleteLaunchdTask = (id: string): Promise<void> =>
  invoke("delete_launchd_task", { id });

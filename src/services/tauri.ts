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

export const regenerateSkills = (vaultPath: string): Promise<void> =>
  invoke("regenerate_skills", { vaultPath });

export const loadAppSettings = (vaultPath: string): Promise<string> =>
  invoke("load_app_settings", { vaultPath });

export const saveAppSettings = (vaultPath: string, content: string): Promise<void> =>
  invoke("save_app_settings", { vaultPath, content });

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

// ─────────────────────────────────────────────────────────────────────────────
// Apple Notes (备忘录)
// ─────────────────────────────────────────────────────────────────────────────

export interface AppleNote {
  id: string;
  name: string;
  content: string;
  created: string | null;
  modified: string | null;
  folder: string;
}

export interface AppleNotesResult {
  notes: AppleNote[];
  total: number;
  has_more: boolean;
}

export const getAppleNotes = (
  query?: string,
  offset?: number,
  limit?: number
): Promise<AppleNotesResult> =>
  invoke("get_apple_notes", { query, offset, limit });

export const createAppleNote = (folder: string, title: string, body: string): Promise<string> =>
  invoke("create_apple_note", { folder, title, body });

export const updateAppleNote = (noteId: string, body: string): Promise<void> =>
  invoke("update_apple_note", { noteId, body });

// ─────────────────────────────────────────────────────────────────────────────
// Email / IMAP Sync
// ─────────────────────────────────────────────────────────────────────────────

export interface ImapAccount {
  email: string;
  password: string;
  imapHost: string;
  imapPort: number;
  protocol?: string;
  account_id?: string;
}

export interface EmailMessage {
  id: string;
  uid: number;
  from: string;
  to: string;
  subject: string;
  date: string;
  bodyText?: string;
  bodyHtml?: string;
  attachments: string[];
  flags: string[];
  folder: string;
}

export const imapSync = (
  account: ImapAccount,
  vaultPath: string,
  folder: string,
  maxEmails: number
): Promise<EmailMessage[]> =>
  invoke("imap_sync", {
    account: {
      email: account.email,
      password: account.password,
      imap_host: account.imapHost,
      imap_port: account.imapPort,
      protocol: account.protocol,
      account_id: account.account_id,
    },
    vaultPath,
    folder,
    maxEmails,
  });

export const getCachedEmails = (vaultPath: string, accountId: string, offset?: number, limit?: number): Promise<EmailMessage[]> =>
  invoke("get_cached_emails", { vaultPath, accountId, offset, limit });

export const getEmailContent = (vaultPath: string, accountId: string, emailId: string): Promise<EmailMessage> =>
  invoke("get_email_content", { vaultPath, accountId, emailId });

export const listEmailFolders = (vaultPath: string): Promise<string[]> =>
  invoke("list_email_folders", { vaultPath });

// ─────────────────────────────────────────────────────────────────────────────
// Email / SMTP Send
// ─────────────────────────────────────────────────────────────────────────────

export interface SendEmailRequest {
  smtp: {
    from_email: string;
    from_name: string;
    password: string;
    smtp_host: string;
    smtp_port: number;
  };
  to: string;
  subject: string;
  body: string;
  in_reply_to?: string;
}

export const sendEmail = (request: SendEmailRequest): Promise<void> =>
  invoke("send_email", { request });

export const deleteEmail = (
  vaultPath: string,
  accountId: string,
  emailId: string,
  imapHost?: string,
  imapPort?: number,
  imapPassword?: string,
  email?: string,
  folder?: string
): Promise<void> =>
  invoke("delete_email", {
    vaultPath,
    accountId,
    emailId,
    imapHost,
    imapPort,
    imapPassword,
    email,
    folder,
  });

export const markEmailRead = (
  vaultPath: string,
  accountId: string,
  emailId: string,
  read: boolean,
  folder?: string,
  imapHost?: string,
  imapPort?: number,
  imapPassword?: string,
  email?: string
): Promise<void> =>
  invoke("mark_email_read", {
    vaultPath,
    accountId,
    emailId,
    read,
    folder,
    imapHost,
    imapPort,
    imapPassword,
    email,
  });

export const openExternalUrl = (url: string): Promise<void> =>
  invoke("open_external_url", { url });

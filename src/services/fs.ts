/**
 * Unified File System Service
 * Automatically selects Tauri or Web implementation based on environment
 */

import { isTauri } from "./env";
import * as tauri from "./tauri";
import * as webFs from "./web-fs";

// Re-export types from @/types
export type { NoteFile, ScheduledTask } from "@/types";

// Re-export types from tauri
export type { ImapAccount, EmailMessage, SendEmailRequest } from "./tauri";

// Vault
export const getVaultPath = (): Promise<string | null> =>
  isTauri() ? tauri.getVaultPath() : Promise.resolve(webFs.getVaultPath());

export const setVaultPath = (path: string): Promise<void> =>
  isTauri() ? tauri.setVaultPath(path) : Promise.resolve();

export const initVault = (path: string): Promise<void> =>
  isTauri() ? tauri.initVault(path) : webFs.initVault(path);

export const pickVaultFolder = (): Promise<string | null> =>
  isTauri() ? tauri.pickVaultFolder() : webFs.pickVaultFolder();

// Config
export const loadMenuConfig = (vaultPath: string): Promise<string> =>
  isTauri() ? tauri.loadMenuConfig(vaultPath) : webFs.loadMenuConfig(vaultPath);

export const saveMenuConfig = (vaultPath: string, content: string): Promise<void> =>
  isTauri() ? tauri.saveMenuConfig(vaultPath, content) : webFs.saveMenuConfig(vaultPath, content);

export const loadBoardConfig = (vaultPath: string): Promise<string> =>
  isTauri() ? tauri.loadBoardConfig(vaultPath) : webFs.loadBoardConfig(vaultPath);

export const saveBoardConfig = (vaultPath: string, content: string): Promise<void> =>
  isTauri() ? tauri.saveBoardConfig(vaultPath, content) : webFs.saveBoardConfig(vaultPath, content);

export const regenerateSkills = (vaultPath: string): Promise<void> =>
  isTauri() ? tauri.regenerateSkills(vaultPath) : webFs.regenerateSkills(vaultPath);

export const loadAppSettings = (vaultPath: string): Promise<string> =>
  isTauri() ? tauri.loadAppSettings(vaultPath) : webFs.loadAppSettings(vaultPath);

export const saveAppSettings = (vaultPath: string, content: string): Promise<void> =>
  isTauri() ? tauri.saveAppSettings(vaultPath, content) : webFs.saveAppSettings(vaultPath, content);

// Generic FS
export const readFile = (path: string): Promise<string> =>
  isTauri() ? tauri.readFile(path) : webFs.readFile(path);

export const writeFile = (path: string, content: string): Promise<void> =>
  isTauri() ? tauri.writeFile(path, content) : webFs.writeFile(path, content);

export const deleteFile = (path: string): Promise<void> =>
  isTauri() ? tauri.deleteFile(path) : webFs.deleteFile(path);

export const fileExists = (path: string): Promise<boolean> =>
  isTauri() ? tauri.fileExists(path) : webFs.fileExists(path);

export const createDirAll = (path: string): Promise<void> =>
  isTauri() ? tauri.createDirAll(path) : webFs.createDirAll(path);

export const moveFile = (src: string, dest: string): Promise<void> =>
  isTauri() ? tauri.moveFile(src, dest) : webFs.moveFile(src, dest);

export const listDir = (
  path: string,
  recursive = false
): Promise<{ name: string; path: string; is_dir: boolean; modified?: string }[]> =>
  isTauri() ? tauri.listDir(path, recursive) : webFs.listDir(path, recursive);

// Notes
import type { NoteFile } from "@/types";

export const readNote = (path: string): Promise<NoteFile> =>
  isTauri() ? tauri.readNote(path) : webFs.readNote(path);

export const writeNote = (
  path: string,
  frontmatter: Record<string, unknown>,
  content: string
): Promise<void> =>
  isTauri()
    ? tauri.writeNote(path, frontmatter, content)
    : webFs.writeNote(path, frontmatter, content);

export const listNotes = (
  dir: string,
  recursive = false
): Promise<NoteFile[]> =>
  isTauri() ? tauri.listNotes(dir, recursive) : webFs.listNotes(dir, recursive);

// System (Tauri only)
export const openInFinder = (path: string): Promise<void> =>
  tauri.openInFinder(path);

export const runShellCommand = (command: string, args: string[]): Promise<string> =>
  tauri.runShellCommand(command, args);

export const runShortcut = (name: string): Promise<string> =>
  tauri.runShortcut(name);

// Git (Tauri only)
export const scanGitRepos = (root: string, maxDepth?: number) =>
  tauri.scanGitRepos(root, maxDepth);

// Skills (Tauri only)
export const getSkillPaths = () =>
  isTauri() ? tauri.getSkillPaths() : webFs.getSkillPaths();

export const listSkillFiles = (paths: string[]) =>
  isTauri() ? tauri.listSkillFiles(paths) : webFs.listSkillFiles(paths);

// Scheduler (Tauri only)
import type { ScheduledTask } from "@/types";

export const createLaunchdTask = (task: ScheduledTask) =>
  tauri.createLaunchdTask(task);

export const listLaunchdTasks = () =>
  tauri.listLaunchdTasks();

export const deleteLaunchdTask = (id: string) =>
  tauri.deleteLaunchdTask(id);

// Apple Notes (Tauri only)
export const getAppleNotes = (
  query?: string,
  offset?: number,
  limit?: number
) =>
  isTauri()
    ? tauri.getAppleNotes(query, offset, limit)
    : webFs.getAppleNotes(query, offset, limit);

export const createAppleNote = (folder: string, title: string, body: string) =>
  isTauri()
    ? tauri.createAppleNote(folder, title, body)
    : webFs.createAppleNote(folder, title, body);

export const updateAppleNote = (noteId: string, body: string) =>
  isTauri()
    ? tauri.updateAppleNote(noteId, body)
    : webFs.updateAppleNote(noteId, body);

// Re-export Apple Note types from tauri
export type { AppleNote, AppleNotesResult } from "./tauri";

// Email (Tauri only)
export const imapSync = (
  account: tauri.ImapAccount,
  vaultPath: string,
  folder: string,
  maxEmails: number,
  skip?: number
) => tauri.imapSync(account, vaultPath, folder, maxEmails, skip);

export const getCachedEmails = (vaultPath: string, accountId: string, offset?: number, limit?: number) =>
  tauri.getCachedEmails(vaultPath, accountId, offset, limit);

export const getEmailContent = (vaultPath: string, accountId: string, emailId: string) =>
  tauri.getEmailContent(vaultPath, accountId, emailId);

export const listEmailFolders = (vaultPath: string) =>
  tauri.listEmailFolders(vaultPath);

export const sendEmail = (request: tauri.SendEmailRequest) =>
  tauri.sendEmail(request);

export const deleteEmail = (
  vaultPath: string,
  accountId: string,
  emailId: string,
  imapHost?: string,
  imapPort?: number,
  imapPassword?: string,
  email?: string,
  folder?: string
) =>
  tauri.deleteEmail(vaultPath, accountId, emailId, imapHost, imapPort, imapPassword, email, folder);

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
) =>
  tauri.markEmailRead(vaultPath, accountId, emailId, read, folder, imapHost, imapPort, imapPassword, email);

export const openExternalUrl = (url: string): Promise<void> =>
  tauri.openExternalUrl(url);

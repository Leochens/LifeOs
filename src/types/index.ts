// ─────────────────────────────────────────────────────────────────────────────
// Core domain types
// ─────────────────────────────────────────────────────────────────────────────

export interface NoteFile {
  path: string;
  filename: string;
  frontmatter: Record<string, string>;
  content: string;
  modified: string;
}

// ── Daily / Tasks ──────────────────────────────────────────────────────────

export interface TaskItem {
  id: string;          // derived from line index
  text: string;
  done: boolean;
  tags: string[];      // #tag parsed from text
  time?: string;       // ⏰HH:MM
}

export interface DayNote {
  date: string;        // YYYY-MM-DD
  energy: "low" | "medium" | "high";
  mood: string;
  tasks: TaskItem[];
  notes: string;       // everything after ## 今日笔记
  path: string;
}

// ── Habits ─────────────────────────────────────────────────────────────────

export interface HabitDef {
  id: string;
  name: string;
  icon: string;
  target_days: number[]; // 1=Mon..7=Sun
  created: string;
}

export interface HabitStore {
  habits: HabitDef[];
  checkins: Record<string, string[]>; // date -> habit ids completed
}

// ── Projects ───────────────────────────────────────────────────────────────

export type ProjectStatus = "backlog" | "todo" | "active" | "paused" | "done";
export type Priority = "low" | "medium" | "high" | "urgent";

export interface Project {
  path: string;
  title: string;
  status: ProjectStatus;
  priority: Priority;
  created: string;
  updated: string;
  due?: string;
  tags: string[];
  progress: number;    // 0-100
  github?: string;
  content: string;
}

export interface KanbanColumn {
  id: string;
  name: string;
  color: string;
}

// ── Planning / Goals ───────────────────────────────────────────────────────

export type GoalType = "annual" | "quarterly" | "monthly";

export interface GoalMilestone {
  title: string;
  due: string;
  done: boolean;
}

export interface Goal {
  path: string;
  title: string;
  type: GoalType;
  year: number;
  quarter?: number;
  month?: number;
  progress: number;
  due: string;
  tags: string[];
  content: string;
  status?: "active" | "completed" | "archived";
  priority?: Priority;
  milestones?: GoalMilestone[];
}

// ── Diary ──────────────────────────────────────────────────────────────────

export interface DiaryEntry {
  path: string;
  date: string;
  title: string;
  mood: string;
  weather?: string;
  energy: string;
  tags: string[];
  content: string;
  modified: string;
}

// ── Decisions ──────────────────────────────────────────────────────────────

export type DecisionStatus = "pending" | "decided" | "archived";
export type DecisionWeight = "low" | "medium" | "high" | "critical";

export interface Decision {
  path: string;
  title: string;
  created: string;
  status: DecisionStatus;
  decided_on?: string;
  outcome?: string;
  review_date?: string;
  weight: DecisionWeight;
  content: string;
}

// ── Connectors ─────────────────────────────────────────────────────────────

export interface ConnectorConfig {
  name: string;
  id: string;
  icon: string;
  enabled: boolean;
  status: "connected" | "disconnected" | "error";
  lastSync?: string;
  meta?: Record<string, string>;
}

// ── Sticky Notes ───────────────────────────────────────────────────────────

export type StickyColor = "yellow" | "pink" | "blue" | "green" | "orange";

export interface StickyNote {
  id: string;
  x: number;           // canvas coordinate
  y: number;
  width: number;
  height: number;
  content: string;
  color: StickyColor;
  rotation: number;    // -5 to 5 degrees
  created: string;
}

// ── Skills ─────────────────────────────────────────────────────────────────

export interface Skill {
  name: string;
  title: string;
  description: string;
  path: string;
  ide: string;
  content: string;
  size: number;
}

export interface SkillPath {
  ide: string;
  path: string;
}

// ── Git Repos ──────────────────────────────────────────────────────────────

export interface GitRepo {
  path: string;
  name: string;
  branch: string;
  has_uncommitted: boolean;
  last_commit?: string;
  remote_url?: string;
}

// ── Scheduled Tasks ────────────────────────────────────────────────────────

export interface ScheduledTask {
  id: string;
  label: string;
  program: string;
  args: string[];
  interval_seconds: number;
  enabled: boolean;
}

// ── Server Management ───────────────────────────────────────────────────────

export interface ServerInfo {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authType: "password" | "key" | "both";
  password?: string;
  privateKeyPath?: string;
  publicKeyPath?: string;
  notes: string;
  tags: string[];
  created: string;
  updated: string;
}

// ── Life Data (Apple Health & Screen Time) ─────────────────────────────────

export interface LifeData {
  screenTime?: ScreenTimeData;
  healthData?: HealthData;
}

export interface ScreenTimeData {
  totalMinutes: number;
  byCategory: Record<string, number>;
  byApp: Record<string, number>;
  pickupCount: number;
  date: string;
}

export interface HealthData {
  steps: number;
  activeMinutes: number;
  calories: number;
  sleepHours: number;
  heartRate?: number;
  date: string;
}

// ── Theme ──────────────────────────────────────────────────────────────────

export type Theme = "dark" | "light";

// ── App state ──────────────────────────────────────────────────────────────

export type ViewId =
  | "dashboard"
  | "daily"
  | "kanban"
  | "planning"
  | "diary"
  | "decisions"
  | "connectors"
  | "stickynotes"
  | "skills"
  | "gitscanner"
  | "scheduler"
  | "life"
  | "chat"
  | "mail"
  | "servers"
  | "finance"
  | "subscriptions"
  | "settings"
  | "notes";

export interface AppConfig {
  vaultPath: string;
  theme: Theme;
  accentColor: string;
  // Claude Code settings
  claudeCodePath: string;
  claudeCodeEnabled: boolean;
  // User preferences
  defaultView: ViewId;
  showScreenTime: boolean;
  showHealthData: boolean;
}

export interface UserSettings {
  claudeCodePath: string;
  claudeCodeEnabled: boolean;
  defaultView: ViewId;
  showScreenTime: boolean;
  showHealthData: boolean;
  recentChats: ChatMessage[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  thinking?: string;
  timestamp: number;
}

// ── Plugin System ───────────────────────────────────────────────────────────────

export interface Plugin {
  id: string;
  name: string;
  icon: string;
  component: ViewId;
  enabled: boolean;
  builtin: boolean;
  description?: string;
}

export interface PluginGroup {
  id: string;
  name: string;
  icon?: string;
  order: number;
  collapsed: boolean;
  pluginIds: string[];
}

export interface MenuConfig {
  groups: PluginGroup[];
  plugins: Plugin[];
}

// ── Email ──────────────────────────────────────────────────────────────────────

export interface EmailAccount {
  id: string;
  name: string;
  email: string;
  imapHost: string;
  imapPort: number;
  protocol?: "imap" | "pop3"; // 协议类型
  username: string;
  password?: string; // 密码存储在 vault 中（简化实现）
  authType: "password" | "oauth2";
  // 密码只存储引用，实际密码从系统 keychain 获取
  passwordRef?: string;
  folders: string[];
  lastSync?: string;
  enabled: boolean;
}

export interface Email {
  id: string;
  accountId: string;
  folder: string;
  uid: number;
  subject: string;
  from: string;
  fromName: string;
  to: string;
  date: string;
  preview: string;
  bodyText?: string;
  bodyHtml?: string;
  isRead: boolean;
  isStarred: boolean;
  hasAttachments: boolean;
  attachments: EmailAttachment[];
}

export interface EmailAttachment {
  filename: string;
  mimeType: string;
  size: number;
  url?: string;
}

// ── Finance ──────────────────────────────────────────────────────────────────

export interface FinancePerson {
  id: string;
  name: string;
  role: string;         // e.g. "爸爸", "妈妈"
  created: string;
  updated: string;
  path: string;
}

export interface FinanceSubItem {
  id: string;
  name: string;
  amount: number;
}

export interface FinanceRecord {
  person: string;
  date: string;
  liquid: FinanceSubItem[];       // 流动资金（可多项）
  fixed: FinanceSubItem[];        // 固定资产（可多项）
  investment: FinanceSubItem[];   // 投资理财（可多项）
  receivable: FinanceSubItem[];   // 应收款（可多项）
  debt: FinanceSubItem[];         // 负债（可多项）
  path: string;
}

// ── Subscriptions ────────────────────────────────────────────────────────────

export type AppType = "mobile" | "desktop" | "saas";

export interface Subscription {
  id: string;
  name: string;
  amount: number;
  currency: string;
  cycle: "monthly" | "yearly" | "weekly";
  startDate: string;
  renewalDate: string;
  paymentMethod: string;
  appType: AppType;
  tags: string[];
  enabled: boolean;
  notes: string;
  path: string;
}

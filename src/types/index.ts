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
  id: ProjectStatus;
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
  | "settings";

export interface AppConfig {
  vaultPath: string;
  theme: Theme;
  accentColor: string;
}

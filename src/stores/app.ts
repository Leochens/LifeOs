import { create } from "zustand";
import type {
  ViewId,
  DayNote,
  Project,
  DiaryEntry,
  Decision,
  Goal,
  HabitStore,
  ConnectorConfig,
  StickyNote,
  Skill,
  GitRepo,
  ScheduledTask,
  Theme,
} from "@/types";

interface AppState {
  // Setup
  vaultPath: string | null;
  setVaultPath: (p: string) => void;

  // Navigation
  currentView: ViewId;
  setView: (v: ViewId) => void;

  // Theme
  theme: Theme;
  setTheme: (t: Theme) => void;

  // Daily
  todayNote: DayNote | null;
  setTodayNote: (n: DayNote | null) => void;
  habits: HabitStore | null;
  setHabits: (h: HabitStore) => void;

  // Projects
  projects: Project[];
  setProjects: (p: Project[]) => void;
  upsertProject: (p: Project) => void;

  // Planning
  goals: Goal[];
  setGoals: (g: Goal[]) => void;

  // Diary
  diaryEntries: DiaryEntry[];
  setDiaryEntries: (e: DiaryEntry[]) => void;
  activeDiary: DiaryEntry | null;
  setActiveDiary: (e: DiaryEntry | null) => void;

  // Decisions
  decisions: Decision[];
  setDecisions: (d: Decision[]) => void;

  // Connectors
  connectors: ConnectorConfig[];
  setConnectors: (c: ConnectorConfig[]) => void;

  // Sticky Notes
  stickyNotes: StickyNote[];
  setStickyNotes: (notes: StickyNote[]) => void;
  upsertStickyNote: (note: StickyNote) => void;
  deleteStickyNote: (id: string) => void;

  // Skills
  skills: Skill[];
  setSkills: (s: Skill[]) => void;

  // Git Repos
  gitRepos: GitRepo[];
  setGitRepos: (r: GitRepo[]) => void;

  // Scheduled Tasks
  scheduledTasks: ScheduledTask[];
  setScheduledTasks: (t: ScheduledTask[]) => void;

  // Claude Code settings
  claudeCodeEnabled: boolean;
  setClaudeCodeEnabled: (e: boolean) => void;
  claudeCodePath: string;
  setClaudeCodePath: (p: string) => void;

  // UI
  isLoading: boolean;
  setLoading: (v: boolean) => void;
  cmdPaletteOpen: boolean;
  setCmdPalette: (v: boolean) => void;
}

export const useStore = create<AppState>((set) => ({
  vaultPath: null,
  setVaultPath: (vaultPath) => set({ vaultPath }),

  currentView: "dashboard",
  setView: (currentView) => set({ currentView }),

  theme: "dark",
  setTheme: (theme) => {
    document.documentElement.setAttribute("data-theme", theme);
    set({ theme });
  },

  todayNote: null,
  setTodayNote: (todayNote) => set({ todayNote }),
  habits: null,
  setHabits: (habits) => set({ habits }),

  projects: [],
  setProjects: (projects) => set({ projects }),
  upsertProject: (p) =>
    set((s) => ({
      projects: s.projects.some((x) => x.path === p.path)
        ? s.projects.map((x) => (x.path === p.path ? p : x))
        : [...s.projects, p],
    })),

  goals: [],
  setGoals: (goals) => set({ goals }),

  diaryEntries: [],
  setDiaryEntries: (diaryEntries) => set({ diaryEntries }),
  activeDiary: null,
  setActiveDiary: (activeDiary) => set({ activeDiary }),

  decisions: [],
  setDecisions: (decisions) => set({ decisions }),

  connectors: [],
  setConnectors: (connectors) => set({ connectors }),

  stickyNotes: [],
  setStickyNotes: (stickyNotes) => set({ stickyNotes }),
  upsertStickyNote: (note) =>
    set((s) => ({
      stickyNotes: s.stickyNotes.some((n) => n.id === note.id)
        ? s.stickyNotes.map((n) => (n.id === note.id ? note : n))
        : [...s.stickyNotes, note],
    })),
  deleteStickyNote: (id) =>
    set((s) => ({ stickyNotes: s.stickyNotes.filter((n) => n.id !== id) })),

  skills: [],
  setSkills: (skills) => set({ skills }),

  gitRepos: [],
  setGitRepos: (gitRepos) => set({ gitRepos }),

  scheduledTasks: [],
  setScheduledTasks: (scheduledTasks) => set({ scheduledTasks }),

  claudeCodeEnabled: true,
  setClaudeCodeEnabled: (claudeCodeEnabled) => set({ claudeCodeEnabled }),
  claudeCodePath: "claude",
  setClaudeCodePath: (claudeCodePath) => set({ claudeCodePath }),

  isLoading: false,
  setLoading: (isLoading) => set({ isLoading }),
  cmdPaletteOpen: false,
  setCmdPalette: (cmdPaletteOpen) => set({ cmdPaletteOpen }),
}));

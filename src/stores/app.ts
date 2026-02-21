import { create } from "zustand";
import { saveMenuConfig, loadMenuConfig, saveAppSettings, loadAppSettings } from "@/services/fs";
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
  MenuConfig,
  EmailAccount,
  Email,
  FinancePerson,
  FinanceRecord,
  Subscription,
} from "@/types";

// Parse YAML string to MenuConfig
function parseMenuConfigYaml(yaml: string): MenuConfig | null {
  try {
    const groups: MenuConfig["groups"] = [];
    const plugins: MenuConfig["plugins"] = [];

    let currentSection: "groups" | "plugins" | null = null;
    let currentGroup: Partial<MenuConfig["groups"][0]> = {};
    let currentPlugin: Partial<MenuConfig["plugins"][0]> = {};
    let inPluginIds = false;

    const lines = yaml.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Skip comments and empty lines
      if (!trimmed || trimmed.startsWith("#")) continue;

      // Detect section
      if (trimmed === "groups:") {
        currentSection = "groups";
        continue;
      }
      if (trimmed === "plugins:") {
        currentSection = "plugins";
        continue;
      }

      // Parse groups
      if (currentSection === "groups") {
        if (trimmed.startsWith("- id:")) {
          if (currentGroup.id) {
            groups.push(currentGroup as MenuConfig["groups"][0]);
          }
          currentGroup = { pluginIds: [] };
          currentGroup.id = trimmed.replace("- id:", "").trim();
        } else if (trimmed.startsWith("name:")) {
          currentGroup.name = trimmed.replace("name:", "").trim();
        } else if (trimmed.startsWith("order:")) {
          currentGroup.order = parseInt(trimmed.replace("order:", "").trim());
        } else if (trimmed.startsWith("collapsed:")) {
          currentGroup.collapsed = trimmed.replace("collapsed:", "").trim() === "true";
        } else if (trimmed === "pluginIds:") {
          inPluginIds = true;
        } else if (inPluginIds && trimmed.startsWith("- ")) {
          currentGroup.pluginIds = currentGroup.pluginIds || [];
          currentGroup.pluginIds.push(trimmed.replace("- ", "").trim());
        } else if (!trimmed.startsWith("-") && !trimmed.includes(":")) {
          inPluginIds = false;
        }
      }

      // Parse plugins
      if (currentSection === "plugins") {
        if (trimmed.startsWith("- id:")) {
          if (currentPlugin.id) {
            plugins.push(currentPlugin as MenuConfig["plugins"][0]);
          }
          currentPlugin = {};
          currentPlugin.id = trimmed.replace("- id:", "").trim();
        } else if (trimmed.startsWith("name:")) {
          currentPlugin.name = trimmed.replace("name:", "").trim();
        } else if (trimmed.startsWith("icon:")) {
          currentPlugin.icon = trimmed.replace("icon:", "").trim();
        } else if (trimmed.startsWith("component:")) {
          currentPlugin.component = trimmed.replace("component:", "").trim() as MenuConfig["plugins"][0]["component"];
        } else if (trimmed.startsWith("enabled:")) {
          currentPlugin.enabled = trimmed.replace("enabled:", "").trim() === "true";
        } else if (trimmed.startsWith("builtin:")) {
          currentPlugin.builtin = trimmed.replace("builtin:", "").trim() === "true";
        }
      }
    }

    // Push last items
    if (currentGroup.id) {
      groups.push(currentGroup as MenuConfig["groups"][0]);
    }
    if (currentPlugin.id) {
      plugins.push(currentPlugin as MenuConfig["plugins"][0]);
    }

    return { groups, plugins };
  } catch (e) {
    console.error("Failed to parse menu config:", e);
    return null;
  }
}

// Convert MenuConfig to YAML string
function menuConfigToYaml(config: MenuConfig): string {
  let yaml = "# LifeOS 菜单配置\n# 用户可以自定义修改此文件来调整侧边栏菜单\n\n";

  // Groups
  yaml += "groups:\n";
  for (const group of config.groups) {
    yaml += `  - id: ${group.id}\n`;
    yaml += `    name: ${group.name}\n`;
    yaml += `    order: ${group.order}\n`;
    yaml += `    collapsed: ${group.collapsed}\n`;
    yaml += `    pluginIds:\n`;
    for (const pluginId of group.pluginIds) {
      yaml += `      - ${pluginId}\n`;
    }
  }

  // Plugins
  yaml += "\nplugins:\n";
  for (const plugin of config.plugins) {
    yaml += `  - id: ${plugin.id}\n`;
    yaml += `    name: ${plugin.name}\n`;
    yaml += `    icon: ${plugin.icon}\n`;
    yaml += `    component: ${plugin.component}\n`;
    yaml += `    enabled: ${plugin.enabled}\n`;
    yaml += `    builtin: ${plugin.builtin}\n`;
  }

  return yaml;
}

// Settings YAML helpers
function settingsToYaml(theme: string, claudeCodeEnabled: boolean, claudeCodePath: string): string {
  return `theme: ${theme}\nclaudeCodeEnabled: ${claudeCodeEnabled}\nclaudeCodePath: ${claudeCodePath}\n`;
}

function parseSettingsYaml(yaml: string): { theme?: string; claudeCodeEnabled?: boolean; claudeCodePath?: string } {
  const result: any = {};
  for (const line of yaml.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("theme:")) result.theme = trimmed.replace("theme:", "").trim();
    if (trimmed.startsWith("claudeCodeEnabled:")) result.claudeCodeEnabled = trimmed.replace("claudeCodeEnabled:", "").trim() === "true";
    if (trimmed.startsWith("claudeCodePath:")) result.claudeCodePath = trimmed.replace("claudeCodePath:", "").trim();
  }
  return result;
}

// Default menu configuration
const DEFAULT_MENU_CONFIG: MenuConfig = {
  groups: [
    {
      id: "work",
      name: "工作",
      order: 0,
      collapsed: false,
      pluginIds: ["dashboard", "daily", "kanban", "planning"],
    },
    {
      id: "journal",
      name: "记录",
      order: 1,
      collapsed: false,
      pluginIds: ["diary", "decisions", "stickynotes"],
    },
    {
      id: "life",
      name: "生活",
      order: 2,
      collapsed: false,
      pluginIds: ["life", "chat", "mail", "finance", "subscriptions", "notes"],
    },
    {
      id: "tools",
      name: "工具",
      order: 3,
      collapsed: false,
      pluginIds: ["servers", "connectors", "skills", "gitscanner", "scheduler"],
    },
    // Note: "settings" is built into the sidebar footer, not in a group
  ],
  plugins: [
    // 必选插件 - 不可关闭
    { id: "dashboard", name: "总览", icon: "LayoutDashboard", component: "dashboard", enabled: true, builtin: true },
    // 可选插件 - 默认开启，用户可关闭
    { id: "daily", name: "日常", icon: "ListTodo", component: "daily", enabled: true, builtin: false },
    { id: "kanban", name: "项目", icon: "Kanban", component: "kanban", enabled: true, builtin: false },
    { id: "planning", name: "计划", icon: "Target", component: "planning", enabled: true, builtin: false },
    { id: "diary", name: "日记", icon: "BookOpen", component: "diary", enabled: true, builtin: false },
    { id: "decisions", name: "决策", icon: "Scale", component: "decisions", enabled: true, builtin: false },
    { id: "stickynotes", name: "便利贴", icon: "StickyNote", component: "stickynotes", enabled: true, builtin: false },
    { id: "life", name: "生活数据", icon: "Heart", component: "life", enabled: true, builtin: false },
    { id: "chat", name: "AI 聊天", icon: "MessageCircle", component: "chat", enabled: true, builtin: false },
    { id: "mail", name: "邮箱", icon: "Mail", component: "mail", enabled: true, builtin: false },
    { id: "servers", name: "服务器", icon: "Server", component: "servers", enabled: true, builtin: false },
    { id: "connectors", name: "连接", icon: "Plug", component: "connectors", enabled: true, builtin: false },
    { id: "skills", name: "Skills", icon: "Wrench", component: "skills", enabled: true, builtin: false },
    { id: "gitscanner", name: "Git 仓库", icon: "GitBranch", component: "gitscanner", enabled: true, builtin: false },
    { id: "scheduler", name: "定时任务", icon: "Clock", component: "scheduler", enabled: true, builtin: false },
    { id: "finance", name: "财务", icon: "Wallet", component: "finance", enabled: true, builtin: false },
    { id: "subscriptions", name: "订阅", icon: "CreditCard", component: "subscriptions", enabled: true, builtin: false },
    { id: "notes", name: "备忘录", icon: "FileText", component: "notes", enabled: true, builtin: false },
    // 设置 - 必选
    { id: "settings", name: "设置", icon: "Settings", component: "settings", enabled: true, builtin: true },
  ],
};

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

  // Menu / Plugin System
  menuConfig: MenuConfig;
  setMenuConfig: (config: MenuConfig) => void;
  updatePlugin: (pluginId: string, updates: Partial<{ enabled: boolean; name: string; icon: string }>) => void;
  updateGroup: (groupId: string, updates: Partial<{ name: string; collapsed: boolean; pluginIds: string[] }>) => void;
  saveMenuConfigToVault: () => Promise<void>;
  loadMenuConfigFromVault: () => Promise<void>;
  loadAppSettingsFromVault: () => Promise<void>;

  // Email
  emailAccounts: EmailAccount[];
  setEmailAccounts: (accounts: EmailAccount[]) => void;
  emails: Email[];
  setEmails: (emails: Email[]) => void;

  // Finance
  financePersons: FinancePerson[];
  setFinancePersons: (persons: FinancePerson[]) => void;
  financeRecords: FinanceRecord[];
  setFinanceRecords: (records: FinanceRecord[]) => void;

  // Subscriptions
  subscriptions: Subscription[];
  setSubscriptions: (subs: Subscription[]) => void;

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
    // Auto-save settings
    const state = useStore.getState();
    if (state.vaultPath) {
      const yaml = settingsToYaml(theme, state.claudeCodeEnabled, state.claudeCodePath);
      saveAppSettings(state.vaultPath, yaml).catch(console.error);
    }
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
  setClaudeCodeEnabled: (claudeCodeEnabled) => {
    set({ claudeCodeEnabled });
    // Auto-save settings
    const state = useStore.getState();
    if (state.vaultPath) {
      const yaml = settingsToYaml(state.theme, claudeCodeEnabled, state.claudeCodePath);
      saveAppSettings(state.vaultPath, yaml).catch(console.error);
    }
  },
  claudeCodePath: "claude",
  setClaudeCodePath: (claudeCodePath) => {
    set({ claudeCodePath });
    // Auto-save settings
    const state = useStore.getState();
    if (state.vaultPath) {
      const yaml = settingsToYaml(state.theme, state.claudeCodeEnabled, claudeCodePath);
      saveAppSettings(state.vaultPath, yaml).catch(console.error);
    }
  },

  // Menu / Plugin System
  menuConfig: DEFAULT_MENU_CONFIG,
  setMenuConfig: (menuConfig) => set({ menuConfig }),
  updatePlugin: async (pluginId, updates) => {
    set((s) => ({
      menuConfig: {
        ...s.menuConfig,
        plugins: s.menuConfig.plugins.map((p) =>
          p.id === pluginId ? { ...p, ...updates } : p
        ),
      },
    }));
    // Auto-save to vault
    useStore.getState().saveMenuConfigToVault();
  },
  updateGroup: async (groupId, updates) => {
    set((s) => ({
      menuConfig: {
        ...s.menuConfig,
        groups: s.menuConfig.groups.map((g) =>
          g.id === groupId ? { ...g, ...updates } : g
        ),
      },
    }));
    // Auto-save to vault
    useStore.getState().saveMenuConfigToVault();
  },
  saveMenuConfigToVault: async () => {
    const state = useStore.getState();
    if (!state.vaultPath) return;

    // Convert menu config to YAML
    const yaml = menuConfigToYaml(state.menuConfig);
    try {
      await saveMenuConfig(state.vaultPath, yaml);
    } catch (e) {
      console.error("Failed to save menu config:", e);
    }
  },
  loadMenuConfigFromVault: async () => {
    const state = useStore.getState();
    if (!state.vaultPath) return;

    try {
      const yaml = await loadMenuConfig(state.vaultPath);
      const parsed = parseMenuConfigYaml(yaml);
      if (parsed) {
        // Merge new plugins from DEFAULT_MENU_CONFIG if not present
        const defaultConfig = DEFAULT_MENU_CONFIG;
        const mergedPlugins = [...parsed.plugins];

        for (const defaultPlugin of defaultConfig.plugins) {
          if (!parsed.plugins.find(p => p.id === defaultPlugin.id)) {
            // Add new plugin with enabled: true
            mergedPlugins.push({ ...defaultPlugin, enabled: true });
          }
        }

        // Merge new groups from DEFAULT_MENU_CONFIG and ensure all plugins are in some group
        const mergedGroups = [...parsed.groups];

        for (const defaultGroup of defaultConfig.groups) {
          const existingGroup = parsed.groups.find(g => g.id === defaultGroup.id);
          if (!existingGroup) {
            // Add new group
            mergedGroups.push({ ...defaultGroup });
          } else {
            // Ensure plugins from default group are in existing group
            const groupIdx = mergedGroups.findIndex(g => g.id === defaultGroup.id);
            for (const pluginId of defaultGroup.pluginIds) {
              if (!mergedGroups[groupIdx].pluginIds.includes(pluginId)) {
                mergedGroups[groupIdx].pluginIds.push(pluginId);
              }
            }
          }
        }

        set({ menuConfig: { plugins: mergedPlugins, groups: mergedGroups } });
      }
    } catch (e) {
      // If loading fails, use default config
      console.log("Using default menu config");
    }
  },

  loadAppSettingsFromVault: async () => {
    const state = useStore.getState();
    if (!state.vaultPath) return;
    try {
      const yaml = await loadAppSettings(state.vaultPath);
      if (!yaml) return;
      const settings = parseSettingsYaml(yaml);
      if (settings.theme) {
        document.documentElement.setAttribute("data-theme", settings.theme);
        set({ theme: settings.theme as Theme });
      }
      if (settings.claudeCodeEnabled !== undefined) set({ claudeCodeEnabled: settings.claudeCodeEnabled });
      if (settings.claudeCodePath) set({ claudeCodePath: settings.claudeCodePath });
    } catch (e) {
      console.log("No settings file found, using defaults");
    }
  },

  // Email
  emailAccounts: [],
  setEmailAccounts: (emailAccounts) => set({ emailAccounts }),
  emails: [],
  setEmails: (emails) => set({ emails }),

  // Finance
  financePersons: [],
  setFinancePersons: (financePersons) => set({ financePersons }),
  financeRecords: [],
  setFinanceRecords: (financeRecords) => set({ financeRecords }),

  // Subscriptions
  subscriptions: [],
  setSubscriptions: (subscriptions) => set({ subscriptions }),

  isLoading: false,
  setLoading: (isLoading) => set({ isLoading }),
  cmdPaletteOpen: false,
  setCmdPalette: (cmdPaletteOpen) => set({ cmdPaletteOpen }),
}));

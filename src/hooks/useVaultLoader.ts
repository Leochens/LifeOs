import { useCallback } from "react";
import { useStore } from "@/stores/app";
import * as tauri from "@/services/tauri";
import * as parser from "@/services/parser";
import { format } from "date-fns";
import type { HabitStore, DayNote, Project, DiaryEntry, Decision, Goal } from "@/types";

export function useVaultLoader() {
  const { vaultPath, setTodayNote, setProjects, setDiaryEntries, setDecisions, setGoals, setHabits, setLoading } =
    useStore();

  const loadAll = useCallback(async () => {
    if (!vaultPath) return;
    setLoading(true);
    try {
      await Promise.all([
        loadToday(vaultPath, setTodayNote),
        loadProjects(vaultPath, setProjects),
        loadDiary(vaultPath, setDiaryEntries),
        loadDecisions(vaultPath, setDecisions),
        loadGoals(vaultPath, setGoals),
        loadHabits(vaultPath, setHabits),
      ]);
    } finally {
      setLoading(false);
    }
  }, [vaultPath]);

  return { loadAll };
}

async function loadToday(
  vault: string,
  setTodayNote: (n: DayNote | null) => void
) {
  const today = format(new Date(), "yyyy-MM-dd");
  const path = `${vault}/daily/tasks/${today}.md`;

  const exists = await tauri.fileExists(path);
  if (!exists) {
    // Create today's file from template
    const templatePath = `${vault}/diary/templates/daily.md`;
    const templateExists = await tauri.fileExists(templatePath);
    const content = templateExists
      ? (await tauri.readFile(templatePath)).replace("{{date}}", today).replace("{{content}}", "")
      : `---\ndate: ${today}\nenergy: high\nmood: 😊\n---\n\n## 今日任务\n\n- [ ] \n\n## 今日笔记\n\n`;
    await tauri.writeFile(path, content);
  }

  const note = await tauri.readNote(path);
  const day = parser.parseDayNote(path, note.frontmatter, note.content);
  setTodayNote(day);
}

async function loadProjects(
  vault: string,
  setProjects: (p: Project[]) => void
) {
  const notes = await tauri.listNotes(`${vault}/projects`, true);
  const projects = notes
    .filter((n) => !n.filename.startsWith("_"))
    .map((n) => parser.parseProject(n.path, n.frontmatter, n.content));
  setProjects(projects);
}

async function loadDiary(
  vault: string,
  setDiaryEntries: (e: DiaryEntry[]) => void
) {
  const notes = await tauri.listNotes(`${vault}/diary`, true);
  const entries = notes
    .filter((n) => n.filename.match(/^\d{4}-\d{2}-\d{2}(-\d{4})?\.md$/))
    .map((n) =>
      parser.parseDiaryEntry(n.path, n.frontmatter, n.content, n.modified)
    );
  setDiaryEntries(entries);
}

async function loadDecisions(
  vault: string,
  setDecisions: (d: Decision[]) => void
) {
  const notes = await tauri.listNotes(`${vault}/decisions`, false);
  const decisions = notes.map((n) =>
    parser.parseDecision(n.path, n.frontmatter, n.content)
  );
  setDecisions(decisions);
}

async function loadGoals(
  vault: string,
  setGoals: (g: Goal[]) => void
) {
  const notes = await tauri.listNotes(`${vault}/planning/goals`, false);
  const goals: Goal[] = notes.map((n) => ({
    path: n.path,
    title: n.frontmatter.title ?? n.filename.replace(".md", ""),
    type: (n.frontmatter.type as "annual" | "quarterly" | "monthly") ?? "annual",
    year: parseInt(n.frontmatter.year ?? "2025"),
    quarter: n.frontmatter.quarter ? parseInt(n.frontmatter.quarter) : undefined,
    month: n.frontmatter.month ? parseInt(n.frontmatter.month) : undefined,
    progress: parseInt(n.frontmatter.progress ?? "0"),
    due: n.frontmatter.due ?? "",
    tags: n.frontmatter.tags ? n.frontmatter.tags.split(",").map((t: string) => t.trim()) : [],
    content: n.content,
    status: (n.frontmatter.status as Goal["status"]) ?? "active",
    priority: (n.frontmatter.priority as Goal["priority"]) ?? "medium",
  }));
  setGoals(goals);
}

async function loadHabits(
  vault: string,
  setHabits: (h: HabitStore) => void
) {
  try {
    const raw = await tauri.readFile(`${vault}/daily/habits/habits.yaml`);
    const habits = parseHabitsYaml(raw);
    setHabits(habits);
  } catch {
    setHabits({ habits: [], checkins: {} });
  }
}

function parseHabitsYaml(raw: string): HabitStore {
  const habitBlocks: HabitStore["habits"] = [];
  const checkins: Record<string, string[]> = {};

  let inHabit = false;
  let currentHabit: Partial<HabitStore["habits"][0]> = {};

  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("- id:")) {
      if (currentHabit.id) habitBlocks.push(currentHabit as HabitStore["habits"][0]);
      currentHabit = { id: trimmed.replace("- id:", "").trim(), target_days: [1,2,3,4,5,6,7] };
      inHabit = true;
    } else if (inHabit && trimmed.startsWith("name:")) {
      currentHabit.name = trimmed.replace("name:", "").trim().replace(/"/g, "");
    } else if (inHabit && trimmed.startsWith("icon:")) {
      currentHabit.icon = trimmed.replace("icon:", "").trim().replace(/"/g, "");
    } else if (trimmed.startsWith("checkins:")) {
      if (currentHabit.id) { habitBlocks.push(currentHabit as HabitStore["habits"][0]); currentHabit = {}; }
      inHabit = false;
    } else if (!inHabit && trimmed.match(/^\d{4}-\d{2}-\d{2}:/)) {
      const colonIdx = trimmed.indexOf(":");
      const date = trimmed.slice(0, colonIdx);
      const rest = trimmed.slice(colonIdx + 1);
      checkins[date] = rest.trim().replace(/[\[\]]/g, "").split(",").map((s) => s.trim()).filter(Boolean);
    }
  }
  if (currentHabit.id) habitBlocks.push(currentHabit as HabitStore["habits"][0]);

  return { habits: habitBlocks, checkins };
}

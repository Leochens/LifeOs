import type { TaskItem, DayNote, DiaryEntry, Project, Decision } from "@/types";
import { format } from "date-fns";

// ─────────────────────────────────────────────────────────────────────────────
// Task parsing from Markdown checkbox lines
// ─────────────────────────────────────────────────────────────────────────────

export function parseTasks(content: string): TaskItem[] {
  const lines = content.split("\n");
  const tasks: TaskItem[] = [];

  lines.forEach((line, i) => {
    const match = line.match(/^-\s*\[([ xX])\]\s+(.+)$/);
    if (!match) return;

    const done = match[1] !== " ";
    let text = match[2];

    const tags = [...text.matchAll(/#(\w+)/g)].map((m) => m[1]);
    const timeMatch = text.match(/⏰(\d{2}:\d{2})/);
    const time = timeMatch ? timeMatch[1] : undefined;

    // Strip tags and time markers from display text
    text = text.replace(/#\w+/g, "").replace(/⏰\d{2}:\d{2}/, "").trim();

    tasks.push({ id: `task-${i}`, text, done, tags, time });
  });

  return tasks;
}

export function serializeTasks(tasks: TaskItem[], existingContent: string): string {
  const lines = existingContent.split("\n");
  let taskIndex = 0;

  return lines
    .map((line) => {
      if (/^-\s*\[([ xX])\]/.test(line)) {
        const task = tasks[taskIndex++];
        if (!task) return line;
        const check = task.done ? "x" : " ";
        const tagStr = task.tags.map((t) => `#${t}`).join(" ");
        const timeStr = task.time ? ` ⏰${task.time}` : "";
        return `- [${check}] ${task.text}${tagStr ? " " + tagStr : ""}${timeStr}`;
      }
      return line;
    })
    .join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// DayNote (daily task file)
// ─────────────────────────────────────────────────────────────────────────────

export function parseDayNote(
  path: string,
  frontmatter: Record<string, string>,
  content: string
): DayNote {
  // Split at ## 今日笔记 section
  const sections = content.split(/^##\s+今日(任务|笔记)/m);
  const taskSection = sections[0] ?? content;
  const noteSection = sections.slice(-1)[0]?.trim() ?? "";

  return {
    date: frontmatter.date ?? path.replace(/.*\/(\d{4}-\d{2}-\d{2})\.md$/, "$1"),
    energy: (frontmatter.energy as DayNote["energy"]) ?? "high",
    mood: frontmatter.mood ?? "😊",
    tasks: parseTasks(taskSection),
    notes: noteSection,
    path,
  };
}

export function serializeDayNote(note: DayNote): { frontmatter: Record<string, string>; content: string } {
  const fm: Record<string, string> = {
    date: note.date,
    energy: note.energy,
    mood: note.mood,
  };

  const taskLines = note.tasks
    .map((t) => {
      const check = t.done ? "x" : " ";
      const tags = t.tags.map((tag) => `#${tag}`).join(" ");
      const time = t.time ? ` ⏰${t.time}` : "";
      return `- [${check}] ${t.text}${tags ? " " + tags : ""}${time}`;
    })
    .join("\n");

  const content = `## 今日任务\n\n${taskLines}\n\n## 今日笔记\n\n${note.notes}`;
  return { frontmatter: fm, content };
}

// ─────────────────────────────────────────────────────────────────────────────
// Project
// ─────────────────────────────────────────────────────────────────────────────

export function parseProject(
  path: string,
  fm: Record<string, string>,
  content: string
): Project {
  return {
    path,
    title: fm.title ?? path.split("/").pop()?.replace(".md", "") ?? "Untitled",
    status: (fm.status as Project["status"]) ?? "backlog",
    priority: (fm.priority as Project["priority"]) ?? "medium",
    created: fm.created ?? "",
    updated: fm.updated ?? "",
    due: fm.due,
    tags: fm.tags ? fm.tags.split(",").map((t) => t.trim()) : [],
    progress: parseInt(fm.progress ?? "0"),
    github: fm.github,
    content,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Diary
// ─────────────────────────────────────────────────────────────────────────────

export function parseDiaryEntry(
  path: string,
  fm: Record<string, string>,
  content: string,
  modified: string
): DiaryEntry {
  const dateFromPath = path.match(/(\d{4}-\d{2}-\d{2})/)?.[1] ?? "";
  // Prefer frontmatter title, fallback to content heading, then date
  const title = fm.title?.trim() || extractTitle(content) || dateFromPath;
  return {
    path,
    date: fm.date ?? dateFromPath,
    title,
    mood: fm.mood ?? "😊",
    weather: fm.weather,
    energy: fm.energy ?? "medium",
    tags: fm.tags ? fm.tags.split(",").map((t) => t.trim()) : [],
    content,
    modified,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Decision
// ─────────────────────────────────────────────────────────────────────────────

export function parseDecision(
  path: string,
  fm: Record<string, string>,
  content: string
): Decision {
  return {
    path,
    title: fm.title ?? "Untitled Decision",
    created: fm.created ?? "",
    status: (fm.status as Decision["status"]) ?? "pending",
    decided_on: fm.decided_on,
    outcome: fm.outcome,
    review_date: fm.review_date,
    weight: (fm.weight as Decision["weight"]) ?? "medium",
    content,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function extractTitle(content: string): string | undefined {
  const h1 = content.match(/^#\s+(.+)$/m);
  return h1?.[1]?.trim();
}

export function todayPath(vaultPath: string): string {
  const today = format(new Date(), "yyyy-MM-dd");
  return `${vaultPath}/daily/tasks/${today}.md`;
}

export function diaryPath(vaultPath: string, date: string): string {
  const year = date.slice(0, 4);
  return `${vaultPath}/diary/${year}/${date}.md`;
}

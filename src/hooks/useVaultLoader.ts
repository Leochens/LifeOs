import { useCallback } from "react";
import { useStore } from "@/stores/app";
import * as fs from "@/services/fs";
import * as parser from "@/services/parser";
import { format } from "date-fns";
import type { HabitStore, DayNote, Project, DiaryEntry, Decision, Goal, FinancePerson, FinanceRecord, FinanceSubItem, Subscription } from "@/types";

export function useVaultLoader() {
  const { vaultPath, setTodayNote, setProjects, setDiaryEntries, setDecisions, setGoals, setHabits, setFinancePersons, setFinanceRecords, setSubscriptions, setLoading, loadMenuConfigFromVault, loadAppSettingsFromVault } =
    useStore();

  const loadAll = useCallback(async () => {
    if (!vaultPath) return;
    setLoading(true);
    try {
      // Load menu config and app settings first
      await loadMenuConfigFromVault();
      await loadAppSettingsFromVault();

      // Use allSettled so one failing loader doesn't break the rest
      const results = await Promise.allSettled([
        loadToday(vaultPath, setTodayNote),
        loadProjects(vaultPath, setProjects),
        loadDiary(vaultPath, setDiaryEntries),
        loadDecisions(vaultPath, setDecisions),
        loadGoals(vaultPath, setGoals),
        loadHabits(vaultPath, setHabits),
        loadFinanceData(vaultPath, setFinancePersons, setFinanceRecords),
        loadSubscriptions(vaultPath, setSubscriptions),
      ]);
      results.forEach((r, i) => {
        if (r.status === "rejected") {
          const names = ["today", "projects", "diary", "decisions", "goals", "habits", "finance", "subscriptions"];
          console.warn(`Failed to load ${names[i]}:`, r.reason);
        }
      });
    } finally {
      setLoading(false);
    }
  }, [vaultPath, loadMenuConfigFromVault, loadAppSettingsFromVault]);

  return { loadAll };
}

async function loadToday(
  vault: string,
  setTodayNote: (n: DayNote | null) => void
) {
  const today = format(new Date(), "yyyy-MM-dd");
  const path = `${vault}/daily/tasks/${today}.md`;

  const exists = await fs.fileExists(path);
  if (!exists) {
    // Create today's file from template
    const templatePath = `${vault}/diary/templates/daily.md`;
    const templateExists = await fs.fileExists(templatePath);
    const content = templateExists
      ? (await fs.readFile(templatePath)).replace("{{date}}", today).replace("{{content}}", "")
      : `---\ndate: ${today}\nenergy: high\nmood: 😊\n---\n\n## 今日任务\n\n- [ ] \n\n## 今日笔记\n\n`;
    await fs.writeFile(path, content);
  }

  const note = await fs.readNote(path);
  const day = parser.parseDayNote(path, note.frontmatter, note.content);
  setTodayNote(day);
}

async function loadProjects(
  vault: string,
  setProjects: (p: Project[]) => void
) {
  const notes = await fs.listNotes(`${vault}/projects`, true);
  const projects = notes
    .filter((n) => !n.filename.startsWith("_"))
    .map((n) => parser.parseProject(n.path, n.frontmatter, n.content));
  setProjects(projects);
}

async function loadDiary(
  vault: string,
  setDiaryEntries: (e: DiaryEntry[]) => void
) {
  const notes = await fs.listNotes(`${vault}/diary`, true);
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
  const notes = await fs.listNotes(`${vault}/decisions`, false);
  const decisions = notes.map((n) =>
    parser.parseDecision(n.path, n.frontmatter, n.content)
  );
  setDecisions(decisions);
}

async function loadGoals(
  vault: string,
  setGoals: (g: Goal[]) => void
) {
  const notes = await fs.listNotes(`${vault}/planning/goals`, false);
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
    const raw = await fs.readFile(`${vault}/daily/habits/habits.yaml`);
    const habits = parseHabitsYaml(raw);
    setHabits(habits);
  } catch {
    setHabits({ habits: [], checkins: {} });
  }
}

async function loadFinanceData(
  vault: string,
  setFinancePersons: (p: FinancePerson[]) => void,
  setFinanceRecords: (r: FinanceRecord[]) => void
) {
  try {
    const personNotes = await fs.listNotes(`${vault}/finance`, false);
    const persons: FinancePerson[] = personNotes
      .filter((n) => n.frontmatter.name)
      .map((n) => ({
        id: n.frontmatter.id ?? n.filename.replace(".md", ""),
        name: n.frontmatter.name ?? "",
        role: n.frontmatter.role ?? "",
        created: n.frontmatter.created ?? "",
        updated: n.frontmatter.updated ?? "",
        path: n.path,
      }));
    setFinancePersons(persons);

    const records: FinanceRecord[] = [];

    // Helper to parse sub-items from frontmatter
    const parseSubItems = (raw: string | undefined, defaults: string[]): FinanceSubItem[] => {
      if (!raw) return defaults.map((name, i) => ({ id: `sub-${i}`, name, amount: 0 }));
      // Try JSON format first (new format)
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        // Not JSON, might be old single number format
      }
      // Old format: single number
      const num = parseFloat(raw);
      if (!isNaN(num)) {
        return [{ id: "sub-total", name: "总计", amount: num }];
      }
      return defaults.map((name, i) => ({ id: `sub-${i}`, name, amount: 0 }));
    };

    const defaultItems: Record<string, string[]> = {
      liquid: ["银行存款", "现金", "余额宝", "微信钱包", "支付宝"],
      fixed: ["房产", "车辆", "贵重物品"],
      investment: ["股票", "基金", "理财产品", "国债", "黄金"],
      receivable: ["借款", "退款", "分红"],
      debt: ["房贷", "车贷", "信用卡", "消费贷"],
    };

    for (const person of persons) {
      const slug = person.id;
      try {
        const recNotes = await fs.listNotes(`${vault}/finance/records/${slug}`, false);
        for (const rn of recNotes) {
          records.push({
            person: rn.frontmatter.person ?? person.name,
            date: rn.frontmatter.date ?? rn.filename.replace(".md", ""),
            liquid: parseSubItems(rn.frontmatter.liquid, defaultItems.liquid),
            fixed: parseSubItems(rn.frontmatter.fixed, defaultItems.fixed),
            investment: parseSubItems(rn.frontmatter.investment, defaultItems.investment),
            receivable: parseSubItems(rn.frontmatter.receivable, defaultItems.receivable),
            debt: parseSubItems(rn.frontmatter.debt, defaultItems.debt),
            path: rn.path,
          });
        }
      } catch {
        // records dir may not exist yet
      }
    }
    setFinanceRecords(records);
  } catch {
    setFinancePersons([]);
    setFinanceRecords([]);
  }
}

async function loadSubscriptions(
  vault: string,
  setSubscriptions: (s: Subscription[]) => void
) {
  try {
    const notes = await fs.listNotes(`${vault}/subscriptions`, false);
    const subs: Subscription[] = notes
      .filter((n) => n.frontmatter.name)
      .map((n) => ({
        id: n.frontmatter.id ?? n.filename.replace(".md", ""),
        name: n.frontmatter.name ?? "",
        amount: parseFloat(n.frontmatter.amount ?? "0"),
        currency: n.frontmatter.currency ?? "CNY",
        cycle: (n.frontmatter.cycle as Subscription["cycle"]) ?? "monthly",
        startDate: n.frontmatter.startDate ?? "",
        renewalDate: n.frontmatter.renewalDate ?? "",
        paymentMethod: n.frontmatter.paymentMethod ?? "",
        appType: (n.frontmatter.appType as Subscription["appType"]) ?? "saas",
        tags: n.frontmatter.tags ? n.frontmatter.tags.split(",").map((t: string) => t.trim()) : [],
        enabled: n.frontmatter.enabled !== "false",
        notes: n.content,
        path: n.path,
      }));
    setSubscriptions(subs);
  } catch {
    setSubscriptions([]);
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

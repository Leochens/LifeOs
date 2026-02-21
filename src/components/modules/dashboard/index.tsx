import { useState, useMemo } from "react";
import { useStore } from "@/stores/app";
import { writeFile } from "@/services/fs";
import { format, subDays } from "date-fns";
import { zhCN } from "date-fns/locale";
import type { HabitStore } from "@/types";
import { ClipboardList, Rocket, BookOpen, Scale, CheckCircle, FolderKanban, ChevronRight, Check } from "lucide-react";

export default function Dashboard() {
  const todayNote = useStore((s) => s.todayNote);
  const projects = useStore((s) => s.projects);
  const diaryEntries = useStore((s) => s.diaryEntries);
  const stickyNotes = useStore((s) => s.stickyNotes);
  const decisions = useStore((s) => s.decisions);
  const vaultPath = useStore((s) => s.vaultPath);
  const [habits, setHabits] = useState(useStore.getState().habits);
  const setView = useStore((s) => s.setView);

  // Subscribe to store habits changes
  useStore((s) => {
    if (s.habits !== habits && s.habits !== null) {
      setHabits(s.habits);
    }
    return s.habits;
  });

  const today = format(new Date(), "yyyy-MM-dd");
  const todayCheckins = habits?.checkins[today] ?? [];
  const pendingTasks = todayNote?.tasks.filter((t) => !t.done).length ?? 0;
  const doneTasks = todayNote?.tasks.filter((t) => t.done).length ?? 0;
  const totalTasks = todayNote?.tasks.length ?? 0;
  const completionRate = totalTasks > 0 ? doneTasks / totalTasks : 0;
  const activeProjects = projects.filter((p) => p.status === "active");
  const pendingDecisions = decisions.filter((d) => d.status === "pending").length;

  const hour = new Date().getHours();
  const greeting = hour < 6 ? "夜深了，注意休息" : hour < 12 ? "早上好！" : hour < 18 ? "下午好！" : "晚上好！";
  const motivation = completionRate >= 1 && totalTasks > 0
    ? "今天的任务全完成了，太棒了！"
    : completionRate >= 0.5
    ? "已完成一半，继续加油！"
    : "新的一天，加油！";

  const toggleHabit = async (habitId: string) => {
    if (!habits || !vaultPath) return;
    const checkins = { ...habits.checkins };
    const todayCheckins = checkins[today] ?? [];
    if (todayCheckins.includes(habitId)) {
      checkins[today] = todayCheckins.filter(id => id !== habitId);
    } else {
      checkins[today] = [...todayCheckins, habitId];
    }
    const updated: HabitStore = { habits: habits.habits, checkins };
    const yaml = serializeHabits(updated);
    await writeFile(`${vaultPath}/daily/habits/habits.yaml`, yaml);
    setHabits(updated);
  };

  // Heatmap data: activity per day over the last 365 days
  const heatmapData = useMemo(() => {
    const now = new Date();
    const map: Record<string, number> = {};

    // Count diary entries by date
    for (const entry of diaryEntries) {
      if (entry.date) {
        map[entry.date] = (map[entry.date] || 0) + 1;
      }
    }

    // Count todayNote tasks by date (today)
    if (todayNote && todayNote.tasks.length > 0) {
      map[todayNote.date] = (map[todayNote.date] || 0) + todayNote.tasks.length;
    }

    // Count project updates by date
    for (const p of projects) {
      if (p.updated) {
        const d = p.updated.slice(0, 10);
        map[d] = (map[d] || 0) + 1;
      }
    }

    // Count sticky notes by created date
    for (const s of stickyNotes) {
      if (s.created) {
        const d = s.created.slice(0, 10);
        map[d] = (map[d] || 0) + 1;
      }
    }

    // Build 365-day grid
    const days: { date: string; level: number }[] = [];
    for (let i = 364; i >= 0; i--) {
      const d = format(subDays(now, i), "yyyy-MM-dd");
      const count = map[d] || 0;
      const level = count === 0 ? 0 : count <= 1 ? 1 : count <= 3 ? 2 : count <= 5 ? 3 : 4;
      days.push({ date: d, level });
    }
    return days;
  }, [diaryEntries, todayNote, projects, stickyNotes]);

  // Arrange heatmap into weeks (columns), starting from Sunday
  const heatmapWeeks = useMemo(() => {
    const weeks: { date: string; level: number }[][] = [];
    let currentWeek: { date: string; level: number }[] = [];

    // First day: pad with empty cells to align to weekday
    const firstDate = new Date(heatmapData[0].date);
    const dayOfWeek = firstDate.getDay(); // 0=Sun
    for (let i = 0; i < dayOfWeek; i++) {
      currentWeek.push({ date: "", level: -1 });
    }

    for (const day of heatmapData) {
      currentWeek.push(day);
      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    }
    if (currentWeek.length > 0) {
      weeks.push(currentWeek);
    }
    return weeks;
  }, [heatmapData]);

  const heatmapColors = [
    "var(--panel2)",
    "rgba(0, 200, 255, 0.2)",
    "rgba(0, 200, 255, 0.4)",
    "rgba(0, 200, 255, 0.7)",
    "rgba(0, 200, 255, 1.0)",
  ];

  return (
    <div className="flex flex-col gap-5 fade-in">
      {/* Date Hero + Greeting */}
      <div className="mb-1">
        <div className="flex items-baseline gap-4 mb-1">
          <div className="font-disp text-5xl tracking-widest text-text leading-none">
            {format(new Date(), "MM月dd日", { locale: zhCN })}
          </div>
          <div className="text-text-dim text-sm">
            {format(new Date(), "EEEE", { locale: zhCN })}
          </div>
        </div>
        <div className="text-sm text-text-mid">
          {greeting} — {motivation}
        </div>
      </div>

      {/* Main layout: left 2/3 + right 1/3 */}
      <div className="grid grid-cols-[2fr_1fr] gap-5 items-start">
        {/* Left column */}
        <div className="flex flex-col gap-5">
          {/* Stats 2x2 */}
          <div className="grid grid-cols-2 gap-4">
            <div
              className="stat-card cursor-pointer group hover:scale-[1.02] hover:-translate-y-0.5"
              onClick={() => setView("daily")}
            >
              <div className="text-3xl mb-2.5 text-accent group-hover:drop-shadow-[0_0_8px_var(--accent)] transition-all duration-300">
                <ClipboardList size={28} strokeWidth={1.5} />
              </div>
              <div className="stat-card-value text-accent">{pendingTasks}</div>
              <div className="stat-card-label">待完成任务</div>
              {todayNote && totalTasks > 0 && (
                <div className="mt-2">
                  <div className="progress-track">
                    <div
                      className="progress-fill animate-progress"
                      style={{ "--target-width": `${completionRate * 100}%` } as React.CSSProperties}
                    />
                  </div>
                  <div className="text-[10px] text-text-dim mt-1 text-right">
                    {doneTasks}/{totalTasks}
                  </div>
                </div>
              )}
            </div>
            <div
              className="stat-card cursor-pointer group hover:scale-[1.02] hover:-translate-y-0.5"
              onClick={() => setView("kanban")}
            >
              <div className="text-3xl mb-2.5 text-accent-2 group-hover:drop-shadow-[0_0_8px_var(--accent-2)] transition-all duration-300">
                <Rocket size={28} strokeWidth={1.5} />
              </div>
              <div className="stat-card-value text-accent-2">{activeProjects.length}</div>
              <div className="stat-card-label">进行项目</div>
            </div>
            <div
              className="stat-card cursor-pointer group hover:scale-[1.02] hover:-translate-y-0.5"
              onClick={() => setView("diary")}
            >
              <div className="text-3xl mb-2.5 text-accent-3 group-hover:drop-shadow-[0_0_8px_var(--accent-3)] transition-all duration-300">
                <BookOpen size={28} strokeWidth={1.5} />
              </div>
              <div className="stat-card-value text-accent-3">{diaryEntries.length}</div>
              <div className="stat-card-label">日记条数</div>
            </div>
            <div
              className="stat-card cursor-pointer group hover:scale-[1.02] hover:-translate-y-0.5"
              onClick={() => setView("decisions")}
            >
              <div className="text-3xl mb-2.5 text-accent-5 group-hover:drop-shadow-[0_0_8px_var(--accent-5)] transition-all duration-300">
                <Scale size={28} strokeWidth={1.5} />
              </div>
              <div className="stat-card-value text-accent-5">{pendingDecisions}</div>
              <div className="stat-card-label">待决策</div>
            </div>
          </div>

          {/* Today's tasks */}
          <div className="panel p-5 fade-in" style={{ animationDelay: "0.1s" }}>
            <div className="flex justify-between items-center mb-3">
              <SectionLabel dot="var(--accent3)">今日任务</SectionLabel>
              <button className="btn-ghost text-[11px] px-2 py-0.75 flex items-center gap-1" onClick={() => setView("daily")}>
                查看全部 <ChevronRight size={12} />
              </button>
            </div>
            {todayNote?.tasks.length === 0 && (
              <div className="text-text-dim text-sm">暂无任务</div>
            )}
            <div className="flex flex-col gap-1.5">
              {todayNote?.tasks.slice(0, 8).map((task) => (
                <div
                  key={task.id}
                  className={`flex items-center gap-2.5 px-2.5 py-1.75 rounded-sm bg-panel-2 border border-border transition-all duration-200 hover:scale-[1.01] ${task.done ? "opacity-50" : "hover:border-accent3/30"}`}
                >
                  <span className="text-sm">
                    {task.done ? (
                      <CheckCircle size={16} className="text-accent3" />
                    ) : (
                      <div className="w-4 h-4 rounded-sm border border-border" />
                    )}
                  </span>
                  <span className={`text-sm flex-1 ${task.done ? "line-through text-text-dim" : "text-text"}`}>
                    {task.text}
                  </span>
                  {task.time && (
                    <span className="text-[10px] text-text-dim font-mono">
                      {task.time}
                    </span>
                  )}
                  {task.tags[0] && <span className="tag">{task.tags[0]}</span>}
                </div>
              ))}
            </div>
            {(todayNote?.tasks.length ?? 0) > 8 && (
              <button className="btn btn-ghost mt-2.5 w-full justify-center" onClick={() => setView("daily")}>
                查看全部 <ChevronRight size={14} />
              </button>
            )}
          </div>

          {/* Active projects */}
          <div className="panel p-5 fade-in" style={{ animationDelay: "0.2s" }}>
            <SectionLabel dot="var(--accent)">活跃项目</SectionLabel>
            <div className="mt-2.5 flex flex-col gap-2">
              {activeProjects.slice(0, 3).map((p) => (
                <div
                  key={p.path}
                  className="p-3 bg-panel-2 border border-border rounded-sm cursor-pointer transition-all duration-200 hover:scale-[1.01] hover:border-accent"
                  onClick={() => setView("kanban")}
                >
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium flex items-center gap-2">
                      <FolderKanban size={14} className="text-accent-2" />
                      {p.title}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className={`text-[9px] px-2 py-0.5 rounded-full uppercase tracking-widest ${
                        p.priority === "high" ? "bg-accent2/15 text-accent2" :
                        p.priority === "urgent" ? "bg-accent4/15 text-accent4" :
                        "bg-border text-text-dim"
                      }`}>
                        {p.priority}
                      </span>
                      <span className="text-[11px] text-text-dim font-mono">{p.progress}%</span>
                    </div>
                  </div>
                  <div className="progress-track">
                    <div
                      className="progress-fill animate-progress"
                      style={{ "--target-width": `${p.progress}%` } as React.CSSProperties}
                    />
                  </div>
                  <div className="text-[10px] text-text-dim mt-1.5 font-mono">
                    更新于 {p.updated}
                  </div>
                </div>
              ))}
              {activeProjects.length === 0 && (
                <div className="text-text-dim text-sm">暂无活跃项目</div>
              )}
            </div>
          </div>

          {/* Activity Heatmap */}
          <div className="panel p-5 fade-in" style={{ animationDelay: "0.3s" }}>
            <SectionLabel dot="var(--accent)">活跃度</SectionLabel>
            <div className="mt-3 overflow-x-auto">
              <div className="flex gap-0.5 min-w-fit">
                {heatmapWeeks.map((week, wi) => (
                  <div key={wi} className="flex flex-col gap-0.5">
                    {week.map((day, di) => (
                      <div
                        key={di}
                        title={day.date ? `${day.date}: ${day.level === 0 ? "无活动" : `活跃度 ${day.level}`}` : ""}
                        className="w-2.5 h-2.5 rounded-[2px] transition-colors duration-150 hover:scale-125 animate-heatmap"
                        style={{
                          background: day.level < 0 ? "transparent" : heatmapColors[day.level],
                          animationDelay: `${0.3 + (wi * 0.01) + (di * 0.002)}s`
                        }}
                      />
                    ))}
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-1.5 mt-2 justify-end">
                <span className="text-[10px] text-text-dim">少</span>
                {heatmapColors.map((c, i) => (
                  <div key={i} className="w-2.5 h-2.5 rounded-[2px]" style={{ background: c }} />
                ))}
                <span className="text-[10px] text-text-dim">多</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-5">
          {/* Habits with checkin */}
          <div className="panel p-5 fade-in" style={{ animationDelay: "0.15s" }}>
            <SectionLabel dot="var(--accent2)">今日习惯</SectionLabel>
            <div className="mt-2.5 flex flex-col gap-2">
              {habits?.habits.map((h) => {
                const done = todayCheckins.includes(h.id);
                return (
                  <div
                    key={h.id}
                    onClick={() => toggleHabit(h.id)}
                    className={`flex items-center gap-3 p-2.5 rounded-sm cursor-pointer transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] ${
                      done ? "bg-accent3/5 border border-accent3/20" : "bg-panel-2 border border-border hover:border-accent3/30"
                    }`}
                  >
                    <span className="text-xl">{h.icon}</span>
                    <span className={`text-sm flex-1 ${done ? "text-accent3" : "text-text"}`}>{h.name}</span>
                    <div
                      className={`w-6 h-6 rounded-sm flex items-center justify-center text-sm font-bold transition-all duration-200 animate-check ${
                        done ? "bg-accent3 text-black shadow-[0_0_10px_var(--accent3)] scale-100" : "bg-border text-transparent"
                      }`}
                    >
                      <Check size={14} strokeWidth={3} />
                    </div>
                  </div>
                );
              })}
              {!habits?.habits.length && (
                <div className="text-text-dim text-sm">
                  还没有习惯，在 daily/habits/habits.yaml 中添加
                </div>
              )}
              {habits && habits.habits.length > 0 && (
                <div className="text-[11px] text-text-dim mt-1 text-center">
                  {todayCheckins.length}/{habits.habits.length} 已完成
                </div>
              )}
            </div>
          </div>

          {/* Recent diary */}
          <div className="panel p-5 fade-in" style={{ animationDelay: "0.25s" }}>
            <SectionLabel dot="var(--accent5)">最近日记</SectionLabel>
            <div className="mt-2.5 flex flex-col gap-2">
              {diaryEntries.slice(0, 3).map((e) => (
                <div
                  key={e.path}
                  className="flex items-center gap-3 p-2.5 bg-panel-2 border border-border rounded-sm cursor-pointer transition-all duration-200 hover:scale-[1.02] hover:border-accent5"
                  onClick={() => setView("diary")}
                >
                  <span className="text-2xl leading-none">{e.mood}</span>
                  <div className="flex-1 overflow-hidden">
                    <div className="text-sm font-medium whitespace-nowrap overflow-hidden text-ellipsis">
                      {e.title || e.date}
                    </div>
                    <div className="text-[10px] text-text-dim font-mono tracking-widest mt-0.5">
                      {e.date}
                    </div>
                    {e.tags.length > 0 && (
                      <div className="flex gap-1 mt-1">
                        {e.tags.slice(0, 3).map((tag) => (
                          <span key={tag} className="tag text-[9px]">{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {diaryEntries.length === 0 && (
                <div className="text-text-dim text-sm">还没有日记</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function serializeHabits(store: HabitStore): string {
  let yaml = "habits:\n";
  for (const h of store.habits) {
    yaml += `  - id: ${h.id}\n    name: "${h.name}"\n    icon: "${h.icon}"\n    target_days: [${h.target_days.join(",")}]\n    created: "${h.created}"\n`;
  }
  yaml += "checkins:\n";
  for (const [date, ids] of Object.entries(store.checkins)) {
    yaml += `  ${date}: [${ids.join(", ")}]\n`;
  }
  return yaml;
}

function SectionLabel({ dot, children }: { dot: string; children: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: dot, boxShadow: `0 0 6px ${dot}` }} />
      <span className="label">{children}</span>
    </div>
  );
}

import { useState, useMemo } from "react";
import { useStore } from "@/stores/app";
import { writeFile } from "@/services/tauri";
import { format, subDays } from "date-fns";
import { zhCN } from "date-fns/locale";
import type { HabitStore } from "@/types";

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
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Date Hero + Greeting */}
      <div style={{ marginBottom: 4 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginBottom: 4 }}>
          <div style={{
            fontFamily: "var(--font-disp)", fontSize: 48,
            letterSpacing: 4, color: "var(--text)", lineHeight: 1,
          }}>
            {format(new Date(), "MM月dd日", { locale: zhCN })}
          </div>
          <div style={{ color: "var(--text-dim)", fontSize: 14 }}>
            {format(new Date(), "EEEE", { locale: zhCN })}
          </div>
        </div>
        <div style={{ fontSize: 13, color: "var(--text-mid)" }}>
          {greeting} — {motivation}
        </div>
      </div>

      {/* Main layout: left 2/3 + right 1/3 */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, alignItems: "start" }}>
        {/* Left column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Stats 2x2 */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="stat-card" onClick={() => setView("daily")} style={{ cursor: "pointer" }}>
              <div className="stat-card-icon">📋</div>
              <div className="stat-card-value" style={{ color: "var(--accent)" }}>{pendingTasks}</div>
              <div className="stat-card-label">待完成任务</div>
              {todayNote && totalTasks > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${completionRate * 100}%` }} />
                  </div>
                  <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 4, textAlign: "right" }}>
                    {doneTasks}/{totalTasks}
                  </div>
                </div>
              )}
            </div>
            <div className="stat-card" onClick={() => setView("kanban")} style={{ cursor: "pointer" }}>
              <div className="stat-card-icon">🚀</div>
              <div className="stat-card-value" style={{ color: "var(--accent2)" }}>{activeProjects.length}</div>
              <div className="stat-card-label">进行项目</div>
            </div>
            <div className="stat-card" onClick={() => setView("diary")} style={{ cursor: "pointer" }}>
              <div className="stat-card-icon">📝</div>
              <div className="stat-card-value" style={{ color: "var(--accent3)" }}>{diaryEntries.length}</div>
              <div className="stat-card-label">日记条数</div>
            </div>
            <div className="stat-card" onClick={() => setView("decisions")} style={{ cursor: "pointer" }}>
              <div className="stat-card-icon">⚖️</div>
              <div className="stat-card-value" style={{ color: "var(--accent5)" }}>{pendingDecisions}</div>
              <div className="stat-card-label">待决策</div>
            </div>
          </div>

          {/* Today's tasks */}
          <div className="panel" style={{ padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <SectionLabel dot="var(--accent3)">今日任务</SectionLabel>
              <button className="btn-ghost" style={{ fontSize: 11, padding: "3px 8px" }} onClick={() => setView("daily")}>
                查看全部 →
              </button>
            </div>
            {todayNote?.tasks.length === 0 && (
              <div style={{ color: "var(--text-dim)", fontSize: 13 }}>暂无任务</div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {todayNote?.tasks.slice(0, 8).map((task) => (
                <div key={task.id} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "7px 10px", borderRadius: "var(--radius-sm)",
                  background: "var(--panel2)", border: "1px solid var(--border)",
                  opacity: task.done ? 0.5 : 1,
                }}>
                  <span style={{ fontSize: 14 }}>{task.done ? "✅" : "⬜"}</span>
                  <span style={{
                    fontSize: 13, flex: 1,
                    textDecoration: task.done ? "line-through" : "none",
                    color: task.done ? "var(--text-dim)" : "var(--text)",
                  }}>
                    {task.text}
                  </span>
                  {task.time && (
                    <span style={{ fontSize: 10, color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
                      {task.time}
                    </span>
                  )}
                  {task.tags[0] && <span className="tag">{task.tags[0]}</span>}
                </div>
              ))}
            </div>
            {(todayNote?.tasks.length ?? 0) > 8 && (
              <button className="btn btn-ghost" style={{ marginTop: 10, width: "100%", justifyContent: "center" }}
                onClick={() => setView("daily")}>
                查看全部 →
              </button>
            )}
          </div>

          {/* Active projects */}
          <div className="panel" style={{ padding: 20 }}>
            <SectionLabel dot="var(--accent)">活跃项目</SectionLabel>
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
              {activeProjects.slice(0, 3).map((p) => (
                <div key={p.path} style={{
                  padding: "12px 14px",
                  background: "var(--panel2)", border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)",
                  cursor: "pointer",
                }} onClick={() => setView("kanban")}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{p.title}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{
                        fontSize: 9, padding: "2px 8px", borderRadius: 8,
                        background: p.priority === "high" ? "rgba(123,97,255,0.15)" : p.priority === "urgent" ? "rgba(255,107,107,0.15)" : "var(--border)",
                        color: p.priority === "high" ? "var(--accent2)" : p.priority === "urgent" ? "var(--accent4)" : "var(--text-dim)",
                        textTransform: "uppercase", letterSpacing: 1,
                      }}>
                        {p.priority}
                      </span>
                      <span style={{ fontSize: 11, color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>{p.progress}%</span>
                    </div>
                  </div>
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${p.progress}%` }} />
                  </div>
                  <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 6, fontFamily: "var(--font-mono)" }}>
                    更新于 {p.updated}
                  </div>
                </div>
              ))}
              {activeProjects.length === 0 && (
                <div style={{ color: "var(--text-dim)", fontSize: 13 }}>暂无活跃项目</div>
              )}
            </div>
          </div>

          {/* Activity Heatmap */}
          <div className="panel" style={{ padding: 20 }}>
            <SectionLabel dot="var(--accent)">活跃度</SectionLabel>
            <div style={{ marginTop: 12, overflowX: "auto" }}>
              <div style={{ display: "flex", gap: 2, minWidth: "fit-content" }}>
                {heatmapWeeks.map((week, wi) => (
                  <div key={wi} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    {week.map((day, di) => (
                      <div
                        key={di}
                        title={day.date ? `${day.date}: ${day.level === 0 ? "无活动" : `活跃度 ${day.level}`}` : ""}
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: 2,
                          background: day.level < 0 ? "transparent" : heatmapColors[day.level],
                          transition: "background 0.15s",
                        }}
                      />
                    ))}
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, justifyContent: "flex-end" }}>
                <span style={{ fontSize: 10, color: "var(--text-dim)" }}>少</span>
                {heatmapColors.map((c, i) => (
                  <div key={i} style={{ width: 10, height: 10, borderRadius: 2, background: c }} />
                ))}
                <span style={{ fontSize: 10, color: "var(--text-dim)" }}>多</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Habits with checkin */}
          <div className="panel" style={{ padding: 20 }}>
            <SectionLabel dot="var(--accent2)">今日习惯</SectionLabel>
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
              {habits?.habits.map((h) => {
                const done = todayCheckins.includes(h.id);
                return (
                  <div
                    key={h.id}
                    onClick={() => toggleHabit(h.id)}
                    style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "10px 12px",
                      background: done ? "rgba(0,255,163,0.05)" : "var(--panel2)",
                      border: `1px solid ${done ? "rgba(0,255,163,0.2)" : "var(--border)"}`,
                      borderRadius: "var(--radius-sm)",
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                  >
                    <span style={{ fontSize: 20 }}>{h.icon}</span>
                    <span style={{ fontSize: 13, flex: 1, color: done ? "var(--accent3)" : "var(--text)" }}>{h.name}</span>
                    <div style={{
                      width: 24, height: 24, borderRadius: 6,
                      background: done ? "var(--accent3)" : "var(--border)",
                      boxShadow: done ? "0 0 10px var(--accent3)" : "none",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 13, color: done ? "#000" : "transparent",
                      fontWeight: 700,
                      transition: "all 0.15s",
                    }}>
                      ✓
                    </div>
                  </div>
                );
              })}
              {!habits?.habits.length && (
                <div style={{ color: "var(--text-dim)", fontSize: 13 }}>
                  还没有习惯，在 daily/habits/habits.yaml 中添加
                </div>
              )}
              {habits && habits.habits.length > 0 && (
                <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 4, textAlign: "center" }}>
                  {todayCheckins.length}/{habits.habits.length} 已完成
                </div>
              )}
            </div>
          </div>

          {/* Recent diary */}
          <div className="panel" style={{ padding: 20 }}>
            <SectionLabel dot="var(--accent5)">最近日记</SectionLabel>
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
              {diaryEntries.slice(0, 3).map((e) => (
                <div key={e.path} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "10px 12px",
                  background: "var(--panel2)", border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)", cursor: "pointer",
                  transition: "border-color 0.15s",
                }}
                onClick={() => setView("diary")}
                onMouseEnter={(el) => { (el.currentTarget as HTMLElement).style.borderColor = "rgba(255,179,71,0.3)"; }}
                onMouseLeave={(el) => { (el.currentTarget as HTMLElement).style.borderColor = "var(--border)"; }}
                >
                  <span style={{ fontSize: 28, lineHeight: 1 }}>{e.mood}</span>
                  <div style={{ flex: 1, overflow: "hidden" }}>
                    <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {e.title || e.date}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--text-dim)", fontFamily: "var(--font-mono)", letterSpacing: 1, marginTop: 2 }}>
                      {e.date}
                    </div>
                    {e.tags.length > 0 && (
                      <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                        {e.tags.slice(0, 3).map((tag) => (
                          <span key={tag} className="tag" style={{ fontSize: 9 }}>{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {diaryEntries.length === 0 && (
                <div style={{ color: "var(--text-dim)", fontSize: 13 }}>还没有日记</div>
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
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ width: 6, height: 6, borderRadius: "50%", background: dot, boxShadow: `0 0 6px ${dot}`, flexShrink: 0 }} />
      <span className="label">{children}</span>
    </div>
  );
}

import { useState, useEffect } from "react";
import { useStore } from "@/stores/app";
import { writeNote, readNote, listDir } from "@/services/tauri";
import { serializeDayNote } from "@/services/parser";
import type { TaskItem, DayNote } from "@/types";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, isSameMonth } from "date-fns";
import { zhCN } from "date-fns/locale";

function parseTasksFromContent(content: string): TaskItem[] {
  const lines = content.split("\n");
  const tasks: TaskItem[] = [];
  for (const line of lines) {
    const match = line.match(/^- \[([ xX])\] (.+)$/);
    if (match) {
      const done = match[1] !== " ";
      const raw = match[2];
      const tags = [...raw.matchAll(/#(\w+)/g)].map((m) => m[1]);
      const text = raw.replace(/#\w+/g, "").trim();
      tasks.push({ id: `hist-${Date.now()}-${Math.random()}`, text, done, tags });
    }
  }
  return tasks;
}

export default function DailyView() {
  const todayNote = useStore((s) => s.todayNote);
  const setTodayNote = useStore((s) => s.setTodayNote);
  const vaultPath = useStore((s) => s.vaultPath);
  const [newTask, setNewTask] = useState("");
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"today" | "history">("today");

  // History state
  const [calMonth, setCalMonth] = useState(new Date());
  const [historyDates, setHistoryDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedNote, setSelectedNote] = useState<DayNote | null>(null);

  // Load history dates
  useEffect(() => {
    if (!vaultPath || tab !== "history") return;
    listDir(vaultPath + "/daily/tasks", false).then((entries) => {
      const dates = entries
        .filter((e: { is_dir: boolean; name: string }) => !e.is_dir && e.name.endsWith(".md"))
        .map((e: { name: string }) => e.name.replace(".md", ""));
      setHistoryDates(dates);
    }).catch(() => setHistoryDates([]));
  }, [tab, calMonth, vaultPath]);

  const loadDate = async (date: string) => {
    setSelectedDate(date);
    if (!vaultPath) return;
    const path = `${vaultPath}/daily/tasks/${date}.md`;
    try {
      const note = await readNote(path);
      const tasks = parseTasksFromContent(note.content);
      setSelectedNote({ date, energy: "medium", mood: "", tasks, notes: "", path });
    } catch {
      setSelectedNote(null);
    }
  };

  if (tab === "today" && !todayNote) {
    return <div style={{ color: "var(--text-dim)" }}>加载中...</div>;
  }

  const save = async (updated: DayNote) => {
    setSaving(true);
    try {
      const { frontmatter, content } = serializeDayNote(updated);
      await writeNote(updated.path, frontmatter, content);
    } finally {
      setSaving(false);
    }
  };

  const toggleTask = async (id: string) => {
    if (!todayNote) return;
    const updated = {
      ...todayNote,
      tasks: todayNote.tasks.map((t) =>
        t.id === id ? { ...t, done: !t.done } : t
      ),
    };
    setTodayNote(updated);
    await save(updated);
  };

  const addTask = async () => {
    if (!newTask.trim() || !todayNote) return;
    const tags = [...newTask.matchAll(/#(\w+)/g)].map((m) => m[1]);
    const text = newTask.replace(/#\w+/g, "").trim();
    const newItem: TaskItem = {
      id: `task-${Date.now()}`,
      text, tags, done: false,
    };
    const updated = { ...todayNote, tasks: [...todayNote.tasks, newItem] };
    setTodayNote(updated);
    setNewTask("");
    await save(updated);
  };

  const deleteTask = async (id: string) => {
    if (!todayNote) return;
    const updated = { ...todayNote, tasks: todayNote.tasks.filter((t) => t.id !== id) };
    setTodayNote(updated);
    await save(updated);
  };

  const pending = todayNote?.tasks.filter((t) => !t.done) ?? [];
  const done = todayNote?.tasks.filter((t) => t.done) ?? [];

  // Calendar helpers
  const monthStart = startOfMonth(calMonth);
  const monthEnd = endOfMonth(calMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startPad = getDay(monthStart); // 0=Sun

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 900 }}>
      {/* Tab bar */}
      <div style={{ display: "flex", gap: 0 }}>
        {(["today", "history"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: "8px 24px", fontSize: 14, cursor: "pointer",
              fontFamily: "var(--font-sans)",
              background: tab === t ? "rgba(0,200,255,0.1)" : "transparent",
              color: tab === t ? "var(--accent)" : "var(--text-dim)",
              border: `1px solid ${tab === t ? "rgba(0,200,255,0.3)" : "var(--border)"}`,
              borderRadius: t === "today" ? "var(--radius-sm) 0 0 var(--radius-sm)" : "0 var(--radius-sm) var(--radius-sm) 0",
              transition: "all 0.15s",
            }}
          >
            {t === "today" ? "今日" : "历史"}
          </button>
        ))}
      </div>

      {tab === "today" && todayNote && (
        <>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontFamily: "var(--font-disp)", fontSize: 28, letterSpacing: 3, color: "var(--accent)" }}>
                今日任务
              </div>
              <div style={{ color: "var(--text-dim)", fontSize: 12, fontFamily: "var(--font-mono)", marginTop: 2 }}>
                {format(new Date(), "yyyy年MM月dd日 EEEE", { locale: zhCN })}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {saving && <span style={{ fontSize: 11, color: "var(--text-dim)" }}>保存中...</span>}
              <MoodBadge mood={todayNote.mood} />
            </div>
          </div>

          {/* Add task */}
          <div style={{ display: "flex", gap: 8 }}>
            <input
              className="input"
              placeholder="添加任务... 支持 #标签  (Enter 确认)"
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addTask()}
            />
            <button className="btn btn-primary" onClick={addTask} style={{ whiteSpace: "nowrap" }}>
              + 添加
            </button>
          </div>

          {/* Progress */}
          {todayNote.tasks.length > 0 && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-dim)", marginBottom: 6 }}>
                <span>今日进度</span>
                <span style={{ color: "var(--accent)" }}>{done.length}/{todayNote.tasks.length}</span>
              </div>
              <div className="progress-track" style={{ height: 6 }}>
                <div className="progress-fill"
                  style={{ width: `${todayNote.tasks.length ? (done.length / todayNote.tasks.length) * 100 : 0}%` }} />
              </div>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {/* Pending */}
            <div className="panel" style={{ padding: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent5)",
                             boxShadow: "0 0 6px var(--accent5)" }} />
                <span className="label">待完成 ({pending.length})</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {pending.map((task) => (
                  <TaskRow key={task.id} task={task} onToggle={toggleTask} onDelete={deleteTask} />
                ))}
                {pending.length === 0 && (
                  <div style={{ color: "var(--accent3)", fontSize: 13, padding: "10px 0" }}>
                    全部完成！
                  </div>
                )}
              </div>
            </div>

            {/* Done */}
            <div className="panel" style={{ padding: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent3)",
                             boxShadow: "0 0 6px var(--accent3)" }} />
                <span className="label">已完成 ({done.length})</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {done.map((task) => (
                  <TaskRow key={task.id} task={task} onToggle={toggleTask} onDelete={deleteTask} />
                ))}
                {done.length === 0 && (
                  <div style={{ color: "var(--text-dim)", fontSize: 13 }}>尚未完成任何任务</div>
                )}
              </div>
            </div>
          </div>

          {/* Notes section */}
          <div className="panel" style={{ padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent2)",
                           boxShadow: "0 0 6px var(--accent2)" }} />
              <span className="label">今日笔记</span>
            </div>
            <textarea
              className="input"
              style={{ minHeight: 120 }}
              value={todayNote.notes}
              placeholder="今天有什么想记录的..."
              onChange={(e) => setTodayNote({ ...todayNote, notes: e.target.value })}
              onBlur={() => save(todayNote)}
            />
          </div>
        </>
      )}

      {tab === "history" && (
        <>
          {/* Header */}
          <div style={{ fontFamily: "var(--font-disp)", fontSize: 28, letterSpacing: 3, color: "var(--accent)" }}>
            历史任务
          </div>

          {/* Calendar */}
          <div className="panel" style={{ padding: 24 }}>
            {/* Month nav */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <button
                className="btn btn-ghost"
                onClick={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1))}
                style={{ padding: "8px 14px", fontSize: 13 }}
              >
                ← 上月
              </button>
              <span style={{ fontFamily: "var(--font-disp)", fontSize: 20, color: "var(--accent)", letterSpacing: 3 }}>
                {format(calMonth, "yyyy年MM月", { locale: zhCN })}
              </span>
              <button
                className="btn btn-ghost"
                onClick={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1))}
                style={{ padding: "8px 14px", fontSize: 13 }}
              >
                下月 →
              </button>
            </div>

            {/* Weekday headers */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, textAlign: "center", marginBottom: 12 }}>
              {["日", "一", "二", "三", "四", "五", "六"].map((d, i) => (
                <div key={d} style={{
                  fontSize: 12, color: i === 0 || i === 6 ? "var(--accent4)" : "var(--text-dim)",
                  padding: "10px 0", fontFamily: "var(--font-mono)", fontWeight: 600
                }}>
                  {d}
                </div>
              ))}

              {/* Empty cells for padding */}
              {Array.from({ length: startPad }).map((_, i) => (
                <div key={`pad-${i}`} style={{ height: 52 }} />
              ))}

              {/* Days */}
              {days.map((day) => {
                const dateStr = format(day, "yyyy-MM-dd");
                const isToday = isSameDay(day, new Date());
                const hasData = historyDates.includes(dateStr);
                const isSelected = selectedDate === dateStr;
                const inMonth = isSameMonth(day, calMonth);

                return (
                  <div
                    key={dateStr}
                    onClick={() => hasData && loadDate(dateStr)}
                    style={{
                      height: 52, cursor: hasData ? "pointer" : "default",
                      borderRadius: 12, textAlign: "center",
                      fontSize: 14, position: "relative",
                      transition: "all 0.2s",
                      background: isSelected ? "var(--accent)" : isToday ? "rgba(0,200,255,0.08)" : "transparent",
                      color: isSelected ? "#fff" : !inMonth ? "var(--text-dim)" : "var(--text)",
                      fontWeight: isToday ? 600 : 400,
                      border: isToday && !isSelected ? "1px solid var(--accent)" : "1px solid transparent",
                      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    <div>{day.getDate()}</div>
                    {hasData && (
                      <div style={{
                        width: 5, height: 5, borderRadius: "50%",
                        background: isSelected ? "#fff" : "var(--accent3)",
                        marginTop: 2,
                      }} />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div style={{ display: "flex", gap: 20, justifyContent: "center", marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--text-dim)" }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, background: "var(--accent)" }} />
                已选择
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--text-dim)" }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, background: "rgba(0,200,255,0.08)", border: "1px solid var(--accent)" }} />
                今日
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--text-dim)" }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--accent3)" }} />
                有记录
              </div>
            </div>
          </div>

          {/* Selected date tasks (read-only) */}
          {selectedDate && (
            <div className="panel" style={{ padding: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)",
                             boxShadow: "0 0 6px var(--accent)" }} />
                <span className="label">{selectedDate} 的任务</span>
              </div>
              {selectedNote && selectedNote.tasks.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {selectedNote.tasks.map((task) => (
                    <div
                      key={task.id}
                      style={{
                        display: "flex", alignItems: "center", gap: 10,
                        padding: "9px 12px",
                        background: "var(--panel2)", border: "1px solid var(--border)",
                        borderRadius: "var(--radius-sm)",
                        opacity: task.done ? 0.55 : 1,
                      }}
                    >
                      <div style={{
                        width: 20, height: 20, borderRadius: 4, flexShrink: 0,
                        background: task.done ? "var(--accent3)" : "transparent",
                        border: `1.5px solid ${task.done ? "var(--accent3)" : "var(--border)"}`,
                        color: task.done ? "#000" : "transparent",
                        fontSize: 11,
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        {task.done && "✓"}
                      </div>
                      <span style={{
                        flex: 1, fontSize: 13,
                        textDecoration: task.done ? "line-through" : "none",
                        color: task.done ? "var(--text-dim)" : "var(--text)",
                      }}>
                        {task.text}
                      </span>
                      {task.tags.map((tag) => (
                        <span key={tag} className="tag" style={{ fontSize: 10 }}>#{tag}</span>
                      ))}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: "var(--text-dim)", fontSize: 13 }}>
                  {selectedNote ? "该日期没有任务记录" : "加载中..."}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function TaskRow({ task, onToggle, onDelete }: {
  task: TaskItem;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "9px 12px",
      background: "var(--panel2)", border: "1px solid var(--border)",
      borderRadius: "var(--radius-sm)",
      opacity: task.done ? 0.55 : 1,
      transition: "opacity 0.2s",
    }}>
      <button
        onClick={() => onToggle(task.id)}
        style={{
          width: 20, height: 20, borderRadius: 4, flexShrink: 0,
          background: task.done ? "var(--accent3)" : "transparent",
          border: `1.5px solid ${task.done ? "var(--accent3)" : "var(--border)"}`,
          color: task.done ? "#000" : "transparent",
          fontSize: 11, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "all 0.15s",
          boxShadow: task.done ? "0 0 8px var(--accent3)" : "none",
        }}
      >
        ✓
      </button>
      <span style={{
        flex: 1, fontSize: 13,
        textDecoration: task.done ? "line-through" : "none",
        color: task.done ? "var(--text-dim)" : "var(--text)",
      }}>
        {task.text}
      </span>
      {task.tags.map((tag) => (
        <span key={tag} className="tag" style={{ fontSize: 10 }}>#{tag}</span>
      ))}
      <button
        className="btn-icon"
        onClick={() => onDelete(task.id)}
        style={{ padding: "2px 6px", fontSize: 11, opacity: 0.4 }}
      >
        ✕
      </button>
    </div>
  );
}

function MoodBadge({ mood }: { mood: string }) {
  return (
    <div style={{
      padding: "6px 14px", border: "1px solid var(--border)",
      borderRadius: 20, fontSize: 20,
      background: "var(--panel)",
    }}>
      {mood}
    </div>
  );
}

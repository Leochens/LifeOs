import { useState, useEffect } from "react";
import { useStore } from "@/stores/app";
import { writeNote, readNote, listDir } from "@/services/fs";
import { serializeDayNote } from "@/services/parser";
import type { TaskItem, DayNote } from "@/types";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, isSameMonth } from "date-fns";
import { zhCN } from "date-fns/locale";
import { Check, X, Plus, ChevronLeft, ChevronRight } from "lucide-react";

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
    return <div className="text-text-dim">加载中...</div>;
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
    <div className="flex flex-col gap-5 max-w-[900px]">
      {/* Tab bar */}
      <div className="flex gap-0">
        {(["today", "history"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-6 text-sm cursor-pointer font-sans transition-all duration-150 ${
              t === "today"
                ? "rounded-l-sm rounded-r-none"
                : "rounded-r-sm rounded-l-none"
            } ${
              tab === t
                ? "bg-accent/10 text-accent border border-accent/30"
                : "bg-transparent text-text-dim border border-border"
            }`}
            style={{
              padding: "8px 24px",
              background: tab === t ? "rgba(0,200,255,0.1)" : "transparent",
              color: tab === t ? "var(--accent)" : "var(--text-dim)",
              border: `1px solid ${tab === t ? "rgba(0,200,255,0.3)" : "var(--border)"}`,
            }}
          >
            {t === "today" ? "今日" : "历史"}
          </button>
        ))}
      </div>

      {tab === "today" && todayNote && (
        <>
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <div className="font-disp text-[28px] tracking-widest text-accent">
                今日任务
              </div>
              <div className="text-text-dim text-xs font-mono mt-0.5">
                {format(new Date(), "yyyy年MM月dd日 EEEE", { locale: zhCN })}
              </div>
            </div>
            <div className="flex gap-2 items-center">
              {saving && <span className="text-xs text-text-dim">保存中...</span>}
              <MoodBadge mood={todayNote.mood} />
            </div>
          </div>

          {/* Add task */}
          <div className="flex gap-2">
            <input
              className="input"
              placeholder="添加任务... 支持 #标签  (Enter 确认)"
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addTask()}
            />
            <button className="btn btn-primary whitespace-nowrap flex items-center gap-1.5" onClick={addTask}>
              <Plus size={14} /> 添加
            </button>
          </div>

          {/* Progress */}
          {todayNote.tasks.length > 0 && (
            <div>
              <div className="flex justify-between text-xs text-text-dim mb-1.5">
                <span>今日进度</span>
                <span className="text-accent">{done.length}/{todayNote.tasks.length}</span>
              </div>
              <div className="progress-track h-1.5">
                <div className="progress-fill"
                  style={{ width: `${todayNote.tasks.length ? (done.length / todayNote.tasks.length) * 100 : 0}%` }} />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {/* Pending */}
            <div className="panel p-5">
              <div className="flex items-center gap-2 mb-3.5">
                <div className="w-1.5 h-1.5 rounded-full bg-accent5" style={{ boxShadow: "0 0 6px var(--accent5)" }} />
                <span className="label">待完成 ({pending.length})</span>
              </div>
              <div className="flex flex-col gap-1.5">
                {pending.map((task) => (
                  <TaskRow key={task.id} task={task} onToggle={toggleTask} onDelete={deleteTask} />
                ))}
                {pending.length === 0 && (
                  <div className="text-accent3 text-sm py-2.5">
                    全部完成！
                  </div>
                )}
              </div>
            </div>

            {/* Done */}
            <div className="panel p-5">
              <div className="flex items-center gap-2 mb-3.5">
                <div className="w-1.5 h-1.5 rounded-full bg-accent3" style={{ boxShadow: "0 0 6px var(--accent3)" }} />
                <span className="label">已完成 ({done.length})</span>
              </div>
              <div className="flex flex-col gap-1.5">
                {done.map((task) => (
                  <TaskRow key={task.id} task={task} onToggle={toggleTask} onDelete={deleteTask} />
                ))}
                {done.length === 0 && (
                  <div className="text-text-dim text-sm">尚未完成任何任务</div>
                )}
              </div>
            </div>
          </div>

          {/* Notes section */}
          <div className="panel p-5">
            <div className="flex items-center gap-2 mb-3.5">
              <div className="w-1.5 h-1.5 rounded-full bg-accent2" style={{ boxShadow: "0 0 6px var(--accent2)" }} />
              <span className="label">今日笔记</span>
            </div>
            <textarea
              className="input min-h-[120px]"
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
          <div className="font-disp text-[28px] tracking-widest text-accent">
            历史任务
          </div>

          {/* Calendar */}
          <div className="panel p-6">
            {/* Month nav */}
            <div className="flex justify-between items-center mb-6">
              <button
                className="btn btn-ghost px-3.5 text-sm flex items-center gap-1.5 hover:bg-accent/5"
                onClick={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1))}
              >
                <ChevronLeft size={16} /> 上月
              </button>
              <span className="font-disp text-xl text-accent tracking-widest">
                {format(calMonth, "yyyy年MM月", { locale: zhCN })}
              </span>
              <button
                className="btn btn-ghost px-3.5 text-sm flex items-center gap-1.5 hover:bg-accent/5"
                onClick={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1))}
              >
                下月 <ChevronRight size={16} />
              </button>
            </div>

            {/* Weekday headers */}
            <div className="grid grid-cols-7 gap-1.5 text-center mb-3">
              {["日", "一", "二", "三", "四", "五", "六"].map((d, i) => (
                <div key={d} className={`text-xs py-2.5 font-mono font-semibold ${i === 0 || i === 6 ? "text-accent4" : "text-text-dim"}`}>
                  {d}
                </div>
              ))}

              {/* Empty cells for padding */}
              {Array.from({ length: startPad }).map((_, i) => (
                <div key={`pad-${i}`} className="h-13" />
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
                    className="h-13 rounded-xl text-sm relative transition-all duration-200 flex flex-col items-center justify-center cursor-pointer"
                    style={{
                      cursor: hasData ? "pointer" : "default",
                      background: isSelected ? "var(--accent)" : isToday ? "rgba(0,200,255,0.08)" : "transparent",
                      color: isSelected ? "#fff" : !inMonth ? "var(--text-dim)" : "var(--text)",
                      fontWeight: isToday ? 600 : 400,
                      border: isToday && !isSelected ? "1px solid var(--accent)" : "1px solid transparent",
                    }}
                  >
                    <div>{day.getDate()}</div>
                    {hasData && (
                      <div className="w-1 h-1 rounded-full absolute bottom-2"
                        style={{
                          background: isSelected ? "#fff" : "var(--accent3)",
                        }} />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex gap-5 justify-center mt-5 pt-4 border-t border-border">
              <div className="flex items-center gap-2 text-xs text-text-dim">
                <div className="w-2.5 h-2.5 rounded-sm bg-accent" />
                已选择
              </div>
              <div className="flex items-center gap-2 text-xs text-text-dim">
                <div className="w-2.5 h-2.5 rounded-sm bg-accent/10 border border-accent" />
                今日
              </div>
              <div className="flex items-center gap-2 text-xs text-text-dim">
                <div className="w-2.5 h-2.5 rounded-full bg-accent3" />
                有记录
              </div>
            </div>
          </div>

          {/* Selected date tasks (read-only) */}
          {selectedDate && (
            <div className="panel p-5">
              <div className="flex items-center gap-2 mb-3.5">
                <div className="w-1.5 h-1.5 rounded-full bg-accent" style={{ boxShadow: "0 0 6px var(--accent)" }} />
                <span className="label">{selectedDate} 的任务</span>
              </div>
              {selectedNote && selectedNote.tasks.length > 0 ? (
                <div className="flex flex-col gap-1.5">
                  {selectedNote.tasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center gap-2.5 px-3 py-2.25 bg-panel-2 border border-border rounded-sm transition-colors hover:border-accent/20"
                    >
                      <div className={`w-5 h-5 rounded-sm flex-shrink-0 flex items-center justify-center ${
                        task.done ? "bg-accent3 text-black shadow-[0_0_8px_var(--accent3)]" : "bg-transparent border border-border"
                      }`}>
                        {task.done && <Check size={12} strokeWidth={3} />}
                      </div>
                      <span className={`flex-1 text-sm ${task.done ? "line-through text-text-dim" : "text-text"}`}>
                        {task.text}
                      </span>
                      {task.tags.map((tag) => (
                        <span key={tag} className="tag text-[10px]">#{tag}</span>
                      ))}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-text-dim text-sm">
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
    <div className="flex items-center gap-2.5 px-3 py-2.25 bg-panel-2 border border-border rounded-sm transition-all duration-200 hover:border-accent/30 hover:shadow-sm">
      <button
        onClick={() => onToggle(task.id)}
        className={`w-5 h-5 rounded-sm flex-shrink-0 flex items-center justify-center cursor-pointer transition-all duration-150 hover:scale-110 ${
          task.done
            ? "bg-accent3 text-black shadow-[0_0_8px_var(--accent3)]"
            : "bg-transparent border border-border text-transparent hover:border-accent/50"
        }`}
      >
        <Check size={12} strokeWidth={3} />
      </button>
      <span className={`flex-1 text-sm transition-colors ${task.done ? "line-through text-text-dim" : "text-text"}`}>
        {task.text}
      </span>
      {task.tags.map((tag) => (
        <span key={tag} className="tag text-[10px]">#{tag}</span>
      ))}
      <button
        className="w-6 h-6 flex items-center justify-center text-text-dim hover:text-red-400 hover:bg-red-400/10 rounded-sm transition-all duration-150 opacity-40 hover:opacity-100"
        onClick={() => onDelete(task.id)}
      >
        <X size={14} />
      </button>
    </div>
  );
}

function MoodBadge({ mood }: { mood: string }) {
  return (
    <div className="px-3.5 py-1.5 border border-border rounded-full text-xl bg-panel">
      {mood}
    </div>
  );
}

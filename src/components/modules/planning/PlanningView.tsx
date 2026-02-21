import { useState } from "react";
import { useStore } from "@/stores/app";
import { writeNote, readNote, deleteFile } from "@/services/fs";
import type { Goal, GoalType, Priority } from "@/types";

const TYPE_LABELS: Record<GoalType, string> = { annual: "年度目标", quarterly: "季度目标", monthly: "月度目标" };
const PRIORITY_COLORS: Record<Priority, string> = { urgent: "var(--accent4)", high: "var(--accent4)", medium: "var(--accent5)", low: "var(--accent3)" };
const PRIORITY_LABELS: Record<Priority, string> = { urgent: "紧急", high: "高", medium: "中", low: "低" };

export default function PlanningView() {
  const goals = useStore((s) => s.goals);
  const setGoals = useStore((s) => s.setGoals);
  const vaultPath = useStore((s) => s.vaultPath);

  const [showModal, setShowModal] = useState(false);
  const [newGoalTitle, setNewGoalTitle] = useState("");
  const [newGoalType, setNewGoalType] = useState<GoalType>("annual");
  const [newGoalYear, setNewGoalYear] = useState(new Date().getFullYear());
  const [newGoalQuarter, setNewGoalQuarter] = useState(1);
  const [newGoalMonth, setNewGoalMonth] = useState(1);
  const [newGoalPriority, setNewGoalPriority] = useState<Priority>("medium");
  const [newGoalDue, setNewGoalDue] = useState("");
  const [newGoalTags, setNewGoalTags] = useState("");
  const [creating, setCreating] = useState(false);

  // Edit state
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editPriority, setEditPriority] = useState<Priority>("medium");
  const [editProgress, setEditProgress] = useState(0);
  const [editDue, setEditDue] = useState("");
  const [editStatus, setEditStatus] = useState<"active" | "completed" | "archived">("active");

  const resetForm = () => {
    setNewGoalTitle("");
    setNewGoalType("annual");
    setNewGoalYear(new Date().getFullYear());
    setNewGoalQuarter(1);
    setNewGoalMonth(1);
    setNewGoalPriority("medium");
    setNewGoalDue("");
    setNewGoalTags("");
  };

  const createGoal = async () => {
    if (!newGoalTitle.trim() || !vaultPath || creating) return;
    setCreating(true);
    try {
      const slug = newGoalTitle
        .trim()
        .replace(/\s+/g, "-")
        .replace(/[^\p{L}\p{N}_-]/gu, "")
        .slice(0, 30) || `goal-${Date.now()}`;
      const year = newGoalYear;
      const typePrefix = newGoalType === "annual" ? "annual" : newGoalType === "quarterly" ? `q${newGoalQuarter}` : `m${String(newGoalMonth).padStart(2, "0")}`;
      const path = `${vaultPath}/planning/goals/${year}-${typePrefix}-${slug}.md`;
      const tagsArr = newGoalTags ? newGoalTags.split(",").map(t => t.trim()).filter(Boolean) : [];
      const due = newGoalDue || `${year}-12-31`;

      const fm: Record<string, string> = {
        title: newGoalTitle.trim(),
        type: newGoalType,
        year: String(year),
        status: "active",
        progress: "0",
        priority: newGoalPriority,
        due,
        tags: newGoalTags,
      };
      if (newGoalType === "quarterly") fm.quarter = String(newGoalQuarter);
      if (newGoalType === "monthly") fm.month = String(newGoalMonth);

      const content = `## 目标说明

${newGoalTitle.trim()}

## 关键结果

-

## 执行计划

-
`;

      // Write file
      await writeNote(path, fm, content);

      // Directly update store (no loadAll!)
      const newGoal: Goal = {
        path,
        title: newGoalTitle.trim(),
        type: newGoalType,
        year,
        quarter: newGoalType === "quarterly" ? newGoalQuarter : undefined,
        month: newGoalType === "monthly" ? newGoalMonth : undefined,
        progress: 0,
        due,
        tags: tagsArr,
        content,
        status: "active",
        priority: newGoalPriority,
      };
      setGoals([...goals, newGoal]);
      setShowModal(false);
      resetForm();
    } catch (err) {
      console.error("Failed to create goal:", err);
      alert("创建目标失败: " + err);
    } finally {
      setCreating(false);
    }
  };

  const updateProgress = async (goal: Goal, progress: number) => {
    const updated = goals.map((g) => g.path === goal.path ? { ...g, progress } : g);
    setGoals(updated);
    try {
      const note = await readNote(goal.path);
      const fm = { ...note.frontmatter, progress: String(progress) };
      await writeNote(goal.path, fm, note.content);
    } catch { }
  };

  const openEdit = (g: Goal) => {
    setEditingGoal(g);
    setEditTitle(g.title);
    setEditPriority(g.priority || "medium");
    setEditProgress(g.progress);
    setEditDue(g.due);
    setEditStatus(g.status || "active");
  };

  const saveEdit = async () => {
    if (!editingGoal) return;
    try {
      const note = await readNote(editingGoal.path);
      const fm = {
        ...note.frontmatter,
        title: editTitle.trim(),
        priority: editPriority,
        progress: String(editProgress),
        due: editDue,
        status: editStatus,
      };
      await writeNote(editingGoal.path, fm, note.content);
      setGoals(goals.map(g => g.path === editingGoal.path ? {
        ...g, title: editTitle.trim(), priority: editPriority,
        progress: editProgress, due: editDue, status: editStatus,
      } : g));
      setEditingGoal(null);
    } catch (err) {
      console.error("Failed to save goal:", err);
    }
  };

  const removeGoal = async (goal: Goal) => {
    if (!confirm(`确定删除目标「${goal.title}」吗？`)) return;
    try {
      await deleteFile(goal.path);
      setGoals(goals.filter(g => g.path !== goal.path));
    } catch (err) {
      console.error("Failed to delete goal:", err);
    }
  };

  // Group by type
  const grouped: Record<GoalType, Goal[]> = { annual: [], quarterly: [], monthly: [] };
  for (const g of goals) {
    if (grouped[g.type]) grouped[g.type].push(g);
  }

  return (
    <div className="flex flex-col gap-5 max-w-[1100px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="font-disp text-[28px] tracking-widest text-accent">
          目标计划
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          + 新建目标
        </button>
      </div>

      {goals.length === 0 && !showModal && (
        <div className="panel p-10 text-center text-text-dim">
          <div className="text-4xl mb-3">&#9670;</div>
          <div>点击上方"新建目标"创建你的第一个目标</div>
          <div className="text-xs mt-2 font-mono text-accent tracking-widest">
            或在 planning/goals/ 目录下手动创建目标文件
          </div>
        </div>
      )}

      {/* Grouped display */}
      <div className="grid grid-cols-3 gap-4 items-start">
        {(["annual", "quarterly", "monthly"] as GoalType[]).map((type) => (
          <div key={type} className="flex flex-col gap-3">
            <div className="font-mono text-xs tracking-widest text-accent2 uppercase border-b border-border pb-2">
              {TYPE_LABELS[type]} ({grouped[type].length})
            </div>
            {grouped[type].length === 0 && (
              <div className="text-text-dim text-xs py-3">
                暂无{TYPE_LABELS[type]}
              </div>
            )}
            {grouped[type].map((g) => (
              <GoalCard
                key={g.path}
                goal={g}
                onUpdateProgress={(p) => updateProgress(g, p)}
                onEdit={() => openEdit(g)}
                onDelete={() => removeGoal(g)}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Create Goal Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-start justify-center" onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <div className="bg-panel border border-border rounded-lg p-7 flex flex-col gap-4 max-h-[85vh] overflow-y-auto mt-[8vh] w-[480px]">
            <div className="font-disp text-xl tracking-widest text-accent">
              新建目标
            </div>

            <div>
              <label className="label block mb-1.5">标题</label>
              <input className="input" placeholder="输入目标标题..." value={newGoalTitle}
                onChange={(e) => setNewGoalTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createGoal()} />
            </div>

            <div>
              <label className="label block mb-1.5">类型</label>
              <div className="flex gap-2">
                {(["annual", "quarterly", "monthly"] as GoalType[]).map((t) => (
                  <button key={t} onClick={() => setNewGoalType(t)} className={`px-4 py-1.5 text-sm cursor-pointer rounded-sm transition-colors ${
                    newGoalType === t
                      ? "bg-accent/15 text-accent border border-accent/40"
                      : "bg-transparent text-text-dim border border-border"
                  }`}>
                    {TYPE_LABELS[t].replace("目标", "")}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="label block mb-1.5">年份</label>
              <input className="input w-[120px]" type="number" value={newGoalYear}
                onChange={(e) => setNewGoalYear(Number(e.target.value))} />
            </div>

            {newGoalType === "quarterly" && (
              <div>
                <label className="label block mb-1.5">季度</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4].map((q) => (
                    <button key={q} onClick={() => setNewGoalQuarter(q)} className={`px-4 py-1.5 text-sm cursor-pointer rounded-sm transition-colors ${
                      newGoalQuarter === q
                        ? "bg-accent/15 text-accent border border-accent/40"
                        : "bg-transparent text-text-dim border border-border"
                    }`}>Q{q}</button>
                  ))}
                </div>
              </div>
            )}

            {newGoalType === "monthly" && (
              <div>
                <label className="label block mb-1.5">月份</label>
                <div className="flex gap-1.5 flex-wrap">
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <button key={m} onClick={() => setNewGoalMonth(m)} className={`px-3 py-1 text-xs cursor-pointer rounded-sm transition-colors ${
                      newGoalMonth === m
                        ? "bg-accent/15 text-accent border border-accent/40"
                        : "bg-transparent text-text-dim border border-border"
                    }`}>{m}月</button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="label block mb-1.5">优先级</label>
              <div className="flex gap-2">
                {(["low", "medium", "high"] as Priority[]).map((p) => (
                  <button key={p} onClick={() => setNewGoalPriority(p)} className={`px-4 py-1.5 text-sm cursor-pointer rounded-sm transition-colors ${
                    newGoalPriority === p
                      ? "border"
                      : "bg-transparent border border-border"
                  }`}
                  style={{
                    background: newGoalPriority === p ? `${PRIORITY_COLORS[p]}22` : "transparent",
                    color: newGoalPriority === p ? PRIORITY_COLORS[p] : "var(--text-dim)",
                    borderColor: newGoalPriority === p ? `${PRIORITY_COLORS[p]}66` : "var(--border)",
                  }}>
                    {PRIORITY_LABELS[p]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="label block mb-1.5">截止日期</label>
              <input className="input w-[200px]" type="date" value={newGoalDue}
                onChange={(e) => setNewGoalDue(e.target.value)} />
            </div>

            <div>
              <label className="label block mb-1.5">标签 (逗号分隔)</label>
              <input className="input" placeholder="学习, 健康, 工作..."
                value={newGoalTags} onChange={(e) => setNewGoalTags(e.target.value)} />
            </div>

            <div className="flex justify-end gap-2.5 mt-2">
              <button className="btn btn-ghost" onClick={() => { setShowModal(false); resetForm(); }}>取消</button>
              <button className="btn btn-primary" onClick={createGoal} disabled={creating}>
                {creating ? "创建中..." : "创建目标"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Goal Modal */}
      {editingGoal && (
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-start justify-center" onClick={(e) => e.target === e.currentTarget && setEditingGoal(null)}>
          <div className="bg-panel border border-border rounded-lg p-7 flex flex-col gap-4 max-h-[85vh] overflow-y-auto mt-[8vh] w-[480px]">
            <div className="font-disp text-xl tracking-widest text-accent">
              编辑目标
            </div>
            <div>
              <label className="block text-xs text-text-dim mb-1.5">标题</label>
              <input className="input w-full" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-text-dim mb-1.5">状态</label>
              <div className="flex gap-1.5">
                {(["active", "completed", "archived"] as const).map((s) => (
                  <button key={s} onClick={() => setEditStatus(s)} className={`px-3.5 py-1.5 text-xs cursor-pointer rounded-sm transition-colors ${
                    editStatus === s
                      ? "bg-accent/15 text-accent border border-accent/40"
                      : "bg-transparent text-text-dim border border-border"
                  }`}>
                    {s === "active" ? "进行中" : s === "completed" ? "已完成" : "已归档"}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs text-text-dim mb-1.5">优先级</label>
              <div className="flex gap-1.5">
                {(["low", "medium", "high"] as Priority[]).map((p) => (
                  <button key={p} onClick={() => setEditPriority(p)} className={`px-3.5 py-1.5 text-xs cursor-pointer rounded-sm transition-colors ${
                    editPriority === p
                      ? "border"
                      : "bg-transparent border border-border"
                  }`}
                  style={{
                    background: editPriority === p ? `${PRIORITY_COLORS[p]}22` : "transparent",
                    color: editPriority === p ? PRIORITY_COLORS[p] : "var(--text-dim)",
                    borderColor: editPriority === p ? `${PRIORITY_COLORS[p]}55` : "var(--border)",
                  }}>
                    {PRIORITY_LABELS[p]}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs text-text-dim mb-1.5">进度: {editProgress}%</label>
              <input type="range" min={0} max={100} value={editProgress}
                onChange={(e) => setEditProgress(Number(e.target.value))}
                className="w-full accent-accent" />
            </div>
            <div>
              <label className="block text-xs text-text-dim mb-1.5">截止日期</label>
              <input className="input w-[200px]" type="date" value={editDue}
                onChange={(e) => setEditDue(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2.5 mt-2">
              <button className="btn btn-ghost" onClick={() => setEditingGoal(null)}>取消</button>
              <button className="btn btn-primary" onClick={saveEdit}>保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function GoalCard({ goal, onUpdateProgress, onEdit, onDelete }: {
  goal: Goal;
  onUpdateProgress: (p: number) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [showActions, setShowActions] = useState(false);
  const g = goal;

  return (
    <div
      className="panel p-4 relative overflow-hidden"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className="absolute left-0 top-0 bottom-0 w-0.75 bg-gradient-to-b from-accent to-accent-2" />
      <div className="ml-2.5">
        {/* Title + badges + actions */}
        <div className="flex justify-between items-center mb-1.5">
          <div className="text-sm font-medium flex-1">{g.title}</div>
          <div className="flex gap-1 items-center flex-shrink-0">
            {showActions && (
              <>
                <button onClick={onEdit} className="w-5.5 h-5.5 rounded-sm border-none bg-accent/12 text-accent cursor-pointer text-xs flex items-center justify-center" title="编辑">&#9998;</button>
                <button onClick={onDelete} className="w-5.5 h-5.5 rounded-sm border-none bg-accent4/10 text-accent4 cursor-pointer text-xs flex items-center justify-center" title="删除">&#10005;</button>
              </>
            )}
            {g.priority && (
              <span className="text-[10px] px-2 py-0.5 rounded-full ml-1"
                style={{
                  background: `${PRIORITY_COLORS[g.priority]}22`,
                  color: PRIORITY_COLORS[g.priority],
                  border: `1px solid ${PRIORITY_COLORS[g.priority]}44`,
                }}>
                {PRIORITY_LABELS[g.priority]}
              </span>
            )}
            {g.status && (
              <span className="text-[10px] px-2 py-0.5 rounded-full"
                style={{
                  background: g.status === "completed" ? "rgba(0,200,100,0.15)" : g.status === "archived" ? "rgba(128,128,128,0.15)" : "rgba(0,200,255,0.1)",
                  color: g.status === "completed" ? "var(--accent3)" : g.status === "archived" ? "var(--text-dim)" : "var(--accent)",
                  border: `1px solid ${g.status === "completed" ? "rgba(0,200,100,0.3)" : g.status === "archived" ? "rgba(128,128,128,0.3)" : "rgba(0,200,255,0.25)"}`,
                }}>
                {g.status === "active" ? "进行中" : g.status === "completed" ? "已完成" : "已归档"}
              </span>
            )}
          </div>
        </div>

        {g.due && (
          <div className="text-xs text-text-dim mb-2">截止: {g.due}</div>
        )}

        <div className="flex items-center gap-2 mb-2">
          <input type="range" min={0} max={100} value={g.progress}
            onChange={(e) => onUpdateProgress(Number(e.target.value))}
            className="flex-1 accent-accent cursor-pointer" />
          <span className="text-xs text-accent font-mono min-w-[36px] text-right">
            {g.progress}%
          </span>
        </div>

        <div className="progress-track h-1">
          <div className="progress-fill" style={{ width: `${g.progress}%` }} />
        </div>

        {g.tags.length > 0 && (
          <div className="mt-2 flex gap-1.5 flex-wrap">
            {g.tags.map((t) => <span key={t} className="tag">{t}</span>)}
          </div>
        )}
      </div>
    </div>
  );
}

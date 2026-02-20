import { useState } from "react";
import { useStore } from "@/stores/app";
import { writeNote, readNote } from "@/services/tauri";
import { useVaultLoader } from "@/hooks/useVaultLoader";
import type { Goal, GoalType, Priority } from "@/types";

const TYPE_LABELS: Record<GoalType, string> = { annual: "年度目标", quarterly: "季度目标", monthly: "月度目标" };
const PRIORITY_COLORS: Record<Priority, string> = { urgent: "var(--accent4)", high: "var(--accent4)", medium: "var(--accent5)", low: "var(--accent3)" };
const PRIORITY_LABELS: Record<Priority, string> = { urgent: "紧急", high: "高", medium: "中", low: "低" };

export default function PlanningView() {
  const goals = useStore((s) => s.goals);
  const setGoals = useStore((s) => s.setGoals);
  const vaultPath = useStore((s) => s.vaultPath);
  const { loadAll } = useVaultLoader();

  const [showModal, setShowModal] = useState(false);
  const [newGoalTitle, setNewGoalTitle] = useState("");
  const [newGoalType, setNewGoalType] = useState<GoalType>("annual");
  const [newGoalYear, setNewGoalYear] = useState(new Date().getFullYear());
  const [newGoalQuarter, setNewGoalQuarter] = useState(1);
  const [newGoalMonth, setNewGoalMonth] = useState(1);
  const [newGoalPriority, setNewGoalPriority] = useState<Priority>("medium");
  const [newGoalDue, setNewGoalDue] = useState("");
  const [newGoalTags, setNewGoalTags] = useState("");

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
    if (!newGoalTitle.trim() || !vaultPath) return;
    const slug = newGoalTitle.toLowerCase().replace(/\s+/g, "-").replace(/[^\w-]/g, "").slice(0, 30);
    const year = newGoalYear;
    const typePrefix = newGoalType === "annual" ? "annual" : newGoalType === "quarterly" ? `q${newGoalQuarter}` : `m${String(newGoalMonth).padStart(2, "0")}`;
    const path = `${vaultPath}/planning/goals/${year}-${typePrefix}-${slug}.md`;
    const fm: Record<string, string> = {
      title: newGoalTitle,
      type: newGoalType,
      year: String(year),
      status: "active",
      progress: "0",
      priority: newGoalPriority,
      due: newGoalDue || `${year}-12-31`,
      tags: newGoalTags,
    };
    if (newGoalType === "quarterly") fm.quarter = String(newGoalQuarter);
    if (newGoalType === "monthly") fm.month = String(newGoalMonth);
    const content = `## 目标说明\n\n${newGoalTitle}\n\n## 关键结果\n\n- \n\n## 执行计划\n\n- \n`;
    await writeNote(path, fm, content);
    await loadAll();
    setShowModal(false);
    resetForm();
  };

  const updateProgress = async (goal: Goal, progress: number) => {
    // Optimistic update
    const updated = goals.map((g) => g.path === goal.path ? { ...g, progress } : g);
    setGoals(updated);
    // Persist
    try {
      const note = await readNote(goal.path);
      const fm = { ...note.frontmatter, progress: String(progress) };
      await writeNote(goal.path, fm, note.content);
    } catch {}
  };

  // Group by type
  const grouped: Record<GoalType, Goal[]> = { annual: [], quarterly: [], monthly: [] };
  for (const g of goals) {
    if (grouped[g.type]) grouped[g.type].push(g);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontFamily: "var(--font-disp)", fontSize: 28, letterSpacing: 3, color: "var(--accent)" }}>
          目标计划
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          + 新建目标
        </button>
      </div>

      {goals.length === 0 && !showModal && (
        <div className="panel" style={{ padding: 40, textAlign: "center", color: "var(--text-dim)" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>&#9670;</div>
          <div>点击上方"新建目标"创建你的第一个目标</div>
          <div style={{ fontSize: 12, marginTop: 8, fontFamily: "var(--font-mono)", color: "var(--accent)", letterSpacing: 1 }}>
            或在 planning/goals/ 目录下手动创建目标文件
          </div>
        </div>
      )}

      {/* Grouped display */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, alignItems: "start" }}>
        {(["annual", "quarterly", "monthly"] as GoalType[]).map((type) => (
          <div key={type} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{
              fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: 2,
              color: "var(--accent2)", textTransform: "uppercase",
              borderBottom: "1px solid var(--border)", paddingBottom: 8,
            }}>
              {TYPE_LABELS[type]} ({grouped[type].length})
            </div>
            {grouped[type].length === 0 && (
              <div style={{ color: "var(--text-dim)", fontSize: 12, padding: "12px 0" }}>
                暂无{TYPE_LABELS[type]}
              </div>
            )}
            {grouped[type].map((g) => (
              <div key={g.path} className="panel" style={{ padding: 16, position: "relative", overflow: "hidden" }}>
                <div style={{
                  position: "absolute", left: 0, top: 0, bottom: 0, width: 3,
                  background: "linear-gradient(to bottom, var(--accent), var(--accent2))",
                }} />
                <div style={{ marginLeft: 10 }}>
                  {/* Title + badges */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, flex: 1 }}>{g.title}</div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
                      {/* Priority badge */}
                      {g.priority && (
                        <span style={{
                          fontSize: 10, padding: "2px 8px", borderRadius: 10,
                          background: `${PRIORITY_COLORS[g.priority]}22`,
                          color: PRIORITY_COLORS[g.priority],
                          border: `1px solid ${PRIORITY_COLORS[g.priority]}44`,
                        }}>
                          {PRIORITY_LABELS[g.priority]}
                        </span>
                      )}
                      {/* Status badge */}
                      {g.status && (
                        <span style={{
                          fontSize: 10, padding: "2px 8px", borderRadius: 10,
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
                    <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 8 }}>
                      截止: {g.due}
                    </div>
                  )}

                  {/* Progress with range slider */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={g.progress}
                      onChange={(e) => updateProgress(g, Number(e.target.value))}
                      style={{ flex: 1, accentColor: "var(--accent)", cursor: "pointer" }}
                    />
                    <span style={{ fontSize: 11, color: "var(--accent)", fontFamily: "var(--font-mono)", minWidth: 36, textAlign: "right" }}>
                      {g.progress}%
                    </span>
                  </div>

                  <div className="progress-track" style={{ height: 4 }}>
                    <div className="progress-fill" style={{ width: `${g.progress}%` }} />
                  </div>

                  {g.tags.length > 0 && (
                    <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {g.tags.map((t) => <span key={t} className="tag">{t}</span>)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Create Goal Modal */}
      {showModal && (
        <div className="modal-overlay" style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
        }} onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal" style={{
            background: "var(--panel)", border: "1px solid var(--border)",
            borderRadius: "var(--radius)", padding: 28, width: 480,
            display: "flex", flexDirection: "column", gap: 16,
          }}>
            <div style={{ fontFamily: "var(--font-disp)", fontSize: 20, letterSpacing: 2, color: "var(--accent)" }}>
              新建目标
            </div>

            {/* Title */}
            <div>
              <label className="label" style={{ display: "block", marginBottom: 6 }}>标题</label>
              <input
                className="input"
                placeholder="输入目标标题..."
                value={newGoalTitle}
                onChange={(e) => setNewGoalTitle(e.target.value)}
              />
            </div>

            {/* Type */}
            <div>
              <label className="label" style={{ display: "block", marginBottom: 6 }}>类型</label>
              <div style={{ display: "flex", gap: 8 }}>
                {(["annual", "quarterly", "monthly"] as GoalType[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setNewGoalType(t)}
                    style={{
                      padding: "6px 16px", fontSize: 13, cursor: "pointer",
                      borderRadius: "var(--radius-sm)",
                      background: newGoalType === t ? "rgba(0,200,255,0.15)" : "transparent",
                      color: newGoalType === t ? "var(--accent)" : "var(--text-dim)",
                      border: `1px solid ${newGoalType === t ? "rgba(0,200,255,0.4)" : "var(--border)"}`,
                      transition: "all 0.15s",
                    }}
                  >
                    {TYPE_LABELS[t].replace("目标", "")}
                  </button>
                ))}
              </div>
            </div>

            {/* Year */}
            <div>
              <label className="label" style={{ display: "block", marginBottom: 6 }}>年份</label>
              <input
                className="input"
                type="number"
                value={newGoalYear}
                onChange={(e) => setNewGoalYear(Number(e.target.value))}
                style={{ width: 120 }}
              />
            </div>

            {/* Quarter (conditional) */}
            {newGoalType === "quarterly" && (
              <div>
                <label className="label" style={{ display: "block", marginBottom: 6 }}>季度</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {[1, 2, 3, 4].map((q) => (
                    <button
                      key={q}
                      onClick={() => setNewGoalQuarter(q)}
                      style={{
                        padding: "6px 16px", fontSize: 13, cursor: "pointer",
                        borderRadius: "var(--radius-sm)",
                        background: newGoalQuarter === q ? "rgba(0,200,255,0.15)" : "transparent",
                        color: newGoalQuarter === q ? "var(--accent)" : "var(--text-dim)",
                        border: `1px solid ${newGoalQuarter === q ? "rgba(0,200,255,0.4)" : "var(--border)"}`,
                      }}
                    >
                      Q{q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Month (conditional) */}
            {newGoalType === "monthly" && (
              <div>
                <label className="label" style={{ display: "block", marginBottom: 6 }}>月份</label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <button
                      key={m}
                      onClick={() => setNewGoalMonth(m)}
                      style={{
                        padding: "4px 12px", fontSize: 12, cursor: "pointer",
                        borderRadius: "var(--radius-sm)",
                        background: newGoalMonth === m ? "rgba(0,200,255,0.15)" : "transparent",
                        color: newGoalMonth === m ? "var(--accent)" : "var(--text-dim)",
                        border: `1px solid ${newGoalMonth === m ? "rgba(0,200,255,0.4)" : "var(--border)"}`,
                      }}
                    >
                      {m}月
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Priority */}
            <div>
              <label className="label" style={{ display: "block", marginBottom: 6 }}>优先级</label>
              <div style={{ display: "flex", gap: 8 }}>
                {(["low", "medium", "high"] as Priority[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setNewGoalPriority(p)}
                    style={{
                      padding: "6px 16px", fontSize: 13, cursor: "pointer",
                      borderRadius: "var(--radius-sm)",
                      background: newGoalPriority === p ? `${PRIORITY_COLORS[p]}22` : "transparent",
                      color: newGoalPriority === p ? PRIORITY_COLORS[p] : "var(--text-dim)",
                      border: `1px solid ${newGoalPriority === p ? `${PRIORITY_COLORS[p]}66` : "var(--border)"}`,
                    }}
                  >
                    {PRIORITY_LABELS[p]}
                  </button>
                ))}
              </div>
            </div>

            {/* Due date */}
            <div>
              <label className="label" style={{ display: "block", marginBottom: 6 }}>截止日期</label>
              <input
                className="input"
                type="date"
                value={newGoalDue}
                onChange={(e) => setNewGoalDue(e.target.value)}
                style={{ width: 200 }}
              />
            </div>

            {/* Tags */}
            <div>
              <label className="label" style={{ display: "block", marginBottom: 6 }}>标签 (逗号分隔)</label>
              <input
                className="input"
                placeholder="学习, 健康, 工作..."
                value={newGoalTags}
                onChange={(e) => setNewGoalTags(e.target.value)}
              />
            </div>

            {/* Actions */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
              <button className="btn btn-ghost" onClick={() => { setShowModal(false); resetForm(); }}>
                取消
              </button>
              <button className="btn btn-primary" onClick={createGoal}>
                创建目标
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

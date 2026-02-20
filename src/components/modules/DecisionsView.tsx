import { useState } from "react";
import { useStore } from "@/stores/app";
import { writeNote, runShellCommand } from "@/services/tauri";
import { useVaultLoader } from "@/hooks/useVaultLoader";
import type { Decision, DecisionWeight } from "@/types";
import { format } from "date-fns";

const STATUS_LABELS: Record<Decision["status"], { label: string; color: string }> = {
  pending:  { label: "思考中", color: "var(--accent5)" },
  decided:  { label: "已决定", color: "var(--accent3)" },
  archived: { label: "已归档", color: "var(--text-dim)" },
};

const WEIGHT_LABELS: Record<Decision["weight"], string> = {
  low: "低", medium: "中", high: "高", critical: "关键",
};

const WEIGHT_OPTIONS: { value: DecisionWeight; label: string; color: string }[] = [
  { value: "low", label: "低", color: "var(--text-dim)" },
  { value: "medium", label: "中", color: "var(--accent5)" },
  { value: "high", label: "高", color: "var(--accent2)" },
  { value: "critical", label: "关键", color: "var(--accent4)" },
];

export default function DecisionsView() {
  const decisions = useStore((s) => s.decisions);
  const vaultPath = useStore((s) => s.vaultPath);
  const { loadAll } = useVaultLoader();
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newWeight, setNewWeight] = useState<DecisionWeight>("medium");
  const [newContent, setNewContent] = useState("");

  const createDecision = async () => {
    if (!newTitle.trim() || !vaultPath) return;
    const today = format(new Date(), "yyyy-MM-dd");
    const slug = newTitle.toLowerCase().replace(/\s+/g, "-").replace(/[^\w-]/g, "").slice(0, 40);
    const path = `${vaultPath}/decisions/${today}-${slug}.md`;

    const fm = {
      title: newTitle,
      created: today,
      status: "pending",
      weight: newWeight,
      decided_on: "~",
      outcome: "~",
      review_date: "~",
    };

    const background = newContent.trim() || "描述这个决策的背景...";
    const content = `## 背景\n\n${background}\n\n## 支持理由\n\n- \n\n## 反对理由\n\n- \n\n## 最终决定\n\n_待定_\n`;
    await writeNote(path, fm, content);
    await loadAll();
    setCreating(false);
    setNewTitle("");
    setNewWeight("medium");
    setNewContent("");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 900 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontFamily: "var(--font-disp)", fontSize: 28, letterSpacing: 3, color: "var(--accent)" }}>
          重大决策
        </div>
        <button className="btn btn-primary" onClick={() => setCreating(true)}>+ 记录新决策</button>
      </div>

      {creating && (
        <div className="panel" style={{ padding: 20 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <div style={{ fontSize: 13, color: "var(--text-mid)", marginBottom: 6 }}>决策标题</div>
              <input
                className="input"
                autoFocus
                placeholder="用一句话描述这个决策..."
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Escape") setCreating(false); }}
                style={{ width: "100%" }}
              />
            </div>
            <div>
              <div style={{ fontSize: 13, color: "var(--text-mid)", marginBottom: 6 }}>重要性</div>
              <div style={{ display: "flex", gap: 6 }}>
                {WEIGHT_OPTIONS.map((w) => (
                  <button
                    key={w.value}
                    onClick={() => setNewWeight(w.value)}
                    style={{
                      padding: "5px 14px",
                      borderRadius: 20,
                      fontSize: 12,
                      border: `1px solid ${newWeight === w.value ? w.color : "var(--border)"}`,
                      background: newWeight === w.value ? `${w.color}18` : "transparent",
                      color: newWeight === w.value ? w.color : "var(--text-dim)",
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                  >
                    {w.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 13, color: "var(--text-mid)", marginBottom: 6 }}>背景描述</div>
              <textarea
                className="input"
                placeholder="简要描述这个决策的背景和上下文..."
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                rows={3}
                style={{ width: "100%", resize: "vertical" }}
              />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-primary" onClick={createDecision}>创建</button>
              <button className="btn btn-ghost" onClick={() => { setCreating(false); setNewTitle(""); setNewWeight("medium"); setNewContent(""); }}>取消</button>
            </div>
          </div>
        </div>
      )}

      {decisions.map((d) => <DecisionCard key={d.path} decision={d} />)}

      {decisions.length === 0 && !creating && (
        <div className="panel" style={{ padding: 40, textAlign: "center", color: "var(--text-dim)" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⊙</div>
          <div>还没有记录任何决策</div>
          <div style={{ fontSize: 12, marginTop: 8 }}>重大决策值得被认真对待和记录</div>
        </div>
      )}
    </div>
  );
}

function DecisionCard({ decision }: { decision: Decision }) {
  const st = STATUS_LABELS[decision.status];
  const lines = decision.content.split("\n");
  const prosStart = lines.findIndex((l) => l.includes("支持理由"));
  const consStart = lines.findIndex((l) => l.includes("反对理由"));

  const pros = prosStart >= 0
    ? lines.slice(prosStart + 1, consStart >= 0 ? consStart : undefined)
        .filter((l) => l.trim().startsWith("-")).map((l) => l.replace(/^-\s*/, ""))
    : [];
  const cons = consStart >= 0
    ? lines.slice(consStart + 1).filter((l) => l.trim().startsWith("-")).map((l) => l.replace(/^-\s*/, "")).slice(0, 5)
    : [];

  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [claudeError, setClaudeError] = useState<string | null>(null);

  const runAnalysis = async () => {
    setAnalyzing(true);
    setClaudeError(null);
    const prompt = `请分析以下决策，给出专业的利弊分析和建议：

决策标题：${decision.title}
重要性：${WEIGHT_LABELS[decision.weight]}
状态：${STATUS_LABELS[decision.status].label}

${decision.content}

请从以下角度分析：
1. 核心权衡点
2. 支持理由的合理性
3. 反对理由的合理性
4. 最终建议
5. 需要考虑的风险

请用简洁的中文回答。`;

    try {
      const result = await runShellCommand("claude", ["-p", prompt]);
      setAnalysis(result);
      setShowAnalysis(true);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      if (errMsg.includes("Failed to run") || errMsg.includes("not found")) {
        setClaudeError("需要安装 Claude CLI。请运行：npm install -g @anthropic-ai/claude-code");
      } else {
        setClaudeError(errMsg.slice(0, 200));
      }
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="panel" style={{ padding: 24 }}>
      <div style={{ display: "flex", alignItems: "start", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>{decision.title}</div>
          <div style={{
            fontFamily: "var(--font-mono)", fontSize: 10,
            color: "var(--text-dim)", letterSpacing: 1,
          }}>
            {decision.created} · 重要性: {WEIGHT_LABELS[decision.weight]}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            className="btn btn-ghost"
            onClick={analyzing ? undefined : runAnalysis}
            style={{
              fontSize: 11,
              padding: "3px 10px",
              opacity: analyzing ? 0.7 : 1,
              cursor: analyzing ? "wait" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <span className={analyzing ? "spin" : ""} style={{ display: "inline-block" }}>
              {analyzing ? "⟳" : "🤖"}
            </span>
            {analyzing ? "分析中..." : "AI 分析"}
          </button>
          <span style={{
            fontSize: 11, padding: "3px 10px", borderRadius: 20,
            background: `${st.color}18`, color: st.color, letterSpacing: 1,
            border: `1px solid ${st.color}40`,
            whiteSpace: "nowrap",
          }}>
            {st.label}
          </span>
        </div>
      </div>

      {claudeError && (
        <div style={{ fontSize: 11, color: "var(--accent4)", marginBottom: 12, padding: "6px 10px", background: "rgba(255,107,107,0.08)", borderRadius: "var(--radius-sm)" }}>
          {claudeError}
        </div>
      )}

      {analysis && (
        <div style={{ marginBottom: 16 }}>
          <div
            onClick={() => setShowAnalysis(!showAnalysis)}
            style={{
              fontSize: 12, color: "var(--accent2)", cursor: "pointer",
              display: "flex", alignItems: "center", gap: 6, marginBottom: showAnalysis ? 10 : 0,
              userSelect: "none",
            }}
          >
            <span style={{ transform: showAnalysis ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s", display: "inline-block" }}>
              ▶
            </span>
            🤖 AI 分析结果
          </div>
          {showAnalysis && (
            <div style={{
              background: "var(--panel2)",
              borderLeft: "3px solid var(--accent2)",
              borderRadius: "0 var(--radius-sm) var(--radius-sm) 0",
              padding: "14px 16px",
              fontSize: 13,
              color: "var(--text-mid)",
              whiteSpace: "pre-wrap",
              lineHeight: 1.7,
            }}>
              {analysis}
            </div>
          )}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{
          background: "var(--panel2)", border: "1px solid var(--border)",
          borderRadius: "var(--radius-sm)", padding: 14,
        }}>
          <div style={{ fontSize: 10, letterSpacing: 2, color: "var(--accent3)", marginBottom: 10, textTransform: "uppercase" }}>
            ✦ 支持理由
          </div>
          <ul style={{ paddingLeft: 16 }}>
            {pros.slice(0, 5).map((p, i) => (
              <li key={i} style={{ fontSize: 13, color: "var(--text-mid)", marginBottom: 5, lineHeight: 1.5 }}>{p}</li>
            ))}
            {pros.length === 0 && <li style={{ fontSize: 13, color: "var(--text-dim)" }}>待补充...</li>}
          </ul>
        </div>
        <div style={{
          background: "var(--panel2)", border: "1px solid var(--border)",
          borderRadius: "var(--radius-sm)", padding: 14,
        }}>
          <div style={{ fontSize: 10, letterSpacing: 2, color: "var(--accent4)", marginBottom: 10, textTransform: "uppercase" }}>
            ✦ 反对理由
          </div>
          <ul style={{ paddingLeft: 16 }}>
            {cons.slice(0, 5).map((c, i) => (
              <li key={i} style={{ fontSize: 13, color: "var(--text-mid)", marginBottom: 5, lineHeight: 1.5 }}>{c}</li>
            ))}
            {cons.length === 0 && <li style={{ fontSize: 13, color: "var(--text-dim)" }}>待补充...</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}

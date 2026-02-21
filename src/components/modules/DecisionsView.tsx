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
    const content = `## 背景

${background}

## 支持理由

-

## 反对理由

-

## 最终决定

_待定_
`;
    await writeNote(path, fm, content);
    await loadAll();
    setCreating(false);
    setNewTitle("");
    setNewWeight("medium");
    setNewContent("");
  };

  return (
    <div className="flex flex-col gap-5 max-w-[900px]">
      <div className="flex items-center justify-between">
        <div className="font-disp text-[28px] tracking-widest text-accent">
          重大决策
        </div>
        <button className="btn btn-primary" onClick={() => setCreating(true)}>+ 记录新决策</button>
      </div>

      {creating && (
        <div className="panel p-5">
          <div className="flex flex-col gap-3.5">
            <div>
              <div className="text-sm text-text-mid mb-1.5">决策标题</div>
              <input
                className="input w-full"
                autoFocus
                placeholder="用一句话描述这个决策..."
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Escape") setCreating(false); }}
              />
            </div>
            <div>
              <div className="text-sm text-text-mid mb-1.5">重要性</div>
              <div className="flex gap-1.5">
                {WEIGHT_OPTIONS.map((w) => (
                  <button
                    key={w.value}
                    onClick={() => setNewWeight(w.value)}
                    className="px-3.5 py-1.25 rounded-full text-xs cursor-pointer transition-colors duration-150"
                    style={{
                      border: `1px solid ${newWeight === w.value ? w.color : "var(--border)"}`,
                      background: newWeight === w.value ? `${w.color}18` : "transparent",
                      color: newWeight === w.value ? w.color : "var(--text-dim)",
                    }}
                  >
                    {w.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="text-sm text-text-mid mb-1.5">背景描述</div>
              <textarea
                className="input w-full resize-y"
                placeholder="简要描述这个决策的背景和上下文..."
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                rows={3}
              />
            </div>
            <div className="flex gap-2">
              <button className="btn btn-primary" onClick={createDecision}>创建</button>
              <button className="btn btn-ghost" onClick={() => { setCreating(false); setNewTitle(""); setNewWeight("medium"); setNewContent(""); }}>取消</button>
            </div>
          </div>
        </div>
      )}

      {decisions.map((d) => <DecisionCard key={d.path} decision={d} />)}

      {decisions.length === 0 && !creating && (
        <div className="panel p-10 text-center text-text-dim">
          <div className="text-4xl mb-3">⊙</div>
          <div>还没有记录任何决策</div>
          <div className="text-xs mt-2">重大决策值得被认真对待和记录</div>
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
    // Extract key info to keep prompt concise
    const pros = decision.content.includes("支持理由")
      ? decision.content.split("支持理由")[1]?.split("反对理由")[0] || ""
      : "";
    const cons = decision.content.includes("反对理由")
      ? decision.content.split("反对理由")[1]?.split("最终决定")[0] || ""
      : "";

    const prompt = `分析这个决策。标题：${decision.title}，重要性：${WEIGHT_LABELS[decision.weight]}。

支持理由：${pros.slice(0, 200)}
反对理由：${cons.slice(0, 200)}

请用 3-4 句话给出建议。`;

    try {
      const result = await runShellCommand("claude", ["-p", prompt]);
      setAnalysis(result);
      setShowAnalysis(true);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error("Claude analysis error:", errMsg);
      if (errMsg.includes("Failed to run") || errMsg.includes("not found") || errMsg.includes("ENOENT")) {
        setClaudeError("需要安装 Claude CLI。请运行：npm install -g @anthropic-ai/claude-code");
      } else if (errMsg.includes("Session") || errMsg.includes("session")) {
        setClaudeError("无法在嵌套会话中运行。请直接在终端中运行此应用。");
      } else if (errMsg.length > 100) {
        setClaudeError("分析失败: " + errMsg.slice(0, 100) + "...");
      } else {
        setClaudeError(errMsg);
      }
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="panel p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="text-base font-semibold mb-1">{decision.title}</div>
          <div className="font-mono text-[10px] text-text-dim tracking-widest">
            {decision.created} · 重要性: {WEIGHT_LABELS[decision.weight]}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="btn btn-ghost text-xs px-2.5 py-0.75 flex items-center gap-1"
            onClick={analyzing ? undefined : runAnalysis}
          >
            <span className={analyzing ? "animate-spin" : ""}>
              {analyzing ? "⟳" : "🤖"}
            </span>
            {analyzing ? "分析中..." : "AI 分析"}
          </button>
          <span className="text-xs px-2.5 py-0.75 rounded-full whitespace-nowrap"
            style={{
              background: `${st.color}18`, color: st.color,
              border: `1px solid ${st.color}40`,
            }}>
            {st.label}
          </span>
        </div>
      </div>

      {claudeError && (
        <div className="text-xs text-accent4 mb-3 px-2.5 py-1.5 bg-accent4/8 rounded-sm">
          {claudeError}
        </div>
      )}

      {analysis && (
        <div className="mb-4">
          <div
            onClick={() => setShowAnalysis(!showAnalysis)}
            className="text-xs text-accent2 cursor-pointer flex items-center gap-1.5 mb-2.5 select-none"
          >
            <span className="inline-block transition-transform duration-150" style={{ transform: showAnalysis ? "rotate(90deg)" : "rotate(0deg)" }}>
              ▶
            </span>
            🤖 AI 分析结果
          </div>
          {showAnalysis && (
            <div className="bg-panel-2 border-l-[3px] border-accent2 rounded-r-sm p-3.5 text-sm text-text-mid whitespace-pre-wrap leading-relaxed">
              {analysis}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-panel-2 border border-border rounded-sm p-3.5">
          <div className="text-[10px] tracking-widest text-accent3 mb-2.5 uppercase">
            ✦ 支持理由
          </div>
          <ul className="pl-4">
            {pros.slice(0, 5).map((p, i) => (
              <li key={i} className="text-sm text-text-mid mb-1.25 leading-relaxed">{p}</li>
            ))}
            {pros.length === 0 && <li className="text-sm text-text-dim">待补充...</li>}
          </ul>
        </div>
        <div className="bg-panel-2 border border-border rounded-sm p-3.5">
          <div className="text-[10px] tracking-widest text-accent4 mb-2.5 uppercase">
            ✦ 反对理由
          </div>
          <ul className="pl-4">
            {cons.slice(0, 5).map((c, i) => (
              <li key={i} className="text-sm text-text-mid mb-1.25 leading-relaxed">{c}</li>
            ))}
            {cons.length === 0 && <li className="text-sm text-text-dim">待补充...</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect } from "react";
import { useStore } from "@/stores/app";
import { writeNote } from "@/services/tauri";
import { useVaultLoader } from "@/hooks/useVaultLoader";
import type { DiaryEntry } from "@/types";
import { format } from "date-fns";

const MOODS = ["😴", "😔", "😐", "😊", "🔥", "🎯", "🤔", "😌"];

export default function DiaryView() {
  const diaryEntries = useStore((s) => s.diaryEntries);
  const vaultPath = useStore((s) => s.vaultPath);
  const { loadAll } = useVaultLoader();

  const [active, setActive] = useState<DiaryEntry | null>(diaryEntries[0] ?? null);
  const [editing, setEditing] = useState<DiaryEntry | null>(null);
  const [saving, setSaving] = useState(false);
  const [newDate, setNewDate] = useState(format(new Date(), "yyyy-MM-dd"));

  useEffect(() => {
    if (diaryEntries.length && !active) setActive(diaryEntries[0]);
  }, [diaryEntries]);

  const open = (e: DiaryEntry) => { setActive(e); setEditing({ ...e }); };

  const save = async () => {
    if (!editing || !vaultPath) return;
    setSaving(true);
    try {
      const fm = {
        date: editing.date,
        title: editing.title || "",
        mood: editing.mood,
        energy: editing.energy,
        tags: editing.tags.join(", "),
      };
      await writeNote(editing.path, fm, editing.content);
      await loadAll();
    } finally {
      setSaving(false);
    }
  };

  const newEntry = async (targetDateStr?: string) => {
    if (!vaultPath) return;
    const dateStr = targetDateStr || newDate || format(new Date(), "yyyy-MM-dd");
    const year = dateStr.slice(0, 4);
    const now = new Date();
    const timeStr = format(now, "HHmm");
    const filename = `${dateStr}-${timeStr}.md`;
    const path = `${vaultPath}/diary/${year}/${filename}`;
    const fm = { date: dateStr, mood: "😊", energy: "high", tags: "" };
    await writeNote(path, fm, `# ${dateStr}\n\n`);
    await loadAll();
  };

  // Group entries by date
  const grouped = diaryEntries.reduce((acc, e) => {
    const d = e.date;
    if (!acc[d]) acc[d] = [];
    acc[d].push(e);
    return acc;
  }, {} as Record<string, DiaryEntry[]>);
  const sortedDates = Object.keys(grouped).sort().reverse();

  const current = editing ?? active;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 16, height: "calc(100vh - 120px)" }}>
      {/* List */}
      <div style={{ display: "flex", flexDirection: "column", gap: 0, overflow: "auto" }}>
        {/* New entry controls */}
        <div style={{ display: "flex", gap: 6, marginBottom: 12, alignItems: "stretch" }}>
          <input
            type="date"
            className="input"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            style={{ flex: 1, fontSize: 12, padding: "6px 8px" }}
          />
          <button
            className="btn btn-primary"
            style={{ whiteSpace: "nowrap", fontSize: 12, padding: "6px 12px" }}
            onClick={() => newEntry()}
          >
            + 新建
          </button>
        </div>

        {/* Grouped list */}
        {sortedDates.map((date) => (
          <div key={date} style={{ marginBottom: 8 }}>
            {/* Date group header */}
            <div style={{
              fontSize: 11, fontFamily: "var(--font-mono)",
              color: "var(--accent)", letterSpacing: 1,
              padding: "6px 12px 4px",
              borderBottom: "1px solid var(--border)",
              marginBottom: 4,
            }}>
              {date}
              <span style={{ color: "var(--text-dim)", marginLeft: 8 }}>
                ({grouped[date].length})
              </span>
            </div>
            {grouped[date].map((e) => (
              <div
                key={e.path}
                onClick={() => open(e)}
                style={{
                  padding: "8px 12px", cursor: "pointer",
                  borderRadius: "var(--radius-sm)", marginBottom: 2,
                  background: active?.path === e.path ? "rgba(0,200,255,0.08)" : "transparent",
                  border: `1px solid ${active?.path === e.path ? "rgba(0,200,255,0.25)" : "transparent"}`,
                  transition: "all 0.15s",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{
                    fontFamily: "var(--font-mono)", fontSize: 10,
                    color: "var(--text-dim)", letterSpacing: 1,
                  }}>
                    {e.path.split("/").pop()?.replace(".md", "") ?? ""}
                  </span>
                  <span style={{ fontSize: 16 }}>{e.mood}</span>
                </div>
                <div style={{
                  fontSize: 13, marginTop: 3,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {e.title || "(无标题)"}
                </div>
              </div>
            ))}
          </div>
        ))}

        {sortedDates.length === 0 && (
          <div style={{ color: "var(--text-dim)", fontSize: 13, textAlign: "center", padding: 20 }}>
            暂无日记
          </div>
        )}
      </div>

      {/* Editor */}
      {current ? (
        <div className="panel" style={{ padding: 28, display: "flex", flexDirection: "column", overflow: "auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div style={{
              fontFamily: "var(--font-mono)", fontSize: 11,
              color: "var(--accent)", letterSpacing: 2,
            }}>
              {current.date}
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {saving && <span style={{ fontSize: 11, color: "var(--text-dim)" }}>保存中...</span>}
              <button className="btn btn-primary" style={{ padding: "7px 16px", fontSize: 12 }} onClick={save}>
                保存
              </button>
            </div>
          </div>

          {/* Mood picker */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "var(--text-dim)", marginRight: 4 }}>心情：</span>
            {MOODS.map((m) => (
              <button
                key={m}
                onClick={() => editing && setEditing({ ...editing, mood: m })}
                style={{
                  fontSize: 20, padding: "4px 8px", borderRadius: 8, cursor: "pointer",
                  background: editing?.mood === m ? "rgba(0,200,255,0.15)" : "transparent",
                  border: `1px solid ${editing?.mood === m ? "rgba(0,200,255,0.4)" : "transparent"}`,
                  opacity: editing?.mood === m ? 1 : 0.45,
                  transform: editing?.mood === m ? "scale(1.2)" : "scale(1)",
                  transition: "all 0.15s",
                }}
              >
                {m}
              </button>
            ))}
          </div>

          {/* Title editor */}
          <div style={{ marginBottom: 16 }}>
            <input
              className="input"
              value={editing?.title ?? current?.title ?? ""}
              onChange={(e) => editing && setEditing({ ...editing, title: e.target.value })}
              onFocus={() => !editing && setEditing({ ...current! })}
              placeholder="输入日记标题..."
              style={{
                fontSize: 18, fontWeight: 600,
                background: "transparent", border: "none",
                padding: "8px 0", width: "100%",
              }}
            />
          </div>

          {/* Content editor */}
          <textarea
            className="input"
            style={{
              flex: 1, minHeight: 400, fontSize: 14,
              lineHeight: 1.9, resize: "none",
            }}
            value={editing?.content ?? current.content}
            onChange={(e) => editing && setEditing({ ...editing, content: e.target.value })}
            onFocus={() => !editing && setEditing({ ...current })}
            placeholder="写下今天的所思所想..."
          />
        </div>
      ) : (
        <div className="panel" style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "var(--text-dim)",
        }}>
          选择或新建一篇日记
        </div>
      )}
    </div>
  );
}

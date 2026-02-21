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
    <div className="grid grid-cols-[260px_1fr] gap-4 h-[calc(100vh-120px)]">
      {/* List */}
      <div className="flex flex-col gap-0 overflow-auto">
        {/* New entry controls */}
        <div className="flex gap-1.5 mb-3 items-stretch">
          <input
            type="date"
            className="input text-xs px-2 py-1.5 flex-1"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
          />
          <button
            className="btn btn-primary whitespace-nowrap text-xs px-3 py-1.5"
            onClick={() => newEntry()}
          >
            + 新建
          </button>
        </div>

        {/* Grouped list */}
        {sortedDates.map((date) => (
          <div key={date} className="mb-2">
            {/* Date group header */}
            <div className="text-xs font-mono text-accent tracking-widest px-3 pb-1 border-b border-border mb-1">
              {date}
              <span className="text-text-dim ml-2">
                ({grouped[date].length})
              </span>
            </div>
            {grouped[date].map((e) => (
              <div
                key={e.path}
                onClick={() => open(e)}
                className="px-3 py-2 cursor-pointer rounded-sm mb-0.5 transition-all duration-150"
                style={{
                  background: active?.path === e.path ? "rgba(0,200,255,0.08)" : "transparent",
                  border: `1px solid ${active?.path === e.path ? "rgba(0,200,255,0.25)" : "transparent"}`,
                }}
              >
                <div className="flex justify-between items-center">
                  <span className="font-mono text-[10px] text-text-dim tracking-widest">
                    {e.path.split("/").pop()?.replace(".md", "") ?? ""}
                  </span>
                  <span className="text-base">{e.mood}</span>
                </div>
                <div className="text-sm mt-0.75 overflow-hidden text-ellipsis whitespace-nowrap">
                  {e.title || "(无标题)"}
                </div>
              </div>
            ))}
          </div>
        ))}

        {sortedDates.length === 0 && (
          <div className="text-text-dim text-sm text-center p-5">
            暂无日记
          </div>
        )}
      </div>

      {/* Editor */}
      {current ? (
        <div className="panel p-7 flex flex-col overflow-auto">
          <div className="flex justify-between items-center mb-5">
            <div className="font-mono text-xs text-accent tracking-widest">
              {current.date}
            </div>
            <div className="flex gap-2 items-center">
              {saving && <span className="text-xs text-text-dim">保存中...</span>}
              <button className="btn btn-primary px-4 py-1.5 text-sm" onClick={save}>
                保存
              </button>
            </div>
          </div>

          {/* Mood picker */}
          <div className="flex gap-2 mb-4 items-center">
            <span className="text-xs text-text-dim mr-1">心情：</span>
            {MOODS.map((m) => (
              <button
                key={m}
                onClick={() => editing && setEditing({ ...editing, mood: m })}
                className="text-lg px-2 py-1 rounded-sm cursor-pointer transition-all duration-150"
                style={{
                  background: editing?.mood === m ? "rgba(0,200,255,0.15)" : "transparent",
                  border: `1px solid ${editing?.mood === m ? "rgba(0,200,255,0.4)" : "transparent"}`,
                  opacity: editing?.mood === m ? 1 : 0.45,
                  transform: editing?.mood === m ? "scale(1.2)" : "scale(1)",
                }}
              >
                {m}
              </button>
            ))}
          </div>

          {/* Title editor */}
          <div className="mb-4">
            <input
              className="input text-lg font-semibold bg-transparent border-none px-0 py-2 w-full"
              value={editing?.title ?? current?.title ?? ""}
              onChange={(e) => editing && setEditing({ ...editing, title: e.target.value })}
              onFocus={() => !editing && setEditing({ ...current! })}
              placeholder="输入日记标题..."
            />
          </div>

          {/* Content editor */}
          <textarea
            className="input flex-1 min-h-[400px] text-sm leading-relaxed resize-none"
            value={editing?.content ?? current.content}
            onChange={(e) => editing && setEditing({ ...editing, content: e.target.value })}
            onFocus={() => !editing && setEditing({ ...current })}
            placeholder="写下今天的所思所想..."
          />
        </div>
      ) : (
        <div className="panel flex items-center justify-center text-text-dim">
          选择或新建一篇日记
        </div>
      )}
    </div>
  );
}

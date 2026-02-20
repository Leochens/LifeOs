import { useStore } from "@/stores/app";
import type { ViewId } from "@/types";

const NAV_ITEMS: { id: ViewId; label: string; icon: string }[] = [
  { id: "dashboard",   label: "总览",     icon: "⬡" },
  { id: "daily",       label: "日常",     icon: "◎" },
  { id: "kanban",      label: "项目",     icon: "⊞" },
  { id: "planning",    label: "计划",     icon: "◈" },
  { id: "diary",       label: "日记",     icon: "◇" },
  { id: "decisions",   label: "决策",     icon: "⊙" },
  { id: "life",        label: "生活",     icon: "♡" },
  { id: "chat",        label: "AI 聊天",  icon: "💬" },
  { id: "servers",     label: "服务器",   icon: "🖥" },
  { id: "connectors",  label: "连接",     icon: "⇌" },
  { id: "stickynotes", label: "便利贴",   icon: "◻" },
  { id: "skills",      label: "Skills",   icon: "⟁" },
  { id: "gitscanner",  label: "Git 仓库", icon: "⌥" },
  { id: "scheduler",   label: "定时任务", icon: "◷" },
];

export default function Sidebar() {
  const currentView = useStore((s) => s.currentView);
  const setView = useStore((s) => s.setView);
  const vaultPath = useStore((s) => s.vaultPath);

  const folderName = vaultPath?.split("/").pop() ?? "vault";

  const NavButton = ({ item }: { item: { id: ViewId; label: string; icon: string } }) => {
    const active = currentView === item.id;
    return (
      <button
        key={item.id}
        onClick={() => setView(item.id)}
        style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "8px 12px",
          background: active ? "rgba(0,200,255,0.08)" : "transparent",
          border: `1px solid ${active ? "rgba(0,200,255,0.25)" : "transparent"}`,
          borderRadius: "var(--radius-sm)",
          color: active ? "var(--accent)" : "var(--text-dim)",
          cursor: "pointer",
          width: "100%", textAlign: "left",
          fontSize: 12,
          transition: "all 0.15s",
        }}
        onMouseEnter={(e) => {
          if (!active) (e.currentTarget as HTMLElement).style.color = "var(--text)";
        }}
        onMouseLeave={(e) => {
          if (!active) (e.currentTarget as HTMLElement).style.color = "var(--text-dim)";
        }}
      >
        <span style={{ fontSize: 14, width: 18, textAlign: "center" }}>{item.icon}</span>
        <span>{item.label}</span>
      </button>
    );
  };

  const settingsActive = currentView === "settings";

  return (
    <aside style={{
      width: 175, flexShrink: 0,
      borderRight: "1px solid var(--border)",
      display: "flex", flexDirection: "column",
      background: "var(--panel)",
      padding: "10px 8px",
    }}>
      {/* Vault label */}
      <div style={{
        padding: "6px 10px 12px",
        borderBottom: "1px solid var(--border)",
        marginBottom: 6,
      }}>
        <div className="label" style={{ marginBottom: 4 }}>Vault</div>
        <div style={{ fontSize: 11, color: "var(--text-mid)", overflow: "hidden",
                      textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          📁 {folderName}
        </div>
      </div>

      {/* Nav */}
      <nav style={{ display: "flex", flexDirection: "column", gap: 1, flex: 1, overflow: "auto" }}>
        {NAV_ITEMS.map((item) => (
          <NavButton key={item.id} item={item} />
        ))}
      </nav>

      {/* Bottom: settings + shortcut */}
      <div style={{ paddingTop: 8, borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 4 }}>
        <button
          onClick={() => setView("settings")}
          style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "8px 12px",
            background: settingsActive ? "rgba(0,200,255,0.08)" : "transparent",
            border: `1px solid ${settingsActive ? "rgba(0,200,255,0.25)" : "transparent"}`,
            borderRadius: "var(--radius-sm)",
            color: settingsActive ? "var(--accent)" : "var(--text-dim)",
            cursor: "pointer",
            width: "100%", textAlign: "left",
            fontSize: 12,
            transition: "all 0.15s",
          }}
          onMouseEnter={(e) => {
            if (!settingsActive) (e.currentTarget as HTMLElement).style.color = "var(--text)";
          }}
          onMouseLeave={(e) => {
            if (!settingsActive) (e.currentTarget as HTMLElement).style.color = "var(--text-dim)";
          }}
        >
          <span style={{ fontSize: 14, width: 18, textAlign: "center" }}>⚙</span>
          <span>设置</span>
        </button>
        <div style={{ fontSize: 10, color: "var(--text-dim)", letterSpacing: 1, paddingLeft: 10 }}>
          ⌘K 快速命令
        </div>
      </div>
    </aside>
  );
}

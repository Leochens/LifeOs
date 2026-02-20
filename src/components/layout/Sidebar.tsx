import { useState } from "react";
import { useStore } from "@/stores/app";
import type { ViewId, Plugin, PluginGroup } from "@/types";
import * as Icons from "@/components/icons";

// Icon component renderer
const IconRenderer = ({ name, size = 14 }: { name: string; size?: number }) => {
  const IconComponent = (Icons as Record<string, any>)[name];
  if (!IconComponent) {
    return <span style={{ fontSize: size }}>?</span>;
  }
  return <IconComponent size={size} />;
};

export default function Sidebar() {
  const currentView = useStore((s) => s.currentView);
  const setView = useStore((s) => s.setView);
  const vaultPath = useStore((s) => s.vaultPath);
  const menuConfig = useStore((s) => s.menuConfig);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const folderName = vaultPath?.split("/").pop() ?? "vault";

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const { groups, plugins } = menuConfig;
  // Sort groups by order
  const sortedGroups = [...groups].sort((a, b) => a.order - b.order);

  // Get enabled plugins for a group
  const getGroupPlugins = (group: PluginGroup) => {
    return group.pluginIds
      .map((id) => plugins.find((p) => p.id === id && p.enabled))
      .filter((p): p is Plugin => p !== undefined);
  };

  const NavButton = ({ plugin }: { plugin: Plugin }) => {
    const active = currentView === plugin.component;
    return (
      <button
        key={plugin.id}
        onClick={() => setView(plugin.component as ViewId)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "8px 12px",
          background: active ? "rgba(0,200,255,0.08)" : "transparent",
          border: `1px solid ${active ? "rgba(0,200,255,0.25)" : "transparent"}`,
          borderRadius: "var(--radius-sm)",
          color: active ? "var(--accent)" : "var(--text-dim)",
          cursor: "pointer",
          width: "100%",
          textAlign: "left",
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
        <span style={{ width: 18, textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <IconRenderer name={plugin.icon} />
        </span>
        <span>{plugin.name}</span>
      </button>
    );
  };

  const GroupHeader = ({ group, plugins }: { group: PluginGroup; plugins: Plugin[] }) => {
    const collapsed = collapsedGroups.has(group.id);
    return (
      <div style={{ marginBottom: 4 }}>
        <button
          onClick={() => toggleGroup(group.id)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            width: "100%",
            padding: "6px 10px",
            background: "transparent",
            border: "none",
            color: "var(--text-dim)",
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: 1,
            cursor: "pointer",
            textTransform: "uppercase",
          }}
        >
          <span
            style={{
              transform: collapsed ? "rotate(0deg)" : "rotate(90deg)",
              transition: "transform 0.15s",
              fontSize: 8,
            }}
          >
            ▶
          </span>
          <span style={{ flex: 1, textAlign: "left" }}>{group.name}</span>
          <span style={{ opacity: 0.5, fontSize: 10 }}>{plugins.length}</span>
        </button>
        {!collapsed && (
          <div style={{ display: "flex", flexDirection: "column", gap: 1, paddingLeft: 4 }}>
            {plugins.map((plugin) => (
              <NavButton key={plugin.id} plugin={plugin} />
            ))}
          </div>
        )}
      </div>
    );
  };

  const settingsActive = currentView === "settings";

  return (
    <aside
      style={{
        width: 175,
        flexShrink: 0,
        borderRight: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        background: "var(--panel)",
        padding: "10px 8px",
      }}
    >
      {/* Vault label */}
      <div
        style={{
          padding: "6px 10px 12px",
          borderBottom: "1px solid var(--border)",
          marginBottom: 6,
        }}
      >
        <div className="label" style={{ marginBottom: 4 }}>
          Vault
        </div>
        <div
          style={{
            fontSize: 11,
            color: "var(--text-mid)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          📁 {folderName}
        </div>
      </div>

      {/* Nav with groups */}
      <nav
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 4,
          flex: 1,
          overflow: "auto",
        }}
      >
        {sortedGroups.map((group) => {
          const groupPlugins = getGroupPlugins(group);
          if (groupPlugins.length === 0) return null;
          return (
            <GroupHeader
              key={group.id}
              group={group}
              plugins={groupPlugins}
            />
          );
        })}
      </nav>

      {/* Bottom: settings + shortcut */}
      <div
        style={{
          paddingTop: 8,
          borderTop: "1px solid var(--border)",
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        <button
          onClick={() => setView("settings")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "8px 12px",
            background: settingsActive ? "rgba(0,200,255,0.08)" : "transparent",
            border: `1px solid ${settingsActive ? "rgba(0,200,255,0.25)" : "transparent"}`,
            borderRadius: "var(--radius-sm)",
            color: settingsActive ? "var(--accent)" : "var(--text-dim)",
            cursor: "pointer",
            width: "100%",
            textAlign: "left",
            fontSize: 12,
            transition: "all 0.15s",
          }}
          onMouseEnter={(e) => {
            if (!settingsActive)
              (e.currentTarget as HTMLElement).style.color = "var(--text)";
          }}
          onMouseLeave={(e) => {
            if (!settingsActive)
              (e.currentTarget as HTMLElement).style.color = "var(--text-dim)";
          }}
        >
          <span style={{ width: 18, textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <IconRenderer name="Settings" />
          </span>
          <span>设置</span>
        </button>
        <div
          style={{
            fontSize: 10,
            color: "var(--text-dim)",
            letterSpacing: 1,
            paddingLeft: 10,
          }}
        >
          ⌘K 快速命令
        </div>
      </div>
    </aside>
  );
}

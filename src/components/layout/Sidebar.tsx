import { useState, useEffect, useCallback, useRef } from "react";
import { useStore } from "@/stores/app";
import type { ViewId, Plugin, PluginGroup } from "@/types";
import * as Icons from "@/components/icons";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";

// Icon component renderer
const IconRenderer = ({ name, size = 14 }: { name: string; size?: number }) => {
  const IconComponent = (Icons as Record<string, any>)[name];
  if (!IconComponent) {
    return <span className="text-[14px]">?</span>;
  }
  return <IconComponent size={size} />;
};

// Context menu state
interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  pluginName: string;
  viewId: string;
}

async function openInNewWindow(viewId: string, pluginName: string) {
  const label = `plugin-${viewId}`;
  // Try to focus existing window first
  const existing = await WebviewWindow.getByLabel(label);
  if (existing) {
    await existing.setFocus();
    return;
  }
  // Create new window
  new WebviewWindow(label, {
    url: `index.html?view=${viewId}&standalone=true`,
    title: pluginName,
    width: 1100,
    height: 700,
    center: true,
  });
}

export default function Sidebar() {
  const currentView = useStore((s) => s.currentView);
  const setView = useStore((s) => s.setView);
  const vaultPath = useStore((s) => s.vaultPath);
  const menuConfig = useStore((s) => s.menuConfig);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    pluginName: "",
    viewId: "",
  });
  const menuRef = useRef<HTMLDivElement>(null);

  const folderName = vaultPath?.split("/").pop() ?? "vault";

  // Close context menu on click outside or Escape
  const closeMenu = useCallback(() => {
    setContextMenu((prev) => ({ ...prev, visible: false }));
  }, []);

  useEffect(() => {
    if (!contextMenu.visible) return;
    const handleClick = () => closeMenu();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMenu();
    };
    document.addEventListener("click", handleClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("click", handleClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [contextMenu.visible, closeMenu]);

  const handleContextMenu = (e: React.MouseEvent, viewId: string, pluginName: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      pluginName,
      viewId,
    });
  };

  const handleOpenNewWindow = () => {
    openInNewWindow(contextMenu.viewId, contextMenu.pluginName);
    closeMenu();
  };

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
        onContextMenu={(e) => handleContextMenu(e, plugin.component, plugin.name)}
        className={`flex items-center gap-2.5 px-3 py-2 w-full text-left text-xs transition-all duration-200 cursor-pointer ${
          active
            ? "bg-accent/15 border border-accent/30 text-accent scale-[0.98]"
            : "bg-transparent border border-transparent text-text-dim hover:text-text hover:bg-hover hover:scale-[0.99]"
        }`}
        style={{ borderRadius: "var(--radius-sm)" }}
      >
        <span className="w-[18px] text-center flex items-center justify-center">
          <IconRenderer name={plugin.icon} />
        </span>
        <span>{plugin.name}</span>
      </button>
    );
  };

  const GroupHeader = ({ group, plugins }: { group: PluginGroup; plugins: Plugin[] }) => {
    const collapsed = collapsedGroups.has(group.id);
    return (
      <div className="mb-1">
        <button
          onClick={() => toggleGroup(group.id)}
          className="flex items-center gap-1.5 w-full px-2.5 py-1.5 bg-transparent border-none text-text-dim text-[11px] font-medium tracking-wide cursor-pointer uppercase transition-colors duration-150 hover:text-text"
        >
          <span
            className="text-[8px] transition-transform duration-200 ease-out"
            style={{ transform: collapsed ? "rotate(0deg)" : "rotate(90deg)" }}
          >
            ▶
          </span>
          <span className="flex-1 text-left">{group.name}</span>
          <span className="opacity-50 text-[10px]">{plugins.length}</span>
        </button>
        <div
          className={`flex flex-col gap-0.5 pl-1 overflow-hidden transition-all duration-200 ease-out ${
            collapsed ? "max-h-0 opacity-0" : "max-h-[500px] opacity-100"
          }`}
        >
          {plugins.map((plugin) => (
            <NavButton key={plugin.id} plugin={plugin} />
          ))}
        </div>
      </div>
    );
  };

  const settingsActive = currentView === "settings";

  return (
    <aside className="w-[175px] flex-shrink-0 border-r border-border flex flex-col bg-panel px-2 py-2.5">
      {/* Vault label */}
      <div className="px-2.5 pb-3 border-b border-border mb-1.5">
        <div className="label mb-1">
          Vault
        </div>
        <div className="text-[11px] text-text-mid overflow-hidden text-ellipsis whitespace-nowrap">
          📁 {folderName}
        </div>
      </div>

      {/* Nav with groups */}
      <nav className="flex flex-col gap-1 flex-1 overflow-auto">
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
      <div className="pt-2 border-t border-border flex flex-col gap-1">
        <button
          onClick={() => setView("settings")}
          onContextMenu={(e) => handleContextMenu(e, "settings", "设置")}
          className={`flex items-center gap-2.5 px-3 py-2 w-full text-left text-xs transition-all duration-200 cursor-pointer ${
            settingsActive
              ? "bg-accent/15 border border-accent/30 text-accent scale-[0.98]"
              : "bg-transparent border border-transparent text-text-dim hover:text-text hover:bg-hover hover:scale-[0.99]"
          }`}
          style={{ borderRadius: "var(--radius-sm)" }}
        >
          <span className="w-[18px] text-center flex items-center justify-center">
            <IconRenderer name="Settings" />
          </span>
          <span>设置</span>
        </button>
        <div className="text-[10px] text-text-dim tracking-widest pl-2.5">
          ⌘K 快速命令
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu.visible && (
        <div
          ref={menuRef}
          className="fixed z-[9999] bg-panel border border-border shadow-lg py-1 min-w-[160px]"
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
            borderRadius: "var(--radius-sm)",
          }}
        >
          <button
            onClick={handleOpenNewWindow}
            className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-text-dim hover:text-text hover:bg-hover cursor-pointer bg-transparent border-none text-left"
          >
            <IconRenderer name="ExternalLink" size={12} />
            <span>在新窗口打开</span>
          </button>
        </div>
      )}
    </aside>
  );
}

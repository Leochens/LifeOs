import { useStore } from "@/stores/app";
import type { Plugin } from "@/types";
import * as Icons from "@/components/icons";

// Icon component renderer
const IconRenderer = ({ name, size = 16 }: { name: string; size?: number }) => {
  const IconComponent = (Icons as Record<string, any>)[name];
  if (!IconComponent) {
    return <span style={{ fontSize: size }}>?</span>;
  }
  return <IconComponent size={size} />;
};

export default function MenuManager() {
  const menuConfig = useStore((s) => s.menuConfig);
  const updatePlugin = useStore((s) => s.updatePlugin);
  const updateGroup = useStore((s) => s.updateGroup);

  const { groups, plugins } = menuConfig;
  const sortedGroups = [...groups].sort((a, b) => a.order - b.order);

  const handleTogglePlugin = (plugin: Plugin) => {
    if (plugin.builtin) return; // Can't disable built-in plugins
    updatePlugin(plugin.id, { enabled: !plugin.enabled });
  };

  const handleToggleGroup = (groupId: string) => {
    const group = groups.find((g) => g.id === groupId);
    if (group) {
      updateGroup(groupId, { collapsed: !group.collapsed });
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <div className="label" style={{ marginBottom: 12 }}>菜单管理</div>
        <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 16 }}>
          管理侧边栏菜单分组和插件开关。内置插件无法关闭。
        </div>
      </div>

      {/* Groups and Plugins */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {sortedGroups.map((group) => {
          const groupPlugins = group.pluginIds
            .map((id) => plugins.find((p) => p.id === id))
            .filter((p): p is Plugin => p !== undefined);

          return (
            <div key={group.id} className="panel" style={{ padding: 16 }}>
              {/* Group Header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 12,
                  paddingBottom: 8,
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <button
                  onClick={() => handleToggleGroup(group.id)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--text)",
                    padding: 4,
                  }}
                >
                  <span
                    style={{
                      transform: group.collapsed ? "rotate(0deg)" : "rotate(90deg)",
                      transition: "transform 0.15s",
                      fontSize: 10,
                    }}
                  >
                    ▶
                  </span>
                </button>
                <span style={{ fontWeight: 600, flex: 1 }}>{group.name}</span>
                <span style={{ fontSize: 11, color: "var(--text-dim)" }}>
                  {groupPlugins.length} 个插件
                </span>
              </div>

              {/* Plugin List */}
              {!group.collapsed && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {groupPlugins.map((plugin) => (
                    <div
                      key={plugin.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "8px 12px",
                        background: "var(--panel2)",
                        borderRadius: "var(--radius-sm)",
                      }}
                    >
                      <span style={{ width: 20, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <IconRenderer name={plugin.icon} />
                      </span>
                      <span style={{ flex: 1, fontSize: 13 }}>{plugin.name}</span>
                      {!plugin.builtin && (
                        <button
                          onClick={() => handleTogglePlugin(plugin)}
                          style={{
                            width: 36,
                            height: 20,
                            borderRadius: 10,
                            border: "none",
                            background: plugin.enabled ? "var(--accent)" : "var(--border)",
                            cursor: "pointer",
                            position: "relative",
                          }}
                        >
                          <span
                            style={{
                              position: "absolute",
                              top: 2,
                              left: plugin.enabled ? 18 : 2,
                              width: 16,
                              height: 16,
                              borderRadius: "50%",
                              background: "white",
                              transition: "left 0.15s",
                            }}
                          />
                        </button>
                      )}
                      {plugin.builtin && (
                        <span style={{ fontSize: 10, color: "var(--text-dim)", padding: "2px 6px", background: "var(--panel)", borderRadius: 4 }}>
                          内置
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Quick Tips */}
      <div className="panel" style={{ padding: 16, background: "var(--panel2)" }}>
        <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 8 }}>💡 使用提示</div>
        <ul style={{ fontSize: 11, color: "var(--text-dim)", paddingLeft: 16, lineHeight: 1.8 }}>
          <li>点击分组名称左侧箭头可折叠/展开分组</li>
          <li>总览和设置为内置插件，无法关闭</li>
          <li>其他插件可自由开启或关闭</li>
          <li>关闭的插件不会在侧边栏显示</li>
          <li>修改会自动保存</li>
        </ul>
      </div>
    </div>
  );
}

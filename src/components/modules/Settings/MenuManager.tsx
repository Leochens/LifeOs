import { useStore } from "@/stores/app";
import type { Plugin } from "@/types";
import * as Icons from "@/components/icons";

// Icon component renderer
const IconRenderer = ({ name, size = 16 }: { name: string; size?: number }) => {
  const IconComponent = (Icons as Record<string, any>)[name];
  if (!IconComponent) {
    return <span className="text-text" style={{ fontSize: size }}>?</span>;
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
    <div className="flex flex-col gap-5">
      <div>
        <div className="label mb-3">菜单管理</div>
        <div className="text-xs text-text-dim mb-4">
          管理侧边栏菜单分组和插件开关。内置插件无法关闭。
        </div>
      </div>

      {/* Groups and Plugins */}
      <div className="flex flex-col gap-4">
        {sortedGroups.map((group) => {
          const groupPlugins = group.pluginIds
            .map((id) => plugins.find((p) => p.id === id))
            .filter((p): p is Plugin => p !== undefined);

          return (
            <div key={group.id} className="panel p-4">
              {/* Group Header */}
              <div
                className="flex items-center gap-2 mb-3 pb-2 border-b border-border"
              >
                <button
                  onClick={() => handleToggleGroup(group.id)}
                  className="bg-transparent border-none cursor-pointer text-text p-1"
                >
                  <span
                    className={`text-[10px] transition-transform duration-150 ${group.collapsed ? "" : "rotate-90"}`}
                  >
                    ▶
                  </span>
                </button>
                <span className="font-semibold flex-1">{group.name}</span>
                <span className="text-[11px] text-text-dim">
                  {groupPlugins.length} 个插件
                </span>
              </div>

              {/* Plugin List */}
              {!group.collapsed && (
                <div className="flex flex-col gap-2">
                  {groupPlugins.map((plugin) => (
                    <div
                      key={plugin.id}
                      className="flex items-center gap-3 p-3 bg-panel2 rounded-sm"
                    >
                      <span className="w-5 flex items-center justify-center">
                        <IconRenderer name={plugin.icon} />
                      </span>
                      <span className="flex-1 text-sm">{plugin.name}</span>
                      {!plugin.builtin && (
                        <button
                          onClick={() => handleTogglePlugin(plugin)}
                          className="w-9 h-5 rounded-full border-none cursor-pointer relative"
                          style={{ background: plugin.enabled ? "var(--accent)" : "var(--border)" }}
                        >
                          <span
                            className="absolute top-0.5 rounded-full bg-white transition-all duration-150"
                            style={{
                              left: plugin.enabled ? 18 : 2,
                              width: 16,
                              height: 16,
                            }}
                          />
                        </button>
                      )}
                      {plugin.builtin && (
                        <span className="text-[10px] text-text-dim px-1.5 py-0.5 bg-panel rounded">
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
      <div className="panel p-4 bg-panel2">
        <div className="text-xs font-medium mb-2">💡 使用提示</div>
        <ul className="text-[11px] text-text-dim pl-4 leading-relaxed">
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

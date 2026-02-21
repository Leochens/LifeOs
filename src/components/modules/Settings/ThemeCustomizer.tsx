// ─────────────────────────────────────────────────────────────────────────────
// ThemeCustomizer - Design Tokens 主题定制组件
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import { useThemeStore, THEME_PRESETS } from "@/stores/theme";
import { useStore } from "@/stores/app";
import { darkColorTokens, lightColorTokens } from "@/tokens";
import type { ColorTokens, ThemeMode } from "@/types/tokens";
import {
  Palette,
  Check,
  Download,
  Upload,
  RotateCcw,
  Moon,
  Sun,
  Sparkles,
} from "lucide-react";

// 可编辑的颜色 Token
const EDITABLE_COLORS: { key: keyof ColorTokens; label: string; group: string }[] = [
  { key: "bg", label: "背景色", group: "背景" },
  { key: "panel", label: "面板背景", group: "背景" },
  { key: "panel2", label: "次级面板", group: "背景" },
  { key: "text", label: "主文字", group: "文字" },
  { key: "textDim", label: "暗淡文字", group: "文字" },
  { key: "textMid", label: "中等文字", group: "文字" },
  { key: "border", label: "边框", group: "边框" },
  { key: "border2", label: "次级边框", group: "边框" },
  { key: "primary", label: "主色调", group: "强调色" },
  { key: "accent", label: "强调色 1", group: "强调色" },
  { key: "accent2", label: "强调色 2", group: "强调色" },
  { key: "accent3", label: "成功色", group: "强调色" },
  { key: "accent4", label: "错误色", group: "强调色" },
  { key: "accent5", label: "警告色", group: "强调色" },
];

export default function ThemeCustomizer() {
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);

  const {
    activePresetId,
    setActivePreset,
    customTheme,
    updateCustomColor,
    resetCustomTheme,
  } = useThemeStore();

  const [editingMode, setEditingMode] = useState<ThemeMode>(theme);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    背景: true,
    文字: true,
    边框: true,
    强调色: true,
  });

  // 同步编辑模式与当前主题
  useEffect(() => {
    setEditingMode(theme);
  }, [theme]);

  // 获取当前有效颜色
  const getCurrentColor = (key: keyof ColorTokens): string => {
    // 先检查自定义颜色
    if (customTheme?.colors[editingMode]?.[key]) {
      return customTheme.colors[editingMode][key]!;
    }

    // 再检查预设颜色
    const preset = THEME_PRESETS.find((p) => p.id === activePresetId);
    if (preset?.colors[editingMode]?.[key]) {
      return preset.colors[editingMode][key]!;
    }

    // 最后使用默认值
    const defaultTokens = editingMode === "dark" ? darkColorTokens : lightColorTokens;
    return defaultTokens[key];
  };

  // 处理颜色变化
  const handleColorChange = (key: keyof ColorTokens, value: string) => {
    updateCustomColor(editingMode, key, value);
  };

  // 切换分组展开状态
  const toggleGroup = (group: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [group]: !prev[group],
    }));
  };

  // 导出主题配置
  const handleExport = () => {
    const config = {
      presetId: activePresetId,
      customTheme,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(config, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `life-os-theme-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 导入主题配置
  const handleImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const config = JSON.parse(text);

        if (config.presetId) {
          setActivePreset(config.presetId);
        }
        if (config.customTheme) {
          useThemeStore.getState().setCustomTheme(config.customTheme);
        }

        alert("主题配置已导入！");
      } catch (err) {
        alert("导入失败：无效的主题配置文件");
      }
    };
    input.click();
  };

  // 按分组组织颜色
  const groupedColors = EDITABLE_COLORS.reduce((acc, color) => {
    if (!acc[color.group]) acc[color.group] = [];
    acc[color.group].push(color);
    return acc;
  }, {} as Record<string, typeof EDITABLE_COLORS>);

  return (
    <div className="space-y-6">
      {/* 主题模式切换 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {theme === "dark" ? (
            <Moon size={16} className="text-accent" />
          ) : (
            <Sun size={16} className="text-accent5" />
          )}
          <span className="text-sm text-text">
            {theme === "dark" ? "深色模式" : "浅色模式"}
          </span>
        </div>
        <div
          className="toggle-wrap cursor-pointer"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          <button className={`toggle ${theme === "light" ? "on" : ""}`} />
          <span className="text-xs text-text-dim">
            {theme === "light" ? "浅色" : "深色"}
          </span>
        </div>
      </div>

      {/* 预设主题 */}
      <div>
        <div className="text-xs text-text-mid mb-3 flex items-center gap-1.5">
          <Sparkles size={12} />
          预设主题
        </div>
        <div className="grid grid-cols-3 gap-2">
          {THEME_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => setActivePreset(preset.id)}
              className={`
                relative p-3 rounded-md border transition-all text-left
                ${
                  activePresetId === preset.id
                    ? "border-accent bg-accent/10"
                    : "border-border hover:border-border2 bg-panel"
                }
              `}
            >
              {activePresetId === preset.id && (
                <Check
                  size={12}
                  className="absolute top-2 right-2 text-accent"
                />
              )}
              <div className="text-sm text-text mb-1">{preset.name}</div>
              <div className="text-xs text-text-dim">{preset.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* 编辑模式切换 */}
      <div>
        <div className="text-xs text-text-mid mb-2">编辑模式</div>
        <div className="flex gap-2">
          <button
            onClick={() => setEditingMode("dark")}
            className={`
              flex-1 py-2 px-3 rounded-md text-sm transition-all
              ${
                editingMode === "dark"
                  ? "bg-accent/20 text-accent border border-accent/50"
                  : "bg-panel2 text-text-dim border border-border hover:border-border2"
              }
            `}
          >
            <Moon size={14} className="inline mr-1.5" />
            深色
          </button>
          <button
            onClick={() => setEditingMode("light")}
            className={`
              flex-1 py-2 px-3 rounded-md text-sm transition-all
              ${
                editingMode === "light"
                  ? "bg-accent/20 text-accent border border-accent/50"
                  : "bg-panel2 text-text-dim border border-border hover:border-border2"
              }
            `}
          >
            <Sun size={14} className="inline mr-1.5" />
            浅色
          </button>
        </div>
      </div>

      {/* 颜色编辑器 */}
      <div>
        <div className="text-xs text-text-mid mb-3 flex items-center gap-1.5">
          <Palette size={12} />
          自定义颜色
        </div>

        <div className="space-y-3">
          {Object.entries(groupedColors).map(([group, colors]) => (
            <div key={group}>
              <button
                onClick={() => toggleGroup(group)}
                className="w-full flex items-center justify-between py-1.5 text-xs text-text-mid hover:text-text"
              >
                <span>{group}</span>
                <span className="text-text-dim">
                  {expandedGroups[group] ? "−" : "+"}
                </span>
              </button>

              {expandedGroups[group] && (
                <div className="grid grid-cols-2 gap-2 pt-2">
                  {colors.map((color) => {
                    const currentColor = getCurrentColor(color.key);
                    return (
                      <div
                        key={color.key}
                        className="flex items-center gap-2 p-2 rounded-md bg-panel/50"
                      >
                        <input
                          type="color"
                          value={currentColor.startsWith("rgba") ? "#000000" : currentColor}
                          onChange={(e) => handleColorChange(color.key, e.target.value)}
                          className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent"
                          style={{
                            backgroundColor: currentColor.startsWith("rgba")
                              ? currentColor
                              : undefined,
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-text">{color.label}</div>
                          <div className="text-[10px] text-text-dim font-mono truncate">
                            {currentColor.length > 20
                              ? currentColor.slice(0, 20) + "..."
                              : currentColor}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex gap-2 pt-2">
        <button
          onClick={resetCustomTheme}
          className="btn btn-ghost flex items-center gap-1.5"
        >
          <RotateCcw size={14} />
          重置默认
        </button>
        <button
          onClick={handleExport}
          className="btn btn-ghost flex items-center gap-1.5"
        >
          <Download size={14} />
          导出
        </button>
        <button
          onClick={handleImport}
          className="btn btn-ghost flex items-center gap-1.5"
        >
          <Upload size={14} />
          导入
        </button>
      </div>

      {/* 提示信息 */}
      <div className="p-3 bg-panel2/50 rounded-md border border-border">
        <div className="text-xs text-text-dim leading-relaxed">
          💡 提示：自定义颜色会覆盖预设主题的颜色。修改后会自动保存到本地配置。
        </div>
      </div>
    </div>
  );
}

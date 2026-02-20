import { useState } from "react";
import { useStore } from "@/stores/app";
import { pickVaultFolder, setVaultPath as saveVaultPath, initVault, openInFinder, regenerateSkills } from "@/services/tauri";
import { Settings, FolderOpen, Moon, Sun, Info, Bot, CheckCircle, RefreshCw } from "lucide-react";
import MenuManager from "./Settings/MenuManager";

export default function SettingsView() {
  const vaultPath = useStore((s) => s.vaultPath);
  const setVaultPathStore = useStore((s) => s.setVaultPath);
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);
  const claudeCodeEnabled = useStore((s) => s.claudeCodeEnabled);
  const setClaudeCodeEnabled = useStore((s) => s.setClaudeCodeEnabled);
  const claudeCodePath = useStore((s) => s.claudeCodePath);
  const setClaudeCodePath = useStore((s) => s.setClaudeCodePath);

  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const [migrating, setMigrating] = useState(false);
  const [regeneratingSkills, setRegeneratingSkills] = useState(false);

  const handlePickFolder = async () => {
    const selected = await pickVaultFolder();
    if (selected) {
      setPendingPath(selected);
    }
  };

  const handleMigrate = async () => {
    if (!pendingPath) return;
    setMigrating(true);
    try {
      await initVault(pendingPath);
      await saveVaultPath(pendingPath);
      setVaultPathStore(pendingPath);
    } finally {
      setMigrating(false);
      setPendingPath(null);
    }
  };

  const handleSwitchOnly = async () => {
    if (!pendingPath) return;
    await saveVaultPath(pendingPath);
    setVaultPathStore(pendingPath);
    setPendingPath(null);
  };

  const handleCancel = () => {
    setPendingPath(null);
  };

  const handleOpenFinder = () => {
    if (vaultPath) openInFinder(vaultPath);
  };

  const handleRegenerateSkills = async () => {
    if (!vaultPath) return;
    setRegeneratingSkills(true);
    try {
      await regenerateSkills(vaultPath);
      alert("Skills 已重新生成！");
    } catch (e) {
      console.error("Failed to regenerate skills:", e);
      alert("生成失败: " + String(e));
    } finally {
      setRegeneratingSkills(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 800 }}>
      {/* Header */}
      <div>
        <div style={{ fontFamily: "var(--font-disp)", fontSize: 28, letterSpacing: 3, color: "var(--accent)", display: "flex", alignItems: "center", gap: 10 }}>
          <Settings size={24} />
          设置
        </div>
        <div style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 4 }}>
          管理 Vault 路径、外观和应用信息。
        </div>
      </div>

      {/* Vault Path */}
      <div>
        <div className="label" style={{ marginBottom: 12 }}>Vault 路径</div>
        <div className="panel-inner" style={{ padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <FolderOpen size={16} style={{ color: "var(--accent)", flexShrink: 0 }} />
            <code style={{
              fontSize: 13,
              color: "var(--text)",
              background: "rgba(0,200,255,0.06)",
              padding: "4px 10px",
              borderRadius: 6,
              flex: 1,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}>
              {vaultPath || "未设置"}
            </code>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn btn-ghost" onClick={handlePickFolder}>
              修改路径
            </button>
            <button className="btn btn-ghost" onClick={handleOpenFinder} disabled={!vaultPath}>
              在 Finder 中打开
            </button>
          </div>

          {/* Pending path confirmation */}
          {pendingPath && (
            <div className="scale-in" style={{
              marginTop: 16,
              padding: 16,
              background: "rgba(0,200,255,0.05)",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border2)",
            }}>
              <div style={{ fontSize: 13, color: "var(--text-mid)", marginBottom: 8 }}>
                新路径：<span style={{ color: "var(--accent)" }}>{pendingPath}</span>
              </div>
              <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 12 }}>
                选择如何切换到新路径：
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button className="btn btn-primary" onClick={handleMigrate} disabled={migrating}>
                  {migrating ? "迁移中..." : "迁移数据"}
                </button>
                <button className="btn btn-ghost" onClick={handleSwitchOnly}>
                  只切换路径
                </button>
                <button className="btn btn-ghost" onClick={handleCancel}>
                  取消
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Appearance */}
      <div>
        <div className="label" style={{ marginBottom: 12 }}>外观</div>
        <div className="panel-inner" style={{ padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {theme === "dark" ? <Moon size={16} style={{ color: "var(--accent)" }} /> : <Sun size={16} style={{ color: "var(--accent5)" }} />}
              <span style={{ fontSize: 14, color: "var(--text)" }}>
                {theme === "dark" ? "深色模式" : "浅色模式"}
              </span>
            </div>
            <div className="toggle-wrap" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
              <button className={`toggle ${theme === "light" ? "on" : ""}`} />
              <span style={{ fontSize: 12, color: "var(--text-dim)" }}>
                {theme === "light" ? "浅色" : "深色"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Claude Code */}
      <div>
        <div className="label" style={{ marginBottom: 12 }}>Claude Code AI</div>
        <div className="panel-inner" style={{ padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Bot size={16} style={{ color: "var(--accent2)" }} />
              <span style={{ fontSize: 14, color: "var(--text)" }}>启用 Claude Code</span>
            </div>
            <div className="toggle-wrap" onClick={() => setClaudeCodeEnabled(!claudeCodeEnabled)}>
              <button className={`toggle ${claudeCodeEnabled ? "on" : ""}`} />
              <span style={{ fontSize: 12, color: "var(--text-dim)" }}>
                {claudeCodeEnabled ? "启用" : "禁用"}
              </span>
            </div>
          </div>

          {claudeCodeEnabled && (
            <>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: "var(--text-mid)", display: "block", marginBottom: 6 }}>CLI 路径</label>
                <input
                  className="input"
                  value={claudeCodePath}
                  onChange={(e) => setClaudeCodePath(e.target.value)}
                  placeholder="claude"
                  style={{ width: "100%" }}
                />
              </div>

              <div style={{ padding: 12, background: "var(--panel2)", borderRadius: "var(--radius-sm)", display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 4 }}>连接状态</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <CheckCircle size={14} style={{ color: "var(--accent3)" }} />
                    <span style={{ fontSize: 13 }}>就绪</span>
                  </div>
                </div>
                <div style={{ fontSize: 11, color: "var(--text-dim)" }}>
                  Claude Code 用于 AI 聊天和决策分析功能
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Skills Management */}
      <div>
        <div className="label" style={{ marginBottom: 12 }}>AI Skills</div>
        <div className="panel-inner" style={{ padding: 20 }}>
          <div style={{ fontSize: 13, color: "var(--text-dim)", marginBottom: 12 }}>
            重新生成 AI 斜杠命令技能文档，用于 /看板、/日记 等 AI 助手命令。
          </div>
          <button
            className="btn btn-ghost"
            onClick={handleRegenerateSkills}
            disabled={!vaultPath || regeneratingSkills}
            style={{ display: "flex", alignItems: "center", gap: 8 }}
          >
            <RefreshCw size={14} className={regeneratingSkills ? "spin" : ""} />
            {regeneratingSkills ? "生成中..." : "重新生成 Skills"}
          </button>
        </div>
      </div>

      {/* Menu Management */}
      <div>
        <div className="label" style={{ marginBottom: 12 }}>菜单管理</div>
        <div className="panel-inner" style={{ padding: 20 }}>
          <MenuManager />
        </div>
      </div>

      {/* About */}
      <div>
        <div className="label" style={{ marginBottom: 12 }}>关于</div>
        <div className="panel-inner" style={{ padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <Info size={16} style={{ color: "var(--accent2)" }} />
            <span style={{ fontSize: 14, color: "var(--text)" }}>Life OS</span>
            <span className="tag purple" style={{ marginLeft: 4 }}>v0.1.0</span>
          </div>
          <div style={{ fontSize: 13, color: "var(--text-dim)", lineHeight: 1.8 }}>
            数据本地存储，完全离线。你的数据只保留在你的设备上。
          </div>
        </div>
      </div>
    </div>
  );
}

import { useState } from "react";
import { useStore } from "@/stores/app";
import { pickVaultFolder, setVaultPath as saveVaultPath, initVault, openInFinder, regenerateSkills } from "@/services/tauri";
import { Settings, FolderOpen, Info, Bot, CheckCircle, RefreshCw } from "lucide-react";
import MenuManager from "./Settings/MenuManager";
import ThemeCustomizer from "./Settings/ThemeCustomizer";

export default function SettingsView() {
  const vaultPath = useStore((s) => s.vaultPath);
  const setVaultPathStore = useStore((s) => s.setVaultPath);
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
    <div className="flex flex-col gap-6 max-w-[800px]">
      {/* Header */}
      <div>
        <div className="font-disp text-[28px] tracking-widest text-accent flex items-center gap-2.5">
          <Settings size={24} />
          设置
        </div>
        <div className="text-sm text-text-dim mt-1">
          管理 Vault 路径、外观和应用信息。
        </div>
      </div>

      {/* Vault Path */}
      <div>
        <div className="label mb-3">Vault 路径</div>
        <div className="panel-inner p-5">
          <div className="flex items-center gap-2.5 mb-3.5">
            <FolderOpen size={16} className="text-accent flex-shrink-0" />
            <code className="text-sm text-text bg-accent/5 px-2.5 py-1 rounded-sm flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
              {vaultPath || "未设置"}
            </code>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button className="btn btn-ghost" onClick={handlePickFolder}>
              修改路径
            </button>
            <button className="btn btn-ghost" onClick={handleOpenFinder} disabled={!vaultPath}>
              在 Finder 中打开
            </button>
          </div>

          {/* Pending path confirmation */}
          {pendingPath && (
            <div className="scale-in mt-4 p-4 bg-accent/5 rounded-sm border border-border-2">
              <div className="text-sm text-text-mid mb-2">
                新路径：<span className="text-accent">{pendingPath}</span>
              </div>
              <div className="text-xs text-text-dim mb-3">
                选择如何切换到新路径：
              </div>
              <div className="flex gap-2 flex-wrap">
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
        <div className="label mb-3">外观</div>
        <div className="panel-inner p-5">
          <ThemeCustomizer />
        </div>
      </div>

      {/* Claude Code */}
      <div>
        <div className="label mb-3">Claude Code AI</div>
        <div className="panel-inner p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <Bot size={16} className="text-accent-2" />
              <span className="text-sm text-text">启用 Claude Code</span>
            </div>
            <div className="toggle-wrap cursor-pointer" onClick={() => setClaudeCodeEnabled(!claudeCodeEnabled)}>
              <button className={`toggle ${claudeCodeEnabled ? "on" : ""}`} />
              <span className="text-xs text-text-dim">
                {claudeCodeEnabled ? "启用" : "禁用"}
              </span>
            </div>
          </div>

          {claudeCodeEnabled && (
            <>
              <div className="mb-3">
                <label className="text-xs text-text-mid block mb-1.5">CLI 路径</label>
                <input
                  className="input"
                  value={claudeCodePath}
                  onChange={(e) => setClaudeCodePath(e.target.value)}
                  placeholder="claude"
                />
              </div>

              <div className="p-3 bg-panel-2 rounded-sm flex items-center gap-3">
                <div className="flex-1">
                  <div className="text-xs text-text-dim mb-1">连接状态</div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle size={14} className="text-accent3" />
                    <span className="text-sm">就绪</span>
                  </div>
                </div>
                <div className="text-xs text-text-dim">
                  Claude Code 用于 AI 聊天和决策分析功能
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Skills Management */}
      <div>
        <div className="label mb-3">AI Skills</div>
        <div className="panel-inner p-5">
          <div className="text-sm text-text-dim mb-3">
            重新生成 AI 斜杠命令技能文档，用于 /看板、/日记 等 AI 助手命令。
          </div>
          <button
            className="btn btn-ghost flex items-center gap-2"
            onClick={handleRegenerateSkills}
            disabled={!vaultPath || regeneratingSkills}
          >
            <RefreshCw size={14} className={regeneratingSkills ? "animate-spin" : ""} />
            {regeneratingSkills ? "生成中..." : "重新生成 Skills"}
          </button>
        </div>
      </div>

      {/* Menu Management */}
      <div>
        <div className="label mb-3">菜单管理</div>
        <div className="panel-inner p-5">
          <MenuManager />
        </div>
      </div>

      {/* About */}
      <div>
        <div className="label mb-3">关于</div>
        <div className="panel-inner p-5">
          <div className="flex items-center gap-2.5 mb-3">
            <Info size={16} className="text-accent-2" />
            <span className="text-sm text-text">Life OS</span>
            <span className="tag purple ml-1">v0.1.0</span>
          </div>
          <div className="text-sm text-text-dim leading-relaxed">
            数据本地存储，完全离线。你的数据只保留在你的设备上。
          </div>
        </div>
      </div>
    </div>
  );
}

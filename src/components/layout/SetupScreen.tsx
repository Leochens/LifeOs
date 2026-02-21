import { useState } from "react";
import { useStore } from "@/stores/app";
import { pickVaultFolder, initVault } from "@/services/tauri";

export default function SetupScreen() {
  const setVaultPath = useStore((s) => s.setVaultPath);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handlePick = async () => {
    setError("");
    const folder = await pickVaultFolder();
    if (!folder) return;

    setLoading(true);
    try {
      await initVault(folder);
      setVaultPath(folder);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative z-10 flex flex-col items-center justify-center h-screen gap-8">
      {/* Logo */}
      <div className="text-center">
        <div className="font-disp text-6xl tracking-[12px] text-accent leading-none" style={{ textShadow: "var(--glow)" }}>
          LIFE OS
        </div>
        <div className="font-mono text-xs text-text-dim tracking-widest mt-2">
          PERSONAL OPERATING SYSTEM
        </div>
      </div>

      {/* Setup card */}
      <div className="panel fade-up p-10 max-w-[480px] w-full text-center">
        <div className="text-4xl mb-4">📁</div>
        <h2 className="text-lg mb-2">选择你的 Vault 目录</h2>
        <p className="text-text-mid text-sm leading-relaxed mb-7">
          Vault 是你所有数据的家。选择一个文件夹，Life OS 会在里面创建结构化的目录。
          <br />
          推荐放在 <code className="text-accent text-[11px]">iCloud Drive</code> 或
          <code className="text-accent text-[11px]"> Dropbox</code> 下以实现跨设备同步。
        </p>

        <button
          className="btn btn-primary w-full justify-center py-3 px-6 text-[15px]"
          onClick={handlePick}
          disabled={loading}
        >
          {loading ? "正在初始化..." : "📂 选择文件夹"}
        </button>

        {error && (
          <div className="mt-4 px-3.5 py-2.5 bg-accent4/10 border border-accent4/30 rounded-sm text-accent4 text-xs">
            {error}
          </div>
        )}

        <div className="mt-6 text-[11px] text-text-dim leading-8">
          ✦ 所有数据存储为 Markdown 文件<br />
          ✦ 完全离线，数据永远属于你<br />
          ✦ 支持任何编辑器直接编辑
        </div>
      </div>
    </div>
  );
}

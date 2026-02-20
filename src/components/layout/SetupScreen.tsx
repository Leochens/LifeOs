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
    <div style={{
      position: "relative", zIndex: 1,
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      height: "100vh", gap: 32,
    }}>
      {/* Logo */}
      <div style={{ textAlign: "center" }}>
        <div style={{
          fontFamily: "var(--font-disp)", fontSize: 64,
          letterSpacing: 12, color: "var(--accent)",
          textShadow: "var(--glow)", lineHeight: 1,
        }}>
          LIFE OS
        </div>
        <div style={{
          fontFamily: "var(--font-mono)", fontSize: 12,
          color: "var(--text-dim)", letterSpacing: 4, marginTop: 8,
        }}>
          PERSONAL OPERATING SYSTEM
        </div>
      </div>

      {/* Setup card */}
      <div className="panel fade-up" style={{ padding: 40, maxWidth: 480, width: "100%", textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>📁</div>
        <h2 style={{ fontSize: 18, marginBottom: 8 }}>选择你的 Vault 目录</h2>
        <p style={{ color: "var(--text-mid)", fontSize: 13, lineHeight: 1.8, marginBottom: 28 }}>
          Vault 是你所有数据的家。选择一个文件夹，Life OS 会在里面创建结构化的目录。
          <br />
          推荐放在 <code style={{ color: "var(--accent)", fontSize: 11 }}>iCloud Drive</code> 或
          <code style={{ color: "var(--accent)", fontSize: 11 }}> Dropbox</code> 下以实现跨设备同步。
        </p>

        <button
          className="btn btn-primary"
          style={{ width: "100%", justifyContent: "center", padding: "12px 24px", fontSize: 15 }}
          onClick={handlePick}
          disabled={loading}
        >
          {loading ? "正在初始化..." : "📂 选择文件夹"}
        </button>

        {error && (
          <div style={{
            marginTop: 16, padding: "10px 14px",
            background: "rgba(255,107,107,0.1)", border: "1px solid rgba(255,107,107,0.3)",
            borderRadius: "var(--radius-sm)", color: "var(--accent4)", fontSize: 12,
          }}>
            {error}
          </div>
        )}

        <div style={{ marginTop: 24, fontSize: 11, color: "var(--text-dim)", lineHeight: 2 }}>
          ✦ 所有数据存储为 Markdown 文件<br />
          ✦ 完全离线，数据永远属于你<br />
          ✦ 支持任何编辑器直接编辑
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useStore } from "@/stores/app";

export default function Titlebar() {
  const [time, setTime] = useState("");
  const isLoading = useStore((s) => s.isLoading);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, "0");
      const m = String(now.getMinutes()).padStart(2, "0");
      const s = String(now.getSeconds()).padStart(2, "0");
      setTime(`${h}:${m}:${s}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <header
      data-tauri-drag-region
      style={{
        display: "flex", alignItems: "center",
        padding: "0 20px", height: 44,
        borderBottom: "1px solid var(--border)",
        background: "rgba(6,8,16,0.9)",
        backdropFilter: "blur(12px)",
        flexShrink: 0,
        userSelect: "none",
      }}
    >
      {/* macOS traffic lights space (titleBarStyle: Overlay) */}
      <div style={{ width: 80 }} />

      {/* Logo */}
      <div style={{
        fontFamily: "var(--font-disp)",
        fontSize: 20, letterSpacing: 4,
        color: "var(--accent)", textShadow: "var(--glow)",
        display: "flex", alignItems: "center", gap: 10,
      }}>
        LIFE OS
        <span style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10, color: "var(--text-dim)", letterSpacing: 2,
        }}>
          v0.1
        </span>
      </div>

      <div style={{ flex: 1 }} />

      {/* Status */}
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        {isLoading ? (
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--text-dim)" }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent5)",
                         boxShadow: "0 0 6px var(--accent5)" }} className="pulse" />
            同步中...
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--text-dim)" }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent3)",
                         boxShadow: "0 0 6px var(--accent3)" }} className="pulse" />
            在线
          </div>
        )}
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-mid)", letterSpacing: 1 }}>
          {time}
        </div>
      </div>
    </header>
  );
}

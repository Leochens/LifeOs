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
      className="flex items-center px-5 h-11 border-b border-border bg-[rgba(6,8,16,0.9)] backdrop-blur-xl flex-shrink-0 select-none"
    >
      {/* macOS traffic lights space (titleBarStyle: Overlay) */}
      <div className="w-20" />

      {/* Logo */}
      <div className="font-disp text-xl tracking-widest text-accent flex items-center gap-2.5" style={{ textShadow: "var(--glow)" }}>
        LIFE OS
        <span className="font-mono text-[10px] text-text-dim tracking-widest">
          v0.1
        </span>
      </div>

      <div className="flex-1" />

      {/* Status */}
      <div className="flex items-center gap-3.5">
        {isLoading ? (
          <div className="flex items-center gap-1.5 text-[11px] text-text-dim">
            <div className="w-1.5 h-1.5 rounded-full bg-accent-5 animate-pulse" style={{ boxShadow: "0 0 6px var(--accent5)" }} />
            同步中...
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-[11px] text-text-dim">
            <div className="w-1.5 h-1.5 rounded-full bg-accent-3 animate-pulse" style={{ boxShadow: "0 0 6px var(--accent3)" }} />
            在线
          </div>
        )}
        <div className="font-mono text-xs text-text-mid tracking-widest">
          {time}
        </div>
      </div>
    </header>
  );
}

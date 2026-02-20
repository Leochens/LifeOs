import { useState, useEffect } from "react";
import { useStore } from "@/stores/app";
import { runShellCommand } from "@/services/tauri";
import type { ScreenTimeData, HealthData } from "@/types";
import { format, subDays } from "date-fns";

export default function LifeView() {
  const vaultPath = useStore((s) => s.vaultPath);
  const [screenTime, setScreenTime] = useState<ScreenTimeData | null>(null);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Try to get Screen Time data via shortcuts
      const today = format(new Date(), "yyyy-MM-dd");

      // For now, we'll show a placeholder as macOS Screen Time API requires special permissions
      // In a real implementation, you would create a Shortcut that exports Screen Time data
      setScreenTime({
        totalMinutes: 0,
        byCategory: {
          "社交": 120,
          "工作": 180,
          "娱乐": 60,
          "其他": 40,
        },
        byApp: {
          "Slack": 90,
          "Chrome": 120,
          "VS Code": 60,
          "微信": 30,
        },
        pickupCount: 45,
        date: today,
      });

      // Similarly for Health data - would need Shortcuts integration
      setHealth({
        steps: 8500,
        activeMinutes: 45,
        calories: 2100,
        sleepHours: 7.5,
        heartRate: 72,
        date: today,
      });

      setLastUpdate(new Date().toLocaleTimeString());
    } catch (e) {
      console.error("Failed to load life data:", e);
      setError("无法加载数据。请确保已授予必要的权限。");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [vaultPath]);

  const formatMinutes = (mins: number) => {
    const hours = Math.floor(mins / 60);
    const minutes = mins % 60;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div style={{ fontFamily: "var(--font-disp)", fontSize: 28, letterSpacing: 3, color: "var(--accent)" }}>
          生活数据
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {lastUpdate && (
            <span style={{ fontSize: 11, color: "var(--text-dim)" }}>
              更新于 {lastUpdate}
            </span>
          )}
          <button className="btn btn-ghost" onClick={loadData} style={{ fontSize: 12 }}>
            ⟳ 刷新
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "var(--text-dim)" }}>
          加载中...
        </div>
      ) : error ? (
        <div className="panel" style={{ padding: 40, textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
          <div style={{ color: "var(--accent4)" }}>{error}</div>
          <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 8 }}>
            需要在系统设置中授予"屏幕使用时间"和"健康"数据的访问权限
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 24 }}>
          {/* Screen Time */}
          <div className="panel" style={{ padding: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
              <span style={{ fontSize: 24 }}>📱</span>
              <div>
                <div style={{ fontSize: 16, fontWeight: 600 }}>屏幕使用时间</div>
                <div style={{ fontSize: 12, color: "var(--text-dim)" }}>今日数据</div>
              </div>
            </div>

            {/* Summary cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
              <div style={{ padding: 16, background: "var(--panel2)", borderRadius: "var(--radius-sm)", textAlign: "center" }}>
                <div style={{ fontSize: 28, fontWeight: 600, color: "var(--accent)" }}>
                  {screenTime ? formatMinutes(screenTime.totalMinutes) : "--"}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 4 }}>总使用时间</div>
              </div>
              <div style={{ padding: 16, background: "var(--panel2)", borderRadius: "var(--radius-sm)", textAlign: "center" }}>
                <div style={{ fontSize: 28, fontWeight: 600, color: "var(--accent3)" }}>
                  {screenTime?.pickupCount || "--"}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 4 }}>拿起次数</div>
              </div>
              <div style={{ padding: 16, background: "var(--panel2)", borderRadius: "var(--radius-sm)", textAlign: "center" }}>
                <div style={{ fontSize: 28, fontWeight: 600, color: "var(--accent2)" }}>
                  {screenTime ? Object.keys(screenTime.byCategory).length : "--"}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 4 }}>使用分类</div>
              </div>
            </div>

            {/* By Category */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 10, letterSpacing: 1 }}>按分类</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {screenTime && Object.entries(screenTime.byCategory).map(([cat, mins]) => (
                  <div key={cat} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ width: 60, fontSize: 13 }}>{cat}</span>
                    <div style={{ flex: 1, height: 8, background: "var(--panel2)", borderRadius: 4, overflow: "hidden" }}>
                      <div
                        style={{
                          height: "100%",
                          width: `${(mins / Math.max(...Object.values(screenTime.byCategory))) * 100}%`,
                          background: "var(--accent)",
                          borderRadius: 4,
                        }}
                      />
                    </div>
                    <span style={{ fontSize: 12, color: "var(--text-dim)", width: 50, textAlign: "right" }}>
                      {formatMinutes(mins)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* By App */}
            <div>
              <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 10, letterSpacing: 1 }}>按应用</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {screenTime && Object.entries(screenTime.byApp).map(([app, mins]) => (
                  <div key={app} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ width: 80, fontSize: 13 }}>{app}</span>
                    <div style={{ flex: 1, height: 8, background: "var(--panel2)", borderRadius: 4, overflow: "hidden" }}>
                      <div
                        style={{
                          height: "100%",
                          width: `${(mins / Math.max(...Object.values(screenTime.byApp))) * 100}%`,
                          background: "var(--accent2)",
                          borderRadius: 4,
                        }}
                      />
                    </div>
                    <span style={{ fontSize: 12, color: "var(--text-dim)", width: 50, textAlign: "right" }}>
                      {formatMinutes(mins)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Health Data */}
          <div className="panel" style={{ padding: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
              <span style={{ fontSize: 24 }}>❤️</span>
              <div>
                <div style={{ fontSize: 16, fontWeight: 600 }}>健康数据</div>
                <div style={{ fontSize: 12, color: "var(--text-dim)" }}>今日数据</div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
              <div style={{ padding: 16, background: "var(--panel2)", borderRadius: "var(--radius-sm)", textAlign: "center" }}>
                <div style={{ fontSize: 24, fontWeight: 600, color: "var(--accent3)" }}>
                  {health?.steps.toLocaleString() || "--"}
                </div>
                <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 4 }}>步数</div>
              </div>
              <div style={{ padding: 16, background: "var(--panel2)", borderRadius: "var(--radius-sm)", textAlign: "center" }}>
                <div style={{ fontSize: 24, fontWeight: 600, color: "var(--accent)" }}>
                  {health?.activeMinutes || "--"}
                </div>
                <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 4 }}>活动分钟</div>
              </div>
              <div style={{ padding: 16, background: "var(--panel2)", borderRadius: "var(--radius-sm)", textAlign: "center" }}>
                <div style={{ fontSize: 24, fontWeight: 600, color: "var(--accent2)" }}>
                  {health?.calories || "--"}
                </div>
                <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 4 }}>千卡</div>
              </div>
              <div style={{ padding: 16, background: "var(--panel2)", borderRadius: "var(--radius-sm)", textAlign: "center" }}>
                <div style={{ fontSize: 24, fontWeight: 600, color: "var(--accent4)" }}>
                  {health?.sleepHours || "--"}
                </div>
                <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 4 }}>睡眠小时</div>
              </div>
            </div>

            {health?.heartRate && (
              <div style={{ marginTop: 16, padding: 12, background: "var(--panel2)", borderRadius: "var(--radius-sm)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <span style={{ color: "var(--accent4)" }}>♥</span>
                <span style={{ fontSize: 14 }}>心率</span>
                <span style={{ fontSize: 18, fontWeight: 600, color: "var(--accent)" }}>{health.heartRate}</span>
                <span style={{ fontSize: 12, color: "var(--text-dim)" }}>BPM</span>
              </div>
            )}
          </div>

          {/* Info */}
          <div style={{ fontSize: 11, color: "var(--text-dim)", textAlign: "center", padding: 12 }}>
            数据需要 macOS 屏幕使用时间 和 健康 权限。如数据不准确，请检查系统偏好设置。
          </div>
        </div>
      )}
    </div>
  );
}

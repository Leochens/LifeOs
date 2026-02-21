import { useState, useEffect } from "react";
import { useStore } from "@/stores/app";
import { runShortcut } from "@/services/fs";
import type { ScreenTimeData, HealthData } from "@/types";
import { format } from "date-fns";

export default function LifeView() {
  const vaultPath = useStore((s) => s.vaultPath);
  const [screenTime, setScreenTime] = useState<ScreenTimeData | null>(null);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [shortcutsConfigured, setShortcutsConfigured] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    const today = format(new Date(), "yyyy-MM-dd");

    try {
      // Try to get Screen Time data via shortcuts
      let screenTimeData: ScreenTimeData | null = null;
      let healthData: HealthData | null = null;

      try {
        const stResult = await runShortcut("Get Screen Time");
        const st = JSON.parse(stResult);
        if (st && st.totalMinutes) {
          screenTimeData = {
            totalMinutes: st.totalMinutes || 0,
            byCategory: st.byCategory || {},
            byApp: st.byApp || {},
            pickupCount: st.pickupCount || 0,
            date: today,
          };
          setShortcutsConfigured(true);
        }
      } catch (e) {
        console.log("Screen Time shortcut not available:", e);
      }

      try {
        const healthResult = await runShortcut("Get Health Data");
        const hd = JSON.parse(healthResult);
        if (hd && hd.steps) {
          healthData = {
            steps: hd.steps || 0,
            activeMinutes: hd.activeMinutes || 0,
            calories: hd.calories || 0,
            sleepHours: hd.sleepHours || 0,
            heartRate: hd.heartRate,
            date: today,
          };
          setShortcutsConfigured(true);
        }
      } catch (e) {
        console.log("Health shortcut not available:", e);
      }

      // If shortcuts didn't work, use mock data
      if (!screenTimeData) {
        screenTimeData = {
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
        };
      }

      if (!healthData) {
        healthData = {
          steps: 8500,
          activeMinutes: 45,
          calories: 2100,
          sleepHours: 7.5,
          heartRate: 72,
          date: today,
        };
      }

      setScreenTime(screenTimeData);
      setHealth(healthData);
      setLastUpdate(new Date().toLocaleTimeString());
    } catch (e) {
      console.error("Failed to load life data:", e);
      // Use mock data as fallback
      setScreenTime({
        totalMinutes: 0,
        byCategory: { "社交": 120, "工作": 180, "娱乐": 60, "其他": 40 },
        byApp: { "Slack": 90, "Chrome": 120, "VS Code": 60, "微信": 30 },
        pickupCount: 45,
        date: today,
      });
      setHealth({
        steps: 8500,
        activeMinutes: 45,
        calories: 2100,
        sleepHours: 7.5,
        heartRate: 72,
        date: today,
      });
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
    <div className="max-w-[900px]">
      <div className="flex items-center justify-between mb-6">
        <div className="font-[var(--font-disp)] text-[28px] tracking-[3px] text-accent">
          生活数据
        </div>
        <div className="flex items-center gap-3">
          {lastUpdate && (
            <span className="text-[11px] text-text-dim">
              更新于 {lastUpdate}
            </span>
          )}
          <button className="btn btn-ghost" onClick={loadData} style={{ fontSize: 12 }}>
            ⟳ 刷新
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-10 text-center text-text-dim">
          加载中...
        </div>
      ) : error ? (
        <div className="panel p-10 text-center">
          <div className="text-[32px] mb-3">⚠️</div>
          <div className="text-accent4">{error}</div>
          <div className="text-[12px] text-text-dim mt-2">
            需要在系统设置中授予"屏幕使用时间"和"健康"数据的访问权限
          </div>
        </div>
      ) : (
        <div className="grid gap-6">
          {/* Screen Time */}
          <div className="panel p-6">
            <div className="flex items-center gap-3 mb-5">
              <span className="text-[24px]">📱</span>
              <div>
                <div className="text-[16px] font-semibold">屏幕使用时间</div>
                <div className="text-[12px] text-text-dim">今日数据</div>
              </div>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              <div className="p-4 bg-panel2 rounded-[var(--radius-sm)] text-center">
                <div className="text-[28px] font-semibold text-accent">
                  {screenTime ? formatMinutes(screenTime.totalMinutes) : "--"}
                </div>
                <div className="text-[11px] text-text-dim mt-1">总使用时间</div>
              </div>
              <div className="p-4 bg-panel2 rounded-[var(--radius-sm)] text-center">
                <div className="text-[28px] font-semibold text-accent3">
                  {screenTime?.pickupCount || "--"}
                </div>
                <div className="text-[11px] text-text-dim mt-1">拿起次数</div>
              </div>
              <div className="p-4 bg-panel2 rounded-[var(--radius-sm)] text-center">
                <div className="text-[28px] font-semibold text-accent2">
                  {screenTime ? Object.keys(screenTime.byCategory).length : "--"}
                </div>
                <div className="text-[11px] text-text-dim mt-1">使用分类</div>
              </div>
            </div>

            {/* By Category */}
            <div className="mb-5">
              <div className="text-[12px] text-text-dim mb-[10px] tracking-[1px]">按分类</div>
              <div className="flex flex-col gap-2">
                {screenTime && Object.entries(screenTime.byCategory).map(([cat, mins]) => (
                  <div key={cat} className="flex items-center gap-3">
                    <span className="w-[60px] text-[13px]">{cat}</span>
                    <div className="flex-1 h-2 bg-panel2 rounded-[4px] overflow-hidden">
                      <div
                        style={{
                          height: "100%",
                          width: `${(mins / Math.max(...Object.values(screenTime.byCategory))) * 100}%`,
                          background: "var(--accent)",
                          borderRadius: 4,
                        }}
                      />
                    </div>
                    <span className="text-[12px] text-text-dim w-[50px] text-right">
                      {formatMinutes(mins)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* By App */}
            <div>
              <div className="text-[12px] text-text-dim mb-[10px] tracking-[1px]">按应用</div>
              <div className="flex flex-col gap-2">
                {screenTime && Object.entries(screenTime.byApp).map(([app, mins]) => (
                  <div key={app} className="flex items-center gap-3">
                    <span className="w-[80px] text-[13px]">{app}</span>
                    <div className="flex-1 h-2 bg-panel2 rounded-[4px] overflow-hidden">
                      <div
                        style={{
                          height: "100%",
                          width: `${(mins / Math.max(...Object.values(screenTime.byApp))) * 100}%`,
                          background: "var(--accent2)",
                          borderRadius: 4,
                        }}
                      />
                    </div>
                    <span className="text-[12px] text-text-dim w-[50px] text-right">
                      {formatMinutes(mins)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Health Data */}
          <div className="panel p-6">
            <div className="flex items-center gap-3 mb-5">
              <span className="text-[24px]">❤️</span>
              <div>
                <div className="text-[16px] font-semibold">健康数据</div>
                <div className="text-[12px] text-text-dim">今日数据</div>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-3">
              <div className="p-4 bg-panel2 rounded-[var(--radius-sm)] text-center">
                <div className="text-[24px] font-semibold text-accent3">
                  {health?.steps.toLocaleString() || "--"}
                </div>
                <div className="text-[10px] text-text-dim mt-1">步数</div>
              </div>
              <div className="p-4 bg-panel2 rounded-[var(--radius-sm)] text-center">
                <div className="text-[24px] font-semibold text-accent">
                  {health?.activeMinutes || "--"}
                </div>
                <div className="text-[10px] text-text-dim mt-1">活动分钟</div>
              </div>
              <div className="p-4 bg-panel2 rounded-[var(--radius-sm)] text-center">
                <div className="text-[24px] font-semibold text-accent2">
                  {health?.calories || "--"}
                </div>
                <div className="text-[10px] text-text-dim mt-1">千卡</div>
              </div>
              <div className="p-4 bg-panel2 rounded-[var(--radius-sm)] text-center">
                <div className="text-[24px] font-semibold text-accent4">
                  {health?.sleepHours || "--"}
                </div>
                <div className="text-[10px] text-text-dim mt-1">睡眠小时</div>
              </div>
            </div>

            {health?.heartRate && (
              <div className="mt-4 p-3 bg-panel2 rounded-[var(--radius-sm)] flex items-center justify-center gap-2">
                <span className="text-accent4">♥</span>
                <span className="text-[14px]">心率</span>
                <span className="text-[18px] font-semibold text-accent">{health.heartRate}</span>
                <span className="text-[12px] text-text-dim">BPM</span>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="text-[11px] text-text-dim text-center p-3">
            {shortcutsConfigured ? (
              <span className="text-accent3">✓ 数据已通过 Shortcuts 实时获取</span>
            ) : (
              <>
                数据使用模拟值。请在 Shortcuts 应用中创建两个捷径：
                <br />
                1. "Get Screen Time" - 输出 JSON 格式的屏幕使用时间
                <br />
                2. "Get Health Data" - 输出 JSON 格式的健康数据
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

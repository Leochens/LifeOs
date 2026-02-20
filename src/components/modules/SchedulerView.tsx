import { useEffect, useState } from "react";
import { useStore } from "@/stores/app";
import {
  createLaunchdTask,
  listLaunchdTasks,
  deleteLaunchdTask,
} from "@/services/tauri";
import type { ScheduledTask } from "@/types";

function formatInterval(seconds: number): string {
  if (seconds >= 3600 && seconds % 3600 === 0) {
    const h = seconds / 3600;
    return `每 ${h} 小时`;
  }
  if (seconds >= 60 && seconds % 60 === 0) {
    const m = seconds / 60;
    return `每 ${m} 分钟`;
  }
  return `每 ${seconds} 秒`;
}

function generateId(label: string): string {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `com.lifeos.${slug || "task"}.${Date.now().toString(36)}`;
}

interface NewTask {
  label: string;
  id: string;
  program: string;
  argsStr: string;
  intervalValue: number;
  intervalUnit: "seconds" | "minutes" | "hours";
  enabled: boolean;
}

const EMPTY_TASK: NewTask = {
  label: "",
  id: "",
  program: "",
  argsStr: "",
  intervalValue: 60,
  intervalUnit: "minutes",
  enabled: true,
};

export default function SchedulerView() {
  const scheduledTasks = useStore((s) => s.scheduledTasks);
  const setScheduledTasks = useStore((s) => s.setScheduledTasks);
  const vaultPath = useStore((s) => s.vaultPath);

  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState<NewTask>({ ...EMPTY_TASK });
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);

  async function loadTasks() {
    try {
      const tasks = await listLaunchdTasks();
      setScheduledTasks(tasks);
    } catch {
      // ignore load errors
    }
  }

  useEffect(() => {
    loadTasks();
  }, []);

  function updateForm(patch: Partial<NewTask>) {
    setForm((prev) => {
      const next = { ...prev, ...patch };
      // Auto-generate ID when label changes
      if (patch.label !== undefined && !prev.id) {
        next.id = generateId(patch.label);
      }
      return next;
    });
  }

  function toSeconds(value: number, unit: string): number {
    if (unit === "hours") return value * 3600;
    if (unit === "minutes") return value * 60;
    return value;
  }

  async function handleCreate() {
    if (!form.label || !form.program) return;
    setError("");
    const task: ScheduledTask = {
      id: form.id || generateId(form.label),
      label: form.label,
      program: form.program,
      args: form.argsStr ? form.argsStr.split(" ") : [],
      interval_seconds: toSeconds(form.intervalValue, form.intervalUnit),
      enabled: form.enabled,
    };
    try {
      await createLaunchdTask(task);
      setShowNew(false);
      setForm({ ...EMPTY_TASK });
      await loadTasks();
    } catch (e: unknown) {
      setError(String(e));
    }
  }

  async function handleDelete(id: string) {
    setDeleting(id);
    setError("");
    try {
      await deleteLaunchdTask(id);
      await loadTasks();
    } catch (e: unknown) {
      setError(String(e));
    } finally {
      setDeleting(null);
    }
  }

  function applyPreset(preset: {
    label: string;
    program: string;
    args: string[];
    interval: number;
  }) {
    const unit =
      preset.interval >= 3600
        ? "hours"
        : preset.interval >= 60
          ? "minutes"
          : "seconds";
    const val =
      unit === "hours"
        ? preset.interval / 3600
        : unit === "minutes"
          ? preset.interval / 60
          : preset.interval;

    setForm({
      label: preset.label,
      id: generateId(preset.label),
      program: preset.program,
      argsStr: preset.args.join(" "),
      intervalValue: val,
      intervalUnit: unit as NewTask["intervalUnit"],
      enabled: true,
    });
    setShowNew(true);
  }

  const presets = [
    {
      label: "每日备份 Vault",
      program: "/bin/sh",
      args: ["-c", `cp -r ${vaultPath ?? "~/vault"} ${vaultPath ?? "~/vault"}_backup`],
      interval: 86400,
    },
    {
      label: "每小时提醒",
      program: "/usr/bin/osascript",
      args: ["-e", 'display notification "该休息了" with title "Life OS"'],
      interval: 3600,
    },
  ];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 20,
        maxWidth: 900,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div>
          <div
            style={{
              fontFamily: "var(--font-disp)",
              fontSize: 28,
              letterSpacing: 3,
              color: "var(--accent)",
            }}
          >
            定时任务
          </div>
          <div
            style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 4 }}
          >
            使用 macOS launchd 管理定时任务。仅支持 macOS 系统。
          </div>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => {
            setForm({ ...EMPTY_TASK });
            setShowNew(true);
          }}
        >
          新建任务
        </button>
      </div>

      {/* Presets */}
      <div className="panel" style={{ padding: 16 }}>
        <div className="label" style={{ marginBottom: 10 }}>
          快速创建预设
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {presets.map((p) => (
            <button
              key={p.label}
              className="btn btn-ghost"
              onClick={() => applyPreset(p)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div
          style={{
            background: "rgba(255,107,107,0.12)",
            border: "1px solid var(--accent4)",
            color: "var(--accent4)",
            padding: "10px 16px",
            borderRadius: "var(--radius-sm)",
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      {/* Task cards */}
      <div
        style={{ display: "flex", flexDirection: "column", gap: 12 }}
      >
        {scheduledTasks.map((task) => (
          <div
            key={task.id}
            className="panel"
            style={{ padding: 20 }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 16,
              }}
            >
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    marginBottom: 8,
                  }}
                >
                  <span style={{ fontSize: 16, fontWeight: 600 }}>
                    {task.label}
                  </span>
                  <span
                    className={`tag ${task.enabled ? "green" : ""}`}
                    style={{ fontSize: 10 }}
                  >
                    {task.enabled ? "已启用" : "已禁用"}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--text-dim)",
                    fontFamily: "var(--font-mono)",
                    marginBottom: 6,
                  }}
                >
                  ID: {task.id}
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: "var(--text-mid)",
                    fontFamily: "var(--font-mono)",
                    marginBottom: 6,
                    wordBreak: "break-all",
                  }}
                >
                  {task.program} {task.args.join(" ")}
                </div>
                <div style={{ fontSize: 13, color: "var(--text-mid)" }}>
                  {formatInterval(task.interval_seconds)}
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  flexShrink: 0,
                }}
              >
                <div
                  className={`toggle ${task.enabled ? "on" : ""}`}
                  style={{ cursor: "default" }}
                  title={task.enabled ? "已启用" : "已禁用"}
                />
                <button
                  className="btn btn-ghost"
                  style={{
                    color: "var(--accent4)",
                    borderColor: "rgba(255,107,107,0.2)",
                    padding: "6px 14px",
                  }}
                  onClick={() => handleDelete(task.id)}
                  disabled={deleting === task.id}
                >
                  {deleting === task.id ? "删除中..." : "删除"}
                </button>
              </div>
            </div>
          </div>
        ))}

        {scheduledTasks.length === 0 && (
          <div
            style={{
              textAlign: "center",
              padding: 60,
              color: "var(--text-dim)",
              fontSize: 14,
            }}
          >
            暂无定时任务，点击"新建任务"或使用预设模板创建
          </div>
        )}
      </div>

      {/* New Task Modal */}
      {showNew && (
        <div className="modal-overlay" onClick={() => setShowNew(false)}>
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
            style={{ minWidth: 500 }}
          >
            <div
              style={{
                fontFamily: "var(--font-disp)",
                fontSize: 22,
                letterSpacing: 2,
                color: "var(--accent)",
                marginBottom: 20,
              }}
            >
              新建定时任务
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 16,
              }}
            >
              <div>
                <div className="label" style={{ marginBottom: 6 }}>
                  任务名称
                </div>
                <input
                  className="input"
                  placeholder="如: 每日备份"
                  value={form.label}
                  onChange={(e) => updateForm({ label: e.target.value })}
                />
              </div>

              <div>
                <div className="label" style={{ marginBottom: 6 }}>
                  任务 ID
                </div>
                <input
                  className="input"
                  placeholder="com.lifeos.task.xxx"
                  value={form.id}
                  onChange={(e) => updateForm({ id: e.target.value })}
                  style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}
                />
              </div>

              <div>
                <div className="label" style={{ marginBottom: 6 }}>
                  执行程序
                </div>
                <input
                  className="input"
                  placeholder="如: /usr/bin/python3"
                  value={form.program}
                  onChange={(e) => updateForm({ program: e.target.value })}
                  style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}
                />
              </div>

              <div>
                <div className="label" style={{ marginBottom: 6 }}>
                  参数（空格分隔）
                </div>
                <input
                  className="input"
                  placeholder="如: /path/to/script.py --flag"
                  value={form.argsStr}
                  onChange={(e) => updateForm({ argsStr: e.target.value })}
                  style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}
                />
              </div>

              <div>
                <div className="label" style={{ marginBottom: 6 }}>
                  执行间隔
                </div>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <input
                    className="input"
                    type="number"
                    min={1}
                    value={form.intervalValue}
                    onChange={(e) =>
                      updateForm({
                        intervalValue: Math.max(1, Number(e.target.value)),
                      })
                    }
                    style={{ width: 100 }}
                  />
                  <select
                    className="input"
                    value={form.intervalUnit}
                    onChange={(e) =>
                      updateForm({
                        intervalUnit: e.target.value as NewTask["intervalUnit"],
                      })
                    }
                    style={{ width: 100, cursor: "pointer" }}
                  >
                    <option value="seconds">秒</option>
                    <option value="minutes">分钟</option>
                    <option value="hours">小时</option>
                  </select>
                </div>
              </div>

              <div
                className="toggle-wrap"
                onClick={() => updateForm({ enabled: !form.enabled })}
              >
                <div
                  className={`toggle ${form.enabled ? "on" : ""}`}
                />
                <span style={{ fontSize: 13, color: "var(--text-mid)" }}>
                  {form.enabled ? "创建后启用" : "创建后禁用"}
                </span>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 10,
                  justifyContent: "flex-end",
                  marginTop: 8,
                }}
              >
                <button
                  className="btn btn-ghost"
                  onClick={() => setShowNew(false)}
                >
                  取消
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleCreate}
                  disabled={!form.label || !form.program}
                >
                  创建
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

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
    <div className="flex flex-col gap-5 max-w-[900px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="font-[var(--font-disp)] text-[28px] tracking-[3px] text-accent">
            定时任务
          </div>
          <div className="text-[13px] text-text-dim mt-1">
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
      <div className="panel p-4">
        <div className="label mb-2.5">
          快速创建预设
        </div>
        <div className="flex gap-2.5">
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
        <div className="bg-[rgba(255,107,107,0.12)] border border-accent4 text-accent4 px-4 py-2.5 rounded-[var(--radius-sm)] text-[13px]">
          {error}
        </div>
      )}

      {/* Task cards */}
      <div
        className="flex flex-col gap-3"
      >
        {scheduledTasks.map((task) => (
          <div
            key={task.id}
            className="panel p-5"
          >
            <div
              className="flex items-start gap-4"
            >
              <div className="flex-1">
                <div
                  className="flex items-center gap-[10px] mb-2"
                >
                  <span className="text-[16px] font-semibold">
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
                  className="text-[11px] text-text-dim font-[var(--font-mono)] mb-[6px]"
                >
                  ID: {task.id}
                </div>
                <div
                  className="text-[13px] text-text-mid font-[var(--font-mono)] mb-[6px] break-all"
                >
                  {task.program} {task.args.join(" ")}
                </div>
                <div className="text-[13px] text-text-mid">
                  {formatInterval(task.interval_seconds)}
                </div>
              </div>

              <div
                className="flex items-center gap-3 flex-shrink-0"
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
            className="text-center p-[60px] text-text-dim text-[14px]"
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
              className="font-[var(--font-disp)] text-[22px] tracking-[2px] text-accent mb-5"
            >
              新建定时任务
            </div>

            <div
              className="flex flex-col gap-4"
            >
              <div>
                <div className="label mb-1.5">
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
                <div className="label mb-1.5">
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
                <div className="label mb-1.5">
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
                <div className="label mb-1.5">
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
                <div className="label mb-1.5">
                  执行间隔
                </div>
                <div className="flex gap-2.5 items-center">
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
                className="flex gap-2.5 justify-end mt-2"
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

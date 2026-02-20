import { useState } from "react";
import { useStore } from "@/stores/app";
import { writeNote, moveFile } from "@/services/tauri";
import type { Project, ProjectStatus, Priority } from "@/types";
import { format } from "date-fns";

const COLUMNS: { id: ProjectStatus; label: string; color: string }[] = [
  { id: "backlog", label: "💤 待规划",  color: "var(--text-dim)" },
  { id: "todo",    label: "📋 计划中",  color: "var(--accent)" },
  { id: "active",  label: "⚡ 进行中",  color: "var(--accent2)" },
  { id: "done",    label: "✅ 已完成",  color: "var(--accent3)" },
];

const PRIORITY_COLORS: Record<Priority, string> = {
  urgent:  "var(--accent4)",
  high:   "var(--accent4)",
  medium: "var(--accent5)",
  low:    "var(--text-dim)",
};

export default function KanbanView() {
  const projects = useStore((s) => s.projects);
  const upsertProject = useStore((s) => s.upsertProject);
  const vaultPath = useStore((s) => s.vaultPath);
  const [newCardCol, setNewCardCol] = useState<ProjectStatus | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const moveProject = async (project: Project, newStatus: ProjectStatus) => {
    if (!vaultPath) return;
    const oldPath = project.path;
    const filename = project.path.split("/").pop()!;
    const newPath = `${vaultPath}/projects/${newStatus}/${filename}`;

    // Move file on disk
    await moveFile(oldPath, newPath);

    // Update store
    upsertProject({ ...project, path: newPath, status: newStatus, updated: format(new Date(), "yyyy-MM-dd") });
  };

  const createProject = async (status: ProjectStatus) => {
    if (!newTitle.trim() || !vaultPath) return;
    const slug = newTitle.toLowerCase().replace(/\s+/g, "-").replace(/[^\w-]/g, "");
    const path = `${vaultPath}/projects/${status}/${slug}.md`;
    const today = format(new Date(), "yyyy-MM-dd");

    const fm = {
      title: newTitle,
      status,
      priority: "medium",
      created: today,
      updated: today,
      progress: "0",
      tags: "",
    };

    await writeNote(path, fm, `## 目标\n\n${newTitle}\n\n## 任务\n\n- [ ] \n\n## 笔记\n\n`);
    upsertProject({
      path, title: newTitle, status, priority: "medium",
      created: today, updated: today, progress: 0, tags: [], content: "",
    });
    setNewCardCol(null);
    setNewTitle("");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ fontFamily: "var(--font-disp)", fontSize: 28, letterSpacing: 3, color: "var(--accent)" }}>
        项目看板
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, alignItems: "start" }}>
        {COLUMNS.map((col) => {
          const colProjects = projects.filter((p) => p.status === col.id);
          return (
            <div
              key={col.id}
              style={{ borderRadius: "var(--radius)", overflow: "hidden", border: "1px solid var(--border)" }}
              onDragOver={(e) => { e.preventDefault(); }}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("projectPath");
                const proj = projects.find((p) => p.path === id);
                if (proj && proj.status !== col.id) moveProject(proj, col.id);
                setDraggingId(null);
              }}
            >
              {/* Column header */}
              <div style={{ height: 3, background: col.color }} />
              <div style={{
                padding: "12px 14px",
                background: "var(--panel)",
                borderBottom: "1px solid var(--border)",
                display: "flex", alignItems: "center",
              }}>
                <span style={{ fontSize: 13, fontWeight: 500, flex: 1 }}>{col.label}</span>
                <span style={{
                  fontSize: 11, padding: "1px 8px", borderRadius: 20,
                  background: `${col.color}18`, color: col.color,
                }}>
                  {colProjects.length}
                </span>
              </div>

              {/* Cards */}
              <div style={{
                padding: 10,
                background: draggingId ? "rgba(0,200,255,0.02)" : "var(--panel)",
                display: "flex", flexDirection: "column", gap: 8, minHeight: 80,
              }}>
                {colProjects.map((p) => (
                  <KanbanCard
                    key={p.path}
                    project={p}
                    onDragStart={() => setDraggingId(p.path)}
                  />
                ))}

                {/* Add card inline */}
                {newCardCol === col.id ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <input
                      className="input"
                      autoFocus
                      placeholder="项目名称..."
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") createProject(col.id);
                        if (e.key === "Escape") { setNewCardCol(null); setNewTitle(""); }
                      }}
                    />
                    <div style={{ display: "flex", gap: 6 }}>
                      <button className="btn btn-primary" style={{ flex: 1, justifyContent: "center", fontSize: 12, padding: "6px" }}
                        onClick={() => createProject(col.id)}>确认</button>
                      <button className="btn btn-ghost" style={{ fontSize: 12, padding: "6px 10px" }}
                        onClick={() => { setNewCardCol(null); setNewTitle(""); }}>取消</button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setNewCardCol(col.id)}
                    style={{
                      width: "100%", padding: "7px",
                      background: "transparent",
                      border: "1px dashed var(--border)",
                      color: "var(--text-dim)", fontSize: 12,
                      borderRadius: "var(--radius-sm)", cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor = "rgba(0,200,255,0.4)";
                      (e.currentTarget as HTMLElement).style.color = "var(--accent)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
                      (e.currentTarget as HTMLElement).style.color = "var(--text-dim)";
                    }}
                  >
                    + 添加
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function KanbanCard({ project, onDragStart }: { project: Project; onDragStart: () => void }) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("projectPath", project.path);
        onDragStart();
      }}
      style={{
        background: "var(--panel2)", border: "1px solid var(--border)",
        borderRadius: "var(--radius-sm)", padding: "11px 12px",
        cursor: "grab", transition: "all 0.15s",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = "rgba(0,200,255,0.3)";
        (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
        (e.currentTarget as HTMLElement).style.transform = "none";
      }}
    >
      <div style={{ fontSize: 13, marginBottom: 8, lineHeight: 1.4 }}>{project.title}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        {project.tags.slice(0, 2).map((tag) => (
          <span key={tag} className="tag" style={{ fontSize: 10 }}>{tag}</span>
        ))}
        <span style={{
          marginLeft: "auto", fontSize: 10,
          color: PRIORITY_COLORS[project.priority],
        }}>
          {project.priority === "high" ? "↑高" : project.priority === "medium" ? "→中" : "↓低"}
        </span>
      </div>
      {project.progress > 0 && (
        <div style={{ marginTop: 8 }}>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${project.progress}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}

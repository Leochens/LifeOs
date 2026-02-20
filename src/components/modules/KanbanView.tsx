import { useState, useMemo } from "react";
import { useStore } from "@/stores/app";
import { writeNote, readNote, moveFile, deleteFile } from "@/services/tauri";
import type { Project, ProjectStatus, Priority } from "@/types";
import { format } from "date-fns";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useDroppable } from "@dnd-kit/core";

const COLUMNS: { id: ProjectStatus; label: string; color: string; accent: string }[] = [
  { id: "backlog", label: "待规划",  color: "var(--text-dim)",   accent: "rgba(128,128,128,0.12)" },
  { id: "todo",    label: "计划中",  color: "var(--accent)",     accent: "rgba(0,200,255,0.08)" },
  { id: "active",  label: "进行中",  color: "var(--accent2)",    accent: "rgba(200,100,255,0.08)" },
  { id: "done",    label: "已完成",  color: "var(--accent3)",    accent: "rgba(0,200,100,0.08)" },
];

const PRIORITY_COLORS: Record<Priority, string> = {
  urgent: "var(--accent4)", high: "var(--accent4)", medium: "var(--accent5)", low: "var(--text-dim)",
};
const PRIORITY_LABELS: Record<Priority, string> = {
  urgent: "紧急", high: "高", medium: "中", low: "低",
};

export default function KanbanView() {
  const projects = useStore((s) => s.projects);
  const setProjects = useStore((s) => s.setProjects);
  const upsertProject = useStore((s) => s.upsertProject);
  const vaultPath = useStore((s) => s.vaultPath);

  const [newCardCol, setNewCardCol] = useState<ProjectStatus | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState<Priority>("medium");
  const [newTags, setNewTags] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);

  // Edit modal
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editPriority, setEditPriority] = useState<Priority>("medium");
  const [editTags, setEditTags] = useState("");
  const [editProgress, setEditProgress] = useState(0);
  const [editDue, setEditDue] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const activeProject = useMemo(
    () => projects.find((p) => p.path === activeId) ?? null,
    [activeId, projects]
  );

  const projectsByStatus = useMemo(() => {
    const map: Record<ProjectStatus, Project[]> = { backlog: [], todo: [], active: [], paused: [], done: [] };
    for (const p of projects) {
      if (map[p.status]) map[p.status].push(p);
    }
    return map;
  }, [projects]);

  const moveProject = async (project: Project, newStatus: ProjectStatus) => {
    if (!vaultPath || project.status === newStatus) return;
    try {
      const filename = project.path.split("/").pop()!;
      const newPath = `${vaultPath}/projects/${newStatus}/${filename}`;
      await moveFile(project.path, newPath);
      upsertProject({ ...project, path: newPath, status: newStatus, updated: format(new Date(), "yyyy-MM-dd") });
    } catch (err) {
      console.error("Failed to move project:", err);
    }
  };

  const createProject = async (status: ProjectStatus) => {
    if (!newTitle.trim() || !vaultPath) return;
    const slug = newTitle.trim().replace(/\s+/g, "-").replace(/[^\p{L}\p{N}_-]/gu, "").slice(0, 40) || `proj-${Date.now()}`;
    const path = `${vaultPath}/projects/${status}/${slug}.md`;
    const today = format(new Date(), "yyyy-MM-dd");
    const fm = { title: newTitle.trim(), status, priority: newPriority, created: today, updated: today, progress: "0", tags: newTags };
    await writeNote(path, fm, `## 目标\n\n${newTitle.trim()}\n\n## 任务\n\n- [ ] \n\n## 笔记\n\n`);
    upsertProject({
      path, title: newTitle.trim(), status, priority: newPriority,
      created: today, updated: today, progress: 0,
      tags: newTags ? newTags.split(",").map(t => t.trim()).filter(Boolean) : [],
      content: "",
    });
    setNewCardCol(null);
    setNewTitle("");
    setNewPriority("medium");
    setNewTags("");
  };

  const openEdit = (project: Project) => {
    setEditingProject(project);
    setEditTitle(project.title);
    setEditPriority(project.priority);
    setEditTags(project.tags.join(", "));
    setEditProgress(project.progress);
    setEditDue(project.due || "");
  };

  const saveEdit = async () => {
    if (!editingProject || !vaultPath) return;
    try {
      const note = await readNote(editingProject.path);
      const fm = {
        ...note.frontmatter,
        title: editTitle.trim(), priority: editPriority, tags: editTags,
        progress: String(editProgress), due: editDue || "~",
        updated: format(new Date(), "yyyy-MM-dd"),
      };
      await writeNote(editingProject.path, fm, note.content);
      upsertProject({
        ...editingProject, title: editTitle.trim(), priority: editPriority,
        tags: editTags ? editTags.split(",").map(t => t.trim()).filter(Boolean) : [],
        progress: editProgress, due: editDue || undefined,
        updated: format(new Date(), "yyyy-MM-dd"),
      });
      setEditingProject(null);
    } catch (err) {
      console.error("Failed to save project:", err);
    }
  };

  const removeProject = async (project: Project) => {
    if (!confirm(`确定删除项目「${project.title}」吗？`)) return;
    try {
      await deleteFile(project.path);
      setProjects(projects.filter(p => p.path !== project.path));
    } catch (err) {
      console.error("Failed to delete:", err);
    }
  };

  // DnD handlers
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (_event: DragOverEvent) => {
    // Visual feedback handled by useDroppable
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const project = projects.find((p) => p.path === active.id);
    if (!project) return;

    // Determine target column
    const overId = over.id as string;
    // Check if dropped on a column droppable
    const targetCol = COLUMNS.find((c) => c.id === overId);
    if (targetCol && project.status !== targetCol.id) {
      moveProject(project, targetCol.id);
      return;
    }

    // Check if dropped on another card - move to that card's column
    const targetProject = projects.find((p) => p.path === overId);
    if (targetProject && project.status !== targetProject.status) {
      moveProject(project, targetProject.status);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontFamily: "var(--font-disp)", fontSize: 28, letterSpacing: 3, color: "var(--accent)" }}>
          项目看板
        </div>
        <span style={{ fontSize: 12, color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
          {projects.length} 个项目
        </span>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, alignItems: "start" }}>
          {COLUMNS.map((col) => (
            <KanbanColumn
              key={col.id}
              col={col}
              projects={projectsByStatus[col.id]}
              newCardCol={newCardCol}
              newTitle={newTitle}
              newPriority={newPriority}
              newTags={newTags}
              onNewTitle={setNewTitle}
              onNewPriority={setNewPriority}
              onNewTags={setNewTags}
              onStartAdd={() => { setNewCardCol(col.id); setNewTitle(""); setNewPriority("medium"); setNewTags(""); }}
              onCancelAdd={() => { setNewCardCol(null); setNewTitle(""); }}
              onConfirmAdd={() => createProject(col.id)}
              onEdit={openEdit}
              onDelete={removeProject}
            />
          ))}
        </div>

        <DragOverlay dropAnimation={null}>
          {activeProject && <CardOverlay project={activeProject} />}
        </DragOverlay>
      </DndContext>

      {/* Edit Modal */}
      {editingProject && (
        <div style={{
          position: "fixed", top: 0, right: 0, bottom: 0, left: 0, zIndex: 100,
          background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center",
        }} onClick={(e) => e.target === e.currentTarget && setEditingProject(null)}>
          <div style={{
            background: "var(--panel)", border: "1px solid var(--border)",
            borderRadius: "var(--radius)", padding: 28, width: 480,
            display: "flex", flexDirection: "column", gap: 16,
          }}>
            <div style={{ fontFamily: "var(--font-disp)", fontSize: 20, letterSpacing: 2, color: "var(--accent)" }}>编辑项目</div>
            <div>
              <label style={{ display: "block", fontSize: 12, color: "var(--text-dim)", marginBottom: 6 }}>标题</label>
              <input className="input" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} style={{ width: "100%" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, color: "var(--text-dim)", marginBottom: 6 }}>优先级</label>
              <div style={{ display: "flex", gap: 6 }}>
                {(["low", "medium", "high", "urgent"] as Priority[]).map((p) => (
                  <button key={p} onClick={() => setEditPriority(p)} style={{
                    padding: "6px 16px", fontSize: 12, cursor: "pointer", borderRadius: "var(--radius-sm)",
                    background: editPriority === p ? `${PRIORITY_COLORS[p]}22` : "transparent",
                    color: editPriority === p ? PRIORITY_COLORS[p] : "var(--text-dim)",
                    border: `1px solid ${editPriority === p ? `${PRIORITY_COLORS[p]}55` : "var(--border)"}`,
                  }}>{PRIORITY_LABELS[p]}</button>
                ))}
              </div>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, color: "var(--text-dim)", marginBottom: 6 }}>进度: {editProgress}%</label>
              <input type="range" min={0} max={100} value={editProgress}
                onChange={(e) => setEditProgress(Number(e.target.value))} style={{ width: "100%", accentColor: "var(--accent)" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, color: "var(--text-dim)", marginBottom: 6 }}>截止日期</label>
              <input className="input" type="date" value={editDue} onChange={(e) => setEditDue(e.target.value)} style={{ width: 200 }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, color: "var(--text-dim)", marginBottom: 6 }}>标签 (逗号分隔)</label>
              <input className="input" placeholder="前端, API, 重构..." value={editTags} onChange={(e) => setEditTags(e.target.value)} style={{ width: "100%" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
              <button className="btn btn-ghost" onClick={() => setEditingProject(null)}>取消</button>
              <button className="btn btn-primary" onClick={saveEdit}>保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Column component with useDroppable
// ─────────────────────────────────────────────────────────────────────────────

function KanbanColumn({ col, projects, newCardCol, newTitle, newPriority, newTags,
  onNewTitle, onNewPriority, onNewTags, onStartAdd, onCancelAdd, onConfirmAdd, onEdit, onDelete,
}: {
  col: typeof COLUMNS[number];
  projects: Project[];
  newCardCol: ProjectStatus | null;
  newTitle: string;
  newPriority: Priority;
  newTags: string;
  onNewTitle: (v: string) => void;
  onNewPriority: (v: Priority) => void;
  onNewTags: (v: string) => void;
  onStartAdd: () => void;
  onCancelAdd: () => void;
  onConfirmAdd: () => void;
  onEdit: (p: Project) => void;
  onDelete: (p: Project) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: col.id });

  return (
    <div
      ref={setNodeRef}
      style={{
        borderRadius: "var(--radius)", overflow: "hidden",
        border: `1px solid ${isOver ? col.color : "var(--border)"}`,
        transition: "border-color 0.2s, box-shadow 0.2s",
        boxShadow: isOver ? `0 0 12px ${col.color}33` : "none",
      }}
    >
      <div style={{ height: 3, background: `linear-gradient(90deg, ${col.color}, transparent)` }} />
      <div style={{
        padding: "12px 14px", background: "var(--panel)",
        borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center",
      }}>
        <span style={{ fontSize: 13, fontWeight: 600, flex: 1, letterSpacing: 1 }}>{col.label}</span>
        <span style={{
          fontSize: 11, padding: "2px 10px", borderRadius: 20,
          background: `${col.color}18`, color: col.color,
          fontFamily: "var(--font-mono)", fontWeight: 500,
        }}>{projects.length}</span>
      </div>

      <div style={{
        padding: 10,
        background: isOver ? col.accent : "var(--panel)",
        display: "flex", flexDirection: "column", gap: 8,
        minHeight: 100, transition: "background 0.2s",
      }}>
        <SortableContext items={projects.map(p => p.path)} strategy={verticalListSortingStrategy}>
          {projects.map((p) => (
            <SortableCard key={p.path} project={p} onEdit={() => onEdit(p)} onDelete={() => onDelete(p)} />
          ))}
        </SortableContext>

        {newCardCol === col.id ? (
          <div style={{
            display: "flex", flexDirection: "column", gap: 8,
            padding: 12, background: "var(--panel2)",
            border: "1px solid var(--border)", borderRadius: "var(--radius-sm)",
          }}>
            <input className="input" autoFocus placeholder="项目名称..."
              value={newTitle} onChange={(e) => onNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onConfirmAdd();
                if (e.key === "Escape") onCancelAdd();
              }} />
            <div style={{ display: "flex", gap: 4 }}>
              {(["low", "medium", "high", "urgent"] as Priority[]).map((p) => (
                <button key={p} onClick={() => onNewPriority(p)} style={{
                  flex: 1, padding: "4px 0", fontSize: 11, cursor: "pointer",
                  borderRadius: "var(--radius-sm)",
                  background: newPriority === p ? `${PRIORITY_COLORS[p]}22` : "transparent",
                  color: newPriority === p ? PRIORITY_COLORS[p] : "var(--text-dim)",
                  border: `1px solid ${newPriority === p ? `${PRIORITY_COLORS[p]}55` : "var(--border)"}`,
                }}>{PRIORITY_LABELS[p]}</button>
              ))}
            </div>
            <input className="input" placeholder="标签 (逗号分隔)..." value={newTags}
              onChange={(e) => onNewTags(e.target.value)} style={{ fontSize: 12 }} />
            <div style={{ display: "flex", gap: 6 }}>
              <button className="btn btn-primary" style={{ flex: 1, justifyContent: "center", fontSize: 12, padding: "6px" }}
                onClick={onConfirmAdd}>创建</button>
              <button className="btn btn-ghost" style={{ fontSize: 12, padding: "6px 10px" }}
                onClick={onCancelAdd}>取消</button>
            </div>
          </div>
        ) : (
          <button onClick={onStartAdd} style={{
            width: "100%", padding: "8px", background: "transparent",
            border: "1px dashed var(--border)", color: "var(--text-dim)",
            fontSize: 12, borderRadius: "var(--radius-sm)", cursor: "pointer",
            transition: "all 0.15s",
          }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = col.color; e.currentTarget.style.color = col.color; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-dim)"; }}
          >+ 添加项目</button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sortable Card
// ─────────────────────────────────────────────────────────────────────────────

function SortableCard({ project, onEdit, onDelete }: {
  project: Project;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging: isSortDragging } = useSortable({ id: project.path });
  const [showActions, setShowActions] = useState(false);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div style={{
        background: "var(--panel2)", border: "1px solid var(--border)",
        borderRadius: "var(--radius-sm)", padding: "12px 14px",
        cursor: "grab", position: "relative",
      }}>
        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6, lineHeight: 1.5, paddingRight: showActions ? 50 : 0 }}>
          {project.title}
        </div>

        {showActions && (
          <div style={{ position: "absolute", top: 8, right: 8, display: "flex", gap: 2 }}>
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              style={{
                width: 22, height: 22, borderRadius: 4, border: "none",
                background: "rgba(0,200,255,0.12)", color: "var(--accent)",
                cursor: "pointer", fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center",
              }}
              title="编辑"
            >&#9998;</button>
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              style={{
                width: 22, height: 22, borderRadius: 4, border: "none",
                background: "rgba(255,107,107,0.1)", color: "var(--accent4)",
                cursor: "pointer", fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center",
              }}
              title="删除"
            >&#10005;</button>
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {project.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="tag" style={{ fontSize: 10 }}>{tag}</span>
          ))}
          {project.due && (
            <span style={{ fontSize: 10, color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>{project.due}</span>
          )}
          <span style={{
            marginLeft: "auto", fontSize: 10,
            color: PRIORITY_COLORS[project.priority],
            padding: "2px 8px", borderRadius: 10,
            background: `${PRIORITY_COLORS[project.priority]}15`,
            border: `1px solid ${PRIORITY_COLORS[project.priority]}30`,
            fontWeight: 500,
          }}>{PRIORITY_LABELS[project.priority]}</span>
        </div>

        {project.progress > 0 && (
          <div style={{ marginTop: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
              <span style={{ fontSize: 10, color: "var(--text-dim)" }}>进度</span>
              <span style={{ fontSize: 10, color: "var(--accent)", fontFamily: "var(--font-mono)" }}>{project.progress}%</span>
            </div>
            <div className="progress-track" style={{ height: 3 }}>
              <div className="progress-fill" style={{ width: `${project.progress}%` }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Drag Overlay (ghost card while dragging)
// ─────────────────────────────────────────────────────────────────────────────

function CardOverlay({ project }: { project: Project }) {
  return (
    <div style={{
      background: "var(--panel2)", border: "2px solid var(--accent)",
      borderRadius: "var(--radius-sm)", padding: "12px 14px",
      boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
      opacity: 0.95, cursor: "grabbing", width: 240,
    }}>
      <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>{project.title}</div>
      <span style={{
        fontSize: 10, color: PRIORITY_COLORS[project.priority],
        padding: "2px 8px", borderRadius: 10,
        background: `${PRIORITY_COLORS[project.priority]}15`,
      }}>{PRIORITY_LABELS[project.priority]}</span>
    </div>
  );
}

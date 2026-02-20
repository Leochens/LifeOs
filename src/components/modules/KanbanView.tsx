import { useState, useMemo, useEffect } from "react";
import { useStore } from "@/stores/app";
import { writeNote, loadBoardConfig, saveBoardConfig } from "@/services/tauri";
import type { Project, KanbanColumn, Priority } from "@/types";
import { format } from "date-fns";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragEndEvent,
} from "@dnd-kit/core";
import { Plus, ChevronLeft } from "lucide-react";

const DEFAULT_COLUMNS: KanbanColumn[] = [
  { id: "backlog", name: "待规划", color: "#888" },
  { id: "todo", name: "计划中", color: "#00c8ff" },
  { id: "active", name: "进行中", color: "#c864ff" },
  { id: "done", name: "已完成", color: "#00c864" },
];

const PRIORITY_COLORS: Record<Priority, string> = {
  urgent: "var(--accent4)", high: "var(--accent4)", medium: "var(--accent5)", low: "var(--text-dim)",
};
const PRIORITY_LABELS: Record<Priority, string> = {
  urgent: "紧急", high: "高", medium: "中", low: "低",
};

// Parse board config from YAML
function parseBoardConfig(content: string): KanbanColumn[] {
  if (!content.trim()) return DEFAULT_COLUMNS;
  const columns: KanbanColumn[] = [];
  const lines = content.split("\n");
  let inColumns = false;
  let currentCol: Partial<KanbanColumn> = {};

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "columns:") {
      inColumns = true;
      continue;
    }
    if (inColumns) {
      if (trimmed.startsWith("- id:")) {
        if (currentCol.id) {
          columns.push(currentCol as KanbanColumn);
        }
        currentCol = { id: trimmed.replace("- id:", "").trim() };
      } else if (trimmed.startsWith("name:") && currentCol.id) {
        currentCol.name = trimmed.replace("name:", "").trim().replace(/"/g, "");
      } else if (trimmed.startsWith("color:") && currentCol.id) {
        currentCol.color = trimmed.replace("color:", "").trim().replace(/"/g, "");
      }
    }
  }
  if (currentCol.id) columns.push(currentCol as KanbanColumn);

  return columns.length > 0 ? columns : DEFAULT_COLUMNS;
}

// Convert columns to YAML
function columnsToYaml(columns: KanbanColumn[]): string {
  const lines = ["columns:"];
  for (const col of columns) {
    lines.push(`  - id: ${col.id}`);
    lines.push(`    name: "${col.name}"`);
    lines.push(`    color: "${col.color}"`);
  }
  return lines.join("\n");
}

export default function KanbanView() {
  const projects = useStore((s) => s.projects);
  const upsertProject = useStore((s) => s.upsertProject);
  const vaultPath = useStore((s) => s.vaultPath);

  // 项目列表 vs 看板视图
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [columns, setColumns] = useState<KanbanColumn[]>(DEFAULT_COLUMNS);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Add column modal
  const [showAddCol, setShowAddCol] = useState(false);
  const [newColName, setNewColName] = useState("");
  const [newColColor, setNewColColor] = useState("#00c8ff");

  // Load columns from config
  useEffect(() => {
    if (!vaultPath) return;
    loadBoardConfig(vaultPath)
      .then((content) => {
        const parsed = parseBoardConfig(content);
        setColumns(parsed);
      })
      .catch(() => {
        setColumns(DEFAULT_COLUMNS);
      });
  }, [vaultPath]);

  // Save columns to config
  const saveColumns = async (newColumns: KanbanColumn[]) => {
    if (!vaultPath) return;
    try {
      await saveBoardConfig(vaultPath, columnsToYaml(newColumns));
      setColumns(newColumns);
    } catch (err) {
      console.error("Failed to save board config:", err);
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // 按项目分组 - 这里我们需要从项目内容中解析出任务
  // 由于当前项目是 markdown 文件，我们需要读取内容来获取任务列表
  // 为了简化，这里暂时显示项目的元信息

  const openProjectBoard = (project: Project) => {
    setSelectedProject(project);
  };

  const goBackToList = () => {
    setSelectedProject(null);
  };

  // 如果选择了项目，显示项目看板
  if (selectedProject) {
    return (
      <ProjectBoard
        project={selectedProject}
        columns={columns}
        onBack={goBackToList}
        showAddCol={showAddCol}
        setShowAddCol={setShowAddCol}
        newColName={newColName}
        setNewColName={setNewColName}
        newColColor={newColColor}
        setNewColColor={setNewColColor}
        addColumn={() => {
          if (!newColName.trim()) return;
          const id = newColName.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^\p{L}\p{N}_-]/gu, "").slice(0, 20);
          const newCol: KanbanColumn = { id: id || `col-${Date.now()}`, name: newColName.trim(), color: newColColor };
          saveColumns([...columns, newCol]);
          setShowAddCol(false);
          setNewColName("");
          setNewColColor("#00c8ff");
        }}
        sensors={sensors}
        activeId={activeId}
        setActiveId={setActiveId}
      />
    );
  }

  // 否则显示项目列表
  return (
    <ProjectList
      projects={projects}
      onSelectProject={openProjectBoard}
      onCreateProject={async (title, priority, tags) => {
        if (!title.trim() || !vaultPath) return;
        const slug = title.trim().replace(/\s+/g, "-").replace(/[^\p{L}\p{N}_-]/gu, "").slice(0, 40) || `proj-${Date.now()}`;
        const path = `${vaultPath}/projects/backlog/${slug}.md`;
        const today = format(new Date(), "yyyy-MM-dd");
        const fm = { title: title.trim(), status: "backlog", priority, created: today, updated: today, progress: "0", tags };
        await writeNote(path, fm, `## 目标\n\n${title.trim()}\n\n## 任务\n\n- [ ] \n\n## 笔记\n\n`);
        upsertProject({
          path, title: title.trim(), status: "backlog", priority,
          created: today, updated: today, progress: 0,
          tags: tags ? tags.split(",").map(t => t.trim()).filter(Boolean) : [],
          content: "",
        });
      }}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Project List View
// ─────────────────────────────────────────────────────────────────────────────

function ProjectList({
  projects,
  onSelectProject,
  onCreateProject,
}: {
  projects: Project[];
  onSelectProject: (p: Project) => void;
  onCreateProject: (title: string, priority: Priority, tags: string) => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState<Priority>("medium");
  const [newTags, setNewTags] = useState("");

  const statusColors: Record<string, string> = {
    backlog: "#888",
    todo: "#00c8ff",
    active: "#c864ff",
    paused: "#ffd93d",
    done: "#00c864",
  };

  const statusLabels: Record<string, string> = {
    backlog: "待规划",
    todo: "计划中",
    active: "进行中",
    paused: "暂停",
    done: "已完成",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontFamily: "var(--font-disp)", fontSize: 28, letterSpacing: 3, color: "var(--accent)" }}>
          项目
        </div>
        <span style={{ fontSize: 12, color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
          {projects.length} 个项目
        </span>
      </div>

      {/* Add new project */}
      {showAdd ? (
        <div className="panel" style={{ padding: 16, background: "var(--panel2)" }}>
          <input
            className="input"
            autoFocus
            placeholder="项目名称..."
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newTitle.trim()) {
                onCreateProject(newTitle, newPriority, newTags);
                setShowAdd(false);
                setNewTitle("");
                setNewPriority("medium");
                setNewTags("");
              }
              if (e.key === "Escape") {
                setShowAdd(false);
                setNewTitle("");
              }
            }}
            style={{ width: "100%", marginBottom: 12 }}
          />
          <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
            {(["low", "medium", "high", "urgent"] as Priority[]).map((p) => (
              <button
                key={p}
                onClick={() => setNewPriority(p)}
                style={{
                  flex: 1,
                  padding: "6px 0",
                  fontSize: 12,
                  cursor: "pointer",
                  borderRadius: "var(--radius-sm)",
                  background: newPriority === p ? `${PRIORITY_COLORS[p]}22` : "transparent",
                  color: newPriority === p ? PRIORITY_COLORS[p] : "var(--text-dim)",
                  border: `1px solid ${newPriority === p ? `${PRIORITY_COLORS[p]}55` : "var(--border)"}`,
                }}
              >
                {PRIORITY_LABELS[p]}
              </button>
            ))}
          </div>
          <input
            className="input"
            placeholder="标签 (逗号分隔)..."
            value={newTags}
            onChange={(e) => setNewTags(e.target.value)}
            style={{ width: "100%", marginBottom: 12, fontSize: 12 }}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="btn btn-primary"
              style={{ flex: 1, justifyContent: "center" }}
              onClick={() => {
                if (newTitle.trim()) {
                  onCreateProject(newTitle, newPriority, newTags);
                  setShowAdd(false);
                  setNewTitle("");
                  setNewPriority("medium");
                  setNewTags("");
                }
              }}
            >
              创建
            </button>
            <button className="btn btn-ghost" onClick={() => setShowAdd(false)}>
              取消
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "12px 16px",
            background: "transparent",
            border: "1px dashed var(--border)",
            borderRadius: "var(--radius)",
            color: "var(--text-dim)",
            cursor: "pointer",
            fontSize: 13,
            transition: "all 0.15s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "var(--accent)";
            e.currentTarget.style.color = "var(--accent)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--border)";
            e.currentTarget.style.color = "var(--text-dim)";
          }}
        >
          <Plus size={16} />
          新建项目
        </button>
      )}

      {/* Project cards grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
        {projects.map((project) => (
          <div
            key={project.path}
            onClick={() => onSelectProject(project)}
            style={{
              background: "var(--panel2)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              padding: 16,
              cursor: "pointer",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "var(--accent)";
              e.currentTarget.style.transform = "translateY(-2px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--border)";
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
              <div style={{ fontSize: 15, fontWeight: 600, flex: 1, lineHeight: 1.4 }}>{project.title}</div>
              <span
                style={{
                  fontSize: 10,
                  padding: "2px 8px",
                  borderRadius: 10,
                  background: `${statusColors[project.status]}18`,
                  color: statusColors[project.status],
                  fontWeight: 500,
                  whiteSpace: "nowrap",
                  marginLeft: 8,
                }}
              >
                {statusLabels[project.status]}
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              {project.tags.slice(0, 3).map((tag) => (
                <span key={tag} className="tag" style={{ fontSize: 10 }}>
                  {tag}
                </span>
              ))}
              {project.due && (
                <span style={{ fontSize: 10, color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
                  {project.due}
                </span>
              )}
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span
                style={{
                  fontSize: 10,
                  color: PRIORITY_COLORS[project.priority],
                  padding: "2px 8px",
                  borderRadius: 10,
                  background: `${PRIORITY_COLORS[project.priority]}15`,
                  border: `1px solid ${PRIORITY_COLORS[project.priority]}30`,
                  fontWeight: 500,
                }}
              >
                {PRIORITY_LABELS[project.priority]}
              </span>
              {project.progress > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div className="progress-track" style={{ width: 60, height: 3 }}>
                    <div className="progress-fill" style={{ width: `${project.progress}%` }} />
                  </div>
                  <span style={{ fontSize: 10, color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
                    {project.progress}%
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Project Board View (single project's panels)
// ─────────────────────────────────────────────────────────────────────────────

function ProjectBoard({
  project,
  columns,
  onBack,
  showAddCol,
  setShowAddCol,
  newColName,
  setNewColName,
  newColColor,
  setNewColColor,
  addColumn,
  sensors,
  activeId,
  setActiveId,
}: {
  project: Project;
  columns: KanbanColumn[];
  onBack: () => void;
  showAddCol: boolean;
  setShowAddCol: (v: boolean) => void;
  newColName: string;
  setNewColName: (v: string) => void;
  newColColor: string;
  setNewColColor: (v: string) => void;
  addColumn: () => void;
  sensors: ReturnType<typeof useSensors>;
  activeId: string | null;
  setActiveId: (v: string | null) => void;
}) {
  // 这里我们从项目内容中解析任务
  // 简化版本：直接从项目文件中读取内容
  const [tasks, setTasks] = useState<{ id: string; text: string; done: boolean; status: string }[]>([]);

  useEffect(() => {
    // 模拟从项目内容解析任务
    // 实际应该解析 markdown 中的任务列表
    const lines = project.content.split("\n");
    const parsedTasks: { id: string; text: string; done: boolean; status: string }[] = [];
    let inTasks = false;

    for (const line of lines) {
      if (line.includes("## 任务")) {
        inTasks = true;
        continue;
      }
      if (inTasks && line.startsWith("- [")) {
        const done = line.includes("[x]");
        const text = line.replace(/^-\s*\[[x\s]\]\s*/, "").trim();
        parsedTasks.push({
          id: `task-${parsedTasks.length}`,
          text,
          done,
          status: project.status, // 暂时使用项目状态
        });
      }
      if (inTasks && line.startsWith("## ") && !line.includes("任务")) {
        break;
      }
    }
    setTasks(parsedTasks);
  }, [project]);

  const tasksByStatus = useMemo(() => {
    const map: Record<string, typeof tasks> = {};
    for (const col of columns) {
      map[col.id] = [];
    }
    for (const t of tasks) {
      if (map[t.status]) map[t.status].push(t);
    }
    return map;
  }, [tasks, columns]);

  const toggleTask = (taskId: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, done: !t.done } : t))
    );
    // TODO: 保存回文件
  };

  const [newTaskCol, setNewTaskCol] = useState<string | null>(null);
  const [newTaskText, setNewTaskText] = useState("");

  const addTask = (colId: string) => {
    if (!newTaskText.trim()) return;
    setTasks((prev) => [
      ...prev,
      {
        id: `task-${Date.now()}`,
        text: newTaskText.trim(),
        done: false,
        status: colId,
      },
    ]);
    setNewTaskCol(null);
    setNewTaskText("");
    // TODO: 保存回文件
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    const overId = over.id as string;
    const targetCol = columns.find((c) => c.id === overId);

    if (targetCol && task.status !== targetCol.id) {
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: targetCol.id } : t))
      );
      // TODO: 保存回文件
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <button
          onClick={onBack}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 32,
            height: 32,
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--border)",
            background: "var(--panel)",
            color: "var(--text-dim)",
            cursor: "pointer",
          }}
        >
          <ChevronLeft size={18} />
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "var(--font-disp)", fontSize: 24, letterSpacing: 2, color: "var(--accent)" }}>
            {project.title}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 4 }}>
            {project.content.slice(0, 100)}...
          </div>
        </div>
        <span style={{ fontSize: 12, color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
          {tasks.length} 个任务 · {columns.length} 个面板
        </span>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={(e) => setActiveId(e.active.id as string)}
        onDragEnd={handleDragEnd}
      >
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${columns.length},1fr)`, gap: 14, alignItems: "start" }}>
          {columns.map((col) => (
            <div
              key={col.id}
              style={{
                borderRadius: "var(--radius)",
                overflow: "hidden",
                border: `1px solid var(--border)`,
              }}
            >
              <div style={{ height: 3, background: `linear-gradient(90deg, ${col.color}, transparent)` }} />
              <div
                style={{
                  padding: "12px 14px",
                  background: "var(--panel)",
                  borderBottom: "1px solid var(--border)",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 600, flex: 1, letterSpacing: 1 }}>{col.name}</span>
                <span
                  style={{
                    fontSize: 11,
                    padding: "2px 10px",
                    borderRadius: 20,
                    background: `${col.color}18`,
                    color: col.color,
                    fontFamily: "var(--font-mono)",
                    fontWeight: 500,
                  }}
                >
                  {(tasksByStatus[col.id] || []).length}
                </span>
              </div>

              <div
                style={{
                  padding: 10,
                  background: "var(--panel)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  minHeight: 100,
                }}
              >
                {(tasksByStatus[col.id] || []).map((task) => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", task.id);
                      setActiveId(task.id);
                    }}
                    style={{
                      background: "var(--panel2)",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius-sm)",
                      padding: "10px 12px",
                      cursor: "grab",
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 8,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={task.done}
                      onChange={() => toggleTask(task.id)}
                      style={{ marginTop: 3, accentColor: "var(--accent)" }}
                    />
                    <span
                      style={{
                        fontSize: 13,
                        flex: 1,
                        textDecoration: task.done ? "line-through" : "none",
                        color: task.done ? "var(--text-dim)" : "var(--text)",
                      }}
                    >
                      {task.text}
                    </span>
                  </div>
                ))}

                {newTaskCol === col.id ? (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                      padding: 12,
                      background: "var(--panel2)",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius-sm)",
                    }}
                  >
                    <input
                      className="input"
                      autoFocus
                      placeholder="任务内容..."
                      value={newTaskText}
                      onChange={(e) => setNewTaskText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") addTask(col.id);
                        if (e.key === "Escape") {
                          setNewTaskCol(null);
                          setNewTaskText("");
                        }
                      }}
                    />
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        className="btn btn-primary"
                        style={{ flex: 1, justifyContent: "center", fontSize: 12, padding: "6px" }}
                        onClick={() => addTask(col.id)}
                      >
                        添加
                      </button>
                      <button
                        className="btn btn-ghost"
                        style={{ fontSize: 12, padding: "6px 10px" }}
                        onClick={() => {
                          setNewTaskCol(null);
                          setNewTaskText("");
                        }}
                      >
                        取消
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setNewTaskCol(col.id)}
                    style={{
                      width: "100%",
                      padding: "8px",
                      background: "transparent",
                      border: "1px dashed var(--border)",
                      color: "var(--text-dim)",
                      fontSize: 12,
                      borderRadius: "var(--radius-sm)",
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = col.color;
                      e.currentTarget.style.color = col.color;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "var(--border)";
                      e.currentTarget.style.color = "var(--text-dim)";
                    }}
                  >
                    + 添加任务
                  </button>
                )}
              </div>
            </div>
          ))}

          {/* Add column button */}
          <div
            style={{
              minWidth: 200,
              borderRadius: "var(--radius)",
              border: "1px dashed var(--border)",
              padding: "40px 20px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
              cursor: "pointer",
              transition: "all 0.15s",
            }}
            onClick={() => setShowAddCol(true)}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "var(--accent)";
              e.currentTarget.style.color = "var(--accent)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--border)";
              e.currentTarget.style.color = "var(--text-dim)";
            }}
          >
            <Plus size={24} />
            <span style={{ fontSize: 13 }}>新建面板</span>
          </div>
        </div>
      </DndContext>

      {/* Add Column Modal */}
      {showAddCol && (
        <div
          style={{
            position: "fixed",
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            zIndex: 100,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={(e) => e.target === e.currentTarget && setShowAddCol(false)}
        >
          <div
            style={{
              background: "var(--panel)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              padding: 28,
              width: 360,
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            <div style={{ fontFamily: "var(--font-disp)", fontSize: 18, letterSpacing: 2, color: "var(--accent)" }}>
              新建面板
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, color: "var(--text-dim)", marginBottom: 6 }}>
                面板名称
              </label>
              <input
                className="input"
                autoFocus
                placeholder="例如：进行中、待审核..."
                value={newColName}
                onChange={(e) => setNewColName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addColumn()}
                style={{ width: "100%" }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, color: "var(--text-dim)", marginBottom: 6 }}>
                颜色
              </label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {["#00c8ff", "#c864ff", "#00c864", "#ff6b6b", "#ffd93d", "#6bcb77", "#ff9f43", "#a29bfe"].map(
                  (c) => (
                    <button
                      key={c}
                      onClick={() => setNewColColor(c)}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 6,
                        border: newColColor === c ? "2px solid white" : "none",
                        background: c,
                        cursor: "pointer",
                        boxShadow: newColColor === c ? `0 0 0 2px ${c}` : "none",
                      }}
                    />
                  )
                )}
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
              <button className="btn btn-ghost" onClick={() => setShowAddCol(false)}>
                取消
              </button>
              <button className="btn btn-primary" onClick={addColumn}>
                创建
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

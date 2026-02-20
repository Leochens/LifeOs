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
  useDroppable,
  useDraggable,
  type DragEndEvent,
  DragOverlay,
} from "@dnd-kit/core";
import { Plus, ChevronLeft, Calendar, Flag } from "lucide-react";

// Serialize tasks to markdown format
function tasksToMarkdown(tasks: Task[], existingContent: string): string {
  // Find the "## 任务" section in the existing content
  const lines = existingContent.split("\n");
  const taskLines: string[] = [];

  for (const task of tasks) {
    const check = task.done ? "x" : " ";
    let taskStr = `- [${check}] ${task.text}`;
    if (task.priority) taskStr += ` [${task.priority}]`;
    if (task.dueDate) taskStr += ` <${task.dueDate}>`;
    taskLines.push(taskStr);
  }

  // Find where to insert tasks (after ## 任务 or create section)
  let result: string[] = [];
  let foundTasks = false;
  for (const line of lines) {
    if (line.match(/^##\s+.*任务/)) {
      foundTasks = true;
      result.push(line);
      result.push("");
      result.push(...taskLines);
    } else if (!foundTasks && line.startsWith("## ")) {
      // Insert tasks section before other sections
      result.push("## 任务");
      result.push("");
      result.push(...taskLines);
      result.push("");
      foundTasks = true;
      result.push(line);
    } else {
      result.push(line);
    }
  }

  if (!foundTasks) {
    // No sections found, append tasks at the end
    result.push("");
    result.push("## 任务");
    result.push("");
    result.push(...taskLines);
  }

  return result.join("\n");
}

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

// Task type with priority and dueDate
interface Task {
  id: string;
  text: string;
  done: boolean;
  status: string;
  priority?: Priority;
  dueDate?: string;
}

// Count uncompleted todos from markdown content
function countPendingTodos(content: string): number {
  if (!content) return 0;
  const matches = content.match(/^-\s*\[\s\]/gm);
  return matches ? matches.length : 0;
}

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
      />
    );
  }

  // 否则显示项目列表
  return (
    <ProjectList
      projects={projects}
      columns={columns}
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
  columns,
  onSelectProject,
  onCreateProject,
}: {
  projects: Project[];
  columns: KanbanColumn[];
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
        {projects.map((project) => {
          const pendingTodos = countPendingTodos(project.content);
          return (
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
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span
                    style={{
                      fontSize: 10,
                      color: "var(--text-dim)",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    {columns.length} 面板
                  </span>
                  {pendingTodos > 0 && (
                    <span
                      style={{
                        fontSize: 10,
                        color: "var(--accent)",
                        fontFamily: "var(--font-mono)",
                      }}
                    >
                      {pendingTodos} 待办
                    </span>
                  )}
                </div>
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
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Droppable Column Wrapper
// ─────────────────────────────────────────────────────────────────────────────

function DroppableColumn({
  id,
  children,
  style,
}: {
  id: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        outline: isOver ? "2px solid var(--accent)" : "none",
        outlineOffset: -2,
        transition: "outline 0.15s",
      }}
    >
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Draggable Task Card
// ─────────────────────────────────────────────────────────────────────────────

function DraggableTaskCard({
  task,
  onToggle,
}: {
  task: Task;
  onToggle: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
  });

  const dragStyle: React.CSSProperties = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
    : {};

  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && !task.done;

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{
        background: "var(--panel2)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-sm)",
        padding: "10px 12px",
        cursor: isDragging ? "grabbing" : "grab",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        opacity: isDragging ? 0.5 : 1,
        ...dragStyle,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        <input
          type="checkbox"
          checked={task.done}
          onChange={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          onPointerDown={(e) => e.stopPropagation()}
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
      {(task.priority || task.dueDate) && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 24 }}>
          {task.priority && (
            <span
              style={{
                fontSize: 10,
                padding: "1px 6px",
                borderRadius: 8,
                background: `${PRIORITY_COLORS[task.priority]}18`,
                color: PRIORITY_COLORS[task.priority],
                fontWeight: 500,
                display: "flex",
                alignItems: "center",
                gap: 3,
              }}
            >
              <Flag size={9} />
              {PRIORITY_LABELS[task.priority]}
            </span>
          )}
          {task.dueDate && (
            <span
              style={{
                fontSize: 10,
                padding: "1px 6px",
                borderRadius: 8,
                background: isOverdue ? "rgba(255,80,80,0.15)" : "rgba(255,255,255,0.06)",
                color: isOverdue ? "#ff5050" : "var(--text-dim)",
                fontFamily: "var(--font-mono)",
                display: "flex",
                alignItems: "center",
                gap: 3,
              }}
            >
              <Calendar size={9} />
              {task.dueDate}
            </span>
          )}
        </div>
      )}
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
}) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [dragActiveId, setDragActiveId] = useState<string | null>(null);
  const vaultPath = useStore((s) => s.vaultPath);

  // Save tasks back to project file
  const saveTasks = async (newTasks: Task[]) => {
    if (!vaultPath || !project.path) return;
    const newContent = tasksToMarkdown(newTasks, project.content);
    const frontmatter = {
      title: project.title,
      status: project.status,
      priority: project.priority,
      created: project.created,
      updated: format(new Date(), "yyyy-MM-dd"),
      progress: String(project.progress),
      tags: project.tags.join(","),
      due: project.due || "",
    };
    try {
      await writeNote(project.path, frontmatter, newContent);
    } catch (e) {
      console.error("Failed to save tasks:", e);
    }
  };

  useEffect(() => {
    const lines = project.content.split("\n");
    const parsedTasks: Task[] = [];
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
          status: project.status,
        });
      }
      if (inTasks && line.startsWith("## ") && !line.includes("任务")) {
        break;
      }
    }
    setTasks(parsedTasks);
  }, [project]);

  const tasksByStatus = useMemo(() => {
    const map: Record<string, Task[]> = {};
    for (const col of columns) {
      map[col.id] = [];
    }
    for (const t of tasks) {
      if (map[t.status]) map[t.status].push(t);
    }
    return map;
  }, [tasks, columns]);

  const toggleTask = (taskId: string) => {
    setTasks((prev) => {
      const newTasks = prev.map((t) => (t.id === taskId ? { ...t, done: !t.done } : t));
      saveTasks(newTasks);
      return newTasks;
    });
  };

  const [newTaskCol, setNewTaskCol] = useState<string | null>(null);
  const [newTaskText, setNewTaskText] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState<Priority | "">("");
  const [newTaskDueDate, setNewTaskDueDate] = useState("");

  const addTask = (colId: string) => {
    if (!newTaskText.trim()) return;
    const newTask: Task = {
      id: `task-${Date.now()}`,
      text: newTaskText.trim(),
      done: false,
      status: colId,
      priority: newTaskPriority || undefined,
      dueDate: newTaskDueDate || undefined,
    };
    setTasks((prev) => {
      const newTasks = [...prev, newTask];
      saveTasks(newTasks);
      return newTasks;
    });
    setNewTaskCol(null);
    setNewTaskText("");
    setNewTaskPriority("");
    setNewTaskDueDate("");
  };

  const handleDragStart = (event: { active: { id: string | number } }) => {
    setDragActiveId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setDragActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    const overId = over.id as string;
    // over could be a column or another task
    const targetCol = columns.find((c) => c.id === overId);
    if (targetCol) {
      // Dropped on a column
      if (task.status !== targetCol.id) {
        setTasks((prev) => {
          const newTasks = prev.map((t) => (t.id === taskId ? { ...t, status: targetCol.id } : t));
          saveTasks(newTasks);
          return newTasks;
        });
      }
    } else {
      // Dropped on another task - find which column that task belongs to
      const overTask = tasks.find((t) => t.id === overId);
      if (overTask && task.status !== overTask.status) {
        setTasks((prev) => {
          const newTasks = prev.map((t) => (t.id === taskId ? { ...t, status: overTask.status } : t));
          saveTasks(newTasks);
          return newTasks;
        });
      }
    }
  };

  const draggedTask = dragActiveId ? tasks.find((t) => t.id === dragActiveId) : null;

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
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${columns.length},1fr)`, gap: 14, alignItems: "start" }}>
          {columns.map((col) => (
            <DroppableColumn
              key={col.id}
              id={col.id}
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
                  <DraggableTaskCard
                    key={task.id}
                    task={task}
                    onToggle={() => toggleTask(task.id)}
                  />
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
                          setNewTaskPriority("");
                          setNewTaskDueDate("");
                        }
                      }}
                    />
                    <div style={{ display: "flex", gap: 3 }}>
                      {(["low", "medium", "high", "urgent"] as Priority[]).map((p) => (
                        <button
                          key={p}
                          onClick={() => setNewTaskPriority(newTaskPriority === p ? "" : p)}
                          style={{
                            flex: 1,
                            padding: "4px 0",
                            fontSize: 10,
                            cursor: "pointer",
                            borderRadius: "var(--radius-sm)",
                            background: newTaskPriority === p ? `${PRIORITY_COLORS[p]}22` : "transparent",
                            color: newTaskPriority === p ? PRIORITY_COLORS[p] : "var(--text-dim)",
                            border: `1px solid ${newTaskPriority === p ? `${PRIORITY_COLORS[p]}55` : "var(--border)"}`,
                          }}
                        >
                          {PRIORITY_LABELS[p]}
                        </button>
                      ))}
                    </div>
                    <input
                      type="date"
                      className="input"
                      value={newTaskDueDate}
                      onChange={(e) => setNewTaskDueDate(e.target.value)}
                      style={{ fontSize: 11, padding: "4px 8px" }}
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
                          setNewTaskPriority("");
                          setNewTaskDueDate("");
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
            </DroppableColumn>
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

        <DragOverlay>
          {draggedTask ? (
            <div
              style={{
                background: "var(--panel2)",
                border: "1px solid var(--accent)",
                borderRadius: "var(--radius-sm)",
                padding: "10px 12px",
                cursor: "grabbing",
                boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                <input
                  type="checkbox"
                  checked={draggedTask.done}
                  readOnly
                  style={{ marginTop: 3, accentColor: "var(--accent)" }}
                />
                <span
                  style={{
                    fontSize: 13,
                    flex: 1,
                    textDecoration: draggedTask.done ? "line-through" : "none",
                    color: draggedTask.done ? "var(--text-dim)" : "var(--text)",
                  }}
                >
                  {draggedTask.text}
                </span>
              </div>
              {(draggedTask.priority || draggedTask.dueDate) && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 24 }}>
                  {draggedTask.priority && (
                    <span
                      style={{
                        fontSize: 10,
                        padding: "1px 6px",
                        borderRadius: 8,
                        background: `${PRIORITY_COLORS[draggedTask.priority]}18`,
                        color: PRIORITY_COLORS[draggedTask.priority],
                        fontWeight: 500,
                        display: "flex",
                        alignItems: "center",
                        gap: 3,
                      }}
                    >
                      <Flag size={9} />
                      {PRIORITY_LABELS[draggedTask.priority]}
                    </span>
                  )}
                  {draggedTask.dueDate && (
                    <span
                      style={{
                        fontSize: 10,
                        padding: "1px 6px",
                        borderRadius: 8,
                        background: "rgba(255,255,255,0.06)",
                        color: "var(--text-dim)",
                        fontFamily: "var(--font-mono)",
                        display: "flex",
                        alignItems: "center",
                        gap: 3,
                      }}
                    >
                      <Calendar size={9} />
                      {draggedTask.dueDate}
                    </span>
                  )}
                </div>
              )}
            </div>
          ) : null}
        </DragOverlay>
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

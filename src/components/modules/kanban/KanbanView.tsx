import { useState, useMemo, useEffect } from "react";
import { useStore } from "@/stores/app";
import { writeNote, loadBoardConfig, saveBoardConfig } from "@/services/fs";
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
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div className="font-[var(--font-disp)] text-[28px] tracking-[3px] text-accent">
          项目
        </div>
        <span className="text-[12px] text-text-dim font-[var(--font-mono)]">
          {projects.length} 个项目
        </span>
      </div>

      {/* Add new project */}
      {showAdd ? (
        <div className="panel p-4 bg-[var(--panel2)]">
          <input
            className="input w-full mb-3"
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
          />
          <div className="flex gap-1 mb-3">
            {(["low", "medium", "high", "urgent"] as Priority[]).map((p) => (
              <button
                key={p}
                onClick={() => setNewPriority(p)}
                className="flex-1 py-[6px] text-[12px] cursor-pointer rounded-[var(--radius-sm)]"
                style={{
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
            className="input w-full mb-3 text-[12px]"
            placeholder="标签 (逗号分隔)..."
            value={newTags}
            onChange={(e) => setNewTags(e.target.value)}
          />
          <div className="flex gap-2">
            <button
              className="btn btn-primary flex-1 justify-center"
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
          className="flex items-center gap-2 py-3 px-4 bg-transparent border border-dashed border-border rounded-[var(--radius)] text-text-dim cursor-pointer text-[13px] transition-all hover:border-accent hover:text-accent"
        >
          <Plus size={16} />
          新建项目
        </button>
      )}

      {/* Project cards grid */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3">
        {projects.map((project) => {
          const pendingTodos = countPendingTodos(project.content);
          return (
            <div
              key={project.path}
              onClick={() => onSelectProject(project)}
              className="bg-[var(--panel2)] border border-border rounded-[var(--radius)] p-4 cursor-pointer transition-all hover:border-accent hover:-translate-y-0.5"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="text-[15px] font-semibold flex-1 leading-[1.4]">{project.title}</div>
                <span
                  className="text-[10px] py-[2px] px-2 rounded-[10px] font-medium whitespace-nowrap ml-2"
                  style={{
                    background: `${statusColors[project.status]}18`,
                    color: statusColors[project.status],
                  }}
                >
                  {statusLabels[project.status]}
                </span>
              </div>

              <div className="flex items-center gap-2 mb-2">
                {project.tags.slice(0, 3).map((tag) => (
                  <span key={tag} className="tag text-[10px]">
                    {tag}
                  </span>
                ))}
                {project.due && (
                  <span className="text-[10px] text-text-dim font-[var(--font-mono)]">
                    {project.due}
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-[10px]">
                  <span
                    className="text-[10px] text-text-dim font-[var(--font-mono)]"
                  >
                    {columns.length} 面板
                  </span>
                  {pendingTodos > 0 && (
                    <span
                      className="text-[10px] text-accent font-[var(--font-mono)]"
                    >
                      {pendingTodos} 待办
                    </span>
                  )}
                </div>
                {project.progress > 0 && (
                  <div className="flex items-center gap-1.5">
                    <div className="progress-track w-[60px] h-[3px]">
                      <div className="progress-fill" style={{ width: `${project.progress}%` }} />
                    </div>
                    <span className="text-[10px] text-text-dim font-[var(--font-mono)]">
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
  className,
}: {
  id: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={className}
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
      className="bg-[var(--panel2)] border border-border rounded-[var(--radius-sm)] py-[10px] px-3 flex flex-col gap-1.5"
      style={{
        cursor: isDragging ? "grabbing" : "grab",
        opacity: isDragging ? 0.5 : 1,
        ...dragStyle,
      }}
    >
      <div className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={task.done}
          onChange={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className="mt-[3px]"
          style={{ accentColor: "var(--accent)" }}
        />
        <span
          className="text-[13px] flex-1"
          style={{
            textDecoration: task.done ? "line-through" : "none",
            color: task.done ? "var(--text-dim)" : "var(--text)",
          }}
        >
          {task.text}
        </span>
      </div>
      {(task.priority || task.dueDate) && (
        <div className="flex items-center gap-1.5 ml-6">
          {task.priority && (
            <span
              className="text-[10px] py-[1px] px-1.5 rounded-[8px] font-medium flex items-center gap-[3px]"
              style={{
                background: `${PRIORITY_COLORS[task.priority]}18`,
                color: PRIORITY_COLORS[task.priority],
              }}
            >
              <Flag size={9} />
              {PRIORITY_LABELS[task.priority]}
            </span>
          )}
          {task.dueDate && (
            <span
              className="text-[10px] py-[1px] px-1.5 rounded-[8px] flex items-center gap-[3px] font-[var(--font-mono)]"
              style={{
                background: isOverdue ? "rgba(255,80,80,0.15)" : "rgba(255,255,255,0.06)",
                color: isOverdue ? "#ff5050" : "var(--text-dim)",
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
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="flex items-center justify-center w-8 h-8 rounded-[var(--radius-sm)] border border-border bg-[var(--panel)] text-text-dim cursor-pointer"
        >
          <ChevronLeft size={18} />
        </button>
        <div className="flex-1">
          <div className="font-[var(--font-disp)] text-[24px] tracking-[2px] text-accent">
            {project.title}
          </div>
          <div className="text-[12px] text-text-dim mt-1">
            {project.content.slice(0, 100)}...
          </div>
        </div>
        <span className="text-[12px] text-text-dim font-[var(--font-mono)]">
          {tasks.length} 个任务 · {columns.length} 个面板
        </span>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid gap-[14px] items-start" style={{ gridTemplateColumns: `repeat(${columns.length},1fr)` }}>
          {columns.map((col) => (
            <DroppableColumn
              key={col.id}
              id={col.id}
              className="rounded-[var(--radius)] overflow-hidden border border-border"
            >
              <div className="h-[3px]" style={{ background: `linear-gradient(90deg, ${col.color}, transparent)` }} />
              <div
                className="py-3 px-[14px] bg-[var(--panel)] border-b border-border flex items-center"
              >
                <span className="text-[13px] font-semibold flex-1 tracking-[1px]">{col.name}</span>
                <span
                  className="text-[11px] py-[2px] px-2.5 rounded-[20px] font-medium font-[var(--font-mono)]"
                  style={{
                    background: `${col.color}18`,
                    color: col.color,
                  }}
                >
                  {(tasksByStatus[col.id] || []).length}
                </span>
              </div>

              <div
                className="p-[10px] bg-[var(--panel)] flex flex-col gap-2 min-h-[100px]"
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
                    className="flex flex-col gap-2 p-3 bg-[var(--panel2)] border border-border rounded-[var(--radius-sm)]"
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
                    <div className="flex gap-[3px]">
                      {(["low", "medium", "high", "urgent"] as Priority[]).map((p) => (
                        <button
                          key={p}
                          onClick={() => setNewTaskPriority(newTaskPriority === p ? "" : p)}
                          className="flex-1 py-1 text-[10px] cursor-pointer rounded-[var(--radius-sm)]"
                          style={{
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
                      className="input text-[11px] py-1 px-2"
                      value={newTaskDueDate}
                      onChange={(e) => setNewTaskDueDate(e.target.value)}
                    />
                    <div className="flex gap-1.5">
                      <button
                        className="btn btn-primary flex-1 justify-center text-[12px] py-1.5"
                        onClick={() => addTask(col.id)}
                      >
                        添加
                      </button>
                      <button
                        className="btn btn-ghost text-[12px] py-1.5 px-2.5"
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
                    className="w-full py-2 bg-transparent border border-dashed border-border text-text-dim text-[12px] rounded-[var(--radius-sm)] cursor-pointer transition-all"
                  >
                    + 添加任务
                  </button>
                )}
              </div>
            </DroppableColumn>
          ))}

          {/* Add column button */}
          <div
            className="min-w-[200px] rounded-[var(--radius)] border border-dashed border-border py-10 px-5 flex flex-col items-center gap-2 cursor-pointer transition-all"
            onClick={() => setShowAddCol(true)}
          >
            <Plus size={24} />
            <span className="text-[13px]">新建面板</span>
          </div>
        </div>

        <DragOverlay>
          {draggedTask ? (
            <div
              className="bg-[var(--panel2)] border border-accent rounded-[var(--radius-sm)] py-[10px] px-3 cursor-grabbing shadow-[0_4px_16px_rgba(0,0,0,0.3)] flex flex-col gap-1.5"
            >
              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={draggedTask.done}
                  readOnly
                  className="mt-[3px]"
                  style={{ accentColor: "var(--accent)" }}
                />
                <span
                  className="text-[13px] flex-1"
                  style={{
                    textDecoration: draggedTask.done ? "line-through" : "none",
                    color: draggedTask.done ? "var(--text-dim)" : "var(--text)",
                  }}
                >
                  {draggedTask.text}
                </span>
              </div>
              {(draggedTask.priority || draggedTask.dueDate) && (
                <div className="flex items-center gap-1.5 ml-6">
                  {draggedTask.priority && (
                    <span
                      className="text-[10px] py-[1px] px-1.5 rounded-[8px] font-medium flex items-center gap-[3px]"
                      style={{
                        background: `${PRIORITY_COLORS[draggedTask.priority]}18`,
                        color: PRIORITY_COLORS[draggedTask.priority],
                      }}
                    >
                      <Flag size={9} />
                      {PRIORITY_LABELS[draggedTask.priority]}
                    </span>
                  )}
                  {draggedTask.dueDate && (
                    <span
                      className="text-[10px] py-[1px] px-1.5 rounded-[8px] flex items-center gap-[3px] font-[var(--font-mono)]"
                      style={{
                        background: "rgba(255,255,255,0.06)",
                        color: "var(--text-dim)",
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
          className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center"
          onClick={(e) => e.target === e.currentTarget && setShowAddCol(false)}
        >
          <div
            className="bg-[var(--panel)] border border-border rounded-[var(--radius)] p-7 w-[360px] flex flex-col gap-4"
          >
            <div className="font-[var(--font-disp)] text-[18px] tracking-[2px] text-accent">
              新建面板
            </div>
            <div>
              <label className="block text-[12px] text-text-dim mb-1.5">
                面板名称
              </label>
              <input
                className="input w-full"
                autoFocus
                placeholder="例如：进行中、待审核..."
                value={newColName}
                onChange={(e) => setNewColName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addColumn()}
              />
            </div>
            <div>
              <label className="block text-[12px] text-text-dim mb-1.5">
                颜色
              </label>
              <div className="flex gap-2 flex-wrap">
                {["#00c8ff", "#c864ff", "#00c864", "#ff6b6b", "#ffd93d", "#6bcb77", "#ff9f43", "#a29bfe"].map(
                  (c) => (
                    <button
                      key={c}
                      onClick={() => setNewColColor(c)}
                      className="w-7 h-7 rounded-[6px]"
                      style={{
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
            <div className="flex justify-end gap-2.5 mt-2">
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

import { useState, useMemo, useEffect } from "react";
import { useStore } from "@/stores/app";
import { writeNote, deleteFile } from "@/services/fs";
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
import { Plus, ChevronLeft, Calendar, Flag, Trash2 } from "lucide-react";

// Serialize tasks to markdown format dynamically based on columns
function tasksToMarkdown(tasks: Task[], columns: KanbanColumn[], existingContent: string): string {
  const lines = existingContent.split("\n");
  const result: string[] = [];

  // 1. 保留原本不是看板列（## 标题）上方及其内部非任务的内容
  // 识别原本存在哪些看板标题
  const existingHeaders = new Set<string>();
  let currentHeader = "";

  for (const line of lines) {
    if (line.match(/^##\s+/)) {
      currentHeader = line.replace(/^##\s+/, "").trim();
      existingHeaders.add(currentHeader);
      // We will override these task items later
      continue;
    }
    // 如果还没进入过任务板标题，或者是正常的文字内容（非任务勾选），我们予以外部保留
    if (!line.trim().startsWith("- [") && !line.trim().startsWith("- [x]")) {
      // It's not a task check line, if it's right after a header, we might skip it if we reconstruct entirely,
      // but to be safe and preserve non-task content under boards:
      if (currentHeader) {
        // optionally keep non-task text under headers (like notes)
        // for simplicity in kanban rebuilding, we often just keep frontmatter and notes before/after
      }
    }
  }

  // 让我们用一个更安全的完整重组方案
  // A. 提取除开任务面板的所有内容（前言，或不匹配任何栏目的其他段落）

  let topContent: string[] = [];
  let isInsideKanban = false;

  for (const line of lines) {
    const headerMatch = line.match(/^\s*##\s+(.+)$/);
    if (headerMatch) {
      const headerTitle = headerMatch[1].trim();
      // 如果这个 header 是我们的看板列之一，说明进入了动态看板区域
      if (columns.some(c => c.name === headerTitle)) {
        isInsideKanban = true;
      } else {
        // 如果它不是看板列名字（比如 "笔记" 或者是以前的遗留），我们也许把它留在原位
        isInsideKanban = false;
        topContent.push(line);
      }
      continue;
    }

    if (isInsideKanban) {
      // 属于被我们重构的任务行或者空行，跳过（等下重新生成）
      if (line.trim() === "" || line.trim().match(/^[-*]\s*\[[xX\s]\]/)) {
        continue;
      } else {
        // 如果列下有人工写的其他文字注释，暂时作为顶层内容附加
        topContent.push(line);
      }
    } else {
      topContent.push(line);
    }
  }

  result.push(...topContent);
  if (result[result.length - 1] !== "") result.push("");

  // B. 重新生成看板区域
  for (const col of columns) {
    result.push(`## ${col.name}`);

    const colTasks = tasks.filter(t => t.status === col.id);
    for (const task of colTasks) {
      const check = task.done ? "x" : " ";
      let taskStr = `- [${check}] ${task.text}`;
      if (task.priority) taskStr += ` [${task.priority}]`;
      if (task.dueDate) taskStr += ` <${task.dueDate}>`;
      result.push(taskStr);
    }
    result.push(""); // empty line after each column
  }

  return result.join("\n").trim() + "\n";
}

// (Deprecated global columns definition: panels are now dynamic per project markdown headers)
// const DEFAULT_COLUMNS: KanbanColumn[] = [ ... ];

const PRIORITY_COLORS: Record<Priority, string> = {
  urgent: "var(--accent4)", high: "var(--accent4)", medium: "var(--accent5)", low: "var(--text-dim)",
};
const PRIORITY_LABELS: Record<Priority, string> = {
  urgent: "紧急", high: "高", medium: "中", low: "低",
};

// Task type with priority and dueDate
export interface Task {
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

export default function KanbanView() {
  const projects = useStore((s) => s.projects);
  const upsertProject = useStore((s) => s.upsertProject);
  const vaultPath = useStore((s) => s.vaultPath);
  const defaultProject = useStore((s) => s.defaultProject);
  const setDefaultProject = useStore((s) => s.setDefaultProject);

  // 项目列表 vs 看板视图
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [initialized, setInitialized] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // 自动打开默认项目
  useEffect(() => {
    if (initialized || projects.length === 0) return;
    if (defaultProject) {
      const defaultProj = projects.find((p) => p.path === defaultProject);
      if (defaultProj) {
        setSelectedProject(defaultProj);
      }
    }
    setInitialized(true);
  }, [defaultProject, projects, initialized]);

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
        onBack={goBackToList}
        sensors={sensors}
      />
    );
  }

  // 否则显示项目列表
  return (
    <ProjectList
      projects={projects}
      onSelectProject={openProjectBoard}
      onCreateProject={async (title, priority, tags, desc) => {
        if (!title.trim() || !vaultPath) return;
        const slug = title.trim().replace(/\s+/g, "-").replace(/[^\p{L}\p{N}_-]/gu, "").slice(0, 40) || `proj-${Date.now()}`;
        const path = `${vaultPath}/projects/${slug}.md`;
        const today = format(new Date(), "yyyy-MM-dd");
        const fm = { title: title.trim(), status: "backlog", priority, created: today, updated: today, progress: "0", tags };
        const content = desc?.trim()
          ? `${desc.trim()}\n\n## 待规划\n\n- [ ] 示例新任务\n\n## 进行中\n\n## 已完成\n\n`
          : `## 待规划\n\n- [ ] 示例新任务\n\n## 进行中\n\n## 已完成\n\n`;
        await writeNote(path, fm, content);
        upsertProject({
          path, title: title.trim(), status: "backlog", priority,
          created: today, updated: today, progress: 0,
          tags: tags ? tags.split(",").map(t => t.trim()).filter(Boolean) : [],
          content: content,
        });
      }}
      onDeleteProject={async (path) => {
        try {
          await deleteFile(path);
          useStore.getState().setProjects(projects.filter((p) => p.path !== path));
        } catch (e) {
          console.error("Failed to delete project:", e);
        }
      }}
      defaultProject={defaultProject}
      onSetDefault={(path) => setDefaultProject(path)}
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
  onDeleteProject,
  defaultProject,
  onSetDefault,
}: {
  projects: Project[];
  onSelectProject: (p: Project) => void;
  onCreateProject: (title: string, priority: Priority, tags: string, desc?: string) => void;
  onDeleteProject: (path: string) => void;
  defaultProject: string | null;
  onSetDefault: (path: string | null) => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState<Priority>("medium");
  const [newTags, setNewTags] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // 编辑项目状态
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editPriority, setEditPriority] = useState<Priority>("medium");
  const [editTags, setEditTags] = useState("");
  const [editStatus, setEditStatus] = useState<"backlog" | "todo" | "active" | "paused" | "done">("backlog");
  const [editDesc, setEditDesc] = useState("");

  // 提取项目描述（非任务部分的内容）
  const getProjectDescription = (content: string): string => {
    const lines = content.split("\n");
    const descLines = lines.filter(
      (l) => l.trim() !== "" && !l.match(/^\s*##/) && !l.match(/^\s*[-*]\s*\[/)
    );
    return descLines.join("\n");
  };

  const startEdit = (project: Project) => {
    setEditingProject(project);
    setEditTitle(project.title);
    setEditPriority(project.priority || "medium");
    setEditTags(project.tags.join(", "));
    setEditStatus(project.status);
    setEditDesc(getProjectDescription(project.content));
  };

  const saveEdit = async () => {
    if (!editingProject || !editTitle.trim()) return;

    // 从原始内容中提取任务部分
    const lines = editingProject.content.split("\n");
    const taskLines: string[] = [];
    let inTaskSection = false;
    for (const line of lines) {
      if (line.match(/^\s*##/)) {
        inTaskSection = true;
      }
      if (inTaskSection) {
        taskLines.push(line);
      }
    }
    // 组合新描述和任务内容
    const newContent = (editDesc ? editDesc.trim() + "\n\n" : "") + taskLines.join("\n");

    const updatedProject: Project = {
      ...editingProject,
      title: editTitle.trim(),
      priority: editPriority,
      status: editStatus,
      tags: editTags.split(",").map((t) => t.trim()).filter(Boolean),
      updated: new Date().toISOString().split("T")[0],
      content: newContent,
    };
    // 保存到文件
    const frontmatter = {
      title: updatedProject.title,
      status: updatedProject.status,
      priority: updatedProject.priority,
      created: updatedProject.created,
      updated: updatedProject.updated,
      progress: String(updatedProject.progress),
      tags: updatedProject.tags.join(","),
      due: updatedProject.due || "",
    };
    try {
      await writeNote(updatedProject.path, frontmatter, newContent);
    } catch (e) {
      console.error("Failed to save project:", e);
    }
    // 调用 upsertProject 更新
    useStore.getState().upsertProject(updatedProject);
    setEditingProject(null);
  };

  // 过滤项目
  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return projects;
    const query = searchQuery.toLowerCase();
    return projects.filter(
      (p) =>
        p.title.toLowerCase().includes(query) ||
        p.tags.some((t) => t.toLowerCase().includes(query))
    );
  }, [projects, searchQuery]);

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
          {filteredProjects.length} 个项目 {searchQuery ? `/ ${projects.length}` : ""}
        </span>
      </div>

      {/* Search */}
      <div className="relative">
        <input
          className="input w-full pl-9"
          placeholder="搜索项目名称或标签..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-dim"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-dim hover:text-text"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
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
          <textarea
            className="input w-full mb-3 text-[12px] h-20 resize-none"
            placeholder="项目描述 (可选)..."
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
          />
          <div className="flex gap-2">
            <button
              className="btn btn-primary flex-1 justify-center"
              onClick={() => {
                if (newTitle.trim()) {
                  onCreateProject(newTitle, newPriority, newTags, newDesc);
                  setShowAdd(false);
                  setNewTitle("");
                  setNewPriority("medium");
                  setNewTags("");
                  setNewDesc("");
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
        {filteredProjects.map((project) => {
          const pendingTodos = countPendingTodos(project.content);
          const isDefault = defaultProject === project.path;
          return (
            <div
              key={project.path}
              onClick={() => onSelectProject(project)}
              className="bg-[var(--panel2)] border border-border rounded-[var(--radius)] p-4 cursor-pointer transition-all hover:border-accent hover:-translate-y-0.5"
              style={isDefault ? { borderColor: "var(--accent)" } : undefined}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="text-[15px] font-semibold flex-1 leading-[1.4]">{project.title}</div>
                <div className="flex items-center gap-2 ml-2">
                  {isDefault && (
                    <span className="text-[10px] py-[2px] px-2 rounded-[10px] font-medium whitespace-nowrap bg-accent/20 text-accent">
                      默认
                    </span>
                  )}
                  <span
                    className="text-[10px] py-[2px] px-2 rounded-[10px] font-medium whitespace-nowrap"
                    style={{
                      background: `${statusColors[project.status]}18`,
                      color: statusColors[project.status],
                    }}
                  >
                    {statusLabels[project.status]}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isDefault) {
                        onSetDefault(null);
                      } else {
                        onSetDefault(project.path);
                      }
                    }}
                    className={`p-1 rounded hover:bg-[var(--bg)] transition-colors ${
                      isDefault ? "text-accent" : "text-text-dim hover:text-accent"
                    }`}
                    title={isDefault ? "取消默认" : "设为默认"}
                  >
                    <svg className="w-[13px] h-[13px]" fill={isDefault ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      startEdit(project);
                    }}
                    className="p-1 text-text-dim hover:text-accent rounded hover:bg-[var(--bg)] transition-colors"
                    title="编辑项目"
                  >
                    <svg className="w-[13px] h-[13px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm(`确定要永久删除项目 "${project.title}" 吗？此操作无法撤销。`)) {
                        onDeleteProject(project.path);
                      }
                    }}
                    className="p-1 text-text-dim hover:text-red-500 rounded hover:bg-[var(--bg)] transition-colors"
                    title="删除项目"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
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

      {/* 编辑项目弹窗 */}
      {editingProject && (
        <div
          className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center"
          onClick={(e) => e.target === e.currentTarget && setEditingProject(null)}
        >
          <div className="bg-[var(--panel)] border border-border rounded-[var(--radius)] p-7 w-[400px] flex flex-col gap-4">
            <div className="font-[var(--font-disp)] text-[18px] tracking-[2px] text-accent">
              编辑项目
            </div>
            <div>
              <label className="block text-[12px] text-text-dim mb-1.5">项目名称</label>
              <input
                className="input w-full"
                autoFocus
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[12px] text-text-dim mb-1.5">状态</label>
              <div className="flex gap-1">
                {(["backlog", "todo", "active", "paused", "done"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setEditStatus(s)}
                    className="flex-1 py-1.5 text-[11px] cursor-pointer rounded-[var(--radius-sm)]"
                    style={{
                      background: editStatus === s ? `${statusColors[s]}22` : "transparent",
                      color: editStatus === s ? statusColors[s] : "var(--text-dim)",
                      border: `1px solid ${editStatus === s ? `${statusColors[s]}55` : "var(--border)"}`,
                    }}
                  >
                    {statusLabels[s]}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-[12px] text-text-dim mb-1.5">优先级</label>
              <div className="flex gap-1">
                {(["low", "medium", "high", "urgent"] as Priority[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setEditPriority(p)}
                    className="flex-1 py-1.5 text-[11px] cursor-pointer rounded-[var(--radius-sm)]"
                    style={{
                      background: editPriority === p ? `${PRIORITY_COLORS[p]}22` : "transparent",
                      color: editPriority === p ? PRIORITY_COLORS[p] : "var(--text-dim)",
                      border: `1px solid ${editPriority === p ? `${PRIORITY_COLORS[p]}55` : "var(--border)"}`,
                    }}
                  >
                    {PRIORITY_LABELS[p]}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-[12px] text-text-dim mb-1.5">标签</label>
              <input
                className="input w-full text-[12px]"
                placeholder="标签 (逗号分隔)..."
                value={editTags}
                onChange={(e) => setEditTags(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[12px] text-text-dim mb-1.5">项目描述</label>
              <textarea
                className="input w-full h-24 text-[12px] resize-none"
                placeholder="项目描述..."
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2.5 mt-2">
              <button className="btn btn-ghost" onClick={() => setEditingProject(null)}>
                取消
              </button>
              <button className="btn btn-primary" onClick={saveEdit}>
                保存
              </button>
            </div>
          </div>
        </div>
      )}
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
  onUpdate,
}: {
  task: Task;
  onToggle: () => void;
  onUpdate: (taskId: string, text: string, priority: Priority | undefined, dueDate: string | undefined) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState(task.text);
  const [priority, setPriority] = useState<Priority | "">(task.priority || "");
  const [dueDate, setDueDate] = useState(task.dueDate || "");

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    disabled: isEditing,
  });

  const dragStyle: React.CSSProperties = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
    : {};

  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && !task.done;

  if (isEditing) {
    return (
      <div className="flex flex-col gap-2 p-3 bg-[var(--panel2)] border border-border rounded-[var(--radius-sm)] z-10 cursor-default">
        <input
          className="input text-[13px]"
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              onUpdate(task.id, text, (priority as Priority) || undefined, dueDate || undefined);
              setIsEditing(false);
            }
            if (e.key === "Escape") {
              setIsEditing(false);
              setText(task.text);
              setPriority(task.priority || "");
              setDueDate(task.dueDate || "");
            }
          }}
        />
        <div className="flex gap-[3px]">
          {(["low", "medium", "high", "urgent"] as Priority[]).map((p) => (
            <button
              key={p}
              onClick={() => setPriority(priority === p ? "" : p)}
              className="flex-1 py-1 text-[10px] cursor-pointer rounded-[var(--radius-sm)]"
              style={{
                background: priority === p ? `${PRIORITY_COLORS[p]}22` : "transparent",
                color: priority === p ? PRIORITY_COLORS[p] : "var(--text-dim)",
                border: `1px solid ${priority === p ? `${PRIORITY_COLORS[p]}55` : "var(--border)"}`,
              }}
            >
              {PRIORITY_LABELS[p]}
            </button>
          ))}
        </div>
        <input
          type="date"
          className="input text-[11px] py-1 px-2"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />
        <div className="flex gap-1.5">
          <button
            className="btn btn-primary flex-1 justify-center text-[12px] py-1.5"
            onClick={() => {
              onUpdate(task.id, text, (priority as Priority) || undefined, dueDate || undefined);
              setIsEditing(false);
            }}
          >
            保存
          </button>
          <button
            className="btn btn-ghost text-[12px] py-1.5 px-2.5"
            onClick={() => {
              setIsEditing(false);
              setText(task.text);
              setPriority(task.priority || "");
              setDueDate(task.dueDate || "");
            }}
          >
            取消
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onDoubleClick={(e) => {
        e.stopPropagation();
        setIsEditing(true);
      }}
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
  onBack,
  sensors,
}: {
  project: Project;
  onBack: () => void;
  sensors: ReturnType<typeof useSensors>;
}) {
  const [columns, setColumns] = useState<KanbanColumn[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [dragActiveId, setDragActiveId] = useState<string | null>(null);

  // 项目描述编辑
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [editDesc, setEditDesc] = useState("");

  // 提取项目描述（非任务部分的内容）
  const getProjectDescription = (content: string): string => {
    const lines = content.split("\n");
    const descLines = lines.filter(
      (l) => l.trim() !== "" && !l.match(/^\s*##/) && !l.match(/^\s*[-*]\s*\[/)
    );
    return descLines.join("\n");
  };

  const startEditDesc = () => {
    setEditDesc(getProjectDescription(project.content));
    setIsEditingDesc(true);
  };

  const saveDescription = () => {
    // 保存描述：只传递新描述文本，让 saveTasks 从原始内容中提取任务部分
    saveTasks(tasks, columns, editDesc);
    setIsEditingDesc(false);
  };

  // Add column modal
  const [showAddCol, setShowAddCol] = useState(false);
  const [newColName, setNewColName] = useState("");
  const [newColColor, setNewColColor] = useState("#00c8ff");

  // Edit column modal
  const [editingColumn, setEditingColumn] = useState<KanbanColumn | null>(null);
  const [editColName, setEditColName] = useState("");
  const [editColColor, setEditColColor] = useState("#00c8ff");

  const startEditColumn = (col: KanbanColumn) => {
    setEditingColumn(col);
    setEditColName(col.name);
    setEditColColor(col.color);
  };

  const saveColumn = () => {
    if (!editingColumn || !editColName.trim()) return;
    const newCols = columns.map((c) =>
      c.id === editingColumn.id
        ? { ...c, name: editColName.trim(), color: editColColor }
        : c
    );
    setColumns(newCols);
    saveTasks(tasks, newCols);
    setEditingColumn(null);
  };

  const addColumn = () => {
    if (!newColName.trim()) return;
    const id = newColName.trim().toLowerCase().replace(/\\s+/g, "-").replace(/[^\\p{L}\\p{N}_-]/gu, "").slice(0, 20);
    const newCol: KanbanColumn = { id: id || `col-${Date.now()}`, name: newColName.trim(), color: newColColor };

    // Optimistic UI update
    const newCols = [...columns, newCol];
    setColumns(newCols);

    // Save to markdown via saveTasks, passing current tasks and new columns
    saveTasks(tasks, newCols);

    setShowAddCol(false);
    setNewColName("");
    setNewColColor("#00c8ff");
  };
  const vaultPath = useStore((s) => s.vaultPath);

  const upsertProject = useStore((s) => s.upsertProject);

  // Save tasks back to project file AND local store
  const saveTasks = async (newTasks: Task[], newCols: KanbanColumn[] = columns, newDescription?: string) => {
    if (!vaultPath || !project.path) return;
    // 如果提供了新描述，提取旧的任务内容并组合
    let newContent: string;
    if (newDescription !== undefined) {
      // 从现有内容中提取任务部分（## 标题及其下的任务）
      const lines = project.content.split("\n");
      const taskLines: string[] = [];
      let inTaskSection = false;
      for (const line of lines) {
        if (line.match(/^\s*##/)) {
          inTaskSection = true;
        }
        if (inTaskSection) {
          taskLines.push(line);
        }
      }
      // 组合新描述和任务内容
      newContent = (newDescription ? newDescription.trim() + "\n\n" : "") + taskLines.join("\n");
    } else {
      newContent = tasksToMarkdown(newTasks, newCols, project.content);
    }
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
      // Immediately reflect content change in global store to avoid HMR / caching reset bugs
      upsertProject({ ...project, content: newContent });
    } catch (e) {
      console.error("Failed to save tasks:", e);
    }
  };

  useEffect(() => {
    const lines = project.content.split("\n");
    const parsedTasks: Task[] = [];
    let currentColumnId = "backlog"; // fallback

    // Map extracted columns from headers
    const dynamicColumns: KanbanColumn[] = [];
    const colorPalette = ["#888", "#00c8ff", "#c864ff", "#00c864", "#ff6b6b", "#ffd93d", "#6bcb77", "#ff9f43", "#a29bfe"];

    for (const line of lines) {
      const headerMatch = line.match(/^\s*##\s+(.+)$/);
      if (headerMatch) {
        const headerName = headerMatch[1].trim();
        // Skip some standard headers that should not be kanban boards
        if (headerName === "笔记" || headerName === "目标") continue;

        const id = headerName.toLowerCase().replace(/\s+/g, "-");
        currentColumnId = id;
        dynamicColumns.push({
          id,
          name: headerName,
          color: colorPalette[dynamicColumns.length % colorPalette.length]
        });
        continue;
      }

      const taskMatch = line.match(/^\s*[-*]\s*\[([xX\s])\]/);
      if (taskMatch) {
        const done = taskMatch[1] === "x" || taskMatch[1] === "X";
        let parsedText = line.replace(/^\s*[-*]\s*\[[xX\s]\]\s*/, "").trim();
        let status: string = currentColumnId;
        let priority: Priority | undefined;
        let dueDate: string | undefined;

        const dueMatch = parsedText.match(/\s+<([^>]+)>$/);
        if (dueMatch) {
          dueDate = dueMatch[1];
          parsedText = parsedText.slice(0, dueMatch.index);
        }

        const priomatch = parsedText.match(/\s+\[(urgent|high|medium|low)\]$/);
        if (priomatch) {
          priority = priomatch[1] as Priority;
          parsedText = parsedText.slice(0, priomatch.index);
        }

        parsedTasks.push({
          id: `task-${parsedTasks.length}`,
          text: parsedText.trim(),
          done,
          status,
          priority,
          dueDate,
        });
      }
    }

    if (dynamicColumns.length > 0) {
      setColumns(dynamicColumns);
    } else {
      setColumns([{ id: "backlog", name: "待规划", color: "#888" }]);
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

  const updateTask = (taskId: string, text: string, priority: Priority | undefined, dueDate: string | undefined) => {
    if (!text.trim()) return;
    setTasks((prev) => {
      const newTasks = prev.map((t) => (t.id === taskId ? { ...t, text: text.trim(), priority, dueDate } : t));
      saveTasks(newTasks);
      return newTasks;
    });
  };

  // Delete column and all its tasks
  const deleteColumn = (colId: string) => {
    // Filter out tasks belonging to this column
    const newTasks = tasks.filter((t) => t.status !== colId);
    // Filter out the column
    const newCols = columns.filter((c) => c.id !== colId);

    setTasks(newTasks);
    setColumns(newCols);
    saveTasks(newTasks, newCols);
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
    let targetColId = overId;

    // Check if overId is a column or a task
    const isColumn = columns.some((c) => c.id === overId);
    if (!isColumn) {
      const overTask = tasks.find((t) => t.id === overId);
      if (overTask) {
        targetColId = overTask.status;
      }
    }

    if (task.status !== targetColId) {
      setTasks((prev) => {
        const newTasks = prev.map((t) => (t.id === taskId ? { ...t, status: targetColId } : t));
        saveTasks(newTasks);
        return newTasks;
      });
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
          {isEditingDesc ? (
            <div className="flex flex-col gap-2 mt-2">
              <textarea
                className="input w-full h-24 text-[12px] resize-none"
                autoFocus
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                placeholder="输入项目描述..."
              />
              <div className="flex gap-2">
                <button className="btn btn-primary text-[12px] py-1.5" onClick={saveDescription}>
                  保存
                </button>
                <button className="btn btn-ghost text-[12px] py-1.5" onClick={() => setIsEditingDesc(false)}>
                  取消
                </button>
              </div>
            </div>
          ) : (
            <div className="group relative">
              <div className="text-[12px] text-text-dim mt-1 whitespace-pre-wrap">
                {(() => {
                  const previewLines = project.content.split("\n");
                  const previewText = previewLines.filter(l => l.trim() !== "" && !l.match(/^\s*##/) && !l.match(/^\s*[-*]\s*\[/)).slice(0, 3).join("\n");
                  return previewText ? previewText : "暂无项目描述...";
                })()}
              </div>
              <button
                onClick={startEditDesc}
                className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 p-1 text-text-dim hover:text-accent transition-opacity"
                title="编辑描述"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
            </div>
          )}
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
                <button
                  onClick={() => startEditColumn(col)}
                  className="ml-2 p-1 text-text-dim hover:text-accent rounded hover:bg-[var(--bg)] transition-colors"
                  title="编辑面板"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button
                  onClick={() => {
                    const taskCount = (tasksByStatus[col.id] || []).length;
                    const msg = taskCount > 0
                      ? `确定要删除面板 "${col.name}" 吗？该面板下有 ${taskCount} 个任务将被一并删除，此操作无法撤销。`
                      : `确定要删除面板 "${col.name}" 吗？此操作无法撤销。`;
                    if (window.confirm(msg)) {
                      deleteColumn(col.id);
                    }
                  }}
                  className="ml-2 p-1 text-text-dim hover:text-red-500 rounded hover:bg-[var(--bg)] transition-colors"
                  title="删除面板"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              <div
                className="p-[10px] bg-[var(--panel)] flex flex-col gap-2 min-h-[100px]"
              >
                {(tasksByStatus[col.id] || []).map((task) => (
                  <DraggableTaskCard
                    key={task.id}
                    task={task}
                    onToggle={() => toggleTask(task.id)}
                    onUpdate={updateTask}
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

      {/* Edit Column Modal */}
      {editingColumn && (
        <div
          className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center"
          onClick={(e) => e.target === e.currentTarget && setEditingColumn(null)}
        >
          <div
            className="bg-[var(--panel)] border border-border rounded-[var(--radius)] p-7 w-[360px] flex flex-col gap-4"
          >
            <div className="font-[var(--font-disp)] text-[18px] tracking-[2px] text-accent">
              编辑面板
            </div>
            <div>
              <label className="block text-[12px] text-text-dim mb-1.5">
                面板名称
              </label>
              <input
                className="input w-full"
                autoFocus
                placeholder="例如：进行中、待审核..."
                value={editColName}
                onChange={(e) => setEditColName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveColumn()}
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
                      onClick={() => setEditColColor(c)}
                      className="w-7 h-7 rounded-[6px]"
                      style={{
                        border: editColColor === c ? "2px solid white" : "none",
                        background: c,
                        cursor: "pointer",
                        boxShadow: editColColor === c ? `0 0 0 2px ${c}` : "none",
                      }}
                    />
                  )
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2.5 mt-2">
              <button className="btn btn-ghost" onClick={() => setEditingColumn(null)}>
                取消
              </button>
              <button className="btn btn-primary" onClick={saveColumn}>
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

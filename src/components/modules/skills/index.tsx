import { useEffect, useState } from "react";
import { useStore } from "@/stores/app";
import {
  getSkillPaths,
  listSkillFiles,
  writeFile,
  openInFinder,
} from "@/services/fs";
import type { Skill, SkillPath } from "@/types";

const IDE_COLORS: Record<string, string> = {
  "Claude Code": "var(--accent)",
  "Cursor": "var(--accent2)",
  "VS Code": "#0078d4",
};

function ideColor(ide: string) {
  return IDE_COLORS[ide] ?? "var(--text-dim)";
}

function ideGroup(ide: string) {
  if (ide.toLowerCase().includes("claude")) return "Claude Code";
  if (ide.toLowerCase().includes("cursor")) return "Cursor";
  if (ide.toLowerCase().includes("code")) return "VS Code";
  return "Other";
}

const DEFAULT_TEMPLATE = `---
description: Describe what this skill does
---

# Skill Name

Your instructions here.
`;

export default function SkillsView() {
  const skills = useStore((s) => s.skills);
  const setSkills = useStore((s) => s.setSkills);

  const [skillPaths, setSkillPaths] = useState<SkillPath[]>([]);
  const [activeSkill, setActiveSkill] = useState<Skill | null>(null);
  const [editedContent, setEditedContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDir, setNewDir] = useState("");

  async function load() {
    try {
      console.log("Loading skills...");
      const paths = await getSkillPaths();
      console.log("Got paths:", paths);
      setSkillPaths(paths);
      const files = await listSkillFiles(paths.map((p) => p.path));
      console.log("Got files:", files.length);
      setSkills(files);
      console.log("Skills updated, total:", files.length);
    } catch (e: unknown) {
      console.error("Failed to load skills:", e);
      setError(String(e));
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (activeSkill) {
      setEditedContent(activeSkill.content);
    }
  }, [activeSkill]);

  // Group skills by IDE
  const grouped: Record<string, Skill[]> = {};
  for (const s of skills) {
    const g = ideGroup(s.ide);
    if (!grouped[g]) grouped[g] = [];
    grouped[g].push(s);
  }
  const groupOrder = ["Claude Code", "Cursor", "VS Code", "Other"];

  async function handleSave() {
    if (!activeSkill) return;
    setSaving(true);
    setError("");
    try {
      await writeFile(activeSkill.path, editedContent);
      setActiveSkill({ ...activeSkill, content: editedContent });
      await load();
    } catch (e: unknown) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  async function handleOpenFinder() {
    if (!activeSkill) return;
    const dir = activeSkill.path.replace(/\/[^/]+$/, "");
    await openInFinder(dir);
  }

  async function handleCreate() {
    if (!newName || !newDir) return;
    const filename = newName.endsWith(".md") ? newName : newName + ".md";
    const fullPath = newDir.replace(/\/$/, "") + "/" + filename;
    setError("");
    try {
      console.log("Creating skill:", fullPath);
      await writeFile(fullPath, DEFAULT_TEMPLATE);
      console.log("File created, reloading...");
      setShowNew(false);
      setNewName("");
      setNewDir("");
      await load();
      console.log("Reload complete");
    } catch (e: unknown) {
      console.error("Failed to create skill:", e);
      setError(String(e));
    }
  }

  return (
    <div className="flex gap-4 h-[calc(100vh-120px)]">
      {/* Left panel - file list */}
      <div
        className="panel shrink-0 flex flex-col overflow-hidden"
        style={{ width: 260 }}
      >
        <div
          className="flex gap-2 pb-3 px-4 border-b border-border"
        >
          <button className="btn btn-ghost flex-1" onClick={load}>
            刷新
          </button>
          <button
            className="btn btn-primary flex-1"
            onClick={() => {
              setShowNew(true);
              if (skillPaths.length > 0) setNewDir(skillPaths[0].path);
            }}
          >
            新建 Skill
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {groupOrder.map((group) => {
            const items = grouped[group];
            if (!items || items.length === 0) return null;
            return (
              <div key={group} className="mb-2">
                <div
                  className="label flex items-center gap-1.5 px-4 pt-2 pb-1"
                >
                  <span
                    className="shrink-0 rounded-full"
                    style={{
                      width: 6,
                      height: 6,
                      background: ideColor(group),
                      boxShadow: `0 0 6px ${ideColor(group)}`,
                    }}
                  />
                  {group}
                </div>
                {items.map((s) => (
                  <div
                    key={s.path}
                    onClick={() => setActiveSkill(s)}
                    className="flex items-center justify-between px-4 py-2 cursor-pointer transition-colors duration-100"
                    style={{
                      background:
                        activeSkill?.path === s.path
                          ? "rgba(0,200,255,0.08)"
                          : "transparent",
                      borderLeft:
                        activeSkill?.path === s.path
                          ? `2px solid ${ideColor(group)}`
                          : "2px solid transparent",
                    }}
                    onMouseEnter={(e) => {
                      if (activeSkill?.path !== s.path)
                        (e.currentTarget as HTMLElement).style.background =
                          "rgba(0,200,255,0.04)";
                    }}
                    onMouseLeave={(e) => {
                      if (activeSkill?.path !== s.path)
                        (e.currentTarget as HTMLElement).style.background =
                          "transparent";
                    }}
                  >
                    <div className="flex-1 overflow-hidden">
                      <div
                        className="font-medium text-sm overflow-hidden text-ellipsis whitespace-nowrap"
                      >
                        {s.title || s.name}
                      </div>
                      {s.description && (
                        <div
                          className="text-[10px] text-text-dim overflow-hidden text-ellipsis whitespace-nowrap mt-0.5"
                        >
                          {s.description}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
          {skills.length === 0 && (
            <div
              className="p-5 text-text-dim text-sm text-center"
            >
              没有发现 Skill 文件
            </div>
          )}
        </div>
      </div>

      {/* Right panel - editor */}
      <div
        className="panel flex-1 flex flex-col overflow-hidden"
      >
        {activeSkill ? (
          <>
            <div
              className="flex items-center gap-3 px-5 py-4 border-b border-border"
            >
              <div className="flex-1">
                <div
                  className="flex items-center gap-2.5 mb-1"
                >
                  <span className="text-base font-semibold">
                    {activeSkill.title || activeSkill.name}
                  </span>
                  <span
                    className="tag"
                    style={{
                      background: `${ideColor(ideGroup(activeSkill.ide))}18`,
                      color: ideColor(ideGroup(activeSkill.ide)),
                    }}
                  >
                    {ideGroup(activeSkill.ide)}
                  </span>
                </div>
                <div
                  className="text-[11px] text-text-dim font-mono"
                >
                  {activeSkill.path}
                </div>
              </div>
              <button
                className="btn btn-ghost"
                onClick={handleOpenFinder}
              >
                在 Finder 中打开
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? "保存中..." : "保存"}
              </button>
            </div>
            <textarea
              className="input flex-1 m-3 font-mono text-sm leading-relaxed resize-none rounded-sm"
            />
          </>
        ) : (
          <div
            className="flex-1 flex items-center justify-center text-text-dim text-sm"
          >
            从左侧选择一个 Skill 文件查看和编辑
          </div>
        )}
      </div>

      {/* Error display */}
      {error && (
        <div
          className="fixed bottom-5 right-5 p-[10px_16px] border border-accent4 rounded-sm text-[13px] z-[200] max-w-[400px]"
          style={{
            background: "rgba(255,107,107,0.15)",
            color: "var(--accent4)",
          }}
        >
          {error}
          <button
            className="ml-3 bg-none border-none cursor-pointer text-accent4 text-[13px]"
            onClick={() => setError("")}
          >
            x
          </button>
        </div>
      )}

      {/* New Skill Modal */}
      {showNew && (
        <div className="modal-overlay" onClick={() => setShowNew(false)}>
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
            style={{ minWidth: 420 }}
          >
            <div
              className="font-disp text-2xl tracking-widest text-accent mb-5"
            >
              新建 SKILL
            </div>
            <div
              className="flex flex-col gap-3.5"
            >
              <div>
                <div className="label mb-1.5">
                  文件名
                </div>
                <input
                  className="input"
                  placeholder="my-skill.md"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>
              <div>
                <div className="label mb-1.5">
                  保存目录
                </div>
                <select
                  className="input"
                  value={newDir}
                  onChange={(e) => setNewDir(e.target.value)}
                  style={{ cursor: "pointer" }}
                >
                  {skillPaths.map((sp) => (
                    <option key={sp.path} value={sp.path}>
                      {sp.ide} - {sp.path}
                    </option>
                  ))}
                </select>
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
                  disabled={!newName}
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
